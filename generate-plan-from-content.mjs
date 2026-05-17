// Generiert einen ECHT personalisierten Trainingsplan als A4-PDF, basierend auf
// einem von Claude AI erzeugten TrainingPlanContent-JSON.
//
// Im Gegensatz zu generate-{1,3,6}monatsplan-pdf.mjs ist dieser Generator
// content-driven: er rendert NICHT hardcoded Yuna/Bruno-Inhalte, sondern den
// echten personalisierten Plan aus member_plan_content (Claude-Output).
//
// Verwendung als Modul:
//   import { buildPdfFromContent } from "./generate-plan-from-content.mjs";
//   const bytes = await buildPdfFromContent({
//     plan: trainingPlanContentJson,
//     dogName: "Bruno",
//     dogBreed: "Labrador-Mix",
//     mainProblem: "Leinenziehen",
//     planLengthMonths: 3,
//   });
//
// Layout pro Woche: 3 Seiten (Wochenziele+Tagesplan, Übung 1, Übung 2+No-Gos)
// Gesamt: 1 Cover + 3 Intro + N*3 Wochen + M Monatsübersichten + 1 Abschluss
//         + 1 Zusatzspiele = je nach Plan-Länge 17–80 Seiten.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFileSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join as pathJoin } from "path";
import QRCode from "qrcode";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Assets fuer PDF-Generierung liegen separat (NICHT in public/), damit
// Next.js den public/-Folder NICHT als Dependency in das Function-Bundle
// traced (sonst 250MB+ durch ungenutzte Videos etc.).
const PDF_ASSETS = (file) => pathJoin(__dirname, "pdf-assets", file);
// PUBLIC nur fuer CLI-Output verwenden (Test-PDF schreiben).
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
    imagePath: "pdf-assets/Hund1.png",
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
    imagePath: "pdf-assets/Hund2.png",
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
export async function buildPdfFromContent(params = {}) {
  const DOG_NAME     = (params.dogName     ?? process.env.DOG_NAME     ?? DEFAULT_DOG_NAME).trim();
  const DOG_BREED    = (params.dogBreed    ?? process.env.DOG_BREED    ?? DEFAULT_DOG_BREED).trim();
  const DOG_AGE      = (params.dogAge      ?? process.env.DOG_AGE      ?? DEFAULT_DOG_AGE).trim();
  const MAIN_PROBLEM = (params.mainProblem ?? process.env.MAIN_PROBLEM ?? DEFAULT_MAIN_PROBLEM).trim();
  const planLengthMonths = params.planLengthMonths || 3;
  const plan = params.plan;
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) {
    throw new Error("buildPdfFromContent: params.plan ist leer oder hat keine weeks[]");
  }
  if (params.verbose !== false) {
    console.log(`Generiere ${planLengthMonths}-Monatsplan (Content-Driven) für ${DOG_NAME} — ${plan.weeks.length} Wochen aus AI-Plan`);
  }

  const doc = await PDFDocument.create();
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  // Echtes Pfoten-Logo aus public/ einbetten
  const logoBytes = readFileSync(PDF_ASSETS("logo.png"));
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
  const dogCoverImg = await doc.embedPng(readFileSync(PDF_ASSETS("TrainerPfoten-thumb.png")));
  const dogAccentImg = await doc.embedPng(readFileSync(PDF_ASSETS("Hund4.png")));

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

    // Titel dynamisch je nach Plan-Länge
    const titleStr = `${planLengthMonths}-Monatsplan für`;
    let y = A4_H - BANNER_H - 90;
    const titleSize = 46;
    p.drawText(titleStr, {
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
      width: fontBold.widthOfTextAtSize(titleStr, titleSize) * 0.55,
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
    // Unter Hundename: kurzer Subtitle dynamisch
    y -= 36;
    p.drawText(`${plan.weeks.length} Wochen · ${planLengthMonths} ${planLengthMonths === 1 ? "Monat" : "Monate"}`, {
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

  // ===== INTRO-SEITEN (3) — aus AI-Plan plan.intro =====
  // Falls plan.intro fehlt oder ein Feld leer ist, fallback auf generischen
  // Text der DOG_NAME + MAIN_PROBLEM referenziert.
  const introData = plan.intro || {};

  const introEinleitungText =
    introData.einleitung ||
    `Dieser Trainingsplan wurde speziell für ${DOG_NAME} und ihre Bedürfnisse entwickelt. Er begleitet dich Schritt für Schritt durch ${plan.weeks.length} Wochen, mit klarem Fokus auf ${MAIN_PROBLEM}. Jede Übung ist so gestaltet, dass du sie ohne Vorkenntnisse umsetzen kannst.`;

  const introAufbauText =
    introData.aufbau ||
    `Der Plan ist in ${plan.weeks.length} Wochen gegliedert, die aufeinander aufbauen. Jede Woche hat klare Ziele, einen detaillierten Tagesplan und 2 Kernübungen, die du täglich übst. Plus: einen Wochen-Check, der dir zeigt, ob ihr bereit für die nächste Stufe seid. Gehe erst weiter, wenn die Mehrheit der Check-Punkte sitzt — Stabilität schlägt Tempo.`;

  const introZieleText =
    introData.ziele ||
    `Das übergeordnete Ziel dieses Plans ist, dass ${DOG_NAME} ein deutlich entspannteres Verhältnis zu der Situation entwickelt, die heute ${MAIN_PROBLEM} auslöst. Über die ${plan.weeks.length} Wochen lernt ${DOG_NAME} alternative Reaktionsmuster, die ihren Stress senken und dir mehr Sicherheit im Alltag geben.`;

  // Seite 2 — Willkommen
  {
    const p = newPage();
    let y = drawSectionTitle(p, `Willkommen — Dein Plan für ${DOG_NAME}`, MARGIN, A4_H - BANNER_H - 50, fontBold, 28);
    y -= 6;
    for (const para of String(introEinleitungText).split(/\n\n+/)) {
      y = drawParagraph(p, para.trim(), MARGIN, y, CONTENT_W, fontReg, 12, TEXT_DARK, 17);
      y -= 10;
    }
  }

  // Seite 3 — Arbeitsweise / Aufbau (inkl. Markerwort-Tipp-Box)
  {
    const p = newPage();
    let y = drawSectionTitle(p, "So arbeitest du mit diesem Plan", MARGIN, A4_H - BANNER_H - 50, fontBold, 28);
    y -= 6;
    for (const para of String(introAufbauText).split(/\n\n+/)) {
      y = drawParagraph(p, para.trim(), MARGIN, y, CONTENT_W, fontReg, 12, TEXT_DARK, 17);
      y -= 10;
    }

    // ===== Markerwort-Tipp-Box =====
    // Erklärung was ein Markerwort ist + Beispiele. Damit Halter sofort
    // verstehen wie "FEIN" in den Übungs-Schritten gemeint ist.
    y -= 6;
    const boxX = MARGIN;
    const boxW = CONTENT_W;
    const boxPadding = 18;
    // Höhe abschätzen — Title + 4 Zeilen Text + Beispiele
    const boxTextLines = wrapText(
      `Sage ein klar definiertes Wort wie "Fein", "Supi" oder "Yes" in fröhlichem Ton, SOFORT wenn ${DOG_NAME} das gewünschte Verhalten zeigt. Direkt danach Leckerli geben.`,
      fontReg,
      11,
      boxW - 2 * boxPadding
    );
    const boxExampleLines = wrapText(
      `Beispiel: ${DOG_NAME} schaut dich auf das Signal SCHAU an, du sagst sofort "Fein!" und gibst ihm direkt ein Leckerli. Das Markerwort ist die Brücke zwischen "richtig gemacht" und der Belohnung — die wichtigste Abkürzung im Hundetraining.`,
      fontReg,
      10.5,
      boxW - 2 * boxPadding
    );
    const boxH = 36 + boxTextLines.length * 15 + 12 + boxExampleLines.length * 14 + boxPadding;
    const boxY = y - boxH;

    // Hintergrund (warmes Beige)
    drawRoundedRect(p, boxX, boxY, boxW, boxH, 10, BANNER_TAN);
    // Linke goldene Akzent-Linie
    p.drawRectangle({
      x: boxX + 8, y: boxY + 10,
      width: 3, height: boxH - 20,
      color: GOLD,
    });

    let by = boxY + boxH - boxPadding - 2;
    // Titel
    p.drawText("Dein Markerwort beim Üben", {
      x: boxX + boxPadding + 8, y: by,
      size: 13, font: fontBold, color: DARK_BROWN,
    });
    by -= 22;
    // Text
    for (const line of boxTextLines) {
      p.drawText(line, {
        x: boxX + boxPadding + 8, y: by,
        size: 11, font: fontReg, color: TEXT_DARK,
      });
      by -= 15;
    }
    by -= 6;
    // Beispiel
    for (const line of boxExampleLines) {
      p.drawText(line, {
        x: boxX + boxPadding + 8, y: by,
        size: 10.5, font: fontReg, color: TEXT_MEDIUM,
      });
      by -= 14;
    }
  }

  // Seite 4 — Trainingsziel
  {
    const p = newPage();
    let y = drawSectionTitle(p, `Euer Trainingsziel`, MARGIN, A4_H - BANNER_H - 50, fontBold, 28);
    y -= 6;
    for (const para of String(introZieleText).split(/\n\n+/)) {
      y = drawParagraph(p, para.trim(), MARGIN, y, CONTENT_W, fontReg, 12, TEXT_DARK, 17);
      y -= 10;
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
  // Helper — rendert eine einzelne Woche im 3-Seiten-Layout (für 1M/3M)
  function renderSingleWeek(week, wIdx) {
    const weekNum = week.num || wIdx + 1;
    const wochenziele = Array.isArray(week.wochenziele) ? week.wochenziele : [];
    const tagesplanParas = String(week.tagesplan || "").split(/\n\n+/).filter(Boolean);
    const uebungen = Array.isArray(week.uebungen) ? week.uebungen : [];
    const ue1 = uebungen[0] || null;
    const ue2 = uebungen[1] || null;
    const no_gos = Array.isArray(week.no_gos) ? week.no_gos : [];
    const fortschritt = Array.isArray(week.fortschritt) ? week.fortschritt : [];

    // === Seite 1 — Wochenziele + Tagesplan ===
    {
      const p = newPage();
      const labelY = A4_H - BANNER_H - 50;
      drawWeekLabel(p, weekNum, MARGIN, labelY - 8, fontBold, fontReg);
      let y = labelY - 60;

      if (week.title) {
        p.drawText(String(week.title), { x: MARGIN, y, size: 16, font: fontBold, color: DARK_BROWN });
        y -= 28;
      }

      p.drawText("Wochenziele", { x: MARGIN, y, size: 14, font: fontBold, color: DARK_BROWN });
      y -= 22;
      for (const g of wochenziele) {
        y = drawArrowBullet(p, g, MARGIN, y, CONTENT_W, fontReg, fontBold, 10.5, TEXT_DARK, 14);
      }

      y -= 10;
      p.drawText("Tagesplan", { x: MARGIN, y, size: 14, font: fontBold, color: DARK_BROWN });
      y -= 22;
      for (const para of tagesplanParas) {
        y = drawParagraph(p, para, MARGIN, y, CONTENT_W, fontReg, 10.5, TEXT_DARK, 14);
        y -= 6;
      }
    }

    if (ue1) {
      const p = newPage();
      drawWeekLabel(p, weekNum, MARGIN, A4_H - BANNER_H - 55, fontBold, fontReg);
      let y = A4_H - BANNER_H - 95;
      y = drawSectionPill(p, "ÜBUNG 1", MARGIN, y, fontBold, PILL_AC_GREEN, PILL_BG_GREEN, 8);
      y -= 18;
      p.drawText(String(ue1.name || "Kernübung"), { x: MARGIN, y, size: 18, font: fontBold, color: DARK_BROWN });
      y -= 28;
      const steps = Array.isArray(ue1.schritte) ? ue1.schritte : [];
      for (let i = 0; i < steps.length; i++) {
        y = drawNumberedStep(p, i + 1, steps[i], MARGIN, y, CONTENT_W, fontReg, fontBold, 11.5, TEXT_DARK, 16);
        y -= 3;
      }
    }

    if (ue2) {
      const p = newPage();
      drawWeekLabel(p, weekNum, MARGIN, A4_H - BANNER_H - 55, fontBold, fontReg);
      let y = A4_H - BANNER_H - 95;
      y = drawSectionPill(p, "ÜBUNG 2", MARGIN, y, fontBold, PILL_AC_GREEN, PILL_BG_GREEN, 8);
      y -= 16;
      p.drawText(String(ue2.name || "Kernübung 2"), { x: MARGIN, y, size: 17, font: fontBold, color: DARK_BROWN });
      y -= 24;
      const steps2 = Array.isArray(ue2.schritte) ? ue2.schritte : [];
      for (let i = 0; i < steps2.length; i++) {
        y = drawNumberedStep(p, i + 1, steps2[i], MARGIN, y, CONTENT_W, fontReg, fontBold, 10.5, TEXT_DARK, 14);
        y -= 2;
      }

      if (no_gos.length && y > 220) {
        y -= 14;
        p.drawText("Vermeide diese Woche", { x: MARGIN, y, size: 12, font: fontBold, color: WARN_RED });
        y -= 16;
        for (const ng of no_gos.slice(0, 4)) {
          y = drawWarnBullet(p, ng, MARGIN, y, CONTENT_W, fontReg, 10, TEXT_DARK, 13);
          y -= 1;
        }
      }
      if (fortschritt.length && y > 130) {
        y -= 10;
        p.drawText("Fortschritt erkennst du daran", { x: MARGIN, y, size: 12, font: fontBold, color: GOLD_DARK });
        y -= 16;
        for (const f of fortschritt.slice(0, 3)) {
          y = drawCheckBullet(p, f, MARGIN, y, CONTENT_W, fontReg, 10, TEXT_DARK, 13);
          y -= 1;
        }
      }
    }
  }

  // Helper — rendert ein 2-Wochen-Pair als "Phase" in 4 Seiten (für 6M)
  // Seite 1: Phase-Overview (Wochenziele beider Wochen + Tagesplan)
  // Seite 2: Woche A — beide Übungen kompakt
  // Seite 3: Woche B — beide Übungen kompakt
  // Seite 4: Phasen-Check (No-Gos + Fortschritt beider Wochen)
  function renderPhasePair(wA, wB, phaseIdx) {
    const phaseNum = phaseIdx + 1;
    const wAnum = wA.num || phaseIdx * 2 + 1;
    const wBnum = wB.num || phaseIdx * 2 + 2;

    // === Seite 1 — Phase-Overview ===
    {
      const p = newPage();
      const labelY = A4_H - BANNER_H - 50;
      drawWeekLabel(p, phaseNum, MARGIN, labelY - 8, fontBold, fontReg);
      // Sub-Label rechts neben dem Phase-Label: Wochen-Range
      p.drawText(`Woche ${wAnum}–${wBnum}`, {
        x: MARGIN + 130, y: labelY + 4, size: 13, font: fontReg, color: GOLD_DARK,
      });
      let y = labelY - 60;

      // Phase-Titel: aus Woche A.title (oder generisch)
      if (wA.title) {
        p.drawText(String(wA.title), { x: MARGIN, y, size: 15, font: fontBold, color: DARK_BROWN });
        y -= 22;
      }

      // Zwei-Spalten-Layout für Wochenziele
      const colW = (CONTENT_W - 20) / 2;
      const yStart = y;
      // Spalte links: Woche A Ziele
      let yL = yStart;
      p.drawText(`Woche ${wAnum} · Ziele`, { x: MARGIN, y: yL, size: 11, font: fontBold, color: GOLD_DARK });
      yL -= 16;
      for (const g of (wA.wochenziele || []).slice(0, 5)) {
        yL = drawArrowBullet(p, g, MARGIN, yL, colW, fontReg, fontBold, 9.5, TEXT_DARK, 12);
      }
      // Spalte rechts: Woche B Ziele
      let yR = yStart;
      const xR = MARGIN + colW + 20;
      p.drawText(`Woche ${wBnum} · Ziele`, { x: xR, y: yR, size: 11, font: fontBold, color: GOLD_DARK });
      yR -= 16;
      for (const g of (wB.wochenziele || []).slice(0, 5)) {
        yR = drawArrowBullet(p, g, xR, yR, colW, fontReg, fontBold, 9.5, TEXT_DARK, 12);
      }

      y = Math.min(yL, yR) - 14;

      // Tagesplan-Übersicht für beide Wochen — verkürzt
      p.drawText("Tagesplan-Übersicht", { x: MARGIN, y, size: 12, font: fontBold, color: DARK_BROWN });
      y -= 18;
      if (wA.tagesplan) {
        p.drawText(`Woche ${wAnum}:`, { x: MARGIN, y, size: 10, font: fontBold, color: GOLD_DARK });
        y -= 14;
        const firstParaA = String(wA.tagesplan).split(/\n\n+/)[0] || "";
        y = drawParagraph(p, firstParaA, MARGIN, y, CONTENT_W, fontReg, 9.5, TEXT_DARK, 13);
        y -= 8;
      }
      if (wB.tagesplan) {
        p.drawText(`Woche ${wBnum}:`, { x: MARGIN, y, size: 10, font: fontBold, color: GOLD_DARK });
        y -= 14;
        const firstParaB = String(wB.tagesplan).split(/\n\n+/)[0] || "";
        y = drawParagraph(p, firstParaB, MARGIN, y, CONTENT_W, fontReg, 9.5, TEXT_DARK, 13);
      }
    }

    // === Seite 2 — Woche A: beide Übungen kompakt ===
    {
      const p = newPage();
      drawWeekLabel(p, phaseNum, MARGIN, A4_H - BANNER_H - 55, fontBold, fontReg);
      p.drawText(`Woche ${wAnum}`, {
        x: MARGIN + 130, y: A4_H - BANNER_H - 49, size: 13, font: fontReg, color: GOLD_DARK,
      });
      let y = A4_H - BANNER_H - 100;
      const uebs = Array.isArray(wA.uebungen) ? wA.uebungen.slice(0, 2) : [];
      for (let i = 0; i < uebs.length; i++) {
        const u = uebs[i];
        y = drawSectionPill(p, `ÜBUNG ${i + 1}`, MARGIN, y, fontBold, PILL_AC_GREEN, PILL_BG_GREEN, 6);
        y -= 14;
        p.drawText(String(u.name || ""), { x: MARGIN, y, size: 14, font: fontBold, color: DARK_BROWN });
        y -= 20;
        const steps = Array.isArray(u.schritte) ? u.schritte : [];
        for (let s = 0; s < steps.length; s++) {
          y = drawNumberedStep(p, s + 1, steps[s], MARGIN, y, CONTENT_W, fontReg, fontBold, 9.5, TEXT_DARK, 12);
          y -= 1;
        }
        y -= 10;
      }
    }

    // === Seite 3 — Woche B: beide Übungen kompakt ===
    {
      const p = newPage();
      drawWeekLabel(p, phaseNum, MARGIN, A4_H - BANNER_H - 55, fontBold, fontReg);
      p.drawText(`Woche ${wBnum}`, {
        x: MARGIN + 130, y: A4_H - BANNER_H - 49, size: 13, font: fontReg, color: GOLD_DARK,
      });
      let y = A4_H - BANNER_H - 100;
      const uebs = Array.isArray(wB.uebungen) ? wB.uebungen.slice(0, 2) : [];
      for (let i = 0; i < uebs.length; i++) {
        const u = uebs[i];
        y = drawSectionPill(p, `ÜBUNG ${i + 1}`, MARGIN, y, fontBold, PILL_AC_GREEN, PILL_BG_GREEN, 6);
        y -= 14;
        p.drawText(String(u.name || ""), { x: MARGIN, y, size: 14, font: fontBold, color: DARK_BROWN });
        y -= 20;
        const steps = Array.isArray(u.schritte) ? u.schritte : [];
        for (let s = 0; s < steps.length; s++) {
          y = drawNumberedStep(p, s + 1, steps[s], MARGIN, y, CONTENT_W, fontReg, fontBold, 9.5, TEXT_DARK, 12);
          y -= 1;
        }
        y -= 10;
      }
    }

    // === Seite 4 — Phasen-Check ===
    {
      const p = newPage();
      drawWeekLabel(p, phaseNum, MARGIN, A4_H - BANNER_H - 55, fontBold, fontReg);
      let y = A4_H - BANNER_H - 95;
      y = drawSectionPill(p, "PHASEN-CHECK", MARGIN, y, fontBold, PILL_AC_GOLD, PILL_BG_GOLD, 8);
      y -= 18;
      p.drawText("Was diese Phase festigen sollte", { x: MARGIN, y, size: 16, font: fontBold, color: DARK_BROWN });
      y -= 24;

      // No-Gos beider Wochen
      const allNoGos = [
        ...(Array.isArray(wA.no_gos) ? wA.no_gos : []),
        ...(Array.isArray(wB.no_gos) ? wB.no_gos : []),
      ].slice(0, 6);
      if (allNoGos.length) {
        p.drawText("Vermeide in diesen 2 Wochen", { x: MARGIN, y, size: 12, font: fontBold, color: WARN_RED });
        y -= 18;
        for (const ng of allNoGos) {
          y = drawWarnBullet(p, ng, MARGIN, y, CONTENT_W, fontReg, 10.5, TEXT_DARK, 14);
          y -= 1;
        }
        y -= 10;
      }

      // Fortschritt beider Wochen
      const allFortschritt = [
        ...(Array.isArray(wA.fortschritt) ? wA.fortschritt : []),
        ...(Array.isArray(wB.fortschritt) ? wB.fortschritt : []),
      ].slice(0, 6);
      if (allFortschritt.length) {
        p.drawText("Fortschritt erkennst du daran", { x: MARGIN, y, size: 12, font: fontBold, color: GOLD_DARK });
        y -= 18;
        for (const f of allFortschritt) {
          y = drawCheckBullet(p, f, MARGIN, y, CONTENT_W, fontReg, 10.5, TEXT_DARK, 14);
          y -= 1;
        }
      }
    }
  }

  // ===== Wochen-Loop — bei 6M paarweise als Phasen, sonst einzeln =====
  const useDoubleWeekLayout =
    planLengthMonths === 6 && plan.weeks.length >= 12;

  if (useDoubleWeekLayout) {
    const totalPhases = Math.floor(plan.weeks.length / 2);
    for (let phaseIdx = 0; phaseIdx < totalPhases; phaseIdx++) {
      const wA = plan.weeks[phaseIdx * 2];
      const wB = plan.weeks[phaseIdx * 2 + 1];
      renderPhasePair(wA, wB, phaseIdx);
    }
  } else {
    for (let wIdx = 0; wIdx < plan.weeks.length; wIdx++) {
      renderSingleWeek(plan.weeks[wIdx], wIdx);
    }
  }

  // ===== Monats-Übersichten =====
  // Bei 6M paaren wir je zwei Monate auf eine Seite, um auf ca. 56 Seiten
  // Gesamtumfang zu kommen (statt 6 separate Seiten).
  const monatsUebersichten = Array.isArray(plan.monats_uebersichten)
    ? plan.monats_uebersichten
    : [];
  if (planLengthMonths === 6 && monatsUebersichten.length >= 2) {
    // 6M: 3 Monatsübersichten pro Seite — alle 6 Monate auf 2 Seiten gesamt.
    for (let i = 0; i < monatsUebersichten.length; i += 3) {
      const group = monatsUebersichten.slice(i, i + 3);
      if (group.length === 0) continue;
      const p = newPage();
      const monthLabel = group.map((m) => m.monat).join(" · ");
      let y = drawSectionTitle(
        p,
        group.length === 1 ? `Monat ${group[0].monat} — Zwischenstand` : `Zwischenstand · Monat ${monthLabel}`,
        MARGIN, A4_H - BANNER_H - 50, fontBold, 22
      );
      y -= 6;

      for (const mu of group) {
        p.drawText(`Monat ${mu.monat}`, { x: MARGIN, y, size: 12, font: fontBold, color: GOLD_DARK });
        y -= 16;
        const firstPara = String(mu.text || "").split(/\n\n+/).filter(Boolean)[0] || "";
        y = drawParagraph(p, firstPara, MARGIN, y, CONTENT_W, fontReg, 10, TEXT_DARK, 13);
        y -= 12;
      }
    }
  } else {
    for (const mu of monatsUebersichten) {
      const p = newPage();
      let y = drawSectionTitle(p, `Monat ${mu.monat} — Zwischenstand`, MARGIN, A4_H - BANNER_H - 50, fontBold, 28);
      y -= 6;
      for (const para of String(mu.text || "").split(/\n\n+/).filter(Boolean)) {
        y = drawParagraph(p, para, MARGIN, y, CONTENT_W, fontReg, 12, TEXT_DARK, 17);
        y -= 10;
      }
    }
  }

  // ===== Abschluss (aus plan.abschluss; mit Fallback) =====
  {
    const p = newPage();
    let y = drawSectionTitle(p, "Abschluss & wie es weitergeht", MARGIN, A4_H - BANNER_H - 50, fontBold, 28);
    y -= 6;
    const abschlussText =
      plan.abschluss ||
      `Du hast ${DOG_NAME} über ${plan.weeks.length} Wochen systematisch begleitet — das ist eine echte Leistung. Die hier aufgebauten Strategien sind jetzt Teil eures Alltags und werden mit weiterer Anwendung immer stabiler.\n\nHalte das Trainingstagebuch im Mitglieder-Bereich weiter aktiv und beobachte die kleinen Fortschritte. Wenn etwas stagniert, kannst du jederzeit über den KI-Trainer Rückfragen stellen — und für tiefere Themen empfehlen wir den Austausch mit einer Hundetrainerin vor Ort.`;
    for (const para of String(abschlussText).split(/\n\n+/).filter(Boolean)) {
      y = drawParagraph(p, para, MARGIN, y, CONTENT_W, fontReg, 12, TEXT_DARK, 17);
      y -= 10;
    }
    // Footer
    const footerLines = ["Bei Fragen kannst du dich jederzeit per Mail beim Pfoten-Plan-Team melden.", "Viel Spaß und Erfolg!"];
    let fy = 60;
    for (let i = footerLines.length - 1; i >= 0; i--) {
      const line = footerLines[i];
      const w = fontBold.widthOfTextAtSize(line, 11);
      p.drawText(line, { x: (A4_W - w) / 2, y: fy, size: 11, font: fontBold, color: DARK_BROWN });
      fy += 16;
    }
  }

  // ===== Zusatz-Spiele (aus plan.zusatz_spiele) =====
  const zusatzSpiele = Array.isArray(plan.zusatz_spiele) ? plan.zusatz_spiele : [];
  if (zusatzSpiele.length > 0) {
    const p = newPage();
    p.drawText("Zusatz!", { x: MARGIN, y: A4_H - BANNER_H - 50, size: 26, font: fontBold, color: DARK_BROWN });
    p.drawText("Bonus-Spiele fürs Training zwischendurch", { x: MARGIN, y: A4_H - 60 - 80, size: 12, font: fontReg, color: TEXT_MEDIUM });
    p.drawCircle({ x: MARGIN + 95, y: A4_H - 60 - 50, size: 6, color: GOLD });

    // bis zu 3 Spielen in drei Spalten
    const games = zusatzSpiele.slice(0, 3);
    const col_W = (CONTENT_W - 24) / 3;
    const colY0 = A4_H - 60 - 130;

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const cx = MARGIN + i * (col_W + 12);
      let y = colY0;

      // Titel
      const titleLines = wrapText(String(game.name || `Spiel ${i + 1}`), fontBold, 11.5, col_W);
      for (const tl of titleLines) {
        p.drawText(tl, { x: cx, y, size: 11.5, font: fontBold, color: DARK_BROWN });
        y -= 15;
      }
      y -= 4;

      // Ziel
      p.drawText("Ziel:", { x: cx, y, size: 10, font: fontBold, color: TEXT_DARK });
      y -= 14;
      const goalLines = wrapText(String(game.ziel || ""), fontReg, 9.5, col_W);
      for (const l of goalLines) {
        p.drawText(l, { x: cx, y, size: 9.5, font: fontReg, color: TEXT_DARK });
        y -= 13;
      }
      y -= 8;

      // So funktioniert das Spiel
      p.drawText("So funktioniert das Spiel:", { x: cx, y, size: 10, font: fontBold, color: TEXT_DARK });
      y -= 14;
      const steps = Array.isArray(game.schritte) ? game.schritte : [];
      for (const s of steps) {
        const arrow = "->";
        const arrowW = fontBold.widthOfTextAtSize(arrow, 9);
        p.drawText(arrow, { x: cx, y, size: 9, font: fontBold, color: TEXT_DARK });
        const lines = wrapText(String(s), fontReg, 9, col_W - arrowW - 4);
        for (let li = 0; li < lines.length; li++) {
          p.drawText(lines[li], { x: cx + arrowW + 4, y, size: 9, font: fontReg, color: TEXT_DARK });
          y -= 12;
        }
      }
      y -= 8;

      // Warum es hilft
      p.drawText("Warum es hilft:", { x: cx, y, size: 10, font: fontBold, color: TEXT_DARK });
      y -= 14;
      const whyLines = wrapText(String(game.warum || ""), fontReg, 9.5, col_W);
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
// Erwartet ein JSON-File mit dem Plan-Content als Argument:
//   node generate-plan-from-content.mjs path/to/plan.json [dogName] [breed] [problem] [months]
const __isMain = import.meta.url === `file://${process.argv[1]}`;
if (__isMain) {
  const planFile = process.argv[2];
  if (!planFile) {
    console.error("Usage: node generate-plan-from-content.mjs <plan.json> [dogName] [breed] [problem] [months]");
    process.exit(1);
  }
  const plan = JSON.parse(readFileSync(planFile, "utf-8"));
  buildPdfFromContent({
    plan,
    dogName: process.argv[3] || process.env.DOG_NAME,
    dogBreed: process.argv[4] || process.env.DOG_BREED,
    mainProblem: process.argv[5] || process.env.MAIN_PROBLEM,
    planLengthMonths: Number(process.argv[6] || process.env.MONTHS || 3),
  })
    .then((bytes) => {
      const outPath = PUBLIC("monatsplan-personalisiert-TEST.pdf");
      writeFileSync(outPath, bytes);
      console.log(`✓ PDF geschrieben: ${outPath}`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
