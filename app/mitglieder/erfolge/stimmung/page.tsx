// /mitglieder/erfolge/stimmung — Wochen-Begleitung mit KI-Zusammenfassung.
// Pro Plan-Woche EIN kurzer Check-in (statt nach jeder Uebung). KI fasst
// die Woche zusammen und vergleicht zur Vorwoche. Daily-Mood-Grid bleibt
// als Mini-Verlauf am Ende erhalten.

import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";
import {
  listMoodLogs,
  lastDaysSummary,
  getWeeklyCheckIns,
  getWeeklyQuestions,
  getCurrentPlanWeek,
  indexByWeek,
  type Mood,
} from "@/lib/member-mood";
import { getPlanIntro } from "@/lib/member-plan-intro";
import WeeklyCheckIn from "@/components/mitglieder/WeeklyCheckIn";
import { getMemberLang } from "@/lib/member-lang";

export const dynamic = "force-dynamic";

const MOOD_EMOJI: Record<Mood, string> = {
  gut: "😊",
  mittel: "😐",
  schwierig: "😞",
};

const MOOD_COLOR: Record<Mood, string> = {
  gut: "#16A34A",
  mittel: "#F59E0B",
  schwierig: "#DC2626",
};

const MOOD_LABEL: Record<Mood, string> = {
  gut: "gut",
  mittel: "durchwachsen",
  schwierig: "schwierig",
};

const MOOD_LABEL_PL: Record<Mood, string> = {
  gut: "dobrze",
  mittel: "różnie",
  schwierig: "trudno",
};

const DAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const DAY_SHORT_PL = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

