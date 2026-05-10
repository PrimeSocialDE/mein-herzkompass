"use client";

// Wochen-Check-in fuer den Stimmungs-Tagebuch.
// Eine kurze Frage pro Plan-Woche statt nach jeder Uebung — die KI
// fasst dir die Woche zusammen und vergleicht zur Vorwoche. Ist
// individuell auf das Quiz-Problem (Plan-Schwerpunkt) angepasst.

import { useState } from "react";
import type { MoodQuestion } from "@/lib/member-mood-questions";

type Mood = "gut" | "mittel" | "schwierig";

const MOODS: { key: Mood; emoji: string; label: string; color: string }[] = [
  { key: "gut", emoji: "😊", label: "Gut gelaufen", color: "#16A34A" },
  { key: "mittel", emoji: "😐", label: "Durchwachsen", color: "#F59E0B" },
  { key: "schwierig", emoji: "😞", label: "Schwierig", color: "#DC2626" },
];

interface Props {
  weekNum: number;
  weekTitle: string;          // z.B. "Türklingel & Besuchs-Training"
  weekBody: string;           // 1-2 Sätze Schwerpunkt
  questions: MoodQuestion[];
  problemKey: string | null;
  alreadyDone?: boolean;      // schon Eintrag fuer diese Woche?
}

export default function WeeklyCheckIn({
  weekNum,
  weekTitle,
  weekBody,
  questions,
  problemKey,
  alreadyDone = false,
}: Props) {
  const [open, setOpen] = useState(!alreadyDone);
  const [selected, setSelected] = useState<Mood | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function save() {
    if (!selected || saving) return;
    if (questions.length > 0 && Object.keys(answers).length === 0) {
      setError("Bitte beantworte mindestens eine Frage.");
      return;
    }
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
          plan_week: weekNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error?.includes("schema cache") ||
            data.error?.includes("plan_week")
            ? "Datenbank-Setup unvollständig — bitte SQL-Migration für Wochen-Check-in ausführen."
            : data.error || "Speichern fehlgeschlagen"
        );
        setSaving(false);
        return;
      }
      if (data.feedback) {
        setFeedback(data.feedback);
        setSaving(false);
      } else {
        setTimeout(() => window.location.reload(), 800);
      }
    } catch {
      setError("Verbindungsfehler. Versuch's gleich nochmal.");
      setSaving(false);
    }
  }

  // ── Stage: Feedback empfangen ────────────────────────────────────
  if (feedback) {
    return (
      <div className="bg-gradient-to-br from-[#FFFDF8] to-[#FFF9F0] border-2 border-[#C4A576] rounded-2xl p-5 shadow-[0_4px_20px_rgba(196,165,118,0.15)]">
        <div className="flex items-start gap-3 mb-3">
          <div className="text-[28px] flex-shrink-0">🐾</div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
              Deine Wochen-Zusammenfassung
            </p>
            <p className="text-[13px] font-bold text-[#1a1a1a] mb-2 leading-tight">
              Woche {weekNum}: {weekTitle}
            </p>
            <p className="text-[14px] text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
              {feedback}
            </p>
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-[#C4A576] text-white font-semibold py-2.5 px-4 rounded-xl text-[13px] shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
        >
          Verlauf ansehen
        </button>
      </div>
    );
  }

  // ── Stage: Schon erledigt → kompakte Karte mit Re-Open ───────────
  if (alreadyDone && !open) {
    return (
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-4 flex items-start gap-3">
        <span className="text-[20px] flex-shrink-0">✓</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#166534] mb-0.5">
            Wochen-Check für Woche {weekNum} erledigt
          </p>
          <p className="text-[12px] text-[#15803D] leading-relaxed mb-2">
            Du hast für diese Woche schon eingetragen. Deine Zusammenfassung
            siehst du unten im Verlauf.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="text-[12px] text-[#15803D] underline underline-offset-2 font-semibold"
          >
            Trotzdem nochmal eintragen
          </button>
        </div>
      </div>
    );
  }

  // ── Stage: Default Check-in ──────────────────────────────────────
  return (
    <div className="bg-white border border-[#EADDC5] rounded-2xl p-5">
      {/* Plan-Wochen-Kontext */}
      <div className="bg-[#FFF9F0] border border-[#EADDC5] rounded-xl p-3 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
          Plan-Woche {weekNum}
        </p>
        <p className="text-[14px] font-bold text-[#1a1a1a] mb-1 leading-tight">
          {weekTitle}
        </p>
        <p className="text-[12px] text-[#5A4A3A] leading-relaxed">
          {weekBody}
        </p>
      </div>

      <p className="text-[15px] font-bold text-[#1a1a1a] mb-3 leading-tight">
        Wie war deine Woche?
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

      {/* Wochen-Fragen — nach Mood-Auswahl */}
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
              placeholder="z.B. 'Am Wochenende war's deutlich besser als unter der Woche'"
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
            {saving ? "Hole KI-Zusammenfassung…" : "Wochen-Check eintragen"}
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
