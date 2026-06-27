// Premium-PDF "Dein Hund verstehen" — rasse- & verhaltens-personalisiert.
// Content-getrieben: bekommt KI-generierte Inhalte + optional das Kundenfoto.
// Stil 1:1 wie Sommer-/Anti-Giftköder-Plan (pdf-lib, A4, Rassebilder).
// Export: buildHundVerstehenPDF({ dogName, breed, age, dogPhoto, content }) -> Uint8Array

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const A4_W = 595.28, A4_H = 841.89, MARGIN = 50, CONTENT_W = A4_W - 2 * MARGIN;
const GOLD = rgb(196 / 255, 165 / 255, 118 / 255), DARK_BROWN = rgb(139 / 255, 115 / 255, 85 / 255);
const TEXT_DARK = rgb(26 / 255, 26 / 255, 26 / 255), TEXT_MEDIUM = rgb(100 / 255, 100 / 255, 100 / 255), TEXT_LIGHT = rgb(150 / 255, 150 / 255, 150 / 255);
const WHITE = rgb(1, 1, 1), BG_LIGHT = rgb(250 / 255, 248 / 255, 245 / 255), BORDER_LIGHT = rgb(232 / 255, 220 / 255, 200 / 255);
const ROW_ALT = rgb(250 / 255, 247 / 255, 242 / 255);

const DISCLAIMER =
  "Dieses Profil erklärt rasse- und verhaltenstypische Tendenzen. Jeder Hund ist individuell — sieh es als Orientierung, nicht als Urteil. Es ersetzt keine tierärztliche oder verhaltenstherapeutische Beratung.";

const S = (s: any) =>
  String(s == null ? "" : s)
    .replace(/[→←⇒▶]/g, "-")
    .replace(/[≥]/g, "ab ")
    .replace(/[≤]/g, "bis ")
    .replace(/[\u{1F000}-\u{1FAFF}☀-➿️✂]/gu, "")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...");

interface Fonts { regular: PDFFont; bold: PDFFont; italic: PDFFont; }

// ── Content-Schnittstelle (kommt aus der KI-Generierung) ──────────────────
export interface HundVerstehenContent {
  characterIntro: string;
  characterTraits: { label: string; value: string }[]; // "Auf einen Blick"
  steckbrief: { feld: string; wert: string }[];
  bodyLanguageIntro: string;
  bodyLanguageSignals: { signal: string; bedeutung: string }[];
  photoObservation?: string | null; // aus Foto-Analyse (Vision), optional
  needsIntro: string;
  needsPoints: string[];
  breedTopics: { thema: string; tipp: string }[];
  closing: string;
}

export interface HundVerstehenInput {
  dogName?: string | null;
  breed?: string | null;
  age?: string | null;
  dogPhoto?: { bytes: Uint8Array; type: string } | null;
  content: HundVerstehenContent;
}

function breedFileName(k: string): string {
  const m: Record<string, string> = {
    labrador: "Labrador-Retriever.jpg", "labrador retriever": "Labrador-Retriever.jpg", "labrador-mix": "Labrador-Retriever.jpg",
    "golden retriever": "Golden-Retriever.jpg", "deutscher schäferhund": "German-Shepard.jpg",
    schäferhund: "German-Shepard.jpg", "german shepherd": "German-Shepard.jpg",
    "australian shepherd": "Australian-Shepherd.jpg", aussie: "Australian-Shepherd.jpg",
    "border collie": "Border-Collie.jpg", dackel: "Dackel.jpg", goldendoodle: "Goldendoodle.jpg",
    havaneser: "Havanese.jpg", havanese: "Havanese.jpg", mischling: "Mischling.jpg",
  };
  const lk = k.trim().toLowerCase();
  if (m[lk]) return m[lk];
  for (const key of Object.keys(m)) if (lk.includes(key)) return m[key];
  return "Allgemein.jpg";
}
function normalizeBreedDisplay(breed?: string | null): string {
  if (!breed) return "Mischling";
  const s = String(breed).trim();
  if (!s || /unknown/i.test(s)) return "Mischling";
  return s;
}
function ageLabel(age?: string | null): string {
  const a = (age || "").toLowerCase();
  if (a === "puppy" || a === "welpe") return "Welpe";
  if (a === "young" || a === "junghund") return "Junghund";
  if (a === "senior") return "Senior";
  return "Erwachsen";
}

