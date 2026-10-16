// Produkt-PDF "Was dein Hund dir sagen will — Körpersprache lesen" (19,90 €).
// Fester Inhalt aus lib/koerpersprache-content.ts + Zeichnungen aus
// public/koerpersprache/kNN.jpg. Personalisiert: Titel, Einleitung, Fokus-Seite.
// Keine KI beim Kauf -> sofort und zuverlaessig.
// Export: buildKoerperspracheHeft({ dogName, breed, problem }) -> Uint8Array

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from "pdf-lib";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  SIGNALE, SIGNAL_BY_KEY, AMPEL_TEXT, GRUNDREGELN, IRRTUEMER, REGELN_VERHALTEN,
  SITUATIONEN, BEOBACHTUNGSPLAN, SPICKZETTEL, PROBLEM_FOKUS, FOKUS_DEFAULT, PROBLEM_LABEL,
  ALLTAG, RUHE, AUSLASTUNG, KEINE_PANIK,
  type Ampel, type Signal,
} from "./koerpersprache-content";

const W = 595.28, H = 841.89, M = 50, CW = W - 2 * M;
const GOLD = rgb(196 / 255, 165 / 255, 118 / 255), BRAUN = rgb(139 / 255, 115 / 255, 85 / 255);
const DUNKEL = rgb(42 / 255, 33 / 255, 24 / 255), TEXT = rgb(40 / 255, 36 / 255, 32 / 255);
const GRAU = rgb(110 / 255, 104 / 255, 96 / 255), HELL = rgb(250 / 255, 246 / 255, 238 / 255);
const LINIE = rgb(226 / 255, 214 / 255, 194 / 255), WEISS = rgb(1, 1, 1);
const AMPEL_FARBE: Record<Ampel, ReturnType<typeof rgb>> = {
  gruen: rgb(63 / 255, 128 / 255, 82 / 255),
  gelb: rgb(201 / 255, 150 / 255, 40 / 255),
  rot: rgb(178 / 255, 58 / 255, 44 / 255),
};

// Nur WinAnsi-Zeichen durchlassen (StandardFonts).
const S = (s: any) =>
  String(s == null ? "" : s)
    .replace(/[→←⇒▶]/g, "-")
    .replace(/[\u{1F000}-\u{1FAFF}☀-➿️]/gu, "")
    .replace(/…/g, "...");

interface F { r: PDFFont; b: PDFFont; i: PDFFont; }

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const absatz of S(text).split("\n")) {
    let z = "";
    for (const w of absatz.split(/\s+/).filter(Boolean)) {
      const t = z ? z + " " + w : w;
      if (font.widthOfTextAtSize(t, size) > maxW && z) { out.push(z); z = w; } else z = t;
    }
    out.push(z);
  }
  return out;
}

class Heft {
  doc: PDFDocument; f: F; page!: PDFPage; y = 0; seite = 0; dogName: string;
  bilder = new Map<string, PDFImage>();
  constructor(doc: PDFDocument, f: F, dogName: string) { this.doc = doc; this.f = f; this.dogName = dogName; }

