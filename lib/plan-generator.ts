// AI-Generator fuer den 12-Wochen-Trainingsplan.
// Quiz-Daten + Hund-Kontext → strukturierter TrainingPlanContent JSON
// via Claude API. Spaeter als Make.com-Ersatz nutzbar.
//
// KOSTEN-SCHAETZUNG pro Plan (Stand 2026, claude-sonnet-4-5: $3/M in + $15/M out):
//   1 Monat (4 Wochen):  ~2.5k in + ~3k out  ≈ $0.05  (=5 Cent)
//   3 Monate (12 Wochen): ~2.5k in + ~8k out ≈ $0.13  (=13 Cent)
//   6 Monate (24 Wochen): ~2.5k in + ~16k out ≈ $0.25 (=25 Cent)
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
  plan_length_months?: 1 | 3 | 6; // Default 3 — entspricht selected_plan
}

// Mapping selected_plan → Monate
export function planLengthFromSelectedPlan(
  selectedPlan: string | null | undefined
): 1 | 3 | 6 {
  const s = (selectedPlan || "").toLowerCase().trim();
  if (s === "1month" || s === "1monat" || s.startsWith("1")) return 1;
  if (s === "6month" || s === "6monat" || s.startsWith("6")) return 6;
  return 3; // Default fallback (auch fuer "3month")
}

interface PhaseSpec {
  range: string;       // "Woche 1-2"
  thema: string;       // "Grundlagen + Alltagsstruktur"
}

