// lib/silvester-content.ts
//
// Erzeugt den personalisierten "Silvester-Plan" (Knallangst-Training + Plan für
// die Silvesternacht). Aufbau wie lib/giftkoeder-content.ts: Opus liefert JSON in
// zwei parallelen Hälften, lib/silvester-pdf setzt daraus das PDF.
//
// PERSONALISIERUNG:
//   - Fragebogen (Rasse, Alter, Geschlecht, Hauptproblem) aus wauwerk_leads
//   - drei Angaben von der Landingpage: Angst-Stärke, Wohnlage, an Silvester zu Hause
//   - Kaufdatum: die Zahl der Trainingswochen ergibt sich aus der Zeit bis Silvester.
//     Wer Anfang November kauft, bekommt sechs Wochen, wer am 27.12. kauft, ein
//     Kurzprogramm mit Schwerpunkt auf der Nacht selbst. Die Wochen-Gerüste und
//     Datumsangaben setzt der Code, Opus füllt nur die Inhalte.
//
// WICHTIG, inhaltlich: Starke Geräuschangst ist auch ein Tiergesundheits-Thema.
// Der Plan nennt Medikamente nur als „mit der Tierärztin besprechen“, nie mit
// Wirkstoff oder Dosis, und verweist bei starker Angst früh auf die Praxis.

import Anthropic from "@anthropic-ai/sdk";

export type AngstStufe = "leicht" | "mittel" | "stark" | "unbekannt";

export interface SilvesterWoche {
  label: string;      // "Woche 1"
  zeitraum: string;   // "05.11. – 11.11." oder ""
  phase: string;      // festes Gerüst, z. B. "Sicherer Ort und Entspannung"
}

export interface SilvesterContent {
  dogName: string;
  subtitle: string;
  wochen: SilvesterWoche[];
  tageBisSilvester: number;
  sections: any[];
}

// Die 12 Übungen als festes Gerüst. Opus füllt sie aus, erfindet sie nicht.
const UEBUNGEN: Array<[number, string, string]> = [
  [1,  "Stufe 1 — Sicherheit und Ruhe", "Der sichere Rückzugsort: eine Höhle, die er selbst wählt"],
  [2,  "Stufe 1 — Sicherheit und Ruhe", "Das Entspannungssignal: ein Wort, das Ruhe bedeutet"],
  [3,  "Stufe 1 — Sicherheit und Ruhe", "Kauen und Schlecken als eingebaute Beruhigung"],
  [4,  "Stufe 1 — Sicherheit und Ruhe", "Nähe richtig anbieten, ohne die Angst zu bestärken"],
  [5,  "Stufe 2 — Geräusche gewöhnen", "Knallgeräusche auf der leisesten Stufe"],
  [6,  "Stufe 2 — Geräusche gewöhnen", "Knall heißt Futter: die Gegenkonditionierung"],
  [7,  "Stufe 2 — Geräusche gewöhnen", "Lauter in kleinen Schritten, mit klarer Stopp-Regel"],
  [8,  "Stufe 2 — Geräusche gewöhnen", "Andere Räume, Lichtblitze und überraschende Momente"],
  [9,  "Stufe 3 — Bereit für Silvester", "Die Gassi-Routine für Dezember: doppelt gesichert"],
  [10, "Stufe 3 — Bereit für Silvester", "Wenn draußen ein Böller knallt: der Notfall-Rückzug"],
  [11, "Stufe 3 — Bereit für Silvester", "Such- und Kauspiele für den Silvesterabend"],
  [12, "Stufe 3 — Bereit für Silvester", "Die Generalprobe: ein Abend wie Silvester"],
];

