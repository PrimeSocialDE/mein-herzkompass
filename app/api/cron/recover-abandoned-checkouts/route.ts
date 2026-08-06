// GET /api/cron/recover-abandoned-checkouts?secret=pfoten-cron-2024
//
// Cron alle 5 Min (in vercel.json eingetragen). Sucht Leads mit:
//   - created_at zwischen vor 10 Min und 24h (Window — nicht zu frueh, aber
//     weit genug fuer Langueberleger + spaet gesetzte "pending"-Abbrecher)
//   - email gesetzt
//   - status IN (checkout_started, pending, failed, cancelled) — also echte
//     Checkout-Abbrecher; NICHT email_captured (Nurture-Sequenz) und nicht paid
//   - answers.recovery_mail_sent_at NICHT gesetzt (Idempotenz)
//   - Versand via Brevo (sendCheckoutRecoveryMail ohne transactional-Flag)
//
// Schickt EINE Magic-Link-Mail mit Dashboard-Link, setzt das Sent-Flag.
// Idempotent — wird nur einmal pro Lead geschickt.
//
// Optional: ?email=foo@bar.de — nur diesen Lead verarbeiten (manueller
// Test, Time-Window wird ignoriert).

import { NextRequest, NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import { sendCheckoutRecoveryMail } from "@/lib/member-mail";
import { langFromLead } from "@/lib/lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";

const PROBLEM_LABELS: Record<string, string> = {
  pulling: "Leinenziehen",
  barking: "Übermäßiges Bellen",
  aggression: "Aggression in Begegnungen",
  anxiety: "Trennungsangst",
  jumping: "Anspringen von Menschen",
  recall: "Unzuverlässiger Rückruf",
  energy: "Zu viel Energie",
  destructive: "Zerstörungsverhalten",
  soiling: "Stubenunreinheit",
  mouthing: "Aufnehmen vom Boden",
};

function planLengthFromSelected(selected: string | null): 1 | 3 | 6 {
  if (selected === "1month") return 1;
  if (selected === "6month") return 6;
  return 3;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dryRun = searchParams.get("dry") === "1";
  const emailFilter = searchParams.get("email")?.toLowerCase();
  // Test-Mode: ignoriert status-paid-Filter UND Test-Email-Filter UND
  // Idempotenz-Flag. Schickt Mail an die angegebene Email auch wenn der
  // User schon paid ist / Recovery-Mail schon raus war. NUR fuer Tests.
  const testMode = searchParams.get("test") === "1" && !!emailFilter;
  const admin = createMemberAdminClient();

  // Lead-Window: nicht zu frueh (User braucht 5-10 Min am Checkout),
  // Fenster auf 24h geweitet (vorher 30 Min) — faengt auch Langueberleger
  // + spaeter (per Webhook) auf "pending" gesetzte Abbrecher. Das Idempotenz-
  // Flag (recovery_mail_sent_at) verhindert Doppel-Mails, .limit(50)/Lauf
  // drosselt (alle 5 Min -> max ~600/h, Backlog wird abgetragen).
  const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
  const windowStart = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  let query = admin
    .from("wauwerk_leads")
    .select(
      "id, email, dog_name, status, selected_plan, answers, created_at"
    )
    .not("email", "is", null);
  if (!testMode) {
    // NUR echte Checkout-Abbrecher — NICHT email_captured (die bekommen die
    // Nurture-Sequenz) und nicht paid. Sonst wuerde das 24h-Fenster
    // Top-of-Funnel-Leads mit "Kauf abschliessen"-Mails zuspammen.
    query = query.in("status", [
      "checkout_started",
      "pending",
      "failed",
      "cancelled",
    ]);
  }

  if (emailFilter) {
    query = query.ilike("email", emailFilter);
  } else {
    query = query
      .lte("created_at", tenMinAgo)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false })
      .limit(50);
  }

  const { data: leads, error } = await query;
  if (error) {
    console.error("[recover-cron] fetch error:", error.message);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  const stats = {
    candidates: leads?.length || 0,
    sent: 0,
    skipped_already_sent: 0,
    skipped_no_email: 0,
    skipped_test_email: 0,
    failed: 0,
    dry_run: dryRun,
  };

  for (const lead of leads || []) {
    if (!lead.email) {
      stats.skipped_no_email++;
      continue;
    }
    // Test-Emails ueberspringen (im testMode: nicht skippen)
    if (!testMode) {
      const isTest =
        /^test@|@test\.|^example@|@example\./i.test(lead.email) ||
        lead.email === "test@test.de";
      if (isTest) {
        stats.skipped_test_email++;
        continue;
      }
    }

    const answers = (lead.answers || {}) as Record<string, any>;
    if (answers.recovery_mail_sent_at && !testMode) {
      stats.skipped_already_sent++;
      continue;
    }

    if (dryRun) {
      stats.sent++;
      continue;
    }

    const problemKey =
      answers.dog_problem || answers.problem || answers.main_problem || null;
    const problemLabel = problemKey ? PROBLEM_LABELS[problemKey] || null : null;
    const planLengthMonths = planLengthFromSelected(lead.selected_plan);

    try {
      const res = await sendCheckoutRecoveryMail({
        to: lead.email,
        dogName: lead.dog_name || answers.dog_name || null,
        problemLabel,
        planLengthMonths,
        leadId: lead.id,
        // Test-Mode forciert Free-View im Dashboard. Production-Cron
        // (testMode=false): User ist sowieso non-paid → kein Override.
        previewFreeView: testMode,
        lang: langFromLead(lead),
      });
      if (res.ok) {
        stats.sent++;
        // Idempotenz-Flag setzen
        await admin
          .from("wauwerk_leads")
          .update({
            answers: {
              ...answers,
              recovery_mail_sent_at: new Date().toISOString(),
            },
          })
          .eq("id", lead.id);
      } else {
        stats.failed++;
        console.warn(
          "[recover-cron] mail-send failed:",
          lead.email,
          (res as any).reason
        );
      }
    } catch (e: any) {
      stats.failed++;
      console.error("[recover-cron] exception:", lead.email, e?.message);
    }
  }

  return NextResponse.json({ ok: true, stats });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
