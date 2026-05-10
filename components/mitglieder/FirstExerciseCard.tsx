// "Deine gratis Übung" - Hero-Card für Free-User. Zeigt Inhalt direkt
// (statt nur Linkliste), damit User sofort einen Mehrwert hat und nicht
// erst Klicks weit weg vom Pricing landet.
//
// Pompös: GRATIS-Badge prominent, gesamte Uebung Schritt fuer Schritt
// ausgefuehrt mit Goes / No-Goes / Frequenz. Wenn Modul keinen
// strukturierten Inhalt hat: Generic-Fallback der trotzdem nach echter
// Anleitung aussieht.

import Link from "next/link";
import { imageForModule } from "@/lib/member-images";
import {
  buildExerciseFallback,
  type ContentSection,
} from "@/lib/member-exercise-fallback";

interface ModulePreview {
  slug: string;
  title: string;
  description: string | null;
  content: { sections?: ContentSection[]; image_url?: string } | any;
}

export default function FirstExerciseCard({
  module,
  dogName,
  dogBreed,
  imageOverride,
  hideImage,
}: {
  module: ModulePreview;
  dogName?: string | null;
  dogBreed?: string | null;
  imageOverride?: string | null;
  hideImage?: boolean;
}) {
  const dog = dogName?.trim() || "deinem Hund";
  const dogPossessive = dogName?.trim() ? `${dogName}s` : "Eure";
  const moduleSections: ContentSection[] = Array.isArray(
    module.content?.sections
  )
    ? module.content.sections
    : [];
  const sections =
    moduleSections.length >= 3 ? moduleSections : buildExerciseFallback(dog);
  const imageUrl =
    imageOverride || imageForModule(module.slug, module.content?.image_url);

  const stepCount = sections.filter((s) => s.type === "step").length;

  return (
    <div className="bg-white rounded-2xl border border-[#EADDC5] shadow-[0_2px_12px_rgba(139,115,85,0.06)] overflow-hidden">
      {/* Bild-Header (optional via hideImage abschaltbar) */}
      {!hideImage && (
        <div className="relative aspect-[5/4] md:aspect-[4/3] overflow-hidden bg-[#FAF4E8]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={module.title}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
        </div>
      )}

      {/* Pompöses Eyebrow: GRATIS-Badge + Sektion-Marker */}
      <div className="px-5 md:px-7 pt-5 pb-2 flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 bg-[#16A34A] text-white text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full">
          <span>★</span> Gratis
        </span>
        <span className="text-[12px] font-bold uppercase tracking-widest text-[#8B7355]">
          {dogName ? `${dogPossessive} erste Übung` : "Deine erste Übung"}
        </span>
        <span className="text-[10px] text-[#9CA3AF]">·</span>
        <span className="text-[12px] text-[#6B7280] font-medium">5 Min</span>
      </div>

      {/* Titel + Personalisierung + Beschreibung */}
      <div className="px-5 md:px-7 pb-3">
        <h2 className="text-[26px] md:text-[32px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          {module.title}
        </h2>
        <p className="text-[12px] text-[#8B7355] font-semibold mt-1.5 flex items-center gap-1.5">
          <span className="text-[#C4A576]">→</span>
          <span>
            Auf {dog}
            {dogBreed ? ` (${dogBreed})` : ""} zugeschnitten
          </span>
        </p>
        {module.description && (
          <p className="text-[14px] text-[#6B7280] leading-relaxed mt-2.5">
            {module.description}
          </p>
        )}
      </div>

      {/* Steps-Übersicht-Banner */}
      {stepCount > 0 && (
        <div className="mx-5 md:mx-7 mb-4 bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-[20px] flex-shrink-0">📝</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355]">
              So gehst du vor
            </p>
            <p className="text-[13px] font-bold text-[#1a1a1a] leading-snug">
              {stepCount} Schritt{stepCount === 1 ? "" : "e"}, klar erklärt
            </p>
          </div>
        </div>
      )}

      {/* Content-Sections — ALLE inline, nicht nur 2 */}
      <div className="px-5 md:px-7 pb-5 space-y-4">
        {sections.map((s, i) => {
          // Step-Index berechnen damit Nummerierung stimmt
          const stepIndex = sections
            .slice(0, i)
            .filter((p) => p.type === "step").length;
          return (
            <SectionRenderer key={i} section={s} stepIndex={stepIndex} />
          );
        })}

        {/* CTA: zum Modul-Detail (das hat den Closing-Teaser fuer Upsell) */}
        <div className="pt-3 border-t border-[#F0EBE3]">
          <Link
            href={`/mitglieder/modul/${module.slug}`}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-[#1a1a1a] hover:bg-[#000] text-white font-semibold px-5 py-3 rounded-xl text-[14px] transition shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          >
            Übung im Detail ansehen
            <span className="text-[12px]">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function SectionRenderer({
  section,
  stepIndex,
}: {
  section: ContentSection;
  stepIndex: number;
}) {
  if (section.type === "step") {
    return (
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#C4A576] text-white flex items-center justify-center text-[14px] font-extrabold">
          {stepIndex + 1}
        </div>
        <div className="flex-1 pt-0.5">
          {section.title && (
            <p className="text-[15px] font-bold text-[#1a1a1a] leading-snug mb-1">
              {section.title}
            </p>
          )}
          {section.content && (
            <p className="text-[13px] text-[#4B5563] leading-relaxed">
              {section.content}
            </p>
          )}
        </div>
      </div>
    );
  }
  if (section.type === "tip") {
    return (
      <div className="bg-[#FFF9F0] border-l-4 border-[#C4A576] rounded-r-lg px-4 py-3">
        <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wide mb-1">
          💡 {section.title || "Tipp"}
        </p>
        {section.content && (
          <p className="text-[13px] text-[#5A4A3A] leading-relaxed">
            {section.content}
          </p>
        )}
      </div>
    );
  }
  if (section.type === "do") {
    const items = section.items || (section.content ? [section.content] : []);
    return (
      <div className="bg-[#F0FDF4] border-l-4 border-[#16A34A] rounded-r-lg px-4 py-3">
        <p className="text-[11px] font-bold text-[#15803D] uppercase tracking-wide mb-2">
          ✓ {section.title || "Mach das"}
        </p>
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex gap-2 text-[13px] text-[#166534] leading-snug"
            >
              <span className="font-bold flex-shrink-0">✓</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (section.type === "dont") {
    const items = section.items || (section.content ? [section.content] : []);
    return (
      <div className="bg-[#FEF2F2] border-l-4 border-[#DC2626] rounded-r-lg px-4 py-3">
        <p className="text-[11px] font-bold text-[#B91C1C] uppercase tracking-wide mb-2">
          ✗ {section.title || "Bitte nicht"}
        </p>
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex gap-2 text-[13px] text-[#7F1D1D] leading-snug"
            >
              <span className="font-bold flex-shrink-0">✗</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (section.type === "frequency") {
    return (
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg px-4 py-3 flex items-start gap-3">
        <span className="text-[22px] leading-none">⏱️</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-[#1E40AF] uppercase tracking-wide mb-0.5">
            {section.title || "Wie oft"}
          </p>
          {section.content && (
            <p className="text-[13px] font-semibold text-[#1E3A8A] leading-relaxed">
              {section.content}
            </p>
          )}
        </div>
      </div>
    );
  }
  return (
    <p className="text-[14px] text-[#1a1a1a] leading-relaxed">
      {section.content || ""}
    </p>
  );
}
