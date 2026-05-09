// Dashboard /mitglieder.
// Layout-Philosophie: Wärme zuerst, Mehrwert zuerst, Pricing zuletzt.
// Keine Hard-Sell-Hero. User landet im Mitgliederbereich und bekommt
// sofort eine erste Übung — kein "kauf jetzt" als erstes Bild.

import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth-server";
import {
  getOrCreateMemberProfile,
  listModulesForMember,
  listActiveUpsells,
  getModuleBySlug,
  type MemberProfile,
} from "@/lib/member-db";
import FirstExerciseCard from "@/components/mitglieder/FirstExerciseCard";
import ModuleGrid from "@/components/mitglieder/ModuleGrid";
import DogProfileCard from "@/components/mitglieder/DogProfileCard";
import ProgressCircle from "@/components/mitglieder/ProgressCircle";
import WeekOverview from "@/components/mitglieder/WeekOverview";
import { groupModulesByWeek } from "@/lib/member-weeks";
import { PROBLEM_IMAGE } from "@/lib/member-images";

export const dynamic = "force-dynamic";

const PROBLEM_LABELS: Record<string, string> = {
  pulling: "Leinenziehen",
  barking: "Bellen",
  aggression: "Aggression",
  anxiety: "Trennungsangst",
  jumping: "Anspringen",
  recall: "Rückruf",
  energy: "übermäßige Energie",
  destructive: "Zerstörungsverhalten",
  soiling: "Stubenreinheit",
  mouthing: "Aufnehmen von Gegenständen",
};

