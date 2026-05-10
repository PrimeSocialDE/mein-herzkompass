// POST /api/mitglieder/mood/log
//
// Append-only Stimmungs-Check. Speichert Eintrag und holt — wenn
// strukturierte Antworten dabei sind — kurzes KI-Feedback vom
// Anthropic Haiku-Modell und gibt das in der Response zurueck.
//
// Zwei Modi:
//   - Daily (default): mood + answers zur letzten Uebung
//   - Weekly: zusaetzlich plan_week gesetzt → KI-Zusammenfassung der
//     ganzen Woche, mit Vergleich zur Vorwoche falls vorhanden

import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentMember,
  createMemberAdminClient,
} from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";
import {
  QUESTIONS_BY_PROBLEM,
  WEEKLY_QUESTIONS_BY_PROBLEM,
  getWeeklyCheckIns,
  indexByWeek,
} from "@/lib/member-mood";
import { getPlanIntro } from "@/lib/member-plan-intro";
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

const MOOD_LABEL: Record<string, string> = {
  gut: "gut gelaufen",
  mittel: "mittelmäßig",
  schwierig: "schwierig",
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

  // plan_week: nur fuer Wochen-Check-in
  let plan_week: number | null = null;
  if (body?.plan_week != null) {
    const w = Number(body.plan_week);
    if (Number.isInteger(w) && w >= 1 && w <= 52) plan_week = w;
  }
  const isWeekly = plan_week !== null;

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
  const insertPayload: Record<string, any> = {
    user_id: user.id,
    email: user.email || "",
    mood,
    note,
    module_slug,
    answers,
  };
  if (plan_week !== null) {
    insertPayload.plan_week = plan_week;
    insertPayload.plan_problem_key = problem_key;
  }

  const { data: insertData, error: insertError } = await admin
    .from("member_mood_logs")
    .insert(insertPayload)
    .select("id, log_date, mood, note, created_at, plan_week")
    .single();

  if (insertError) {
    console.error("[mood/log] insert failed:", insertError);
    return NextResponse.json(
      { error: insertError.message || "Speichern fehlgeschlagen" },
      { status: 500 }
    );
  }

  // ── KI-Feedback ──────────────────────────────────────────────────
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

      // Wahl der Frage-Definitionen je nach Modus
      const questionDefs = effectiveProblemKey
        ? (isWeekly
            ? WEEKLY_QUESTIONS_BY_PROBLEM[effectiveProblemKey]
            : QUESTIONS_BY_PROBLEM[effectiveProblemKey]) || []
        : [];

      const answerLines: string[] = [];
      for (const [k, v] of Object.entries(answers)) {
        const qDef = questionDefs.find((q) => q.key === k);
        const qText = qDef?.text || k;
        const optLabel = qDef?.options.find((o) => o.value === v)?.label || v;
        answerLines.push(`- ${qText} → ${optLabel}`);
      }
      const noteText = note ? `\nEigene Notiz: "${note}"` : "";

      let prompt = "";
      let maxTokens = 200;

      if (isWeekly) {
        // ── Wochen-Zusammenfassung ───────────────────────────────────
        const planIntro = getPlanIntro(effectiveProblemKey, dog);
        const weekDef = planIntro?.weeks.find((w) => w.num === plan_week);
        const weekContext = weekDef
          ? `Plan-Schwerpunkt dieser Woche (Woche ${plan_week}): "${weekDef.title}" — ${weekDef.body}`
          : `Plan-Woche: ${plan_week}`;

        // Vorherige Wochen-Eintraege fuer Vergleich
        const allWeekly = await getWeeklyCheckIns(user.id);
        const byWeek = indexByWeek(allWeekly);
        const prevWeek = byWeek.get(plan_week! - 1);
        let prevContext = "";
        if (prevWeek) {
          const prevAns = (prevWeek.answers || {}) as Record<string, string>;
          const prevLines: string[] = [];
          for (const [k, v] of Object.entries(prevAns)) {
            const qDef = questionDefs.find((q) => q.key === k);
            const optLabel =
              qDef?.options.find((o) => o.value === v)?.label || v;
            prevLines.push(`- ${qDef?.text || k} → ${optLabel}`);
          }
          prevContext = `\n\nZum Vergleich Woche ${plan_week! - 1} (Stimmung: ${MOOD_LABEL[prevWeek.mood]}):\n${prevLines.join("\n") || "(keine Antworten)"}${prevWeek.note ? `\nNotiz damals: "${prevWeek.note}"` : ""}`;
        }

        prompt = `Du bist die Pfoten-Plan KI-Trainer-Assistenz. Der User hat gerade seinen Wochen-Check für Plan-Woche ${plan_week} eingetragen.

Hund: ${dog}${problemLabel ? `, Hauptthema: ${problemLabel}` : ""}.
${weekContext}

Diese Woche - Stimmung: ${MOOD_LABEL[mood]}.
Antworten:
${answerLines.join("\n")}${noteText}${prevContext}

Schreibe eine ermutigende Wochen-Zusammenfassung in MAXIMAL 100 Wörtern. Struktur:
1. Ein Satz, was diese Woche besonders auffaellt (Erfolg oder Knackpunkt).
2. ${prevWeek ? "Ein Satz Vergleich zur Vorwoche (besser/schlechter/wo)." : "Ein Satz Einordnung wo ihr im Plan steht."}
3. Ein konkreter Tipp fuer naechste Woche (sehr konkret, kein Geschwurbel).

Sprich den User mit "du" an. Normaler Fließtext, KEIN Markdown, keine Sternchen, keine Bindestriche-Aufzählungen.`;
        maxTokens = 350;
      } else {
        // ── Taegl. Mini-Tipp (bestehender Modus) ─────────────────────
        prompt = `Du bist die Pfoten-Plan KI-Trainer-Assistenz, eine freundliche Hundetrainer-Assistenz. Der User hat gerade eine Trainings-Einheit eingetragen.

Hund: ${dog}${problemLabel ? `, Hauptthema: ${problemLabel}` : ""}.
Wie es lief: ${MOOD_LABEL[mood]}.
Antworten:
${answerLines.join("\n")}${noteText}

Gib eine konkrete, freundliche Empfehlung in MAXIMAL 60 Wörtern: was als nächstes hilft. Sei sehr konkret (z.B. "Geh morgen mit mehr Distanz zum Auslöser"), kein Geschwurbel. Sprich den User mit "du" an. Schreibe normalen Fließtext, KEIN Markdown, keine Sternchen, keine Bindestriche-Aufzählungen. Bei "schwierig"-Stimmung: ermutigend bleiben.`;
      }

      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
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

      // Wochen-Feedback persistieren (best effort, schlaegt nicht den Insert)
      if (isWeekly && feedback && insertData?.id) {
        const { error: upErr } = await admin
          .from("member_mood_logs")
          .update({ ai_feedback: feedback })
          .eq("id", insertData.id);
        if (upErr && !upErr.message?.includes("ai_feedback")) {
          console.warn("[mood/log] saving ai_feedback failed:", upErr.message);
        }
      }
    } catch (e: any) {
      console.error("[mood/log] feedback generation failed:", e?.message);
      // Feedback-Fail ist nicht fatal — User bekommt einfach kein Feedback
    }
  }

  return NextResponse.json({ ok: true, log: insertData, feedback });
}
