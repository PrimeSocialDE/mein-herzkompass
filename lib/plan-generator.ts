// AI-Generator fuer den 12-Wochen-Trainingsplan.
// Quiz-Daten + Hund-Kontext → strukturierter TrainingPlanContent JSON
// via Claude API. Spaeter als Make.com-Ersatz nutzbar.
//
// KOSTEN-SCHAETZUNG (Stand 2026):
//   Input:  ~2k tokens System-Prompt + ~500 tokens Quiz-Daten = ~2.5k
//   Output: ~8k tokens fuer kompletten 12-Wochen-Plan in DE
//   claude-sonnet-4-5: $3/M input + $15/M output
//   → pro Plan: ~$0.135 (=13 Cent)
//   Vergleich Make.com + Docupilot: deutlich teurer (Abo + Pay-per-Plan)

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { TrainingPlanContent } from "./member-plan-content";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

// Quiz-Daten die als Input dienen.
// Felder sind alle optional — der Prompt sagt Claude, wie er mit
// fehlenden Daten umgehen soll (sinnvolle Defaults).
export interface PlanGeneratorInput {
  dog_name: string;
  dog_breed?: string | null;
  dog_age?: string | null;        // "2 Jahre" oder "Welpe"
  dog_size?: string | null;       // "groß" / "mittel" / "klein"
  dog_problem: string;            // "pulling" / "barking" / ...
  dog_problem_label?: string;     // human-readable, fuer prompt
  bekannte_signale?: string[];    // z.B. ["Sitz", "Platz", "Stop"]
  trainingszeit_minuten?: number; // Default 15
  zusatz_kontext?: string;        // freier Text aus weiteren Quiz-Antworten
}

const PROBLEM_LABELS_DE: Record<string, string> = {
  pulling: "Leinenziehen",
  barking: "übermäßiges Bellen",
  aggression: "Aggression in Begegnungen",
  anxiety: "Trennungsangst",
  jumping: "Anspringen von Menschen",
  recall: "unzuverlässiger Rückruf",
  energy: "zu viel Energie und mangelnde Ruhe",
  destructive: "Zerstörungsverhalten",
  soiling: "Stubenunreinheit",
  mouthing: "Aufnehmen von Dingen vom Boden",
};

function getProblemLabel(input: PlanGeneratorInput): string {
  return (
    input.dog_problem_label ||
    PROBLEM_LABELS_DE[input.dog_problem] ||
    input.dog_problem
  );
}