export default async function MitgliederDashboard() {
  const user = await getCurrentMember();
  if (!user) {
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

  // Erste Free-Übung mit Content holen (für Hero-Card)
  const firstFree = modules.find((m) => m.is_free);
  const firstFreeFull = firstFree ? await getModuleBySlug(firstFree.slug) : null;

  // Greeting personalisiert
  const firstName =
    member.name?.split(" ")[0] ||
    (member.email?.split("@")[0] || "")
      .split(/[+._-]/)[0]
      .replace(/^./, (c) => c.toUpperCase());
  const greeting = firstName ? `Hallo ${firstName}` : "Hallo";

  // Problem-Label aus Quiz für Kontext
  const problemKey =
    member.quiz_result?.dog_problem || member.quiz_result?.problem;
  const problemLabel = problemKey ? PROBLEM_LABELS[problemKey] || null : null;

  // ───────────────────────────────────────────────────────────────────
  // PAID — Module + Fortschritt + Upsells
  // ───────────────────────────────────────────────────────────────────
  if (isPaid) {
    const unlockedCount = modules.filter((m) => m.unlocked).length;
    const weeks = groupModulesByWeek(modules);
    return (
      <>
        <Header
          greeting={greeting}
          subtitle={`Schön dass du da bist. Hier ist dein Plan für ${dog}.`}
        />

        <DogProfileCard
          dogName={member.dog_name}
          dogBreed={member.dog_breed}
          quizResult={member.quiz_result}
        />

        {/* Fortschritts-Kreis */}
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 mb-6">
          <ProgressCircle
            current={unlockedCount}
            total={modules.length}
            label="Dein Fortschritt"
            sublabel={
              unlockedCount === modules.length && modules.length > 0
                ? "Alle Module freigeschaltet — gratuliere!"
                : `${modules.length - unlockedCount} Module folgen noch`
            }
          />
        </div>

        {/* Wochen-Plan */}
        <div className="mb-8">
          <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-3">
            Dein Trainings-Plan, Woche für Woche
          </h2>
          <WeekOverview weeks={weeks} isPaid={true} />
        </div>

        {upsells.length > 0 && <UpsellSection upsells={upsells} />}
      </>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // FREE / KEIN PLAN — Welcome-First, Erste Übung, dann dezent Upgrade
  // ───────────────────────────────────────────────────────────────────
  const welcomeSubtitle = problemLabel
    ? `Schön dass du da bist. Wir zeigen dir gleich, wie du ${dog} bei „${problemLabel}" Schritt für Schritt helfen kannst.`
    : `Schön dass du da bist. Wir zeigen dir gleich, wie du ${dog} mit kleinen Übungen weiterbringst.`;

  return (
    <>
      <Header greeting={greeting} subtitle={welcomeSubtitle} />

      {/* Hund-Profil prominent — was wir aus Quiz schon wissen */}
      <DogProfileCard
        dogName={member.dog_name}
        dogBreed={member.dog_breed}
        quizResult={member.quiz_result}
      />

      {/* HERO: Erste Übung als Inhalt — KEIN Pricing! */}
      {firstFreeFull && (
        <div className="mb-8">
          <FirstExerciseCard
            module={firstFreeFull as any}
            dogName={member.dog_name}
          />
        </div>
      )}

      {/* Sozialer Beweis — wirkt am Anfang der Customer Journey besonders */}
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-5 py-3.5 mb-8 flex items-center gap-3">
        <div className="text-2xl leading-none flex-shrink-0">🐾</div>
        <p className="text-[13px] text-[#15803D] leading-relaxed">
          <strong className="text-[#166534]">Über 5.000 Hundebesitzer</strong>{" "}
          trainieren bereits mit Pfoten-Plan. Schön, dass {dog === "deinem Hund" ? "du" : `du und ${dog}`} dazugehört{dog === "deinem Hund" ? "" : "et"}.
        </p>
      </div>

      {/* Weitere Free-Übungen falls mehr als eine */}
      {modules.filter((m) => m.is_free).length > 1 && (
        <div className="mb-8">
          <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-3">
            Mehr kostenlose Übungen
          </h2>
          <ModuleGrid
            modules={modules.filter((m) => m.is_free && m.slug !== firstFree?.slug)}
            isPaid={false}
          />
        </div>
      )}

      {/* Soft-Bridge zum vollen Plan — nicht aggressiv */}
      <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-2xl p-6 mb-8">
        <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">
          Wenn du tiefer einsteigen willst
        </p>
        <h3 className="text-[18px] font-extrabold text-[#1a1a1a] mb-2 leading-tight">
          Mit dem vollen Plan bekommst du {modules.length} aufeinander
          aufgebaute Module für {dog}
        </h3>
        <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">
          Schritt-für-Schritt-Übungen, klar erklärt, sofort umsetzbar. Bei
          Fragen unterstützt dich unser KI-Trainer rund um die Uhr.
        </p>
        <Link
          href="/mitglieder/upgrade"
          className="inline-block bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-3 px-6 rounded-xl text-[14px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
        >
          Mehr erfahren
        </Link>
      </div>

      {/* Wochen-Plan-Vorschau — User sieht WIE der Plan aufgebaut ist */}
      {(() => {
        const lockedWeeks = groupModulesByWeek(modules.filter((m) => !m.is_free));
        if (lockedWeeks.length === 0) return null;
        return (
          <div className="mb-8">
            <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-1">
              So ist dein Plan aufgebaut
            </h2>
            <p className="text-[13px] text-[#6B7280] mb-4">
              Schritt für Schritt, Woche für Woche — kein Zufall, sondern
              ein klarer Pfad für {dog}.
            </p>
            <WeekOverview weeks={lockedWeeks} isPaid={false} />
          </div>
        );
      })()}

      {/* Trust-Section am Ende: Trainer-Team-Foto + KI-Trainer-Hinweis */}
      <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/TrainerPfoten-thumb.png"
            alt="Pfoten-Plan Trainer-Team"
            className="w-16 h-16 rounded-full object-cover border-2 border-[#C4A576] flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
              Hilfe vom KI-Trainer
            </p>
            <p className="text-[14px] font-bold text-[#1a1a1a] leading-tight mb-1">
              24/7 Antworten auf deine Fragen
            </p>
            <p className="text-[12px] text-[#6B7280] leading-relaxed">
              Unsere KI, trainiert mit dem Wissen unseres Hundetrainer-Teams
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Komponenten (lokal) ─────────────────────────────────────────────

function Header({ greeting, subtitle }: { greeting: string; subtitle: string }) {
  return (
    <div className="mb-6 md:mb-8">
      <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
        Übersicht
      </p>
      <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
        {greeting}
      </h1>
      <p className="text-[15px] text-[#6B7280] mt-1.5 leading-relaxed">{subtitle}</p>
    </div>
  );
}

function UpsellSection({ upsells }: { upsells: any[] }) {
  return (
    <div>
      <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-1">
        Zusätzliche Module aus dem Modul-Shop
      </h2>
      <p className="text-[13px] text-[#6B7280] mb-4">
        Wenn dein Hund noch andere Themen hat — hier kannst du gezielt erweitern.
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
  );
}
