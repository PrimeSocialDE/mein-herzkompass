// POST /api/mitglieder/mood/log
//
// Append-only Stimmungs-Check. Speichert Eintrag und holt — wenn
// strukturierte Antworten dabei sind — kurzes KI-Feedback vom
// Anthropic Haiku-Modell und gibt das in der Response zurueck.

import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentMember,
  createMemberAdminClient,
} from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";
import { QUESTIONS_BY_PROBLEM } from "@/lib/member-mood";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MOODS = ["gut", "mittel", "schwierig"];
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

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
  const problem_key = body?.problem_key
    ? String(body.problem_key).trim().slice(0, 50)
    : null;
  const answersRaw =
    body?.answers && typeof body.answers === "object" ? body.answers : null;
  // Sanitize: nur strings/nummern, keine grossen Objekte
  let answers: Record<string, string> | null = null;
  if (answersRaw) {
    answers = {};
    for (const [k, v] of Object.entries(answersRaw)) {
      if (typeof k === "string" && k.length < 100 && v != null) {
        answers[k] = String(v).slice(0, 200);
      }
    }
    if (Object.keys(answers).length === 0) answers = null;
  }

  const admin = createMemberAdminClient();

  // ── Insert ───────────────────────────────────────────────────────
  const { data: insertData, error: insertError } = await admin
    .from("member_mood_logs")
    .insert({
      user_id: user.id,
      email: user.email || "",
      mood,
      note,
      module_slug,
      answers,
    })
    .select("id, log_date, mood, note, created_at")
    .single();

  if (insertError) {
    console.error("[mood/log] insert failed:", insertError);
    return NextResponse.json(
      { error: insertError.message || "Speichern fehlgeschlagen" },
      { status: 500 }
    );
  }

  // ── KI-Feedback (nur wenn strukturierte Antworten + API-Key) ────
  let feedback: string | null = null;
  if (answers && ANTHROPIC_API_KEY) {
    try {
      const member = await getOrCreateMemberProfile({
        userId: user.id,
        email: user.email || "",
      });
      const dog = member.dog_name?.trim() || "deinem Hund";
      const effectiveProblemKey =
        problem_key ||
        member.quiz_result?.dog_problem ||
        member.quiz_result?.problem ||
        null;
      const problemLabel = effectiveProblemKey
        ? PROBLEM_LABELS[effectiveProblemKey] || effectiveProblemKey
        : null;

      // Antworten human-readable formatieren
      const questionDefs = effectiveProblemKey
        ? QUESTIONS_BY_PROBLEM[effectiveProblemKey] || []
        : [];
      const answerLines: string[] = [];
      for (const [k, v] of Object.entries(answers)) {
        const qDef = questionDefs.find((q) => q.key === k);
        const qText = qDef?.text || k;
        const optLabel = qDef?.options.find((o) => o.value === v)?.label || v;
        answerLines.push(`- ${qText} → ${optLabel}`);
      }
      const noteText = note ? `\nEigene Notiz: "${note}"` : "";

      const moodLabel: Record<string, string> = {
        gut: "gut gelaufen",
        mittel: "mittelmäßig",
        schwierig: "schwierig",
      };

      const prompt = `Du bist die Pfoten-Plan KI-Trainer-Assistenz, eine freundliche Hundetrainer-Assistenz. Der User hat gerade eine Trainings-Einheit eingetragen.

Hund: ${dog}${problemLabel ? `, Hauptthema: ${problemLabel}` : ""}.
Wie es lief: ${moodLabel[mood]}.
Antworten:
${answerLines.join("\n")}${noteText}

Gib eine konkrete, freundliche Empfehlung in MAXIMAL 60 Wörtern: was als nächstes hilft. Sei sehr konkret (z.B. "Geh morgen mit mehr Distanz zum Auslöser"), kein Geschwurbel. Sprich den User mit "du" an. Schreibe normalen Fließtext, KEIN Markdown, keine Sternchen, keine Bindestriche-Aufzählungen. Bei "schwierig"-Stimmung: ermutigend bleiben.`;

      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("")
        .trim();

      // Defensiv Markdown raus, falls Claude doch was reinpackt
      feedback = text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/—/g, "-");
    } catch (e: any) {
      console.error("[mood/log] feedback generation failed:", e?.message);
      // Feedback-Fail ist nicht fatal — User bekommt einfach kein Feedback
    }
  }

  return NextResponse.json({ ok: true, log: insertData, feedback });
}