export async function buildHundVerstehenPDF(input: HundVerstehenInput): Promise<Uint8Array> {
  const DOG = S(input.dogName || "dein Hund").slice(0, 40) || "dein Hund";
  const breedKey = (input.breed || "").trim().toLowerCase();
  const BREED = normalizeBreedDisplay(input.breed);
  const AGE = ageLabel(input.age);
  const C = input.content;

  const doc = await PDFDocument.create();
  const F: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };

  // Total-Seitenzahl ist dynamisch — wir zaehlen am Ende; Footer nutzt Platzhalter.
  const pages: PDFPage[] = [];

  const wrap = (t: string, f: PDFFont, s: number, mw: number): string[] => {
    const ws = S(t).split(" "); const ls: string[] = []; let c = "";
    for (const w of ws) { const x = c ? c + " " + w : w; if (f.widthOfTextAtSize(x, s) > mw && c) { ls.push(c); c = w; } else c = x; }
    if (c) ls.push(c); return ls;
  };
  const rrect = (p: PDFPage, x: number, y: number, w: number, h: number, r: number, color: any) => {
    p.drawRectangle({ x: x + r, y, width: w - 2 * r, height: h, color });
    p.drawRectangle({ x, y: y + r, width: w, height: h - 2 * r, color });
    for (const [cx, cy] of [[x + r, y + r], [x + w - r, y + r], [x + r, y + h - r], [x + w - r, y + h - r]]) p.drawCircle({ x: cx, y: cy, size: r, color });
  };
  const newPage = () => { const p = doc.addPage([A4_W, A4_H]); p.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE }); p.drawRectangle({ x: 0, y: A4_H - 6, width: A4_W, height: 6, color: GOLD }); pages.push(p); return p; };
  const header = (p: PDFPage, pill: string, title: string): number => {
    let y = A4_H - 60; const pw = F.bold.widthOfTextAtSize(pill, 9) + 18; rrect(p, MARGIN, y - 18, pw, 22, 4, GOLD); p.drawText(S(pill), { x: MARGIN + 9, y: y - 12, size: 9, font: F.bold, color: WHITE });
    y -= 56; for (const line of wrap(title, F.bold, 21, CONTENT_W)) { p.drawText(line, { x: MARGIN, y, size: 21, font: F.bold, color: TEXT_DARK }); y -= 27; }
    y -= 10; p.drawRectangle({ x: MARGIN, y, width: CONTENT_W, height: 1, color: BORDER_LIGHT }); return y - 24;
  };
  const para = (p: PDFPage, t: string, y: number, o: any = {}): number => {
    const size = o.size ?? 11, color = o.color ?? TEXT_DARK, font = o.font ?? F.regular, gap = o.gap ?? 7;
    for (const line of wrap(t, font, size, CONTENT_W)) { p.drawText(line, { x: MARGIN, y, size, font, color }); y -= size + gap; } return y - 5;
  };
  const subhead = (p: PDFPage, t: string, y: number): number => { p.drawText(S(t), { x: MARGIN, y, size: 13, font: F.bold, color: DARK_BROWN }); return y - 21; };
  const bullet = (p: PDFPage, t: string, y: number): number => {
    p.drawCircle({ x: MARGIN + 4, y: y + 3, size: 2.2, color: GOLD }); const ls = wrap(t, F.regular, 10.5, CONTENT_W - 20);
    for (const [i, line] of ls.entries()) p.drawText(line, { x: MARGIN + 16, y: y - i * 15, size: 10.5, font: F.regular, color: TEXT_MEDIUM }); return y - (ls.length * 15) - 6;
  };
  const tip = (p: PDFPage, label: string, t: string, y: number): number => {
    y -= 18; const ls = wrap(t, F.regular, 10, CONTENT_W - 32); const bh = 44 + ls.length * 14; rrect(p, MARGIN, y - bh + 14, CONTENT_W, bh, 6, BG_LIGHT); p.drawRectangle({ x: MARGIN, y: y - bh + 14, width: 3, height: bh, color: GOLD });
    p.drawText(S(label), { x: MARGIN + 14, y: y - 4, size: 10, font: F.bold, color: DARK_BROWN }); y -= 24;
    for (const line of ls) { p.drawText(line, { x: MARGIN + 14, y, size: 10, font: F.regular, color: TEXT_MEDIUM }); y -= 14; } return y - 16;
  };
  const table = (p: PDFPage, topY: number, colW: number[], headers: string[], rows: string[][]): number => {
    const x = MARGIN, pad = 7, fs = 9.5, lh = 12.5, tw = colW.reduce((a, b) => a + b, 0); let y = topY; const hH = 22;
    p.drawRectangle({ x, y: y - hH, width: tw, height: hH, color: DARK_BROWN }); let cx = x;
    for (let i = 0; i < headers.length; i++) { p.drawText(S(headers[i]), { x: cx + pad, y: y - 15, size: 9.5, font: F.bold, color: WHITE }); cx += colW[i]; }
    y -= hH;
    rows.forEach((row, ri) => {
      const wr = row.map((c, i) => wrap(c, F.regular, fs, colW[i] - 2 * pad)); const nl = Math.max(...wr.map((w) => w.length)); const rh = nl * lh + 9;
      if (ri % 2 === 1) p.drawRectangle({ x, y: y - rh, width: tw, height: rh, color: ROW_ALT });
      cx = x; for (let i = 0; i < wr.length; i++) { let ty = y - 13; for (const line of wr[i]) { p.drawText(line, { x: cx + pad, y: ty, size: fs, font: i === 0 ? F.bold : F.regular, color: TEXT_DARK }); ty -= lh; } cx += colW[i]; }
      p.drawRectangle({ x, y: y - rh, width: tw, height: 0.5, color: BORDER_LIGHT }); y -= rh;
    });
    return y - 6;
  };

  // Hilfsfunktion: Bild fuer Cover (Kundenfoto bevorzugt, sonst Rassebild)
  async function embedCover(): Promise<{ img: any } | null> {
    try {
      if (input.dogPhoto?.bytes?.length) {
        const t = input.dogPhoto.type || "";
        const img = /png/i.test(t) ? await doc.embedPng(input.dogPhoto.bytes) : await doc.embedJpg(input.dogPhoto.bytes);
        return { img };
      }
    } catch { /* faellt auf Rassebild zurueck */ }
    try {
      const ip = join(process.cwd(), "public", "breeds", breedFileName(breedKey));
      if (existsSync(ip)) return { img: await doc.embedJpg(readFileSync(ip)) };
    } catch { /* */ }
    return null;
  }
  async function embedBreed(): Promise<any | null> {
    try { const ip = join(process.cwd(), "public", "breeds", breedFileName(breedKey)); if (existsSync(ip)) return await doc.embedJpg(readFileSync(ip)); } catch { /* */ }
    return null;
  }

  // ── 1 Cover ──────────────────────────────────────────────────────
  {
    const p = newPage(); const pill = "DEIN HUND VERSTEHEN"; const pw = F.bold.widthOfTextAtSize(pill, 9) + 18;
    rrect(p, MARGIN, A4_H - 95, pw, 22, 4, GOLD); p.drawText(pill, { x: MARGIN + 9, y: A4_H - 89, size: 9, font: F.bold, color: WHITE });
    p.drawText(`${DOG} verstehen`, { x: MARGIN, y: A4_H - 140, size: 30, font: F.bold, color: TEXT_DARK });
    p.drawText(`${BREED} · ${AGE}`, { x: MARGIN, y: A4_H - 168, size: 13, font: F.regular, color: TEXT_MEDIUM });
    let imgY = A4_H - 470;
    const cover = await embedCover();
    if (cover) { const iw = CONTENT_W, ih = Math.min((cover.img.height / cover.img.width) * iw, 300); imgY = A4_H - 200 - ih; p.drawImage(cover.img, { x: MARGIN, y: imgY, width: iw, height: ih }); }
    let y = imgY - 30;
    y = para(p, `Dieses Profil hilft dir, ${DOG} wirklich zu verstehen — wie er tickt, was in ihm steckt, wie er mit dir spricht und was er gerade braucht. Auf den Hund und die Rasse zugeschnitten.`, y, { color: TEXT_MEDIUM });
  }

  // ── 2 So tickt [Hund] ────────────────────────────────────────────
  {
    const p = newPage(); let y = header(p, "CHARAKTER", `So tickt ${DOG}`);
    y = para(p, C.characterIntro, y);
    if (C.characterTraits?.length) {
      y = subhead(p, "Auf einen Blick", y);
      y = table(p, y, [165, CONTENT_W - 165], ["Eigenschaft", "Bei " + DOG], C.characterTraits.map((t) => [t.label, t.value]));
    }
  }

  // ── 3 Rasse-Steckbrief ───────────────────────────────────────────
  {
    const p = newPage(); let y = header(p, "RASSE-STECKBRIEF", `${BREED} — Herkunft & Wesen`);
    y = para(p, `Vieles an ${DOG} wird klarer, wenn man weiß, wofür ${BREED} ursprünglich gezüchtet wurden. Diese Veranlagungen stecken bis heute in ihm.`, y);
    const breedImg = await embedBreed();
    if (breedImg && !input.dogPhoto) { /* Rassebild war schon Cover-Fallback */ }
    if (C.steckbrief?.length) {
      y = table(p, y, [150, CONTENT_W - 150], ["Merkmal", "Beschreibung"], C.steckbrief.map((r) => [r.feld, r.wert]));
    }
  }

  // ── 4 Wie [Hund] mit dir spricht ─────────────────────────────────
  {
    const p = newPage(); let y = header(p, "KÖRPERSPRACHE", `Wie ${DOG} mit dir spricht`);
    y = para(p, C.bodyLanguageIntro, y);
    if (C.bodyLanguageSignals?.length) {
      y = table(p, y, [150, CONTENT_W - 150], ["Signal", "Was es bedeutet"], C.bodyLanguageSignals.map((s) => [s.signal, s.bedeutung]));
    }
    if (C.photoObservation) {
      y = tip(p, `Aus deinem Foto von ${DOG}`, C.photoObservation, y);
    }
  }

  // ── 5 Was [Hund] jetzt braucht ───────────────────────────────────
  {
    const p = newPage(); let y = header(p, "BEDÜRFNISSE", `Was ${DOG} jetzt braucht`);
    y = para(p, C.needsIntro, y);
    if (C.needsPoints?.length) { for (const pt of C.needsPoints) y = bullet(p, pt, y); }
  }

  // ── 6 Rasse-typische Themen ──────────────────────────────────────
  if (C.breedTopics?.length) {
    const p = newPage(); let y = header(p, "GUT ZU WISSEN", `${BREED}-typische Themen`);
    y = para(p, `Diese Themen tauchen bei ${BREED} häufiger auf. Kein Muss — aber gut, sie zu kennen, bevor sie zum Problem werden.`, y);
    y = table(p, y, [165, CONTENT_W - 165], ["Thema", "Was hilft"], C.breedTopics.map((t) => [t.thema, t.tipp]));
  }

  // ── 7 Abschluss ──────────────────────────────────────────────────
  {
    const p = newPage(); let y = header(p, "DEIN NÄCHSTER SCHRITT", `${DOG} & du`);
    y = para(p, C.closing, y);
    y = tip(p, "Übrigens", `Je besser du ${DOG} verstehst, desto leichter wird das Training — weil du weißt, WARUM er Dinge tut. Dein Trainingsplan im Mitgliederbereich baut genau darauf auf.`, y);
  }

  // ── Footer auf allen Seiten (jetzt mit korrekter Gesamtzahl) ──────
  const TOTAL = pages.length;
  pages.forEach((p, i) => {
    const dl = wrap(DISCLAIMER, F.italic, 7.5, CONTENT_W); let dy = 32 + dl.length * 9;
    for (const line of dl) { const w = F.italic.widthOfTextAtSize(line, 7.5); p.drawText(line, { x: (A4_W - w) / 2, y: dy, size: 7.5, font: F.italic, color: TEXT_LIGHT }); dy -= 9; }
    const meta = `Pfoten-Plan · ${DOG} verstehen · Seite ${i + 1}/${TOTAL}`; const mw = F.regular.widthOfTextAtSize(meta, 8);
    p.drawText(meta, { x: (A4_W - mw) / 2, y: 18, size: 8, font: F.regular, color: TEXT_LIGHT });
    p.drawRectangle({ x: 0, y: 0, width: A4_W, height: 3, color: GOLD });
  });

  return await doc.save();
}
