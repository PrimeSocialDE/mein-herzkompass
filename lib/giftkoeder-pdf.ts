// lib/giftkoeder-pdf.ts
//
// Rendert das Handbuch "Nichts vom Boden" (Content aus giftkoeder-content.ts)
// als A4-PDF via pdf-lib.
//
// DESIGN: bewusst dieselbe Sprache wie der Haupt-Plan und die Zusatzmodule
// (generate-plan-from-content.mjs / generate-zusatzmodul-pdf.mjs): A4 quer,
// Sand-Hintergrund, Tan-Banner mit Pfote und Wortmarke, Titel mit goldenem
// Unterstrich, Pills statt Kaesten, goldene Nummernkreise. Die Hilfsfunktionen
// sind von dort uebernommen, damit das Heft neben den anderen PDFs nicht wie
// ein Fremdkoerper aussieht.
//
// Besonderheit: die Notfall-Seite ist rot gesetzt und steht eigenstaendig da.
// Giftkoeder sind ein Gesundheitsrisiko — das Training beugt vor, es ersetzt
// keinen Tierarzt.

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from "pdf-lib";
import type { GiftkoederContent } from "./giftkoeder-content";

const A4_W = 841.89;
const A4_H = 595.28;
const BANNER_H = 55;
const MARGIN = 60;
const CONTENT_W = A4_W - 2 * MARGIN;
const TEXT_W = 660; // Zeilenlaenge begrenzen — quer ist die Seite breiter als lesbar
const BOTTOM = 56;

// Brand-Farben, 1:1 aus generate-plan-from-content.mjs
const BANNER_TAN = rgb(255 / 255, 227 / 255, 180 / 255);
const GOLD = rgb(196 / 255, 165 / 255, 118 / 255);
const GOLD_DARK = rgb(139 / 255, 115 / 255, 85 / 255);
const GOLD_SOFT = rgb(255 / 255, 227 / 255, 180 / 255);
const DARK_BROWN = rgb(36 / 255, 23 / 255, 20 / 255);
const TEXT_DARK = rgb(26 / 255, 26 / 255, 26 / 255);
const TEXT_MEDIUM = rgb(80 / 255, 80 / 255, 80 / 255);
const TEXT_LIGHT = rgb(150 / 255, 150 / 255, 150 / 255);
const WHITE = rgb(1, 1, 1);
const BG_CREAM = rgb(250 / 255, 245 / 255, 235 / 255);
const BG_BAR = rgb(240 / 255, 230 / 255, 210 / 255);
const WARN_RED = rgb(199 / 255, 73 / 255, 60 / 255);
const PILL_BG_GREEN = rgb(232 / 255, 244 / 255, 230 / 255);
const PILL_AC_GREEN = rgb(70 / 255, 145 / 255, 80 / 255);
const PILL_BG_RED = rgb(252 / 255, 230 / 255, 226 / 255);
const PILL_BG_GOLD = rgb(248 / 255, 240 / 255, 222 / 255);

// pdf-lib StandardFonts koennen nur WinAnsi -> Sonderzeichen ersetzen/strippen.
const S = (t: any): string =>
  String(t == null ? "" : t)
    .replace(/[‘’‚‹›]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•●·]/g, "-")
    .replace(/→/g, "->")
    .replace(/ /g, " ")
    .replace(/[^\x00-\xFF]/g, "")
    .trim();

function wrap(t: string, f: PDFFont, s: number, mw: number): string[] {
  const out: string[] = [];
  for (const para of S(t).split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/)) {
      const test = line ? line + " " + w : w;
      if (f.widthOfTextAtSize(test, s) > mw && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    out.push(line);
  }
  return out.filter((l) => l.length);
}

function roundedRect(p: PDFPage, x: number, y: number, w: number, h: number, r: number, color: any) {
  if (r > w / 2) r = w / 2;
  if (r > h / 2) r = h / 2;
  p.drawRectangle({ x: x + r, y, width: w - 2 * r, height: h, color });
  p.drawRectangle({ x, y: y + r, width: w, height: h - 2 * r, color });
  p.drawCircle({ x: x + r, y: y + r, size: r, color });
  p.drawCircle({ x: x + w - r, y: y + r, size: r, color });
  p.drawCircle({ x: x + r, y: y + h - r, size: r, color });
  p.drawCircle({ x: x + w - r, y: y + h - r, size: r, color });
}

