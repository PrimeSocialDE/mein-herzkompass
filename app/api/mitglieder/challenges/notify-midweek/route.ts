// GET /api/mitglieder/challenges/notify-midweek?secret=pfoten-cron-2024
//
// Mittwoch-Cron (18:00 Berlin / 17:00 UTC im Sommer, 16:00 UTC im Winter —
// Vercel-Cron laeuft in UTC, wir setzen 0 17 * * 3 als Kompromiss).
//
// Zielgruppe: alle Mitglieder mit Email + Quiz-Problem, die in dieser
// Wochen-Challenges haben aber bislang KEINE einzige Session geloggt
// und KEIN Challenge der aktuellen Woche `completed_at` hat.
//
// Idempotenz: pro Challenge-Row gibt's `reminder_sent_at`. Wenn IRGENDEINE
// Challenge der aktuellen Woche schon einen Reminder hat → skip User.
// Nach dem Senden alle Challenges der Woche markieren.
//
// VORAUSSETZUNG (einmalig im Supabase SQL Editor):
//   ALTER TABLE public.member_user_challenges
//     ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
// Wenn die Spalte fehlt, faellt der Cron silent auf "send-without-tracking"
// zurueck — dann kann es bei Cron-Mehrfach-Lauf doppelte Mails geben.

import { NextRequest, NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import { getOrAssignWeekChallenges, getWeekStartDate } from "@/lib/member-challenges";
import { sendMidweekReminderMail } from "@/lib/member-mail";
import type { MemberProfile } from "@/lib/member-db";
import type { UserChallenge } from "@/lib/member-challenges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = "pfoten-cron-2024";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dryRun = searchParams.get("dry") === "1";
  const emailFilter = searchParams.get("email")?.toLowerCase();
  const limitParam = parseInt(searchParams.get("limit") || "0", 10);
  const limit = limitParam > 0 ? Math.min(limitParam, 500) : 500;

  const admin = createMemberAdminClient();
  const weekStart = getWeekStartDate();

  // Member-Liste — bei email-Filter nur diesen einen
  let query = admin
    .from("member_users")
    .select("*")
    .not("email", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (emailFilter) query = query.ilike("email", emailFilter);

  const { data: members, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "fetch_members_failed", details: error.message },
      { status: 500 }
    );
  }

  const stats = {
    total: members?.length || 0,
    skipped_no_email: 0,
    skipped_no_problem: 0,
    skipped_already_engaged: 0,
    skipped_already_reminded: 0,
    skipped_all_completed: 0,
    sent: 0,
    failed: 0,
    dry_run: dryRun,
    week_start: weekStart,
  };

  for (const m of (members || []) as MemberProfile[]) {
    if (!m.email) { stats.skipped_no_email++; continue; }
    const problemKey =
      m.quiz_result?.dog_problem || m.quiz_result?.problem || null;
    if (!problemKey) { stats.skipped_no_problem++; continue; }

    // Challenges dieser Woche holen (assign falls noch nicht angelegt)
    let challenges: UserChallenge[];
    try {
      challenges = await getOrAssignWeekChallenges(m);
    } catch (e: any) {
      stats.failed++;
      continue;
    }
    if (challenges.length === 0) { stats.failed++; continue; }

    // Schon irgendwas geschafft oder angefangen? Dann kein Mid-Week-Reminder
    // (waere fuer Engaged-User nervig).
    const hasEngaged = challenges.some(
      (c) => c.sessions_done > 0 || c.completed_at !== null
    );
    if (hasEngaged) {
      // Sub-Differenzieren fuer Stats
      const allCompleted = challenges.every((c) => c.completed_at !== null);
      if (allCompleted) stats.skipped_all_completed++;
      else stats.skipped_already_engaged++;
      continue;
    }

    // Idempotenz: schon Reminder diese Woche raus?
    const alreadyReminded = challenges.some(
      (c: any) => !!c.reminder_sent_at
    );
    if (alreadyReminded) { stats.skipped_already_reminded++; continue; }

    if (dryRun) { stats.sent++; continue; }

    try {
      const res = await sendMidweekReminderMail(m, challenges);
      if (res.ok) {
        stats.sent++;
        // Mark als reminded auf ALLEN Challenge-Rows der Woche.
        // Wenn die Spalte nicht existiert, faellt das durch — Mail ist trotzdem raus.
        try {
          await admin
            .from("member_user_challenges")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("user_id", m.id)
            .eq("week_start_date", weekStart);
        } catch {
          // Spalte fehlt? Egal — Mail ist raus, naechster Cron-Run wuerde nochmal senden
        }
      } else {
        stats.failed++;
      }
    } catch (e: any) {
      console.error(
        "[challenges/notify-midweek] mail failed:",
        m.email,
        e?.message
      );
      stats.failed++;
    }
  }

  return NextResponse.json({ ok: true, stats });
}
