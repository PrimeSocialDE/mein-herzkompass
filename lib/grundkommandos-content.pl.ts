// lib/grundkommandos-content.pl.ts
//
// POLNISCHE Variante (ŁapaPlan / lang="pl") von grundkommandos-content.ts.
// Generiert den INHALT des "Planu podstawowych komend" (Order-Bump-Produkt)
// pro Hund via Opus mit einem POLNISCHEN Prompt. Struktur/JSON-Keys sind 1:1
// identisch zur DE-Version (der PDF-Builder liest dieselben Keys) — nur die
// vom Leser sichtbaren Werte sind polnisch.
// Das deutsche grundkommandos-content.ts bleibt voellig unangetastet.

import Anthropic from "@anthropic-ai/sdk";
import type { GrundkommandosContent } from "./grundkommandos-content";

// Quiz-Command-Keys -> polnische Labels
export const COMMAND_LABELS_PL: Record<string, string> = {
  sit: "Siad",
  name: "Imię",
  place: "Na miejsce (mata)",
  come: "Do mnie",
  stay: "Zostań",
  paw: "Łapa",
  wait: "Czekaj",
  heel: "Do nogi",
  stop: "Stop",
  leave: "Zostaw / Puść",
  down: "Waruj (połóż się)",
};

// Kern-Kommandos, die das Produkt IMMER abdeckt (auch nicht ausgewaehlte).
const CORE = [
  "Siad",
  "Waruj (połóż się)",
  "Zostań",
  "Do mnie",
  "Czekaj",
  "Zostaw / Puść",
  "Patrz (kontakt wzrokowy)",
  "Na matę",
];

