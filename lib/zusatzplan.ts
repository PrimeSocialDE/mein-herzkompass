// Individueller Zusatz-Plan aus einer Kundenbeschwerde — serverseitig.
//
// Portierung des Generators aus public/admin-plan.html (dort im Browser, mit
// hochgeladenem PDF). Hier nimmt er den gespeicherten Plan aus
// member_plan_content (Wochen + Übungsnamen) als Grundlage, damit der
// Zusatz-Plan Übungen bringt, die noch nicht drin sind. Prompt und Struktur
// sind identisch zum Dashboard, damit die Pläne gleich aussehen.
//
// Export: zusatzplanText(...) -> string · zusatzplanPDF(text, dogName) -> Uint8Array

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

const MODEL = "claude-sonnet-4-6";

export const ZUSATZPLAN_SYSTEM = `AUSGABE-SPRACHE: DEUTSCH. Der komplette Plan bleibt auf Deutsch.

Du bist ein erfahrener Hundetrainer-Assistent. Analysiere den Trainingsplan, verstehe die Beschwerde, und erstelle eine korrigierte Version.

WICHTIG - FORMATIERUNG:
- Verwende KEIN Markdown. Keine Hashtags (#), keine Sterne (*/**), keine Unterstriche (_).
- Trenne jede Seite mit einer Zeile die nur === enthält.
- Schreibe reinen Text mit klaren Absätzen.

GESAMTSTRUKTUR DES PLANS:

=== (Seitenumbruch)
SEITE 1 - TITELSEITE:
[Hundename]'s persönlicher Zusatz-Plan

=== (Seitenumbruch)
SEITE 2 - EINLEITUNG (diese Seite soll gut gefüllt sein, aber NICHT über den Seitenrand hinausgehen):

Titel: "So nutzt du diesen Plan"

Schreibe einen warmen, persönlichen Einleitungstext in 3 Abschnitten. Der Text soll sich lesen wie ein Brief von einem Hundetrainer - nicht wie eine Bedienungsanleitung. Verwende den Hundenamen durchgehend.

ABSCHNITT 1 (4-5 Sätze):
Erkläre das Problem des Hundes einfühlsam. Zeige Verständnis ("Das kennen viele Hundebesitzer"). Erkläre warum dieser Plan anders ist als allgemeine Tipps aus dem Internet - er ist genau auf diesen Hund zugeschnitten. Mach Mut, dass Veränderung möglich ist, auch wenn es sich gerade schwer anfühlt.

ABSCHNITT 2 - Schreibe die Überschrift "Dein 3-Monats-Fahrplan" als eigene Zeile. Dann für jeden Monat:

Schreibe "Monat 1 (Woche 1-4): Übung 1 und 2" als eigene fettgedruckte Zeile.
Dann eine Leerzeile, dann 2-3 Sätze Erklärung. Dann eine Leerzeile vor dem nächsten Monat.

Schreibe "Monat 2 (Woche 5-8): Übung 3 und 4" als eigene fettgedruckte Zeile.
Dann eine Leerzeile, dann 2-3 Sätze. Dann Leerzeile.

Schreibe "Monat 3 (Woche 9-12): Übung 5 und 6" als eigene fettgedruckte Zeile.
Dann eine Leerzeile, dann 2-3 Sätze.

Schreibe "Bonus: Fortgeschrittene Übungen 7-9" als eigene fettgedruckte Zeile.
Dann eine Leerzeile, dann 1-2 Sätze: Für Hunde die die Grundlagen beherrschen. Diese Übungen kannst du ab Monat 2-3 ergänzen oder nach den 3 Monaten als Aufbau nutzen.

ABSCHNITT 3 - Schreibe die Überschrift "Tipps für den Erfolg" als eigene Zeile. Dann 4 Punkte, jeder Punkt so:

Schreibe den Tipp-Titel fett, dann Doppelpunkt, dann die Erklärung in derselben Zeile. Nach jedem Punkt eine Leerzeile.

Die 4 Punkte:
- Kurz und regelmäßig: 5-10 Minuten täglich bringen mehr als eine lange Einheit am Wochenende
- Immer positiv aufhören: Beende jede Einheit mit einem Erfolgserlebnis
- Rückschritte gehören dazu: Wenn es mal nicht klappt, geh einen Schritt zurück
- Du bist nicht allein: Bei Fragen erreichst du uns per E-Mail an support@pfoten-plan.de

=== (Seitenumbruch)
SEITEN 3-8 - GRUNDLAGEN (je eine Übung pro Seite):

Die ersten 6 Übungen sind die Basis. Sie starten einfach und werden progressiv schwieriger. Übung 1-2 sind Grundlagen, 3-4 Alltagsintegration, 5-6 fortgeschrittener.

Format pro Übung:

Übung [Nummer]: [Titel] – [Untertitel]

[Kurze Beschreibung was der Hund lernt, 1-2 Sätze]
[Ziel-Satz]

Schritt für Schritt

1. [Schritt-Titel]
[Erklärung Zeile 1]
[Erklärung Zeile 2]

(6 Schritte insgesamt)

Wie oft und wie lange
- [3-4 Punkte]

Worauf du achten solltest
- [3-4 Punkte]

Go's
- [genau 3 Punkte]

No Go's
- [genau 3 Punkte]

=== (Seitenumbruch)
SEITE 9 - ÜBERGANGSSEITE:

Titel: "Bereit für mehr? Fortgeschrittene Übungen"

Schreibe 2-3 Absätze:
- Erkläre dass die folgenden 3 Übungen für Hunde gedacht sind, die die Grundlagen bereits beherrschen
- Wann man damit starten sollte (wenn Übung 1-6 zuverlässig klappen)
- Diese Übungen sind anspruchsvoller und trainieren unter realistischen, schwierigeren Bedingungen
- Man kann sie als Ergänzung ab Monat 2-3 einbauen oder nach den 3 Monaten als Aufbau nutzen

=== (Seitenumbruch)
SEITEN 10-12 - FORTGESCHRITTENE ÜBUNGEN (je eine pro Seite):

3 weitere Übungen im selben Format wie oben (Schritt für Schritt, Go's, No Go's etc.)
Diese Übungen müssen DEUTLICH schwieriger sein als Übung 1-6:
- Mehr Ablenkung, realistischere Situationen, höherer Schwierigkeitsgrad
- Übungen die unter Stress, mit anderen Hunden, in unbekannter Umgebung funktionieren
- Für Hunde die die Basics schon können und eine echte Herausforderung brauchen
Nummeriere sie als Übung 7, 8, 9.

=== (Seitenumbruch)
LETZTE SEITE - ABSCHLUSS:
Titel: "Abschluss"

Schreibe 3-4 Absätze als Abschlusstext. Der Text soll sachlich-motivierend sein, NICHT kitschig oder übertrieben emotional. Vermeide Sätze wie "[Hundename] ist Familie" oder "Ihr schafft das zusammen". Stattdessen:
- Fasse zusammen, was die Übungen bewirken und warum Konsequenz wichtig ist
- Erkläre dass Veränderung nicht über Nacht passiert, aber mit regelmäßigem Training sichtbar wird
- Ermutige den Halter dranzubleiben und die Übungen in den Alltag zu integrieren
- Weise auf den E-Mail-Support hin (support@pfoten-plan.de)
Ton: professionell, ruhig, zuversichtlich - wie ein guter Trainer der am Ende einer Stunde zusammenfasst.

WEITERE REGELN:
- Alles auf Deutsch, Du-Form - KEINE englischen Begriffe verwenden (kein "Trigger", "Recall", "Impulse Control" etc. - immer die deutsche Entsprechung nutzen)
- Den Hundenamen aus dem Original übernehmen
- Praxisnah und konkret, keine allgemeinen Floskeln
- 6 Grundlagen-Übungen + 3 Fortgeschrittene Übungen, alle aufeinander aufbauend
- Go's und No Go's immer genau 3 Punkte, nicht mehr
- LAYOUT: Die linke Spalte enthält Übungstitel, Beschreibung, Schritt für Schritt (1-6). Die rechte Spalte enthält "Wie oft und wie lange", "Worauf du achten solltest", "Go's", "No Go's". So ergibt sich ein sauberes 2-Spalten-Layout.
- Gib NUR den Plan aus, keine Meta-Kommentare`;

