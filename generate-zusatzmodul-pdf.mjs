// Generiert einen Zusatz-Modul-PDF (10 Seiten A4 Querformat) im
// PfotenPlan-Style. Layout ist 1:1 an die zwei Sample-PDFs angelehnt
// (Leinenführung "Mogli" + Energie & Ruhe "Blues").
//
// Personalisierung: nur Hundename (+ ggf. Rasse) wird ausgetauscht,
// der Rest des Inhalts ist statisch.
//
// Verfuegbare Module:
//   - pulling: Leinenführungs-Plan
//   - energy: Energie- & Ruhe-Plan
//
// Verwendung als Modul:
//   import { buildPdf } from "./generate-zusatzmodul-pdf.mjs";
//   const bytes = await buildPdf({
//     dogName: "Bruno",
//     dogBreed: "Labrador-Mix",
//     moduleKey: "pulling",
//   });
//
// CLI: DOG_NAME="Bruno" MODULE_KEY="pulling" node generate-zusatzmodul-pdf.mjs

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFileSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join as pathJoin } from "path";
import QRCode from "qrcode";

// __dirname-Aequivalent fuer ESM — zeigt auf Repo-Root (wo dieses File liegt)
const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = (file) => pathJoin(__dirname, "public", file);

// A4 Querformat (Landscape) — Originalvorlage ist quer; bessere Lesbarkeit
// für die Zielgruppe (40–50 Jahre)
const A4_W = 841.89;
const A4_H = 595.28;

// Brand-Farben (PfotenPlan-PDF Look)
const BANNER_TAN  = rgb(255 / 255, 227 / 255, 180 / 255); // #FFE3B4 — Header-Banner (beige-braun, Brand)
const GOLD        = rgb(196 / 255, 165 / 255, 118 / 255); // #C4A576 — Akzente
const GOLD_DARK   = rgb(139 / 255, 115 / 255, 85 / 255);  // #8B7355 — dunkleres Gold
const GOLD_SOFT   = rgb(255 / 255, 227 / 255, 180 / 255); // #FFE3B4 — helleres Beige für Pfoten-Deko
const DARK_BROWN  = rgb(36 / 255, 23 / 255, 20 / 255);    // #241714
const TEXT_DARK   = rgb(26 / 255, 26 / 255, 26 / 255);
const TEXT_MEDIUM = rgb(80 / 255, 80 / 255, 80 / 255);
const TEXT_LIGHT  = rgb(150 / 255, 150 / 255, 150 / 255);
const WHITE       = rgb(1, 1, 1);
const BG_CREAM    = rgb(250 / 255, 245 / 255, 235 / 255); // weicher Sand-Hintergrund
const BG_BAR      = rgb(240 / 255, 230 / 255, 210 / 255); // Wochen-Label-Bar

// ========= Personalisierungs-Defaults (CLI-Fallback) =========
// Diese Konstanten dienen nur als Default beim direkten CLI-Aufruf.
// Bei Library-Nutzung kommen die Werte als params in buildPdf().
const DEFAULT_DOG_NAME     = "Yuna";
const DEFAULT_DOG_BREED    = "Mischling";
const DEFAULT_DOG_AGE      = "2 Jahre";
const DEFAULT_MAIN_PROBLEM = "Ängstlichkeit gegenüber Menschen";

// ========= Helpers =========
function wrapText(text, font, size, maxWidth) {
  // Erlaubt manuelle Zeilenumbrüche via "\n"
  const paragraphs = String(text).split("\n");
  const out = [];
  for (const para of paragraphs) {
    const words = para.split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}

function drawRoundedRect(page, x, y, w, h, r, color) {
  if (r > w / 2) r = w / 2;
  if (r > h / 2) r = h / 2;
  page.drawRectangle({ x: x + r, y, width: w - 2 * r, height: h, color });
  page.drawRectangle({ x, y: y + r, width: w, height: h - 2 * r, color });
  page.drawCircle({ x: x + r,     y: y + r,     size: r, color });
  page.drawCircle({ x: x + w - r, y: y + r,     size: r, color });
  page.drawCircle({ x: x + r,     y: y + h - r, size: r, color });
  page.drawCircle({ x: x + w - r, y: y + h - r, size: r, color });
}

// Pfoten-Icon — kleiner, kompakt (für Header & Deko)
function drawPaw(page, cx, cy, scale = 1, color = GOLD) {
  const pad = 7 * scale;
  const toe = 3.5 * scale;
  page.drawEllipse({ x: cx, y: cy - pad * 0.3, xScale: pad, yScale: pad * 0.85, color });
  page.drawCircle({ x: cx - pad * 1.05, y: cy + pad * 0.7, size: toe,       color });
  page.drawCircle({ x: cx - pad * 0.4,  y: cy + pad * 1.2, size: toe * 1.1, color });
  page.drawCircle({ x: cx + pad * 0.4,  y: cy + pad * 1.2, size: toe * 1.1, color });
  page.drawCircle({ x: cx + pad * 1.05, y: cy + pad * 0.7, size: toe,       color });
}

// Banner-Höhe (auch vom Cover & Inhaltsseiten benutzt)
const BANNER_H = 55;

// Header-Banner — auf JEDER Seite (außer ggf. Cover-Variante)
// `logoImage` ist das eingebettete Pfoten-Logo (PNGEmbedded), wird vor dem
// Aufruf einmal pro Dokument geladen.
function drawHeaderBanner(page, fontBold, logoImage) {
  const H = BANNER_H;
  page.drawRectangle({ x: 0, y: A4_H - H, width: A4_W, height: H, color: BANNER_TAN });
  // mittig: Logo + "PfotenPlan"
  const label = "PfotenPlan";
  const labelSize = 15;
  const labelW = fontBold.widthOfTextAtSize(label, labelSize);
  const logoSize = 24;
  const gap = 10;
  const totalW = logoSize + gap + labelW;
  const startX = (A4_W - totalW) / 2;
  page.drawImage(logoImage, {
    x: startX,
    y: A4_H - H / 2 - logoSize / 2,
    width: logoSize,
    height: logoSize,
  });
  page.drawText(label, {
    x: startX + logoSize + gap,
    y: A4_H - H / 2 - labelSize / 2 + 2,
    size: labelSize,
    font: fontBold,
    color: DARK_BROWN,
  });
}

// Dezente goldene Schnörkel in den Ecken (wie in der PDF) — geschwungene
// Linien via SVG-Pfaden. Positioniert relativ zur Bannerhöhe + Seiten-Ecken.
function drawCornerSwooshes(page) {
  const swooshColor = GOLD_SOFT;
  const opts = { borderColor: swooshColor, borderWidth: 1.2 };

  // oben rechts — geschwungene Schleife direkt unter dem Banner
  page.drawSvgPath(
    "M 0 0 C 25 -4, 50 4, 60 26 S 55 64, 28 60 S -8 42, 0 26",
    { x: A4_W - 60, y: A4_H - BANNER_H - 18, ...opts }
  );
  // Begleit-Schnörkel
  page.drawSvgPath(
    "M 0 0 C 12 -2, 24 4, 26 16 S 18 32, 6 26",
    { x: A4_W - 90, y: A4_H - BANNER_H - 60, ...opts }
  );

  // oben links — kleiner Akzent
  page.drawSvgPath(
    "M 0 0 C -8 -2, -20 6, -22 22 S -10 38, 6 30",
    { x: 30, y: A4_H - BANNER_H - 30, ...opts }
  );

  // unten rechts — Spiegelung
  page.drawSvgPath(
    "M 0 0 C 25 -4, 50 4, 60 26 S 55 64, 28 60 S -8 42, 0 26",
    { x: A4_W - 60, y: 60, ...opts }
  );

  // unten links — sehr dezent
  page.drawSvgPath(
    "M 0 0 C -8 4, -16 14, -10 26 S 10 34, 18 26",
    { x: 30, y: 40, ...opts }
  );
}

// Seitenzahl unten rechts
function drawPageNumber(page, n, font) {
  const txt = String(n);
  const w = font.widthOfTextAtSize(txt, 12);
  page.drawText(txt, {
    x: A4_W - 50 - w / 2,
    y: 28,
    size: 12,
    font,
    color: TEXT_DARK,
  });
}

// Cremefarbener Hintergrund (Vollfläche unter Banner)
function drawPageBackground(page) {
  page.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: BG_CREAM });
}

// Großer Titel mit goldenem Unterstrich. Schrumpft automatisch, wenn der
// Titel breiter als die Content-Width wäre.
function drawSectionTitle(page, title, x, y, fontBold, size = 30, maxWidth = 700) {
  let s = size;
  while (fontBold.widthOfTextAtSize(title, s) > maxWidth && s > 16) s -= 1;
  page.drawText(title, { x, y, size: s, font: fontBold, color: DARK_BROWN });
  // goldener Unterstrich (passt sich Titel-Breite an)
  const underlineW = Math.min(220, fontBold.widthOfTextAtSize(title, s) * 0.45);
  page.drawRectangle({ x, y: y - 10, width: underlineW, height: 2, color: GOLD });
  return y - (s + 16); // neue Y-Position
}

// Wochen-Label-Box (oben links auf Wochen-Seiten, mit weichem Tan-Hintergrund)
function drawWeekLabel(page, weekNr, x, y, fontBold) {
  const label = `Woche ${weekNr}`;
  const size = 22;
  const txtW = fontBold.widthOfTextAtSize(label, size);
  const padX = 14;
  const padY = 7;
  const boxW = txtW + padX * 2;
  const boxH = size + padY * 2;
  drawRoundedRect(page, x, y, boxW, boxH, 4, BG_BAR);
  page.drawText(label, {
    x: x + padX,
    y: y + padY + 2,
    size,
    font: fontBold,
    color: DARK_BROWN,
  });
  return y;
}

// Absatz mit Wrap, gibt neue Y-Position zurück
function drawParagraph(page, text, x, y, maxWidth, font, size = 13, color = TEXT_DARK, lineGap = 18) {
  const lines = wrapText(text, font, size, maxWidth);
  for (const line of lines) {
    page.drawText(line, { x, y, size, font, color });
    y -= lineGap;
  }
  return y;
}

// Bullet-Zeile mit "->" Pfeil (wie im Original)
function drawArrowBullet(page, text, x, y, maxWidth, fontReg, fontBold, size = 12.5, color = TEXT_DARK, lineGap = 17) {
  const arrow = "->";
  const arrowW = fontBold.widthOfTextAtSize(arrow, size);
  page.drawText(arrow, { x, y, size, font: fontBold, color });
  const textX = x + arrowW + 8;
  const lines = wrapText(text, fontReg, size, maxWidth - (arrowW + 8));
  for (let i = 0; i < lines.length; i++) {
    page.drawText(lines[i], { x: textX, y, size, font: fontReg, color });
    y -= lineGap;
  }
  return y - 2;
}

// Nummerierter Schritt mit goldenem Kreis + Zahl in Weiß. Für sequenzielle
// Anleitungen (Übung Schritt für Schritt).
function drawNumberedStep(page, n, text, x, y, maxWidth, fontReg, fontBold, size = 12.5, color = TEXT_DARK, lineGap = 17) {
  const r = 11;
  const cx = x + r;
  const cy = y + size * 0.32;
  page.drawCircle({ x: cx, y: cy, size: r, color: GOLD });
  const num = String(n);
  const numSize = 12;
  const nw = fontBold.widthOfTextAtSize(num, numSize);
  page.drawText(num, {
    x: cx - nw / 2,
    y: cy - numSize * 0.34,
    size: numSize,
    font: fontBold,
    color: WHITE,
  });
  const textX = x + r * 2 + 10;
  const lines = wrapText(text, fontReg, size, maxWidth - (r * 2 + 10));
  for (let i = 0; i < lines.length; i++) {
    page.drawText(lines[i], { x: textX, y, size, font: fontReg, color });
    y -= lineGap;
  }
  return y - 4;
}

// Bullet-Zeile mit Häkchen-Symbol (für Wochen-Check)
function drawCheckBullet(page, text, x, y, maxWidth, fontReg, size = 12.5, color = TEXT_DARK, lineGap = 17) {
  const cx = x + 5;
  const cy = y + size * 0.32;
  const checkColor = GOLD_DARK;
  page.drawLine({
    start: { x: cx - 4, y: cy - 1 },
    end:   { x: cx - 1, y: cy - 5 },
    thickness: 2.2, color: checkColor,
  });
  page.drawLine({
    start: { x: cx - 1, y: cy - 5 },
    end:   { x: cx + 6, y: cy + 5 },
    thickness: 2.2, color: checkColor,
  });
  const textX = x + 22;
  const lines = wrapText(text, fontReg, size, maxWidth - 22);
  for (let i = 0; i < lines.length; i++) {
    page.drawText(lines[i], { x: textX, y, size, font: fontReg, color });
    y -= lineGap;
  }
  return y - 2;
}

// Warn-Dreieck Bullet (für Typische Fehler)
const WARN_RED = rgb(199 / 255, 73 / 255, 60 / 255);
function drawWarnBullet(page, text, x, y, maxWidth, fontReg, size = 12.5, color = TEXT_DARK, lineGap = 17) {
  const cx = x + 7;
  const cy = y + size * 0.32;
  const tri = 7;
  // Dreieck als Pfad — Achtung: drawSvgPath nutzt SVG-Y (nach unten), Origin bei (x, y)
  // Wir setzen Origin auf (cx, cy + tri*0.5) und zeichnen relative Punkte
  page.drawSvgPath(
    `M 0 -${tri} L -${tri} ${tri * 0.6} L ${tri} ${tri * 0.6} Z`,
    { x: cx, y: cy + tri * 0.4, color: WARN_RED, borderColor: WARN_RED, borderWidth: 0.5 }
  );
  page.drawText("!", {
    x: cx - 1.5,
    y: cy - tri * 0.45,
    size: 9,
    font: fontReg,
    color: WHITE,
  });
  const textX = x + 22;
  const lines = wrapText(text, fontReg, size, maxWidth - 22);
  for (let i = 0; i < lines.length; i++) {
    page.drawText(lines[i], { x: textX, y, size, font: fontReg, color });
    y -= lineGap;
  }
  return y - 2;
}

// Farbcodierter Sektion-Header für Wochen-Seiten (Übung / Fehler / Check).
// Pill-Design: heller Hintergrund mit zarter Akzent-Linie links (innerhalb
// der gerundeten Pill, nicht oben/unten überstehend).
// `y` ist die UNTERE Kante; Rückgabe ist y direkt unterhalb der Pill +
// Default-Spacing — bereit für nachfolgenden Title.
function drawSectionPill(page, label, x, y, fontBold, accentColor, bgColor, spacingBelow = 14) {
  const size = 11;
  const padLeft = 14;
  const padRight = 14;
  const padY = 7;
  const labelW = fontBold.widthOfTextAtSize(label, size);
  const w = padLeft + labelW + padRight;
  const h = size + padY * 2;
  // Pill-Hintergrund (rounded)
  drawRoundedRect(page, x, y, w, h, 4, bgColor);
  // Akzent-Streifen DEUTLICH innerhalb der Pill — sichtbar kürzer als die
  // Pill-Höhe, damit er weder in die abgerundeten Ecken noch über die
  // Pill-Kanten rausragt.
  const stripeInset = 6;
  page.drawRectangle({
    x: x + 4,
    y: y + stripeInset,
    width: 2.5,
    height: h - 2 * stripeInset,
    color: accentColor,
  });
  // Label
  page.drawText(label, {
    x: x + padLeft,
    y: y + padY + 1,
    size,
    font: fontBold,
    color: DARK_BROWN,
  });
  return y - spacingBelow;
}
const PILL_BG_GREEN = rgb(232 / 255, 244 / 255, 230 / 255);
const PILL_AC_GREEN = rgb(70 / 255, 145 / 255, 80 / 255);
const PILL_BG_RED   = rgb(252 / 255, 230 / 255, 226 / 255);
const PILL_AC_RED   = WARN_RED;
const PILL_BG_GOLD  = rgb(248 / 255, 240 / 255, 222 / 255);
const PILL_AC_GOLD  = GOLD_DARK;


// ========= Module-Configs (Content 1:1 aus Sample-PDFs) =========
// Personalisierung: ${'$'}{dogName} wird im Code ersetzt.

