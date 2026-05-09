// Modul-Grid: zeigt alle Module mit Lock-Status. Freigeschaltete Module
// sind klickbar, gesperrte werden mit Lock-Overlay + Beschreibung gezeigt
// (psychologisch: User sieht was er verpasst und kann upgraden).

import Link from "next/link";
import type { ModuleWithStatus } from "@/lib/member-db";
import { imageForModule } from "@/lib/member-images";

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
        const img = imageForModule(m.slug);
        return (
          <div
            key={m.id}
            className={`relative bg-white border rounded-2xl overflow-hidden transition ${
              showAsLocked
                ? "border-[#F0EBE3]"
                : "border-[#EADDC5] hover:border-[#C4A576] hover:shadow-[0_4px_16px_rgba(196,165,118,0.12)]"
            }`}
          >
            {/* Bild-Header — bei locked: Sepia/Grau-Filter für klares Visual */}
            <div className="relative h-32 bg-[#FAF4E8] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt={m.title}
                className={`absolute inset-0 w-full h-full object-cover transition ${
                  showAsLocked ? "grayscale opacity-60" : ""
                }`}
              />
              {showAsLocked && (
                <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                  <div className="bg-white/90 backdrop-blur-sm rounded-full p-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B7355" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                </div>
              )}
              <div className="absolute top-2.5 left-3 inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md">
                <span className="text-[9px] font-bold tracking-widest uppercase text-[#8B7355]">
                  Modul {i + 1}
                </span>
              </div>
              {!showAsLocked && (
                <div className="absolute top-2.5 right-3 inline-flex items-center gap-1 bg-[#16A34A] text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  Frei
                </div>
              )}
            </div>

            <div className="p-4">
              <h3 className="text-[15px] font-bold text-[#1a1a1a] leading-tight mb-1">
                {m.title}
              </h3>
              {m.description && (
                <p className="text-[12px] text-[#6B7280] leading-relaxed mb-3 line-clamp-2">
                  {m.description}
                </p>
              )}
              {showAsLocked ? (
                isPaid && m.unlock_at ? (
                  <div className="text-[11px] text-[#8B7355] font-medium">
                    Wird am {formatUnlockDate(m.unlock_at)} freigeschaltet
                  </div>
                ) : (
                  <Link
                    href="/mitglieder/upgrade"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#C4A576] hover:text-[#8B7355]"
                  >
                    Freischalten →
                  </Link>
                )
              ) : (
                <Link
                  href={`/mitglieder/modul/${m.slug}`}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1a1a1a] hover:text-[#8B7355]"
                >
                  Öffnen →
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
