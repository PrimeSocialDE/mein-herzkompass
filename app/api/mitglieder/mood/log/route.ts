// POST /api/mitglieder/mood/log
//
// Append-only Stimmungs-Check. Der eingeloggte User legt eine Zeile
// in member_mood_logs an. Mehrere Eintraege pro Tag erlaubt.

import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentMember,
  createMemberAdminClient,
} from "@/lib/member-auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MOODS = ["gut", "mittel", "schwierig"];

export async function POST(req: NextRequest) {
  const user = await getCurrentMember();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }

  const mood = String(body?.mood || "").trim();
  if (!ALLOWED_MOODS.includes(mood)) {
    return NextResponse.json(
      { error: "mood muss 'gut', 'mittel' oder 'schwierig' sein" },
      { status: 400 }
    );
  }

  const note = body?.note ? String(body.note).trim().slice(0, 500) : null;
  const module_slug = body?.module_slug
    ? String(body.module_slug).trim().slice(0, 100)
    : null;

  const admin = createMemberAdminClient();
  const { data, error } = await admin
    .from("member_mood_logs")
    .insert({
      user_id: user.id,
      email: user.email || "",
      mood,
      note,
      module_slug,
    })
    .select("id, log_date, mood, note, created_at")
    .single();

  if (error) {
    console.error("[mood/log] insert failed:", error);
    return NextResponse.json(
      { error: error.message || "Speichern fehlgeschlagen" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, log: data });
}
