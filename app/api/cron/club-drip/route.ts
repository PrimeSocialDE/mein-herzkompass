// app/api/cron/club-drip/route.ts
//
// Taeglicher Cron fuer das Pfoten-Plan Club-Abo:
//  1) DRIP: bei aktiven Mitgliedern, deren club_next_unlock_at erreicht ist,
//     das naechste Themen-Modul freischalten (Relevanz zuerst, dann Beliebtheit).
//  2) EXPIRY: bei gekuendigten Mitgliedern, deren club_access_until abgelaufen
//     ist, den Zugang schliessen (member -> "paid").
//
// Auth: ?secret=... (gleiches Muster wie die anderen Crons).

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { readClubState, dripUnlockForLead, expireClubIfDue } from "@/lib/club";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const dripped: any[] = [];
  const expired: any[] = [];

  // 1) DRIP — Mitglieder mit gesetztem next_unlock_at
  {
    const { data, error } = await supabase
      .from("wauwerk_leads")
      .select("id,email,answers")
      .not("answers->>club_next_unlock_at", "is", null)
      .limit(500);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    for (const lead of data || []) {
      const s = readClubState(lead.answers);
      if (!s.active || !s.nextUnlockAt) continue;
      if (s.nextUnlockAt > today) continue; // noch nicht faellig
      try {
        const slug = await dripUnlockForLead(lead as any);
        if (slug) dripped.push({ id: lead.id, email: lead.email, unlocked: slug });
      } catch (e: any) {
        dripped.push({ id: lead.id, error: e?.message || "error" });
      }
    }
  }

  // 2) EXPIRY — gekuendigte mit abgelaufenem Zugang
  {
    const { data } = await supabase
      .from("wauwerk_leads")
      .select("id,email,answers")
      .not("answers->>club_access_until", "is", null)
      .limit(500);
    for (const lead of data || []) {
      try {
        const done = await expireClubIfDue(lead as any);
        if (done) expired.push({ id: lead.id, email: lead.email });
      } catch (e: any) {
        expired.push({ id: lead.id, error: e?.message || "error" });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    dripped_count: dripped.length,
    expired_count: expired.length,
    dripped,
    expired,
  });
}
