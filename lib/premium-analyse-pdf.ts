// Premium-Analyse-PDF — tiefes VERSTÄNDNIS-Gutachten (79 EUR), KEIN Trainingsplan.
// Erklärt den Hund: Ursache, Rasse & Herkunft, Gesundheit & Körper, Persönlichkeit
// & Psyche, Lebensphase, Sozialverhalten, Körpersprache, Alltags-Balance. Ergänzt
// (widerspricht NICHT) dem bereits gekauften Schritt-für-Schritt-Trainingsplan.
// Visuell: Deckblatt-Bild, Profil-Karte, Reizschwelle, Sicherheitsabstand,
// Eskalationsleiter, Persönlichkeits-Achsen, Lebensphasen-Leiste, Auslastungs-Balken.

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

const A4_W = 595.28, A4_H = 841.89, MARGIN = 50, CONTENT_W = A4_W - 2 * MARGIN, BOTTOM = 76;
const GOLD = rgb(196 / 255, 165 / 255, 118 / 255), DARK_BROWN = rgb(139 / 255, 115 / 255, 85 / 255);
const TEXT_DARK = rgb(26 / 255, 26 / 255, 26 / 255), TEXT_MEDIUM = rgb(66 / 255, 66 / 255, 66 / 255), TEXT_LIGHT = rgb(150 / 255, 150 / 255, 150 / 255);
const WHITE = rgb(1, 1, 1), BORDER_LIGHT = rgb(232 / 255, 220 / 255, 200 / 255);
const CREAM = rgb(255 / 255, 249 / 255, 240 / 255), WARN = rgb(254 / 255, 243 / 255, 235 / 255);
const SOFT_GREEN = rgb(232 / 255, 245 / 255, 233 / 255), GREEN_LINE = rgb(34 / 255, 120 / 255, 70 / 255);
const RED_LINE = rgb(190 / 255, 70 / 255, 60 / 255);
const INK = rgb(45 / 255, 45 / 255, 55 / 255), CARD_BG = rgb(0.992, 0.988, 0.98);
const TRACK = rgb(0.91, 0.88, 0.82);
// Eskalations-Farben (entspannt -> Eskalation)
const L1 = rgb(0.84, 0.93, 0.84), L2 = rgb(0.93, 0.95, 0.78), L3 = rgb(0.99, 0.92, 0.72), L4 = rgb(0.98, 0.84, 0.66), L5 = rgb(0.97, 0.77, 0.74);

const DISCLAIMER =
  "Diese persönliche Analyse ist ein fundiertes Verständnis-Gutachten auf Basis deiner Schilderung. Sie ersetzt keine tierärztliche oder verhaltenstherapeutische Untersuchung vor Ort und ist keine medizinische Diagnose.";

const S = (s: any) =>
  String(s == null ? "" : s)
    .replace(/[→←⇒▶]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[\u{1F000}-\u{1FAFF}☀-➿️✂]/gu, "");

export interface PremiumAnalyseContent {
  summary: string;
  intro: string;
  wishAnswer?: string | null;
  diagnosis: string;
  distanceNote?: string | null;
  breedHeritage: string;
  health: { topics: string[]; bodyCondition: string; nutrition: string; medicalNote: string };
  personality: { typeName: string; type: string; text: string; stress: string; bond: string; axes: { label: string; left: string; right: string; pos: number }[] };
  lifePhase: { now: string; text: string; ahead: string };
  vision: string;
  socialBehavior: string;
  bodyLanguageIntro: string;
  bodyLanguageSignals: { signal: string; meaning: string }[];
  dailyNeeds: string;
  needsBalance: { kopf: number; koerper: number; ruhe: number };
  whyFailed: string;
  planBridge: string;
  faq: { q: string; a: string }[];
  closing: string;
  photoObservation?: string | null;
  dangerNote?: string | null;
}

export interface PremiumAnalyseInput {
  dogName?: string | null;
  breed?: string | null;
  age?: string | null;
  problemLabel?: string | null;
  facts?: { label: string; value: string }[];
  coverImage?: { bytes: Uint8Array; type: string } | null;
  wishQuestion?: string | null;
  content: PremiumAnalyseContent;
}

