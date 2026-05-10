// POST /api/wochen-check-demo
//
// Public Endpoint fuer die Wochen-Begleitung-Demo. Kein Login.
// Rate-limited per IP (in-memory, reicht fuer Marketing-Demo).
// Generiert eine Pfoten-Plan-typische KI-Wochen-Empfehlung.

import { NextRequest, NextResponse } from "next/server";
import { WEEKLY_QUESTIONS_BY_PROBLEM } from "@/lib/member-mood";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const ALLOWED_MOODS = ["gut", "mittel", "schwierig"];

const PROBLEM_LABELS: Record<string, string> = {
  pulling: "Leinenziehen",
  barking: "Bellen",
  aggression: "Aggression",
  anxiety: "Trennungsangst",
  jumping: "Anspringen",
  recall: "Rückruf",
  energy: "übermäßige Energie",
  destructive: "Zerstörungsverhalten",
  soiling: "Stubenreinheit",
  mouthing: "Aufnehmen vom Boden",
};

const MOOD_LABEL: Record<string, string> = {
  gut: "gut gelaufen",
  mittel: "durchwachsen",
  schwierig: "schwierig",
};

// In-Memory Rate-Limit: max 5 Requests pro IP pro Stunde.
// Reicht fuer Marketing-Demo - wer mehr will, soll den Plan kaufen.
const rateLimitMap = new Map<string, number[]>();
const MAX_REQUESTS = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1h

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter(
    (t) => now - t < WINDOW_MS
  );
  if (timestamps.length >= MAX_REQUESTS) {
    rateLimitMap.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
}

// Map einmal pro Tag aufraeumen damit's nicht wachsen kann
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 24 * 60 * 60 * 1000) return;
  lastCleanup = now;
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const filtered = timestamps.filter((t) => now - t < WINDOW_MS);
    if (filtered.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, filtered);
  }
}

export async function POST(req: NextRequest) {
  maybeCleanup();

  // IP fuer Rate-Limit (aus Forwarded-Header oder fallback)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      {
        error:
          "Du hast die Demo schon mehrfach getestet. Hol dir den Plan, dann gibt's die KI-Begleitung unbegrenzt.",
      },
      { status: 429 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }

  const problem_key = String(body?.problem_key || "").trim();
  if (!problem_key || !PROBLEM_LABELS[problem_key]) {
    return NextResponse.json(
      { error: "Bitte ein Problem-Thema wählen." },
      { status: 400 }
    );
  }

  const mood = String(body?.mood || "").trim();
  if (!ALLOWED_MOODS.includes(mood)) {
    return NextResponse.json(
      { error: "Stimmung fehlt." },
      { status: 400 }
    );
  }

  const dogName = body?.dog_name
    ? String(body.dog_name).trim().slice(0, 40)
    : null;
  const dog = dogName || "deinem Hund";

  const answersRaw =
    body?.answers && typeof body.answers === "object" ? body.answers : null;
  const answers: Record<string, string> = {};
  if (answersRaw) {
    for (const [k, v] of Object.entries(answersRaw)) {
      if (typeof k === "string" && k.length < 100 && v != null) {
        answers[k] = String(v).slice(0, 200);
      }
    }
  }

  if (Object.keys(answers).length === 0) {
    return NextResponse.json(
      { error: "Bitte mindestens eine Frage beantworten." },
      { status: 400 }
    );
  }

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Demo gerade nicht verfügbar (KI-Schlüssel fehlt)." },
      { status: 503 }
    );
  }

  const problemLabel = PROBLEM_LABELS[problem_key];
  const questionDefs = WEEKLY_QUESTIONS_BY_PROBLEM[problem_key] || [];

  const answerLines: string[] = [];
  for (const [k, v] of Object.entries(answers)) {
    const qDef = questionDefs.find((q) => q.key === k);
    const qText = qDef?.text || k;
    const optLabel = qDef?.options.find((o) => o.value === v)?.label || v;
    answerLines.push(`- ${qText} → ${optLabel}`);
  }

  const prompt = `Du bist die Pfoten-Plan KI-Trainer-Assistenz. Ein Hundehalter probiert die kostenlose Vorschau und hat Fragen zu "${problemLabel}" beantwortet.

Hund: ${dog}.
Hauptthema: ${problemLabel}.
Wie die Woche lief: ${MOOD_LABEL[mood]}.

Antworten:
${answerLines.join("\n")}

Schreibe eine konkrete, motivierende Wochen-Empfehlung in MAXIMAL 110 Wörtern. Struktur:
1. Ein Satz: Was sticht aus den Antworten besonders heraus (Erfolg ODER Knackpunkt).
2. Ein Satz: Was die wahrscheinlichste Ursache fuer das auffaellige Verhalten ist (zeig dass du verstehst, was los ist).
3. Zwei sehr konkrete Tipps fuer die nächste Woche - keine Allgemeinplaetze. Beispiel: "Geh 3x diese Woche mit Bruno auf eine ruhige Strecke, fang mit 5m Distanz zu anderen Hunden an" - NICHT "ueb mehr".

Sprich den User mit "du" an. ${dogName ? `Nutze den Namen "${dogName}" wo es passt.` : ""} Normaler Fließtext, KEIN Markdown, keine Sternchen, keine Bindestriche-Aufzaehlungen, keine Zwischenueberschriften. Sehr direkt, sehr konkret - so wie ein erfahrener Hundetrainer aus dem Bauch heraus reden wuerde.`;

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("")
      .trim();

    const feedback = text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/—/g, "-");

    return NextResponse.json({ ok: true, feedback });
  } catch (e: any) {
    console.error("[wochen-check-demo] failed:", e?.message);
    return NextResponse.json(
      { error: "KI-Antwort konnte nicht erstellt werden. Versuch es gleich nochmal." },
      { status: 500 }
    );
  }
}
