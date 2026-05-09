// Wochen-Plan-Übersicht. Zeigt für jeden Wochen-Block:
// - Wochen-Nummer
// - Anzahl Module + Fortschritts-Indikator
// - Akkordeon mit Modul-Titeln
//
// Free-User sehen es als VORSCHAU — Module sind alle locked.
// Paid-User sehen ihre Drip-Progression — bereits freigeschaltete
// Wochen highlighted.

import Link from "next/link";
import type { WeekGroup } from "@/lib/member-weeks";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
  });
}

export default function WeekOverview({
  weeks,
  isPaid,
}: {
  weeks: WeekGroup[];
  isPaid: boolean;
}) {
  if (weeks.length === 0) return null;

  return (
    <div className="space-y-3">
      {weeks.map((w) => {
        const allUnlocked = w.unlockedCount === w.totalCount && w.totalCount > 0;
        return (
          <div
            key={w.weekNumber}
            className={`bg-white rounded-2xl border overflow-hidden ${
              w.isUnlocked
                ? "border-[#EADDC5]"
                : "border-[#F0EBE3]"
            }`}
          >
            {/* Wochen-Header */}
            <div className="px-5 py-4 flex items-center gap-3">
              {/* Status-Kreis */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-[14px] ${
                  allUnlocked
                    ? "bg-[#16A34A] text-white"
                    : w.isUnlocked
                      ? "bg-[#FFF9F0] text-[#8B7355] border-2 border-[#C4A576]"
                      : "bg-[#F3F4F6] text-[#9CA3AF]"
                }`}
              >
                {allUnlocked ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  w.weekNumber
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355]">
                  Woche {w.weekNumber}
                </p>
                <p className="text-[14px] font-bold text-[#1a1a1a] leading-tight">
                  {w.totalCount} {w.totalCount === 1 ? "Modul" : "Module"}
                  {isPaid && w.totalCount > 0 && (
                    <span className="ml-1.5 text-[12px] font-medium text-[#6B7280]">
                      ({w.unlockedCount}/{w.totalCount} frei)
                    </span>
                  )}
                </p>
              </div>

              {/* Status-Badge rechts */}
              {!w.isUnlocked && isPaid && w.unlockAt && (
                <div className="text-[11px] text-[#8B7355] font-medium text-right flex-shrink-0">
                  Frei ab<br />
                  {formatDate(w.unlockAt)}
                </div>
              )}
              {!isPaid && !w.isUnlocked && (
                <div className="flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
              )}
            </div>

            {/* Modul-Liste */}
            <div className="border-t border-[#F0EBE3] divide-y divide-[#F0EBE3]">
              {w.modules.map((m) => {
                const moduleUnlocked = m.unlocked;
                return (
                  <div
                    key={m.id}
                    className="px-5 py-3 flex items-center gap-3"
                  >
                    <div
                      className={`flex-shrink-0 w-2 h-2 rounded-full ${
                        moduleUnlocked ? "bg-[#16A34A]" : "bg-[#D1D5DB]"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-[13px] font-medium leading-tight ${
                          moduleUnlocked ? "text-[#1a1a1a]" : "text-[#6B7280]"
                        }`}
                      >
                        {m.title}
                      </p>
                      {m.description && !moduleUnlocked && (
                        <p className="text-[11px] text-[#9CA3AF] line-clamp-1 mt-0.5">
                          {m.description}
                        </p>
                      )}
                    </div>
                    {moduleUnlocked ? (
                      <Link
                        href={`/mitglieder/modul/${m.slug}`}
                        className="flex-shrink-0 text-[11px] font-semibold text-[#1a1a1a] hover:text-[#8B7355]"
                      >
                        Öffnen →
                      </Link>
                    ) : (
                      <span className="flex-shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
