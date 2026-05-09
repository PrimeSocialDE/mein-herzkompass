// POST /api/mitglieder/challenges/log-session
// Body: { challenge_id: string, delta?: number }
// Erhoeht sessions_done um delta (default +1) und setzt completed_at
// wenn target erreicht ist. Idempotent gegen ueberzaehlen via clamp.

import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentMember,
  createMemberAdminClient,
} from "@/lib/member-auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const challengeId = String(body?.challenge_id || "");
  const delta = Math.max(-1, Math.min(1, Number(body?.delta) || 1));

  if (!challengeId) {
    return NextResponse.json(
      { error: "challenge_id fehlt" },
      { status: 400 }
    );
  }

  const admin = createMemberAdminClient();

  // Challenge laden + ownership pruefen
  const { data: ch } = await admin
    .from("member_user_challenges")
    .select("*")
    .eq("id", challengeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!ch) {
    return NextResponse.json(
      { error: "Challenge nicht gefunden" },
      { status: 404 }
    );
  }

  // Clamp: 0 <= sessions_done <= target_sessions
  const next = Math.max(
    0,
    Math.min(ch.target_sessions, (ch.sessions_done || 0) + delta)
  );
  const completedNow = next >= ch.target_sessions;

  const updates: Record<string, any> = { sessions_done: next };
  if (completedNow && !ch.completed_at) {
    updates.completed_at = new Date().toISOString();
  } else if (!completedNow && ch.completed_at) {
    // Falls User wieder runterzaehlt unter target: completed zuruecknehmen
    updates.completed_at = null;
  }

  const { data: updated, error } = await admin
    .from("member_user_challenges")
    .update(updates)
    .eq("id", challengeId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("[challenges/log-session] update failed:", error);
    return NextResponse.json(
      { error: "Konnte nicht speichern" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    challenge: updated,
    just_completed: completedNow && !ch.completed_at,
  });
}
