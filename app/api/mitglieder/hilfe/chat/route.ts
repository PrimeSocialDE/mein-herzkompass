// Chat-Endpoint für die /mitglieder/hilfe Seite. Ruft Claude (Anthropic
// SDK) mit dem User-Kontext (Hund-Daten + Quiz-Antworten + paid-Status)
// im System-Prompt — Claude antwortet damit als Pfoten-Plan-Trainer-AI
// kontextbezogen auf den konkreten Hund.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentMember, createMemberAdminClient } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

// Free-Tier Rate-Limit: 3 Fragen pro 24h (rolling window per User)
const FREE_DAILY_LIMIT = 3;
// Paid-User: kein Limit (oder höher — hier: kein Limit)
const PAID_DAILY_LIMIT = Infinity;

const PROBLEM_LABELS: Record<string, string> = {
  pulling: "Leinenziehen",
  barking: "übermäßiges Bellen",
  aggression: "Aggression",
  anxiety: "Trennungsangst",
  jumping: "Anspringen",
  recall: "Rückruf-Probleme",
  energy: "übermäßige Energie",
  destructive: "Zerstörungsverhalten",
  soiling: "Stubenreinheit",
  mouthing: "Aufnehmen von Gegenständen",
};

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Chat ist gerade nicht verfügbar (Konfig fehlt)." },
      { status: 503 }
    );
  }

  const user = await getCurrentMember();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  let messages: IncomingMessage[];
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }
  if (messages.length === 0) {
    return NextResponse.json({ error: "Keine Nachrichten" }, { status: 400 });
  }
  // Limit gegen Missbrauch
  if (messages.length > 20) messages = messages.slice(-20);

  const member = await getOrCreateMemberProfile({
    userId: user.id,
    email: user.email || "",
  });

  // ── Rate-Limit-Check (Free: 3/24h, Paid: unlimited) ─────────────
  const limit =
    member.purchase_status === "paid" ? PAID_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const admin = createMemberAdminClient();
  const { data: usageRow } = await admin
    .from("member_users")
    .select("chat_usage_count, chat_usage_reset_at")
    .eq("id", user.id)
    .maybeSingle();

  const now = new Date();
  const resetAt = usageRow?.chat_usage_reset_at
    ? new Date(usageRow.chat_usage_reset_at as string)
    : null;
  const expired = !resetAt || now.getTime() - resetAt.getTime() > 24 * 60 * 60 * 1000;
  const currentCount = expired ? 0 : (usageRow?.chat_usage_count as number | null) || 0;

  if (limit !== Infinity && currentCount >= limit) {
    const nextReset = expired
      ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
      : new Date(resetAt!.getTime() + 24 * 60 * 60 * 1000);
    return NextResponse.json(
      {
        error: "limit_reached",
        limit,
        used: currentCount,
        resets_at: nextReset.toISOString(),
        is_paid: member.purchase_status === "paid",
      },
      { status: 429 }
    );
  }

  // ── User-Kontext zusammenbauen (für System-Prompt) ──────────────
  const dog = member.dog_name || "der Hund";
  const breed = member.dog_breed ? `, ${member.dog_breed}` : "";
  const quiz = member.quiz_result || {};
  const ageRaw = quiz.dog_age;
  const ageStr = ageRaw ? `, ${ageRaw}` : "";
  const problemKey = quiz.dog_problem || quiz.problem;
  const problemLabel = problemKey ? PROBLEM_LABELS[problemKey] || problemKey : null;
  const knownCommands: string[] = Array.isArray(quiz.dog_commands)
    ? quiz.dog_commands
    : [];

  const contextLines: string[] = [
    `Hund: ${dog}${breed}${ageStr}.`,
  ];
  if (problemLabel) {
    contextLines.push(`Hauptthema laut Quiz: "${problemLabel}".`);
  }
  if (knownCommands.length > 0) {
    contextLines.push(
      `Bekannte Kommandos: ${knownCommands.slice(0, 5).join(", ")}.`
    );
  }
  contextLines.push(
    `Status: ${member.purchase_status === "paid" ? "voller Plan" : "kostenlose Übungen"}.`
  );

  const systemPrompt = `Du bist die Pfoten-Plan Trainer-Assistenz, eine freundliche Hundetrainerin im Chat. Antworte auf Deutsch, geduldig, konkret und alltagsnah.

NUTZER-KONTEXT:
${contextLines.join("\n")}

REGELN:
- Sprich den User mit "du" an.
- Beziehe dich wenn möglich konkret auf ${dog}${problemLabel ? ` und das Thema "${problemLabel}"` : ""}.
- Gib Schritt-für-Schritt-Tipps, kurz und umsetzbar (max 3-5 Schritte).
- Wenn unklar ist was gemeint ist: stelle EINE Rückfrage statt zu raten.
- Bleibe IMMER beim Thema Hundetraining/Pfoten-Plan. Bei Off-Topic ("welches Wetter ist heute" etc.): freundlich zurückführen.
- Bei medizinischen Symptomen (Schmerzen, akute Krankheit): empfehle Tierarzt-Besuch.
- Halte Antworten unter 200 Wörter, nutze gerne kurze Listen oder Aufzählungen.

FORMAT (WICHTIG):
- Verwende KEIN Markdown. Keine Sternchen (** oder *), keine #-Headlines, keine Backticks.
- Schreibe normalen Fließtext. Für Aufzählungen nutze einfache Nummern (1. 2. 3.) oder Bindestriche (-).
- Verwende KEINE langen Gedankenstriche (— oder –). Nutze stattdessen Kommas, Punkte oder normale Bindestriche (-).
- Schreibe wichtige Wörter ohne Hervorhebung, der Text wirkt natürlicher.`;

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content.slice(0, 4000),
      })),
    });

    const text = response.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n")
      .trim();

    // Defensiv: Markdown-Sterne und lange Gedankenstriche raus, falls
    // Claude sich trotz System-Prompt nicht dran hält.
    const cleaned = text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?;:])/g, "$1$2")
      .replace(/\s—\s/g, ", ")
      .replace(/\s–\s/g, ", ")
      .replace(/—/g, "-")
      .replace(/–/g, "-");

    // Counter hochzählen (nur Free-User, Paid hat Infinity)
    if (limit !== Infinity) {
      const newCount = currentCount + 1;
      const newResetAt = expired ? now.toISOString() : (resetAt?.toISOString() || now.toISOString());
      await admin
        .from("member_users")
        .update({
          chat_usage_count: newCount,
          chat_usage_reset_at: newResetAt,
        })
        .eq("id", user.id);
    }

    return NextResponse.json({
      reply: cleaned,
      usage: limit === Infinity
        ? { unlimited: true }
        : { used: currentCount + 1, limit, remaining: Math.max(0, limit - (currentCount + 1)) },
    });
  } catch (e: any) {
    console.error("[hilfe-chat] Anthropic error:", e);
    return NextResponse.json(
      { error: "Konnte Antwort nicht generieren. Versuch's gleich nochmal." },
      { status: 500 }
    );
  }
}
