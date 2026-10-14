// GET /api/cron/warm-recovery-drip?secret=pfoten-cron-2024
//
// Cron alle 30 Min. Sucht Leads mit status=pending oder status=failed
// und schickt die passende Stage-Mail (1/2/3/4/5) basierend auf paid_at-Alter.
//
// Stages (relativ zu created_at):
//   1) >= 2h     und < 24h    → Stage 1 (Soft Reminder)
//   2) >= 24h    und < 72h    → Stage 2 (Story)
//   3) >= 72h    und < 5d     → Stage 3 (Trainer-Brief)
//   4) >= 5d     und < 7d     → Stage 4 (FAQ)
//   5) >= 7d     und < 14d    → Stage 5 (Last-Call + Discount)
//
// Suppression:
//   - Lead muss noch status pending/failed haben (paid → automatisch entfernt)
//   - answers.warm_recovery_stageN_sent_at darf nicht gesetzt sein
//   - Wenn andere Stage in letzten 20h gesendet → skip (kein Spam-Tag)
//
// Optional: ?email=foo@bar.de für manuellen Test einzelner Leads.
//
// 14.10.2026 Fix: vorher .limit(40) OHNE Sortierung -> pro Lauf immer dieselben
// ~40 Zeilen, aeltere Leads wurden nie geladen. Ergebnis seit August: Stage 1
// an ~1.600 Leads, Stage 3 an 220, Stage 4/5 an je 4. Jetzt: alle faelligen
// Leads paginiert, aeltester zuerst, Sende-Deckel pro Lauf. Dazu Kaeufer-Sperre
// per E-Mail (Kaeufer legen meist eine neue Lead-Zeile an, die abgebrochene
// bleibt auf pending/failed) und max. 1 Mail je E-Mail und 20h.

