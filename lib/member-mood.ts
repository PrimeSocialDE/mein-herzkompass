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
