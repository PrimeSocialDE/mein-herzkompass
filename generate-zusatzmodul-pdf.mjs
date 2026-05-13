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
  pulling: {
    coverTitle: "Leinenführungs-Plan für",
    coverImage: "leinenfuehrung-cover.png",  // wenn vorhanden, sonst fallback
    fallbackCoverImage: "Hund4.png",
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
    coverImage: "energie-ruhe-cover.png",
    fallbackCoverImage: "Hund4.png",
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
};

// Personalisierungs-Helper: ersetzt {dogName} in beliebigem Text.
function personalize(text, dogName) {
  return String(text || "").replace(/\{dogName\}/g, dogName);
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

  const logoBytes = readFileSync(PUBLIC("logo.png"));
  const logoImage = await doc.embedPng(logoBytes);

  // Cover-Bild: bevorzugt modul-spezifisch, fallback auf generic
  let coverImg;
  try {
    coverImg = await doc.embedPng(readFileSync(PUBLIC(mod.coverImage)));
  } catch {
    coverImg = await doc.embedPng(readFileSync(PUBLIC(mod.fallbackCoverImage || "Hund4.png")));
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

  // ===== SEITE 1 — COVER =====
  {
    const p = newPage();
    const leftW = A4_W * 0.55;
    let y = A4_H - BANNER_H - 110;
    const titleSize = 38;
    const titleStr = mod.coverTitle;
    p.drawText(titleStr, { x: MARGIN, y, size: titleSize, font: fontBold, color: DARK_BROWN });
    // Unterstrich
    p.drawRectangle({
      x: MARGIN, y: y - 10,
      width: fontBold.widthOfTextAtSize(titleStr, titleSize) * 0.55,
      height: 2, color: GOLD,
    });
    // Hundenamen
    y -= 70;
    p.drawText(DOG_NAME, { x: MARGIN, y, size: 36, font: fontReg, color: DARK_BROWN });

    // Pfoten-Deko unten links
    drawPaw(p, MARGIN + 30, 130, 1.6, GOLD_SOFT);
    drawPaw(p, MARGIN + 95, 100, 1.4, GOLD_SOFT);
    drawPaw(p, MARGIN + 165, 130, 1.6, GOLD_SOFT);
    drawPaw(p, MARGIN + 230, 100, 1.4, GOLD_SOFT);

    // Rechte Seite: Cover-Bild
    const boxW = 320;
    const boxH = 320;
    const boxX = leftW + (A4_W - leftW - boxW) / 2;
    const boxY = (A4_H - BANNER_H - boxH) / 2 + 20;
    p.drawImage(coverImg, { x: boxX, y: boxY, width: boxW, height: boxH });
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
    for (const para of mod.why.paras) {
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
        const lines = wrapText(it, fontReg, 10, RIGHT_W - 14);
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
