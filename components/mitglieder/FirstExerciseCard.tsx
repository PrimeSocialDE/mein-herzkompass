// "Deine erste Übung" - Hero-Card für Free-User. Zeigt direkt Inhalt
// (statt nur Linkliste), damit User sofort einen Mehrwert haben und
// nicht erst 3 Klicks weit weg vom Pricing landen.

import Link from "next/link";

interface ContentSection {
  type: "text" | "step" | "tip";
  title?: string;
  content?: string;
}

interface ModulePreview {
  slug: string;
  title: string;
  description: string | null;
  content: { sections?: ContentSection[] } | any;
}

export default function FirstExerciseCard({
  module,
  dogName,
}: {
  module: ModulePreview;
  dogName?: string | null;
}) {
  const dog = dogName || "deinem Hund";
  const sections: ContentSection[] = Array.isArray(module.content?.sections)
    ? module.content.sections
    : [];

  // Erste 2 Sections inline zeigen, Rest hinter "Komplett ansehen"-Link
  const visibleSections = sections.slice(0, 2);
  const hasMore = sections.length > 2;

  return (
    <div className="bg-white rounded-2xl border border-[#EADDC5] shadow-[0_2px_12px_rgba(139,115,85,0.06)] overflow-hidden">
      {/* Beige-Top-Section mit Modul-Titel */}
      <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] px-6 py-5 border-b border-[#F0EBE3]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355]">
            Deine erste Übung
          </span>
          <span className="text-[10px] text-[#9CA3AF]">·</span>
          <span className="text-[10px] text-[#9CA3AF]">5 Min</span>
        </div>
        <h2 className="text-[22px] md:text-[26px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          {module.title}
        </h2>
        {module.description && (
          <p className="text-[14px] text-[#6B7280] leading-relaxed mt-2">
            {module.description}
          </p>
        )}
      </div>

      {/* Content-Sections inline */}
      <div className="px-6 py-5 space-y-4">
        {visibleSections.length === 0 ? (
          <p className="text-[14px] text-[#6B7280] leading-relaxed">
            Klick unten auf "Komplett ansehen" — dort findest du die Schritt-
            für-Schritt-Anleitung für {dog}.
          </p>
        ) : (
          visibleSections.map((s, i) => (
            <SectionRenderer key={i} section={s} index={i} />
          ))
        )}

        {hasMore && (
          <div className="pt-2">
            <Link
              href={`/mitglieder/modul/${module.slug}`}
              className="inline-flex items-center gap-1.5 bg-[#1a1a1a] hover:bg-[#000] text-white font-semibold px-5 py-3 rounded-xl text-[14px] transition shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
            >
              Komplette Übung ansehen
              <span className="text-[12px]">→</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionRenderer({
  section,
  index,
}: {
  section: ContentSection;
  index: number;
}) {
  if (section.type === "step") {
    return (
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#C4A576] text-white flex items-center justify-center text-[13px] font-bold">
          {index + 1}
        </div>
        <div className="flex-1 pt-0.5">
          {section.title && (
            <p className="text-[14px] font-semibold text-[#1a1a1a] leading-snug mb-1">
              {section.title}
            </p>
          )}
          {section.content && (
            <p className="text-[13px] text-[#6B7280] leading-relaxed">
              {section.content}
            </p>
          )}
        </div>
      </div>
    );
  }
  if (section.type === "tip") {
    return (
      <div className="bg-[#FFF9F0] border-l-3 border-[#C4A576] rounded-r-lg px-4 py-3">
        {section.title && (
          <p className="text-[12px] font-bold text-[#8B7355] uppercase tracking-wide mb-1">
            {section.title || "Tipp"}
          </p>
        )}
        {section.content && (
          <p className="text-[13px] text-[#5A4A3A] leading-relaxed">
            {section.content}
          </p>
        )}
      </div>
    );
  }
  // Default: text
  return (
    <p className="text-[14px] text-[#1a1a1a] leading-relaxed">
      {section.content || ""}
    </p>
  );
}
