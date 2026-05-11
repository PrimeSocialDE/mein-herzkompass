// /mitglieder/erfolge/coaching — Plan-Begleitung.
// Zeigt: wo bist du im Plan, naechstes Modul, Tagestipp passend zum
// Quiz-Problem. Fuer Free-User: Free-Modul + Tipp + Soft-Bridge.

import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth-server";
import {
  getOrCreateMemberProfile,
  listModulesForMember,
} from "@/lib/member-db";
import { groupModulesByWeek } from "@/lib/member-weeks";
import { getDailyTip } from "@/lib/member-coaching";
import { getPlanIntro } from "@/lib/member-plan-intro";
import { getCurrentPlanWeek } from "@/lib/member-mood";
import {
  getLatestPlanContent,
  isTrainingPlanContent,
} from "@/lib/member-plan-content";
import TrainingPlanWeekly from "@/components/mitglieder/TrainingPlanWeekly";

export const dynamic = "force-dynamic";

const PROBLEM_LABELS: Record<string, string> = {
  pulling: "Leinenziehen",
  barking: "Bellen",
  aggression: "Aggression",
  anxiety: "Trennungsangst",
  jumping: "Anspringen",
  recall: "Rückruf",
  energy: "Energie",
  destructive: "Zerstörungsverhalten",
  soiling: "Stubenreinheit",
  mouthing: "Aufnehmen vom Boden",
};

