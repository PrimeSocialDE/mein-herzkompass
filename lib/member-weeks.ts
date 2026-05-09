// Wochen-Logik: leitet aus member_modules.unlock_after_days ab
// in welche Trainings-Woche ein Modul gehört. Kein DB-Schema-Update
// nötig — pure Berechnung.
//
// Konvention: Tag 0 = Woche 1 (sofort verfügbar bei Kauf), Tag 7 = Woche 2,
// Tag 14 = Woche 3 usw. Wer eine andere Granularität will (z.B. 3-Tage-
// Drip), kann dieses File anpassen ohne DB-Migration.

import type { ModuleWithStatus } from "./member-db";

const DAYS_PER_WEEK = 7;

export interface WeekGroup {
  weekNumber: number;
  modules: ModuleWithStatus[];
  unlockedCount: number;
  totalCount: number;
  isUnlocked: boolean;
  unlockAt: string | null;
}

export function weekForDays(days: number): number {
  if (days <= 0) return 1;
  return Math.floor(days / DAYS_PER_WEEK) + 1;
}

export function groupModulesByWeek(
  modules: ModuleWithStatus[]
): WeekGroup[] {
  const map = new Map<number, ModuleWithStatus[]>();
  for (const m of modules) {
    const w = weekForDays(m.unlock_after_days);
    if (!map.has(w)) map.set(w, []);
    map.get(w)!.push(m);
  }

  const weeks: WeekGroup[] = [];
  for (const [weekNumber, weekModules] of [...map.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    const unlockedCount = weekModules.filter((m) => m.unlocked).length;
    const totalCount = weekModules.length;
    // Woche ist "unlocked" wenn mind. ein Modul daraus unlocked ist
    const isUnlocked = unlockedCount > 0;
    // Wann wird die Woche frei? = frühester unlock_at innerhalb der Woche
    const unlockDates = weekModules
      .map((m) => m.unlock_at)
      .filter((d): d is string => !!d);
    const unlockAt = unlockDates.length
      ? unlockDates.sort()[0]
      : null;
    weeks.push({
      weekNumber,
      modules: weekModules,
      unlockedCount,
      totalCount,
      isUnlocked,
      unlockAt,
    });
  }
  return weeks;
}