/** Kompakte Übersicht des Originalplans: Woche, Titel, Übungsnamen. */
export function planUebersicht(content: any): string {
  if (!content || !Array.isArray(content.weeks)) return "";
  return content.weeks
    .map((w: any) => {
      const ue = Array.isArray(w.uebungen) ? w.uebungen.map((u: any) => u?.name).filter(Boolean).join(", ") : "";
      return `Woche ${w.num}: ${w.title || ""}${w.fokus ? ` (Fokus: ${w.fokus})` : ""}${ue ? ` — Übungen: ${ue}` : ""}`;
    })
    .join("\n");
}

export async function zusatzplanText(opts: {
  dogName: string;
  customerName?: string;
  problemLabel?: string;
  beschwerde: string;
  planUebersicht: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt");
  let context = "";
  if (opts.customerName) context += `Kundenname: ${opts.customerName}\n`;
  if (opts.dogName) context += `Hundename: ${opts.dogName}\n`;
  if (opts.problemLabel) context += `Hundeproblem: ${opts.problemLabel}\n`;
  const user =
    (context ? `ZUSATZINFORMATIONEN:\n${context}\n` : "") +
    `BESCHWERDE / KORREKTURANWEISUNG (Worte der Kundin / des Kunden):\n${opts.beschwerde}\n\n` +
    (opts.planUebersicht
      ? `BISHERIGER TRAININGSPLAN (Übersicht, Woche für Woche). Wiederhole diese Übungen NICHT, sondern bring neue, die genau auf die Beschwerde eingehen:\n${opts.planUebersicht}\n\n`
      : "") +
    `Bitte erstelle den Zusatz-Plan.`;
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 12000,
    system: ZUSATZPLAN_SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  return res.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
}

// ── PDF ─────────────────────────────────────────────────────────────────────
const W = 595.28, H = 841.89, M = 46;
const GOLD = rgb(196 / 255, 165 / 255, 118 / 255), BRAUN = rgb(139 / 255, 115 / 255, 85 / 255);
const DUNKEL = rgb(36 / 255, 30 / 255, 24 / 255), TEXT = rgb(45 / 255, 42 / 255, 38 / 255);
const GRAU = rgb(115 / 255, 110 / 255, 102 / 255), HELL = rgb(250 / 255, 247 / 255, 241 / 255);
const LINIE = rgb(230 / 255, 220 / 255, 202 / 255), WEISS = rgb(1, 1, 1);

const S = (s: any) =>
  String(s == null ? "" : s)
    .replace(/[→⇒➜]/g, "-")
    .replace(/[✓✔]/g, "-")
    .replace(/[\u{1F000}-\u{1FAFF}☀-➿️]/gu, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ–—‘’‚“”„•…€]/g, "");

