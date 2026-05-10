"use client";

// Inline-Check-in fuer den Stimmungs-Tagebuch.
// Flow:
// 1. Mood waehlen (😊/😐/😞)
// 2. Folgefragen erscheinen (passend zum Quiz-Problem)
// 3. Optionale Notiz dazu
// 4. Eintragen → Backend speichert + holt KI-Feedback → wird angezeigt

import { useState } from "react";
import type { MoodQuestion } from "@/lib/member-mood-questions";

type Mood = "gut" | "mittel" | "schwierig";

const MOODS: { key: Mood; emoji: string; label: string; color: string }[] = [
  { key: "gut", emoji: "😊", label: "Gut gelaufen", color: "#16A34A" },
  { key: "mittel", emoji: "😐", label: "Mittel", color: "#F59E0B" },
  { key: "schwierig", emoji: "😞", label: "Schwierig", color: "#DC2626" },
];

interface Props {
  questions: MoodQuestion[];
  problemKey: string | null;
}

export default function MoodCheckIn({ questions, problemKey }: Props) {
  const [selected, setSelected] = useState<Mood | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function save() {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/mitglieder/mood/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood: selected,
          note: note.trim() || undefined,
          answers: Object.keys(answers).length ? answers : undefined,
          problem_key: problemKey || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error?.includes("schema cache")
            ? "Datenbank-Setup unvollständig (SQL-Migration ausführen)."
            : data.error || "Speichern fehlgeschlagen"
        );
        setSaving(false);
        return;
      }

      // KI-Feedback wenn vorhanden
      if (data.feedback) {
        setFeedback(data.feedback);
        setSaving(false);
        // KEIN Reload — User soll Feedback in Ruhe lesen
      } else {
        // Kein Feedback → direkt reload damit Verlauf updated
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (e) {
      setError("Verbindungsfehler. Versuch's gleich nochmal.");
      setSaving(false);
    }
  }

  function reset() {
    setSelected(null);
    setAnswers({});
    setNote("");
    setShowNote(false);
    setFeedback(null);
    setError("");
  }

  // ── Stage: Feedback empfangen ────────────────────────────────────
  if (feedback) {
    return (
      <div className="bg-gradient-to-br from-[#FFFDF8] to-[#FFF9F0] border-2 border-[#C4A576] rounded-2xl p-5 shadow-[0_4px_20px_rgba(196,165,118,0.15)]">
        <div className="flex items-start gap-3 mb-3">
          <div className="text-[28px] flex-shrink-0">🐾</div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
              Tipp vom KI-Trainer
            </p>
            <p className="text-[14px] text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
              {feedback}
            </p>
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-[#EADDC5]">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-[#C4A576] text-white font-semibold py-2.5 px-4 rounded-xl text-[13px] shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            Verlauf ansehen
          </button>
          <button
            onClick={reset}
            className="bg-white border border-[#EADDC5] text-[#1a1a1a] font-semibold py-2.5 px-4 rounded-xl text-[13px]"
          >
            Noch eintragen
          </button>
        </div>
      </div>
    );
  }

  // ── Stage: Default Check-in ──────────────────────────────────────
  return (
    <div className="bg-white border border-[#EADDC5] rounded-2xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
        Wie lief&rsquo;s heute?
      </p>
      <p className="text-[15px] font-bold text-[#1a1a1a] mb-4 leading-tight">
        Trag kurz ein wie deine letzte Übung war
      </p>

      {/* 3 Mood-Buttons */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {MOODS.map((m) => {
          const isSel = selected === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setSelected(m.key)}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-colors ${
                isSel
                  ? "border-[#C4A576] bg-[#FFF9F0]"
                  : "border-[#EADDC5] bg-white"
              }`}
              style={isSel ? { borderColor: m.color } : undefined}
            >
              <span className="text-[28px] leading-none">{m.emoji}</span>
              <span className="text-[11px] font-semibold text-[#1a1a1a]">
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Folgefragen — erst nach Mood-Auswahl, nur wenn Fragen vorhanden */}
      {selected && questions.length > 0 && (
        <div className="space-y-3 mb-4 pt-2 border-t border-[#F0EBE3]">
          {questions.map((q) => (
            <div key={q.key}>
              <p className="text-[12px] font-semibold text-[#1a1a1a] mb-1.5">
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
                      className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border ${
                        isPicked
                          ? "bg-[#C4A576] text-white border-[#C4A576]"
                          : "bg-white text-[#4B5563] border-[#EADDC5]"
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
      )}

      {/* Notiz optional */}
      {selected && (
        <>
          {!showNote ? (
            <button
              onClick={() => setShowNote(true)}
              className="text-[12px] text-[#8B7355] underline underline-offset-2 mb-3"
            >
              + Eigene Notiz dazu (optional)
            </button>
          ) : (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. 'Beim 3. Versuch hat's geklappt'"
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 border border-[#EADDC5] rounded-lg text-[13px] mb-3 focus:outline-none focus:border-[#C4A576]"
            />
          )}

          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-[#C4A576] disabled:opacity-60 text-white font-semibold py-2.5 px-5 rounded-xl text-[13px] shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            {saving
              ? "Speichere…"
              : questions.length > 0 && Object.keys(answers).length > 0
                ? "Eintragen + Tipp holen"
                : "Eintragen"}
          </button>
          {error && (
            <p className="text-[11px] text-[#B91C1C] text-center mt-2">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