// Phasen-Aufbau je nach Plan-Laenge — der Prompt nutzt das damit der
// rote Faden ueber die Wochen stimmt
function buildPhases(weeksTotal: number): PhaseSpec[] {
  if (weeksTotal <= 4) {
    return [
      { range: "Woche 1", thema: "Grundlagen + Alltagsstruktur aufbauen" },
      { range: "Woche 2", thema: "Impulskontrolle + erste Kernuebungen" },
      { range: "Woche 3", thema: "Hauptthema systematisch angehen" },
      { range: "Woche 4", thema: "Stabilisierung + Alltagstauglichkeit" },
    ];
  }
  if (weeksTotal <= 12) {
    return [
      { range: "Woche 1-4", thema: "Grundlagen + Alltagsstruktur + erste Kernuebungen" },
      { range: "Woche 5-8", thema: "Hauptthema in Tiefe + erste Begegnungen / schwierigere Situationen" },
      { range: "Woche 9-12", thema: "Generalisierung + Stabilisierung + langfristige Routinen" },
    ];
  }
  // 24 Wochen / 6 Monate
  return [
    { range: "Woche 1-4", thema: "Fundament: Vertrauen, Ruhe-Rituale, Grundlagen-Signale" },
    { range: "Woche 5-8", thema: "Hauptthema einfuehren in reizarmer Umgebung" },
    { range: "Woche 9-12", thema: "Erste echte Alltagssituationen + leichte Reize" },
    { range: "Woche 13-16", thema: "Schwierigere Situationen, Begegnungen, mehr Ablenkung" },
    { range: "Woche 17-20", thema: "Generalisierung in neue Orte + Reizkombinationen" },
    { range: "Woche 21-24", thema: "Stabilisierung + Langzeit-Routinen + Rueckfallplan" },
  ];
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

function buildSystemPrompt(weeksTotal: number, monthsTotal: number, phases: PhaseSpec[]): string {
  const phaseLines = phases
    .map((p) => `   - ${p.range}: ${p.thema}`)
    .join("\n");

  // Monatsuebersichten: 1 pro Monat = monthsTotal Stueck
  const monatsUebersichtenSpec =
    monthsTotal > 0
      ? `  "monats_uebersichten": [\n${Array.from({ length: monthsTotal }, (_, i) => `    { "monat": ${i + 1}, "text": "3-4 Absätze für Monat ${i + 1}." }`).join(",\n")}\n  ],`
      : "";

  return `Du bist erfahrene Hundetrainerin im Pfoten-Plan-Team und erstellst personalisierte ${monthsTotal}-Monats-Trainingspläne (${weeksTotal} Wochen) für Hundehalter zwischen 35 und 55 Jahren. Dein Schreibstil ist ruhig, klar und ohne Jargon — keine Anglizismen, keine Buzzwords, keine Doktor-Sprache.

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
    // Wiederhole für num: 2, 3, ... ${weeksTotal} — INSGESAMT GENAU ${weeksTotal} WOCHEN
  ],
${monatsUebersichtenSpec}
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

1. **Roter Faden über ${weeksTotal} Wochen**: Plan baut aufeinander auf. Phasen-Struktur:
${phaseLines}
   Jede Woche hat einen klaren Schwerpunkt der sich aus der Phase ableitet. Bei längeren Plänen (6 Monate) wird jede Phase tiefer ausgearbeitet — keine Wiederholungen ohne Steigerung.

2. **Hundename durchgehend**: Verwende den Namen des Hundes in JEDER Woche mehrfach in Wochenzielen, Tagesplan und Übungen — wirkt persönlicher.

3. **Realistische Übungen**: Schritte sind konkret und ausführbar. Keine vagen Anweisungen wie "übe Geduld". Stattdessen: "Halte ein Leckerli auf Augenhöhe, sage SCHAU, warte bis er dich ansieht."

4. **Trainingszeit respektieren**: Wenn 15 Min/Tag angegeben sind, dürfen die Übungen nicht 45 Min brauchen. Lieber 2 × 5 Min.

5. **Trauma-informiert bei Aggression/Angst**: Keine Konfrontation, keine Strafe, kein Leinenruck. Distanz-Management, positive Verknüpfung, schrittweise Annäherung.

6. **Bekannte Signale nutzen**: Wenn der Hund Sitz/Platz schon kann, baue darauf auf statt von Null zu starten.

7. **No-Gos sind harte Stichpunkte**: Keine ganzen Sätze. "Ruck an Leine verletzt Vertrauen", nicht "Du solltest niemals an der Leine rucken weil...".

8. **Fortschritts-Marker = Verben in Grundform** (User-facing Vorlage: "In dieser Woche sollte <Hund>..."): "etwas seltener anspringen", "schneller herunterfahren", "häufiger Blickkontakt suchen".

9. **Wenn Trainingszeit knapp ist** (<15 Min): Übungen in Alltagsmomente einbetten (Haustür, Futter, Schwellen) statt zusätzliche Trainingsblöcke.

10. **Sprache 40-50+**: Komplette Sätze, höflich-direkter Ton, Du-Anrede. Keine Hashtags, keine Emojis im Plan-Text (außer wenn der Schema-Wert es vorgibt).

Validiere am Ende: JSON ist valide, ALLE Felder vorhanden, GENAU ${weeksTotal} Wochen (num: 1 bis ${weeksTotal}), ${monthsTotal} monats_uebersichten, mindestens 3 zusatz_spiele.`;
}

function buildUserPrompt(
  input: PlanGeneratorInput,
  weeksTotal: number,
  monthsTotal: number
): string {
  const problemLabel = getProblemLabel(input);
  const trainingszeit = input.trainingszeit_minuten || 15;
  const signaleLine =
    input.bekannte_signale && input.bekannte_signale.length > 0
      ? `Bekannte Signale: ${input.bekannte_signale.join(", ")}`
      : "Bekannte Signale: keine bzw. nicht abgefragt";

  return `Erstelle einen ${monthsTotal}-Monats-Trainingsplan (${weeksTotal} Wochen) für folgenden Hund:

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

  const monthsTotal = input.plan_length_months || 3;
  const weeksTotal = monthsTotal * 4;
  const phases = buildPhases(weeksTotal);
  const systemPrompt = buildSystemPrompt(weeksTotal, monthsTotal, phases);
  // 24 Wochen brauchen mehr Output-Budget als 4 oder 12
  const maxTokens = weeksTotal <= 4 ? 6000 : weeksTotal <= 12 ? 16000 : 32000;

  try {
    const response = await anthropic.messages.create({
      // Sonnet 4.5 ist der Sweet-Spot fuer dieses Volumen: gut genug fuer
      // strukturierte Inhalte, deutlich guenstiger als Opus
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        { role: "user", content: buildUserPrompt(input, weeksTotal, monthsTotal) },
      ],
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
