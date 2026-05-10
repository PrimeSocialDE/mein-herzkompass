"use client";

// 5-Slide-Onboarding-Tutorial fuer den allerersten Login.
// Zielgruppe 40-50+ — viele kennen Plattformen nicht, wir zeigen
// klar wo was zu finden ist.
//
// Trigger: localStorage-Flag 'pp_onboarding_v1_done' nicht gesetzt.
// Mobile: full-screen-Overlay. Desktop: zentriertes Modal max-w-lg.
// Buttons: 'Zurueck' / 'Weiter' / 'Verstanden, los gehts!' (letzter Slide)
// Plus 'Spaeter ueberspringen' rechts oben.

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "pp_onboarding_v1_done";

interface Slide {
  emoji: string;
  title: (dog: string) => string;
  body: string;
  ctaHref?: string;       // optionaler 'gleich ausprobieren'-Link
  ctaLabel?: string;
}

const SLIDES: Slide[] = [
  {
    emoji: "🐾",
    title: (dog) =>
      dog === "deinem Hund"
        ? "Willkommen bei Pfoten-Plan!"
        : `Willkommen, ${dog}!`,
    body: "Wir zeigen dir in 5 kurzen Karten, was du wo findest. Du kannst jederzeit überspringen.",
  },
  {
    emoji: "🏠",
    title: () => "Übersicht — dein täglicher Startpunkt",
    body: "Hier landest du beim Login. Du siehst deine erste Übung, deinen Plan-Aufbau und alles Wichtige auf einen Blick.",
    ctaHref: "/mitglieder",
    ctaLabel: "Zur Übersicht",
  },
  {
    emoji: "🏆",
    title: () => "Erfolge — dranbleiben mit System",
    body: "Wochen-Aufgaben, Plan-Coaching mit Tagestipp und ein Stimmungs-Check für euren Trainings-Verlauf. Macht Spaß und hilft.",
    ctaHref: "/mitglieder/erfolge",
    ctaLabel: "Erfolge ansehen",
  },
  {
    emoji: "📚",
    title: () => "Module — Spezial-Themen einzeln",
    body: "Aggression, Leinenführigkeit, Trennungsangst — als Einzel-Module zum gezielten Dazukaufen, wenn ein Thema besonders dringend ist.",
    ctaHref: "/mitglieder/module",
    ctaLabel: "Modul-Shop",
  },
  {
    emoji: "💬",
    title: () => "Hilfe — der KI-Trainer ist immer da",
    body: "Stell uns Fragen, 24/7 verfügbar. Antworten in Sekunden — trainiert mit dem Wissen unseres echten Hundetrainer-Teams.",
    ctaHref: "/mitglieder/hilfe",
    ctaLabel: "KI-Trainer öffnen",
  },
];

export default function OnboardingTutorial({
  dogName,
}: {
  dogName?: string | null;
}) {
  const [show, setShow] = useState(false);
  const [index, setIndex] = useState(0);
  const dog = dogName?.trim() || "deinem Hund";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    // Klein verzoegert damit's nach dem Layout-Setup erscheint, nicht
    // sofort ueber dem half-rendered DOM
    const t = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(t);
  }, []);

  function close() {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
    setShow(false);
  }

  function next() {
    if (index < SLIDES.length - 1) setIndex(index + 1);
    else close();
  }
  function back() {
    if (index > 0) setIndex(index - 1);
  }

  // ESC-Key schliesst
  useEffect(() => {
    if (!show) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, index]);

  if (!show) return null;

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF8F5] sm:bg-black/55 flex items-center justify-center sm:px-4 sm:py-6">
      <div className="bg-white w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl sm:shadow-2xl flex flex-col overflow-hidden">
        {/* Top-Bar: Skip + Progress */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3]">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355]">
            {index + 1} / {SLIDES.length}
          </div>
          <button
            onClick={close}
            className="text-[12px] text-[#9CA3AF] underline underline-offset-2"
          >
            Überspringen
          </button>
        </div>

        {/* Slide-Content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8 sm:py-12">
          <div className="text-[72px] mb-4 leading-none">{slide.emoji}</div>
          <h2 className="text-[22px] sm:text-[26px] font-extrabold text-[#1a1a1a] leading-tight mb-3">
            {slide.title(dog)}
          </h2>
          <p className="text-[15px] text-[#4B5563] leading-relaxed max-w-md">
            {slide.body}
          </p>

          {slide.ctaHref && slide.ctaLabel && (
            <Link
              href={slide.ctaHref}
              onClick={close}
              className="mt-6 inline-block bg-[#FAFAFA] border border-[#EADDC5] text-[#1a1a1a] font-semibold py-2.5 px-5 rounded-xl text-[13px]"
            >
              {slide.ctaLabel} →
            </Link>
          )}
        </div>

        {/* Dots-Indicator */}
        <div className="flex items-center justify-center gap-1.5 py-3">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`rounded-full transition-all ${
                i === index ? "bg-[#C4A576] w-6 h-2" : "bg-[#E5DDC8] w-2 h-2"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 px-5 pb-5 pt-2 sm:pt-3">
          <button
            onClick={back}
            disabled={index === 0}
            className="flex-1 bg-[#FAFAFA] border border-[#EADDC5] disabled:opacity-40 disabled:cursor-not-allowed text-[#1a1a1a] font-semibold py-3 px-5 rounded-xl text-[14px]"
          >
            ← Zurück
          </button>
          <button
            onClick={next}
            className="flex-[2] bg-[#C4A576] text-white font-semibold py-3 px-5 rounded-xl text-[14px] shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            {isLast ? "Verstanden, los geht's!" : "Weiter →"}
          </button>
        </div>
      </div>
    </div>
  );
}