  neueSeite() {
    this.page = this.doc.addPage([W, H]);
    this.seite++;
    this.page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: HELL });
    this.page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: GOLD });
    if (this.seite > 1) {
      const fuss = S(`Was ${this.dogName} dir sagen will  ·  Pfoten-Plan`);
      this.page.drawText(fuss, { x: M, y: 28, size: 8, font: this.f.r, color: GRAU });
      const n = String(this.seite);
      this.page.drawText(n, { x: W - M - this.f.r.widthOfTextAtSize(n, 8), y: 28, size: 8, font: this.f.r, color: GRAU });
    }
    this.y = H - 60;
  }
  platz(h: number) { if (this.y - h < 60) this.neueSeite(); }

  text(t: string, o: { size?: number; font?: PDFFont; color?: any; x?: number; w?: number; lh?: number } = {}) {
    const size = o.size ?? 10.5, font = o.font ?? this.f.r, x = o.x ?? M, w = o.w ?? CW, lh = o.lh ?? size * 1.45;
    for (const z of wrap(t, font, size, w)) {
      this.platz(lh);
      this.page.drawText(z, { x, y: this.y - size, size, font, color: o.color ?? TEXT });
      this.y -= lh;
    }
  }
  titel(t: string, unter?: string) {
    this.platz(70);
    this.text(t, { size: 22, font: this.f.b, color: DUNKEL, lh: 28 });
    this.page.drawRectangle({ x: M, y: this.y - 2, width: 44, height: 2.5, color: GOLD });
    this.y -= 14;
    if (unter) { this.text(unter, { size: 11, color: GRAU }); this.y -= 6; }
  }
  zwischen(t: string) { this.platz(40); this.y -= 6; this.text(t, { size: 13.5, font: this.f.b, color: BRAUN, lh: 19 }); this.y -= 2; }

  bild(file: string): PDFImage | null {
    return this.bilder.get(file) || null;
  }

  ampelChip(a: Ampel, x: number, y: number) {
    const t = S(`${AMPEL_TEXT[a].label}: ${AMPEL_TEXT[a].kurz}`);
    const w = this.f.b.widthOfTextAtSize(t, 8) + 14;
    this.page.drawRectangle({ x, y: y - 3, width: w, height: 14, color: AMPEL_FARBE[a] });
    this.page.drawText(t, { x: x + 7, y: y + 1, size: 8, font: this.f.b, color: WEISS });
  }

  signalKarte(s: Signal, nr: number) {
    const bildW = 168, bildH = 126, gap = 16, textX = M + bildW + gap, textW = CW - bildW - gap;
    // Hoehe vorab schaetzen
    const zeilen = (t: string, sz: number, w: number) => wrap(t, this.f.r, sz, w).length;
    const hText = 22 + 20 + 3 * 15 + (zeilen(s.siehst, 9.2, textW) + zeilen(s.bedeutet, 9.2, textW) + zeilen(s.tust, 9.2, textW)) * 12.4;
    const hIrrtum = s.irrtum ? zeilen(s.irrtum, 9.2, CW - 24) * 12.4 + 18 : 0;
    const h = Math.max(bildH, hText) + hIrrtum + 14;
    this.platz(h);
    const top = this.y;
    this.page.drawRectangle({ x: M - 10, y: top - h + 8, width: CW + 20, height: h, color: WEISS, borderColor: LINIE, borderWidth: 1 });
    const img = this.bild(s.bild);
    if (img) this.page.drawImage(img, { x: M, y: top - bildH, width: bildW, height: bildH });
    let ty = top;
    this.page.drawText(S(`${nr}. ${s.titel}`), { x: textX, y: ty - 13, size: 12.5, font: this.f.b, color: DUNKEL });
    ty -= 22;
    this.ampelChip(s.ampel, textX, ty - 10);
    ty -= 20;
    const block = (label: string, t: string) => {
      this.page.drawText(S(label), { x: textX, y: ty - 8.5, size: 8, font: this.f.b, color: BRAUN });
      ty -= 13;
      for (const z of wrap(t, this.f.r, 9.2, textW)) {
        this.page.drawText(z, { x: textX, y: ty - 9.2, size: 9.2, font: this.f.r, color: TEXT });
        ty -= 12.4;
      }
      ty -= 2;
    };
    block("WAS DU SIEHST", s.siehst);
    block("WAS ES MEISTENS BEDEUTET", s.bedeutet);
    block("WAS DU JETZT TUST", s.tust);
    this.y = Math.min(ty, top - bildH) - 6;
    if (s.irrtum) {
      const zl = wrap(s.irrtum, this.f.i, 9.2, CW - 24);
      const bh = zl.length * 12.4 + 10;
      this.page.drawRectangle({ x: M, y: this.y - bh, width: CW, height: bh, color: rgb(253 / 255, 243 / 255, 230 / 255) });
      this.page.drawRectangle({ x: M, y: this.y - bh, width: 3, height: bh, color: GOLD });
      let iy = this.y - 6;
      for (const z of zl) { this.page.drawText(z, { x: M + 12, y: iy - 9.2, size: 9.2, font: this.f.i, color: TEXT }); iy -= 12.4; }
      this.y -= bh + 2;
    }
    this.y -= 16;
  }
}

