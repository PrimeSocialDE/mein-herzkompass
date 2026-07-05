// lib/grundkommandos-content.ts
//
// Generiert den INHALT des "Notfall-Grundkommando-Plan" (Order-Bump-Produkt)
// pro Hund via Opus. Fokussiert auf die Kommandos, die der Hund laut Quiz
// (answers.dog_commands) NOCH NICHT kann, baut auf den bekannten auf.
// Rueckgabe: striktes Content-JSON (siehe GrundkommandosContent), das der
// PDF-Builder (lib/grundkommandos-pdf.ts) rendert.

import Anthropic from "@anthropic-ai/sdk";

// Quiz-Command-Keys -> deutsche Labels
export const COMMAND_LABELS: Record<string, string> = {
  sit: "Sitz",
  name: "Name",
  place: "Auf-den-Platz (Decke)",
  come: "Hier/Komm",
  stay: "Bleib",
  paw: "Pfote",
  wait: "Warte",
  heel: "Fuß",
  stop: "Stopp",
  leave: "Aus/Lass es",
  down: "Platz (hinlegen)",
};

// Kern-Kommandos, die das Produkt IMMER abdeckt (auch nicht ausgewaehlte).
const CORE = [
  "Sitz",
  "Platz (hinlegen)",
  "Bleib",
  "Hier",
  "Warte",
  "Aus / Lass es",
  "Schau (Blickkontakt)",
  "Auf die Decke",
];

export interface GrundkommandoCmd {
  key: "cmd";
  command: string;
  status: "kann_schon" | "neu";
  title: string;
  intro: string;
  vorbereitung: string;
  aufbau: string[];
  wenn_nicht: string;
  wiederholung: string;
  erfolg: string;
  fehler: string;
}
export interface GrundkommandosContent {
  dogName: string;
  subtitle: string;
  known: string[];
  sections: any[];
}

function buildUserPrompt(dog: string, breed: string, problem: string, knownSet: string): string {
  return `Erstelle ein SEHR AUSFÜHRLICHES Praxis-Handbuch „Sicher durch den Alltag – Grundkommandos für unsichere Hunde" für ${dog} (${breed}), Thema: ${problem}.
${dog} kann schon: ${knownSet || "nichts"}. Kern-Kommandos (auch nicht ausgewählte wichtig): ${CORE.join(", ")}. status "kann_schon" wenn in "${knownSet}" sonst "neu".
LEITLINIEN: Jedes Kommando als ECHTES Schritt-für-Schritt-Tutorial für Laien; konkret wie man den Hund HINFÜHRT (locken, Handbewegung); "wenn er nicht reagiert, dann..."; realistische Erwartung (NICHT beim ersten Mal, viele Wdh über Tage, konkrete Zahlen); unsicherer Hund = kein Zwang, mit Erfolg aufhören. Kontroll-Kommandos, die auch bei Radfahrern, Joggern, anderen Hunden und Besuch sitzen.
Gib NUR JSON, jeder Wert eine Zeile:
{"dogName":"${dog}","subtitle":"...","sections":[
 {"key":"warum","title":"...","body":"3-4 Sätze"},
 {"key":"haltung","title":"Deine Haltung zuerst","body":"2-3 Sätze","points":["5 Regeln"]},
 {"key":"methode","title":"So lernt dein Hund — dein Werkzeugkasten","body":"2-3 Sätze","bausteine":[{"name":"Locken","text":"..."},{"name":"Das Ja-Wort (Markern)","text":"..."},{"name":"Belohnen","text":"..."},{"name":"Wiederholen","text":"..."},{"name":"Kleine Schritte","text":"..."},{"name":"Mit Erfolg aufhören","text":"..."}]},
 ${CORE.map((c) => `{"key":"cmd","command":"${c}","status":"kann_schon|neu","title":"${c} — kurzer Zusatz","intro":"1-2 Sätze","vorbereitung":"1-2 Sätze","aufbau":["6-7 konkrete Schritte inkl. Locken/Handbewegung und wenn-er-nicht-reagiert"],"wenn_nicht":"2-3 Sätze sanft hinführen","wiederholung":"konkret: Wdh/Einheit, wie oft täglich, wie viele Tage; nicht beim ersten Mal","erfolg":"...","fehler":"..."}`).join(",\n ")},
 {"key":"playbook","title":"Das Alltags-Playbook: welches Kommando wann","intro":"1 Satz","situations":[
  {"ort":"Zuhause","situation":"Besuch klingelt/kommt rein","kommando":"Decke + Bleib","tun":"2-3 Sätze"},
  {"ort":"Zuhause","situation":"Es klingelt / lautes Geräusch","kommando":"Schau + Platz","tun":"..."},
  {"ort":"Zuhause","situation":"Betteln / Futter fällt runter","kommando":"Aus / Lass es","tun":"..."},
  {"ort":"Zuhause","situation":"${dog} dreht auf / hektisch","kommando":"Platz / Decke","tun":"..."},
  {"ort":"Zuhause","situation":"Kinder rennen/toben","kommando":"Auf die Decke","tun":"..."},
  {"ort":"Draußen","situation":"Anderer Hund kommt entgegen","kommando":"Schau + Hier","tun":"..."},
  {"ort":"Draußen","situation":"Katze/Maus huscht vorbei","kommando":"Schau / Aus","tun":"..."},
  {"ort":"Draußen","situation":"Jogger/Radfahrer","kommando":"Sitz + Schau","tun":"..."},
  {"ort":"Draußen","situation":"Vor dem Überqueren einer Straße","kommando":"Sitz + Warte","tun":"..."},
  {"ort":"Draußen","situation":"Fremde will streicheln","kommando":"Sitz / Hier","tun":"..."},
  {"ort":"Draußen","situation":"Im Café / Warten","kommando":"Platz + Bleib","tun":"..."},
  {"ort":"Draußen","situation":"${dog} erschrickt / will fliehen","kommando":"Schau + Hier","tun":"..."},
  {"ort":"Draußen","situation":"An der Haustür ohne Stürmen","kommando":"Sitz + Warte","tun":"..."},
  {"ort":"Draußen","situation":"Lauter Reiz (Müllauto/Feuerwerk)","kommando":"Schau + Decke","tun":"..."}
 ]},
 {"key":"wenn","title":"Was tun, wenn…","cases":[{"fall":"${dog} friert ein","tun":"..."},{"fall":"überfordert/gestresst","tun":"..."},{"fall":"drinnen ok, draußen nicht","tun":"..."},{"fall":"reagiert nur bei dir","tun":"..."},{"fall":"Rückschritt","tun":"..."}]},
 {"key":"woche","title":"Dein 7-Tage-Startplan","days":[{"tag":"Tag 1-2","fokus":"..."},{"tag":"Tag 3-4","fokus":"..."},{"tag":"Tag 5-6","fokus":"..."},{"tag":"Tag 7","fokus":"..."}],"check":["4 Ja/Nein-Checks"]}
]}`;
}