const MODULES = {
  lebensretter: {
    coverTitle: "Lebensretter-Training für",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Warum diese 10 Kommandos so wichtig sind",
      subtitle: "Die Übungen, die im Ernstfall zählen",
      paras: [
        "Dein normaler Trainingsplan macht euren Alltag entspannter. Dieses Training hat eine andere Aufgabe: Es soll {dogName} in genau den Momenten schützen, in denen du keine Sekunde zum Nachdenken hast.",
        "Ein losgerissener Hund an der Straße, ein Giftköder auf dem Weg, ein Radfahrer, der plötzlich um die Ecke kommt. In solchen Momenten entscheidet nicht Gehorsam, sondern ein einziges, blitzschnell sitzendes Signal.",
        "Genau diese Signale trainieren die wenigsten Halter gezielt, obwohl sie die wichtigsten überhaupt sind. Die folgenden 10 Kommandos bauen dir Schritt für Schritt ein Sicherheitsnetz für {dogName} auf.",
        "Wichtig: Du übst diese Signale in Ruhe und ohne echten Stress auf, damit sie im Ernstfall automatisch abrufbar sind. Ein Kommando, das nur zuhause klappt, hilft draußen nicht.",
      ],
    },
    how: {
      title: "So baust du die Kommandos richtig auf",
      paras: [
        "Trainiere jedes Kommando zuerst drinnen und in völliger Ruhe, bevor du es nach draußen und in schwierigere Situationen bringst. {dogName} muss erst verstehen, was gemeint ist, bevor Ablenkung dazukommt.",
        "Belohne im Sicherheitstraining großzügig und hochwertig. Gerade der Notfall-Rückruf und das Aus sollen sich für {dogName} maximal lohnen, dann reagiert er auch, wenn etwas Spannenderes lockt.",
        "Kurze, häufige Einheiten schlagen lange. 2 bis 3 Minuten pro Kommando am Tag, dafür regelmäßig, bringen mehr als eine lange Einheit am Wochenende.",
        "Teste ein Kommando nie zum ersten Mal in einer echten Gefahrensituation. Baue es sauber auf, festige es unter leichter Ablenkung und steigere erst dann. Sicherheit entsteht durch Wiederholung, nicht durch Druck.",
      ],
    },
    exercises: [
      {
        title: "Der Notfall-Rückruf",
        intro: "Das eine Signal, das zieht, wenn es wirklich drauf ankommt, aufgebaut als absoluter Jackpot.",
        steps: [
          { name: "Ein eigenes Notfallwort wählen", desc: "Nimm ein Wort, das du im Alltag NICHT benutzt, zum Beispiel Sofort oder einen Pfiff. Es wird ausschließlich für den Ernstfall reserviert und nie verbraucht." },
          { name: "Mit dem Mega-Jackpot verknüpfen", desc: "Sag das Wort in ruhiger Umgebung und gib {dogName} sofort etwas außergewöhnlich Gutes, mehrere Stücke Käse oder Fleisch hintereinander. So wird das Wort zum größten Versprechen, das er kennt." },
          { name: "Distanz langsam aufbauen", desc: "Wiederhole es über Tage aus wenigen Metern, dann aus dem Nebenraum, dann aus dem Garten. Jedes Mal kommt der Jackpot." },
          { name: "Leichte Ablenkung einbauen", desc: "Übe, wenn {dogName} gerade schnüffelt oder spielt. Kommt er trotzdem, feiere ihn überschwänglich. Kommt er nicht, gehst du eine Stufe zurück, näher und mit weniger Ablenkung." },
          { name: "Wort heilig halten", desc: "Benutze das Notfallwort NIE für Alltagssituationen und rufe nie damit, wenn du unsicher bist, ob er kommt. Jedes verbrannte Mal schwächt es." },
        ],
        frequency: ["Täglich 5 kurze Wiederholungen", "Immer mit Top-Belohnung", "Nie im echten Notfall zum ersten Mal testen"],
        watchFor: ["Kommt {dogName} freudig und schnell", "Kein Zögern beim Wort", "Belohnung bleibt immer außergewöhnlich"],
        gos: ["Wort ausschließlich für den Ernstfall", "Immer der größte Jackpot", "Großzügig feiern"],
        noGos: ["Nicht im Alltag verbrauchen", "Nicht rufen bei Unsicherheit", "Nie schimpfen, wenn er kommt"],
      },
      {
        title: "Sofort-Aus",
        intro: "{dogName} spuckt auf ein Wort sofort aus, was er im Maul hat, der wichtigste Schutz vor Giftködern und Fremdkörpern.",
        steps: [
          { name: "Mit dem Tausch beginnen", desc: "Gib {dogName} etwas Langweiliges ins Maul, ein Stück Trockenfutter, und halte ihm gleichzeitig etwas viel Besseres hin. Sag ruhig Aus und belohne, sobald er loslässt." },
          { name: "Loslassen belohnen, nicht nehmen", desc: "Der Deal ist: abgeben lohnt sich immer. Nimm ihm nie einfach etwas weg, sonst lernt er zu schlucken oder wegzulaufen." },
          { name: "Schwierigkeit steigern", desc: "Übe mit langweiligen, dann interessanteren Gegenständen. Immer gilt: Aus plus sofort etwas Besseres." },
          { name: "Draußen übertragen", desc: "Übe an harmlosen Fundstücken beim Spaziergang. Sag Aus, tausche gegen ein Top-Leckerli. So wird Abgeben zur Gewohnheit, bevor es ernst wird." },
          { name: "Zufällig einbauen", desc: "Baue Aus in unerwartete Alltagsmomente ein, nicht nur in der Übungssituation. Immer sofort etwas Besseres dafür, damit es überall zuverlässig sitzt." },
        ],
        frequency: ["Täglich 5 bis 10 Tausch-Wiederholungen", "Erst drinnen, dann draußen", "Immer der bessere Tausch"],
        watchFor: ["{dogName} lässt zügig los", "Kein Verschlucken oder Wegdrehen", "Er kommt eher zu dir statt weg"],
        gos: ["Abgeben immer belohnen", "Ruhig und freundlich bleiben", "Gegen etwas Besseres tauschen"],
        noGos: ["Nicht hinterherjagen", "Nicht aus dem Maul reißen", "Nicht schimpfen"],
      },
      {
        title: "Lass es",
        intro: "{dogName} nimmt Gefährliches gar nicht erst auf, die proaktive Stufe vor dem Aus.",
        steps: [
          { name: "Leckerli in der Faust anbieten", desc: "Halte ein Leckerli in der geschlossenen Faust hin. {dogName} wird schnuppern und lecken. Warte ruhig, bis er ablässt, und belohne genau dann aus der anderen Hand." },
          { name: "Wort einführen", desc: "Sobald er zuverlässig ablässt, sag ruhig Lass es in dem Moment, in dem er sich abwendet, und belohne." },
          { name: "Auf den Boden übertragen", desc: "Leg ein Leckerli auf den Boden, deck es mit der Hand ab. Sag Lass es. Belohne für Ablassen aus der anderen Hand, nie das abgedeckte." },
          { name: "In Bewegung üben", desc: "Leg beim Spaziergang harmlose Köder aus, etwa Trockenfutter. Sag Lass es, bevor er ran will, und belohne das Vorbeigehen großzügig." },
          { name: "Mit mehr Ablenkung steigern", desc: "Übe an belebteren Orten mit mehr Reizen. Steigere die Schwierigkeit erst, wenn Lass es an ruhigen Orten sicher klappt." },
        ],
        frequency: ["Täglich 5 Minuten", "Vom Ruhigen ins Ablenkende steigern", "Belohnung kommt IMMER aus deiner Hand"],
        watchFor: ["{dogName} wendet sich aktiv ab", "Er schaut zu dir statt zum Objekt", "Kein Hinstürzen mehr"],
        gos: ["Ablassen sofort belohnen", "Ruhig und klar bleiben", "Frühzeitig ansagen"],
        noGos: ["Nie das verbotene Objekt geben", "Nicht mit lauter Stimme", "Nicht zu schnell steigern"],
      },
      {
        title: "Steh, der Distanz-Not-Halt",
        intro: "{dogName} bleibt auf ein Wort sofort stehen, auch aus 15 Metern, wenn er auf eine Gefahr zuläuft.",
        steps: [
          { name: "Steh direkt vor dir aufbauen", desc: "Locke {dogName} mit einem Leckerli vor der Nase langsam nach oben und leicht zurück, bis er aus der Bewegung stehen bleibt. Sag Steh und belohne im Stehen." },
          { name: "Kurze Distanz einbauen", desc: "Geh einen Schritt weg, sag Steh, geh zu ihm und belohne AN der Stelle. Wichtig: Belohnung kommt dorthin, wo er steht, nicht zu dir." },
          { name: "Distanz vergrößern", desc: "Steigere über Tage auf 5, dann 10, dann 15 Meter. Bleibt er nicht, gehst du wieder näher heran." },
          { name: "Aus der Bewegung stoppen", desc: "Lass {dogName} auf dich zukommen und sag mitten in der Bewegung Steh. Belohne das sofortige Anhalten. Das ist die eigentliche Notfall-Situation." },
          { name: "Im Alltag testen", desc: "Baue Steh in ganz normale Spaziergänge ein, an einer Kreuzung oder vor einer Wiese, damit es zur verlässlichen Gewohnheit wird." },
        ],
        frequency: ["Täglich einige Wiederholungen", "Distanz langsam steigern", "Belohnung immer am Standort"],
        watchFor: ["Sofortiges Anhalten", "Kein Weiterlaufen zu dir", "Ruhiges Stehen"],
        gos: ["Am Standort belohnen", "Klar und ruhig ansagen", "In kleinen Schritten steigern"],
        noGos: ["Nicht zu dir rufen beim Steh", "Nicht zu früh weit weggehen", "Nicht wiederholt rufen"],
      },
      {
        title: "Platz auf Distanz",
        intro: "{dogName} legt sich sofort ab, auch aus Entfernung, der zuverlässigste Not-Stopp überhaupt.",
        steps: [
          { name: "Platz sicher aufbauen", desc: "Festige zuerst ein sauberes Platz direkt vor dir mit Handzeichen, flache Hand nach unten, und Wort." },
          { name: "Handzeichen betonen", desc: "Ein deutliches Handzeichen wirkt über Distanz oft besser als das Wort. Übe beides gemeinsam, damit {dogName} beide versteht." },
          { name: "Einen Schritt Abstand", desc: "Geh einen Schritt zurück, gib Wort und Handzeichen. Belohne das Ablegen an Ort und Stelle." },
          { name: "Distanz aufbauen", desc: "Steigere langsam die Entfernung. Ein sicheres Platz aus Distanz kann {dogName} an einer Gefahrenkante halten, wenn ein Rückruf zu riskant wäre." },
          { name: "Überall üben", desc: "Übe Platz an unterschiedlichen Orten und Untergründen, damit {dogName} überall zuverlässig reagiert, nicht nur in der gewohnten Umgebung." },
        ],
        frequency: ["Täglich üben", "Handzeichen immer mitgeben", "Distanz nur langsam steigern"],
        watchFor: ["Zügiges Ablegen", "Bleibt liegen bis zur Auflösung", "Reagiert auch auf das Handzeichen"],
        gos: ["Am Ablege-Ort belohnen", "Deutliches Handzeichen", "Ruhig auflösen"],
        noGos: ["Nicht ranrufen zum Ablegen", "Nicht drücken oder schieben", "Nicht zu schnell steigern"],
      },
      {
        title: "Bleib unter Ablenkung",
        intro: "{dogName} bleibt zuverlässig, auch wenn es spannend wird, an der Tür, am Auto, an der Gefahrenstelle.",
        steps: [
          { name: "Kurz und nah starten", desc: "Sag Bleib, warte 2 Sekunden, geh zurück und belohne. Baue Zeit und Distanz getrennt auf, nie beides gleichzeitig." },
          { name: "Dauer steigern", desc: "Verlängere die Wartezeit langsam auf 10, dann 30 Sekunden, bevor du Distanz dazunimmst." },
          { name: "Ablenkung einbauen", desc: "Übe, während du dich bewegst, ein Leckerli fallen lässt oder es an der Tür klingelt. Belohne das Bleiben." },
          { name: "Klares Auflösewort", desc: "Beende jedes Bleib mit einem festen Wort, etwa Okay. Nur dann darf {dogName} sich lösen, nicht von allein." },
          { name: "In den Alltag übertragen", desc: "Nutze Bleib in echten Situationen, an der Kasse, beim Schuhe-Anziehen, vor dem Auto, damit es alltagssicher wird." },
        ],
        frequency: ["Täglich kurze Einheiten", "Dauer und Distanz getrennt", "Immer klar auflösen"],
        watchFor: ["Bleibt trotz Ablenkung", "Wartet auf das Auflösewort", "Ruhige Körperhaltung"],
        gos: ["In kleinen Schritten steigern", "Klar auflösen", "Ruhe belohnen"],
        noGos: ["Nicht zu schwer starten", "Nicht ohne Auflösewort enden", "Nicht schimpfen bei Fehler"],
      },
      {
        title: "Zu mir, die Not-Position",
        intro: "{dogName} kommt auf ein Wort sofort dicht an dein Bein, an engen Wegen, bei Radfahrern oder anderen Hunden.",
        steps: [
          { name: "Position ans Bein locken", desc: "Locke {dogName} mit einem Leckerli an deine Seite, sodass er dicht neben deinem Bein steht. Sag Zu mir und belohne genau dort." },
          { name: "Aus der Bewegung", desc: "Sag im Gehen Zu mir und locke ihn an dein Bein. Belohne mehrfach an der Bein-Naht, damit die Position sich lohnt." },
          { name: "In Ruhe festigen", desc: "Übe, dass er auch mal einige Schritte dicht an dir bleibt, bevor er sich wieder lösen darf." },
          { name: "An echten Engstellen nutzen", desc: "Setze Zu mir bewusst ein, wenn ein Radfahrer oder Hund kommt. So hast du {dogName} sicher an deiner Seite statt im Weg." },
          { name: "Belohnung ausschleichen", desc: "Wenn die Position sicher sitzt, belohne nicht mehr jedes Mal, sondern unregelmäßig. So bleibt Zu mir spannend und zuverlässig." },
        ],
        frequency: ["Täglich in den Spaziergang einbauen", "Belohnung an der Bein-Naht", "Kurz halten, dann auflösen"],
        watchFor: ["Kommt zügig an die Seite", "Bleibt kurz dicht bei dir", "Orientiert sich an dir"],
        gos: ["An der Bein-Position belohnen", "Ruhig und freundlich", "Früh genug ansagen"],
        noGos: ["Nicht zerren", "Nicht festhalten", "Nicht zu lange am Stück verlangen"],
      },
      {
        title: "Warte an Tür und Auto",
        intro: "{dogName} stürmt nicht aus Tür oder Auto, die häufigste Situation, in der Hunde ausbüxen.",
        steps: [
          { name: "Hand an die Tür, nicht öffnen", desc: "Fass den Griff an. Wird {dogName} hektisch, lass wieder los. Nur Ruhe bringt den nächsten Schritt." },
          { name: "Spaltweise öffnen", desc: "Öffne die Tür minimal. Drängt er vor, schließ wieder. Öffne weiter nur bei ruhigem Warten." },
          { name: "Auflösen kontrollieren", desc: "{dogName} geht erst raus, wenn du es freigibst, etwa mit Okay, nie von allein." },
          { name: "Am Auto sichern", desc: "Übe besonders am geöffneten Auto: erst wird die Leine angelegt, dann kommt die Freigabe. Nie ohne Leine rausspringen lassen." },
          { name: "Konsequent bleiben", desc: "Lass {dogName} an JEDER Tür und JEDEM Ausstieg warten, auch wenn es mal eilig ist. Erst die Konsequenz macht es zur festen Regel." },
        ],
        frequency: ["Bei jeder Tür und jedem Ausstieg", "Immer erst Freigabe", "Auto immer mit Leine"],
        watchFor: ["Wartet ruhig", "Springt nicht vor", "Wartet aufs Auflösewort"],
        gos: ["Nur bei Ruhe öffnen", "Klar freigeben", "Am Auto immer zuerst die Leine"],
        noGos: ["Nicht rausstürmen lassen", "Nicht ohne Freigabe", "Auto nie ungesichert öffnen"],
      },
      {
        title: "Schau, die Not-Aufmerksamkeit",
        intro: "{dogName} nimmt auf ein Wort Blickkontakt zu dir auf, bevor er auf eine Gefahr fixiert.",
        steps: [
          { name: "Blick belohnen", desc: "Halte ein Leckerli an dein Gesicht und sag Schau. Sobald {dogName} in deine Augen schaut, markiere mit Fein und belohne." },
          { name: "Ohne Leckerli am Gesicht", desc: "Sag nur Schau. Schaut er, sofort belohnen. So löst das Wort den Blick aus, nicht das Leckerli." },
          { name: "Leichte Ablenkung", desc: "Übe an ruhigen Orten mit etwas Ablenkung. Schaut {dogName} auf Schau weg von der Ablenkung zu dir, feiere das." },
          { name: "Vor der Fixierung einsetzen", desc: "Nutze Schau, sobald du eine mögliche Gefahr früh siehst, etwa einen Hund oder Radfahrer. Du holst {dogName}s Aufmerksamkeit, bevor er sich festbeißt." },
          { name: "Immer wieder auffrischen", desc: "Setze Schau regelmäßig in echten Momenten ein, sobald sich draußen etwas Spannendes zeigt. Je öfter du früh reagierst, desto verlässlicher wird der Blick." },
        ],
        frequency: ["Täglich mehrfach kurz", "Vom Ruhigen ins Ablenkende", "Immer sofort belohnen"],
        watchFor: ["Schneller Blick zu dir", "Löst sich von der Ablenkung", "Reagiert auf das Wort allein"],
        gos: ["Blick sofort belohnen", "Früh einsetzen", "Ruhig bleiben"],
        noGos: ["Nicht zu spät einsetzen", "Nicht den Kopf festhalten", "Nicht genervt wiederholen"],
      },
      {
        title: "Maulkorb ohne Stress",
        intro: "{dogName} akzeptiert den Maulkorb entspannt, unverzichtbar für Tierarzt, Notfall oder wenn er Pflicht ist.",
        steps: [
          { name: "Maulkorb positiv einführen", desc: "Leg den Maulkorb hin und belohne jedes Interesse. Füttere durch das Gitter, damit {dogName} den Maulkorb mit Gutem verbindet." },
          { name: "Schnauze selbst reinstecken", desc: "Halte ein Leckerli hinten im Maulkorb, sodass {dogName} die Schnauze von selbst hineinsteckt. Noch nicht schließen." },
          { name: "Kurz schließen", desc: "Schließ den Verschluss für 1 Sekunde, belohne, öffne wieder. Steigere die Dauer sehr langsam." },
          { name: "In Bewegung tragen", desc: "Lass {dogName} den geschlossenen Maulkorb erst kurz, dann länger beim Spaziergang tragen. Immer wieder durch das Gitter belohnen." },
          { name: "Regelmäßig auffrischen", desc: "Setz den Maulkorb ab und zu kurz auf, auch ohne Anlass, und belohne. So bleibt er entspannt und ist im Ernstfall kein Stress." },
        ],
        frequency: ["Täglich 2 bis 3 Minuten", "Dauer sehr langsam steigern", "Immer positiv beenden"],
        watchFor: ["Steckt die Schnauze freiwillig rein", "Bleibt ruhig beim Tragen", "Kein Kratzen oder Panik"],
        gos: ["Durch das Gitter belohnen", "In winzigen Schritten", "Immer freiwillig"],
        noGos: ["Nicht überstülpen", "Nicht zu lange zu früh", "Nie erzwingen"],
      },
    ],
    abschluss: {
      title: "Abschluss",
      subtitle: "Dein Sicherheitsnetz für {dogName}",
      paras: [
        "Diese 10 Kommandos sind kein einmaliges Projekt, sondern ein Sicherheitsnetz, das du immer wieder auffrischst. Ein Signal, das monatelang nicht geübt wurde, verblasst, gerade die wichtigsten willst du frisch halten.",
        "Nimm dir vor, jede Woche zwei oder drei dieser Kommandos kurz zu wiederholen. Ein paar Minuten reichen, damit sie im Ernstfall sitzen.",
        "Denk daran: Diese Übungen sollen {dogName} schützen, nicht unter Druck setzen. Baue sie ruhig und mit viel Belohnung auf, dann reagiert er im entscheidenden Moment freudig statt ängstlich.",
        "Wenn du irgendwo feststeckst, ist dein persönlicher KI-Trainer jederzeit für dich da. Du kannst ihm sogar ein Foto oder Video von {dogName} zeigen und bekommst konkrete Hilfe.",
      ],
    },
  },

  pulling: {
    coverTitle: "Leinenführungs-Plan für",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Warum dieser Plan genau so aufgebaut ist",
      subtitle: "Entspannt von Anfang an",
      paras: [
        "{dogName} bringt seine ganz eigene Geschichte, sein Temperament und seine Erfahrungen mit. Genau das macht ihn einzigartig und erklärt, warum Leinenführung sich manchmal herausfordernd anfühlt.",
        "Seine Energie und sein Bewegungsdrang sind nicht das Problem, sondern Hinweise darauf, wie wichtig klare Orientierung für ihn ist. Wenn {dogName} an der Leine zieht, zeigt er damit oft Aufregung, Erwartung oder innere Anspannung.",
        "Leinenthemen entstehen häufig, wenn der Hund schneller ist als der Mensch, äußerlich und innerlich. Es fehlt dann nicht an Gehorsam, sondern an ruhiger, verständlicher Führung im Alltag.",
        "Dieser Plan ist dafür gedacht, dir und {dogName} einen klaren, gut machbaren Weg zu geben. Im Mittelpunkt steht eure Orientierung zueinander, nicht Kontrolle oder Druck.",
      ],
    },
    how: {
      title: "So setzt du die Übungen richtig um",
      paras: [
        "Die Übungen in diesem Plan bauen Schritt für Schritt aufeinander auf. Ihr startet mit ruhigen Grundlagen, damit {dogName} lernen kann, sich an dir zu orientieren, bevor es spannender wird.",
        "Wenn die Basis sitzt, kommen Übungen hinzu, die seine Aufmerksamkeit festigen und in Bewegung bringen. {dogName} kennt bereits einige Signale, diese nutzen wir, um ihm Sicherheit und Klarheit an der Leine zu geben.",
        "Später werden die Inhalte nach und nach in euren Alltag übertragen, etwa auf normalen Spaziergängen oder in aufregenderen Situationen. So lernt {dogName}, dass sich das Gelernte nicht nur zu Hause oder in ruhiger Umgebung lohnt.",
        "Du musst nicht alles auf einmal umsetzen. Ein bis zwei gut gemachte Übungen pro Spaziergang reichen und sind wertvoller als viele schnelle Versuche ohne Ruhe und Wiederholung.",
      ],
    },
    exercises: [
      {
        title: "Ruhiger Start an der Haustür",
        intro: "Ruhiger Start mit klarer Führung bestimmt den gesamten Spaziergang.",
        steps: [
          { name: "Leine anlegen und kurz warten", desc: "Leine anlegen und ruhig stehen bleiben. Keine Bewegung nach vorne, kein Losgehen. Kurz warten, bis ein ruhiger Zustand erreicht ist." },
          { name: "Türgriff anfassen, ohne zu öffnen", desc: "Den Türgriff berühren. Entsteht Hektik, Springen oder Drängeln, Griff wieder loslassen und kurz warten. Ruhe ermöglicht den nächsten Schritt, Unruhe stoppt den Ablauf." },
          { name: "Tür einen Spalt öffnen", desc: "Die Tür nur minimal öffnen. Wird nach vorne gedrängt, Tür wieder schließen und warten. Bleibt es ruhig, die Tür weiter öffnen." },
          { name: "Erster Schritt nach draußen", desc: "Zuerst selbst nach draußen gehen. Das Folgen erfolgt ohne Vorbeidrängen. Bei Drängeln einen Schritt zurückgehen, Tür wieder halb schließen, kurz warten und erneut versuchen." },
          { name: "Draußen kurz stehen bleiben", desc: "Draußen 2 bis 5 Sekunden stehen bleiben. Leine locker halten. Kurz ankommen lassen und bewusst ruhig starten." },
          { name: "Losgehen erst bei lockerer Leine", desc: "Erst bei lockerer Leine losgehen. Ziehen bedeutet Stopp. Locker bedeutet Weitergehen." },
        ],
        frequency: ["Bei jedem Spaziergang einmal durchführen", "2 bis 4 Minuten am Anfang einplanen", "Lieber zwei kurze Versuche als einen langen"],
        watchFor: ["Ruhe vor Geschwindigkeit", "Entspannte, stabile Körperhaltung", "Leine bleibt locker"],
        gos: ["Tür öffnet sich nur bei Ruhe", "Kleine Pausen bewusst zulassen", "Ruhig loben bei Orientierung"],
        noGos: ["Nicht ziehen oder zerren", "Nicht schimpfen oder hektisch reden", "Nicht nachgeben bei Drängeln"],
      },
      {
        title: "Orientierung am Bein",
        intro: "Orientierung an der Position der führenden Person.",
        steps: [
          { name: "Locker losgehen", desc: "Ganz normal starten. Die Leine ist locker, das Tempo ruhig. Es geht um einen entspannten Einstieg, nicht um Perfektion." },
          { name: "Eigenen Bereich festlegen", desc: "Seitlich neben dir laufen lassen, nicht vor dir. Einen kleinen Bereich neben dem Bein vorstellen, in dem Bewegung erlaubt ist. Sobald deutlich vorgelaufen wird, wird gestoppt." },
          { name: "Ziehen stoppt sofort", desc: "Sobald Spannung auf der Leine entsteht, ruhig stehen bleiben. Kein Zurückziehen und keine Worte. Stillstand ist die klare Konsequenz." },
          { name: "Warten, bis die Leine wieder locker wird", desc: "Kurz abwarten. Oft folgt ein Umdrehen oder ein Schritt zurück. In dem Moment, in dem die Leine locker wird, geht es weiter." },
          { name: "Bewegung ist die Belohnung", desc: "Weitergehen erfolgt nur bei lockerer Leine. So entsteht die Verknüpfung: Anpassung bringt Fortschritt." },
          { name: "Wiederholen und normal weiterlaufen", desc: "Das wiederholt sich mehrmals während des Spaziergangs. Ruhig bleiben, konsequent handeln und kein großes Thema daraus machen." },
        ],
        frequency: ["Bei jedem Spaziergang integrieren", "5 bis 10 Minuten pro Runde", "Lieber mehrere kurze Sequenzen"],
        watchFor: ["Dein Tempo bestimmt den Ablauf", "Leine bleibt locker", "Ruhig bleiben, nicht diskutieren"],
        gos: ["Still stehen bei Zug", "Weitergehen bei Lockerheit", "Nähe ruhig bestätigen"],
        noGos: ["Nicht ziehen oder zerren", "Nicht dauernd ansprechen", "Nicht schneller werden bei Zug"],
      },
      {
        title: "Richtungswechsel ohne Ansage",
        intro: "Aufmerksamkeit bei der Bezugsperson statt nach vorne zu ziehen.",
        steps: [
          { name: "Normal laufen und Leine locker halten", desc: "Entspannt geradeaus gehen. Es wird ruhig mitgelaufen, ohne ständiges Ansprechen. Die Übung funktioniert nur bei eigener Ruhe." },
          { name: "Richtungswechsel aus dem Alltag heraus", desc: "Plötzlich die Richtung wechseln, ohne etwas zu sagen. Nicht hektisch, aber klar. Einfach umdrehen oder links bzw. rechts weitergehen." },
          { name: "Aufmerksamkeit entsteht von selbst", desc: "Es wird wahrgenommen, wohin die führende Person geht. Folgen mit kurzer Verzögerung ist völlig in Ordnung." },
          { name: "Keine Worte, keine Korrekturen", desc: "Keine Erklärungen, nur Führung über Bewegung. Bei kurzer Irritation ruhig in der neuen Richtung weitergehen." },
          { name: "Bei Zug wieder stoppen", desc: "Entsteht Spannung auf der Leine, ruhig stehen bleiben. Sobald die Leine wieder locker ist, in der gewählten Richtung weitergehen." },
          { name: "Ruhig bestätigen", desc: "Gutes Folgen kann kurz gelobt oder bestätigt werden. Ruhig und klar, ohne Aufregung." },
        ],
        frequency: ["2 bis 3 Richtungswechsel pro Spaziergang", "Kurz und gezielt einsetzen", "Nur bei lockerer Leine starten"],
        watchFor: ["Keine Ankündigungen", "Bewegung statt Worte", "Ruhig und klar bleiben"],
        gos: ["Sanft, aber eindeutig drehen", "Lockerheit bestätigen", "Konsequent bleiben"],
        noGos: ["Nicht vorher warnen", "Nicht rucken oder reißen", "Nicht hektisch werden"],
      },
      {
        title: "Stehen bleiben bei Zug",
        intro: "Locker laufen bringt ans Ziel.",
        steps: [
          { name: "Losgehen wie bei einem normalen Spaziergang", desc: "Entspannt starten und laufen lassen. Die Übung entsteht direkt aus dem Alltag." },
          { name: "Spannung früh erkennen", desc: "Sobald die Leine straff wird, sofort reagieren. Nicht erst nach mehreren Schritten, sondern direkt beim ersten Zug." },
          { name: "Sofort stehen bleiben", desc: "Komplett stoppen. Kein Weitergehen, keine Worte, kein Druck. Einfach ruhig warten." },
          { name: "Spannung wird selbst gelöst", desc: "Oft folgt ein Umdrehen, Zurückgehen oder Umpositionieren. In dem Moment, in dem die Leine wieder locker ist, passt es." },
          { name: "Weitergehen als klare Belohnung", desc: "Sobald die Leine locker ist, weitergehen. Die Logik ist eindeutig: Locker bedeutet Fortschritt." },
          { name: "Immer gleich bleiben", desc: "Jedes Mal identisch handeln. So wird der Ablauf klar, verständlich und fair." },
        ],
        frequency: ["Bei jedem Ziehen anwenden", "Stopps nur wenige Sekunden", "Mehrfach pro Spaziergang"],
        watchFor: ["Sofort stoppen bei Zug", "Geduldig warten", "Weitergehen nur bei Lockerheit"],
        gos: ["Ruhig stehen bleiben", "Konsequentes Weitergehen", "Lockerheit belohnen"],
        noGos: ["Nicht weiterlaufen trotz Zug", "Nicht ziehen oder festhalten", "Nicht schimpfen"],
      },
      {
        title: "Ablenkungen ruhig passieren",
        intro: "Ruhig und ansprechbar, auch bei Ablenkung.",
        steps: [
          { name: "Ablenkung früh erkennen", desc: "Bei Hund, Mensch oder Reiz früh entscheiden, welcher Abstand Ruhe ermöglicht." },
          { name: "Abstand als Werkzeug nutzen", desc: "Einen Bogen gehen, Straßenseite wechseln oder Distanz vergrößern. Abstand ist sauberes Training." },
          { name: "Tempo beibehalten", desc: "Ruhig weitergehen. Kein Stehenbleiben zum Beobachten. Bei Fixieren in Bewegung bleiben und Abstand schaffen." },
          { name: "Ziehen vergrößert den Abstand", desc: "Nicht Richtung Ablenkung gehen. Distanz erhöhen oder leicht abdrehen, bis die Leine locker ist." },
          { name: "Ruhige Momente bestätigen", desc: "Blickkontakt oder lockere Leine ruhig loben oder kurz belohnen." },
          { name: "Training kurz halten", desc: "Wenige erfolgreiche Situationen sind besser als viele überfordernde. Ziel sind Erfolgserlebnisse." },
        ],
        frequency: ["1 bis 2 Ablenkungen pro Spaziergang", "Mit großem Abstand starten", "Dauer langsam steigern"],
        watchFor: ["Abstand hält Ruhe", "Tempo bleibt konstant", "Nicht fixieren lassen"],
        gos: ["Bögen laufen", "Frühzeitig Abstand schaffen", "Orientierung belohnen"],
        noGos: ["Nicht frontal rein", "Nicht stehen bleiben und starren", "Nicht korrigieren aus Stress"],
      },
      {
        title: "Ruhiger Spaziergangsabschluss",
        intro: "Ruhiges Ankommen nach dem Spaziergang.",
        steps: [
          { name: "Tempo in den letzten Minuten reduzieren", desc: "Kurz vor dem Zuhause bewusst langsamer werden. Ein ruhiger, klarer Abschluss statt Hektik." },
          { name: "Leine locker, Körpersprache ruhig", desc: "Entspannt bleiben und die Leine locker halten. Der Spaziergang fährt herunter, nicht hoch." },
          { name: "Vor der Haustür kurz stoppen", desc: "Vor dem Öffnen kurz stehen bleiben. Ankommen lassen, statt hineinzuschießen." },
          { name: "Tür nur bei Ruhe öffnen", desc: "Bei Drängeln, Springen oder Zug kurz warten. Die Tür öffnet sich erst bei Ruhe." },
          { name: "Ruhig reingehen", desc: "Zuerst hineingehen, folgen lassen. Keine Eile, kein Ziehen. Ruhe bringt Bewegung." },
          { name: "Spaziergang bewusst beenden", desc: "Drinnen Leine ab, ruhig bestätigen, fertig. Ein klarer und entspannter Abschluss." },
        ],
        frequency: ["Bei jedem Spaziergang anwenden", "Letzte Minuten bewusst nutzen", "Kein Zeitdruck am Ende"],
        watchFor: ["Tempo langsam reduzieren", "Tür nur bei Ruhe", "Leine bleibt locker"],
        gos: ["Ruhiger Abschluss", "Kurze Pausen zulassen", "Klar und entspannt bleiben"],
        noGos: ["Nicht hektisch werden", "Nicht ziehen lassen", "Nicht durchdrücken bei Drängeln"],
      },
      {
        title: "Tempo-Wechsel als Aufmerksamkeits-Tool",
        intro: "Unvorhersehbare Tempo-Änderungen zwingen den Hund, sich an dir zu orientieren.",
        steps: [
          { name: "Normales Tempo halten", desc: "Starte den Spaziergang in deinem üblichen Tempo. Die Leine ist locker, {dogName} läuft entspannt mit. Erst der Rhythmus, dann der Wechsel." },
          { name: "Plötzlich verlangsamen", desc: "Ohne Ankündigung das Tempo halbieren. Schritt für Schritt deutlich langsamer werden. {dogName} muss sich anpassen, sonst läuft er vor." },
          { name: "Anpassung sofort belohnen", desc: "Bei Tempo-Anpassung an der Bein-Position: FEIN, kleines Leckerli direkt an der Hose. Du wirst zum Tempo-Geber, nicht der Geruch vor der Nase." },
          { name: "Plötzlich beschleunigen", desc: "Nach einigen Schritten langsam: ohne Vorwarnung in zügiges Tempo wechseln, fast Joggen. {dogName} muss wieder mitziehen." },
          { name: "Pro Spaziergang 6 bis 10 Wechsel", desc: "Über den Spaziergang verteilt mehrere Tempo-Wechsel. Kein Schema, unvorhersehbar. Genau das ist der Reiz." },
          { name: "Variation mit 90-Grad-Drehungen", desc: "Statt Tempo-Wechsel auch mal eine kurze 90-Grad-Drehung. Gleiche Mechanik: {dogName} folgt, FEIN + Leckerli an der Bein-Position." },
        ],
        frequency: ["Bei jedem Spaziergang einbauen", "6 bis 10 Wechsel verteilt"],
        watchFor: ["Wechsel ohne Ankündigung", "Anpassung sofort belohnen"],
        gos: ["Unberechenbar bleiben", "Belohnung an der Bein-Naht"],
        noGos: ["Vorher 'jetzt aufpassen' sagen", "Bei Vorlaufen schimpfen"],
      },
      {
        title: "Schnüffel-Pause als Belohnung",
        intro: "Schnüffeln ist Bedürfnis. Wir nutzen es als Belohnung für lockere Leine.",
        steps: [
          { name: "Lockere Phase erkennen", desc: "Beobachte {dogName} bewusst auf dem Spaziergang. Wann läuft er entspannt mit lockerer Leine? Diese Momente sind Belohnungs-Gelegenheiten." },
          { name: "Schnüffel-Spot freigeben", desc: "Wenn die Leine locker ist und ein Schnüffel-Ort kommt: ruhig SCHNÜFFEL sagen und die Leine etwas länger lassen. {dogName} darf bewusst und ausgiebig schnüffeln." },
          { name: "60 bis 90 Sekunden Zeit", desc: "Lass {dogName} eine Minute oder länger schnüffeln, wenn es ein interessanter Spot ist. Schnüffeln baut Stress ab und ist anstrengender als Laufen." },
          { name: "Klares Ende signalisieren", desc: "Beende die Pause mit einem Signal wie WEITER. Locke {dogName} kurz mit einem Leckerli zurück an die Bein-Position. Lockere Leine: weiter geht's." },
          { name: "Bei Zug: keine Pause", desc: "Wenn {dogName} zum Schnüffel-Ort zieht, gibt es KEINE Pause. Erst zurück auf lockere Leine, dann auf deine Initiative die Freigabe. Du entscheidest." },
          { name: "Pro Spaziergang 4 bis 6 Pausen", desc: "Schnüffel-Pausen bewusst über den Spaziergang verteilen. Sie sind nicht Unterbrechung, sondern wertvoller Teil des Spaziergangs." },
        ],
        frequency: ["4 bis 6 Pausen pro Spaziergang", "Bewusst über die Strecke verteilen"],
        watchFor: ["Schnüffel-Pause nur bei lockerer Leine", "Du entscheidest, nicht der Hund"],
        gos: ["Pause als bewusste Belohnung", "60 bis 90 Sek Zeit geben"],
        noGos: ["Pause bei Zug", "Schnüffel-Spot direkt anlaufen lassen"],
      },
    ],
    abschluss: {
      title: "Abschluss",
      subtitle: "Viel Erfolg",
      paras: [
        "Leinenführung mit {dogName} ist kein einmaliges Projekt, sondern ein laufender Prozess. Es wird Tage geben, an denen es leicht läuft, und Tage, an denen es holpriger ist, und beides gehört dazu.",
        "Wichtiger als Perfektion ist, dass ihr gemeinsam Fortschritte macht. Schon kleine Veränderungen, etwa ein paar ruhige Schritte ohne Zug, sind ein Zeichen, dass {dogName} beginnt, sich mehr an dir zu orientieren.",
        "Deine ruhige, klare Konsequenz ist dabei entscheidend. Wenn du für {dogName} vorhersehbar bleibst und Regeln freundlich, aber verlässlich umsetzt, kann er sich an dir besser ausrichten.",
        "Nutze diesen Plan als Rahmen, den du immer wieder aufgreifst, wiederholst und an euren Alltag anpasst. So wird Leinenführung für dich und {dogName} nach und nach selbstverständlicher und entspannter.",
      ],
    },
  },

  energy: {
    coverTitle: "Energie- & Ruhe-Plan für",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Warum dieser Plan genau so aufgebaut ist",
      subtitle: "Entspannt von Anfang an",
      paras: [
        "{dogName} bringt von Natur aus viel Energie und Wachheit mit. Dieses Energielevel ist weder gut noch schlecht, sondern einfach ein Teil seiner Persönlichkeit und seines Typs.",
        "Alter, Rasse und Alltag bestimmen gemeinsam, wie leicht ein Hund zur Ruhe findet. Dazu kommen bisherige Lernerfahrungen, zum Beispiel wie oft {dogName} schon gelernt hat, sich auch bei Aufregung wieder zu sammeln.",
        "Wenn ein Hund wenig echte Erholung im Tag hat, staut sich innere Spannung auf. Bei {dogName} kann sich das dann in überdrehtem Verhalten, erschwertem Rückruf, stärkerem Ziehen an der Leine oder mehr Unsicherheit zeigen.",
        "Dieser Plan legt den Schwerpunkt auf Struktur, wiederkehrende Abläufe und gut vorbereitete Pausen. Ziel ist nicht, {dogName} maximal auszupowern, sondern eine bessere Balance zwischen Aktivität, Klarheit und Ruhe zu finden.",
      ],
    },
    how: {
      title: "So setzt du die Übungen richtig um",
      paras: [
        "Die Grundlage ist ein möglichst klarer Tagesrhythmus für {dogName}. Wiederkehrende Abläufe helfen ihm, vorherzusehen, wann eher Action und wann eher Entspannung angesagt ist.",
        "In den aktiveren Phasen bekommt {dogName} gezielte Aufgaben und kurze Einheiten, die Kopf und Körper ansprechen. Dazwischen folgen bewusste Ruhephasen, in denen er nicht bespielt wird, sondern lernen darf, herunterzufahren und abzuschalten.",
        "Statt dauernder Bespaßung geht es um Übungen, die seine Selbstregulation stärken, zum Beispiel kontrolliertes Warten, ruhiges Liegen auf dem Platz oder ein klar aufgebauter Rückruf mit Pause danach. So kann {dogName} Schritt für Schritt lernen, trotz Aufregung wieder in einen ruhigeren inneren Zustand zu kommen.",
        "Das Training findet im normalen Alltag statt, beim Spaziergang, im Haus und in kurzen, klar geplanten Sequenzen. Ein bis zwei Schwerpunkte pro Tag reichen dabei aus, denn für {dogName} ist die Qualität der Übung und die anschließende Erholung wichtiger als die Menge an Aktionen.",
      ],
    },
    exercises: [
      {
        title: "Den Ruhe-Ort etablieren um Energie zu senken",
        intro: "Diese Übung schafft eine feste Zone in der Wohnung, die für deinen Hund untrennbar mit dem Gefühl von körperlicher Schwere und Entspannung verknüpft wird.",
        steps: [
          { name: "Den reizarmen Platz wählen", desc: "Wähle einen Platz für das Körbchen oder die Decke, der abseits vom Geschehen liegt (eine ruhige Ecke, nicht im Flur oder vor der Terrassentür). Hier soll der Hund nichts bewachen oder beobachten müssen. Es ist seine \"Ladestation\"." },
          { name: "Mit der Leine begrenzen", desc: "Nimm deinen Hund in der Wohnung an die Leine. Das verhindert, dass er hibbelig hin und her rennt. Führe ihn wortlos und in Zeitlupe zu seinem Platz. Deine langsame Bewegung überträgt sich auf ihn." },
          { name: "Warten statt drücken", desc: "Stehe entspannt am Platz und warte. Gib kein Kommando wie \"Platz\". Warte einfach, bis dem Hund langweilig wird und er sich von allein hinsetzt oder hinlegt. Wir wollen, dass er die Ruhe selbst findet, nicht befohlen bekommt." },
          { name: "Die Ruhe füttern", desc: "Sobald der Hund liegt: Lege ganz ruhig ein Leckerchen zwischen seine Vorderpfoten. Sprich dabei nicht oder nur sehr leise und langgezogen (\"Priiima\"). Hektisches Lob würde ihn wieder hochfahren." },
          { name: "Intervalle dehnen", desc: "Lege das nächste Stück Futter erst nach ein paar Sekunden nach. Der Hund soll lernen: \"Liegenbleiben und Warten lohnt sich.\" Atme dabei selbst tief aus. Dein Ziel ist es, den Puls des Hundes durch deine Ruhe zu senken." },
          { name: "Klares Ende setzen", desc: "Bevor der Hund unruhig wird, beendest du die Übung mit einem Signal (z. B. \"Lauf\"). Erst jetzt darf er aufstehen. So lernt er: Auf der Decke ist Pause, Action gibt es erst nach der Freigabe." },
        ],
        frequency: ["3-5 Mal täglich üben", "Anfangs nur 2-3 Minuten"],
        watchFor: ["Deine eigene Energie muss extrem ruhig sein", "Füttere nur, solange der Kopf unten ist"],
        gos: ["Leckerchen langsam ablegen", "Tief und ruhig atmen"],
        noGos: ["Den Hund auf den Platz zwingen", "Mit hoher Stimme quietschen", "Aufregende Spiele auf der Decke spielen"],
      },
      {
        title: "Den Motor runterfahren durch Kauen",
        intro: "Diese Übung hilft deinem Hund, nach einer aktiven Phase körperlich und geistig durch eine monotone Tätigkeit in die Entspannung zu finden.",
        steps: [
          { name: "Den richtigen Zeitpunkt wählen", desc: "Nutze diese Übung gezielt nach Phasen hoher Erregung, also direkt nach dem Gassi gehen, nach Besuch oder wildem Spiel. Wir wollen den Übergang von \"High Power\" zu \"Schlafen\" erleichtern." },
          { name: "Das passende Material nutzen", desc: "Wähle etwas, an dem dein Hund mindestens 10-15 Minuten beschäftigt ist. Ein gefüllter Kong (zum Schlecken) oder eine feste Rinderkopfhaut (zum Kauen) eignen sich perfekt. Harte Arbeit macht müde." },
          { name: "Am Ruhe-Ort verknüpfen", desc: "Führe deinen Hund zu seinem Platz aus Übung 1. Gib ihm den Kauartikel nur dort. Er soll lernen: \"Auf dieser Decke passiert Entspannung, hier muss ich nicht herumrennen.\"" },
          { name: "Co-Regulation anbieten", desc: "Ist dein Hund sehr unruhig und trägt den Knochen hektisch herum? Setz dich zu ihm und halte den Kauartikel an einer Seite fest, während er an der anderen Seite kaut. Deine Ruhe und das Festhalten helfen ihm, sich stationär zu beruhigen." },
          { name: "Die körperliche Wirkung beobachten", desc: "Du wirst sehen, wie sich die Atmung verändert. Anfangs kaut er vielleicht hektisch, dann werden die Kieferbewegungen langsamer, die Augenlider schwerer. Das Kauen wirkt wie ein Ventil für die angestaute Energie." },
          { name: "Den Übergang zum Schlaf zulassen", desc: "Oft schlafen Hunde direkt über dem Kauen ein. Wenn der Hund das Interesse verliert und zur Seite kippt: Nimm den Rest leise weg oder lass ihn liegen. Lass den Hund jetzt schlafen - Ziel erreicht." },
        ],
        frequency: ["1x täglich fest einplanen (z. B. abends)", "Dauer: ca. 15 bis 30 Minuten"],
        watchFor: ["Der Artikel darf nicht zu schwer sein (Frust), aber auch nicht zu schnell weg (kein Effekt)", "Wasser bereitstellen (Kauen macht durstig)"],
        gos: ["Den Knochen für den Hund festhalten", "Gefüllte Schleck-Spielzeuge (Schlecken beruhigt noch schneller)"],
        noGos: ["Den Hund beim Kauen ärgern oder stören", "Den Artikel als Strafe wegnehmen"],
      },
      {
        title: "An- und Ausschalter trainieren",
        intro: "Diese Übung bringt deinem Hund bei, dass er selbst im wildesten Spiel ansprechbar bleibt und sich regulieren kann.",
        steps: [
          { name: "Das Spielzeug ruhig halten", desc: "Nimm ein Spielzeug (z. B. ein Zerrseil), das du gut kontrollieren kannst. Halte es zunächst nah bei dir und ruhig. Der Hund soll lernen: Spielzeug in der Hand bedeutet nicht automatisch Chaos." },
          { name: "Das Go starten", desc: "Gib ein Startsignal (z. B. \"Action\") und spiele kurz (!) und intensiv mit dem Hund. Zergeln, bewegen, Spaß haben. Lass die Energie für 10 bis 15 Sekunden hochkochen." },
          { name: "Das plötzliche Einfrieren", desc: "Stoppe das Spiel abrupt. Werde zur Salzsäule. Halte das Spielzeug fest an deinem Körper oder lass es schlaff herunterhängen, aber lass es nicht los. Bewege dich keinen Millimeter mehr." },
          { name: "Die Erwartungshaltung aushalten", desc: "Dein Hund wird wahrscheinlich weiterziehen, stupsen oder bellen. Ignoriere das. Sag nichts. Warte auf den Moment, in dem er merkt: \"Huch, die Party ist vorbei\" und kurz inne hält oder das Seil loslässt." },
          { name: "Ruhe reaktiviert das Spiel", desc: "Genau in der Sekunde, in der der Hund locker lässt, sich hinsetzt oder dich fragend anschaut: Zack! Das Spiel geht sofort weiter. Deine Bewegung ist die Belohnung für sein Innehalten." },
          { name: "Das Spiel ruhig beenden", desc: "Wiederhole den Wechsel von Start und Stopp ein paar Mal. Wichtig: Beende die Übung immer in einer ruhigen Phase. Tausche das Spielzeug gegen ein Leckerchen und pack es weg. Wir hören nicht auf dem Höhepunkt auf." },
        ],
        frequency: ["1-2 Mal täglich ins Spiel einbauen", "Nur wenige Minuten insgesamt"],
        watchFor: ["Sei klar in deiner Körpersprache: Aktiv vs. Eingefroren", "Das Spielzeug ist deine Fernbedienung für seine Energie"],
        gos: ["Sofort weiterspielen, wenn er ruhig ist", "Spaß haben"],
        noGos: ["\"Aus\" oder \"Nein\" brüllen", "Den Hund wild machen, bis er nicht mehr ansprechbar ist"],
      },
      {
        title: "Bewegungsreize aushalten um standhaft zu bleiben",
        intro: "Diese Übung bringt deinem Hund bei, dass er fliegenden oder rollenden Objekten nicht automatisch folgen muss, sondern bei dir die bessere Belohnung findet.",
        steps: [
          { name: "Die Sicherung anlegen", desc: "Nimm deinen Hund an eine kurze Leine und bitte ihn ins \"Sitz\" neben dir. Stelle sicher, dass die Leine so fixiert ist, dass er nicht losstarten kann, sollte er es doch versuchen. Du brauchst einen Ball oder ein Spielzeug in der Hand." },
          { name: "Den Reiz niedrig starten", desc: "Wirf den Ball nicht. Lass ihn erst einmal nur aus deiner Hand fallen oder rolle ihn ganz langsam einen Meter von dir weg. Ziel ist, dass der Reiz da ist, aber nicht maximal aufregend." },
          { name: "Den Impuls abfangen", desc: "Dein Hund wird wahrscheinlich zucken oder aufstehen wollen. Bleib ruhig stehen. Die Leine verhindert den Erfolg. Sage nichts, zieh nicht zurück, halte einfach nur stand." },
          { name: "Die Entscheidung belohnen", desc: "Sobald der Hund merkt \"Ich komme nicht hin\" und sich wieder hinsetzt oder dich anschaut: Bingo! Gib ihm sofort ein hochwertiges Leckerchen direkt aus deiner Hand. Er lernt: \"Der Ball bewegt sich, aber das Essen gibt es beim Menschen.\"" },
          { name: "Du verwaltest die Beute", desc: "Ganz wichtig: Der Hund darf zur Belohnung nicht zum Ball. Du gehst hin, hebst den Ball auf und steckst ihn ein. Das signalisiert: Bewegungen kontrollierst du, nicht der Hund." },
          { name: "Die Intensität steigern", desc: "Klappt das langsame Kullen, wirf den Ball mal leicht hoch oder rolle ihn schneller. Die Regel bleibt: Der Hund bleibt sitzen und kassiert bei dir ab. Nur Ruhe führt zum Erfolg." },
        ],
        frequency: ["5-10 Wiederholungen pro Einheit", "Übe auf weichem Untergrund (Garten/Wiese)"],
        watchFor: ["Leine muss den Hund halten, nicht deine Stimme", "Belohne bei dir, schick ihn nicht zum Ball"],
        gos: ["Ruhig stehen bleiben bei Impuls", "Belohnung kommt von dir, nicht vom Ball"],
        noGos: ["Ball werfen, bevor der Hund sitzt", "Schimpfen, wenn er zuckt", "Den Hund zur Belohnung hinterherhetzen lassen"],
      },
      {
        title: "Zeitlupen-Gehen nutzen",
        intro: "Diese Übung zwingt den Hund, sich extrem auf seine Schritte zu konzentrieren und sein Tempo drastisch zu drosseln, was automatisch den Puls senkt.",
        steps: [
          { name: "Das Tempo extrem drosseln", desc: "Beginne auf einem ruhigen Wegabschnitt. Nimm die Leine kurz, aber locker. Laufe nun nicht normal, sondern bewege dich demonstrativ in Zeitlupe. Setze ganz bewusst einen Fuß vor den anderen, als würdest du auf rohen Eiern balancieren." },
          { name: "Schritt für Schritt agieren", desc: "Mache einen Schritt, atme aus, mache den nächsten Schritt. Dein Hund wird anfangs irritiert sein und wahrscheinlich schneller laufen wollen. Da du dich aber kaum bewegst, muss er warten und sich anpassen." },
          { name: "Sanftes Ausbremsen", desc: "Will dein Hund an dir vorbeiziehen, bleibst du in deiner Zeitlupe einfach stehen oder blockierst ihn sanft mit deinem Bein. Werde nicht hektisch, rucke nicht an der Leine. Sei wie ein schwerer Fels, der sich nur langsam bewegt." },
          { name: "Konzentration belohnen", desc: "Sobald der Hund sich deinem extrem langsamen Rhythmus anpasst und dich vielleicht fragend anschaut (\"Warum schleichen wir?\"), lobst du ihn leise und gibst ein Leckerchen. Wichtig: Gib es im Gehen, bleib nicht extra stehen." },
          { name: "Die Synchronisation spüren", desc: "Du wirst merken, wie der Hund anfängt, seine Pfoten bewusster zu setzen. Diese Konzentration auf den eigenen Körper unterbricht den Tunnelblick und das hektische Scannen der Umgebung. Ihr bewegt euch im Einklang." },
          { name: "Als Cool-Down nutzen", desc: "Nutze diese Technik immer dann, wenn dein Hund draußen gerade hochgedreht ist (z. B. nach einer Hundebegegnung). Statt normal weiterzulaufen (was die Erregung hält), schaltest du für 20 Meter in den Zeitlupen-Modus, um ihn wieder zu erden." },
        ],
        frequency: ["Immer mal wieder 20-30 Meter auf dem Spaziergang", "Als bewusste Bremse bei Aufregung"],
        watchFor: ["Atme tief und hörbar aus - das ist ansteckend", "Deine Knie bleiben locker, nicht versteifen"],
        gos: ["Extrem langsam werden (Slomo)", "Den Hund beobachten, nicht korrigieren"],
        noGos: ["An der Leine rucken", "Hektisch werden, weil der Hund zieht", "Sprechen (lenkt nur ab)"],
      },
      {
        title: "Parkbank-Prinzip nutzen",
        intro: "Diese Übung trainiert die Frustrationstoleranz und die Fähigkeit, Reize einfach nur zu beobachten, ohne darauf reagieren zu müssen.",
        steps: [
          { name: "Den Beobachtungsposten wählen", desc: "Suche dir eine Parkbank oder eine Mauer an einem Ort, wo etwas los ist (z. B. im Park oder in der Nähe eines Supermarktes), aber genug Abstand herrscht. Setz dich hin. Dein Hund bleibt an der Leine." },
          { name: "Den Bewegungsradius begrenzen", desc: "Kürze die Leine so weit ein, dass dein Hund bequem sitzen oder liegen kann, aber nicht unruhig hin und her wandern kann. Das ständige Tigern hält den Adrenalinspiegel hoch. Wir beschränken ihn physisch auf den Ruhe-Modus." },
          { name: "Langeweile aushalten", desc: "Jetzt tust du: Nichts. Lies ein Buch, schau auf dein Handy oder beobachte die Wolken. Ignoriere deinen Hund. Er wird anfangs fiepen, zappeln oder Forderungen stellen. Das ist normaler Frustabbau. Bleib standhaft und reagiere nicht darauf." },
          { name: "Auf den Kipp-Punkt warten", desc: "Es wird einen Moment geben, in dem dein Hund aufgibt. Er atmet tief aus, senkt den Kopf oder legt sich endlich hin. Seine Körpersprache wechselt von \"Ich will hier weg!\" zu \"Na gut, dann warten wir halt.\"" },
          { name: "Die Ruhe bestätigen", desc: "Genau in diesem Moment des Loslassens legst du ihm ruhig und wortlos ein Leckerchen zwischen die Vorderpfoten (wie in Übung 1). Bestätige ihn dafür, dass er sich mit der Situation abgefunden hat." },
          { name: "Ruhiger Aufbruch", desc: "Bleib noch einen Moment sitzen. Wenn ihr aufbrecht, dann langsam und ohne Hektik. Der Aufbruch ist keine Belohnung (\"Juhu, endlich Action!\"), sondern einfach nur ein Ortswechsel." },
        ],
        frequency: ["1-2 Mal pro Woche gezielt einplanen", "5 bis 15 Minuten (bis der Hund entspannt)"],
        watchFor: ["Wenn der Hund bellt: Sitz es aus. Gehe nicht, solange er fordert", "Wähle den Ort so, dass keine Hunde direkt an euch vorbeilaufen müssen"],
        gos: ["Leine unter den Fuß klemmen (Hände frei haben)", "Ein Buch mitnehmen (signalisiert: Ich habe Zeit)"],
        noGos: ["Den Hund zutexten (\"Ist ja gut, wir gehen gleich\")", "Aufbrechen, während der Hund noch zappelt"],
      },
      {
        title: "WARTE als Impuls-Bremse",
        intro: "Das wichtigste Signal für innere Ruhe: bewusstes Warten lernen.",
        steps: [
          { name: "Mit dem Futternapf starten", desc: "Halte den vollen Futternapf auf Hüfthöhe, {dogName} steht vor dir. Sage einmal ruhig WARTE und senke den Napf langsam Richtung Boden." },
          { name: "Bei Hinstürmen: hochziehen", desc: "Stürmt {dogName} nach vorne oder will hochspringen, bevor der Napf am Boden ist: Napf wieder hoch, ohne Wort. Keine Diskussion, einfach nur die Hand bewegen." },
          { name: "Erst bei Ruhe am Boden", desc: "Sobald {dogName} ruhig bleibt, kann der Napf den Boden erreichen. 1 bis 2 Sekunden warten lassen. Erst dann: Freigabe-Wort wie HOL DIR oder OK." },
          { name: "Steigerung in Sekunden-Schritten", desc: "Über die Woche von 1 Sek auf 3, 5, dann 10 Sekunden steigern. Bei Erfolgsquote unter 7 von 10 zurück auf die niedrigere Stufe." },
          { name: "Auf andere Situationen übertragen", desc: "Wenn 10 Sekunden vor dem Futter sitzen: WARTE auch vor der Haustür einsetzen, vor dem Spielzeug-Wurf, vor dem Auto-Einstieg. Drei Alltags-Situationen täglich." },
          { name: "WARTE wird Alltags-Reflex", desc: "Nach 3 bis 4 Wochen wird WARTE ein zuverlässiges Werkzeug. Du nutzt es überall im Alltag, ohne nachzudenken. Frustrationstoleranz wächst messbar." },
        ],
        frequency: ["3 bis 4 Mini-Situationen täglich", "Über 3 bis 4 Wochen festigen"],
        watchFor: ["Niemals länger als 15 Sek halten", "Bei zu langem Warten wird es Strafe"],
        gos: ["Wartezeit langsam steigern", "Freigabe gehört zur Übung"],
        noGos: ["WARTE ohne Auflösung", "Bei Aufstehen schimpfen"],
      },
      {
        title: "Anti-Stress-Schnüffelteppich",
        intro: "Nasenarbeit auf der Schnüffelmatte ist meditatives Anti-Stress-Tool.",
        steps: [
          { name: "Schnüffelmatte richtig vorbereiten", desc: "Eine Schnüffelmatte mit dichten Stoff-Streifen. Trockenfutter oder kleine Leckerli in die Streifen drücken, einige tiefer, einige oberflächlicher." },
          { name: "An ruhigem Ort platzieren", desc: "Lege die Matte an einen festen, ruhigen Ort. Nicht im Durchgangsbereich, nicht vor dem Sofa. Hier ist Konzentrations-Zone." },
          { name: "Übergeben mit ruhigem Signal", desc: "Führe {dogName} ruhig zur Matte, sage SUCH in tiefer Stimme. Setze dich entspannt daneben oder geh weg, je nachdem was er besser kann." },
          { name: "Nicht stören, nicht helfen", desc: "{dogName} arbeitet selbstständig. Nicht eingreifen, nicht hinzeigen, nicht ansprechen. Das wäre Störung. Nur ruhig daneben sein oder beobachten aus der Ferne." },
          { name: "Wirkung beobachten", desc: "Du wirst sehen, wie sich {dogName}s Körper langsam entspannt: Atmung wird ruhiger, Schwanz hängt locker, Augenlider werden schwerer. Nach 15 bis 20 Min ist das Bedürfnis befriedigt." },
          { name: "Nach dem Schnüffeln: Ruhe", desc: "Wenn {dogName} fertig ist: Matte wegräumen, keine direkte Folgeaktivität. Oft schläft er direkt ein. Das ist genau richtig. Ziel erreicht." },
        ],
        frequency: ["1 bis 2 Mal täglich", "15 bis 25 Min pro Session"],
        watchFor: ["Nicht eingreifen oder helfen", "Matte regelmäßig waschen"],
        gos: ["Selbstständige Arbeit", "Ruhe danach zulassen"],
        noGos: ["Bei Frust 'helfen'", "Direkt danach wieder aktivieren"],
      },
    ],
    abschluss: {
      title: "Abschluss",
      subtitle: "Viel Erfolg",
      paras: [
        "Ruhe ist für {dogName} genauso ein Lerninhalt wie Sitz oder Platz. Mit klaren Signalen, wiederkehrenden Ritualen und gut vorbereiteten Pausen kann er Stück für Stück lernen, seine Energie besser zu sortieren.",
        "Veränderung entsteht nicht durch einzelne intensive Tage, sondern durch viele ähnliche, überschaubare Wiederholungen. Gerade bei einem wachen Hund wie {dogName} ist es normal, dass Fortschritte und Rückschritte sich abwechseln.",
        "Klarheit im Alltag und ein verlässlicher Rhythmus geben {dogName} Sicherheit. Wenn er weiß, was als Nächstes ungefähr passiert, fällt es ihm leichter, sich zu entspannen und deine Entscheidungen anzunehmen.",
        "Die weitere Arbeit besteht darin, diese Struktur im Alltag beizubehalten, zu beobachten und behutsam anzupassen. So kann {dogName} neue Gewohnheiten festigen, und ihr beide findet nach und nach eine ruhigere, gut planbare Balance zwischen Aktivität und Erholung.",
      ],
    },
  },

  anxiety: {
    coverTitle: "Alleine-bleiben Plan für",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Warum dieser Plan genau so aufgebaut ist",
      subtitle: "Entspannt von Anfang an",
      paras: [
        "{dogName} reagiert sensibel auf das Alleinbleiben. Das ist kein Fehler im Verhalten, sondern ein Ausdruck der starken Bindung an dich und seines Bedürfnisses nach Sicherheit.",
        "Trennungsstress entsteht meist dann, wenn das Alleinsein nicht in kleinen, klaren Schritten geübt wurde. Der Hund weiß nicht, wann du wiederkommst, und sein Nervensystem schlägt Alarm.",
        "Bei {dogName} kann sich das in Bellen, Winseln, Pacing, Speicheln oder zerstörerischem Verhalten zeigen. Das sind keine Trotzreaktionen, sondern echte Stresssignale.",
        "Dieser Plan baut Allein-Zeit ruhig und systematisch auf, ohne Dramatisierung beim Gehen oder Kommen. Ziel ist, dass {dogName} lernt: 'Mein Mensch geht, und kommt zuverlässig wieder. Ich bin sicher.'",
      ],
    },
    how: {
      title: "So setzt du die Übungen richtig um",
      paras: [
        "Die Reihenfolge ist entscheidend: erst die Vor-Signale entkoppeln, dann Sekunden allein, dann Minuten, dann Stunden. Wer zu schnell steigert, baut die Angst nur neu auf.",
        "Beobachte {dogName} per Video, wenn du übst. Bauchgefühl reicht nicht, weil Hunde oft erst nach Minuten Stress zeigen. Smartphone-Kamera in den Raum stellen und live mitschauen.",
        "Reagiere niemals auf Jaulen mit Zurückkommen. Auch keine dramatischen Verabschiedungen. Je banaler du das Gehen machst, desto weniger Bedeutung bekommt es für {dogName}.",
        "Bei schwerer Trennungsangst gehört ein Tierarzt-Check dazu. Manchmal hilft kurzfristige medizinische Unterstützung, damit das Verhaltenstraining überhaupt greifen kann.",
      ],
    },
    exercises: [
      {
        title: "Vor-Signale entkoppeln",
        intro: "Bevor du gehen kannst, muss {dogName} lernen, dass Schlüssel, Schuhe und Jacke nichts bedeuten.",
        steps: [
          { name: "Den Auslöser-Stack identifizieren", desc: "Beobachte 2-3 Tage genau, ab welchem Moment {dogName} unruhig wird. Typische Auslöser: Schlüssel klimpern, Schuhe anziehen, Jacke greifen, Türklinke berühren. Notiere die Reihenfolge." },
          { name: "Jeden Auslöser einzeln zeigen", desc: "Greife 10x täglich den Schlüssel, halte ihn in der Hand, leg ihn wieder hin. Nicht gehen. {dogName} schaut, wartet, verliert dann das Interesse. Genau das ist das Lernziel." },
          { name: "Schuhe anziehen ohne zu gehen", desc: "Mehrmals täglich Schuhe an, ein paar Schritte durch die Wohnung, Schuhe wieder aus. Niemals nach dem Anziehen tatsächlich die Tür öffnen. Der Auslöser verliert seine Bedeutung." },
          { name: "Tür-Routine entwerten", desc: "Türklinke berühren, Tür minimal öffnen, wieder schließen. 5-7 mal hintereinander. Kein Drama, keine Ansprache. {dogName} lernt: 'Tür geht auf' bedeutet nicht automatisch 'Mensch geht weg'." },
          { name: "Mischen und beiläufig machen", desc: "Verwebe die Auslöser in deinen ganz normalen Alltag: Schlüssel beim Telefonieren in der Hand, Jacke beim Aufräumen tragen. Ziel ist, dass nichts mehr ein klares Signal ist." },
          { name: "Erfolg überprüfen", desc: "Nach 7-10 Tagen reagiert {dogName} nicht mehr auf Schlüssel oder Schuhe. Erst dann gehen wir zur nächsten Übung über. Wenn er noch reagiert, hier länger bleiben." },
        ],
        frequency: ["10-15 Wiederholungen pro Auslöser täglich", "Über 1-2 Wochen konsequent", "Beiläufig in den Alltag einbauen"],
        watchFor: ["Subtile Stress-Anzeichen erkennen (Hecheln, Speichelschlucken, Augen weit)", "Niemals an einem Tag radikal steigern"],
        gos: ["Auslöser ohne Aufmerksamkeit nutzen", "Ruhig und beiläufig bleiben"],
        noGos: ["Tatsächlich gehen, wenn {dogName} reagiert", "Auslöser nur für echtes Gehen verwenden"],
      },
      {
        title: "Sekunden-Phasen aufbauen",
        intro: "Allein bleiben wird wie ein Muskel trainiert. Wir starten mit Sekunden und steigern langsam.",
        steps: [
          { name: "Im selben Raum starten", desc: "{dogName} liegt entspannt im Wohnzimmer. Du stehst auf, gehst zur Tür, drehst dich um, kommst zurück. 5 Sekunden Abwesenheit aus seiner Sicht. Wiederhole 5 mal." },
          { name: "In den Nachbarraum", desc: "Geh aus dem Raum, schließe die Tür halb, warte 5 Sekunden, komm zurück. Beim Zurückkommen: keine Begrüßung. Du gehst beiläufig weiter, als wäre nichts." },
          { name: "Türe ganz schließen", desc: "Gleicher Ablauf, aber jetzt schließt du die Türe wirklich. {dogName} hört nichts mehr von dir. 5 Sekunden, 10, dann wieder rein. Steigerung in 5-Sekunden-Schritten." },
          { name: "Stress-Anzeichen erkennen", desc: "Beobachte beim Reinkommen: war {dogName} aufgestanden? Jault er? Pacing? Bei Stress-Anzeichen sofort zurück auf die letzte Stufe, die geklappt hat." },
          { name: "Bis 1 Minute steigern", desc: "Nach 1 Woche solltest du 60 Sekunden Abwesenheit schaffen, ohne dass {dogName} stresst. Wenn das stabil läuft, wechselst du zur nächsten Übung." },
          { name: "Gehen und Kommen entdramatisieren", desc: "Niemals 'Tschüss' oder 'Hallo' rufen. Kein freudiges Wiedersehen. Du gehst, du kommst. Banal. Genau das nimmt die emotionale Spannung raus." },
        ],
        frequency: ["3-5 Sessions pro Tag", "Über 1-2 Wochen Sekunden auf 1 Minute steigern", "Niemals 2 Stufen an einem Tag"],
        watchFor: ["Erst Stress-Frei, dann steigern", "Video-Kontrolle hilft beim ehrlichen Bewertern"],
        gos: ["Beiläufig gehen, beiläufig kommen", "Konsequent in 5-10-Sek-Schritten steigern"],
        noGos: ["Bei Jaulen zurückkommen", "Mit hoher Stimme begrüßen"],
      },
      {
        title: "Der Allein-Zeit-Kong",
        intro: "Ein exklusives, hochwertiges Beschäftigungs-Spielzeug verknüpft Allein-Sein mit etwas Positivem.",
        steps: [
          { name: "Den Special-Kong vorbereiten", desc: "Stopfe einen Kong mit Lieblings-Inhalt: Nassfutter, Hähnchenstücke, weicher Käse. Friere ihn 4-6 Stunden ein. Dieser Kong existiert NUR während deiner Abwesenheit." },
          { name: "Übergabe-Ritual etablieren", desc: "Kurz vor dem Gehen: leg den Kong auf {dogName}s Decke. Sprich nicht. {dogName} soll sich auf den Kong stürzen, nicht auf dich." },
          { name: "Gleichzeitig die Tür", desc: "Während {dogName} am Kong arbeitet, gehst du beiläufig zur Tür. Erst 30 Sekunden weg, dann 2 Minuten, dann 5. {dogName} ist beschäftigt, du bist weg, alles ok." },
          { name: "Kong nach Rückkehr wegnehmen", desc: "Sobald du wieder da bist, nimmst du den Kong ruhig weg, auch wenn noch Inhalt drin ist. Der Kong ist ausschließlich Allein-Zeit-Werkzeug, nie für gemeinsame Zeit." },
          { name: "Mit den Stufen kombinieren", desc: "Verbinde den Kong mit den Sekunden-Phasen-Übungen. Je länger {dogName} am Kong bleibt, ohne Stress zu zeigen, desto länger darfst du wegbleiben." },
          { name: "Variation einbauen", desc: "Wenn der Kong langweilig wird: Schnüffelmatte als Alternative, oder Naturkauartikel. Wichtig bleibt: das Werkzeug gibt es nur dann, wenn du wirklich weggehst." },
        ],
        frequency: ["Bei jeder geplanten Abwesenheit", "Kong auf Vorrat einfrieren (3-4 Stück bereit)", "Nicht bei jeder Mini-Übung, sonst verliert er den Effekt"],
        watchFor: ["Frisst {dogName} überhaupt vom Kong? Wenn nein, ist der Stress noch zu hoch", "Inhalt nach Vorliebe wählen (gefroren = länger)"],
        gos: ["Wertvollster Inhalt, den {dogName} kennt", "Übergabe wortlos und ruhig"],
        noGos: ["Kong vor dem Gehen schon füttern", "Kong auch für andere Anlässe nutzen"],
      },
      {
        title: "Tür-Routine ohne Drama",
        intro: "Die Art, wie du gehst und wiederkommst, prägt die emotionale Verknüpfung des Allein-Seins.",
        steps: [
          { name: "10 Minuten vor dem Gehen ruhig werden", desc: "Keine Aufregung, kein Anstarren, keine extra Streicheleinheiten. Du lebst deinen Alltag, {dogName} lebt seinen. Das senkt sein Anti-Stress-Niveau." },
          { name: "Wortlos gehen", desc: "Keine Abschiedsworte, kein Streicheln vor dem Gehen, kein 'Sei brav'. Du gehst einfach. Genau wie zur Toilette oder ins Schlafzimmer." },
          { name: "Kong als Brücke", desc: "Den Allein-Zeit-Kong geben, dann ruhig zur Tür. Tür auf, raus, Tür zu. Maximal 5 Sekunden zwischen Kong-Übergabe und geschlossener Tür." },
          { name: "Bei Rückkehr 2 Minuten ignorieren", desc: "Tür auf, reinkommen, Schuhe ausziehen, beiläufig in der Wohnung weitermachen. Erst nach 2 Minuten ruhig 'Hallo'. {dogName} darf sich erst beruhigen, bevor es Aufmerksamkeit gibt." },
          { name: "Begrüßung nur bei ruhigem Hund", desc: "Wenn {dogName} aufgeregt springt: weiterdrehen, ignorieren. Sobald die 4 Pfoten ruhig am Boden sind: kurzes, ruhiges Hallo, ein Streicheln, fertig." },
          { name: "Routine konsequent halten", desc: "Über Wochen wird das Ankommen und Gehen banal. {dogName} hört auf, deine Anwesenheit als emotionales Ereignis zu erleben. Sie wird Normalität." },
        ],
        frequency: ["Bei jedem Gehen und Kommen", "Konsequenz auch bei kurzen Erledigungen", "Familien-Briefing wichtig"],
        watchFor: ["Auch andere Familienmitglieder müssen mitmachen", "Eine emotionale Begrüßung kostet eine Woche Lerneffekt"],
        gos: ["Beiläufig, wortlos, ruhig", "Nach Heimkehr erstmal weiterleben"],
        noGos: ["Drama beim Gehen oder Kommen", "Schlechtes Gewissen zeigen"],
      },
      {
        title: "Stunden-Phasen aufbauen",
        intro: "Wenn Minuten klappen, baust du langsam zu Stunden auf. Mit Video-Kontrolle.",
        steps: [
          { name: "Kamera einrichten", desc: "Smartphone oder Smart-Camera so platzieren, dass {dogName}s Liege-Bereich sichtbar ist. Live-Stream auf dein Zweitgerät, damit du jederzeit nachschauen kannst." },
          { name: "30 Minuten als erste Stufe", desc: "Geh 30 Minuten weg (kurzer Spaziergang um den Block, Einkaufen). Schau alle 5-10 Minuten per Video. Wenn ruhig: bis 30 Min durchziehen. Bei Stress: zurück auf 15 Min." },
          { name: "In 15-Min-Schritten steigern", desc: "Nach 1 Woche 30 Min stabil: auf 45 Min steigern. Dann 1 Stunde, dann 90 Min, dann 2 Stunden. Pro Stufe mindestens 4-5 Tage Sicherheit." },
          { name: "Kong-Wirkung dokumentieren", desc: "Wie lange arbeitet {dogName} am Kong? Wenn er nach 10 Min aufhört und ruhig liegt: Top. Wenn er den Kong gar nicht anfasst: Stress zu hoch, kürzere Allein-Zeit." },
          { name: "Stress-Symptome richtig deuten", desc: "Pacing, Hecheln ohne Hitze, Speicheln, Bellen, Pfoten lecken: alles Stress. Schlafen, ruhig liegen, Kong bearbeiten: alles gut. Ehrlich beobachten." },
          { name: "Bei Rückschritt zurückrudern", desc: "Wenn {dogName} an einem Tag plötzlich stresst, obwohl die Stufe vorher klappte: zur letzten erfolgreichen Stufe zurück. 1 Woche dort bleiben, dann neu probieren." },
        ],
        frequency: ["3-4 echte Übungs-Abwesenheiten pro Woche", "Steigerung über 6-8 Wochen", "Niemals direkt mehrere Stunden testen"],
        watchFor: ["Video-Kontrolle ist Pflicht, kein Schätzen", "Echte Toilettenpause vor langer Allein-Zeit"],
        gos: ["Stufen sauber halten, ehrlich beobachten", "Tempo nach {dogName} richten"],
        noGos: ["Bei Stress länger durchziehen", "Mehrere Stunden auf einmal wagen"],
      },
      {
        title: "Berechenbare Tagesroutine",
        intro: "Hunde mit Trennungsangst entspannen massiv, wenn der Tag vorhersehbar wird.",
        steps: [
          { name: "Feste Zeiten festlegen", desc: "Spaziergang morgens 7:00, Frühstück 7:30, Mittagsruhe 11:00, Nachmittagsspaziergang 16:00, Abendessen 18:00, Nachtruhe 22:00. So konkret wie möglich." },
          { name: "Plan sichtbar machen", desc: "Schreib die Routine an den Kühlschrank. Familienmitglieder müssen sich daran halten. Eine Person, die zu unerwarteten Zeiten kommt und geht, sabotiert die Routine." },
          { name: "Allein-Zeiten einplanen", desc: "Bau die Übungs-Allein-Zeiten fest ein. Z.B. immer nach dem Frühstück eine kurze Allein-Phase, immer am Nachmittag eine längere. {dogName} kann das Muster erlernen." },
          { name: "Bewegung vor Allein-Zeit", desc: "15-20 Minuten Spaziergang oder Schnüffelarbeit vor jeder geplanten Allein-Phase. Müder Hund + berechenbare Struktur = halbierte Trennungsangst." },
          { name: "Wochenende einhalten", desc: "Hunde unterscheiden nicht zwischen Werktag und Sonntag. Wenn am Wochenende plötzlich alles anders ist, verliert die Routine ihre Wirkung. Konsistenz bleibt." },
          { name: "Über 4 Wochen festigen", desc: "Nach 4 Wochen konsequenter Routine ist sie internalisiert. {dogName} weiß, was wann kommt, und kann Allein-Zeiten ohne Anti-Stress-Niveau erleben." },
        ],
        frequency: ["Täglich, auch Wochenende", "4-6 Wochen für stabile Internalisierung", "Plan sichtbar aufhängen"],
        watchFor: ["Familien-Konsequenz ist Pflicht", "Auch 15 Min Verspätung können {dogName} verunsichern"],
        gos: ["Schreib die Routine sichtbar auf", "Bewusste Pausen einplanen"],
        noGos: ["An manchen Tagen die Routine kippen", "Spontane Pläne ohne Vorbereitung"],
      },
      {
        title: "Sicherheits-Decke als mobiler Anker",
        intro: "Eine spezielle Decke wird zum Sicherheits-Symbol, das überall mitgenommen werden kann.",
        steps: [
          { name: "Decke auswählen", desc: "Eine kuschelige, mittelgroße Decke (60x80cm), die {dogName} schon kennt und mag. Diese Decke bekommt ab jetzt einen Sonderstatus." },
          { name: "Positive Verknüpfung aufbauen", desc: "Lege die Decke an den festen Ruhe-Ort. Sage ruhig 'PLATZ', führe {dogName} drauf. Belohnung mit weichem Leckerli, ruhig streicheln. 5-7 mal täglich." },
          { name: "Nur für Ruhe verwenden", desc: "Die Decke ist NIE für Spiel, NIE für Aufregung. Wenn {dogName} mit der Decke spielen will, weg damit. Sie steht ausschließlich für Entspannung." },
          { name: "Auf Allein-Zeit übertragen", desc: "Während deiner Abwesenheit: Decke liegt am festen Platz, Kong drauf. {dogName} verbindet Decke + Kong + Ruhe. Diese Triade wird zum Anker." },
          { name: "Mobile Variante einführen", desc: "Eine kleinere Reise-Variante der Decke besorgen oder eine mit deinem Geruch. Diese kann mit zu Schwiegereltern, ins Auto, zum Tierarzt. Überall: Decke = Sicherheit." },
          { name: "Geruch frisch halten", desc: "Decke nicht zu oft waschen. Dein Geruch und der Ruhe-Geruch von {dogName} machen sie wertvoll. Alle 2-3 Wochen reicht für die Hygiene." },
        ],
        frequency: ["Decke täglich nutzen", "Mobile Variante bei Bedarf", "Geruch und Ruhe-Verknüpfung pflegen"],
        watchFor: ["Decke nur bei Ruhe einsetzen", "Niemals als Erziehungsmittel"],
        gos: ["Decke als positiver Anker pflegen", "Mobile Variante bewusst etablieren"],
        noGos: ["Decke zu oft waschen", "Mit der Decke spielen lassen"],
      },
      {
        title: "Lange Abwesenheit alltagsfähig machen",
        intro: "Wenn 2-3 Stunden klappen, gehen wir den Schritt zur echten Arbeits-Abwesenheit.",
        steps: [
          { name: "Generalprobe planen", desc: "Wähle einen Tag, an dem du flexibel bist. Plane eine Abwesenheit von 4 Stunden mit echter Toilettenpause davor, gefrorenem Kong, eingerichteter Kamera." },
          { name: "Erste Stunde live beobachten", desc: "In der ersten Stunde alle 5-10 Min per Video kontrollieren. {dogName} sollte am Kong arbeiten, dann ruhig liegen. Bei Stress: zurück." },
          { name: "Mittlere Phase ist die kritische", desc: "Zwischen Stunde 1 und 3: {dogName} hat den Kong durch, jetzt kommt die echte Allein-Zeit. Schläft er? Liegt er ruhig? Genau das ist der Test." },
          { name: "Letzte Stunde beobachten", desc: "Manche Hunde werden gegen Ende wieder unruhig (sie spüren intuitiv die Rückkehr-Zeit). Wenn Pacing einsetzt: Notiere die Zeit, übernächste Übung 30 Min früher zurück." },
          { name: "Bei Erfolg auf 5-6 Stunden steigern", desc: "Eine Woche stabile 4 Stunden, dann 5, dann 6. Bei 6 Stunden Toilettenpause durch Hundesitter oder Mittagsspaziergang einplanen." },
          { name: "Backup-Plan etablieren", desc: "Für Tage länger als 5-6 Stunden: Hundesitter, Dogwalker, Nachbarn, Familie. Auch ein gut allein-bleibender Hund braucht Bewegung und sozialen Kontakt." },
        ],
        frequency: ["1-2 echte Generalproben pro Woche", "Über 4-6 Wochen aufbauen", "Backup-Plan einrichten"],
        watchFor: ["Bei Rückschritt nicht durchziehen", "Toilettenpause für jeden Hund Pflicht"],
        gos: ["Plan mit Pufferzeiten", "Backup-Optionen aufbauen"],
        noGos: ["Spontan 7-8 Stunden allein lassen", "Auf Bauchgefühl statt Video vertrauen"],
      },
    ],
    abschluss: {
      title: "Abschluss",
      subtitle: "Viel Erfolg",
      paras: [
        "Trennungsangst zu überwinden ist kein Sprint, sondern ein Marathon in kleinen Schritten. Mit {dogName} hast du einen treuen Partner, der bereit ist zu lernen, dass dein Weggehen kein Verlust bedeutet.",
        "Die wichtigste Veränderung passiert dabei oft nicht beim Hund, sondern bei dir. Wenn du gelassen gehst und kommst, ohne Drama, ohne schlechtes Gewissen, lernt {dogName} dass Allein-Sein einfach ein normaler Teil seines Tages ist.",
        "Bleib geduldig, auch wenn es Rückschritte gibt. Stressige Tage, Krankheit, Umzüge oder andere Veränderungen können das Gelernte kurz wackeln lassen. Das ist normal, kein Versagen.",
        "Die Werkzeuge in diesem Plan sind dauerhaft. Auch wenn {dogName} später entspannt allein bleibt, kannst du Kong, Decke und Routine immer wieder als Wartung nutzen, damit die Sicherheit stabil bleibt.",
      ],
    },
  },

  aggression: {
    coverTitle: "Aggressions-Kontrolle für",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Warum dieser Plan genau so aufgebaut ist",
      subtitle: "Sicher und unter Schwellenwert",
      paras: [
        "{dogName} reagiert in bestimmten Situationen mit Bellen, Knurren oder Lunge-Versuchen. Das ist kein Charakterfehler, sondern meist ein Schutzverhalten: er fühlt sich überfordert und versucht, Abstand zu schaffen.",
        "Aggression entsteht fast immer aus Unsicherheit, schlechten Erfahrungen oder einem zu engen Reiz-Korridor. Der Hund ist über seinem Schwellenwert, an dem er noch lernen kann, und reagiert nur noch.",
        "Bei {dogName} können verschiedene Auslöser zusammenwirken: andere Hunde, Jogger, Fahrradfahrer, fremde Menschen. Jeder hat seinen eigenen kritischen Abstand, ab dem die Reaktion beginnt.",
        "Dieser Plan arbeitet konsequent UNTER dem Schwellenwert. Wir setzen niemals auf Konfrontation, sondern auf Distanz, Vorhersehbarkeit und positive Verknüpfungen. Das ist der einzige Weg, der nachhaltig funktioniert.",
      ],
    },
    how: {
      title: "So setzt du die Übungen richtig um",
      paras: [
        "Sicherheit zuerst. Bevor du irgendetwas trainierst, brauchst du einen positiv konditionierten Maulkorb und ein klares Verständnis von {dogName}s Schwellenwert-Distanz pro Auslöser-Typ.",
        "Die Übungen bauen aufeinander auf: erst Werkzeuge etablieren (Maulkorb, Marker), dann Schwellenwert beobachten, dann unter Schwellenwert trainieren, dann schrittweise näher rangehen.",
        "Du wirst NIEMALS die Distanz reduzieren, solange {dogName} reagiert. Erst wenn er drei Sessions hintereinander bei einer Distanz ruhig bleibt, gehst du 2-5m näher ran. Nie schneller.",
        "Wenn doch etwas eskaliert, wirf den Trainingsfortschritt nicht weg. Eine Eskalation kostet ca. 2 Wochen Lernfortschritt. Plane Fluchtwege, vermeide Hochrisiko-Strecken, halte die 72-Stunden-Stress-Erholungs-Regel ein.",
      ],
    },
    exercises: [
      {
        title: "Maulkorb positiv konditionieren",
        intro: "Bevor du den Maulkorb brauchst, muss {dogName} ihn als positiv erleben.",
        steps: [
          { name: "Den richtigen Maulkorb wählen", desc: "Korbmaulkorb (Baskerville Ultra oder BUMAS), kein Stoff-Maulschlinge. Der Hund muss hecheln und Wasser trinken können. Anpassung beim Fachhändler oder Hundetrainer." },
          { name: "Maulkorb sichtbar liegen lassen", desc: "Tag 1-3: leg den Maulkorb einfach in den Wohnraum, ohne Reaktion. {dogName} schnüffelt, ignoriert ihn, vielleicht inspiziert er ihn neugierig. Genau richtig." },
          { name: "Leckerli durchs Gitter geben", desc: "Tag 4-6: Halte den Maulkorb in der Hand, schiebe ein Leckerli durch die Gitterstäbe. {dogName} streckt die Nase rein, kassiert. Mehrere Male täglich, kurze Sessions." },
          { name: "Nase aktiv reinstecken lassen", desc: "Tag 7-10: {dogName} schiebt seine Schnauze von selbst in den Maulkorb, weil drinnen Leckerli warten. Du hältst noch, ziehst sofort wieder weg. Positive Verknüpfung sitzt." },
          { name: "Erste Tragezeiten", desc: "Tag 11-14: Maulkorb für 2-5 Sekunden schließen, sofort wieder ab. Leckerli durch die Gitter. Schritt für Schritt auf 1-2 Minuten Tragezeit steigern." },
          { name: "Niemals in Stress-Situationen einsetzen", desc: "Erst nach 14-21 Tagen positiver Verknüpfung: Maulkorb für den ersten Spaziergang. Auf einer ruhigen Strecke ohne Auslöser. Niemals zum ersten Mal in einer Stress-Situation aufsetzen." },
        ],
        frequency: ["Mehrmals täglich kurze Sessions", "Über 2-3 Wochen aufbauen", "Tragezeit langsam steigern"],
        watchFor: ["Niemals zu Stress kombinieren", "Pause bei Frust-Anzeichen"],
        gos: ["Hochwertige Belohnung durch Gitter", "Sehr geduldig vorgehen"],
        noGos: ["Maulkorb in Krise zum ersten Mal aufsetzen", "Stoff-Maulschlinge verwenden"],
      },
      {
        title: "Schwellenwert finden und dokumentieren",
        intro: "Bevor du trainierst, musst du wissen, ab welcher Distanz {dogName} noch lernen kann.",
        steps: [
          { name: "Beobachtungs-Ort auswählen", desc: "Park-Eingang, Joggingstrecke oder ähnlich, wo Auslöser regelmäßig vorbeikommen. Du musst {dogName} sicher entfernen können, falls etwas eng wird." },
          { name: "Aus großer Distanz starten", desc: "Beginne bei 50-80 Meter. Beobachte {dogName} ganz genau: Mimik, Augen, Schwanz, Atmung. Notiere alles." },
          { name: "Schwellenwert-Signale erkennen", desc: "Erste Anzeichen: gespannte Mimik, fixierte Augen, steifer Schwanz, geschlossenes Maul, kurze Atem-Pause. Das ist AM Schwellenwert. Notiere die Distanz." },
          { name: "Reaktion bedeutet drüber", desc: "Bellen, Lunge-Versuch, Knurren: du bist DRÜBER. Sofort Distanz verdoppeln. Dort wird nichts gelernt, nur reagiert." },
          { name: "Pro Auslöser-Typ einzeln", desc: "Hunde, Jogger, Fahrrad, Kind, fremde Männer: jeder hat eigene Distanz. Notiere pro Auslöser in einem Tagebuch. Das ist deine Trainings-Karte." },
          { name: "Karte als Trainings-Boden", desc: "Diese Werte sind dein Trainings-Boden für die nächsten Wochen. Du arbeitest immer UNTER diesen Werten, niemals daran kratzen, niemals drüber." },
        ],
        frequency: ["4 Tage à 20-30 Min Beobachtungs-Sessions", "Pro Auslöser-Typ einzeln", "Notizen schriftlich führen"],
        watchFor: ["Stress-Signale früh erkennen", "Distanz lieber zu groß als zu klein"],
        gos: ["Tagebuch mit Distanzen pro Auslöser", "Geduldig und genau beobachten"],
        noGos: ["Schwellenwert testen, indem du näher rangehst", "Reaktion in Kauf nehmen für 'Feedback'"],
      },
      {
        title: "Schau-Hin Spiel mit echten Auslösern",
        intro: "{dogName} lernt: Auslöser anschauen ist okay, dann gibts Belohnung bei mir.",
        steps: [
          { name: "Sicher unter Schwellenwert positionieren", desc: "Mit {dogName} an einem Ort, wo Auslöser in deiner notierten sicheren Distanz auftreten. Du hast Hochwertiges in der Hosentasche (Hähnchen, Käse, Leberwurst)." },
          { name: "Auslöser taucht auf, du wartest", desc: "Sobald {dogName} den Auslöser entdeckt: keine Reaktion von dir. Warte ab. {dogName} schaut, registriert, ist aber unter dem Reaktions-Niveau." },
          { name: "SCHAU als Marker setzen", desc: "Sage in dem Moment, in dem {dogName} hingeschaut hat: SCHAU + sofort ein Leckerli, das du gut sichtbar hochhältst, so dass {dogName} zu dir blickt." },
          { name: "Belohnung am Bein", desc: "Wenn {dogName} dich anschaut: hochwertiges Leckerli, ruhig gefüttert. Er lernt: 'Auslöser sehen = Erwartung auf Belohnung beim Halter'. Emotionale Verknüpfung verändert sich." },
          { name: "Wiederholen bei jedem Sichtkontakt", desc: "Bei jedem neuen Auslöser: SCHAU + Belohnung. Pro Session 6-10 Wiederholungen. Niemals OBERHALB des Schwellenwerts, das ist Konfrontation." },
          { name: "Distanz erst nach Erfolg verringern", desc: "Wenn 3 Sessions hintereinander 8 von 10 Reaktionen sauber laufen, 2-5m näher rangehen. Niemals schneller. Plateaus sind normal." },
        ],
        frequency: ["3-4 Sessions pro Woche, 20-30 Min", "Niemals zwei verschiedene Auslöser-Typen pro Session"],
        watchFor: ["Distanz ist alles", "Erste Stress-Signale = Distanz vergrößern"],
        gos: ["Hochwertige Belohnung verwenden", "Konsequent unter Schwellenwert bleiben"],
        noGos: ["Auslöser provozieren", "Mehrere Auslöser-Typen mischen"],
      },
      {
        title: "Bogen-Technik bei Begegnungen",
        intro: "Wenn ein Auslöser zu eng kommt, brauchst du eine klare Ausweich-Strategie.",
        steps: [
          { name: "Fluchtwege vorab notieren", desc: "Bei der Spaziergangs-Planung: wo sind Seitenstraßen, Hofeingänge, Bushaltestellen? Diese sind deine Notfall-Ausstiege. Mental visualisieren." },
          { name: "Auslöser früh erkennen", desc: "Trainier dich darauf, Auslöser 30-50m vor {dogName} zu sehen. Sobald sichtbar: Entscheidung für Bogen oder Weitergehen treffen, bevor er reagiert." },
          { name: "Sanft umdrehen", desc: "Wenn Bogen nötig: sage ruhig BOGEN und dreh dich um 90 Grad weg. Nicht ruckartig, nicht panisch. Locke {dogName} mit Leckerli in die neue Richtung." },
          { name: "Entschieden weitergehen", desc: "Geh entschieden in die neue Richtung, nicht zögerlich. {dogName} folgt. Niemals zurückblicken oder anhalten, um zu schauen, was der Auslöser macht." },
          { name: "Außerhalb der Sicht-Linie belohnen", desc: "Sobald ihr aus der Sicht-Linie raus seid (Ecke, Hauseingang): 3 Leckerli ans Maul, ruhig WUNDERBAR sagen, einen Moment stehen. Ihr habt gewonnen." },
          { name: "Niemals einfach ausweichen", desc: "WICHTIG: niemals dem Auslöser ausweichen, ohne {dogName}s Aufmerksamkeit zu lenken. Sonst sieht er den Auslöser, du gehst weiter, Frust und Eskalation drohen." },
        ],
        frequency: ["Bei jeder akuten Situation", "Spaziergänge mit Fluchtwegs-Karte planen", "Üben in nicht-akuten Situationen"],
        watchFor: ["Frühe Auslöser-Erkennung trainieren", "Eigene Ruhe halten"],
        gos: ["Entschieden in Fluchtweg gehen", "Lockerli als Lock-Mittel parat"],
        noGos: ["Panisch fliehen", "Auslöser fixieren lassen"],
      },
      {
        title: "Anschauen-und-Abwenden",
        intro: "Nächste Stufe: {dogName} schaut den Auslöser an UND wendet sich von selbst ab.",
        steps: [
          { name: "Voraussetzung Schau-Hin sitzt", desc: "Diese Übung erst, wenn Schau-Hin zuverlässig läuft (8/10 Sessions sauber). Sonst ist {dogName} noch nicht bereit." },
          { name: "Unter Schwellenwert positionieren", desc: "Gleicher Setup wie bei Schau-Hin: Auslöser sichtbar, {dogName} unter Schwellenwert. Du bist ruhig, abwartend." },
          { name: "Hinschauen erlauben", desc: "{dogName} sieht den Auslöser. Diesmal warte ein paar Sekunden, ohne SCHAU zu sagen. {dogName} schaut, beobachtet, registriert. Du bleibst still." },
          { name: "Wegschauen abwarten", desc: "Wenn {dogName} VON SELBST den Blick abwendet: SOFORT Jackpot 3-4 Leckerli, ruhiges WUNDERBAR. Das ist der eigentliche Lerneffekt." },
          { name: "Wenn er starrt: leiser SCHAU-Hint", desc: "Sollte {dogName} mehr als 5-10 Sek starren, ohne abzuwenden: leiser SCHAU-Marker. Belohnung kommt, aber kleiner. Ziel bleibt das selbständige Abwenden." },
          { name: "Über Wochen automatisch", desc: "Nach 3-4 Wochen wendet sich {dogName} oft von selbst ab, ohne dass du eingreifen musst. Das ist Selbst-Regulation auf hohem Niveau." },
        ],
        frequency: ["2-3 Sessions pro Woche", "Erst nach gefestigtem Schau-Hin", "Pro Session 5-8 Wiederholungen"],
        watchFor: ["Geduldig auf selbständiges Abwenden warten", "Niemals Druck aufbauen"],
        gos: ["Selbständigkeit belohnen", "Ruhig und abwartend bleiben"],
        noGos: ["Vorschnell SCHAU sagen", "Frustriert werden bei langem Starren"],
      },
      {
        title: "Pufferzone vor erwarteten Begegnungen",
        intro: "Bei vorhersehbaren Begegnungen bereitest du {dogName} mental und räumlich vor.",
        steps: [
          { name: "Begegnungs-Hotspots identifizieren", desc: "Wo treffen wir typischerweise Auslöser? Park-Eingang, vor dem Bäcker, an der Bushaltestelle. Notiere die Stellen mental." },
          { name: "20m davor in den Modus", desc: "Bevor ihr den Hotspot erreicht: Leine etwas kürzer, Hosentaschen-Hand vorbereitet, SCHAU-Signal mental scharfgeschaltet. Du bist im Trainings-Modus." },
          { name: "Aktives Bei-Fuß bauen", desc: "20m vor und 20m nach dem Hotspot: {dogName} läuft eng am Bein, du belohnst alle 5-10 Schritte. Erhöhte Aufmerksamkeit, nicht durch Druck, sondern durch Belohnungs-Dichte." },
          { name: "Auslöser durch SCHAU oder Bogen", desc: "Wenn ein Auslöser auftaucht: SCHAU-Hin wie geübt oder Bogen, je nach Distanz. Du hast vorbereitet und bist nicht überrascht." },
          { name: "Nach Passage entspannen", desc: "Außerhalb des Hotspots: Leine wieder etwas länger, Belohnungs-Frequenz reduzieren, ruhig weiterlaufen. Schnüffel-Pause als Belohnung." },
          { name: "Routine wird Reflex", desc: "Nach 3-4 Wochen ist die Pufferzone-Routine reflexartig. Du machst das nicht mehr bewusst, sondern automatisch. {dogName} reagiert ruhiger auf bekannten Strecken." },
        ],
        frequency: ["Bei jedem Spaziergang an Hotspots", "Über 3-4 Wochen routiniert"],
        watchFor: ["Vorausplanung statt Reaktion", "Eigenes Niveau halten"],
        gos: ["Hotspots im Kopf vorbereiten", "Belohnungs-Dichte hochfahren"],
        noGos: ["Hotspots überraschen lassen", "Erst dann reagieren, wenn es eng wird"],
      },
      {
        title: "72-Stunden-Stress-Erholungs-Regel",
        intro: "Nach einer Eskalation oder Stress-Situation braucht {dogName} echte Erholung, bevor weiter trainiert wird.",
        steps: [
          { name: "Stress-Situation erkennen", desc: "Eskalation, Bellen, Lunge-Versuch, sehr enge Begegnung, ungewollter Auslöser-Kontakt: das alles ist eine Stress-Situation, die Stresshormone freisetzt." },
          { name: "Sofort Trainings-Pause", desc: "Direkt nach der Situation: 72 Stunden kein gezieltes Auslöser-Training. Nur ruhige, vertraute Spaziergänge in bekannter Umgebung." },
          { name: "Stress-Niveau natürlich abklingen", desc: "Stresshormone (Cortisol) brauchen 3 Tage zum vollständigen Abbau. In dieser Zeit ist {dogName} reaktiver, schneller getriggert. Das ist biologisch, nicht psychologisch." },
          { name: "Auslöser-Strecken meiden", desc: "Während der 72 Stunden bewusst die Hotspots umgehen. Andere Strecken wählen, ruhigere Zeiten nutzen. Das ist Schutz, kein Aufgeben." },
          { name: "Beruhigende Aktivitäten", desc: "Nasenarbeit, ruhige Schnüffel-Spaziergänge, Kong-Beschäftigung, Massage. Alles was {dogName} runterfährt. Keine aufregenden Spiele oder Hundekontakt." },
          { name: "Nach 72 Stunden behutsam zurück", desc: "Nach 3 Tagen: erste vorsichtige Trainings-Session in größerer Distanz als sonst. Beobachten, ob das Niveau wieder normal ist. Wenn ja: normales Training weiter." },
        ],
        frequency: ["Bei jeder Stress-Situation 72h Pause", "Beruhigende Aktivitäten täglich"],
        watchFor: ["Stress kumuliert über mehrere Tage", "Geduldig die Pause halten"],
        gos: ["Beruhigende Spaziergänge", "Bewusst Hotspots meiden"],
        noGos: ["Direkt am nächsten Tag wieder trainieren", "Eskalation als 'einmaliges Ereignis' abtun"],
      },
      {
        title: "Notfall-Protokoll bei Eskalation",
        intro: "Wenn doch was schiefgeht: klare Schritte, kein Chaos.",
        steps: [
          { name: "KEIN Schreien, KEIN Ziehen", desc: "Schritt 1 in einer Eskalation: ruhig bleiben. Schreien verstärkt {dogName}s Erregung enorm. Hektisches Ziehen verstärkt die Spannung." },
          { name: "Mit dem Körper drehen", desc: "Drehe deinen Körper zwischen {dogName} und den Auslöser. Du nimmst den Sichtkontakt weg, ohne an der Leine zu ziehen." },
          { name: "Entschieden weggehen", desc: "Sage einmal BOGEN und gehe entschieden in eine sichere Richtung. Mit Leckerli locken, nicht zerren. Mindestens 30m Distanz aufbauen." },
          { name: "Außerhalb der Sicht beruhigen", desc: "Wenn ihr außerhalb der Sicht-Linie seid: anhalten, 3 Leckerli ruhig füttern, WUNDERBAR sagen. {dogName} soll runterkommen." },
          { name: "Stress-Anzeichen einschätzen", desc: "Wie geht es {dogName}? Hechelt er noch? Pupillen weit? Zittert er? Wenn ja: noch mehr Distanz, ruhiger Ort, Wasser anbieten." },
          { name: "72-Stunden-Regel aktivieren", desc: "Nach der Eskalation: ab in den 72-Stunden-Stress-Erholungs-Modus (siehe Übung 7). Trainings-Pause, ruhige Aktivitäten, bewusst Hotspots meiden." },
        ],
        frequency: ["Nur bei tatsächlicher Eskalation", "Trockenübungen drinnen 1x pro Woche"],
        watchFor: ["Eigene Ruhe halten ist alles", "Niemals Hektik weitergeben"],
        gos: ["Ruhig, entschieden, weg", "Hochwertige Belohnung griffbereit"],
        noGos: ["Schreien oder Ziehen", "Auslöser nochmal nähern, um zu zeigen 'ist nicht schlimm'"],
      },
    ],
    abschluss: {
      title: "Abschluss",
      subtitle: "Viel Erfolg",
      paras: [
        "Aggression bei Hunden ist fast immer Selbstschutz. {dogName} reagiert so, weil er sich überfordert fühlt. Dein Job ist nicht, ihn zu 'umerziehen', sondern ihm Sicherheit zu geben.",
        "Wer Distanz, Schwellenwert und Geduld als Werkzeuge nutzt, hat den entscheidenden Vorteil gegenüber jeder Konfrontations-Methode. Es ist langsamer, aber dauerhaft.",
        "Rückschritte sind Teil des Prozesses. Eine Eskalation bedeutet nicht, dass die Arbeit umsonst war. Mit der 72-Stunden-Regel und ruhigen Aktivitäten kommst du schnell wieder auf den Weg.",
        "Halte das Tagebuch mit Schwellenwerten weiter aktiv. Dein Wissen über {dogName}s Reaktionen ist dein wichtigstes Werkzeug. Mit jedem Monat wirst du seine Signale besser lesen.",
      ],
    },
  },

  mouthing: {
    coverTitle: "Anti-Aufnehm Plan für",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Warum dieser Plan genau so aufgebaut ist",
      subtitle: "Sicherheit auf jedem Spaziergang",
      paras: [
        "{dogName} nimmt draußen alles auf, was nach etwas riecht. Das ist kein Erziehungsfehler, sondern ein natürlicher Trieb: der Nasentrieb plus Beuteinstinkt plus die Neugier eines wachen Hundes.",
        "Aufnehmen ist selbst-belohnend. {dogName} findet etwas, schluckt es, fertig. Es gibt keinen Grund für ihn, das nicht zu tun, solange er nichts Besseres bei dir bekommt.",
        "Dazu kommt: jeder Erfolg verstärkt das Verhalten. Ein einmal heimlich verschlucktes Brotstück bedeutet, dass der nächste Spaziergang noch intensiveres Suchen wird.",
        "Dieser Plan baut die Alternative auf: ein sauberes AUS-Signal, ein PFUI-Stop-Signal, Tausch-Geschäfte mit hoher Wertigkeit und Maulkorb-Sicherheit für Hochrisiko-Strecken. Du bekommst Kontrolle ohne Strafe.",
      ],
    },
    how: {
      title: "So setzt du die Übungen richtig um",
      paras: [
        "Du baust zuerst drinnen auf, bevor draußen geübt wird. Drinnen ist {dogName} weniger getrieben, die Signale können sauber konditioniert werden.",
        "AUS, PFUI und Tausch-Geschäft sind drei verschiedene Werkzeuge. Sie kommen NIEMALS als Strafe, sondern als Signale mit klarer Belohnungs-Alternative.",
        "Während der Aufbauphase ist der Maulkorb dein bester Freund an Hochrisiko-Strecken (vor Schulen, Mülltagen, Park-Eingängen). Das ist kein Eingeständnis, das ist Vernunft.",
        "Die Belohnungs-Wertigkeit muss IMMER höher sein als das, was draußen liegen könnte. Trockenfutter reicht nicht. Du brauchst Hähnchen, Wurst, Käse, etwas, das wirklich attraktiv ist.",
      ],
    },
    exercises: [
      {
        title: "AUS-Signal sauber aufbauen drinnen",
        intro: "{dogName} lernt drinnen, dass Hergeben sich lohnt — bevor wir nach draußen gehen.",
        steps: [
          { name: "Niedrigwertiges Objekt geben", desc: "Wähle ein einfaches Spielzeug, das {dogName} mag aber nicht über alles. Lass ihn damit spielen, im Maul tragen, ein paar Sekunden." },
          { name: "Hochwertige Belohnung zeigen", desc: "Halte ein wertvolles Leckerli (Hähnchen, Käse) auf Nase-Höhe. {dogName} riecht es, sieht es. Die Werts-Differenz zwischen Spielzeug und Leckerli ist alles." },
          { name: "Ruhig AUS sagen", desc: "Sage AUS in ruhiger, nicht-drohender Stimme. Nicht laut, nicht streng. {dogName} ist noch nicht konditioniert, das Wort muss positiv geladen werden." },
          { name: "Auf das Loslassen warten", desc: "{dogName} überlegt: Spielzeug behalten oder Leckerli holen? Meistens entscheidet er sich fürs Leckerli. Sobald er das Spielzeug fallen lässt: FEIN, Leckerli, ruhiges Lob." },
          { name: "Spielzeug zurückgeben", desc: "WICHTIG: nach 3-5 Sekunden gibst du das Spielzeug zurück. {dogName} lernt: AUS ist kein Verlust, sondern ein gutes Tauschgeschäft, das positiv endet." },
          { name: "Wertigkeit langsam steigern", desc: "Nach 2 Wochen mit einfachem Spielzeug: Lieblings-Spielzeug, dann Kauartikel, dann (vorsichtig) ein Knochen. Pro Stufe 5-7 Tage." },
        ],
        frequency: ["3-5 AUS-Sessions täglich drinnen", "Über 2-3 Wochen aufbauen", "Wertigkeit langsam steigern"],
        watchFor: ["Belohnung muss IMMER wertvoller sein als das Objekt", "Niemals reissen oder Hand-ins-Maul"],
        gos: ["Ruhig und entspannt bleiben", "Spielzeug zurückgeben"],
        noGos: ["AUS mit drohender Stimme sagen", "Hand ins Maul stecken"],
      },
      {
        title: "PFUI als Stop-Signal drinnen",
        intro: "PFUI verhindert die Aufnahme, BEVOR sie passiert. Ganz wichtig: PFUI ist kein Schimpfwort.",
        steps: [
          { name: "Trainings-Setup", desc: "Lege ein niedrigwertiges Leckerli auf den Boden, das {dogName} eigentlich haben darf. Hochwertiges Tausch-Leckerli bereithalten." },
          { name: "Im Moment des Hinbeugens", desc: "Sobald {dogName} sich zum Leckerli am Boden beugt: sage PFUI in fester, ruhiger Stimme. Nicht laut, nicht strafend. Klar und eindeutig." },
          { name: "Sofort mit Alternative locken", desc: "PFUI darf NIEMALS allein stehen. Direkt danach: hochwertiges Leckerli aus der Hand zeigen, {dogName} zur Seite locken." },
          { name: "Bei Wegdrehen belohnen", desc: "Sobald {dogName} sich vom Bodenleckerli abwendet und zu dir kommt: FEIN, Mega-Belohnung, ruhiges Lob. Das Bodenleckerli verschwindet." },
          { name: "Wertigkeit der Bodensache steigern", desc: "Nach 1 Woche: Käse-Würfel auf dem Boden statt Trockenfutter. Nach 2 Wochen: Stück Hähnchen. Tausch-Belohnung wird auch wertvoller (Leberwurst)." },
          { name: "Bedeutung nicht inflationär nutzen", desc: "PFUI ist kein Allzweck-Stop. Nur für 'lass dieses Objekt liegen'. Sonst verliert es seine Wirkung. Andere Stop-Signale (NEIN, AUS) haben andere Bedeutungen." },
        ],
        frequency: ["3-5 PFUI-Sessions täglich drinnen", "Über 2-3 Wochen festigen", "Wertigkeit schrittweise steigern"],
        watchFor: ["Stimme bleibt ruhig, nicht aggressiv", "Belohnungs-Alternative wertvoller"],
        gos: ["PFUI + sofortige Alternative", "Wertigkeit langsam steigern"],
        noGos: ["PFUI als Schimpfwort missbrauchen", "PFUI ohne Belohnungs-Alternative"],
      },
      {
        title: "Tausch-Geschäft mit Wertigkeits-Stufen",
        intro: "Wenn {dogName} schon was im Maul hat: ruhig tauschen statt panisch reissen.",
        steps: [
          { name: "Niemals hinterherrennen", desc: "Wenn {dogName} schon was aufgenommen hat: NICHT hinterherrennen. Das verstärkt das Wegrennen-Verhalten und macht es zum Spiel." },
          { name: "Ruhig nähern, Tausch zeigen", desc: "Gehe ruhig zu {dogName}, hochwertiges Tausch-Leckerli in der Hand. Stell dich nicht über ihn, sondern seitlich. Sprich nicht." },
          { name: "AUS sagen, abwarten", desc: "Sage AUS, Leckerli halt sichtbar nahe der Nase. Warte 2-3 Sekunden. {dogName} wägt ab: Behalten oder Tauschen?" },
          { name: "Bei Hergeben belohnen", desc: "Wenn {dogName} das Maul öffnet und das Objekt fallen lässt: FEIN + Mega-Belohnung. Das aufgenommene Objekt wegräumen, ohne Drama." },
          { name: "Niemals reissen oder ins Maul", desc: "Wenn {dogName} nicht hergibt: warte länger, höhere Wertigkeit zeigen. NIEMALS Hand ins Maul, das vergiftet das Signal lebenslang." },
          { name: "Hochwertigste Belohnung griffbereit", desc: "Auf dem Spaziergang IMMER: Hähnchen oder Leberwurst in der Hosentasche. Trockenfutter reicht nicht. Du musst das aufgenommene Objekt überbieten können." },
        ],
        frequency: ["Bei jeder echten Aufnahme", "Drinnen 3-4x täglich üben", "Hochwertige Belohnung immer dabei"],
        watchFor: ["Wertigkeits-Hierarchie kennen", "Ruhe bewahren"],
        gos: ["Tauschen mit echter Wertigkeit", "Sanft und ruhig nähern"],
        noGos: ["Hinterherrennen", "Reissen oder Hand ins Maul"],
      },
      {
        title: "Belohnungs-Suche als Alternative",
        intro: "Du gibst {dogName}s Such-Trieb eine erlaubte Befriedigungs-Quelle.",
        steps: [
          { name: "Hosentasche füllen", desc: "Vor jedem Spaziergang: 15-20 weiche Leckerli (kleine Stücke) in die Hosentasche. Die müssen klein und schnell verfügbar sein." },
          { name: "Bei Boden-Schnüffeln werfen", desc: "Sobald {dogName} schnüffelnd Richtung Boden geht (typisches Aufnahme-Anzeichen): 2-3 Leckerli ins Gras werfen, in einem Bereich, der für ihn klar zum Suchen ist." },
          { name: "SUCH sagen", desc: "Sage SUCH, sobald die Leckerli fliegen. {dogName} sucht jetzt aktiv NACH den FREIGEGEBENEN Leckerli, statt auf etwas Zufälliges am Boden zu hoffen." },
          { name: "Pro Spaziergang 5-7 Mal", desc: "Diese Such-Phasen brauchst du nicht zu rationieren. Pro Spaziergang 5-7 SUCH-Momente sind ein guter Schnitt. {dogName} weiß: 'Bei meinem Halter kommt was, ich brauche nicht selbst suchen.'" },
          { name: "Verbindung zu Hotspots", desc: "Vor euren typischen Hotspots (Mülltonnen, Park-Eingang) gezielt SUCH-Momente einbauen. Du lenkst um, bevor {dogName} überhaupt schnüffelnd am Boden ist." },
          { name: "Über Wochen wird er checken", desc: "Nach 3-4 Wochen blickt {dogName} bei jedem Boden-Reiz erst kurz zu dir, ob du was wirfst. Die Hosentasche ist sein neuer Lieferant geworden." },
        ],
        frequency: ["Bei jedem Spaziergang konsequent", "Hosentaschen-Routine etablieren"],
        watchFor: ["Werfen NUR auf sicheren Boden, nicht in Mülltonnen-Bereich", "Leckerli klein halten"],
        gos: ["Such-Trieb umlenken, nicht unterdrücken", "Hosentasche immer voll"],
        noGos: ["Nur Trockenfutter werfen (zu uninteressant)", "Werfen erst nach Aufnahme"],
      },
      {
        title: "Maulkorb für Hochrisiko-Strecken",
        intro: "Sicherheit zuerst. An kritischen Orten ist der Maulkorb dein bester Schutz.",
        steps: [
          { name: "Maulkorb positiv konditionieren", desc: "Wie bei der Aggression-Übung: Korbmaulkorb (Baskerville Ultra), 10-14 Tage positiv aufbauen, bevor er auf einem Spaziergang zum Einsatz kommt." },
          { name: "Hochrisiko-Strecken identifizieren", desc: "Wo nehmen wir am häufigsten was auf? Vor Schulen (Pausenbrote), Mülltagen, Park-Eingängen, Bushaltestellen. Diese Strecken markieren." },
          { name: "Maulkorb-Pflicht etablieren", desc: "Auf diesen Strecken: Maulkorb dran. Nicht verhandelbar. Auch wenn es 'mal nicht schlimm' wäre. Konsequenz zählt." },
          { name: "Auf sicheren Strecken weglassen", desc: "Auf bekannten ruhigen Strecken kannst du den Maulkorb weglassen. Das gibt {dogName} auch positiven Spielraum und zeigt: er ist nicht generell etwas Negatives." },
          { name: "Während Training-Übergang", desc: "Während AUS und PFUI noch im Aufbau sind: Maulkorb auch auf 'normalen' Strecken nutzen. Sicherheit zuerst. Erst wenn Signale stabil sitzen, kannst du reduzieren." },
          { name: "Niemals als Strafe oder Erziehung", desc: "Maulkorb darf NIEMALS Strafgefühl haben. Er ist Sicherheits-Werkzeug. Wenn {dogName} Frust zeigt: positive Konditionierung wiederholen, kürzere Tragezeiten." },
        ],
        frequency: ["An identifizierten Hotspots immer", "Während Aufbauphase großzügig nutzen"],
        watchFor: ["Positive Verknüpfung pflegen", "Niemals als Strafmittel"],
        gos: ["Korbmaulkorb, kein Stoff", "Konsequent an Risikostrecken"],
        noGos: ["Maulkorb in Stress ohne Vorlauf", "Stoff-Maulschlinge verwenden"],
      },
      {
        title: "Nasenarbeit zur Befriedigung",
        intro: "Wer Nase und Kopf ausreichend nutzt, sucht draußen weniger.",
        steps: [
          { name: "Tägliche Nasenarbeit einplanen", desc: "Mindestens 20-30 Min pro Tag Nasenarbeit: Suchspiel in der Wohnung, Spuren-Such draußen, Schnüffelmatte, Kong. Müde Nase = ruhige Pfoten draußen." },
          { name: "Schnüffel-Pausen erlauben", desc: "Auf dem Spaziergang: jede 5-10 Min eine 30-60 Sek Schnüffel-Pause. {dogName} schnüffelt an Gras, Büschen, Pfosten. Nicht aufnehmen, nur erkunden." },
          { name: "Mantrailing-Element einbauen", desc: "1-2 mal pro Woche eine kleine Spur legen: 10-20m Leckerli-Spur. {dogName} folgt schnüffelnd. Eine 15-Min-Spur ersetzt 30 Min Spaziergang an Wirkung." },
          { name: "Schnüffelmatte zu Hause", desc: "Statt Schüssel-Fütterung: Trockenfutter auf eine Schnüffelmatte verteilen. {dogName} arbeitet 15-20 Min daran. Macht müde, befriedigt den Trieb." },
          { name: "Auf Spaziergangs-Highlights freuen", desc: "Plane gezielt 'Such-Spaziergänge': in einem ruhigen Wald, weniger befahrene Wege, wo Schnüffeln Hauptaufgabe ist. {dogName} lernt: Erkundung ist erlaubt und schön." },
          { name: "Effekt: weniger Beuteinstinkt", desc: "Nach 4-6 Wochen täglicher Nasenarbeit reduziert sich der Aufnahme-Drang erkennbar. Der Trieb ist weniger 'gestaut'." },
        ],
        frequency: ["Täglich 20-30 Min Nasenarbeit", "Mindestens 1 Mantrailing-Einheit pro Woche"],
        watchFor: ["Qualität wichtiger als Quantität", "Mit Routine im Tagesplan verankern"],
        gos: ["Nasenarbeit als feste Routine", "Schnüffel-Pausen einplanen"],
        noGos: ["Nasenarbeit als Belohnung weglassen", "Stumpfes Toben statt Nasentätigkeit"],
      },
      {
        title: "Bei-Fuß-Belohnen an Hot-Spots",
        intro: "An kritischen Stellen wird die Bein-Position zur lohnendsten Option.",
        steps: [
          { name: "Hosentasche voll Top-Belohnung", desc: "Hähnchen, Käse, Wurst — was {dogName} liebt. Klein geschnitten, schnell verfügbar." },
          { name: "Bei Annäherung an Hot-Spot kürzen", desc: "20m vor dem Hot-Spot: Leine auf 1m kürzen. {dogName} läuft eng am Bein. Du bist aufmerksam, beobachtest die Bodenlage." },
          { name: "Alle 3-5 Schritte Leckerli", desc: "Während der Passage am Hot-Spot: alle 3-5 Schritte ein Top-Leckerli direkt an der Bein-Naht. {dogName} schaut zu dir, nicht zum Boden." },
          { name: "SUCH-Würfe als Bonus", desc: "Wenn doch was Verdächtiges am Boden liegt: nicht stehen bleiben, sondern 2-3 Leckerli auf eine SICHERE Stelle werfen (Wiese, klare Stelle) und SUCH sagen." },
          { name: "Nach Passage entspannen", desc: "Sobald ihr durch den Hot-Spot durch seid: Leine wieder etwas länger, Belohnungs-Frequenz reduzieren, Schnüffel-Pause als Belohnung." },
          { name: "Über Wochen automatisch", desc: "Nach 3-4 Wochen geht {dogName} eng am Bein, wenn er die Hot-Spot-Strecke erkennt. Die Routine wird Reflex." },
        ],
        frequency: ["Bei jedem Spaziergang an Hot-Spots", "Über 3-4 Wochen automatisieren"],
        watchFor: ["Wirklich hochwertige Belohnung verwenden", "Aufmerksam bleiben"],
        gos: ["Belohnungs-Dichte hoch fahren", "Kurze Leine an Hot-Spots"],
        noGos: ["Schimpfen, wenn {dogName} schnüffelt", "Trockenfutter als Belohnung"],
      },
    ],
    abschluss: {
      title: "Abschluss",
      subtitle: "Viel Erfolg",
      paras: [
        "Aufnehmen ist ein Trieb, kein Charakterfehler. {dogName} kann nicht 'gut erzogen werden' im klassischen Sinne, weil das Aufnehmen selbst-belohnend ist. Was er aber kann: lernen, dass es bei dir Besseres gibt.",
        "Geduld ist alles. AUS, PFUI und Tausch-Geschäft brauchen Wochen, bis sie draußen unter echten Bedingungen funktionieren. Bleib konsequent, hochwertige Belohnungen griffbereit.",
        "Der Maulkorb ist kein Eingeständnis, sondern Sicherheits-Werkzeug. Solange das Training noch nicht 100% sitzt, ist er an Hochrisiko-Strecken einfach Vernunft. Giftköder und scharfe Objekte gibt es überall.",
        "Halte die Nasenarbeit als feste Routine. Ein Hund, dessen Nase und Kopf täglich gefordert sind, hat draußen weniger Such-Drang. Das ist die nachhaltigste Säule deines Plans.",
      ],
    },
  },

  recall: {
    coverTitle: "Rückruf-Plan für",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Warum dieser Plan genau so aufgebaut ist",
      subtitle: "Verlässlicher Rückruf in jeder Situation",
      paras: [
        "{dogName} kommt manchmal, wenn du rufst, manchmal nicht. Das ist nicht 'Ungehorsam', sondern fehlende Verlässlichkeit. Der Rückruf ist die wichtigste Lebensversicherung im Hundeleben.",
        "Wenn der Rückruf wackelt, hat das fast immer eine Geschichte. Vielleicht wurde das Signal zu oft gerufen, wenn der Hund nicht kommen konnte (Ablenkung). Vielleicht hat er gelernt, dass Kommen Anleinen bedeutet — das Ende des Spaßes.",
        "Bei {dogName} bauen wir entweder das alte Signal neu auf oder ein komplett neues Wort. Wichtig ist: dieses Wort wird IMMER positiv aufgeladen, niemals für Negatives missbraucht.",
        "Dieser Plan baut den Rückruf in Stufen auf: drinnen, draußen mit Schleppleine, unter Ablenkung, in der Pfeife-Variante als Backup. Erst wenn jede Stufe 90% sitzt, kommt die nächste.",
      ],
    },
    how: {
      title: "So setzt du die Übungen richtig um",
      paras: [
        "Hochwertige Belohnung ist Pflicht. Hähnchen, Käse, Leberwurst — Trockenfutter reicht für den Rückruf nicht. Das Signal muss der attraktivste Moment des Spaziergangs sein.",
        "Wähle bewusst ein neues Wort, falls das alte vergiftet ist. KOMM-HER, HIER oder ein eigenes Wort. Aber nur EIN Wort, konsequent für alle Familienmitglieder gleich.",
        "Schleppleine ist die Sicherheits-Brücke zwischen Drinnen und Freilauf. 5-10m Biothane (kein Seil — verbrennt Hände). Niemals direkt zum Freilauf springen, ohne diese Zwischenstufe.",
        "Niemals das Rückruf-Signal für Negatives nutzen: Anleinen am Spaziergangs-Ende, Tierarzt, Bad, Schimpfen. Für diese Dinge brauchst du ein anderes Wort. Das Rückruf-Signal bleibt heilig.",
      ],
    },
    exercises: [
      {
        title: "KOMM-HER positiv neu laden",
        intro: "Erste Stufe drinnen: das Signal wird zur attraktivsten Sache des Tages.",
        steps: [
          { name: "Neues Wort wählen", desc: "Wenn das alte HIER vergiftet ist (Hund kommt nicht zuverlässig), nimm KOMM-HER, ZU MIR oder ein eigenes Wort. Familienkonsens: alle nutzen das gleiche Wort." },
          { name: "Drinnen mit 3m starten", desc: "{dogName} ist entspannt im Wohnzimmer. Du gehst 3m weg, drehst dich um, gehst in tiefe Hocke." },
          { name: "Fröhlich rufen", desc: "Sage KOMM-HER in hellem, fröhlichem Ton. NICHT befehlsmäßig, sondern einladend. Wie wenn du den Hund zu was Schönem rufst." },
          { name: "Jackpot-Belohnung", desc: "Sobald {dogName} bei dir ist: 5-7 Hähnchen-Stücke hintereinander, ruhiges Lob, kurzes Streicheln. Das ist nicht 'normal lecker' — das ist ein FEST." },
          { name: "Sofort wieder gehen lassen", desc: "Nach 30 Sekunden Belohnung: 'OK', {dogName} darf weiterspielen, weiterschnüffeln. Der Rückruf endet NIEMALS mit dem Ende der Freiheit. Das ist die Pointe." },
          { name: "5 Wiederholungen, 3 Sessions täglich", desc: "Pro Session 5 Rückrufe, 3 Sessions pro Tag drinnen. Eine Woche so, dann verlängern auf 5m, 8m, durch andere Räume." },
        ],
        frequency: ["3 Sessions pro Tag drinnen", "Über 1 Woche aufbauen", "Sofort wieder gehen lassen nach Belohnung"],
        watchFor: ["Belohnung muss WIRKLICH wertvoll sein", "Ton ist einladend, nicht befehlsmäßig"],
        gos: ["Hähnchen, nicht Trockenfutter", "Fröhlich rufen"],
        noGos: ["Anleinen direkt nach Rückruf", "Befehlsmäßig rufen"],
      },
      {
        title: "Festhalte-Rückruf für hohe Motivation",
        intro: "Eine zweite Person hält {dogName} fest, du rennst weg — Beuteinstinkt aktiviert sich.",
        steps: [
          { name: "Helfer einbeziehen", desc: "Partner, Familienmitglied oder Freund. Diese Person hält {dogName} sanft am Brustgeschirr fest." },
          { name: "Du läufst sichtbar weg", desc: "Du gehst 10-15 Meter weg, im Sichtbereich. Dreh dich um, geh in tiefe Hocke, klatsche fröhlich in die Hände." },
          { name: "Fröhlich rufen, Helfer lässt los", desc: "Du rufst KOMM-HER in hellem Ton. Gleichzeitig: Helfer lässt {dogName} los. {dogName} sprintet zu dir." },
          { name: "MEGA-Jackpot bei Ankunft", desc: "{dogName} kommt mit Energie an: 7-10 Hähnchen-Stücke, ausgelassenes Lob, freudige Begrüßung. Das ist Highlight-Erlebnis." },
          { name: "Wieder loslassen", desc: "Nach 30 Sek Belohnung: 'OK', {dogName} läuft zurück zum Helfer, weiter spielen oder spazieren. Niemals direkt anleinen nach diesem Spiel." },
          { name: "Distanz langsam steigern", desc: "Über Wochen auf 30-50m steigern. Auch draußen mit Schleppleine. Diese Übung ist eine der wirkungsvollsten überhaupt — der Beuteinstinkt arbeitet für dich." },
        ],
        frequency: ["2-3 Sessions pro Woche, je 4-6 Wiederholungen", "Draußen mit Schleppleine sichern"],
        watchFor: ["Helfer hält sanft, nicht streng", "Du selbst musst sichtbar Spaß haben"],
        gos: ["Mega-Belohnung, Mega-Lob", "Sofort wieder gehen lassen"],
        noGos: ["Direkt nach Rückruf anleinen und heimgehen", "Helfer als 'Bestrafer' erscheinen lassen"],
      },
      {
        title: "Schleppleinen-Arbeit als Brücke",
        intro: "Bevor Freilauf riskiert wird: 5-10m Schleppleine. {dogName} fühlt sich frei, du hast Sicherheit.",
        steps: [
          { name: "Richtige Schleppleine", desc: "5-10m Biothane (nicht Seil — verbrennt die Hände bei Durchziehen). Brustgeschirr (NIEMALS am Halsband befestigen — Verletzungsgefahr)." },
          { name: "An ruhigem Ort starten", desc: "Ruhige Wiese oder Wald-Lichtung ohne andere Hunde. {dogName} läuft frei in 5-10m Radius." },
          { name: "Regelmäßig zurückrufen", desc: "Alle 3-5 Min: KOMM-HER mit fröhlichem Ton. {dogName} kommt? Jackpot, ruhig lassen, weitergehen lassen." },
          { name: "Falls nicht: Schleppleine nutzen", desc: "Wenn {dogName} NICHT kommt: keine zweite Aufforderung. Stattdessen Schleppleine sanft aufnehmen, ihn zu dir ziehen, ruhig. Trotzdem kleine Belohnung beim Ankommen." },
          { name: "Niemals rufen, wenn nicht möglich", desc: "Wenn {dogName} stark abgelenkt ist (anderer Hund, Wildgeruch), und du WEISST: er wird nicht kommen — dann NICHT rufen. Schleppleine sanft aufnehmen, ohne Wort." },
          { name: "Über Wochen zuverlässig", desc: "Nach 2-3 Wochen kommt {dogName} 80-90% der Rückrufe. Erst dann denken wir an freie Stufe. Bis dahin: Schleppleine bleibt dran." },
        ],
        frequency: ["3-4 Schleppleinen-Spaziergänge pro Woche", "Über 3-4 Wochen aufbauen"],
        watchFor: ["Biothane statt Seil", "Brustgeschirr Pflicht"],
        gos: ["An ruhigen Orten üben", "Belohnung hochwertig halten"],
        noGos: ["Schleppleine am Halsband", "Rufen, wenn klar nicht kommt"],
      },
      {
        title: "KOMM-HER unter Ablenkung",
        intro: "Echter Test: Rückruf funktioniert auch, wenn was Spannenderes lockt.",
        steps: [
          { name: "Moderate Ablenkung wählen", desc: "Park-Rand mit Spaziergängern in 30m, ruhige Wiese in Hörweite einer Straße. NICHT direkt bei anderen Hunden — zu intensiv für diese Stufe." },
          { name: "Schleppleine sicher", desc: "Schleppleine bleibt dran. Die Sicherheit ist Pflicht, bis der Rückruf unter Ablenkung 90% sitzt." },
          { name: "Vorlauf-Belohnung", desc: "Vor jedem geplanten Rückruf 1-2 Mini-Belohnungen aus der Hand, damit {dogName} weiß: 'mein Halter ist gerade interessant'." },
          { name: "Fröhlich rufen, einmal", desc: "Sage KOMM-HER in hellem Ton, EINMAL. Nicht wiederholen. Wenn {dogName} kommt: SUPER-JACKPOT 7-10 Leckerli, übertriebenes Lob." },
          { name: "Wenn nicht: Schleppleine, kein Drama", desc: "Wenn {dogName} nicht kommt: ruhig die Schleppleine aufnehmen, leicht zurückziehen, kein zweiter Ruf, kein Schimpfen. Bei Ankommen: trotzdem Mini-Belohnung." },
          { name: "Erfolgsquote 80% halten", desc: "Pro Session 4-6 Rückrufe. Erfolgsquote unter 70%? Ablenkung reduzieren. Über 90%? Stärkere Ablenkung wagen." },
        ],
        frequency: ["3-4 Sessions pro Woche", "Über 2-4 Wochen aufbauen", "Erfolgsquote bewusst halten"],
        watchFor: ["Niemals stärkere Ablenkung als handhabbar", "Wenn weniger als 70%: Stufe zurück"],
        gos: ["Vorlauf-Belohnungen geben", "Einmal rufen, dann Schleppleine"],
        noGos: ["Mehrfach rufen ohne Reaktion", "Ablenkung zu schnell steigern"],
      },
      {
        title: "Hundepfeife als zweites Signal",
        intro: "Eine Pfeife trägt weit, klingt immer gleich und kann nicht 'vergiftet' werden.",
        steps: [
          { name: "Richtige Pfeife", desc: "ACME 211.5 oder ähnliche Hunde-Pfeife. Halsband-Anhänger, damit du sie immer dabei hast. Nicht zu schrill, klar pfeifbar." },
          { name: "Drinnen konditionieren", desc: "Drinnen: pfeife einen klaren Doppelton (kurz-kurz oder lang-kurz), sofort Jackpot. {dogName} verbindet 'Pfeife = Lecker'." },
          { name: "5-7 Wiederholungen pro Session", desc: "Pro Session 5-7 Pfeif-Belohnungs-Wiederholungen, 2 Sessions täglich, eine Woche lang. Konditionierung muss tief sitzen." },
          { name: "Mit Schleppleine nach draußen", desc: "Übertrage nach draußen: Schleppleine dran, Pfeife: {dogName} kommt: Mega-Jackpot. Die Pfeife ist neue, frische Verknüpfung." },
          { name: "Niemals für Negatives", desc: "Die Pfeife darf NIEMALS für Anleinen, Bad, Tierarzt benutzt werden. Sie ist exklusiv das positive Backup-Signal." },
          { name: "Nach 4 Wochen zuverlässiger", desc: "Pfeife ist nach 4 Wochen zuverlässiger als die Stimme. Sie klingt immer gleich (egal wie frustriert du bist) und trägt 200m+. Notfall-Werkzeug Nr. 1." },
        ],
        frequency: ["Drinnen 2 Sessions/Tag eine Woche", "Dann mit Schleppleine draußen", "Niemals inflationär einsetzen"],
        watchFor: ["Eine Pfeife für alle Familienmitglieder", "Niemals für Negatives"],
        gos: ["Immer gleicher Doppelton", "Mega-Belohnung bei Ankommen"],
        noGos: ["Pfeife bei Tierarzt-Termin", "Mehrfach pfeifen ohne Reaktion"],
      },
      {
        title: "Drei-Stufen-Belohnung",
        intro: "Verschiedene Belohnungs-Stufen für verschiedene Schwierigkeiten.",
        steps: [
          { name: "Drei Stufen definieren", desc: "ALLTAG-Rückruf (leichte Ablenkung): normale Belohnung 2-3 Leckerli. JACKPOT (mittelschwer): 5-7 hochwertige Leckerli. NOTFALL (extrem schwer): 10+ Mega-Belohnung." },
          { name: "Alltag-Rückrufe pro Spaziergang", desc: "3-5 Alltag-Rückrufe pro Spaziergang. Einfache Situationen, normale Belohnung. {dogName} lernt: Rückruf ist normal und passiert oft." },
          { name: "Jackpot bei Erfolg unter Ablenkung", desc: "Wenn {dogName} eine herausfordernde Situation meistert (anderer Hund 50m, Reh in Sichtweite): Mega-Belohnung 7-10 Leckerli. Spitzenleistung kostet." },
          { name: "Notfall-Wort sparen", desc: "Ein extra Wort (z.B. ZU MIR oder ein eigenes) wird ausschließlich für Notfälle reserviert. Niemals im Alltag nutzen, sonst verliert es die Magie." },
          { name: "Notfall-Wort regelmäßig testen", desc: "1x pro Monat ein 'Trockenübungs-Notfall': in entspannter Situation das Notfall-Wort rufen, MEGA-Jackpot von 15 Leckerlis. So bleibt es konditioniert." },
          { name: "Belohnungs-Hierarchie konsequent halten", desc: "Niemals Notfall-Belohnung im Alltag verschwenden. Niemals Alltags-Belohnung in Notfall einsetzen. Die Stufen sind heilig." },
        ],
        frequency: ["Alltag-Rückrufe: 3-5x pro Spaziergang", "Notfall-Wort: 1x monatlich testen"],
        watchFor: ["Wertigkeits-Hierarchie strikt halten", "Notfall-Wort separat halten"],
        gos: ["Stufen klar trennen", "Notfall-Wort sparsam halten"],
        noGos: ["Notfall-Wort inflationär", "Alle Rückrufe gleich belohnen"],
      },
      {
        title: "Erster kontrollierter Freilauf",
        intro: "Wenn alles vorher klappt: erste vorsichtige Freilauf-Phase.",
        steps: [
          { name: "Sicherste Zone wählen", desc: "Eingezäunte Hundewiese, Waldlichtung weit weg von Straße. Die topographisch sicherste Option, die du kennst." },
          { name: "Schleppleine ablegen, nicht abnehmen", desc: "Schleppleine bleibt am Geschirr, aber du lässt sie auf den Boden fallen. {dogName} darf 10m frei laufen, hat aber noch Sicherheit (du kannst auf die Leine treten)." },
          { name: "Nach 1-2 Min Rückruf", desc: "Erster Test: nach 1-2 Min Freilauf KOMM-HER + Pfeife (beide Signale gleichzeitig fürs erste Mal). Bei zuverlässigem Rückruf in 5 Sekunden: weitermachen." },
          { name: "Bei Nicht-Kommen: zurück", desc: "Wenn {dogName} nicht kommt: SOFORT zurück zur Schleppleinen-Phase. 2 weitere Wochen Schleppleine, dann erneuter Test. Geduld zahlt sich aus." },
          { name: "Pro Freilauf max 15-20 Min", desc: "Erste Freiläufe nicht länger als 15-20 Min. Pro Freilauf 3-4 Rückrufe einbauen, alle mit Jackpot. Beende, bevor {dogName} müde wird." },
          { name: "Niemals an Straßen", desc: "Egal wie gut der Rückruf ist: NIEMALS Freilauf an Straßen-Nähe, in unbekannten Gegenden, bei hohem Wildbestand. Sicherheit geht immer vor Komfort." },
        ],
        frequency: ["1-2 Freiläufe pro Woche, kurz", "Niemals an Straßen, niemals länger als 20 Min"],
        watchFor: ["Sichere Umgebung als Pflicht", "Bei Nicht-Kommen sofort zurück zur Schleppleine"],
        gos: ["Eingezäunte Zone bevorzugen", "Schleppleine als Sicherheits-Brücke"],
        noGos: ["Freilauf an Straßen", "Bei Versagen weiter probieren"],
      },
      {
        title: "Wartung lebenslang",
        intro: "Ein guter Rückruf braucht regelmäßige Wartung, sonst verblasst er.",
        steps: [
          { name: "Pro Spaziergang 2-3 Rückrufe", desc: "Auch wenn der Rückruf seit Monaten zuverlässig läuft: pro Spaziergang mindestens 2-3 Rückrufe einbauen, immer mit Belohnung. Das hält die Verknüpfung frisch." },
          { name: "Hochwertige Belohnung beibehalten", desc: "Niemals auf Trockenfutter als Rückruf-Belohnung reduzieren. Das untergräbt die Wertigkeit. Hähnchen, Käse, hochwertige Leckerli bleiben Standard." },
          { name: "Monatlich neue Strecke", desc: "1x pro Monat eine neue Strecke für den Rückruf-Test. Generalisierung muss gepflegt werden, sonst funktioniert er nur an bekannten Orten." },
          { name: "Notfall-Wort jährlich auffrischen", desc: "Das Notfall-Signal alle 3-6 Monate in einer entspannten Situation testen und JACKPOT geben. So bleibt es einsatzbereit, wenn du es wirklich brauchst." },
          { name: "Bei Rückschritt sofort eingreifen", desc: "Wenn {dogName} mal nicht kommt: NICHT die Schleppleine permanent weglassen. Eine Woche zurück zur Schleppleine, dann neuer Versuch. Keine Angst vor temporären Rückschritten." },
          { name: "Festhalte-Rückruf als Booster", desc: "Alle paar Monate eine Festhalte-Rückruf-Session mit Helfer einbauen. Das pusht die Begeisterung enorm und frischt die Verknüpfung auf." },
        ],
        frequency: ["Lebenslange Wartung", "Mindestens 2-3 Rückrufe pro Spaziergang"],
        watchFor: ["Belohnungs-Niveau hoch halten", "Generalisierung pflegen"],
        gos: ["Regelmäßige Wartung", "Hochwertige Belohnung beibehalten"],
        noGos: ["Rückruf für selbstverständlich halten", "Belohnung reduzieren oder weglassen"],
      },
    ],
    abschluss: {
      title: "Abschluss",
      subtitle: "Viel Erfolg",
      paras: [
        "Ein zuverlässiger Rückruf ist die wichtigste Lebensversicherung deines Hundes. {dogName} kann nur dann Freiheit haben, wenn er auch wirklich zurückkommt — alles andere ist Risiko.",
        "Das Geheimnis ist Geduld plus hochwertige Belohnung. Niemals auf günstigere Leckerli umsteigen, niemals den Rückruf für selbstverständlich halten. Mit jedem freundlich beantworteten Rückruf festigst du die Verknüpfung.",
        "Nutze die Schleppleine länger als du denkst. Hunde-Halter springen oft zu schnell zum Freilauf. Wer 2-3 Monate länger Schleppleine nutzt, hat einen 100% verlässlichen Rückruf statt 80%.",
        "Die Pfeife ist dein Notfall-Werkzeug. Pflege sie monatlich, vergiß sie nie. Wenn der Tag kommt, an dem {dogName} im hohen Gras verschwindet und du fast in Panik gerätst — diese Pfeife wird dich retten.",
      ],
    },
  },

  barking: {
    coverTitle: "Anti-Bell Plan für",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Warum dieser Plan genau so aufgebaut ist",
      subtitle: "Ruhe statt Dauerlärm",
      paras: [
        "{dogName} bellt zu viel. Das ist kein Zeichen von Dominanz oder Bösartigkeit, sondern fast immer eine Reaktion auf Reize, Frust, Aufmerksamkeits-Bedürfnisse oder Unsicherheit.",
        "Bellen hat ganz unterschiedliche Ursachen: Klingel, Geräusche im Treppenhaus, andere Hunde im Garten, Allein-Sein, Frust an der Leine. Jede Ursache braucht ihre eigene Antwort.",
        "Das größte Missverständnis: Anschreien hört Bellen NICHT auf. Im Gegenteil, für den Hund klingt das wie Mit-Bellen. Bei {dogName} verstärkt jedes Reagieren auf das Bellen das Verhalten.",
        "Dieser Plan baut Stille als das wertvolle Verhalten auf. Wir belohnen Schweige-Phasen, etablieren Klingel-Alternativen und entkoppeln Auslöser-Reaktionen systematisch. Geduldig, ohne Druck.",
      ],
    },
    how: {
      title: "So setzt du die Übungen richtig um",
      paras: [
        "Identifiziere zuerst die Auslöser. Wann bellt {dogName} am häufigsten? Türklingel, Fenster, Frust, Allein-Sein? Pro Ursache gibt es eine andere Technik.",
        "Belohne Schweigen aktiv. Hunde lernen schneller, was sie BEKOMMEN sollen, als was sie LASSEN sollen. Jede 5-10-Sekunden-Stille bekommt einen leisen RUHE-Marker mit Leckerli.",
        "Sei konsequent in deiner Reaktion: Bellen wird komplett ignoriert (Wegdrehen, kein Augenkontakt). Schweige-Phasen werden belohnt. Nach 2-3 Wochen lernt {dogName}: 'Bellen bringt nichts. Schweigen bringt Leckerli.'",
        "Familien-Konsequenz ist Pflicht. Ein Familienmitglied, das beim Bellen kuschelt oder schimpft, sabotiert die ganze Arbeit. Briefing am Anfang, alle ziehen mit.",
      ],
    },
    exercises: [
      {
        title: "Auslöser-Tagebuch führen",
        intro: "Bevor du Bellen reduzieren kannst, musst du wissen, wann und warum es passiert.",
        steps: [
          { name: "Notizheft bereitlegen", desc: "Ein A5-Heftchen oder eine Notiz-App auf dem Handy. Wichtig: schnell verfügbar, sobald Bellen anfängt." },
          { name: "Über 7 Tage alle Bell-Episoden notieren", desc: "Pro Episode: Datum, Uhrzeit, Auslöser (Klingel, Geräusch, Hund vorm Fenster), Dauer in Minuten, deine Reaktion." },
          { name: "Muster identifizieren", desc: "Nach 7 Tagen werte aus: 3 häufigste Auslöser, typische Tageszeiten, typische Dauer. Das sind deine Trainings-Schwerpunkte." },
          { name: "Top-Auslöser priorisieren", desc: "Identifiziere die 1-2 Hauptauslöser (z.B. Klingel + Hund am Fenster). Diese werden zuerst angegangen. Die seltenen Auslöser kommen später." },
          { name: "Reaktion ehrlich bewerten", desc: "Wie reagierst du selbst aktuell? Schreist du? Kuschelst du? Ignorierst du? Notiere ehrlich. Oft ist die eigene Reaktion ein Teil des Problems." },
          { name: "Tagebuch in Phase 2 weiterführen", desc: "Nach den ersten 2 Wochen Training: Tagebuch erneut führen. Vergleiche die Häufigkeit. So siehst du objektiv, ob das Training greift." },
        ],
        frequency: ["7 Tage konsequent dokumentieren", "Nach 2 Wochen Training erneut auswerten"],
        watchFor: ["Ehrlichkeit ist wichtig", "Auch Mini-Episoden notieren"],
        gos: ["Sofort nach Episode notieren", "Muster suchen"],
        noGos: ["Nur die 'großen' Episoden zählen", "Eigene Reaktion verschweigen"],
      },
      {
        title: "Stille-Marker etablieren",
        intro: "Schweigen wird zur belohnten Aktion. Konditionierung über Wochen.",
        steps: [
          { name: "RUHE als neues Markerwort", desc: "Wähle ein Wort, das im Alltag selten vorkommt. RUHE oder LEISE eignen sich gut. Dieses Wort wird ab jetzt mit Stille-Belohnung verknüpft." },
          { name: "5-Sekunden-Stille erkennen", desc: "Beobachte {dogName} bewusst: 5 Sekunden ohne Bellen, ohne Winseln, ohne Jaulen. Genau in diesem Moment ist Belohnungs-Zeit." },
          { name: "Leise RUHE sagen + Leckerli", desc: "In dem Stille-Moment: leise RUHE sagen, ein weiches Leckerli zwischen die Vorderpfoten legen. Ruhig, ohne Aufregung." },
          { name: "Über 1 Woche täglich 8-10 Mal", desc: "Pro Tag 8-10 dieser Stille-Belohnungen. Konsequent. {dogName} lernt: Stille = manchmal kommt was Gutes." },
          { name: "Dauer der Stille verlängern", desc: "Nach 1 Woche: 10 Sek warten, bevor du RUHE sagst. Dann 20 Sek, 30 Sek, 1 Min. Über 3 Wochen auf 1-2 Minuten Stille steigern." },
          { name: "Niemals 'leise' rufen, wenn er bellt", desc: "WICHTIG: RUHE niemals als Stop-Signal nutzen, wenn {dogName} schon bellt. Das vergiftet die Verknüpfung. RUHE kommt nur für Stille, nicht als Korrektur." },
        ],
        frequency: ["8-10 Belohnungen pro Tag", "Über 3 Wochen Stille verlängern"],
        watchFor: ["Niemals RUHE als Schimpfwort nutzen", "Leise und ruhig belohnen"],
        gos: ["Leiser Marker, weiches Leckerli", "Konsequent über Wochen"],
        noGos: ["RUHE während Bellen sagen", "Mit hoher Stimme belohnen (regt an)"],
      },
      {
        title: "Klingel-Decke-Routine",
        intro: "Klingelt es, läuft {dogName} zur Decke statt zur Tür. Pawlow für Anfänger.",
        steps: [
          { name: "Decke an festem Platz", desc: "Eine Decke 3m von der Eingangstür entfernt, an einem ruhigen Ort. Diese Decke wird ab jetzt mit der Klingel verknüpft." },
          { name: "Klingel-Aufnahme auf Handy", desc: "Nimm den Klang eurer echten Türklingel auf (auf dem Handy aufnehmen). Du brauchst diesen exakten Klang für die Konditionierung." },
          { name: "Trockenübungen drinnen", desc: "Spiele Klingel-Aufnahme leise ab: führe {dogName} sofort zur Decke: Leckerli auf der Decke. 10 Wiederholungen pro Session, 2 Sessions/Tag." },
          { name: "Lautstärke steigern", desc: "Über 1 Woche die Klingel-Lautstärke schrittweise erhöhen, immer mit gleichem Ablauf. Klingel: Decke: Belohnung." },
          { name: "Echte Klingel mit Helfer", desc: "Nach 2 Wochen: Helfer klingelt von draußen, {dogName} sollte automatisch zur Decke rennen. Bei Erfolg: MEGA-Jackpot." },
          { name: "Routine bei echten Gästen", desc: "Wenn echte Gäste kommen: Klingel: Decke: {dogName} bleibt liegen, Gast kommt rein, ignoriert ihn die ersten 2 Min. Erst dann darf {dogName} aufstehen und freundlich begrüßen." },
        ],
        frequency: ["2 Sessions/Tag drinnen aufbauen", "Über 2-3 Wochen festigen", "Echte Klingel-Tests mit Helfer"],
        watchFor: ["Konsistente Lautstärke-Steigerung", "Niemals an Tür belohnen"],
        gos: ["Decke = sicherer Belohnungs-Ort", "Konsequent durchziehen"],
        noGos: ["Tür-Bereich als Belohnungs-Zone", "Inkonsequent bei echten Gästen"],
      },
      {
        title: "Aufmerksamkeits-Bellen aushungern",
        intro: "Wenn {dogName} bellt, um Aufmerksamkeit zu kriegen, ist Ignorieren die einzige Lösung.",
        steps: [
          { name: "Aufmerksamkeits-Bellen erkennen", desc: "Es ist Aufmerksamkeits-Bellen, wenn {dogName} dich anschaut beim Bellen, in dein Sichtfeld läuft, fordert. KEIN echter Auslöser außen — der Auslöser bist du." },
          { name: "Komplettes Wegdrehen", desc: "Sobald Aufmerksamkeits-Bellen anfängt: Rücken zudrehen, keinen Augenkontakt, keinen Ton sagen. Du existierst gerade nicht für {dogName}." },
          { name: "5 Sek Stille abwarten", desc: "Du drehst dich erst wieder zu, wenn {dogName} 5 Sek nicht gebellt hat. Sobald die Stille da ist: drehen, ruhig hallo." },
          { name: "Bei Wieder-Bellen sofort weg", desc: "Wenn das Bellen wieder anfängt: sofort wieder Rücken zudrehen. Konsequent, jedes Mal. {dogName} lernt: 'Bellen = Halter geht weg.'" },
          { name: "Aushungerungs-Höhepunkt erwarten", desc: "WICHTIG: In den ersten 3-7 Tagen wird das Bellen oft SCHLIMMER, nicht besser. Das ist der 'Extinction Burst'. Wer hier nachgibt, hat verloren. Durchhalten." },
          { name: "Nach 2 Wochen messbar weniger", desc: "Wenn Familien-Konsequenz konsequent ist, reduziert sich Aufmerksamkeits-Bellen nach 2-3 Wochen messbar. Familien-Briefing ist entscheidend." },
        ],
        frequency: ["Bei jedem Aufmerksamkeits-Bellen", "Familien-Konsequenz täglich"],
        watchFor: ["Aushungerungs-Höhepunkt nicht missdeuten", "Ein einzelner Nachgeben kostet 1 Woche"],
        gos: ["Komplett wegdrehen, kein Wort", "Stille belohnen"],
        noGos: ["Anschreien", "Nach längerem Bellen nachgeben"],
      },
      {
        title: "Außenreiz-Gegenkonditionierung",
        intro: "Wenn {dogName} an Fenster oder im Garten bellt: emotionale Verknüpfung ändern.",
        steps: [
          { name: "Sicht-Zone identifizieren", desc: "Wo bellt {dogName} typischerweise? Fenster zur Straße, Balkon, Garten-Zaun. Diese Stellen sind die kritischen Punkte." },
          { name: "Belohnungs-Glas in Reichweite", desc: "Ein Glas mit hochwertigen Leckerli direkt an der Bellzone platzieren. Du musst innerhalb von 2 Sekunden ein Leckerli geben können, wenn der Reiz auftaucht." },
          { name: "Reiz erscheint: Leckerli", desc: "Sobald ein potenzieller Bell-Auslöser auftaucht (Mensch vorm Fenster, Hund am Zaun): SOFORT Leckerli geben. NICHT erst warten, ob {dogName} bellt." },
          { name: "Reiz weg: Leckerli weg", desc: "Wenn der Reiz verschwindet, hört auch die Belohnung auf. {dogName} verbindet: 'Reiz da = was Gutes. Reiz weg = nichts.' Emotionale Verknüpfung verändert sich." },
          { name: "Bei Bellen NICHT belohnen", desc: "Wenn {dogName} schon zu bellen anfängt, BEVOR du das Leckerli geben kannst: keine Belohnung. Du musst schneller sein als das Bellen. Bei Reiz-Erscheinung sofort agieren." },
          { name: "Über 3-4 Wochen Verknüpfung", desc: "Konsequent über Wochen ändert sich {dogName}s emotionale Reaktion. Reiz = Erwartung auf Leckerli, nicht Anti-Stress-Bellen. Das ist Gegenkonditionierung." },
        ],
        frequency: ["Bei jedem Reiz an kritischen Stellen", "Über 3-4 Wochen konsequent"],
        watchFor: ["Schneller sein als das Bellen", "Niemals Bellen belohnen"],
        gos: ["Leckerli-Glas in Reichweite", "Sofort bei Reiz reagieren"],
        noGos: ["Nach Bellen-Start belohnen", "Auslöser ignorieren in der Hoffnung"],
      },
      {
        title: "Frust-Bellen reduzieren",
        intro: "Manche Hunde bellen aus Frust. Lösung: Frust-Toleranz aufbauen.",
        steps: [
          { name: "Frust-Bellen erkennen", desc: "Frust-Bellen passiert, wenn {dogName} etwas nicht kann/darf: Eichhörnchen ausser Reichweite, anderer Hund hinter Zaun, Tür zur Küche zu. {dogName} fiept-bellt aus Erwartung." },
          { name: "WARTE-Signal etablieren", desc: "Drinnen: vor Futter WARTE sagen, Hand vor Napf, 5 Sek warten, dann FREIGABE und Futter. Steigerung auf 10, 20, 30 Sek über 2 Wochen." },
          { name: "Bei Bellen während WARTE", desc: "Wenn {dogName} während des Wartens bellt: Hand zurückziehen, kein FREIGABE. Sobald 3 Sek ruhig: erst dann Auflösung." },
          { name: "WARTE in Alltags-Situationen", desc: "Übertrage auf Frust-Auslöser: WARTE bei der Tür zur Küche, WARTE bei der Leine vor dem Spaziergang, WARTE vor dem Spielzeug. 5-7 Mini-Situationen täglich." },
          { name: "Frust-Toleranz wächst über Wochen", desc: "Nach 3-4 Wochen versteht {dogName}: 'Bellen bringt mich nicht zum Ziel. Ruhig warten bringt mich zum Ziel.' Frust-Bellen reduziert sich messbar." },
          { name: "Niemals bei Bellen nachgeben", desc: "Wichtigster Punkt: NIEMALS dem Frust-Bellen nachgeben. Wenn {dogName} bellt und du dann die Tür öffnest oder das Spielzeug gibst, hast du das Bellen verstärkt." },
        ],
        frequency: ["5-7 Mini-WARTE pro Tag", "Über 3-4 Wochen aufbauen"],
        watchFor: ["Niemals bei Bellen das Ziel öffnen", "WARTE muss positiv enden (Auflösung)"],
        gos: ["WARTE als positives Signal", "Konsequenz bei Frust-Bellen"],
        noGos: ["Auflösen während Bellen", "Bei Bellen schimpfen"],
      },
      {
        title: "Tür-Routine bei Gästen",
        intro: "Echte Gäste-Empfangs-Sequenz, die das Bellen entschärft.",
        steps: [
          { name: "Gäste vorab briefen", desc: "Sage Gästen vor ihrem Kommen: 'Bitte {dogName} ignorieren, bis ich sage, dass es ok ist.' Kein Streicheln, kein Anschauen, kein Ansprechen." },
          { name: "Klingel: Decke (geübte Routine)", desc: "Bei der echten Klingel: {dogName} läuft zur Decke (geübt in Übung 3). Du gehst zur Tür, öffnest ruhig, begrüßt den Gast leise." },
          { name: "Gast kommt rein, ignoriert {dogName}", desc: "Der Gast geht ruhig ins Wohnzimmer, setzt sich, ignoriert {dogName} auf der Decke. {dogName} bleibt liegen, alle 30 Sek ein Leckerli." },
          { name: "Nach 5 Min ruhigem Liegen: Freigabe", desc: "Wenn {dogName} 5 Minuten ruhig liegt: OK-Signal, sie darf vorsichtig zum Gast. Wenn sie hochfährt oder bellt: zurück zur Decke." },
          { name: "Gast streichelt nur bei SITZ", desc: "Wenn {dogName} zum Gast geht: SITZ sagen. Erst wenn sie ruhig sitzt, darf der Gast streicheln. Bei Springen: Gast dreht sich weg." },
          { name: "Routine über mehrere Gäste festigen", desc: "Über 4-6 Wochen mit verschiedenen Gästen üben. Es wird zur Normalität. {dogName} weiß: 'Klingel = Decke, dann ruhiges Hallo.'" },
        ],
        frequency: ["Bei jedem geplanten Gäste-Besuch", "Über mehrere Wochen festigen"],
        watchFor: ["Gäste-Briefing ist entscheidend", "Konsequenz bei jedem Besuch"],
        gos: ["Gäste vorab informieren", "Decke = Empfangs-Standard"],
        noGos: ["Gäste reagieren auf Bellen", "Direkt am Eingang begrüßen lassen"],
      },
      {
        title: "Stress-Hygiene gegen Bell-Rückfälle",
        intro: "Bellen kommt zurück, wenn der allgemeine Stress-Level steigt. Vorbeugung statt Reaktion.",
        steps: [
          { name: "Stress-Faktoren identifizieren", desc: "Was stresst {dogName}? Wenig Schlaf, zu viel Action, neue Familienmitglieder, Umzug, Krankheit. Wenn der Stress-Level steigt, kommt Bellen zurück." },
          { name: "Schlaf-Hygiene pflegen", desc: "Erwachsene Hunde brauchen 16-20h Ruhe pro Tag. Wenn {dogName} weniger schläft, ist er reaktiver. Bewusste Ruhe-Phasen einplanen, auch wenn er wach ist." },
          { name: "Aktivitäten ausbalancieren", desc: "Niemals mehrere hochaufregende Aktivitäten am selben Tag stapeln. Park-Besuch + Besuch + langer Spaziergang ist Überforderung. Pro Tag max 2 echte Highlights." },
          { name: "72-Stunden-Stress-Regel", desc: "Nach einem stressigen Ereignis (Tierarzt, Eskalation, Umzug): 72 Stunden bewusst ruhige Tage. Kein Anti-Bell-Training in dieser Zeit. Stress-Hormone müssen abklingen." },
          { name: "Allgemeine Auslastung passend", desc: "Genug Nasenarbeit, Kopfarbeit, Sozial-Kontakt. Ein unterforderter Hund bellt mehr. Tagesplan: 1 körperlich, 1 Nasenarbeit, 1 Kopfarbeit." },
          { name: "Bei Bell-Schub Routine zurückfahren", desc: "Wenn das Bellen plötzlich wieder anfängt: nicht panisch werden. Stress-Faktoren prüfen, Routine ruhiger gestalten, 2 Wochen 'sauber' fahren. Dann normalisiert es sich." },
        ],
        frequency: ["Lebenslange Wartung", "Bei akuten Bell-Schub Routine prüfen"],
        watchFor: ["Stress kumuliert über Tage", "Schlaf-Hygiene oft unterschätzt"],
        gos: ["Stress-Faktoren proaktiv reduzieren", "Schlaf einplanen"],
        noGos: ["Bei Stress-Phase mehr Training", "Bellen ignorieren als Symptom"],
      },
    ],
    abschluss: {
      title: "Abschluss",
      subtitle: "Viel Erfolg",
      paras: [
        "Bellen ist Kommunikation. {dogName} hat Gründe, warum er bellt — Reiz, Frust, Angst, Aufmerksamkeit. Dein Job ist nicht, ihn 'zu still zu machen', sondern die richtige Ursache zu adressieren.",
        "Stille zu belohnen ist die wichtigste Säule. Hunde lernen schneller, was sie BEKOMMEN sollen, als was sie LASSEN sollen. Jede Stille-Phase, die mit Leckerli endet, baut die Routine.",
        "Familien-Konsequenz ist alles. Eine Person, die beim Bellen kuschelt oder schimpft, sabotiert die ganze Arbeit. Briefing am Anfang, alle ziehen mit. Über Wochen zahlt sich das aus.",
        "Wenn das Bellen mal wieder kommt, schau auf den allgemeinen Stress-Level. Oft ist Bellen ein Symptom für Über- oder Unterforderung. Mit Schlaf-Hygiene und ausgeglichener Auslastung bleibt es stabil.",
      ],
    },
  },

  jumping: {
    coverTitle: "Anti-Anspring Plan für",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Warum dieser Plan genau so aufgebaut ist",
      subtitle: "Ruhige Begrüßungen statt Chaos",
      paras: [
        "{dogName} springt Menschen an, freundlich gemeint, aber unangenehm. Das ist kein Erziehungsfehler, sondern fehlende Impulskontrolle plus die einfache Logik: Springen hat in der Vergangenheit Aufmerksamkeit gebracht.",
        "Hunde sind Meister im Lesen menschlicher Reaktionen. Auch Schimpfen, Wegstoßen oder lautes 'Aus!' ist für {dogName} Aufmerksamkeit. Aufmerksamkeit verstärkt das Verhalten, ohne dass du es willst.",
        "Bei {dogName} arbeiten wir mit dem genauen Gegenteil: 4 Pfoten am Boden bringen Belohnung, Springen bringt NICHTS. Du gibst eine bessere Alternative.",
        "Dieser Plan baut die Routine systematisch auf: zuerst bei dir selbst, dann mit der Familie, dann mit angekündigten Gästen, dann mit fremden Vorbeigängern. Geduldig, konsequent, freundlich.",
      ],
    },
    how: {
      title: "So setzt du die Übungen richtig um",
      paras: [
        "Konsequenz ist alles. Eine Person, die einmal beim Springen 'aber er meints doch nett' streichelt, sabotiert eine Woche Lernfortschritt. Familien-Briefing am Anfang ist Pflicht.",
        "SITZ als Begrüßungs-Alternative ist die wichtigste Säule. {dogName} kann nicht gleichzeitig sitzen und springen. Wir geben ihm ein Verhalten, das mit Springen unvereinbar ist.",
        "Gäste müssen instruiert werden. Sage Besuchern vorab: 'Bitte ignoriere {dogName}, bis er sitzt.' Das fühlt sich anfangs unhöflich an, schützt aber das Training.",
        "Streichelei ist die Belohnung. Wenn {dogName} sitzt, streichelt der Mensch. Wenn {dogName} springt, Rücken zudrehen, keine Aufmerksamkeit. Klar, konsequent, mit jeder Person gleich.",
      ],
    },
    exercises: [
      {
        title: "4-Pfoten-Regel etablieren",
        intro: "Boden-Kontakt wird zur Standard-Belohnung. Springen bringt nichts.",
        steps: [
          { name: "Beobachtungs-Modus aktivieren", desc: "Achte 1-2 Tage bewusst auf jeden Moment, in dem {dogName} dich begrüßt. Wann springt er, wann steht er ruhig? Notiere typische Auslöser." },
          { name: "Bei jedem Wieder-Sehen 4 Pfoten checken", desc: "Du kommst nach Hause, in den Raum, zur Küche zurück. JEDES Mal: hat {dogName} 4 Pfoten am Boden? Wenn ja: SOFORT runter, ruhig hallo, leises Streicheln." },
          { name: "Bei Springen: Rücken zudrehen", desc: "Sobald die Vorderpfoten hochgehen: 180-Grad-Drehung, Augen weg, keinen Ton. Du existierst gerade nicht. KEIN 'Aus!', kein Wegstoßen — das ist Aufmerksamkeit." },
          { name: "4 Pfoten zurück = wieder Aufmerksamkeit", desc: "Sobald 4 Pfoten wieder am Boden: drehen, ruhig hallo. {dogName} lernt blitzschnell: 'Springen = Halter geht weg. Stehen = Hallo.'" },
          { name: "Familien-Briefing am Tag 1", desc: "Alle Hausbewohner kriegen die Regel erklärt. Aufkleber an der Wohnungstür: '4 Pfoten = ja. Springen = wegdrehen.' Inkonsequenz EINER Person sabotiert alles." },
          { name: "Nach 2-3 Wochen konsequent", desc: "Wenn alle mitziehen: Anspringen reduziert sich nach 2-3 Wochen messbar. Der Weg ist nicht 'Springen ausschalten', sondern '4 Pfoten zur Standard-Begrüßung machen'." },
        ],
        frequency: ["Bei jedem Wieder-Sehen anwenden", "Familien-Konsequenz täglich"],
        watchFor: ["Inkonsequenz kostet Wochen", "Niemals 'mal nett anspringen lassen'"],
        gos: ["Rücken zudrehen bei Springen", "4 Pfoten konsequent belohnen"],
        noGos: ["'Aus!' rufen (ist Aufmerksamkeit)", "Mit Knie wegstoßen"],
      },
      {
        title: "SITZ als Begrüßungs-Alternative",
        intro: "Statt nur Springen verhindern: ein erwünschtes Verhalten anbieten.",
        steps: [
          { name: "SITZ muss zuverlässig sitzen", desc: "Voraussetzung: SITZ ist auf normales Signal in 8 von 10 Versuchen zuverlässig. Wenn nicht, erst das festigen, dann die Anti-Anspring-Übung." },
          { name: "Bei Begegnungen SITZ sagen", desc: "Bei Begegnungen (Familie, Gäste, Spaziergänger): SITZ sagen, BEVOR der Mensch in Sprungweite ist. {dogName} bekommt eine Aufgabe." },
          { name: "Bei Sitzen: Mensch streichelt", desc: "{dogName} sitzt: sofort FEIN, Streicheln, leise Belohnung. Der Mensch wird zur Belohnungs-Quelle, nicht zur Sprungrampe." },
          { name: "Bei Aufstehen zum Springen: Streicheln stop", desc: "Sobald {dogName} aufsteht oder springt: Mensch dreht sich weg, Streicheln stop. Sobald wieder SITZ: zuwenden, Streicheln weiter." },
          { name: "Auch Gäste anweisen", desc: "Vorab Gäste briefen: 'Streichelst du nur, wenn er sitzt. Wenn er aufsteht: dreh dich weg.' Schriftlicher Hinweis am Eingang hilft bei vergesslichen Gästen." },
          { name: "Über Wochen automatisch", desc: "Nach 3-4 Wochen wird SITZ zur automatischen Begrüßungs-Routine. {dogName} setzt sich von selbst, weil das die lohnende Strategie ist." },
        ],
        frequency: ["Bei jeder Begegnung", "Über 3-4 Wochen zur Routine"],
        watchFor: ["SITZ muss sehr stabil sein als Voraussetzung", "Gäste-Briefing nicht vergessen"],
        gos: ["SITZ vor jedem Hallo", "Konsequent Gäste briefen"],
        noGos: ["SITZ ohne Belohnung lassen", "Bei Aufstehen weiter streicheln"],
      },
      {
        title: "Eigene Begrüßungs-Routine entdramatisieren",
        intro: "Wie du dich selbst beim Heimkommen verhältst, prägt das Anspringen massiv.",
        steps: [
          { name: "Heimkommen-Choreographie", desc: "Tür auf, ruhig reingehen, Schuhe ausziehen, Tasche abstellen — alles OHNE {dogName} anzuschauen. Auch wenn er aufgeregt springt: ignorieren." },
          { name: "Erst nach 2 Min Aufmerksamkeit", desc: "Lebe normal weiter — geh in die Küche, mach dir Tee, leg den Mantel weg. Erst wenn {dogName} sich beruhigt hat, gehst du zu ihm." },
          { name: "Begrüßung am Boden", desc: "Geh in die Hocke (oder setz dich), {dogName} kommt zu dir. 4 Pfoten am Boden? SITZ? Dann ruhig streicheln. So vermeidest du Hochsprung-Anreize." },
          { name: "Ruhige Stimme", desc: "Begrüße {dogName} in tiefer, ruhiger Stimme. KEIN aufgeregtes 'Wo ist mein Schatz!' Das pusht ihn hoch. Tief und warm: 'Na du.'" },
          { name: "Familie schult sich gegenseitig", desc: "Familienmitglieder erinnern sich gegenseitig. 'Hey, du hast wieder mit hoher Stimme begrüßt — der springt deshalb so.' Ehrliches Feedback bringt Fortschritt." },
          { name: "Über Wochen wird Begrüßung banal", desc: "Nach 4-6 Wochen entspannter Routine: {dogName} ist weniger aufgeregt beim Heimkommen, weil es keine emotionale Spitze mehr ist." },
        ],
        frequency: ["Bei jedem Heimkommen", "Familien-Konsistenz"],
        watchFor: ["Eigene Aufregung dämpfen", "Familie schult sich gegenseitig"],
        gos: ["Tiefe, ruhige Stimme", "Auf Bodenhöhe begrüßen"],
        noGos: ["Hochaufgeregtes 'Wo ist mein Schatz'", "Direkt im Stehen kuscheln"],
      },
      {
        title: "Gäste-Klingel-Routine",
        intro: "Bei Gästen wird das Anspringen besonders intensiv. Wir bauen eine klare Sequenz.",
        steps: [
          { name: "Decke 3m von Eingangstür", desc: "Eine Decke ist 3m von der Tür entfernt platziert, an einem ruhigen Ort. Diese Decke wird der Empfangs-Ort." },
          { name: "Klingel = Decke (geübte Routine)", desc: "Wenn es klingelt: {dogName} läuft auf die Decke (vorher in Trockenübungen aufgebaut). Bei Erfolg: Leckerli auf der Decke." },
          { name: "Gast kommt, ignoriert {dogName}", desc: "Du öffnest die Tür, Gast kommt rein. Gast wurde vorab gebrieft: NICHT ansprechen, NICHT anschauen, NICHT bücken zum {dogName}. Geht direkt ins Wohnzimmer." },
          { name: "Nach 2-3 Min ruhigem Liegen: OK", desc: "Wenn {dogName} 2-3 Min ruhig auf der Decke geblieben ist: OK-Signal, sie darf zum Gast. Wenn nicht: zurück zur Decke, neue 1 Min Pause." },
          { name: "Gast streichelt nur bei SITZ", desc: "Wenn {dogName} beim Gast ist: SITZ-Signal. Bei Sitzen: ruhiges Streicheln. Bei Aufstehen: Streicheln stop, Gast dreht sich weg." },
          { name: "Routine über mehrere Gäste festigen", desc: "Mit verschiedenen Gästen über 4-6 Wochen üben. Verschiedene Hausbewohner-Typen, verschiedene Energien. {dogName} lernt: das gilt für alle, nicht nur für die Familie." },
        ],
        frequency: ["Bei jedem Gäste-Besuch", "Über 4-6 Wochen festigen"],
        watchFor: ["Gäste-Briefing ist Pflicht", "Inkonsequenz EINES Gastes kostet die Übung"],
        gos: ["Decke = Empfangs-Standard", "Gäste vorab klar instruieren"],
        noGos: ["Gäste direkt am Eingang begrüßen lassen", "Springen 'mal durchgehen lassen'"],
      },
      {
        title: "Vorbeigänger im Spaziergang",
        intro: "Anspringen draußen ist heikel. Nicht jeder will einen freundlichen Hund auf dem Mantel.",
        steps: [
          { name: "Beobachtung 1: wann springt er?", desc: "Auf 2-3 Spaziergängen beobachten: bei welchen Menschen springt {dogName}? Männer? Frauen? Kinder? Größe? Hut auf?" },
          { name: "Vor Begegnung SITZ", desc: "Wenn ein Vorbeigänger in Sichtweite kommt (10-15m), gib SITZ-Signal NEBEN deinem Bein. {dogName} sitzt, Belohnung mit Leckerli." },
          { name: "Halten während Vorbeigang", desc: "Während der Mensch vorbeigeht: {dogName} bleibt sitzen, du belohnst alle 5 Sek mit Mini-Leckerli. Aufmerksamkeit ist bei dir, nicht beim Vorbeigänger." },
          { name: "Vorbeigänger anweisen", desc: "Falls der Mensch interessiert wirkt: 'Bitte ignoriere ihn, wir trainieren gerade.' Die meisten Menschen respektieren das." },
          { name: "Nach Passage: weitergehen", desc: "Sobald der Vorbeigänger 5m hinter euch ist: FEIN, weitergehen. Schnüffel-Pause als Bonus-Belohnung." },
          { name: "Über Wochen wird Sitzen Reflex", desc: "Nach 4-6 Wochen setzt {dogName} sich von selbst, wenn ein Vorbeigänger kommt. Vorbeigänger werden zur normalen Routine, nicht zum Sprung-Anlass." },
        ],
        frequency: ["Bei jeder Begegnung im Spaziergang", "Über 4-6 Wochen automatisieren"],
        watchFor: ["Vorbeigänger respektvoll anweisen", "Bei Springen Distanz vergrößern"],
        gos: ["SITZ vor jeder Begegnung", "Hochwertige Belohnung griffbereit"],
        noGos: ["Vorbeigänger mit {dogName} interagieren lassen", "Bei Springen schimpfen"],
      },
      {
        title: "Selbst-Beruhigung üben",
        intro: "Hunde, die anspringen, sind oft generell hochgepuscht. Wir bauen Ruhe-Fähigkeit auf.",
        steps: [
          { name: "Ruhe-Decke etablieren", desc: "Eine Decke an einem ruhigen Ort, die {dogName} kennt. Diese ist für Ruhe-Phasen reserviert, nicht für Spiel." },
          { name: "Vor erwartbarer Aufregung", desc: "Bevor Gäste kommen, bevor du gehst, bevor was Spannendes passiert: führe {dogName} 10 Min auf die Decke. Setze dich daneben, atme ruhig, gib alle 60 Sek ein weiches Leckerli für ruhiges Liegen." },
          { name: "Aufregung als Trigger erkennen", desc: "Auf-Gestaden-sein vor Begegnungen kommt oft schon VOR dem eigentlichen Sprung. {dogName} fängt schon vorab an, hektisch zu werden. Genau dann ist Ruhe-Übung wichtig." },
          { name: "WUNDERBAR als Marker", desc: "Verknüpfe ein Wort wie WUNDERBAR mit Ruhe-Momenten. Wenn {dogName} ruhig liegt: leise WUNDERBAR sagen, weiches Leckerli. Über Wochen wird das Wort zum Anti-Anspring-Anker." },
          { name: "Cool-Down nach Begegnungen", desc: "Nach intensiven Begegnungen: 5-10 Min Cool-Down auf der Decke. {dogName} lernt, dass nach Aufregung Ruhe folgt — nicht weitere Action." },
          { name: "Über Wochen senkt Tagespegel", desc: "Nach 4-6 Wochen mit konsequenter Ruhe-Arbeit ist {dogName}s allgemeiner Tagespegel niedriger. Das Anti-Anspring-Verhalten kommt von einer ruhigeren Basis." },
        ],
        frequency: ["Tägliche Ruhe-Übungen einplanen", "Vor und nach Begegnungen"],
        watchFor: ["Ruhe braucht Übung wie alles andere", "Marker WUNDERBAR sparsam einsetzen"],
        gos: ["Ruhe-Decke pflegen", "Tägliche Cool-Downs"],
        noGos: ["Nach Aufregung sofort wieder aktivieren", "Marker inflationär nutzen"],
      },
      {
        title: "Kinder und ängstliche Menschen",
        intro: "Bei Kindern oder unsicheren Menschen ist Anspringen besonders heikel.",
        steps: [
          { name: "Anspring-Risiko-Personen identifizieren", desc: "Kinder, ältere Menschen, ängstliche Menschen, Personen in Geschäftskleidung. Bei diesen ist Anspringen besonders unangemessen und kann Schaden verursachen." },
          { name: "Sofort SITZ + Leckerli-Strom", desc: "Wenn Risiko-Person in Sicht: SITZ, hochwertige Leckerli alle 3-5 Sek bei {dogName}. Maximale Beschäftigung mit dir, minimale Verfügbarkeit fürs Springen." },
          { name: "Distanz halten", desc: "Bei diesen Personen: 3-5m Abstand halten. Niemand muss begrüßt werden. Wenn du unsicher bist: einfach Bogen gehen, kein Drama." },
          { name: "Bei Annäherung: ausweichen", desc: "Wenn jemand auf dich zukommt mit Streichel-Absicht: höflich, aber bestimmt sagen 'Bitte nicht, er übt gerade.' Die meisten Menschen verstehen das." },
          { name: "Bei Kindern: vorab fragen", desc: "Wenn ein Kind {dogName} streicheln möchte: erst SITZ etablieren, dann Eltern fragen, dann erst ruhiges Streicheln. Kein wildes Spielen, kein Hochjubeln." },
          { name: "Worst-Case-Plan haben", desc: "Falls {dogName} doch jemanden anspringt: ruhig entschuldigen, {dogName} wegführen, nicht in Tirade verfallen. Nach der Situation: kurze Pause, dann normales Training fortsetzen." },
        ],
        frequency: ["Bei Risiko-Begegnungen immer", "Bewusst Distanz halten"],
        watchFor: ["Eltern fragen bei Kindern", "Vorab kommunizieren"],
        gos: ["Distanz als Schutz", "Höflich, aber klar kommunizieren"],
        noGos: ["Kinder streicheln lassen bei unsicheren Hunden", "Aus Höflichkeit Springen 'durchgehen'"],
      },
      {
        title: "Wartungs-Routine etablieren",
        intro: "Wenn das Anspringen weg ist: regelmäßig auffrischen, sonst kommt es zurück.",
        steps: [
          { name: "Routine im Alltag erhalten", desc: "Auch wenn {dogName} seit Monaten nicht mehr springt: 4-Pfoten-Belohnung im Alltag konsequent halten. Sonst erodiert das Verhalten langsam." },
          { name: "Familien-Briefings alle 2-3 Monate", desc: "Familie regelmäßig erinnern: keine Schleichwege ins alte Verhalten. Auch ältere Familienmitglieder, die mal zu Besuch sind, briefen." },
          { name: "Bei neuen Familienmitgliedern", desc: "Neuer Partner, Mitbewohner, Kinder: sofort einbeziehen ins Anti-Anspring-Training. Sonst wird das Anspringen über sie zurückkommen." },
          { name: "Refresh-Übungen 1x monatlich", desc: "1x pro Monat eine bewusste SITZ-bei-Begrüßung-Session mit Familienmitglied. 5 Min, hochwertige Belohnung. Das hält die Verknüpfung frisch." },
          { name: "Bei Rückfall: 1 Woche extra-konsequent", desc: "Wenn {dogName} mal wieder springt: 1 Woche extra-konsequent fahren. Niemals 'das ist halt passiert' akzeptieren. Konsequenz heißt: jedes Mal." },
          { name: "Stress-Tests einbauen", desc: "Alle 4-6 Wochen bewusste Stress-Tests: Mehrgenerationen-Besuch, Kinder, aufregender Gast. Wenn {dogName} unter Stress weiter ruhig bleibt: Routine ist wirklich gefestigt." },
        ],
        frequency: ["Wartung lebenslang", "Stress-Tests alle 4-6 Wochen"],
        watchFor: ["Niemals als 'erledigt' abhaken", "Neue Familienmitglieder sofort einbeziehen"],
        gos: ["Konsequenz im Alltag", "Regelmäßige Refresh-Übungen"],
        noGos: ["Wenn er nicht springt, wird Belohnung weggelassen", "Stress-Tests vermeiden aus Bequemlichkeit"],
      },
    ],
    abschluss: {
      title: "Abschluss",
      subtitle: "Viel Erfolg",
      paras: [
        "Anspringen ist erlerntes Verhalten — und kann genauso erlernt werden, dass es nicht mehr passiert. {dogName} braucht klare Regeln und eine bessere Alternative (SITZ), dann sortiert er das Verhalten von selbst um.",
        "Familien-Konsequenz ist die wichtigste Säule. Ein Hund, der bei Mama nicht springen darf, aber bei Papa schon, wird verwirrt sein und keine Routine entwickeln. Alle ziehen mit, oder es wird schwer.",
        "Gäste sind die wahre Bewährungsprobe. Brief sie vorab, hänge einen Zettel an die Tür, sei höflich-bestimmt. Die meisten Menschen verstehen das und respektieren die Regel.",
        "Halte die Routine auch nach Erfolg lebenslang. Anspringen ist nur eine Inkonsequenz vom Comeback entfernt. Mit täglicher 4-Pfoten-Belohnung und regelmäßigen Stress-Tests bleibt das Verhalten stabil.",
      ],
    },
  },

  destructive: {
    coverTitle: "Anti-Zerstörungs Plan für",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Warum dieser Plan genau so aufgebaut ist",
      subtitle: "Bessere Alternativen statt Verbote",
      paras: [
        "{dogName} zerstört Dinge: Schuhe, Kissen, Möbelkanten, Fernseher-Kabel. Das ist kein 'Trotzverhalten', sondern hat fast immer eine konkrete Ursache: Langeweile, Beißbedürfnis, Trennungsangst oder ungenutzte Energie.",
        "Die Ursache zu erkennen ist 50% der Lösung. Junge Hunde im Zahnwechsel haben Beißbedürfnis. Unterforderte Hunde haben Langeweile. Gestresste Hunde haben Anti-Stress-Verhalten.",
        "Bei {dogName} arbeiten wir nicht mit Strafe (kommt zu spät und zerstört das Vertrauen), sondern mit Management, Alternativen und ausreichender Auslastung.",
        "Dieser Plan baut systematisch auf: Ursachen-Analyse, erlaubte Kau-Objekte etablieren, Management während Abwesenheit, mentale Auslastung erhöhen. Geduldig, ohne Konflikt.",
      ],
    },
    how: {
      title: "So setzt du die Übungen richtig um",
      paras: [
        "Beginne mit der Ursachen-Analyse, bevor du in Aktion gehst. Was, wann, wie? Erst dann weißt du, wo der Hebel ist.",
        "Kau-Objekte rotieren. 4-5 verschiedene Naturkauartikel, Kong-Varianten, Schnüffelmatten. Nicht alle gleichzeitig — Rotation hält die Attraktivität hoch.",
        "Management ist kein Aufgeben, sondern Vernunft. Solange das Training noch im Aufbau ist, kommen Schuhe in den Schrank, Kabel in den Kabelkanal, Risiko-Bereiche werden geschützt.",
        "Niemals nachträglich schimpfen. Wenn du nach Stunden eine zerstörte Sache findest, kann {dogName} das nicht mit der Tat verknüpfen. Das schimpfen erzeugt nur Stress, der die Zerstörung paradoxerweise verstärkt.",
      ],
    },
    exercises: [
      {
        title: "Ursachen-Analyse durchführen",
        intro: "Warum zerstört {dogName}? Erst wenn das klar ist, kann gezielt geholfen werden.",
        steps: [
          { name: "Was wird zerstört?", desc: "Schuhe + persönliche Gegenstände: meist Geruch-orientiert (Bindungsthema). Möbel + Teppiche: Beißbedürfnis. Türen + Fensterrahmen: meist Trennungsangst." },
          { name: "Wann wird zerstört?", desc: "Nur in deiner Abwesenheit: Trennungsangst-Verdacht. Auch wenn du da bist: Langeweile oder Beißbedürfnis. Nachts: eventuell Schlafplatz-Stress oder Aufwach-Beißen." },
          { name: "Alter und Rasse beachten", desc: "Junge Hunde (4-9 Monate) sind im Zahnwechsel — Beißbedürfnis ist normal. Bestimmte Rassen (Terrier, Schäfer) haben höheren Kau-Trieb." },
          { name: "Auslastungs-Bilanz", desc: "Wie viele Stunden Bewegung pro Tag? Wie viel Kopfarbeit (Suchspiel, Tricks)? Wie viel Schlaf? Ein unterforderter Hund zerstört, weil Energie raus muss." },
          { name: "Eine Woche dokumentieren", desc: "Tagebuch über 7 Tage: was wurde zerstört, wann, was war vorher passiert. Muster werden meist schnell erkennbar." },
          { name: "Schwerpunkt wählen", desc: "Basierend auf der Analyse: Anti-Trennungsangst, Anti-Langeweile oder Beißbedürfnis-Management. Pro Hund oft 1-2 Hauptursachen, die parallel adressiert werden." },
        ],
        frequency: ["7 Tage Dokumentation", "Wöchentliche Auswertung"],
        watchFor: ["Mehrere Ursachen kombinieren oft", "Ehrlichkeit bei Auslastungs-Bilanz"],
        gos: ["Tagebuch konsequent führen", "Muster suchen"],
        noGos: ["Annehmen es ist 'Trotz'", "Ohne Analyse 'einfach trainieren'"],
      },
      {
        title: "Erlaubte Kau-Objekte etablieren",
        intro: "Beißbedürfnis befriedigen mit klarem Sortiment statt verbieten.",
        steps: [
          { name: "5-6 verschiedene Kau-Objekte besorgen", desc: "Naturkauartikel (Büffelhaut, Ochsenziemer), Kong Classic, Schnüffelmatte, Naturholz-Knochen, Geweih, Kauwurzeln. Vielfalt hält Attraktivität." },
          { name: "Rotations-System aufbauen", desc: "Pro Tag 1-2 Objekte verfügbar, andere weglegen. Nach 2-3 Tagen Rotation. So bleiben alle Objekte interessant, nichts wird langweilig." },
          { name: "Lange Kau-Sessions ermöglichen", desc: "15-30 Min Kau-Session pro Tag. Diese Wirkdauer ist entscheidend — kürzer = kein Effekt aufs Kau-Bedürfnis. {dogName} muss wirklich Kiefer-Arbeit leisten." },
          { name: "Verbotenes Objekt: Tausch statt Schimpfen", desc: "Wenn du {dogName} mit Schuh erwischst: ruhig Tausch-Leckerli zeigen, AUS sagen, beim Hergeben FEIN + erlaubtes Kau-Objekt anbieten. Niemals schimpfen oder reissen." },
          { name: "Niemals Rohhaut-Knochen", desc: "Rohhaut-Knochen sind Verletzungs- und Erstickungs-Gefahr. Bleib bei Naturkauartikeln aus dem Fachhandel. Geweih ist gut, aber kann Zähne brechen — Vorsicht." },
          { name: "Über Wochen senkt das Bedürfnis", desc: "Nach 4-6 Wochen mit aktivem Kau-Sortiment reduziert sich Zerstörung anderer Objekte messbar. Das Bedürfnis ist befriedigt, kein Frust mehr." },
        ],
        frequency: ["Tägliche Kau-Sessions", "Rotation alle 2-3 Tage"],
        watchFor: ["Niemals Rohhaut", "Qualität wichtiger als Quantität"],
        gos: ["Rotation pflegen", "Lange Sessions ermöglichen"],
        noGos: ["Rohhaut-Knochen", "Bei verbotenem Objekt schimpfen"],
      },
      {
        title: "Management-Zonen einrichten",
        intro: "Wenn nicht beobachtet: sicherer Bereich, keine Möglichkeit zur Zerstörung.",
        steps: [
          { name: "Risiko-Zonen identifizieren", desc: "Flur mit Schuhen, Wohnzimmer mit Fernseher-Kabel, Büro mit Papier. Diese sind kritisch, hier passiert oft Zerstörung." },
          { name: "Sichere Zone festlegen", desc: "Küche mit Babyschutz-Gitter, ein Zimmer, eine Box. Hier ist nichts Zerstörbares. {dogName} bekommt seine erlaubten Kau-Objekte und Wasser." },
          { name: "Box als positive Zone aufbauen", desc: "Wenn du eine Box nutzt: positiv konditionieren. Tür offen lassen, Lieblings-Kong rein, {dogName} darf rein/raus. Niemals als Strafe." },
          { name: "Bei Abwesenheit: sichere Zone", desc: "Wenn du gehst: {dogName} in der sicheren Zone, mit Kau-Objekt oder Kong. Keine Verlockung zur Zerstörung, kein Trauma durch Schimpfen nach der Tat." },
          { name: "Auch bei Anwesenheit eingrenzen", desc: "Wenn du duscht oder kochst, kannst nicht überall hinsehen: {dogName} in der sicheren Zone. Lieber Türen zu als Hund frei in Risiko-Bereich." },
          { name: "Über Wochen Zonen erweitern", desc: "Wenn {dogName} 2-3 Wochen keine Zerstörung mehr: vorsichtig die Zonen erweitern. Wieder Zerstörung? Zurück zur kleineren Zone." },
        ],
        frequency: ["Permanente Routine", "Bei jeder Abwesenheit anwenden"],
        watchFor: ["Niemals als Strafe", "Positiv konditionieren"],
        gos: ["Sichere Zone gemütlich gestalten", "Türen zu in Risiko-Phasen"],
        noGos: ["Box als Strafort", "Volle Wohnung freigeben unbeobachtet"],
      },
      {
        title: "Mentale Auslastung verdoppeln",
        intro: "Müder Hund-Kopf = ruhige Pfoten. Auslastung ist die wichtigste Säule.",
        steps: [
          { name: "Auslastungs-Plan aufstellen", desc: "Pro Tag: 1 Spaziergang (30-60 Min mit Tempo-Wechseln), 1 Nasenarbeit (Suchspiel, Spuren-Suche), 1 Kopfarbeit (Trick, Kong). Plus 2-3x pro Woche Sozial-Kontakt." },
          { name: "Suchspiel statt Schüssel", desc: "Trockenfutter nicht aus der Schüssel, sondern verteilt in der Wohnung oder in der Schnüffelmatte. 20-30 Min Nasenarbeit statt 30 Sek Schlingen." },
          { name: "Kong als Mahlzeit-Ersatz", desc: "1 Mahlzeit pro Tag aus dem Kong (Nassfutter, eingefroren). {dogName} arbeitet 30-60 Min konzentriert, ist danach müde." },
          { name: "Shape-Tricks für Kopfarbeit", desc: "5-7 Min Shape-Session pro Tag: einen neuen Trick beibringen (Pfötchen, Drehen, Touch). Mental anstrengend, macht müde." },
          { name: "Spuren-Suche draußen", desc: "1-2 mal pro Woche: 15-20m Leckerli-Spur auf einer ruhigen Wiese. {dogName} folgt schnüffelnd. Eine 15-Min-Spur ist anstrengender als 30 Min stumpfes Laufen." },
          { name: "Abend-Erschöpfung als Indikator", desc: "Wenn {dogName} abends sichtbar müde ist und freiwillig ruht — Auslastung passt. Wenn er noch zappelt — mehr Kopfarbeit nötig." },
        ],
        frequency: ["Tägliche Auslastungs-Routine", "Pro Säule (Bewegung/Nase/Kopf) täglich etwas"],
        watchFor: ["Qualität > Quantität", "Kopfarbeit oft unterschätzt"],
        gos: ["Mischung aus 3 Säulen", "Mahlzeiten als Beschäftigung"],
        noGos: ["Nur stumpfes Laufen", "Auslastung als 'optional' sehen"],
      },
      {
        title: "Tausch-Geschäft statt Strafe",
        intro: "Wenn {dogName} mit verbotenem Objekt erwischt wird: ruhig tauschen, kein Drama.",
        steps: [
          { name: "Nicht hinterherrennen", desc: "Wenn {dogName} einen Schuh hat: NIEMALS hinterherrennen. Das ist für ihn Spielvergnügen und verstärkt das Aufnehmen massiv." },
          { name: "Ruhig nähern, Tausch zeigen", desc: "Hochwertiges Tausch-Leckerli holen (Hähnchen, Käse), ruhig zu {dogName} gehen, von der Seite, nicht von vorne." },
          { name: "AUS sagen, abwarten", desc: "AUS in ruhiger Stimme, Leckerli sichtbar nahe seiner Nase. 2-3 Sek warten. {dogName} wägt ab: Schuh oder Leckerli?" },
          { name: "Bei Hergeben: FEIN + Tausch", desc: "Sobald {dogName} loslässt: FEIN, Leckerli, dann ein ERLAUBTES Kau-Objekt anbieten. Der Schuh wird leise weggeräumt, ohne Drama." },
          { name: "Niemals reissen", desc: "NIEMALS Hand ins Maul, niemals reissen. Das vergiftet das AUS-Signal lebenslang und kann zur Ressourcen-Verteidigung führen." },
          { name: "Niemals nachträglich schimpfen", desc: "Wenn du nach Stunden eine zerstörte Sache findest: NICHT schimpfen, NICHT Nase reindrücken. {dogName} kann das nicht verknüpfen. Du erzeugst nur Stress." },
        ],
        frequency: ["Bei jedem erwischten Vorfall", "Routine etablieren"],
        watchFor: ["Hochwertige Belohnung griffbereit haben", "Eigene Ruhe bewahren"],
        gos: ["Ruhig tauschen", "Erlaubtes Kau-Objekt anbieten"],
        noGos: ["Hinterherrennen", "Nachträglich schimpfen"],
      },
      {
        title: "Allein-Zeit mit Kong vorbereiten",
        intro: "Wenn Trennungsangst eine Ursache ist: Kong macht die Allein-Zeit erträglich.",
        steps: [
          { name: "Spezial-Kong vorbereiten", desc: "Kong mit Nassfutter, Hähnchenstücken, Käse füllen. 4-6 Stunden einfrieren. Dieser Kong existiert NUR während deiner Abwesenheit." },
          { name: "Übergabe-Ritual", desc: "Kurz vor dem Gehen: Kong an festen Platz (Decke, Box) geben. {dogName} soll sich auf den Kong stürzen, nicht auf deinen Abschied." },
          { name: "Beiläufig gehen", desc: "Kein Drama beim Verlassen. Tür auf, raus, Tür zu. Maximal 5 Sek zwischen Kong-Übergabe und geschlossener Tür." },
          { name: "Per Video kontrollieren", desc: "Smartphone-Kamera einrichten. Schau alle 5-10 Min: arbeitet {dogName} am Kong? Ruht er danach? Oder zerstört er trotzdem?" },
          { name: "Bei Zerstörung trotz Kong: andere Ursache", desc: "Wenn {dogName} den Kong ignoriert und stattdessen zerstört: vermutlich Trennungsangst zu hoch. Dann auf den Anti-Anxiety-Pfad gehen, kürzere Allein-Zeiten." },
          { name: "Kong nach Rückkehr wegnehmen", desc: "Wenn du wieder da bist: Kong ruhig wegnehmen, auch wenn noch Inhalt drin. Der Kong ist exklusiv Allein-Zeit-Werkzeug, nicht für gemeinsame Zeit." },
        ],
        frequency: ["Bei jeder geplanten Abwesenheit", "Kong-Vorrat einfrieren"],
        watchFor: ["Video-Kontrolle als Wahrheit", "Bei Stress andere Ursache prüfen"],
        gos: ["Kong nur für Allein-Zeit", "Beiläufig gehen und kommen"],
        noGos: ["Drama beim Gehen", "Bei Stress länger weg bleiben"],
      },
      {
        title: "Lange Liege-Phasen aufbauen",
        intro: "Hunde, die zerstören, brauchen oft mehr Ruhe-Training, nicht weniger Action.",
        steps: [
          { name: "Ruhe-Decke etablieren", desc: "Decke an einem ruhigen Ort, NICHT im Durchgangsbereich. Hier wird Ruhe trainiert, nicht Spiel." },
          { name: "Decken-Routine täglich", desc: "Pro Tag 2-3 Mal: 10-15 Min Decken-Zeit. {dogName} liegt auf der Decke, du bist daneben oder arbeitest in der Nähe. Alle 1-2 Min weiches Leckerli für ruhiges Liegen." },
          { name: "Kong während Decken-Zeit", desc: "Mit Kong-Beschäftigung kombinieren: Kong rein, {dogName} arbeitet 30-60 Min ruhig daran. Danach schläft er oft direkt ein." },
          { name: "Schlaf-Hygiene pflegen", desc: "Erwachsene Hunde brauchen 16-20h Ruhe pro Tag. Wenn {dogName} weniger schläft, wird er unruhig und sucht Beschäftigung — manchmal durch Zerstörung." },
          { name: "Ruhe vor Allein-Zeit", desc: "10-15 Min Ruhe-Phase auf der Decke VOR jeder geplanten Abwesenheit. Müder Hund + entspannter Hund = weniger Zerstörungs-Risiko." },
          { name: "Über Wochen sucht {dogName} Decke", desc: "Nach 3-4 Wochen geht {dogName} freiwillig auf die Decke, wenn er Ruhe sucht. Die Decke wird zur sicheren Zone, nicht zum Zwangsort." },
        ],
        frequency: ["Tägliche Decken-Zeiten", "Vor jeder Allein-Zeit Ruhe-Phase"],
        watchFor: ["Schlaf wirklich messen", "Decke positiv halten"],
        gos: ["Mit Kong kombinieren", "Vor Abwesenheit Ruhe"],
        noGos: ["Decke als Strafort", "Schlaf-Stunden unterschätzen"],
      },
      {
        title: "Stress-Phasen managen",
        intro: "Wenn besondere Phasen kommen: Routine hochfahren, Risiko reduzieren.",
        steps: [
          { name: "Stress-Phasen erkennen", desc: "Umzug, neue Familienmitglieder, Urlaub, Krankheit, Feiertage. In diesen Phasen ist Zerstörungs-Risiko erhöht." },
          { name: "Management proaktiv hochfahren", desc: "Während Stress-Phasen: engere Zonen, mehr Kau-Beschäftigung, mehr Kong-Allein-Zeit. Lieber zu viel Schutz als zu wenig." },
          { name: "Mehr Auslastung einplanen", desc: "Ein gestresster Hund braucht mehr Nasenarbeit, mehr Kopfarbeit. Lange Spaziergänge ALLEIN reichen nicht — die Auslastungs-Säulen müssen alle bedient werden." },
          { name: "Routinen extra-strikt halten", desc: "Wenn das Leben gerade chaotisch ist, ist eine strikte Tages-Routine für {dogName} doppelt wichtig. Gleiche Zeiten für Spaziergang, Fütterung, Schlaf." },
          { name: "72-Stunden-Stress-Erholung", desc: "Nach einem stressigen Ereignis: 72 Stunden bewusst ruhige Tage. Keine zusätzlichen Reize, keine neuen Trainings-Inhalte. Stress-Hormone müssen abklingen." },
          { name: "Bei Zerstörungs-Schub Routine prüfen", desc: "Wenn {dogName} plötzlich wieder zerstört: nicht panisch werden. Stress-Faktoren prüfen, Management hochfahren, ruhiger fahren. Meist normalisiert es sich in 1-2 Wochen." },
        ],
        frequency: ["Bei jeder Stress-Phase", "Proaktiv vorbereiten"],
        watchFor: ["Stress kumuliert über Tage", "Routine als Stabilisator"],
        gos: ["Management hochfahren", "Routinen striktes halten"],
        noGos: ["Stress-Phase als 'normal' fahren", "Trainings-Inhalte erhöhen bei Stress"],
      },
    ],
    abschluss: {
      title: "Abschluss",
      subtitle: "Viel Erfolg",
      paras: [
        "Zerstörung ist kein Charakterfehler. {dogName} reagiert auf etwas — Beißbedürfnis, Langeweile, Stress, Angst. Wenn du die Ursache adressierst, verschwindet das Symptom.",
        "Erlaubte Kau-Objekte und Auslastung sind die zwei wichtigsten Säulen. Mit einem aktiven Sortiment und täglicher mentaler Beschäftigung kommt Zerstörung kaum noch vor.",
        "Management ist kein Aufgeben. Wer Schuhe wegräumt, Kabel sichert und Risiko-Zonen schließt, schützt sowohl die Einrichtung als auch das Vertrauen zwischen euch. Strafe nach der Tat ist immer schädlich.",
        "Halte das Sortiment auch nach Erfolg lebenslang. Junge Hunde im Zahnwechsel sind eine Phase. Aber das Kau-Bedürfnis bleibt lebenslang ein Bedürfnis. Pflege die Routine, plane Kau-Sortiment im monatlichen Budget ein.",
      ],
    },
  },

  soiling: {
    coverTitle: "Stubenreinheits-Plan für",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Warum dieser Plan genau so aufgebaut ist",
      subtitle: "Klare Routine, sauberer Umgang",
      paras: [
        "{dogName} ist nicht zuverlässig stubenrein. Bei Welpen ist das normal und Teil der Lernkurve. Bei erwachsenen Hunden ist es oft eine Kombination aus fehlender Routine, Stress oder einer medizinischen Ursache.",
        "Wichtig zuerst: bei erwachsenen Hunden mit plötzlichen Unfällen IMMER zuerst Tierarzt-Check. Blasenentzündung, Niere, Hormonschwankungen können Ursache sein. Erst wenn medizinisch alles klar ist, machen wir Verhaltens-Training.",
        "Bei {dogName} bauen wir Stubenreinheit über Vorhersehbarkeit und Belohnung auf. Strafe funktioniert nicht und schadet — Hunde verstehen den Zusammenhang nicht und verstecken sich zukünftig.",
        "Dieser Plan setzt auf 6 Säulen: Routine etablieren, Toilettendrang lesen, am richtigen Platz belohnen, Unfälle managen, Stress reduzieren, langsam Frequenz reduzieren. Geduldig, ohne Druck.",
      ],
    },
    how: {
      title: "So setzt du die Übungen richtig um",
      paras: [
        "Tierarzt zuerst. Bei erwachsenen Hunden, die plötzlich unrein werden, ist medizinische Ursache wahrscheinlich. Bei Welpen reicht meist Routine.",
        "Die Routine ist alles. 5-7 Toilettenrunden pro Tag bei Welpen, 4-5 bei jungen Hunden, 3-4 bei erwachsenen. Feste Zeiten: nach Aufwachen, nach Fressen, nach Spiel, nach Schlaf, vor Schlaf.",
        "Belohnung direkt am Platz und SOFORT. Wenn {dogName} draußen pinkelt: SOFORT FEIN + hochwertiges Leckerli, direkt am Ort des Geschehens. Verzögerung von 5+ Sek lernt nichts.",
        "Bei Unfällen: enzymatischen Reiniger nutzen (Tierhandlung). Normaler Reiniger entfernt den Geruch nicht vollständig, {dogName} riecht weiter den Reiz und pinkelt erneut an gleicher Stelle.",
      ],
    },
    exercises: [
      {
        title: "Tierarzt-Check und Basis-Tagebuch",
        intro: "Bevor du irgendetwas trainierst: Ursachen sicher abklären.",
        steps: [
          { name: "Tierarzt-Termin vereinbaren", desc: "Bei erwachsenen Hunden mit Unrein-Problemen: zuerst Tierarzt. Urin-Test, Blut-Test bei älteren Hunden. Häufig findet sich eine behandelbare Ursache (Infektion, Diabetes, Hormone)." },
          { name: "Wasser-Konsum messen", desc: "Eine Woche lang: wie viel trinkt {dogName} pro Tag? Markiere den Wassernapf morgens. Plötzlich viel Trinken kann auf Niere oder Diabetes hinweisen." },
          { name: "Toilettendrang-Tagebuch", desc: "7 Tage notieren: wann pinkelt/kotet {dogName}? Wann passieren Unfälle? Wann ist es draußen? Muster werden meist schnell erkennbar." },
          { name: "Unfall-Stellen markieren", desc: "Notiere, WO in der Wohnung die Unfälle passieren. Immer gleiche Stelle? Möglicherweise Geruchsrest. Immer andere? Eher Stress oder Vergesslichkeit." },
          { name: "Stress-Faktoren prüfen", desc: "Hat sich was geändert? Neuer Bewohner, Umzug, Änderung im Tagesablauf, neuer Hund im Haushalt? Stress-Soiling ist häufig." },
          { name: "Nach 1 Woche Bilanz", desc: "Nach 7 Tagen Datensammlung: ist es medizinisch (Tierarzt-Befund)? Routine-Problem (Muster ersichtlich)? Stress-Problem (Auslöser klar)? Daraus folgt der Schwerpunkt." },
        ],
        frequency: ["7 Tage Dokumentation", "Tierarzt-Termin zeitnah"],
        watchFor: ["Niemals Verhalten trainieren bevor Tierarzt abklärt", "Ehrlich dokumentieren"],
        gos: ["Tierarzt zuerst", "Daten sammeln"],
        noGos: ["Sofort schimpfen ohne Diagnose", "Annehmen es ist 'nur Erziehung'"],
      },
      {
        title: "Berechenbare Toiletten-Routine",
        intro: "Vorhersehbare Zeiten für Toilettengang reduzieren Unfälle massiv.",
        steps: [
          { name: "Feste Toilettenzeiten", desc: "Bei Welpen 5-7x täglich: nach Aufwachen, nach Fressen (15-30 Min später), nach Spiel, nach Schlaf, vor Schlaf, sowie zu festen Tageszeiten." },
          { name: "Pünktlich rausgehen", desc: "Stelle Wecker für die Toilettenzeiten. Verpasste Zeiten = höheres Unfall-Risiko. Lieber 5 Min zu früh als 5 Min zu spät." },
          { name: "Gleicher Platz draußen", desc: "Führe {dogName} an einen festen Toilettenplatz: Garten-Ecke, ruhiges Stück Wiese. Der Geruch von gestern hilft, heute zu pinkeln. Aktiv pflegen, nicht jedes Mal wechseln." },
          { name: "Geduldig warten", desc: "Am Toilettenplatz: 5-10 Min Zeit geben. Nicht ablenken, nicht spielen. Einfach warten und {dogName} die Ruhe geben, sich zu lösen." },
          { name: "Nach Erfolg: Belohnung + Spaziergang", desc: "Sobald {dogName} sich gelöst hat: FEIN, hochwertiges Leckerli, ruhiges Lob. Erst DANN beginnt der eigentliche Spaziergang oder Spiel. Toilette wird Eingangstor zur Belohnung." },
          { name: "Über 2-3 Wochen wird Routine internalisiert", desc: "Nach 2-3 Wochen mit konsequenten Zeiten erwartet {dogName} die Routine und löst sich pünktlich. Unfälle reduzieren sich messbar." },
        ],
        frequency: ["5-7 Toilettenrunden pro Tag", "Konsequente Uhrzeiten halten"],
        watchFor: ["Pünktlichkeit ist alles", "Toilettenplatz pflegen"],
        gos: ["Wecker für Toilettenzeiten", "Gleicher Platz"],
        noGos: ["Toilettenzeiten verschieben", "Direkt nach Pinkeln heim"],
      },
      {
        title: "Toilettendrang lesen lernen",
        intro: "Wer früh erkennt, wann {dogName} muss, kann rechtzeitig rausgehen.",
        steps: [
          { name: "Beobachtungs-Modus aktivieren", desc: "Wenn {dogName} wach ist und sich frei bewegt: bewusst beobachten. Welche Verhaltensweisen kommen VOR dem Pinkeln?" },
          { name: "Typische Auslöser-Signale", desc: "Am Boden schnüffeln, im Kreis drehen, plötzlich unruhig werden, zur Tür schauen, sich zurückziehen, von dir wegbewegen. Alle sind Vor-Signale." },
          { name: "Sofort rausgehen bei Signal", desc: "Sobald eines dieser Signale auftaucht: SOFORT rausgehen. Nicht erst Schuhe anziehen mit Verzögerung. Schnell, schnell. Lieber unnötig rausgegangen als Unfall." },
          { name: "Im Garten/draußen: zum Toilettenplatz", desc: "Wenn ihr draußen seid: ruhig zum festen Toilettenplatz führen. Dort warten, bis {dogName} sich gelöst hat." },
          { name: "Belohnung am Platz", desc: "Sobald Erfolg: FEIN + Mega-Belohnung direkt am Platz. {dogName} verbindet: 'Wenn ich draußen am richtigen Platz pinkle, kommt was Tolles.'" },
          { name: "Über Wochen wirst du schneller", desc: "Nach 3-4 Wochen erkennst du die Vor-Signale fast automatisch. Du reagierst innerhalb von Sekunden. Unfälle werden zur Ausnahme." },
        ],
        frequency: ["Permanente Aufmerksamkeit bei Welpen", "Bei jedem Auslöser-Signal reagieren"],
        watchFor: ["Schnelligkeit ist entscheidend", "Lieber unnötig rausgehen"],
        gos: ["Sofort reagieren auf Signale", "Mega-Belohnung am Platz"],
        noGos: ["Erst Schuhe anziehen, dann gehen", "Signale ignorieren"],
      },
      {
        title: "Belohnung direkt am Toilettenplatz",
        intro: "Timing entscheidet. Belohnung muss direkt am Platz und SOFORT kommen.",
        steps: [
          { name: "Leckerli IMMER dabei haben", desc: "Bei jeder Toilettenrunde: 3-5 hochwertige Leckerli in der Tasche. Hähnchen, Käse, weiche Leckerli — etwas, das {dogName} wirklich liebt." },
          { name: "Während des Pinkelns: leise FEIN", desc: "Sobald {dogName} mit dem Lösen beginnt: leise und sanft FEIN sagen, während er pinkelt. Niemals beim Anfangen, das stört." },
          { name: "Sofort nach Fertig: Leckerli", desc: "In dem Moment, in dem {dogName} fertig ist: SOFORT Leckerli direkt am Platz geben. Nicht erst Sekunden warten. Verzögerung von 5+ Sek schwächt die Verknüpfung deutlich." },
          { name: "Ruhiges Lob", desc: "Lob in tiefer, ruhiger Stimme. Nicht hochgepuscht, sonst regt sich {dogName} auf und es ist schwieriger, beim nächsten Mal sich zu lösen." },
          { name: "Spielzeit als Bonus", desc: "Nach der Belohnung beginnt erst die eigentliche Spielzeit oder der Spaziergang. So lernt {dogName}: Toilette = Eingangstor zu allem Schönen." },
          { name: "Über 2-3 Wochen festigt sich", desc: "Bei konsequenter Belohnung lernt {dogName} in 2-3 Wochen: 'Pinkeln am richtigen Platz lohnt sich.' Er sucht aktiv die Belohnung." },
        ],
        frequency: ["Bei jeder erfolgreichen Toilettenrunde", "Über 2-3 Wochen festigen"],
        watchFor: ["Timing ist alles", "Hochwertige Belohnung verwenden"],
        gos: ["SOFORT nach Pinkeln belohnen", "Hochwertiges Leckerli"],
        noGos: ["Belohnung erst zu Hause", "Trockenfutter als Belohnung"],
      },
      {
        title: "Unfälle ruhig managen",
        intro: "Wenn doch ein Unfall passiert: kein Drama, sondern saubere Routine.",
        steps: [
          { name: "KEIN Schimpfen, KEIN Nase-Reindrücken", desc: "Diese Methoden funktionieren nicht und schaden. {dogName} versteht den Zusammenhang nicht und versteckt sich zukünftig. Eine der häufigsten Fehler." },
          { name: "{dogName} kurz aus dem Raum nehmen", desc: "Wenn Unfall frisch ist: {dogName} ruhig in den Garten/anderen Raum bringen. Vielleicht kommt noch was — dann am Toilettenplatz belohnen." },
          { name: "Mit Enzym-Reiniger sauber machen", desc: "Enzymatischer Reiniger (Tierhandlung) ist Pflicht. Normaler Reiniger entfernt den Geruch für Hunde-Nasen NICHT vollständig. {dogName} riecht weiter den Reiz und pinkelt erneut." },
          { name: "Stelle gründlich behandeln", desc: "Großzügig Enzym-Reiniger auftragen, einwirken lassen (Packung folgen), dann sauber wischen. Auf Teppichen mehrere Anwendungen nötig. Manche Stellen müssen 3-4x behandelt werden." },
          { name: "Tagebuch eintragen", desc: "Notiere: Wann, wo, was war vorher. Vielleicht ein Muster ('immer wenn länger als 4h kein Spaziergang'). Daten helfen, Routine anzupassen." },
          { name: "Routine anpassen, nicht schimpfen", desc: "Bei häufigen Unfällen: Frequenz der Toilettenrunden erhöhen. Bei stress-bedingten Unfällen: Stress-Faktoren reduzieren. Bei jungen Hunden: häufiger raus." },
        ],
        frequency: ["Bei jedem Unfall sofort", "Enzym-Reiniger immer auf Vorrat"],
        watchFor: ["Niemals schimpfen oder strafen", "Geruch vollständig entfernen"],
        gos: ["Enzym-Reiniger verwenden", "Routine anpassen"],
        noGos: ["Schimpfen oder Nase-rein", "Normalreiniger nutzen"],
      },
      {
        title: "Nächtliche Blase trainieren",
        intro: "Wenn nachts Unfälle passieren: gezielte Routine fürs Schlafzimmer.",
        steps: [
          { name: "Wasserentzug 2h vor Nachtruhe", desc: "Wasser-Napf 2 Stunden vor dem Schlafengehen wegnehmen. {dogName} hat dann eine leerere Blase über Nacht. WICHTIG: tagsüber immer frisches Wasser zur Verfügung." },
          { name: "Letzte Toiletten-Runde vor Schlaf", desc: "Direkt vor dem Schlafengehen: lange Toilettenrunde. Erst raus, wenn {dogName} sich wirklich gelöst hat. Lieber 20 Min warten als zurück mit voller Blase." },
          { name: "Schlafplatz an deiner Nähe", desc: "Bei Welpen: Box oder Korb im Schlafzimmer, in deiner Nähe. Wenn {dogName} nachts unruhig wird, hörst du es und kannst rausgehen." },
          { name: "Bei nächtlichen Signalen sofort raus", desc: "Wenn {dogName} aufsteht, fiept, sich unruhig bewegt: NICHT ignorieren. Sofort aufstehen und raus zum Toilettenplatz. Auch um 3 Uhr morgens." },
          { name: "Trocken-Wecker bei Welpen", desc: "Bei Welpen: in den ersten Wochen Wecker stellen, z.B. um 3 Uhr nachts eine zusätzliche Toilettenrunde. Vorbeugung statt Unfall-Reaktion." },
          { name: "Über Wochen Frequenz reduzieren", desc: "Nach 4-6 Wochen wird die Blasenkapazität größer. Du kannst die Nacht-Wecker reduzieren. Bei erwachsenen Hunden sollte eine ganze Nacht ohne Unfall möglich sein." },
        ],
        frequency: ["Tägliche Abend-Routine", "Bei Welpen Nacht-Wecker"],
        watchFor: ["Wasserentzug NUR 2h, niemals länger", "Auf Nacht-Signale reagieren"],
        gos: ["Wasser 2h vor Schlaf weg", "Lange Abend-Toilette"],
        noGos: ["Nachts {dogName} ignorieren bei Unruhe", "Wasser ganz wegnehmen"],
      },
      {
        title: "Stress-bedingte Unfälle reduzieren",
        intro: "Manche Hunde machen aus Stress in die Wohnung. Lösung: Stress angehen, nicht Symptom.",
        steps: [
          { name: "Stress-Auslöser identifizieren", desc: "Gewitter? Neue Menschen? Familien-Veränderungen? Wenn medizinisch alles ok ist und die Routine sitzt, ist Stress oft die Ursache." },
          { name: "Stress-Trigger reduzieren", desc: "Bei Gewitter-Stress: Beruhigungs-Routine mit Decke und Kong. Bei Besuchs-Stress: weniger Besuche oder mehr Vorbereitung. Bei Routine-Veränderungen: extra-strikte Tages-Struktur." },
          { name: "Bei Stress mehr Toilettenrunden", desc: "In stressigen Phasen: Frequenz erhöhen. Lieber alle 2h raus als alle 4h. Gestresste Hunde haben oft eine schwächere Blasenkontrolle." },
          { name: "Beruhigungs-Routinen einbauen", desc: "Nasenarbeit, Cool-Down auf der Decke, Kong-Beschäftigung — alles was {dogName} runterfährt. Stress-Niveau insgesamt senken." },
          { name: "Parallel an Stress-Toleranz arbeiten", desc: "Mini-Stressoren in den Alltag einbauen, an denen {dogName} lernen kann: 'Stress kann ich aushalten.' Anti-Übererregungs-Routine (Reize raus, Decke, Marker)." },
          { name: "Bei chronischem Stress: Tierarzt", desc: "Wenn der Stress nicht reduzierbar ist: Tierarzt einbeziehen. Manchmal hilft kurzfristige medizinische Unterstützung. Auch hier gilt: ohne medizinische Abklärung verschwende keine Monate auf Verhaltens-Training." },
        ],
        frequency: ["Bei Stress-Phasen sofort hochfahren", "Frequenz von Routinen anpassen"],
        watchFor: ["Stress kumuliert", "Bei chronischem Stress Hilfe holen"],
        gos: ["Beruhigungs-Routinen pflegen", "Frequenz erhöhen"],
        noGos: ["Bei Stress mehr Druck", "Stress-Soiling als 'Trotz' interpretieren"],
      },
      {
        title: "Frequenz langsam reduzieren",
        intro: "Wenn Stubenreinheit klappt: schrittweise die Toilettenrunden reduzieren.",
        steps: [
          { name: "Voraussetzung: 3-4 Wochen ohne Unfall", desc: "Erst reduzieren, wenn 3-4 Wochen am Stück KEINE Unfälle. Wenn doch einer dazwischen kommt: Reduktion verschieben." },
          { name: "Erste Reduktion: 1 Runde weniger", desc: "Statt 5 nur noch 4 Toilettenrunden pro Tag. Welche fällt am ehesten weg? Meist die zwischen Nachmittag und Abend, wenn die anderen gut sitzen." },
          { name: "2 Wochen beobachten", desc: "Pro reduzierter Runde: 2 Wochen Beobachtung. Wenn keine Unfälle: weiter reduzieren. Wenn Unfälle: zurück zur höheren Frequenz für 4 Wochen." },
          { name: "Bei Welpen: nicht zu schnell", desc: "Junge Hunde brauchen länger 5-7 Runden. Reduktion erst ab 6-7 Monaten. Vorher: lieber zu oft als zu selten." },
          { name: "Erwachsene Norm: 3-4 Runden", desc: "Gesunde erwachsene Hunde brauchen langfristig 3-4 Toilettenrunden pro Tag. Morgens, mittags, abends, vor Schlaf. Reicht aus, wenn Blase und Verdauung normal sind." },
          { name: "Bei Senioren: wieder hochfahren", desc: "Wenn {dogName} älter wird (10+): Frequenz wieder erhöhen. Senioren haben oft schwächere Blasen und brauchen mehr Routine. Anpassung ist Lebensaufgabe." },
        ],
        frequency: ["Reduktion in 2-Wochen-Schritten", "Niemals voreilig"],
        watchFor: ["Senioren brauchen mehr, nicht weniger", "Bei Unfall sofort zurück"],
        gos: ["Geduldig reduzieren", "Bei Älterwerden anpassen"],
        noGos: ["Zu schnell reduzieren", "Welpen wie Erwachsene behandeln"],
      },
    ],
    abschluss: {
      title: "Abschluss",
      subtitle: "Viel Erfolg",
      paras: [
        "Stubenreinheit ist Lerninhalt wie alles andere — und braucht Zeit, Geduld und konsequente Routine. {dogName} ist kein 'sturer' Hund, sondern noch nicht fertig konditioniert. Mit der richtigen Routine wird das selbstverständlich.",
        "Tierarzt-Check zuerst ist die wichtigste Regel. Erwachsene Hunde, die plötzlich unsauber werden, haben oft eine medizinische Ursache. Ohne Abklärung verschwendest du Monate auf falsches Training.",
        "Strafe funktioniert nicht und schadet. {dogName} versteht den Zusammenhang nicht, lernt nur Angst vor dir und versteckt sich zukünftig. Niemals schimpfen, niemals Nase-Reindrücken. Stattdessen: Routine, Belohnung, Geduld.",
        "Halte die Routine auch nach Erfolg. Stubenreinheit kann verloren gehen, wenn Routine wegfällt. Bei Veränderungen (Umzug, neue Familienmitglieder, älter werdender Hund) lieber frühzeitig die Frequenz erhöhen.",
      ],
    },
  },

  sicherheit: {
    coverTitle: "Sicherheits-Kommandos für",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Warum diese Kommandos über Sicherheit entscheiden",
      subtitle: "Die Grundlagen für den Ernstfall",
      paras: [
        "Die meisten gefährlichen Momente im Hundeleben passieren in Sekunden: die offene Autotür an der Straße, der Köder im Gebüsch, das Reh am Waldrand. In genau diesen Momenten hilft kein langes Training - nur ein Kommando, das sitzt.",
        "Deshalb geht es in diesem Plan nicht um Tricks, sondern um {dogName}s Sicherheit. Jedes der sechs Kommandos ist ein kleiner Rettungsanker: der automatische Halt am Bordstein, der Stopp auf Distanz, das verlässliche Lass-es, der Notfall-Rückruf.",
        "Das Schöne daran: Diese Signale geben nicht nur dir Sicherheit, sondern auch {dogName}. Ein Hund, der klare Regeln kennt, ist entspannter - weil er nicht selbst entscheiden muss, was gefährlich ist.",
        "Du brauchst dafür keine Härte und keinen Drill. Nur Ruhe, klare Wörter und ein paar Minuten am Tag. Schritt für Schritt wird aus jedem Kommando eine Gewohnheit, auf die im Ernstfall Verlass ist.",
      ],
    },
    how: {
      title: "So trainierst du die Kommandos richtig",
      paras: [
        "Übe immer erst dort, wo es leicht ist: drinnen, ohne Ablenkung, in Ruhe. {dogName} muss ein Kommando sicher kennen, bevor Straße, andere Hunde oder Aufregung dazukommen.",
        "Halte die Einheiten kurz. Zwei bis drei Minuten pro Kommando, dafür täglich, bringen mehr als eine lange Übung am Wochenende. Ein gutes Ende zur richtigen Zeit ist wichtiger als viele Wiederholungen.",
        "Belohne großzügig - gerade bei Sicherheits-Kommandos. Wenn Steh oder der Notfall-Rückruf sich für {dogName} immer richtig lohnt, zieht das Wort auch dann, wenn es drauf ankommt.",
        "Steigere die Schwierigkeit immer nur in einem Punkt: entweder mehr Distanz, oder mehr Ablenkung, oder mehr Zeit - nie alles gleichzeitig. Klappt etwas nicht, mach es eine Stufe leichter. Erfolg baut auf Erfolg.",
      ],
    },
    exercises: [
      {
        title: "Der Bordstein-Stopp",
        intro: "{dogName} bleibt automatisch an jeder Kante stehen - bevor er überhaupt an die Straße denkt.",
        steps: [
          { name: "Ruhige Kante wählen", desc: "Beginne an einem Bordstein ohne Verkehr. {dogName} soll die Übung in Ruhe verstehen, bevor echte Straßen dazukommen." },
          { name: "Vor der Kante anhalten", desc: "Kurz vor dem Bordstein selbst stehen bleiben. Nicht ziehen, nicht reden. Einfach anhalten und warten." },
          { name: "Halt belohnen", desc: "Sobald {dogName} steht und die Leine locker ist: ruhig loben, kleines Leckerli an deiner Seite. Der Halt soll sich lohnen." },
          { name: "Freigabe-Wort einführen", desc: "Erst du entscheidest, wann es weitergeht. Ein klares Geh oder Weiter als Freigabe. Vorher passiert nichts." },
          { name: "An jeder Kante wiederholen", desc: "Ab jetzt an jedem Bordstein anhalten - auch ohne Verkehr. So wird der Halt zur Gewohnheit, nicht zur Ausnahme." },
          { name: "Erst dann echte Straßen", desc: "Wenn es an ruhigen Kanten sicher sitzt, übe an belebteren Stellen. Der Ablauf bleibt gleich, nur die Umgebung wird spannender." },
        ],
        frequency: ["An jeder Bordsteinkante", "Erst ohne, dann mit Verkehr", "Bei jedem Spaziergang"],
        watchFor: ["Halt kommt vor der Kante", "Leine bleibt locker", "Du gibst die Freigabe"],
        gos: ["Immer anhalten, ausnahmslos", "Ruhig loben beim Stehen", "Klares Freigabe-Wort"],
        noGos: ["Nicht mal so, mal so", "Nicht den Hund entscheiden lassen", "Nicht über die Straße ziehen"],
      },
      {
        title: "Der Notfall-Stopp (Steh)",
        intro: "Ein Wort, das {dogName} auf der Stelle einfrieren lässt - auch auf Distanz. Für den Moment, der zählt.",
        steps: [
          { name: "Nah beginnen", desc: "Starte direkt vor {dogName}, ohne Ablenkung. Er soll das Wort in Ruhe kennenlernen, bevor Distanz oder Aufregung dazukommen." },
          { name: "Steh plus Stopp-Hand", desc: "Sag ruhig und klar Steh und hebe die flache Hand wie ein Stoppschild. Stimme und Geste gehören zusammen." },
          { name: "Stillstand sofort belohnen", desc: "In der Sekunde, in der {dogName} stehen bleibt: sofort loben und belohnen. Das Timing ist alles - die Belohnung gehört an den Stillstand." },
          { name: "Distanz langsam aufbauen", desc: "Wenn es nah klappt, vergrößere den Abstand. Erst zwei Meter, dann fünf, dann mehr. Immer nur so weit, wie es sicher gelingt." },
          { name: "In Bewegung testen", desc: "Übe den Stopp, während {dogName} langsam auf dich zukommt oder wegläuft. Das ist der Ernstfall: Stopp aus der Bewegung." },
          { name: "Selten, aber ernst", desc: "Nutze das Wort nur, wenn du es meinst - und belohne es immer groß. So bleibt es das stärkste Signal, das du hast." },
        ],
        frequency: ["Täglich 2-3 Mini-Runden", "Distanz nur langsam steigern", "Jedes Gelingen belohnen"],
        watchFor: ["Stopp heißt sofortiger Halt", "Hand und Stimme zusammen", "Belohnung am Stillstand"],
        gos: ["Groß belohnen, jedes Mal", "Ruhig und bestimmt bleiben", "Nur bei echtem Gelingen steigern"],
        noGos: ["Nicht ins Leere rufen", "Nicht schimpfen bei Fehlern", "Nicht zu früh auf Distanz"],
      },
      {
        title: "Bleib und Warte",
        intro: "{dogName} bleibt, wo er ist - an der Tür, am Auto, an der Kreuzung - bis du ihn freigibst.",
        steps: [
          { name: "Grundposition wählen", desc: "Lass {dogName} sitzen oder liegen. Aus einer ruhigen Position heraus fällt Warten leichter als im Stehen." },
          { name: "Bleib plus eine Sekunde", desc: "Sag ruhig Bleib und warte nur eine Sekunde. Dann zurück, loben, belohnen. Anfangs geht es um Sekunden, nicht Minuten." },
          { name: "Zeit langsam dehnen", desc: "Steigere die Wartezeit in kleinen Schritten: zwei, drei, fünf Sekunden. Bricht {dogName} ab, warst du zu schnell - kürzer wieder anfangen." },
          { name: "Einen Schritt Abstand", desc: "Wenn die Zeit klappt, kommt Distanz dazu: ein Schritt zurück, wieder hin, belohnen. Zeit und Abstand nie gleichzeitig steigern." },
          { name: "Ablenkung einbauen", desc: "Übe an der Tür, am geöffneten Auto, an der Kreuzung. Genau dort brauchst du das Bleib im Alltag." },
          { name: "Immer aktiv auflösen", desc: "{dogName} bleibt, bis du Okay oder Geh sagst. Nie von selbst aufstehen lassen - die Freigabe kommt immer von dir." },
        ],
        frequency: ["Täglich kurz üben", "Zeit oder Abstand steigern, nie beides", "An echten Orten testen"],
        watchFor: ["Freigabe kommt von dir", "Kleine Schritte", "Position bleibt stabil"],
        gos: ["Aktiv auflösen mit Wort", "Bei Abbruch leichter machen", "Ruhig bestätigen"],
        noGos: ["Nicht selbst aufstehen lassen", "Nicht zu lang am Anfang", "Nicht locken und wegziehen"],
      },
      {
        title: "Impulskontrolle an Tür und Auto",
        intro: "Kein Rausstürmen mehr - {dogName} wartet an der geöffneten Tür und am Kofferraum auf deine Freigabe.",
        steps: [
          { name: "Hand an den Griff", desc: "Fass Türgriff oder Kofferraum an, ohne zu öffnen. Wird {dogName} hektisch, Hand weg und warten. Ruhe öffnet, Unruhe stoppt." },
          { name: "Spaltbreit öffnen", desc: "Öffne nur einen Spalt. Drängelt {dogName} vor, sofort wieder schließen. Bleibt er ruhig, weiter öffnen." },
          { name: "Ganz offen, er bleibt", desc: "Tür oder Klappe ganz offen - {dogName} bleibt sitzen. Das ist der Kern: eine offene Tür heißt nicht automatisch raus." },
          { name: "Freigabe abwarten lassen", desc: "Erst auf dein Okay darf {dogName} durch oder raus. Ohne Wort passiert nichts, egal wie weit offen." },
          { name: "Am Auto besonders üben", desc: "Der Kofferraum ist der wichtigste Ort: {dogName} springt erst auf Freigabe raus, nie von selbst an die Straße." },
          { name: "Jedes Mal gleich", desc: "Immer dieselbe Regel, an jeder Tür. Keine Ausnahme, wenn es mal schnell gehen soll - gerade dann zählt es." },
        ],
        frequency: ["Bei jeder Tür- und Auto-Situation", "Kurz, aber konsequent", "Kofferraum extra üben"],
        watchFor: ["Offen heißt nicht Freigabe", "Ruhe öffnet die Tür", "Wort vor Bewegung"],
        gos: ["Bei Drängeln schließen", "Nur bei Ruhe öffnen", "Freigabe klar setzen"],
        noGos: ["Nicht rausstürmen lassen", "Keine Ausnahme bei Eile", "Nicht schimpfen, nur schließen"],
      },
      {
        title: "Aus und Lass es",
        intro: "{dogName} lässt sofort los oder nimmt gar nicht erst auf - der wichtigste Schutz gegen Giftköder und Gefahr.",
        steps: [
          { name: "Mit Tausch beginnen", desc: "Halte etwas Langweiliges in der Hand. Sag Aus und tausche gegen ein besseres Leckerli. Loslassen soll sich immer lohnen." },
          { name: "Lass es am Boden", desc: "Leg ein Leckerli auf den Boden und decke es mit der Hand ab. Sag Lass es. Sobald {dogName} ablässt: aus der anderen Hand belohnen." },
          { name: "Nie das Verbotene geben", desc: "Was am Boden liegt, bekommt {dogName} nie. Die Belohnung kommt immer von dir, aus der Hand. So wird Lass es verlässlich." },
          { name: "Hand langsam wegnehmen", desc: "Wenn es klappt, deck das Leckerli nicht mehr ab. {dogName} soll es liegen lassen, obwohl es frei liegt. Fein steigern." },
          { name: "In Bewegung üben", desc: "Geh an einem liegenden Leckerli vorbei und sag Lass es. Der Alltag ist genau das: etwas liegt, ihr geht weiter." },
          { name: "Draußen absichern", desc: "Übe es auf dem Spaziergang mit Abstand. Im Ernstfall - Giftköder, Aas - kann dieses Wort {dogName}s Leben retten." },
        ],
        frequency: ["Täglich 2-3 Minuten", "Erst drinnen, dann draußen", "Immer aus der Hand belohnen"],
        watchFor: ["Verbotenes gibt es nie", "Belohnung aus der Hand", "Ruhig, kein Zerren"],
        gos: ["Gegen Besseres tauschen", "Ablassen groß loben", "Langsam frei liegen lassen"],
        noGos: ["Nie das Bodenstück geben", "Nicht aus dem Maul reißen", "Nicht drohen"],
      },
      {
        title: "Der Notfall-Rückruf",
        intro: "Ein reserviertes Wort, das {dogName} immer zurückholt - geladen für den einen Moment, in dem es zählt.",
        steps: [
          { name: "Neues Wort wählen", desc: "Nimm ein Wort, das ihr sonst nie nutzt - zum Beispiel Hierher oder eine Pfeife. Es darf nie mit etwas Negativem verknüpft sein." },
          { name: "Mit dem Jackpot laden", desc: "Sag das Wort und gib sofort etwas Außergewöhnliches: Käse, Wurst, das absolute Lieblings-Highlight. Nur für dieses Wort." },
          { name: "Ohne Ablenkung starten", desc: "Übe zuerst drinnen, direkt vor {dogName}. Wort, dann Jackpot, viele Male. Das Wort wird zum Versprechen auf das Beste." },
          { name: "Distanz und Räume wechseln", desc: "Ruf {dogName} aus dem Nebenzimmer, dann aus dem Garten. Kommt er, gibt es immer den Jackpot. Nie enttäuschen." },
          { name: "Nie zum Beenden nutzen", desc: "Ruf {dogName} nie mit diesem Wort, um Spaß zu beenden (Leine dran, heim gehen). Sonst verbrennt es. Für den Abbruch gibt es andere Wörter." },
          { name: "Selten und heilig halten", desc: "Nutze das Notfall-Wort im Alltag fast nie. Es bleibt geladen für die echte Gefahr - und zieht dann zuverlässig." },
        ],
        frequency: ["Täglich laden, kaum abrufen", "Immer der Jackpot", "Distanz langsam steigern"],
        watchFor: ["Nur positive Verknüpfung", "Immer die Top-Belohnung", "Nie zum Spaß-Ende"],
        gos: ["Eigenes, reserviertes Wort", "Jackpot jedes Mal", "Selten und ernst einsetzen"],
        noGos: ["Nie zum Beenden rufen", "Nicht schimpfen wenn er kommt", "Nicht im Alltag verheizen"],
      },
    ],
    abschluss: {
      title: "Jetzt ist dein Hund sicherer unterwegs",
      subtitle: "Dranbleiben lohnt sich",
      paras: [
        "Du hast {dogName} jetzt sechs Werkzeuge an die Hand gegeben, die im Ernstfall wirklich zählen. Kein Trick, keine Show - sondern echte Sicherheit für euch beide.",
        "Der Schlüssel ist Wiederholung im Alltag. Ein Bordstein-Stopp, der nur manchmal gilt, hilft nicht. Bleib bei jeder Kante, jeder Tür, jedem Lass es konsequent - dann werden die Kommandos zur Gewohnheit, auf die im entscheidenden Moment Verlass ist.",
        "Halte besonders den Notfall-Rückruf und das Steh heilig: selten einsetzen, immer groß belohnen. So bleiben sie die stärksten Wörter, die du hast.",
        "Und denk dran: Jede kleine Übung heute ist eine Versicherung für morgen. {dogName} vertraut darauf, dass du in der Gefahr für ihn da bist - mit diesen Kommandos bist du es. Viel Freude und sichere Wege euch beiden!",
      ],
    },
  },
};