export default async function CoachingPage() {
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
  const isPaid = member.purchase_status === "paid";

  const problemKey =
    member.quiz_result?.dog_problem || member.quiz_result?.problem || null;
  const problemLabel = problemKey ? PROBLEM_LABELS[problemKey] || null : null;

  const tip = getDailyTip(problemKey);

  const modules = await listModulesForMember(member);
  const weeks = groupModulesByWeek(modules);

  // Aktuelle Woche = letzte mit unlocked-Modulen.
  // Naechstes Modul = erstes unlocked (in Reihenfolge), das noch nicht abgeschlossen wurde.
  const currentWeek = [...weeks].reverse().find((w) => w.isUnlocked) || null;
  const nextWeek = weeks.find((w) => !w.isUnlocked) || null;
  const currentModule =
    currentWeek?.modules.find((m) => m.unlocked) || null;
  const totalWeeks = weeks.length;
  const currentWeekNumber = currentWeek?.weekNumber || 0;

  // Plan-Content: erst aus DB versuchen (member_plan_content mit slug
  // 'trainingsplan' — wird von Make.com nach PDF-Generierung befuellt).
  // Fallback: generischer 4-Wochen-Plan aus lib/member-plan-intro.ts.
  const trainingPlan = await getLatestPlanContent(
    user.id,
    member.email,
    "trainingsplan"
  );
  const hasRichPlan = trainingPlan && isTrainingPlanContent(trainingPlan.content);
  const richPlan = hasRichPlan
    ? (trainingPlan.content as import("@/lib/member-plan-content").TrainingPlanContent)
    : null;

  const planIntro = hasRichPlan ? null : getPlanIntro(problemKey, dog);
  const planTotalWeeks = hasRichPlan
    ? richPlan!.weeks.length
    : planIntro?.weeks.length || 0;
  const planCurrentWeek =
    planTotalWeeks > 0
      ? getCurrentPlanWeek(member.created_at, planTotalWeeks)
      : 0;

  return (
    <>
      {/* Back-Link zum Hub */}
      <Link
        href="/mitglieder/erfolge"
        className="inline-flex items-center gap-1 text-[12px] text-[#6B7280] mb-3"
      >
        ← Erfolge-Übersicht
      </Link>

      {/* Header */}
      <div className="mb-6">
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          Plan-Begleitung
        </p>
        <h1 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          Dein Plan für {dog}
        </h1>
        <p className="text-[14px] text-[#4B5563] mt-2 leading-relaxed">
          {isPaid
            ? "Wo du gerade bist, was als nächstes dran ist und ein Tagestipp dazu."
            : "Tagestipp und das nächste Modul für deinen Hund."}
        </p>
      </div>

      {/* Plan-Status (nur Paid) */}
      {isPaid && totalWeeks > 0 && (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355]">
              Dein Stand im Plan
            </p>
            <span className="text-[12px] font-bold text-[#1a1a1a]">
              Woche {currentWeekNumber} / {totalWeeks}
            </span>
          </div>
          <div className="w-full h-2 bg-[#F0EBE3] rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-[#C4A576] rounded-full transition-all"
              style={{
                width: `${Math.min(
                  100,
                  (currentWeekNumber / totalWeeks) * 100
                )}%`,
              }}
            />
          </div>
          {nextWeek && (
            <p className="text-[12px] text-[#6B7280] leading-snug">
              Nächste Woche wird Woche {nextWeek.weekNumber} freigeschaltet.
            </p>
          )}
        </div>
      )}

      {/* PDF-Download (wenn vorhanden) — direkt unter Plan-Status */}
      {trainingPlan?.pdf_url && (
        <a
          href={trainingPlan.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white border-2 border-dashed border-[#C4A576] rounded-2xl p-4 mb-5 flex items-center gap-3 hover:bg-[#FFF9F0] transition-colors"
        >
          <span className="text-[28px] flex-shrink-0">📄</span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-[#1a1a1a] leading-tight mb-0.5">
              Dein Trainings-Plan als PDF
            </p>
            <p className="text-[12px] text-[#6B7280]">
              Identisch zu dem was du per Mail bekommen hast — zum Ausdrucken
            </p>
          </div>
          <span className="text-[12px] font-bold text-[#C4A576] flex-shrink-0">
            Öffnen →
          </span>
        </a>
      )}

      {/* Vollstaendiger Plan: aus DB (Make.com) oder Fallback aus plan-intro */}
      {hasRichPlan && richPlan ? (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355]">
              Dein kompletter Plan
            </p>
            <p className="text-[10px] text-[#9CA3AF]">
              Identisch zur PDF
            </p>
          </div>
          <TrainingPlanWeekly plan={richPlan} currentWeek={planCurrentWeek} />
        </section>
      ) : planIntro ? (
        <section className="mb-6">
          <div className="bg-gradient-to-br from-[#FFFDF8] to-[#FFF9F0] border border-[#EADDC5] rounded-2xl p-5 mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1.5">
              Dein Plan-Überblick
            </p>
            <h2 className="text-[18px] md:text-[20px] font-extrabold text-[#1a1a1a] leading-tight mb-2">
              {planIntro.headline}
            </h2>
            <p className="text-[13px] md:text-[14px] text-[#4B5563] leading-relaxed">
              {planIntro.intro}
            </p>
            <p className="text-[11px] text-[#8B7355] mt-3 italic">
              Den ausführlichen 12-Wochen-Plan mit allen Übungen findest du in
              der Mail die du beim Kauf bekommen hast.
            </p>
          </div>

          <div className="space-y-2">
            {planIntro.weeks.map((w) => {
              const isCurrent = w.num === planCurrentWeek;
              const isPast = w.num < planCurrentWeek;
              const isFuture = w.num > planCurrentWeek;
              return (
                <div
                  key={w.num}
                  className={`bg-white border rounded-xl p-4 transition-colors ${
                    isCurrent
                      ? "border-[#C4A576] shadow-[0_2px_8px_rgba(196,165,118,0.12)]"
                      : "border-[#EADDC5]"
                  } ${isFuture ? "opacity-70" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold ${
                        isPast
                          ? "bg-[#16A34A] text-white"
                          : isCurrent
                            ? "bg-[#C4A576] text-white"
                            : "bg-[#F0EBE3] text-[#9CA3AF]"
                      }`}
                    >
                      {isPast ? "✓" : w.num}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355]">
                          Woche {w.num}
                        </p>
                        {isCurrent && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-[#FFF9F0] text-[#8B7355] px-1.5 py-0.5 rounded border border-[#EADDC5]">
                            Aktuell
                          </span>
                        )}
                        {isFuture && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-[#FAFAFA] text-[#9CA3AF] px-1.5 py-0.5 rounded">
                            Kommt noch
                          </span>
                        )}
                      </div>
                      <p className="text-[14px] font-bold text-[#1a1a1a] leading-tight mb-1">
                        {w.title}
                      </p>
                      <p className="text-[12px] text-[#6B7280] leading-relaxed">
                        {w.body}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Tipp des Tages */}
      <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[20px]">💡</span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355]">
            Tipp heute{problemLabel ? ` · ${problemLabel}` : ""}
          </p>
        </div>
        <h2 className="text-[16px] font-extrabold text-[#1a1a1a] mb-1.5 leading-tight">
          {tip.title}
        </h2>
        <p className="text-[13px] text-[#4B5563] leading-relaxed">
          {tip.body}
        </p>
        <p className="text-[10px] text-[#9CA3AF] mt-3">
          Neuer Tipp jeden Tag — komm gerne morgen wieder.
        </p>
      </div>

      {/* Aktuelles / Naechstes Modul */}
      {currentModule ? (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1.5">
            Dran bei {dog}
          </p>
          <h2 className="text-[18px] font-extrabold text-[#1a1a1a] mb-1.5 leading-tight">
            {currentModule.title}
          </h2>
          {currentModule.description && (
            <p className="text-[13px] text-[#6B7280] leading-relaxed mb-3">
              {currentModule.description}
            </p>
          )}
          <Link
            href={`/mitglieder/modul/${currentModule.slug}`}
            className="inline-block bg-[#C4A576] text-white font-semibold py-2.5 px-5 rounded-xl text-[13px] shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            Modul öffnen
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 mb-5 text-center">
          <p className="text-[20px] mb-1">📚</p>
          <p className="text-[14px] text-[#6B7280]">
            Noch kein freigeschaltetes Modul. Schau zur{" "}
            <Link
              href="/mitglieder/module"
              className="text-[#C4A576] underline underline-offset-2"
            >
              Modul-Übersicht
            </Link>
            .
          </p>
        </div>
      )}

      {/* Free-Soft-Bridge */}
      {!isPaid && (
        <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-2xl p-5 mb-6">
          <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">
            Mit dem vollen Plan
          </p>
          <h3 className="text-[16px] font-extrabold text-[#1a1a1a] mb-2 leading-tight">
            Wochengenaue Begleitung für {dog}
          </h3>
          <ul className="space-y-1.5 text-[13px] text-[#1a1a1a] mb-4">
            <li className="flex gap-2 items-start">
              <span className="text-[#C4A576] flex-shrink-0">📍</span>
              <span>Wo du im Plan stehst, immer auf einen Blick</span>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-[#C4A576] flex-shrink-0">📚</span>
              <span>Module Schritt für Schritt freigeschaltet</span>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-[#C4A576] flex-shrink-0">🤖</span>
              <span>Unbegrenzter KI-Trainer für Rückfragen</span>
            </li>
          </ul>
          <Link
            href="/mitglieder/upgrade"
            className="inline-block bg-[#C4A576] text-white font-semibold py-2.5 px-5 rounded-xl text-[13px] shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            Plan ansehen
          </Link>
        </div>
      )}

      {/* Quick-Links */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link
          href="/mitglieder/hilfe"
          className="bg-white border border-[#EADDC5] rounded-xl p-4 flex items-center gap-3"
        >
          <span className="text-[24px] flex-shrink-0">💬</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#1a1a1a] leading-tight">
              KI-Trainer fragen
            </p>
            <p className="text-[11px] text-[#6B7280]">
              Direkte Hilfe
            </p>
          </div>
        </Link>
        <Link
          href="/mitglieder/erfolge/challenges"
          className="bg-white border border-[#EADDC5] rounded-xl p-4 flex items-center gap-3"
        >
          <span className="text-[24px] flex-shrink-0">🏆</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#1a1a1a] leading-tight">
              Wochen-Aufgabe
            </p>
            <p className="text-[11px] text-[#6B7280]">
              Abzeichen holen
            </p>
          </div>
        </Link>
      </div>
    </>
  );
}
