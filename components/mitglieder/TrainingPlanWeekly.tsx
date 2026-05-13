"use client";

// Rendert den N-Wochen-Trainingsplan aus member_plan_content.content.
// Statt aller Wochen als lange Liste: horizontaler Wochen-Selector
// oben + nur die selektierte Woche im Detail. Default: aktuelle Woche.

import { useState } from "react";
import type { TrainingPlanContent } from "@/lib/member-plan-content";

interface Props {
  plan: TrainingPlanContent;
  currentWeek: number;       // 1..N (aus getCurrentPlanWeek)
}

export default function TrainingPlanWeekly({ plan, currentWeek }: Props) {
  const totalWeeks = plan.weeks.length;
  const initialWeek = Math.max(1, Math.min(currentWeek, totalWeeks));
  const [selectedWeek, setSelectedWeek] = useState<number>(initialWeek);

  const week = plan.weeks.find((w) => w.num === selectedWeek) || plan.weeks[0];
  const isCurrent = week.num === currentWeek;
  const isPast = week.num < currentWeek;
  const isFuture = week.num > currentWeek;
  const monthIdx = Math.ceil(week.num / 4);

  return (
    <div className="space-y-5">
      {/* Intro-Block (kompakt, immer sichtbar oben) */}
      {plan.intro && (plan.intro.einleitung || plan.intro.ziele || plan.intro.aufbau) && (
        <details className="bg-gradient-to-br from-[#FFFDF8] to-[#FFF9F0] border border-[#EADDC5] rounded-2xl p-5">
          <summary className="cursor-pointer list-none flex items-center justify-between">
            <div>
              {plan.intro.headline && (
                <h2 className="text-[16px] md:text-[18px] font-extrabold text-[#1a1a1a] leading-tight">
                  {plan.intro.headline}
                </h2>
              )}
              <p className="text-[11px] text-[#8B7355] mt-0.5">
                Einleitung, Aufbau und Ziele
              </p>
            </div>
            <span className="text-[18px] text-[#8B7355]">▾</span>
          </summary>
          <div className="mt-4 space-y-4">
            {plan.intro.einleitung && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355] mb-1.5">
                  Einleitung
                </p>
                <p className="text-[13px] md:text-[14px] text-[#4B5563] leading-relaxed whitespace-pre-line">
                  {plan.intro.einleitung}
                </p>
              </div>
            )}
            {plan.intro.aufbau && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355] mb-1.5">
                  Aufbau
                </p>
                <p className="text-[13px] md:text-[14px] text-[#4B5563] leading-relaxed whitespace-pre-line">
                  {plan.intro.aufbau}
                </p>
              </div>
            )}
            {plan.intro.ziele && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355] mb-1.5">
                  Deine Ziele
                </p>
                <p className="text-[13px] md:text-[14px] text-[#4B5563] leading-relaxed whitespace-pre-line">
                  {plan.intro.ziele}
                </p>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Wochen-Selector (horizontaler Slider) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355]">
            Wähle eine Woche
          </p>
          <button
            type="button"
            onClick={() => setSelectedWeek(currentWeek)}
            className="text-[11px] font-semibold text-[#C4A576] hover:text-[#8B7355]"
          >
            → Aktuelle Woche
          </button>
        </div>
        <div className="-mx-4 md:mx-0 px-4 md:px-0 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 pb-1 min-w-min">
            {plan.weeks.map((w) => {
              const isSel = w.num === selectedWeek;
              const isCur = w.num === currentWeek;
              const past = w.num < currentWeek;
              return (
                <button
                  key={w.num}
                  type="button"
                  onClick={() => setSelectedWeek(w.num)}
                  className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold transition ${
                    isSel
                      ? "bg-[#C4A576] text-white shadow-[0_2px_8px_rgba(196,165,118,0.3)]"
                      : isCur
                        ? "bg-[#FFF9F0] text-[#8B7355] border-2 border-[#C4A576]"
                        : past
                          ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                          : "bg-white text-[#9CA3AF] border border-[#EADDC5]"
                  }`}
                  aria-label={`Woche ${w.num}`}
                >
                  <span className="text-[9px] uppercase tracking-wider leading-none">W</span>
                  <span className="text-[14px] leading-none mt-0.5">{w.num}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected-Week-Card */}
      <div
        className={`bg-white border-2 rounded-2xl overflow-hidden ${
          isCurrent
            ? "border-[#C4A576] shadow-[0_4px_16px_rgba(196,165,118,0.15)]"
            : "border-[#EADDC5]"
        } ${isFuture ? "opacity-90" : ""}`}
      >
        {/* Wochen-Header */}
        <div
          className={`px-5 py-3 flex items-center gap-3 ${
            isCurrent
              ? "bg-gradient-to-r from-[#FFF9F0] to-[#FFFDF8]"
              : "bg-[#FAFAFA]"
          } border-b border-[#F0EBE3]`}
        >
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold ${
              isPast
                ? "bg-[#16A34A] text-white"
                : isCurrent
                  ? "bg-[#C4A576] text-white"
                  : "bg-[#F0EBE3] text-[#9CA3AF]"
            }`}
          >
            {isPast ? "✓" : week.num}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355]">
                Woche {week.num} <span className="text-[#9CA3AF] font-medium">/ {totalWeeks}</span>
              </p>
              {isCurrent && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-white text-[#8B7355] px-1.5 py-0.5 rounded border border-[#EADDC5]">
                  Aktuell
                </span>
              )}
              {isFuture && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-[#F0EBE3] text-[#9CA3AF] px-1.5 py-0.5 rounded">
                  Kommt noch
                </span>
              )}
              {isPast && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-[#F0FDF4] text-[#15803D] px-1.5 py-0.5 rounded">
                  Geschafft
                </span>
              )}
            </div>
            <p className="text-[15px] md:text-[16px] font-extrabold text-[#1a1a1a] leading-tight">
              {week.title}
            </p>
          </div>
        </div>

        {/* Wochen-Inhalt */}
        <div className="px-5 py-4 space-y-4">
          {week.wochenziele && week.wochenziele.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355] mb-2 flex items-center gap-1.5">
                <span>🎯</span> Wochenziele
              </p>
              <ul className="space-y-1.5">
                {week.wochenziele.map((z, i) => (
                  <li
                    key={i}
                    className="text-[13px] text-[#4B5563] leading-relaxed pl-4 relative"
                  >
                    <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-[#C4A576]" />
                    {z}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {week.tagesplan && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355] mb-2 flex items-center gap-1.5">
                <span>📅</span> Tagesplan
              </p>
              <p className="text-[13px] text-[#4B5563] leading-relaxed whitespace-pre-line">
                {week.tagesplan}
              </p>
            </div>
          )}

          {week.no_gos && week.no_gos.length > 0 && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#B91C1C] mb-2 flex items-center gap-1.5">
                <span>✕</span> No-Gos
              </p>
              <ul className="space-y-1">
                {week.no_gos.map((n, i) => (
                  <li
                    key={i}
                    className="text-[12px] text-[#7F1D1D] leading-relaxed"
                  >
                    → {n}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {week.fortschritt && week.fortschritt.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355] mb-2 flex items-center gap-1.5">
                <span>📈</span> Fortschritts-Marker
              </p>
              <p className="text-[12px] text-[#6B7280] mb-1 italic">
                In dieser Woche sollte dein Hund …
              </p>
              <ul className="space-y-1">
                {week.fortschritt.map((f, i) => (
                  <li
                    key={i}
                    className="text-[13px] text-[#4B5563] leading-relaxed pl-4 relative"
                  >
                    <span className="absolute left-0 top-2 w-1.5 h-0.5 bg-[#16A34A]" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {week.uebungen && week.uebungen.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {week.uebungen.map((u, i) => (
                <div
                  key={i}
                  className="bg-[#FFFDF8] border border-[#EADDC5] rounded-xl p-4"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
                    Übung {i + 1}
                  </p>
                  <p className="text-[14px] font-bold text-[#1a1a1a] mb-2 leading-tight">
                    {u.name}
                  </p>
                  <ol className="space-y-1">
                    {u.schritte.map((s, j) => (
                      <li
                        key={j}
                        className="text-[12px] text-[#4B5563] leading-relaxed flex gap-2"
                      >
                        <span className="text-[#C4A576] font-bold flex-shrink-0">
                          {j + 1}.
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Monats-Übersicht für diese Wochen-Phase */}
      {plan.monats_uebersichten?.find((m) => m.monat === monthIdx) && (
        <details className="bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] rounded-2xl p-5">
          <summary className="cursor-pointer list-none flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#C4A576]">
              Monats-Übersicht · Monat {monthIdx}
            </p>
            <span className="text-[18px] text-[#C4A576]">▾</span>
          </summary>
          <p className="text-[13px] md:text-[14px] text-[#D1D5DB] leading-relaxed whitespace-pre-line mt-3">
            {plan.monats_uebersichten.find((m) => m.monat === monthIdx)?.text}
          </p>
        </details>
      )}

      {/* Abschluss (immer sichtbar, kompakt) */}
      {plan.abschluss && (
        <details className="bg-gradient-to-br from-[#FFFDF8] to-[#FFF9F0] border-2 border-[#C4A576] rounded-2xl p-5">
          <summary className="cursor-pointer list-none flex items-center justify-between">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[#8B7355]">
              Abschluss · Viel Erfolg 🐾
            </p>
            <span className="text-[18px] text-[#8B7355]">▾</span>
          </summary>
          <p className="text-[13px] md:text-[14px] text-[#4B5563] leading-relaxed whitespace-pre-line mt-3">
            {plan.abschluss}
          </p>
        </details>
      )}

      {/* Bonus-Spiele */}
      {plan.zusatz_spiele && plan.zusatz_spiele.length > 0 && (
        <details className="bg-white border border-[#EADDC5] rounded-2xl p-5">
          <summary className="cursor-pointer list-none flex items-center justify-between">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[#8B7355] flex items-center gap-1.5">
              <span>⭐</span> Bonus-Spiele ({plan.zusatz_spiele.length})
            </p>
            <span className="text-[18px] text-[#8B7355]">▾</span>
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {plan.zusatz_spiele.map((s) => (
              <div
                key={s.nummer}
                className="bg-[#FFFDF8] border border-[#EADDC5] rounded-xl p-4"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
                  Spiel {s.nummer}
                </p>
                <p className="text-[14px] font-bold text-[#1a1a1a] mb-2 leading-tight">
                  {s.name}
                </p>
                <p className="text-[12px] text-[#6B7280] mb-2">
                  <strong>Ziel:</strong> {s.ziel}
                </p>
                <ol className="space-y-1 mb-2">
                  {s.schritte.map((step, j) => (
                    <li
                      key={j}
                      className="text-[12px] text-[#4B5563] leading-relaxed flex gap-2"
                    >
                      <span className="text-[#C4A576] font-bold flex-shrink-0">
                        {j + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="text-[11px] text-[#6B7280] italic leading-relaxed mt-2 pt-2 border-t border-[#F0EBE3]">
                  {s.warum}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
