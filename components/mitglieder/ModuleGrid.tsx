// Modul-Grid: zeigt alle Module mit Lock-Status. Freigeschaltete Module
// sind klickbar, gesperrte werden mit Lock-Overlay + Beschreibung gezeigt
// (psychologisch: User sieht was er verpasst und kann upgraden).

import Link from "next/link";
import type { ModuleWithStatus } from "@/lib/member-db";

function formatUnlockDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long" });
}

export default function ModuleGrid({
  modules,
  isPaid,
}: {
  modules: ModuleWithStatus[];
  isPaid: boolean;
}) {
  if (modules.length === 0) {
    return (
      <div className="bg-white border border-[#EADDC5] rounded-2xl p-6 text-center text-[#6B7280] text-[13px]">
        Module werden bald hier erscheinen.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
      {modules.map((m, i) => {
        const showAsLocked = !m.unlocked;
        return (
          <div
            key={m.id}
            className={`relative bg-white border rounded-2xl p-5 transition ${
              showAsLocked
                ? "border-[#F0EBE3] opacity-90"
                : "border-[#EADDC5] hover:border-[#C4A576] hover:shadow-[0_4px_16px_rgba(196,165,118,0.12)]"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="text-[10px] font-bold tracking-widest uppercase text-[#8B7355]">
                Modul {i + 1}
              </div>
              {showAsLocked ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Gesperrt
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#16A34A]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Verfügbar
                </span>
              )}
            </div>

            <h3 className="text-[16px] font-bold text-[#1a1a1a] leading-tight mb-1">
              {m.title}
            </h3>
            {m.description && (
              <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4 line-clamp-3">
                {m.description}
              </p>
            )}

            {showAsLocked ? (
              <div className="space-y-2">
                {isPaid && m.unlock_at ? (
                  <div className="text-[11px] text-[#8B7355]">
                    Wird am {formatUnlockDate(m.unlock_at)} freigeschaltet
                  </div>
                ) : (
                  <Link
                    href="/mitglieder/upgrade"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#C4A576] hover:text-[#8B7355]"
                  >
                    Freischalten →
                  </Link>
                )}
              </div>
            ) : (
              <Link
                href={`/mitglieder/modul/${m.slug}`}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#1a1a1a] hover:text-[#8B7355]"
              >
                Öffnen →
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