// Phasen für bis zu sechs Wochen. Bei weniger Zeit werden sie zusammengelegt —
// die letzte Phase (Silvesterwoche) bleibt immer erhalten.
const PHASEN_6 = [
  "Sicherer Ort und Entspannung (Übungen 1-4)",
  "Geräusche ganz leise, Knall heißt Futter (Übungen 5-6)",
  "Lauter und in anderen Räumen (Übungen 7-8)",
  "Draußen und Gassi-Routine (Übungen 9-10)",
  "Generalprobe und Spiele für den Abend (Übungen 11-12)",
  "Silvesterwoche: nichts Neues, Routine und Vorbereitung",
];
const PHASEN_NACH_ANZAHL: Record<number, string[]> = {
  6: PHASEN_6,
  5: [PHASEN_6[0], PHASEN_6[1], "Lauter, andere Räume, draußen (Übungen 7-10)", PHASEN_6[4], PHASEN_6[5]],
  4: ["Sicherer Ort, Entspannung, erste leise Geräusche (Übungen 1-6)", "Lauter, andere Räume, draußen (Übungen 7-10)", PHASEN_6[4], PHASEN_6[5]],
  3: ["Sicherer Ort, Entspannung, leise Geräusche (Übungen 1-6)", "Lauter, Gassi-Routine, Generalprobe (Übungen 7-12)", PHASEN_6[5]],
  2: ["Kurzprogramm: Rückzugsort, Entspannung, Kauen, leise Geräusche (Übungen 1-3, 5-6)", "Silvesterwoche: Gassi-Routine, Spiele, Vorbereitung (Übungen 9-11)"],
  1: ["Notprogramm für die letzten Tage: Rückzugsort, Kauen, Gassi-Routine, Spiele (Übungen 1, 3, 9, 11)"],
};

