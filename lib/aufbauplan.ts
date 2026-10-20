// Aufbauplan der Plan-Verlängerung (3 oder 6 Monate, frische Übungen).
//
// Nutzt den bewährten Zusatzplan-Generator (lib/zusatzplan.ts): gleicher
// Prompt-Aufbau, gleiche PDF-Optik. Unterschied: Grundlage ist nicht eine
// Beschwerde, sondern der Check-in nach Planende (was klappt, was hakt, was
// ist neu). Pro Teil 9 neue Übungen über 3 Monate; der 6-Monats-Plan besteht
// aus Teil 1 (Monat 1-3) und Teil 2 (Monat 4-6), Teil 2 schließt die Übungen
// aus Teil 1 aus. Ein Teil dauert rund 3-4 Minuten (Sonnet, 12k Tokens).

import { ZUSATZPLAN_SYSTEM, zusatzplanPDF } from "@/lib/zusatzplan";

const MODEL = "claude-sonnet-4-6";

export interface VerlCheckin {
  klappt?: string;
  klappt_nicht?: string;
  neu?: string;
}

function ersetze(s: string, paare: Array<[string, string]>, teil: 1 | 2): string {
  for (const [alt, neu] of paare) {
    if (!s.includes(alt)) {
      console.warn(`[aufbauplan] Prompt-Baustein nicht gefunden (Teil ${teil}): ${alt.slice(0, 60)}`);
      continue;
    }
    s = s.split(alt).join(neu);
  }
  return s;
}

export function aufbauSystem(teil: 1 | 2): string {
  let s = ersetze(
    ZUSATZPLAN_SYSTEM,
    [
      [
        "Analysiere den Trainingsplan, verstehe die Beschwerde, und erstelle eine korrigierte Version.",
        "Der Halter hat seinen bisherigen Trainingsplan abgeschlossen und ihn verlängert. Du erstellst den AUFBAUPLAN: ausschließlich neue Übungen, die auf dem bisher Gelernten aufbauen und genau dort ansetzen, wo es laut Check-in noch hakt oder was neu dazugekommen ist.",
      ],
      [
        "[Hundename]'s persönlicher Zusatz-Plan",
        teil === 2 ? "[Hundename]s Aufbauplan – Teil 2" : "[Hundename]s persönlicher Aufbauplan",
      ],
      [
        'Erkläre das Problem des Hundes einfühlsam. Zeige Verständnis ("Das kennen viele Hundebesitzer"). Erkläre warum dieser Plan anders ist als allgemeine Tipps aus dem Internet - er ist genau auf diesen Hund zugeschnitten. Mach Mut, dass Veränderung möglich ist, auch wenn es sich gerade schwer anfühlt.',
        teil === 2
          ? "Knüpfe an Teil 1 an: die Grundlagen der ersten drei Monate sitzen, jetzt geht es um mehr Ablenkung, längere Dauer und den echten Alltag. Benenne konkret, woran ihr in Monat 4 bis 6 arbeitet. Mach Mut für die zweite Etappe."
          : "Würdige zuerst konkret, was laut Check-in schon klappt (mit den Worten des Halters). Benenne dann, woran ihr in den nächsten Monaten arbeitet: was noch hakt und was neu dazugekommen ist. Erkläre, dass dieser Aufbauplan auf dem bisherigen Plan aufbaut und nur neue Übungen enthält. Mach Mut für die nächste Etappe.",
      ],
    ],
    teil
  );
  if (teil === 2) {
    s = ersetze(
      s,
      [
        ["Monat 1 (Woche 1-4): Übung 1 und 2", "Monat 4 (Woche 13-16): Übung 10 und 11"],
        ["Monat 2 (Woche 5-8): Übung 3 und 4", "Monat 5 (Woche 17-20): Übung 12 und 13"],
        ["Monat 3 (Woche 9-12): Übung 5 und 6", "Monat 6 (Woche 21-24): Übung 14 und 15"],
        ["Bonus: Fortgeschrittene Übungen 7-9", "Bonus: Fortgeschrittene Übungen 16-18"],
        ["ab Monat 2-3", "ab Monat 5-6"],
        ["Übung 1-2 sind Grundlagen, 3-4 Alltagsintegration, 5-6 fortgeschrittener.", "Übung 10-11 sind die Grundlagen dieser Etappe, 12-13 Alltagsintegration, 14-15 fortgeschrittener."],
        ["(wenn Übung 1-6 zuverlässig klappen)", "(wenn Übung 10-15 zuverlässig klappen)"],
        ["Nummeriere sie als Übung 7, 8, 9.", "Nummeriere sie als Übung 16, 17, 18."],
      ],
      teil
    );
  }
  return s;
}

