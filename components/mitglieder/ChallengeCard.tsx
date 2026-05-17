"use client";

// Aktive Wochen-Challenge mit Fortschritts-Punkten und Abhak-Button.
// Optimistic Update: UI reagiert sofort, Server holt nach.
// Konfetti + Celebration-Overlay beim Erspielen des Abzeichens.

import { useState, useTransition, useEffect, useRef } from "react";

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
  const [showCelebration, setShowCelebration] = useState(false);
  const [error, setError] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  const isCompleted = !!completedAt;
  const percent = Math.min(100, Math.round((done / target) * 100));

  // Konfetti + Celebration-Overlay starten sobald justCompleted true wird.
  // Confetti spawnt am oberen Card-Rand (visuell mittig), 2 Bursts fuer
  // mehr "Wow". Overlay zeigt 2.5s einen Toast-Hint.
  useEffect(() => {
    if (!justCompleted) return;
    setShowCelebration(true);
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("canvas-confetti");
        if (cancelled) return;
        const fire = mod.default;
        const rect = cardRef.current?.getBoundingClientRect();
        const originX = rect
          ? (rect.left + rect.width / 2) / window.innerWidth
          : 0.5;
        const originY = rect
          ? (rect.top + rect.height / 3) / window.innerHeight
          : 0.4;
        const baseOpts = {
          origin: { x: originX, y: originY },
          colors: ["#C4A576", "#FFD66B", "#E8B547", "#8B7355", "#FFF4D6"],
          zIndex: 9999,
          disableForReducedMotion: true,
        };
        fire({ ...baseOpts, particleCount: 80, spread: 70, startVelocity: 35 });
        setTimeout(() => {
          if (!cancelled) fire({ ...baseOpts, particleCount: 50, spread: 100, startVelocity: 28, scalar: 0.9 });
        }, 220);
      } catch (e) {
        // Confetti-Lib nicht ladbar? Egal — Celebration-Overlay tut's auch alleine
      }
    })();

    const t = setTimeout(() => setShowCelebration(false), 2800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [justCompleted]);

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
      ref={cardRef}
      className={`relative bg-white border rounded-2xl p-5 transition ${
        isCompleted
          ? "border-[#C4A576] shadow-[0_2px_12px_rgba(196,165,118,0.2)]"
          : "border-[#EADDC5] shadow-[0_2px_12px_rgba(139,115,85,0.06)]"
      }`}
    >
      {/* Celebration-Overlay — kurze gold-Banner-Notif beim Erspielen */}
      {showCelebration && (
        <div
          className="absolute inset-0 z-10 rounded-2xl pointer-events-none flex items-center justify-center bg-gradient-to-br from-[#FFF9F0]/95 via-[#FFF4D6]/95 to-[#FAF4E8]/95 backdrop-blur-[2px]"
          style={{ animation: "celebrationFade 2.8s ease-out forwards" }}
        >
          <div
            className="text-center px-6"
            style={{ animation: "celebrationPop 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}
          >
            <div className="text-[72px] leading-none mb-2 drop-shadow-lg">
              {badgeEmoji}
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8B7355] mb-1">
              Neues Abzeichen
            </p>
            <p className="text-[20px] font-extrabold text-[#1a1a1a] leading-tight">
              {badgeLabel}
            </p>
            <p className="text-[12px] text-[#6B7280] mt-2">
              🎉 Geschafft!
            </p>
          </div>
          <style jsx>{`
            @keyframes celebrationPop {
              0% { transform: scale(0.6) rotate(-8deg); opacity: 0; }
              60% { transform: scale(1.1) rotate(2deg); opacity: 1; }
              100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            @keyframes celebrationFade {
              0%, 70% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
        </div>
      )}

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