function datum(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

// Teilt die Zeit von morgen bis zum 30.12. in gleich lange Trainingswochen.
// Nach Silvester (Januar) gibt es keinen Termin: dann sechs Wochen ohne Datum,
// der Plan läuft als allgemeines Knallangst-Training für das nächste Jahr.
export function silvesterWochen(jetzt = new Date()): { wochen: SilvesterWoche[]; tageBis: number } {
  const heute = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  const silvester = new Date(heute.getFullYear(), 11, 31);
  const tageBis = Math.round((silvester.getTime() - heute.getTime()) / 86400000);

  if (heute.getMonth() < 9 || tageBis < 0) {
    // Januar bis September: kein sinnvoller Countdown
    return {
      tageBis: -1,
      wochen: PHASEN_6.map((phase, i) => ({ label: `Woche ${i + 1}`, zeitraum: "", phase })),
    };
  }

  const anzahl = Math.max(1, Math.min(6, Math.floor(tageBis / 7)));
  const phasen = PHASEN_NACH_ANZAHL[anzahl];
  const start = new Date(heute.getTime() + 86400000);
  const ende = new Date(heute.getFullYear(), 11, 30);
  const spanne = Math.max(1, Math.round((ende.getTime() - start.getTime()) / 86400000) + 1);
  const proWoche = spanne / anzahl;

  const wochen = phasen.map((phase, i) => {
    const von = new Date(start.getTime() + Math.round(i * proWoche) * 86400000);
    const bis = i === anzahl - 1 ? ende : new Date(start.getTime() + (Math.round((i + 1) * proWoche) - 1) * 86400000);
    return { label: anzahl === 1 ? "Deine letzten Tage" : `Woche ${i + 1}`, zeitraum: `${datum(von)} – ${datum(bis)}`, phase };
  });
  return { wochen, tageBis };
}

const ANGST_TEXT: Record<AngstStufe, string> = {
  leicht: "leicht ängstlich: zuckt zusammen, ist unruhig, beruhigt sich aber wieder",
  mittel: "deutlich ängstlich: zittert, hechelt, versteckt sich, frisst an Silvester kaum",
  stark: "stark ängstlich bis panisch: will fliehen, ist kaum ansprechbar, braucht lange, um sich zu erholen",
  unbekannt: "noch unbekannt: erstes Silvester bei dir oder du weißt nicht, wie er reagiert",
};
const LAGE_TEXT: Record<string, string> = {
  stadt: "Stadt, viel Feuerwerk in der Nähe, oft schon Tage vorher",
  vorort: "Vorort oder Kleinstadt, Feuerwerk vor allem um Mitternacht",
  land: "ländlich, eher wenig Feuerwerk, aber einzelne laute Böller",
};
const ZUHAUSE_TEXT: Record<string, string> = {
  ja: "Der Halter ist an Silvester zu Hause und kann bei ihm sein",
  nein: "Der Halter ist an Silvester unterwegs, jemand anderes betreut den Hund oder er bleibt kurz allein",
  unsicher: "Noch unklar, ob der Halter an Silvester zu Hause ist",
};

// dog_problem kommt als Schlüssel aus dem Fragebogen
const PROBLEM_TEXT: Record<string, string> = {
  pulling: "zieht an der Leine",
  barking: "bellt viel",
  aggression: "reagiert aggressiv auf andere Hunde oder Menschen",
  anxiety: "ist ängstlich oder kann schlecht allein bleiben",
  jumping: "springt Menschen an",
  recall: "kommt nicht zuverlässig zurück",
  energy: "hat sehr viel Energie und kommt schwer zur Ruhe",
  destructive: "macht Dinge kaputt",
  soiling: "ist noch nicht ganz stubenrein",
  mouthing: "nimmt alles ins Maul",
};

const SYS =
  "Du bist Ben, ein ruhiger, erfahrener Hundetrainer. Warme, gesprochene DU-Sprache, sehr konkret und praktisch, für Laien. Viele Leserinnen sind über 50 — kurze Sätze, kein Fachjargon, kein Markdown. KEINE echten Zeilenumbrüche in JSON-Strings. Gültiges JSON. Antworte NUR mit JSON. SCHREIBWEISE: Rechtschreibung mit echten Umlauten und ß (ä, ö, ü, Ä, Ö, Ü, ß). Schreib niemals ae, oe, ue oder ss als Ersatz. ANFÜHRUNGSZEICHEN: innerhalb der Texte niemals ein gerades \" verwenden, sondern immer die deutschen Zeichen „ und “ — ein gerades Anführungszeichen zerstört das JSON. Auch keine Backslashes. Keine Gedankenstriche als Satzzeichen, lieber zwei Sätze.";

function uebungsVorlage([n, stufe, titel]: [number, string, string]): string {
  return `{"key":"uebung","nummer":${n},"stufe":"${stufe}","title":"${titel}","intro":"1-2 Sätze, warum genau diese Übung für ihn wichtig ist","vorbereitung":"1-2 Sätze: was du brauchst und wo","aufbau":["5-7 konkrete Schritte, jeder einzeln ausführbar, mit Zeit- oder Lautstärkeangabe"],"wenn_nicht":"2-3 Sätze: woran du merkst, dass es zu viel ist, und wie du eine Stufe zurückgehst","wiederholung":"konkret: wie lange je Einheit, wie oft am Tag, über wie viele Tage","erfolg":"1 Satz: woran du merkst, dass es sitzt","fehler":"1 Satz: der häufigste Fehler dabei"}`;
}

const LEITLINIEN = `LEITLINIEN:
- Jede Übung ist ein echtes Schritt-für-Schritt-Tutorial, heute Abend machbar, ohne Vorwissen.
- Geräusch-Training immer unterhalb der Angstschwelle: lieber zu leise als zu laut. Klare Stopp-Regel nennen (Hecheln, Ohren zurück, Fressen verweigert = sofort leiser, Pause).
- Keine Konfrontation, kein „da muss er durch“, kein Schimpfen. Trösten ist erlaubt und verstärkt die Angst nicht, ruhige Nähe hilft.
- Medikamente, Pheromone oder Nahrungsergänzung nur als „frag deine Tierärztin“, nie mit Wirkstoff, Produktname oder Dosis.
- Sicherheit zuerst: Panikflucht ist das größte Risiko an Silvester (Geschirr plus Halsband, doppelt gesichert, Leine auch im Garten, Adresse am Halsband, Chip registriert).
- Schreibweise: echte Umlaute und ß, niemals ae/oe/ue/ss als Ersatz.`;

// Bereinigte Angaben, wie sie in den Prompt gehen
interface Profil {
  dogName: string;
  breed: string;
  age: string;
  gender: string;
  problem: string;
  angst: AngstStufe;
  lage: string;
  zuhause: string;
}

function steckbrief(p: Profil): string {
  return `STECKBRIEF:
- Hund: ${p.dogName}, ${p.breed}, ${p.age}${p.gender ? ", " + p.gender : ""}
- Angst bei Knall und Feuerwerk: ${ANGST_TEXT[p.angst]}
- Wohnlage: ${LAGE_TEXT[p.lage] || "unbekannt"}
- Silvesterabend: ${ZUHAUSE_TEXT[p.zuhause] || ZUHAUSE_TEXT.unsicher}
- Hauptthema aus dem Fragebogen: ${PROBLEM_TEXT[p.problem] || p.problem}`;
}

function buildUserPrompt(teil: 1 | 2, p: Profil, wochen: SilvesterWoche[], tageBis: number): string {
  const alle = UEBUNGEN.map(([n, , titel]) => `${n}. ${titel}`).join("; ");
  const zeit =
    tageBis < 0
      ? "Bis Silvester ist noch viel Zeit. Der Plan ist ein allgemeines Knallangst-Training, das man rechtzeitig vor Silvester startet."
      : `Heute sind es noch ${tageBis} Tage bis Silvester. Der Plan hat ${wochen.length} ${wochen.length === 1 ? "Abschnitt" : "Wochen"}.${tageBis < 14 ? " Die Zeit ist knapp: Gewöhnung schafft er nicht mehr vollständig, Schwerpunkt ist Management und die Nacht selbst. Sag das ehrlich, ohne Panik zu machen." : ""}`;
  const kopf = `Erstelle einen sehr persönlichen „Silvester-Plan“ für ${p.dogName}: Training gegen Knallangst plus ein genauer Plan für die Silvesternacht.

${steckbrief(p)}

${zeit}

Der Plan hat 12 Übungen in drei Stufen: ${alle}.
Du schreibst jetzt NUR Teil ${teil} von 2.

${LEITLINIEN}
- ${p.dogName} immer beim Namen nennen. Rasse, Alter, Angst-Stärke, Wohnlage und Silvesterabend spürbar einbeziehen, nicht nur erwähnen.

Gib NUR JSON, jeder Wert eine Zeile:`;

  if (teil === 1) {
    const wochenVorlage = wochen
      .map((w) => `{"label":"${w.label}","phase":"${w.phase}","ziel":"1 Satz: was am Ende dieses Abschnitts klappt","taeglich":["3 konkrete Tagesaufgaben mit Minutenangabe"],"check":"1 Satz: woran du merkst, dass ihr weitergehen könnt"}`)
      .join(",\n  ");
    const liste = UEBUNGEN.slice(0, 6).map(uebungsVorlage).join(",\n ");
    return `${kopf}
{"dogName":"${p.dogName}","subtitle":"1 Satz, persönlich, ohne den Produktnamen","sections":[
 {"key":"einschaetzung","title":"So schätze ich ${p.dogName} ein","body":"5-6 Sätze, persönlich: was seine Angst-Stärke, Rasse, Alter und Wohnlage für Silvester bedeuten und was realistisch erreichbar ist","staerken":["3 Dinge, die für ihn sprechen"],"achtung":["3 Punkte, auf die du bei ihm besonders achten musst"]},
 {"key":"warum","title":"Warum Hunde vor Feuerwerk Angst haben","body":"4-5 Sätze, ohne Schuldzuweisung, mit dem Gehör des Hundes"},
 {"key":"sicherheit","title":"Zuerst: die Sicherheitsregeln für Dezember","body":"2-3 Sätze","points":["6 klare Regeln gegen Panikflucht und Unfälle"]},
 {"key":"wochenplan","title":"Dein Wochenplan bis Silvester","wochen":[
  ${wochenVorlage}
 ]},
 ${liste}
]}`;
  }

  const liste = UEBUNGEN.slice(6).map(uebungsVorlage).join(",\n ");
  return `${kopf}
{"sections":[
 ${liste},
 {"key":"nacht","title":"Der Plan für die Silvesternacht","body":"2-3 Sätze, persönlich auf seinen Abend zugeschnitten","ablauf":[{"zeit":"30.12.","tun":"..."},{"zeit":"31.12. morgens","tun":"..."},{"zeit":"31.12. nachmittags","tun":"..."},{"zeit":"Ab 18 Uhr","tun":"..."},{"zeit":"23 bis 1 Uhr","tun":"..."},{"zeit":"1.1. morgens","tun":"..."}],"packliste":["6 Dinge, die du bis zum 30.12. bereitlegst"]},
 {"key":"tierarzt","title":"Wann du mit der Tierärztin sprechen solltest","body":"3-4 Sätze, angepasst an seine Angst-Stärke. Sag, dass der Termin rechtzeitig vor Silvester sein muss, weil manche Mittel Vorlauf brauchen. Keine Wirkstoffe, keine Produktnamen.","fragen":["4 Fragen, die du in der Praxis stellen kannst"],"anzeichen":["4 Anzeichen, bei denen du nicht abwartest"]},
 {"key":"wenn","title":"Was tun, wenn…","cases":[{"fall":"${p.dogName} frisst beim Geräusch-Training nicht mehr","tun":"..."},{"fall":"Schon Tage vor Silvester knallt es draußen","tun":"..."},{"fall":"Er zittert und will nur unter das Bett","tun":"..."},{"fall":"Er muss raus, aber draußen knallt es","tun":"..."},{"fall":"Nach Silvester ist er noch tagelang schreckhaft","tun":"..."}]},
 {"key":"checkliste","title":"Deine Checkliste für den 31.12.","punkte":["8 kurze Haken-Punkte"]}
]}`;
}

function parseAntwort(text: string): any {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("kein JSON in der Antwort");
  let raw = text.slice(s, e + 1).replace(/[\r\n\t]+/g, " ");
  // Im Test einmal gesehen: ein leerer Streu-String zwischen zwei Feldern
  // ({"body":"…"," ","staerken":[…]}). Er zerlegt das JSON und hat nie Inhalt.
  raw = raw.replace(/,\s*"\s*"\s*,/g, ",");
  raw = raw.replace(
    /("(?:wenn_nicht|wiederholung|erfolg|fehler|intro|vorbereitung|tun|body|subtitle|title|ziel|check|zeit)"\s*:\s*"[^"]*")\s*\]/g,
    "$1"
  );
  try {
    return JSON.parse(raw);
  } catch (err: any) {
    const pos = Number(String(err?.message || "").match(/position (\d+)/)?.[1] || 0);
    console.error(
      "[silvester-content] JSON kaputt:",
      err?.message,
      "…" + raw.slice(Math.max(0, pos - 90), pos + 90) + "…"
    );
    throw err;
  }
}

export interface SilvesterInput {
  dogName?: string | null;
  breed?: string | null;
  age?: string | null;
  gender?: string | null;
  problem?: string | null;
  angst?: AngstStufe | string | null;
  lage?: string | null;
  zuhause?: string | null;
}

export async function generateSilvesterContent(input: SilvesterInput, jetzt = new Date()): Promise<SilvesterContent> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt");

  const angstRoh = String(input.angst || "").trim() as AngstStufe;
  const p: Profil = {
    dogName: (input.dogName || "dein Hund").trim() || "dein Hund",
    breed: (input.breed || "Mischling").trim() || "Mischling",
    age: (input.age || "erwachsen").trim() || "erwachsen",
    gender: (input.gender || "").trim(),
    problem: (input.problem || "keine Angabe").trim() || "keine Angabe",
    angst: ANGST_TEXT[angstRoh] ? angstRoh : "unbekannt",
    lage: LAGE_TEXT[String(input.lage || "")] ? String(input.lage) : "",
    zuhause: ZUHAUSE_TEXT[String(input.zuhause || "")] ? String(input.zuhause) : "unsicher",
  };
  const { wochen, tageBis } = silvesterWochen(jetzt);

  const anthropic = new Anthropic({ apiKey });
  // Zweiter Versuch je Hälfte, wie bei Nichts vom Boden: ein kaputtes Zeichen
  // im JSON soll nicht die Auslieferung eines Kaufs kippen.
  const haelfte = async (teil: 1 | 2) => {
    let letzterFehler: any = null;
    for (let versuch = 1; versuch <= 2; versuch++) {
      try {
        const stream = anthropic.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 20000,
          system: SYS,
          messages: [{ role: "user", content: buildUserPrompt(teil, p, wochen, tageBis) }],
        });
        const msg = await stream.finalMessage();
        return parseAntwort(msg.content.map((b: any) => (b.type === "text" ? b.text : "")).join(""));
      } catch (e: any) {
        letzterFehler = e;
        console.warn(`[silvester-content] Teil ${teil}, Versuch ${versuch} fehlgeschlagen:`, e?.message);
      }
    }
    throw letzterFehler;
  };

  const [eins, zwei] = await Promise.all([haelfte(1), haelfte(2)]);

  const sections = [...(eins?.sections || []), ...(zwei?.sections || [])];
  if (!sections.length) throw new Error("Opus lieferte keine Sektionen");
  const anzahl = sections.filter((x: any) => x?.key === "uebung").length;
  if (anzahl < 9) throw new Error(`nur ${anzahl} Uebungen statt 12`);

  // Datumsangaben kommen aus dem Code, nicht aus dem Modell.
  const wp = sections.find((x: any) => x?.key === "wochenplan");
  if (wp && Array.isArray(wp.wochen)) {
    wp.wochen = wp.wochen.slice(0, wochen.length).map((w: any, i: number) => ({
      ...w,
      label: wochen[i].label,
      zeitraum: wochen[i].zeitraum,
      phase: wochen[i].phase,
    }));
  }

  return {
    dogName: eins?.dogName || p.dogName,
    subtitle: eins?.subtitle || "Schritt für Schritt zu einem ruhigeren Jahreswechsel",
    wochen,
    tageBisSilvester: tageBis,
    sections,
  };
}
