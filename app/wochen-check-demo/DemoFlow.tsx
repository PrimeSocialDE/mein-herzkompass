"use client";

// Demo-Flow: Problem waehlen → Hundename → Stimmung → Fragen → KI-Antwort.
// Alles in einer Komponente fuer maximale Conversion.

import { useEffect, useState } from "react";
import {
  WEEKLY_QUESTIONS_BY_PROBLEM,
  type MoodQuestion,
} from "@/lib/member-mood-questions";

type Mood = "gut" | "mittel" | "schwierig";

interface Problem {
  key: string;
  emoji: string;
  label: string;
}

interface Props {
  problems: Problem[];
}

const MOODS: { key: Mood; emoji: string; label: string; color: string }[] = [
  { key: "gut", emoji: "😊", label: "Gut gelaufen", color: "#16A34A" },
  { key: "mittel", emoji: "😐", label: "Durchwachsen", color: "#F59E0B" },
  { key: "schwierig", emoji: "😞", label: "Schwierig", color: "#DC2626" },
];

type Stage = "problem" | "dog" | "mood" | "questions" | "loading" | "result";

export default function DemoFlow({ problems }: Props) {
  const [stage, setStage] = useState<Stage>("problem");
  const [problemKey, setProblemKey] = useState<string | null>(null);
  const [dogName, setDogName] = useState("");
  const [mood, setMood] = useState<Mood | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState("");

  const questions: MoodQuestion[] = problemKey
    ? WEEKLY_QUESTIONS_BY_PROBLEM[problemKey] || []
    : [];

  // Auto-advance: wenn alle Fragen beantwortet → submit
  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => answers[q.key] !== undefined);

  useEffect(() => {
    if (stage === "questions" && allAnswered) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, allAnswered]);

  async function submit() {
    if (!problemKey || !mood) return;
    setStage("loading");
    setError("");
    try {
      const res = await fetch("/api/wochen-check-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem_key: problemKey,
          dog_name: dogName.trim() || null,
          mood,
          answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Etwas ist schief gelaufen.");
        setStage("questions");
        return;
      }
      setFeedback(data.feedback);
      setStage("result");
    } catch {
      setError("Verbindungsfehler. Versuch's gleich nochmal.");
      setStage("questions");
    }
  }

  function reset() {
    setStage("problem");
    setProblemKey(null);
    setDogName("");
    setMood(null);
    setAnswers({});
    setFeedback(null);
    setError("");
  }

  // Fortschritts-Anzeige
  const stageNum =
    stage === "problem"
      ? 1
      : stage === "dog"
        ? 2
        : stage === "mood"
          ? 3
          : stage === "questions"
            ? 4
            : 5;

  return (
    <div className="bg-white border border-[#EADDC5] rounded-3xl p-5 md:p-7 shadow-[0_4px_24px_rgba(139,115,85,0.08)]">
      {/* Schritt-Anzeige (nicht im result) */}
      {stage !== "result" && stage !== "loading" && (
        <div className="flex items-center gap-1.5 mb-5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full ${
                n <= stageNum ? "bg-[#C4A576]" : "bg-[#F0EBE3]"
              }`}
            />
          ))}
        </div>
      )}

      {/* ── Stage 1: Problem auswaehlen ──────────────────────────────── */}
      {stage === "problem" && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">
            Schritt 1 von 4
          </p>
          <h2 className="text-[20px] md:text-[24px] font-extrabold text-[#1a1a1a] leading-tight mb-4">
            Was ist gerade dein größtes Thema?
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {problems.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setProblemKey(p.key);
                  setStage("dog");
                }}
                className="flex flex-col items-center gap-1 py-4 px-2 rounded-xl border-2 border-[#EADDC5] bg-white hover:border-[#C4A576] hover:bg-[#FFF9F0] transition-colors"
              >
                <span className="text-[28px] leading-none">{p.emoji}</span>
                <span className="text-[12px] font-semibold text-[#1a1a1a] text-center leading-tight">
                  {p.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Stage 2: Hundename ───────────────────────────────────────── */}
      {stage === "dog" && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">
            Schritt 2 von 4
          </p>
          <h2 className="text-[20px] md:text-[24px] font-extrabold text-[#1a1a1a] leading-tight mb-4">
            Wie heißt dein Hund?
          </h2>
          <p className="text-[13px] text-[#6B7280] mb-3 leading-relaxed">
            Damit der KI-Coach dich persönlich ansprechen kann.
          </p>
          <input
            type="text"
            value={dogName}
            onChange={(e) => setDogName(e.target.value.slice(0, 40))}
            placeholder="z.B. Bruno"
            autoFocus
            className="w-full px-4 py-3 border-2 border-[#EADDC5] rounded-xl text-[15px] mb-4 focus:outline-none focus:border-[#C4A576]"
            onKeyDown={(e) => {
              if (e.key === "Enter") setStage("mood");
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setStage("problem")}
              className="bg-[#FAFAFA] border border-[#EADDC5] text-[#1a1a1a] font-semibold py-3 px-4 rounded-xl text-[13px]"
            >
              ← Zurück
            </button>
            <button
              onClick={() => setStage("mood")}
              className="flex-1 bg-[#C4A576] text-white font-semibold py-3 px-4 rounded-xl text-[14px] shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
            >
              Weiter →
            </button>
          </div>
        </>
      )}

      {/* ── Stage 3: Mood ────────────────────────────────────────────── */}
      {stage === "mood" && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">
            Schritt 3 von 4
          </p>
          <h2 className="text-[20px] md:text-[24px] font-extrabold text-[#1a1a1a] leading-tight mb-4">
            Wie war eure letzte Woche?
          </h2>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {MOODS.map((m) => {
              const isSel = mood === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => {
                    setMood(m.key);
                    setStage("questions");
                  }}
                  className={`flex flex-col items-center gap-1 py-4 px-2 rounded-xl border-2 transition-colors ${
                    isSel
                      ? "border-[#C4A576] bg-[#FFF9F0]"
                      : "border-[#EADDC5] bg-white hover:border-[#C4A576]"
                  }`}
                  style={isSel ? { borderColor: m.color } : undefined}
                >
                  <span className="text-[32px] leading-none">{m.emoji}</span>
                  <span className="text-[12px] font-semibold text-[#1a1a1a]">
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setStage("dog")}
            className="bg-[#FAFAFA] border border-[#EADDC5] text-[#1a1a1a] font-semibold py-2.5 px-4 rounded-xl text-[12px]"
          >
            ← Zurück
          </button>
        </>
      )}

      {/* ── Stage 4: Konkrete Fragen ─────────────────────────────────── */}
      {stage === "questions" && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">
            Schritt 4 von 4
          </p>
          <h2 className="text-[20px] md:text-[24px] font-extrabold text-[#1a1a1a] leading-tight mb-1">
            {dogName ? `Erzähl mir von ${dogName}` : "Erzähl mir mehr"}
          </h2>
          <p className="text-[12px] text-[#6B7280] mb-4 leading-relaxed">
            {questions.length} kurze Fragen - tipp einfach an, was am ehesten
            zutrifft.
          </p>

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div
                key={q.key}
                className={`pb-4 ${
                  idx < questions.length - 1
                    ? "border-b border-[#F0EBE3]"
                    : ""
                }`}
              >
                <p className="text-[13px] font-semibold text-[#1a1a1a] mb-2">
                  <span className="text-[#C4A576] mr-1.5">{idx + 1}.</span>
                  {q.text}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {q.options.map((opt) => {
                    const isPicked = answers[q.key] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setAnswers((s) => ({ ...s, [q.key]: opt.value }))
                        }
                        className={`text-[12px] font-semibold px-3 py-2 rounded-full border transition-colors ${
                          isPicked
                            ? "bg-[#C4A576] text-white border-[#C4A576]"
                            : "bg-white text-[#4B5563] border-[#EADDC5] hover:border-[#C4A576]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-[12px] text-[#B91C1C] text-center mt-3">
              {error}
            </p>
          )}

          {!allAnswered && (
            <p className="text-[11px] text-[#9CA3AF] text-center mt-4 italic">
              Sobald alle Fragen beantwortet sind, läuft die KI los…
            </p>
          )}
        </>
      )}

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {stage === "loading" && (
        <div className="text-center py-10">
          <div className="text-[48px] mb-3 animate-pulse">🐾</div>
          <p className="text-[16px] font-bold text-[#1a1a1a] mb-1">
            KI analysiert eure Woche…
          </p>
          <p className="text-[12px] text-[#6B7280]">Dauert ein paar Sekunden.</p>
        </div>
      )}

      {/* ── Result ──────────────────────────────────────────────────── */}
      {stage === "result" && feedback && (
        <>
          <div className="bg-gradient-to-br from-[#FFFDF8] to-[#FFF9F0] border-2 border-[#C4A576] rounded-2xl p-5 mb-5 shadow-[0_4px_20px_rgba(196,165,118,0.15)]">
            <div className="flex items-start gap-3 mb-3">
              <div className="text-[32px] flex-shrink-0">🐾</div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
                  Deine KI-Wochen-Empfehlung
                </p>
                <p className="text-[13px] font-bold text-[#1a1a1a]">
                  {dogName ? `Für ${dogName}` : "Für euch"} · von Pfoten-Plan
                </p>
              </div>
            </div>
            <p className="text-[14px] md:text-[15px] text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
              {feedback}
            </p>
          </div>

          {/* CTA-Block */}
          <div className="bg-[#1a1a1a] rounded-2xl p-5 md:p-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#C4A576] mb-2">
              Das war nur die Vorschau
            </p>
            <h3 className="text-[18px] md:text-[22px] font-extrabold text-white leading-tight mb-2">
              Hol dir den vollen Pfoten-Plan{" "}
              {dogName ? `für ${dogName}` : "für deinen Hund"}
            </h3>
            <p className="text-[13px] text-[#D1D5DB] leading-relaxed mb-4">
              4 Wochen Schritt-für-Schritt-Plan, KI-Trainer rund um die Uhr,
              Wochen-Begleitung und alle Spezial-Module.
            </p>
            <a
              href="/quiz.html"
              className="inline-block bg-[#C4A576] text-white font-bold py-3.5 px-6 rounded-xl text-[15px] shadow-[0_2px_8px_rgba(196,165,118,0.4)] mb-2"
            >
              Plan in 2 Min zusammenstellen →
            </a>
            <p className="text-[11px] text-[#9CA3AF]">
              Ab 9,90 € · 14 Tage Geld-zurück-Garantie
            </p>
          </div>

          <button
            onClick={reset}
            className="w-full mt-4 text-[12px] text-[#8B7355] underline underline-offset-2 font-semibold py-2"
          >
            Nochmal von vorn (anderes Thema probieren)
          </button>
        </>
      )}
    </div>
  );
}
