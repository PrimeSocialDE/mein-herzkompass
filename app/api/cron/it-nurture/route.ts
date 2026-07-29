// GET /api/cron/it-nurture?secret=pfoten-cron-2024
//
// IT-Nurture-Sequenz fuer email_captured-Leads mit lang=it (zampaplan.it).
// 8 Stufen ab created_at: +10 Min, +6 Std, +1..+6 Tage.
// Laeuft alle ~10 Min (fuer die 10-Min-Mail). Idempotent (Flag pro Stufe in
// answers), stoppt automatisch bei Kauf (Status wechselt weg von
// email_captured). DE/PL unberuehrt — Query filtert strikt auf lang=it.
//
// Optional: ?email=foo@bar.it (Einzel-Test) · ?dry=1 (nur zeigen)
//           · ?preview=foo@bar.it (alle 8 Mails an Test-Adresse).
//
// Sicherheits-Schalter: sendet an ECHTE Leads erst bei IT_NURTURE_LIVE=1.
// Bis dahin (DNS + Brevo-Absender zampaplan.it noch nicht live) nur
// Vorschau/Einzeltest/dry.

import { NextRequest, NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import { sendItNurtureMail, type ItNurtureStage } from "@/lib/it-nurture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";

const STAGE_WINDOWS: { stage: ItNurtureStage; minH: number; maxH: number }[] = [
  { stage: 1, minH: 10 / 60, maxH: 6 },
  { stage: 2, minH: 6, maxH: 24 },
  { stage: 3, minH: 24, maxH: 48 },
  { stage: 4, minH: 48, maxH: 72 },
  { stage: 5, minH: 72, maxH: 96 },
  { stage: 6, minH: 96, maxH: 120 },
  { stage: 7, minH: 120, maxH: 144 },
  { stage: 8, minH: 144, maxH: 264 },
];

function pickStage(createdAt: string): ItNurtureStage | null {
  const ageH = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  for (const w of STAGE_WINDOWS) {
    if (ageH >= w.minH && ageH < w.maxH) return w.stage;
  }
  return null;
}

const flagKey = (s: ItNurtureStage) => `it_nurture_stage${s}_sent_at`;

// Anti-Spam: max 1 Nurture-Mail pro 4h (Stufe 1->2 liegt ~5h50 auseinander,
// tägliche Stufen 24h — 4h blockt also nie eine fällige Stufe, faengt aber
// versehentliche Doppel-Laeufe ab).
function recentlySent(answers: any): boolean {
  const cutoff = Date.now() - 4 * 3_600_000;
  for (let s = 1 as number; s <= 8; s++) {
    const ts = answers?.[`it_nurture_stage${s}_sent_at`];
    if (ts && new Date(ts).getTime() > cutoff) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Vorschau: alle 8 Mails an eine Test-Adresse schicken (Review vor Live).
  const preview = searchParams.get("preview")?.toLowerCase();
  if (preview) {
    const out: any[] = [];
    for (let s = 1 as ItNurtureStage; s <= 8; s = (s + 1) as ItNurtureStage) {
      const r = await sendItNurtureMail(s, {
        to: preview,
        dogName: searchParams.get("dog") || "Rex",
        dogProblem: searchParams.get("problem") || "energy",
        leadId: null,
      });
      out.push({ stage: s, ok: r.ok, reason: r.reason });
    }
    return NextResponse.json({ ok: true, preview, sent: out });
  }

  const dryRun = searchParams.get("dry") === "1";
  const emailFilter = searchParams.get("email")?.toLowerCase();

  // Sicherheits-Schalter: Der geplante Cron sendet an ECHTE Leads erst, wenn
  // IT_NURTURE_LIVE=1 in Vercel gesetzt ist. Vorher nur Vorschau/Einzeltest/dry.
  // So kann die Sequenz reviewt werden, bevor sie 8 Mails an echte IT-Leads
  // schickt. Nach dem Review (und wenn zampaplan.it-DNS + Brevo-Absender live
  // sind): IT_NURTURE_LIVE=1 setzen -> live.
  const live = process.env.IT_NURTURE_LIVE === "1";
  if (!live && !emailFilter && !dryRun) {
    return NextResponse.json({
      ok: true,
      disabled: true,
      reason: "IT_NURTURE_LIVE!=1 — setze die Env-Var auf 1 um live zu gehen",
    });
  }

  const admin = createMemberAdminClient();

  // Fenster: 10 Min alt bis 11 Tage alt.
  const from = new Date(Date.now() - 11 * 86_400_000).toISOString();
  const until = new Date(Date.now() - 10 * 60_000).toISOString();

  let query = admin
    .from("wauwerk_leads")
    .select("id, email, dog_name, status, answers, created_at")
    .not("email", "is", null)
    .eq("status", "email_captured")
    .contains("answers", { lang: "it" }); // STRIKT nur IT — DE/PL unberuehrt

  if (emailFilter) {
    query = query.ilike("email", emailFilter);
  } else {
    query = query
      .gte("created_at", from)
      .lte("created_at", until)
      .order("created_at", { ascending: false })
      .limit(60);
  }

  const { data: leads, error } = await query;
  if (error) {
    console.error("[it-nurture] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: any[] = [];
  let sent = 0,
    skipped = 0,
    failed = 0;

  for (const lead of leads || []) {
    const answers = lead.answers || {};
    // Doppelte Sicherheit: nur echte IT-Leads.
    if (answers.lang !== "it") {
      skipped++;
      continue;
    }

    const stage = pickStage(lead.created_at);
    if (!stage) {
      skipped++;
      results.push({ id: lead.id, skip: "no_window" });
      continue;
    }
    if (answers[flagKey(stage)]) {
      skipped++;
      results.push({ id: lead.id, skip: `stage_${stage}_sent` });
      continue;
    }
    if (recentlySent(answers)) {
      skipped++;
      results.push({ id: lead.id, skip: "anti_spam_4h" });
      continue;
    }

    if (dryRun) {
      sent++;
      results.push({
        id: lead.id,
        email: lead.email,
        would_send: stage,
        dog: lead.dog_name,
      });
      continue;
    }

    const res = await sendItNurtureMail(stage, {
      to: lead.email,
      dogName: lead.dog_name || answers.dog_name || null,
      dogProblem: answers.dog_problem || null,
      leadId: lead.id,
    });

    if (res.ok) {
      sent++;
      const updated = { ...answers, [flagKey(stage)]: new Date().toISOString() };
      const { error: uErr } = await admin
        .from("wauwerk_leads")
        .update({ answers: updated })
        .eq("id", lead.id);
      if (uErr)
        console.warn(`[it-nurture] flag update failed ${lead.id}:`, uErr.message);
      results.push({ id: lead.id, email: lead.email, sent_stage: stage });
    } else {
      failed++;
      results.push({ id: lead.id, email: lead.email, stage, error: res.reason });
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    counted: leads?.length || 0,
    sent,
    skipped,
    failed,
    results,
  });
}
