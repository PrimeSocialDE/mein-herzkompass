// Generiert einen personalisierten 3-Monats-Trainingsplan als A4-PDF
// (PfotenPlan-Style — gleiches Layout wie 1- und 6-Monatsplan, aber
// 12 Wochen à 3 Seiten = 36 Seiten + Intro/Outro ergibt ca. 47 Seiten).
//
// Verwendung (lokal zum Preview):
//   DOG_NAME="Eddy" DOG_BREED="Mischling" DOG_AGE="2 Jahre" \
//   MAIN_PROBLEM="Ängstlichkeit gegenüber Menschen" \
//   node generate-3monatsplan-pdf.mjs
//
// Output: public/monatsplan-3monat-TEST.pdf

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFileSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join as pathJoin } from "path";
import QRCode from "qrcode";

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
const DEFAULT_DOG_NAME     = "Eddy";
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

// Wochen-Label-Box (oben links auf Wochen-Seiten, mit weichem Tan-Hintergrund).
function drawWeekLabel(page, weekNr, x, y, fontBold, _fontReg) {
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

// ========= Content (Yuna-Standardplan, 1:1 aus Original) =========
function buildPlan(DOG_NAME, MAIN_PROBLEM) {
  return {
  intro: {
    welcomeTitle: "Willkommen bei euren drei Trainingsmonaten",
    welcomeText: [
      `Dieser Trainingsplan wurde speziell für ${DOG_NAME} und ihre Bedürfnisse entwickelt. Er begleitet dich über drei Monate Schritt für Schritt durch 12 aufeinander aufbauende Wochen. In dieser Zeit baut ihr ein solides Fundament, übertragt das Gelernte in den Alltag und stabilisiert die neuen Verhaltensmuster, damit sie auch nach den drei Monaten Bestand haben.`,
      `${DOG_NAME}s ${MAIN_PROBLEM} und ihre Unsicherheit in der Umwelt sind der Ausgangspunkt dieses Plans. Das Ziel ist nicht, ${DOG_NAME} zu einem kontaktfreudigen Hund zu machen, sondern ihr über drei Monate Werkzeuge an die Hand zu geben, mit denen sie beängstigende Situationen souverän bewältigen kann. Du als Bezugsperson wirst dabei zu ihrem verlässlichen Anker.`,
      `Der Plan baut systematisch aufeinander auf, weshalb die Reihenfolge der Wochen wichtig ist. Jede Woche hat klare Ziele und einen Wochencheck, der dir zeigt, ob ${DOG_NAME} bereit für die nächste Stufe ist. Wenn ein Schritt noch nicht sitzt, ist es völlig in Ordnung, eine Woche zu wiederholen. Fortschritt entsteht durch Wiederholung und positive Erfahrungen, nicht durch Tempo.`,
      `Lies den gesamten Plan einmal durch, bevor du mit dem Training beginnst. So verstehst du, wohin die Reise über die zwölf Wochen geht, und kannst die einzelnen Übungen besser einordnen. Markiere dir die Stellen, die dir besonders wichtig erscheinen, und bereite dein Trainingsmaterial vor, bevor du in Woche 1 startest.`,
    ],
    workTitle: "So arbeitest du mit diesem Plan richtig",
    workText: [
      `Der Plan ist in 12 Wochen gegliedert, die jeweils ein konkretes Entwicklungsziel verfolgen. Die Wochen 1 und 2 legen das Fundament drinnen und im Garten. Die Wochen 3 und 4 verlagern das Training nach draußen in reizarme Bereiche. Wochen 5 bis 8 führen kontrollierte Begegnungsübungen ein und generalisieren das Gelernte. Wochen 9 bis 12 stabilisieren das Verhalten in echten Alltagssituationen und schaffen langfristige Routinen.`,
      `Jede Woche enthält zwei Kernübungen mit detaillierten Schritt-für-Schritt-Anleitungen. Die Kernübungen sind das Herzstück des Trainings und sollten täglich mehrmals kurz geübt werden. Zusätzlich gibt es Alltagstipps, die dir helfen, das Gelernte in den normalen Tagesablauf einzubauen.`,
      `Am Ende jeder Woche findest du einen Wochencheck mit konkreten Kriterien. Diese Kriterien zeigen dir, ob ${DOG_NAME} die Inhalte der Woche verinnerlicht hat. Gehe erst zur nächsten Woche über, wenn die Mehrheit der Checkpunkte erfüllt ist. Ehrlichkeit bei der Einschätzung ist wichtiger als schnelles Vorankommen.`,
      `Die Zeitangaben bei den Übungen sind Richtwerte. Kurze, konzentrierte Einheiten sind effektiver als lange, ermüdende Trainingsblöcke. Beende jede Übung dann, wenn ${DOG_NAME} noch motiviert und aufmerksam ist, auch wenn die angegebene Zeit noch nicht um ist.`,
    ],
    rulesTitle: "Die drei Grundregeln im Training",
    rulesText: [
      `Trainiere immer in kurzen Einheiten von drei bis maximal zehn Minuten. ${DOG_NAME}s Konzentrationsfähigkeit ist begrenzt, besonders in stressigen Situationen. Mehrere kurze Einheiten über den Tag verteilt bringen deutlich mehr als eine lange Sitzung. Qualität geht immer vor Quantität.`,
      `Verwende ausschließlich positive Verstärkung in Form von Leckerlis, ruhigem Lob und Streicheln. Strafe, Leinenruck oder lautes Schimpfen sind bei einem ängstlichen Hund wie ${DOG_NAME} absolut kontraproduktiv, weil sie die Angst verstärken statt sie zu lösen. Dein Ziel ist, dass ${DOG_NAME} gute Erfahrungen sammelt und Vertrauen aufbaut.`,
      `Achte auf ${DOG_NAME}s Körpersprache und respektiere ihre Grenzen. Eingeklemmte Rute, abgewandter Blick, Hecheln bei kühlen Temperaturen und steifer Körper sind Stresssignale. Wenn du diese Zeichen siehst, ist die Situation zu viel für ${DOG_NAME} und du solltest sofort die Distanz vergrößern oder die Übung vereinfachen.`,
      `Konsistenz ist der Schlüssel zum Erfolg. Verwende immer dieselben Signalwörter in derselben Tonlage und belohne immer dasselbe Verhalten. Alle Familienmitglieder sollten die gleichen Regeln und Signale verwenden, damit ${DOG_NAME} nicht verwirrt wird.`,
    ],
  },
  profile: {
    overviewTitle: "Dein Hund im Überblick",
    overviewText: [
      `${DOG_NAME} ist eine Hündin mit generalisierter Ängstlichkeit und ausgeprägter Unsicherheit gegenüber erwachsenen Menschen. Diese Angst zeigt sich in verschiedenen Verhaltensweisen, die im Alltag zu Herausforderungen führen. ${DOG_NAME}s Stresssignale umfassen Meideverhalten, eine eingeklemmte Rute, körperliche Anspannung und das aktive Vermeiden von Blickkontakt mit fremden Personen.`,
      `An der Leine zeigt ${DOG_NAME} starkes Ziehen, das vor allem in angstauslösenden Situationen auftritt. Dieses Ziehen ist kein Ungehorsam, sondern ein Fluchtversuch. ${DOG_NAME} versucht, durch schnelles Vorwärtsbewegen oder seitliches Ausweichen Abstand zwischen sich und den angstauslösenden Reiz zu bringen. Die Leine verhindert die Flucht, was den Stress zusätzlich erhöht.`,
      `In Situationen, in denen ${DOG_NAME} keinen Abstand herstellen kann, beginnt sie zu bellen. Dieses Bellen ist ein Mittel zur Distanzvergrößerung, also eine Aufforderung an das Gegenüber, sich zu entfernen. ${DOG_NAME} hat bisher keine alternativen Strategien gelernt, um mit beängstigenden Situationen umzugehen, weshalb sie immer wieder auf Bellen und Flucht zurückgreift.`,
      `Trotz dieser Schwierigkeiten bringt ${DOG_NAME} wichtige Ressourcen mit. Sie hat eine Bindung zu ihrer Bezugsperson und sucht in unsicheren Momenten deren Nähe. Genau hier setzt der Trainingsplan an: Die bestehende Bindung wird gestärkt und als Grundlage genutzt, um ${DOG_NAME} neue Bewältigungsstrategien beizubringen.`,
    ],
    causeTitle: "Warum dieses Problem entsteht",
    causeText: [
      `Die Hauptursache für ${DOG_NAME}s Verhalten liegt wahrscheinlich in mangelnden oder negativen Sozialisierungserfahrungen mit erwachsenen Menschen. In einer wichtigen Entwicklungsphase hat ${DOG_NAME} nicht genug positive Kontakte mit verschiedenen Menschen gehabt. Dadurch hat sie fremde Personen als potenzielle Bedrohung abgespeichert. Diese Verknüpfung ist tief verankert und lässt sich nur durch systematische positive Gegenerfahrungen verändern.`,
      `Das Leinenziehen ist eine direkte Konsequenz der Angst. ${DOG_NAME} nutzt es als Bewältigungsstrategie, um durch Flucht nach vorne oder zur Seite Distanz zu dem herzustellen, was ihr Angst macht. Es ist also kein Erziehungsproblem im klassischen Sinne, sondern ein emotionales Problem, das sich motorisch äußert. Deshalb wird das Leinenziehen nicht durch reines Leinentraining gelöst, sondern durch den Abbau der zugrundeliegenden Angst.`,
      `Das Bellen erfüllt eine ähnliche Funktion wie das Ziehen. Wenn Flucht nicht möglich ist, setzt ${DOG_NAME} Bellen als Mittel ein, um den bedrohlichen Reiz auf Abstand zu halten. Da dieses Verhalten in der Vergangenheit oft funktioniert hat, weil Menschen tatsächlich zurückgewichen sind, hat es sich als Strategie verfestigt. ${DOG_NAME} fehlen alternative Verhaltensweisen, die ihr in solchen Momenten Sicherheit geben.`,
      `Alle drei Probleme, die Angst, das Ziehen und das Bellen, hängen also zusammen und entspringen derselben Quelle. Deshalb behandelt dieser Plan nicht die Symptome einzeln, sondern setzt am Kern an. Durch den Aufbau von Vertrauen, Orientierung und alternativen Strategien werden alle drei Bereiche gleichzeitig verbessert.`,
    ],
    goalTitle: "Euer Trainingsziel in 3 Monaten",
    goalText: [
      `Das übergeordnete Ziel dieses 3-Monatsplans ist der Aufbau von emotionaler Sicherheit für ${DOG_NAME}. Über zwölf Wochen lernt sie, dass ihre Bezugsperson eine verlässliche sichere Basis ist, an der sie sich in unsicheren Momenten orientieren kann. Dieser Vertrauensaufbau ist das Fundament für alle weiteren Trainingsschritte.`,
      `Ein zentrales Trainingsziel ist die systematische Desensibilisierung gegenüber erwachsenen Menschen. Das bedeutet, dass ${DOG_NAME} schrittweise und in ihrem eigenen Tempo lernt, fremde Personen mit positiven Erfahrungen zu verknüpfen. Durch viele kontrollierte Begegnungen über die drei Monate verschiebt sich die emotionale Reaktion von Angst zu Gelassenheit. Dieser Prozess braucht Zeit und darf nicht überstürzt werden.`,
      `Im Bereich der Leinenführigkeit ist das Ziel, dass ${DOG_NAME} an lockerer Leine durch verschiedene Umgebungen geht und sich an ihrer Bezugsperson orientiert. Statt Flucht nach vorne soll ${DOG_NAME} durch Blickkontakt und ruhiges Gehen auf Stress reagieren.`,
      `Schließlich soll ${DOG_NAME} alternative Bewältigungsstrategien zum Bellen aufgebaut haben. Dazu gehören der erlernte Blickkontakt auf das Signal SCHAU, das Ausweichen über einen BOGEN, der freiwillige Rückzug zur Bezugsperson und das Abliegen auf einer Decke. Am Ende der drei Monate hat ${DOG_NAME} ein Repertoire an Verhaltensweisen, die sie statt des Bellens einsetzen kann.`,
    ],
  },
  weeks: [
    {
      nr: 1,
      goals: [
        `${DOG_NAME} lernt das Aufmerksamkeitssignal SCHAU und nimmt auf Signal zuverlässig Blickkontakt auf.`,
        `${DOG_NAME} wird an die Entspannungsdecke herangeführt und kann dort für mindestens eine Minute ruhig liegen.`,
        `${DOG_NAME} lernt das Grundprinzip der lockeren Leinenführung in reizarmer Umgebung drinnen.`,
        `${DOG_NAME} erfährt ihre Bezugsperson als sichere Basis, die für Ruhe und Belohnung sorgt.`,
        `Alle Übungen finden drinnen oder im eigenen Garten statt, um ${DOG_NAME}s Stresslevel niedrig zu halten.`,
      ],
      day: [
        `Starte den Tag mit einer kurzen SCHAU-Übung von drei Minuten in einem ruhigen Raum. Fordere vor der Morgenfütterung einen Blickkontakt ein und stelle den Napf erst ab, wenn ${DOG_NAME} dich angesehen hat.`,
        `Übe am Mittag eine weitere SCHAU-Einheit und anschließend das Deckentraining für fünf Minuten. Zusätzlich kannst du eine kurze Handberührungs-Übung mit TOUCH einbauen, um ${DOG_NAME}s Vertrauen in körperliche Nähe zu stärken.`,
        `Am Abend legst du die Decke neben deinen Sitzplatz und belohnst ${DOG_NAME} in unregelmäßigen Abständen für ruhiges Liegen. Vor dem Schlafengehen kannst du noch eine dritte SCHAU-Einheit einbauen und das Leinenspiel in der Wohnung für wenige Minuten üben.`,
      ],
      ex1: {
        title: "Übung 1 Schritt für Schritt",
        sub: "Sicherer Blickkontakt",
        intro: `Mit dieser Übung lernt ${DOG_NAME}, auf das Signal SCHAU sofort Blickkontakt mit dir aufzunehmen. Du brauchst dafür weiche Leckerlis, die ${DOG_NAME} besonders gerne mag, und eine ruhige Umgebung ohne Ablenkung. Die Übung ist erfolgreich, wenn ${DOG_NAME} innerhalb von zwei Sekunden nach dem Signal in deine Augen schaut und von sich aus beginnt, dir Blickkontakt anzubieten.`,
        steps: [
          `Halte ein Leckerli neben dein Gesicht auf Augenhöhe, sage SCHAU und warte, bis ${DOG_NAME} dich ansieht.`,
          `Sobald ${DOG_NAME}s Blick deine Augen trifft, sage sofort FEIN in warmem Ton und gib ihr das Leckerli.`,
          `Wiederhole diese Abfolge fünfmal hintereinander und mache dann eine kurze Pause von dreißig Sekunden.`,
          `Bewege das Leckerli schrittweise vom Gesicht weg, damit ${DOG_NAME} lernt, dich statt die Hand anzuschauen.`,
          `Steigere die Dauer des Blickkontakts langsam auf zwei bis drei Sekunden, bevor du FEIN sagst.`,
          `Übe in verschiedenen Räumen deiner Wohnung, damit ${DOG_NAME} das Signal nicht nur mit einem Ort verknüpft.`,
          `Füge nach einigen Tagen leichte Ablenkungen hinzu, zum Beispiel ein Spielzeug, das am Boden liegt.`,
          `Belohne besonders weichen und ruhigen Blickkontakt mit einem Jackpot aus drei bis vier Leckerlis nacheinander.`,
        ],
      },
      mistakes: [
        `Das Signal SCHAU wiederholt rufen, wenn ${DOG_NAME} nicht reagiert, weil sie so lernt, das erste Signal zu ignorieren.`,
        `Das Leckerli direkt vor ${DOG_NAME}s Nase halten, weil sie dann das Futter fixiert statt Blickkontakt zu üben.`,
        `Zu schnell die Ablenkungen steigern, weil ${DOG_NAME} dann überfordert wird und die Verknüpfung nicht festigt.`,
        `Üben, wenn ${DOG_NAME} aufgeregt oder gestresst ist, weil sie in diesem Zustand nicht lernfähig ist.`,
        `Blickkontakt erzwingen, indem man ${DOG_NAME}s Kopf festhält, weil das Vertrauen zerstört und Angst auslöst.`,
        `Die Übung zu lang ausdehnen, weil ${DOG_NAME}s Konzentration nach drei Minuten nachlässt und Frust entsteht.`,
      ],
      ex2: {
        title: "Übung 2 Schritt für Schritt",
        sub: "Ruheort Decke",
        intro: `${DOG_NAME} lernt bei dieser Übung, auf einer bestimmten Decke zur Ruhe zu kommen. Du brauchst eine Decke, die du ausschließlich für diesen Zweck nutzt, und Leckerlis, die du ruhig verabreichen kannst. Der Fortschritt zeigt sich daran, dass ${DOG_NAME} sich innerhalb von zehn Sekunden auf die Decke legt und Entspannungszeichen wie tiefes Ausatmen oder Kopf ablegen zeigt.`,
        steps: [
          `Lege die Decke an einen ruhigen Ort, führe ${DOG_NAME} mit einem Leckerli dorthin und belohne das Betreten sofort.`,
          `Sobald ${DOG_NAME} mit allen vier Pfoten auf der Decke steht, sage PLATZ und belohne die Liegeposition.`,
          `Gib alle fünf Sekunden ruhig ein Leckerli zwischen ${DOG_NAME}s Vorderpfoten, solange sie auf der Decke liegt.`,
          `Verlängere die Abstände zwischen den Leckerlis langsam auf zehn und dann auf fünfzehn Sekunden.`,
          `Sage FEIN in tiefer, ruhiger Stimme, damit ${DOG_NAME} die Belohnung mit Entspannung verknüpft statt mit Aufregung.`,
          `Wenn ${DOG_NAME} aufsteht, sage nichts und führe sie einfach ruhig und ohne Hektik zurück auf die Decke.`,
          `Übe das Deckenliegen, während du selbst ruhig daneben sitzt und beispielsweise ein Buch liest.`,
          `Beende jede Einheit mit einem klaren Auflösesignal wie LAUF, bevor ${DOG_NAME} von selbst aufsteht und weggeht.`,
          `Nutze immer dieselbe Decke, damit ${DOG_NAME} sie als eindeutiges Signal für Ruhe und Sicherheit erkennt.`,
        ],
      },
      check: [
        `${DOG_NAME} schaut dich bei drei von vier SCHAU-Signalen innerhalb von zwei Sekunden an.`,
        `${DOG_NAME} bietet von sich aus gelegentlich Blickkontakt an, ohne dass du das Signal gibst.`,
        `${DOG_NAME} legt sich auf die Decke und bleibt dort mindestens eine Minute ruhig liegen.`,
        `${DOG_NAME} zeigt auf der Decke erste Entspannungszeichen wie tiefes Ausatmen oder Kopf ablegen.`,
        `${DOG_NAME} versteht beim Leinenspiel drinnen das Grundprinzip, dass lockere Leine Vorwärtskommen bedeutet.`,
      ],
    },
    {
      nr: 2,
      goals: [
        `${DOG_NAME} überträgt den gelernten Blickkontakt und die Leinenführung in ruhige Außenbereiche.`,
        `${DOG_NAME} beginnt, fremde Menschen auf mindestens zwanzig Metern Distanz positiv mit Leckerlis zu verknüpfen.`,
        `${DOG_NAME} geht draußen zehn Schritte am Stück an lockerer Leine, ohne zu ziehen.`,
        `${DOG_NAME} lernt den Rückruf HIER als zuverlässiges Sicherheitssignal kennen.`,
        `Die Entspannungsdecke wird erstmals draußen an einem ruhigen Ort eingesetzt.`,
      ],
      day: [
        `Beginne jeden Spaziergang mit einer kurzen SCHAU-Übung direkt vor der Haustür, um ${DOG_NAME}s Aufmerksamkeit auf dich zu lenken. Übe dann fünf bis sieben Minuten lockere Leinenführung an einem ruhigen Ort ohne Passanten.`,
        `Einmal täglich suchst du einen Ort auf, an dem Menschen in mindestens zwanzig Metern Entfernung vorbeigehen, beispielsweise eine Parkbank am Rand eines Weges. Hier übst du die Gegenkonditionierung für etwa zehn Minuten mit maximal fünf Menschenbegegnungen.`,
        `Am Nachmittag oder Abend legst du die Entspannungsdecke an einem ruhigen Ort draußen aus und übst das Deckenprotokoll wie drinnen. Zusätzlich baust du den Rückruf HIER in ablenkungsarmer Umgebung ein und belohnst ${DOG_NAME}s Kommen mit einem großzügigen Jackpot.`,
      ],
      ex1: {
        title: "Übung 1 Schritt für Schritt",
        sub: "Schau Mal Wer Da",
        intro: `Diese Übung verändert ${DOG_NAME}s emotionale Reaktion auf fremde Menschen grundlegend. Du brauchst einen Ort, an dem Menschen in mindestens zwanzig Metern Entfernung vorbeigehen, und besonders hochwertige Leckerlis. Fortschritt erkennst du daran, dass ${DOG_NAME} bei Erscheinen eines Menschen erwartungsvoll zu dir schaut, statt den Menschen zu fixieren.`,
        steps: [
          `Setze dich mit ${DOG_NAME} an einen ruhigen Ort, von dem aus ihr Menschen in sicherer Entfernung beobachten könnt.`,
          `Sobald ein Mensch in ${DOG_NAME}s Sichtfeld auftaucht, sage ruhig SCHAU und beginne sofort, kleine Leckerlis zu füttern.`,
          `Füttere in gleichmäßigem, ruhigem Tempo weiter, solange der Mensch sichtbar ist und sich im Bereich bewegt.`,
          `Sobald der Mensch aus dem Sichtfeld verschwunden ist, hören die Leckerlis sofort und vollständig auf.`,
          `${DOG_NAME} soll die Verknüpfung aufbauen: Mensch erscheint bedeutet Leckerlis, Mensch verschwindet bedeutet Leckerlis vorbei.`,
          `Beobachte ${DOG_NAME}s Körpersprache genau und achte auf Anspannung, Fixieren, Vorbeugen oder steife Rute als Warnsignale.`,
          `Vergrößere den Abstand sofort, wenn ${DOG_NAME} Stresssignale zeigt, und setze die Übung von dort fort.`,
          `Beende die Einheit nach maximal fünf Menschenbegegnungen oder früher, wenn ${DOG_NAME} müde oder unruhig wirkt.`,
        ],
      },
      mistakes: [
        `Die Leckerlis erst geben, wenn ${DOG_NAME} bereits reagiert hat, weil dann die positive Verknüpfung zu spät kommt.`,
        `Einen Ort wählen, an dem zu viele Menschen gleichzeitig auftauchen, weil ${DOG_NAME} dann dauerhaft im Stress ist.`,
        `${DOG_NAME} am Bellen hindern wollen, indem man die Leine strafft, weil der Leinenzug die Angst zusätzlich verstärkt.`,
        `Zu nah an den Menschen herangehen, weil ${DOG_NAME} dann keine Leckerlis mehr annehmen kann vor Aufregung.`,
        `Die Übung fortsetzen, obwohl ${DOG_NAME} bereits deutliche Stresssignale zeigt, weil das die Angst verschlimmert statt lindert.`,
        `Leckerlis auch geben, wenn kein Mensch sichtbar ist, weil das die gezielte Verknüpfung verwässert und unwirksam macht.`,
      ],
      ex2: {
        title: "Übung 2 Schritt für Schritt",
        sub: "Gemeinsam Gehen",
        intro: `${DOG_NAME} lernt bei dieser Übung, draußen an lockerer Leine neben oder leicht vor dir zu gehen, ohne zu ziehen. Du brauchst eine normale Leine, ein Geschirr und viele kleine Leckerlis in einer gut erreichbaren Tasche. Du erkennst Fortschritt daran, dass ${DOG_NAME} zehn Schritte am Stück gehen kann, ohne dass die Leine straff wird, und sich bei Richtungswechseln innerhalb von drei Sekunden an dir orientiert.`,
        steps: [
          `Starte an einem ruhigen Ort ohne Passanten und beginne langsam und entspannt zu gehen.`,
          `Sage alle fünf Schritte FEIN und gib ${DOG_NAME} ein Leckerli auf Kniehöhe, solange die Leine locker hängt.`,
          `Wird die Leine straff, bleibe sofort und kommentarlos stehen wie eine Statue und warte geduldig ab.`,
          `Sobald ${DOG_NAME} sich zu dir umdreht oder die Leine von selbst lockert, sage FEIN und gehe weiter.`,
          `Baue Richtungswechsel ein, indem du HIER sagst, dich umdrehst und in die entgegengesetzte Richtung gehst.`,
          `Belohne ${DOG_NAME} großzügig, wenn sie den Richtungswechsel mitmacht und zügig zu dir aufschließt.`,
          `Variiere dein Gehtempo zwischen langsam und zügig und belohne ${DOG_NAME}s Anpassung an dein Tempo.`,
          `Halte die Übung bei fünf bis sieben Minuten und beende sie, solange ${DOG_NAME} noch aufmerksam mitarbeitet.`,
        ],
      },
      check: [
        `${DOG_NAME} schaut bei mindestens drei von fünf Menschenbegegnungen auf Distanz erwartungsvoll zu dir statt zum Menschen.`,
        `${DOG_NAME}s Körper bleibt bei Menschenbegegnungen auf zwanzig Metern Entfernung überwiegend locker und entspannt.`,
        `${DOG_NAME} kann draußen zehn Schritte am Stück an lockerer Leine gehen, ohne zu ziehen.`,
        `${DOG_NAME} orientiert sich bei Richtungswechseln innerhalb von drei Sekunden an dir und geht mit.`,
        `${DOG_NAME} kann auf der Entspannungsdecke draußen an einem ruhigen Ort für mindestens eine Minute liegen bleiben.`,
      ],
    },
    {
      nr: 3,
      goals: [
        `${DOG_NAME} bewältigt Begegnungen mit Menschen auf einer reduzierten Distanz von zehn bis fünfzehn Metern.`,
        `${DOG_NAME} lernt das BOGEN-Signal als strukturierte Ausweichstrategie bei entgegenkommenden Menschen.`,
        `${DOG_NAME} kann fremde Menschen ruhig beobachten und wendet den Blick selbstständig zur Bezugsperson zurück.`,
        `${DOG_NAME} zeigt im Alltag deutlich weniger Leinenspannung und seltener Bellverhalten bei Begegnungen.`,
        `Das Signal STOPP wird als ruhige Umlenkung bei beginnendem Bellen eingeführt.`,
      ],
      day: [
        `Starte den Tag mit einer kurzen SCHAU-Übung und einem entspannten Spaziergang, bei dem du den BOGEN bei Begegnungen gezielt einsetzt. Plane die Route so, dass du entgegenkommende Menschen frühzeitig siehst und rechtzeitig reagieren kannst.`,
        `Einmal täglich übst du das Ruhige Beobachten von einer Parkbank oder einem ähnlichen Ort aus, an dem Menschen in zehn bis fünfzehn Metern Entfernung vorbeigehen. Nutze nach jeder Beobachtungssituation eine kurze Schnüffelsuche mit SUCH, um ${DOG_NAME} beim Stressabbau zu helfen.`,
        `Am Abend legst du die Decke aus und belohnst ${DOG_NAME} für entspanntes Liegen. Nutze die ruhige Abendzeit für eine kurze Reflexion: Wie viele Begegnungen hat ${DOG_NAME} heute gut gemeistert und wo brauchte sie noch mehr Abstand.`,
      ],
      ex1: {
        title: "Übung 1 Schritt für Schritt",
        sub: "Sicherer Bogen",
        intro: `Mit dieser Übung lernt ${DOG_NAME} eine klare Ausweichstrategie, die das Bellen und Ziehen bei Begegnungen ersetzt. Du brauchst Leckerlis und eine Leine mit ausreichend Bewegungsfreiheit, am besten drei Meter Länge. Fortschritt erkennst du daran, dass ${DOG_NAME} dem BOGEN-Signal ohne Zögern folgt und sich an dir orientiert statt am entgegenkommenden Menschen.`,
        steps: [
          `Übe den Bewegungsablauf zunächst ohne echte Begegnung, indem du mit ${DOG_NAME} um Laternen oder Mülleimer herumgehst.`,
          `Sage dabei BOGEN und locke ${DOG_NAME} mit einem Leckerli an deiner linken Seite in den Halbkreis hinein.`,
          `Belohne ${DOG_NAME} alle zwei bis drei Schritte während des Bogens mit FEIN und einem Leckerli.`,
          `Fordere während des Bogens mehrfach SCHAU, um ${DOG_NAME}s Aufmerksamkeit auf dich statt auf den Reiz zu halten.`,
          `Steigere auf echte Begegnungen mit großem Abstand von mindestens fünfzehn Metern, sobald das Bewegungsmuster sitzt.`,
          `Gib nach dem erfolgreichen Passieren eines Menschen einen Jackpot aus drei bis vier Leckerlis als besondere Belohnung.`,
          `Verringere den Bogenradius erst dann, wenn ${DOG_NAME} die Übung entspannt und ohne Stresssignale ausführt.`,
          `Leite den BOGEN immer frühzeitig ein, sobald du einen Menschen siehst, und nicht erst, wenn ${DOG_NAME} bereits reagiert.`,
        ],
      },
      mistakes: [
        `Den BOGEN zu spät einleiten, wenn ${DOG_NAME} den Menschen bereits fixiert, weil sie dann nicht mehr ansprechbar ist.`,
        `${DOG_NAME} am straffen Leinenzug in den Bogen zerren, weil physischer Zwang die Angst verstärkt und Vertrauen zerstört.`,
        `Den Bogenradius zu schnell verkleinern, weil ${DOG_NAME} dann zu nah am Auslöser ist und wieder in Stress gerät.`,
        `Vergessen, während des Bogens zu belohnen, weil ${DOG_NAME} dann keinen Grund hat, die Ausweichbewegung positiv zu bewerten.`,
        `In einer Sackgasse üben, wo kein Ausweichen möglich ist, weil ${DOG_NAME} dann keinen Fluchtweg hat und panisch reagiert.`,
      ],
      ex2: {
        title: "Übung 2 Schritt für Schritt",
        sub: "Stilles Schauen",
        intro: `Bei dieser Übung lernt ${DOG_NAME}, fremde Menschen ruhig zu beobachten und den Blick dann eigenständig zu dir zurückzuwenden. Du brauchst eine Bank oder einen festen Standort mit Blick auf einen Gehweg in mindestens zehn Metern Abstand. Du erkennst Fortschritt daran, dass ${DOG_NAME} einen Menschen kurz anschaut und dann von alleine zu dir blickt, ohne dass du SCHAU sagen musst.`,
        steps: [
          `Setze dich mit ${DOG_NAME} an den gewählten Ort und lasse sie die Umgebung zunächst in Ruhe wahrnehmen.`,
          `Wenn ein Mensch vorbeigeht, lasse ${DOG_NAME} kurz hinschauen, ohne etwas zu sagen oder einzugreifen.`,
          `Sobald ${DOG_NAME} den Blick vom Menschen abwendet und dich anschaut, sage sofort FEIN und belohne großzügig.`,
          `Falls ${DOG_NAME} nach drei Sekunden nicht von alleine wegschaut, sage ruhig SCHAU und belohne den Blickkontakt.`,
          `Steigere die Anforderung, indem du erst nach zwei Sekunden gehaltenem Blickkontakt mit dir FEIN sagst und belohnst.`,
          `Arbeite dich von einzelnen ruhigen Fußgängern langsam zu etwas lebhafteren Situationen vor.`,
          `Bei Anzeichen von Stress wie Vorbeugen, Knurren oder Bellen vergrößere sofort den Abstand zum Geschehen.`,
          `Beende jede Einheit mit einer Situation, in der ${DOG_NAME} Erfolg hatte, damit sie ein positives Gefühl mitnimmt.`,
        ],
      },
      check: [
        `${DOG_NAME} folgt dem BOGEN-Signal bei Begegnungen zuverlässig und orientiert sich dabei an dir statt am Menschen.`,
        `${DOG_NAME} zeigt während des Bogengehens keine starken Stresssignale wie steife Rute, Fixieren oder Bellen.`,
        `${DOG_NAME} wendet bei mindestens der Hälfte der Beobachtungssituationen den Blick von sich aus zu dir zurück.`,
        `${DOG_NAME} kann Leckerlis annehmen, während ein Mensch in zehn bis fünfzehn Metern Entfernung vorbeigeht.`,
        `${DOG_NAME} zeigt im Vergleich zum Wochenbeginn sichtbar weniger Leinenspannung und selteneres Bellen bei Begegnungen.`,
      ],
    },
    {
      nr: 4,
      goals: [
        `${DOG_NAME} bewältigt einen normalen Spaziergang mit mehreren Menschenbegegnungen souverän und ohne starkes Bellen.`,
        `${DOG_NAME} zeigt eigenständig gelernte Strategien wie Blickkontakt, Bogen oder Rückzug zur Bezugsperson.`,
        `${DOG_NAME} nähert sich in einer kontrollierten Übung freiwillig einer ruhigen Person auf unter drei Meter.`,
        `Alle Übungen werden in realistische Alltagsszenarien mit unterschiedlichen Schwierigkeitsgraden überführt.`,
        `Der Übergang vom intensiven Training zur langfristigen Alltagsroutine mit festen Ritualen beginnt.`,
      ],
      day: [
        `Nutze den Hauptspaziergang als tägliche Trainingseinheit mit zehn bis fünfzehn Minuten gezieltem Fokus auf Begegnungen. Starte mit einer SCHAU-Übung vor der Haustür und setze BOGEN, SCHAU und SUCH je nach Situation flexibel ein.`,
        `Zwei bis dreimal pro Woche übst du die freiwillige Annäherung an eine kooperative Person, die ${DOG_NAME} komplett ignoriert. Halte diese Einheiten kurz bei maximal fünf Minuten und beende sie immer mit einer positiven Erfahrung.`,
        `Schließe jeden Tag mit einer Entspannungsphase auf der Decke ab, die du auf fünfzehn bis zwanzig Minuten ausdehnen kannst. Belohne in unregelmäßigen Abständen ruhiges Verhalten und nutze deine eigene ruhige Atmung, um ${DOG_NAME} beim Entspannen zu unterstützen.`,
      ],
      ex1: {
        title: "Übung 1 Schritt für Schritt",
        sub: "Sicherer Spaziergang",
        intro: `Diese Übung führt alle gelernten Strategien in einem normalen Alltagsspaziergang zusammen. Du brauchst Leckerlis, die Leine und eine Route mit voraussichtlich drei bis fünf Menschenbegegnungen. Der Fortschritt zeigt sich daran, dass ${DOG_NAME} mindestens drei Begegnungen pro Spaziergang ohne Bellen oder starkes Ziehen bewältigt und sich eigenständig an dir orientiert.`,
        steps: [
          `Starte mit einer kurzen SCHAU-Übung direkt vor der Haustür, um ${DOG_NAME}s Aufmerksamkeit und Fokus zu gewinnen.`,
          `Gehe mit lockerer Leine los und belohne etwa alle zehn Schritte gutes Gehen mit einem ruhigen FEIN.`,
          `Nutze bei der ersten Begegnung BOGEN oder SCHAU, je nachdem welche Strategie die Situation erfordert.`,
          `Setze nach jeder Menschenbegegnung eine kurze Schnüffelsuche mit SUCH ein, um ${DOG_NAME}s Stress abzubauen.`,
          `Beobachte aufmerksam, ob ${DOG_NAME} von sich aus Strategien anwendet, und belohne eigenständiges Verhalten besonders großzügig.`,
          `Variiere die Spazierroute über die Woche, damit ${DOG_NAME} die Strategien auf verschiedene Orte und Situationen überträgt.`,
          `Beende den Spaziergang mit einer positiven Erfahrung und einer ruhigen Phase auf der Decke zu Hause.`,
          `Notiere nach jedem Spaziergang kurz, wie viele Begegnungen gut liefen und wo ${DOG_NAME} noch Unterstützung brauchte.`,
        ],
      },
      mistakes: null, // Woche 4 hat keine "typische Fehler" Seite — stattdessen Stabilisierung
      ex2: {
        title: "Übung 2 Schritt für Schritt",
        sub: `${DOG_NAME}s Entscheidung`,
        intro: `Bei dieser Übung darf ${DOG_NAME} selbst entscheiden, ob und wie nah sie einer ruhigen Person kommen möchte. Du brauchst eine kooperative Person, die bereit ist, ${DOG_NAME} komplett zu ignorieren, und besonders gute Leckerlis. Fortschritt zeigt sich daran, dass ${DOG_NAME} sich der Person auf unter drei Meter nähert, ohne Stresssignale zu zeigen, und in deren Gegenwart ein Leckerli vom Boden aufnehmen kann.`,
        steps: [
          `Bitte die Person, sich in zehn Metern Entfernung seitlich hinzusetzen, den Blick abzuwenden und ${DOG_NAME} komplett zu ignorieren.`,
          `Gehe mit ${DOG_NAME} in die Nähe und bleibe in einer Entfernung stehen, in der ${DOG_NAME} noch deutlich entspannt ist.`,
          `Lasse die Leine lang und gib ${DOG_NAME} die volle Freiheit, sich zu nähern oder Abstand zu halten.`,
          `Belohne jede eigenständige Entscheidung, sowohl mutiges Annähern als auch bewusstes Abstandhalten mit FEIN und Leckerli.`,
          `Die Person soll keinen Blickkontakt herstellen, die Hand nicht ausstrecken und sich insgesamt möglichst ruhig verhalten.`,
          `Wenn ${DOG_NAME} sich nähert und schnüffelt, kann die Person ein Leckerli ohne Bewegung neben sich auf den Boden legen.`,
          `Dränge ${DOG_NAME} niemals zur Annäherung, denn jeder Schritt muss vollständig freiwillig und aus eigener Motivation kommen.`,
          `Beende die Übung nach spätestens fünf Minuten oder sofort, wenn ${DOG_NAME} deutliche Stresszeichen wie Bellen oder Erstarren zeigt.`,
        ],
      },
      stab: {
        title: "Stabilisierung im Alltag",
        text: [
          `Nach den ersten acht Wochen hat ${DOG_NAME} ein Grundrepertoire an Strategien aufgebaut. Das SCHAU-Signal, die lockere Leinenführung und das BOGEN-Gehen sind ab jetzt fester Bestandteil jedes Spaziergangs. In den folgenden 16 Wochen werden diese Strategien in immer komplexeren Situationen erprobt und vertieft.`,
          `Belohne die gelernten Verhaltensweisen weiterhin regelmäßig — gerade jetzt, da der erste Lerneffort vorbei ist, ist Konsistenz entscheidend, damit ${DOG_NAME}s neue Reaktionsmuster sich dauerhaft festigen.`,
        ],
      },
    },
    {
      nr: 5,
      goals: [
        `${DOG_NAME} bewältigt einen Spaziergang mit 5–7 Menschenbegegnungen souverän, ohne dass ihr Stresslevel über den Tag hinweg ansteigt.`,
        `${DOG_NAME} kann Menschengruppen aus mittlerer Distanz (10–15 Meter) ruhig beobachten, ohne anzuschlagen oder zu ziehen.`,
        `Das Deckenliegen wird draußen auf unterschiedliche Orte generalisiert: Garten, Park, Wiese, vor einer Bäckerei.`,
        `${DOG_NAME} lernt, längere Pausen während Spaziergängen aktiv zur Stressregulation zu nutzen.`,
        `Der eigene Spazierrhythmus wird angepasst: bewusstes Verlangsamen statt schnellem Vorwärtsdrang.`,
      ],
      day: [
        `Morgens ein Standardspaziergang mit dem bekannten Übungsrepertoire aus den ersten vier Wochen. Suche dabei aktiv Orte mit moderatem Menschenaufkommen, an denen ${DOG_NAME} ihr neues Verhalten erproben kann.`,
        `Mittags eine 10-minütige Bank-Übung: Setzt euch an einen Ort mit Durchgangsverkehr und übt das ruhige Beobachten. Belohne jedes selbstständige Wegschauen großzügig.`,
        `Abends eine entspannte Decken-Einheit draußen — auf einer Wiese, im Garten oder an einem ruhigen Ort. Ziel: ${DOG_NAME} soll lernen, draußen für 10 Minuten am Stück ruhig liegen zu bleiben.`,
      ],
      ex1: {
        title: "Übung 1 Schritt für Schritt",
        sub: "Mehrfach-Begegnungen",
        intro: `${DOG_NAME} lernt, mehrere Menschenbegegnungen in kurzer Abfolge zu bewältigen, ohne dass sich Stress aufstaut. Du brauchst eine Route mit voraussichtlich 5–7 Begegnungen innerhalb von 20 Minuten. Fortschritt zeigt sich daran, dass ${DOG_NAME} die fünfte Begegnung genauso souverän meistert wie die erste.`,
        steps: [
          `Plane die Route so, dass zwischen den Begegnungen jeweils 2–3 Minuten ruhige Strecke liegen für Regeneration.`,
          `Vor der ersten Begegnung: kurze SCHAU-Sequenz, um ${DOG_NAME}s Fokus auf dich einzustellen.`,
          `Nach jeder Begegnung: aktiv eine Schnüffelsuche mit SUCH einleiten, um Stresshormone abzubauen.`,
          `Beobachte ${DOG_NAME}s Körpersprache zwischen den Begegnungen — wenn sich Anspannung hält, vergrößere die Pause.`,
          `Wenn ${DOG_NAME} bei der dritten Begegnung müder wirkt, kehre lieber um statt die Route zu Ende zu gehen.`,
          `Belohne besonders gut bewältigte Begegnungen mit einem Jackpot aus 4–5 Leckerlis nacheinander.`,
          `Notiere nach jedem Spaziergang in deinem Trainingstagebuch, wie viele Begegnungen heute gut liefen.`,
        ],
      },
      mistakes: [
        `Die Route so eng planen, dass mehrere Begegnungen direkt hintereinander kommen — ${DOG_NAME} hat keine Zeit zur Regeneration.`,
        `Die Schnüffelpausen weglassen, weil "es ja gut lief" — gerade dann hilft die aktive Stressabfuhr.`,
        `Die Belohnungen reduzieren, weil "${DOG_NAME} weiß ja was sie tun soll" — die Verknüpfung muss weiterhin gepflegt werden.`,
        `Begegnungen zwingen statt sie geschehen zu lassen — wenn möglich, lass die Route die Begegnungen vorgeben.`,
        `Die eigene Anspannung übersehen — wenn du selbst angespannt durch die Begegnungen läufst, spürt ${DOG_NAME} das.`,
      ],
      ex2: {
        title: "Übung 2 Schritt für Schritt",
        sub: "Decke an wechselnden Orten",
        intro: `${DOG_NAME} überträgt das Deckenliegen auf unterschiedliche Außenorte. Du brauchst eine kleine, kompakte Decke, die in den Rucksack passt, und Geduld. Fortschritt zeigt sich daran, dass ${DOG_NAME} an einem neuen Ort innerhalb von 90 Sekunden die Decke betritt und sich ablegt.`,
        steps: [
          `Wähle für die ersten Einheiten Orte mit niedrigem Reizniveau: stille Wiese, eigener Garten, ruhige Parkecke.`,
          `Lege die Decke aus und führe ${DOG_NAME} mit einem Leckerli dorthin — wie beim Indoor-Decken-Training.`,
          `Belohne das Ablegen schneller als drinnen — die Außenreize machen die Übung schwieriger.`,
          `Verlängere die Liegezeit schrittweise: erst 1 Minute, dann 3, später 10.`,
          `Wechsle nach erfolgreichen Einheiten zu Orten mit leicht erhöhtem Reizniveau: Park-Hauptweg, Vorgarten einer Bäckerei.`,
          `Wenn ${DOG_NAME} aufsteht: ruhig zurückführen, ohne Worte, ohne Hektik.`,
          `Beende immer mit Erfolg — auch wenn das bedeutet, dass die Übung an einem Tag nur 2 Minuten dauert.`,
        ],
      },
      check: [
        `${DOG_NAME} bewältigt 5 Begegnungen hintereinander auf einem Standardspaziergang ohne sichtbare Stresseskalation.`,
        `Schnüffelpausen werden von ${DOG_NAME} aktiv genutzt — sie senkt den Kopf und sucht eigenständig.`,
        `Das Deckenliegen funktioniert an mindestens 3 unterschiedlichen Außenorten für jeweils 5 Minuten.`,
        `${DOG_NAME} legt sich an neuen Außenorten innerhalb von 2 Minuten auf die Decke.`,
        `Die eigene Atmung und Anspannung beim Spaziergang ist dir bewusst und du arbeitest aktiv mit ihr.`,
      ],
    },
    {
      nr: 6,
      goals: [
        `${DOG_NAME} bewältigt einen Spaziergang in einer leicht reiznreichen Umgebung (kleinere Stadtstraßen, Vorortzentrum).`,
        `${DOG_NAME} lernt, auf Geräuschreize wie vorbeifahrende Autos, Fahrräder und Skateboards ruhig zu reagieren.`,
        `Neue Orte werden systematisch erkundet — alle 2–3 Tage ein neuer, vorher unbekannter Spazierweg.`,
        `${DOG_NAME} entwickelt einen "Anker-Reflex": auf das Wort RUHIG kommt sie automatisch in deine Nähe.`,
        `Die Reizgewöhnung baut auf Woche 5 auf — keine neuen Schwierigkeitssprünge, sondern Vertiefung.`,
      ],
      day: [
        `Morgens: 20-minütiger Spaziergang an einem vertrauten Ort. ${DOG_NAME} startet mit bekanntem Terrain in den Tag.`,
        `Mittags: 15 Minuten an einem leicht reizreicheren Ort. Plane bewusst Stopps und Beobachtungspausen ein.`,
        `Abends: Erkundung eines neuen Weges in eurer Umgebung — Vorortstraßen, Industriegebietsränder, ruhige Wohnviertel.`,
      ],
      ex1: {
        title: "Übung 1 Schritt für Schritt",
        sub: "Reizgewöhnung Stadt",
        intro: `${DOG_NAME} lernt, Geräusch- und Bewegungsreize aus mittlerer Distanz gelassen zu nehmen. Ihr seid an einer kleineren Stadtstraße oder im Vorortzentrum. Fortschritt zeigt sich daran, dass ${DOG_NAME} bei einem vorbeifahrenden Fahrrad weder zusammenzuckt noch zieht.`,
        steps: [
          `Wähle einen Ort, an dem die Reize vorhersehbar sind: Bürgersteig einer ruhigen Wohnstraße, Sitzbank in einem Vorortzentrum.`,
          `Setze dich zunächst mit ${DOG_NAME} hin — ihr beobachtet die Umgebung gemeinsam, ohne Druck.`,
          `Bei jedem auffälligen Reiz (Auto, Fahrrad, Roller): sage ruhig SCHAU und belohne den Blickkontakt zu dir.`,
          `Achte besonders auf Bewegungsreize — Hunde reagieren stärker auf Bewegung als auf Geräusche.`,
          `Halte die Einheit kurz: 8–12 Minuten reichen vollkommen aus.`,
          `Schließe mit einem entspannten Heimweg über ${DOG_NAME}s bevorzugte Route ab.`,
        ],
      },
      mistakes: [
        `Direkt an stark befahrenen Straßen üben — der Reiz ist zu massiv für diese Woche.`,
        `${DOG_NAME} dazu bringen wollen, Reize anzuschauen — gerade das Wegschauen ist Erfolg.`,
        `Die Einheiten zu lang machen — Stadtreize sind anstrengender als ländliche Spaziergänge.`,
        `Eigene Anspannung bei vorbeifahrenden Autos übersehen — dein Erschrecken überträgt sich.`,
      ],
      ex2: {
        title: "Übung 2 Schritt für Schritt",
        sub: "Anker-Signal RUHIG",
        intro: `${DOG_NAME} lernt ein neues Sicherheitssignal: RUHIG. Es bedeutet "komm zu mir und entspann dich". Du brauchst Leckerlis und eine ruhige Übungsumgebung zum Aufbau. Fortschritt zeigt sich daran, dass ${DOG_NAME} auf RUHIG in deine Nähe kommt und sich neben dir hinsetzt.`,
        steps: [
          `Übe zunächst drinnen: ${DOG_NAME} ist in einem anderen Raum oder einige Meter weg.`,
          `Sage ruhig und tief RUHIG und klopfe leicht auf den Boden neben deinen Füßen.`,
          `Sobald ${DOG_NAME} kommt, belohne sofort und großzügig — Jackpot-Modus.`,
          `Sage zusätzlich PLATZ, sobald sie neben dir steht, und belohne das Hinsetzen.`,
          `Übe das Signal zunächst nur in ruhigen, vertrauten Umgebungen.`,
          `Steigere erst nach 4–5 Tagen erfolgreichen Indoor-Trainings auf Outdoor-Settings.`,
          `Nutze RUHIG später bewusst nur, wenn ${DOG_NAME} entspannen soll — nicht als Notbremse.`,
        ],
      },
      check: [
        `${DOG_NAME} reagiert auf vorbeifahrende Fahrräder mit Blickkontakt zu dir statt mit Bellen oder Ziehen.`,
        `Mindestens 3 neue Spazierorte sind erfolgreich erkundet worden.`,
        `RUHIG funktioniert drinnen zuverlässig: ${DOG_NAME} kommt innerhalb von 3 Sekunden in deine Nähe.`,
        `${DOG_NAME} zeigt im Stadtbereich keine deutlich erhöhten Stresssignale im Vergleich zum Land.`,
      ],
    },
    {
      nr: 7,
      goals: [
        `${DOG_NAME} bewältigt Begegnungen mit unterschiedlichen Menschentypen souverän — Männer, Frauen, Kinder.`,
        `Spezielle Reize wie Mütze, Schirm, Brille, Bart werden eingeübt — viele Hunde reagieren auf solche Details.`,
        `Das RUHIG-Signal aus Woche 6 wird im Außenbereich gefestigt und in Begegnungssituationen integriert.`,
        `${DOG_NAME} entwickelt erste Ansätze von Vertrauen gegenüber wiederkehrenden, freundlichen Personen.`,
        `Der Bogenradius bei Begegnungen wird langsam auf 5–7 Meter reduziert.`,
      ],
      day: [
        `Morgens: Spaziergang mit gezieltem Augenmerk auf Begegnungen mit unterschiedlichen Menschentypen — variiere bewusst die Tageszeit, um andere Personen zu treffen.`,
        `Mittags: 10 Minuten Beobachtungstraining an einem Ort mit Kinderspielplatz in 30 Meter Entfernung.`,
        `Abends: Spaziergang mit Einbau des RUHIG-Signals — übe es vor und nach Begegnungen bewusst.`,
      ],
      ex1: {
        title: "Übung 1 Schritt für Schritt",
        sub: "Personen-Vielfalt",
        intro: `${DOG_NAME} lernt, dass die Strategien aus den ersten Wochen für alle Menschen gelten — egal wie sie aussehen. Du brauchst Spazierorte mit unterschiedlichem Publikum (Berufspendler morgens, Spaziergänger nachmittags, Jogger abends). Fortschritt zeigt sich daran, dass ${DOG_NAME} bei einer ungewohnten Person (z.B. Mann mit Schirm) genauso reagiert wie bei einer vertrauten Person.`,
        steps: [
          `Beobachte in der ersten Woche bewusst, auf welche Personentypen ${DOG_NAME} besonders reagiert.`,
          `Suche gezielt Orte auf, an denen diese spezifischen Personentypen zu erwarten sind.`,
          `Setze die bekannten Strategien (SCHAU, BOGEN) ein, achte aber auf die feinen Unterschiede in ${DOG_NAME}s Reaktion.`,
          `Bei besonders schwierigen Begegnungen: lieber einen größeren Bogen wählen und Erfolge sammeln.`,
          `Belohne ${DOG_NAME} extra großzügig bei Begegnungen mit "neuen" Typen — die Generalisierung muss verstärkt werden.`,
          `Variiere die Übungstage, sodass ${DOG_NAME} unterschiedlichste Personentypen über die zwei Wochen trifft.`,
        ],
      },
      mistakes: [
        `Annehmen, dass alle Menschen für ${DOG_NAME} gleich sind — sie nimmt feine Unterschiede wahr.`,
        `Schwierige Begegnungen vermeiden — gerade diese müssen geübt werden, aber kontrolliert.`,
        `Bei Kindern zu nah ran gehen — Kinderverhalten ist unvorhersehbar, Distanz ist hier besonders wichtig.`,
      ],
      ex2: {
        title: "Übung 2 Schritt für Schritt",
        sub: "RUHIG im Außenbereich",
        intro: `${DOG_NAME} festigt das RUHIG-Signal in realistischen Außensituationen. Du brauchst Leckerlis und einen ruhigen Außenort zum Aufbau. Fortschritt zeigt sich daran, dass ${DOG_NAME} auch nach einer Begegnung auf RUHIG schnell zu dir kommt und sich entspannt.`,
        steps: [
          `Übe RUHIG zunächst in einer entspannten Außensituation ohne Trigger — Garten, ruhige Wiese.`,
          `${DOG_NAME} ist 5–10 Meter entfernt am Schnüffeln oder Erkunden.`,
          `Sage RUHIG in tiefem, ruhigem Ton — und belohne sofort, wenn sie kommt.`,
          `Steigere die Distanz und den Reizpegel über die zwei Wochen langsam.`,
          `Setze RUHIG nach einer erfolgreichen Begegnung ein — die Belohnung verstärkt die Verbindung "Begegnung gemeistert, dann Ruhe-Phase".`,
          `Vermeide es, RUHIG einzusetzen, wenn ${DOG_NAME} bereits stark gestresst ist — dann lieber abbrechen.`,
        ],
      },
      check: [
        `${DOG_NAME} bewältigt Begegnungen mit mindestens 4 unterschiedlichen Personentypen souverän.`,
        `Auf RUHIG kommt ${DOG_NAME} draußen aus 5 Meter Distanz innerhalb von 4 Sekunden zu dir.`,
        `Der Bogenradius bei Begegnungen ist auf 5–7 Meter reduzierbar, ohne dass ${DOG_NAME} Stresssignale zeigt.`,
        `Kinderspielplätze in 30 Meter Entfernung sind in der Beobachtung neutralisiert.`,
      ],
    },
    {
      nr: 8,
      goals: [
        `${DOG_NAME} bewältigt direktes Vorbeigehen an Menschen in 3–5 Meter Distanz, ohne den BOGEN einsetzen zu müssen.`,
        `${DOG_NAME} entwickelt Vertrauen, dass die Bezugsperson die Situation steuert — die Eigeninitiative tritt zurück.`,
        `Die Schwellenwertarbeit beginnt: Wo genau liegt heute ${DOG_NAME}s Komfortgrenze, und wo kommt der Stress?`,
        `Längere Einheiten werden eingeführt: einzelne Begegnungen können bewusst etwas länger gehalten werden.`,
        `Erstes "neutrales Stehenbleiben" während einer Begegnung wird geübt.`,
      ],
      day: [
        `Morgens: bewusster Spaziergang an einem leicht reizreichen Ort, mit Fokus auf Schwellenwertarbeit.`,
        `Mittags: 10 Minuten Bank-Übung an einem mittelfrequentierten Ort, mit kontrollierten Vorbeigehern.`,
        `Abends: ruhiger Spaziergang zur Regeneration — keine neuen Reize, nur das Bekannte.`,
      ],
      ex1: {
        title: "Übung 1 Schritt für Schritt",
        sub: "Direktes Vorbeigehen",
        intro: `${DOG_NAME} lernt, an einem Menschen in 3–5 Meter Distanz vorbeizugehen, ohne dass ein Bogen nötig ist. Du brauchst Spazierwege, an denen Vorbeigehen unvermeidlich ist — schmalere Wege, Brücken, Engstellen. Fortschritt zeigt sich daran, dass ${DOG_NAME} dabei locker an der Leine bleibt und dich nicht aus den Augen verliert.`,
        steps: [
          `Wähle zunächst Wege mit niedriger Frequenz — pro Stunde nur 1–2 Vorbeigeher.`,
          `Beobachte ${DOG_NAME}s Körpersprache schon aus 15 Meter Distanz und bereite sie mit SCHAU vor.`,
          `Halte das Tempo konstant — nicht schneller, nicht langsamer werden.`,
          `Belohne während des Vorbeigehens kontinuierlich mit kleinen Leckerlis (Pippeling-Modus).`,
          `Wenn ${DOG_NAME} stress-frei vorbeigeht: Jackpot 5 Sekunden nach Passage.`,
          `Vermeide direkten Blickkontakt mit dem entgegenkommenden Menschen — das beruhigt ${DOG_NAME} zusätzlich.`,
          `Wenn ${DOG_NAME} doch Anspannung zeigt: zurück zum BOGEN, ohne Frust.`,
        ],
      },
      mistakes: [
        `Auf Erfolg drängen — wenn ${DOG_NAME} heute keinen direkten Vorbeigang schafft, ist morgen ein neuer Tag.`,
        `Den Leckerli-Strom unterbrechen, weil "es ja gerade gut läuft" — Kontinuität ist der Schlüssel.`,
        `Auf engen Wegen üben, an denen wenn-überhaupt kein Ausweichen mehr möglich ist.`,
      ],
      ex2: {
        title: "Übung 2 Schritt für Schritt",
        sub: "Schwellenwert-Diagnose",
        intro: `Du lernst, ${DOG_NAME}s Schwellenwert präzise abzulesen. Du brauchst dein Trainingstagebuch und einen aufmerksamen Blick. Fortschritt zeigt sich daran, dass du innerhalb von 2 Sekunden erkennst, wann ${DOG_NAME} ihren Schwellenwert überschreitet.`,
        steps: [
          `Beobachte: Wo blickt ${DOG_NAME} hin? Wie ist ihre Ohrenhaltung? Stirn glatt oder leicht gerunzelt?`,
          `Achte auf das Atemmuster — schnelles Hecheln bei kühlen Temperaturen ist ein deutliches Stresssignal.`,
          `Beobachte die Rute — gestreckt, hochgehalten, eingeklemmt? Jede Position hat Bedeutung.`,
          `Notiere am Abend in dein Trainingstagebuch: Wo war heute der Schwellenwert? Bei welchem Reiz?`,
          `Erkenne wiederkehrende Muster: Sind bestimmte Tageszeiten schwieriger? Bestimmte Orte?`,
          `Plane den nächsten Tag so, dass ${DOG_NAME} 90% ihrer Zeit unter dem Schwellenwert verbringt.`,
        ],
      },
      check: [
        `${DOG_NAME} kann an einem Menschen in 3–5 Meter Distanz vorbeigehen, ohne den BOGEN zu brauchen.`,
        `Du erkennst ${DOG_NAME}s Schwellenwert zuverlässig anhand von 3 spezifischen Körpersignalen.`,
        `Das Trainingstagebuch wird täglich geführt und zeigt sichtbare Muster.`,
        `${DOG_NAME} bleibt während eines direkten Vorbeigangs an lockerer Leine.`,
      ],
    },
    {
      nr: 9,
      goals: [
        `${DOG_NAME} bewältigt Begegnungen mit anderen Hunden auf 20–30 Meter Distanz ruhig und kontrolliert.`,
        `Hundeparks oder Hundewiesen werden bewusst nur als Beobachtungsorte genutzt — nicht als Spielplätze.`,
        `Andere Hunde werden in das bestehende Reaktionsrepertoire integriert (SCHAU, BOGEN, RUHIG).`,
        `${DOG_NAME} entwickelt ein klares Verständnis: andere Hunde sind keine Spielpartner, sondern Umweltreize.`,
        `Begegnungen mit Hund und Mensch gleichzeitig werden geübt.`,
      ],
      day: [
        `Morgens: Standardspaziergang an einem Ort, an dem regelmäßig andere Hunde unterwegs sind.`,
        `Mittags: 15-minütige Bank-Übung in 25 Meter Entfernung zu einer Hundewiese.`,
        `Abends: Spaziergang in einer Umgebung mit gemischten Reizen — Menschen UND andere Hunde.`,
      ],
      ex1: {
        title: "Übung 1 Schritt für Schritt",
        sub: "Hund in Distanz beobachten",
        intro: `${DOG_NAME} lernt, andere Hunde aus sicherer Distanz neutral wahrzunehmen. Du brauchst einen Ort mit Hundewiese oder ähnlichem, von dem aus du in 25–30 Meter Distanz beobachten kannst. Fortschritt zeigt sich daran, dass ${DOG_NAME} bei einem rennenden Hund nicht in Aufregung gerät.`,
        steps: [
          `Wähle einen Ort mit fester Sitzgelegenheit (Bank, Mauer) in 25–30 Meter Entfernung zur Hundewiese.`,
          `Setze dich entspannt hin — keine Hektik, kein Drängen.`,
          `Bei jedem Hund, der ${DOG_NAME}s Aufmerksamkeit erregt: SCHAU und Belohnung.`,
          `Achte besonders auf rennende oder bellende Hunde — diese Reize sind am schwierigsten.`,
          `Wenn ${DOG_NAME} gut bleibt: 10 Minuten Beobachtungseinheit, dann ruhige Heimfahrt.`,
          `Vermeide unbedingt direkte Hundebegegnungen in dieser Woche — Distanz ist der Schlüssel.`,
        ],
      },
      mistakes: [
        `Auf einen Hundepark gehen — das ist zu intensiv, andere Hunde kommen zu nah.`,
        `Andere Hundebesitzer in Smalltalk verwickeln — die Aufmerksamkeit muss bei ${DOG_NAME} bleiben.`,
        `Den Hunden zuwinken oder mit ihnen kommunizieren — das verwirrt ${DOG_NAME}.`,
        `${DOG_NAME} zwingen wollen, Interesse an anderen Hunden zu zeigen.`,
      ],
      ex2: {
        title: "Übung 2 Schritt für Schritt",
        sub: "Gemischte Reize",
        intro: `${DOG_NAME} lernt, mit gemischten Reizen (Mensch + Hund gleichzeitig) umzugehen. Du brauchst eine Spazierroute, an der beide Reizarten auftreten. Fortschritt zeigt sich daran, dass ${DOG_NAME} ihre bekannten Strategien situationsabhängig einsetzt.`,
        steps: [
          `Wähle Routen, an denen Hund-und-Mensch-Begegnungen vorhersehbar sind (Spaziergänger mit Hund).`,
          `Beachte: jetzt sind zwei Reize zu managen — der Mensch und der Hund.`,
          `Halte den Abstand mindestens auf der Distanz, die du für reine Hundebegegnungen brauchst (20+ Meter).`,
          `Setze BOGEN oder SCHAU je nach Situation ein.`,
          `Belohne besonders großzügig bei erfolgreichen Mixed-Begegnungen.`,
        ],
      },
      check: [
        `${DOG_NAME} bewältigt eine Hund-Beobachtungssitzung von 10 Minuten in 25 Meter Distanz souverän.`,
        `Bei gemischten Begegnungen (Mensch + Hund) zeigt ${DOG_NAME} klare, strategiebasierte Reaktionen.`,
        `Rennende oder bellende Hunde in der Distanz lösen keine Eskalation aus.`,
        `Die Distanz zu Hunden bleibt konsequent über 20 Meter.`,
      ],
    },
    {
      nr: 10,
      goals: [
        `${DOG_NAME} bewältigt einen kurzen Aufenthalt im Café-Außenbereich (15–20 Minuten) ruhig.`,
        `Stadtspaziergänge in moderaten Fußgängerzonen werden in das Repertoire aufgenommen.`,
        `${DOG_NAME} lernt, ihren neuen "Ruhepunkt unter dem Tisch" einzunehmen.`,
        `Die ersten Routinen für gemeinsame Alltagserlebnisse entstehen — kleine wöchentliche Highlights.`,
        `Selbstständigkeit von ${DOG_NAME} wird gefördert: weniger Ansagen, mehr Vertrauen.`,
      ],
      day: [
        `Morgens: vertrauter Spaziergang als ruhiger Tagesstart.`,
        `Mittags oder nachmittags: 15-minütiger Café-Aufenthalt mit Decke unter dem Tisch (2–3 mal pro Woche).`,
        `Abends: ruhige Heim-Routine mit Decke im Wohnzimmer.`,
      ],
      ex1: {
        title: "Übung 1 Schritt für Schritt",
        sub: "Café-Außenbereich",
        intro: `${DOG_NAME} lernt, in einer Café-Situation ruhig zu warten. Du brauchst ein Café mit Außenbereich, deine Reisedecke und Geduld. Fortschritt zeigt sich daran, dass ${DOG_NAME} 15 Minuten ruhig unter dem Tisch liegen bleibt.`,
        steps: [
          `Wähle ein Café mit ruhigem Außenbereich, nicht zentral in einer Fußgängerzone.`,
          `Lege die Decke vor oder unter den Tisch — gut geschützt, nicht im Durchgang.`,
          `Bestelle erst, wenn ${DOG_NAME} sich abgelegt hat — die Übung hat Priorität.`,
          `Belohne ${DOG_NAME} in der ersten Minute mehrfach für ruhiges Liegen.`,
          `Reduziere die Belohnungsfrequenz langsam — alle 30 Sekunden, dann jede Minute.`,
          `Wenn ${DOG_NAME} aufsteht oder unruhig wird: bleibe selbst ruhig sitzen und führe sie zurück.`,
          `Beende den Aufenthalt nach 15 Minuten — auch wenn es gerade super lief.`,
        ],
      },
      mistakes: [
        `Direkt in eine zentrale Fußgängerzone gehen — zu viele Reize für den ersten Versuch.`,
        `Den eigenen Stress übersehen — wenn du selbst hektisch bist (Kaffeebestellung etc.), wirkt sich das aus.`,
        `Andere Gäste oder Kellner mit ${DOG_NAME} interagieren lassen — Ruhe ist das Ziel, nicht Sozialisierung.`,
      ],
      ex2: {
        title: "Übung 2 Schritt für Schritt",
        sub: "Selbstständigkeits-Spaziergang",
        intro: `${DOG_NAME} entwickelt mehr Selbstständigkeit. Du brauchst eine bekannte Spazierroute und die Bereitschaft, weniger zu reden. Fortschritt zeigt sich daran, dass ${DOG_NAME} eigenständig Strategien wählt, ohne dass du sie ansagen musst.`,
        steps: [
          `Wähle eine vertraute Route mit moderaten Reizen.`,
          `Reduziere deine verbalen Signale bewusst — sage nichts, solange ${DOG_NAME} gut reagiert.`,
          `Beobachte, ob ${DOG_NAME} eigenständig SCHAU oder BOGEN wählt, ohne dass du das Signal gibst.`,
          `Belohne eigenständige, gute Entscheidungen mit großzügigem Jackpot.`,
          `Wenn ${DOG_NAME} unsicher wird: einmal helfen, dann wieder zurückhalten.`,
          `Diese Übung zeigt dir, wo ${DOG_NAME} schon selbstständig ist und wo sie noch Stütze braucht.`,
        ],
      },
      check: [
        `${DOG_NAME} bewältigt einen 15-minütigen Café-Aufenthalt ohne starkes Unruheverhalten.`,
        `Eigenständige Strategiewahl bei mindestens 2 Begegnungen pro Spaziergang.`,
        `Die Selbstständigkeit fühlt sich für dich angenehm an — du musst nicht ständig "managen".`,
        `Stadtspaziergänge in moderaten Fußgängerzonen sind in 80% der Fälle ruhig.`,
      ],
    },
    {
      nr: 11,
      goals: [
        `${DOG_NAME} bewältigt ruhigen Besuch zuhause (Familie, Freunde) souverän — sie bleibt entspannt auf ihrer Decke.`,
        `Gäste werden systematisch von ${DOG_NAME} ignoriert — keine Aufdringlichkeit, keine Vermeidung, einfach Neutralität.`,
        `Die Bezugsperson steuert klar, wer wann mit ${DOG_NAME} interagiert (oder eben nicht).`,
        `Übungen zur Türklingel-Routine werden eingeführt.`,
        `${DOG_NAME} entwickelt eine "soziale Pufferzone" im eigenen Zuhause.`,
      ],
      day: [
        `Morgens: ruhiger Spaziergang — Bewegungsanteil ist wichtig vor "sozialen" Tagen.`,
        `Mittags oder nachmittags: Besuchsempfang üben (1–2 mal pro Woche, mit kooperativen Personen).`,
        `Abends: gemeinsame ruhige Wohnzimmerphase, viel Belohnung für Entspannung.`,
      ],
      ex1: {
        title: "Übung 1 Schritt für Schritt",
        sub: "Besuchsempfang",
        intro: `${DOG_NAME} lernt, dass Besuch zuhause keine besondere Bedrohung ist. Du brauchst kooperative Personen, die bereit sind, ${DOG_NAME} zu ignorieren. Fortschritt zeigt sich daran, dass ${DOG_NAME} während eines 30-minütigen Besuchs auf ihrer Decke bleibt.`,
        steps: [
          `Informiere die Gäste vorab klar: "${DOG_NAME} darf bei Eintritt nicht angesprochen oder angeschaut werden."`,
          `Lege ${DOG_NAME}s Decke an einen ruhigen Platz im Wohnzimmer — nicht im Durchgang, nicht im Mittelpunkt.`,
          `Sage ${DOG_NAME} kurz vor dem Klingeln PLATZ und belohne das Liegen.`,
          `Bei Eintritt: Gäste gehen direkt vorbei zu ihren Sitzplätzen — keine Aufmerksamkeit für ${DOG_NAME}.`,
          `Du belohnst ${DOG_NAME} kontinuierlich für ruhiges Liegen während des Besuchs.`,
          `Nach 15 Minuten kann ein Gast langsam und ohne Blickkontakt ein Leckerli auf den Boden in ${DOG_NAME}s Nähe legen.`,
          `Beende den Besuch (zumindest die Übung) nach 30 Minuten — dann darf ${DOG_NAME} aufstehen und sich entspannen.`,
        ],
      },
      mistakes: [
        `Gäste, die "kompetent mit Hunden" sind und meinen, sie wüssten es besser — gerade die sind oft das Problem.`,
        `${DOG_NAME} zu Beginn streicheln oder beschwichtigen lassen — Distanz ist hier essentiell.`,
        `Die Übung zu lange machen — 30 Minuten reichen vollkommen.`,
        `Eigenen Stress beim Besuch übersehen — ${DOG_NAME} spürt deine Anspannung sofort.`,
      ],
      ex2: {
        title: "Übung 2 Schritt für Schritt",
        sub: "Türklingel-Routine",
        intro: `${DOG_NAME} lernt eine feste Routine für das Klingeln. Du brauchst einen kooperativen Helfer, der mehrmals klingelt und wieder weggeht. Fortschritt zeigt sich daran, dass ${DOG_NAME} auf ein Klingeln mit gehen zur Decke reagiert statt mit Bellen.`,
        steps: [
          `Etabliere die Routine: Klingel, dann Decke, dann Belohnung.`,
          `Beginne mit "Trocken-Übungen": du tippst auf das Klingel-Geräusch ohne dass jemand klingelt.`,
          `Sobald die erste Verknüpfung steht, kann ein Helfer einmal kurz klingeln und sofort gehen.`,
          `${DOG_NAME} geht zur Decke (du leitest sie hin, wenn nötig), wird belohnt — und nichts weiter passiert.`,
          `Wiederhole das über mehrere Tage hinweg, sodass das Klingeln seine Schreckwirkung verliert.`,
          `Erst nach 4–5 Tagen kann der Helfer nach dem Klingeln auch eintreten — mit Ignoranz gegenüber ${DOG_NAME}.`,
        ],
      },
      check: [
        `${DOG_NAME} bleibt während eines 30-minütigen Gästebesuchs auf ihrer Decke.`,
        `Auf das Klingeln folgt ein Decke-Reflex statt Bellen.`,
        `Gäste werden von ${DOG_NAME} weder gemieden noch aufgesucht — neutral.`,
        `Die eigene Anspannung beim Empfang ist nicht mehr spürbar gesteigert.`,
      ],
    },
    {
      nr: 12,
      goals: [
        `${DOG_NAME}s gelernte Strategien sind dauerhaft im Alltag verankert — kein bewusstes "Training" mehr nötig.`,
        `Die Bezugsperson kann das eigene Belohnungsverhalten reduzieren ohne dass ${DOG_NAME}s Sicherheit nachlässt.`,
        `Ein persönliches "Wartungs-Ritual" wird entwickelt: feste wöchentliche Übungs-Highlights.`,
        `Rückschritte werden früh erkannt und souverän verarbeitet.`,
        `Ein neues Trainings-Ziel für die Zeit nach den 6 Monaten wird gemeinsam definiert.`,
      ],
      day: [
        `Morgens: Spaziergang mit allen Strategien im Repertoire, aber ohne expliziten Trainings-Fokus.`,
        `Mittags: 1–2 mal pro Woche bewusstes "Wartungs-Training" an einem mittelschwierigen Ort.`,
        `Abends: ruhige Routine, Reflexion des Tages, Eintrag im Tagebuch.`,
      ],
      ex1: {
        title: "Übung 1 Schritt für Schritt",
        sub: "Alltagsintegration",
        intro: `${DOG_NAME}s Strategien werden vom expliziten Training zur Alltagsroutine. Du brauchst nur dein bewusstes Auge und die Bereitschaft, weniger zu trainieren. Fortschritt zeigt sich daran, dass Spaziergänge sich nicht mehr wie Training anfühlen.`,
        steps: [
          `Reduziere die Häufigkeit der Belohnungen bewusst — von "alle 10 Schritte" auf "alle 50 Schritte".`,
          `Belohne weiterhin Spitzenleistungen mit Jackpot — die Verstärkung der besten Momente bleibt.`,
          `Beobachte, ob ${DOG_NAME} ohne explizite Belohnung weiterhin die Strategien zeigt.`,
          `Wenn ja: weiter reduzieren, immer in kleinen Schritten.`,
          `Wenn nein: kurz zurück zur höheren Belohnungsfrequenz, dann erneut versuchen.`,
          `Über die zwei Wochen entwickelt sich ein "Alltagsmodus" — entspannter, weniger trainings-fokussiert.`,
        ],
      },
      mistakes: [
        `Zu schnell von Trainings- in Alltagsmodus wechseln — die Übergangszeit muss langsam sein.`,
        `Belohnungen komplett weglassen — auch im Alltag braucht das System Verstärkung.`,
        `Annehmen, dass jetzt "alles erledigt" ist — Wartung ist Daueraufgabe.`,
      ],
      ex2: {
        title: "Übung 2 Schritt für Schritt",
        sub: "Eigenes Wartungs-Ritual",
        intro: `Du entwickelst dein eigenes wöchentliches Wartungs-Ritual für ${DOG_NAME}. Du brauchst Klarheit über eure Stärken und Schwächen und etwas Planungs-Zeit. Fortschritt zeigt sich daran, dass das Ritual zur festen Gewohnheit wird.`,
        steps: [
          `Reflektiere: An welchen Orten ist ${DOG_NAME} immer noch unsicher? Welche Übungen müssen lebendig bleiben?`,
          `Definiere 2–3 wöchentliche "Wartungs-Spots": Café-Besuch, schwieriger Spazierweg, soziale Situation.`,
          `Plane einen festen Wochentag und eine feste Zeit für jeden dieser Spots.`,
          `Notiere im Tagebuch nach jedem Wartungs-Besuch: Was lief gut, was war schwer?`,
          `Passe das Ritual alle 4–6 Wochen an deine aktuelle Lebensrealität an.`,
          `Erkenne: Ihr seid ein Team, das sich gemeinsam entwickelt — das Ritual ist nur ein Werkzeug.`,
        ],
      },
      stab: {
        title: "Wie es nach den 6 Monaten weitergeht",
        text: [
          `Mit dem Ende der 12. Woche habt ihr drei Monate intensives Training durchgezogen. ${DOG_NAME} hat sich sichtbar verändert — ihr Reaktionsrepertoire ist breit, ihre Sicherheit ist gewachsen, und du als Bezugsperson hast das Vertrauen gewonnen, schwierige Situationen souverän zu managen.`,
          `Was jetzt kommt, ist die Wartungs- und Vertiefungsphase. Die im letzten Schritt entwickelten Rituale bilden das Gerüst eures gemeinsamen Alltags. Trainings-Sessions im engeren Sinne werden seltener — aber jede gemeinsame Situation ist eine Gelegenheit zur Festigung.`,
          `Setze dir alle 3–4 Monate ein neues kleines Ziel. Das kann ein neuer Ort, eine neue Person oder eine neue Routine sein. Bleibt in Bewegung, aber ohne Druck. ${DOG_NAME}s Entwicklung ist nicht abgeschlossen — sie geht weiter, in entspannterer Form.`,
          `Wenn du das Gefühl hast, dass etwas stagniert oder Rückschritte auftauchen, die du nicht erklären kannst: ziehe eine professionelle Hundetrainerin vor Ort hinzu. Ein frischer Blick hilft oft, blinde Flecken zu erkennen.`,
        ],
      },
    },
  ],
  outro: {
    difficultTitle: "Umgang mit schwierigen Situationen im Alltag",
    difficultIntro: `Trotz guter Planung wird es Situationen geben, in denen ${DOG_NAME} über ihre Belastungsgrenze gerät. Entscheidend ist dann, ruhig zu bleiben und ${DOG_NAME} aktiv aus der Situation herauszuführen. Dein eigener Stresslevel überträgt sich direkt auf ${DOG_NAME}, also atme bewusst tief durch und handle besonnen.`,
    difficultBullets: [
      `Wenn ${DOG_NAME} beginnt zu bellen, sage einmalig ruhig STOPP, dann sofort SCHAU und belohne jeden Blickkontakt großzügig.`,
      `Wenn ${DOG_NAME} die Leine straff zieht und nicht ansprechbar ist, drehe dich ruhig um, gehe zügig in die entgegengesetzte Richtung und belohne das Mitkommen.`,
      `Wenn ein Mensch direkt auf euch zukommt und Ausweichen nicht möglich ist, stelle dich zwischen ${DOG_NAME} und die Person und füttere ${DOG_NAME} durchgehend.`,
      `Wenn ${DOG_NAME} nach einer stressigen Begegnung aufgewühlt ist, nutze SUCH und wirf Leckerlis ins Gras, damit das Schnüffeln sie beruhigt.`,
      `Wenn ${DOG_NAME} erstarrt und weder Leckerlis annimmt noch auf Signale reagiert, entferne dich zügig und ruhig aus der Situation, ohne zu reden oder zu zerren.`,
    ],
    setbackTitle: "Rückschritte richtig einordnen und nutzen",
    setbackText: [
      `Rückschritte sind ein normaler und erwartbarer Teil des Trainingsprozesses mit einem ängstlichen Hund. ${DOG_NAME}s Angstverhalten hat sich über einen langen Zeitraum aufgebaut und wird nicht linear verschwinden. Es wird Tage geben, an denen ${DOG_NAME} stärker reagiert als am Vortag, und das bedeutet nicht, dass euer Training gescheitert ist.`,
      `Wenn du einen Rückschritt bemerkst, gehe ohne Frust ein bis zwei Schwierigkeitsstufen zurück. Vergrößere die Distanz zu Menschen wieder, übe in ruhigerer Umgebung und senke die Anforderungen. Arbeite von diesem niedrigeren Level aus wieder langsam nach oben. Rückschritte können durch viele Faktoren ausgelöst werden, zum Beispiel schlechtes Wetter, Lärm, Krankheit oder eine einzelne negative Erfahrung.`,
      `Entscheidend ist deine eigene Haltung gegenüber den Rückschritten. Bleibe geduldig und vertraue auf den Prozess. Jede positive Erfahrung, die ${DOG_NAME} mit dir sammelt, zahlt auf ein Konto ein, das langfristig wächst. Die kleinen Fortschritte summieren sich über Wochen und Monate zu einer echten Veränderung in ${DOG_NAME}s Erleben der Welt.`,
    ],
    nextTitle: "Dein nächster Trainingsschritt",
    nextText: [
      `Du hast in den letzten sechs Monaten die Grundlagen gelegt UND vertieft, um ${DOG_NAME} systematisch mehr Sicherheit und Vertrauen im Alltag zu geben. ${DOG_NAME} hat gelernt, dass ihre Bezugsperson ein verlässlicher Anker ist, dass Menschen nicht grundsätzlich bedrohlich sind und dass es Alternativen zum Bellen und Flüchten gibt. Über 24 Wochen sind diese Erkenntnisse zu einer tief verankerten Reaktionsweise geworden — das ist eine erhebliche Leistung, die du dir und ${DOG_NAME} anerkennen darfst.`,
      `Dieser Plan war ein langer Atem — und das ist seine größte Stärke. ${DOG_NAME}s Ängstlichkeit wird sich weiter verbessern, wenn du die Übungen und Prinzipien konsequent in den Alltag einbaust. Steigere die Schwierigkeit weiterhin in kleinen Schritten und gib ${DOG_NAME} die Zeit, die sie braucht, um jede neue Stufe sicher zu bewältigen.`,
      `Wenn du das Gefühl hast, dass ${DOG_NAME}s Fortschritte stagnieren oder dass bestimmte Situationen trotz der sechs Monate intensiven Trainings nicht besser werden, ziehe eine professionelle Hundetrainerin vor Ort hinzu. Gemeinsam könnt ihr den nächsten Schritt anpassen und gezielt an den Stellen arbeiten, die im Alltag noch Herausforderungen darstellen. Du bist auf einem starken Weg und ${DOG_NAME} hat in dir die beste Voraussetzung für ein entspanntes Leben.`,
    ],
    nextFooter: "Bei Fragen kannst du dich jederzeit per Mail bei unserem Team melden.\nViel Spaß mit deinem PfotenPlan!",
  },
  bonus: {
    title: "Zusatz!",
    subtitle: "Danke von PfotenPlan",
    games: [
      {
        title: "Spiel 1: Futter suchen",
        goal: "Konzentration, Nasenarbeit und innere Ruhe fördern",
        steps: [
          "Hund sitzt oder steht ruhig",
          "Zeige ein kleines Futterstück",
          "Lege es sichtbar ab",
          "Sage ruhig „Such“",
          "Lasse den Hund selbstständig suchen",
          "Bleibe still und beobachte",
          "Lobe leise nach dem Finden",
          "Wiederhole an anderer Stelle",
        ],
        why: "Nasenarbeit macht müde, ruhig und zufrieden.\nSie stärkt Selbstständigkeit und Frustrationstoleranz.",
      },
      {
        title: "Spiel 2: Handtouch spielerisch",
        goal: "Aufmerksamkeit, Orientierung und Nähe spielerisch stärken",
        steps: [
          "Halte deine Hand ruhig seitlich hin",
          "Warte auf Interesse",
          "Hund berührt die Hand mit der Nase",
          "Bestätige ruhig",
          "Belohne direkt",
          "Wechsle langsam die Position",
          "Bleibe freundlich und entspannt",
          "Beende nach wenigen Wiederholungen",
        ],
        why: "Der Hund lernt, sich aktiv an dir zu orientieren.\nDas Spiel ist ideal bei Unsicherheit oder Ablenkung.",
      },
      {
        title: "Spiel 3: Ruhiges Zerrspiel",
        goal: "Impulskontrolle und kontrolliertes Spiel lernen",
        steps: [
          "Nimm ein weiches Spielzeug",
          "Lade ruhig zum Ziehen ein",
          "Spiele langsam und kontrolliert",
          "Stoppe plötzlich die Bewegung",
          "Warte auf Lockerlassen oder Ruhe",
          "Belohne ruhiges Verhalten",
          "Spiele erst dann weiter",
          "Beende das Spiel bewusst",
        ],
        why: "Der Hund lernt, Erregung zu regulieren.\nSpiel und Kontrolle schließen sich nicht aus.",
      },
    ],
  },
  };
}

// ========= Werbe-Seiten-Renderer =========
// Zwei Upsell-Seiten die in alle Plaene (1M/3M/6M) eingestreut werden:
// einer in der Mitte, einer am Ende. QR-Code wird zur Buildzeit generiert.

const AD_PAGES = {
  ernaehrung: {
    badge: "DEIN HUND VERDIENT MEHR",
    headline: "Richtiges Futter = glänzendes Fell,\nstarke Knochen, mehr Energie.",
    body: [
      "Dein personalisierter Ernährungsplan — abgestimmt auf Rasse, Alter,",
      "Gewicht und Aktivitätslevel. Konkrete Tagespläne, optimale",
      "Fütterungszeiten, sichere Snack-Listen und eine klare Übersicht:",
      "Was dein Hund niemals fressen sollte.",
      "",
      "Ausdrucken, an den Kühlschrank hängen, endlich Klarheit im Napf.",
    ],
    price: "Nur 24,99 €",
    cta: "Jetzt scannen",
    qrUrl: "https://www.pfoten-plan.de/ernaehrungsplan",
    imagePath: "public/Hund1.png",
  },
  erstehilfe: {
    badge: "FÜR DEN NOTFALL GERÜSTET",
    headline: "Samstagabend. Schokolade im Maul.\nWas jetzt?",
    body: [
      "Von Vergiftung über Hitzschlag bis Insektenstich — die 10 häufigsten",
      "Notfälle mit klaren Schritt-für-Schritt Anleitungen. Plus:",
      "Giftnotruf-Nummern, Notfall-Apotheke-Checkliste und",
      "Wiederbelebungs-Technik.",
      "",
      "Ausdrucken, griffbereit haben, damit du im Ernstfall nicht googelst,",
      "sondern handelst.",
    ],
    price: "Nur 14,99 €",
    cta: "Jetzt scannen",
    qrUrl: "https://www.pfoten-plan.de/erste-hilfe-set",
    imagePath: "public/Hund2.png",
  },
};

async function buildQrPng(url, sizePx = 480) {
  return await QRCode.toBuffer(url, {
    type: "png",
    width: sizePx,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1A1A1A", light: "#FFFFFF" },
  });
}

function drawAdPage(p, type, fonts, qrImage, dogImage, layout) {
  const { fontReg, fontBold } = fonts;
  const { A4_W, A4_H, BANNER_H, MARGIN, CONTENT_W, DARK_BROWN, GOLD, GOLD_DARK, TEXT_DARK, TEXT_MEDIUM, BG_BAR, WHITE } = layout;
  const ad = AD_PAGES[type];

  // Badge oben (dark-Pille mit hellem Text — dunkel weil das Beige eh hell ist)
  const badgeY = A4_H - BANNER_H - 70;
  const badgeText = ad.badge;
  const badgeSize = 11;
  const badgePadX = 14;
  const badgePadY = 7;
  const badgeW = fontBold.widthOfTextAtSize(badgeText, badgeSize) + badgePadX * 2;
  p.drawRectangle({
    x: MARGIN,
    y: badgeY - badgePadY,
    width: badgeW,
    height: badgeSize + badgePadY * 2,
    color: DARK_BROWN,
  });
  p.drawText(badgeText, {
    x: MARGIN + badgePadX,
    y: badgeY,
    size: badgeSize,
    font: fontBold,
    color: WHITE,
  });

  // Headline — 2 Zeilen, gross, fett
  let y = badgeY - 50;
  const headlineSize = 32;
  const headlineLines = ad.headline.split("\n");
  for (const line of headlineLines) {
    p.drawText(line, {
      x: MARGIN,
      y,
      size: headlineSize,
      font: fontBold,
      color: DARK_BROWN,
    });
    y -= headlineSize + 6;
  }

  // Body — links, mehrzeilig (auf 55% Breite damit Hund-Foto rechts Platz hat)
  y -= 18;
  const bodySize = 13;
  const bodyMaxW = (A4_W - 2 * MARGIN) * 0.55;
  for (const line of ad.body) {
    p.drawText(line, {
      x: MARGIN,
      y,
      size: bodySize,
      font: fontReg,
      color: TEXT_DARK,
      maxWidth: bodyMaxW,
    });
    y -= bodySize + 6;
  }

  // Hund-Foto unten links — quadratisch mit gold-Rahmen
  if (dogImage) {
    const photoSize = 200;
    const photoX = MARGIN;
    const photoY = MARGIN + 15;
    // Schatten / Hintergrund
    p.drawRectangle({
      x: photoX - 4,
      y: photoY - 4,
      width: photoSize + 8,
      height: photoSize + 8,
      color: GOLD,
    });
    p.drawImage(dogImage, {
      x: photoX,
      y: photoY,
      width: photoSize,
      height: photoSize,
    });
  }

  // QR-Code rechts unten, mit Preis-Tag links daneben
  const qrSize = 180;
  const qrX = A4_W - MARGIN - qrSize;
  const qrY = MARGIN + 40;
  p.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  // "Jetzt scannen" unter QR
  const ctaSize = 14;
  const ctaW = fontBold.widthOfTextAtSize(ad.cta, ctaSize);
  p.drawText(ad.cta, {
    x: qrX + (qrSize - ctaW) / 2,
    y: qrY - 22,
    size: ctaSize,
    font: fontBold,
    color: DARK_BROWN,
  });

  // Preis-Tag — gold + Pfeil
  const priceSize = 24;
  const priceW = fontBold.widthOfTextAtSize(ad.price, priceSize);
  const priceX = qrX - priceW - 50;
  const priceY = qrY + qrSize / 2 + 8;
  p.drawText(ad.price, {
    x: priceX,
    y: priceY,
    size: priceSize,
    font: fontBold,
    color: DARK_BROWN,
  });
  // Geschwungener Pfeil von Preis Richtung QR (einfacher Bezier)
  const arrowSx = priceX + priceW + 8;
  const arrowSy = priceY + 4;
  const arrowEx = qrX - 6;
  const arrowEy = qrY + qrSize / 2 + 18;
  p.drawSvgPath(
    `M ${arrowSx} ${A4_H - arrowSy} C ${arrowSx + 25} ${A4_H - arrowSy - 18} ${arrowEx - 25} ${A4_H - arrowEy + 18} ${arrowEx} ${A4_H - arrowEy} M ${arrowEx} ${A4_H - arrowEy} L ${arrowEx - 8} ${A4_H - arrowEy + 4} M ${arrowEx} ${A4_H - arrowEy} L ${arrowEx - 8} ${A4_H - arrowEy - 4}`,
    {
      borderColor: DARK_BROWN,
      borderWidth: 2.5,
    }
  );
}

// ========= PDF-Aufbau =========
export async function buildPdf(params = {}) {
  const DOG_NAME     = (params.dogName     ?? process.env.DOG_NAME     ?? DEFAULT_DOG_NAME).trim();
  const DOG_BREED    = (params.dogBreed    ?? process.env.DOG_BREED    ?? DEFAULT_DOG_BREED).trim();
  const DOG_AGE      = (params.dogAge      ?? process.env.DOG_AGE      ?? DEFAULT_DOG_AGE).trim();
  const MAIN_PROBLEM = (params.mainProblem ?? process.env.MAIN_PROBLEM ?? DEFAULT_MAIN_PROBLEM).trim();
  const PLAN = buildPlan(DOG_NAME, MAIN_PROBLEM);
  if (params.verbose !== false) {
    console.log(`Generiere 3-Monatsplan für ${DOG_NAME} (${DOG_BREED}, ${DOG_AGE}, Problem: ${MAIN_PROBLEM})…`);
  }

  const doc = await PDFDocument.create();
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  // Echtes Pfoten-Logo aus public/ einbetten
  const logoBytes = readFileSync(PUBLIC("logo.png"));
  const logoImage = await doc.embedPng(logoBytes);

  // QR-Codes fuer Werbeseiten zur Laufzeit erzeugen
  const qrErnaehrungPng = await buildQrPng(AD_PAGES.ernaehrung.qrUrl);
  const qrErsteHilfePng = await buildQrPng(AD_PAGES.erstehilfe.qrUrl);
  const qrErnaehrungImg = await doc.embedPng(qrErnaehrungPng);
  const qrErsteHilfeImg = await doc.embedPng(qrErsteHilfePng);

  // Hund-Fotos fuer Werbeseiten + Cover
  const dogErnaehrungImg = await doc.embedPng(
    readFileSync(pathJoin(__dirname, AD_PAGES.ernaehrung.imagePath))
  );
  const dogErsteHilfeImg = await doc.embedPng(
    readFileSync(pathJoin(__dirname, AD_PAGES.erstehilfe.imagePath))
  );
  const dogCoverImg = await doc.embedPng(readFileSync(PUBLIC("TrainerPfoten-thumb.png")));
  const dogAccentImg = await doc.embedPng(readFileSync(PUBLIC("Hund4.png")));

  const MARGIN = 70;
  const CONTENT_X = MARGIN;
  const CONTENT_W = A4_W - 2 * MARGIN;
  const CONTENT_TOP = A4_H - BANNER_H - 30; // unter Banner mit Abstand

  let pageNr = 0;
  function newPage(opts = { number: true }) {
    pageNr += 1;
    const p = doc.addPage([A4_W, A4_H]);
    drawPageBackground(p);
    drawHeaderBanner(p, fontBold, logoImage);
    drawCornerSwooshes(p);
    if (opts.number !== false) drawPageNumber(p, pageNr, fontReg);
    return p;
  }

  // ===== SEITE 1 — COVER (Querformat) =====
  {
    const p = newPage();
    // Layout-Regionen
    const leftW = A4_W * 0.55;        // linke Hälfte = Titel-Block
    const rightX = leftW;
    const rightW = A4_W - leftW;

    // Titel "1-Monatsplan für" — groß, linksbündig, etwa Mitte-vertikal
    let y = A4_H - BANNER_H - 90;
    const titleSize = 46;
    p.drawText("3-Monatsplan für", {
      x: MARGIN,
      y,
      size: titleSize,
      font: fontBold,
      color: DARK_BROWN,
    });
    // Goldener Unterstrich
    p.drawRectangle({
      x: MARGIN,
      y: y - 12,
      width: fontBold.widthOfTextAtSize("3-Monatsplan für", titleSize) * 0.55,
      height: 3,
      color: GOLD,
    });
    // Hundenamen
    y -= 70;
    p.drawText(DOG_NAME, {
      x: MARGIN,
      y,
      size: 36,
      font: fontReg,
      color: DARK_BROWN,
    });
    // Unter Hundename: kurzer Subtitle „12 Wochen · 3 Monate"
    y -= 36;
    p.drawText("12 Wochen · 3 Monate", {
      x: MARGIN,
      y,
      size: 15,
      font: fontReg,
      color: TEXT_MEDIUM,
    });

    // Pfoten-Deko links unten — leicht versetzt
    const decoBaseY = 90;
    drawPaw(p, MARGIN + 30,   decoBaseY + 30, 1.6, GOLD_SOFT);
    drawPaw(p, MARGIN + 95,   decoBaseY,      1.4, GOLD_SOFT);
    drawPaw(p, MARGIN + 165,  decoBaseY + 30, 1.6, GOLD_SOFT);
    drawPaw(p, MARGIN + 230,  decoBaseY,      1.4, GOLD_SOFT);

    // Tag-Pille (Hauptproblem) — unter Pfoten-Deko
    if (MAIN_PROBLEM) {
      const tagSize = 12;
      const tagPadX = 16;
      const tagH = 28;
      const tagW = fontBold.widthOfTextAtSize(MAIN_PROBLEM, tagSize) + tagPadX * 2;
      const tagY = 40;
      drawRoundedRect(p, MARGIN, tagY, tagW, tagH, 14, WHITE);
      p.drawRectangle({ x: MARGIN, y: tagY, width: tagW, height: 2, color: GOLD });
      p.drawText(MAIN_PROBLEM, {
        x: MARGIN + tagPadX,
        y: tagY + 8,
        size: tagSize,
        font: fontBold,
        color: DARK_BROWN,
      });
    }

    // Rechte Seite: Foto mit Goldrahmen
    const boxW = 300;
    const boxH = 300;
    const boxX = rightX + (rightW - boxW) / 2;
    const boxY = (A4_H - BANNER_H - boxH) / 2 + 30;
    // Gold-Rahmen
    p.drawRectangle({
      x: boxX - 6, y: boxY - 6,
      width: boxW + 12, height: boxH + 12,
      color: GOLD,
    });
    // Hund-Foto
    p.drawImage(dogCoverImg, {
      x: boxX, y: boxY,
      width: boxW, height: boxH,
    });
    // Caption-Streifen unter Bild
    const captionY = boxY - 32;
    const captionLine = `Dein PfotenPlan-Trainerteam`;
    const captionSize = 13;
    const capW = fontReg.widthOfTextAtSize(captionLine, captionSize);
    p.drawText(captionLine, {
      x: boxX + (boxW - capW) / 2,
      y: captionY,
      size: captionSize,
      font: fontReg,
      color: TEXT_MEDIUM,
    });
  }

  // ===== SEITE 2 — Willkommen =====
  {
    const p = newPage();
    let y = drawSectionTitle(p, PLAN.intro.welcomeTitle, MARGIN, A4_H - BANNER_H - 50, fontBold, 30);
    y -= 6;
    for (const para of PLAN.intro.welcomeText) {
      y = drawParagraph(p, para, MARGIN, y, CONTENT_W, fontReg, 11.5, TEXT_DARK, 16);
      y -= 8;
    }
  }

  // ===== SEITE 3 — Arbeitsweise =====
  {
    const p = newPage();
    let y = drawSectionTitle(p, PLAN.intro.workTitle, MARGIN, A4_H - BANNER_H - 50, fontBold, 30);
    y -= 6;
    for (const para of PLAN.intro.workText) {
      y = drawParagraph(p, para, MARGIN, y, CONTENT_W, fontReg, 11.5, TEXT_DARK, 16);
      y -= 8;
    }
  }

  // ===== SEITE 4 — 3 Grundregeln =====
  {
    const p = newPage();
    let y = drawSectionTitle(p, PLAN.intro.rulesTitle, MARGIN, A4_H - BANNER_H - 50, fontBold, 30);
    y -= 6;
    for (const para of PLAN.intro.rulesText) {
      y = drawParagraph(p, para, MARGIN, y, CONTENT_W, fontReg, 11.5, TEXT_DARK, 16);
      y -= 8;
    }
  }

  // ===== SEITE 5 — Dein Hund im Überblick =====
  {
    const p = newPage();
    let y = drawSectionTitle(p, PLAN.profile.overviewTitle, MARGIN, A4_H - BANNER_H - 50, fontBold, 30);
    y -= 6;
    for (const para of PLAN.profile.overviewText) {
      y = drawParagraph(p, para, MARGIN, y, CONTENT_W, fontReg, 11.5, TEXT_DARK, 16);
      y -= 8;
    }
  }

  // ===== SEITE 6 — Warum dieses Problem =====
  {
    const p = newPage();
    let y = drawSectionTitle(p, PLAN.profile.causeTitle, MARGIN, A4_H - BANNER_H - 50, fontBold, 30);
    y -= 6;
    for (const para of PLAN.profile.causeText) {
      y = drawParagraph(p, para, MARGIN, y, CONTENT_W, fontReg, 11.5, TEXT_DARK, 16);
      y -= 8;
    }
  }

  // ===== SEITE 7 — Trainingsziel =====
  {
    const p = newPage();
    let y = drawSectionTitle(p, PLAN.profile.goalTitle, MARGIN, A4_H - BANNER_H - 50, fontBold, 30);
    y -= 6;
    for (const para of PLAN.profile.goalText) {
      y = drawParagraph(p, para, MARGIN, y, CONTENT_W, fontReg, 11.5, TEXT_DARK, 16);
      y -= 8;
    }
  }

  // Layout-Parameter-Bundle fuer Ad-Pages
  const adLayout = {
    A4_W, A4_H, BANNER_H, MARGIN, CONTENT_W,
    DARK_BROWN, GOLD, GOLD_DARK, TEXT_DARK, TEXT_MEDIUM, BG_BAR, WHITE,
  };
  const adFonts = { fontReg, fontBold };

  // ===== Wochen 1–4 =====
  // ===== 12 Wochen — 3 Seiten pro Woche (12 × 3 = 36 Wochen-Seiten) =====
  // Seite 1: Wochen-Ziele + Tagesplan kompakt kombiniert
  // Seite 2: Übung 1 Schritt für Schritt
  // Seite 3: Übung 2 + Wochen-Check kombiniert
  //          (bei Woche 4 / 12 ohne Check: Übung 2 + Stabilisierung)
  for (let wIdx = 0; wIdx < PLAN.weeks.length; wIdx++) {
    const week = PLAN.weeks[wIdx];

    // === Seite 1 — Ziele + Tagesplan kombiniert ===
    {
      const p = newPage();
      const labelY = A4_H - BANNER_H - 50;
      drawWeekLabel(p, week.nr, MARGIN, labelY - 8, fontBold, fontReg);
      let y = labelY - 60;

      // Ziele-Block
      p.drawText("Wochenziele", { x: MARGIN, y, size: 14, font: fontBold, color: DARK_BROWN });
      y -= 22;
      for (const g of week.goals) {
        y = drawArrowBullet(p, g, MARGIN, y, CONTENT_W, fontReg, fontBold, 10.5, TEXT_DARK, 14);
      }

      y -= 8;
      // Tagesplan-Block
      p.drawText("Tagesplan", { x: MARGIN, y, size: 14, font: fontBold, color: DARK_BROWN });
      y -= 22;
      for (const para of week.day) {
        y = drawParagraph(p, para, MARGIN, y, CONTENT_W, fontReg, 10.5, TEXT_DARK, 14);
        y -= 6;
      }
    }

    // === Seite 2 — Übung 1 ===
    {
      const p = newPage();
      drawWeekLabel(p, week.nr, MARGIN, A4_H - BANNER_H - 55, fontBold, fontReg);
      let y = A4_H - BANNER_H - 95;
      y = drawSectionPill(p, "ÜBUNG 1", MARGIN, y, fontBold, PILL_AC_GREEN, PILL_BG_GREEN, 8);
      y -= 18;
      p.drawText(week.ex1.title, { x: MARGIN, y, size: 18, font: fontBold, color: DARK_BROWN });
      y -= 22;
      p.drawText(week.ex1.sub, { x: MARGIN, y, size: 13, font: fontReg, color: TEXT_MEDIUM });
      y -= 22;
      y = drawParagraph(p, week.ex1.intro, MARGIN, y, CONTENT_W, fontReg, 11.5, TEXT_DARK, 16);
      y -= 10;
      for (let i = 0; i < week.ex1.steps.length; i++) {
        y = drawNumberedStep(p, i + 1, week.ex1.steps[i], MARGIN, y, CONTENT_W, fontReg, fontBold, 11.5, TEXT_DARK, 16);
        y -= 3;
      }
    }

    // === Seite 3 — Übung 2 + Check (bzw. Stabilisierung) ===
    {
      const p = newPage();
      drawWeekLabel(p, week.nr, MARGIN, A4_H - BANNER_H - 55, fontBold, fontReg);
      let y = A4_H - BANNER_H - 95;
      y = drawSectionPill(p, "ÜBUNG 2", MARGIN, y, fontBold, PILL_AC_GREEN, PILL_BG_GREEN, 8);
      y -= 16;
      p.drawText(week.ex2.title, { x: MARGIN, y, size: 17, font: fontBold, color: DARK_BROWN });
      y -= 20;
      p.drawText(week.ex2.sub, { x: MARGIN, y, size: 12, font: fontReg, color: TEXT_MEDIUM });
      y -= 18;
      y = drawParagraph(p, week.ex2.intro, MARGIN, y, CONTENT_W, fontReg, 10.5, TEXT_DARK, 14);
      y -= 8;
      // Steps mit kompakter Darstellung — 8.5/12 lineGap fuer mehr Platz
      for (let i = 0; i < week.ex2.steps.length; i++) {
        y = drawNumberedStep(p, i + 1, week.ex2.steps[i], MARGIN, y, CONTENT_W, fontReg, fontBold, 10.5, TEXT_DARK, 14);
        y -= 2;
      }

      // Sub-Block: Wochen-Check oder Stabilisierung
      y -= 14;
      if (week.check && week.check.length) {
        // kleiner Wochen-Check als Bullets
        p.drawText("Wochen-Check", { x: MARGIN, y, size: 13, font: fontBold, color: GOLD_DARK });
        y -= 18;
        for (const c of week.check) {
          y = drawCheckBullet(p, c, MARGIN, y, CONTENT_W, fontReg, 10.5, TEXT_DARK, 14);
          y -= 2;
        }
      } else if (week.stab) {
        // Stabilisierungs-Block (Woche 4 / 12) — knapper
        p.drawText(week.stab.title, { x: MARGIN, y, size: 13, font: fontBold, color: GOLD_DARK });
        y -= 18;
        // nur ersten 2 Absaetze auf der Seite (Platz)
        for (let i = 0; i < Math.min(2, week.stab.text.length); i++) {
          y = drawParagraph(p, week.stab.text[i], MARGIN, y, CONTENT_W, fontReg, 10.5, TEXT_DARK, 14);
          y -= 6;
        }
      }
    }
  }

  // ===== Outro: Schwierige Situationen =====
  {
    const p = newPage();
    let y = drawSectionTitle(p, PLAN.outro.difficultTitle, MARGIN, A4_H - BANNER_H - 50, fontBold, 28);
    y -= 6;
    y = drawParagraph(p, PLAN.outro.difficultIntro, MARGIN, y, CONTENT_W, fontReg, 11.5, TEXT_DARK, 16);
    y -= 14;
    for (const m of PLAN.outro.difficultBullets) {
      y = drawArrowBullet(p, m, MARGIN, y, CONTENT_W, fontReg, fontBold, 11, TEXT_DARK, 15);
      y -= 2;
    }
  }

  // ===== Outro: Rückschritte =====
  {
    const p = newPage();
    let y = drawSectionTitle(p, PLAN.outro.setbackTitle, MARGIN, A4_H - BANNER_H - 50, fontBold, 30);
    y -= 6;
    for (const para of PLAN.outro.setbackText) {
      y = drawParagraph(p, para, MARGIN, y, CONTENT_W, fontReg, 11.5, TEXT_DARK, 16);
      y -= 8;
    }
  }

  // ===== Outro: Nächster Schritt =====
  {
    const p = newPage();
    let y = drawSectionTitle(p, PLAN.outro.nextTitle, MARGIN, A4_H - BANNER_H - 50, fontBold, 30);
    y -= 6;
    for (const para of PLAN.outro.nextText) {
      y = drawParagraph(p, para, MARGIN, y, CONTENT_W, fontReg, 11.5, TEXT_DARK, 16);
      y -= 8;
    }
    // Footer-Block unten zentriert
    const footerLines = PLAN.outro.nextFooter.split("\n");
    let fy = 60;
    for (let i = footerLines.length - 1; i >= 0; i--) {
      const line = footerLines[i];
      const w = fontBold.widthOfTextAtSize(line, 11);
      p.drawText(line, { x: (A4_W - w) / 2, y: fy, size: 11, font: fontBold, color: DARK_BROWN });
      fy += 16;
    }
  }

  // ===== Bonus-Spiele =====
  {
    const p = newPage();
    // Titel "Zusatz!"
    p.drawText(PLAN.bonus.title, { x: MARGIN, y: A4_H - BANNER_H - 50, size: 26, font: fontBold, color: DARK_BROWN });
    p.drawText(PLAN.bonus.subtitle, { x: MARGIN, y: A4_H - 60 - 80, size: 12, font: fontReg, color: TEXT_MEDIUM });
    // Stern-Andeutung neben Titel
    p.drawCircle({ x: MARGIN + 95, y: A4_H - 60 - 50, size: 6, color: GOLD });

    // Drei Spalten
    const col_W = (CONTENT_W - 24) / 3; // 12px Gap zwischen Spalten
    const colY0 = A4_H - 60 - 130;
    const cols = PLAN.bonus.games;

    for (let i = 0; i < cols.length; i++) {
      const game = cols[i];
      const cx = MARGIN + i * (col_W + 12);
      let y = colY0;
      // Titel — wrap auf max. zwei Zeilen, damit lange Spielnamen nicht in
      // die Nachbarspalte rutschen
      const titleLines = wrapText(game.title, fontBold, 11.5, col_W);
      for (const tl of titleLines) {
        p.drawText(tl, { x: cx, y, size: 11.5, font: fontBold, color: DARK_BROWN });
        y -= 15;
      }
      y -= 4;
      // Ziel
      p.drawText("Ziel:", { x: cx, y, size: 10, font: fontBold, color: TEXT_DARK });
      y -= 14;
      const goalLines = wrapText(game.goal, fontReg, 9.5, col_W);
      for (const l of goalLines) {
        p.drawText(l, { x: cx, y, size: 9.5, font: fontReg, color: TEXT_DARK });
        y -= 13;
      }
      y -= 8;
      // So funktioniert das Spiel
      p.drawText("So funktioniert das Spiel:", { x: cx, y, size: 10, font: fontBold, color: TEXT_DARK });
      y -= 14;
      for (const s of game.steps) {
        const arrow = "->";
        const arrowW = fontBold.widthOfTextAtSize(arrow, 9);
        p.drawText(arrow, { x: cx, y, size: 9, font: fontBold, color: TEXT_DARK });
        const lines = wrapText(s, fontReg, 9, col_W - arrowW - 4);
        for (let li = 0; li < lines.length; li++) {
          p.drawText(lines[li], { x: cx + arrowW + 4, y, size: 9, font: fontReg, color: TEXT_DARK });
          y -= 12;
        }
      }
      y -= 8;
      // Warum es hilft
      p.drawText("Warum es hilft:", { x: cx, y, size: 10, font: fontBold, color: TEXT_DARK });
      y -= 14;
      const whyLines = wrapText(game.why, fontReg, 9.5, col_W);
      for (const l of whyLines) {
        p.drawText(l, { x: cx, y, size: 9.5, font: fontReg, color: TEXT_DARK });
        y -= 13;
      }
    }
  }

  // ========= Speichern =========
  const bytes = await doc.save();
  if (params.verbose !== false) {
    console.log(`  Seiten: ${pageNr}`);
  }
  return bytes;
}

// ========= CLI-Wrapper (nur bei direkter Ausführung) =========
const __isMain = import.meta.url === `file://${process.argv[1]}`;
if (__isMain) {
  buildPdf()
    .then((bytes) => {
      const outPath = PUBLIC("monatsplan-3monat-TEST.pdf");
      writeFileSync(outPath, bytes);
      console.log(`✓ PDF geschrieben: ${outPath}`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