export async function buildPremiumAnalysePDF(input: PremiumAnalyseInput): Promise<Uint8Array> {
  const DOG = S(input.dogName || "deinen Hund").slice(0, 40) || "deinen Hund";
  const BREED = S(input.breed || "").trim();
  const WISH = S(input.wishQuestion || "").trim();
  const C = input.content;
  const facts = (input.facts || []).filter((f) => f && f.value);

  const doc = await PDFDocument.create();
  const F = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  let coverImg: any = null;
  if (input.coverImage?.bytes?.length) {
    try { coverImg = /png/i.test(input.coverImage.type || "") ? await doc.embedPng(input.coverImage.bytes) : await doc.embedJpg(input.coverImage.bytes); } catch { coverImg = null; }
  }

  const pages: PDFPage[] = [];
  let p: PDFPage = null as any;
  let y = 0;
  let sectionNo = 0;

  const tw = (t: string, f: PDFFont, s: number) => f.widthOfTextAtSize(S(t), s);
  const wrap = (t: string, f: PDFFont, s: number, mw: number): string[] => {
    const ws = S(t).split(/\s+/); const ls: string[] = []; let c = "";
    for (const w of ws) { const x = c ? c + " " + w : w; if (f.widthOfTextAtSize(x, s) > mw && c) { ls.push(c); c = w; } else c = x; }
    if (c) ls.push(c); return ls;
  };
  const rrect = (pg: PDFPage, x: number, yy: number, w: number, h: number, r: number, o: any) => {
    if (o.color) { pg.drawRectangle({ x: x + r, y: yy, width: w - 2 * r, height: h, color: o.color }); pg.drawRectangle({ x, y: yy + r, width: w, height: h - 2 * r, color: o.color }); for (const [cx, cy] of [[x + r, yy + r], [x + w - r, yy + r], [x + r, yy + h - r], [x + w - r, yy + h - r]]) pg.drawCircle({ x: cx, y: cy, size: r, color: o.color }); }
    if (o.border) { const bw = o.borderWidth || 1; pg.drawLine({ start: { x: x + r, y: yy }, end: { x: x + w - r, y: yy }, thickness: bw, color: o.border }); pg.drawLine({ start: { x: x + r, y: yy + h }, end: { x: x + w - r, y: yy + h }, thickness: bw, color: o.border }); pg.drawLine({ start: { x, y: yy + r }, end: { x, y: yy + h - r }, thickness: bw, color: o.border }); pg.drawLine({ start: { x: x + w, y: yy + r }, end: { x: x + w, y: yy + h - r }, thickness: bw, color: o.border }); }
  };
  const addPage = () => {
    p = doc.addPage([A4_W, A4_H]);
    p.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
    p.drawRectangle({ x: 0, y: A4_H - 6, width: A4_W, height: 6, color: GOLD });
    pages.push(p); y = A4_H - 60;
  };
  const ensure = (need: number) => { if (y - need < BOTTOM) addPage(); };
  const center = (t: string, yy: number, f: PDFFont, s: number, color: any) => p.drawText(S(t), { x: (A4_W - tw(t, f, s)) / 2, y: yy, size: s, font: f, color });

  const para = (t: string, o: any = {}) => {
    const size = o.size ?? 11, color = o.color ?? TEXT_MEDIUM, font = o.font ?? F.regular, gap = o.gap ?? 15, lh = size + 8, x = o.x ?? MARGIN, mw = o.mw ?? CONTENT_W;
    for (const blk of S(t).split(/\n\n+/)) {
      for (const line of wrap(blk, font, size, mw)) { ensure(lh); p.drawText(line, { x, y, size, font, color }); y -= lh; }
      y -= gap;
    }
  };
  const sectionTitle = (t: string, opts: any = {}) => {
    const numbered = opts.num !== false; if (numbered) sectionNo++;
    ensure(80); y -= 38;
    const ts = 15.5;
    const lines = wrap(t, F.bold, ts, CONTENT_W - (numbered ? 36 : 0));
    const tx = numbered ? MARGIN + 36 : MARGIN;
    if (numbered) {
      const cy = y + ts * 0.33;
      p.drawCircle({ x: MARGIN + 12, y: cy, size: 12.5, color: GOLD });
      const d = String(sectionNo);
      p.drawText(d, { x: MARGIN + 12 - tw(d, F.bold, 11) / 2, y: cy - 3.9, size: 11, font: F.bold, color: WHITE });
    }
    for (const line of lines) { p.drawText(line, { x: tx, y, size: ts, font: F.bold, color: TEXT_DARK }); y -= ts + 9; }
    y -= 20;
  };
  const miniHead = (t: string) => { ensure(30); y -= 6; p.drawText(S(t), { x: MARGIN, y, size: 10.5, font: F.bold, color: DARK_BROWN }); y -= 18; };
  const subhead = (t: string) => { ensure(28); y -= 10; p.drawText(S(t), { x: MARGIN, y, size: 12, font: F.bold, color: TEXT_DARK }); y -= 19; };
  const bullet = (t: string) => {
    const ls = wrap(t, F.regular, 10.5, CONTENT_W - 20); ensure(ls.length * 16.5 + 11);
    p.drawCircle({ x: MARGIN + 4, y: y + 3, size: 2.2, color: GOLD });
    for (const [i, line] of ls.entries()) p.drawText(line, { x: MARGIN + 16, y: y - i * 16.5, size: 10.5, font: F.regular, color: TEXT_MEDIUM });
    y -= ls.length * 16.5 + 13;
  };
  const calloutBox = (label: string, t: string, bg: any = CREAM) => {
    const ls = wrap(t, F.regular, 11, CONTENT_W - 32); const bh = 48 + ls.length * 16; ensure(bh + 14);
    rrect(p, MARGIN, y - bh + 14, CONTENT_W, bh, 8, { color: bg }); p.drawRectangle({ x: MARGIN, y: y - bh + 14, width: 3, height: bh, color: GOLD });
    p.drawText(S(label), { x: MARGIN + 16, y: y - 6, size: 10, font: F.bold, color: DARK_BROWN }); let yy = y - 28;
    for (const line of ls) { p.drawText(line, { x: MARGIN + 16, y: yy, size: 11, font: F.regular, color: TEXT_DARK }); yy -= 16; }
    y = y - bh - 16;
  };
  const signalRow = (sig: string, mean: string) => {
    const sigLs = wrap(sig, F.bold, 11, CONTENT_W); const meanLs = wrap(mean, F.regular, 10.5, CONTENT_W - 16);
    ensure(sigLs.length * 15 + meanLs.length * 14.5 + 12);
    for (const l of sigLs) { p.drawText(l, { x: MARGIN, y, size: 11, font: F.bold, color: TEXT_DARK }); y -= 15.5; }
    for (const l of meanLs) { p.drawText(l, { x: MARGIN + 16, y, size: 10.5, font: F.regular, color: TEXT_MEDIUM }); y -= 15; }
    y -= 12;
  };

  // ── Diagramm: Reizschwellen-Kurve (Verständnis: Erregung über Reiz-Nähe) ──
  const thresholdDiagram = () => {
    const H = 188; ensure(H + 10);
    const x0 = MARGIN + 34, x1 = MARGIN + CONTENT_W - 12, plotW = x1 - x0;
    const yTop = y - 10, yBot = y - H + 30, plotH = yTop - yBot;
    const thr = yBot + plotH * 0.56;
    p.drawRectangle({ x: x0, y: yBot, width: plotW, height: thr - yBot, color: SOFT_GREEN });
    p.drawRectangle({ x: x0, y: thr, width: plotW, height: yTop - thr, color: rgb(252 / 255, 232 / 255, 230 / 255) });
    p.drawLine({ start: { x: x0, y: yBot }, end: { x: x1, y: yBot }, thickness: 1, color: TEXT_LIGHT });
    p.drawLine({ start: { x: x0, y: yBot }, end: { x: x0, y: yTop }, thickness: 1, color: TEXT_LIGHT });
    let prev: any = null;
    for (let i = 0; i <= 40; i++) { const t = i / 40; const px = x0 + t * plotW; const v = 1 / (1 + Math.exp(-(t * 12 - 6))); const py = yBot + 6 + v * (plotH - 12); if (prev) p.drawLine({ start: prev, end: { x: px, y: py }, thickness: 2.2, color: INK }); prev = { x: px, y: py }; }
    p.drawLine({ start: { x: x0, y: thr }, end: { x: x1, y: thr }, thickness: 1.2, color: RED_LINE, dashArray: [4, 3] });
    p.drawText("Reizschwelle", { x: x1 - tw("Reizschwelle", F.bold, 8.5) - 4, y: thr + 5, size: 8.5, font: F.bold, color: RED_LINE });
    p.drawText("ansprechbar - hier ist er bei dir", { x: x0 + 8, y: thr - 16, size: 8.5, font: F.bold, color: GREEN_LINE });
    p.drawText("über der Schwelle - nicht mehr erreichbar", { x: x0 + 8, y: yTop - 14, size: 8.5, font: F.bold, color: RED_LINE });
    p.drawText("Erregung", { x: MARGIN, y: yTop - 4, size: 8, font: F.regular, color: TEXT_LIGHT });
    p.drawText("Nähe zum Auslöser  ->", { x: x1 - tw("Nähe zum Auslöser  ->", F.regular, 8), y: yBot - 13, size: 8, font: F.regular, color: TEXT_LIGHT });
    y = yBot - 26;
  };

  // ── Diagramm: Sicherheitsabstand (Draufsicht) ──
  const distanceSketch = () => {
    const H = 104; ensure(H + 8);
    const midY = y - 34;
    const dogX = MARGIN + 46, trigX = MARGIN + CONTENT_W - 56;
    p.drawRectangle({ x: dogX, y: midY - 14, width: (trigX - dogX) * 0.6, height: 28, color: SOFT_GREEN });
    p.drawLine({ start: { x: dogX, y: midY }, end: { x: trigX, y: midY }, thickness: 1, color: TEXT_LIGHT, dashArray: [3, 3] });
    const dInit = (DOG.match(/[A-Za-zÄÖÜäöü]/)?.[0] || "H").toUpperCase();
    p.drawCircle({ x: dogX, y: midY, size: 13, color: DARK_BROWN });
    p.drawText(dInit, { x: dogX - tw(dInit, F.bold, 11) / 2, y: midY - 4, size: 11, font: F.bold, color: WHITE });
    p.drawCircle({ x: trigX, y: midY, size: 13, color: TEXT_LIGHT });
    p.drawText("?", { x: trigX - tw("?", F.bold, 11) / 2, y: midY - 4, size: 11, font: F.bold, color: WHITE });
    const dl = DOG.length > 16 ? DOG.slice(0, 15) + "." : DOG;
    p.drawText(dl, { x: dogX - tw(dl, F.regular, 8.5) / 2, y: midY - 26, size: 8.5, font: F.regular, color: TEXT_MEDIUM });
    p.drawText("Auslöser", { x: trigX - tw("Auslöser", F.regular, 8.5) / 2, y: midY - 26, size: 8.5, font: F.regular, color: TEXT_MEDIUM });
    p.drawText("Arbeitszone: so viel Abstand, dass " + DOG + " noch ansprechbar bleibt", { x: MARGIN, y: midY + 26, size: 8.5, font: F.bold, color: GREEN_LINE });
    y = midY - 40;
  };

  // ── Diagramm: Eskalationsleiter (Stress-Signale) ──
  const escalationLadder = () => {
    const rows = [
      [L5, "Pöbeln / Losschießen", "über der Schwelle - nicht mehr ansprechbar"],
      [L4, "Knurren, Bellen, Vorstoßen", "kurz vor der Eskalation"],
      [L3, "Fixieren, Erstarren, Lefzen", "die Vorboten - genau hier zeigt er es dir"],
      [L2, "Leichte Anspannung, Ohren vor", "erste Anzeichen"],
      [L1, "Entspannt, locker, ansprechbar", "alles gut - so willst du ihn sehen"],
    ];
    const rh = 41, H = rows.length * rh + 16; ensure(H + 8);
    let ty = y;
    rows.forEach((r, i) => {
      rrect(p, MARGIN, ty - rh + 6, CONTENT_W, rh - 8, 6, { color: r[0] as any });
      p.drawText(S(r[1]), { x: MARGIN + 16, y: ty - 16, size: 11, font: F.bold, color: TEXT_DARK });
      p.drawText(S(r[2]), { x: MARGIN + 16, y: ty - 29, size: 8.5, font: F.regular, color: TEXT_MEDIUM });
      if (i === 2) p.drawText("<- früh erkennen", { x: MARGIN + CONTENT_W - tw("<- früh erkennen", F.bold, 9) - 14, y: ty - 21, size: 9, font: F.bold, color: RED_LINE });
      ty -= rh;
    });
    p.drawText("Erregung steigt nach oben", { x: MARGIN, y: ty - 2, size: 8, font: F.italic, color: TEXT_LIGHT });
    y = ty - 16;
  };

  // ── Diagramm: Persönlichkeits-Achsen ──
  const personalityAxes = (axes: { label: string; left: string; right: string; pos: number }[]) => {
    const ax = (axes || []).slice(0, 4); if (!ax.length) return;
    const rowH = 54; ensure(ax.length * rowH + 14);
    const x0 = MARGIN + 6, x1 = MARGIN + CONTENT_W - 6, trackW = x1 - x0;
    ax.forEach((a) => {
      y -= 9;
      p.drawText(S(a.label), { x: x0, y: y, size: 9.5, font: F.bold, color: DARK_BROWN });
      const ty = y - 19;
      p.drawLine({ start: { x: x0, y: ty }, end: { x: x1, y: ty }, thickness: 3, color: TRACK });
      const pos = Math.max(0, Math.min(1, Number(a.pos) || 0.5));
      const dx = x0 + pos * trackW;
      p.drawCircle({ x: dx, y: ty, size: 6.5, color: GOLD });
      p.drawCircle({ x: dx, y: ty, size: 2.5, color: WHITE });
      p.drawText(S(a.left), { x: x0, y: ty - 13, size: 8, font: F.regular, color: TEXT_MEDIUM });
      p.drawText(S(a.right), { x: x1 - tw(a.right, F.regular, 8), y: ty - 13, size: 8, font: F.regular, color: TEXT_MEDIUM });
      y -= rowH - 9;
    });
    y -= 18;
  };

  // ── Diagramm: Lebensphasen-Leiste ──
  const lifePhaseBar = (nowLabel: string) => {
    const phases = ["Welpe", "Junghund", "Reife", "Erwachsen", "Senior"];
    const lk = S(nowLabel).toLowerCase();
    let idx = phases.findIndex((ph) => lk.includes(ph.toLowerCase()));
    if (idx < 0) { if (lk.includes("adoles") || lk.includes("pubert")) idx = 1; else if (lk.includes("alt")) idx = 4; else idx = 3; }
    const H = 70; ensure(H + 8);
    const segW = CONTENT_W / phases.length, barY = y - 30, barH = 22;
    phases.forEach((ph, i) => {
      const sx = MARGIN + i * segW;
      const active = i === idx;
      rrect(p, sx + 2, barY, segW - 4, barH, 4, { color: active ? GOLD : rgb(0.95, 0.92, 0.86) });
      p.drawText(ph, { x: sx + (segW - tw(ph, active ? F.bold : F.regular, 9)) / 2, y: barY + 7, size: 9, font: active ? F.bold : F.regular, color: active ? WHITE : TEXT_MEDIUM });
      if (active) { const cx = sx + segW / 2; p.drawText("aktuell", { x: cx - tw("aktuell", F.bold, 8) / 2, y: barY + barH + 6, size: 8, font: F.bold, color: DARK_BROWN }); }
    });
    y = barY - 18;
  };

  // ── Diagramm: Auslastungs-Balance (Kopf / Körper / Ruhe) ──
  const needsBalanceBars = (b: { kopf: number; koerper: number; ruhe: number }) => {
    const rows: [string, number, any][] = [
      ["Kopfarbeit", Number(b?.kopf) || 0, rgb(0.42, 0.55, 0.78)],
      ["Körperliche Auslastung", Number(b?.koerper) || 0, rgb(0.78, 0.55, 0.40)],
      ["Echte Ruhe", Number(b?.ruhe) || 0, rgb(0.45, 0.66, 0.52)],
    ];
    const maxV = Math.max(1, ...rows.map((r) => r[1]));
    const rowH = 30, H = rows.length * rowH + 10; ensure(H + 8);
    const labelW = 150, x0 = MARGIN + labelW, barMaxW = CONTENT_W - labelW - 44;
    rows.forEach((r) => {
      p.drawText(r[0], { x: MARGIN, y: y - 14, size: 10, font: F.bold, color: TEXT_DARK });
      const bw = Math.max(4, (r[1] / maxV) * barMaxW);
      rrect(p, x0, y - 18, barMaxW, 13, 3, { color: rgb(0.95, 0.93, 0.89) });
      rrect(p, x0, y - 18, bw, 13, 3, { color: r[2] });
      p.drawText(`${Math.round(r[1])}%`, { x: x0 + barMaxW + 8, y: y - 15, size: 9.5, font: F.bold, color: TEXT_MEDIUM });
      y -= rowH;
    });
    y -= 8;
  };

  // ── Hunde-Profil-Karte ──
  const factsCard = () => {
    if (!facts.length) return;
    const labelW = 158, valX = MARGIN + labelW + 14, valW = MARGIN + CONTENT_W - 16 - valX;
    const rowHs = facts.map((f) => Math.max(20, wrap(f.value, F.regular, 10.5, valW).length * 14.5 + 6));
    const bh = rowHs.reduce((a, b) => a + b, 0) + 18; ensure(bh + 10);
    rrect(p, MARGIN, y - bh, CONTENT_W, bh, 10, { color: CARD_BG, border: BORDER_LIGHT });
    let ry = y - 22;
    facts.forEach((f, i) => {
      // Lange Labels automatisch verkleinern, damit sie nie in den Wert laufen.
      let ls = 10; while (ls > 8 && tw(f.label, F.bold, ls) > labelW - 14) ls -= 0.5;
      p.drawText(S(f.label), { x: MARGIN + 16, y: ry, size: ls, font: F.bold, color: DARK_BROWN });
      let vy = ry; for (const vl of wrap(f.value, F.regular, 10.5, valW)) { p.drawText(vl, { x: valX, y: vy, size: 10.5, font: F.regular, color: TEXT_DARK }); vy -= 14.5; }
      ry -= rowHs[i];
    });
    y = y - bh - 14;
  };

  // ════════════════════ DECKBLATT ════════════════════
  addPage();
  p.drawRectangle({ x: 0, y: A4_H - 248, width: A4_W, height: 242, color: CREAM });
  p.drawRectangle({ x: 0, y: A4_H - 248, width: A4_W, height: 4, color: GOLD });
  const pill = "PFOTEN-PLAN · PREMIUM"; const pw = tw(pill, F.bold, 9) + 20;
  rrect(p, MARGIN, A4_H - 96, pw, 22, 4, { color: GOLD }); p.drawText(pill, { x: MARGIN + 10, y: A4_H - 90, size: 9, font: F.bold, color: WHITE });
  p.drawText("Persönliche", { x: MARGIN, y: A4_H - 150, size: 31, font: F.bold, color: TEXT_DARK });
  p.drawText("Verhaltens-Analyse", { x: MARGIN, y: A4_H - 187, size: 31, font: F.bold, color: DARK_BROWN });
  p.drawText("So tickt dein Hund wirklich", { x: MARGIN, y: A4_H - 215, size: 13, font: F.regular, color: TEXT_MEDIUM });
  let cyc = A4_H - 280;
  if (coverImg) {
    const boxH = 168; const ar = coverImg.width / coverImg.height;
    let iw = boxH * ar, ih = boxH; if (iw > CONTENT_W) { iw = CONTENT_W; ih = iw / ar; }
    const ix = (A4_W - iw) / 2, iy = cyc - ih;
    p.drawImage(coverImg, { x: ix, y: iy, width: iw, height: ih });
    rrect(p, ix - 1, iy - 1, iw + 2, ih + 2, 2, { border: BORDER_LIGHT, borderWidth: 1.5 });
    cyc = iy - 28;
  }
  center("Erstellt für " + DOG, cyc, F.bold, 22, TEXT_DARK); cyc -= 24;
  const subc = [BREED, S(input.age || ""), input.problemLabel ? "Thema: " + S(input.problemLabel) : ""].filter(Boolean).join("  ·  ");
  if (subc) { center(subc, cyc, F.regular, 12, TEXT_MEDIUM); cyc -= 30; }
  if (C.summary) {
    const ls = wrap(C.summary, F.regular, 11.5, CONTENT_W - 32); const bh = 52 + ls.length * 16;
    rrect(p, MARGIN, cyc - bh, CONTENT_W, bh, 10, { color: rgb(0.99, 0.985, 0.975), border: BORDER_LIGHT });
    p.drawRectangle({ x: MARGIN, y: cyc - bh, width: 3, height: bh, color: GOLD });
    p.drawText("KERN-BEFUND", { x: MARGIN + 16, y: cyc - 22, size: 9, font: F.bold, color: DARK_BROWN });
    let ly = cyc - 42; for (const line of ls) { p.drawText(line, { x: MARGIN + 16, y: ly, size: 11.5, font: F.regular, color: TEXT_DARK }); ly -= 16; }
  }
  center("Ein tiefes Verständnis-Gutachten - die Ergänzung zu deinem Trainingsplan.", 88, F.italic, 10, TEXT_LIGHT);

  // ════════════════════ INHALT ════════════════════
  addPage();
  sectionTitle("Inhalt", { num: false });
  for (const t of [
    "Dein Hund auf einen Blick",
    "1. Das verstehe ich aus deiner Schilderung",
    "2. Die wahrscheinliche Ursache",
    `3. Woher ${DOG} kommt - Rasse, Herkunft & Erbe`,
    "4. Gesundheit & Körper (informativ)",
    `5. ${DOG}s Persönlichkeit & Psyche`,
    `6. Wo ${DOG} gerade steht - die Lebensphase`,
    "7. Sozialverhalten & Verträglichkeit",
    `8. ${DOG} lesen lernen - seine Körpersprache`,
    `9. Was ${DOG} im Alltag wirklich braucht`,
    "10. Warum es bisher nicht geklappt hat",
    "11. So verbindest du das mit deinem Training",
    "12. Häufige Fragen zu deinem Fall",
    `13. ${DOG} in einem Jahr`,
    "14. Ein ehrliches Wort",
  ]) { ensure(22); p.drawText(t, { x: MARGIN + 4, y, size: 11.5, font: F.regular, color: TEXT_MEDIUM }); y -= 22; }

  // ════════════════════ INHALT ════════════════════
  sectionTitle("Dein Hund auf einen Blick", { num: false }); factsCard();

  sectionTitle("Das verstehe ich aus deiner Schilderung"); para(C.intro);
  if (C.photoObservation) calloutBox("Was ich auf deinen Bildern sehe", C.photoObservation);
  if (C.wishAnswer) calloutBox(WISH ? `Du wolltest wissen: "${WISH}"` : "Was du am liebsten verstehen wolltest", C.wishAnswer, rgb(0.96, 0.97, 0.99));

  sectionTitle("Die wahrscheinliche Ursache"); para(C.diagnosis);
  miniHead("So kannst du dir seine Erregung vorstellen:"); thresholdDiagram();
  miniHead("Und so viel Abstand braucht er, um ansprechbar zu bleiben:"); distanceSketch();
  if (C.distanceNote) para(C.distanceNote, { size: 10.5 });

  sectionTitle(`Woher ${DOG} kommt - Rasse, Herkunft & Erbe`); para(C.breedHeritage);

  sectionTitle("Gesundheit & Körper");
  para("Rein informativ und keine Diagnose - aber gerade bei plötzlichem oder hartnäckigem Verhalten lohnt der Blick auf den Körper.", { size: 10.5 });
  if (C.health?.topics?.length) { miniHead("Rassetypische Themen, die du im Blick behalten solltest:"); for (const t of C.health.topics) bullet(t); }
  if (C.health?.bodyCondition) { subhead("Körperbau & Idealgewicht"); para(C.health.bodyCondition); }
  if (C.health?.nutrition) { subhead("Ernährungs-Check"); para(C.health.nutrition); }
  if (C.health?.medicalNote) calloutBox("Wann du Verhalten tierärztlich abklären solltest", C.health.medicalNote, WARN);

  sectionTitle(`${DOG}s Persönlichkeit & Psyche`);
  if (C.personality?.typeName || C.personality?.type) {
    const name = S(C.personality.typeName || C.personality.type);
    const desc = C.personality.typeName ? S(C.personality.type) : "";
    const bh = desc ? 64 : 50; ensure(bh + 10);
    rrect(p, MARGIN, y - bh, CONTENT_W, bh, 10, { color: CREAM, border: GOLD, borderWidth: 1.3 });
    p.drawRectangle({ x: MARGIN, y: y - bh, width: 4, height: bh, color: GOLD });
    p.drawText("PERSÖNLICHKEITS-TYP", { x: MARGIN + 18, y: y - 18, size: 8.5, font: F.bold, color: DARK_BROWN });
    p.drawText(name, { x: MARGIN + 18, y: y - 40, size: 16.5, font: F.bold, color: TEXT_DARK });
    if (desc) p.drawText(desc, { x: MARGIN + 18, y: y - 55, size: 9.5, font: F.italic, color: TEXT_MEDIUM });
    y -= bh + 18;
  }
  if (C.personality?.text) para(C.personality.text);
  if (C.personality?.axes?.length) { miniHead("Wo " + DOG + " im Wesen steht:"); personalityAxes(C.personality.axes); }
  if (C.personality?.stress) { subhead("Stresslevel - und was ihn runterbringt"); para(C.personality.stress); }
  if (C.personality?.bond) { subhead("Eure Bindung"); para(C.personality.bond); }

  sectionTitle(`Wo ${DOG} gerade steht - die Lebensphase`);
  if (C.lifePhase?.now) lifePhaseBar(C.lifePhase.now);
  if (C.lifePhase?.text) para(C.lifePhase.text);
  if (C.lifePhase?.ahead) { subhead("Was in den nächsten 1-3 Jahren auf euch zukommt"); para(C.lifePhase.ahead); }

  sectionTitle("Sozialverhalten & Verträglichkeit"); para(C.socialBehavior);

  sectionTitle(`${DOG} lesen lernen - seine Körpersprache`);
  if (C.bodyLanguageIntro) para(C.bodyLanguageIntro);
  for (const s of (C.bodyLanguageSignals || [])) signalRow(s.signal, s.meaning);
  miniHead("So eskaliert Stress - lerne, es früh zu sehen:"); escalationLadder();

  sectionTitle(`Was ${DOG} im Alltag wirklich braucht`); para(C.dailyNeeds);
  if (C.needsBalance) { miniHead("Seine gesunde Tages-Balance (Kopf / Körper / Ruhe):"); needsBalanceBars(C.needsBalance); }

  sectionTitle("Warum es bisher nicht geklappt hat"); para(C.whyFailed);

  sectionTitle("So verbindest du das mit deinem Training");
  para(C.planBridge);

  if (C.faq?.length) {
    sectionTitle("Häufige Fragen zu deinem Fall");
    for (const f of C.faq) { ensure(46); para(f.q, { size: 11, font: F.bold, color: TEXT_DARK, gap: 4 }); para(f.a, { size: 10.5, color: TEXT_MEDIUM }); }
  }

  if (C.vision) {
    sectionTitle(`${DOG} in einem Jahr`);
    para("Stell dir vor, wo ihr in zwölf Monaten stehen könnt - wenn du dieses Verständnis mit deinem Trainingsplan verbindest:", { size: 10.5, font: F.italic, color: DARK_BROWN });
    para(C.vision);
  }

  sectionTitle("Ein ehrliches Wort"); para(C.closing);
  if (C.dangerNote) calloutBox("Wichtiger Sicherheits-Hinweis", C.dangerNote, WARN);

  // ════════════════════ FOOTER ════════════════════
  const TOTAL = pages.length;
  pages.forEach((pg, i) => {
    if (i === 0) { pg.drawRectangle({ x: 0, y: 0, width: A4_W, height: 3, color: GOLD }); return; }
    const dl = wrap(DISCLAIMER, F.italic, 7.5, CONTENT_W); let dy = 30 + dl.length * 9;
    for (const line of dl) { const w = tw(line, F.italic, 7.5); pg.drawText(line, { x: (A4_W - w) / 2, y: dy, size: 7.5, font: F.italic, color: TEXT_LIGHT }); dy -= 9; }
    const meta = `Pfoten-Plan · Persönliche Analyse für ${DOG} · Seite ${i + 1}/${TOTAL}`; const mw = tw(meta, F.regular, 8);
    pg.drawText(meta, { x: (A4_W - mw) / 2, y: 16, size: 8, font: F.regular, color: TEXT_LIGHT });
    pg.drawRectangle({ x: 0, y: 0, width: A4_W, height: 3, color: GOLD });
  });

  return await doc.save();
}