function drawPaw(p: PDFPage, cx: number, cy: number, scale = 1, color: any = GOLD) {
  const pad = 7 * scale;
  const toe = 3.5 * scale;
  p.drawEllipse({ x: cx, y: cy - pad * 0.3, xScale: pad, yScale: pad * 0.85, color });
  p.drawCircle({ x: cx - pad * 1.05, y: cy + pad * 0.7, size: toe, color });
  p.drawCircle({ x: cx - pad * 0.4, y: cy + pad * 1.2, size: toe * 1.1, color });
  p.drawCircle({ x: cx + pad * 0.4, y: cy + pad * 1.2, size: toe * 1.1, color });
  p.drawCircle({ x: cx + pad * 1.05, y: cy + pad * 0.7, size: toe, color });
}

function drawCornerSwooshes(p: PDFPage) {
  const opts = { borderColor: GOLD_SOFT, borderWidth: 1.2 };
  p.drawSvgPath("M 0 0 C 25 -4, 50 4, 60 26 S 55 64, 28 60 S -8 42, 0 26", {
    x: A4_W - 60,
    y: A4_H - BANNER_H - 18,
    ...opts,
  });
  p.drawSvgPath("M 0 0 C 12 -2, 24 4, 26 16 S 18 32, 6 26", { x: A4_W - 90, y: A4_H - BANNER_H - 60, ...opts });
  p.drawSvgPath("M 0 0 C -8 -2, -20 6, -22 22 S -10 38, 6 30", { x: 30, y: A4_H - BANNER_H - 30, ...opts });
  p.drawSvgPath("M 0 0 C 25 -4, 50 4, 60 26 S 55 64, 28 60 S -8 42, 0 26", { x: A4_W - 60, y: 60, ...opts });
  p.drawSvgPath("M 0 0 C -8 4, -16 14, -10 26 S 10 34, 18 26", { x: 30, y: 40, ...opts });
}

