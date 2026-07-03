// app/api/pfoten-coach/generate/route.ts
//
// Manueller Trigger fuer die Audio-Coach-Generierung eines Kunden.
// Auth: Bearer WORKER_TOKEN. Body: { email? , lead_id? , dogName? }.
// Fuehrt die volle Pipeline aus (Opus-Skripte -> Ben-Vertonung -> Upload ->
// answers.pfoten_coach.content). Braucht ELEVENLABS_API_KEY (sonst klarer Fehler).

import { NextRequest, NextResponse } from "next/server";
import { generateCoachForEmail } from "@/lib/pfoten-coach-generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WORKER_TOKEN = (process.env.WORKER_TOKEN || "").trim();

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = (auth.match(/^Bearer\s+(.+)$/i)?.[1] || auth).trim();
  if (!WORKER_TOKEN || token !== WORKER_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim();
  const leadId = String(body?.lead_id || body?.leadId || "").trim();
  const dogName = body?.dogName ? String(body.dogName) : undefined;
  if (!email && !leadId) {
    return NextResponse.json({ error: "email oder lead_id nötig" }, { status: 400 });
  }

  try {
    const res = await generateCoachForEmail({ email, leadId, dogName });
    return NextResponse.json(res, res.ok ? undefined : { status: 400 });
  } catch (e: any) {
    console.error("[pfoten-coach/generate] error:", e?.message || e);
    return NextResponse.json({ ok: false, reason: e?.message || "error" }, { status: 500 });
  }
}