export async function buildKoerperspracheHeft(input: {
  dogName?: string | null; breed?: string | null; problem?: string | null;
}): Promise<Uint8Array> {
  const dogName = S((input.dogName || "").trim() || "dein Hund");
  const dogCap = dogName.charAt(0).toUpperCase() + dogName.slice(1);
  const breed = S((input.breed || "").trim());
  const problem = String(input.problem || "");

  const doc = await PDFDocument.create();
  doc.setTitle(`Was ${dogCap} dir sagen will`);
  doc.setAuthor("Pfoten-Plan");
  const f: F = {
    r: await doc.embedFont(StandardFonts.Helvetica),
    b: await doc.embedFont(StandardFonts.HelveticaBold),
    i: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const h = new Heft(doc, f, dogCap);

  // Bilder laden (fehlende werden still uebersprungen)
  const dir = join(process.cwd(), "public", "koerpersprache");
  const dateien = new Set<string>([...SIGNALE.map((s) => s.bild), ...ALLTAG.map((s) => s.bild), "k19.jpg", "k20.jpg", "k27.jpg"]);
  for (const d of dateien) {
    const p = join(dir, d);
    if (existsSync(p)) h.bilder.set(d, await doc.embedJpg(readFileSync(p)));
  }

  // ── 1 Titelseite ────────────────────────────────────────────────
  h.neueSeite();
  h.page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(247 / 255, 239 / 255, 224 / 255) });
  h.page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: GOLD });
  const cover = h.bild("k20.jpg");
  if (cover) h.page.drawImage(cover, { x: M, y: H - 120 - 372, width: CW, height: 372 });
  let cy = H - 540;
  h.page.drawText(S("KÖRPERSPRACHE LESEN"), { x: M, y: cy, size: 11, font: f.b, color: BRAUN });
  cy -= 40;
  for (const z of wrap(`Was ${dogCap} dir sagen will`, f.b, 32, CW)) { h.page.drawText(z, { x: M, y: cy, size: 32, font: f.b, color: DUNKEL }); cy -= 38; }
  h.page.drawRectangle({ x: M, y: cy + 22, width: 60, height: 3, color: GOLD });
  cy -= 6;
  for (const z of wrap("24 Signale, die du ab heute verstehst, und was du dann tust. Dazu: wie du ihn zur Ruhe bringst und richtig auslastest.", f.r, 13, CW)) {
    h.page.drawText(z, { x: M, y: cy, size: 13, font: f.r, color: GRAU }); cy -= 19;
  }
  if (breed) { cy -= 8; h.page.drawText(S(`Für ${dogCap}${breed ? ` (${breed})` : ""}`), { x: M, y: cy, size: 11, font: f.b, color: BRAUN }); }

  // ── 2 So nutzt du dieses Heft ───────────────────────────────────
  h.neueSeite();
  h.titel(`${dogCap} spricht mit dir. Ständig.`, "Nur eben nicht mit Worten.");
  h.text(`Hunde zeigen fast alles, was sie fühlen, mit dem Körper: Unsicherheit, Freude, Stress und auch die Warnung, bevor es knallt. Die meisten Missverständnisse zwischen Mensch und Hund entstehen nicht, weil der Hund „nicht hört“, sondern weil wir seine Signale übersehen.`);
  h.y -= 6;
  h.text(`Wenn du diese Signale lesen kannst, ändert sich viel: Du siehst früher, wann ${dogName} etwas zu viel wird. Du kannst eingreifen, bevor er bellt, zieht oder schnappt. Und ${dogName} merkt, dass du ihn verstehst. Das ist die Grundlage für jedes Training.`);
  h.zwischen("Die Ampel");
  h.text("Jedes Signal in diesem Heft hat eine Farbe. So weißt du auf einen Blick, wie dringend es ist:");
  h.y -= 4;
  for (const a of ["gruen", "gelb", "rot"] as Ampel[]) {
    h.platz(22);
    h.ampelChip(a, M, h.y - 12);
    h.y -= 24;
  }
  h.zwischen("Drei Grundregeln");
  GRUNDREGELN.forEach((g, i) => {
    h.text(`${i + 1}. ${g.titel}`, { font: f.b, size: 11, color: DUNKEL });
    h.text(g.text, { x: M + 14, w: CW - 14 });
    h.y -= 4;
  });

  // ── 3 Fokus-Seite ───────────────────────────────────────────────
  const fokus = PROBLEM_FOKUS[problem] || FOKUS_DEFAULT;
  const problemLabel = PROBLEM_LABEL[problem];
  h.neueSeite();
  h.titel(
    problemLabel ? `Deine wichtigsten Signale bei ${problemLabel}` : `Die wichtigsten Signale für ${dogName}`,
    `Wenn du nur vier Signale lernst, dann diese.`
  );
  h.text(fokus.text);
  h.y -= 10;
  fokus.keys.forEach((k, i) => {
    const s = SIGNAL_BY_KEY[k]; if (!s) return;
    h.platz(120);
    const top = h.y, img = h.bild(s.bild);
    h.page.drawRectangle({ x: M - 6, y: top - 108, width: CW + 12, height: 110, color: WEISS, borderColor: LINIE, borderWidth: 1 });
    if (img) h.page.drawImage(img, { x: M, y: top - 100, width: 128, height: 96 });
    const tx = M + 142, tw = CW - 142;
    h.page.drawText(S(`${i + 1}. ${s.titel}`), { x: tx, y: top - 16, size: 12, font: f.b, color: DUNKEL });
    h.ampelChip(s.ampel, tx, top - 36);
    let ty = top - 52;
    for (const z of wrap(s.tust, f.r, 9.5, tw).slice(0, 4)) { h.page.drawText(z, { x: tx, y: ty - 9.5, size: 9.5, font: f.r, color: TEXT }); ty -= 13; }
    h.y = top - 118;
  });
  h.y -= 4;
  h.text("Alle Details zu diesen Signalen findest du auf den nächsten Seiten.", { size: 9.5, color: GRAU, font: f.i });

  // ── 4 Signal-Karten ─────────────────────────────────────────────
  const gruppen: { a: Ampel; titel: string; unter: string }[] = [
    { a: "gruen", titel: "Grün: So sieht Wohlfühlen aus", unter: "Diese Signale zeigen dir, wie dein Hund aussieht, wenn alles in Ordnung ist." },
    { a: "gelb", titel: "Gelb: „Mir ist nicht ganz wohl“", unter: "Leise Signale, mit denen dein Hund sich selbst und andere beruhigen will. Hier kannst du am leichtesten helfen." },
    { a: "rot", titel: "Rot: „Hör auf, sonst …“", unter: "Deutliche Warnungen. Jetzt brauchst du Abstand, keine Diskussion." },
  ];
  let nr = 1;
  for (const g of gruppen) {
    h.neueSeite();
    h.titel(g.titel, g.unter);
    for (const s of SIGNALE.filter((x) => x.ampel === g.a)) h.signalKarte(s, nr++);
  }

  // ── 4b Alltagssignale ───────────────────────────────────────────
  h.neueSeite();
  h.titel(`Was ${dogName} von dir will`, "Alltagssignale: Bedürfnisse, die er dir zeigt, und wie du klug darauf reagierst.");
  for (const s of ALLTAG) h.signalKarte(s, nr++);

  // ── 4c Zur Ruhe bringen ─────────────────────────────────────────
  h.neueSeite();
  h.titel(`So bringst du ${dogName} zur Ruhe`, "Sechs Wege, die bei den meisten Hunden wirken. Probier aus, was zu euch passt.");
  RUHE.forEach((r, i) => {
    h.platz(110);
    h.text(`${i + 1}. ${r.titel}`, { font: f.b, size: 12.5, color: DUNKEL, lh: 18 });
    h.text(r.warum, { color: GRAU, size: 10, x: M + 14, w: CW - 14 });
    h.y -= 2;
    r.so.forEach((z) => h.text(`·  ${z}`, { x: M + 20, w: CW - 20, size: 10 }));
    h.y -= 10;
  });

  // ── 4d Auslastung ───────────────────────────────────────────────
  h.neueSeite();
  h.titel("Wenn er Auslauf braucht", "Richtig auslasten heißt nicht: mehr rennen.");
  h.text(AUSLASTUNG.einleitung, { size: 11 });
  h.y -= 6;
  for (const a of AUSLASTUNG.arten) {
    h.text(a.titel, { font: f.b, size: 12, color: BRAUN, lh: 17 });
    h.text(a.text, { x: M + 14, w: CW - 14 });
    h.y -= 6;
  }
  h.zwischen("Fünf Ideen für heute");
  AUSLASTUNG.ideen.forEach((z) => h.text(`·  ${z}`, { x: M + 6, w: CW - 6 }));
  h.y -= 10;
  for (const t of [AUSLASTUNG.achtung, AUSLASTUNG.ruhe]) {
    const zl = wrap(t, f.r, 10, CW - 24); const bh = zl.length * 14 + 14;
    h.platz(bh + 10);
    h.page.drawRectangle({ x: M, y: h.y - bh, width: CW, height: bh, color: rgb(253 / 255, 243 / 255, 230 / 255) });
    h.page.drawRectangle({ x: M, y: h.y - bh, width: 3, height: bh, color: GOLD });
    let iy = h.y - 8;
    for (const z of zl) { h.page.drawText(z, { x: M + 12, y: iy - 10, size: 10, font: f.r, color: TEXT }); iy -= 14; }
    h.y -= bh + 10;
  }

  // ── 4e Keine Panik ──────────────────────────────────────────────
  h.neueSeite();
  h.titel("Keine Panik", "Was harmlos aussieht oder klingt, und wann du doch zum Tierarzt solltest.");
  for (const k of KEINE_PANIK) {
    h.platz(k.bild ? 260 : 90);
    if (k.bild && h.bild(k.bild)) {
      h.page.drawImage(h.bild(k.bild)!, { x: M, y: h.y - 150, width: 200, height: 150 });
      h.y -= 160;
    }
    h.text(k.titel, { font: f.b, size: 13, color: DUNKEL, lh: 19 });
    h.text(k.was);
    h.y -= 2;
    h.text("Was du tust", { font: f.b, size: 9, color: BRAUN });
    h.text(k.tun, { x: M + 10, w: CW - 10 });
    h.y -= 2;
    h.text("Ab zum Tierarzt", { font: f.b, size: 9, color: AMPEL_FARBE.rot });
    h.text(k.tierarzt, { x: M + 10, w: CW - 10 });
    h.y -= 12;
  }
  h.text("Diese Seite ersetzt keine tierärztliche Untersuchung. Im Zweifel lieber einmal zu oft anrufen.", { size: 8.5, color: GRAU, font: f.i });

  // ── 5 Irrtuemer ─────────────────────────────────────────────────
  h.neueSeite();
  h.titel("Fünf Irrtümer, die fast alle glauben", "Und was wirklich dahintersteckt.");
  for (const ir of IRRTUEMER) {
    h.platz(60);
    h.text(ir.glaube, { font: f.b, size: 11.5, color: DUNKEL });
    h.text(ir.wahr, { x: M + 14, w: CW - 14 });
    h.y -= 8;
  }
  h.zwischen("So verhältst du dich ab heute");
  REGELN_VERHALTEN.forEach((r, i) => {
    h.text(`${i + 1}. ${r.titel}`, { font: f.b, size: 11, color: DUNKEL });
    h.text(r.text, { x: M + 14, w: CW - 14 });
    h.y -= 4;
  });

  // ── 6 Situationen ───────────────────────────────────────────────
  h.neueSeite();
  h.titel("Körpersprache im Alltag", "Vier Situationen, in denen du das Gelernte sofort brauchst.");
  for (const sit of SITUATIONEN) {
    if (sit.titel.startsWith("Kinder")) {
      const img = h.bild("k19.jpg");
      if (img) { h.platz(190); h.page.drawImage(img, { x: M, y: h.y - 170, width: 227, height: 170 }); h.y -= 180; }
    }
    h.zwischen(sit.titel);
    sit.schritte.forEach((st) => { h.text(`·  ${st}`, { x: M + 6, w: CW - 6 }); h.y -= 2; });
  }

  // ── 7 Beobachtungsplan ──────────────────────────────────────────
  h.neueSeite();
  h.titel("Dein 7-Tage-Beobachtungsplan", `Jeden Tag ein kleiner Blick. Nach einer Woche siehst du ${dogName} mit anderen Augen.`);
  for (const t of BEOBACHTUNGSPLAN) {
    h.platz(50);
    h.page.drawRectangle({ x: M, y: h.y - 14, width: 12, height: 12, borderColor: BRAUN, borderWidth: 1.2 });
    h.text(t, { x: M + 22, w: CW - 22 });
    h.page.drawLine({ start: { x: M + 22, y: h.y - 8 }, end: { x: W - M, y: h.y - 8 }, thickness: 0.5, color: LINIE });
    h.page.drawLine({ start: { x: M + 22, y: h.y - 24 }, end: { x: W - M, y: h.y - 24 }, thickness: 0.5, color: LINIE });
    h.y -= 34;
  }

  // ── 8 Spickzettel ───────────────────────────────────────────────
  h.neueSeite();
  h.titel("Dein Spickzettel", "Ausschneiden, falten und in die Jackentasche stecken.");
  const kx = M, kw = CW, top = h.y - 6;
  const zeileH = 34, kh = 50 + SPICKZETTEL.length * zeileH;
  h.page.drawRectangle({ x: kx, y: top - kh, width: kw, height: kh, color: WEISS, borderColor: BRAUN, borderWidth: 1.2, borderDashArray: [5, 4] });
  h.page.drawText(S("Die 5 Warnsignale  ·  sofort handeln"), { x: kx + 16, y: top - 26, size: 13, font: f.b, color: AMPEL_FARBE.rot });
  let sy = top - 50;
  for (const s of SPICKZETTEL) {
    h.page.drawText(S(s.signal), { x: kx + 16, y: sy - 12, size: 11.5, font: f.b, color: DUNKEL });
    h.page.drawText(S(s.tun), { x: kx + 210, y: sy - 12, size: 11, font: f.r, color: TEXT });
    h.page.drawLine({ start: { x: kx + 16, y: sy - zeileH + 8 }, end: { x: kx + kw - 16, y: sy - zeileH + 8 }, thickness: 0.4, color: LINIE });
    sy -= zeileH;
  }
  h.y = top - kh - 30;
  h.text(`Ein letzter Gedanke: Du musst nicht alles auf einmal sehen. Fang mit den gelben Signalen an. Wer die leisen Zeichen erkennt, braucht die lauten fast nie. ${dogCap} wird es dir danken.`, { size: 11 });
  h.y -= 10;
  h.text("Hinweis: Dieses Heft erklärt typische Bedeutungen von Hundesignalen. Jeder Hund ist individuell, achte immer auf das Gesamtbild. Bei ernsthaften Verhaltensproblemen oder plötzlichen Veränderungen hol dir tierärztlichen oder verhaltenstherapeutischen Rat.", { size: 8.5, color: GRAU, font: f.i });

  return await doc.save();
}
