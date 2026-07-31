// GET /api/cron/email-captured?secret=pfoten-cron-2024
//
// DE-Nurture-Sequenz fuer email_captured-Leads (pfoten-plan.de).
// Ersetzt den Brevo-UI-Automation-Workflow. 8 Stufen ab created_at:
//   +10 Min, +6 Std, +1..+7 Tage. Laeuft alle ~10 Min (fuer die 10-Min-Mail).
// Idempotent (Flag pro Stufe in answers), stoppt automatisch bei Kauf
// (status wechselt weg von email_captured). PL unberuehrt — strikt NICHT-pl.
//
// Schalter: sendet an ECHTE Leads erst mit EC_SEQUENCE_LIVE=1 in Vercel.
// Vorher nur ?preview=mail@x (alle 8 an eine Adresse) · ?email= · ?dry=1.

import { NextRequest, NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import { sendEmailCapturedMail, type EcStage } from "@/lib/email-captured-sequence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";

const STAGE_WINDOWS: { stage: EcStage; minH: number; maxH: number }[] = [
  { stage: 1, minH: 10 / 60, maxH: 6 },
  { stage: 2, minH: 6, maxH: 24 },
  { stage: 3, minH: 24, maxH: 48 },
  { stage: 4, minH: 48, maxH: 72 },
  { stage: 5, minH: 72, maxH: 96 },
  { stage: 6, minH: 96, maxH: 120 },
  { stage: 7, minH: 120, maxH: 156 },
  { stage: 8, minH: 156, maxH: 264 },
];

function pickStage(createdAt: string): EcStage | null {
  const ageH = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  for (const w of STAGE_WINDOWS) {
    if (ageH >= w.minH && ageH < w.maxH) return w.stage;
  }
  return null;
}

const flagKey = (s: EcStage) => `ec_seq_stage${s}_sent_at`;

// Anti-Doppel: max 1 Mail pro 4h (blockt versehentliche Doppel-Laeufe,
// faengt aber nie eine faellige Stufe ab — die liegen >=5h auseinander).
function recentlySent(answers: any): boolean {
  const cutoff = Date.now() - 4 * 3_600_000;
  for (let s = 1; s <= 8; s++) {
    const ts = answers?.[`ec_seq_stage${s}_sent_at`];
    if (ts && new Date(ts).getTime() > cutoff) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Vorschau: alle 8 Mails an eine Test-Adresse (Review vor Live).
  const preview = searchParams.get("preview")?.toLowerCase();
  if (preview) {
    const out: any[] = [];
    for (let s = 1 as EcStage; s <= 8; s = (s + 1) as EcStage) {
      const r = await sendEmailCapturedMail(s, {
        to: preview,
        dogName: searchParams.get("dog") || "Balu",
        dogProblem: searchParams.get("problem") || "pulling",
        dogBreed: searchParams.get("breed") || "labrador",
        dogAge: searchParams.get("age") || "adult",
        leadId: null,
      });
      out.push({ stage: s, ok: r.ok, reason: r.reason });
    }
    return NextResponse.json({ ok: true, preview, sent: out });
  }

  const dryRun = searchParams.get("dry") === "1";
  const emailFilter = searchParams.get("email")?.toLowerCase();

  // Sicherheits-Schalter + Go-Live-Grenze:
  //  - leer/ungesetzt  -> schlafend (kein Versand an echte Leads)
  //  - "1"             -> live OHNE Grenze (nur fuer Tests/Flexibilitaet)
  //  - Datum (ISO)     -> live, aber NUR Leads ab diesem Datum. So faengt der
  //    Umschalt-Cron NICHT den ganzen Backlog der letzten Tage auf einmal ab
  //    (kein Burst, kein Doppel mit dem auslaufenden Brevo-Workflow).
  const liveVal = (process.env.EC_SEQUENCE_LIVE || "").trim();
  const live = liveVal !== "";
  if (!live && !emailFilter && !dryRun) {
    return NextResponse.json({
      ok: true,
      disabled: true,
      reason:
        "EC_SEQUENCE_LIVE leer — setze ein Startdatum (z.B. 2026-07-28) fuer sauberen Livegang, oder 1 fuer Test ohne Grenze",
    });
  }
  let startCutoff: string | null = null;
  if (live && liveVal !== "1") {
    const d = new Date(liveVal);
    if (!isNaN(d.getTime())) startCutoff = d.toISOString();
  }

  const admin = createMemberAdminClient();

  // Fenster: 10 Min alt bis 11 Tage alt. Bei gesetzter Go-Live-Grenze ab dem
  // spaeteren der beiden (Startdatum), damit kein alter Backlog erwischt wird.
  const elevenDaysAgo = new Date(Date.now() - 11 * 86_400_000).toISOString();
  const from = startCutoff && startCutoff > elevenDaysAgo ? startCutoff : elevenDaysAgo;
  const until = new Date(Date.now() - 10 * 60_000).toISOString();

  let query = admin
    .from("wauwerk_leads")
    .select("id, email, dog_name, status, answers, created_at")
    .not("email", "is", null)
    .eq("status", "email_captured");

  if (emailFilter) {
    query = query.ilike("email", emailFilter);
  } else {
    query = query
      .gte("created_at", from)
      .lte("created_at", until)
      .order("created_at", { ascending: false })
      .limit(80);
  }

  const { data: leads, error } = await query;
  if (error) {
    console.error("[email-captured] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: any[] = [];
  let sent = 0,
    skipped = 0,
    failed = 0;

  for (const lead of leads || []) {
    const answers = lead.answers || {};

    // STRIKT DE: nur deutsche Leads. PL laeuft ueber pl-nurture, IT ueber
    // it-nurture — alle Nicht-DE-Sprachen hier ausschliessen.
    const leadLang = String(answers.lang || "").toLowerCase();
    if (leadLang && leadLang !== "de") {
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
      results.push({ id: lead.id, email: lead.email, would_send: stage, dog: lead.dog_name });
      continue;
    }

    const res = await sendEmailCapturedMail(stage, {
      to: lead.email,
      dogName: lead.dog_name || answers.dog_name || null,
      dogProblem: answers.dog_problem || null,
      dogBreed: answers.dog_breed || null,
      dogAge: answers.dog_age || null,
      leadId: lead.id,
    });

    if (res.ok) {
      sent++;
      // Fresh-Read + Merge: nur das Flag additiv setzen, damit ein zeitgleicher
      // Kauf-Webhook (der answers/status aendert) NICHT ueberschrieben wird.
      const { data: fresh } = await admin
        .from("wauwerk_leads")
        .select("answers")
        .eq("id", lead.id)
        .single();
      const merged = { ...(fresh?.answers || answers), [flagKey(stage)]: new Date().toISOString() };
      const { error: uErr } = await admin
        .from("wauwerk_leads")
        .update({ answers: merged })
        .eq("id", lead.id);
      if (uErr) console.warn(`[email-captured] flag update failed ${lead.id}:`, uErr.message);
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
