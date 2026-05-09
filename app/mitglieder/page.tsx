// Dashboard-Seite (/mitglieder).
// Zeigt 3 verschiedene Views je nach purchase_status:
//   • "free" + kein Quiz/Lead → "Hol dir deinen Plan" (1/3/6-Monats)
//   • "free" mit Quiz → Quiz-Ergebnis + 2 Free-Übungen + Upgrade-CTA
//   • "paid"          → Module-Grid (Drip) + Upsell-Empfehlungen

import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth";
import {
  getOrCreateMemberProfile,
  listModulesForMember,
  listActiveUpsells,
  type MemberProfile,
} from "@/lib/member-db";
import PlanOptionsCard from "@/components/mitglieder/PlanOptionsCard";
import ModuleGrid from "@/components/mitglieder/ModuleGrid";

export const dynamic = "force-dynamic";

export default async function MitgliederDashboard() {
  const user = await getCurrentMember();
  if (!user) {
    // Middleware sollte das auffangen, aber Defensive Render
    return (
      <div className="text-center py-12 text-[#6B7280]">
        Bitte zuerst <Link href="/mitglieder/login" className="underline">einloggen</Link>.
      </div>
    );
  }

  let member: MemberProfile;
  try {
    member = await getOrCreateMemberProfile({
      userId: user.id,
      email: user.email || "",
    });
  } catch (e) {
    return (
      <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl p-5 text-[14px]">
        Profil konnte nicht geladen werden. Bitte später nochmal versuchen.
      </div>
    );
  }

  const modules = await listModulesForMember(member);
  const upsells = await listActiveUpsells();
  const dog = member.dog_name || "deinem Hund";
  const isPaid = member.purchase_status === "paid";
  const hasQuizData = !!member.source_lead_id;

  // ── HEADER ──────────────────────────────────────────────────────────
  const Header = (
    <div className="mb-6 md:mb-8">
      <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
        Übersicht
      </p>
      <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
        {member.name ? `Hallo ${member.name},` : "Willkommen,"}
      </h1>
      <p className="text-[15px] text-[#6B7280] mt-1">
        {isPaid
          ? `Schön dass du da bist. Hier ist dein Plan für ${dog}.`
          : `Schön dass du da bist. Hier kannst du mit ${dog} loslegen.`}
      </p>
    </div>
  );

  // ── 1) KEIN Plan, KEINE Quiz-Daten → Plan-Options ──────────────────
  if (!isPaid && !hasQuizData) {
    return (
      <>
        {Header}
        <PlanOptionsCard dogName={member.dog_name} />
      </>
    );
  }

  // ── 2) FREE mit Quiz-Daten → Teaser + Upgrade ──────────────────────
  if (!isPaid) {
    const freeModules = modules.filter((m) => m.is_free);
    return (
      <>
        {Header}

        {/* Quiz-Erinnerung */}
        {member.quiz_result?.dog_problem && (
          <div className="bg-[#FFF9F0] border border-[#EADDC5] rounded-xl p-5 mb-6">
            <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider mb-1">
              Aus deinem Quiz
            </p>
            <p className="text-[14px] text-[#1a1a1a] leading-relaxed">
              Du hast uns gesagt, dass {dog}s Hauptthema{" "}
              <strong>{member.quiz_result.dog_problem}</strong> ist. Dafür haben
              wir den passenden Plan zusammengestellt.
            </p>
          </div>
        )}

        {/* Free-Übungen */}
        <div className="mb-6">
          <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-3">
            Deine kostenlosen Übungen
          </h2>
          {freeModules.length > 0 ? (
            <ModuleGrid modules={freeModules} isPaid={false} />
          ) : (
            <div className="bg-white border border-[#EADDC5] rounded-2xl p-6 text-center text-[#6B7280] text-[13px]">
              Kostenlose Übungen werden bald hier erscheinen.
            </div>
          )}
        </div>

        {/* Upgrade-CTA */}
        <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#C4A576] rounded-2xl p-6 mb-6">
          <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider mb-1">
            Schalte alles frei
          </p>
          <h3 className="text-[20px] font-extrabold text-[#1a1a1a] mb-2 leading-tight">
            Mit dem vollen Plan bekommst du {modules.length} Module für {dog}
          </h3>
          <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">
            Schritt-für-Schritt-Übungen gezielt auf {dog}s Thema. Klar erklärt,
            sofort umsetzbar.
          </p>
          <Link
            href="/mitglieder/upgrade"
            className="inline-block bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-3 px-6 rounded-xl text-[14px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            Plan freischalten
          </Link>
        </div>

        {/* Alle Module (locked) zur Vorschau */}
        <div>
          <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-3">
            Was im vollen Plan drin ist
          </h2>
          <ModuleGrid modules={modules.filter((m) => !m.is_free)} isPaid={false} />
        </div>
      </>
    );
  }

  // ── 3) PAID → Module-Grid + Upsells ────────────────────────────────
  const unlockedCount = modules.filter((m) => m.unlocked).length;
  return (
    <>
      {Header}

      {/* Fortschritt */}
      <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[13px] font-semibold text-[#1a1a1a]">Dein Fortschritt</p>
          <p className="text-[12px] text-[#8B7355] font-medium">
            {unlockedCount} / {modules.length} freigeschaltet
          </p>
        </div>
        <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#C4A576] transition-all"
            style={{
              width: modules.length === 0 ? "0%" : `${(unlockedCount / modules.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Module */}
      <div className="mb-8">
        <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-3">
          Deine Trainings-Module
        </h2>
        <ModuleGrid modules={modules} isPaid={true} />
      </div>

      {/* Upsells */}
      {upsells.length > 0 && (
        <div>
          <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-1">
            Zusätzliche Module aus dem Modul-Shop
          </h2>
          <p className="text-[13px] text-[#6B7280] mb-4">
            Wenn dein Hund noch andere Themen hat — hier kannst du
            gezielt erweitern.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upsells.map((u: any) => (
              <Link
                key={u.id}
                href={`/mitglieder/upgrade?upsell=${u.slug}`}
                className="bg-white border border-[#EADDC5] hover:border-[#C4A576] rounded-2xl p-5 transition hover:shadow-[0_4px_16px_rgba(196,165,118,0.12)]"
              >
                {u.badge_text && (
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-[#FFF9F0] text-[#8B7355] px-2 py-0.5 rounded-md mb-2">
                    {u.badge_text}
                  </span>
                )}
                <h4 className="text-[15px] font-bold text-[#1a1a1a] mb-1">
                  {u.title}
                </h4>
                {u.description && (
                  <p className="text-[12px] text-[#6B7280] leading-relaxed mb-3 line-clamp-2">
                    {u.description}
                  </p>
                )}
                <div className="text-[16px] font-extrabold text-[#C4A576]">
                  €{(u.price_cents / 100).toFixed(2).replace(".", ",")}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