/** Übungstitel ("Übung 3: Titel – Untertitel") aus einem fertigen Plantext. */
export function uebungsNamen(text: string): string[] {
  return (text.match(/^Übung \d+:.*$/gm) || []).map((z) => z.trim()).slice(0, 30);
}

const saeubern = (t?: string, max = 800) =>
  String(t || "").replace(/[`<>{}]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

export async function aufbauplanText(opts: {
  dogName: string;
  customerName?: string;
  problemLabel?: string;
  checkin: VerlCheckin;
  planUebersicht: string;
  teil: 1 | 2;
  teil1Uebungen?: string[];
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt");
  let context = "";
  if (opts.customerName) context += `Kundenname: ${opts.customerName}\n`;
  if (opts.dogName) context += `Hundename: ${opts.dogName}\n`;
  if (opts.problemLabel) context += `Ursprüngliches Hauptthema: ${opts.problemLabel}\n`;
  const c = opts.checkin || {};
  const user =
    (context ? `ZUSATZINFORMATIONEN:\n${context}\n` : "") +
    `CHECK-IN DES HALTERS NACH ABSCHLUSS DES BISHERIGEN PLANS (seine eigenen Worte):\n` +
    `Was schon klappt: ${saeubern(c.klappt) || "(keine Angabe)"}\n` +
    `Was noch nicht klappt: ${saeubern(c.klappt_nicht) || "(keine Angabe)"}\n` +
    `Was neu dazugekommen ist: ${saeubern(c.neu) || "(nichts)"}\n\n` +
    (opts.planUebersicht
      ? `BISHERIGER TRAININGSPLAN (Übersicht, Woche für Woche). Wiederhole diese Übungen NICHT, sondern baue darauf auf:\n${opts.planUebersicht}\n\n`
      : "") +
    (opts.teil === 2 && opts.teil1Uebungen?.length
      ? `DIES IST TEIL 2 (Monat 4 bis 6). Teil 1 (Monat 1 bis 3) enthielt bereits diese Übungen. Wiederhole sie NICHT, sondern steigere darauf aufbauend:\n${opts.teil1Uebungen.join("\n")}\n\n`
      : "") +
    `Bitte erstelle den Aufbauplan${opts.teil === 2 ? " (Teil 2)" : ""}.`;
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 12000,
    system: aufbauSystem(opts.teil),
    messages: [{ role: "user", content: user }],
  });
  return res.content.filter((x: any) => x.type === "text").map((x: any) => x.text).join("").trim();
}

export function aufbauplanPDF(text: string, dogName: string, teil: 1 | 2, monate: 3 | 6): Promise<Uint8Array> {
  const zeitraum = monate === 6 ? (teil === 2 ? "Monat 4 bis 6" : "Monat 1 bis 3") : "die nächsten 3 Monate";
  return zusatzplanPDF(text, dogName, {
    titel: teil === 2 ? `${dogName}s Aufbauplan – Teil 2` : `${dogName}s persönlicher Aufbauplan`,
    untertitel: `Neue Übungen für ${zeitraum}: aufbauend auf dem, was ${dogName} schon kann, und genau da, wo es noch hakt. Zum Ausdrucken und Abhaken.`,
    fuss: `${dogName}s Aufbauplan${teil === 2 ? " · Teil 2" : ""} · Pfoten-Plan`,
  });
}
