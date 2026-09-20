// Prompt + Parsing fuer das Produkt "Charakterprofil".
// Bewusst getrennt von der Route, damit sich der Inhalt ohne laufenden
// Next-Server testen laesst (siehe scratchpad/cp-content-test.mts).

import type { CharakterprofilContent, Uebung } from "@/lib/charakterprofil-pdf";

export const THEMEN: Record<string, string> = {
  recall: "Rückruf", pulling: "Leinenführigkeit", barking: "Bellen",
  aggression: "Hundebegegnungen", anxiety: "Unsicherheit und Angst",
  separation: "Alleinbleiben", mouthing: "Zwicken und Beißhemmung",
  destructive: "Zerstören in der Wohnung", jumping: "Anspringen",
  energy: "Unruhe", obedience: "Grundgehorsam", behavior: "Verhalten allgemein",
  potty: "Stubenreinheit",
};

const UEBUNG_SCHEMA = `{
    "titel": "Name der Übung, konkret und merkbar",
    "ziel": "1 Satz: was die Übung bewirkt",
    "dauer": "z.B. '10 Minuten, täglich über 7 Tage'",
    "schritte": ["4 bis 6 Schritte, jeder EINE Handlung, die der Halter heute umsetzen kann, ohne Vorwissen"],
    "achten": "1 bis 2 Sätze: woran der Halter merkt, dass es richtig läuft",
    "wennNicht": "1 bis 2 Sätze: was er ändert, wenn es nicht klappt (leichtere Stufe, nicht wiederholen)"
  }`;

export const SCHEMA = `{
  "kurzgesagt": "3-4 Sätze: DIESER Hund in kurz. Rasse + Alter + das vom Halter genannte Thema zusammengeführt. Beginne konkret, nicht mit einer Floskel.",
  "herkunft": "Absatz (4-6 Sätze): wofür die Rasse gezüchtet wurde und was davon heute im Wohnzimmer ankommt. Bei Mischling: die genannten Anteile.",
  "steckbrief": [{"feld":"Herkunft / Ursprüngliche Aufgabe / Energielevel / Arbeitet über / Größe und Gewicht / Typische Stärke / Typische Schwäche","wert":"konkret, max 12 Wörter"} (genau 7)],
  "charakterText": "3-4 Sätze: wie dieser Hund tickt, verknüpft mit dem genannten Verhalten.",
  "achsen": [{"label":"Energielevel / Futtermotivation / Selbstständigkeit / Reizoffenheit / Ruhefähigkeit","wert":1-5,"notiz":"1 Satz, was der Wert für den Alltag heißt"} (genau 5, in dieser Reihenfolge)],
  "mischAnteile": [{"rasse":"eine der genannten Rassen","zeigtSich":"woran der Halter genau diesen Anteil erkennt"}] (nur wenn Mischrassen angegeben sind, sonst null),
  "tagText": "3-4 Sätze: welcher Tagesrhythmus zu diesem Hund passt und warum die Reihenfolge Reiz/Ruhe zählt.",
  "tagesplan": [{"zeit":"Morgens / Vormittags / Mittags / Nachmittags / Abends / Vor dem Schlafen","dauer":"z.B. '30 bis 40 Min'","was":"was in diesem Block passiert, rassegerecht"} (genau 6)],
  "bewegung": {"text":"4-6 Sätze: wie viel Bewegung diese Rasse WIRKLICH braucht und welche Art. Nenne auch, was zu viel ist.","faustregel":"1-2 Sätze mit konkreten Zahlen","uebung": ${UEBUNG_SCHEMA}},
  "schlaf": {"text":"4-6 Sätze: warum Schlaf bei diesem Hund Trainingsarbeit ist.","stunden":"konkrete Stundenangabe + Einordnung","anzeichen":["4 beobachtbare Anzeichen von Übermüdung"],"uebung": ${UEBUNG_SCHEMA}},
  "kopfarbeit": {"text":"3-5 Sätze: welche Art Kopfarbeit zu DIESER Rasse passt und warum.","uebung": ${UEBUNG_SCHEMA},"weitere":[{"name":"kurzer Name","anleitung":"1-2 Sätze Anleitung"} (genau 2)]},
  "thema": {"titel":"Euer Thema: <das vom Halter genannte Thema in Alltagssprache>","text":"4-6 Sätze: warum genau dieses Thema bei dieser Rasse entsteht. Kein Vorwurf.","uebung": ${UEBUNG_SCHEMA}},
  "baustellen": [{"thema":"kurz","warum":"2 Sätze, rasse-fundiert","sofort":"1-2 Sätze: was der Halter ab heute anders macht"} (genau 4)],
  "donts": [{"dont":"kurz","warum":"1-2 Sätze","stattdessen":"1-2 Sätze Alternative"} (genau 3)],
  "koerpersprache": [{"signal":"beobachtbares Signal","bedeutung":"was es heißt + was der Halter tut"} (genau 5)],
  "wochenplan": [{"tag":"Montag bis Sonntag","aufgabe":"EINE Mini-Aufgabe aus diesem Profil","dauer":"z.B. '10 Min'"} (genau 7, Sonntag ist bewusst ein Ruhetag)],
  "selfCheck": ["genau 5 kurze, beobachtbare Aussagen zum Ankreuzen"],
  "selfCheckResult": "4-5 Sätze: Auflösung. Benenne die wahrscheinlichste Baustelle und sag, mit WELCHER Übung aus diesem Profil er anfangen soll.",
  "closing": "3-4 warme, ehrliche Sätze zum Abschluss. Kein Verkaufston."
}`;

