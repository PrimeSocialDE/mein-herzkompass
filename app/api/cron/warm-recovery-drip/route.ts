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

import { NextRequest, NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import {
  sendWarmRecoveryMail,
  type WarmRecoveryStage,
} from "@/lib/warm-recovery-mail";
import { syncWarmRecoveryLists } from "@/lib/brevo-contacts";

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

  let query = admin
    .from("wauwerk_leads")
    .select(
      "id, email, dog_name, status, selected_plan, ab_variant, answers, created_at"
    )
    .not("email", "is", null)
    .in("status", ["pending", "failed"]);

  if (emailFilter) {
    query = query.ilike("email", emailFilter);
  } else {
    query = query
      .lte("created_at", lookbackUntil)
      .gte("created_at", lookbackFrom)
      .limit(40);
  }

  const { data: leads, error } = await query;
  if (error) {
    console.error("[warm-recovery-drip] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: any[] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const lead of leads || []) {
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

    if (dryRun) {
      sent++;
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
      stage
    );

    if (sendRes.ok) {
      sent++;
      // Flag setzen — answers JSONB-Merge muss komplette answers behalten
      const updatedAnswers = {
        ...answers,
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
    counted: leads?.length || 0,
    sent,
    skipped,
    failed,
    results,
  });
}