// Personalisierungs-Helper: ersetzt {dogName} in beliebigem Text.
// WinAnsi-Safe: pdf-lib (Helvetica + WinAnsi) crasht bei Unicode-Sonderzeichen.
// Pfeile, Bullet-Symbole, Smart-Quotes etc. werden vor dem drawText ersetzt.
function winansiSafe(s) {
  if (typeof s !== "string") return s;
  // Code-Point-basiert, um Encoding-Unfälle bei Sed/Replace-All zu vermeiden.
  // Beispiel: → statt direktem Pfeil-Zeichen.
  return s
    .replace(/[→➔➜⇒]/g, ":") // → ➔ ➜ ⇒
    .replace(/[←⇐]/g, "") // ← ⇐
    .replace(/[↑↓]/g, "") // ↑ ↓
    .replace(/[•●◦▪▫]/g, "-") // • ● ◦ ▪ ▫
    .replace(/[✓✔]/g, "ok") // ✓ ✔
    .replace(/[✗✘×]/g, "x") // ✗ ✘ ×
    .replace(/[‘’‚‛]/g, "'") // ‘ ’ ‚ ‛
    .replace(/[“”‟]/g, '"') // “ ” ‟
    .replace(/—/g, ",") // —
    .replace(/–/g, ",") // –
    .replace(/…/g, "..."); // …
}

