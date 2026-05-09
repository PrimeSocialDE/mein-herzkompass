// /mitglieder/erfolge — Wochen-Challenges + Badge-Wand.
// Free: 1 Challenge pro Woche. Paid: bis zu 3.
// Login-Gate bzw. Profil-Erstellung wie ueberall im Mitgliederbereich.

import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";
import {
  getOrAssignWeekChallenges,
  getEarnedBadges,
} from "@/lib/member-challenges";
import ChallengeCard from "@/components/mitglieder/ChallengeCard";

export const dynamic = "force-dynamic";

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
  const dog = member.dog_name || "deinem Hund";

  const challenges = await getOrAssignWeekChallenges(member);
  const badges = await getEarnedBadges(user.id, 24);

  const completedThisWeek = challenges.filter((c) => c.completed_at).length;
  const totalThisWeek = challenges.length;

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          Erfolge & Challenges
        </p>
        <h1 className="text-[22px] md:text-[26px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          Mach was mit {dog}
        </h1>
        <p className="text-[13px] text-[#6B7280] mt-1.5 leading-relaxed">
          Jede Woche kleine, konkrete Trainings-Challenges. Schaffst du sie,
          gibts ein Badge fürs Profil.
        </p>
      </div>

      {/* Wochen-Status */}
      {totalThisWeek > 0 && (
        <div className="bg-white border border-[#EADDC5] rounded-2xl px-5 py-4 mb-5 flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#FFF9F0] flex items-center justify-center text-[20px]">
            🗓️
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-0.5">
              Diese Woche
            </p>
            <p className="text-[14px] font-bold text-[#1a1a1a] leading-tight">
              {completedThisWeek === totalThisWeek
                ? `Alle ${totalThisWeek} Challenges geschafft! `
                : `${completedThisWeek} von ${totalThisWeek} Challenges geschafft`}
            </p>
            {completedThisWeek === totalThisWeek && (
              <p className="text-[12px] text-[#6B7280] mt-0.5">
                Nächste Woche kommen neue. Stark!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Challenges */}
      {challenges.length === 0 ? (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-6 text-center">
          <p className="text-[14px] text-[#6B7280]">
            Diese Woche keine neue Challenge — du hast schon alle aus dem
            aktuellen Pool durch. Schau Montag wieder rein.
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
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

      {/* Free-Hint: Bonus-Challenges sind paid */}
      {!isPaid && (
        <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-2xl p-5 mb-8">
          <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">
            Mehr Challenges?
          </p>
          <h3 className="text-[16px] font-extrabold text-[#1a1a1a] mb-1 leading-tight">
            Mit dem Pfoten-Plan bekommst du jede Woche bis zu 3 Challenges
          </h3>
          <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">
            Bonus-Trainings für Tricks, Aufmerksamkeit und mehr — passend zum
            Wochen-Modul deines Plans.
          </p>
          <Link
            href="/mitglieder/upgrade"
            className="inline-block bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-2.5 px-5 rounded-xl text-[13px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            Plan freischalten
          </Link>
        </div>
      )}

      {/* Badge-Wand */}
      <div className="mb-6">
        <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-1">
          Deine Badges
        </h2>
        <p className="text-[13px] text-[#6B7280] mb-4">
          Sammlung aller Erfolge die du mit {dog} freigespielt hast.
        </p>

        {badges.length === 0 ? (
          <div className="bg-[#FAFAFA] border border-dashed border-[#EADDC5] rounded-2xl p-8 text-center">
            <p className="text-[28px] mb-2">🏆</p>
            <p className="text-[13px] text-[#6B7280]">
              Noch keine Badges — schaff deine erste Challenge!
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
          </div>
        )}
      </div>
    </>
  );
}

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
