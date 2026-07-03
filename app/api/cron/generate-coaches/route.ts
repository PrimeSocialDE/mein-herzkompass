// app/api/cron/generate-coaches/route.ts
//
// Verarbeitet bezahlte Audio-Coaches, die noch keinen Inhalt haben
// (answers.pfoten_coach.status = 'paid' && kein content) und generiert sie.
// No-Op solange ELEVENLABS_API_KEY fehlt -> "wartet nur auf den Key".
// Auth: ?secret=... (gleiches Muster wie die anderen Crons).

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { generateCoachForEmail } from "@/lib/pfoten-coach-generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";
const PER_RUN = 2; // pro Lauf (Opus + ~15k Zeichen TTS je Kunde ist teuer/langsam)

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json({ ok: true, skipped: "elevenlabs_key_missing" });
  }

  // Bezahlte Coaches ohne Inhalt finden.
  const { data, error } = await supabase
    .from("wauwerk_leads")
    .select("id,email,answers")
    .eq("answers->pfoten_coach->>status", "paid")
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const todo = (data || [])
    .filter((r: any) => !r.answers?.pfoten_coach?.content)
    .slice(0, PER_RUN);

  const results: any[] = [];
  for (const r of todo) {
    try {
      results.push(await generateCoachForEmail({ leadId: String(r.id), email: String(r.email || "") }));
    } catch (e: any) {
      results.push({ ok: false, leadId: r.id, reason: e?.message || "error" });
    }
  }

  return NextResponse.json({ ok: true, found: todo.length, results });
}
