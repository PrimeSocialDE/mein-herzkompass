// Rendert den 12-Wochen-Trainingsplan aus member_plan_content.content.
// Layout angelehnt an die Mail-PDF: Intro-Karten, Wochen-Karten mit
// Ziel/Tagesplan/No-Gos/Fortschritt/Uebungen, Monatsuebersichten, Abschluss.
//
// Aktuelle Woche wird optisch hervorgehoben (Gold-Rahmen + "Aktuell"-Tag).
// Zukuenftige Wochen sind sichtbar aber etwas matt damit klar ist was kommt.

import type { TrainingPlanContent } from "@/lib/member-plan-content";

interface Props {
  plan: TrainingPlanContent;
  currentWeek: number;       // 1..N (aus getCurrentPlanWeek)
}

export default function TrainingPlanWeekly({ plan, currentWeek }: Props) {
  const totalWeeks = plan.weeks.length;

  return (
    <div className="space-y-5">
      {/* Intro-Block */}
      {plan.intro && (plan.intro.einleitung || plan.intro.ziele || plan.intro.aufbau) && (
        <div className="bg-gradient-to-br from-[#FFFDF8] to-[#FFF9F0] border border-[#EADDC5] rounded-2xl p-5">
          {plan.intro.headline && (
            <h2 className="text-[18px] md:text-[20px] font-extrabold text-[#1a1a1a] leading-tight mb-3">
              {plan.intro.headline}
            </h2>
          )}
          {plan.intro.einleitung && (
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355] mb-1.5">
                Einleitung
              </p>
              <p className="text-[13px] md:text-[14px] text-[#4B5563] leading-relaxed whitespace-pre-line">
                {plan.intro.einleitung}
              </p>
            </div>
          )}
          {plan.intro.ziele && (
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355] mb-1.5">
                Deine Ziele
              </p>
              <p className="text-[13px] md:text-[14px] text-[#4B5563] leading-relaxed whitespace-pre-line">
                {plan.intro.ziele}
              </p>
            </div>
          )}
          {plan.intro.aufbau && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355] mb-1.5">
                Aufbau deines Plans
              </p>
              <p className="text-[13px] md:text-[14px] text-[#4B5563] leading-relaxed whitespace-pre-line">
                {plan.intro.aufbau}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Wochen + ggf. Monatsuebersichten inline */}
      {plan.weeks.map((week) => {
        const isCurrent = week.num === currentWeek;
        const isPast = week.num < currentWeek;
        const isFuture = week.num > currentWeek;

        // Nach jeder 4. Woche pruefen ob es eine Monatsuebersicht gibt
        const monthIdx = Math.ceil(week.num / 4);
        const showMonthOverviewAfter =
          week.num % 4 === 0 &&
          plan.monats_uebersichten?.find((m) => m.monat === monthIdx);

        return (
          <div key={week.num}>
            <div
              className={`bg-white border-2 rounded-2xl overflow-hidden ${
                isCurrent
                  ? "border-[#C4A576] shadow-[0_4px_16px_rgba(196,165,118,0.15)]"
                  : "border-[#EADDC5]"
              } ${isFuture ? "opacity-75" : ""}`}
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
                  </div>
                  <p className="text-[15px] md:text-[16px] font-extrabold text-[#1a1a1a] leading-tight">
                    {week.title}
                  </p>
                </div>
              </div>

              {/* Wochen-Inhalt — bei zukuenftigen Wochen kompakt anteasern */}
              <div className="px-5 py-4 space-y-4">
                {/* Wochenziele */}
                {week.wochenziele.length > 0 && (
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

                {/* Tagesplan */}
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

                {/* No-Gos */}
                {week.no_gos.length > 0 && (
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

                {/* Fortschritts-Marker */}
                {week.fortschritt.length > 0 && (
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

                {/* Uebungen */}
                {week.uebungen.length > 0 && (
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

            {/* Monats-Uebersicht direkt nach Woche 4/8/12 */}
            {showMonthOverviewAfter && (
              <div className="mt-3 bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] rounded-2xl p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#C4A576] mb-2">
                  Monats-Übersicht · Monat {monthIdx}
                </p>
                <p className="text-[13px] md:text-[14px] text-[#D1D5DB] leading-relaxed whitespace-pre-line">
                  {showMonthOverviewAfter.text}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Abschluss */}
      {plan.abschluss && (
        <div className="bg-gradient-to-br from-[#FFFDF8] to-[#FFF9F0] border-2 border-[#C4A576] rounded-2xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">
            Abschluss · Viel Erfolg 🐾
          </p>
          <p className="text-[13px] md:text-[14px] text-[#4B5563] leading-relaxed whitespace-pre-line">
            {plan.abschluss}
          </p>
        </div>
      )}

      {/* Bonus-Spiele */}
      {plan.zusatz_spiele && plan.zusatz_spiele.length > 0 && (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355] mb-3 flex items-center gap-1.5">
            <span>⭐</span> Bonus-Spiele
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
        </div>
      )}
    </div>
  );
}
