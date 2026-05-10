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
  // Optional: Wochen-Check-in-Felder (siehe week-migration)
  plan_week?: number | null;
  plan_problem_key?: string | null;
  answers?: Record<string, string> | null;
  ai_feedback?: string | null;
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

// ── Wochen-Check-in (statt taegl. nach jeder Uebung) ──────────────────
// Pro Woche EIN Eintrag mit broader Fragen + KI-Zusammenfassung der
// Woche. Kein Replace fuer den taeglichen Check-in im Modul-Kontext —
// das Wochen-Format ist ein zweiter Layer fuer den groben Verlauf.

// Wochen-Fragen sind bewusst fortschritts-orientiert (weil ueber 7
// Tage gemittelt) statt situations-konkret. 2 Fragen pro Problem-Key.
export const WEEKLY_QUESTIONS_BY_PROBLEM: Record<string, MoodQuestion[]> = {
  pulling: [
    {
      key: "fortschritt",
      text: "Wie ist der Fortschritt beim lockeren Leinen-Laufen?",
      options: [
        { value: "deutlich_besser", label: "Deutlich besser" },
        { value: "etwas_besser", label: "Etwas besser" },
        { value: "gleich", label: "Wie vorher" },
        { value: "schlechter", label: "Eher schlechter" },
      ],
    },
    {
      key: "uebungs_tage",
      text: "An wie vielen Tagen habt ihr geübt?",
      options: [
        { value: "fast_taeglich", label: "Fast täglich" },
        { value: "mehrmals", label: "3-4 Tage" },
        { value: "selten", label: "1-2 Tage" },
        { value: "gar_nicht", label: "Gar nicht" },
      ],
    },
  ],
  barking: [
    {
      key: "fortschritt",
      text: "Wie hat sich das Bellen entwickelt?",
      options: [
        { value: "deutlich_besser", label: "Deutlich weniger" },
        { value: "etwas_besser", label: "Etwas weniger" },
        { value: "gleich", label: "Wie vorher" },
        { value: "schlechter", label: "Eher mehr" },
      ],
    },
    {
      key: "ausloeser_woche",
      text: "Welcher Auslöser war diese Woche am häufigsten?",
      options: [
        { value: "tuerklingel", label: "Türklingel/Besuch" },
        { value: "andere_hunde", label: "Andere Hunde" },
        { value: "geraeusche", label: "Geräusche" },
        { value: "langeweile", label: "Langeweile" },
        { value: "kaum_was", label: "Kaum noch was" },
      ],
    },
  ],
  aggression: [
    {
      key: "fortschritt",
      text: "Wie hat sich das Verhalten entwickelt?",
      options: [
        { value: "deutlich_besser", label: "Deutlich entspannter" },
        { value: "etwas_besser", label: "Etwas entspannter" },
        { value: "gleich", label: "Wie vorher" },
        { value: "schlechter", label: "Angespannter" },
      ],
    },
    {
      key: "vorfaelle",
      text: "Wie viele kritische Situationen gab es?",
      options: [
        { value: "keine", label: "Keine" },
        { value: "1_2", label: "1-2" },
        { value: "mehrere", label: "Mehrere" },
        { value: "taeglich", label: "Fast täglich" },
      ],
    },
  ],
  anxiety: [
    {
      key: "fortschritt",
      text: "Wie war das Allein-bleiben diese Woche?",
      options: [
        { value: "deutlich_besser", label: "Deutlich entspannter" },
        { value: "etwas_besser", label: "Etwas entspannter" },
        { value: "gleich", label: "Wie vorher" },
        { value: "schlechter", label: "Schwieriger" },
      ],
    },
    {
      key: "max_dauer",
      text: "Wie lange war er max. allein - ohne Stress?",
      options: [
        { value: "minuten", label: "Wenige Minuten" },
        { value: "viertel", label: "15-30 Min" },
        { value: "stunde", label: "Bis 1 Std" },
        { value: "mehr", label: "Mehrere Stunden" },
      ],
    },
  ],
  jumping: [
    {
      key: "fortschritt",
      text: "Wie hat sich das Anspringen entwickelt?",
      options: [
        { value: "deutlich_besser", label: "Deutlich seltener" },
        { value: "etwas_besser", label: "Etwas seltener" },
        { value: "gleich", label: "Wie vorher" },
        { value: "schlechter", label: "Häufiger" },
      ],
    },
    {
      key: "konsequenz",
      text: "Hat die Familie konsequent reagiert?",
      options: [
        { value: "alle", label: "Ja, alle gleich" },
        { value: "meistens", label: "Meistens" },
        { value: "uneinig", label: "Uneinheitlich" },
      ],
    },
  ],
  recall: [
    {
      key: "fortschritt",
      text: "Wie zuverlässig kommt er auf Rückruf?",
      options: [
        { value: "deutlich_besser", label: "Sehr zuverlässig" },
        { value: "etwas_besser", label: "Etwas besser" },
        { value: "gleich", label: "Wie vorher" },
        { value: "schlechter", label: "Eher schlechter" },
      ],
    },
    {
      key: "freilauf",
      text: "Wo habt ihr geübt?",
      options: [
        { value: "garten", label: "Nur Garten/zuhause" },
        { value: "leine", label: "An langer Leine" },
        { value: "freilauf", label: "Schon im Freilauf" },
      ],
    },
  ],
  energy: [
    {
      key: "fortschritt",
      text: "Wie ist sein Ruhe-Verhalten diese Woche?",
      options: [
        { value: "deutlich_besser", label: "Deutlich ruhiger" },
        { value: "etwas_besser", label: "Etwas ruhiger" },
        { value: "gleich", label: "Wie vorher" },
        { value: "schlechter", label: "Aufgedrehter" },
      ],
    },
    {
      key: "kopfarbeit",
      text: "Wie oft Suchspiele/Kopfarbeit?",
      options: [
        { value: "taeglich", label: "Täglich" },
        { value: "mehrmals", label: "3-4× Woche" },
        { value: "selten", label: "1-2× Woche" },
        { value: "gar_nicht", label: "Gar nicht" },
      ],
    },
  ],
  destructive: [
    {
      key: "fortschritt",
      text: "Wie war das Zerstören diese Woche?",
      options: [
        { value: "deutlich_besser", label: "Nichts mehr" },
        { value: "etwas_besser", label: "Weniger" },
        { value: "gleich", label: "Wie vorher" },
        { value: "schlechter", label: "Häufiger" },
      ],
    },
    {
      key: "tausch_klappt",
      text: "Klappt das Tausch-Spiel inzwischen?",
      options: [
        { value: "zuverlaessig", label: "Ja, zuverlässig" },
        { value: "manchmal", label: "Manchmal" },
        { value: "noch_nicht", label: "Noch nicht" },
        { value: "nicht_geuebt", label: "Nicht geübt" },
      ],
    },
  ],
  soiling: [
    {
      key: "fortschritt",
      text: "Wie war's diese Woche mit dem Pinkeln?",
      options: [
        { value: "deutlich_besser", label: "Alles draußen" },
        { value: "etwas_besser", label: "Wenige Pannen" },
        { value: "gleich", label: "Wie vorher" },
        { value: "schlechter", label: "Mehr Pannen" },
      ],
    },
    {
      key: "routine",
      text: "Wie konsequent waren die Pipi-Pause-Zeiten?",
      options: [
        { value: "fest", label: "Feste Zeiten" },
        { value: "meist", label: "Meistens" },
        { value: "unregelmaessig", label: "Unregelmäßig" },
      ],
    },
  ],
  mouthing: [
    {
      key: "fortschritt",
      text: "Wie oft hat er was vom Boden aufgenommen?",
      options: [
        { value: "deutlich_besser", label: "Kaum noch" },
        { value: "etwas_besser", label: "Seltener" },
        { value: "gleich", label: "Wie vorher" },
        { value: "schlechter", label: "Häufiger" },
      ],
    },
    {
      key: "aus_klappt",
      text: "Wie zuverlässig ist das 'Aus'?",
      options: [
        { value: "zuverlaessig", label: "Zuverlässig" },
        { value: "meist", label: "Meistens" },
        { value: "selten", label: "Selten" },
        { value: "nicht_geuebt", label: "Nicht geübt" },
      ],
    },
  ],
};

