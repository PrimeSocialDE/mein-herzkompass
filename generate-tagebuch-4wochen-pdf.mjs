// Generiert das 4-Wochen-Trainings-Tagebuch als personalisiertes A4-PDF.
//
// Verwendung (lokal zum Preview):
//   DOG_NAME="Luna" DOG_BREED="Labrador" DOG_AGE="3 Jahre" \
//   MAIN_PROBLEM="Leinenziehen" node generate-tagebuch-4wochen-pdf.mjs
//
// Output: public/tagebuch-4wochen-TEST.pdf
//
// Die gleichen Parameter werden später von /api/tagebuch/generate aus
// wauwerk_leads.answers (dog_name, dog_breed, dog_age, dog_problem) befüllt.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFileSync } from "fs";

const A4_W = 595.28;
const A4_H = 841.89;

// Brand-Farben (matched deinplan4)
const DARK_BROWN   = rgb(36 / 255, 23 / 255, 20 / 255);     // #241714
const GOLD         = rgb(196 / 255, 165 / 255, 118 / 255);  // #C4A576
const GOLD_DARK    = rgb(139 / 255, 115 / 255, 85 / 255);
const ORANGE       = rgb(230 / 255, 121 / 255, 70 / 255);   // #E67946
const TEXT_DARK    = rgb(26 / 255, 26 / 255, 26 / 255);
const TEXT_MEDIUM  = rgb(100 / 255, 100 / 255, 100 / 255);
const TEXT_LIGHT   = rgb(150 / 255, 150 / 255, 150 / 255);
const WHITE        = rgb(1, 1, 1);
const BG_CREAM     = rgb(250 / 255, 248 / 255, 243 / 255);  // #FAF8F3
const BG_WARM      = rgb(255 / 255, 251 / 255, 245 / 255);  // #FFFBF5
const BORDER_LIGHT = rgb(232 / 255, 220 / 255, 200 / 255);  // #E8DCC8
const LINE_LIGHT   = rgb(210 / 255, 200 / 255, 185 / 255);

// ========= Personalisierung =========
const DOG_NAME     = (process.env.DOG_NAME     || "deinem Hund").trim();
const DOG_BREED    = (process.env.DOG_BREED    || "Mischling").trim();
const DOG_AGE      = (process.env.DOG_AGE      || "—").trim();
const MAIN_PROBLEM = (process.env.MAIN_PROBLEM || "Leinenziehen").trim();

// Motivations-Zitate pro Woche
const WEEK_QUOTES = [
  "Der erste Schritt ist immer der schwerste. Du hast ihn gemacht.",
  "Jede Wiederholung baut die neue Gewohnheit. Bleib dran.",
  "Halbzeit. Das Meiste hast du schon geschafft.",
  "Die letzten Meter sind oft die wichtigsten. Finish stark.",
];

// ========= Text-Helpers =========
function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
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

function drawRoundedBorder(page, x, y, w, h, r, color, thickness = 1) {
  // Fake outline via 4 filled rects + 4 circles, dann inneren "Loch"
  // Einfacher: wir zeichnen eine etwas größere Farbe und darauf eine kleinere BG-Farbe
  // Für Simplizität nutzen wir drawLine segments (gerade Kanten reichen meistens)
  page.drawLine({ start: { x: x + r, y },           end: { x: x + w - r, y },           thickness, color });
  page.drawLine({ start: { x: x + r, y: y + h },    end: { x: x + w - r, y: y + h },    thickness, color });
  page.drawLine({ start: { x, y: y + r },           end: { x, y: y + h - r },           thickness, color });
  page.drawLine({ start: { x: x + w, y: y + r },    end: { x: x + w, y: y + h - r },    thickness, color });
}