export interface ProfilDaten {
  dogName: string;
  breed: string;            // Anzeige-Rasse ("Mischling" wenn unbekannt)
  mischRassen: string[];
  istMisch: boolean;
  age?: string;
  gender?: string;
  problem?: string;
  behaviors?: string[];
  goal?: string;
}

export function systemPrompt(d: ProfilDaten): string {
  return `Du bist der Pfoten-Plan Rasse-Experte und schreibst das Produkt "Charakterprofil" fuer ${d.dogName}.

WORUM ES GEHT: Der Halter hat bereits einen Trainingsplan. Dieses Profil erklaert die RASSE und was sie im Alltag bedeutet. Verhalten ist ein Unterpunkt, nicht das Hauptthema.

HARTE REGELN:
- Jeder Abschnitt endet in etwas, das der Halter TUN kann. Reine Beschreibung ohne Handlung ist ein Fehler.
- Die vier Uebungen sind der Kern des Produkts. Jeder Schritt ist EINE konkrete Handlung mit Ort, Dauer und Material. Kein "arbeite an der Bindung", sondern "wirf zwei Leckerli auf die Decke und geh weg".
- Zahlen statt Gefuehl: Minuten, Stunden, Wiederholungen, Entfernungen. Erfinde keine Studien, aber sei konkret.
- Rasse-fundiert: beziehe dich auf Zuchtzweck und Herkunft und uebersetze das in Alltag. Keine Floskeln wie "treu und verspielt".
- Ehrlich: Rasse ist eine Tendenz, kein Schicksal. Wenn etwas unsicher ist, sag es.
- Du-Ansprache, warm, direkt, Zielgruppe ist ueber 50. Deutsch. Keine Markdown-Sterne, keine Emojis, keine langen Gedankenstriche.
${d.istMisch && d.mischRassen.length ? `- MISCHLING: Der Halter hat ${d.mischRassen.join(", ")} angegeben. Zeig pro Anteil, woran man ihn erkennt, und fuelle "mischAnteile".` : ""}
${d.istMisch && !d.mischRassen.length ? `- MISCHLING OHNE RASSEANGABE: Arbeite ueber Groesse, Alter und das beschriebene Verhalten. Setze "mischAnteile" auf null und sag ehrlich, was sich ohne Rasse nicht sicher sagen laesst.` : ""}
${!d.istMisch ? `- Rasse ist bekannt: ${d.breed}. Setze "mischAnteile" auf null.` : ""}

Gib AUSSCHLIESSLICH gueltiges JSON in genau dieser Struktur zurueck (Beschreibungen ersetzen):
${SCHEMA}`;
}

export function datenBlock(d: ProfilDaten): string {
  const thema = d.problem ? THEMEN[d.problem] || d.problem : "";
  return [
    `Name: ${d.dogName}`,
    `Rasse: ${d.mischRassen.length ? `Mischling (${d.mischRassen.join(", ")})` : d.breed}`,
    `Alter: ${d.age || "erwachsen"}`,
    d.gender ? `Geschlecht: ${d.gender === "female" ? "Hündin" : "Rüde"}` : null,
    thema ? `Trainingsthema aus dem Fragebogen: ${thema}` : null,
    d.behaviors?.length ? `Beobachtetes Verhalten: ${d.behaviors.map((b) => THEMEN[b] || b).join(", ")}` : null,
    d.goal ? `Ziel des Halters: ${d.goal}` : null,
  ].filter(Boolean).join("\n");
}