const SYSTEM_PROMPT = `Du bist erfahrene Hundetrainerin im Pfoten-Plan-Team und erstellst personalisierte 12-Wochen-Trainingspläne für Hundehalter zwischen 35 und 55 Jahren. Dein Schreibstil ist ruhig, klar und ohne Jargon — keine Anglizismen, keine Buzzwords, keine Doktor-Sprache.

Du gibst deinen Plan AUSSCHLIESSLICH als valides JSON zurück — kein Markdown, kein Vorspann, kein Nachspann. Das JSON entspricht EXAKT folgendem Schema:

{
  "intro": {
    "headline": "3-Monatsplan für <Hundename>",
    "einleitung": "3-4 Absätze. Wer der Hund ist, was die Problemlage ist, warum dieser Plan helfen wird. Newlines zwischen Absätzen mit \\n\\n.",
    "ziele": "3-4 Absätze. Was am Ende der 12 Wochen erreicht sein soll. Konkret, nicht abstrakt.",
    "aufbau": "3-4 Absätze. Wie der Plan strukturiert ist: 12 Wochen, kurze tägliche Einheiten, Wiederholungen erlaubt, Rückschritte normal."
  },
  "weeks": [
    {
      "num": 1,
      "title": "Kurzer prägnanter Wochen-Titel, max 4 Wörter z.B. 'Start Alltagstruktur'",
      "wochenziele": ["Ziel 1 als ganzer Satz mit Hundenamen.", "Ziel 2.", "Ziel 3.", "Ziel 4.", "Ziel 5."],
      "tagesplan": "2 Absätze. Wie eine typische Trainingswoche aussieht. Was morgens/mittags/abends passiert. Realistisch für die angegebene Trainingszeit.",
      "no_gos": ["Kurzer Stichpunkt 1, max 6 Wörter", "Stichpunkt 2", "...", "6 No-Gos insgesamt"],
      "fortschritt": ["seltener X", "schneller Y", "...", "5 beobachtbare Indikatoren — KEIN Hundename, beginnen mit Verb in der Grundform"],
      "uebungen": [
        {
          "name": "Kurzer Übungs-Titel, z.B. 'Ritual Haustür ruhig'",
          "schritte": ["Schritt 1 als Imperativ-Satz", "Schritt 2", "...", "8 Schritte insgesamt"]
        },
        {
          "name": "Zweite Übung",
          "schritte": ["8 Schritte"]
        }
      ]
    }
    // Wiederhole für num: 2, 3, ... 12
  ],
  "monats_uebersichten": [
    { "monat": 1, "text": "3-4 Absätze. Was im ersten Monat (Wochen 1-4) erreicht wurde, typische Schwierigkeiten, Ausblick auf Monat 2." },
    { "monat": 2, "text": "3-4 Absätze für Monat 2." },
    { "monat": 3, "text": "3-4 Absätze für Monat 3." }
  ],
  "abschluss": "3-4 Absätze. Zusammenfassung, was erreicht wurde, wie es weitergeht. Ermutigend, ohne falsche Versprechen.",
  "zusatz_spiele": [
    {
      "nummer": 1,
      "name": "Spiel-Name",
      "ziel": "Ein Satz",
      "schritte": ["Schritt 1", "...", "8 Schritte"],
      "warum": "1-2 Sätze, warum dieses Spiel hilft."
    }
    // 3 Bonus-Spiele insgesamt
  ]
}

WICHTIGE INHALTLICHE LEITPLANKEN:

1. **Roter Faden über 12 Wochen**: Plan baut aufeinander auf. Woche 1-4 = Grundlagen + Alltagsstruktur. Woche 5-8 = Hauptthema in Tiefe + erste Begegnungen. Woche 9-12 = Generalisierung + Stabilisierung. Jede Woche hat einen klaren Schwerpunkt.

2. **Hundename durchgehend**: Verwende den Namen des Hundes in JEDER Woche mehrfach in Wochenzielen, Tagesplan und Übungen — wirkt persönlicher.

3. **Realistische Übungen**: Schritte sind konkret und ausführbar. Keine vagen Anweisungen wie "übe Geduld". Stattdessen: "Halte ein Leckerli auf Augenhöhe, sage SCHAU, warte bis er dich ansieht."

4. **Trainingszeit respektieren**: Wenn 15 Min/Tag angegeben sind, dürfen die Übungen nicht 45 Min brauchen. Lieber 2 × 5 Min.

5. **Trauma-informiert bei Aggression/Angst**: Keine Konfrontation, keine Strafe, kein Leinenruck. Distanz-Management, positive Verknüpfung, schrittweise Annäherung.

6. **Bekannte Signale nutzen**: Wenn der Hund Sitz/Platz schon kann, baue darauf auf statt von Null zu starten.

7. **No-Gos sind harte Stichpunkte**: Keine ganzen Sätze. "Ruck an Leine verletzt Vertrauen", nicht "Du solltest niemals an der Leine rucken weil...".

8. **Fortschritts-Marker = Verben in Grundform** (User-facing Vorlage: "In dieser Woche sollte <Hund>..."): "etwas seltener anspringen", "schneller herunterfahren", "häufiger Blickkontakt suchen".

9. **Wenn Trainingszeit knapp ist** (<15 Min): Übungen in Alltagsmomente einbetten (Haustür, Futter, Schwellen) statt zusätzliche Trainingsblöcke.

10. **Sprache 40-50+**: Komplette Sätze, höflich-direkter Ton, Du-Anrede. Keine Hashtags, keine Emojis im Plan-Text (außer wenn der Schema-Wert es vorgibt).

Validiere am Ende: JSON ist valide, ALLE Felder vorhanden, 12 Wochen, 3 monats_uebersichten, mindestens 3 zusatz_spiele.`;

