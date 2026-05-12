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
import { listMoodLogs, getCurrentPlanWeek } from "@/lib/member-mood";
import {
  getLatestPlanContent,
  isTrainingPlanContent,
  type TrainingPlanContent,
} from "@/lib/member-plan-content";

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

  // Quick-Stats fuer die Cards + Plan-Content fuer Preview-Banner
  const [badges, modules, moodLogs, trainingPlan] = await Promise.all([
    getEarnedBadges(user.id, 100),
    listModulesForMember(member),
    listMoodLogs(user.id, 7),
    getLatestPlanContent(user.id, member.email, "trainingsplan"),
  ]);
  const unlockedModules = modules.filter((m) => m.unlocked).length;
  const moodCount7d = moodLogs.length;

  // Preview: aktuelle Plan-Woche aus DB-Content (wenn vorhanden)
  const hasRichPlan =
    trainingPlan && isTrainingPlanContent(trainingPlan.content);
  const richPlan = hasRichPlan
    ? (trainingPlan.content as TrainingPlanContent)
    : null;
  const planTotalWeeks = richPlan?.weeks.length || 0;
  const planCurrentWeekNum =
    planTotalWeeks > 0
      ? getCurrentPlanWeek(member.created_at, planTotalWeeks)
      : 0;
  const currentPlanWeek =
    richPlan?.weeks.find((w) => w.num === planCurrentWeekNum) ||
    richPlan?.weeks[0] ||
    null;
  const firstExercise = currentPlanWeek?.uebungen?.[0] || null;

  return (
    <>
      {/* Hero */}
      <div className="mb-5 -mx-4 md:-mx-8 md:mt-[-10px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Herchallanges.jpg"
          alt={`${dogPossessive} Trainings-Bereich`}
          className="w-full aspect-[16/7] object-cover object-bottom md:rounded-2xl"
        />
      </div>

      {/* Header */}
      <div className="mb-6">
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          Erfolge
        </p>
        <h1 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          {dogName ? `${dogPossessive} Trainings-Bereich` : "Euer Trainings-Bereich"}
        </h1>
        <p className="text-[14px] text-[#4B5563] mt-2 leading-relaxed">
          Zwei Wege, dranzubleiben. Was möchtest du heute machen?
        </p>
      </div>

      {/* Plan-Banner — prominent, immer als Einstieg in den Plan */}
      {hasRichPlan && richPlan && currentPlanWeek ? (
        <Link
          href="/mitglieder/erfolge/coaching"
          className="block bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border-2 border-[#C4A576] rounded-2xl p-5 mb-5 shadow-[0_2px_8px_rgba(196,165,118,0.15)]"
        >
          <div className="flex items-start justify-between mb-3 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
                Dein Trainings-Plan
              </p>
              <h2 className="text-[18px] md:text-[20px] font-extrabold text-[#1a1a1a] leading-tight">
                Woche {planCurrentWeekNum} · {currentPlanWeek.title}
              </h2>
            </div>
            <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider bg-white border border-[#EADDC5] text-[#8B7355] px-2 py-1 rounded-md">
              {planCurrentWeekNum}/{planTotalWeeks}
            </span>
          </div>

          {/* Fortschritts-Balken */}
          <div className="w-full h-1.5 bg-white/70 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-[#C4A576] rounded-full transition-all"
              style={{
                width: `${Math.min(
                  100,
                  (planCurrentWeekNum / planTotalWeeks) * 100
                )}%`,
              }}
            />
          </div>

          {firstExercise && (
            <div className="bg-white/80 border border-[#EADDC5] rounded-xl p-3 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B7355] mb-0.5">
                Diese Woche dran
              </p>
              <p className="text-[13px] font-bold text-[#1a1a1a] leading-snug">
                {firstExercise.name}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[12px] text-[#6B7280]">
              Kompletter Plan mit allen Übungen
              {trainingPlan?.pdf_url ? " + PDF" : ""}
            </p>
            <span className="text-[13px] font-bold text-[#C4A576] inline-flex items-center gap-1">
              Plan öffnen <span aria-hidden>→</span>
            </span>
          </div>
        </Link>
      ) : isPaid ? (
        <Link
          href="/mitglieder/erfolge/coaching"
          className="block bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border-2 border-[#C4A576] rounded-2xl p-5 mb-5"
        >
          <div className="flex items-center gap-3">
            <span className="text-[32px] flex-shrink-0">🗺️</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-0.5">
                Dein Trainings-Plan
              </p>
              <p className="text-[15px] font-extrabold text-[#1a1a1a] leading-tight">
                Hier ist dein kompletter Plan für {dog}
              </p>
              <p className="text-[12px] text-[#6B7280] mt-0.5">
                Alle Wochen, Übungen und der PDF-Download
              </p>
            </div>
            <span className="flex-shrink-0 text-[13px] font-bold text-[#C4A576]">→</span>
          </div>
        </Link>
      ) : null}

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
                {badges.length} Abzeichen
              </span>
            )}
          </div>
          <h2 className="text-[18px] font-extrabold text-[#1a1a1a] mb-1.5 leading-tight">
            Wochen-Aufgaben
          </h2>
          <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4 flex-1">
            Spielerische Mini-Herausforderungen für {dog}. Geschafft = Abzeichen
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
                Gratis-Tipps
              </span>
            )}
          </div>
          <h2 className="text-[18px] font-extrabold text-[#1a1a1a] mb-1.5 leading-tight">
            Plan-Begleitung
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
