// /mitglieder/erfolge — Hub mit 2 Choice-Cards.
// Splittet auf in:
//   1. /erfolge/challenges — Wochen-Aufgaben + Badges (Gamification)
//   2. /erfolge/coaching   — Plan-Position + tägliche Tipps zu deinem Plan

import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth-server";
import {
  getOrCreateMemberProfile,
  listModulesForMember,
} from "@/lib/member-db";
import { getEarnedBadges } from "@/lib/member-challenges";
import { listMoodLogs } from "@/lib/member-mood";

export const dynamic = "force-dynamic";

export default async function ErfolgeHubPage() {
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

  const dogName = member.dog_name?.trim() || null;
  const dog = dogName || "deinem Hund";
  const dogPossessive = dogName ? `${dogName}s` : "Eure";
  const isPaid = member.purchase_status === "paid";

  // Quick-Stats fuer die Cards
  const [badges, modules, moodLogs] = await Promise.all([
    getEarnedBadges(user.id, 100),
    listModulesForMember(member),
    listMoodLogs(user.id, 7),
  ]);
  const unlockedModules = modules.filter((m) => m.unlocked).length;
  const moodCount7d = moodLogs.length;

  return (
    <>
      {/* Hero */}
      <div className="mb-5 -mx-4 md:-mx-8 md:mt-[-10px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Herchallanges.png"
          alt={`${dogPossessive} Trainings-Hub`}
          className="w-full aspect-[16/7] object-cover object-bottom md:rounded-2xl"
        />
      </div>

      {/* Header */}
      <div className="mb-6">
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          Erfolge
        </p>
        <h1 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          {dogName ? `${dogPossessive} Trainings-Hub` : "Euer Trainings-Hub"}
        </h1>
        <p className="text-[14px] text-[#4B5563] mt-2 leading-relaxed">
          Zwei Wege, dranzubleiben. Was möchtest du heute machen?
        </p>
      </div>

      {/* Choice-Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Card A: Challenges */}
        <Link
          href="/mitglieder/erfolge/challenges"
          className="group bg-white border border-[#EADDC5] rounded-2xl p-5 flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="text-[40px] leading-none">🏆</div>
            {badges.length > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FFF9F0] text-[#8B7355] px-2 py-0.5 rounded-md">
                {badges.length} Badges
              </span>
            )}
          </div>
          <h2 className="text-[18px] font-extrabold text-[#1a1a1a] mb-1.5 leading-tight">
            Wochen-Aufgaben
          </h2>
          <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4 flex-1">
            Spielerische Mini-Herausforderungen für {dog}. Geschafft = Badge
            für die Sammlung.
          </p>
          <span className="text-[12px] font-semibold text-[#C4A576] inline-flex items-center gap-1">
            Aufgaben holen <span aria-hidden>→</span>
          </span>
        </Link>

        {/* Card B: Coaching */}
        <Link
          href="/mitglieder/erfolge/coaching"
          className="group bg-white border border-[#EADDC5] rounded-2xl p-5 flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="text-[40px] leading-none">🗺️</div>
            {isPaid && unlockedModules > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#F0FDF4] text-[#15803D] px-2 py-0.5 rounded-md">
                {unlockedModules} Module frei
              </span>
            )}
            {!isPaid && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FAFAFA] text-[#6B7280] px-2 py-0.5 rounded-md">
                Free-Tipps
              </span>
            )}
          </div>
          <h2 className="text-[18px] font-extrabold text-[#1a1a1a] mb-1.5 leading-tight">
            Plan-Coaching
          </h2>
          <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4 flex-1">
            Wo stehst du im Plan? Tagestipp und nächstes Modul für {dog} —
            dranbleiben leicht gemacht.
          </p>
          <span className="text-[12px] font-semibold text-[#C4A576] inline-flex items-center gap-1">
            Tipp ansehen <span aria-hidden>→</span>
          </span>
        </Link>

        {/* Card C: Stimmungs-Tagebuch (NEU) */}
        <Link
          href="/mitglieder/erfolge/stimmung"
          className="group bg-white border border-[#EADDC5] rounded-2xl p-5 flex flex-col sm:col-span-2"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="text-[40px] leading-none">📊</div>
            {moodCount7d > 0 ? (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#F0FDF4] text-[#15803D] px-2 py-0.5 rounded-md">
                {moodCount7d} Eintr. / 7 Tage
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FAFAFA] text-[#6B7280] px-2 py-0.5 rounded-md">
                Neu
              </span>
            )}
          </div>
          <h2 className="text-[18px] font-extrabold text-[#1a1a1a] mb-1.5 leading-tight">
            Stimmungs-Tagebuch
          </h2>
          <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4 flex-1">
            Nach jeder Übung kurz tracken: 😊 😐 😞 + optional Notiz. Daraus
            baut sich euer Verlauf — ihr seht wann es besser wird.
          </p>
          <span className="text-[12px] font-semibold text-[#C4A576] inline-flex items-center gap-1">
            Eintragen <span aria-hidden>→</span>
          </span>
        </Link>
      </div>
    </>
  );
}
