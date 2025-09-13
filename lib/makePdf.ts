// lib/makePdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";
import type { Blocks } from "./analysis"; // enthält deinen Blocks-Typ

type Rect = { x: number; y: number; w: number; h: number };
type Box = {
  key: keyof Blocks;     // Welcher Textblock
  page: number;          // 0-basierter Seitenindex
  rect: Rect;            // Ziel-Rechteck (pt)
  size?: number;         // Schriftgröße (default 11)
  bold?: boolean;        // Überschriften etc.
  linkNextKey?: string;  // in welche Box soll weiterfließen, wenn h überschritten
};

const A4: [number, number] = [595.28, 841.89];

// ========= 1) LAYOUT DEFINIEREN =========
// HINWEIS: y misst von unten! (pdf-lib Standard)
const layout: Box[] = [
  // Seite 1
  {
    key: "Begrüßung_block1",
    page: 0,
    rect: { x: 50, y: 700, w: 495, h: 80 }, // TODO Koordinaten anpassen
    size: 12,
    bold: false,
    linkNextKey: "analyse_block1__s1",
  },
  {
    key: "analyse_block1",
    page: 0,
    rect: { x: 50, y: 600, w: 495, h: 120 }, // TODO
    size: 11,
    linkNextKey: "analyse_block1__s1",
  },
  // Overflow-Kette für analyse_block1 auf Seite 1 (falls nötig)
  {
    key: "analyse_block1", // gleicher Text fließt weiter
    page: 0,
    rect: { x: 50, y: 460, w: 495, h: 100 }, // TODO
    size: 11,
    // Schlüssel, der nur intern zum Verbinden dient
  } as any as Box & { key: "analyse_block1"; }, // Trick, um denselben Key mehrfach zu erlauben

  // Seite 2
  {
    key: "analyse_block2",
    page: 1,
    rect: { x: 50, y: 680, w: 495, h: 180 }, // TODO
    size: 11,
    linkNextKey: "analyse_block2__s2",
  },
  {
    key: "analyse_block2",
    page: 1,
    rect: { x: 50, y: 480, w: 495, h: 140 }, // TODO
    size: 11,
  },

  // Seite 3
  {
    key: "fakten_block1",
    page: 2,
    rect: { x: 50, y: 680, w: 495, h: 100 }, // TODO
    size: 11,
  },

  // Seite 4 – Stärken/Schwächen
  {
    key: "staerken_block1",
    page: 3,
    rect: { x: 50, y: 680, w: 230, h: 160 }, // linke Spalte, TODO
    size: 11,
  },
  {
    key: "schwaechen_block1",
    page: 3,
    rect: { x: 315, y: 680, w: 230, h: 160 }, // rechte Spalte, TODO
    size: 11,
  },

  // Seite 5 – Ergebnis
  {
    key: "ergebnis_block",
    page: 4,
    rect: { x: 50, y: 660, w: 495, h: 220 }, // TODO
    size: 12,
  },

  // Seite 6 – Empfehlungen
  {
    key: "empfehlung1",
    page: 5,
    rect: { x: 50, y: 680, w: 495, h: 120 }, // TODO
    size: 11,
    linkNextKey: "empfehlung2__s6",
  },
  {
    key: "empfehlung2",
    page: 5,
    rect: { x: 50, y: 540, w: 495, h: 120 }, // TODO
    size: 11,
    linkNextKey: "empfehlung3__s6",
  },
  {
    key: "empfehlung3",
    page: 5,
    rect: { x: 50, y: 400, w: 495, h: 120 }, // TODO
    size: 11,
  },

  // Seite 7 – Zukunft
  {
    key: "zukunft_block1",
    page: 6,
    rect: { x: 50, y: 680, w: 495, h: 140 }, // TODO
    size: 11,
    linkNextKey: "zukunft_block2__s7",
  },
  {
    key: "zukunft_block2",
    page: 6,
    rect: { x: 50, y: 520, w: 495, h: 140 }, // TODO
    size: 11,
  },

  // Seite 8 – Abschluss/Wünsche
  {
    key: "abschluss_block",
    page: 7,
    rect: { x: 50, y: 660, w: 495, h: 160 }, // TODO
    size: 11,
    linkNextKey: "wuensche_block__s8",
  },
  {
    key: "wuensche_block",
    page: 7,
    rect: { x: 50, y: 480, w: 495, h: 120 }, // TODO
    size: 11,
  },
];

// ========= 2) RENDER-ENGINE =========

