// "[Hund] verstehen" — KI-generiertes Rasse-/Verhaltens-Profil fuer das
// Dashboard. Kern des geplanten "Plus"-Abos: ein warmer, konkreter Insight,
// der den Hund erklaert (nicht das Problem loest). Wird pro Nutzer generiert
// und ~monatlich frisch erzeugt ("immer Neues" = Abo-Hook).
//
// Generierung laeuft on-demand + gecacht in member_plan_content
// (plan_slug="hund-verstehen"), damit der Dashboard-Load nicht blockiert.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  getCurrentMember,
  createMemberAdminClient,
} from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const SLUG = "hund-verstehen";
const FRESH_DAYS = 28; // juenger als das = Cache nutzen; aelter = neu generieren

const PROBLEM_LABELS: Record<string, string> = {
  pulling: "Leinenziehen",
  barking: "uebermaessiges Bellen",
  aggression: "Aggression",
  anxiety: "Trennungsangst",
  jumping: "Anspringen",
  recall: "Rueckruf",
  energy: "viel Energie",
  destructive: "Zerstoerungsverhalten",
  soiling: "Stubenreinheit",
  mouthing: "Aufnehmen von Gegenstaenden",
};

interface InsightSection {
  emoji: string;
  heading: string;
  text: string;
}
interface Insight {
  title: string;
  intro: string;
  sections: InsightSection[];
  note: string;
  generatedAt: string;
}

export async function GET() {
  const user = await getCurrentMember();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const admin = createMemberAdminClient();
  const member = await getOrCreateMemberProfile({
    userId: user.id,
    email: user.email || "",
  });

  // Feature ist Teil des Plans/Abos → nur fuer zahlende Mitglieder
  if (member.purchase_status !== "paid") {
    return NextResponse.json({ error: "locked", reason: "not_paid" }, { status: 402 });
  }

  // ── Cache pruefen ────────────────────────────────────────────────
  const { data: cached } = await admin
    .from("member_plan_content")
    .select("id, content, created_at")
    .eq("user_id", user.id)
    .eq("plan_slug", SLUG)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached?.content) {
    const ageDays =
      (Date.now() - new Date((cached as any).created_at).getTime()) / 86400000;
    if (ageDays < FRESH_DAYS) {
      return NextResponse.json({ insight: cached.content, cached: true });
    }
  }

  if (!ANTHROPIC_API_KEY) {
    // Kein Key → falls alter Cache existiert, lieber den zeigen als nichts
    if (cached?.content) {
      return NextResponse.json({ insight: cached.content, cached: true });
    }
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  // ── Kontext aus Profil/Quiz ──────────────────────────────────────
  const dog = member.dog_name?.trim() || "dein Hund";
  const breed = member.dog_breed?.trim() || null;
  const quiz = (member.quiz_result || {}) as Record<string, any>;
  const age = quiz.dog_age || null;
  const problemKey = quiz.dog_problem || quiz.problem;
  const problemLabel = problemKey
    ? PROBLEM_LABELS[problemKey] || problemKey
    : null;
  const behaviors: string[] = Array.isArray(quiz.dog_behaviors)
    ? quiz.dog_behaviors
    : [];
  const commands: string[] = Array.isArray(quiz.dog_commands)
    ? quiz.dog_commands
    : [];

  const ctx = [
    `Name: ${dog}`,
    breed ? `Rasse: ${breed}` : "Rasse: unbekannt/Mischling",
    age ? `Alter: ${age}` : null,
    problemLabel ? `Hauptthema: ${problemLabel}` : null,
    behaviors.length ? `Beobachtetes Verhalten: ${behaviors.slice(0, 6).join(", ")}` : null,
    commands.length ? `Kann schon: ${commands.slice(0, 6).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const system = `Du bist der Pfoten-Plan KI-Trainer. Erstelle ein warmes, konkretes "${dog} verstehen"-Profil — es erklaert den HUND (Persoenlichkeit, Rasse-Instinkte, Koerpersprache, Beduerfnisse), es loest NICHT das Trainingsproblem.

REGELN:
- SPEZIFISCH + rasse-fundiert. KEINE generischen Floskeln ("treu und verspielt", "bester Freund"). Wenn die Rasse bekannt ist, beziehe dich auf das, wofuer sie gezuechtet wurde, und was das fuer Alltag/Verhalten bedeutet.
- Ehrlich: Rasse = Tendenzen, kein Schicksal. Bei Mischling/unbekannt: ueber das beobachtete Verhalten gehen.
- Du-Ansprache, warm, kompetent, nicht roboterhaft. Deutsch.
- Keine Markdown-Sterne, keine langen Gedankenstriche.
- Jede section.text: 2-3 Saetze, konkret und alltagsnah.

Gib AUSSCHLIESSLICH gueltiges JSON zurueck, exakt diese Struktur:
{"title": string, "intro": string (1 Satz), "sections": [{"emoji": string, "heading": string, "text": string}], "note": string (1 kurzer Satz, ehrlicher Hinweis dass jeder Hund individuell ist)}

Erzeuge GENAU diese 4 sections in dieser Reihenfolge:
1. emoji "🧭", heading "So tickt ${dog}" — Persoenlichkeit aus Rasse + Verhalten.
2. emoji "🧬", heading "${breed ? breed + "-Instinkte" : "Seine Instinkte"}" — was im Hund steckt und warum er bestimmte Dinge tut.
3. emoji "💬", heading "Wie ${dog} mit dir spricht" — 2-3 konkrete Koerpersprache-Signale, auf die man achten sollte.
4. emoji "❤️", heading "Was ${dog} jetzt braucht" — Beduerfnisse passend zu Alter/Thema.`;

  let insight: Insight;
  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: `Hier sind die Daten:\n${ctx}` }],
    });
    const raw = resp.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("")
      .trim();
    const jsonStr = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonStr);
    insight = {
      title: String(parsed.title || `${dog} verstehen`),
      intro: String(parsed.intro || ""),
      sections: Array.isArray(parsed.sections)
        ? parsed.sections.slice(0, 4).map((s: any) => ({
            emoji: String(s.emoji || "🐾"),
            heading: String(s.heading || ""),
            text: String(s.text || ""),
          }))
        : [],
      note: String(parsed.note || "Jeder Hund ist individuell — sieh es als Kompass, nicht als Urteil."),
      generatedAt: new Date().toISOString(),
    };
    if (insight.sections.length === 0) throw new Error("no_sections");
  } catch (e: any) {
    console.error("[hund-verstehen] generation failed:", e?.message);
    if (cached?.content) {
      return NextResponse.json({ insight: cached.content, cached: true });
    }
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }

  // ── Cachen (alte Version fuer diesen User vorher entfernen) ───────
  try {
    await admin
      .from("member_plan_content")
      .delete()
      .eq("user_id", user.id)
      .eq("plan_slug", SLUG);
    await admin.from("member_plan_content").insert({
      user_id: user.id,
      email: member.email,
      plan_slug: SLUG,
      plan_title: insight.title,
      content: insight,
      dog_name: member.dog_name || null,
      dog_breed: member.dog_breed || null,
      source: "claude-insight",
    });
  } catch (e: any) {
    console.warn("[hund-verstehen] cache write failed:", e?.message);
  }

  return NextResponse.json({ insight, cached: false });
}