const str = (v: any, max = 600) => String(v == null ? "" : v).slice(0, max);
const uebungAus = (o: any): Uebung => ({
  titel: str(o?.titel, 90),
  ziel: str(o?.ziel, 220),
  dauer: str(o?.dauer, 60),
  schritte: Array.isArray(o?.schritte) ? o.schritte.slice(0, 6).map((s: any) => str(s, 240)) : [],
  achten: str(o?.achten, 300),
  wennNicht: str(o?.wennNicht, 300),
});

/** Robustes Parsen der KI-Antwort. Wirft, wenn kein JSON drin steckt. */
export function parseContent(raw: string): CharakterprofilContent {
  const p = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  return {
    kurzgesagt: str(p.kurzgesagt, 800),
    herkunft: str(p.herkunft, 1200),
    steckbrief: Array.isArray(p.steckbrief) ? p.steckbrief.slice(0, 7).map((r: any) => ({ feld: str(r.feld, 40), wert: str(r.wert, 120) })) : [],
    charakterText: str(p.charakterText, 900),
    achsen: Array.isArray(p.achsen) ? p.achsen.slice(0, 5).map((a: any) => ({ label: str(a.label, 40), wert: Number(a.wert) || 3, notiz: str(a.notiz, 180) })) : [],
    mischAnteile: Array.isArray(p.mischAnteile) && p.mischAnteile.length
      ? p.mischAnteile.slice(0, 3).map((m: any) => ({ rasse: str(m.rasse, 60), zeigtSich: str(m.zeigtSich, 260) }))
      : null,
    tagText: str(p.tagText, 900),
    tagesplan: Array.isArray(p.tagesplan) ? p.tagesplan.slice(0, 6).map((t: any) => ({ zeit: str(t.zeit, 30), dauer: str(t.dauer, 30), was: str(t.was, 160) })) : [],
    bewegung: { text: str(p.bewegung?.text, 1200), faustregel: str(p.bewegung?.faustregel, 400), uebung: uebungAus(p.bewegung?.uebung) },
    schlaf: {
      text: str(p.schlaf?.text, 1200), stunden: str(p.schlaf?.stunden, 300),
      anzeichen: Array.isArray(p.schlaf?.anzeichen) ? p.schlaf.anzeichen.slice(0, 5).map((x: any) => str(x, 160)) : [],
      uebung: uebungAus(p.schlaf?.uebung),
    },
    kopfarbeit: {
      text: str(p.kopfarbeit?.text, 1000), uebung: uebungAus(p.kopfarbeit?.uebung),
      weitere: Array.isArray(p.kopfarbeit?.weitere) ? p.kopfarbeit.weitere.slice(0, 2).map((w: any) => ({ name: str(w.name, 50), anleitung: str(w.anleitung, 220) })) : [],
    },
    thema: { titel: str(p.thema?.titel, 90), text: str(p.thema?.text, 1200), uebung: uebungAus(p.thema?.uebung) },
    baustellen: Array.isArray(p.baustellen) ? p.baustellen.slice(0, 4).map((b: any) => ({ thema: str(b.thema, 70), warum: str(b.warum, 320), sofort: str(b.sofort, 300) })) : [],
    donts: Array.isArray(p.donts) ? p.donts.slice(0, 3).map((d: any) => ({ dont: str(d.dont, 70), warum: str(d.warum, 220), stattdessen: str(d.stattdessen, 220) })) : [],
    koerpersprache: Array.isArray(p.koerpersprache) ? p.koerpersprache.slice(0, 5).map((k: any) => ({ signal: str(k.signal, 70), bedeutung: str(k.bedeutung, 220) })) : [],
    wochenplan: Array.isArray(p.wochenplan) ? p.wochenplan.slice(0, 7).map((t: any) => ({ tag: str(t.tag, 20), aufgabe: str(t.aufgabe, 140), dauer: str(t.dauer, 20) })) : [],
    selfCheck: Array.isArray(p.selfCheck) ? p.selfCheck.slice(0, 5).map((x: any) => str(x, 140)) : [],
    selfCheckResult: str(p.selfCheckResult, 900),
    closing: str(p.closing, 700),
  };
}

export function istMischling(breed?: string | null, rasseUnbekannt?: boolean): boolean {
  return !!rasseUnbekannt || !breed || /mischling|mieszaniec|meticcio|andere rasse|unbekannt/i.test(String(breed));
}
