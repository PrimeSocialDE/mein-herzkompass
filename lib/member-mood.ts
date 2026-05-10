// Helpers fuer Stimmungs-Check (member_mood_logs).
// Append-only — wir holen, gruppieren, zaehlen.

import { createMemberAdminClient } from "./member-auth-server";

export type Mood = "gut" | "mittel" | "schwierig";

export interface MoodLog {
  id: string;
  user_id: string | null;
  email: string;
  log_date: string;        // YYYY-MM-DD
  mood: Mood;
  note: string | null;
  module_slug: string | null;
  created_at: string;
}

export interface DaySummary {
  date: string;            // YYYY-MM-DD
  count: number;
  predominant: Mood | null;
  moods: Record<Mood, number>;
}

export interface WeekSummary {
  weekStart: string;       // ISO-date Montag
  weekLabel: string;       // 'KW XX' oder 'Diese Woche'
  count: number;
  moods: Record<Mood, number>;
  predominant: Mood | null;
}

const MOOD_VALUES: Mood[] = ["gut", "mittel", "schwierig"];

export async function listMoodLogs(
  userId: string,
  daysBack = 60
): Promise<MoodLog[]> {
  const admin = createMemberAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const { data } = await admin
    .from("member_mood_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("log_date", cutoff.toISOString().slice(0, 10))
    .order("created_at", { ascending: false });
  return (data || []) as MoodLog[];
}

function emptyMoods(): Record<Mood, number> {
  return { gut: 0, mittel: 0, schwierig: 0 };
}

function pickPredominant(moods: Record<Mood, number>): Mood | null {
  let max = 0;
  let result: Mood | null = null;
  for (const m of MOOD_VALUES) {
    if (moods[m] > max) {
      max = moods[m];
      result = m;
    }
  }
  return result;
}

// Letzte N Tage als Tages-Zusammenfassung (heute zuerst)
export function lastDaysSummary(
  logs: MoodLog[],
  days = 7
): DaySummary[] {
  const result: DaySummary[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLogs = logs.filter((l) => l.log_date === dateStr);
    const moods = emptyMoods();
    for (const l of dayLogs) {
      moods[l.mood] = (moods[l.mood] || 0) + 1;
    }
    result.push({
      date: dateStr,
      count: dayLogs.length,
      predominant: dayLogs.length > 0 ? pickPredominant(moods) : null,
      moods,
    });
  }
  return result;
}

// Wochen-Zusammenfassung (Montag-basiert)
function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekNumber(d: Date): number {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function weeklySummary(
  logs: MoodLog[],
  weeks = 4
): WeekSummary[] {
  const today = new Date();
  const thisWeekStart = getWeekStart(today);
  const result: WeekSummary[] = [];
  for (let i = 0; i < weeks; i++) {
    const start = new Date(thisWeekStart);
    start.setDate(thisWeekStart.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const weekLogs = logs.filter(
      (l) => l.log_date >= startStr && l.log_date <= endStr
    );
    const moods = emptyMoods();
    for (const l of weekLogs) {
      moods[l.mood]++;
    }

    const label = i === 0 ? "Diese Woche" : i === 1 ? "Letzte Woche" : `KW ${getWeekNumber(start)}`;

    result.push({
      weekStart: startStr,
      weekLabel: label,
      count: weekLogs.length,
      moods,
      predominant: weekLogs.length > 0 ? pickPredominant(moods) : null,
    });
  }
  return result;
}

// Detector: 3+ schwierige Eintraege in Folge → AI sollte angepasste Empfehlung geben
export function detectStrugglePattern(logs: MoodLog[]): boolean {
  const recent = logs.slice(0, 3);
  return recent.length >= 3 && recent.every((l) => l.mood === "schwierig");
}

// ── Folgefragen pro Problem-Key ────────────────────────────────────
// Werden nach der Mood-Auswahl angezeigt damit User eine konkrete
// Aussage zur letzten Uebung treffen kann. Antworten werden als JSON
// in member_mood_logs.answers gespeichert und gehen in den KI-Feedback-
// Prompt ein.

export interface MoodQuestion {
  key: string;
  text: string;
  options: { value: string; label: string }[];
}

export const QUESTIONS_BY_PROBLEM: Record<string, MoodQuestion[]> = {
  pulling: [
    {
      key: "leine_dauer",
      text: "Wie viel Zeit lief er locker an der Leine?",
      options: [
        { value: "kaum", label: "Kaum" },
        { value: "kurz", label: "Etwa 1/3" },
        { value: "haelfte", label: "Etwa Hälfte" },
        { value: "meist", label: "Großteil" },
      ],
    },
    {
      key: "richtungswechsel",
      text: "Hat er auf Richtungswechsel reagiert?",
      options: [
        { value: "sofort", label: "Ja, sofort" },
        { value: "mehrmals", label: "Nach 2-3 Versuchen" },
        { value: "nein", label: "Nein" },
      ],
    },
  ],
  barking: [
    {
      key: "ausloeser",
      text: "Was hat das Bellen ausgelöst?",
      options: [
        { value: "tuerklingel", label: "Türklingel/Besuch" },
        { value: "andere_hunde", label: "Andere Hunde" },
        { value: "passanten", label: "Passanten" },
        { value: "geraeusche", label: "Außengeräusche" },
        { value: "langeweile", label: "Langeweile" },
      ],
    },
    {
      key: "ruhe_gefunden",
      text: "Wie schnell wurde er wieder ruhig?",
      options: [
        { value: "sofort", label: "Sofort" },
        { value: "mit_kommando", label: "Mit Kommando" },
        { value: "lange", label: "Hat lange gedauert" },
      ],
    },
  ],
  aggression: [
    {
      key: "ausloeser",
      text: "Was hat ihn aggressiv reagieren lassen?",
      options: [
        { value: "andere_hunde", label: "Andere Hunde" },
        { value: "menschen", label: "Menschen" },
        { value: "ressource", label: "Futter/Spielzeug" },
        { value: "leine", label: "An der Leine" },
      ],
    },
    {
      key: "distanz",
      text: "Wie war die Distanz zum Auslöser?",
      options: [
        { value: "nah", label: "Sehr nah (<3m)" },
        { value: "mittel", label: "Mittel (3-10m)" },
        { value: "weit", label: "Weit (>10m)" },
      ],
    },
  ],
  anxiety: [
    {
      key: "alleinzeit",
      text: "Wie lange war er allein?",
      options: [
        { value: "kurz", label: "Bis 5 Min" },
        { value: "mittel", label: "5-30 Min" },
        { value: "lang", label: "Über 30 Min" },
      ],
    },
    {
      key: "verhalten",
      text: "Wie hat er reagiert?",
      options: [
        { value: "ruhig", label: "Ruhig geblieben" },
        { value: "winselt", label: "Hat gewinselt" },
        { value: "bellt", label: "Hat gebellt" },
        { value: "zerstoert", label: "Was zerstört" },
      ],
    },
  ],
  jumping: [
    {
      key: "haeufigkeit",
      text: "Wie oft hat er gesprungen?",
      options: [
        { value: "gar_nicht", label: "Gar nicht" },
        { value: "1_2", label: "1-2 mal" },
        { value: "oft", label: "Mehrfach" },
      ],
    },
    {
      key: "wer",
      text: "Bei wem ist er gesprungen?",
      options: [
        { value: "familie", label: "Familie" },
        { value: "besuch", label: "Besuch" },
        { value: "fremde", label: "Fremde" },
      ],
    },
  ],
  recall: [
    {
      key: "kam_zurueck",
      text: "Ist er auf den Rückruf gekommen?",
      options: [
        { value: "sofort", label: "Sofort" },
        { value: "spaet", label: "Verspätet" },
        { value: "gar_nicht", label: "Gar nicht" },
      ],
    },
    {
      key: "ablenkung",
      text: "Welche Ablenkung war da?",
      options: [
        { value: "keine", label: "Keine" },
        { value: "hunde", label: "Andere Hunde" },
        { value: "wild", label: "Wild/Vögel" },
        { value: "stark", label: "Stark abgelenkt" },
      ],
    },
  ],
  energy: [
    {
      key: "auspowern",
      text: "Wie lange habt ihr trainiert/gespielt?",
      options: [
        { value: "kurz", label: "Bis 15 Min" },
        { value: "mittel", label: "15-45 Min" },
        { value: "lang", label: "Über 45 Min" },
      ],
    },
    {
      key: "ruhe_danach",
      text: "Hat er danach Ruhe gefunden?",
      options: [
        { value: "ja", label: "Ja, ist eingeschlafen" },
        { value: "etwas", label: "Etwas ruhiger" },
        { value: "nein", label: "Weiter aufgedreht" },
      ],
    },
  ],
  destructive: [
    {
      key: "was",
      text: "Was hat er angefasst/zerstört?",
      options: [
        { value: "schuhe", label: "Schuhe" },
        { value: "moebel", label: "Möbel" },
        { value: "kabel", label: "Kabel" },
        { value: "papier", label: "Papier/Müll" },
        { value: "nichts", label: "Nichts heute" },
      ],
    },
    {
      key: "tausch",
      text: "Hat das Tausch-Spiel geklappt?",
      options: [
        { value: "ja", label: "Ja, gerne hergegeben" },
        { value: "zoegerlich", label: "Zögerlich" },
        { value: "nein", label: "Nein, nicht hergegeben" },
        { value: "nicht_versucht", label: "Nicht probiert" },
      ],
    },
  ],
  soiling: [
    {
      key: "wo",
      text: "Wo wurde gepinkelt?",
      options: [
        { value: "draussen", label: "Nur draußen" },
        { value: "panne", label: "1 Panne drinnen" },
        { value: "mehrfach", label: "Mehrfach drinnen" },
      ],
    },
    {
      key: "pausen",
      text: "Wie viele Pipi-Pausen draußen?",
      options: [
        { value: "wenig", label: "1-2 mal" },
        { value: "normal", label: "3-5 mal" },
        { value: "viel", label: "6+ mal" },
      ],
    },
  ],
  mouthing: [
    {
      key: "aufgenommen",
      text: "Hat er was aufgenommen?",
      options: [
        { value: "nichts", label: "Nichts" },
        { value: "essbares", label: "Essen vom Boden" },
        { value: "muell", label: "Müll" },
        { value: "stoeckchen", label: "Stöckchen/Steine" },
      ],
    },
    {
      key: "aus_kommando",
      text: "Hat das 'Aus' funktioniert?",
      options: [
        { value: "sofort", label: "Sofort hergegeben" },
        { value: "mit_tausch", label: "Mit Tausch" },
        { value: "nein", label: "Nein" },
        { value: "nicht_versucht", label: "Nicht probiert" },
      ],
    },
  ],
};

export function getQuestionsForProblem(
  key: string | null
): MoodQuestion[] {
  if (!key) return [];
  return QUESTIONS_BY_PROBLEM[key] || [];
}
