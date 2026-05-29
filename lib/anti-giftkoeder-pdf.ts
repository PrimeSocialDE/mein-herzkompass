// Anti-Giftkoeder-Trainingsplan PDF-Generator
//
// 12-Seiten-PDF, dynamisch befuellt mit Quiz-Daten (Hundename, Rasse, Alter).
// Pfoten-Plan-Design (Gold-Akzent, Helvetica, A4). Verhaltens-Training only.
// KEIN medizinischer Content — Disclaimer auf jeder Seite unten.

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from "pdf-lib";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ───────── Layout-Konstanten ─────────
const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 50;
const CONTENT_W = A4_W - 2 * MARGIN;

const GOLD = rgb(196 / 255, 165 / 255, 118 / 255);
const DARK_BROWN = rgb(139 / 255, 115 / 255, 85 / 255);
const TEXT_DARK = rgb(26 / 255, 26 / 255, 26 / 255);
const TEXT_MEDIUM = rgb(100 / 255, 100 / 255, 100 / 255);
const TEXT_LIGHT = rgb(150 / 255, 150 / 255, 150 / 255);
const WHITE = rgb(1, 1, 1);
const BG_LIGHT = rgb(250 / 255, 248 / 255, 245 / 255);
const BG_WARM = rgb(254 / 255, 249 / 255, 243 / 255);
const BORDER_LIGHT = rgb(232 / 255, 220 / 255, 200 / 255);

// ───────── Rasse-Mapping ─────────

