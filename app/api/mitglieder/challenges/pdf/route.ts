// GET /api/mitglieder/challenges/pdf
//
// Liefert die aktuellen Wochen-Aufgaben des eingeloggten Mitglieds als PDF zum
// Download. Auth über die Member-Session (wie die Dashboard-Seite). Rein
// lesend/additiv — nutzt exakt dieselbe Datenquelle wie /mitglieder/erfolge.

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";
import { getMemberLang } from "@/lib/member-lang";
import { getOrAssignWeekChallenges } from "@/lib/member-challenges";
import { buildChallengesPDF } from "@/lib/challenges-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentMember();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const member = await getOrCreateMemberProfile({
    userId: user.id,
    email: user.email || "",
  });
  const lang = await getMemberLang(user?.email ?? member?.email ?? null);
  const challenges = await getOrAssignWeekChallenges(member);

  const items = (challenges || []).map((c: any) => ({
    title: c.challenge_title,
    description: c.challenge_description,
    target_sessions: c.target_sessions,
    sessions_done: c.sessions_done,
    badge_label: c.badge_label,
    completed: !!c.completed_at,
  }));

  const dogName = member.dog_name?.trim() || null;
  const weekLabel = lang === "pl" ? "Zadania na ten tydzień" : "Aufgaben dieser Woche";
  const dateLabel = new Date().toLocaleDateString(lang === "pl" ? "pl-PL" : "de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const pdf = await buildChallengesPDF({
    dogName,
    challenges: items,
    lang,
    weekLabel,
    dateLabel,
  });

  const safeDog = (dogName || (lang === "pl" ? "pies" : "hund"))
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "hund";
  const fname = (lang === "pl" ? "Zadania-tygodnia-" : "Wochenaufgaben-") + safeDog + ".pdf";

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
