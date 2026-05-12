// Generiert einen personalisierten 1-Monats-Trainingsplan als A4-PDF
// (PfotenPlan-Style — orientiert am bestehenden Yuna-Beispiel-Plan).
//
// Verwendung (lokal zum Preview):
//   DOG_NAME="Yuna" DOG_BREED="Mischling" DOG_AGE="2 Jahre" \
//   MAIN_PROBLEM="Ängstlichkeit gegenüber Menschen" \
//   node generate-monatsplan-pdf.mjs
//
// Output: public/monatsplan-1monat-TEST.pdf
//
// Inhalte sind aktuell statisch (Yuna-Beispiel) — die Content-Pipeline
// (KI / Templates aus Quiz-Antworten) kommt in einem späteren Schritt.
// Make/Supabase werden NICHT angefasst.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFileSync, readFileSync } from "fs";
import QRCode from "qrcode";

// A4 Querformat (Landscape) — Originalvorlage ist quer; bessere Lesbarkeit
// für die Zielgruppe (40–50 Jahre)
const A4_W = 841.89;
const A4_H = 595.28;

// Brand-Farben (PfotenPlan-PDF Look)
const BANNER_TAN  = rgb(196 / 255, 165 / 255, 118 / 255); // #C4A576 — Header-Banner
const GOLD        = rgb(196 / 255, 165 / 255, 118 / 255); // #C4A576 — Akzente
const GOLD_DARK   = rgb(139 / 255, 115 / 255, 85 / 255);  // #8B7355 — dunkleres Gold
const GOLD_SOFT   = rgb(216 / 255, 188 / 255, 145 / 255); // helleres Gold für Pfoten-Deko
const DARK_BROWN  = rgb(36 / 255, 23 / 255, 20 / 255);    // #241714
const TEXT_DARK   = rgb(26 / 255, 26 / 255, 26 / 255);
const TEXT_MEDIUM = rgb(80 / 255, 80 / 255, 80 / 255);
const TEXT_LIGHT  = rgb(150 / 255, 150 / 255, 150 / 255);
const WHITE       = rgb(1, 1, 1);
const BG_CREAM    = rgb(250 / 255, 245 / 255, 235 / 255); // weicher Sand-Hintergrund
const BG_BAR      = rgb(240 / 255, 230 / 255, 210 / 255); // Wochen-Label-Bar

// ========= Personalisierung =========
const DOG_NAME     = (process.env.DOG_NAME     || "Yuna").trim();
const DOG_BREED    = (process.env.DOG_BREED    || "Mischling").trim();
const DOG_AGE      = (process.env.DOG_AGE      || "2 Jahre").trim();
const MAIN_PROBLEM = (process.env.MAIN_PROBLEM || "Ängstlichkeit gegenüber Menschen").trim();

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

