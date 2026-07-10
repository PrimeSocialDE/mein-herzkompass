// GET /api/mitglieder/challenges/notify?secret=pfoten-cron-2024
//
// Wochen-Cron: jeden Montag laufen lassen. Iteriert alle aktiven
// Mitglieder, sorgt dass sie Challenges fuer die aktuelle Woche haben
// und schickt eine Erinnerungs-Mail.
//
// Idempotent in der Woche: getOrAssignWeekChallenges legt nur an wenn
// noch keine da sind. Aber: die Mail wuerde bei Mehrfach-Trigger erneut
// rausgehen — daher kleiner Schutz: nur senden wenn die Challenges in
// den letzten 6 Stunden angelegt wurden ODER noch unangetastet sind.

import { NextRequest, NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import { getOrAssignWeekChallenges } from "@/lib/member-challenges";
import { sendWeeklyChallengesMail } from "@/lib/member-mail";
import { langFromEmailLookup } from "@/lib/lang";
import type { MemberProfile } from "@/lib/member-db";

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
  const limitParam = parseInt(searchParams.get("limit") || "0", 10);
  const limit = limitParam > 0 ? Math.min(limitParam, 500) : 500;

  const admin = createMemberAdminClient();

  // Zielgruppe: alle Mitglieder mit Email + Quiz-Problem.
  // Free + Paid bekommen Mail (Free profitiert ja auch von einer
  // Aufgabe pro Woche).
  const { data: members, error } = await admin
    .from("member_users")
    .select("*")
    .not("email", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[challenges/notify] fetch members failed:", error);
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
    sent: 0,
    failed: 0,
    dry_run: dryRun,
  };

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  for (const m of (members || []) as MemberProfile[]) {
    if (!m.email) {
      stats.skipped_no_email++;
      continue;
    }
    const problemKey =
      m.quiz_result?.dog_problem || m.quiz_result?.problem || null;
    if (!problemKey) {
      stats.skipped_no_problem++;
      continue;
    }

    // Challenges der aktuellen Woche sicherstellen
    let challenges;
    try {
      challenges = await getOrAssignWeekChallenges(m);
    } catch (e: any) {
      console.error("[challenges/notify] assign failed:", m.id, e?.message);
      stats.failed++;
      continue;
    }

    if (challenges.length === 0) {
      stats.failed++;
      continue;
    }

    // Schon was geschafft diese Woche? Dann keine "neue Woche"-Mail —
    // sonst wirkt's komisch ("schon halb geschafft, hier eine Mail"). Nur
    // schicken wenn die Challenges JUNG (< 6h) UND noch nicht angefasst
    // sind. Bei Mehrfach-Trigger des Crons schickt das nicht erneut, weil
    // dann die Challenges schon laenger als 6h existieren.
    const isFresh = challenges.every(
      (c) =>
        c.sessions_done === 0 &&
        c.completed_at === null &&
        c.created_at >= sixHoursAgo
    );

    if (!isFresh) {
      stats.skipped_already_engaged++;
      continue;
    }

    if (dryRun) {
      stats.sent++;
      continue;
    }

    try {
      const res = await sendWeeklyChallengesMail(m, challenges, await langFromEmailLookup(admin, m.email));
      if (res.ok) stats.sent++;
      else stats.failed++;
    } catch (e: any) {
      console.error(
        "[challenges/notify] mail failed:",
        m.email,
        e?.message
      );
      stats.failed++;
    }
  }

  return NextResponse.json({ ok: true, stats });
}
