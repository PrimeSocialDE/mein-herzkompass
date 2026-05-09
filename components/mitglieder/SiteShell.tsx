"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV: NavItem[] = [
  {
    href: "/mitglieder",
    label: "Übersicht",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
    ),
  },
  {
    href: "/mitglieder/erfolge",
    label: "Erfolge",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
    ),
  },
  {
    href: "/mitglieder/module",
    label: "Module",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    ),
  },
  {
    href: "/mitglieder/upgrade",
    label: "Upgrade",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    ),
  },
  {
    href: "/mitglieder/hilfe",
    label: "Hilfe",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    ),
  },
];

export default function SiteShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email?: string;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/mitglieder") return pathname === "/mitglieder";
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1a1a1a]">
      {/* ── Sidebar (Desktop ≥768px) ─────────────────────────────────── */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 bg-white border-r border-[#EADDC5]">
        <div className="px-6 py-7 border-b border-[#F0EBE3] flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Pfoten-Plan"
            className="w-9 h-9 rounded-md object-contain"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
          <div>
            <div className="text-[15px] font-bold tracking-tight text-[#1a1a1a]">
              Pfoten-Plan
            </div>
            <div className="text-[11px] text-[#8B7355] font-medium">Mitgliederbereich</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-[#FFF9F0] text-[#8B7355]"
                  : "text-[#4B5563] hover:bg-[#FAFAFA]"
              }`}
            >
              <span className={isActive(item.href) ? "text-[#C4A576]" : "text-[#9CA3AF]"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        {email && (
          <div className="px-4 py-4 border-t border-[#F0EBE3]">
            <div className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wide mb-1">
              Eingeloggt als
            </div>
            <div className="text-[12px] text-[#4B5563] truncate">{email}</div>
            <div className="mt-2 flex items-center gap-3">
              <Link
                href="/mitglieder/profil"
                className="text-[12px] text-[#9CA3AF] hover:text-[#1a1a1a] underline underline-offset-2"
              >
                Profil
              </Link>
              <span className="text-[10px] text-[#D1D5DB]">·</span>
              <form action="/api/mitglieder/logout" method="POST">
                <button
                  type="submit"
                  className="text-[12px] text-[#9CA3AF] hover:text-[#1a1a1a] underline underline-offset-2"
                >
                  Abmelden
                </button>
              </form>
            </div>
          </div>
        )}
      </aside>

      {/* ── Mobile Top-Bar ───────────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-[#EADDC5] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Pfoten-Plan"
            className="w-8 h-8 rounded-md object-contain"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
          <span className="text-[15px] font-bold tracking-tight">Pfoten-Plan</span>
        </div>
        {email && (
          <div className="flex items-center gap-3">
            <Link
              href="/mitglieder/profil"
              aria-label="Profil & Einstellungen"
              className="text-[#6B7280] hover:text-[#1a1a1a] p-1"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>
            </Link>
            <form action="/api/mitglieder/logout" method="POST">
              <button
                type="submit"
                className="text-[#6B7280] hover:text-[#1a1a1a] p-1"
                aria-label="Abmelden"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </form>
          </div>
        )}
      </header>

      {/* ── Main-Content ─────────────────────────────────────────────── */}
      <main className="md:ml-64 pb-20 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10">
          {children}
        </div>
      </main>

      {/* ── Bottom-Nav (Mobile <768px) ───────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#EADDC5] px-2 pt-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 flex-1 py-2 rounded-lg text-[11px] font-medium ${
                isActive(item.href) ? "text-[#8B7355]" : "text-[#9CA3AF]"
              }`}
            >
              <span className={isActive(item.href) ? "text-[#C4A576]" : "text-[#9CA3AF]"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
