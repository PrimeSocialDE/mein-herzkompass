// Tagliche Cron fuer die Email-Sequenz nach Plan-Kauf (Mails 2-9 ausser Mail 5).
//
// Auth: ?secret=$CRON_SECRET (matched gegen process.env.CRON_SECRET)
//       oder ?email=foo@bar.de fuer Einzel-Test (ueberspringt Idempotenz wenn force=1)
//
// Logik:
//   1) Hole paid Leads der letzten 35 Tage
//   2) Pro Lead: skip wenn status='refunded'/'cancelled' oder
//      answers.email_sequence_unsubscribed_at gesetzt
//   3) Berechne daysAfterPaid aus paid_at
//   4) Finde faellige Mail-Nummer (getDueMail)
//   5) Skip wenn diese Mail-Nummer schon in answers.email_sequence_sent[] ist
//   6) Sende via Brevo, markiere in answers.email_sequence_sent[]
//
// Vercel-Cron: vercel.json bekommt einen Eintrag der das taegl. um 09:00 UTC triggert.

import { NextRequest, NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import {
  EMAIL_SEQUENCE_SCHEDULE,
  getDueMail,
  sendSequenceMail,
  type SequenceLead,
} from "@/lib/email-sequence";
import { langFromLead } from "@/lib/lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";

const EXCLUDED_STATUSES = new Set(["refunded", "cancelled", "canceled", "chargeback"]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const emailFilter = searchParams.get("email")?.toLowerCase();
  const force = searchParams.get("force") === "1";
  const dryRun = searchParams.get("dry") === "1";

  const admin = createMemberAdminClient();

  // Window: 35 Tage zurueck (Mail 9 = T+30, +5 Tage Toleranz fuer cron-misses)
  const since = new Date(Date.now() - 35 * 86_400_000).toISOString();

  let query = admin
    .from("wauwerk_leads")
    .select("id, email, dog_name, selected_plan, paid_at, status, answers")
    .gte("paid_at", since)
    .not("paid_at", "is", null)
    .not("email", "is", null);

  if (emailFilter) {
    query = query.ilike("email", emailFilter);
  } else {
    query = query.eq("status", "paid").limit(200);
  }

  const { data: leads, error } = await query;
  if (error) {
    console.error("[email-sequence-cron] fetch error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const stats = {
    candidates: leads?.length || 0,
    sent: 0,
    skipped_excluded_status: 0,
    skipped_unsubscribed: 0,
    skipped_already_sent: 0,
    skipped_no_due_mail: 0,
    skipped_no_content: 0,
    skipped_test_email: 0,
    failed: 0,
    dry_run: dryRun,
    sends: [] as Array<{ lead_id: string; email: string; mail_num: number }>,
  };

  for (const lead of leads || []) {
    // 1) Status-Filter
    if (EXCLUDED_STATUSES.has((lead.status || "").toLowerCase())) {
      stats.skipped_excluded_status++;
      continue;
    }

    const answers = (lead.answers || {}) as Record<string, any>;

    // 2) Unsubscribe-Flag — KAUF-DROP-OUT-Mechanismus
    if (answers.email_sequence_unsubscribed_at) {
      stats.skipped_unsubscribed++;
      continue;
    }

    // 3) Test-Email-Filter (ausser bei force / emailFilter-Aufruf)
    if (!emailFilter) {
      const isTest =
        /^test@|@test\.|^example@|@example\./i.test(lead.email) ||
        lead.email === "test@test.de";
      if (isTest) {
        stats.skipped_test_email++;
        continue;
      }
    }

    // 4) daysAfterPaid berechnen
    const paidAt = new Date(lead.paid_at);
    const daysAfterPaid = Math.floor((Date.now() - paidAt.getTime()) / 86_400_000);
    const dueMailNum = getDueMail(daysAfterPaid);
    if (!dueMailNum) {
      stats.skipped_no_due_mail++;
      continue;
    }

    // 5) Idempotenz — schon gesendet?
    const sentList: number[] = Array.isArray(answers.email_sequence_sent)
      ? answers.email_sequence_sent
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

    // 6) Senden
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
      if (res.reason === "no_content_for_mail") {
        // z. B. Mail 9 Cross-Sell, aber User hat alle Bumps schon → Skip statt Fail
        stats.skipped_no_content++;
        // Trotzdem als "sent" markieren damit wir's nicht jeden Tag erneut versuchen
        const newSent = [...sentList, dueMailNum];
        await admin
          .from("wauwerk_leads")
          .update({
            answers: { ...answers, email_sequence_sent: newSent, email_sequence_skipped_no_content_at: new Date().toISOString() },
          })
          .eq("id", lead.id);
        continue;
      }
      console.warn("[email-sequence-cron] send-fail:", lead.email, "mail", dueMailNum, res.reason);
      stats.failed++;
      continue;
    }

    // Idempotenz-Flag setzen
    const newSent = [...sentList, dueMailNum];
    await admin
      .from("wauwerk_leads")
      .update({
        answers: {
          ...answers,
          email_sequence_sent: newSent,
          [`email_seq_${dueMailNum}_sent_at`]: new Date().toISOString(),
        },
      })
      .eq("id", lead.id);
    stats.sent++;
    stats.sends.push({ lead_id: lead.id, email: lead.email, mail_num: dueMailNum });
  }

  console.log(
    `[email-sequence-cron] candidates=${stats.candidates} sent=${stats.sent} skipped=${stats.skipped_excluded_status + stats.skipped_unsubscribed + stats.skipped_already_sent + stats.skipped_no_due_mail + stats.skipped_no_content + stats.skipped_test_email} failed=${stats.failed}`
  );

  return NextResponse.json({
    ok: true,
    stats,
    schedule: EMAIL_SEQUENCE_SCHEDULE,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