const SYS =
  "Du bist Ben, ein ruhiger, erfahrener Hundetrainer. Warme, gesprochene DU-Sprache, sehr konkret/praktisch. Kein Fachjargon, kein Markdown. KEINE echten Zeilenumbrüche in JSON-Strings. Achte auf gültige JSON-Syntax. Antworte NUR mit JSON.";

// dog_commands (Quiz-Keys) -> deutsche Labels
export function knownLabelsFromDogCommands(dogCommands: any): string[] {
  if (!Array.isArray(dogCommands)) return [];
  return dogCommands
    .map((c) => COMMAND_LABELS[String(c)] || null)
    .filter((x): x is string => !!x && x !== "keins");
}

export async function generateGrundkommandosContent(input: {
  dogName?: string | null;
  breed?: string | null;
  problem?: string | null;
  knownCommands?: string[];
}): Promise<GrundkommandosContent> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt");

  const dog = (input.dogName || "dein Hund").trim() || "dein Hund";
  const breed = (input.breed || "Mischling").trim() || "Mischling";
  const problem = (input.problem || "Unsicherheit").trim() || "Unsicherheit";
  const known = (input.knownCommands || []).filter(Boolean);
  const knownSet = known.join(", ");

  const anthropic = new Anthropic({ apiKey });
  const stream = anthropic.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 22000,
    system: SYS,
    messages: [{ role: "user", content: buildUserPrompt(dog, breed, problem, knownSet) }],
  });
  const msg = await stream.finalMessage();
  const text = msg.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");

  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("kein JSON in Opus-Antwort");
  let raw = text.slice(s, e + 1).replace(/[\r\n\t]+/g, " ");
  // Reparatur: Streu-"]" direkt nach skalaren Text-Feldern entfernen (Opus-Fehler)
  raw = raw.replace(
    /("(?:wenn_nicht|wiederholung|erfolg|fehler|intro|vorbereitung|tun|body|text|subtitle|title|fokus)"\s*:\s*"[^"]*")\s*\]/g,
    "$1"
  );
  const data = JSON.parse(raw) as GrundkommandosContent;
  if (!Array.isArray(data?.sections) || !data.sections.length) {
    throw new Error("Opus lieferte keine Sektionen");
  }
  data.known = known;
  data.dogName = data.dogName || dog;
  return data;
}