// ========= Content (Yuna-Standardplan, 1:1 aus Original) =========
const PLAN = {
  intro: {
    welcomeTitle: "Willkommen bei eurem Trainingsmonat",
    welcomeText: [
      `Dieser Trainingsplan wurde speziell für ${DOG_NAME} und ihre Bedürfnisse entwickelt. Er begleitet dich über vier Wochen Schritt für Schritt dabei, ${DOG_NAME} mehr Sicherheit im Alltag zu geben und eine vertrauensvolle Zusammenarbeit aufzubauen. Jede Übung ist so gestaltet, dass du sie ohne Vorkenntnisse im Hundetraining umsetzen kannst. Du brauchst lediglich weiche Leckerlis, eine Leine, eine Decke und vor allem Geduld.`,
      `${DOG_NAME}s ${MAIN_PROBLEM} und ihre Unsicherheit in der Umwelt sind der Ausgangspunkt dieses Plans. Das Ziel ist nicht, ${DOG_NAME} zu einem kontaktfreudigen Hund zu machen, sondern ihr Werkzeuge an die Hand zu geben, mit denen sie beängstigende Situationen gelassen bewältigen kann. Du als Bezugsperson wirst dabei zu ihrem sicheren Anker, an dem sie sich orientiert.`,
      `Der Plan baut aufeinander auf, weshalb die Reihenfolge der Wochen wichtig ist. Jede Woche hat klare Ziele und einen Wochencheck, der dir zeigt, ob ${DOG_NAME} bereit für die nächste Stufe ist. Wenn ein Schritt noch nicht sitzt, ist es völlig in Ordnung, eine Woche zu wiederholen. Fortschritt entsteht durch Wiederholung und positive Erfahrungen, nicht durch Tempo.`,
      `Lies den gesamten Plan einmal durch, bevor du mit dem Training beginnst. So verstehst du, wohin die Reise geht, und kannst die einzelnen Übungen besser einordnen. Markiere dir die Stellen, die dir besonders wichtig erscheinen, und bereite dein Trainingsmaterial vor, bevor du in Woche eins startest.`,
    ],
    workTitle: "So arbeitest du mit diesem Plan richtig",
    workText: [
      `Der Plan ist in vier Wochen gegliedert, die jeweils ein übergeordnetes Entwicklungsziel verfolgen. Woche eins legt das Fundament mit Grundübungen in reizarmer Umgebung. Woche zwei verlagert das Training nach draußen und führt erste Begegnungsübungen ein. Die Wochen drei und vier steigern die Anforderungen schrittweise und führen alle Bausteine im Alltag zusammen.`,
      `Jede Woche enthält zwei Kernübungen mit detaillierten Schritt-für-Schritt-Anleitungen. Zusätzlich gibt es Begleitübungen, die das Training ergänzen, und Alltagstipps, die dir helfen, das Gelernte in den normalen Tagesablauf einzubauen. Die Kernübungen sind das Herzstück des Trainings und sollten täglich geübt werden.`,
      `Am Ende jeder Woche findest du einen Wochencheck mit konkreten Kriterien. Diese Kriterien zeigen dir, ob ${DOG_NAME} die Inhalte der Woche verinnerlicht hat. Gehe erst zur nächsten Woche über, wenn die Mehrheit der Checkpunkte erfüllt ist. Ehrlichkeit bei der Einschätzung ist wichtiger als schnelles Vorankommen.`,
      `Die Zeitangaben bei den Übungen sind Richtwerte. Kurze, konzentrierte Einheiten sind effektiver als lange, ermüdende Trainingsblöcke. Beende jede Übung immer dann, wenn ${DOG_NAME} noch motiviert und aufmerksam ist, auch wenn die angegebene Zeit noch nicht um ist.`,
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
    goalTitle: "Euer Trainingsziel in 4 Wochen",
    goalText: [
      `Das übergeordnete Ziel dieses Plans ist der Aufbau von emotionaler Sicherheit für ${DOG_NAME}. Sie soll lernen, dass ihre Bezugsperson eine verlässliche sichere Basis ist, an der sie sich in unsicheren Momenten orientieren kann. Dieser Vertrauensaufbau ist das Fundament für alle weiteren Trainingsschritte. Ohne diese Basis würden einzelne Übungen nicht nachhaltig wirken.`,
      `Ein zentrales Trainingsziel ist die systematische Desensibilisierung gegenüber erwachsenen Menschen. Das bedeutet, dass ${DOG_NAME} schrittweise und in ihrem eigenen Tempo lernt, fremde Personen mit positiven Erfahrungen zu verknüpfen. Durch kontrollierte Begegnungen auf sicherer Distanz wird die emotionale Reaktion von Angst langsam in Richtung Gelassenheit verschoben. Dieser Prozess braucht Zeit und darf nicht überstürzt werden.`,
      `Im Bereich der Leinenführigkeit ist das Ziel, dass ${DOG_NAME} lernt, an lockerer Leine zu gehen und sich an ihrer Bezugsperson zu orientieren. Statt durch Flucht nach vorne soll ${DOG_NAME} durch Blickkontakt und ruhiges Gehen auf Stress reagieren. Die lockere Leine ist dabei nicht nur ein praktisches Ziel, sondern auch ein Zeichen dafür, dass ${DOG_NAME} sich sicher genug fühlt, um nicht mehr fliehen zu müssen.`,
      `Schließlich soll ${DOG_NAME} alternative Bewältigungsstrategien zum Bellen aufbauen. Dazu gehören der erlernte Blickkontakt auf das Signal SCHAU, das Ausweichen über einen BOGEN und der freiwillige Rückzug zur Bezugsperson. Am Ende des Plans soll ${DOG_NAME} ein Repertoire an Verhaltensweisen haben, die sie statt des Bellens einsetzen kann, wenn sie sich unsicher fühlt.`,
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
          `Nach den vier Wochen hat ${DOG_NAME} ein Grundrepertoire an Strategien aufgebaut, das nun dauerhaft gepflegt werden muss. Das SCHAU-Signal, die lockere Leinenführung und das BOGEN-Gehen sollten fester Bestandteil jedes Spaziergangs bleiben. Belohne diese Verhaltensweisen auch nach Ende des Plans regelmäßig, damit sie nicht verblassen.`,
          `Menschenbegegnungen sollten weiterhin kontrolliert und positiv gestaltet werden. Vermeide Situationen, in denen fremde Personen ungefragt auf ${DOG_NAME} zugehen oder sie bedrängen. Erkläre Mitmenschen bei Bedarf freundlich, dass ${DOG_NAME} Abstand braucht und nicht gestreichelt werden möchte.`,
          `Führe ein kurzes Trainingstagebuch weiter, in dem du nach jedem Spaziergang notierst, wie Begegnungen verlaufen sind. So erkennst du Fortschritte über Wochen und Monate hinweg und bemerkst frühzeitig, wenn sich Rückschritte anbahnen. Dieses Tagebuch ist dein wichtigstes Werkzeug für die langfristige Arbeit mit ${DOG_NAME}.`,
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
      `Du hast in den letzten vier Wochen die Grundlagen gelegt, um ${DOG_NAME} systematisch mehr Sicherheit und Vertrauen im Alltag zu geben. ${DOG_NAME} hat gelernt, dass ihre Bezugsperson ein verlässlicher Anker ist, dass Menschen nicht grundsätzlich bedrohlich sind und dass es Alternativen zum Bellen und Flüchten gibt. Das ist eine erhebliche Leistung, die du dir und ${DOG_NAME} anerkennen darfst.`,
      `Dieser Plan ist der Anfang einer langfristigen Veränderung, nicht das Ende. ${DOG_NAME}s Ängstlichkeit wird sich weiter verbessern, wenn du die Übungen und Prinzipien konsequent in den Alltag einbaust. Steigere die Schwierigkeit weiterhin in kleinen Schritten und gib ${DOG_NAME} die Zeit, die sie braucht, um jede neue Stufe sicher zu bewältigen.`,
      `Wenn du das Gefühl hast, dass ${DOG_NAME}s Fortschritte stagnieren oder dass bestimmte Situationen trotz Training nicht besser werden, ziehe eine professionelle Hundetrainerin vor Ort hinzu. Gemeinsam könnt ihr den Plan anpassen und gezielt an den Stellen arbeiten, die im Alltag die größten Herausforderungen darstellen. Du bist auf einem guten Weg und ${DOG_NAME} hat in dir die beste Voraussetzung für ein entspannteres Leben.`,
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

function drawAdPage(p, type, fonts, qrImage, layout) {
  const { fontReg, fontBold } = fonts;
  const { A4_W, A4_H, BANNER_H, MARGIN, CONTENT_W, DARK_BROWN, GOLD, GOLD_DARK, TEXT_DARK, TEXT_MEDIUM, BG_BAR, WHITE } = layout;
  const ad = AD_PAGES[type];

  // Badge oben (gold-Pille)
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
    color: GOLD,
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

  // Body — links, mehrzeilig
  y -= 18;
  const bodySize = 13;
  for (const line of ad.body) {
    p.drawText(line, {
      x: MARGIN,
      y,
      size: bodySize,
      font: fontReg,
      color: TEXT_DARK,
    });
    y -= bodySize + 6;
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
async function main() {
  console.log(`Generiere 1-Monatsplan für ${DOG_NAME} (${DOG_BREED}, ${DOG_AGE}, Problem: ${MAIN_PROBLEM})…`);

  const doc = await PDFDocument.create();
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  // Echtes Pfoten-Logo aus public/ einbetten
  const logoBytes = readFileSync("public/logo.png");
  const logoImage = await doc.embedPng(logoBytes);

  // QR-Codes fuer Werbeseiten zur Laufzeit erzeugen
  const qrErnaehrungPng = await buildQrPng(AD_PAGES.ernaehrung.qrUrl);
  const qrErsteHilfePng = await buildQrPng(AD_PAGES.erstehilfe.qrUrl);
  const qrErnaehrungImg = await doc.embedPng(qrErnaehrungPng);
  const qrErsteHilfeImg = await doc.embedPng(qrErsteHilfePng);

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
    p.drawText("1-Monatsplan für", {
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
      width: fontBold.widthOfTextAtSize("1-Monatsplan für", titleSize) * 0.55,
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

    // Rechte Seite: Foto-Box mit Logo (Platzhalter für späteres Hundefoto)
    const boxW = 280;
    const boxH = 280;
    const boxX = rightX + (rightW - boxW) / 2;
    const boxY = (A4_H - BANNER_H - boxH) / 2 + 30;
    drawRoundedRect(p, boxX, boxY, boxW, boxH, 14, WHITE);
    p.drawRectangle({ x: boxX, y: boxY, width: boxW, height: 3, color: GOLD });
    // Logo groß mittig
    const coverLogoSize = 130;
    p.drawImage(logoImage, {
      x: boxX + (boxW - coverLogoSize) / 2,
      y: boxY + 110,
      width: coverLogoSize,
      height: coverLogoSize,
    });
    // Caption im Foto-Bereich
    const captionLines = [`für ${DOG_NAME}`, `${DOG_BREED} · ${DOG_AGE}`];
    let cy = boxY + 75;
    for (const l of captionLines) {
      const w = fontReg.widthOfTextAtSize(l, 13);
      p.drawText(l, { x: boxX + (boxW - w) / 2, y: cy, size: 13, font: fontReg, color: TEXT_MEDIUM });
      cy -= 20;
    }
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
  for (let wIdx = 0; wIdx < PLAN.weeks.length; wIdx++) {
    const week = PLAN.weeks[wIdx];

    // Werbe-Seite 1 (Mitte) — nach Woche 2, also vor Woche 3
    if (wIdx === 2) {
      drawAdPage(newPage(), "ernaehrung", adFonts, qrErnaehrungImg, adLayout);
    }
    // Seite — Fokus und Ziel
    {
      const p = newPage();
      const labelY = A4_H - BANNER_H - 50;
      drawWeekLabel(p, week.nr, MARGIN, labelY - 8, fontBold);
      let y = labelY - 50;
      p.drawText("Fokus und Ziel", { x: MARGIN, y, size: 14, font: fontBold, color: DARK_BROWN });
      y -= 28;
      p.drawText("Wochenziele:", { x: MARGIN, y, size: 11.5, font: fontReg, color: TEXT_DARK });
      y -= 18;
      for (const g of week.goals) {
        y = drawArrowBullet(p, g, MARGIN, y, CONTENT_W, fontReg, fontBold, 11, TEXT_DARK, 15);
      }
      // Pfoten-Deko unten links
      drawPaw(p, MARGIN + 20, 90, 1.6, GOLD_SOFT);
      drawPaw(p, MARGIN + 65, 60, 1.2, GOLD_SOFT);
    }

    // Seite — Tagesstruktur
    {
      const p = newPage();
      drawWeekLabel(p, week.nr, MARGIN, A4_H - BANNER_H - 55, fontBold);
      let y = A4_H - BANNER_H - 105;
      p.drawText("Tagesstruktur", { x: MARGIN, y, size: 14, font: fontBold, color: DARK_BROWN });
      y -= 24;
      for (const para of week.day) {
        y = drawParagraph(p, para, MARGIN, y, CONTENT_W, fontReg, 11.5, TEXT_DARK, 16);
        y -= 10;
      }
    }

    // Seite — Übung 1 Schritt für Schritt
    {
      const p = newPage();
      drawWeekLabel(p, week.nr, MARGIN, A4_H - BANNER_H - 55, fontBold);
      // Pill direkt unter Wochen-Label (Wochen-Label-Box endet bei y - 36 Höhe, also start - 36)
      let y = A4_H - BANNER_H - 95;
      y = drawSectionPill(p, "ÜBUNG 1", MARGIN, y, fontBold, PILL_AC_GREEN, PILL_BG_GREEN, 8);
      // Title sitzt direkt unter Pill — Title-Baseline + size = top
      y -= 18; // Platz für Titel-Höhe
      p.drawText(week.ex1.title, { x: MARGIN, y, size: 18, font: fontBold, color: DARK_BROWN });
      y -= 22;
      p.drawText(week.ex1.sub, { x: MARGIN, y, size: 13, font: fontReg, color: TEXT_MEDIUM });
      y -= 22;
      y = drawParagraph(p, week.ex1.intro, MARGIN, y, CONTENT_W, fontReg, 12.5, TEXT_DARK, 17);
      y -= 12;
      for (let i = 0; i < week.ex1.steps.length; i++) {
        y = drawNumberedStep(p, i + 1, week.ex1.steps[i], MARGIN, y, CONTENT_W, fontReg, fontBold, 12.5, TEXT_DARK, 17);
        y -= 4;
      }
    }

    // Seite — Typische Fehler ODER (bei Woche 4) Stabilisierung
    if (week.mistakes && week.mistakes.length) {
      const p = newPage();
      drawWeekLabel(p, week.nr, MARGIN, A4_H - BANNER_H - 55, fontBold);
      let y = A4_H - BANNER_H - 95;
      y = drawSectionPill(p, "TYPISCHE FEHLER", MARGIN, y, fontBold, PILL_AC_RED, PILL_BG_RED, 8);
      y -= 18;
      p.drawText("Typische Fehler bei Übung 1", { x: MARGIN, y, size: 18, font: fontBold, color: DARK_BROWN });
      y -= 28;
      for (const m of week.mistakes) {
        y = drawWarnBullet(p, m, MARGIN, y, CONTENT_W, fontReg, 12.5, TEXT_DARK, 17);
        y -= 4;
      }
    }

    // Seite — Übung 2 Schritt für Schritt
    {
      const p = newPage();
      drawWeekLabel(p, week.nr, MARGIN, A4_H - BANNER_H - 55, fontBold);
      let y = A4_H - BANNER_H - 95;
      y = drawSectionPill(p, "ÜBUNG 2", MARGIN, y, fontBold, PILL_AC_GREEN, PILL_BG_GREEN, 8);
      y -= 18;
      p.drawText(week.ex2.title, { x: MARGIN, y, size: 18, font: fontBold, color: DARK_BROWN });
      y -= 22;
      p.drawText(week.ex2.sub, { x: MARGIN, y, size: 13, font: fontReg, color: TEXT_MEDIUM });
      y -= 22;
      y = drawParagraph(p, week.ex2.intro, MARGIN, y, CONTENT_W, fontReg, 12.5, TEXT_DARK, 17);
      y -= 12;
      for (let i = 0; i < week.ex2.steps.length; i++) {
        y = drawNumberedStep(p, i + 1, week.ex2.steps[i], MARGIN, y, CONTENT_W, fontReg, fontBold, 12.5, TEXT_DARK, 17);
        y -= 4;
      }
    }

    // Seite — Wochen-Check ODER (Woche 4) Stabilisierung
    if (week.check && week.check.length) {
      const p = newPage();
      drawWeekLabel(p, week.nr, MARGIN, A4_H - BANNER_H - 55, fontBold);
      let y = A4_H - BANNER_H - 95;
      y = drawSectionPill(p, "WOCHEN-CHECK", MARGIN, y, fontBold, PILL_AC_GOLD, PILL_BG_GOLD, 8);
      y -= 18;
      p.drawText("Wochen-Check", { x: MARGIN, y, size: 18, font: fontBold, color: DARK_BROWN });
      y -= 24;
      const introCheck = `Prüfe am Ende der Woche ehrlich, wie weit ${DOG_NAME} bei den Inhalten ist. Gehe erst zur nächsten Woche über, wenn die Mehrheit der folgenden Punkte zutrifft.`;
      y = drawParagraph(p, introCheck, MARGIN, y, CONTENT_W, fontReg, 12, TEXT_MEDIUM, 16);
      y -= 14;
      for (const c of week.check) {
        y = drawCheckBullet(p, c, MARGIN, y, CONTENT_W, fontReg, 12.5, TEXT_DARK, 17);
        y -= 4;
      }
    }

    if (week.stab) {
      const p = newPage();
      drawWeekLabel(p, week.nr, MARGIN, A4_H - BANNER_H - 55, fontBold);
      let y = A4_H - BANNER_H - 105;
      p.drawText(week.stab.title, { x: MARGIN, y, size: 14, font: fontBold, color: DARK_BROWN });
      y -= 24;
      for (const para of week.stab.text) {
        y = drawParagraph(p, para, MARGIN, y, CONTENT_W, fontReg, 11.5, TEXT_DARK, 16);
        y -= 10;
      }
    }
  }

  // Werbe-Seite 2 (Ende) — nach allen Wochen, vor Outro
  drawAdPage(newPage(), "erstehilfe", adFonts, qrErsteHilfeImg, adLayout);

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
  const outPath = `public/monatsplan-1monat-TEST.pdf`;
  writeFileSync(outPath, bytes);
  console.log(`✓ PDF geschrieben: ${outPath}`);
  console.log(`  Seiten: ${pageNr}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