function buildUserPrompt(input: PlanGeneratorInput): string {
  const problemLabel = getProblemLabel(input);
  const trainingszeit = input.trainingszeit_minuten || 15;
  const signaleLine =
    input.bekannte_signale && input.bekannte_signale.length > 0
      ? `Bekannte Signale: ${input.bekannte_signale.join(", ")}`
      : "Bekannte Signale: keine bzw. nicht abgefragt";

  return `Erstelle einen 12-Wochen-Trainingsplan für folgenden Hund:

Hundename: ${input.dog_name}
Rasse: ${input.dog_breed || "nicht angegeben (gehe von einem mittelgroßen Mischling aus)"}
Alter: ${input.dog_age || "erwachsen (1-7 Jahre)"}
Größe: ${input.dog_size || "mittel"}
Hauptthema: ${problemLabel}
${signaleLine}
Tägliche Trainingszeit: ${trainingszeit} Minuten
${input.zusatz_kontext ? `\nZusätzlicher Kontext aus dem Quiz:\n${input.zusatz_kontext}` : ""}

Gib NUR das JSON zurück, kein Markdown, keinen Vorspann.`;
}

// Robustes JSON-Parsing — Claude kann manchmal trotz Anweisung ein
// Code-Fence wie ```json ... ``` umlegen
function extractJson(text: string): any {
  const trimmed = text.trim();
  // Code-Fence entfernen
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const candidate = fenceMatch ? fenceMatch[1] : trimmed;
  return JSON.parse(candidate);
}

function validatePlan(plan: any): plan is TrainingPlanContent {
  if (!plan || typeof plan !== "object") return false;
  if (!Array.isArray(plan.weeks)) return false;
  if (plan.weeks.length < 1) return false;
  for (const w of plan.weeks) {
    if (typeof w.num !== "number") return false;
    if (typeof w.title !== "string") return false;
    if (!Array.isArray(w.wochenziele)) return false;
    if (typeof w.tagesplan !== "string") return false;
    if (!Array.isArray(w.no_gos)) return false;
    if (!Array.isArray(w.fortschritt)) return false;
    if (!Array.isArray(w.uebungen)) return false;
  }
  return true;
}

export interface GeneratedPlanResult {
  ok: boolean;
  plan?: TrainingPlanContent;
  error?: string;
  raw_response?: string;       // bei Fehler zum Debuggen
  usage?: {
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number;
  };
}

export async function generateTrainingPlan(
  input: PlanGeneratorInput
): Promise<GeneratedPlanResult> {
  if (!ANTHROPIC_API_KEY) {
    return { ok: false, error: "ANTHROPIC_API_KEY fehlt" };
  }
  if (!input.dog_name || !input.dog_problem) {
    return { ok: false, error: "dog_name + dog_problem sind Pflicht" };
  }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  try {
    const response = await anthropic.messages.create({
      // Sonnet 4.5 ist der Sweet-Spot fuer dieses Volumen: gut genug fuer
      // strukturierte Inhalte, deutlich guenstiger als Opus
      model: "claude-sonnet-4-5",
      max_tokens: 16000, // 12 Wochen + alles drumherum = ca 8-10k tokens
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });

    const text = response.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");

    let parsed: any;
    try {
      parsed = extractJson(text);
    } catch (e: any) {
      return {
        ok: false,
        error: `JSON-Parse fehlgeschlagen: ${e?.message}`,
        raw_response: text.slice(0, 2000),
      };
    }

    if (!validatePlan(parsed)) {
      return {
        ok: false,
        error: "Plan-Schema-Validierung fehlgeschlagen",
        raw_response: JSON.stringify(parsed).slice(0, 2000),
      };
    }

    // Kostenrechnung
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const costUsd =
      (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;

    return {
      ok: true,
      plan: parsed as TrainingPlanContent,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd: Number(costUsd.toFixed(4)),
      },
    };
  } catch (e: any) {
    return {
      ok: false,
      error: `Claude API-Fehler: ${e?.message || String(e)}`,
    };
  }
}
