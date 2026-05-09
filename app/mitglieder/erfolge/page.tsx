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

export const dynamic = "force-dynamic";

// Wieviele "ghost"-Slots auf der Badge-Wand zusaetzlich angezeigt werden
const GHOST_BADGE_COUNT = 8;

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

  const isPaid = member.purchase_status === "paid";
  const dogName = member.dog_name?.trim() || null;
  const dog = dogName || "deinem Hund";
  const dogPossessive = dogName ? `${dogName}s` : "Eure";

  const challenges = await getOrAssignWeekChallenges(member);
  const badges = await getEarnedBadges(user.id, 24);

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

  // Ghost-Badges (alles was sie noch nicht haben, fuer Sammlung-Optik)
  const ghostBadgeTemplates = CHALLENGE_TEMPLATES.filter(
    (t) => !earnedSlugs.has(t.slug)
  ).slice(0, GHOST_BADGE_COUNT);

  return (
    <>
      {/* Header — Hundename prominent, Subtitle minimal */}
      <div className="mb-5">
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          Diese Woche
        </p>
        <h1 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          {dogName ? `${dogPossessive} Trainings-Woche` : "Eure Trainings-Woche"}
        </h1>
      </div>

      {/* Erklaer-Slider: 3 Karten, swipebar Mobile / Grid Desktop */}
      <ExplainerSlider />

      {/* Wochen-Status — kompakt */}
      {totalThisWeek > 0 && (
        <div className="bg-white border border-[#EADDC5] rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
          <span className="text-[20px] flex-shrink-0">
            {completedThisWeek === totalThisWeek ? "✅" : "📍"}
          </span>
          <p className="text-[14px] font-bold text-[#1a1a1a] leading-tight">
            {completedThisWeek} / {totalThisWeek} geschafft
            {completedThisWeek === totalThisWeek && " · Neue ab Montag"}
          </p>
        </div>
      )}

      {/* Aktive Challenges */}
      {challenges.length === 0 ? (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 text-center">
          <p className="text-[20px] mb-1">📅</p>
          <p className="text-[13px] text-[#6B7280]">
            Diese Woche keine neue. Montag startet die nächste.
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

      {/* FOMO: Premium-Challenges blurred mit Lock-Overlay */}
      {!isPaid && lockedPreview.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[18px]">🔒</span>
            <h2 className="text-[16px] font-bold text-[#1a1a1a]">
              Bonus-Challenges
            </h2>
          </div>

          <div className="relative">
            <div className="space-y-3 select-none pointer-events-none">
              {lockedPreview.map((t) => (
                <LockedChallengePreview
                  key={t.slug}
                  emoji={t.badge_emoji}
                  title={t.title}
                  description={t.description}
                  badgeLabel={t.badge_label}
                  target={t.target_sessions}
                />
              ))}
            </div>

            {/* Overlay-CTA mittig auf den geblurrten Cards */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white/95 backdrop-blur-sm border border-[#EADDC5] rounded-2xl px-5 py-4 shadow-[0_8px_32px_rgba(139,115,85,0.18)] max-w-[280px] text-center">
                <div className="text-[24px] mb-1">🎁</div>
                <p className="text-[13px] font-bold text-[#1a1a1a] mb-2 leading-tight">
                  +3 Challenges &amp; mehr Badges
                </p>
                <Link
                  href="/mitglieder/upgrade"
                  className="inline-block bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-2 px-4 rounded-lg text-[12px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
                >
                  Plan freischalten
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Badge-Wand */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[18px] font-bold text-[#1a1a1a]">
            {dogName ? `${dogPossessive} Badges` : "Eure Badges"}
          </h2>
          {badges.length > 0 && (
            <span className="text-[12px] text-[#9CA3AF]">
              {badges.length} gesammelt
            </span>
          )}
        </div>

        {badges.length === 0 && ghostBadgeTemplates.length === 0 ? (
          <div className="bg-[#FAFAFA] border border-dashed border-[#EADDC5] rounded-2xl p-6 text-center">
            <p className="text-[28px] mb-1">🏆</p>
            <p className="text-[13px] text-[#6B7280]">
              Erste Challenge schaffen → erstes Badge.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {badges.map((b: any) => (
              <BadgeTile
                key={b.id}
                emoji={b.badge_emoji}
                label={b.badge_label}
                date={b.completed_at}
              />
            ))}
            {/* Ghost-Slots fuer ungerlaufene Badges — FOMO */}
            {ghostBadgeTemplates.map((t) => (
              <GhostBadgeTile
                key={t.slug}
                emoji={t.badge_emoji}
                label={t.badge_label}
                isPremium={t.is_premium && !isPaid}
              />
            ))}
          </div>
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
}: {
  emoji: string;
  label: string;
  isPremium: boolean;
}) {
  return (
    <div
      className="relative bg-[#FAFAFA] border border-dashed border-[#E5DDC8] rounded-xl p-3 flex flex-col items-center text-center"
      title={isPremium ? "Mit Plan freischalten" : "Noch nicht erspielt"}
    >
      <div className="text-[28px] leading-none mb-1.5 grayscale opacity-30 blur-[2px]">
        {emoji}
      </div>
      <p className="text-[11px] font-bold text-[#9CA3AF] leading-tight mb-0.5 blur-[2px] select-none">
        {label}
      </p>
      <p className="text-[9px] text-[#D1D5DB]">{isPremium ? "🔒 Plan" : "?"}</p>
    </div>
  );
}

function ExplainerSlider() {
  const cards = [
    {
      emoji: "🎯",
      title: "1 Challenge / Woche",
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
      title: "Badge holen",
      body: "Geschafft = Badge für die Sammlung.",
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

function LockedChallengePreview({
  emoji,
  title,
  description,
  badgeLabel,
  target,
}: {
  emoji: string;
  title: string;
  description: string;
  badgeLabel: string;
  target: number;
}) {
  return (
    <div className="relative bg-white border border-[#EADDC5] rounded-2xl p-5 opacity-60 blur-[1.5px]">
      <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider bg-[#FFF9F0] text-[#8B7355] px-2 py-0.5 rounded-md">
        Bonus
      </span>
      <div className="flex items-start gap-3 mb-3 pr-12">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[22px] bg-[#FAFAFA]">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-0.5">
            Challenge dieser Woche
          </p>
          <h3 className="text-[16px] font-extrabold text-[#1a1a1a] leading-tight">
            {title}
          </h3>
        </div>
      </div>
      <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">
        {description}
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5">
          {Array.from({ length: target }).map((_, i) => (
            <div key={i} className="flex-1 h-2 rounded-full bg-[#F0EBE3]" />
          ))}
        </div>
        <span className="text-[12px] font-bold text-[#9CA3AF] min-w-[3ch] text-right">
          0/{target}
        </span>
      </div>
    </div>
  );
}
