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
import { getMemberLang } from "@/lib/member-lang";

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

const PROBLEM_LABELS_PL: Record<string, string> = {
  pulling: "Ciągnięcie na smyczy",
  barking: "Szczekanie",
  aggression: "Agresja",
  anxiety: "Lęk separacyjny",
  jumping: "Skakanie na ludzi",
  recall: "Przywołanie",
  energy: "Energia",
  destructive: "Niszczenie",
  soiling: "Czystość w domu",
  mouthing: "Podnoszenie z ziemi",
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

  const lang = await getMemberLang(user?.email ?? member?.email ?? null);

  const dogName = member.dog_name?.trim() || null;
  // "Dein Plan für X" — Akkusativ, daher "deinen Hund" als Fallback
  const dog = dogName || (lang === "pl" ? "Twojego psa" : "deinen Hund");
  const isPaid = member.purchase_status === "paid";

  const problemKey =
    member.quiz_result?.dog_problem || member.quiz_result?.problem || null;
  const labels = lang === "pl" ? PROBLEM_LABELS_PL : PROBLEM_LABELS;
  const problemLabel = problemKey ? labels[problemKey] || null : null;

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

  const t =
    lang === "pl"
      ? {
          backToOverview: "← Przegląd sukcesów",
          planBegleitung: "Wsparcie w planie",
          planForPre: "Plan dla ",
          subPaid: "Gdzie teraz jesteś, co dalej i dzienna wskazówka do tego.",
          subFree: "Dzienna wskazówka i następny moduł dla Twojego psa.",
          standInPlan: "Twój etap w planie",
          weekLabel: "Tydzień ",
          nextWeekUnlockPre: "W przyszłym tygodniu odblokuje się tydzień ",
          nextWeekUnlockPost: ".",
          pdfTitle: "Twój plan treningowy w PDF",
          pdfSub: "Identyczny z tym, co dostałeś mailem — do wydruku",
          open: "Otwórz →",
          completePlan: "Twój kompletny plan",
          identicalPdf: "Identyczny z PDF",
          planOverview: "Przegląd Twojego planu",
          planMailNote:
            "Szczegółowy 12-tygodniowy plan ze wszystkimi ćwiczeniami znajdziesz w mailu, który dostałeś przy zakupie.",
          current: "Teraz",
          comingUp: "Wkrótce",
          tipToday: "Wskazówka na dziś",
          newTipDaily: "Nowa wskazówka każdego dnia — zajrzyj jutro.",
          workingOnPre: "Trening dla ",
          openModule: "Otwórz moduł",
          noModulePre: "Brak odblokowanego modułu. Zajrzyj do ",
          moduleOverview: "przeglądu modułów",
          noModulePost: ".",
          withFullPlan: "Z pełnym planem",
          weeklyGuidancePre: "Cotygodniowe wsparcie dla ",
          benefit1: "Zawsze wiesz, na jakim etapie planu jesteś",
          benefit2: "Moduły odblokowywane krok po kroku",
          benefit3: "Nieograniczony trener AI do pytań",
          viewPlan: "Zobacz plan",
          askTrainer: "Zapytaj trenera AI",
          directHelp: "Bezpośrednia pomoc",
          weeklyTask: "Zadanie tygodnia",
          getBadge: "Zdobądź odznakę",
        }
      : {
          backToOverview: "← Erfolge-Übersicht",
          planBegleitung: "Plan-Begleitung",
          planForPre: "Dein Plan für ",
          subPaid:
            "Wo du gerade bist, was als nächstes dran ist und ein Tagestipp dazu.",
          subFree: "Tagestipp und das nächste Modul für deinen Hund.",
          standInPlan: "Dein Stand im Plan",
          weekLabel: "Woche ",
          nextWeekUnlockPre: "Nächste Woche wird Woche ",
          nextWeekUnlockPost: " freigeschaltet.",
          pdfTitle: "Dein Trainings-Plan als PDF",
          pdfSub:
            "Identisch zu dem was du per Mail bekommen hast — zum Ausdrucken",
          open: "Öffnen →",
          completePlan: "Dein kompletter Plan",
          identicalPdf: "Identisch zur PDF",
          planOverview: "Dein Plan-Überblick",
          planMailNote:
            "Den ausführlichen 12-Wochen-Plan mit allen Übungen findest du in der Mail die du beim Kauf bekommen hast.",
          current: "Aktuell",
          comingUp: "Kommt noch",
          tipToday: "Tipp heute",
          newTipDaily: "Neuer Tipp jeden Tag — komm gerne morgen wieder.",
          workingOnPre: "Dran bei ",
          openModule: "Modul öffnen",
          noModulePre: "Noch kein freigeschaltetes Modul. Schau zur ",
          moduleOverview: "Modul-Übersicht",
          noModulePost: ".",
          withFullPlan: "Mit dem vollen Plan",
          weeklyGuidancePre: "Wochengenaue Begleitung für ",
          benefit1: "Wo du im Plan stehst, immer auf einen Blick",
          benefit2: "Module Schritt für Schritt freigeschaltet",
          benefit3: "Unbegrenzter KI-Trainer für Rückfragen",
          viewPlan: "Plan ansehen",
          askTrainer: "KI-Trainer fragen",
          directHelp: "Direkte Hilfe",
          weeklyTask: "Wochen-Aufgabe",
          getBadge: "Abzeichen holen",
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

      {/* Header */}
      <div className="mb-6">
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          {t.planBegleitung}
        </p>
        <h1 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          {t.planForPre}{dog}
        </h1>
        <p className="text-[14px] text-[#4B5563] mt-2 leading-relaxed">
          {isPaid ? t.subPaid : t.subFree}
        </p>
      </div>

      {/* Plan-Status (nur Paid) — bevorzugt echter Plan (12W), Fallback Module (~4W) */}
      {isPaid && (hasRichPlan ? planTotalWeeks : totalWeeks) > 0 && (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355]">
              {t.standInPlan}
            </p>
            <span className="text-[12px] font-bold text-[#1a1a1a]">
              {t.weekLabel}{hasRichPlan ? planCurrentWeek : currentWeekNumber} / {hasRichPlan ? planTotalWeeks : totalWeeks}
            </span>
          </div>
          <div className="w-full h-2 bg-[#F0EBE3] rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-[#C4A576] rounded-full transition-all"
              style={{
                width: `${Math.min(
                  100,
                  ((hasRichPlan ? planCurrentWeek : currentWeekNumber) /
                    (hasRichPlan ? planTotalWeeks : totalWeeks)) *
                    100
                )}%`,
              }}
            />
          </div>
          {hasRichPlan && planCurrentWeek < planTotalWeeks && (
            <p className="text-[12px] text-[#6B7280] leading-snug">
              {t.nextWeekUnlockPre}{planCurrentWeek + 1}{t.nextWeekUnlockPost}
            </p>
          )}
          {!hasRichPlan && nextWeek && (
            <p className="text-[12px] text-[#6B7280] leading-snug">
              {t.nextWeekUnlockPre}{nextWeek.weekNumber}{t.nextWeekUnlockPost}
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
              {t.pdfTitle}
            </p>
            <p className="text-[12px] text-[#6B7280]">
              {t.pdfSub}
            </p>
          </div>
          <span className="text-[12px] font-bold text-[#C4A576] flex-shrink-0">
            {t.open}
          </span>
        </a>
      )}

      {/* Vollstaendiger Plan: aus DB (Make.com) oder Fallback aus plan-intro */}
      {hasRichPlan && richPlan ? (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355]">
              {t.completePlan}
            </p>
            <p className="text-[10px] text-[#9CA3AF]">
              {t.identicalPdf}
            </p>
          </div>
          <TrainingPlanWeekly plan={richPlan} currentWeek={planCurrentWeek} />
        </section>
      ) : planIntro ? (
        <section className="mb-6">
          <div className="bg-gradient-to-br from-[#FFFDF8] to-[#FFF9F0] border border-[#EADDC5] rounded-2xl p-5 mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1.5">
              {t.planOverview}
            </p>
            <h2 className="text-[18px] md:text-[20px] font-extrabold text-[#1a1a1a] leading-tight mb-2">
              {planIntro.headline}
            </h2>
            <p className="text-[13px] md:text-[14px] text-[#4B5563] leading-relaxed">
              {planIntro.intro}
            </p>
            <p className="text-[11px] text-[#8B7355] mt-3 italic">
              {t.planMailNote}
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
                          {t.weekLabel}{w.num}
                        </p>
                        {isCurrent && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-[#FFF9F0] text-[#8B7355] px-1.5 py-0.5 rounded border border-[#EADDC5]">
                            {t.current}
                          </span>
                        )}
                        {isFuture && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-[#FAFAFA] text-[#9CA3AF] px-1.5 py-0.5 rounded">
                            {t.comingUp}
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
            {t.tipToday}{problemLabel ? ` · ${problemLabel}` : ""}
          </p>
        </div>
        <h2 className="text-[16px] font-extrabold text-[#1a1a1a] mb-1.5 leading-tight">
          {tip.title}
        </h2>
        <p className="text-[13px] text-[#4B5563] leading-relaxed">
          {tip.body}
        </p>
        <p className="text-[10px] text-[#9CA3AF] mt-3">
          {t.newTipDaily}
        </p>
      </div>

      {/* Aktuelles / Naechstes Modul */}
      {currentModule ? (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1.5">
            {t.workingOnPre}{dog}
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
            {t.openModule}
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 mb-5 text-center">
          <p className="text-[20px] mb-1">📚</p>
          <p className="text-[14px] text-[#6B7280]">
            {t.noModulePre}
            <Link
              href="/mitglieder/module"
              className="text-[#C4A576] underline underline-offset-2"
            >
              {t.moduleOverview}
            </Link>
            {t.noModulePost}
          </p>
        </div>
      )}

      {/* Free-Soft-Bridge */}
      {!isPaid && (
        <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-2xl p-5 mb-6">
          <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">
            {t.withFullPlan}
          </p>
          <h3 className="text-[16px] font-extrabold text-[#1a1a1a] mb-2 leading-tight">
            {t.weeklyGuidancePre}{dog}
          </h3>
          <ul className="space-y-1.5 text-[13px] text-[#1a1a1a] mb-4">
            <li className="flex gap-2 items-start">
              <span className="text-[#C4A576] flex-shrink-0">📍</span>
              <span>{t.benefit1}</span>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-[#C4A576] flex-shrink-0">📚</span>
              <span>{t.benefit2}</span>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-[#C4A576] flex-shrink-0">🤖</span>
              <span>{t.benefit3}</span>
            </li>
          </ul>
          <Link
            href="/mitglieder/upgrade"
            className="inline-block bg-[#C4A576] text-white font-semibold py-2.5 px-5 rounded-xl text-[13px] shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            {t.viewPlan}
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
              {t.askTrainer}
            </p>
            <p className="text-[11px] text-[#6B7280]">
              {t.directHelp}
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
              {t.weeklyTask}
            </p>
            <p className="text-[11px] text-[#6B7280]">
              {t.getBadge}
            </p>
          </div>
        </Link>
      </div>
    </>
  );
}
