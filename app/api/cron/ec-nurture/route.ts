// Tägliche Cron für die email_captured-Nurture (problem-personalisiert, Mails 101–104).
//
// Auth: ?secret=$CRON_SECRET
//       oder ?email=foo@bar.de für Einzel-Test (überspringt Idempotenz mit force=1)
//
// SICHERHEIT gegen Doppel-Mails: Der Massen-Versand ist gated hinter
// EC_SEQUENCE_LIVE=1. Solange die generische Brevo-Automation für email_captured
// noch läuft, bleibt EC_SEQUENCE_LIVE ungesetzt → diese Cron sendet NICHTS an die
// Masse. Einzel-Test (?email=...) und ?dry=1 funktionieren trotzdem, damit du
// die Mails prüfen kannst, bevor du live gehst.
//
// Logik:
//   1) Hole email_captured-Leads der letzten 14 Tage (created_at)
//   2) Skip wenn abgemeldet (answers.unsubscribed / email_sequence_unsubscribed_at)
//      oder inzwischen gekauft (status != email_captured)
//   3) daysAfterCaptured = heute - created_at
//   4) fällige Mail (getDueEcMail 101–104)
//   5) Skip wenn schon in answers.ec_sequence_sent[]
//   6) Sende via sendSequenceMail (SES→Brevo), markiere in answers.ec_sequence_sent[]

import { NextRequest, NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import {
  EC_SEQUENCE_SCHEDULE,
  getDueEcMail,
  sendSequenceMail,
  type SequenceLead,
} from "@/lib/email-sequence";
import { langFromLead } from "@/lib/lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const emailFilter = searchParams.get("email")?.toLowerCase();
  const force = searchParams.get("force") === "1";
  const dryRun = searchParams.get("dry") === "1";

  // Kill-Switch: Massen-Versand nur wenn EC_SEQUENCE_LIVE=1. Einzel-Test/dry immer erlaubt.
  const live = process.env.EC_SEQUENCE_LIVE === "1";
  if (!live && !emailFilter && !dryRun) {
    return NextResponse.json({
      ok: true,
      dormant: true,
      hint: "EC_SEQUENCE_LIVE!=1 → Massen-Versand aus. Test: ?secret=...&email=du@example.de&force=1",
      schedule: EC_SEQUENCE_SCHEDULE,
    });
  }

  const admin = createMemberAdminClient();

  // Window: 14 Tage zurück (letzte Mail = Tag 9, +Toleranz)
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();

  let query = admin
    .from("wauwerk_leads")
    .select("id, email, dog_name, selected_plan, created_at, status, answers")
    .gte("created_at", since)
    .not("email", "is", null);

  if (emailFilter) {
    query = query.ilike("email", emailFilter);
  } else {
    query = query.eq("status", "email_captured").limit(300);
  }

  const { data: leads, error } = await query;
  if (error) {
    console.error("[ec-nurture-cron] fetch error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const stats = {
    live,
    candidates: leads?.length || 0,
    sent: 0,
    skipped_not_captured: 0,
    skipped_unsubscribed: 0,
    skipped_already_sent: 0,
    skipped_no_due_mail: 0,
    skipped_too_fresh: 0,
    skipped_no_content: 0,
    skipped_test_email: 0,
    failed: 0,
    dry_run: dryRun,
    sends: [] as Array<{ lead_id: string; email: string; mail_num: number }>,
  };

  for (const lead of leads || []) {
    // Nur reine email_captured-Leads (nicht wer inzwischen gekauft/pending ist)
    if (!emailFilter && (lead.status || "") !== "email_captured") {
      stats.skipped_not_captured++;
      continue;
    }

    const answers = (lead.answers || {}) as Record<string, any>;

    // Abmeldung (DSGVO) — beide Flags honorieren
    if (answers.email_sequence_unsubscribed_at || answers.unsubscribed) {
      stats.skipped_unsubscribed++;
      continue;
    }

    // Test-Adressen raus (außer bei gezieltem ?email=)
    if (!emailFilter) {
      const isTest =
        /^test@|@test\.|^example@|@example\./i.test(lead.email) ||
        lead.email === "test@test.de";
      if (isTest) {
        stats.skipped_test_email++;
        continue;
      }
    }

    const createdAt = new Date(lead.created_at);
    const msAgo = Date.now() - createdAt.getTime();
    const daysAfterCaptured = Math.floor(msAgo / 86_400_000);
    const dueMailNum = getDueEcMail(daysAfterCaptured);
    if (!dueMailNum) {
      stats.skipped_no_due_mail++;
      continue;
    }

    // Tag-0-Mail (101): erst ~10 Min nach Eingabe senden. Warm, aber nicht im
    // selben Moment (vermeidet Rennen mit dem Checkout: wer sofort kauft, wird
    // pending/paid und fällt hier ohnehin raus).
    if (dueMailNum === 101 && !emailFilter && msAgo < 10 * 60_000) {
      stats.skipped_too_fresh++;
      continue;
    }

    const sentList: number[] = Array.isArray(answers.ec_sequence_sent)
      ? answers.ec_sequence_sent
      : [];
    if (!force && sentList.includes(dueMailNum)) {
      stats.skipped_already_sent++;
      continue;
    }

    if (dryRun) {
      stats.sent++;
      stats.sends.push({ lead_id: lead.id, email: lead.email, mail_num: dueMailNum });
      continue;
    }

    const seqLead: SequenceLead = {
      id: lead.id,
      email: lead.email,
      dog_name: lead.dog_name,
      dog_breed: (lead as any).dog_breed || answers.dog_breed || null,
      selected_plan: lead.selected_plan,
      answers,
    };
    const res = await sendSequenceMail(dueMailNum, seqLead, langFromLead(seqLead));
    if (!res.ok) {
      // DE-only: PL/IT-Leads liefern "no_content_for_mail" → als gesendet markieren (nicht täglich neu versuchen)
      if (res.reason === "no_content_for_mail") {
        stats.skipped_no_content++;
        await admin
          .from("wauwerk_leads")
          .update({ answers: { ...answers, ec_sequence_sent: [...sentList, dueMailNum] } })
          .eq("id", lead.id);
        continue;
      }
      console.warn("[ec-nurture-cron] send-fail:", lead.email, "mail", dueMailNum, res.reason);
      stats.failed++;
      continue;
    }

    await admin
      .from("wauwerk_leads")
      .update({
        answers: {
          ...answers,
          ec_sequence_sent: [...sentList, dueMailNum],
          [`ec_seq_${dueMailNum}_sent_at`]: new Date().toISOString(),
        },
      })
      .eq("id", lead.id);
    stats.sent++;
    stats.sends.push({ lead_id: lead.id, email: lead.email, mail_num: dueMailNum });
  }

  console.log(
    `[ec-nurture-cron] live=${live} candidates=${stats.candidates} sent=${stats.sent} failed=${stats.failed}`
  );

  return NextResponse.json({ ok: true, stats, schedule: EC_SEQUENCE_SCHEDULE });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