function wrap(t: string, f: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const abs of S(t).split("\n")) {
    let z = "";
    for (const w of abs.split(/\s+/).filter(Boolean)) {
      const tt = z ? z + " " + w : w;
      if (f.widthOfTextAtSize(tt, size) > maxW && z) { out.push(z); z = w; } else z = tt;
    }
    out.push(z);
  }
  return out;
}

const RECHTS_START = /^(Wie oft und wie lange|Worauf du achten solltest|Go's|No Go's)\s*$/;
const UEBERSCHRIFT = /^(So nutzt du diesen Plan|Dein 3-Monats-Fahrplan|Tipps für den Erfolg|Abschluss|Worum es geht|Bereit für mehr\?.*|Schritt für Schritt|Wie oft und wie lange|Worauf du achten solltest|Go's|No Go's)\s*$/;
const MONAT = /^(Monat \d+ .+|Bonus: .+)$/;

export async function zusatzplanPDF(
  text: string,
  dogName: string,
  // Optional: eigene Titel für Ableger (z. B. Aufbauplan der Verlängerung)
  opts: { titel?: string; untertitel?: string; fuss?: string } = {}
): Promise<Uint8Array> {
  const titel = opts.titel || `${dogName}s persönlicher Zusatz-Plan`;
  const untertitel = opts.untertitel || "Angepasst an eure Situation: neue Übungen, die genau dort ansetzen, wo es bei euch gerade hakt. Zum Ausdrucken und Abhaken.";
  const fuss = opts.fuss || `${dogName}s Zusatz-Plan · Pfoten-Plan`;
  const doc = await PDFDocument.create();
  doc.setTitle(titel);
  doc.setAuthor("Pfoten-Plan");
  const r = await doc.embedFont(StandardFonts.Helvetica);
  const b = await doc.embedFont(StandardFonts.HelveticaBold);
  let page!: PDFPage, nr = 0;
  const neue = () => {
    page = doc.addPage([W, H]); nr++;
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: HELL });
    page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: GOLD });
    if (nr > 1) {
      page.drawText(S(fuss), { x: M, y: 26, size: 8, font: r, color: GRAU });
      page.drawText(String(nr), { x: W - M - 10, y: 26, size: 8, font: r, color: GRAU });
    }
  };

  // Spalten-Renderer mit Seitenumbruch
  const spalte = (zeilen: string[], x: number, w: number, yStart: number, size = 9.6): number => {
    let y = yStart;
    for (const roh of zeilen) {
      const z = roh.trim();
      if (!z) { y -= 5; continue; }
      const istKopf = UEBERSCHRIFT.test(z) || MONAT.test(z);
      const istSchritt = /^\d+\.\s/.test(z);
      const istPunkt = /^[-•]\s/.test(z);
      const tipp = !istKopf && /^[^:]{3,40}:\s/.test(z) && !/^Übung/.test(z);
      const font = istKopf || istSchritt ? b : r;
      const sz = istKopf && UEBERSCHRIFT.test(z) ? size + 2 : size;
      const farbe = istKopf ? BRAUN : TEXT;
      if (istKopf) y -= 4;
      const inhalt = istPunkt ? "•  " + z.replace(/^[-•]\s+/, "") : z;
      const ein = istPunkt ? 10 : 0;
      for (const [i, zz] of wrap(inhalt, font, sz, w - ein).entries()) {
        if (y < 50) { neue(); y = H - 60; }
        if (tipp && i === 0) {
          const [kopf, ...rest] = zz.split(":");
          page.drawText(kopf + ":", { x: x + ein, y, size: sz, font: b, color: TEXT });
          const kw = b.widthOfTextAtSize(kopf + ":", sz);
          if (rest.length) page.drawText(rest.join(":"), { x: x + ein + kw, y, size: sz, font: r, color: TEXT });
        } else {
          page.drawText(zz, { x: x + (istPunkt && i > 0 ? ein + 9 : ein), y, size: sz, font, color: farbe });
        }
        y -= sz * 1.42;
      }
      if (istKopf) y -= 2;
    }
    return y;
  };

  const seiten = S(text).replace(/\r/g, "").split(/^\s*={3,}.*$/m).map((p) => p.trim()).filter(Boolean);

  // Titelseite (eigene Gestaltung, unabhängig vom KI-Text)
  neue();
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(247 / 255, 239 / 255, 224 / 255) });
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: GOLD });
  page.drawText("PFOTEN-PLAN", { x: M, y: H - 120, size: 12, font: b, color: BRAUN });
  let ty = H - 300;
  for (const z of wrap(titel, b, 34, W - 2 * M)) { page.drawText(z, { x: M, y: ty, size: 34, font: b, color: DUNKEL }); ty -= 42; }
  page.drawRectangle({ x: M, y: ty + 18, width: 64, height: 3, color: GOLD });
  for (const z of wrap(untertitel, r, 13, W - 2 * M)) {
    ty -= 22; page.drawText(z, { x: M, y: ty, size: 13, font: r, color: GRAU });
  }

  for (const s of seiten) {
    const zeilen = s.split("\n");
    if (/(Zusatz-Plan|Aufbauplan|Teil 2.*)\s*$/.test(zeilen[0] || "") && zeilen.length <= 3) continue; // KI-Titelseite überspringen
    neue();
    const erste = (zeilen[0] || "").trim();
    if (/^Übung \d+:/.test(erste)) {
      // Kopf über volle Breite
      let y = H - 64;
      for (const z of wrap(erste, b, 15, W - 2 * M)) { page.drawText(z, { x: M, y, size: 15, font: b, color: DUNKEL }); y -= 20; }
      page.drawRectangle({ x: M, y: y + 8, width: 40, height: 2.5, color: GOLD });
      y -= 8;
      const rest = zeilen.slice(1);
      const idx = rest.findIndex((z) => RECHTS_START.test(z.trim()));
      const links = idx >= 0 ? rest.slice(0, idx) : rest;
      const rechts = idx >= 0 ? rest.slice(idx) : [];
      const gap = 18, lw = (W - 2 * M - gap) * 0.56, rw = W - 2 * M - gap - lw;
      const startSeite = nr, yStart = y;
      // rechte Spalte als Kasten
      page.drawRectangle({ x: M + lw + gap - 8, y: 50, width: rw + 16, height: yStart - 40, color: WEISS, borderColor: LINIE, borderWidth: 1 });
      const yl = spalte(links, M, lw, yStart);
      if (nr === startSeite) {
        spalte(rechts, M + lw + gap, rw, yStart, 9.2);
      } else {
        // linke Spalte lief über -> rechte Inhalte auf der Folgeseite unten anhängen
        spalte(rechts, M, W - 2 * M, yl - 10, 9.4);
      }
    } else {
      let y = H - 64;
      const titel = erste.replace(/^Titel:\s*/, "").replace(/^"|"$/g, "");
      for (const z of wrap(titel, b, 19, W - 2 * M)) { page.drawText(z, { x: M, y, size: 19, font: b, color: DUNKEL }); y -= 24; }
      page.drawRectangle({ x: M, y: y + 10, width: 44, height: 2.5, color: GOLD });
      spalte(zeilen.slice(1), M, W - 2 * M, y - 10, 10.2);
    }
  }
  return await doc.save();
}
