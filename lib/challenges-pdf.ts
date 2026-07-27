// Rendert die Wochen-Aufgaben eines Mitglieds als sauberes A4-PDF (pdf-lib,
// server-seitig). Nutzt den Arimo-Unicode-Font, damit Umlaute (ä/ö/ü/ß) UND
// polnische Zeichen korrekt erscheinen. Rein additiv, kein Workflow betroffen.

import { PDFDocument, rgb, PDFFont, PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "fs";
import path from "path";

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 50;
const CONTENT_W = A4_W - 2 * MARGIN;

const GOLD = rgb(196 / 255, 165 / 255, 118 / 255);
const DARK_BROWN = rgb(139 / 255, 115 / 255, 85 / 255);
const TEXT_DARK = rgb(26 / 255, 26 / 255, 26 / 255);
const TEXT_MEDIUM = rgb(90 / 255, 90 / 255, 90 / 255);
const WHITE = rgb(1, 1, 1);
const BG_LIGHT = rgb(250 / 255, 248 / 255, 245 / 255);
const BORDER = rgb(232 / 255, 220 / 255, 200 / 255);

export interface ChallengePdfItem {
  title: string;
  description: string;
  target_sessions?: number | null;
  sessions_done?: number | null;
  badge_label?: string | null;
  completed?: boolean;
}

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of String(text || "").split("\n")) {
    const words = para.split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
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

const T = (lang: string) =>
  lang === "pl"
    ? {
        title: (d: string) => `Zadania tygodnia dla ${d}`,
        subtitle: "Twoje ćwiczenia na ten tydzień, do wydrukowania lub odhaczenia.",
        goal: "Cel",
        units: "sesje",
        doneOf: (a: number, b: number) => `${a} z ${b} zrobione`,
        done: "zrobione",
        brand: "ŁapaPlan · lapaplan.pl",
        dog: "Twojego psa",
      }
    : {
        title: (d: string) => `Deine Wochen-Aufgaben für ${d}`,
        subtitle: "Deine Übungen für diese Woche, zum Ausdrucken oder Abhaken.",
        goal: "Ziel",
        units: "Übungseinheiten",
        doneOf: (a: number, b: number) => `${a} von ${b} erledigt`,
        done: "erledigt",
        brand: "Pfoten-Plan · pfoten-plan.de",
        dog: "deinen Hund",
      };

export async function buildChallengesPDF(opts: {
  dogName?: string | null;
  challenges: ChallengePdfItem[];
  lang?: string;
  weekLabel?: string | null;
  dateLabel?: string | null;
}): Promise<Uint8Array> {
  const lang = opts.lang === "pl" ? "pl" : "de";
  const t = T(lang);
  const dog = (opts.dogName || "").trim() || t.dog;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(
    readFileSync(path.join(FONT_DIR, "Arimo-Regular.ttf")),
    { subset: true }
  );
  const bold = await doc.embedFont(
    readFileSync(path.join(FONT_DIR, "Arimo-Bold.ttf")),
    { subset: true }
  );

  let page = doc.addPage([A4_W, A4_H]);
  let y = A4_H;

  const topBar = (p: PDFPage) =>
    p.drawRectangle({ x: 0, y: A4_H - 6, width: A4_W, height: 6, color: GOLD });
  const bottomBar = (p: PDFPage) =>
    p.drawRectangle({ x: 0, y: 0, width: A4_W, height: 4, color: GOLD });

  const footer = (p: PDFPage) => {
    const w = regular.widthOfTextAtSize(t.brand, 9);
    p.drawText(t.brand, { x: (A4_W - w) / 2, y: 26, size: 9, font: regular, color: TEXT_MEDIUM });
    bottomBar(p);
  };

  const newPage = () => {
    footer(page);
    page = doc.addPage([A4_W, A4_H]);
    topBar(page);
    y = A4_H - 50;
  };

  // Kopf
  topBar(page);
  y = A4_H - 70;
  page.drawText(t.title(dog), { x: MARGIN, y, size: 24, font: bold, color: TEXT_DARK });
  y -= 26;
  for (const line of wrap(t.subtitle, regular, 12, CONTENT_W)) {
    page.drawText(line, { x: MARGIN, y, size: 12, font: regular, color: TEXT_MEDIUM });
    y -= 16;
  }
  if (opts.weekLabel) {
    y -= 2;
    page.drawText(opts.weekLabel, { x: MARGIN, y, size: 12, font: bold, color: DARK_BROWN });
    y -= 18;
  }
  if (opts.dateLabel) {
    page.drawText(opts.dateLabel, { x: MARGIN, y, size: 10, font: regular, color: TEXT_MEDIUM });
    y -= 16;
  }
  y -= 10;

  // Aufgaben-Karten
  let nr = 0;
  for (const c of opts.challenges) {
    nr++;
    const title = c.title || "";
    const desc = c.description || "";
    const descLines = wrap(desc, regular, 10.5, CONTENT_W - 44);
    const target = c.target_sessions || 0;
    const doneN = c.sessions_done || 0;
    const metaLine = target
      ? `${t.goal}: ${target} ${t.units}   ·   ${t.doneOf(Math.min(doneN, target), target)}`
      : "";
    // Kartenhöhe schätzen
    const cardH = 30 + descLines.length * 14 + (metaLine ? 20 : 6) + 14;
    if (y - cardH < 60) newPage();

    const cardTop = y;
    const cardBottom = y - cardH + 8;
    page.drawRectangle({
      x: MARGIN,
      y: cardBottom,
      width: CONTENT_W,
      height: cardTop - cardBottom,
      color: BG_LIGHT,
      borderColor: BORDER,
      borderWidth: 1,
    });
    // Nummer-Badge
    page.drawCircle({ x: MARGIN + 20, y: cardTop - 20, size: 11, color: GOLD });
    const nrS = String(nr);
    const nrW = bold.widthOfTextAtSize(nrS, 11);
    page.drawText(nrS, { x: MARGIN + 20 - nrW / 2, y: cardTop - 24, size: 11, font: bold, color: WHITE });
    // Titel
    page.drawText(title, { x: MARGIN + 40, y: cardTop - 24, size: 13, font: bold, color: TEXT_DARK });
    let cy = cardTop - 44;
    for (const line of descLines) {
      page.drawText(line, { x: MARGIN + 40, y: cy, size: 10.5, font: regular, color: TEXT_DARK });
      cy -= 14;
    }
    if (metaLine) {
      cy -= 4;
      page.drawText(metaLine, { x: MARGIN + 40, y: cy, size: 10, font: bold, color: DARK_BROWN });
      cy -= 16;
    }
    y = cardBottom - 14;
  }

  footer(page);
  return await doc.save();
}
