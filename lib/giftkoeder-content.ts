// lib/giftkoeder-content.ts
//
// Erzeugt das personalisierte Trainings-Handbuch "Nichts vom Boden" (Anti-Giftkoeder).
// Aufbau wie lib/grundkommandos-content.ts: Opus liefert JSON, lib/giftkoeder-pdf
// setzt daraus das PDF.
//
// WICHTIG, inhaltlich: Giftkoeder sind ein Gesundheitsrisiko, kein Erziehungsthema.
// Das Modul trainiert Vorbeugung und ersetzt KEINEN Tierarzt. Die Notfall-Sektion
// sagt das ausdruecklich und nennt Anzeichen, bei denen sofort gefahren wird.

import Anthropic from "@anthropic-ai/sdk";

export interface GiftkoederUebung {
  key: "uebung";
  nummer: number;
  stufe: string;
  title: string;
  intro: string;
  vorbereitung: string;
  aufbau: string[];
  wenn_nicht: string;
  wiederholung: string;
  erfolg: string;
  fehler: string;
}

export interface GiftkoederContent {
  dogName: string;
  subtitle: string;
  sections: any[];
}

// Die 20 Uebungen als festes Geruest — Opus fuellt sie aus, erfindet sie nicht.
// Reihenfolge ist der Lernweg: geschlossene Hand -> Boden -> Garten -> Laub -> frei.
const UEBUNGEN: Array<[number, string, string]> = [
  [1,  "Stufe 1 — Die Grundlage, drinnen", "Das Tausch-Prinzip: Hergeben lohnt sich"],
  [2,  "Stufe 1 — Die Grundlage, drinnen", "AUS an der geschlossenen Hand"],
  [3,  "Stufe 1 — Die Grundlage, drinnen", "AUS an der offenen Hand"],
  [4,  "Stufe 1 — Die Grundlage, drinnen", "AUS am abgedeckten Leckerli auf dem Boden"],
  [5,  "Stufe 1 — Die Grundlage, drinnen", "AUS am offen liegenden Leckerli"],
  [6,  "Stufe 2 — Vom Flur in den Garten", "Das Ja-Wort für Nicht-Anrühren"],
  [7,  "Stufe 2 — Vom Flur in den Garten", "Blickkontakt statt Boden: der Schau-Wechsel"],
  [8,  "Stufe 2 — Vom Flur in den Garten", "PFUI als klares Stopp-Signal aufbauen"],
  [9,  "Stufe 2 — Vom Flur in den Garten", "An einer präparierten Stelle vorbeigehen"],
  [10, "Stufe 2 — Vom Flur in den Garten", "Anzeigen statt fressen: finden und melden"],
  [11, "Stufe 3 — Draußen, echte Reize",  "Der Laubhaufen im Herbst"],
  [12, "Stufe 3 — Draußen, echte Reize",  "Gebüsch und Wegrand an der Schleppleine"],
  [13, "Stufe 3 — Draußen, echte Reize",  "Die Hotspots: Mülleimer, Parkbank, Grillplatz"],
  [14, "Stufe 3 — Draußen, echte Reize",  "Echte Essensreste auf dem Gehweg"],
  [15, "Stufe 3 — Draußen, echte Reize",  "Ablenkung durch andere Hunde und Menschen"],
  [16, "Stufe 4 — Notfall und Alltag",     "Der Notfall-Abbruch, wenn es schnell gehen muss"],
  [17, "Stufe 4 — Notfall und Alltag",     "Er hat schon etwas im Maul — was jetzt"],
  [18, "Stufe 4 — Notfall und Alltag",     "Maulkorb als Brücke, ohne Drama aufgebaut"],
  [19, "Stufe 4 — Notfall und Alltag",     "Die erste Runde ohne Leine in sicherer Zone"],
  [20, "Stufe 4 — Notfall und Alltag",     "Wartung: damit es in sechs Monaten noch sitzt"],
];

const SYS =
  "Du bist Ben, ein ruhiger, erfahrener Hundetrainer. Warme, gesprochene DU-Sprache, sehr konkret und praktisch, für Laien. Viele Leserinnen sind über 50 — kurze Sätze, kein Fachjargon, kein Markdown. KEINE echten Zeilenumbrüche in JSON-Strings. Gültiges JSON. Antworte NUR mit JSON. SCHREIBWEISE: Rechtschreibung mit echten Umlauten und ß (ä, ö, ü, Ä, Ö, Ü, ß). Schreib niemals ae, oe, ue oder ss als Ersatz — also Handfläche statt Handflaeche, regelmäßig statt regelmaessig, für statt fuer, Übung statt Uebung. ANFÜHRUNGSZEICHEN: innerhalb der Texte niemals ein gerades \" verwenden, sondern immer die deutschen Zeichen „ und “ — ein gerades Anführungszeichen zerstört das JSON. Auch keine Backslashes.";