// Generische Wochen-Fragen, falls kein Problem-Key bekannt ist
const WEEKLY_QUESTIONS_GENERIC: MoodQuestion[] = [
  {
    key: "fortschritt",
    text: "Wie ist der Fortschritt diese Woche?",
    options: [
      { value: "deutlich_besser", label: "Deutlich besser" },
      { value: "etwas_besser", label: "Etwas besser" },
      { value: "gleich", label: "Wie vorher" },
      { value: "schlechter", label: "Eher schlechter" },
    ],
  },
  {
    key: "uebungs_tage",
    text: "An wie vielen Tagen habt ihr geübt?",
    options: [
      { value: "fast_taeglich", label: "Fast täglich" },
      { value: "mehrmals", label: "3-4 Tage" },
      { value: "selten", label: "1-2 Tage" },
      { value: "gar_nicht", label: "Gar nicht" },
    ],
  },
];

export function getWeeklyQuestions(
  problemKey: string | null
): MoodQuestion[] {
  if (!problemKey) return WEEKLY_QUESTIONS_GENERIC;
  return WEEKLY_QUESTIONS_BY_PROBLEM[problemKey] || WEEKLY_QUESTIONS_GENERIC;
}

// Aktuelle Plan-Woche berechnen — basiert auf Tagen seit Profil-Anlage
// (Pfoten-Plan startet beim Anmelden). Wird auf totalWeeks gekappt.
export function getCurrentPlanWeek(
  memberCreatedAt: string,
  totalWeeks: number
): number {
  if (!memberCreatedAt) return 1;
  const start = new Date(memberCreatedAt);
  const now = new Date();
  const days = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const week = Math.floor(days / 7) + 1;
  if (week < 1) return 1;
  if (week > totalWeeks) return totalWeeks;
  return week;
}

// Alle Wochen-Eintraege fuer einen User holen (egal welche Plan-Woche).
// Sortiert: neueste zuerst. Pro Woche kann es mehrere geben — UI zeigt
// dann den juengsten Eintrag pro Woche.
export async function getWeeklyCheckIns(
  userId: string
): Promise<MoodLog[]> {
  const admin = createMemberAdminClient();
  const { data, error } = await admin
    .from("member_mood_logs")
    .select("*")
    .eq("user_id", userId)
    .not("plan_week", "is", null)
    .order("created_at", { ascending: false });
  if (error) {
    // Spalte plan_week noch nicht migriert → leere Liste, kein Crash
    if (error.message?.includes("plan_week")) return [];
    console.warn("[getWeeklyCheckIns]", error.message);
    return [];
  }
  return (data || []) as MoodLog[];
}

// Den juengsten Eintrag pro Woche als Map (week → MoodLog)
export function indexByWeek(logs: MoodLog[]): Map<number, MoodLog> {
  const map = new Map<number, MoodLog>();
  for (const l of logs) {
    if (l.plan_week == null) continue;
    if (!map.has(l.plan_week)) map.set(l.plan_week, l);
  }
  return map;
}
