"use client";

// Aktive Wochen-Challenge mit Fortschritts-Punkten und Abhak-Button.
// Optimistic Update: UI reagiert sofort, Server holt nach.

import { useState, useTransition } from "react";

interface Props {
  id: string;
  title: string;
  description: string;
  target: number;
  sessionsDone: number;
  badgeEmoji: string;
  badgeLabel: string;
  isPremium: boolean;
  completedAt: string | null;
}

export default function ChallengeCard({
  id,
  title,
  description,
  target,
  sessionsDone: initialDone,
  badgeEmoji,
  badgeLabel,
  isPremium,
  completedAt: initialCompletedAt,
}: Props) {
  const [done, setDone] = useState(initialDone);
  const [completedAt, setCompletedAt] = useState<string | null>(
    initialCompletedAt
  );
  const [pending, startTransition] = useTransition();
  const [justCompleted, setJustCompleted] = useState(false);
  const [error, setError] = useState("");

  const isCompleted = !!completedAt;
  const percent = Math.min(100, Math.round((done / target) * 100));

  async function logSession(delta: number) {
    setError("");
    const optimistic = Math.max(0, Math.min(target, done + delta));
    setDone(optimistic);
    if (optimistic >= target && !completedAt) {
      setJustCompleted(true);
      setCompletedAt(new Date().toISOString());
    }
    if (optimistic < target && completedAt) {
      setCompletedAt(null);
      setJustCompleted(false);
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/mitglieder/challenges/log-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challenge_id: id, delta }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Konnte nicht speichern");
          // Rollback bei Fehler
          setDone(initialDone);
          setCompletedAt(initialCompletedAt);
          return;
        }
        // Server-State uebernehmen
        if (data.challenge) {
          setDone(data.challenge.sessions_done);
          setCompletedAt(data.challenge.completed_at);
        }
      } catch (e) {
        setError("Verbindungsfehler");
        setDone(initialDone);
        setCompletedAt(initialCompletedAt);
      }
    });
  }

  return (
    <div
      className={`relative bg-white border rounded-2xl p-5 transition ${
        isCompleted
          ? "border-[#C4A576] shadow-[0_2px_12px_rgba(196,165,118,0.2)]"
          : "border-[#EADDC5] shadow-[0_2px_12px_rgba(139,115,85,0.06)]"
      }`}
    >
      {/* Premium-Pille */}
      {isPremium && (
        <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider bg-[#FFF9F0] text-[#8B7355] px-2 py-0.5 rounded-md">
          Bonus
        </span>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3 pr-12">
        <div
          className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[22px] ${
            isCompleted ? "bg-[#FFF9F0]" : "bg-[#FAFAFA]"
          }`}
        >
          {badgeEmoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-0.5">
            Aufgabe dieser Woche
          </p>
          <h3 className="text-[16px] font-extrabold text-[#1a1a1a] leading-tight">
            {title}
          </h3>
        </div>
      </div>

      <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">
        {description}
      </p>

      {/* Fortschritts-Punkte */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex items-center gap-1.5">
          {Array.from({ length: target }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-2 rounded-full transition-colors ${
                i < done ? "bg-[#C4A576]" : "bg-[#F0EBE3]"
              }`}
            />
          ))}
        </div>
        <span className="text-[12px] font-bold text-[#1a1a1a] min-w-[3ch] text-right">
          {done}/{target}
        </span>
      </div>

      {/* Action-Button oder Erfolgs-State */}
      {isCompleted ? (
        <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-[28px]">{badgeEmoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B7355]">
              Abzeichen verdient
            </p>
            <p className="text-[14px] font-extrabold text-[#1a1a1a]">
              {badgeLabel}
            </p>
          </div>
          {justCompleted && (
            <span className="text-[11px] font-bold text-[#15803D] animate-pulse">
              Neu!
            </span>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => logSession(1)}
            disabled={pending || done >= target}
            className="flex-1 bg-[#C4A576] hover:bg-[#B5946A] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-xl text-[13px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            Session abhaken
          </button>
          {done > 0 && (
            <button
              onClick={() => logSession(-1)}
              disabled={pending}
              className="px-3 text-[12px] text-[#9CA3AF] hover:text-[#1a1a1a] disabled:opacity-50"
              aria-label="Session zurücksetzen"
              title="Eine Session zurück"
            >
              ↺
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-[11px] text-[#B91C1C] mt-2">{error}</p>
      )}
    </div>
  );
}