// Checkbox (leeres Quadrat mit Rand)
function drawCheckbox(page, x, y, size, color = GOLD_DARK) {
  page.drawRectangle({ x, y, width: size, height: size, color: WHITE });
  page.drawLine({ start: { x, y },             end: { x: x + size, y },           thickness: 1, color });
  page.drawLine({ start: { x, y: y + size },   end: { x: x + size, y: y + size }, thickness: 1, color });
  page.drawLine({ start: { x, y },             end: { x, y: y + size },           thickness: 1, color });
  page.drawLine({ start: { x: x + size, y },   end: { x: x + size, y: y + size }, thickness: 1, color });
}

// Horizontale Schreiblinie
function drawWriteLine(page, x, y, w) {
  page.drawLine({
    start: { x, y },
    end:   { x: x + w, y },
    thickness: 0.6,
    color: LINE_LIGHT,
  });
}

// 1-10 Skala: 10 leere Kreise in einer Reihe
function drawScale(page, x, y, font) {
  const count = 10;
  const step = 18;
  const r = 7;
  for (let i = 0; i < count; i++) {
    const cx = x + i * step + r;
    page.drawCircle({ x: cx, y, size: r, color: WHITE });
    // dünner Rand (4 kleine Linien annähernd kreisförmig -> einfacher: Circle mit borderColor ist nicht verfügbar für pdf-lib drawCircle, wir zeichnen einen dünnen Rand als Ring mit 2 Circles)
    page.drawCircle({ x: cx, y, size: r, borderColor: GOLD_DARK, borderWidth: 0.8, color: WHITE });
    const num = String(i + 1);
    const nw  = font.widthOfTextAtSize(num, 8);
    page.drawText(num, { x: cx - nw / 2, y: y - 2.5, size: 8, font, color: TEXT_MEDIUM });
  }
}

// Pfoten-Icon (dekorativ): 1 großer Ballen + 4 kleine Zehen
function drawPaw(page, cx, cy, scale = 1, color = GOLD) {
  const pad = 10 * scale;
  const toe = 5 * scale;
  // großer Ballen
  page.drawEllipse({ x: cx, y: cy - pad * 0.3, xScale: pad, yScale: pad * 0.8, color });
  // 4 Zehen
  page.drawCircle({ x: cx - pad * 1.1, y: cy + pad * 0.7,  size: toe,       color });
  page.drawCircle({ x: cx - pad * 0.4, y: cy + pad * 1.2,  size: toe * 1.1, color });
  page.drawCircle({ x: cx + pad * 0.4, y: cy + pad * 1.2,  size: toe * 1.1, color });
  page.drawCircle({ x: cx + pad * 1.1, y: cy + pad * 0.7,  size: toe,       color });
}

function drawPageFooter(page, pageNr, totalPages, font) {
  const txt = `Tagebuch · Seite ${pageNr}/${totalPages} · Pfoten-Plan`;
  const w = font.widthOfTextAtSize(txt, 9);
  page.drawText(txt, { x: (A4_W - w) / 2, y: 24, size: 9, font, color: TEXT_LIGHT });
  page.drawRectangle({ x: 0, y: 0, width: A4_W, height: 3, color: GOLD });
}

