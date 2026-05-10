// Modul-Detail-Seite. Free-Module: voller Inhalt für alle.
// Paid-Module: Inhalt nur für paid User. Free-User sehen Lock-Overlay.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMember } from "@/lib/member-auth-server";
import {
  getOrCreateMemberProfile,
  getModuleBySlug,
  listModulesForMember,
} from "@/lib/member-db";
import { getLatestPlanContent } from "@/lib/member-plan-content";
import PlanContentRenderer from "@/components/mitglieder/PlanContentRenderer";

export const dynamic = "force-dynamic";

interface ContentSection {
  type: "text" | "step" | "tip";
  title?: string;
  content?: string;
}

export default async function ModulDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentMember();
  if (!user) {
    return (
      <div className="text-[#6B7280]">
        Bitte zuerst <Link href="/mitglieder/login" className="underline">einloggen</Link>.
      </div>
    );
  }

  const member = await getOrCreateMemberProfile({
    userId: user.id,
    email: user.email || "",
  });
  const module = await getModuleBySlug(slug);
  if (!module) notFound();

  // Drip-Status für dieses Modul
  const allModules = await listModulesForMember(member);
  const meta = allModules.find((m) => m.slug === slug);
  const isUnlocked = !!meta?.unlocked;

  const sections: ContentSection[] = Array.isArray(module.content?.sections)
    ? module.content.sections
    : [];

  // Personalisierter Plan-Inhalt aus member_plan_content (Make.com push)
  const planContent = await getLatestPlanContent(
    user.id,
    user.email || "",
    slug
  );

  return (
    <div>
      {/* Back */}
      <Link
        href="/mitglieder"
        className="inline-flex items-center gap-1.5 text-[13px] text-[#8B7355] hover:text-[#1a1a1a] mb-4"
      >
        <span>←</span> Zurück zur Übersicht
      </Link>

      {/* Header */}
      <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-2xl px-6 py-6 mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355]">
            Modul
          </span>
          {module.is_free && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#16A34A] text-white px-2 py-0.5 rounded-md">
              Kostenlos
            </span>
          )}
          {!isUnlocked && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#9CA3AF] text-white px-2 py-0.5 rounded-md inline-flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Gesperrt
            </span>
          )}
        </div>
        <h1 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight mb-2">
          {module.title}
        </h1>
        {module.description && (
          <p className="text-[14px] text-[#6B7280] leading-relaxed">
            {module.description}
          </p>
        )}
      </div>

      {/* Content */}
      {!isUnlocked ? (
        <LockedOverlay />
      ) : planContent ? (
        // Personalisierter Inhalt aus Make.com via member_plan_content
        <>
          {planContent.dog_name && (
            <p className="text-[12px] text-[#9CA3AF] mb-4">
              Personalisiert für {planContent.dog_name}
              {planContent.dog_breed ? ` (${planContent.dog_breed})` : ""} ·
              erstellt am{" "}
              {new Date(planContent.created_at).toLocaleDateString("de-DE")}
            </p>
          )}
          <PlanContentRenderer content={planContent.content} />
          {planContent.pdf_url && (
            <a
              href={planContent.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#FAFAFA] border border-[#EADDC5] hover:bg-[#F0EBE3] text-[#1a1a1a] font-semibold py-2.5 px-5 rounded-xl text-[13px] transition mt-4"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              PDF herunterladen
            </a>
          )}
        </>
      ) : sections.length > 0 ? (
        // Statischer Modul-Inhalt aus member_modules.content (legacy)
        <div className="bg-white border border-[#EADDC5] rounded-2xl px-6 py-6 space-y-5">
          {sections.map((s, i) => (
            <SectionRenderer key={i} section={s} index={i} />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-6 text-center text-[#6B7280] text-[13px]">
          <p className="text-[20px] mb-2">📬</p>
          <p>
            Dein personalisierter Inhalt wird per E-Mail ausgeliefert. Sobald
            er fertig ist, erscheint er auch hier auf der Seite.
          </p>
        </div>
      )}
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
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#C4A576] text-white flex items-center justify-center text-[14px] font-bold">
          {index + 1}
        </div>
        <div className="flex-1 pt-1">
          {section.title && (
            <p className="text-[15px] font-semibold text-[#1a1a1a] leading-snug mb-1">
              {section.title}
            </p>
          )}
          {section.content && (
            <p className="text-[14px] text-[#6B7280] leading-relaxed">
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
        <p className="text-[12px] font-bold text-[#8B7355] uppercase tracking-wide mb-1">
          {section.title || "Tipp"}
        </p>
        {section.content && (
          <p className="text-[13px] text-[#5A4A3A] leading-relaxed">
            {section.content}
          </p>
        )}
      </div>
    );
  }
  return (
    <p className="text-[14px] text-[#1a1a1a] leading-relaxed">
      {section.content || ""}
    </p>
  );
}

function LockedOverlay() {
  return (
    <div className="bg-white border border-[#EADDC5] rounded-2xl px-6 py-10 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#FFF9F0] flex items-center justify-center text-[#C4A576]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <h2 className="text-[20px] font-extrabold text-[#1a1a1a] mb-2">
        Dieses Modul ist gesperrt
      </h2>
      <p className="text-[14px] text-[#6B7280] leading-relaxed mb-5 max-w-sm mx-auto">
        Mit dem vollen Plan bekommst du Zugriff auf alle Module — Schritt für
        Schritt aufeinander aufgebaut.
      </p>
      <Link
        href="/mitglieder/upgrade"
        className="inline-block bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-3 px-6 rounded-xl text-[14px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
      >
        Plan freischalten
      </Link>
    </div>
  );
}
