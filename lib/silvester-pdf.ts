// lib/silvester-pdf.ts
//
// Rendert den "Silvester-Plan" (Content aus silvester-content.ts) als A4-PDF
// via pdf-lib. Bausteine 1:1 aus lib/giftkoeder-pdf.ts, damit der Plan neben
// den anderen PDFs gleich aussieht.
//
// DESIGN: bewusst dieselbe Sprache wie der Haupt-Plan und die Zusatzmodule
// (generate-plan-from-content.mjs / generate-zusatzmodul-pdf.mjs): A4 quer,
// Sand-Hintergrund, Tan-Banner mit Pfote und Wortmarke, Titel mit goldenem
// Unterstrich, Pills statt Kaesten, goldene Nummernkreise. Die Hilfsfunktionen
// sind von dort uebernommen, damit das Heft neben den anderen PDFs nicht wie
// ein Fremdkoerper aussieht.
//
// Besonderheit: Wochenplan mit echten Datumsangaben (aus dem Code, nicht aus
// dem Modell), ein Ablauf fuer die Silvesternacht und eine Tierarzt-Seite.

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from "pdf-lib";
import type { SilvesterContent } from "./silvester-content";

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

export async function buildSilvesterPDF(
  content: SilvesterContent,
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
    const basis = st.y - s;
    st.p.drawText(S(title), { x: st.x, y: basis, size: s, font: F.bold, color: DARK_BROWN });
    const underlineW = Math.min(220, F.bold.widthOfTextAtSize(S(title), s) * 0.45);
    st.p.drawRectangle({ x: st.x, y: basis - 10, width: underlineW, height: 2, color: GOLD });
    st.y = basis - 20;
  };

  const absatz = (
    text: string,
    o: { size?: number; font?: PDFFont; color?: any; gapAfter?: number; width?: number } = {}
  ) => {
    const size = o.size ?? 12.5;
    const font = o.font ?? F.regular;
    const color = o.color ?? TEXT_DARK;
    const lineGap = size + 6;
    // st.y ist die Oberkante der naechsten Zeile — dasselbe Modell wie bei
    // `zeile`. Vorher war es mal die Grundlinie, mal die Oberkante, und beim
    // Mischen beider Bausteine lagen Titel und Text uebereinander.
    for (const ln of wrap(text, font, size, o.width ?? st.w)) {
      ensure(lineGap);
      st.p.drawText(ln, { x: st.x, y: st.y - size, size, font, color });
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

  // Eine Zeile mit Icon — EIN Bausatz fuer Schritte, Haken, Warnungen und
  // Pfeile. Zwei Regeln halten die Seite ruhig:
  //   1. Nichts wird oberhalb von st.y gezeichnet. Vorher ragte der Nummern-
  //      kreis nach oben raus und lag auf der Pill darueber.
  //   2. Alle Icons teilen sich dieselbe Textspalte (ZEILE_EINZUG), egal ob
  //      Kreis, Haken oder Pfote — dadurch steht jede Zeile auf derselben Kante.
  const ZEILE_EINZUG = 26;
  const zeile = (
    icon: { art: "nummer"; n: number } | { art: "haken" | "warnung" | "pfote" | "pfeil" },
    text: string,
    o: { size?: number; gapAfter?: number; color?: any; font?: PDFFont } = {}
  ) => {
    const size = o.size ?? 12.5;
    const font = o.font ?? F.regular;
    const lineGap = size + 6;
    const lines = wrap(text, font, size, st.w - ZEILE_EINZUG);
    const gapAfter = o.gapAfter ?? 8;
    ensure(lines.length * lineGap + gapAfter);

    const oben = st.y;              // obere Kante der Zeile
    const basis = oben - size;      // Grundlinie der ersten Textzeile
    const mitte = basis + size * 0.33;

    if (icon.art === "nummer") {
      const r = size * 0.68;        // Kreis genau so hoch wie die Zeile
      const cx = st.x + r + 1;
      st.p.drawCircle({ x: cx, y: mitte, size: r, color: GOLD });
      const numSize = size * 0.82;
      const nw = F.bold.widthOfTextAtSize(String(icon.n), numSize);
      st.p.drawText(String(icon.n), {
        x: cx - nw / 2,
        y: mitte - numSize * 0.35,
        size: numSize,
        font: F.bold,
        color: WHITE,
      });
    } else if (icon.art === "haken") {
      const cx = st.x + 7;
      const k = size / 12.5;
      st.p.drawLine({ start: { x: cx - 4 * k, y: mitte - k }, end: { x: cx - k, y: mitte - 5 * k }, thickness: 2.1, color: PILL_AC_GREEN });
      st.p.drawLine({ start: { x: cx - k, y: mitte - 5 * k }, end: { x: cx + 6 * k, y: mitte + 5 * k }, thickness: 2.1, color: PILL_AC_GREEN });
    } else if (icon.art === "warnung") {
      const cx = st.x + 7;
      const tri = size * 0.52;
      st.p.drawSvgPath(`M 0 -${tri} L -${tri} ${tri * 0.6} L ${tri} ${tri * 0.6} Z`, {
        x: cx,
        y: mitte + tri * 0.4,
        color: WARN_RED,
        borderColor: WARN_RED,
        borderWidth: 0.5,
      });
      st.p.drawText("!", { x: cx - 1.3, y: mitte - tri * 0.5, size: size * 0.7, font: F.regular, color: WHITE });
    } else if (icon.art === "pfote") {
      drawPaw(st.p, st.x + 7, mitte - 1, size * 0.037, GOLD);
    } else {
      st.p.drawText("->", { x: st.x, y: basis, size, font: F.bold, color: GOLD_DARK });
    }

    let ty = basis;
    for (const ln of lines) {
      st.p.drawText(ln, { x: st.x + ZEILE_EINZUG, y: ty, size, font, color: o.color ?? TEXT_DARK });
      ty -= lineGap;
    }
    st.y = oben - lines.length * lineGap - gapAfter;
  };

  const pfeilPunkt = (text: string, size = 12.5) => zeile({ art: "pfeil" }, text, { size, gapAfter: 6 });
  const nummerSchritt = (n: number, text: string, size = 12.5, gapAfter = 7) =>
    zeile({ art: "nummer", n }, text, { size, gapAfter });
  const hakenPunkt = (text: string, size = 12.5) => zeile({ art: "haken" }, text, { size, gapAfter: 6 });
  const warnPunkt = (text: string, size = 12.5) => zeile({ art: "warnung" }, text, { size, gapAfter: 6 });

  // Kleine Zwischenueberschrift (ohne Pill), z.B. Uebungstitel
  const unterTitel = (text: string, size = 17) => {
    const lines = wrap(text, F.bold, size, st.w);
    ensure(lines.length * (size + 6) + 10);
    for (const ln of lines) {
      st.p.drawText(ln, { x: st.x, y: st.y - size, size, font: F.bold, color: DARK_BROWN });
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
    st.p.drawText(S(label), { x: st.x, y: st.y - size, size, font: F.bold, color: DARK_BROWN });
    st.p.drawText(ersteZeile, { x: st.x + labelW, y: st.y - size, size, font: F.regular, color: TEXT_DARK });
    st.y -= lg;
    for (const ln of wrap(rest, F.regular, size, breite)) {
      ensure(lg);
      st.p.drawText(ln, { x: st.x, y: st.y - size, size, font: F.regular, color: TEXT_DARK });
      st.y -= lg;
    }
  };

  // Icon + fettes Label + Text. Ersetzt in der schmalen Spalte die Pills:
  // vier Pills kosteten ueber 100 Punkt Hoehe, die der Seite dann fehlten.
  // Icon + fettes Label + Fliesstext, auf demselben Raster wie `zeile`.
  // Ersetzt in der schmalen Spalte die Pills: vier Pills kosteten ueber
  // 100 Punkt Hoehe, die der Seite dann fehlten.
  const punktBlock = (
    icon: "punkt" | "haken" | "warnung",
    label: string,
    text: string,
    size = 11.5,
    gapAfter = 14
  ) => {
    const lineGap = size + 6;
    const labelW = F.bold.widthOfTextAtSize(S(label), size) + 5;
    const erste = wrap(text, F.regular, size, st.w - ZEILE_EINZUG - labelW)[0] || "";
    const rest = S(text).slice(erste.length).trim();
    const restZeilen = wrap(rest, F.regular, size, st.w - ZEILE_EINZUG);
    ensure((restZeilen.length + 1) * lineGap + gapAfter);

    const oben = st.y;
    const basis = oben - size;
    const mitte = basis + size * 0.33;

    if (icon === "haken") {
      const cx = st.x + 7;
      const k = size / 12.5;
      st.p.drawLine({ start: { x: cx - 4 * k, y: mitte - k }, end: { x: cx - k, y: mitte - 5 * k }, thickness: 2.1, color: PILL_AC_GREEN });
      st.p.drawLine({ start: { x: cx - k, y: mitte - 5 * k }, end: { x: cx + 6 * k, y: mitte + 5 * k }, thickness: 2.1, color: PILL_AC_GREEN });
    } else if (icon === "warnung") {
      const cx = st.x + 7;
      const tri = size * 0.52;
      st.p.drawSvgPath(`M 0 -${tri} L -${tri} ${tri * 0.6} L ${tri} ${tri * 0.6} Z`, {
        x: cx,
        y: mitte + tri * 0.4,
        color: WARN_RED,
        borderColor: WARN_RED,
        borderWidth: 0.5,
      });
      st.p.drawText("!", { x: cx - 1.3, y: mitte - tri * 0.5, size: size * 0.7, font: F.regular, color: WHITE });
    } else {
      drawPaw(st.p, st.x + 7, mitte - 1, size * 0.037, GOLD);
    }

    st.p.drawText(S(label), { x: st.x + ZEILE_EINZUG, y: basis, size, font: F.bold, color: DARK_BROWN });
    st.p.drawText(erste, { x: st.x + ZEILE_EINZUG + labelW, y: basis, size, font: F.regular, color: TEXT_DARK });
    let ty = basis - lineGap;
    for (const ln of restZeilen) {
      st.p.drawText(ln, { x: st.x + ZEILE_EINZUG, y: ty, size, font: F.regular, color: TEXT_DARK });
      ty -= lineGap;
    }
    st.y = oben - (restZeilen.length + 1) * lineGap - gapAfter;
  };

  const sec = (k: string) => content.sections.find((x: any) => x?.key === k);
  const uebungen = content.sections.filter((x: any) => x?.key === "uebung") as any[];
  const stufen = Array.from(new Set(uebungen.map((u) => S(u.stufe)).filter(Boolean)));

  // ---------- COVER ----------
  newPage();
  st.y = A4_H - BANNER_H - 85;
  st.p.drawText("DEIN SILVESTER-PLAN", { x: MARGIN, y: st.y, size: 11, font: F.bold, color: GOLD_DARK });
  st.y -= 34;
  st.p.drawText("Ruhig durch Silvester", { x: MARGIN, y: st.y, size: 38, font: F.bold, color: DARK_BROWN });
  st.p.drawRectangle({ x: MARGIN, y: st.y - 12, width: 215, height: 2.5, color: GOLD });
  st.y -= 40;
  const wochenZahl = content.wochen.length;
  st.p.drawText(
    "Knallangst-Training in " + (wochenZahl === 1 ? "einem Kurzprogramm" : wochenZahl + " Wochen") + " und dein Plan für die Nacht",
    { x: MARGIN, y: st.y, size: 16, font: F.bold, color: GOLD_DARK }
  );
  st.y -= 30;
  const untertitel = S(content.subtitle || "")
    .replace(/^\s*(Dein\s+)?Silvester-Plan\s*[-:]\s*/i, "")
    .replace(/^./, (c) => c.toUpperCase()) || "Schritt für Schritt zu einem ruhigeren Jahreswechsel";
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
  if (content.tageBisSilvester >= 0) {
    st.y -= 22;
    st.p.drawText(
      content.tageBisSilvester === 0 ? "Heute ist Silvester." : "Noch " + content.tageBisSilvester + " Tage bis Silvester.",
      { x: MARGIN, y: st.y, size: 12, font: F.regular, color: GOLD_DARK }
    );
  }

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
  const merksaetze = [
    "Lieber zu leise als zu laut.",
    "Trösten ist erlaubt.",
    "Sicherheit vor Training.",
  ];
  const leisteH = 54;
  const leisteY = 78;
  roundedRect(st.p, MARGIN, leisteY, A4_W - 2 * MARGIN, leisteH, 10, BG_BAR);
  const spaltenBreite = (A4_W - 2 * MARGIN) / 3;
  merksaetze.forEach((text, i) => {
    const x = MARGIN + i * spaltenBreite + 24;
    drawPaw(st.p, x + 6, leisteY + leisteH / 2 - 2, 0.5, GOLD);
    st.p.drawText(S(text), { x: x + 24, y: leisteY + leisteH / 2 - 4, size: 11.5, font: F.regular, color: DARK_BROWN });
  });
  drawPaw(st.p, MARGIN + 20, leisteY + leisteH + 48, 1.2, BANNER_TAN);
  drawPaw(st.p, MARGIN + 62, leisteY + leisteH + 72, 0.9, BANNER_TAN);
  drawPaw(st.p, MARGIN + 98, leisteY + leisteH + 42, 0.7, BANNER_TAN);

  const einschaetzung = sec("einschaetzung"),
    warum = sec("warum"),
    sicherheit = sec("sicherheit"),
    wochenplan = sec("wochenplan"),
    nacht = sec("nacht"),
    tierarzt = sec("tierarzt"),
    wenn = sec("wenn"),
    checkliste = sec("checkliste");

  // Zwei Listen nebeneinander (links/rechts), wie auf der Notfall-Seite.
  const zweiSpalten = (links: () => void, rechts: () => void) => {
    const top = st.y;
    const seite = st.p;
    spalte(MARGIN + 390, A4_W - (MARGIN + 390) - MARGIN);
    rechts();
    const endeRechts = st.p === seite ? st.y : BOTTOM;
    st.p = seite;
    st.y = top;
    spalte(MARGIN, 350);
    links();
    st.y = Math.min(st.y, endeRechts);
    vollBreite();
  };

  // ---------- EINSCHÄTZUNG ----------
  if (einschaetzung) {
    newPage();
    vollBreite();
    sectionTitle(S(einschaetzung.title) || "So schätze ich " + dog + " ein");
    absatz(einschaetzung.body, { gapAfter: 16 });
    zweiSpalten(
      () => {
        if ((einschaetzung.staerken || []).length) {
          pill("Das spricht für " + dog, PILL_AC_GREEN, PILL_BG_GREEN, 12);
          for (const s of einschaetzung.staerken) hakenPunkt(s, 11.5);
        }
      },
      () => {
        if ((einschaetzung.achtung || []).length) {
          pill("Darauf achtest du besonders", WARN_RED, PILL_BG_RED, 12);
          for (const s of einschaetzung.achtung) warnPunkt(s, 11.5);
        }
      }
    );
  }

  // ---------- WARUM + SICHERHEIT ----------
  if (warum) {
    newPage();
    vollBreite();
    sectionTitle(S(warum.title) || "Warum Hunde vor Feuerwerk Angst haben");
    absatz(warum.body, { gapAfter: 18 });
  }
  if (sicherheit) {
    ensure(170);
    sectionTitle(S(sicherheit.title) || "Zuerst: die Sicherheitsregeln", 22);
    if (sicherheit.body) absatz(sicherheit.body, { gapAfter: 12 });
    for (const p of sicherheit.points || []) pfeilPunkt(p);
    gap(12);
  }

  // ---------- WOCHENPLAN ----------
  if (wochenplan && (wochenplan.wochen || []).length) {
    newPage();
    vollBreite();
    st.y = A4_H - BANNER_H - 56;
    sectionTitle(S(wochenplan.title) || "Dein Wochenplan bis Silvester", 24);
    for (const w of wochenplan.wochen as any[]) {
      const kopf = S(w.label) + (w.zeitraum ? "  ·  " + S(w.zeitraum) : "");
      ensure(110);
      chip(kopf, 14);
      st.y += 6;
      absatz(S(w.phase), { size: 12, font: F.bold, color: GOLD_DARK, gapAfter: 4 });
      if (w.ziel) absatz("Ziel: " + S(w.ziel), { size: 11.5, color: TEXT_MEDIUM, gapAfter: 6 });
      for (const t of w.taeglich || []) pfeilPunkt(t, 11.5);
      if (w.check) hakenPunkt("Weiter, wenn: " + S(w.check), 11);
      gap(10);
    }
  }

  // ---------- DIE ÜBUNGEN ----------
  const SP_L_X = MARGIN;
  const SP_L_W = 380;
  const SP_R_X = MARGIN + 410;
  const SP_R_W = A4_W - SP_R_X - MARGIN;

  let letzteStufe = "";
  for (const u of uebungen) {
    newPage();
    st.y = A4_H - BANNER_H - 56;
    const stufe = S(u.stufe);
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
    unterTitel(S(u.title), 22);
    gap(8);

    const spaltenTop = st.y;
    const spaltenSeite = st.p;
    const platz = spaltenTop - BOTTOM;
    const schritte: string[] = (u.aufbau || []).map((x: any) => S(x));
    const hoeheSchritte = (size: number, abstand: number) => {
      const lg = size + 6;
      return schritte.reduce((a, t) => a + wrap(t, F.regular, size, SP_L_W - ZEILE_EINZUG).length * lg + abstand, 0);
    };
    const rechtsBloecke: Array<[string, string]> = [];
    if (u.wenn_nicht) rechtsBloecke.push(["Wenn es zu viel ist: ", S(u.wenn_nicht)]);
    if (u.wiederholung) rechtsBloecke.push(["Wie oft: ", S(u.wiederholung)]);
    if (u.erfolg) rechtsBloecke.push(["Geschafft, wenn: ", S(u.erfolg)]);
    if (u.fehler) rechtsBloecke.push(["Häufigster Fehler: ", S(u.fehler)]);
    const hoeheRechts = (size: number, abstand: number) => {
      const lg = size + 6;
      let vorlauf = 0;
      if (u.intro) vorlauf += wrap(S(u.intro), F.italic, size, SP_R_W).length * (size + 6) + 14;
      if (u.vorbereitung) {
        const lw = F.bold.widthOfTextAtSize("Das brauchst du: ", size) + 5;
        const e = wrap(S(u.vorbereitung), F.regular, size, SP_R_W - ZEILE_EINZUG - lw)[0] || "";
        vorlauf += (wrap(S(u.vorbereitung).slice(e.length).trim(), F.regular, size, SP_R_W - ZEILE_EINZUG).length + 1) * lg + abstand;
      }
      return vorlauf + rechtsBloecke.reduce((a, [label, text]) => {
        const labelW = F.bold.widthOfTextAtSize(label, size) + 5;
        const erste = wrap(text, F.regular, size, SP_R_W - ZEILE_EINZUG - labelW)[0] || "";
        const rest = text.slice(erste.length).trim();
        return a + (wrap(rest, F.regular, size, SP_R_W - ZEILE_EINZUG).length + 1) * lg + abstand;
      }, 0);
    };
    const PILL_H = 37;
    let szL = 10;
    let abstandL = 5;
    for (const [k, ab] of [[12, 7], [11.5, 7], [11, 6], [10.5, 6], [10, 5]] as Array<[number, number]>) {
      szL = k;
      abstandL = ab;
      if (hoeheSchritte(k, ab) + PILL_H <= platz) break;
    }
    let szR = 9.5;
    let abstandR = 7;
    for (const [k, ab] of [[11.5, 14], [11, 12], [10.5, 10], [10, 9], [9.5, 7]] as Array<[number, number]>) {
      szR = k;
      abstandR = ab;
      if (hoeheRechts(k, ab) <= platz) break;
    }
    spalte(SP_R_X, SP_R_W);
    if (u.intro) absatz(u.intro, { size: szR, font: F.italic, color: TEXT_MEDIUM, gapAfter: 14 });
    if (u.vorbereitung) punktBlock("punkt", "Das brauchst du: ", S(u.vorbereitung), szR, abstandR);
    for (const [i, [label, text]] of rechtsBloecke.entries()) {
      const icon = label.startsWith("Geschafft") ? "haken" : label.startsWith("Häufigster") ? "warnung" : "punkt";
      punktBlock(icon as any, label, text, szR, i === rechtsBloecke.length - 1 ? 0 : abstandR);
    }
    const endeRechts = st.p === spaltenSeite ? st.y : BOTTOM;
    st.p = spaltenSeite;
    st.y = spaltenTop;
    spalte(SP_L_X, SP_L_W);
    pill("So gehst du vor", GOLD_DARK, BG_BAR, 12);
    for (const [i, schritt] of schritte.entries()) nummerSchritt(i + 1, schritt, szL, abstandL);
    st.y = Math.min(st.y, endeRechts);
    vollBreite();
  }

  // ---------- SILVESTERNACHT ----------
  if (nacht) {
    newPage();
    vollBreite();
    st.y = A4_H - BANNER_H - 56;
    sectionTitle(S(nacht.title) || "Der Plan für die Silvesternacht", 24);
    if (nacht.body) absatz(nacht.body, { size: 12, gapAfter: 14 });
    const ablauf = (nacht.ablauf || []) as any[];
    const labelW = Math.max(110, ...ablauf.map((d) => F.bold.widthOfTextAtSize(S(d.zeit), 12) + 26));
    for (const d of ablauf) {
      const lines = wrap(S(d.tun), F.regular, 12, TEXT_W - labelW - 16);
      const hoehe = Math.max(26, lines.length * 18);
      ensure(hoehe + 10);
      const top = st.y;
      roundedRect(st.p, MARGIN, top - 24, labelW, 24, 4, BG_BAR);
      st.p.drawText(S(d.zeit), { x: MARGIN + 13, y: top - 16.5, size: 12, font: F.bold, color: DARK_BROWN });
      let ty = top - 12.5;
      for (const ln of lines) {
        st.p.drawText(ln, { x: MARGIN + labelW + 16, y: ty, size: 12, font: F.regular, color: TEXT_DARK });
        ty -= 18;
      }
      st.y = top - hoehe - 10;
    }
    // Die Packliste steht auf der Checklisten-Seite: hier lief sie im Test
    // auf eine eigene, fast leere Seite über.
  }

  // ---------- TIERARZT ----------
  if (tierarzt) {
    newPage();
    vollBreite();
    st.y = A4_H - BANNER_H - 56;
    const warnH = 34;
    roundedRect(st.p, MARGIN, st.y - warnH, CONTENT_W, warnH, 6, PILL_BG_GOLD);
    st.p.drawRectangle({ x: MARGIN + 5, y: st.y - warnH + 7, width: 3, height: warnH - 14, color: GOLD_DARK });
    st.p.drawText("RECHTZEITIG KLÄREN, NICHT ERST AM 30.12.", {
      x: MARGIN + 18,
      y: st.y - warnH + 12,
      size: 11,
      font: F.bold,
      color: GOLD_DARK,
    });
    st.y -= warnH + 26;
    sectionTitle(S(tierarzt.title) || "Wann du mit der Tierärztin sprechen solltest", 24);
    if (tierarzt.body) absatz(tierarzt.body, { size: 12, gapAfter: 14 });
    zweiSpalten(
      () => {
        if ((tierarzt.fragen || []).length) {
          pill("Das kannst du in der Praxis fragen", GOLD_DARK, BG_BAR, 12);
          for (const f of tierarzt.fragen) pfeilPunkt(f, 11.5);
        }
      },
      () => {
        if ((tierarzt.anzeichen || []).length) {
          pill("Hier wartest du nicht ab", WARN_RED, PILL_BG_RED, 12);
          for (const a of tierarzt.anzeichen) warnPunkt(a, 11.5);
        }
        absatz(
          "Dieser Plan ist ein Training und ersetzt keine tierärztliche Beratung. Mittel gegen Angst gibt es nur nach Rücksprache mit der Praxis.",
          { size: 10.5, font: F.italic, color: TEXT_MEDIUM, gapAfter: 6 }
        );
      }
    );
  }

  // ---------- WENN ES HAKT ----------
  if (wenn) {
    newPage();
    vollBreite();
    st.y = A4_H - BANNER_H - 56;
    sectionTitle(S(wenn.title) || "Was tun, wenn...", 24);
    const faelle = (wenn.cases || []) as any[];
    const haelfte = Math.ceil(faelle.length / 2);
    const zeichneFaelle = (liste: any[]) => {
      for (const c of liste) {
        ensure(64);
        unterTitel(S(c.fall), 13);
        absatz(c.tun, { size: 11.5, color: TEXT_MEDIUM, gapAfter: 16 });
      }
    };
    zweiSpalten(() => zeichneFaelle(faelle.slice(0, haelfte)), () => zeichneFaelle(faelle.slice(haelfte)));
  }

  // ---------- CHECKLISTEN ----------
  // Links die Packliste aus dem Nacht-Abschnitt, rechts die Checkliste für den 31.12.
  const packliste = ((nacht && nacht.packliste) || []) as string[];
  const punkte = ((checkliste && checkliste.punkte) || []) as string[];
  if (packliste.length || punkte.length) {
    newPage();
    vollBreite();
    st.y = A4_H - BANNER_H - 56;
    sectionTitle("Deine Checklisten für Silvester", 24);
    zweiSpalten(
      () => {
        if (!packliste.length) return;
        pill("Bis zum 30.12. bereitlegen", GOLD_DARK, BG_BAR, 12);
        for (const c of packliste) hakenPunkt(c, 12);
      },
      () => {
        if (!punkte.length) return;
        pill(S(checkliste?.title) || "Am 31.12.", PILL_AC_GREEN, PILL_BG_GREEN, 12);
        for (const c of punkte) hakenPunkt(c, 12);
      }
    );
  }

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    if (i === 0) return;
    const txt = String(i + 1);
    const w = F.regular.widthOfTextAtSize(txt, 11);
    p.drawText(txt, { x: A4_W - 50 - w / 2, y: 28, size: 11, font: F.regular, color: TEXT_LIGHT });
  });

  return doc.save();
}