// ========= PDF-Aufbau =========
async function main() {
  console.log("Generiere Tagebuch 4 Wochen für:", { DOG_NAME, DOG_BREED, DOG_AGE, MAIN_PROBLEM });

  const doc        = await PDFDocument.create();
  const fontReg    = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold   = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const MARGIN = 50;
  const CONTENT_W = A4_W - 2 * MARGIN;
  const TOTAL_PAGES = 12;

  // ===== PAGE 1 — COVER =====
  {
    const p = doc.addPage([A4_W, A4_H]);

    // Dunkler Header (#241714), obere 320pt
    const HEADER_H = 320;
    p.drawRectangle({ x: 0, y: A4_H - HEADER_H, width: A4_W, height: HEADER_H, color: DARK_BROWN });
    // Gold-Akzent-Linie am unteren Header-Rand
    p.drawRectangle({ x: 0, y: A4_H - HEADER_H - 3, width: A4_W, height: 3, color: GOLD });

    // Logo-Zeile ganz oben
    p.drawText("PFOTEN-PLAN", {
      x: MARGIN, y: A4_H - 60,
      size: 11, font: fontBold, color: GOLD,
      characterSpacing: 2.2,
    });
    p.drawText("pfoten-plan.de", {
      x: A4_W - MARGIN - fontReg.widthOfTextAtSize("pfoten-plan.de", 10),
      y: A4_H - 60,
      size: 10, font: fontReg, color: rgb(200/255, 180/255, 150/255),
    });

    // Haupttitel weiß auf dunkel
    const title = "Dein Trainings-Tagebuch";
    const tw = fontBold.widthOfTextAtSize(title, 30);
    p.drawText(title, { x: (A4_W - tw) / 2, y: A4_H - 140, size: 30, font: fontBold, color: WHITE });

    // Kleiner Untertitel weiß
    const subTop = "4 Wochen zu einem ruhigeren Hund";
    const stw = fontReg.widthOfTextAtSize(subTop, 13);
    p.drawText(subTop, { x: (A4_W - stw) / 2, y: A4_H - 170, size: 13, font: fontReg, color: rgb(220/255, 200/255, 170/255) });

    // Paw-Icon dekorativ im Header
    drawPaw(p, A4_W / 2, A4_H - 230, 1.3, GOLD);

    // ===== Unterer Bereich: cremig =====
    p.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H - HEADER_H - 3, color: BG_CREAM });

    // "Für [HUNDENAME]" groß, zentriert
    const fuer = "Für";
    const fw = fontReg.widthOfTextAtSize(fuer, 18);
    p.drawText(fuer, { x: (A4_W - fw) / 2, y: A4_H - HEADER_H - 90, size: 18, font: fontReg, color: TEXT_MEDIUM });

    const nameSize = 44;
    const nw = fontBold.widthOfTextAtSize(DOG_NAME, nameSize);
    p.drawText(DOG_NAME, { x: (A4_W - nw) / 2, y: A4_H - HEADER_H - 150, size: nameSize, font: fontBold, color: DARK_BROWN });

    // Deko-Linie unter dem Namen
    p.drawRectangle({ x: (A4_W - 60) / 2, y: A4_H - HEADER_H - 170, width: 60, height: 2, color: GOLD });

    // Personalisierungs-Tags
    const tags = [DOG_BREED, DOG_AGE, MAIN_PROBLEM].filter(Boolean);
    const tagGap = 10;
    const tagFontSize = 11;
    const tagPadX = 12;
    const tagH = 24;
    // Gesamtbreite berechnen
    let totalTagsW = 0;
    const tagWidths = tags.map((t) => fontBold.widthOfTextAtSize(t, tagFontSize) + tagPadX * 2);
    totalTagsW = tagWidths.reduce((a, b) => a + b, 0) + tagGap * (tags.length - 1);
    let tagX = (A4_W - totalTagsW) / 2;
    const tagY = A4_H - HEADER_H - 220;
    for (let i = 0; i < tags.length; i++) {
      drawRoundedRect(p, tagX, tagY, tagWidths[i], tagH, 12, WHITE);
      // dünner Goldrand simulieren: kleiner Strich unten
      p.drawRectangle({ x: tagX, y: tagY, width: tagWidths[i], height: 1.2, color: GOLD });
      const tx = tagX + tagPadX;
      p.drawText(tags[i], { x: tx, y: tagY + 7, size: tagFontSize, font: fontBold, color: DARK_BROWN });
      tagX += tagWidths[i] + tagGap;
    }

    // Abschluss-Blurb unten
    const blurb = "Notiere jeden Tag kurz, was geklappt hat. In 28 Tagen\nschaust du zurück und siehst den Fortschritt schwarz auf weiß.";
    const blurbLines = blurb.split("\n");
    let by = 170;
    for (const line of blurbLines) {
      const lw = fontReg.widthOfTextAtSize(line, 12);
      p.drawText(line, { x: (A4_W - lw) / 2, y: by, size: 12, font: fontReg, color: TEXT_MEDIUM });
      by -= 18;
    }

    // Paw-Icon kleiner unten
    drawPaw(p, A4_W / 2, 100, 0.7, GOLD);

    // Footer-Band
    p.drawRectangle({ x: 0, y: 0, width: A4_W, height: 8, color: GOLD });
  }

  // ===== PAGE 2 — So nutzt du dein Tagebuch =====
  {
    const p = doc.addPage([A4_W, A4_H]);
    p.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
    p.drawRectangle({ x: 0, y: A4_H - 6, width: A4_W, height: 6, color: GOLD });

    let y = A4_H - 70;
    p.drawText("So nutzt du dein Tagebuch", {
      x: MARGIN, y, size: 24, font: fontBold, color: DARK_BROWN,
    });
    y -= 14;
    p.drawRectangle({ x: MARGIN, y, width: 50, height: 2, color: GOLD });
    y -= 28;
    const intro = `Dieses Tagebuch begleitet dich und ${DOG_NAME} durch die nächsten 4 Wochen. Es braucht keine Stunden — 2 Minuten pro Tag reichen.`;
    const introLines = wrapText(intro, fontReg, 12, CONTENT_W);
    for (const l of introLines) {
      p.drawText(l, { x: MARGIN, y, size: 12, font: fontReg, color: TEXT_MEDIUM });
      y -= 17;
    }
    y -= 20;

    const steps = [
      {
        t: "Jeden Tag kurz eintragen",
        d: "2 Minuten reichen. Ein Haken, eine Beobachtung — mehr nicht. Dranbleiben schlägt Perfektion.",
      },
      {
        t: "Abend oder Morgen — find deinen Rhythmus",
        d: "Manche tragen abends ein, andere beim Morgenkaffee. Was für dich funktioniert, ist richtig.",
      },
      {
        t: "Erfolge feiern, auch die kleinen",
        d: "Hat dein Hund heute nur 2 Sekunden ruhig an der Leine gewartet? Das zählt. Kleine Siege addieren sich.",
      },
      {
        t: "Nach 4 Wochen Fortschritt vergleichen",
        d: "Auf der letzten Seite vergleichst du Start und Ende. Du wirst überrascht sein, wie viel sich bewegt hat.",
      },
    ];

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      // Nummer-Kreis
      p.drawCircle({ x: MARGIN + 16, y: y - 4, size: 14, color: GOLD });
      const nr = String(i + 1);
      const nw = fontBold.widthOfTextAtSize(nr, 13);
      p.drawText(nr, { x: MARGIN + 16 - nw / 2, y: y - 9, size: 13, font: fontBold, color: WHITE });

      p.drawText(s.t, { x: MARGIN + 42, y: y - 2, size: 13.5, font: fontBold, color: DARK_BROWN });
      y -= 20;
      const dLines = wrapText(s.d, fontReg, 11, CONTENT_W - 42);
      for (const l of dLines) {
        p.drawText(l, { x: MARGIN + 42, y, size: 11, font: fontReg, color: TEXT_MEDIUM });
        y -= 15;
      }
      y -= 18;
    }

    // Box unten: Warum Tagebuch?
    const boxH = 80;
    const boxY = 120;
    drawRoundedRect(p, MARGIN, boxY, CONTENT_W, boxH, 10, BG_WARM);
    p.drawRectangle({ x: MARGIN, y: boxY, width: 4, height: boxH, color: ORANGE });

    p.drawText("Warum ein Tagebuch?", { x: MARGIN + 18, y: boxY + boxH - 24, size: 13, font: fontBold, color: DARK_BROWN });
    const stat = "94 % der Halter, die ein Tagebuch führen, schaffen den Plan komplett.";
    const stl = wrapText(stat, fontReg, 11.5, CONTENT_W - 36);
    let sy = boxY + boxH - 44;
    for (const line of stl) {
      p.drawText(line, { x: MARGIN + 18, y: sy, size: 11.5, font: fontReg, color: TEXT_DARK });
      sy -= 15;
    }

    drawPageFooter(p, 2, TOTAL_PAGES, fontReg);
  }

  // ===== PAGE 3 — Baseline =====
  {
    const p = doc.addPage([A4_W, A4_H]);
    p.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
    p.drawRectangle({ x: 0, y: A4_H - 6, width: A4_W, height: 6, color: GOLD });

    let y = A4_H - 70;
    p.drawText("Startpunkt: Wo stehen wir heute?", {
      x: MARGIN, y, size: 22, font: fontBold, color: DARK_BROWN,
    });
    y -= 14;
    p.drawRectangle({ x: MARGIN, y, width: 50, height: 2, color: GOLD });
    y -= 26;
    p.drawText("Einmalig auszufüllen an Tag 1 — die Baseline für deinen Fortschritt.", {
      x: MARGIN, y, size: 11, font: fontItalic, color: TEXT_MEDIUM,
    });
    y -= 28;

    // 3 Skalen
    const scales = [
      `Wie problematisch ist ${MAIN_PROBLEM} aktuell?   (1 = kaum  ·  10 = extrem)`,
      "Wie oft triggert das Problem pro Tag?   (1 = selten  ·  10 = ständig)",
      "Wie gestresst bist du dadurch?   (1 = gar nicht  ·  10 = sehr)",
    ];

    for (const label of scales) {
      const labelLines = wrapText(label, fontBold, 11, CONTENT_W);
      for (const l of labelLines) {
        p.drawText(l, { x: MARGIN, y, size: 11, font: fontBold, color: TEXT_DARK });
        y -= 15;
      }
      y -= 4;
      drawScale(p, MARGIN + 5, y - 6, fontReg);
      y -= 36;
    }

    // Freitext-Felder
    const fields = [
      `Mein größter Wunsch für die nächsten 4 Wochen mit ${DOG_NAME}:`,
      "Was habe ich schon probiert?",
    ];
    const LINES_PER_FIELD = 3;
    for (const fLabel of fields) {
      p.drawText(fLabel, { x: MARGIN, y, size: 11, font: fontBold, color: TEXT_DARK });
      y -= 18;
      for (let i = 0; i < LINES_PER_FIELD; i++) {
        drawWriteLine(p, MARGIN, y, CONTENT_W);
        y -= 22;
      }
      y -= 8;
    }

    // Datum-Zeile unten
    y = 120;
    p.drawText("Datum Tag 1:", { x: MARGIN, y, size: 11, font: fontBold, color: TEXT_DARK });
    drawWriteLine(p, MARGIN + 85, y - 3, 160);

    p.drawText("Unterschrift:", { x: MARGIN + 280, y, size: 11, font: fontBold, color: TEXT_DARK });
    drawWriteLine(p, MARGIN + 360, y - 3, CONTENT_W - 360);

    drawPageFooter(p, 3, TOTAL_PAGES, fontReg);
  }

  // ===== PAGES 4-11 — Wochen (4 Wochen × 2 Seiten) =====
  for (let week = 1; week <= 4; week++) {
    // ---- Linke Seite: Woche X — Tages-Tracker ----
    {
      const p = doc.addPage([A4_W, A4_H]);
      p.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
      p.drawRectangle({ x: 0, y: A4_H - 6, width: A4_W, height: 6, color: GOLD });

      // Header-Badge mit Wochennummer
      let y = A4_H - 70;
      const badgeW = 68;
      const badgeH = 28;
      drawRoundedRect(p, MARGIN, y - 22, badgeW, badgeH, 6, DARK_BROWN);
      const badgeTxt = `WOCHE ${week}`;
      const btw = fontBold.widthOfTextAtSize(badgeTxt, 11);
      p.drawText(badgeTxt, { x: MARGIN + (badgeW - btw) / 2, y: y - 15, size: 11, font: fontBold, color: GOLD, characterSpacing: 1.2 });

      const head = `Woche ${week} von 4`;
      p.drawText(head, { x: MARGIN + badgeW + 14, y: y - 14, size: 22, font: fontBold, color: DARK_BROWN });
      y -= 40;
      p.drawRectangle({ x: MARGIN, y, width: CONTENT_W, height: 1, color: BORDER_LIGHT });
      y -= 20;

      // Wochen-Ziel-Feld
      p.drawText("Diese Woche fokussiere ich mich auf …", {
        x: MARGIN, y, size: 11, font: fontBold, color: TEXT_DARK,
      });
      y -= 16;
      drawWriteLine(p, MARGIN, y, CONTENT_W);
      y -= 20;
      drawWriteLine(p, MARGIN, y, CONTENT_W);
      y -= 22;

      // 7-Tage-Raster
      const days = ["Tag 1", "Tag 2", "Tag 3", "Tag 4", "Tag 5", "Tag 6", "Tag 7"];
      const rowH = 54;
      for (let i = 0; i < days.length; i++) {
        const rowY = y - rowH;
        // Subtile Card
        drawRoundedRect(p, MARGIN, rowY, CONTENT_W, rowH - 4, 6, BG_CREAM);

        // Tag-Label + Datum-Linie
        p.drawText(days[i], { x: MARGIN + 12, y: rowY + rowH - 20, size: 11, font: fontBold, color: DARK_BROWN });
        p.drawText("Datum:", { x: MARGIN + 58, y: rowY + rowH - 20, size: 9.5, font: fontReg, color: TEXT_MEDIUM });
        drawWriteLine(p, MARGIN + 94, rowY + rowH - 23, 70);

        // 3 Checkboxen rechts
        const cbSize = 10;
        const cbStartX = MARGIN + 180;
        const cbGap = 112;
        const labels = ["Übung gemacht", "Erfolg gehabt", "Rückschritt"];
        for (let c = 0; c < labels.length; c++) {
          const cbX = cbStartX + c * cbGap;
          const cbY = rowY + rowH - 24;
          drawCheckbox(p, cbX, cbY, cbSize);
          p.drawText(labels[c], { x: cbX + cbSize + 5, y: cbY + 1.5, size: 9.5, font: fontReg, color: TEXT_DARK });
        }

        // Beobachtungs-Zeile
        p.drawText("Beobachtung:", { x: MARGIN + 12, y: rowY + 12, size: 9.5, font: fontBold, color: TEXT_MEDIUM });
        drawWriteLine(p, MARGIN + 82, rowY + 10, CONTENT_W - 94);

        y = rowY;
      }

      // Motivations-Zitat
      y -= 24;
      const quote = "„" + WEEK_QUOTES[week - 1] + "\"";
      const qLines = wrapText(quote, fontItalic, 12, CONTENT_W - 40);
      for (const l of qLines) {
        const lw = fontItalic.widthOfTextAtSize(l, 12);
        p.drawText(l, { x: (A4_W - lw) / 2, y, size: 12, font: fontItalic, color: GOLD_DARK });
        y -= 16;
      }

      drawPageFooter(p, 3 + (week - 1) * 2 + 1, TOTAL_PAGES, fontReg);
    }

    // ---- Rechte Seite: Wochen-Reflexion ----
    {
      const p = doc.addPage([A4_W, A4_H]);
      p.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
      p.drawRectangle({ x: 0, y: A4_H - 6, width: A4_W, height: 6, color: GOLD });

      let y = A4_H - 70;
      p.drawText(`Wochen-Reflexion · Woche ${week}`, {
        x: MARGIN, y, size: 20, font: fontBold, color: DARK_BROWN,
      });
      y -= 14;
      p.drawRectangle({ x: MARGIN, y, width: 50, height: 2, color: GOLD });
      y -= 20;
      p.drawText("Am Ende der Woche auszufüllen — ehrlich zu dir selbst.", {
        x: MARGIN, y, size: 11, font: fontItalic, color: TEXT_MEDIUM,
      });
      y -= 26;

      const questions = [
        { q: "Was hat diese Woche besonders gut geklappt?", lines: 3 },
        { q: "Was war schwierig?",                           lines: 3 },
        { q: "Welche Übung war am effektivsten?",            lines: 2 },
      ];
      for (const item of questions) {
        p.drawText(item.q, { x: MARGIN, y, size: 11.5, font: fontBold, color: TEXT_DARK });
        y -= 16;
        for (let i = 0; i < item.lines; i++) {
          drawWriteLine(p, MARGIN, y, CONTENT_W);
          y -= 22;
        }
        y -= 6;
      }

      // Skala 1-10
      p.drawText("Skala 1–10: Wie zufrieden bin ich mit dieser Woche?", {
        x: MARGIN, y, size: 11.5, font: fontBold, color: TEXT_DARK,
      });
      y -= 22;
      drawScale(p, MARGIN + 5, y, fontReg);
      y -= 40;

      // Erfolgs-Sticker (7 Sterne-Boxen zum Abhaken)
      p.drawText("Erfolgs-Sticker — male aus oder hake ab, was diese Woche gelungen ist:", {
        x: MARGIN, y, size: 10.5, font: fontBold, color: TEXT_DARK,
      });
      y -= 22;
      const stickers = [
        "Dran­geblieben",
        "1 kleiner Sieg",
        "Ruhe bewahrt",
        "Geduld",
        "Neuer Versuch",
        "Erkenntnis",
        "Fortschritt",
      ];
      const stickerW = 68;
      const stickerH = 46;
      const stickerGap = 8;
      const perRow = Math.floor((CONTENT_W + stickerGap) / (stickerW + stickerGap));
      let sx = MARGIN;
      let sy = y - stickerH;
      for (let i = 0; i < stickers.length; i++) {
        if (i > 0 && i % perRow === 0) {
          sx = MARGIN;
          sy -= stickerH + stickerGap;
        }
        drawRoundedRect(p, sx, sy, stickerW, stickerH, 8, BG_CREAM);
        // Stern oben (dreieck-Annäherung: Kreis mit Punkt)
        p.drawCircle({ x: sx + stickerW / 2, y: sy + stickerH - 14, size: 7, color: GOLD });
        const lbl = stickers[i];
        const lw = fontReg.widthOfTextAtSize(lbl, 8);
        p.drawText(lbl, { x: sx + (stickerW - lw) / 2, y: sy + 10, size: 8, font: fontReg, color: TEXT_DARK });
        sx += stickerW + stickerGap;
      }

      drawPageFooter(p, 3 + (week - 1) * 2 + 2, TOTAL_PAGES, fontReg);
    }
  }

  // ===== PAGE 12 — Abschluss =====
  {
    const p = doc.addPage([A4_W, A4_H]);
    p.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
    p.drawRectangle({ x: 0, y: A4_H - 6, width: A4_W, height: 6, color: GOLD });

    let y = A4_H - 70;
    p.drawText("Deine Reise in 4 Wochen", {
      x: MARGIN, y, size: 24, font: fontBold, color: DARK_BROWN,
    });
    y -= 14;
    p.drawRectangle({ x: MARGIN, y, width: 50, height: 2, color: GOLD });
    y -= 26;
    const introEnd = `Trag die gleichen Werte wie an Tag 1 erneut ein. Vergleich Start und Ende — so siehst du schwarz auf weiß, was sich bei ${DOG_NAME} verändert hat.`;
    const introLines = wrapText(introEnd, fontReg, 11.5, CONTENT_W);
    for (const l of introLines) {
      p.drawText(l, { x: MARGIN, y, size: 11.5, font: fontReg, color: TEXT_MEDIUM });
      y -= 16;
    }
    y -= 14;

    // Vergleichs-Tabelle: Kopf
    const colW = CONTENT_W / 3;
    const col1X = MARGIN;
    const col2X = MARGIN + colW;
    const col3X = MARGIN + colW * 2;

    drawRoundedRect(p, MARGIN, y - 26, CONTENT_W, 26, 4, DARK_BROWN);
    p.drawText("Thema", { x: col1X + 12, y: y - 18, size: 10.5, font: fontBold, color: GOLD });
    p.drawText("Start (Tag 1)", { x: col2X + 12, y: y - 18, size: 10.5, font: fontBold, color: GOLD });
    p.drawText("Ende (Tag 28)", { x: col3X + 12, y: y - 18, size: 10.5, font: fontBold, color: GOLD });
    y -= 30;

    const topics = [
      `Problem „${MAIN_PROBLEM}" (1–10)`,
      "Häufigkeit pro Tag (1–10)",
      "Mein Stress-Level (1–10)",
    ];
    for (const topic of topics) {
      drawRoundedRect(p, MARGIN, y - 36, CONTENT_W, 36, 4, BG_CREAM);

      const tLines = wrapText(topic, fontBold, 10.5, colW - 24);
      let ty = y - 16;
      for (const l of tLines) {
        p.drawText(l, { x: col1X + 12, y: ty, size: 10.5, font: fontBold, color: TEXT_DARK });
        ty -= 12;
      }
      // Felder für Start / Ende
      drawRoundedRect(p, col2X + 12, y - 27, 40, 20, 4, WHITE);
      drawRoundedBorder(p, col2X + 12, y - 27, 40, 20, 4, LINE_LIGHT, 0.8);
      drawRoundedRect(p, col3X + 12, y - 27, 40, 20, 4, WHITE);
      drawRoundedBorder(p, col3X + 12, y - 27, 40, 20, 4, LINE_LIGHT, 0.8);
      p.drawText("/10", { x: col2X + 58, y: y - 22, size: 10, font: fontReg, color: TEXT_MEDIUM });
      p.drawText("/10", { x: col3X + 58, y: y - 22, size: 10, font: fontReg, color: TEXT_MEDIUM });

      y -= 42;
    }
    y -= 14;

    // Freitext: Was ist anders?
    p.drawText(`Was ist nach 4 Wochen anders mit ${DOG_NAME}?`, {
      x: MARGIN, y, size: 11.5, font: fontBold, color: TEXT_DARK,
    });
    y -= 16;
    for (let i = 0; i < 3; i++) {
      drawWriteLine(p, MARGIN, y, CONTENT_W);
      y -= 22;
    }
    y -= 10;

    // Motivations-Abschluss
    const endBoxY = 110;
    const endBoxH = 78;
    drawRoundedRect(p, MARGIN, endBoxY, CONTENT_W, endBoxH, 10, DARK_BROWN);
    const endTitle = "Jetzt ist die Gewohnheit gebaut.";
    const etw = fontBold.widthOfTextAtSize(endTitle, 16);
    p.drawText(endTitle, { x: (A4_W - etw) / 2, y: endBoxY + endBoxH - 26, size: 16, font: fontBold, color: GOLD });

    const endSub = "Mach weiter. Die ersten 4 Wochen sind das Fundament — der Rest baut sich darauf auf.";
    const esLines = wrapText(endSub, fontReg, 11, CONTENT_W - 40);
    let esy = endBoxY + endBoxH - 46;
    for (const l of esLines) {
      const lw = fontReg.widthOfTextAtSize(l, 11);
      p.drawText(l, { x: (A4_W - lw) / 2, y: esy, size: 11, font: fontReg, color: WHITE });
      esy -= 14;
    }

    drawPageFooter(p, 12, TOTAL_PAGES, fontReg);
  }

  const pdfBytes = await doc.save();
  const outPath = "public/tagebuch-4wochen-TEST.pdf";
  writeFileSync(outPath, pdfBytes);
  console.log(`\n✅ PDF erzeugt: ${outPath}  (${pdfBytes.byteLength.toLocaleString("de-DE")} bytes)`);
  console.log(`   Personalisiert für: ${DOG_NAME} · ${DOG_BREED} · ${DOG_AGE} · ${MAIN_PROBLEM}`);
}

main().catch((e) => {
  console.error("Fehler:", e);
  process.exit(1);
});
