// /mitglieder/erfolge — Wochen-Challenges + Badge-Wand.
// Free: 1 Challenge pro Woche + geblurrte Premium-Vorschau (FOMO).
// Paid: bis zu 3 Challenges, alles freigeschaltet.

import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";
import {
  getOrAssignWeekChallenges,
  getEarnedBadges,
  CHALLENGE_TEMPLATES,
} from "@/lib/member-challenges";
import ChallengeCard from "@/components/mitglieder/ChallengeCard";
import { getMemberLang, type Lang } from "@/lib/member-lang";

export const dynamic = "force-dynamic";

// Ghost-Tiles: alle noch-nicht-erspielten Abzeichen als schwarz-weisse
// Silhouetten anzeigen. Voll-Sammlung macht das Erspielen sichtbar als
// Fortschrittsziel. Kein hartes Cap mehr.

export default async function ErfolgePage() {
  const user = await getCurrentMember();
  if (!user) {
    return (
      <div className="text-center py-12 text-[#6B7280]">
        Bitte zuerst{" "}
        <Link href="/mitglieder/login" className="underline">
          einloggen
        </Link>
        .
      </div>
    );
  }

  const member = await getOrCreateMemberProfile({
    userId: user.id,
    email: user.email || "",
  });

  const lang = await getMemberLang(user?.email ?? member?.email ?? null);

  const isPaid = member.purchase_status === "paid";
  const dogName = member.dog_name?.trim() || null;
  const dog = dogName || (lang === "pl" ? "Twojego psa" : "deinem Hund");
  const dogPossessive = dogName ? `${dogName}s` : "Eure";

  // Parallel: Challenges + Badges gleichzeitig holen statt nacheinander
  const [challenges, badges] = await Promise.all([
    getOrAssignWeekChallenges(member),
    getEarnedBadges(user.id, 24),
  ]);

  const completedThisWeek = challenges.filter((c) => c.completed_at).length;
  const totalThisWeek = challenges.length;

  // Premium-Vorschau-Challenges (nur fuer Free, FOMO-Trigger)
  const earnedSlugs = new Set(
    badges.map((b: any) => b.challenge_slug as string)
  );
  const lockedPreview = isPaid
    ? []
    : CHALLENGE_TEMPLATES.filter(
        (t) => t.is_premium && !earnedSlugs.has(t.slug)
      ).slice(0, 3);

  // Ghost-Abzeichen (alles was sie noch nicht haben, fuer Sammlung-Optik).
  // KOMPLETTE Liste — User sieht die gesamte Trophy-Sammlung als Ziel.
  const ghostBadgeTemplates = CHALLENGE_TEMPLATES.filter(
    (t) => !earnedSlugs.has(t.slug)
  );

  const t =
    lang === "pl"
      ? {
          backToOverview: "← Przegląd sukcesów",
          heroAlt: "Wasz tydzień treningowy",
          thisWeek: "W tym tygodniu",
          introPre: "Małe zadania treningowe dla ",
          introPost:
            ", które pasują do codzienności. Jak je wykonacie, zbieracie odznaki na ścianę.",
          done: " zrobione",
          newMonday: " · Nowe od poniedziałku",
          emptyChallenges:
            "W tym tygodniu brak nowego zadania. Ciąg dalszy w poniedziałek.",
          bonusTasks: "Zadania bonusowe",
          bonusPlus: "+3 zadania tygodniowo",
          bonusUnlocked: "Odblokowane w pełnym planie",
          unlock: "Odblokuj",
          collected: " zebranych",
          firstBadge: "Wykonaj pierwsze zadanie → pierwsza odznaka.",
          stillToEarn: "Jeszcze do zdobycia",
          openCount: " do zdobycia",
        }
      : {
          backToOverview: "← Erfolge-Übersicht",
          heroAlt: "Eure Trainings-Woche",
          thisWeek: "Diese Woche",
          introPre: "Kleine Trainings-Aufgaben für ",
          introPost:
            ", die in den Alltag passen. Schafft ihr sie, sammelt ihr Abzeichen für die Wand.",
          done: " geschafft",
          newMonday: " · Neue ab Montag",
          emptyChallenges:
            "Diese Woche keine neue Aufgabe. Montag geht’s weiter.",
          bonusTasks: "Bonus-Aufgaben",
          bonusPlus: "+3 Aufgaben pro Woche",
          bonusUnlocked: "Im vollen Plan freigeschaltet",
          unlock: "Freischalten",
          collected: " gesammelt",
          firstBadge: "Erste Aufgabe schaffen → erstes Abzeichen.",
          stillToEarn: "Noch zu erspielen",
          openCount: " offen",
        };

  return (
    <>
      {/* Back-Link zum Hub */}
      <Link
        href="/mitglieder/erfolge"
        className="inline-flex items-center gap-1 text-[12px] text-[#6B7280] mb-3"
      >
        {t.backToOverview}
      </Link>

      {/* Hero-Banner — flacher (16/7), oben staerker beschnitten */}
      <div className="mb-5 -mx-4 md:-mx-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Aufgaben.jpg"
          alt={t.heroAlt}
          className="w-full aspect-[16/7] object-cover object-bottom md:rounded-2xl"
        />
      </div>

      {/* Header — Hundename prominent, kurze Einordnung darunter */}
      <div className="mb-5">
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          {t.thisWeek}
        </p>
        <h1 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          {lang === "pl"
            ? dogName
              ? `Tydzień treningowy ${dogName}`
              : "Wasz tydzień treningowy"
            : dogName
              ? `${dogPossessive} Trainings-Woche`
              : "Eure Trainings-Woche"}
        </h1>
        <p className="text-[14px] text-[#4B5563] mt-2 leading-relaxed">
          {t.introPre}{dog}{t.introPost}
        </p>
      </div>

      {/* Erklaer-Slider: 3 Karten, swipebar Mobile / Grid Desktop */}
      <ExplainerSlider lang={lang} />

      {/* Wochen-Status — kompakt */}
      {totalThisWeek > 0 && (
        <div className="bg-white border border-[#EADDC5] rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
          <span className="text-[20px] flex-shrink-0">
            {completedThisWeek === totalThisWeek ? "✅" : "📍"}
          </span>
          <p className="text-[14px] font-bold text-[#1a1a1a] leading-tight">
            {completedThisWeek} / {totalThisWeek}{t.done}
            {completedThisWeek === totalThisWeek && t.newMonday}
          </p>
        </div>
      )}

      {/* Aktive Aufgaben */}
      {challenges.length === 0 ? (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 text-center">
          <p className="text-[20px] mb-1">📅</p>
          <p className="text-[13px] text-[#6B7280]">
            {t.emptyChallenges}
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-5">
          {challenges.map((c) => (
            <ChallengeCard
              key={c.id}
              id={c.id}
              title={c.challenge_title}
              description={c.challenge_description}
              target={c.target_sessions}
              sessionsDone={c.sessions_done}
              badgeEmoji={c.badge_emoji}
              badgeLabel={c.badge_label}
              isPremium={c.is_premium}
              completedAt={c.completed_at}
            />
          ))}
        </div>
      )}

      {/* Bonus-Aufgaben: kompakt als Mini-Tile-Grid + CTA darunter */}
      {!isPaid && lockedPreview.length > 0 && (
        <div className="mt-10 mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[18px]">🔒</span>
            <h2 className="text-[16px] font-bold text-[#1a1a1a]">
              {t.bonusTasks}
            </h2>
          </div>

          <div className="bg-white border border-[#EADDC5] rounded-2xl p-4">
            {/* Mini-Tiles, blurred — zeigt was kommt ohne Platz zu fressen */}
            <div className="grid grid-cols-3 gap-2 mb-4 select-none pointer-events-none">
              {lockedPreview.map((t) => (
                <div
                  key={t.slug}
                  className="bg-[#FAFAFA] border border-[#EADDC5] rounded-xl p-3 flex flex-col items-center text-center opacity-70"
                >
                  <div className="text-[24px] leading-none mb-1.5 blur-[1.5px]">
                    {t.badge_emoji}
                  </div>
                  <p className="text-[10px] font-bold text-[#1a1a1a] leading-tight blur-[1.5px] line-clamp-2">
                    {t.title}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA darunter, klar und knapp */}
            <div className="flex items-center gap-3 pt-3 border-t border-[#F0EBE3]">
              <span className="text-[24px] flex-shrink-0">🎁</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[#1a1a1a] leading-tight">
                  {t.bonusPlus}
                </p>
                <p className="text-[11px] text-[#6B7280] leading-snug">
                  {t.bonusUnlocked}
                </p>
              </div>
              <Link
                href="/mitglieder/upgrade"
                className="bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-2 px-4 rounded-lg text-[12px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)] flex-shrink-0"
              >
                {t.unlock}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Badge-Wand */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[18px] font-bold text-[#1a1a1a]">
            {lang === "pl"
              ? dogName
                ? `Odznaki ${dogName}`
                : "Wasze odznaki"
              : dogName
                ? `${dogPossessive} Abzeichen`
                : "Eure Abzeichen"}
          </h2>
          {badges.length > 0 && (
            <span className="text-[12px] text-[#9CA3AF]">
              {badges.length}{t.collected}
            </span>
          )}
        </div>

        {badges.length === 0 && ghostBadgeTemplates.length === 0 ? (
          <div className="bg-[#FAFAFA] border border-dashed border-[#EADDC5] rounded-2xl p-6 text-center">
            <p className="text-[28px] mb-1">🏆</p>
            <p className="text-[13px] text-[#6B7280]">
              {t.firstBadge}
            </p>
          </div>
        ) : (
          <>
            {/* Bereits erspielte Abzeichen — bunt, mit Datum */}
            {badges.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-5">
                {badges.map((b: any) => (
                  <BadgeTile
                    key={b.id}
                    emoji={b.badge_emoji}
                    label={b.badge_label}
                    date={b.completed_at}
                  />
                ))}
              </div>
            )}

            {/* Ghost-Sammlung: alle noch zu erspielenden Abzeichen */}
            {ghostBadgeTemplates.length > 0 && (
              <>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#8B7355]">
                    {t.stillToEarn}
                  </h3>
                  <span className="text-[11px] text-[#9CA3AF]">
                    {ghostBadgeTemplates.length}{t.openCount}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {ghostBadgeTemplates.map((t) => (
                    <GhostBadgeTile
                      key={t.slug}
                      emoji={t.badge_emoji}
                      label={t.badge_label}
                      isPremium={t.is_premium && !isPaid}
                      lang={lang}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ── Sub-Components ─────────────────────────────────────────────────

function BadgeTile({
  emoji,
  label,
  date,
}: {
  emoji: string;
  label: string;
  date: string;
}) {
  const d = new Date(date);
  const dateStr = `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}.${d.getFullYear()}`;
  return (
    <div className="bg-white border border-[#EADDC5] rounded-xl p-3 flex flex-col items-center text-center">
      <div className="text-[28px] leading-none mb-1.5">{emoji}</div>
      <p className="text-[11px] font-bold text-[#1a1a1a] leading-tight mb-0.5">
        {label}
      </p>
      <p className="text-[9px] text-[#9CA3AF]">{dateStr}</p>
    </div>
  );
}

function GhostBadgeTile({
  emoji,
  label,
  isPremium,
  lang,
}: {
  emoji: string;
  label: string;
  isPremium: boolean;
  lang: Lang;
}) {
  return (
    <div
      className="relative bg-[#FAFAFA] border border-dashed border-[#E5DDC8] rounded-xl p-3 flex flex-col items-center text-center"
      title={
        isPremium
          ? lang === "pl"
            ? "Odblokuj z planem"
            : "Mit Plan freischalten"
          : lang === "pl"
            ? "Jeszcze nie zdobyte"
            : "Noch nicht erspielt"
      }
    >
      {/* Schwarz-Weiss-Silhouette: grayscale + leichte Opacity. Lesbar
          genug damit User sieht WAS es zu erspielen gibt, aber klar
          erkennbar "noch nicht da". Kein blur, kein Rate-Spiel. */}
      <div
        className="text-[28px] leading-none mb-1.5"
        style={{ filter: "grayscale(1)", opacity: 0.55 }}
      >
        {emoji}
      </div>
      <p className="text-[11px] font-bold text-[#6B7280] leading-tight mb-0.5">
        {label}
      </p>
      <p className="text-[9px] text-[#9CA3AF]">
        {isPremium
          ? lang === "pl"
            ? "🔒 Z planem"
            : "🔒 Mit Plan"
          : lang === "pl"
            ? "Jeszcze otwarte"
            : "Noch offen"}
      </p>
    </div>
  );
}

function ExplainerSlider({ lang }: { lang: Lang }) {
  const cards =
    lang === "pl"
      ? [
          {
            emoji: "🎯",
            title: "1 zadanie tygodniowo",
            body: "Dopasowane do Twojego psa.",
            tint: "from-[#FFF9F0] to-[#FFFDF6]",
          },
          {
            emoji: "⏱️",
            title: "Wystarczy 5 min",
            body: "W codzienności, bez presji.",
            tint: "from-[#F0FDF4] to-[#FAFFF8]",
          },
          {
            emoji: "🏆",
            title: "Zdobądź odznakę",
            body: "Zrobione = odznaka do kolekcji.",
            tint: "from-[#FAF5FF] to-[#FDFBFF]",
          },
        ]
      : [
    {
      emoji: "🎯",
      title: "1 Aufgabe pro Woche",
      body: "Passend zu deinem Hund.",
      tint: "from-[#FFF9F0] to-[#FFFDF6]",
    },
    {
      emoji: "⏱️",
      title: "5 Min reichen",
      body: "Im Alltag, kein Druck.",
      tint: "from-[#F0FDF4] to-[#FAFFF8]",
    },
    {
      emoji: "🏆",
      title: "Abzeichen holen",
      body: "Geschafft = Abzeichen für die Sammlung.",
      tint: "from-[#FAF5FF] to-[#FDFBFF]",
    },
  ];

  return (
    <div className="-mx-4 md:mx-0 mb-6">
      <div
        className="flex md:grid md:grid-cols-3 gap-3 overflow-x-auto md:overflow-visible px-4 md:px-0 snap-x snap-mandatory pb-2 md:pb-0 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {cards.map((c, i) => (
          <div
            key={i}
            className={`flex-shrink-0 w-[78%] sm:w-[55%] md:w-auto snap-center bg-gradient-to-br ${c.tint} border border-[#EADDC5] rounded-2xl p-4`}
          >
            <div className="text-[26px] leading-none mb-2">{c.emoji}</div>
            <p className="text-[13px] font-extrabold text-[#1a1a1a] leading-tight mb-1">
              {c.title}
            </p>
            <p className="text-[12px] text-[#6B7280] leading-relaxed">
              {c.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