import { NextRequest, NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import {
  sendWarmRecoveryMail,
  type WarmRecoveryStage,
} from "@/lib/warm-recovery-mail";
import { syncWarmRecoveryLists } from "@/lib/brevo-contacts";
import { langFromLead } from "@/lib/lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";

const STAGE_WINDOWS: { stage: WarmRecoveryStage; minHours: number; maxHours: number }[] = [
  { stage: 1, minHours: 2,   maxHours: 24 },
  { stage: 2, minHours: 24,  maxHours: 72 },
  { stage: 3, minHours: 72,  maxHours: 120 },  // 5 Tage
  { stage: 4, minHours: 120, maxHours: 168 },  // 7 Tage
  { stage: 5, minHours: 168, maxHours: 336 },  // 14 Tage
];

function pickStage(createdAt: string): WarmRecoveryStage | null {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  for (const w of STAGE_WINDOWS) {
    if (ageHours >= w.minHours && ageHours < w.maxHours) return w.stage;
  }
  return null;
}

function stageFlagKey(stage: WarmRecoveryStage): string {
  return `warm_recovery_stage${stage}_sent_at`;
}

// Anti-Spam: maximal 1 Warm-Mail pro 20h. Falls schon eine Stage in den
// letzten 20h gesendet wurde → skip alle Stages diese Runde.
function recentlySentAnyStage(answers: any): boolean {
  const cutoff = Date.now() - 20 * 3_600_000;
  for (let s = 1; s <= 5; s++) {
    const ts = answers?.[`warm_recovery_stage${s}_sent_at`];
    if (ts && new Date(ts).getTime() > cutoff) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dryRun = searchParams.get("dry") === "1";
  const emailFilter = searchParams.get("email")?.toLowerCase();
  const admin = createMemberAdminClient();

  // Window: 2h alt bis 14 Tage alt
  const lookbackUntil = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const lookbackFrom = new Date(Date.now() - 14 * 86_400_000).toISOString();

  // Pro Lauf max. so viele echte Sends (jede Mail generiert einen KI-Text,
  // maxDuration 300 s). Bei 48 Laeufen/Tag reicht das weit fuer den Bestand.
  const MAX_SENDS_PER_RUN = 40;
  const PAGE = 1000;

  const base = () =>
    admin
      .from("wauwerk_leads")
      .select(
        "id, email, dog_name, status, selected_plan, ab_variant, answers, created_at"
      )
      .not("email", "is", null)
      .in("status", ["pending", "failed"]);

  const leads: any[] = [];
  if (emailFilter) {
    const { data, error } = await base().ilike("email", emailFilter);
    if (error) {
      console.error("[warm-recovery-drip] query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    leads.push(...(data || []));
  } else {
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await base()
        .lte("created_at", lookbackUntil)
        .gte("created_at", lookbackFrom)
        .order("created_at", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) {
        console.error("[warm-recovery-drip] query error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      leads.push(...data);
      if (data.length < PAGE) break;
    }
  }

  // Kaeufer-Sperre: E-Mails mit bezahltem Lead (ab 90 Tage vor dem Fenster).
  const paidEmails = new Set<string>();
  {
    const paidFrom = new Date(new Date(lookbackFrom).getTime() - 90 * 86_400_000).toISOString();
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await admin
        .from("wauwerk_leads")
        .select("email")
        .eq("status", "paid")
        .gte("created_at", paidFrom)
        .order("created_at", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) {
        // Ohne Kaeufer-Liste lieber gar nicht senden als Kaeufer anzuschreiben.
        console.error("[warm-recovery-drip] paid query error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      for (const r of data) if (r.email) paidEmails.add(String(r.email).trim().toLowerCase());
      if (data.length < PAGE) break;
    }
  }

  // Pro E-Mail max. 1 Warm-Mail je 20h, auch ueber mehrere Lead-Zeilen hinweg
  // (Abbrecher haben oft eine pending- UND eine failed-Zeile).
  const lastSentByEmail = new Map<string, number>();
  for (const l of leads) {
    const e = String(l.email || "").trim().toLowerCase();
    for (let s = 1; s <= 5; s++) {
      const ts = l.answers?.[`warm_recovery_stage${s}_sent_at`];
      if (ts) lastSentByEmail.set(e, Math.max(lastSentByEmail.get(e) || 0, new Date(ts).getTime()));
    }
  }

  const results: any[] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const lead of leads) {
    if (!dryRun && sent >= MAX_SENDS_PER_RUN) break;
    const stage = pickStage(lead.created_at);
    if (!stage) {
      skipped++;
      results.push({ id: lead.id, email: lead.email, skip: "no_stage_window" });
      continue;
    }

    const answers = lead.answers || {};
    const flagKey = stageFlagKey(stage);

    if (answers[flagKey]) {
      skipped++;
      results.push({ id: lead.id, email: lead.email, skip: `stage_${stage}_already_sent` });
      continue;
    }

    if (recentlySentAnyStage(answers)) {
      skipped++;
      results.push({ id: lead.id, email: lead.email, skip: "anti_spam_20h" });
      continue;
    }

    const emailKey = String(lead.email || "").trim().toLowerCase();
    if (paidEmails.has(emailKey)) {
      skipped++;
      results.push({ id: lead.id, email: lead.email, skip: "already_customer" });
      continue;
    }
    if ((lastSentByEmail.get(emailKey) || 0) > Date.now() - 20 * 3_600_000) {
      skipped++;
      results.push({ id: lead.id, email: lead.email, skip: "anti_spam_same_email" });
      continue;
    }

    if (dryRun) {
      sent++;
      lastSentByEmail.set(emailKey, Date.now());
      results.push({
        id: lead.id,
        email: lead.email,
        would_send_stage: stage,
        dog: lead.dog_name,
        problem: answers.dog_problem,
      });
      continue;
    }

    // Brevo-Listen-Sync — User aus Nurture raus, Warm-Recovery rein.
    // Idempotent — kein Schaden wenn schon vorher synced.
    syncWarmRecoveryLists(lead.email).catch((e) =>
      console.warn(
        `[warm-recovery-drip] Brevo sync failed for ${lead.email}:`,
        e?.message
      )
    );

    const sendRes = await sendWarmRecoveryMail(
      {
        to: lead.email,
        dogName: lead.dog_name || answers.dog_name || null,
        dogBreed: answers.dog_breed || null,
        dogAge: answers.dog_age || null,
        dogProblem: answers.dog_problem || null,
        customProblem: answers.custom_problem_text || null,
        selectedPlan: lead.selected_plan,
        leadId: lead.id,
        abVariant: lead.ab_variant as "A" | "B" | null,
      },
      stage,
      langFromLead(lead)
    );

    if (sendRes.ok) {
      sent++;
      lastSentByEmail.set(emailKey, Date.now());
      // Flag setzen — Fresh-Read + Merge, damit ein zeitgleicher Kauf-Webhook
      // (der answers/status aendert) nicht ueberschrieben wird.
      const { data: fresh } = await admin
        .from("wauwerk_leads")
        .select("answers")
        .eq("id", lead.id)
        .single();
      const updatedAnswers = {
        ...(fresh?.answers || answers),
        [flagKey]: new Date().toISOString(),
      };
      const { error: updErr } = await admin
        .from("wauwerk_leads")
        .update({ answers: updatedAnswers })
        .eq("id", lead.id);
      if (updErr) {
        console.warn(
          `[warm-recovery-drip] flag update failed for ${lead.id}:`,
          updErr.message
        );
      }
      results.push({
        id: lead.id,
        email: lead.email,
        sent_stage: stage,
        ai_used: sendRes.aiUsed,
        dog: lead.dog_name,
      });
    } else {
      failed++;
      results.push({
        id: lead.id,
        email: lead.email,
        stage,
        error: sendRes.reason,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    counted: leads.length,
    sent,
    skipped,
    failed,
    results,
  });
}