// Ein Uebungs-Geruest als JSON-Vorlage. Opus fuellt die Felder, erfindet aber
// weder Titel noch Reihenfolge.
function uebungsVorlage([n, stufe, titel]: [number, string, string]): string {
  return `{"key":"uebung","nummer":${n},"stufe":"${stufe}","title":"${titel}","intro":"1-2 Sätze, warum diese Übung jetzt dran ist","vorbereitung":"1-2 Sätze: was du brauchst und wo","aufbau":["5-7 konkrete Schritte, jeder einzeln ausführbar, mit Handbewegung und Zeitangabe"],"wenn_nicht":"2-3 Sätze: was tun, wenn er nicht reagiert — sanft eine Stufe zurück","wiederholung":"konkret: wie viele Wiederholungen je Einheit, wie oft am Tag, über wie viele Tage","erfolg":"1 Satz: woran du merkst, dass es sitzt","fehler":"1 Satz: der häufigste Fehler dabei"}`;
}

const LEITLINIEN = `LEITLINIEN:
- Jede Übung ist ein echtes Schritt-für-Schritt-Tutorial. Der Leser soll sie heute Nachmittag machen können, ohne Vorwissen.
- Immer konkret hinführen: wo steht man, was macht die Hand, was sagt man, wann belohnt man.
- Realistische Erwartung: nicht beim ersten Mal, konkrete Zahlen über Tage.
- Kein Zwang, kein Schimpfen, kein Ruck an der Leine. Mit einem Erfolg aufhören.
- Herbst ausdrücklich mitdenken: Laub, Fallobst, feuchtes Gebüsch, früh dunkel.
- Schreibweise: echte Umlaute und ß, niemals ae/oe/ue/ss als Ersatz.`;

// Das Handbuch entsteht in zwei Haelften, die PARALLEL laufen.
//
// Warum: in einem Rutsch brauchte Opus fuer die 20 Uebungen rund vier bis fuenf
// Minuten. Die Auslieferungs-Route haengt am Kauf und hat 300 Sekunden — das war
// zu knapp. Zwei halb so lange Antworten gleichzeitig halbieren die Wartezeit und
// senken nebenbei das Risiko, dass die Antwort mitten im JSON abgeschnitten wird.
// Beide Haelften bekommen die vollstaendige Uebungsliste als Kontext, damit der
// 14-Tage-Plan in Teil 2 die richtigen Nummern nennt.
function buildUserPrompt(teil: 1 | 2, dog: string, breed: string, age: string, problem: string): string {
  const alle = UEBUNGEN.map(([n, , titel]) => `${n}. ${titel}`).join("; ");
  const kopf = `Erstelle ein sehr ausführliches Praxis-Handbuch "Nichts vom Boden — Anti-Giftköder-Training" für ${dog} (${breed}, ${age}). Bekanntes Thema im Alltag: ${problem}.

Das ganze Handbuch hat 20 Übungen in vier Stufen: ${alle}.
Du schreibst jetzt NUR Teil ${teil} von 2.

${LEITLINIEN}
- ${dog} immer beim Namen nennen.

Gib NUR JSON, jeder Wert eine Zeile:`;

  if (teil === 1) {
    const liste = UEBUNGEN.slice(0, 10).map(uebungsVorlage).join(",\n ");
    return `${kopf}
{"dogName":"${dog}","subtitle":"...","sections":[
 {"key":"warum","title":"Warum Hunde alles aufnehmen","body":"4-5 Sätze, erklärt ohne Schuldzuweisung"},
 {"key":"sicherheit","title":"Zuerst: die Sicherheitsregeln","body":"2-3 Sätze","points":["5 klare Regeln für unterwegs"]},
 {"key":"methode","title":"So lernt ${dog} — dein Werkzeugkasten","body":"2-3 Sätze","bausteine":[{"name":"Tauschen statt wegnehmen","text":"..."},{"name":"Das Ja-Wort (Markern)","text":"..."},{"name":"Die Schleppleine","text":"..."},{"name":"Kleine Schritte","text":"..."},{"name":"Timing","text":"..."},{"name":"Mit Erfolg aufhören","text":"..."}]},
 ${liste}
]}`;
  }

  const liste = UEBUNGEN.slice(10).map(uebungsVorlage).join(",\n ");
  return `${kopf}
{"sections":[
 ${liste},
 {"key":"notfall","title":"Notfall: Verdacht auf Giftköder","body":"3-4 Sätze. Sag ausdrücklich, dass dieses Training vorbeugt und keinen Tierarzt ersetzt.","anzeichen":["6 konkrete Anzeichen einer Vergiftung"],"schritte":["5 Schritte in der richtigen Reihenfolge, Tierarzt zuerst"]},
 {"key":"plan","title":"Dein 14-Tage-Startplan","days":[{"tag":"Tag 1-2","fokus":"...","uebungen":"Nummern"},{"tag":"Tag 3-4","fokus":"...","uebungen":"..."},{"tag":"Tag 5-7","fokus":"...","uebungen":"..."},{"tag":"Tag 8-10","fokus":"...","uebungen":"..."},{"tag":"Tag 11-14","fokus":"...","uebungen":"..."}],"check":["5 Ja/Nein-Checks am Ende"]},
 {"key":"wenn","title":"Was tun, wenn…","cases":[{"fall":"${dog} frisst schneller als du reagieren kannst","tun":"..."},{"fall":"Drinnen klappt es, draußen nicht","tun":"..."},{"fall":"Er hört nur, wenn Futter sichtbar ist","tun":"..."},{"fall":"Rückschritt nach guter Woche","tun":"..."},{"fall":"Er knurrt, wenn du an sein Maul willst","tun":"..."}]}
]}`;
}