function personalize(text, dogName) {
  return winansiSafe(String(text || "").replace(/\{dogName\}/g, dogName));
}

// ========= PDF-Aufbau =========
export async function buildPdf(params = {}) {
  const DOG_NAME  = (params.dogName  ?? process.env.DOG_NAME  ?? "Bruno").trim();
  const DOG_BREED = (params.dogBreed ?? process.env.DOG_BREED ?? "Mischling").trim();
  const moduleKey = (params.moduleKey ?? process.env.MODULE_KEY ?? "pulling").trim();

  const mod = MODULES[moduleKey];
  if (!mod) {
    throw new Error(`Unbekannter moduleKey: "${moduleKey}". Verfügbar: ${Object.keys(MODULES).join(", ")}`);
  }

  if (params.verbose !== false) {
    console.log(`Generiere Zusatz-Modul "${moduleKey}" für ${DOG_NAME} (${DOG_BREED})…`);
  }

  const doc = await PDFDocument.create();
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const logoBytes = readFileSync(PUBLIC("logo.png"));
  const logoImage = await doc.embedPng(logoBytes);

  // Cover-Bild optional: wenn fuer das Modul ein eigenes Bild definiert
  // ist UND die Datei existiert, wird es im Medaillon angezeigt.
  // Sonst bleibt das pure typografische Design (Pfote im Medaillon).
  let coverImg = null;
  if (mod.coverImage) {
    try {
      const bytes = readFileSync(PUBLIC(mod.coverImage));
      const ext = mod.coverImage.toLowerCase().split(".").pop();
      coverImg = ext === "jpg" || ext === "jpeg"
        ? await doc.embedJpg(bytes)
        : await doc.embedPng(bytes);
    } catch {
      coverImg = null;
    }
  }

  const MARGIN = 70;
  const CONTENT_W = A4_W - 2 * MARGIN;

  let pageNr = 0;
  function newPage() {
    pageNr += 1;
    const p = doc.addPage([A4_W, A4_H]);
    drawPageBackground(p);
    drawHeaderBanner(p, fontBold, logoImage);
    drawCornerSwooshes(p);
    drawPageNumber(p, pageNr, fontReg);
    return p;
  }

  // ===== SEITE 1 — COVER (typografisch, ohne Bild) =====
  {
    const p = newPage();

    // ── Linke Seite: Titel + Hundename ──
    // Sub-Label klein in Gold-Caps
    const subLabel = "DEIN ZUSATZ-MODUL";
    p.drawText(subLabel, {
      x: MARGIN, y: A4_H - BANNER_H - 80,
      size: 11, font: fontBold, color: GOLD_DARK,
    });
    // Mini-Strich neben Label
    p.drawRectangle({
      x: MARGIN + fontBold.widthOfTextAtSize(subLabel, 11) + 14,
      y: A4_H - BANNER_H - 76,
      width: 60, height: 1.5, color: GOLD,
    });

    // Haupttitel (kann 2 Zeilen sein)
    let y = A4_H - BANNER_H - 130;
    const titleSize = 36;
    const titleStr = mod.coverTitle;
    const titleLines = wrapText(titleStr, fontBold, titleSize, A4_W - 2 * MARGIN - 20);
    for (const line of titleLines) {
      p.drawText(line, { x: MARGIN, y, size: titleSize, font: fontBold, color: DARK_BROWN });
      y -= titleSize + 4;
    }

    // Hundename — groß, in Italic-Stil
    y -= 28;
    p.drawText(DOG_NAME, {
      x: MARGIN, y, size: 64, font: fontItalic, color: GOLD_DARK,
    });

    // ── Mittlerer Bereich: Quote-Box ──
    y -= 80;
    const quoteW = A4_W - 2 * MARGIN;
    const quoteH = 70;
    drawRoundedRect(p, MARGIN, y - quoteH, quoteW, quoteH, 12, BG_BAR);
    // linke goldene Akzent-Linie
    p.drawRectangle({
      x: MARGIN + 12, y: y - quoteH + 12,
      width: 3, height: quoteH - 24, color: GOLD,
    });
    // Quote-Text
    const quoteText = `Jeder Hund verdient einen Weg, der zu ihm passt.`;
    p.drawText(quoteText, {
      x: MARGIN + 28, y: y - 28,
      size: 14, font: fontItalic, color: DARK_BROWN,
    });
    p.drawText(`Diesen hier haben wir mit Sorgfalt fuer ${DOG_NAME} gebaut.`, {
      x: MARGIN + 28, y: y - 48,
      size: 11.5, font: fontReg, color: TEXT_MEDIUM,
    });

    // ── Premium-Footer: drei aufeinander aufbauende Linien als
    //    typografische Signatur (statt der Pfoten-Spur die zu kinderbuch
    //    wirkte). Vermittelt Wertigkeit + Ruhe.
    const footerY = 90;
    // Hauptlinie: kraeftiger gold-stripe rechts ausgerichtet
    p.drawRectangle({
      x: MARGIN, y: footerY,
      width: 80, height: 2.5, color: GOLD,
    });
    // Kleiner Akzent darunter
    p.drawRectangle({
      x: MARGIN, y: footerY - 10,
      width: 40, height: 1.5, color: GOLD_SOFT,
    });
    // Signatur-Text rechts neben den Linien
    p.drawText("PFOTEN-PLAN", {
      x: MARGIN + 100, y: footerY - 4,
      size: 10.5, font: fontBold, color: GOLD_DARK,
    });
    p.drawText("Premium Trainings-Modul", {
      x: MARGIN + 100, y: footerY - 18,
      size: 9, font: fontReg, color: TEXT_MEDIUM,
    });
  }

  // ===== SEITE 2 — Warum dieser Plan =====
  {
    const p = newPage();
    let y = A4_H - BANNER_H - 50;
    p.drawText(mod.why.title, { x: MARGIN, y, size: 26, font: fontBold, color: DARK_BROWN });
    y -= 6;
    p.drawRectangle({ x: MARGIN, y: y - 4, width: 220, height: 2, color: GOLD });
    y -= 18;
    p.drawText(mod.why.subtitle, { x: MARGIN, y, size: 12, font: fontBold, color: GOLD_DARK });
    y -= 26;
    for (const para of (Array.isArray(params.whyParas) && params.whyParas.length ? params.whyParas : mod.why.paras)) {
      y = drawParagraph(p, personalize(para, DOG_NAME), MARGIN, y, CONTENT_W, fontReg, 12, TEXT_DARK, 17);
      y -= 10;
    }
  }

  // ===== SEITE 3 — So setzt du die Übungen richtig um =====
  {
    const p = newPage();
    let y = drawSectionTitle(p, mod.how.title, MARGIN, A4_H - BANNER_H - 50, fontBold, 26);
    y -= 6;
    for (const para of mod.how.paras) {
      y = drawParagraph(p, personalize(para, DOG_NAME), MARGIN, y, CONTENT_W, fontReg, 12, TEXT_DARK, 17);
      y -= 10;
    }
  }

  // ===== SEITE 4-9 — 6 Übungen =====
  for (let i = 0; i < mod.exercises.length; i++) {
    const ex = mod.exercises[i];
    const p = newPage();

    // Layout: links 60% (Steps), rechts 35% (Sidebar)
    const LEFT_W = A4_W * 0.58 - MARGIN;
    const RIGHT_X = MARGIN + LEFT_W + 30;
    const RIGHT_W = A4_W - RIGHT_X - MARGIN;

    // Übungstitel mit Star (Stern aus 2 ineinandergesetzten Rauten)
    let y = A4_H - BANNER_H - 55;
    const starX = MARGIN;
    const starY = y - 4;
    // Goldener Stern als 4-Punkt-Ornament
    p.drawCircle({ x: starX + 12, y: starY, size: 9, color: rgb(240/255, 195/255, 95/255) });
    p.drawText(`Übung ${i + 1}: ${ex.title}`, {
      x: MARGIN + 32, y: y - 12,
      size: 22, font: fontBold, color: DARK_BROWN,
    });
    y -= 38;

    // Intro-Text
    y = drawParagraph(p, personalize(ex.intro, DOG_NAME), MARGIN, y, LEFT_W, fontReg, 11.5, TEXT_DARK, 16);
    y -= 14;

    // "Schritt für Schritt"
    p.drawText("Schritt für Schritt", { x: MARGIN, y, size: 14, font: fontBold, color: DARK_BROWN });
    y -= 22;

    // 6 Schritte links
    for (let si = 0; si < ex.steps.length; si++) {
      const step = ex.steps[si];
      // Step-Title bold + Number prefix
      const stepHeader = `${si + 1}. ${step.name}`;
      const headerLines = wrapText(stepHeader, fontBold, 11, LEFT_W);
      for (const hl of headerLines) {
        p.drawText(hl, { x: MARGIN, y, size: 11, font: fontBold, color: DARK_BROWN });
        y -= 14;
      }
      y -= 2;
      // Description regular
      y = drawParagraph(p, personalize(step.desc, DOG_NAME), MARGIN, y, LEFT_W, fontReg, 10.5, TEXT_DARK, 13);
      y -= 8;
    }

    // ── Sidebar rechts ──
    let sy = A4_H - BANNER_H - 95;

    function sidebarBlock(title, items, titleColor = DARK_BROWN) {
      p.drawText(title, { x: RIGHT_X, y: sy, size: 12, font: fontBold, color: titleColor });
      sy -= 18;
      for (const it of items) {
        const dot = "•";
        p.drawText(dot, { x: RIGHT_X, y: sy, size: 10, font: fontBold, color: GOLD });
        const lines = wrapText(personalize(it, DOG_NAME), fontReg, 10, RIGHT_W - 14);
        for (let li = 0; li < lines.length; li++) {
          p.drawText(lines[li], { x: RIGHT_X + 12, y: sy, size: 10, font: fontReg, color: TEXT_DARK });
          sy -= 13;
        }
        sy -= 2;
      }
      sy -= 10;
    }

    sidebarBlock("Wie oft und wie lange", ex.frequency || []);
    sidebarBlock("Worauf du achten solltest", ex.watchFor || []);
    sidebarBlock("Go's", ex.gos || [], rgb(60/255, 130/255, 70/255));
    sidebarBlock("No Go's", ex.noGos || [], rgb(180/255, 60/255, 50/255));
  }

  // ===== SEITE 10 — Abschluss =====
  {
    const p = newPage();
    let y = A4_H - BANNER_H - 50;
    p.drawText(mod.abschluss.title, { x: MARGIN, y, size: 28, font: fontBold, color: DARK_BROWN });
    y -= 8;
    p.drawRectangle({ x: MARGIN, y: y - 4, width: 140, height: 2, color: GOLD });
    y -= 20;
    p.drawText(mod.abschluss.subtitle, { x: MARGIN, y, size: 12, font: fontBold, color: GOLD_DARK });
    y -= 28;
    for (const para of mod.abschluss.paras) {
      y = drawParagraph(p, personalize(para, DOG_NAME), MARGIN, y, CONTENT_W, fontReg, 12, TEXT_DARK, 17);
      y -= 10;
    }
  }

  // ========= Speichern =========
  const bytes = await doc.save();
  if (params.verbose !== false) {
    console.log(`  Seiten: ${pageNr}`);
  }
  return bytes;
}

// ========= CLI-Wrapper =========
const __isMain = import.meta.url === `file://${process.argv[1]}`;
if (__isMain) {
  buildPdf()
    .then((bytes) => {
      const moduleKey = (process.env.MODULE_KEY || "pulling").trim();
      const outPath = PUBLIC(`zusatzmodul-${moduleKey}-TEST.pdf`);
      writeFileSync(outPath, bytes);
      console.log(`✓ PDF geschrieben: ${outPath}`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