function wrapLines(font: any, size: number, text: string, maxWidth: number) {
  const words = text.replace(/\r/g, "").split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

type DrawCtx = {
  pdfDoc: PDFDocument;
  pages: ReturnType<PDFDocument["getPages"]>;
  font: any;
  fontBold: any;
  debug: boolean;
};

function drawTextInBox(
  ctx: DrawCtx,
  pageIdx: number,
  rect: Rect,
  text: string,
  size: number,
  bold = false
) {
  if (!text || !text.trim()) return { remaining: "" };

  const page = ctx.pages[pageIdx];
  const f = bold ? ctx.fontBold : ctx.font;
  const lineH = Math.max(size + 2, 14);
  const maxLines = Math.floor(rect.h / lineH);
  const lines = wrapLines(f, size, text.trim(), rect.w);

  if (ctx.debug) {
    page.drawRectangle({
      x: rect.x,
      y: rect.y,
      width: rect.w,
      height: rect.h,
      color: undefined,
      borderColor: rgb(0.8, 0.1, 0.1),
      borderWidth: 0.5,
      opacity: 0.2,
      borderOpacity: 0.6,
    });
  }

  let used = 0;
  for (let i = 0; i < lines.length && used < maxLines; i++) {
    page.drawText(lines[i], {
      x: rect.x,
      y: rect.y + rect.h - (used + 1) * lineH + 2,
      size,
      font: f,
      color: rgb(0.12, 0.12, 0.12),
    });
    used++;
  }
  const remaining = lines.slice(used).join(" ");
  return { remaining };
}

function flowInto(
  ctx: DrawCtx,
  boxesForKey: Box[],
  text?: string | null,
  sizeFallback = 11
) {
  if (!text || !text.trim()) return;
  let rest = text.trim();
  for (const b of boxesForKey) {
    const s = b.size ?? sizeFallback;
    const out = drawTextInBox(ctx, b.page, b.rect, rest, s, !!b.bold);
    rest = out.remaining;
    if (!rest) break;
  }
  // Falls doch noch Rest übrig ist: wir schneiden ab (oder weitere Boxen definieren)
}

// ========= 3) PUBLIC API =========

export async function makeAnalysisPdf(params: {
  orderId?: string | null;
  name?: string | null;
  email?: string | null;
  blocks?: Partial<Blocks> | null;
  debugFrames?: boolean; // true zeigt Box-Rahmen – beim Einmessen sehr hilfreich
}): Promise<Uint8Array> {
  const { name, email, blocks, debugFrames } = params || {};

  // Vorlage laden (oder leeres A4 anlegen)
  const tplPath = path.join(process.cwd(), "public", "vorlage.pdf");
  let pdfDoc: PDFDocument;
  if (fs.existsSync(tplPath)) {
    const bytes = fs.readFileSync(tplPath);
    pdfDoc = await PDFDocument.load(bytes);
  } else {
    pdfDoc = await PDFDocument.create();
    pdfDoc.addPage(A4);
  }

  // Fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  // Kopf/Meta – wenn eure Vorlage oben Platz dafür hat, optional setzen:
  // (Beispiel: Seite 1 oben links Name/Email)
  const page0 = pages[0];
  page0.drawText(`Name: ${name ?? "-"}`, {
    x: 50,
    y: A4[1] - 60,
    size: 10,
    font,
    color: rgb(0.25, 0.25, 0.25),
  });
  if (email) {
    page0.drawText(`E-Mail: ${email}`, {
      x: 50,
      y: A4[1] - 75,
      size: 10,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
  }
  page0.drawText(`Erstellt am: ${new Date().toLocaleString("de-DE")}`, {
    x: 50,
    y: A4[1] - 90,
    size: 10,
    font,
    color: rgb(0.25, 0.25, 0.25),
  });

  const ctx: DrawCtx = { pdfDoc, pages, font, fontBold, debug: !!debugFrames };

  // Inhalt schreiben
  const content: Partial<Blocks> = {
    Begrüßung_block1: blocks?.Begrüßung_block1,
    analyse_block1: blocks?.analyse_block1,
    analyse_block2: blocks?.analyse_block2,
    fakten_block1: blocks?.fakten_block1,
    staerken_block1: blocks?.staerken_block1,
    schwaechen_block1: blocks?.schwaechen_block1,
    ergebnis_block: blocks?.ergebnis_block,
    empfehlung1: blocks?.empfehlung1,
    empfehlung2: blocks?.empfehlung2,
    empfehlung3: blocks?.empfehlung3,
    zukunft_block1: blocks?.zukunft_block1,
    zukunft_block2: blocks?.zukunft_block2,
    abschluss_block: blocks?.abschluss_block,
    wuensche_block: blocks?.wuensche_block,
  };

  // pro Key alle Boxen (inkl. Overflow-Boxen) einsammeln und füllen
  const keys = Object.keys(content) as (keyof Blocks)[];
  for (const k of keys) {
    const txt = (content as any)[k] as string | undefined;
    if (!txt) continue;
    const boxesForKey = layout.filter((b) => b.key === k);
    if (!boxesForKey.length) continue;
    flowInto(ctx, boxesForKey, txt);
  }

  return await pdfDoc.save();
}