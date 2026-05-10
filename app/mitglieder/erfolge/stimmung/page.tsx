// /mitglieder/erfolge/stimmung — Stimmungs-Tagebuch.
// Quick-Check pro Trainings-Einheit, Verlauf ueber Tage + Wochen.
// Differenziert sich vom PDF-Tagebuch-Upsell: digital, mit Trends.

import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";
import {
  listMoodLogs,
  lastDaysSummary,
  weeklySummary,
  detectStrugglePattern,
  type Mood,
} from "@/lib/member-mood";
import MoodCheckIn from "@/components/mitglieder/MoodCheckIn";

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
  mittel: "mittel",
  schwierig: "schwierig",
};

const DAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

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

  const dog = member.dog_name?.trim() || "deinem Hund";
  const logs = await listMoodLogs(user.id, 60);
  const days7 = lastDaysSummary(logs, 7);
  const weeks4 = weeklySummary(logs, 4);
  const struggling = detectStrugglePattern(logs);

  // Recent entries mit Notizen (max 5)
  const recentWithNotes = logs.filter((l) => l.note).slice(0, 5);
  const totalLogs = logs.length;

  return (
    <>
      {/* Back-Link */}
      <Link
        href="/mitglieder/erfolge"
        className="inline-flex items-center gap-1 text-[12px] text-[#6B7280] mb-3"
      >
        ← Erfolge-Übersicht
      </Link>

      {/* Header */}
      <div className="mb-5">
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          Stimmungs-Check
        </p>
        <h1 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          Trainings-Verlauf mit {dog}
        </h1>
        <p className="text-[13px] text-[#4B5563] mt-1.5 leading-relaxed">
          Nach jeder Übung kurz tracken wie&rsquo;s lief — daraus baut sich
          euer Verlauf über Wochen.
        </p>
      </div>

      {/* Check-in Widget */}
      <div className="mb-6">
        <MoodCheckIn />
      </div>

      {/* Struggle-Hinweis */}
      {struggling && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 mb-6 flex items-start gap-3">
          <span className="text-[20px] flex-shrink-0">💪</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#B91C1C] mb-0.5">
              Hängt&rsquo;s gerade?
            </p>
            <p className="text-[12px] text-[#7F1D1D] leading-relaxed mb-2">
              3× hintereinander &quot;schwierig&quot; — das ist normal. Hol
              dir Tipps vom KI-Trainer für deine konkrete Situation.
            </p>
            <Link
              href="/mitglieder/hilfe"
              className="inline-block bg-[#DC2626] text-white font-semibold py-2 px-4 rounded-lg text-[12px]"
            >
              KI-Trainer fragen →
            </Link>
          </div>
        </div>
      )}

      {/* Letzte 7 Tage — Streak-Style */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[16px] font-bold text-[#1a1a1a]">
            Letzte 7 Tage
          </h2>
          <span className="text-[11px] text-[#9CA3AF]">
            {totalLogs} Eintrag{totalLogs === 1 ? "" : "e"} insgesamt
          </span>
        </div>
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-4">
          <div className="grid grid-cols-7 gap-2">
            {[...days7].reverse().map((d) => {
              const dt = new Date(d.date);
              const dayName = DAY_SHORT[dt.getDay()];
              const dayNum = dt.getDate();
              const color = d.predominant
                ? MOOD_COLOR[d.predominant]
                : "#E5E7EB";
              return (
                <div
                  key={d.date}
                  className="flex flex-col items-center text-center"
                >
                  <p className="text-[10px] text-[#9CA3AF] mb-1">{dayName}</p>
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
                  {d.count > 0 && (
                    <p className="text-[9px] text-[#9CA3AF]">
                      {d.count}×
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Wochen-Verlauf */}
      <section className="mb-6">
        <h2 className="text-[16px] font-bold text-[#1a1a1a] mb-3">
          Wochen-Verlauf
        </h2>
        <div className="space-y-2">
          {weeks4.map((w) => (
            <div
              key={w.weekStart}
              className="bg-white border border-[#EADDC5] rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-bold text-[#1a1a1a]">
                  {w.weekLabel}
                </p>
                <p className="text-[11px] text-[#9CA3AF]">
                  {w.count === 0
                    ? "Noch keine Einträge"
                    : `${w.count} Eintrag${w.count === 1 ? "" : "e"}`}
                </p>
              </div>
              {w.count === 0 ? (
                <div className="h-2 bg-[#F0EBE3] rounded-full" />
              ) : (
                <>
                  {/* Bar-Chart fuer Stimmungs-Verteilung */}
                  <div className="flex h-2 rounded-full overflow-hidden bg-[#F0EBE3]">
                    {(["gut", "mittel", "schwierig"] as Mood[]).map((m) => {
                      const pct = w.count > 0 ? (w.moods[m] / w.count) * 100 : 0;
                      if (pct === 0) return null;
                      return (
                        <div
                          key={m}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: MOOD_COLOR[m],
                          }}
                        />
                      );
                    })}
                  </div>
                  {/* Predominant-Hinweis */}
                  {w.predominant && (
                    <p className="text-[11px] text-[#6B7280] mt-2 leading-snug">
                      Meistens {MOOD_LABEL[w.predominant]} {MOOD_EMOJI[w.predominant]}
                      {w.moods[w.predominant] > 0 &&
                        ` (${w.moods[w.predominant]}/${w.count})`}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Letzte Notizen */}
      {recentWithNotes.length > 0 && (
        <section className="mb-6">
          <h2 className="text-[16px] font-bold text-[#1a1a1a] mb-3">
            Deine letzten Notizen
          </h2>
          <div className="space-y-2">
            {recentWithNotes.map((l) => {
              const dt = new Date(l.created_at);
              const dateStr = dt.toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
              });
              return (
                <div
                  key={l.id}
                  className="bg-white border border-[#EADDC5] rounded-xl p-3 flex items-start gap-3"
                >
                  <span className="text-[20px] flex-shrink-0">
                    {MOOD_EMOJI[l.mood]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-[#9CA3AF] mb-0.5">
                      {dateStr} · {MOOD_LABEL[l.mood]}
                    </p>
                    <p className="text-[13px] text-[#1a1a1a] leading-relaxed">
                      {l.note}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty-State Hinweis fuer neue User */}
      {totalLogs === 0 && (
        <div className="bg-[#FFF9F0] border border-[#EADDC5] rounded-xl p-4">
          <p className="text-[13px] text-[#5A4A3A] leading-relaxed">
            <strong>Noch keine Einträge.</strong> Trag deine erste
            Übung oben ein — und Tag für Tag baut sich der Verlauf auf.
          </p>
        </div>
      )}
    </>
  );
}
