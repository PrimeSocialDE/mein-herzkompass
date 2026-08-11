"use client";

// Wochen-Check-in fuer den Stimmungs-Tagebuch.
// Eine kurze Frage pro Plan-Woche statt nach jeder Uebung — die KI
// fasst dir die Woche zusammen und vergleicht zur Vorwoche. Ist
// individuell auf das Quiz-Problem (Plan-Schwerpunkt) angepasst.

import { useState } from "react";
import type { MoodQuestion } from "@/lib/member-mood-questions";

type Mood = "gut" | "mittel" | "schwierig";
type Lang = "de" | "pl" | "it";

function moodsFor(lang: Lang): { key: Mood; emoji: string; label: string; color: string }[] {
  const labels =
    lang === "pl"
      ? { gut: "Poszło dobrze", mittel: "Różnie", schwierig: "Trudno" }
      : lang === "it"
        ? { gut: "Andata bene", mittel: "Alti e bassi", schwierig: "Difficile" }
        : { gut: "Gut gelaufen", mittel: "Durchwachsen", schwierig: "Schwierig" };
  return [
    { key: "gut", emoji: "😊", label: labels.gut, color: "#16A34A" },
    { key: "mittel", emoji: "😐", label: labels.mittel, color: "#F59E0B" },
    { key: "schwierig", emoji: "😞", label: labels.schwierig, color: "#DC2626" },
  ];
}

interface Props {
  weekNum: number;
  weekTitle: string;          // z.B. "Türklingel & Besuchs-Training"
  weekBody: string;           // 1-2 Sätze Schwerpunkt
  questions: MoodQuestion[];
  problemKey: string | null;
  alreadyDone?: boolean;      // schon Eintrag fuer diese Woche?
  lang?: Lang;
}

export default function WeeklyCheckIn({
  weekNum,
  weekTitle,
  weekBody,
  questions,
  problemKey,
  alreadyDone = false,
  lang = "de",
}: Props) {
  const MOODS = moodsFor(lang);
  const t =
    lang === "pl"
      ? {
          answerAtLeastOne: "Odpowiedz proszę na co najmniej jedno pytanie.",
          dbIncomplete:
            "Konfiguracja bazy niepełna — uruchom migrację SQL dla tygodniowego checku.",
          saveFailed: "Zapis nie powiódł się",
          connError: "Błąd połączenia. Spróbuj zaraz jeszcze raz.",
          weekSummary: "Twoje podsumowanie tygodnia",
          week: "Tydzień",
          viewHistory: "Zobacz przebieg",
          weekCheckDone: (n: number) => `Tygodniowy check za tydzień ${n} zrobiony`,
          alreadyEntered:
            "Za ten tydzień masz już wpis. Podsumowanie widzisz niżej w przebiegu.",
          enterAnyway: "Mimo to wpisz jeszcze raz",
          planWeek: "Tydzień planu",
          howWasWeek: "Jak minął wasz tydzień?",
          addNote: "+ Dodaj własną notatkę (opcjonalnie)",
          notePlaceholder:
            "np. „W weekend było wyraźnie lepiej niż w tygodniu”",
          gettingSummary: "Pobieram podsumowanie AI…",
          submitCheck: "Zapisz tygodniowy check",
        }
      : lang === "it"
        ? {
            answerAtLeastOne: "Rispondi ad almeno una domanda.",
            dbIncomplete:
              "Configurazione del database incompleta — esegui la migrazione SQL per il check settimanale.",
            saveFailed: "Salvataggio non riuscito",
            connError: "Errore di connessione. Riprova subito.",
            weekSummary: "Il tuo riepilogo della settimana",
            week: "Settimana",
            viewHistory: "Vedi il percorso",
            weekCheckDone: (n: number) => `Check settimanale della settimana ${n} completato`,
            alreadyEntered:
              "Per questa settimana hai già inserito un check. Il riepilogo lo vedi sotto nel percorso.",
            enterAnyway: "Inseriscilo comunque di nuovo",
            planWeek: "Settimana del piano",
            howWasWeek: "Com'è andata la vostra settimana?",
            addNote: "+ Aggiungi una nota (facoltativo)",
            notePlaceholder:
              "es. „Nel weekend è andata molto meglio che durante la settimana”",
            gettingSummary: "Recupero il riepilogo AI…",
            submitCheck: "Registra il check settimanale",
          }
        : {
            answerAtLeastOne: "Bitte beantworte mindestens eine Frage.",
            dbIncomplete:
              "Datenbank-Setup unvollständig — bitte SQL-Migration für Wochen-Check-in ausführen.",
            saveFailed: "Speichern fehlgeschlagen",
            connError: "Verbindungsfehler. Versuch's gleich nochmal.",
            weekSummary: "Deine Wochen-Zusammenfassung",
            week: "Woche",
            viewHistory: "Verlauf ansehen",
            weekCheckDone: (n: number) => `Wochen-Check für Woche ${n} erledigt`,
            alreadyEntered:
              "Du hast für diese Woche schon eingetragen. Deine Zusammenfassung siehst du unten im Verlauf.",
            enterAnyway: "Trotzdem nochmal eintragen",
            planWeek: "Plan-Woche",
            howWasWeek: "Wie war deine Woche?",
            addNote: "+ Eigene Notiz dazu (optional)",
            notePlaceholder:
              "z.B. 'Am Wochenende war's deutlich besser als unter der Woche'",
            gettingSummary: "Hole KI-Zusammenfassung…",
            submitCheck: "Wochen-Check eintragen",
          };
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
      setError(t.answerAtLeastOne);
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
            ? t.dbIncomplete
            : data.error || t.saveFailed
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
      setError(t.connError);
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
              {t.weekSummary}
            </p>
            <p className="text-[13px] font-bold text-[#1a1a1a] mb-2 leading-tight">
              {t.week} {weekNum}: {weekTitle}
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
          {t.viewHistory}
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
            {t.weekCheckDone(weekNum)}
          </p>
          <p className="text-[12px] text-[#15803D] leading-relaxed mb-2">
            {t.alreadyEntered}
          </p>
          <button
            onClick={() => setOpen(true)}
            className="text-[12px] text-[#15803D] underline underline-offset-2 font-semibold"
          >
            {t.enterAnyway}
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
          {t.planWeek} {weekNum}
        </p>
        <p className="text-[14px] font-bold text-[#1a1a1a] mb-1 leading-tight">
          {weekTitle}
        </p>
        <p className="text-[12px] text-[#5A4A3A] leading-relaxed">
          {weekBody}
        </p>
      </div>

      <p className="text-[15px] font-bold text-[#1a1a1a] mb-3 leading-tight">
        {t.howWasWeek}
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
              {t.addNote}
            </button>
          ) : (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePlaceholder}
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
            {saving ? t.gettingSummary : t.submitCheck}
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