function parseAntwort(text: string): any {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("kein JSON in der Antwort");
  let raw = text.slice(s, e + 1).replace(/[\r\n\t]+/g, " ");
  // Gleiche Reparatur wie bei den Grundkommandos: Streu-"]" nach Textfeldern.
  raw = raw.replace(
    /("(?:wenn_nicht|wiederholung|erfolg|fehler|intro|vorbereitung|tun|body|text|subtitle|title|fokus|uebungen)"\s*:\s*"[^"]*")\s*\]/g,
    "$1"
  );
  try {
    return JSON.parse(raw);
  } catch (err: any) {
    // Die Stelle mit ins Log: fast immer ein gerades Anfuehrungszeichen mitten
    // im Text. Ohne den Ausschnitt sucht man im naechsten Fall wieder blind.
    const pos = Number(String(err?.message || "").match(/position (\d+)/)?.[1] || 0);
    console.error(
      "[giftkoeder-content] JSON kaputt:",
      err?.message,
      "…" + raw.slice(Math.max(0, pos - 90), pos + 90) + "…"
    );
    throw err;
  }
}

export async function generateGiftkoederContent(input: {
  dogName?: string | null;
  breed?: string | null;
  age?: string | null;
  problem?: string | null;
}): Promise<GiftkoederContent> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt");

  const dog = (input.dogName || "dein Hund").trim() || "dein Hund";
  const breed = (input.breed || "Mischling").trim() || "Mischling";
  const age = (input.age || "erwachsen").trim() || "erwachsen";
  const problem = (input.problem || "nimmt Sachen vom Boden auf").trim();

  const anthropic = new Anthropic({ apiKey });
  // Ein zweiter Versuch je Haelfte: wenn das Modell einmal ein Zeichen setzt,
  // das das JSON zerlegt, haengt sonst die ganze Auslieferung eines Kaufs daran.
  // Der zweite Anlauf wuerfelt neu und geht erfahrungsgemaess durch.
  const haelfte = async (teil: 1 | 2) => {
    let letzterFehler: any = null;
    for (let versuch = 1; versuch <= 2; versuch++) {
      try {
        const stream = anthropic.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 20000,
          system: SYS,
          messages: [{ role: "user", content: buildUserPrompt(teil, dog, breed, age, problem) }],
        });
        const msg = await stream.finalMessage();
        return parseAntwort(msg.content.map((b: any) => (b.type === "text" ? b.text : "")).join(""));
      } catch (e: any) {
        letzterFehler = e;
        console.warn(`[giftkoeder-content] Teil ${teil}, Versuch ${versuch} fehlgeschlagen:`, e?.message);
      }
    }
    throw letzterFehler;
  };

  const [eins, zwei] = await Promise.all([haelfte(1), haelfte(2)]);

  const sections = [...(eins?.sections || []), ...(zwei?.sections || [])];
  if (!sections.length) throw new Error("Opus lieferte keine Sektionen");
  const anzahl = sections.filter((x: any) => x?.key === "uebung").length;
  if (anzahl < 15) throw new Error(`nur ${anzahl} Uebungen statt 20`);

  return {
    dogName: eins?.dogName || dog,
    subtitle: eins?.subtitle || "Vom Küchentisch bis zum Laubhaufen — Schritt für Schritt",
    sections,
  };
}
