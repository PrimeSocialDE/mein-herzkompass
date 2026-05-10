"use client";

// 5-Schritt-Einfuehrung beim ersten Anmelden — KEIN Vollbild, sondern
// kleines Fenster mit blurred Hintergrund. Pfeile zeigen direkt auf
// die jeweiligen Icons in der unteren Leiste (Mobile) bzw. erwaehnen
// die Seitenleiste (Desktop). Wording strikt deutsch, ohne Anglizismen.

import { useEffect, useState } from "react";

const STORAGE_KEY = "pp_einfuehrung_v2_done";

interface Slide {
  emoji: string;
  title: (dog: string) => string;
  body: string;
  // Position des zugehoerigen Icons in der unteren Leiste (in Prozent
  // der Viewport-Breite, Mitte des Icons). null = kein Pfeil (Begruessung).
  arrowX: number | null;
}

// BottomNav-Reihenfolge (siehe SiteShell): Übersicht | Erfolge | Module | Upgrade | Hilfe
// → 5 Items, gleichmaessig verteilt → Mitten bei 10/30/50/70/90 %
const SLIDES: Slide[] = [
  {
    emoji: "👋",
    title: (dog) =>
      dog === "deinem Hund"
        ? "Schön dass du da bist!"
        : `Schön dass ${dog} da ist!`,
    body: "In 5 kurzen Schritten zeigen wir dir, was du wo findest. Du kannst jederzeit überspringen.",
    arrowX: null,
  },
  {
    emoji: "🏠",
    title: () => "Hier ist deine Übersicht",
    body: "Auf dieser Seite landest du nach der Anmeldung. Du siehst die heutige Übung und wie der Plan aufgebaut ist.",
    arrowX: 10,
  },
  {
    emoji: "🏆",
    title: () => "Hier sammelst du Erfolge",
    body: "Wochen-Aufgaben, dein Trainings-Coaching mit Tagestipp und ein Stimmungs-Tagebuch — alles an einem Platz.",
    arrowX: 30,
  },
  {
    emoji: "📚",
    title: () => "Hier sind die einzelnen Module",
    body: "Spezial-Themen wie Aggression, Leinenführung oder Trennungsangst kannst du hier einzeln dazu holen.",
    arrowX: 50,
  },
  {
    emoji: "💬",
    title: () => "Hier bekommst du Hilfe",
    body: "Stell uns Fragen — der KI-Trainer antwortet rund um die Uhr, mit dem Wissen unseres Hundetrainer-Teams.",
    arrowX: 90,
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
    <>
      {/* Backdrop mit Blur — laesst die untere Leiste (Mobile) bzw die
          Seitenleiste (Desktop) frei damit User die Icon-Labels noch
          lesen kann. */}
      <div
        className="fixed top-0 left-0 right-0 bottom-20 md:bottom-0 md:left-64 z-40 bg-black/40 backdrop-blur-md"
        onClick={close}
      />

      {/* Pfeil zum Icon (nur Mobile, nur wenn arrowX gesetzt).
          Dick + weiss + drop-shadow damit auf jedem Hintergrund sichtbar. */}
      {slide.arrowX !== null && (
        <div
          className="fixed z-50 pointer-events-none md:hidden animate-bounce"
          style={{
            left: `calc(${slide.arrowX}% - 28px)`,
            bottom: "calc(env(safe-area-inset-bottom) + 90px)",
            filter:
              "drop-shadow(0 2px 8px rgba(0,0,0,0.45)) drop-shadow(0 0 2px rgba(0,0,0,0.6))",
          }}
        >
          <svg width="56" height="72" viewBox="0 0 56 72" fill="none">
            <path
              d="M28 4 L28 56 M10 38 L28 56 L46 38"
              stroke="#FFFFFF"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="28" cy="4" r="7" fill="#FFFFFF" />
          </svg>
        </div>
      )}

      {/* Modal-Fenster — klein, zentriert oben/mittig damit Pfeil zum
          Icon unten passt */}
      <div className="fixed inset-x-0 top-[8%] sm:top-[15%] z-50 flex justify-center px-4 pointer-events-none">
        <div className="bg-white rounded-2xl max-w-sm sm:max-w-md w-full shadow-2xl pointer-events-auto overflow-hidden">
          {/* Top-Bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0EBE3]">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355]">
              {index + 1} von {SLIDES.length}
            </div>
            <button
              onClick={close}
              className="text-[12px] text-[#9CA3AF] underline underline-offset-2"
            >
              Überspringen
            </button>
          </div>

          {/* Inhalt */}
          <div className="px-6 py-6 text-center">
            <div className="text-[56px] mb-3 leading-none">{slide.emoji}</div>
            <h2 className="text-[20px] sm:text-[22px] font-extrabold text-[#1a1a1a] leading-tight mb-2">
              {slide.title(dog)}
            </h2>
            <p className="text-[14px] text-[#4B5563] leading-relaxed">
              {slide.body}
            </p>
            {/* Hinweis Desktop: Seitenleiste links */}
            {slide.arrowX !== null && (
              <p className="text-[11px] text-[#9CA3AF] italic mt-3 hidden md:block">
                Du findest das Symbol links in der Seitenleiste.
              </p>
            )}
          </div>

          {/* Punkt-Anzeige */}
          <div className="flex items-center justify-center gap-1.5 pb-3">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`rounded-full transition-all ${
                  i === index
                    ? "bg-[#C4A576] w-6 h-2"
                    : "bg-[#E5DDC8] w-2 h-2"
                }`}
                aria-label={`Schritt ${i + 1}`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-2 px-5 pb-5">
            <button
              onClick={back}
              disabled={index === 0}
              className="flex-1 bg-[#FAFAFA] border border-[#EADDC5] disabled:opacity-40 disabled:cursor-not-allowed text-[#1a1a1a] font-semibold py-2.5 px-4 rounded-xl text-[13px]"
            >
              Zurück
            </button>
            <button
              onClick={next}
              className="flex-[2] bg-[#C4A576] text-white font-semibold py-2.5 px-4 rounded-xl text-[13px] shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
            >
              {isLast ? "Verstanden, los geht's!" : "Weiter"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