function buildUserPrompt(dog: string, breed: string, problem: string, knownSet: string): string {
  return `Stwórz BARDZO SZCZEGÓŁOWY praktyczny poradnik „Pewnie przez codzienność – podstawowe komendy dla niepewnych psów" dla psa ${dog} (${breed}), temat: ${problem}.
${dog} już potrafi: ${knownSet || "nic"}. Komendy podstawowe (nawet te niewybrane są ważne): ${CORE.join(", ")}. status "kann_schon" jeśli jest w „${knownSet}", w innym razie "neu".
WYTYCZNE: Każda komenda jako PRAWDZIWY samouczek krok po kroku dla laika; konkretnie jak NAPROWADZIĆ psa (wabienie, ruch ręki); „jeśli nie reaguje, to..."; realistyczne oczekiwania (NIE za pierwszym razem, wiele powtórzeń przez kilka dni, konkretne liczby); niepewny pies = żadnego przymusu, kończ na sukcesie. Komendy kontrolne, które działają też przy rowerzystach, biegaczach, innych psach i gościach.
Podaj TYLKO JSON, każda wartość w jednej linii:
{"dogName":"${dog}","subtitle":"...","sections":[
 {"key":"warum","title":"...","body":"3-4 zdania"},
 {"key":"haltung","title":"Najpierw Twoja postawa","body":"2-3 zdania","points":["5 zasad"]},
 {"key":"methode","title":"Tak uczy się Twój pies — Twoja skrzynka narzędziowa","body":"2-3 zdania","bausteine":[{"name":"Wabienie","text":"..."},{"name":"Słowo-TAK (marker)","text":"..."},{"name":"Nagradzanie","text":"..."},{"name":"Powtarzanie","text":"..."},{"name":"Małe kroki","text":"..."},{"name":"Kończ na sukcesie","text":"..."}]},
 ${CORE.map((c) => `{"key":"cmd","command":"${c}","status":"kann_schon|neu","title":"${c} — krótki dodatek","intro":"1-2 zdania","vorbereitung":"1-2 zdania","aufbau":["6-7 konkretnych kroków wraz z wabieniem/ruchem ręki oraz co-gdy-nie-reaguje"],"wenn_nicht":"2-3 zdania jak łagodnie naprowadzić","wiederholung":"konkretnie: powtórzeń/sesję, ile razy dziennie, przez ile dni; nie za pierwszym razem","erfolg":"...","fehler":"..."}`).join(",\n ")},
 {"key":"playbook","title":"Poradnik na co dzień: która komenda kiedy","intro":"1 zdanie","situations":[
  {"ort":"W domu","situation":"Gość dzwoni/wchodzi","kommando":"Mata + Zostań","tun":"2-3 zdania"},
  {"ort":"W domu","situation":"Dzwonek / głośny dźwięk","kommando":"Patrz + Waruj","tun":"..."},
  {"ort":"W domu","situation":"Żebranie / jedzenie spada na podłogę","kommando":"Zostaw / Puść","tun":"..."},
  {"ort":"W domu","situation":"${dog} się nakręca / jest rozbiegany","kommando":"Waruj / Mata","tun":"..."},
  {"ort":"W domu","situation":"Dzieci biegają/hałasują","kommando":"Na matę","tun":"..."},
  {"ort":"Na dworze","situation":"Inny pies idzie naprzeciw","kommando":"Patrz + Do mnie","tun":"..."},
  {"ort":"Na dworze","situation":"Kot/mysz przemyka obok","kommando":"Patrz / Zostaw","tun":"..."},
  {"ort":"Na dworze","situation":"Biegacz/rowerzysta","kommando":"Siad + Patrz","tun":"..."},
  {"ort":"Na dworze","situation":"Przed przejściem przez ulicę","kommando":"Siad + Czekaj","tun":"..."},
  {"ort":"Na dworze","situation":"Obcy chce pogłaskać","kommando":"Siad / Do mnie","tun":"..."},
  {"ort":"Na dworze","situation":"W kawiarni / czekanie","kommando":"Waruj + Zostań","tun":"..."},
  {"ort":"Na dworze","situation":"${dog} się płoszy / chce uciec","kommando":"Patrz + Do mnie","tun":"..."},
  {"ort":"Na dworze","situation":"Przy drzwiach bez wypadania","kommando":"Siad + Czekaj","tun":"..."},
  {"ort":"Na dworze","situation":"Głośny bodziec (śmieciarka/fajerwerki)","kommando":"Patrz + Mata","tun":"..."}
 ]},
 {"key":"wenn","title":"Co robić, gdy…","cases":[{"fall":"${dog} zastyga w bezruchu","tun":"..."},{"fall":"przytłoczony/zestresowany","tun":"..."},{"fall":"w domu ok, na dworze nie","tun":"..."},{"fall":"reaguje tylko przy Tobie","tun":"..."},{"fall":"regres","tun":"..."}]},
 {"key":"woche","title":"Twój 7-dniowy plan startowy","days":[{"tag":"Dzień 1-2","fokus":"..."},{"tag":"Dzień 3-4","fokus":"..."},{"tag":"Dzień 5-6","fokus":"..."},{"tag":"Dzień 7","fokus":"..."}],"check":["4 pytania tak/nie do sprawdzenia"]}
]}`;
}

const SYS =
  "Jesteś Ben, spokojny, doświadczony trener psów. Ciepły, mówiony język na „ty”, bardzo konkretny/praktyczny. Bez żargonu, bez markdown. ŻADNYCH prawdziwych znaków nowej linii w stringach JSON. Zwróć uwagę na poprawną składnię JSON. Odpowiadaj TYLKO JSON-em.";

// dog_commands (Quiz-Keys) -> polnische Labels
export function knownLabelsFromDogCommands(dogCommands: any): string[] {
  if (!Array.isArray(dogCommands)) return [];
  return dogCommands
    .map((c) => COMMAND_LABELS_PL[String(c)] || null)
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

  const dog = (input.dogName || "Twój pies").trim() || "Twój pies";
  const breed = (input.breed || "kundelek").trim() || "kundelek";
  const problem = (input.problem || "niepewność").trim() || "niepewność";
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