export async function buildGiftkoederPDF(
  content: GiftkoederContent,
  meta: { breed?: string | null } = {}
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const F = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };

  // Logo aus pdf-assets (wie die anderen Generatoren). Wenn es im Lambda nicht
  // liegt, zeichnen wir die Pfote als Vektor — die Auslieferung eines Kaufs
  // darf nicht an einer Bilddatei scheitern.
  let logo: PDFImage | null = null;
  try {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    logo = await doc.embedPng(readFileSync(join(process.cwd(), "pdf-assets", "logo.png")));
  } catch {
    logo = null;
  }

  const dog = S(content.dogName || "dein Hund");
  const breed = S(meta.breed || "");

  // x/w wandern mit, damit dieselben Bausteine auch in einer schmalen Spalte
  // funktionieren — die Uebungsseiten sind zweispaltig gesetzt.
  const st = { p: null as unknown as PDFPage, y: 0, x: MARGIN, w: TEXT_W };
  const spalte = (x: number, w: number) => {
    st.x = x;
    st.w = w;
  };
  const vollBreite = () => spalte(MARGIN, TEXT_W);

  const seitenGrundlage = (p: PDFPage) => {
    p.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: BG_CREAM });
    drawCornerSwooshes(p);
    // Banner
    p.drawRectangle({ x: 0, y: A4_H - BANNER_H, width: A4_W, height: BANNER_H, color: BANNER_TAN });
    const label = "PfotenPlan";
    const labelSize = 15;
    const labelW = F.bold.widthOfTextAtSize(label, labelSize);
    const logoSize = 24;
    const gap = 10;
    const startX = (A4_W - (logoSize + gap + labelW)) / 2;
    if (logo) {
      p.drawImage(logo, { x: startX, y: A4_H - BANNER_H / 2 - logoSize / 2, width: logoSize, height: logoSize });
    } else {
      drawPaw(p, startX + logoSize / 2, A4_H - BANNER_H / 2 - 3, 0.85, DARK_BROWN);
    }
    p.drawText(label, {
      x: startX + logoSize + gap,
      y: A4_H - BANNER_H / 2 - labelSize / 2 + 2,
      size: labelSize,
      font: F.bold,
      color: DARK_BROWN,
    });
  };

  const newPage = () => {
    st.p = doc.addPage([A4_W, A4_H]);
    seitenGrundlage(st.p);
    st.y = A4_H - BANNER_H - 60;
  };
  const ensure = (h: number) => {
    if (st.y - h < BOTTOM) newPage();
  };
  const gap = (h: number) => {
    st.y -= h;
  };

  // ---------- Bausteine ----------
  const sectionTitle = (title: string, size = 26) => {
    // Nicht am Seitenanfang? Dann vorher Luft lassen, sonst klebt die
    // Ueberschrift am Absatz darueber.
    if (st.y < A4_H - BANNER_H - 70) st.y -= 14;
    ensure(size + 34);
    let s = size;
    while (F.bold.widthOfTextAtSize(S(title), s) > st.w && s > 15) s -= 1;
    st.p.drawText(S(title), { x: st.x, y: st.y, size: s, font: F.bold, color: DARK_BROWN });
    const underlineW = Math.min(220, F.bold.widthOfTextAtSize(S(title), s) * 0.45);
    st.p.drawRectangle({ x: st.x, y: st.y - 10, width: underlineW, height: 2, color: GOLD });
    st.y -= s + 22;
  };

  const absatz = (
    text: string,
    o: { size?: number; font?: PDFFont; color?: any; gapAfter?: number; width?: number } = {}
  ) => {
    const size = o.size ?? 12.5;
    const font = o.font ?? F.regular;
    const color = o.color ?? TEXT_DARK;
    const lineGap = size + 6;
    for (const ln of wrap(text, font, size, o.width ?? st.w)) {
      ensure(lineGap);
      st.p.drawText(ln, { x: st.x, y: st.y, size, font, color });
      st.y -= lineGap;
    }
    st.y -= o.gapAfter ?? 8;
  };

  // Label-Chip wie "Woche 2" im Haupt-Plan
  const chip = (label: string, size = 20) => {
    const txtW = F.bold.widthOfTextAtSize(S(label), size);
    const padX = 14;
    const padY = 7;
    const boxH = size + padY * 2;
    ensure(boxH + 16);
    roundedRect(st.p, st.x, st.y - boxH, txtW + padX * 2, boxH, 4, BG_BAR);
    st.p.drawText(S(label), { x: st.x + padX, y: st.y - boxH + padY + 2, size, font: F.bold, color: DARK_BROWN });
    st.y -= boxH + 16;
  };

  // Farbcodierte Pill als Zwischenueberschrift
  const pill = (label: string, accent: any, bg: any, gapBelow = 12) => {
    const size = 11;
    const padX = 14;
    const padY = 7;
    const w = padX * 2 + F.bold.widthOfTextAtSize(S(label), size);
    const h = size + padY * 2;
    ensure(h + gapBelow + 20);
    roundedRect(st.p, st.x, st.y - h, w, h, 4, bg);
    st.p.drawRectangle({ x: st.x + 4, y: st.y - h + 6, width: 2.5, height: h - 12, color: accent });
    st.p.drawText(S(label), { x: st.x + padX, y: st.y - h + padY + 1, size, font: F.bold, color: DARK_BROWN });
    st.y -= h + gapBelow;
  };

  const pfeilPunkt = (text: string, size = 12.5) => {
    const lineGap = size + 5;
    const arrowW = F.bold.widthOfTextAtSize("->", size);
    const lines = wrap(text, F.regular, size, st.w - (arrowW + 10));
    ensure(lines.length * lineGap + 4);
    st.p.drawText("->", { x: st.x, y: st.y, size, font: F.bold, color: GOLD_DARK });
    let ty = st.y;
    for (const ln of lines) {
      st.p.drawText(ln, { x: st.x + arrowW + 10, y: ty, size, font: F.regular, color: TEXT_DARK });
      ty -= lineGap;
    }
    st.y = ty - 4;
  };

  const nummerSchritt = (n: number, text: string, size = 12.5) => {
    const lineGap = size + 5;
    const r = 11;
    const lines = wrap(text, F.regular, size, st.w - (r * 2 + 12));
    ensure(Math.max(lines.length * lineGap, r * 2 + 4) + 8);
    const cx = st.x + r;
    const cy = st.y + size * 0.32; // Kreismitte auf die erste Textzeile
    st.p.drawCircle({ x: cx, y: cy, size: r, color: GOLD });
    const num = String(n);
    const numSize = 12;
    const nw = F.bold.widthOfTextAtSize(num, numSize);
    st.p.drawText(num, { x: cx - nw / 2, y: cy - numSize * 0.34, size: numSize, font: F.bold, color: WHITE });
    let ty = st.y;
    for (const ln of lines) {
      st.p.drawText(ln, { x: st.x + r * 2 + 12, y: ty, size, font: F.regular, color: TEXT_DARK });
      ty -= lineGap;
    }
    st.y = ty - 8;
  };

  const hakenPunkt = (text: string, size = 12.5) => {
    const lineGap = size + 5;
    const lines = wrap(text, F.regular, size, st.w - 26);
    ensure(lines.length * lineGap + 6);
    const cx = st.x + 5;
    const cy = st.y + size * 0.32;
    st.p.drawLine({ start: { x: cx - 4, y: cy - 1 }, end: { x: cx - 1, y: cy - 5 }, thickness: 2.2, color: GOLD_DARK });
    st.p.drawLine({ start: { x: cx - 1, y: cy - 5 }, end: { x: cx + 6, y: cy + 5 }, thickness: 2.2, color: GOLD_DARK });
    let ty = st.y;
    for (const ln of lines) {
      st.p.drawText(ln, { x: st.x + 24, y: ty, size, font: F.regular, color: TEXT_DARK });
      ty -= lineGap;
    }
    st.y = ty - 5;
  };

  const warnPunkt = (text: string, size = 12.5) => {
    const lineGap = size + 5;
    const lines = wrap(text, F.regular, size, st.w - 26);
    ensure(lines.length * lineGap + 6);
    const cx = st.x + 7;
    const cy = st.y + size * 0.32;
    const tri = 7;
    st.p.drawSvgPath(`M 0 -${tri} L -${tri} ${tri * 0.6} L ${tri} ${tri * 0.6} Z`, {
      x: cx,
      y: cy + tri * 0.4,
      color: WARN_RED,
      borderColor: WARN_RED,
      borderWidth: 0.5,
    });
    st.p.drawText("!", { x: cx - 1.5, y: cy - tri * 0.45, size: 9, font: F.regular, color: WHITE });
    let ty = st.y;
    for (const ln of lines) {
      st.p.drawText(ln, { x: st.x + 24, y: ty, size, font: F.regular, color: TEXT_DARK });
      ty -= lineGap;
    }
    st.y = ty - 5;
  };

  // Kleine Zwischenueberschrift (ohne Pill), z.B. Uebungstitel
  const unterTitel = (text: string, size = 17) => {
    const lines = wrap(text, F.bold, size, st.w);
    ensure(lines.length * (size + 6) + 10);
    for (const ln of lines) {
      st.p.drawText(ln, { x: st.x, y: st.y, size, font: F.bold, color: DARK_BROWN });
      st.y -= size + 6;
    }
    st.y -= 8;
  };

  // "Das brauchst du: ..." — Label fett, Text laeuft in derselben Zeile weiter.
  // Spart gegenueber einer eigenen Pill rund 40 Punkt Hoehe, und genau die
  // fehlten der rechten Spalte.
  const inlineLabel = (label: string, text: string, size = 12, breite = 700) => {
    const lg = size + 6;
    const labelW = F.bold.widthOfTextAtSize(S(label), size) + 6;
    const ersteZeile = wrap(text, F.regular, size, breite - labelW).slice(0, 1)[0] || "";
    const rest = S(text).slice(ersteZeile.length).trim();
    ensure(lg * 2);
    st.p.drawText(S(label), { x: st.x, y: st.y, size, font: F.bold, color: DARK_BROWN });
    st.p.drawText(ersteZeile, { x: st.x + labelW, y: st.y, size, font: F.regular, color: TEXT_DARK });
    st.y -= lg;
    for (const ln of wrap(rest, F.regular, size, breite)) {
      ensure(lg);
      st.p.drawText(ln, { x: st.x, y: st.y, size, font: F.regular, color: TEXT_DARK });
      st.y -= lg;
    }
  };

  // Icon + fettes Label + Text. Ersetzt in der schmalen Spalte die Pills:
  // vier Pills kosteten ueber 100 Punkt Hoehe, die der Seite dann fehlten.
  const punktBlock = (
    icon: "punkt" | "haken" | "warnung",
    label: string,
    text: string,
    size = 11.5,
    gapAfter = 14
  ) => {
    const lg = size + 5.5;
    const ein = 20; // Textspalte neben dem Icon
    const labelW = F.bold.widthOfTextAtSize(S(label), size) + 5;
    const ersteBreite = st.w - ein - labelW;
    const erste = wrap(text, F.regular, size, ersteBreite)[0] || "";
    const rest = S(text).slice(erste.length).trim();
    const restZeilen = wrap(rest, F.regular, size, st.w - ein);
    ensure((restZeilen.length + 1) * lg + gapAfter);

    const cy = st.y + size * 0.32;
    if (icon === "haken") {
      const cx = st.x + 5;
      st.p.drawLine({ start: { x: cx - 4, y: cy - 1 }, end: { x: cx - 1, y: cy - 5 }, thickness: 2.2, color: PILL_AC_GREEN });
      st.p.drawLine({ start: { x: cx - 1, y: cy - 5 }, end: { x: cx + 6, y: cy + 5 }, thickness: 2.2, color: PILL_AC_GREEN });
    } else if (icon === "warnung") {
      const cx = st.x + 7;
      const tri = 6.5;
      st.p.drawSvgPath(`M 0 -${tri} L -${tri} ${tri * 0.6} L ${tri} ${tri * 0.6} Z`, {
        x: cx,
        y: cy + tri * 0.4,
        color: WARN_RED,
        borderColor: WARN_RED,
        borderWidth: 0.5,
      });
      st.p.drawText("!", { x: cx - 1.5, y: cy - tri * 0.45, size: 8.5, font: F.regular, color: WHITE });
    } else {
      drawPaw(st.p, st.x + 6, cy - 1, 0.42, GOLD);
    }

    st.p.drawText(S(label), { x: st.x + ein, y: st.y, size, font: F.bold, color: DARK_BROWN });
    st.p.drawText(erste, { x: st.x + ein + labelW, y: st.y, size, font: F.regular, color: TEXT_DARK });
    st.y -= lg;
    for (const ln of restZeilen) {
      ensure(lg);
      st.p.drawText(ln, { x: st.x + ein, y: st.y, size, font: F.regular, color: TEXT_DARK });
      st.y -= lg;
    }
    st.y -= gapAfter;
  };

  const sec = (k: string) => content.sections.find((x: any) => x?.key === k);
  const uebungen = content.sections.filter((x: any) => x?.key === "uebung") as any[];
  const stufen = Array.from(new Set(uebungen.map((u) => S(u.stufe)).filter(Boolean)));

  // ---------- COVER ----------
  newPage();
  st.y = A4_H - BANNER_H - 85;
  st.p.drawText("TRAININGS-HANDBUCH", { x: MARGIN, y: st.y, size: 11, font: F.bold, color: GOLD_DARK });
  st.y -= 34;
  st.p.drawText("Nichts vom Boden", { x: MARGIN, y: st.y, size: 38, font: F.bold, color: DARK_BROWN });
  st.p.drawRectangle({ x: MARGIN, y: st.y - 12, width: 215, height: 2.5, color: GOLD });
  st.y -= 40;
  st.p.drawText("Anti-Giftköder-Training in " + uebungen.length + " Übungen", {
    x: MARGIN,
    y: st.y,
    size: 17,
    font: F.bold,
    color: GOLD_DARK,
  });
  st.y -= 30;
  // Opus stellt dem Untertitel gern den Produktnamen voran — der steht zwei
  // Zeilen darueber schon.
  const untertitel = S(content.subtitle || "")
    .replace(/^\s*Nichts vom Boden\s*[-:]\s*/i, "")
    .replace(/^\s*Anti-Giftk(ö|oe)der-Training\s*[-:,]?\s*/i, "")
    .replace(/^./, (c) => c.toUpperCase()) ||
    "Vom Küchentisch bis zum Laubhaufen - Schritt für Schritt";
  for (const ln of wrap(untertitel, F.regular, 13, 430)) {
    st.p.drawText(ln, { x: MARGIN, y: st.y, size: 13, font: F.regular, color: TEXT_MEDIUM });
    st.y -= 19;
  }
  st.y -= 14;
  st.p.drawText("Persönlich erstellt für " + dog + (breed ? " - " + breed : ""), {
    x: MARGIN,
    y: st.y,
    size: 13,
    font: F.bold,
    color: DARK_BROWN,
  });

  // Stufen-Übersicht als Karte rechts
  const karteX = MARGIN + 470;
  const karteW = A4_W - karteX - MARGIN;
  const zeilen = stufen.map((s) => wrap(s, F.regular, 12, karteW - 54));
  const karteH = 34 + zeilen.reduce((a, l) => a + Math.max(20, l.length * 17), 0) + 22;
  const karteY = A4_H - BANNER_H - 95 - karteH;
  roundedRect(st.p, karteX, karteY, karteW, karteH, 10, BG_BAR);
  let ky = karteY + karteH - 26;
  st.p.drawText("DEIN WEG", { x: karteX + 22, y: ky, size: 10, font: F.bold, color: GOLD_DARK });
  ky -= 22;
  for (const l of zeilen) {
    drawPaw(st.p, karteX + 28, ky + 2, 0.5, GOLD);
    let ty = ky;
    for (const ln of l) {
      st.p.drawText(ln, { x: karteX + 46, y: ty, size: 12, font: F.regular, color: TEXT_DARK });
      ty -= 17;
    }
    ky -= Math.max(20, l.length * 17);
  }
  // Fussleiste auf dem Cover: drei Saetze, die den Ton des Hefts setzen.
  // Ohne sie steht die untere Haelfte der Querseite leer.
  const merksaetze = [
    "Eine Übung pro Tag reicht völlig.",
    "Erst drinnen üben, dann draußen.",
    "Immer mit einem Erfolg aufhören.",
  ];
  const leisteH = 54;
  const leisteY = 78;
  roundedRect(st.p, MARGIN, leisteY, A4_W - 2 * MARGIN, leisteH, 10, BG_BAR);
  const spaltenBreite = (A4_W - 2 * MARGIN) / 3;
  merksaetze.forEach((text, i) => {
    const x = MARGIN + i * spaltenBreite + 24;
    drawPaw(st.p, x + 6, leisteY + leisteH / 2 - 2, 0.5, GOLD);
    st.p.drawText(S(text), {
      x: x + 24,
      y: leisteY + leisteH / 2 - 4,
      size: 11.5,
      font: F.regular,
      color: DARK_BROWN,
    });
  });
  drawPaw(st.p, MARGIN + 20, leisteY + leisteH + 48, 1.2, BANNER_TAN);
  drawPaw(st.p, MARGIN + 62, leisteY + leisteH + 72, 0.9, BANNER_TAN);
  drawPaw(st.p, MARGIN + 98, leisteY + leisteH + 42, 0.7, BANNER_TAN);

  // ---------- EINLEITUNG ----------
  const warum = sec("warum"),
    sicherheit = sec("sicherheit"),
    methode = sec("methode"),
    notfall = sec("notfall"),
    plan = sec("plan"),
    wenn = sec("wenn");

  if (warum) {
    newPage();
    vollBreite();
    sectionTitle(S(warum.title) || "Warum Hunde alles aufnehmen");
    absatz(warum.body, { gapAfter: 18 });
  }
  if (sicherheit) {
    ensure(170);
    sectionTitle(S(sicherheit.title) || "Zuerst: die Sicherheitsregeln", 22);
    if (sicherheit.body) absatz(sicherheit.body, { gapAfter: 12 });
    for (const p of sicherheit.points || []) pfeilPunkt(p);
    gap(12);
  }
  if (methode) {
    newPage();
    vollBreite();
    sectionTitle(S(methode.title) || "Dein Werkzeugkasten");
    if (methode.body) absatz(methode.body, { gapAfter: 14 });
    for (const [i, b] of (methode.bausteine || []).entries()) {
      const lines = wrap(b.text, F.regular, 12.5, TEXT_W - 46);
      ensure(lines.length * 17.5 + 26);
      const r = 11;
      const cy = st.y + 12.5 * 0.32;
      st.p.drawCircle({ x: MARGIN + r, y: cy, size: r, color: GOLD });
      const nw = F.bold.widthOfTextAtSize(String(i + 1), 12);
      st.p.drawText(String(i + 1), { x: MARGIN + r - nw / 2, y: cy - 12 * 0.34, size: 12, font: F.bold, color: WHITE });
      st.p.drawText(S(b.name), { x: MARGIN + 34, y: st.y, size: 13, font: F.bold, color: DARK_BROWN });
      let ty = st.y - 19;
      for (const ln of lines) {
        st.p.drawText(ln, { x: MARGIN + 34, y: ty, size: 12.5, font: F.regular, color: TEXT_MEDIUM });
        ty -= 17.5;
      }
      st.y = ty - 10;
    }
  }

  // ---------- DIE ÜBUNGEN ----------
  // Eine Übung pro Seite, zweispaltig: links der Ablauf, rechts das Drumherum.
  // Quer ist die Seite breit und flach — einspaltig lief jede Übung auf zwei
  // Seiten über und die zweite war halb leer.
  const SP_L_X = MARGIN;
  const SP_L_W = 380;
  const SP_R_X = MARGIN + 410;
  const SP_R_W = A4_W - SP_R_X - MARGIN;

  let letzteStufe = "";
  for (const u of uebungen) {
    newPage();
    st.y = A4_H - BANNER_H - 56;
    const stufe = S(u.stufe);

    // Kopfzeile: Stufe (nur beim Wechsel) + Übungsnummer
    const nummer = "Übung " + (u.nummer ?? "");
    const nSize = 13;
    const nW = F.bold.widthOfTextAtSize(nummer, nSize) + 26;
    roundedRect(st.p, MARGIN, st.y - 26, nW, 26, 4, BG_BAR);
    st.p.drawText(nummer, { x: MARGIN + 13, y: st.y - 26 + 8, size: nSize, font: F.bold, color: DARK_BROWN });
    if (stufe) {
      const neuStufe = stufe !== letzteStufe;
      const stufeText = S(stufe.replace(/^Stufe\s*(\d+)\s*[—-]\s*/, "Stufe $1: "));
      st.p.drawText(stufeText, {
        x: MARGIN + nW + 14,
        y: st.y - 26 + 8,
        size: 11.5,
        font: neuStufe ? F.bold : F.regular,
        color: neuStufe ? GOLD_DARK : TEXT_LIGHT,
      });
      letzteStufe = stufe;
    }
    st.y -= 44;

    // Titel über die ganze Breite, alles andere in die Spalten
    unterTitel(S(u.title), 22);

    const spaltenTop = st.y;
    const spaltenSeite = st.p;
    const platz = spaltenTop - BOTTOM;

    // Beide Spalten vorher ausmessen und die Schriftgroesse so waehlen, dass
    // die Uebung auf EINE Seite passt. Vorher lief bei den langen Uebungen aus
    // Stufe 3 und 4 jeweils ein Rest auf eine fast leere Folgeseite.
    const schritte: string[] = (u.aufbau || []).map((x: any) => S(x));
    const hoeheSchritte = (size: number) => {
      const lg = size + 5;
      return schritte.reduce(
        (a, t) => a + Math.max(wrap(t, F.regular, size, SP_L_W - 34).length * lg, 26) + 8,
        0
      );
    };
    const rechtsBloecke: Array<[string, string]> = [];
    if (u.wenn_nicht) rechtsBloecke.push(["Wenn es nicht klappt: ", S(u.wenn_nicht)]);
    if (u.wiederholung) rechtsBloecke.push(["Wie oft: ", S(u.wiederholung)]);
    if (u.erfolg) rechtsBloecke.push(["Geschafft, wenn: ", S(u.erfolg)]);
    if (u.fehler) rechtsBloecke.push(["Häufigster Fehler: ", S(u.fehler)]);
    const hoeheRechts = (size: number, abstand: number) => {
      const lg = size + 5.5;
      let vorlauf = 0;
      if (u.intro) vorlauf += wrap(S(u.intro), F.italic, size, SP_R_W).length * (size + 6) + 14;
      if (u.vorbereitung) {
        const lw = F.bold.widthOfTextAtSize("Das brauchst du: ", size) + 5;
        const e = wrap(S(u.vorbereitung), F.regular, size, SP_R_W - 20 - lw)[0] || "";
        vorlauf += (wrap(S(u.vorbereitung).slice(e.length).trim(), F.regular, size, SP_R_W - 20).length + 1) * lg + abstand;
      }
      return vorlauf + rechtsBloecke.reduce((a, [label, text]) => {
        const labelW = F.bold.widthOfTextAtSize(label, size) + 5;
        const erste = wrap(text, F.regular, size, SP_R_W - 20 - labelW)[0] || "";
        const rest = text.slice(erste.length).trim();
        return a + (wrap(rest, F.regular, size, SP_R_W - 20).length + 1) * lg + abstand;
      }, 0);
    };

    const PILL_H = 37; // Pill "So gehst du vor" inkl. Abstand
    let szL = 10.5;
    for (const k of [12, 11.5, 11, 10.5]) {
      szL = k;
      if (hoeheSchritte(k) + PILL_H <= platz) break;
    }
    let szR = 10;
    let abstandR = 14;
    for (const [k, ab] of [[11.5, 14], [11, 13], [10.5, 12], [10, 10]] as Array<[number, number]>) {
      szR = k;
      abstandR = ab;
      if (hoeheRechts(k, ab) <= platz) break;
    }

    // Rechte Spalte zuerst — sie bleibt dadurch sicher auf dieser Seite.
    spalte(SP_R_X, SP_R_W);
    if (u.intro) absatz(u.intro, { size: szR, font: F.italic, color: TEXT_MEDIUM, gapAfter: 14 });
    if (u.vorbereitung) punktBlock("punkt", "Das brauchst du: ", S(u.vorbereitung), szR, abstandR);
    for (const [i, [label, text]] of rechtsBloecke.entries()) {
      const icon = label.startsWith("Geschafft") ? "haken" : label.startsWith("Häufigster") ? "warnung" : "punkt";
      punktBlock(icon as any, label, text, szR, i === rechtsBloecke.length - 1 ? 0 : abstandR);
    }
    const endeRechts = st.p === spaltenSeite ? st.y : BOTTOM;

    // Zurueck nach oben links: der Ablauf.
    st.p = spaltenSeite;
    st.y = spaltenTop;
    spalte(SP_L_X, SP_L_W);
    pill("So gehst du vor", GOLD_DARK, BG_BAR, 12);
    for (const [i, schritt] of schritte.entries()) nummerSchritt(i + 1, schritt, szL);
    st.y = Math.min(st.y, endeRechts);
    vollBreite();
  }

  // ---------- NOTFALL ----------
  if (notfall) {
    newPage();
    vollBreite();
    st.y = A4_H - BANNER_H - 80;
    const warnH = 34;
    roundedRect(st.p, MARGIN, st.y - warnH, CONTENT_W, warnH, 6, PILL_BG_RED);
    st.p.drawRectangle({ x: MARGIN + 5, y: st.y - warnH + 7, width: 3, height: warnH - 14, color: WARN_RED });
    st.p.drawText("IM NOTFALL - BITTE JETZT LESEN, NICHT ERST DANN", {
      x: MARGIN + 18,
      y: st.y - warnH + 12,
      size: 11,
      font: F.bold,
      color: WARN_RED,
    });
    st.y -= warnH + 26;
    sectionTitle(S(notfall.title) || "Notfall: Verdacht auf Giftköder", 24);
    // Zwei Spalten: links die Anzeichen, rechts die Reihenfolge. Einspaltig
    // lief die Seite ueber und die Fortsetzung war fast leer — ausgerechnet
    // die Seite, die im Ernstfall in einem Stueck lesbar sein muss.
    const nTop = st.y;
    const nSeite = st.p;
    spalte(MARGIN + 390, A4_W - (MARGIN + 390) - MARGIN);
    if ((notfall.schritte || []).length) {
      pill("In dieser Reihenfolge handeln", WARN_RED, PILL_BG_RED, 12);
      for (const [i, schritt] of notfall.schritte.entries()) nummerSchritt(i + 1, schritt, 11.5);
      gap(4);
    }
    absatz(
      "Dieses Training beugt vor, es ersetzt keinen Tierarzt. Bei Verdacht auf eine Vergiftung fährst du sofort in die Praxis oder Tierklinik.",
      { size: 10.5, font: F.italic, color: TEXT_MEDIUM, gapAfter: 6 }
    );
    const nEndeRechts = st.p === nSeite ? st.y : BOTTOM;
    st.p = nSeite;
    st.y = nTop;
    spalte(MARGIN, 350);
    if (notfall.body) absatz(notfall.body, { size: 11.5, gapAfter: 16 });
    if ((notfall.anzeichen || []).length) {
      pill("Daran erkennst du eine Vergiftung", WARN_RED, PILL_BG_RED, 12);
      for (const a of notfall.anzeichen) warnPunkt(a, 11.5);
    }
    st.y = Math.min(st.y, nEndeRechts);
    vollBreite();
  }

  // ---------- 14-TAGE-PLAN ----------
  if (plan) {
    newPage();
    vollBreite();
    st.y = A4_H - BANNER_H - 80;
    sectionTitle(S(plan.title) || "Dein 14-Tage-Startplan", 24);
    const tage = (plan.days || []) as any[];
    const labelW = Math.max(74, ...tage.map((d) => F.bold.widthOfTextAtSize(S(d.tag), 12) + 26));
    for (const d of tage) {
      const text = S(d.fokus) + (d.uebungen ? "  (Übungen " + S(d.uebungen) + ")" : "");
      const lines = wrap(text, F.regular, 12.5, TEXT_W - labelW - 16);
      ensure(Math.max(26, lines.length * 17.5) + 12);
      const top = st.y;
      roundedRect(st.p, MARGIN, top - 7, labelW, 24, 4, BG_BAR);
      st.p.drawText(S(d.tag), { x: MARGIN + 13, y: top, size: 12, font: F.bold, color: DARK_BROWN });
      let ty = top;
      for (const ln of lines) {
        st.p.drawText(ln, { x: MARGIN + labelW + 16, y: ty, size: 12.5, font: F.regular, color: TEXT_DARK });
        ty -= 17.5;
      }
      st.y = Math.min(top - 26, ty) - 7;
    }
    const checks: string[] = plan.check || [];
    if (checks.length) {
      gap(8);
      pill("Erfolgs-Check nach 14 Tagen", PILL_AC_GREEN, PILL_BG_GREEN, 12);
      for (const c of checks) hakenPunkt(c, 11.5);
    }
  }

  // ---------- WENN ES HAKT ----------
  if (wenn) {
    newPage();
    vollBreite();
    st.y = A4_H - BANNER_H - 80;
    sectionTitle(S(wenn.title) || "Was tun, wenn...", 24);
    const faelle = (wenn.cases || []) as any[];
    const haelfte = Math.ceil(faelle.length / 2);
    const wTop = st.y;
    const wSeite = st.p;
    const zeichneFaelle = (liste: any[]) => {
      for (const c of liste) {
        ensure(64);
        unterTitel(S(c.fall), 13);
        absatz(c.tun, { size: 11.5, color: TEXT_MEDIUM, gapAfter: 16 });
      }
    };
    spalte(MARGIN + 390, A4_W - (MARGIN + 390) - MARGIN);
    zeichneFaelle(faelle.slice(haelfte));
    const wEndeRechts = st.p === wSeite ? st.y : BOTTOM;
    st.p = wSeite;
    st.y = wTop;
    spalte(MARGIN, 350);
    zeichneFaelle(faelle.slice(0, haelfte));
    st.y = Math.min(st.y, wEndeRechts);
    vollBreite();
  }

  // Seitenzahlen (Cover ohne)
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    if (i === 0) return;
    const txt = String(i + 1);
    const w = F.regular.widthOfTextAtSize(txt, 11);
    p.drawText(txt, { x: A4_W - 50 - w / 2, y: 28, size: 11, font: F.regular, color: TEXT_LIGHT });
  });

  return doc.save();
}
