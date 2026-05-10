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
import { buildShowcaseExercise } from "@/lib/member-showcase-exercise";
import ModuleGrid from "@/components/mitglieder/ModuleGrid";
import DogProfileCard from "@/components/mitglieder/DogProfileCard";
import ProgressCircle from "@/components/mitglieder/ProgressCircle";
import WeekOverview from "@/components/mitglieder/WeekOverview";
import UpgradePopup from "@/components/mitglieder/UpgradePopup";
import OnboardingTutorial from "@/components/mitglieder/OnboardingTutorial";
import { groupModulesByWeek } from "@/lib/member-weeks";
import { PROBLEM_IMAGE } from "@/lib/member-images";
import { getPlanIntro, getBreedNote } from "@/lib/member-plan-intro";

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

  // Greeting personalisiert — wir haben oft KEINEN User-Vornamen
  // (member.name leer + Email wuerde 'kontakt' o.ae. liefern). Daher:
  // wenn Hundename bekannt → 'Schoen dass {Hundename} da ist'
  // sonst:                 → 'Schoen dass ihr da seid'
  // Email-Fallback komplett raus, weil 'Hallo Max' aus 'max@...' ist
  // irrefuehrend (Max ist meist der Hund, nicht der User).
  const dogNameTrimmed = member.dog_name?.trim() || null;
  const greeting = dogNameTrimmed
    ? `Schön dass ${dogNameTrimmed} da ist`
    : "Schön dass ihr da seid";

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
          subtitle={`Hier ist euer Plan für die nächsten Wochen.`}
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

        {/* Onboarding-Tutorial fuer Erstbesucher (auch Paid) */}
        <OnboardingTutorial dogName={member.dog_name} />
      </>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // FREE / KEIN PLAN — Wow-First: erste Uebung sofort sichtbar,
  // Profil erst danach als Kontext, dann dezent Upgrade
  // ───────────────────────────────────────────────────────────────────
  const dogPossessive = member.dog_name?.trim()
    ? `${member.dog_name.trim()}s`
    : null;

  return (
    <>
      {/* Hero-Bild als standalone Banner — KEIN Frame, edge-to-edge.
          Tightere Aspect-Ratio (16/7) schneidet oben und unten weisses
          Padding der Bild-Datei weg. bg-Farbe matched die Card-Akzent-
          Farbe damit kein harter Weiss-Sprung entsteht. */}
      <div className="-mx-4 md:-mx-8 md:mt-[-10px] mb-4 bg-[#FAF8F5]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Hero2Plan.png"
          alt="Mit Freude zum besseren Hund"
          className="w-full aspect-[16/7] object-cover object-center"
        />
      </div>

      {/* Welcome-Block: Hund-Kontext + Wochen-Position */}
      <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 mb-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="text-[28px] flex-shrink-0 leading-none">👋</div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-extrabold text-[#1a1a1a] leading-tight mb-1">
              {greeting}!
            </p>
            {/* Hund-Stats: Rasse, Alter, Hauptthema in einer Zeile */}
            {(member.dog_breed ||
              member.quiz_result?.dog_age ||
              problemLabel) && (
              <p className="text-[12px] text-[#6B7280] leading-snug">
                {[
                  member.dog_breed,
                  member.quiz_result?.dog_age,
                  problemLabel ? `Hauptthema: ${problemLabel}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          {/* Sozialer-Beweis-Pille rechts */}
          <span className="hidden sm:inline-flex items-center gap-1 bg-[#F0FDF4] border border-[#BBF7D0] rounded-full px-2.5 py-0.5 text-[11px] text-[#15803D] flex-shrink-0">
            <span className="text-[12px]">🐾</span>
            <strong className="text-[#166534]">5.000+</strong>
          </span>
        </div>

        {/* Erklaerung: was kommt unten */}
        <p className="text-[13px] text-[#4B5563] leading-relaxed mb-3">
          Unten findest du die <strong className="text-[#1a1a1a]">erste Übung aus deinem Plan</strong>.
          Es ist ein Wochen-Programm: jede Übung baut auf der vorherigen
          auf, du machst sie in deinem eigenen Tempo.
        </p>

        {/* Wochen-Position-Badge */}
        <div className="inline-flex items-center gap-2 bg-[#FFF9F0] border border-[#EADDC5] rounded-full px-3 py-1.5">
          <span className="text-[14px]">📍</span>
          <span className="text-[12px] font-bold text-[#8B7355] uppercase tracking-wider">
            Woche 1 · Übung 1 von 4
          </span>
        </div>
      </div>

      {/* Erste Übung — Showcase 'Leckerli-Test' (Wow-Moment in 5 Min).
          Hardcoded statt DB-Modul damit der ALLER-erste Eindruck stark
          ist. Slug zeigt auf real existierendes Modul fuer den Detail-Link. */}
      <div className="mb-8">
        <FirstExerciseCard
          module={
            {
              slug: firstFree?.slug || "uebung-1",
              title: buildShowcaseExercise(member.dog_name?.trim() || "deinem Hund").title,
              description: buildShowcaseExercise(member.dog_name?.trim() || "deinem Hund").description,
              content: {
                sections: buildShowcaseExercise(member.dog_name?.trim() || "deinem Hund").sections,
              },
            } as any
          }
          dogName={member.dog_name}
          dogBreed={member.dog_breed}
          hideImage
        />
      </div>

      {/* Hund-Profil — jetzt nach der Wow-Card als Kontext */}
      <DogProfileCard
        dogName={member.dog_name}
        dogBreed={member.dog_breed}
        quizResult={member.quiz_result}
      />

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

      {/* Soft-Bridge zum vollen Plan — kompakt */}
      <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-2xl p-5 mb-8">
        <h3 className="text-[18px] font-extrabold text-[#1a1a1a] mb-3 leading-tight">
          {modules.length} Module für {dog} — der volle Plan
        </h3>
        <ul className="space-y-1.5 mb-4 text-[13px] text-[#1a1a1a]">
          <li className="flex gap-2 items-start">
            <span className="text-[#C4A576] flex-shrink-0">📚</span>
            <span>Schritt-für-Schritt-Übungen</span>
          </li>
          <li className="flex gap-2 items-start">
            <span className="text-[#C4A576] flex-shrink-0">🤖</span>
            <span>KI-Trainer rund um die Uhr</span>
          </li>
          <li className="flex gap-2 items-start">
            <span className="text-[#C4A576] flex-shrink-0">🏆</span>
            <span>Wöchentliche Herausforderungen &amp; Abzeichen</span>
          </li>
        </ul>
        <Link
          href="/mitglieder/upgrade"
          className="inline-block bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-2.5 px-5 rounded-xl text-[13px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
        >
          Plan ansehen
        </Link>
      </div>

      {/* Personalisierter Plan-Aufbau — pro Quiz-Problem mit konkreten
          Wochen-Inhalten, statt generisch 'Woche fuer Woche'. */}
      {(() => {
        const planIntro = getPlanIntro(problemKey, dog);
        const breedNote = getBreedNote(member.dog_breed, problemKey);
        if (!planIntro) return null;
        return (
          <div className="mb-8">
            <h2 className="text-[20px] md:text-[22px] font-extrabold text-[#1a1a1a] leading-tight mb-2">
              {planIntro.headline}
            </h2>
            <p className="text-[13px] text-[#4B5563] leading-relaxed mb-4">
              {planIntro.intro}
            </p>

            {breedNote && (
              <div className="bg-[#FFF9F0] border-l-4 border-[#C4A576] rounded-r-lg px-4 py-2.5 mb-4">
                <p className="text-[12px] text-[#5A4A3A] leading-relaxed">
                  <strong className="text-[#8B7355]">Zur Rasse:</strong>{" "}
                  {breedNote}
                </p>
              </div>
            )}

            <div className="space-y-3">
              {planIntro.weeks.map((w) => (
                <div
                  key={w.num}
                  className="bg-white border border-[#EADDC5] rounded-xl p-4 flex gap-3"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#FFF9F0] border border-[#EADDC5] flex items-center justify-center">
                    <span className="text-[12px] font-extrabold text-[#8B7355]">
                      W{w.num}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-[#1a1a1a] leading-tight mb-0.5">
                      {w.title}
                    </p>
                    <p className="text-[12px] text-[#6B7280] leading-snug">
                      {w.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Trust-Section am Ende: Trainer-Team-Foto + KI-Trainer-Hinweis */}
      <div className="bg-white border border-[#EADDC5] rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/TrainerPfoten-thumb.png"
            alt="Pfoten-Plan Trainer-Team"
            className="w-14 h-14 rounded-full object-cover border-2 border-[#C4A576] flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-[#1a1a1a] leading-tight mb-0.5">
              KI-Trainer · 24/7 verfügbar
            </p>
            <p className="text-[12px] text-[#6B7280] leading-snug">
              Trainiert mit dem Wissen unseres Hundetrainer-Teams
            </p>
          </div>
        </div>
      </div>

      {/* Timed Upgrade-Popup — erscheint nach 75s, max 1x/Session,
          7-Tage-Cooldown bei 'Spaeter' */}
      <UpgradePopup
        email={member.email}
        leadId={member.source_lead_id}
        dogName={member.dog_name}
      />

      {/* Onboarding-Tutorial fuer Erstbesucher (5-Slide-Slider) */}
      <OnboardingTutorial dogName={member.dog_name} />
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
        Zusätzliche Module aus der Modul-Übersicht
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