// Voll-Bezeichnung fuer Anzeige (display)
function normalizeBreedDisplay(breed: string | null | undefined): string {
  if (!breed) return "Mischling";
  const s = String(breed).trim();
  if (!s || /unknown/i.test(s)) return "Mischling";
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Rasse-spezifischer Tipp (auf Seite 2). User-spezifiziertes Mapping.
const BREED_TIPS: Record<string, string> = {
  labrador: "Retriever sind extrem futtergetrieben. Das macht das Training anfangs schwieriger, aber es bedeutet auch: die Belohnung aus deiner Hand ist besonders wirksam. Nutze das.",
  "labrador retriever": "Retriever sind extrem futtergetrieben. Das macht das Training anfangs schwieriger, aber es bedeutet auch: die Belohnung aus deiner Hand ist besonders wirksam. Nutze das.",
  "golden retriever": "Retriever sind extrem futtergetrieben. Das macht das Training anfangs schwieriger, aber es bedeutet auch: die Belohnung aus deiner Hand ist besonders wirksam. Nutze das.",
  "deutscher schäferhund": "Schäferhunde lernen schnell und strukturiert. Halte die Übungen klar und konsequent — Wiederholungen festigen das Verhalten bei dieser Rasse besonders gut.",
  schäferhund: "Schäferhunde lernen schnell und strukturiert. Halte die Übungen klar und konsequent — Wiederholungen festigen das Verhalten bei dieser Rasse besonders gut.",
  "german shepherd": "Schäferhunde lernen schnell und strukturiert. Halte die Übungen klar und konsequent — Wiederholungen festigen das Verhalten bei dieser Rasse besonders gut.",
  "australian shepherd": "Arbeitshunde brauchen geistige Auslastung. Die Impulskontroll-Übungen in diesem Plan sind gleichzeitig mentales Training — nutze das als tägliche Beschäftigung.",
  aussie: "Arbeitshunde brauchen geistige Auslastung. Die Impulskontroll-Übungen in diesem Plan sind gleichzeitig mentales Training — nutze das als tägliche Beschäftigung.",
  "border collie": "Arbeitshunde brauchen geistige Auslastung. Die Impulskontroll-Übungen in diesem Plan sind gleichzeitig mentales Training — nutze das als tägliche Beschäftigung.",
  dackel: "Dackel sind eigensinnig und haben einen starken eigenen Willen. Kurze Sessions (3–5 Min) funktionieren besser als lange. Geduld ist bei dieser Rasse besonders wichtig.",
  beagle: "Beagles haben eine der besten Nasen aller Hunderassen und fressen fast alles. Das ‚Zeig mir‘-Signal (Seite 6) ist für Beagles der wichtigste Teil des Plans.",
  mischling: "Jeder Mischling ist anders. Beobachte deinen Hund genau — ist er eher futtergetrieben oder eher jagdlich motiviert? Passe die Belohnungshöhe entsprechend an.",
  havaneser: "Kleine Hunde werden oft unterschätzt. Aber Giftköder am Boden sind für kleine Rassen besonders gefährlich — die toxische Dosis ist bei geringem Körpergewicht schneller erreicht.",
  havanese: "Kleine Hunde werden oft unterschätzt. Aber Giftköder am Boden sind für kleine Rassen besonders gefährlich — die toxische Dosis ist bei geringem Körpergewicht schneller erreicht.",
  "rhodesian ridgeback": "Ridgebacks sind unabhängige Denker. Das Training braucht möglicherweise mehr Wiederholungen, aber einmal gelernt sitzt es bei dieser Rasse besonders fest.",
  goldendoodle: "Doodles sind oft verspielt und leicht ablenkbar. Trainiere in ruhiger Umgebung und steigere die Ablenkung langsam.",
  husky: "Huskies sind eigenwillig und können stur wirken. Halte die Belohnung extrem hochwertig (Fleisch, Käse) und die Sessions kurz.",
};

function resolveBreedTip(breed: string): string {
  const k = breed.trim().toLowerCase();
  return (
    BREED_TIPS[k] ||
    "Das Training ist auf das individuelle Verhalten deines Hundes abgestimmt. Beobachte wie er auf die Übungen reagiert und passe die Geschwindigkeit an."
  );
}

// Kurz-Tipp pro Rasse fuer einzelne Trainings-Seiten (z. B. "Bei Beagles..." als Hinweis-Box)
const BREED_SHORT_TIPS: Record<string, string> = {
  labrador: "Bei Labradoren kann es anfangs länger dauern — Geduld. Der Moment wo dein Hund zum ersten Mal von alleine wegschaut, ist der Durchbruch.",
  "labrador retriever": "Bei Labradoren kann es anfangs länger dauern — Geduld. Der Moment wo dein Hund zum ersten Mal von alleine wegschaut, ist der Durchbruch.",
  "golden retriever": "Bei Goldens hilft draußen höherwertiges Hand-Futter — z. B. Käse oder gekochtes Hühnchen.",
  "deutscher schäferhund": "Schäferhunde brauchen klare Signale. Halte „Aus” immer in derselben Tonlage — Konsequenz macht den Unterschied.",
  schäferhund: "Schäferhunde brauchen klare Signale. Halte „Aus” immer in derselben Tonlage — Konsequenz macht den Unterschied.",
  "australian shepherd": "Aussies langweilen sich schnell. Variiere die Übungs-Reihenfolge alle 2–3 Tage, sonst schalten sie ab.",
  "border collie": "Border Collies durchschauen Muster sehr schnell. Trainiere mit kurzen, abwechslungsreichen Sessions (max. 5 Min).",
  dackel: "Bei Dackeln helfen kurze Sessions (3–5 Min) und ein hochwertiges Leckerli. Lange Übungen frustrieren die Rasse.",
  beagle: "Beagles folgen ihrer Nase — selbst gegen besseres Wissen. Das „Zeig mir”-Signal ist für diese Rasse die wichtigste Übung im Plan.",
  mischling: "Bei Mischlingen lohnt es sich besonders, die Belohnungshöhe individuell auszuprobieren. Manche reagieren auf Leckerli, andere auf Spielzeug oder Lob.",
  havaneser: "Kleine Hunde brauchen kleinere Leckerlis. Eine halbe Erbsen-Größe reicht — sonst sind sie nach 10 Wiederholungen satt.",
  havanese: "Kleine Hunde brauchen kleinere Leckerlis. Eine halbe Erbsen-Größe reicht — sonst sind sie nach 10 Wiederholungen satt.",
  "rhodesian ridgeback": "Ridgebacks sind sensibel — laute Korrekturen verbrennen das Vertrauen. Halte die Stimme ruhig und neutral.",
  goldendoodle: "Doodles sind menschenbezogen — sie wollen gefallen. Nutze das: viel Lob, viele Wiederholungen, ruhige Stimme.",
  husky: "Huskies haben einen starken Jagd- und Fressinstinkt. Trainiere konsequent an der Leine, bevor du an Freilauf denkst.",
};
function resolveBreedShortTip(breed: string): string {
  const k = breed.trim().toLowerCase();
  return (
    BREED_SHORT_TIPS[k] ||
    "Beobachte wie dein Hund auf die Übung reagiert und passe das Tempo individuell an."
  );
}

// Alter-Label (puppy/young/adult/senior – menschenlesbar)
function ageLabel(age: string | null | undefined): string {
  const a = (age || "").toLowerCase();
  if (a === "puppy" || a === "welpe") return "Welpe";
  if (a === "young" || a === "junghund") return "Junghund";
  if (a === "adult" || a === "erwachsen") return "Erwachsen";
  if (a === "senior") return "Senior";
  return "Erwachsen";
}

// ───────── PDF-Helpers ─────────

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundedRect(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: ReturnType<typeof rgb>
) {
  page.drawRectangle({ x: x + r, y, width: w - 2 * r, height: h, color });
  page.drawRectangle({ x, y: y + r, width: w, height: h - 2 * r, color });
  page.drawCircle({ x: x + r, y: y + r, size: r, color });
  page.drawCircle({ x: x + w - r, y: y + r, size: r, color });
  page.drawCircle({ x: x + r, y: y + h - r, size: r, color });
  page.drawCircle({ x: x + w - r, y: y + h - r, size: r, color });
}

const DISCLAIMER =
  "Dieses Modul trainiert präventives Verhalten und ersetzt keinen Tierarzt. Bei Verdacht auf Vergiftung sofort Tierarzt kontaktieren.";

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

function drawFooter(
  page: PDFPage,
  fonts: Fonts,
  pageNumber: number,
  totalPages: number
) {
  // Disclaimer (klein, oben am Footer)
  const dLines = wrapText(DISCLAIMER, fonts.italic, 7.5, CONTENT_W);
  let dy = 32 + dLines.length * 9;
  for (const line of dLines) {
    const w = fonts.italic.widthOfTextAtSize(line, 7.5);
    page.drawText(line, {
      x: (A4_W - w) / 2,
      y: dy,
      size: 7.5,
      font: fonts.italic,
      color: TEXT_LIGHT,
    });
    dy -= 9;
  }
  // Pfoten-Plan + Seitenzahl
  const meta = `Pfoten-Plan · Anti-Giftköder-Training · Seite ${pageNumber}/${totalPages}`;
  const mw = fonts.regular.widthOfTextAtSize(meta, 8);
  page.drawText(meta, {
    x: (A4_W - mw) / 2,
    y: 18,
    size: 8,
    font: fonts.regular,
    color: TEXT_LIGHT,
  });
  // Untere Goldlinie
  page.drawRectangle({ x: 0, y: 0, width: A4_W, height: 3, color: GOLD });
}

function newPage(doc: PDFDocument): PDFPage {
  const page = doc.addPage([A4_W, A4_H]);
  page.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
  page.drawRectangle({ x: 0, y: A4_H - 6, width: A4_W, height: 6, color: GOLD });
  return page;
}

function drawPageHeader(
  page: PDFPage,
  fonts: Fonts,
  pillText: string,
  title: string
): number {
  let y = A4_H - 60;
  // Pill (gold) — bisschen mehr Padding innen
  const pillW = fonts.bold.widthOfTextAtSize(pillText, 9) + 18;
  drawRoundedRect(page, MARGIN, y - 18, pillW, 22, 4, GOLD);
  page.drawText(pillText, {
    x: MARGIN + 9,
    y: y - 12,
    size: 9,
    font: fonts.bold,
    color: WHITE,
  });
  // Deutlich mehr Luft zwischen Pill und Titel (vorher 38, jetzt 56)
  y -= 56;
  // Titel
  const titleLines = wrapText(title, fonts.bold, 22, CONTENT_W);
  for (const line of titleLines) {
    page.drawText(line, {
      x: MARGIN,
      y,
      size: 22,
      font: fonts.bold,
      color: TEXT_DARK,
    });
    y -= 28;
  }
  y -= 12;
  page.drawRectangle({
    x: MARGIN,
    y,
    width: CONTENT_W,
    height: 1,
    color: BORDER_LIGHT,
  });
  y -= 22;
  return y;
}

function drawParagraph(
  page: PDFPage,
  fonts: Fonts,
  text: string,
  y: number,
  options: { size?: number; color?: ReturnType<typeof rgb>; font?: PDFFont; lineGap?: number } = {}
): number {
  const size = options.size ?? 11;
  const color = options.color ?? TEXT_DARK;
  const font = options.font ?? fonts.regular;
  const lineGap = options.lineGap ?? 6;
  const lines = wrapText(text, font, size, CONTENT_W);
  for (const line of lines) {
    page.drawText(line, { x: MARGIN, y, size, font, color });
    y -= size + lineGap;
  }
  return y;
}

function drawTrainerTip(
  page: PDFPage,
  fonts: Fonts,
  tipText: string,
  y: number
): number {
  const lines = wrapText(tipText, fonts.regular, 10, CONTENT_W - 32);
  const boxH = 36 + lines.length * 13;
  drawRoundedRect(page, MARGIN, y - boxH + 14, CONTENT_W, boxH, 6, BG_LIGHT);
  page.drawRectangle({
    x: MARGIN,
    y: y - boxH + 14,
    width: 3,
    height: boxH,
    color: GOLD,
  });
  page.drawText("Trainer-Tipp", {
    x: MARGIN + 14,
    y: y - 2,
    size: 10,
    font: fonts.bold,
    color: DARK_BROWN,
  });
  y -= 18;
  for (const line of lines) {
    page.drawText(line, {
      x: MARGIN + 14,
      y,
      size: 10,
      font: fonts.regular,
      color: TEXT_MEDIUM,
    });
    y -= 13;
  }
  return y - 16;
}

function drawStep(
  page: PDFPage,
  fonts: Fonts,
  n: number,
  title: string,
  desc: string,
  y: number
): number {
  page.drawCircle({ x: MARGIN + 11, y: y - 1, size: 11, color: DARK_BROWN });
  const nText = String(n);
  const nW = fonts.bold.widthOfTextAtSize(nText, 11);
  page.drawText(nText, {
    x: MARGIN + 11 - nW / 2,
    y: y - 4,
    size: 11,
    font: fonts.bold,
    color: WHITE,
  });
  page.drawText(title, {
    x: MARGIN + 30,
    y: y - 1,
    size: 12,
    font: fonts.bold,
    color: TEXT_DARK,
  });
  y -= 18;
  const descLines = wrapText(desc, fonts.regular, 10, CONTENT_W - 30);
  for (const line of descLines) {
    page.drawText(line, {
      x: MARGIN + 30,
      y,
      size: 10,
      font: fonts.regular,
      color: TEXT_DARK,
    });
    y -= 13;
  }
  return y - 12;
}

function drawInfoBox(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  text: string,
  y: number,
  bgColor = BG_WARM
): number {
  const lines = wrapText(text, fonts.regular, 10.5, CONTENT_W - 32);
  const boxH = 40 + lines.length * 14;
  drawRoundedRect(page, MARGIN, y - boxH + 16, CONTENT_W, boxH, 6, bgColor);
  page.drawRectangle({
    x: MARGIN,
    y: y - boxH + 16,
    width: 3,
    height: boxH,
    color: DARK_BROWN,
  });
  page.drawText(label, {
    x: MARGIN + 14,
    y: y - 2,
    size: 10.5,
    font: fonts.bold,
    color: DARK_BROWN,
  });
  y -= 20;
  for (const line of lines) {
    page.drawText(line, {
      x: MARGIN + 14,
      y,
      size: 10.5,
      font: fonts.regular,
      color: TEXT_MEDIUM,
    });
    y -= 14;
  }
  return y - 18;
}

// ───────── Public API ─────────

export interface AntiGiftkoederInput {
  dogName: string;
  breed: string;
  age: string;
}

export async function generateAntiGiftkoederPDF(
  input: AntiGiftkoederInput
): Promise<Uint8Array> {
  const dogName = (input.dogName || "deinen Hund").trim() || "deinen Hund";
  const breedDisplay = normalizeBreedDisplay(input.breed);
  const breedKey = (input.breed || "").trim().toLowerCase();
  const breedTipLong = resolveBreedTip(breedKey);
  const breedTipShort = resolveBreedShortTip(breedKey);
  const age = ageLabel(input.age);

  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fonts: Fonts = { regular, bold, italic };

  const TOTAL = 13;

  // Versuche das Rasse-Bild zu laden (fuer Seite 1)
  let breedImg: PDFImage | null = null;
  try {
    const breedFile = breedFileName(breedKey);
    const imgPath = join(process.cwd(), "public", "breeds", breedFile);
    if (existsSync(imgPath)) {
      const bytes = readFileSync(imgPath);
      breedImg = await doc.embedJpg(bytes);
    }
  } catch {
    // Bild-Laden fehlgeschlagen — Cover funktioniert auch ohne
  }

  // ═══════════ SEITE 1: Deckblatt ═══════════
  {
    const p = newPage(doc);
    // Logo-Wort als Header
    p.drawText("PFOTEN-PLAN", {
      x: MARGIN,
      y: A4_H - 80,
      size: 11,
      font: fonts.bold,
      color: DARK_BROWN,
    });
    p.drawRectangle({
      x: MARGIN,
      y: A4_H - 86,
      width: 60,
      height: 1.5,
      color: GOLD,
    });

    // Haupt-Titel
    const titleA = "Anti-Giftköder-";
    const titleB = `Training für ${dogName}`;
    p.drawText(titleA, {
      x: MARGIN,
      y: A4_H - 140,
      size: 28,
      font: fonts.bold,
      color: TEXT_DARK,
    });
    p.drawText(titleB, {
      x: MARGIN,
      y: A4_H - 174,
      size: 28,
      font: fonts.bold,
      color: GOLD,
    });

    // Subtitle
    p.drawText(`${breedDisplay} · ${age}`, {
      x: MARGIN,
      y: A4_H - 205,
      size: 14,
      font: fonts.regular,
      color: TEXT_MEDIUM,
    });

    // Breed-Bild (falls vorhanden)
    if (breedImg) {
      const imgW = CONTENT_W;
      const imgH = (breedImg.height / breedImg.width) * imgW;
      const imgY = A4_H - 240 - imgH;
      p.drawImage(breedImg, { x: MARGIN, y: imgY, width: imgW, height: imgH });
    }

    // Footer-Statement (oberhalb des Standard-Footers)
    const fy = breedImg ? 220 : 380;
    const stmt = `Dieser Plan ist auf das Fressverhalten und die Impulskontrolle von ${breedDisplay}-Hunden abgestimmt.`;
    const stmtLines = wrapText(stmt, fonts.italic, 11, CONTENT_W);
    let sy = fy;
    for (const l of stmtLines) {
      p.drawText(l, {
        x: MARGIN,
        y: sy,
        size: 11,
        font: fonts.italic,
        color: TEXT_MEDIUM,
      });
      sy -= 15;
    }

    // Datum
    const dateStr = new Date().toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    p.drawText(`Erstellt am ${dateStr}`, {
      x: MARGIN,
      y: sy - 18,
      size: 9.5,
      font: fonts.regular,
      color: TEXT_LIGHT,
    });

    // ─── Disclaimer-Box auf dem Deckblatt (rechtliche Absicherung) ───
    const discTitle = "Wichtiger Hinweis";
    const discBody =
      "Pfoten-Plan ist kein Tierarzt und ersetzt keine tierärztliche Beratung, Diagnose oder Behandlung. Dieses Trainingsmodul vermittelt ausschließlich präventives Verhaltens-Training. Bei Verdacht auf Vergiftung oder einer akuten Notlage kontaktiere sofort deinen Tierarzt oder den tierärztlichen Notdienst. Die Anwendung der hier beschriebenen Übungen erfolgt auf eigene Verantwortung.";
    const discLines = wrapText(discBody, fonts.regular, 8.5, CONTENT_W - 28);
    const discBoxH = 30 + discLines.length * 11;
    const discY = 60 + discBoxH; // direkt oberhalb des Standard-Footers
    drawRoundedRect(
      p,
      MARGIN,
      discY - discBoxH,
      CONTENT_W,
      discBoxH,
      5,
      BG_WARM
    );
    p.drawRectangle({
      x: MARGIN,
      y: discY - discBoxH,
      width: 3,
      height: discBoxH,
      color: DARK_BROWN,
    });
    p.drawText(discTitle, {
      x: MARGIN + 12,
      y: discY - 14,
      size: 9.5,
      font: fonts.bold,
      color: DARK_BROWN,
    });
    let dty = discY - 28;
    for (const line of discLines) {
      p.drawText(line, {
        x: MARGIN + 12,
        y: dty,
        size: 8.5,
        font: fonts.regular,
        color: TEXT_MEDIUM,
      });
      dty -= 11;
    }

    drawFooter(p, fonts, 1, TOTAL);
  }

  // ═══════════ SEITE 2: Warum dieses Training ═══════════
  {
    const p = newPage(doc);
    let y = drawPageHeader(
      p,
      fonts,
      "EINFÜHRUNG",
      "Warum dieses Training wichtig ist"
    );

    y = drawParagraph(
      p,
      fonts,
      "Hunde nehmen instinktiv alles auf, was nach Futter riecht. Im besten Fall ist es ein altes Brötchen — im schlimmsten Fall ein präparierter Köder.",
      y,
      { color: TEXT_DARK }
    );
    y -= 6;

    // Fakt-Box
    y = drawInfoBox(
      p,
      fonts,
      "Fakt",
      "In Deutschland werden jährlich Hunderte Giftköder-Fälle gemeldet. Besonders in Parks, an Waldrändern und in Wohngebieten.",
      y
    );

    // Rasse-Tipp lang
    y = drawParagraph(
      p,
      fonts,
      `Was bei ${breedDisplay} besonders zu beachten ist:`,
      y,
      { font: fonts.bold, size: 11.5 }
    );
    y -= 4;
    y = drawParagraph(p, fonts, breedTipLong, y, { color: TEXT_MEDIUM });
    y -= 8;

    // Ziel
    y = drawParagraph(p, fonts, "Ziel des Trainings", y, {
      font: fonts.bold,
      size: 11.5,
      color: DARK_BROWN,
    });
    y -= 4;
    y = drawParagraph(
      p,
      fonts,
      `Nach diesem Plan kann ${dogName} an Futter am Boden vorbeigehen, ohne es aufzunehmen — und auf dein Signal reagieren, falls es doch passiert.`,
      y,
      { color: TEXT_DARK }
    );
    y -= 8;

    // Zeitrahmen
    drawRoundedRect(p, MARGIN, y - 36, CONTENT_W, 40, 6, BG_LIGHT);
    p.drawText("Dauer", {
      x: MARGIN + 14,
      y: y - 10,
      size: 9.5,
      font: fonts.bold,
      color: DARK_BROWN,
    });
    p.drawText("4 Wochen · 5–10 Minuten täglich", {
      x: MARGIN + 14,
      y: y - 26,
      size: 13,
      font: fonts.bold,
      color: TEXT_DARK,
    });

    drawFooter(p, fonts, 2, TOTAL);
  }

  // ═══════════ SEITE 3: Aus-Signal (Woche 1, Tag 1-3) ═══════════
  {
    const p = newPage(doc);
    let y = drawPageHeader(
      p,
      fonts,
      "DEIN ERSTES SIGNAL",
      "Das „Aus” — dein wichtigstes Werkzeug"
    );

    y = drawParagraph(
      p,
      fonts,
      `Das „Aus” (oder „Nein\") ist das Abbruchsignal. Wenn ${dogName} es zuverlässig kennt, kannst du in echten Situationen reagieren — bevor etwas passiert.`,
      y,
      { color: TEXT_DARK }
    );
    y -= 8;

    y = drawStep(
      p,
      fonts,
      1,
      "Leckerli in geschlossene Faust halten",
      `Zeig ${dogName} die Faust mit dem Leckerli darin — er weiß, dass es da ist, kommt aber nicht ran.`,
      y
    );
    y = drawStep(
      p,
      fonts,
      2,
      "Warten bis er aufgibt und wegschaut",
      "Ignoriere Lecken, Pfötchen, Wuffen — kein Wort, keine Bewegung. Warte einfach.",
      y
    );
    y = drawStep(
      p,
      fonts,
      3,
      `Sofort „Aus” sagen + Leckerli aus ANDERER Hand geben`,
      "Im Moment des Wegschauens: ruhig „Aus\", dann Leckerli aus der freien Hand. Nie aus der Faust selbst.",
      y
    );
    y = drawStep(
      p,
      fonts,
      4,
      "10× wiederholen, 2× täglich",
      "Vormittag und Abend. Insgesamt 20 Wiederholungen am Tag — das sitzt nach 3 Tagen.",
      y
    );

    y -= 4;
    y = drawTrainerTip(p, fonts, breedTipShort, y);

    // Erfolgskriterium + Mini-Tracker
    y = drawInfoBox(
      p,
      fonts,
      "Erfolgskriterium",
      `${dogName} schaut bei 8 von 10 Versuchen weg.   Tag 1: ___/10   Tag 2: ___/10   Tag 3: ___/10`,
      y,
      BG_LIGHT
    );

    drawFooter(p, fonts, 3, TOTAL);
  }

  // ═══════════ SEITE 4: Boden-Futter Indoor (Woche 1, Tag 4-7) ═══════════
  {
    const p = newPage(doc);
    let y = drawPageHeader(
      p,
      fonts,
      "WAS DRINNEN ÜBEN",
      "Futter am Boden ignorieren — drinnen"
    );

    y = drawParagraph(
      p,
      fonts,
      `Jetzt kommt die Kern-Übung. ${dogName} lernt: Boden-Futter ist wertlos, Hand-Futter ist der Jackpot.`,
      y,
      { color: TEXT_DARK }
    );
    y -= 6;

    y = drawStep(
      p,
      fonts,
      1,
      "Leckerli sichtbar auf den Boden legen",
      "Wohnzimmer-Boden, ruhiger Raum, keine Ablenkung.",
      y
    );
    y = drawStep(
      p,
      fonts,
      2,
      `${dogName} an kurzer Leine daneben führen`,
      "Leine ca. 1 m. Du kontrollierst den Abstand zum Leckerli.",
      y
    );
    y = drawStep(
      p,
      fonts,
      3,
      "Sobald er zum Leckerli will: stehen bleiben, warten",
      "Kein Ziehen, kein Wort. Einfach stehen. Er muss selbst die Entscheidung treffen wegzuschauen.",
      y
    );
    y = drawStep(
      p,
      fonts,
      4,
      "Schaut zu dir – „Fein” + Leckerli aus Hand",
      "Im Moment des Blickkontakts: Belohnung aus der freien Hand.",
      y
    );
    y = drawStep(
      p,
      fonts,
      5,
      "Boden-Leckerli bleibt liegen",
      `Du hebst es am Ende auf. ${dogName} bekommt es NIE — sonst lernt er das Falsche.`,
      y
    );

    y -= 2;
    y = drawInfoBox(
      p,
      fonts,
      "Steigerung über die Tage",
      "Tag 4: Leine 1 m · Tag 5: Leine 2 m · Tag 6: ohne Leine, geschlossener Raum · Tag 7: Wiederholung mit anderem Futter.",
      y,
      BG_WARM
    );
    y = drawTrainerTip(p, fonts, breedTipShort, y);

    drawFooter(p, fonts, 4, TOTAL);
  }

  // ═══════════ SEITE 5: Boden-Futter Outdoor (Woche 2, Tag 8-11) ═══════════
  {
    const p = newPage(doc);
    let y = drawPageHeader(
      p,
      fonts,
      "WAS DRAUSSEN ÜBEN",
      "Raus in den Garten oder vor die Haustür"
    );

    y = drawParagraph(
      p,
      fonts,
      `Gleiche Übung wie Seite 4 — diesmal draußen. Mehr Ablenkung, mehr Gerüche, mehr Anspruch an ${dogName}.`,
      y,
      { color: TEXT_DARK }
    );
    y -= 6;

    y = drawStep(
      p,
      fonts,
      1,
      "Futter vorher platzieren",
      "Partner hilft, oder du legst es vor dem Spaziergang heimlich aus. Idealerweise an einer ruhigen Ecke.",
      y
    );
    y = drawStep(
      p,
      fonts,
      2,
      `${dogName} an Leine vorbeiführen`,
      "Normale Spazier-Leine, kein Schleppgeschirr — er soll merken: du bist die Verbindung.",
      y
    );
    y = drawStep(
      p,
      fonts,
      3,
      `Signal „Aus” wenn er Richtung Futter zieht`,
      "Ruhig, klar, dieselbe Tonlage wie drinnen. Kein Schreien.",
      y
    );
    y = drawStep(
      p,
      fonts,
      4,
      "Blickkontakt abwarten – belohnen",
      "Sobald er zu dir schaut: hochwertige Belohnung aus der Hand.",
      y
    );

    y -= 2;
    y = drawInfoBox(
      p,
      fonts,
      "Steigerung",
      "Tag 8: ruhiger Garten · Tag 9: vor die Haustür · Tag 10: leiserer Gehweg · Tag 11: stärkeres Boden-Futter (Wurst statt Trockenfutter).",
      y,
      BG_WARM
    );
    y = drawTrainerTip(
      p,
      fonts,
      `Draußen brauchst du höherwertiges Hand-Futter. Käse, gekochtes Hühnchen oder Wurst — etwas, das stärker zieht als das Boden-Futter.`,
      y
    );

    drawFooter(p, fonts, 5, TOTAL);
  }

  // ═══════════ SEITE 6: „Zeig mir”-Signal (Woche 2, Tag 12-14) ═══════════
  {
    const p = newPage(doc);
    let y = drawPageHeader(
      p,
      fonts,
      "DAS MELDE-SIGNAL",
      "„Zeig mir” — Futter melden statt fressen"
    );

    y = drawParagraph(
      p,
      fonts,
      `Bisher hat ${dogName} gelernt Futter zu ignorieren. Jetzt geht's einen Schritt weiter: Er soll es dir ANZEIGEN.`,
      y,
      { color: TEXT_DARK }
    );
    y -= 6;

    y = drawStep(
      p,
      fonts,
      1,
      "Futter auf Boden legen, sichtbar",
      "Wie bei der Indoor-Übung — aber jetzt schaut er dich aktiv an, weil er das gelernt hat.",
      y
    );
    y = drawStep(
      p,
      fonts,
      2,
      "Er entdeckt Futter, schaut dich an",
      "Genau dieser Moment ist gold wert.",
      y
    );
    y = drawStep(
      p,
      fonts,
      3,
      `Sofort: „Zeig mir!” – gemeinsam hingehen – er sitzt – Belohnung`,
      "Du benennst den Moment, gehst mit, lässt ihn sitzen, belohnst aus der Hand.",
      y
    );
    y = drawStep(
      p,
      fonts,
      4,
      "Du sammelst das Boden-Futter ein",
      `${dogName} bekommt es NIE — auch nicht jetzt. Hand-Futter bleibt die einzige Belohnung.`,
      y
    );

    y -= 2;
    y = drawInfoBox(
      p,
      fonts,
      "Warum das wichtig ist",
      `${dogName} lernt: Futter finden = zu dir kommen und es zeigen. Das ist sicherer als ein reines Verbot, weil der Hund aktiv mit dir zusammenarbeitet.`,
      y,
      BG_LIGHT
    );
    y = drawTrainerTip(p, fonts, breedTipShort, y);

    drawFooter(p, fonts, 6, TOTAL);
  }

  // ═══════════ SEITE 7: Impulskontrolle (Woche 3, Tag 15-18) ═══════════
  {
    const p = newPage(doc);
    let y = drawPageHeader(
      p,
      fonts,
      "IMPULSKONTROLLE",
      "Warten können — die Basis für alles"
    );

    y = drawParagraph(
      p,
      fonts,
      "Ein Hund der warten kann, frisst nicht impulsiv vom Boden. Impulskontrolle ist die Basis für alles.",
      y,
      { color: TEXT_DARK }
    );
    y -= 6;

    y = drawStep(
      p,
      fonts,
      1,
      "Futter vor die Pfoten legen",
      `${dogName} muss Blickkontakt halten — erst auf dein Signal („Nimm!\") fressen. Beginne mit 2 Sekunden, steigere auf 10.`,
      y
    );
    y = drawStep(
      p,
      fonts,
      2,
      "Futter auf der Nase balancieren",
      "Für fortgeschrittene Hunde. Erst auf Signal abwerfen und fangen. Macht Spaß, baut massive Impulskontrolle.",
      y
    );
    y = drawStep(
      p,
      fonts,
      3,
      "Tür auf — Futter draußen sichtbar",
      `${dogName} bleibt sitzen — erst auf Signal rausgehen. Das überträgt die Impulskontrolle auf den echten Spaziergang.`,
      y
    );

    y -= 2;
    y = drawInfoBox(
      p,
      fonts,
      "Warum das alles verändert",
      "Impulskontrolle ist nicht nur für Giftköder wichtig — sie ist die Basis für sicheren Rückruf, ruhige Begegnungen und stressfreie Spaziergänge.",
      y,
      BG_LIGHT
    );
    y = drawTrainerTip(p, fonts, breedTipShort, y);

    drawFooter(p, fonts, 7, TOTAL);
  }

  // ═══════════ SEITE 8: Realsituation Spaziergang (Woche 3, Tag 19-21) ═══════════
  {
    const p = newPage(doc);
    let y = drawPageHeader(
      p,
      fonts,
      "DIE REALSITUATION",
      "Der echte Spaziergang"
    );

    y = drawParagraph(
      p,
      fonts,
      "Jetzt simulierst du echte Bedingungen. Dein Hund weiß nicht, wo das Futter liegt — du schon.",
      y,
      { color: TEXT_DARK }
    );
    y -= 6;

    y = drawStep(
      p,
      fonts,
      1,
      "Partner platziert 3 Futterstücke auf der Route",
      "Mit Kreide-Markierung für dich (oder GPS-Pin), damit du weißt wo. Niedriges Futter zuerst — Trockenes.",
      y
    );
    y = drawStep(
      p,
      fonts,
      2,
      "Normale Gassirunde starten",
      `${dogName} weiß von nichts. Geh normal, achte aber auf die Markierungen.`,
      y
    );
    y = drawStep(
      p,
      fonts,
      3,
      `Bei Futter-Entdeckung: „Aus” — Blickkontakt — belohnen`,
      "Wenn er auf dich schaut: Jackpot. Mehrere kleine Leckerlis + überschwängliches Lob.",
      y
    );
    y = drawStep(
      p,
      fonts,
      4,
      "Wenn er aktiv anzeigt: GROSSER Jackpot",
      `Wenn ${dogName} ohne Aufforderung „Zeig mir” macht: das ist der Goldstandard. Riesen-Lob.`,
      y
    );

    y -= 2;
    y = drawInfoBox(
      p,
      fonts,
      "Wenn er doch frisst",
      "KEIN Schimpfen. Ruhig das Futter aus dem Maul nehmen (wenn sicher möglich), kurz Pause machen, dann neu starten. Rückschritte sind normal und gehören zum Lernprozess.",
      y,
      BG_WARM
    );

    drawFooter(p, fonts, 8, TOTAL);
  }

  // ═══════════ SEITE 9: Ablenkung unter Stress (Woche 4, Tag 22-25) ═══════════
  {
    const p = newPage(doc);
    let y = drawPageHeader(
      p,
      fonts,
      "UNTER STRESS",
      "Wenn es schwierig wird — Ablenkung trainieren"
    );

    y = drawParagraph(
      p,
      fonts,
      "Drei harte Szenarien — wenn es hier sitzt, sitzt es überall.",
      y,
      { color: TEXT_DARK }
    );
    y -= 6;

    y = drawStep(
      p,
      fonts,
      1,
      "Futter + anderer Hund in Sichtweite",
      `Doppelte Ablenkung. ${dogName} muss zwischen zwei Reizen widerstehen. Starte mit großer Distanz.`,
      y
    );
    y = drawStep(
      p,
      fonts,
      2,
      "Futter an einer aufregenden Stelle",
      "Parkeingang, Hundespielwiese, da wo er normalerweise hochgeht. Hier ist die Versuchung am größten.",
      y
    );
    y = drawStep(
      p,
      fonts,
      3,
      "Futter in Bewegung",
      `Rollendes Leckerli triggert den Jagdinstinkt. ${dogName} muss lernen: auch was sich bewegt darf er nicht aufnehmen.`,
      y
    );

    y -= 2;
    y = drawInfoBox(
      p,
      fonts,
      "Erfolgskriterium für Woche 4",
      `${dogName} ignoriert in 9 von 10 Fällen — auch bei Ablenkung. Wenn das sitzt, ist der Plan erfolgreich.`,
      y,
      BG_LIGHT
    );
    y = drawTrainerTip(p, fonts, breedTipShort, y);

    drawFooter(p, fonts, 9, TOTAL);
  }

  // ═══════════ SEITE 10: Ohne Leine (Woche 4, Tag 26-28) ═══════════
  {
    const p = newPage(doc);
    let y = drawPageHeader(
      p,
      fonts,
      "MIT FREILAUF",
      "Ohne Leine — Freilauf mit Sicherheit"
    );

    y = drawInfoBox(
      p,
      fonts,
      "Voraussetzung",
      `Nur wenn ${dogName} an der Leine 9 von 10 Futterstellen ignoriert. Sonst: noch nicht — eine Woche mehr an der Schleppleine ist kein Verlust.`,
      y,
      BG_WARM
    );

    y = drawStep(
      p,
      fonts,
      1,
      "Schleppleine 5 m — Futter ignorieren",
      "Du hast noch die Kontrolle, er fühlt sich aber freier.",
      y
    );
    y = drawStep(
      p,
      fonts,
      2,
      "Schleppleine 10 m — gleiche Übung",
      "Mehr Distanz, mehr Anspruch an die Selbstkontrolle.",
      y
    );
    y = drawStep(
      p,
      fonts,
      3,
      "Schleppleine schleifen lassen",
      "Sicherheits-Netz dran, aber er fühlt sich frei. Mentaler Übergang.",
      y
    );
    y = drawStep(
      p,
      fonts,
      4,
      "Ohne Leine — kurze Strecke — vorplatziertes Futter",
      "Sicheres Gebiet (Hundewiese, eingezäunter Garten). Nur kurze Sequenzen.",
      y
    );

    y -= 2;
    y = drawInfoBox(
      p,
      fonts,
      "Sicherheitshinweis",
      "Im Zweifelsfall: Leine dran. Ein Rückfall ohne Leine kann das bisherige Training gefährden. Lieber einen Tag länger an der Schleppleine als zu früh lösen.",
      y,
      BG_WARM
    );

    drawFooter(p, fonts, 10, TOTAL);
  }

  // ═══════════ SEITE 11: Notfall-Szenarien (5 typische Situationen) ═══════════
  {
    const p = newPage(doc);
    let y = drawPageHeader(
      p,
      fonts,
      "NOTFALL-SZENARIEN",
      "Wenn doch etwas passiert — typische Situationen"
    );

    y = drawParagraph(
      p,
      fonts,
      `Du kannst nicht jeden Köder verhindern. Aber du kannst dich auf die Situationen vorbereiten, in denen ${dogName} am wahrscheinlichsten etwas aufnimmt. Für jedes Szenario hier: was du sofort tust.`,
      y
    );
    y -= 8;

    const scenarios: Array<{ n: number; title: string; desc: string }> = [
      {
        n: 1,
        title: "Auf dem Spaziergang — Essensreste am Boden",
        desc:
          "Ein Brötchen, eine Wurstscheibe, etwas Unbekanntes — kommt fast täglich vor. Sofort „Aus”. Wenn er ausgespuckt hat: Foto vom Objekt, Probe in einen Beutel. Tierarzt informieren, auch wenn er fit wirkt. Manche Stoffe wirken verzögert.",
      },
      {
        n: 2,
        title: "Obst-Reste / Trauben im Park oder Wald",
        desc:
          "Manche Obstsorten sind für Hunde problematisch — die genaue Liste klärst du am besten mit deinem Tierarzt ab. Sofort: Maul checken, Reste sichern. Standort merken (was wuchs da, welche Farbe). Tierarzt anrufen mit der Info — die wissen, ob Eile geboten ist.",
      },
      {
        n: 3,
        title: "Picknick, Café, Restaurant — menschliches Essen",
        desc:
          "Käse, Schokolade, Süßes, Reste vom Teller. Sofort: Maul prüfen, Reste rausnehmen wenn sicher möglich. Nicht versuchen Erbrechen auszulösen ohne tierärztliche Anweisung. Tierarzt-Anruf — die entscheiden, was nötig ist.",
      },
      {
        n: 4,
        title: "Zuhause — Mülleimer, Tüten, Hausapotheke",
        desc:
          "Tabletten am Boden, alte Lebensmittel, eine vergessene Tüte. Sofort: was war da? Welche Verpackung? Tabletten-Packung mitnehmen wenn er an die Hausapotheke kam — der Tierarzt braucht den Wirkstoffnamen.",
      },
      {
        n: 5,
        title: "Du weißt nicht WAS er aufgenommen hat",
        desc:
          "Wichtigster Fall — schnell handeln statt rätseln. Maul checken, Boden absuchen, Foto vom Ort. Tierarzt sofort anrufen und Standort + Beobachtung schildern. Lieber einmal zu früh anrufen als zu spät.",
      },
    ];

    for (const s of scenarios) {
      y = drawStep(p, fonts, s.n, s.title, s.desc, y);
    }

    drawFooter(p, fonts, 11, TOTAL);
  }

  // ═══════════ SEITE 12: Akut-Protokoll + Notfall-Kontakte ═══════════
  {
    const p = newPage(doc);
    let y = drawPageHeader(
      p,
      fonts,
      "AKUT-PROTOKOLL",
      "Die 5 Schritte im Ernstfall"
    );

    y = drawParagraph(
      p,
      fonts,
      `Egal welches Szenario — diese fünf Schritte gelten immer. In dieser Reihenfolge.`,
      y
    );
    y -= 8;

    y = drawStep(
      p,
      fonts,
      1,
      "Ruhe bewahren",
      "Nicht schreien. Panik überträgt sich auf den Hund und verstärkt das Schlucken.",
      y
    );
    y = drawStep(
      p,
      fonts,
      2,
      `„Aus”-Signal geben`,
      `Wenn ${dogName} es trainiert hat, funktioniert es jetzt. Genau dafür übst du.`,
      y
    );
    y = drawStep(
      p,
      fonts,
      3,
      "Maul vorsichtig öffnen, Futter entfernen",
      "Nur wenn sicher möglich (kleine Hunde, ruhiger Hund). Bei großen oder aufgeregten Hunden: nicht erzwingen.",
      y
    );
    y = drawStep(
      p,
      fonts,
      4,
      "Futter sichern",
      "Foto machen, Probe in einen Beutel, Verpackung mitnehmen. Hilft dem Tierarzt enorm bei der Einschätzung.",
      y
    );
    y = drawStep(
      p,
      fonts,
      5,
      "SOFORT Tierarzt anrufen",
      "Nicht warten. Auch wenn der Hund noch keine Symptome zeigt — Zeit ist hier alles. Manche Stoffe wirken erst nach Stunden.",
      y
    );

    y -= 4;
    // Notfall-Kontakt-Box zum Ausfuellen
    drawRoundedRect(p, MARGIN, y - 120, CONTENT_W, 120, 6, BG_LIGHT);
    p.drawRectangle({
      x: MARGIN,
      y: y - 120,
      width: 3,
      height: 120,
      color: DARK_BROWN,
    });
    p.drawText("Deine Notfall-Kontakte — JETZT ausfüllen", {
      x: MARGIN + 14,
      y: y - 14,
      size: 10.5,
      font: fonts.bold,
      color: DARK_BROWN,
    });
    const contacts = [
      "Mein Tierarzt:                                 Tel:",
      "Nächste Tierklinik:                          Tel:",
      "Tierärztlicher Notdienst:                Tel:",
      "Giftnotruf:                                            Tel:",
    ];
    let cy = y - 36;
    for (const c of contacts) {
      p.drawText(c, {
        x: MARGIN + 14,
        y: cy,
        size: 9.5,
        font: fonts.regular,
        color: TEXT_DARK,
      });
      p.drawLine({
        start: { x: MARGIN + 14, y: cy - 4 },
        end: { x: MARGIN + CONTENT_W - 14, y: cy - 4 },
        thickness: 0.5,
        color: BORDER_LIGHT,
      });
      cy -= 19;
    }

    y = cy - 14;
    p.drawText("Tipp: Fülle diese Box jetzt aus und häng sie an deinen Kühlschrank.", {
      x: MARGIN,
      y,
      size: 9.5,
      font: fonts.italic,
      color: TEXT_MEDIUM,
    });

    drawFooter(p, fonts, 12, TOTAL);
  }

  // ═══════════ SEITE 13: 4-Wochen-Tracker ═══════════
  {
    const p = newPage(doc);
    let y = drawPageHeader(
      p,
      fonts,
      "ÜBERBLICK",
      "Dein 4-Wochen-Tracker"
    );

    y = drawParagraph(
      p,
      fonts,
      `Hak jeden Tag ab, an dem du trainiert hast. Trag am Wochenende deine Erfolgsrate ein — so siehst du die Veränderung von ${dogName} Schritt für Schritt.`,
      y,
      { color: TEXT_DARK }
    );
    y -= 10;

    const weeks = [
      "Woche 1 · Aus-Signal + Indoor",
      "Woche 2 · Outdoor + Zeig mir",
      "Woche 3 · Impulskontrolle + echter Spaziergang",
      "Woche 4 · Ablenkung + Freilauf-Übergang",
    ];

    for (let w = 0; w < 4; w++) {
      p.drawText(weeks[w], {
        x: MARGIN,
        y,
        size: 11,
        font: fonts.bold,
        color: DARK_BROWN,
      });
      y -= 14;

      // 7 Tag-Boxen pro Woche
      const boxSize = 22;
      const gap = 6;
      const totalBoxW = 7 * boxSize + 6 * gap;
      const startX = MARGIN + (CONTENT_W - totalBoxW) / 2;
      for (let d = 0; d < 7; d++) {
        const x = startX + d * (boxSize + gap);
        p.drawRectangle({
          x,
          y: y - boxSize,
          width: boxSize,
          height: boxSize,
          borderColor: BORDER_LIGHT,
          borderWidth: 1,
        });
        const dayNum = String(w * 7 + d + 1);
        const dnW = fonts.regular.widthOfTextAtSize(dayNum, 8);
        p.drawText(dayNum, {
          x: x + (boxSize - dnW) / 2,
          y: y - 8,
          size: 8,
          font: fonts.regular,
          color: TEXT_LIGHT,
        });
      }
      y -= boxSize + 6;
      p.drawText(
        `Erfolgsrate: ___/10 Futterstellen ignoriert`,
        {
          x: MARGIN,
          y,
          size: 9.5,
          font: fonts.italic,
          color: TEXT_MEDIUM,
        }
      );
      y -= 22;
    }

    y -= 6;
    y = drawInfoBox(
      p,
      fonts,
      "Geschafft",
      `Wenn ${dogName} nach 4 Wochen zuverlässig Futter am Boden ignoriert, hast du ihm die wichtigste Schutzübung beigebracht, die es gibt. Weiter so.`,
      y,
      BG_LIGHT
    );

    p.drawText(
      "Trag deine Ergebnisse zusätzlich ins Trainings-Tagebuch ein (Mitglieder-Bereich).",
      {
        x: MARGIN,
        y,
        size: 9,
        font: fonts.italic,
        color: TEXT_LIGHT,
      }
    );

    drawFooter(p, fonts, 13, TOTAL);
  }

  return doc.save();
}

// Hilfsfunktion: Map breed -> Datei im /public/breeds/-Ordner
function breedFileName(breedKey: string): string {
  const m: Record<string, string> = {
    labrador: "Labrador-Retriever.jpg",
    "labrador retriever": "Labrador-Retriever.jpg",
    "golden retriever": "Golden-Retriever.jpg",
    "deutscher schäferhund": "German-Shepard.jpg",
    schäferhund: "German-Shepard.jpg",
    "german shepherd": "German-Shepard.jpg",
    "australian shepherd": "Australian-Shepherd.jpg",
    aussie: "Australian-Shepherd.jpg",
    "border collie": "Border-Collie.jpg",
    dackel: "Dackel.jpg",
    goldendoodle: "Goldendoodle.jpg",
    havaneser: "Havanese.jpg",
    havanese: "Havanese.jpg",
    mischling: "Mischling.jpg",
  };
  return m[breedKey] || "Allgemein.jpg";
}
