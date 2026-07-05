// GET /api/cron/warm-recovery-backlog?secret=pfoten-cron-2024[&dry=1]
//
// EINMALIGE Backlog-Rückholung: der normale warm-recovery-drip greift nur für
// Leads 2h–14 Tage alt (pickStage gibt >14T = null). Dadurch blieben ältere
// pending/failed-Abbrecher, die nie eine Erinnerung bekamen, unberührt.
//
// Dieser Cron schickt genau EINE weiche Last-Call-Mail (Stage 5, kein Druck,
// kein Rabatt, 30-Tage-Garantie) an pending/failed-Leads, die:
//   - eine E-Mail haben
//   - zwischen MIN_AGE_DAYS und MAX_AGE_DAYS alt sind (warm, nicht uralt)
//   - noch KEIN warm_recovery-Flag haben (weder Drip-Stage noch Backlog)
//   - nicht abgemeldet sind
// Gepaced über BATCH/Lauf, damit die Domain-Reputation (Login-/Plan-Mails!)
// nicht leidet. Idempotent via answers.warm_recovery_backlog_sent_at.

import { NextRequest, NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import { sendWarmRecoveryMail } from "@/lib/warm-recovery-mail";
import { syncWarmRecoveryLists } from "@/lib/brevo-contacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";
const MIN_AGE_DAYS = 14;   // jünger deckt der normale Drip ab
const MAX_AGE_DAYS = 90;   // älter = zu kalt (90–180T evtl. später als 2. Welle)
const BATCH = 30;          // pro Lauf — mit Cron alle 4h ~180/Tag (bewusst langsam)
const STAGE = 5 as const;  // Soft Last-Call
const FLAG = "warm_recovery_backlog_sent_at";

function hasAnyRecoveryFlag(answers: any): boolean {
  if (answers?.[FLAG]) return true;
  for (let s = 1; s <= 5; s++) if (answers?.[`warm_recovery_stage${s}_sent_at`]) return true;
  return false;
}
function isUnsubscribed(answers: any): boolean {
  return !!(answers?.unsubscribed || answers?.unsubscribed_at || answers?.unsub);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = searchParams.get("dry") === "1";
  const admin = createMemberAdminClient();

  const from = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000).toISOString();
  const until = new Date(Date.now() - MIN_AGE_DAYS * 86_400_000).toISOString();

  // Das ganze Fenster laden (14–90T sind ~700 Zeilen), in-Code filtern.
  const { data, error } = await admin
    .from("wauwerk_leads")
    .select("id, email, dog_name, status, selected_plan, ab_variant, answers, created_at")
    .not("email", "is", null)
    .in("status", ["pending", "failed"])
    .gte("created_at", from)
    .lte("created_at", until)
    .order("created_at", { ascending: true }) // älteste zuerst rausholen
    .limit(1500);
  if (error) {
    console.error("[warm-recovery-backlog] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const eligible = (data || []).filter((l) => {
    const a = l.answers || {};
    return !hasAnyRecoveryFlag(a) && !isUnsubscribed(a);
  });
  const todo = eligible.slice(0, BATCH);

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      window: `${MIN_AGE_DAYS}-${MAX_AGE_DAYS}d`,
      eligibleTotal: eligible.length,
      wouldSendNow: todo.length,
      sample: todo.slice(0, 10).map((l) => ({ id: l.id, email: l.email, dog: l.dog_name, created: l.created_at })),
    });
  }

  let sent = 0;
  let failed = 0;
  const results: any[] = [];
  for (const lead of todo) {
    const answers = lead.answers || {};
    syncWarmRecoveryLists(lead.email).catch((e) =>
      console.warn(`[warm-recovery-backlog] Brevo sync failed for ${lead.email}:`, e?.message)
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
      STAGE
    );
    if (sendRes.ok) {
      sent++;
      const { error: updErr } = await admin
        .from("wauwerk_leads")
        .update({ answers: { ...answers, [FLAG]: new Date().toISOString() } })
        .eq("id", lead.id);
      if (updErr) console.warn(`[warm-recovery-backlog] flag update failed for ${lead.id}:`, updErr.message);
      results.push({ id: lead.id, email: lead.email, sent: true });
    } else {
      failed++;
      results.push({ id: lead.id, email: lead.email, error: sendRes.reason });
    }
  }

  return NextResponse.json({
    ok: true,
    window: `${MIN_AGE_DAYS}-${MAX_AGE_DAYS}d`,
    eligibleTotal: eligible.length,
    batch: BATCH,
    sent,
    failed,
    remaining: Math.max(0, eligible.length - sent),
    results,
  });
}