export default async function StimmungPage() {
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
  const t =
    lang === "pl"
      ? {
          back: "← Przegląd sukcesów",
          kicker: "Cotygodniowe wsparcie",
          diaryWith: "Dziennik z",
          intro:
            "Raz w tygodniu zapisz, jak wam poszło. AI podsumuje twój tydzień i sprawdzi, na jakim etapie planu jesteście.",
          checkinBody: "Zapisz krótko, jak minął wasz tydzień z treningiem.",
          planProgress: "Twój przebieg planu",
          week: "Tydzień",
          current: "Teraz",
          future:
            "Jeszcze przed wami — wpiszcie, gdy przyjdzie czas na ten tydzień.",
          aiSummary: "Podsumowanie AI",
          entryFrom: "Wpis z",
          moodLabel: "Nastrój:",
          last7: "Ostatnie 7 dni",
          fromModules: "z modułów",
          dailyHint:
            "Te dzienne kropki powstają automatycznie, gdy po ćwiczeniu w modułach zrobisz krótki wpis.",
          emptyStrong: "Jeszcze brak wpisów.",
          emptyRest:
            "Wpisz powyżej swój pierwszy tygodniowy check — AI odeśle ci wtedy krótkie podsumowanie twojego tygodnia.",
        }
      : {
          back: "← Erfolge-Übersicht",
          kicker: "Wochen-Begleitung",
          diaryWith: "Tagebuch mit",
          intro:
            "Einmal pro Woche eintragen wie’s gelaufen ist. Die KI fasst deine Woche zusammen und schaut sich an, wo ihr im Plan steht.",
          checkinBody:
            "Trag kurz ein wie deine Woche mit dem Training gelaufen ist.",
          planProgress: "Dein Plan-Verlauf",
          week: "Woche",
          current: "Aktuell",
          future: "Kommt noch — eintragen sobald die Woche dran ist.",
          aiSummary: "KI-Zusammenfassung",
          entryFrom: "Eintrag vom",
          moodLabel: "Stimmung:",
          last7: "Letzte 7 Tage",
          fromModules: "aus den Modulen",
          dailyHint:
            "Diese Tages-Punkte entstehen automatisch wenn du in den Modulen nach einer Übung kurz eintraegst.",
          emptyStrong: "Noch keine Einträge.",
          emptyRest:
            "Trag oben deinen ersten Wochen-Check ein — die KI gibt dir dann eine kurze Zusammenfassung deiner Woche zurück.",
        };

  const dog =
    member.dog_name?.trim() || (lang === "pl" ? "Twojego psa" : "deinem Hund");
  const problemKey =
    member.quiz_result?.dog_problem || member.quiz_result?.problem || null;
  const planIntro = getPlanIntro(problemKey, dog);
  const totalWeeks = planIntro?.weeks.length || 4;
  const currentWeek = getCurrentPlanWeek(member.created_at, totalWeeks);
  const currentWeekDef =
    planIntro?.weeks.find((w) => w.num === currentWeek) || null;
  const weeklyQuestions = getWeeklyQuestions(problemKey);

  // Alle Daten holen
  const [allLogs, weeklyLogs] = await Promise.all([
    listMoodLogs(user.id, 60),
    getWeeklyCheckIns(user.id),
  ]);
  const days7 = lastDaysSummary(allLogs, 7);
  const weekMap = indexByWeek(weeklyLogs);
  const currentWeekDone = weekMap.has(currentWeek);
  const totalDailyLogs = allLogs.filter((l) => l.plan_week == null).length;

  return (
    <>
      {/* Back-Link */}
      <Link
        href="/mitglieder/erfolge"
        className="inline-flex items-center gap-1 text-[12px] text-[#6B7280] mb-3"
      >
        {t.back}
      </Link>

      {/* Header */}
      <div className="mb-5">
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          {t.kicker}
        </p>
        <h1 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          {t.diaryWith} {dog}
        </h1>
        <p className="text-[13px] text-[#4B5563] mt-1.5 leading-relaxed">
          {t.intro}
        </p>
      </div>

      {/* Wochen-Check-in Widget */}
      <section className="mb-6">
        {currentWeekDef ? (
          <WeeklyCheckIn
            weekNum={currentWeek}
            weekTitle={currentWeekDef.title}
            weekBody={currentWeekDef.body}
            questions={weeklyQuestions}
            problemKey={problemKey}
            alreadyDone={currentWeekDone}
          />
        ) : (
          <WeeklyCheckIn
            weekNum={currentWeek}
            weekTitle={`${t.week} ${currentWeek}`}
            weekBody={t.checkinBody}
            questions={weeklyQuestions}
            problemKey={problemKey}
            alreadyDone={currentWeekDone}
          />
        )}
      </section>

      {/* Plan-Wochen-Verlauf mit KI-Zusammenfassungen */}
      {planIntro && (
        <section className="mb-6">
          <h2 className="text-[16px] font-bold text-[#1a1a1a] mb-3">
            {t.planProgress}
          </h2>
          <div className="space-y-2">
            {planIntro.weeks.map((w) => {
              const entry = weekMap.get(w.num);
              const isCurrent = w.num === currentWeek;
              const isFuture = w.num > currentWeek;
              return (
                <div
                  key={w.num}
                  className={`bg-white border rounded-xl p-4 ${
                    isCurrent
                      ? "border-[#C4A576] shadow-[0_2px_8px_rgba(196,165,118,0.12)]"
                      : "border-[#EADDC5]"
                  } ${isFuture ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Status-Punkt */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold ${
                        entry
                          ? "bg-[#16A34A] text-white"
                          : isCurrent
                            ? "bg-[#C4A576] text-white"
                            : "bg-[#F0EBE3] text-[#9CA3AF]"
                      }`}
                    >
                      {entry ? "✓" : w.num}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355]">
                          {t.week} {w.num}
                        </p>
                        {isCurrent && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-[#FFF9F0] text-[#8B7355] px-1.5 py-0.5 rounded border border-[#EADDC5]">
                            {t.current}
                          </span>
                        )}
                        {entry && (
                          <span className="text-[14px]">
                            {MOOD_EMOJI[entry.mood]}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] font-bold text-[#1a1a1a] leading-tight mb-1">
                        {w.title}
                      </p>
                      {!entry && !isFuture && (
                        <p className="text-[12px] text-[#6B7280] leading-relaxed">
                          {w.body}
                        </p>
                      )}
                      {isFuture && (
                        <p className="text-[11px] text-[#9CA3AF] italic">
                          {t.future}
                        </p>
                      )}

                      {/* Eintrag der Woche */}
                      {entry && (
                        <div className="mt-2 space-y-2">
                          {entry.note && (
                            <p className="text-[12px] text-[#1a1a1a] italic leading-relaxed">
                              &ldquo;{entry.note}&rdquo;
                            </p>
                          )}
                          {entry.ai_feedback && (
                            <div className="bg-gradient-to-br from-[#FFFDF8] to-[#FFF9F0] border border-[#EADDC5] rounded-lg p-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
                                {t.aiSummary}
                              </p>
                              <p className="text-[12px] text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
                                {entry.ai_feedback}
                              </p>
                            </div>
                          )}
                          {!entry.ai_feedback && (
                            <p className="text-[11px] text-[#9CA3AF]">
                              {t.entryFrom}{" "}
                              {new Date(entry.created_at).toLocaleDateString(
                                "de-DE",
                                { day: "2-digit", month: "2-digit" }
                              )}{" "}
                              · {t.moodLabel}{" "}
                              {(lang === "pl" ? MOOD_LABEL_PL : MOOD_LABEL)[
                                entry.mood
                              ]}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Mini-Verlauf: letzte 7 Tage (nur wenn auch tagebuch-Eintraege da sind) */}
      {totalDailyLogs > 0 && (
        <section className="mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[16px] font-bold text-[#1a1a1a]">
              {t.last7}
            </h2>
            <span className="text-[11px] text-[#9CA3AF]">
              {t.fromModules}
            </span>
          </div>
          <div className="bg-white border border-[#EADDC5] rounded-2xl p-4">
            <div className="grid grid-cols-7 gap-2">
              {[...days7].reverse().map((d) => {
                const dt = new Date(d.date);
                const dayName = (lang === "pl" ? DAY_SHORT_PL : DAY_SHORT)[
                  dt.getDay()
                ];
                const dayNum = dt.getDate();
                const color = d.predominant
                  ? MOOD_COLOR[d.predominant]
                  : "#E5E7EB";
                return (
                  <div
                    key={d.date}
                    className="flex flex-col items-center text-center"
                  >
                    <p className="text-[10px] text-[#9CA3AF] mb-1">
                      {dayName}
                    </p>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[16px] mb-1"
                      style={{
                        backgroundColor: d.predominant
                          ? `${color}22`
                          : "#FAFAFA",
                        border: `2px solid ${color}`,
                      }}
                    >
                      {d.predominant ? MOOD_EMOJI[d.predominant] : ""}
                    </div>
                    <p className="text-[10px] text-[#6B7280]">{dayNum}.</p>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-[#9CA3AF] mt-2 leading-relaxed">
            {t.dailyHint}
          </p>
        </section>
      )}

      {/* Empty-State Hinweis */}
      {weeklyLogs.length === 0 && totalDailyLogs === 0 && (
        <div className="bg-[#FFF9F0] border border-[#EADDC5] rounded-xl p-4">
          <p className="text-[13px] text-[#5A4A3A] leading-relaxed">
            <strong>{t.emptyStrong}</strong> {t.emptyRest}
          </p>
        </div>
      )}
    </>
  );
}
