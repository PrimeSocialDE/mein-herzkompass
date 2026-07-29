// Generiert einen Zusatz-Modul-PDF (10 Seiten A4 Querformat) im
// PfotenPlan-Style. Layout ist 1:1 an die zwei Sample-PDFs angelehnt
// (Leinenführung "Mogli" + Energie & Ruhe "Blues").
//
// Personalisierung: nur Hundename (+ ggf. Rasse) wird ausgetauscht,
// der Rest des Inhalts ist statisch.
//
// Verfuegbare Module:
//   - pulling: Leinenführungs-Plan
//   - energy: Energie- & Ruhe-Plan
//
// Verwendung als Modul:
//   import { buildPdf } from "./generate-zusatzmodul-pdf.mjs";
//   const bytes = await buildPdf({
//     dogName: "Bruno",
//     dogBreed: "Labrador-Mix",
//     moduleKey: "pulling",
//   });
//
// CLI: DOG_NAME="Bruno" MODULE_KEY="pulling" node generate-zusatzmodul-pdf.mjs

import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { writeFileSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join as pathJoin } from "path";
import QRCode from "qrcode";

// __dirname-Aequivalent fuer ESM — zeigt auf Repo-Root (wo dieses File liegt)
const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = (file) => pathJoin(__dirname, "public", file);
// Unicode-Fonts (Arimo, gebuendelt in public/fonts/) — noetig fuer polnische
// Zeichen (ł ą ę ó ś ż ź ć ń). StandardFonts.Helvetica (WinAnsi) kann das nicht.
const ARIMO_REG    = pathJoin(__dirname, "public", "fonts", "Arimo-Regular.ttf");
const ARIMO_BOLD   = pathJoin(__dirname, "public", "fonts", "Arimo-Bold.ttf");
const ARIMO_ITALIC = pathJoin(__dirname, "public", "fonts", "Arimo-Italic.ttf");

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
// Diese Konstanten dienen nur als Default beim direkten CLI-Aufruf.
// Bei Library-Nutzung kommen die Werte als params in buildPdf().
const DEFAULT_DOG_NAME     = "Yuna";
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
  const label = "ZampaPlan";
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

// Wochen-Label-Box (oben links auf Wochen-Seiten, mit weichem Tan-Hintergrund)
function drawWeekLabel(page, weekNr, x, y, fontBold) {
  const label = `Settimana ${weekNr}`;
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


// ========= Module-Configs (Content 1:1 aus Sample-PDFs) =========
// Personalisierung: ${'$'}{dogName} wird im Code ersetzt.

const MODULES = {
  pulling: {
    coverTitle: "Piano di camminata al guinzaglio morbido per",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Perché questo piano è costruito proprio così",
      subtitle: "Con calma fin dall'inizio",
      paras: [
        "{dogName} ha la sua storia, il suo temperamento e le sue esperienze. È proprio questo a renderlo unico e a spiegare perché camminare al guinzaglio a volte sia una sfida.",
        "La sua energia e il suo bisogno di movimento non sono un problema, ma un segnale di quanto sia importante per lui un orientamento chiaro. Quando {dogName} tira al guinzaglio, spesso mostra così eccitazione, attesa o tensione interiore.",
        "I problemi al guinzaglio nascono spesso quando il cane è più veloce della persona, sia fuori che dentro di sé. In quel momento non manca l'obbedienza, ma una guida calma e comprensibile nella vita di tutti i giorni.",
        "Questo piano vuole dare a te e a {dogName} un percorso chiaro e realizzabile. Al centro c'è il vostro orientamento reciproco, non il controllo o la costrizione.",
      ],
    },
    how: {
      title: "Come svolgere correttamente gli esercizi",
      paras: [
        "Gli esercizi di questo piano si costruiscono passo dopo passo l'uno sull'altro. Partite da basi tranquille, in modo che {dogName} possa imparare a orientarsi su di te prima che le cose si facciano più stimolanti.",
        "Quando le basi sono acquisite, si aggiungono esercizi che consolidano la sua attenzione e la mettono in movimento. {dogName} conosce già alcuni segnali: li usiamo per dargli sicurezza e chiarezza al guinzaglio.",
        "In seguito i contenuti vengono trasferiti gradualmente nella vostra quotidianità, per esempio durante le normali passeggiate o in situazioni più stimolanti. Così {dogName} impara che ciò che ha appreso è utile non solo a casa o in un ambiente tranquillo.",
        "Non devi fare tutto in una volta. Uno o due esercizi svolti bene per passeggiata bastano e valgono più di tanti tentativi rapidi senza calma e senza ripetizioni.",
      ],
    },
    exercises: [
      {
        title: "Partenza tranquilla alla porta",
        intro: "Una partenza tranquilla con una guida chiara dà il tono a tutta la passeggiata.",
        steps: [
          { name: "Metti il guinzaglio e aspetta un momento", desc: "Metti il guinzaglio e resta fermo con calma. Nessun movimento in avanti, nessuna partenza. Aspetta un momento, finché il cane non si calma." },
          { name: "Tocca la maniglia senza aprire", desc: "Tocca la maniglia. Se compaiono nervosismo, salti o spinte in avanti, lascia la maniglia e aspetta un momento. La calma permette il passo successivo, l'agitazione ferma tutto." },
          { name: "Socchiudi la porta", desc: "Apri la porta solo di poco. Se il cane spinge in avanti, chiudi la porta e aspetta. Se è tranquillo, continua ad aprire la porta." },
          { name: "Il primo passo all'aperto", desc: "Esci prima tu all'aperto. Il cane ti segue, senza spingersi avanti. Se spinge, torna indietro di un passo, socchiudi la porta, aspetta un momento e riprova." },
          { name: "All'aperto fermati un momento", desc: "All'aperto fermati per 2-5 secondi. Tieni il guinzaglio morbido. Concedigli un momento per calmarsi e ripartire consapevolmente con calma." },
          { name: "Riparti solo con il guinzaglio morbido", desc: "Riparti solo quando il guinzaglio è morbido. Tirare significa fermarsi. Il guinzaglio morbido significa proseguire." },
        ],
        frequency: ["Esegui una volta a ogni passeggiata", "Prevedi 2-4 minuti all'inizio", "Meglio due tentativi brevi che uno lungo"],
        watchFor: ["La calma prima della velocità", "Postura rilassata e stabile", "Il guinzaglio resta morbido"],
        gos: ["La porta si apre solo con la calma", "Concedi consapevolmente piccole pause", "Loda con calma l'orientamento"],
        noGos: ["Non tirare né strattonare", "Non gridare né parlare con nervosismo", "Non cedere quando spinge"],
      },
      {
        title: "Orientamento al fianco",
        intro: "Orientamento sulla posizione di chi conduce.",
        steps: [
          { name: "Riparti in modo rilassato", desc: "Inizia in modo del tutto normale. Il guinzaglio è morbido, l'andatura tranquilla. Conta una partenza rilassata, non la perfezione." },
          { name: "Definisci la tua zona", desc: "Lascia che il cane cammini al tuo fianco, non davanti a te. Immagina una piccola zona al fianco in cui il movimento è permesso. Quando il cane si spinge chiaramente in avanti, ci si ferma." },
          { name: "Tirare ferma subito", desc: "Non appena sul guinzaglio compare tensione, fermati con calma. Nessuno strattone e nessuna parola. L'immobilità è una conseguenza chiara." },
          { name: "Aspetta che il guinzaglio si ammorbidisca di nuovo", desc: "Aspetta un momento. Spesso segue un voltarsi o un passo indietro. Nel momento in cui il guinzaglio si ammorbidisce, proseguite." },
          { name: "Il movimento è la ricompensa", desc: "Si prosegue solo con il guinzaglio morbido. Così nasce l'associazione: adeguarsi porta progresso." },
          { name: "Ripeti e prosegui normalmente", desc: "Questo si ripete più volte durante la passeggiata. Mantieni la calma, agisci con coerenza e non farne un dramma." },
        ],
        frequency: ["Inseriscilo a ogni passeggiata", "5-10 minuti per giro", "Meglio alcune sequenze brevi"],
        watchFor: ["La tua andatura detta il ritmo", "Il guinzaglio resta morbido", "Mantieni la calma, non discutere"],
        gos: ["Resta immobile quando tira", "Prosegui con il guinzaglio morbido", "Conferma con calma la vicinanza"],
        noGos: ["Non tirare né strattonare", "Non parlargli di continuo", "Non accelerare quando tira"],
      },
      {
        title: "Cambio di direzione senza preavviso",
        intro: "Attenzione rivolta a chi si prende cura di lui invece di tirare in avanti.",
        steps: [
          { name: "Cammina normalmente e tieni il guinzaglio morbido", desc: "Cammina rilassato dritto davanti a te. Il cane cammina tranquillo di fianco, senza continue parole. L'esercizio funziona solo con la tua stessa calma." },
          { name: "Cambio di direzione dalla vita di tutti i giorni", desc: "Cambia improvvisamente direzione senza dire nulla. Non con nervosismo, ma in modo chiaro. Semplicemente girati oppure vai a sinistra o a destra." },
          { name: "L'attenzione arriva da sola", desc: "Il cane si accorge di dove va chi lo conduce. Seguirti con un breve ritardo va benissimo." },
          { name: "Nessuna parola, nessuna correzione", desc: "Nessuna spiegazione, solo la guida attraverso il movimento. Se c'è un breve disorientamento, prosegui con calma nella nuova direzione." },
          { name: "Quando tira, di nuovo stop", desc: "Quando sul guinzaglio compare tensione, fermati con calma. Quando il guinzaglio torna morbido, prosegui nella direzione scelta." },
          { name: "Conferma con calma", desc: "Un buon seguire si può lodare o confermare brevemente. Con calma e chiarezza, senza eccitazione." },
        ],
        frequency: ["2-3 cambi di direzione per passeggiata", "Usalo in modo breve e mirato", "Inizia solo con il guinzaglio morbido"],
        watchFor: ["Nessun preavviso", "Movimento invece di parole", "Resta calmo e chiaro"],
        gos: ["Gira dolcemente, ma in modo inequivocabile", "Conferma il guinzaglio morbido", "Sii coerente"],
        noGos: ["Non avvisare in anticipo", "Non strattonare né tirare con forza", "Non agire con nervosismo"],
      },
      {
        title: "Fermarsi quando tira",
        intro: "Camminare con il guinzaglio morbido porta alla meta.",
        steps: [
          { name: "Parti come in una normale passeggiata", desc: "Inizia rilassato e cammina. L'esercizio nasce direttamente dalla quotidianità." },
          { name: "Riconosci presto la tensione", desc: "Non appena il guinzaglio si tende, reagisci subito. Non dopo alcuni passi, ma immediatamente al primo tiro." },
          { name: "Fermati immediatamente", desc: "Fermati completamente. Nessun proseguire, nessuna parola, nessuna pressione. Aspetta semplicemente con calma." },
          { name: "La tensione si scioglie da sola", desc: "Spesso segue un voltarsi, un tornare indietro o un cambio di posizione. Nel momento in cui il guinzaglio torna morbido, va tutto bene." },
          { name: "Proseguire come ricompensa chiara", desc: "Quando il guinzaglio è morbido, prosegui. La logica è inequivocabile: il guinzaglio morbido significa progresso." },
          { name: "Sempre allo stesso modo", desc: "Ogni volta agisci in modo identico. Così tutto diventa chiaro, comprensibile e giusto." },
        ],
        frequency: ["Usalo a ogni tiro", "Fermate di soli pochi secondi", "Più volte per passeggiata"],
        watchFor: ["Stop immediato quando tira", "Aspetta con pazienza", "Prosegui solo con il guinzaglio morbido"],
        gos: ["Resta fermo con calma", "Prosegui con coerenza", "Ricompensa il guinzaglio morbido"],
        noGos: ["Non proseguire nonostante il tiro", "Non tirare né trattenere", "Non gridare"],
      },
      {
        title: "Passare con calma accanto alle distrazioni",
        intro: "Calmo e attento, anche di fronte alle distrazioni.",
        steps: [
          { name: "Riconosci presto la distrazione", desc: "Di fronte a un cane, una persona o uno stimolo, decidi in anticipo quale distanza permette la calma." },
          { name: "Usa la distanza come strumento", desc: "Fai una curva, cambia lato della strada o aumenta la distanza. La distanza è puro allenamento." },
          { name: "Mantieni l'andatura", desc: "Prosegui con calma. Nessuna fermata per osservare. Se fissa qualcosa, resta in movimento e crea distanza." },
          { name: "Tirare aumenta la distanza", desc: "Non andare verso la distrazione. Aumenta la distanza o devia leggermente, finché il guinzaglio non è morbido." },
          { name: "Conferma i momenti di calma", desc: "Loda con calma o ricompensa brevemente il contatto visivo o il guinzaglio morbido." },
          { name: "Mantieni breve l'allenamento", desc: "Poche situazioni riuscite sono meglio di tante che sovraccaricano. L'obiettivo sono i successi." },
        ],
        frequency: ["1-2 distrazioni per passeggiata", "Inizia con una grande distanza", "Allunga lentamente la durata"],
        watchFor: ["La distanza mantiene la calma", "L'andatura resta costante", "Non permettere che fissi"],
        gos: ["Cammina facendo curve", "Crea distanza per tempo", "Ricompensa l'orientamento"],
        noGos: ["Non andare frontalmente", "Non fermarti a fissare", "Non correggere sotto stress"],
      },
      {
        title: "Concludere la passeggiata con calma",
        intro: "Un rientro tranquillo dopo la passeggiata.",
        steps: [
          { name: "Rallenta l'andatura negli ultimi minuti", desc: "Poco prima di casa rallenta consapevolmente. Una conclusione tranquilla e chiara invece del nervosismo." },
          { name: "Guinzaglio morbido, linguaggio del corpo calmo", desc: "Resta rilassato e tieni il guinzaglio morbido. La passeggiata si spegne, non si carica." },
          { name: "Davanti alla porta fermati un attimo", desc: "Prima di aprire fermati un momento. Lascialo calmare, invece di precipitarsi dentro." },
          { name: "Apri la porta solo con la calma", desc: "Se spinge, salta o tira, aspetta un momento. La porta si apre solo con la calma." },
          { name: "Entra con calma", desc: "Entra prima tu, lascia che il cane ti segua. Senza fretta, senza tirare. La calma mette in moto." },
          { name: "Concludi consapevolmente la passeggiata", desc: "Dentro togli il guinzaglio, conferma con calma, fatto. Una conclusione chiara e rilassata." },
        ],
        frequency: ["Usalo a ogni passeggiata", "Sfrutta consapevolmente gli ultimi minuti", "Senza pressione di tempo alla fine"],
        watchFor: ["Rallenta lentamente l'andatura", "La porta solo con la calma", "Il guinzaglio resta morbido"],
        gos: ["Una conclusione tranquilla", "Concedi brevi pause", "Resta chiaro e rilassato"],
        noGos: ["Non agire con nervosismo", "Non lasciarlo tirare", "Non spingerti in avanti quando spinge"],
      },
      {
        title: "Il cambio di andatura come strumento di attenzione",
        intro: "Cambi di andatura imprevedibili spingono il cane a orientarsi su di te.",
        steps: [
          { name: "Mantieni l'andatura normale", desc: "Inizia la passeggiata alla tua andatura abituale. Il guinzaglio è morbido, {dogName} cammina rilassato di fianco. Prima il ritmo, poi il cambio." },
          { name: "Rallenta all'improvviso", desc: "Senza preavviso dimezza l'andatura. Passo dopo passo rallenta chiaramente. {dogName} deve adeguarsi, altrimenti si spinge in avanti." },
          { name: "Ricompensa subito l'adeguamento", desc: "Quando adegua l'andatura al fianco: BRAVO, un premietto proprio lungo la gamba dei pantaloni. Sei tu a dettare l'andatura, non l'odore davanti al naso." },
          { name: "Accelera all'improvviso", desc: "Dopo alcuni passi lenti: senza preavviso passa a un'andatura veloce, quasi un trotto. {dogName} deve di nuovo tenere il passo." },
          { name: "Da 6 a 10 cambi per passeggiata", desc: "Distribuisci diversi cambi di andatura su tutta la passeggiata. Senza schema, in modo imprevedibile. È proprio questo lo stimolo." },
          { name: "Variante con svolte di 90 gradi", desc: "Invece del cambio di andatura, a volte una breve svolta di 90 gradi. Stessa meccanica: {dogName} ti segue, BRAVO + premietto al fianco." },
        ],
        frequency: ["Inseriscilo a ogni passeggiata", "6-10 cambi distribuiti"],
        watchFor: ["Cambio senza preavviso", "Ricompensa subito l'adeguamento"],
        gos: ["Resta imprevedibile", "Ricompensa lungo la cucitura dei pantaloni"],
        noGos: ["Dire in anticipo «ora attento»", "Gridare quando si spinge avanti"],
      },
      {
        title: "La pausa per annusare come ricompensa",
        intro: "Annusare è un bisogno. Lo usiamo come ricompensa per il guinzaglio morbido.",
        steps: [
          { name: "Riconosci la fase rilassata", desc: "Osserva {dogName} con attenzione durante la passeggiata. Quando cammina rilassato con il guinzaglio morbido? Questi momenti sono occasioni per ricompensare." },
          { name: "Metti a disposizione un punto da annusare", desc: "Quando il guinzaglio è morbido e si presenta un punto da annusare: di' con calma CERCA e allenta un po' di più il guinzaglio. {dogName} può annusare con calma e a piacimento." },
          { name: "Da 60 a 90 secondi di tempo", desc: "Lascia annusare {dogName} un minuto o più, se il punto è interessante. Annusare riduce lo stress e stanca più del camminare." },
          { name: "Segnala una fine chiara", desc: "Concludi la pausa con un segnale come AVANTI. Richiama brevemente {dogName} al fianco con un premietto. Guinzaglio morbido: proseguiamo." },
          { name: "Quando tira: nessuna pausa", desc: "Quando {dogName} tira verso il punto da annusare, NON c'è pausa. Prima il ritorno al guinzaglio morbido, poi il permesso su tua iniziativa. Sei tu a decidere." },
          { name: "Da 4 a 6 pause per passeggiata", desc: "Distribuisci consapevolmente le pause per annusare su tutta la passeggiata. Non è un riempitivo, ma una parte preziosa della passeggiata." },
        ],
        frequency: ["Da 4 a 6 pause per passeggiata", "Distribuiscile consapevolmente su tutto il percorso"],
        watchFor: ["La pausa per annusare solo con il guinzaglio morbido", "Sei tu a decidere, non il cane"],
        gos: ["La pausa come ricompensa consapevole", "Concedi da 60 a 90 sec di tempo"],
        noGos: ["Fare pausa quando tira", "Lasciarlo andare dritto al punto da annusare"],
      },
    ],
    abschluss: {
      title: "Conclusione",
      subtitle: "In bocca al lupo",
      paras: [
        "Camminare al guinzaglio con {dogName} non è un progetto una tantum, ma un processo continuo. Ci saranno giorni in cui va tutto liscio e giorni più accidentati: entrambi fanno parte del percorso.",
        "Più importante della perfezione è che facciate progressi insieme. Già piccoli cambiamenti, come qualche passo tranquillo senza tirare, sono un segno che {dogName} inizia a orientarsi di più su di te.",
        "La tua coerenza calma e chiara è in questo decisiva. Quando resti prevedibile per {dogName} e applichi le regole con gentilezza ma con affidabilità, lui può sintonizzarsi meglio su di te.",
        "Usa questo piano come una cornice a cui torni sempre, che ripeti e adatti alla vostra quotidianità. Così camminare al guinzaglio diventa per te e {dogName} man mano sempre più naturale e rilassato.",
      ],
    },
  },

  energy: {
    coverTitle: "Piano di energia e calma per",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Perché questo piano è costruito proprio così",
      subtitle: "Con calma fin dall'inizio",
      paras: [
        "{dogName} ha per natura molta energia e vigilanza. Questo livello di energia non è né buono né cattivo, è semplicemente parte della sua personalità e del suo tipo.",
        "L'età, la razza e la quotidianità decidono insieme quanto facilmente il cane si calma. A ciò si aggiungono le esperienze fatte finora, per esempio quanto spesso {dogName} ha già imparato a contenersi anche quando è eccitato.",
        "Quando il cane ha poco vero riposo nell'arco della giornata, la tensione interiore si accumula. In {dogName} questo può manifestarsi con irritabilità, un richiamo più difficile, un tiro più forte al guinzaglio o una maggiore insicurezza.",
        "Questo piano punta sulla struttura, su routine ripetibili e su pause ben preparate. L'obiettivo non è stancare al massimo {dogName}, ma trovare un migliore equilibrio tra attività, chiarezza e calma.",
      ],
    },
    how: {
      title: "Come svolgere correttamente gli esercizi",
      paras: [
        "La base è un ritmo della giornata il più possibile chiaro per {dogName}. Le routine ripetibili lo aiutano a prevedere quando è il momento dell'azione e quando quello del riposo.",
        "Nelle fasi più attive {dogName} riceve compiti mirati e brevi unità che impegnano testa e corpo. Tra di esse seguono consapevoli fasi di calma, in cui non viene intrattenuto, ma può imparare a calmarsi e a staccare.",
        "Invece di un intrattenimento continuo, si tratta di esercizi che rafforzano la sua autoregolazione, per esempio l'attesa controllata, lo stare tranquillo sul tappetino o un richiamo ben strutturato seguito da una pausa. Così {dogName} può imparare passo dopo passo a tornare a uno stato interiore più calmo nonostante l'eccitazione.",
        "L'allenamento avviene nella normale quotidianità, durante la passeggiata, in casa e in brevi sequenze ben pianificate. Uno o due punti focali al giorno bastano, perché per {dogName} la qualità dell'esercizio e il riposo che ne segue sono più importanti del numero di azioni.",
      ],
    },
    exercises: [
      {
        title: "Stabilisci un luogo di calma per abbassare l'energia",
        intro: "Questo esercizio crea in casa una zona fissa che per il tuo cane si lega indissolubilmente alla sensazione di pesantezza fisica e di rilassamento.",
        steps: [
          { name: "Scegli un posto povero di stimoli", desc: "Scegli un posto per la cuccia o il tappetino lontano dal trambusto (un angolo tranquillo, non nell'ingresso né davanti alla porta del terrazzo). Qui il cane non deve sorvegliare né osservare nulla. È la sua «stazione di ricarica»." },
          { name: "Limita con il guinzaglio", desc: "Metti al cane il guinzaglio in casa. Questo evita la corsa nervosa avanti e indietro. Portalo senza parole e a passo lento sul suo tappetino. Il tuo movimento lento si trasmette a lui." },
          { name: "Aspetta, non forzare", desc: "Resta rilassato accanto al tappetino e aspetta. Non dare un comando come «TERRA». Aspetta semplicemente che il cane si annoi e si sieda o si sdrai da solo. Vogliamo che trovi la calma da sé, non che la riceva su comando." },
          { name: "Ricompensa la calma con il cibo", desc: "Quando il cane è sdraiato: con la massima calma metti un premietto tra le sue zampe anteriori. Non dire nulla oppure solo molto piano e in modo prolungato («Braaavo»). Una lode nervosa lo caricherebbe di nuovo." },
          { name: "Allunga gli intervalli", desc: "Aggiungi il pezzetto di cibo successivo solo dopo alcuni secondi. Il cane deve imparare: «Stare sdraiato e aspettare conviene». Nel frattempo espira profondamente. Il tuo obiettivo è abbassare il battito del cane con la tua calma." },
          { name: "Stabilisci una fine chiara", desc: "Prima che il cane si agiti, concludi l'esercizio con un segnale (per es. «LIBERO»). Solo ora può alzarsi. Così impara: sul tappetino c'è la pausa, l'azione arriva solo dopo il permesso." },
        ],
        frequency: ["Esercitati 3-5 volte al giorno", "All'inizio solo 2-3 minuti"],
        watchFor: ["La tua stessa energia deve essere molto calma", "Ricompensa solo finché la testa è bassa"],
        gos: ["Posa lentamente il premietto", "Respira in modo profondo e calmo"],
        noGos: ["Forzare il cane sul tappetino", "Parlare con voce acuta e stridula", "Fare giochi eccitanti sul tappetino"],
      },
      {
        title: "Spegnere il motore masticando",
        intro: "Questo esercizio aiuta il cane, dopo una fase attiva, a ritrovare il rilassamento fisico e mentale attraverso un'attività monotona.",
        steps: [
          { name: "Scegli il momento giusto", desc: "Usa questo esercizio in modo mirato dopo le fasi di forte eccitazione, cioè subito dopo la passeggiata, dopo la visita di ospiti o un gioco scatenato. Vogliamo facilitare il passaggio dalla «massima potenza» al «sonno»." },
          { name: "Usa il materiale adatto", desc: "Scegli qualcosa che tenga occupato il cane per almeno 10-15 minuti. Un kong riempito (da leccare) o una pelle di manzo dura (da masticare) sono l'ideale. Il lavoro faticoso stanca." },
          { name: "Collega al luogo di calma", desc: "Porta il cane sul suo tappetino dell'esercizio 1. Dagli il masticabile solo lì. Deve imparare: «Su questo tappetino avviene il rilassamento, qui non devo correre»." },
          { name: "Offri la co-regolazione", desc: "Il cane è molto agitato e porta in giro l'osso con nervosismo? Siediti accanto a lui e tieni fermo il masticabile da un lato, mentre lui mastica dall'altro. La tua calma e il tuo sostegno lo aiutano a rilassarsi in un unico posto." },
          { name: "Osserva l'effetto fisico", desc: "Vedrai come cambia il respiro. All'inizio può masticare con nervosismo, poi i movimenti della mascella diventano più lenti e le palpebre più pesanti. Masticare agisce come una valvola per l'energia accumulata." },
          { name: "Permetti il passaggio al sonno", desc: "I cani spesso si addormentano proprio mentre masticano. Quando il cane perde interesse e si gira su un fianco: togli in silenzio l'avanzo o lascialo lì. Ora lascia dormire il cane - obiettivo raggiunto." },
        ],
        frequency: ["Prevedilo in modo fisso 1 volta al giorno (per es. la sera)", "Durata: circa 15-30 minuti"],
        watchFor: ["Il masticabile non deve essere troppo difficile (frustrazione), ma nemmeno finito troppo in fretta (nessun effetto)", "Prepara dell'acqua (masticare fa venire sete)"],
        gos: ["Tieni fermo l'osso per il cane", "Giochi riempibili da leccare (leccare calma ancora più in fretta)"],
        noGos: ["Stuzzicare o disturbare il cane mentre mastica", "Togliere il masticabile come punizione"],
      },
      {
        title: "Allena l'interruttore di accensione e spegnimento",
        intro: "Questo esercizio insegna al cane che anche nel gioco più scatenato resta attento e sa autoregolarsi.",
        steps: [
          { name: "Tieni il giocattolo con calma", desc: "Prendi un giocattolo (per es. una corda da tira e molla) che controlli bene. Tienilo prima vicino a te e con calma. Il cane deve imparare: il giocattolo in mano non significa automaticamente caos." },
          { name: "Dai il via", desc: "Dai un segnale di partenza (per es. «AZIONE») e gioca brevemente (!) e intensamente con il cane. Tira e molla, movimento, gioco. Lascia salire l'energia per 10-15 secondi." },
          { name: "Congelamento improvviso", desc: "Interrompi il gioco di colpo. Trasformati in una statua di sale. Premi il giocattolo forte contro il corpo o lascialo pendere mollemente, ma non lasciarlo. Non muoverti più di un millimetro." },
          { name: "Sopporta l'attesa", desc: "Il tuo cane probabilmente continuerà a tirare, spingere o abbaiare. Ignoralo. Non dire nulla. Aspetta il momento in cui si accorge: «Ops, la festa è finita» e per un istante si immobilizza oppure lascia la corda." },
          { name: "La calma riavvia il gioco", desc: "Esattamente nel secondo in cui il cane molla, si siede o ti guarda con aria interrogativa: Bum! Il gioco riprende subito. Il tuo movimento è la ricompensa per la sua pausa." },
          { name: "Concludi il gioco con calma", desc: "Ripeti alcune volte l'alternanza tra partenza e stop. Importante: concludi l'esercizio sempre in una fase di calma. Scambia il giocattolo con un premietto e mettilo via. Non si chiude nel momento di picco." },
        ],
        frequency: ["Inseriscilo nel gioco 1-2 volte al giorno", "In tutto solo pochi minuti"],
        watchFor: ["Sii chiaro nel linguaggio del corpo: attivo vs. congelato", "Il giocattolo è il tuo telecomando per la sua energia"],
        gos: ["Riprendi subito a giocare quando è calmo", "Divertiti"],
        noGos: ["Urlare «LASCIA» o «NO»", "Sovreccitare il cane finché non è più attento"],
      },
      {
        title: "Sopportare gli stimoli di movimento per restare impassibile",
        intro: "Questo esercizio insegna al cane che non deve automaticamente inseguire gli oggetti che volano o rotolano, ma che trova una ricompensa migliore da te.",
        steps: [
          { name: "Metti una sicurezza", desc: "Prendi il cane con un guinzaglio corto e chiedigli il «SEDUTO» accanto a te. Assicurati che il guinzaglio sia fissato in modo che non parta, se dovesse comunque provarci. Ti serve una pallina o un giocattolo in mano." },
          { name: "Inizia con uno stimolo debole", desc: "Non lanciare la pallina. Prima falla solo cadere dalla mano o falla rotolare molto lentamente a un metro da te. L'obiettivo è che lo stimolo sia presente, ma non eccitante al massimo." },
          { name: "Intercetta l'impulso", desc: "Il tuo cane probabilmente sussulterà o vorrà alzarsi. Resta calmo. Il guinzaglio impedisce il successo. Non dire nulla, non tirarlo indietro, resisti e basta." },
          { name: "Ricompensa la decisione", desc: "Quando il cane si accorge «Non riesco ad arrivarci» e si siede di nuovo o ti guarda: Bingo! Dagli subito un premietto di valore direttamente dalla mano. Impara: «La pallina si muove, ma il cibo è dalla persona»." },
          { name: "Sei tu a gestire la preda", desc: "Molto importante: il cane non può andare verso la pallina come ricompensa. Sei tu ad avvicinarti, raccogliere la pallina e metterla via. Questo segnala: il movimento lo controlli tu, non il cane." },
          { name: "Aumenta l'intensità", desc: "Quando il rotolamento lento funziona, lancia la pallina leggermente o falla rotolare più veloce. La regola resta: il cane sta seduto e riceve la ricompensa da te. Solo la calma porta al successo." },
        ],
        frequency: ["5-10 ripetizioni per unità", "Esercitati su un fondo morbido (giardino/prato)"],
        watchFor: ["A trattenere il cane deve essere il guinzaglio, non la tua voce", "Ricompensa da te, non mandarlo verso la pallina"],
        gos: ["Resta calmo di fronte all'impulso", "La ricompensa viene da te, non dalla pallina"],
        noGos: ["Lanciare la pallina prima che il cane si sieda", "Gridare quando sussulta", "Lasciare che il cane insegua la ricompensa"],
      },
      {
        title: "Camminare al rallentatore",
        intro: "Questo esercizio spinge il cane a concentrarsi al massimo sui propri passi e a rallentare drasticamente l'andatura, cosa che abbassa automaticamente il battito cardiaco.",
        steps: [
          { name: "Rallenta l'andatura al massimo", desc: "Inizia su un tratto di strada tranquillo. Tieni il guinzaglio corto, ma morbido. Ora non camminare normalmente, ma muoviti in modo dimostrativo al rallentatore. Metti un piede davanti all'altro con piena consapevolezza, come se stessi in equilibrio su delle uova crude." },
          { name: "Procedi passo dopo passo", desc: "Fai un passo, espira, fai il passo successivo. Il tuo cane all'inizio sarà disorientato e probabilmente vorrà andare più veloce. Ma dato che ti muovi appena, deve aspettare e adeguarsi." },
          { name: "Frenata dolce", desc: "Quando il cane vuole superarti, ti fermi semplicemente nel tuo ritmo rallentato oppure lo blocchi dolcemente con la gamba. Non agire con nervosismo, non strattonare il guinzaglio. Sii come una roccia pesante, che si muove solo lentamente." },
          { name: "Ricompensa la concentrazione", desc: "Quando il cane si adegua al tuo ritmo molto lento e magari ti guarda con aria interrogativa («Perché camminiamo di soppiatto?»), lo lodi a bassa voce e gli dai un premietto. Importante: daglielo in movimento, non fermarti apposta." },
          { name: "Senti la sincronizzazione", desc: "Noterai come il cane inizia a posare le zampe con più consapevolezza. Questa concentrazione sul proprio corpo interrompe la visione a tunnel e la scansione nervosa dell'ambiente. Vi muovete in sintonia." },
          { name: "Usalo come calmante", desc: "Usa questa tecnica ogni volta che il cane all'aperto è particolarmente su di giri (per es. dopo l'incontro con un altro cane). Invece di proseguire normalmente (cosa che mantiene l'eccitazione), passi per 20 metri alla modalità rallentatore, per riportarlo di nuovo con i piedi per terra." },
        ],
        frequency: ["Ogni tanto 20-30 metri durante la passeggiata", "Come freno consapevole in caso di eccitazione"],
        watchFor: ["Respira in modo profondo e udibile - si trasmette", "Le tue ginocchia restano morbide, non irrigidirle"],
        gos: ["Rallenta all'estremo (al rallentatore)", "Osserva il cane, non correggere"],
        noGos: ["Strattonare il guinzaglio", "Innervosirti perché il cane tira", "Parlare (distrae soltanto)"],
      },
      {
        title: "La regola della panchina al parco",
        intro: "Questo esercizio allena la tolleranza alla frustrazione e la capacità di osservare semplicemente gli stimoli senza doverci reagire.",
        steps: [
          { name: "Scegli un punto di osservazione", desc: "Trova una panchina al parco o un muretto in un luogo dove succede qualcosa (per es. in un parco o vicino a un supermercato), ma con una distanza sufficiente. Siediti. Il tuo cane resta al guinzaglio." },
          { name: "Limita il raggio di movimento", desc: "Accorcia il guinzaglio quanto basta perché il cane possa stare comodamente seduto o sdraiato, ma non possa camminare avanti e indietro con nervosismo. Il continuo girovagare mantiene alto il livello di adrenalina. Lo limitiamo fisicamente alla modalità calma." },
          { name: "Sopporta la noia", desc: "Ora fai: niente. Leggi un libro, guarda il telefono o osserva le nuvole. Ignora il cane. All'inizio piagnucolerà, si dimenerà o pretenderà qualcosa. È un normale sfogo della frustrazione. Resta impassibile e non reagire." },
          { name: "Aspetta il punto di svolta", desc: "Arriverà il momento in cui il cane si arrende. Espira profondamente, abbassa la testa o finalmente si sdraia. Il suo linguaggio del corpo passa da «Voglio andarmene da qui!» a «Va bene, allora aspettiamo»." },
          { name: "Conferma la calma", desc: "Esattamente in questo momento di resa gli metti con calma e senza parole un premietto tra le zampe anteriori (come nell'esercizio 1). Confermagli che ha accettato la situazione." },
          { name: "Una partenza tranquilla", desc: "Resta seduto ancora un momento. Quando partite, fatelo lentamente e senza nervosismo. La partenza non è una ricompensa («Evviva, finalmente un po' di azione!»), ma semplicemente un cambio di luogo." },
        ],
        frequency: ["Pianificalo in modo mirato 1-2 volte alla settimana", "Da 5 a 15 minuti (finché il cane non si rilassa)"],
        watchFor: ["Quando il cane abbaia: aspetta che passi. Non andartene finché pretende qualcosa", "Scegli il posto in modo che nessun cane debba passare proprio accanto a voi"],
        gos: ["Blocca il guinzaglio con il piede (tieni le mani libere)", "Prendi un libro (segnala: ho tempo)"],
        noGos: ["Parlare al cane («Va bene, tra poco andiamo»)", "Partire quando il cane si sta ancora dimenando"],
      },
      {
        title: "ASPETTA come freno degli impulsi",
        intro: "Il segnale più importante della calma interiore: imparare ad aspettare consapevolmente.",
        steps: [
          { name: "Inizia dalla ciotola del cibo", desc: "Tieni la ciotola piena all'altezza dei fianchi, {dogName} sta davanti a te. Di' una volta con calma ASPETTA e abbassa lentamente la ciotola verso il pavimento." },
          { name: "Se si lancia in avanti: rialza", desc: "Quando {dogName} si lancia in avanti o vuole saltare prima che la ciotola sia a terra: la ciotola di nuovo in alto, senza una parola. Nessuna discussione, solo il movimento della mano." },
          { name: "A terra solo con la calma", desc: "Quando {dogName} resta calmo, la ciotola può toccare il pavimento. Fagli aspettare 1-2 secondi. Solo allora: la parola di rilascio come PRENDI o OK." },
          { name: "Aumento secondo per secondo", desc: "Nel corso della settimana aumenta da 1 sec a 3, 5, poi 10 secondi. Se il successo è sotto 7 su 10, torna a un livello più basso." },
          { name: "Trasferisci ad altre situazioni", desc: "Quando funzionano 10 secondi prima del cibo: usa ASPETTA anche davanti alla porta, prima di lanciare il giocattolo, prima di salire in auto. Tre situazioni quotidiane al giorno." },
          { name: "ASPETTA diventa un riflesso quotidiano", desc: "Dopo 3-4 settimane ASPETTA diventa uno strumento affidabile. Lo usi ovunque nella vita di tutti i giorni, senza pensarci. La tolleranza alla frustrazione cresce in modo misurabile." },
        ],
        frequency: ["Da 3 a 4 mini-situazioni al giorno", "Consolida per 3-4 settimane"],
        watchFor: ["Non trattenere mai più di 15 sec", "Un'attesa troppo lunga diventa una punizione"],
        gos: ["Allunga lentamente il tempo di attesa", "Il rilascio fa parte dell'esercizio"],
        noGos: ["ASPETTA senza rilascio", "Gridare quando si alza"],
      },
      {
        title: "Il tappetino olfattivo antistress",
        intro: "Il lavoro olfattivo sul tappetino olfattivo è uno strumento antistress meditativo.",
        steps: [
          { name: "Prepara correttamente il tappetino olfattivo", desc: "Un tappetino olfattivo con fitte strisce di tessuto. Infila crocchette o piccoli premietti tra le strisce, alcuni più in profondità, altri più in superficie." },
          { name: "Posizionalo in un luogo tranquillo", desc: "Metti il tappetino in un posto fisso e tranquillo. Non in un passaggio, non davanti al divano. È una zona di concentrazione." },
          { name: "Presentalo con un segnale calmo", desc: "Porta {dogName} con calma al tappetino, di' CERCA a bassa voce. Siediti rilassato accanto oppure allontanati, a seconda di cosa gli riesce meglio." },
          { name: "Non disturbare, non aiutare", desc: "{dogName} lavora da solo. Non intervenire, non indicare, non parlargli. Sarebbe un disturbo. Resta semplicemente con calma accanto oppure osserva da lontano." },
          { name: "Osserva l'effetto", desc: "Vedrai come il corpo di {dogName} si rilassa lentamente: il respiro si calma, la coda pende mollemente, le palpebre diventano più pesanti. Dopo 15-20 min il bisogno è soddisfatto." },
          { name: "Dopo l'annusare: calma", desc: "Quando {dogName} ha finito: metti via il tappetino, nessuna attività successiva immediata. Spesso si addormenta subito. Va benissimo così. Obiettivo raggiunto." },
        ],
        frequency: ["1-2 volte al giorno", "15-25 min a sessione"],
        watchFor: ["Non intervenire né aiutare", "Lava il tappetino regolarmente"],
        gos: ["Lavoro autonomo", "Concedi la calma dopo di esso"],
        noGos: ["«Aiutare» in caso di frustrazione", "Riattivare subito dopo"],
      },
    ],
    abschluss: {
      title: "Conclusione",
      subtitle: "In bocca al lupo",
      paras: [
        "La calma è per {dogName} un contenuto da imparare tanto quanto SEDUTO o TERRA. Grazie a segnali chiari, rituali ripetibili e pause ben preparate, può imparare passo dopo passo a gestire meglio la sua energia.",
        "Il cambiamento non nasce da singoli giorni intensi, ma da tante ripetizioni simili e facili da gestire. Proprio in un cane vigile come {dogName} è normale che progressi e passi indietro si alternino.",
        "La chiarezza nella quotidianità e un ritmo affidabile danno a {dogName} un senso di sicurezza. Quando sa più o meno cosa succederà dopo, gli è più facile rilassarsi e accettare le tue decisioni.",
        "Il lavoro successivo consiste nel mantenere questa struttura nella quotidianità, osservarla e adattarla con prudenza. Così {dogName} può consolidare le nuove abitudini e voi due trovate man mano un equilibrio più tranquillo e ben pianificabile tra attività e riposo.",
      ],
    },
  },

  anxiety: {
    coverTitle: "Piano per rimanere da solo per",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Perche questo piano e costruito proprio cosi",
      subtitle: "Sereno fin dal primo momento",
      paras: [
        "{dogName} reagisce con sensibilita al rimanere da solo. Non e un errore di comportamento, ma l'espressione di un legame forte con te e del suo bisogno di sicurezza.",
        "Lo stress da separazione nasce piu spesso quando il rimanere da solo non e stato allenato con piccoli passi chiari. Il cane non sa quando torni e il suo sistema nervoso suona l'allarme.",
        "In {dogName} questo puo manifestarsi con abbai, guaiti, andare avanti e indietro, salivazione o comportamenti distruttivi. Non sono reazioni di dispetto, ma veri e propri segnali di stress.",
        "Questo piano costruisce il tempo in solitudine con calma e in modo sistematico, senza drammatizzare l'uscita o il ritorno. L'obiettivo e che {dogName} impari: „La mia persona esce e torna sempre. Sono al sicuro”.",
      ],
    },
    how: {
      title: "Come eseguire correttamente gli esercizi",
      paras: [
        "L'ordine e decisivo: prima scollegare i segnali che precedono l'uscita, poi i secondi di solitudine, poi i minuti, poi le ore. Chi aumenta troppo in fretta non fa che costruire di nuovo la paura.",
        "Osserva {dogName} tramite video mentre ti alleni. L'intuito non basta, perche i cani mostrano spesso lo stress solo dopo qualche minuto. Metti la fotocamera del telefono nella stanza e guarda in diretta.",
        "Non reagire mai al guaito tornando indietro. E nessun addio drammatico. Piu rendi banale l'uscita, meno significato ha per {dogName}.",
        "Con una grave ansia da separazione serve anche un controllo dal veterinario. A volte un supporto medico a breve termine aiuta, affinche l'allenamento comportamentale possa davvero funzionare.",
      ],
    },
    exercises: [
      {
        title: "Scollega i segnali che precedono l'uscita",
        intro: "Prima di uscire, {dogName} deve imparare che chiavi, scarpe e giacca non significano nulla.",
        steps: [
          { name: "Individua la catena di stimoli", desc: "Osserva con precisione per 2-3 giorni da quale momento {dogName} si agita. Stimoli tipici: tintinnio delle chiavi, mettersi le scarpe, prendere la giacca, toccare la maniglia. Annota l'ordine." },
          { name: "Mostra ogni stimolo separatamente", desc: "Prendi le chiavi 10 volte al giorno, tienile in mano, rimettile giu. Non uscire. {dogName} guarda, aspetta, poi perde interesse. E proprio questo l'obiettivo dell'apprendimento." },
          { name: "Metti le scarpe senza uscire", desc: "Piu volte al giorno metti le scarpe, fai qualche passo per casa, togli di nuovo le scarpe. Dopo averle messe non aprire mai davvero la porta. Lo stimolo perde il suo significato." },
          { name: "Svaluta la routine della porta", desc: "Tocca la maniglia, apri la porta di poco, richiudila. 5-7 volte di seguito. Nessun dramma, nessun discorso. {dogName} impara: „la porta si apre” non significa automaticamente „la persona esce”." },
          { name: "Mescola e fai con noncuranza", desc: "Intreccia gli stimoli nella tua quotidianita del tutto normale: le chiavi in mano durante una telefonata, la giacca indossata mentre pulisci. L'obiettivo e che nulla sia piu un segnale chiaro." },
          { name: "Verifica il risultato", desc: "Dopo 7-10 giorni {dogName} non reagisce piu alle chiavi ne alle scarpe. Solo allora passiamo all'esercizio successivo. Se reagisce ancora, resta qui piu a lungo." },
        ],
        frequency: ["10-15 ripetizioni per stimolo al giorno", "Con costanza per 1-2 settimane", "Intreccia con noncuranza nella quotidianita"],
        watchFor: ["Riconosci i segnali sottili di stress (ansimare, deglutire, occhi spalancati)", "Non aumentare mai in modo radicale in un solo giorno"],
        gos: ["Usa gli stimoli senza dargli peso", "Resta calmo e disinvolto"],
        noGos: ["Uscire davvero quando {dogName} reagisce", "Usare gli stimoli solo per l'uscita vera"],
      },
      {
        title: "Costruisci le fasi di secondi",
        intro: "Il rimanere da solo si allena come un muscolo. Iniziamo dai secondi e aumentiamo lentamente.",
        steps: [
          { name: "Inizia nella stessa stanza", desc: "{dogName} sta disteso rilassato in salotto. Ti alzi, vai alla porta, ti giri, torni. 5 secondi di assenza dalla sua prospettiva. Ripeti 5 volte." },
          { name: "Nella stanza accanto", desc: "Esci dalla stanza, accosta la porta a meta, aspetta 5 secondi, torna. Al ritorno: nessun saluto. Vai avanti disinvolto, come se nulla fosse successo." },
          { name: "Chiudi completamente la porta", desc: "Lo stesso svolgimento, ma ora chiudi davvero la porta. {dogName} non ti sente piu. 5 secondi, 10, poi di nuovo dentro. Aumento a passi di 5 secondi." },
          { name: "Riconosci i segnali di stress", desc: "Osserva quando rientri: {dogName} si e alzato? Guaisce? Va avanti e indietro? Ai segnali di stress torna subito all'ultimo livello riuscito." },
          { name: "Aumenta fino a 1 minuto", desc: "Dopo 1 settimana dovresti raggiungere 60 secondi di assenza senza che {dogName} si stressi. Quando funziona in modo stabile, passi all'esercizio successivo." },
          { name: "Togli il dramma dall'uscita e dal ritorno", desc: "Non dire mai „ciao” ne „eccomi”. Nessun saluto festoso. Esci, torni. Banalmente. E proprio questo che elimina la tensione emotiva." },
        ],
        frequency: ["3-5 sessioni al giorno", "In 1-2 settimane aumenta i secondi fino a 1 minuto", "Mai 2 livelli in un solo giorno"],
        watchFor: ["Prima senza stress, poi aumenta", "Il controllo video aiuta a valutare con onesta"],
        gos: ["Esci disinvolto, torna disinvolto", "Aumenta con costanza a passi di 5-10 sec"],
        noGos: ["Tornare al guaito", "Salutare con voce acuta"],
      },
      {
        title: "Kong per il tempo in solitudine",
        intro: "Un giocattolo di occupazione esclusivo e di valore collega la solitudine a qualcosa di positivo.",
        steps: [
          { name: "Prepara un kong speciale", desc: "Riempi il kong con il contenuto preferito: cibo umido, pezzetti di pollo, formaggio morbido. Congelalo per 4-6 ore. Questo kong esiste SOLO durante la tua assenza." },
          { name: "Stabilisci il rituale di consegna", desc: "Poco prima di uscire: metti il kong sul tappetino di {dogName}. Non dire nulla. {dogName} deve gettarsi sul kong, non su di te." },
          { name: "Contemporaneamente la porta", desc: "Mentre {dogName} lavora sul kong, vai disinvolto alla porta. Prima 30 secondi fuori casa, poi 2 minuti, poi 5. {dogName} e occupato, tu non ci sei, va tutto bene." },
          { name: "Togli il kong al ritorno", desc: "Appena torni, togli con calma il kong, anche se dentro c'e ancora del contenuto. Il kong e esclusivamente uno strumento per il tempo in solitudine, mai per il tempo insieme." },
          { name: "Collega ai livelli", desc: "Collega il kong agli esercizi delle fasi di secondi. Piu a lungo {dogName} resta sul kong senza mostrare stress, piu a lungo puoi rimanere fuori casa." },
          { name: "Introduci varieta", desc: "Quando il kong stanca: tappetino olfattivo come alternativa o un masticabile naturale. L'importante resta: lo strumento c'e solo quando esci davvero." },
        ],
        frequency: ["A ogni assenza pianificata", "Congela kong di scorta (3-4 pezzi pronti)", "Non a ogni mini-esercizio, altrimenti perde effetto"],
        watchFor: ["{dogName} mangia davvero dal kong? Se no, lo stress e ancora troppo alto", "Scegli il contenuto secondo i gusti (congelato = piu a lungo)"],
        gos: ["Il contenuto piu prezioso che {dogName} conosce", "Consegna senza parole e con calma"],
        noGos: ["Dare il kong ancora prima di uscire", "Usare il kong anche in altre occasioni"],
      },
      {
        title: "Routine della porta senza dramma",
        intro: "Il modo in cui esci e torni plasma l'associazione emotiva con la solitudine.",
        steps: [
          { name: "10 minuti prima dell'uscita calmati", desc: "Nessuna eccitazione, nessuno sguardo fisso, nessuna carezza in piu. Tu vivi la tua quotidianita, {dogName} la sua. Questo abbassa il suo livello di stress." },
          { name: "Esci senza parole", desc: "Nessuna parola di addio, nessuna carezza prima di uscire, nessun „fai il bravo”. Semplicemente esci. Esattamente come per andare in bagno o in camera." },
          { name: "Il kong come ponte", desc: "Dai il kong per il tempo in solitudine, poi con calma alla porta. Porta aperta, fuori, porta chiusa. Massimo 5 secondi tra la consegna del kong e la porta chiusa." },
          { name: "Al ritorno ignora per 2 minuti", desc: "Porta aperta, entra, togli le scarpe, occupati con disinvoltura della casa. Solo dopo 2 minuti un calmo „eccomi”. {dogName} deve prima calmarsi, prima di ricevere attenzione." },
          { name: "Saluta solo il cane calmo", desc: "Quando {dogName} salta eccitato: girati, ignora. Appena le 4 zampe sono tranquille a terra: un breve e calmo eccomi, una carezza, fatto." },
          { name: "Mantieni la routine con costanza", desc: "Nell'arco di settimane i ritorni e le uscite diventano banali. {dogName} smette di vivere la tua presenza come un evento emotivo. Diventa una normalita." },
        ],
        frequency: ["A ogni uscita e ritorno", "Costanza anche per commissioni brevi", "Importante il briefing della famiglia"],
        watchFor: ["Anche gli altri membri della famiglia devono partecipare", "Un solo saluto emotivo costa una settimana di apprendimento"],
        gos: ["Disinvolto, senza parole, con calma", "Al rientro prima continua a vivere"],
        noGos: ["Dramma all'uscita o al ritorno", "Mostrare sensi di colpa"],
      },
      {
        title: "Costruisci le fasi di ore",
        intro: "Quando i minuti funzionano, costruisci lentamente fino alle ore. Con controllo video.",
        steps: [
          { name: "Posiziona la fotocamera", desc: "Posiziona il telefono o la fotocamera in modo da vedere la cuccia di {dogName}. Trasmissione in diretta sul tuo secondo dispositivo, cosi puoi controllare in ogni momento." },
          { name: "30 minuti come primo livello", desc: "Esci per 30 minuti (breve giro dell'isolato, spesa). Controlla ogni 5-10 minuti tramite video. Se e calmo: arriva fino a 30 min. Con stress: torna a 15 min." },
          { name: "Aumenta a passi di 15 min", desc: "Dopo 1 settimana di 30 min stabili: aumenta a 45 min. Poi 1 ora, poi 90 min, poi 2 ore. Per ogni livello almeno 4-5 giorni di sicurezza." },
          { name: "Documenta l'effetto del kong", desc: "Quanto a lungo {dogName} lavora sul kong? Se dopo 10 min smette e sta disteso tranquillo: ottimo. Se non tocca affatto il kong: stress troppo alto, tempo in solitudine piu breve." },
          { name: "Leggi correttamente i sintomi di stress", desc: "Andare avanti e indietro, ansimare senza caldo, salivare, abbaiare, leccarsi le zampe: e tutto stress. Dormire, stare disteso tranquillo, lavorare sul kong: va tutto bene. Osserva con onesta." },
          { name: "Se c'e un passo indietro, arretra", desc: "Se {dogName} un giorno all'improvviso si stressa, anche se il livello prima funzionava: torna all'ultimo livello riuscito. Restaci 1 settimana, poi riprova." },
        ],
        frequency: ["3-4 vere assenze di allenamento a settimana", "Aumento nell'arco di 6-8 settimane", "Non testare mai subito diverse ore"],
        watchFor: ["Il controllo video e obbligatorio, niente supposizioni", "Vera pausa pipi prima di un lungo tempo in solitudine"],
        gos: ["Mantieni i livelli puliti, osserva con onesta", "Adatta il ritmo a {dogName}"],
        noGos: ["Tirare piu a lungo nonostante lo stress", "Buttarsi subito su diverse ore"],
      },
      {
        title: "Routine quotidiana prevedibile",
        intro: "I cani con ansia da separazione si rilassano enormemente quando la giornata diventa prevedibile.",
        steps: [
          { name: "Stabilisci orari fissi", desc: "Passeggiata al mattino 7:00, colazione 7:30, riposo a mezzogiorno 11:00, passeggiata del pomeriggio 16:00, cena 18:00, silenzio notturno 22:00. Il piu concreto possibile." },
          { name: "Rendi visibile il piano", desc: "Scrivi la routine sul frigorifero. I membri della famiglia devono rispettarla. La persona che entra ed esce a orari inaspettati sabota la routine." },
          { name: "Pianifica i tempi in solitudine", desc: "Inserisci in modo fisso i tempi in solitudine di allenamento. Ad es. sempre dopo colazione una breve fase di solitudine, sempre al pomeriggio una piu lunga. {dogName} puo imparare questo schema." },
          { name: "Movimento prima del tempo in solitudine", desc: "15-20 minuti di passeggiata o lavoro olfattivo prima di ogni fase di solitudine pianificata. Cane stanco + struttura prevedibile = meta dell'ansia da separazione." },
          { name: "Mantieni anche nel weekend", desc: "I cani non distinguono il giorno feriale dalla domenica. Se nel weekend all'improvviso tutto e diverso, la routine perde il suo effetto. La costanza resta." },
          { name: "Consolida per 4 settimane", desc: "Dopo 4 settimane di routine costante essa e interiorizzata. {dogName} sa cosa e quando succedera, e puo vivere i tempi in solitudine senza stress accresciuto." },
        ],
        frequency: ["Ogni giorno, anche nel weekend", "4-6 settimane per un'interiorizzazione stabile", "Appendi il piano in un punto visibile"],
        watchFor: ["La costanza della famiglia e obbligatoria", "Anche 15 min di ritardo possono agitare {dogName}"],
        gos: ["Scrivi la routine in un punto visibile", "Pianifica pause consapevoli"],
        noGos: ["Stravolgere la routine in alcuni giorni", "Piani spontanei senza preparazione"],
      },
      {
        title: "Coperta di sicurezza come ancora portatile",
        intro: "Una coperta speciale diventa un simbolo di sicurezza che puoi portare ovunque.",
        steps: [
          { name: "Scegli la coperta", desc: "Una coperta accogliente di media grandezza (60x80cm) che {dogName} conosce e ama gia. Questa coperta riceve d'ora in poi uno status speciale." },
          { name: "Costruisci un'associazione positiva", desc: "Metti la coperta in un punto di calma fisso. Di' con calma „TERRA”, guida {dogName} sopra. Ricompensa con un premietto morbido, carezza tranquilla. 5-7 volte al giorno." },
          { name: "Usa solo per la calma", desc: "La coperta non serve MAI per il gioco, MAI per l'eccitazione. Quando {dogName} vuole giocare con la coperta, toglila. Significa esclusivamente rilassamento." },
          { name: "Trasferisci al tempo in solitudine", desc: "Durante la tua assenza: la coperta sta nel punto fisso, il kong sopra. {dogName} collega coperta + kong + calma. Questa triade diventa un'ancora." },
          { name: "Introduci una variante portatile", desc: "Compra una variante da viaggio piu piccola della coperta o una con il tuo odore. Puo andare dai suoceri, in auto, dal veterinario. Ovunque: coperta = sicurezza." },
          { name: "Mantieni l'odore fresco", desc: "Non lavare la coperta troppo spesso. Il tuo odore e l'odore di calma di {dogName} la rendono preziosa. Ogni 2-3 settimane basta per l'igiene." },
        ],
        frequency: ["Usa la coperta ogni giorno", "Variante portatile all'occorrenza", "Cura l'associazione tra odore e calma"],
        watchFor: ["Usa la coperta solo per la calma", "Mai come mezzo educativo"],
        gos: ["Cura la coperta come ancora positiva", "Stabilisci con consapevolezza la variante portatile"],
        noGos: ["Lavare la coperta troppo spesso", "Lasciar giocare con la coperta"],
      },
      {
        title: "Rendi la lunga assenza gestibile ogni giorno",
        intro: "Quando 2-3 ore funzionano, facciamo un passo verso la vera assenza per il lavoro.",
        steps: [
          { name: "Pianifica la prova generale", desc: "Scegli un giorno in cui sei flessibile. Pianifica un'assenza di 4 ore con una vera pausa pipi prima, un kong congelato e la fotocamera posizionata." },
          { name: "Osserva la prima ora in diretta", desc: "Nella prima ora controlla ogni 5-10 min tramite video. {dogName} dovrebbe lavorare sul kong, poi stare disteso tranquillo. Con stress: torna." },
          { name: "La fase centrale e critica", desc: "Tra la 1a e la 3a ora: {dogName} ha finito il kong, ora arriva il vero tempo in solitudine. Dorme? Sta disteso tranquillo? E proprio questo il test." },
          { name: "Osserva l'ultima ora", desc: "Alcuni cani verso la fine si agitano di nuovo (intuiscono l'ora del ritorno). Quando inizia l'andare avanti e indietro: annota l'ora, al prossimo esercizio torna 30 min prima." },
          { name: "Con successo aumenta a 5-6 ore", desc: "Una settimana di 4 ore stabili, poi 5, poi 6. Con 6 ore pianifica una pausa pipi con un dog sitter o una passeggiata a mezzogiorno." },
          { name: "Stabilisci un piano d'emergenza", desc: "Per i giorni piu lunghi di 5-6 ore: dog sitter, dogwalker, vicini, famiglia. Anche un cane che resta bene da solo ha bisogno di movimento e contatto sociale." },
        ],
        frequency: ["1-2 vere prove generali a settimana", "Costruisci nell'arco di 4-6 settimane", "Prepara un piano d'emergenza"],
        watchFor: ["Se c'e un passo indietro non tirare avanti", "Pausa pipi obbligatoria per ogni cane"],
        gos: ["Piano con tempo di margine", "Costruisci opzioni d'emergenza"],
        noGos: ["Lasciare da solo spontaneamente per 7-8 ore", "Fidarsi dell'intuito invece del video"],
      },
    ],
    abschluss: {
      title: "Conclusione",
      subtitle: "In bocca al lupo",
      paras: [
        "Superare l'ansia da separazione non e uno sprint, ma una maratona a piccoli passi. In {dogName} hai un partner fedele, pronto a imparare che la tua uscita non significa una perdita.",
        "Il cambiamento piu importante spesso non avviene nel cane, ma in te. Quando esci e torni con leggerezza, senza dramma, senza sensi di colpa, {dogName} impara che la solitudine e semplicemente una parte normale della sua giornata.",
        "Sii paziente, anche quando capitano dei passi indietro. Giorni stressanti, malattia, traslochi o altri cambiamenti possono per un momento scuotere cio che ha imparato. E normale, non un fallimento.",
        "Gli strumenti in questo piano sono duraturi. Anche quando {dogName} in seguito resta da solo con calma, puoi continuare a usare il kong, la coperta e la routine come mantenimento, affinche il senso di sicurezza resti stabile.",
      ],
    },
  },

  aggression: {
    coverTitle: "Controllo dell'aggressivita per",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Perche questo piano e costruito proprio cosi",
      subtitle: "In sicurezza e sotto la soglia di eccitazione",
      paras: [
        "{dogName} reagisce in certe situazioni con abbai, ringhi o tentativi di scagliarsi. Non e un difetto di carattere, ma piu spesso un comportamento difensivo: si sente sopraffatto e cerca di creare distanza.",
        "L'aggressivita nasce quasi sempre da insicurezza, brutte esperienze o un corridoio di stimoli troppo stretto. Il cane e sopra la sua soglia di eccitazione, quella in cui riesce ancora a imparare, e ormai reagisce soltanto.",
        "In {dogName} diversi stimoli possono agire insieme: altri cani, corridori, ciclisti, persone estranee. Ognuno ha la propria distanza critica, dalla quale inizia la reazione.",
        "Questo piano lavora con costanza SOTTO la soglia di eccitazione. Non puntiamo mai sul confronto, ma sulla distanza, la prevedibilita e le associazioni positive. E l'unica strada che funziona in modo duraturo.",
      ],
    },
    how: {
      title: "Come eseguire correttamente gli esercizi",
      paras: [
        "Prima la sicurezza. Prima di allenare qualsiasi cosa, ti serve una museruola condizionata positivamente e una chiara conoscenza della distanza di soglia di {dogName} per ogni tipo di stimolo.",
        "Gli esercizi si costruiscono uno sull'altro: prima stabilisci gli strumenti (museruola, marcatore), poi osserva la soglia di eccitazione, poi allena sotto la soglia, poi avvicinati gradualmente.",
        "NON ridurrai mai la distanza finche {dogName} reagisce. Solo quando per tre sessioni di seguito resta calmo a una certa distanza, ti avvicini di 2-5m. Mai piu in fretta.",
        "Se pero qualcosa degenera, non cancellare i progressi dell'allenamento. Una singola escalation costa circa 2 settimane di progresso nell'apprendimento. Pianifica vie di fuga, evita i percorsi ad alto rischio, rispetta la regola dei 72 ore di recupero dopo lo stress.",
      ],
    },
    exercises: [
      {
        title: "Condizionamento positivo della museruola",
        intro: "Prima di aver bisogno della museruola, {dogName} deve viverla come qualcosa di positivo.",
        steps: [
          { name: "Scegli la museruola giusta", desc: "Una museruola a cestello (Baskerville Ultra o BUMAS), non una fascia di tessuto sul muso. Il cane deve poter ansimare e bere acqua. Adattamento presso un negozio specializzato o un educatore cinofilo." },
          { name: "Lascia la museruola in vista", desc: "Giorno 1-3: metti semplicemente la museruola nella stanza, senza reazione. {dogName} la annusa, la ignora, magari la esamina per curiosita. Esattamente cosi va bene." },
          { name: "Offri il premietto attraverso la griglia", desc: "Giorno 4-6: tieni la museruola in mano, infila il premietto attraverso le sbarre della griglia. {dogName} infila il naso dentro, prende. Piu volte al giorno, sessioni brevi." },
          { name: "Lascia che infili il naso attivamente", desc: "Giorno 7-10: {dogName} infila da solo il muso nella museruola, perche dentro lo aspettano i premietti. La tieni ancora tu, la togli subito di nuovo. L'associazione positiva e consolidata." },
          { name: "Primi tempi di indosso", desc: "Giorno 11-14: allaccia la museruola per 2-5 secondi, togliela subito di nuovo. Premietto attraverso la griglia. Passo dopo passo aumenta il tempo di indosso fino a 1-2 minuti." },
          { name: "Non usare mai in situazioni di stress", desc: "Solo dopo 14-21 giorni di associazione positiva: la museruola per la prima passeggiata. Su un percorso tranquillo senza stimoli. Non mettere mai per la prima volta in una situazione di stress." },
        ],
        frequency: ["Piu volte al giorno sessioni brevi", "Costruisci nell'arco di 2-3 settimane", "Aumenta lentamente il tempo di indosso"],
        watchFor: ["Non collegare mai allo stress", "Pausa ai segnali di frustrazione"],
        gos: ["Ricompensa di valore attraverso la griglia", "Procedi con molta pazienza"],
        noGos: ["Mettere la museruola per la prima volta in una crisi", "Usare una fascia di tessuto sul muso"],
      },
      {
        title: "Trova e documenta la soglia di eccitazione",
        intro: "Prima di iniziare ad allenare, devi sapere da quale distanza {dogName} riesce ancora a imparare.",
        steps: [
          { name: "Scegli un punto di osservazione", desc: "L'ingresso di un parco, un percorso da corsa o un luogo simile dove gli stimoli passano regolarmente. Devi poter allontanare {dogName} in sicurezza, se le cose si facessero strette." },
          { name: "Inizia da grande distanza", desc: "Inizia da 50-80 metri. Osserva {dogName} molto attentamente: mimica, occhi, coda, respiro. Annota tutto." },
          { name: "Riconosci i segnali di soglia", desc: "Primi segni: mimica tesa, occhi fissi, coda rigida, muso chiuso, breve pausa nel respiro. Questo e SULLA soglia di eccitazione. Annota la distanza." },
          { name: "La reazione significa sopra", desc: "Abbaiare, tentare di scagliarsi, ringhiare: sei SOPRA. Raddoppia subito la distanza. Li non si impara nulla, si reagisce soltanto." },
          { name: "Separatamente per ogni tipo di stimolo", desc: "Cani, corridori, bici, bambino, uomini estranei: ognuno ha la propria distanza. Annota per ogni stimolo nel diario. E la tua mappa di allenamento." },
          { name: "La mappa come fondamento dell'allenamento", desc: "Questi valori sono il tuo fondamento di allenamento per le prossime settimane. Lavori sempre SOTTO questi valori, non sfiorarli mai, mai sopra." },
        ],
        frequency: ["4 giorni con sessioni di osservazione di 20-30 min", "Separatamente per ogni tipo di stimolo", "Prendi appunti per iscritto"],
        watchFor: ["Riconosci per tempo i segnali di stress", "Meglio una distanza troppo grande che troppo piccola"],
        gos: ["Diario con le distanze per ogni stimolo", "Osserva con pazienza e precisione"],
        noGos: ["Testare la soglia avvicinandoti", "Accettare una reazione per „avere un riscontro”"],
      },
      {
        title: "Gioco „guarda la” con stimoli reali",
        intro: "{dogName} impara: guardare lo stimolo va bene, poi c'e la ricompensa da me.",
        steps: [
          { name: "Posizionati in sicurezza sotto la soglia", desc: "Con {dogName} in un punto dove gli stimoli compaiono alla tua distanza di sicurezza annotata. Hai in tasca qualcosa di valore (pollo, formaggio, pate)." },
          { name: "Lo stimolo compare, tu aspetti", desc: "Appena {dogName} nota lo stimolo: nessuna reazione da parte tua. Aspetta. {dogName} guarda, registra, ma e sotto il livello di reazione." },
          { name: "Imposta GUARDA come marcatore", desc: "Di' nel momento in cui {dogName} ha guardato: GUARDA + subito un premietto, che tieni ben visibile in alto, in modo che {dogName} guardi te." },
          { name: "Ricompensa al fianco", desc: "Quando {dogName} guarda te: un premietto di valore, offerto con calma. Impara: „vista dello stimolo = attesa di ricompensa dal conduttore”. L'associazione emotiva cambia." },
          { name: "Ripeti a ogni contatto visivo", desc: "A ogni nuovo stimolo: GUARDA + ricompensa. Per sessione 6-10 ripetizioni. Mai SOPRA la soglia di eccitazione, quello e un confronto." },
          { name: "Riduci la distanza solo dopo il successo", desc: "Quando per 3 sessioni di seguito 8 reazioni su 10 vanno pulite, avvicinati di 2-5m. Mai piu in fretta. Il plateau e normale." },
        ],
        frequency: ["3-4 sessioni a settimana, 20-30 min", "Mai due tipi di stimolo diversi per sessione"],
        watchFor: ["La distanza e tutto", "Primi segnali di stress = aumenta la distanza"],
        gos: ["Usa una ricompensa di valore", "Resta con costanza sotto la soglia"],
        noGos: ["Provocare gli stimoli", "Mescolare piu tipi di stimolo"],
      },
      {
        title: "Tecnica dell'arco negli incontri",
        intro: "Quando lo stimolo si avvicina troppo, ti serve una chiara strategia di aggiramento.",
        steps: [
          { name: "Annota in anticipo le vie di fuga", desc: "Nel pianificare la passeggiata: dove sono le vie laterali, gli ingressi dei cortili, le fermate? Sono le tue uscite d'emergenza. Visualizzale in mente." },
          { name: "Riconosci per tempo lo stimolo", desc: "Allenati a notare gli stimoli 30-50m prima di {dogName}. Appena visibile: prendi la decisione dell'arco o del proseguire, prima che reagisca." },
          { name: "Gira delicatamente", desc: "Quando l'arco e necessario: di' con calma ARCO e girati di 90 gradi. Non con uno strattone, non in preda al panico. Attira {dogName} con un premietto nella nuova direzione." },
          { name: "Prosegui con decisione", desc: "Vai con decisione nella nuova direzione, non con esitazione. {dogName} ti segue. Non voltarti mai indietro ne fermarti a guardare cosa fa lo stimolo." },
          { name: "Ricompensa fuori dalla linea di vista", desc: "Appena uscite dalla linea di vista (angolo, ingresso di un edificio): 3 premietti in bocca, di' con calma FANTASTICO, fermati un attimo. Avete vinto." },
          { name: "Non aggirare mai cosi", desc: "IMPORTANTE: non aggirare mai lo stimolo senza guidare l'attenzione di {dogName}. Altrimenti vede lo stimolo, tu vai avanti, rischia frustrazione ed escalation." },
        ],
        frequency: ["A ogni situazione acuta", "Pianifica le passeggiate con una mappa delle vie di fuga", "Esercitati in situazioni non acute"],
        watchFor: ["Allena il riconoscimento precoce degli stimoli", "Mantieni la tua calma"],
        gos: ["Entra con decisione nella via di fuga", "Premietto pronto come richiamo"],
        noGos: ["Scappare in preda al panico", "Lasciar fissare lo stimolo"],
      },
      {
        title: "Guardare e girarsi",
        intro: "Il livello successivo: {dogName} guarda lo stimolo E si gira da solo.",
        steps: [
          { name: "Requisito: „guarda la” padroneggiato", desc: "Questo esercizio solo quando „guarda la” funziona in modo affidabile (8/10 sessioni pulite). Altrimenti {dogName} non e ancora pronto." },
          { name: "Posizionati sotto la soglia", desc: "La stessa impostazione di „guarda la”: stimolo visibile, {dogName} sotto la soglia. Sei calmo, in attesa." },
          { name: "Lascia che guardi", desc: "{dogName} vede lo stimolo. Questa volta aspetta qualche secondo, senza dire GUARDA. {dogName} guarda, osserva, registra. Tu resti in silenzio." },
          { name: "Aspetta che distolga lo sguardo", desc: "Quando {dogName} distoglie lo sguardo DA SOLO: SUBITO maxi-premio 3-4 premietti, un calmo FANTASTICO. Questo e il vero effetto dell'apprendimento." },
          { name: "Se fissa: segnale sommesso GUARDA", desc: "Se {dogName} fissasse per piu di 5-10 sec senza girarsi: marcatore sommesso GUARDA. La ricompensa arriva, ma piu piccola. L'obiettivo resta il girarsi in autonomia." },
          { name: "Con le settimane in automatico", desc: "Dopo 3-4 settimane {dogName} spesso si gira da solo, senza il tuo intervento. E autoregolazione a un livello alto." },
        ],
        frequency: ["2-3 sessioni a settimana", "Solo dopo aver consolidato „guarda la”", "Per sessione 5-8 ripetizioni"],
        watchFor: ["Aspetta con pazienza il girarsi autonomo", "Non costruire mai pressione"],
        gos: ["Ricompensa l'autonomia", "Resta calmo e in attesa"],
        noGos: ["Dire GUARDA troppo presto", "Frustrarsi durante un lungo fissare"],
      },
      {
        title: "Zona cuscinetto prima degli incontri attesi",
        intro: "Negli incontri prevedibili prepari {dogName} mentalmente e nello spazio.",
        steps: [
          { name: "Individua i punti critici degli incontri", desc: "Dove incontriamo di solito gli stimoli? Ingresso del parco, davanti al panificio, alla fermata. Memorizza questi luoghi." },
          { name: "20m prima in modalita", desc: "Prima di arrivare al punto critico: guinzaglio un po' piu corto, mano pronta alla tasca, segnale GUARDA armato mentalmente. Sei in modalita allenamento." },
          { name: "Costruisci una condotta al fianco attiva", desc: "20m prima e 20m dopo il punto critico: {dogName} cammina stretto al fianco, ricompensi ogni 5-10 passi. Attenzione accresciuta, non per pressione, ma per densita di ricompense." },
          { name: "Lo stimolo con GUARDA o arco", desc: "Quando compare lo stimolo: „guarda la” come allenato o arco, a seconda della distanza. Sei preparato e non colto di sorpresa." },
          { name: "Dopo il passaggio rilassati", desc: "Fuori dal punto critico: guinzaglio di nuovo un po' piu lungo, riduci la frequenza delle ricompense, prosegui con calma. Una pausa annusata come ricompensa." },
          { name: "La routine diventa un riflesso", desc: "Dopo 3-4 settimane la routine della zona cuscinetto diventa riflessa. Non la fai piu consapevolmente, ma in automatico. {dogName} reagisce piu calmo sui percorsi noti." },
        ],
        frequency: ["A ogni passeggiata presso i punti critici", "Diventata routine nell'arco di 3-4 settimane"],
        watchFor: ["Pianificazione anticipata invece di reazione", "Mantieni il tuo livello"],
        gos: ["Prepara i punti critici in mente", "Aumenta la densita delle ricompense"],
        noGos: ["Farsi cogliere di sorpresa dai punti critici", "Reagire solo quando le cose si fanno strette"],
      },
      {
        title: "Regola dei 72 ore di recupero dopo lo stress",
        intro: "Dopo un'escalation o una situazione di stress {dogName} ha bisogno di un vero recupero, prima di essere allenato di nuovo.",
        steps: [
          { name: "Riconosci la situazione di stress", desc: "Escalation, abbaiare, tentativo di scagliarsi, incontro molto ravvicinato, contatto indesiderato con lo stimolo: e tutto una situazione di stress che libera ormoni dello stress." },
          { name: "Subito pausa dall'allenamento", desc: "Subito dopo la situazione: 72 ore senza allenamento mirato con gli stimoli. Solo passeggiate tranquille e familiari in un ambiente noto." },
          { name: "Lascia calare il livello di stress in modo naturale", desc: "Gli ormoni dello stress (cortisolo) hanno bisogno di 3 giorni per smaltirsi completamente. In questo periodo {dogName} e piu reattivo, si attiva piu in fretta. E biologia, non psicologia." },
          { name: "Evita i percorsi con gli stimoli", desc: "Durante le 72 ore aggira consapevolmente i punti critici. Scegli altri percorsi, sfrutta gli orari piu tranquilli. E protezione, non resa." },
          { name: "Attivita calmanti", desc: "Lavoro olfattivo, passeggiate tranquille con annusate, gioco con il kong, massaggio. Tutto cio che rilassa {dogName}. Nessun gioco eccitante ne contatto con altri cani." },
          { name: "Dopo 72 ore torna con cautela", desc: "Dopo 3 giorni: prima sessione di allenamento cauta a una distanza maggiore del solito. Osserva se il livello e tornato normale. Se si: allenamento normale avanti." },
        ],
        frequency: ["A ogni situazione di stress 72h di pausa", "Attivita calmanti ogni giorno"],
        watchFor: ["Lo stress si accumula nell'arco di piu giorni", "Mantieni la pausa con pazienza"],
        gos: ["Passeggiate calmanti", "Aggira consapevolmente i punti critici"],
        noGos: ["Allenare di nuovo gia il giorno dopo", "Sminuire l'escalation come un „episodio isolato”"],
      },
      {
        title: "Protocollo d'emergenza in caso di escalation",
        intro: "Quando qualcosa va comunque storto: passi chiari, nessun caos.",
        steps: [
          { name: "NIENTE urla, NIENTE strattoni", desc: "Passo 1 nell'escalation: mantieni la calma. Le urla amplificano enormemente l'eccitazione di {dogName}. Lo strattone nervoso rafforza la tensione." },
          { name: "Gira il corpo", desc: "Metti il tuo corpo tra {dogName} e lo stimolo. Togli il contatto visivo, senza tirare il guinzaglio." },
          { name: "Allontanati con decisione", desc: "Di' una volta ARCO e vai con decisione nella direzione sicura. Attira con un premietto, non strattonare. Costruisci almeno 30m di distanza." },
          { name: "Calma fuori dalla vista", desc: "Quando siete fuori dalla linea di vista: fermati, offri con calma 3 premietti, di' FANTASTICO. {dogName} deve calmarsi." },
          { name: "Valuta i segnali di stress", desc: "Come si sente {dogName}? Ansima ancora? Pupille larghe? Trema? Se si: ancora piu distanza, un luogo tranquillo, offri dell'acqua." },
          { name: "Attiva la regola dei 72 ore", desc: "Dopo l'escalation: passa in modalita 72 ore di recupero dopo lo stress (vedi esercizio 7). Pausa dall'allenamento, attivita tranquille, aggirare consapevolmente i punti critici." },
        ],
        frequency: ["Solo in caso di reale escalation", "Esercizi a secco in casa 1x a settimana"],
        watchFor: ["Mantenere la propria calma e tutto", "Non trasmettere mai nervosismo"],
        gos: ["Con calma, con decisione, via", "Ricompensa di valore a portata di mano"],
        noGos: ["Urlare o strattonare", "Riavvicinarsi allo stimolo per mostrare che „non succede nulla”"],
      },
    ],
    abschluss: {
      title: "Conclusione",
      subtitle: "In bocca al lupo",
      paras: [
        "L'aggressivita nei cani e quasi sempre autodifesa. {dogName} reagisce cosi perche si sente sopraffatto. Il tuo compito non e „rieducarlo”, ma dargli un senso di sicurezza.",
        "Chi usa la distanza, la soglia di eccitazione e la pazienza come strumenti ha un vantaggio decisivo su qualsiasi metodo di confronto. E piu lento, ma duraturo.",
        "I passi indietro fanno parte del processo. Un'escalation non significa che il lavoro sia stato vano. Grazie alla regola dei 72 ore e alle attivita tranquille torni in fretta sulla strada giusta.",
        "Continua a tenere un diario con le soglie di eccitazione. La tua conoscenza delle reazioni di {dogName} e il tuo strumento piu importante. Con ogni mese leggerai meglio i suoi segnali.",
      ],
    },
  },

  mouthing: {
    coverTitle: "Piano contro il raccogliere da terra per",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Perche questo piano e costruito proprio cosi",
      subtitle: "Sicurezza in ogni passeggiata",
      paras: [
        "{dogName} all'aperto raccoglie tutto cio che ha un odore. Non e un errore educativo, ma un impulso naturale: l'istinto olfattivo piu l'istinto predatorio piu la curiosita di un cane attento.",
        "Il raccogliere di per se e gratificante. {dogName} trova qualcosa, la ingoia, fatto. Per lui non c'e nessun motivo per non farlo, finche da te non ottiene qualcosa di meglio.",
        "In piu: ogni successo rafforza questo comportamento. Un pezzo di pane ingoiato di nascosto una volta significa che la prossima passeggiata sara una ricerca ancora piu intensa.",
        "Questo piano costruisce un'alternativa: un segnale pulito LASCIA, un segnale-stop NO, scambi di grande valore e la messa in sicurezza con la museruola sui percorsi ad alto rischio. Ottieni il controllo senza punizione.",
      ],
    },
    how: {
      title: "Come eseguire correttamente gli esercizi",
      paras: [
        "Prima costruisci in casa, poi ti alleni all'aperto. In casa {dogName} e meno stimolato, i segnali si possono condizionare in modo pulito.",
        "LASCIA, NO e lo scambio sono tre strumenti diversi. Non compaiono MAI come punizione, ma come segnali con una chiara alternativa di ricompensa.",
        "Durante la fase di costruzione la museruola e la tua migliore amica sui percorsi ad alto rischio (davanti alle scuole, nei giorni di raccolta dei rifiuti, agli ingressi dei parchi). Non e un'ammissione di sconfitta, e buon senso.",
        "Il valore della ricompensa deve essere SEMPRE piu alto di cio che puo trovarsi all'aperto. I crocchini non bastano. Ti servono pollo, wurstel, formaggio, qualcosa di davvero appetitoso.",
      ],
    },
    exercises: [
      {
        title: "Costruire in modo pulito il segnale LASCIA in casa",
        intro: "{dogName} impara in casa che restituire conviene, prima di uscire all'aperto.",
        steps: [
          { name: "Dagli un oggetto di poco valore", desc: "Scegli un giocattolo semplice che {dogName} ama, ma non alla follia. Lascialo giocare, portarlo in bocca, per qualche secondo." },
          { name: "Mostra una ricompensa di valore", desc: "Tieni un premietto di valore (pollo, formaggio) all'altezza del naso. {dogName} lo annusa, lo vede. La differenza di valore tra il giocattolo e il premietto e tutto." },
          { name: "Di' LASCIA con calma", desc: "Di' LASCIA con voce calma, non minacciosa. Non forte, non severa. {dogName} non e ancora condizionato, la parola deve essere caricata positivamente." },
          { name: "Aspetta che molli", desc: "{dogName} riflette: tenere il giocattolo o prendere il premietto? Il piu delle volte sceglie il premietto. Non appena molla il giocattolo: BRAVO, premietto, lode tranquilla." },
          { name: "Restituisci il giocattolo", desc: "IMPORTANTE: dopo 3-5 secondi restituisci il giocattolo. {dogName} impara: LASCIA non e una perdita, ma un buon scambio che finisce in modo positivo." },
          { name: "Aumenta lentamente il valore", desc: "Dopo 2 settimane con un giocattolo semplice: il giocattolo preferito, poi un osso da masticare, poi (con cautela) un osso. Per ogni livello 5-7 giorni." },
        ],
        frequency: ["3-5 sessioni LASCIA al giorno in casa", "Costruisci per 2-3 settimane", "Aumenta lentamente il valore"],
        watchFor: ["La ricompensa deve essere SEMPRE piu preziosa dell'oggetto", "Non tirare mai ne mettere la mano in bocca"],
        gos: ["Resta calmo e rilassato", "Restituisci il giocattolo"],
        noGos: ["Dire LASCIA con voce minacciosa", "Mettere la mano in bocca"],
      },
      {
        title: "NO come segnale-stop in casa",
        intro: "NO previene il raccogliere PRIMA che avvenga. Molto importante: NO non e un'imprecazione.",
        steps: [
          { name: "Allestimento dell'allenamento", desc: "Metti a terra un premietto di poco valore, che {dogName} in linea di principio potrebbe avere. Tieni pronto un premietto di valore per lo scambio." },
          { name: "Nel momento in cui si china", desc: "Non appena {dogName} si china verso il premietto a terra: di' NO con voce ferma e calma. Non forte, non punitiva. Chiara e inequivocabile." },
          { name: "Subito attira con un'alternativa", desc: "NO non puo MAI restare da solo. Subito dopo: mostra un premietto di valore dalla mano, attira {dogName} di lato." },
          { name: "Premia quando si gira", desc: "Non appena {dogName} si gira dal premietto a terra e viene da te: BRAVO, mega ricompensa, lode tranquilla. Il premietto da terra sparisce." },
          { name: "Aumenta il valore della cosa a terra", desc: "Dopo 1 settimana: un cubetto di formaggio a terra al posto dei crocchini. Dopo 2 settimane: un pezzo di pollo. Anche la ricompensa per lo scambio diventa piu preziosa (pate)." },
          { name: "Non abusare del significato", desc: "NO non e uno stop universale. Solo per “lascia quell'oggetto”. Altrimenti perde efficacia. Altri segnali-stop (NO, LASCIA) hanno significati diversi." },
        ],
        frequency: ["3-5 sessioni NO al giorno in casa", "Consolida per 2-3 settimane", "Aumenta il valore gradualmente"],
        watchFor: ["La voce resta calma, non aggressiva", "L'alternativa di ricompensa piu preziosa"],
        gos: ["NO + alternativa immediata", "Aumenta lentamente il valore"],
        noGos: ["Abusare di NO come imprecazione", "NO senza alternativa di ricompensa"],
      },
      {
        title: "Scambio con gradi di valore",
        intro: "Quando {dogName} ha gia qualcosa in bocca: scambia con calma invece di tirare in preda al panico.",
        steps: [
          { name: "Non corrergli mai dietro", desc: "Quando {dogName} ha gia raccolto qualcosa: NON corrergli dietro. Rafforza il comportamento di fuga e lo trasforma in un gioco." },
          { name: "Avvicinati con calma, mostra lo scambio", desc: "Avvicinati con calma a {dogName}, con un premietto di valore per lo scambio in mano. Non metterti sopra di lui, ma di lato. Non dire nulla." },
          { name: "Di' LASCIA, aspetta", desc: "Di' LASCIA, tieni il premietto ben visibile vicino al naso. Aspetta 2-3 secondi. {dogName} valuta: tenere o scambiare?" },
          { name: "Premia quando restituisce", desc: "Quando {dogName} apre la bocca e lascia cadere l'oggetto: BRAVO + mega ricompensa. Raccogli l'oggetto senza fare drammi." },
          { name: "Non tirare mai ne infilare la mano in bocca", desc: "Quando {dogName} non restituisce: aspetta piu a lungo, mostra un valore piu alto. MAI la mano in bocca, avvelena il segnale per tutta la vita." },
          { name: "La ricompensa piu preziosa a portata di mano", desc: "In passeggiata SEMPRE: pollo o pate in tasca. I crocchini non bastano. Devi poter superare l'oggetto raccolto." },
        ],
        frequency: ["A ogni raccolta reale", "In casa allenati 3-4 volte al giorno", "Ricompensa di valore sempre con te"],
        watchFor: ["Conosci la gerarchia dei valori", "Mantieni la calma"],
        gos: ["Scambia con un valore reale", "Avvicinati in modo dolce e calmo"],
        noGos: ["Corrergli dietro", "Tirare o mettere la mano in bocca"],
      },
      {
        title: "Cercare la ricompensa come alternativa",
        intro: "Dai all'istinto di ricerca di {dogName} una fonte di appagamento consentita.",
        steps: [
          { name: "Riempi la tasca", desc: "Prima di ogni passeggiata: 15-20 premietti morbidi (pezzetti piccoli) in tasca. Devono essere piccoli e rapidamente accessibili." },
          { name: "Lancia quando annusa a terra", desc: "Non appena {dogName} cammina annusando verso terra (segnale tipico del raccogliere): lancia 2-3 premietti nell'erba, in un'area che per lui e chiaramente da cercare." },
          { name: "Di' CERCA", desc: "Di' CERCA non appena volano i premietti. {dogName} ora cerca attivamente i premietti MESSI A DISPOSIZIONE, invece di contare su qualcosa di casuale a terra." },
          { name: "5-7 volte a passeggiata", desc: "Queste fasi di ricerca non devi razionarle. 5-7 momenti CERCA a passeggiata sono una buona media. {dogName} sa: “Dal mio proprietario compare qualcosa, non devo cercare da solo”." },
          { name: "Collegamento ai punti critici", desc: "Prima dei vostri tipici punti critici (cestini dei rifiuti, ingresso del parco) inserisci di proposito momenti CERCA. Reindirizzi l'attenzione prima che {dogName} inizi anche solo ad annusare a terra." },
          { name: "Con le settimane inizia a controllare", desc: "Dopo 3-4 settimane {dogName} a ogni stimolo a terra prima ti guarda un attimo, per vedere se lanci qualcosa. La tua tasca e diventata il suo nuovo fornitore." },
        ],
        frequency: ["Con coerenza a ogni passeggiata", "Stabilisci la routine della tasca"],
        watchFor: ["Lancia SOLO su terreno sicuro, non nella zona dei cestini", "Tieni i premietti piccoli"],
        gos: ["Reindirizza l'istinto di ricerca, non reprimerlo", "Tasca sempre piena"],
        noGos: ["Lanciare solo crocchini (poco interessanti)", "Lanciare solo dopo il raccogliere"],
      },
      {
        title: "Museruola sui percorsi ad alto rischio",
        intro: "Prima la sicurezza. Nei luoghi critici la museruola e la tua migliore protezione.",
        steps: [
          { name: "Condiziona positivamente la museruola", desc: "Come nell'esercizio sull'aggressivita: museruola a cestello (Baskerville Ultra), 10-14 giorni di costruzione positiva, prima di usarla in passeggiata." },
          { name: "Identifica i percorsi ad alto rischio", desc: "Dove raccogliamo qualcosa piu spesso? Davanti alle scuole (panini), nei giorni di raccolta dei rifiuti, agli ingressi dei parchi, alle fermate. Segna questi percorsi." },
          { name: "Stabilisci l'obbligo della museruola", desc: "Su questi percorsi: museruola indossata. Non negoziabile. Anche se “una volta non e successo nulla”. Conta la coerenza." },
          { name: "Sui percorsi sicuri salta", desc: "Sui percorsi tranquilli e noti puoi saltare la museruola. Questo da a {dogName} una liberta positiva e mostra: non e in generale qualcosa di negativo." },
          { name: "Durante la transizione dell'allenamento", desc: "Mentre LASCIA e NO sono ancora in costruzione: usa la museruola anche sui percorsi “normali”. Prima la sicurezza. Solo quando i segnali sono stabili puoi ridurre." },
          { name: "Mai come punizione o educazione", desc: "La museruola non deve MAI essere associata a una punizione. E uno strumento di sicurezza. Quando {dogName} mostra frustrazione: ripeti il condizionamento positivo, tempi di utilizzo piu brevi." },
        ],
        frequency: ["Sempre nei punti critici identificati", "Nella fase di costruzione usala generosamente"],
        watchFor: ["Cura l'associazione positiva", "Mai come mezzo di punizione"],
        gos: ["Museruola a cestello, non in tessuto", "Con coerenza sui percorsi a rischio"],
        noGos: ["Museruola sotto stress senza preparazione", "Usare un cappio in tessuto sul muso"],
      },
      {
        title: "Lavoro olfattivo per l'appagamento",
        intro: "Chi usa abbastanza il naso e la testa, cerca meno all'aperto.",
        steps: [
          { name: "Pianifica il lavoro olfattivo quotidiano", desc: "Almeno 20-30 min al giorno di lavoro olfattivo: gioco di ricerca in casa, pista all'aperto, tappeto olfattivo, Kong. Naso stanco = zampe tranquille all'aperto." },
          { name: "Concedi pause per annusare", desc: "In passeggiata: ogni 5-10 min una pausa per annusare di 30-60 sec. {dogName} annusa l'erba, i cespugli, i paletti. Non raccoglie, solo esplora." },
          { name: "Inserisci un elemento di pista", desc: "1-2 volte a settimana traccia una piccola pista: 10-20m di pista di premietti. {dogName} la segue annusando. Una pista di 15 minuti equivale, come effetto, a 30 min di passeggiata." },
          { name: "Tappeto olfattivo in casa", desc: "Invece di dargli da mangiare dalla ciotola: distribuisci i crocchini sul tappeto olfattivo. {dogName} ci lavora 15-20 min. Stanca, appaga l'istinto." },
          { name: "Goditi le attrattive della passeggiata", desc: "Pianifica di proposito “passeggiate di ricerca”: in un bosco tranquillo, sentieri poco battuti, dove annusare e il compito principale. {dogName} impara: esplorare e consentito e piacevole." },
          { name: "Effetto: meno istinto predatorio", desc: "Dopo 4-6 settimane di lavoro olfattivo quotidiano il bisogno di raccogliere diminuisce in modo evidente. L'istinto e meno “accumulato”." },
        ],
        frequency: ["Ogni giorno 20-30 min di lavoro olfattivo", "Almeno 1 unita di pista a settimana"],
        watchFor: ["La qualita conta piu della quantita", "Ancoralo nella routine del piano giornaliero"],
        gos: ["Lavoro olfattivo come routine fissa", "Pianifica le pause per annusare"],
        noGos: ["Saltare il lavoro olfattivo come ricompensa", "Sfogo sfrenato invece del lavoro di naso"],
      },
      {
        title: "Premiare al piede nei punti critici",
        intro: "Nei luoghi critici la posizione al piede diventa l'opzione piu conveniente.",
        steps: [
          { name: "Tasca piena della migliore ricompensa", desc: "Pollo, formaggio, wurstel: cio che {dogName} adora. Tagliato fine, rapidamente accessibile." },
          { name: "Accorcia avvicinandoti al punto critico", desc: "20m prima del punto critico: accorcia il guinzaglio a 1m. {dogName} cammina stretto al piede. Sei attento, osservi la situazione a terra." },
          { name: "Ogni 3-5 passi un premietto", desc: "Mentre attraversi il punto critico: ogni 3-5 passi il miglior premietto proprio lungo la cucitura dei pantaloni. {dogName} guarda te, non il terreno." },
          { name: "Lanci CERCA come bonus", desc: "Se comunque qualcosa di sospetto e a terra: non fermarti, ma lancia 2-3 premietti in un punto SICURO (prato, posto pulito) e di' CERCA." },
          { name: "Dopo il passaggio rilassati", desc: "Non appena avete superato il punto critico: guinzaglio di nuovo un po' piu lungo, riduci la frequenza delle ricompense, una pausa per annusare come ricompensa." },
          { name: "Con le settimane in automatico", desc: "Dopo 3-4 settimane {dogName} cammina stretto al piede quando riconosce un percorso con un punto critico. La routine diventa un riflesso." },
        ],
        frequency: ["A ogni passeggiata nei punti critici", "Automatizza in 3-4 settimane"],
        watchFor: ["Usa una ricompensa davvero di valore", "Resta attento"],
        gos: ["Aumenta la densita delle ricompense", "Guinzaglio corto nei punti critici"],
        noGos: ["Gridare quando {dogName} annusa", "Crocchini come ricompensa"],
      },
    ],
    abschluss: {
      title: "Conclusione",
      subtitle: "In bocca al lupo",
      paras: [
        "Il raccogliere e un istinto, non un difetto di carattere. {dogName} non si puo “educare” in senso classico, perche il raccogliere di per se e gratificante. Cio che puo: imparare che da te c'e qualcosa di meglio.",
        "La pazienza e tutto. LASCIA, NO e lo scambio hanno bisogno di settimane prima di funzionare all'aperto in condizioni reali. Sii coerente, con ricompense di valore a portata di mano.",
        "La museruola non e un'ammissione di sconfitta, ma uno strumento di sicurezza. Finche l'allenamento non e al 100%, sui percorsi ad alto rischio e semplicemente buon senso. Esche avvelenate e oggetti taglienti sono ovunque.",
        "Mantieni il lavoro olfattivo come routine fissa. Un cane il cui naso e la cui testa sono impegnati ogni giorno ha all'aperto meno bisogno di cercare. E il pilastro piu duraturo del tuo piano.",
      ],
    },
  },

  recall: {
    coverTitle: "Piano del richiamo per",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Perche questo piano e costruito proprio cosi",
      subtitle: "Un richiamo affidabile in ogni situazione",
      paras: [
        "{dogName} a volte viene quando lo chiami, a volte no. Non e “disobbedienza”, ma mancanza di affidabilita. Il richiamo e la polizza sulla vita piu importante nella vita di un cane.",
        "Quando il richiamo vacilla, quasi sempre ha una sua storia. Forse il segnale e stato chiamato troppo spesso quando il cane non poteva venire (distrazione). Forse ha imparato che venire significa mettere il guinzaglio, fine del gioco.",
        "Con {dogName} o ricostruiamo il vecchio segnale, oppure una parola completamente nuova. L'importante e: questa parola viene SEMPRE caricata positivamente, mai usata per cose negative.",
        "Questo piano costruisce il richiamo a gradini: in casa, all'aperto con la longhina, in presenza di distrazioni, nella variante con il fischietto come sicurezza. Solo quando ogni livello e al 90% si passa al successivo.",
      ],
    },
    how: {
      title: "Come eseguire correttamente gli esercizi",
      paras: [
        "Una ricompensa di valore e d'obbligo. Pollo, formaggio, pate: i crocchini non bastano per il richiamo. Il segnale deve essere il momento piu attraente della passeggiata.",
        "Scegli consapevolmente una nuova parola se quella vecchia e avvelenata. VIENI o una parola tua. Ma una sola parola, sempre uguale per tutti i membri della famiglia.",
        "La longhina e il ponte di sicurezza tra la casa e la corsa libera. 5-10m di biothane (non una corda, brucia le mani). Non saltare mai direttamente alla corsa libera senza questa tappa intermedia.",
        "Non usare mai il segnale del richiamo per cose negative: mettere il guinzaglio a fine passeggiata, il veterinario, il bagno, le grida. Per queste cose ti serve un'altra parola. Il segnale del richiamo resta sacro.",
      ],
    },
    exercises: [
      {
        title: "Ricarica VIENI in modo nuovo e positivo",
        intro: "Primo livello in casa: il segnale diventa la cosa piu attraente della giornata.",
        steps: [
          { name: "Scegli una nuova parola", desc: "Quando il vecchio VIENI e avvelenato (il cane non viene in modo affidabile), prendi un'altra parola tua. Consenso familiare: tutti usano la stessa parola." },
          { name: "Inizia in casa a 3m", desc: "{dogName} e rilassato in salotto. Ti allontani di 3m, ti giri, ti abbassi in un accovacciamento profondo." },
          { name: "Chiama con gioia", desc: "Di' VIENI con tono chiaro e gioioso. NON in modo autoritario, ma invitante. Come se chiamassi il cane verso qualcosa di bello." },
          { name: "Ricompensa maxi-premio", desc: "Non appena {dogName} e da te: 5-7 pezzi di pollo uno dopo l'altro, lode tranquilla, una breve carezza. Non e un “premietto qualunque”, e una FESTA." },
          { name: "Lascialo subito andare di nuovo", desc: "Dopo 30 secondi di ricompensa: “OK”, {dogName} puo tornare a giocare, a annusare. Il richiamo non finisce MAI con la fine della liberta. E questo il punto." },
          { name: "5 ripetizioni, 3 sessioni al giorno", desc: "Per sessione 5 richiami, 3 sessioni al giorno in casa. Cosi per una settimana, poi allunga a 5m, 8m, attraverso altre stanze." },
        ],
        frequency: ["3 sessioni al giorno in casa", "Costruisci per 1 settimana", "Lascialo andare subito dopo la ricompensa"],
        watchFor: ["La ricompensa deve essere DAVVERO di valore", "Il tono e invitante, non autoritario"],
        gos: ["Pollo, non crocchini", "Chiama con gioia"],
        noGos: ["Mettere il guinzaglio subito dopo il richiamo", "Chiamare in modo autoritario"],
      },
      {
        title: "Richiamo con trattenimento per alta motivazione",
        intro: "Una seconda persona trattiene {dogName}, tu scappi: si attiva l'istinto predatorio.",
        steps: [
          { name: "Coinvolgi un aiutante", desc: "Un partner, un familiare o un amico. Questa persona trattiene delicatamente {dogName} per la pettorina." },
          { name: "Ti allontani in modo visibile", desc: "Ti allontani di 10-15 metri, nel campo visivo. Girati, abbassati in un accovacciamento profondo, batti le mani con gioia." },
          { name: "Chiama con gioia, l'aiutante lascia", desc: "Chiami VIENI con tono chiaro. Nello stesso momento: l'aiutante lascia {dogName}. {dogName} corre da te." },
          { name: "MEGA-maxi-premio all'arrivo", desc: "{dogName} arriva di corsa con energia: 7-10 pezzi di pollo, lode esuberante, accoglienza gioiosa. E un'esperienza-attrattiva." },
          { name: "Lascialo di nuovo andare", desc: "Dopo 30 sec di ricompensa: “OK”, {dogName} torna di corsa dall'aiutante, a giocare o a passeggiare. Non mettere mai il guinzaglio subito dopo questo gioco." },
          { name: "Aumenta lentamente la distanza", desc: "Nel corso delle settimane aumenta a 30-50m. Anche all'aperto con la longhina. E uno degli esercizi piu efficaci in assoluto: l'istinto predatorio lavora per te." },
        ],
        frequency: ["2-3 sessioni a settimana, di 4-6 ripetizioni", "All'aperto metti in sicurezza con la longhina"],
        watchFor: ["L'aiutante trattiene delicatamente, non con durezza", "Tu stesso devi visibilmente divertirti"],
        gos: ["Mega ricompensa, mega lode", "Lascialo subito andare di nuovo"],
        noGos: ["Subito dopo il richiamo mettere il guinzaglio e andare a casa", "Far sembrare l'aiutante “punitivo”"],
      },
      {
        title: "Il lavoro con la longhina come ponte",
        intro: "Prima di rischiare la corsa libera: 5-10m di longhina. {dogName} si sente libero, tu hai sicurezza.",
        steps: [
          { name: "La longhina giusta", desc: "5-10m di biothane (non una corda, brucia le mani quando scorre). Pettorina (mai fissare al collare, rischio di lesioni)." },
          { name: "Inizia in un posto tranquillo", desc: "Un prato tranquillo o una radura senza altri cani. {dogName} corre liberamente in un raggio di 5-10m." },
          { name: "Richiama regolarmente", desc: "Ogni 3-5 min: VIENI con tono gioioso. {dogName} viene? Maxi-premio, lascialo con calma, fagli continuare." },
          { name: "Se no: usa la longhina", desc: "Quando {dogName} NON viene: nessuna seconda chiamata. Invece raccogli delicatamente la longhina, tiralo verso di te, con calma. Comunque una piccola ricompensa all'arrivo." },
          { name: "Non chiamare mai quando e impossibile", desc: "Quando {dogName} e fortemente distratto (un altro cane, l'odore di selvaggina) e SAI: non verra, allora NON chiamare. Raccogli delicatamente la longhina, senza dire nulla." },
          { name: "Con le settimane in modo affidabile", desc: "Dopo 2-3 settimane {dogName} viene all'80-90% dei richiami. Solo allora pensiamo alla fase della liberta. Fino ad allora: la longhina resta attaccata." },
        ],
        frequency: ["3-4 passeggiate con la longhina a settimana", "Costruisci per 3-4 settimane"],
        watchFor: ["Biothane al posto della corda", "Pettorina obbligatoria"],
        gos: ["Allenati in posti tranquilli", "Mantieni una ricompensa di valore"],
        noGos: ["Longhina al collare", "Chiamare quando e chiaro che non verra"],
      },
      {
        title: "VIENI in presenza di distrazioni",
        intro: "Il vero test: il richiamo funziona anche quando c'e qualcosa di piu interessante che attira.",
        steps: [
          { name: "Scegli una distrazione moderata", desc: "Il bordo di un parco con passanti a 30m, un prato tranquillo a portata d'udito della strada. NON direttamente vicino ad altri cani, troppo intenso per questo livello." },
          { name: "Longhina per sicurezza", desc: "La longhina resta attaccata. La sicurezza e obbligatoria finche il richiamo in presenza di distrazioni non e al 90%." },
          { name: "Ricompensa preliminare", desc: "Prima di ogni richiamo pianificato 1-2 mini-ricompense dalla mano, perche {dogName} sappia: “il mio proprietario e proprio adesso interessante”." },
          { name: "Chiama con gioia, una volta", desc: "Di' VIENI con tono chiaro, UNA volta. Non ripetere. Quando {dogName} viene: SUPER-MAXI-PREMIO 7-10 premietti, lode esagerata." },
          { name: "Se no: longhina, senza drammi", desc: "Quando {dogName} non viene: raccogli con calma la longhina, tiralo leggermente, nessuna seconda chiamata, nessuna grida. All'arrivo: comunque una mini-ricompensa." },
          { name: "Mantieni un'efficacia dell'80%", desc: "Per sessione 4-6 richiami. Efficacia sotto il 70%? Riduci la distrazione. Sopra il 90%? Osa con una distrazione piu forte." },
        ],
        frequency: ["3-4 sessioni a settimana", "Costruisci per 2-4 settimane", "Mantieni consapevolmente l'efficacia"],
        watchFor: ["Mai una distrazione piu forte di quella gestibile", "Quando meno del 70%: un livello indietro"],
        gos: ["Dai ricompense preliminari", "Chiama una volta, poi la longhina"],
        noGos: ["Chiamare piu volte senza reazione", "Aumentare la distrazione troppo in fretta"],
      },
      {
        title: "Il fischietto come secondo segnale",
        intro: "Il fischietto si sente da lontano, suona sempre uguale e non si puo “avvelenare”.",
        steps: [
          { name: "Il fischietto giusto", desc: "ACME 211.5 o un fischietto per cani simile. Appeso al collare, cosi lo hai sempre con te. Non troppo acuto, chiaramente fischiabile." },
          { name: "Condiziona in casa", desc: "In casa: fischia un doppio tono chiaro (breve-breve o lungo-breve), subito un maxi-premio. {dogName} collega: “fischietto = premietto”." },
          { name: "5-7 ripetizioni a sessione", desc: "Per sessione 5-7 ripetizioni fischietto-ricompensa, 2 sessioni al giorno, per una settimana. Il condizionamento deve radicarsi in profondita." },
          { name: "All'aperto con la longhina", desc: "Trasferisci all'aperto: longhina attaccata, fischietto: {dogName} viene: mega-maxi-premio. Il fischietto e un'associazione nuova e fresca." },
          { name: "Mai per cose negative", desc: "Il fischietto non va MAI usato per mettere il guinzaglio, il bagno, il veterinario. E esclusivamente un segnale di riserva positivo." },
          { name: "Dopo 4 settimane piu sicuro", desc: "Il fischietto dopo 4 settimane e piu sicuro della voce. Suona sempre uguale (per quanto tu sia frustrato) e si sente a 200m+. Strumento d'emergenza n. 1." },
        ],
        frequency: ["In casa 2 sessioni/giorno per una settimana", "Poi con la longhina all'aperto", "Non abusarne mai"],
        watchFor: ["Un fischietto per tutti i membri della famiglia", "Mai per cose negative"],
        gos: ["Sempre lo stesso doppio tono", "Mega ricompensa all'arrivo"],
        noGos: ["Il fischietto durante la visita dal veterinario", "Fischiare piu volte senza reazione"],
      },
      {
        title: "Ricompensa a tre livelli",
        intro: "Diversi livelli di ricompensa per diverse difficolta.",
        steps: [
          { name: "Definisci tre livelli", desc: "Richiamo QUOTIDIANO (distrazione leggera): ricompensa normale 2-3 premietti. MAXI-PREMIO (medio-difficile): 5-7 premietti di valore. EMERGENZA (estremamente difficile): 10+ mega ricompensa." },
          { name: "Richiami quotidiani a passeggiata", desc: "3-5 richiami quotidiani a passeggiata. Situazioni semplici, ricompensa normale. {dogName} impara: il richiamo e normale e capita spesso." },
          { name: "Maxi-premio per un successo in presenza di distrazione", desc: "Quando {dogName} supera una situazione impegnativa (un altro cane a 50m, un capriolo a vista): mega ricompensa 7-10 premietti. L'impresa ha un prezzo." },
          { name: "Risparmia la parola d'emergenza", desc: "Una parola aggiuntiva (tua) la riservi esclusivamente alle situazioni d'emergenza. Non usarla mai tutti i giorni, altrimenti perde la sua magia." },
          { name: "Testa regolarmente la parola d'emergenza", desc: "1 volta al mese un'“emergenza di prova”: in una situazione rilassata chiama la parola d'emergenza, MEGA-maxi-premio di 15 premietti. Cosi resta condizionata." },
          { name: "Mantieni la gerarchia delle ricompense con coerenza", desc: "Non sprecare mai la ricompensa d'emergenza tutti i giorni. Non usare mai la ricompensa quotidiana in un'emergenza. I livelli sono sacri." },
        ],
        frequency: ["Richiami quotidiani: 3-5 volte a passeggiata", "Parola d'emergenza: testala 1 volta al mese"],
        watchFor: ["Rispetta rigorosamente la gerarchia dei valori", "Tieni separata la parola d'emergenza"],
        gos: ["Distingui chiaramente i livelli", "Usa con parsimonia la parola d'emergenza"],
        noGos: ["Parola d'emergenza usata a sproposito", "Premiare tutti i richiami allo stesso modo"],
      },
      {
        title: "Prima corsa libera controllata",
        intro: "Quando tutto il resto funziona: la prima fase cauta di corsa libera.",
        steps: [
          { name: "Scegli la zona piu sicura", desc: "Un'area recintata per cani, una radura lontana dalla strada. L'opzione topograficamente piu sicura che conosci." },
          { name: "Posa la longhina, non toglierla", desc: "La longhina resta alla pettorina, ma la lasci cadere a terra. {dogName} puo correre liberamente per 10m, ma ha comunque una sicurezza (puoi calpestare la longhina)." },
          { name: "Dopo 1-2 min un richiamo", desc: "Primo test: dopo 1-2 min di liberta VIENI + fischietto (entrambi i segnali insieme per la prima volta). Con un richiamo affidabile entro 5 secondi: continua." },
          { name: "Se non viene: indietro", desc: "Quando {dogName} non viene: torna SUBITO alla fase della longhina. 2 altre settimane di longhina, poi un nuovo test. La pazienza paga." },
          { name: "Corsa libera max 15-20 min", desc: "Le prime corse libere non piu lunghe di 15-20 min. In ognuna inserisci 3-4 richiami, tutti con maxi-premio. Concludi prima che {dogName} si stanchi." },
          { name: "Mai vicino alle strade", desc: "Per quanto buono sia il richiamo: MAI corsa libera vicino alle strade, in zone sconosciute, con molta selvaggina. La sicurezza sempre prima della comodita." },
        ],
        frequency: ["1-2 corse libere a settimana, brevi", "Mai vicino alle strade, mai piu di 20 min"],
        watchFor: ["Un ambiente sicuro come obbligo", "Se non viene torna subito alla longhina"],
        gos: ["Preferisci una zona recintata", "La longhina come ponte di sicurezza"],
        noGos: ["Corsa libera vicino alle strade", "Insistere dopo un insuccesso"],
      },
      {
        title: "Manutenzione per tutta la vita",
        intro: "Un buon richiamo ha bisogno di una manutenzione regolare, altrimenti sbiadisce.",
        steps: [
          { name: "2-3 richiami a passeggiata", desc: "Anche quando il richiamo funziona in modo affidabile da mesi: a passeggiata inserisci almeno 2-3 richiami, sempre con ricompensa. Questo mantiene fresca l'associazione." },
          { name: "Mantieni una ricompensa di valore", desc: "Non scendere mai ai crocchini come ricompensa per il richiamo. Mina il valore. Pollo, formaggio, premietti di valore restano lo standard." },
          { name: "Ogni mese un nuovo percorso", desc: "1 volta al mese un nuovo percorso per testare il richiamo. La generalizzazione va curata, altrimenti funziona solo nei posti noti." },
          { name: "Ogni anno rinfresca la parola d'emergenza", desc: "Il segnale d'emergenza ogni 3-6 mesi testalo in una situazione rilassata e dai un MAXI-PREMIO. Cosi resta pronto all'uso, quando davvero ti serve." },
          { name: "In caso di regressione reagisci subito", desc: "Quando {dogName} una volta non viene: NON riporre la longhina in modo definitivo. Una settimana di nuovo alla longhina, poi un nuovo tentativo. Senza timore delle regressioni momentanee." },
          { name: "Il richiamo con trattenimento come ricarica", desc: "Ogni pochi mesi inserisci una sessione di richiamo con trattenimento con un aiutante. Alimenta enormemente l'entusiasmo e rinfresca l'associazione." },
        ],
        frequency: ["Manutenzione per tutta la vita", "Almeno 2-3 richiami a passeggiata"],
        watchFor: ["Mantieni alto il livello della ricompensa", "Cura la generalizzazione"],
        gos: ["Manutenzione regolare", "Mantieni una ricompensa di valore"],
        noGos: ["Dare il richiamo per scontato", "Ridurre o saltare la ricompensa"],
      },
    ],
    abschluss: {
      title: "Conclusione",
      subtitle: "In bocca al lupo",
      paras: [
        "Un richiamo affidabile e la polizza sulla vita piu importante per il tuo cane. {dogName} puo avere liberta solo quando torna davvero, tutto il resto e un rischio.",
        "Il segreto e la pazienza piu una ricompensa di valore. Non passare mai a premietti piu economici, non dare mai il richiamo per scontato. Con ogni richiamo a cui rispondi con gentilezza consolidi l'associazione.",
        "Usa la longhina piu a lungo di quanto pensi. I proprietari di cani spesso saltano troppo in fretta alla corsa libera. Chi usa la longhina 2-3 mesi in piu, ha un richiamo affidabile al 100% invece che all'80%.",
        "Il fischietto e il tuo strumento d'emergenza. Curalo ogni mese, non dimenticarlo mai. Quando arrivera il giorno in cui {dogName} sparisce nell'erba alta e sei quasi in preda al panico, quel fischietto ti salvera.",
      ],
    },
  },

  barking: {
    coverTitle: "Piano contro l'abbaiare per",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Perche questo piano e costruito proprio cosi",
      subtitle: "Calma al posto del rumore continuo",
      paras: [
        "{dogName} abbaia troppo. Non e un segno di dominanza ne di cattiveria, ma quasi sempre una reazione a stimoli, frustrazione, bisogno di attenzione o insicurezza.",
        "L'abbaiare ha cause molto diverse: il campanello, i rumori sul pianerottolo, altri cani in giardino, la solitudine, la frustrazione al guinzaglio. Ogni causa richiede la propria risposta.",
        "Il piu grande malinteso: gridare NON ferma l'abbaiare. Al contrario, per il cane suona come un abbaiare insieme. Con {dogName} ogni reazione all'abbaiare rafforza questo comportamento.",
        "Questo piano costruisce il silenzio come comportamento di valore. Premiamo le fasi di silenzio, stabiliamo delle alternative al campanello e scolleghiamo in modo sistematico le reazioni ai fattori scatenanti. Con pazienza, senza pressione.",
      ],
    },
    how: {
      title: "Come svolgere correttamente gli esercizi",
      paras: [
        "Per prima cosa individua i fattori scatenanti. Quando abbaia {dogName} piu spesso? Il campanello, la finestra, la frustrazione, la solitudine? Per ogni causa c'e una tecnica diversa.",
        "Premia il silenzio in modo attivo. I cani imparano piu in fretta cosa devono OTTENERE che cosa devono EVITARE. Ogni silenzio di 5-10 secondi riceve un sottovoce marcatore SILENZIO con un premietto.",
        "Sii coerente nella tua reazione: l'abbaiare viene completamente ignorato (voltarsi, nessun contatto visivo). Le fasi di silenzio vengono premiate. Dopo 2-3 settimane {dogName} impara: „Abbaiare non serve a niente. Il silenzio da un premietto”.",
        "La coerenza della famiglia e obbligatoria. Un familiare che di fronte all'abbaiare coccola o grida sabota tutto il lavoro. Riunione all'inizio, tutti partecipano.",
      ],
    },
    exercises: [
      {
        title: "Tieni un diario dei fattori scatenanti",
        intro: "Prima di ridurre l'abbaiare, devi sapere quando e perche si verifica.",
        steps: [
          { name: "Prepara un blocco note", desc: "Un quadernetto A5 o un'app per appunti sul telefono. Importante: subito accessibile appena inizia l'abbaiare." },
          { name: "Annota tutti gli episodi di abbaiare per 7 giorni", desc: "Per episodio: data, ora, fattore scatenante (campanello, rumore, cane fuori dalla finestra), durata in minuti, la tua reazione." },
          { name: "Individua gli schemi", desc: "Dopo 7 giorni analizza: i 3 fattori scatenanti piu frequenti, i momenti tipici della giornata, la durata tipica. Questi sono i tuoi punti focali dell'allenamento." },
          { name: "Dai priorita ai fattori scatenanti principali", desc: "Individua 1-2 fattori scatenanti principali (ad es. campanello + cane fuori dalla finestra). Con questi ci occupiamo per primi. I fattori scatenanti rari vengono dopo." },
          { name: "Valuta la tua reazione con onesta", desc: "Come reagisci tu stesso al momento? Gridi? Coccoli? Ignori? Annota con onesta. Spesso la propria reazione fa parte del problema." },
          { name: "Continua il diario nella fase 2", desc: "Dopo le prime 2 settimane di allenamento: tieni di nuovo il diario. Confronta la frequenza. Cosi vedi in modo oggettivo se l'allenamento funziona." },
        ],
        frequency: ["Documenta con coerenza per 7 giorni", "Dopo 2 settimane di allenamento analizza di nuovo"],
        watchFor: ["L'onesta e importante", "Annota anche i mini-episodi"],
        gos: ["Annota subito dopo l'episodio", "Cerca gli schemi"],
        noGos: ["Contare solo gli episodi „grandi”", "Tacere sulla propria reazione"],
      },
      {
        title: "Stabilisci il marcatore del silenzio",
        intro: "Il silenzio diventa un'azione premiata. Condizionamento nell'arco di settimane.",
        steps: [
          { name: "SILENZIO come nuova parola-marcatore", desc: "Scegli una parola che raramente ricorre nella vita di tutti i giorni. SILENZIO o ZITTO vanno bene. Da ora questa parola si collega alla ricompensa per il silenzio." },
          { name: "Riconosci il silenzio di 5 secondi", desc: "Osserva {dogName} in modo consapevole: 5 secondi senza abbaiare, senza mugolare, senza lamentarsi. Proprio in questo momento e il momento della ricompensa." },
          { name: "Di sottovoce SILENZIO + premietto", desc: "Nel momento di silenzio: di sottovoce SILENZIO, posa un premietto morbido tra le zampe anteriori. Con calma, senza eccitazione." },
          { name: "Per 1 settimana ogni giorno 8-10 volte", desc: "Ogni giorno 8-10 di queste ricompense per il silenzio. Con coerenza. {dogName} impara: silenzio = a volte compare qualcosa di buono." },
          { name: "Allunga il tempo di silenzio", desc: "Dopo 1 settimana: aspetta 10 sec prima di dire SILENZIO. Poi 20 sec, 30 sec, 1 min. Nell'arco di 3 settimane aumenta fino a 1-2 minuti di silenzio." },
          { name: "Non chiamare mai „zitto” quando abbaia", desc: "IMPORTANTE: SILENZIO mai come segnale-stop quando {dogName} sta gia abbaiando. Questo avvelena l'associazione. SILENZIO si dice solo per il silenzio, non come correzione." },
        ],
        frequency: ["8-10 ricompense al giorno", "Allunga il silenzio nell'arco di 3 settimane"],
        watchFor: ["Non usare mai SILENZIO come rimprovero", "Premia sottovoce e con calma"],
        gos: ["Marcatore sottovoce, premietto morbido", "Con coerenza nell'arco di settimane"],
        noGos: ["Dire SILENZIO durante l'abbaiare", "Premiare con voce acuta (eccita)"],
      },
      {
        title: "Routine campanello-tappetino",
        intro: "Quando suona, {dogName} corre sul tappetino invece che alla porta. Pavlov per principianti.",
        steps: [
          { name: "Tappetino in un posto fisso", desc: "Tappetino a 3m dalla porta d'ingresso, in un posto tranquillo. Questo tappetino da ora si collega al campanello." },
          { name: "Registrazione del campanello nel telefono", desc: "Registra il suono del vostro vero campanello (registralo nel telefono). Ti serve esattamente questo suono per il condizionamento." },
          { name: "Esercizi a secco in casa", desc: "Riproduci la registrazione del campanello a basso volume: porta subito {dogName} sul tappetino: premietto sul tappetino. 10 ripetizioni a sessione, 2 sessioni/giorno." },
          { name: "Aumenta il volume", desc: "Nell'arco di 1 settimana aumenta gradualmente il volume del campanello, sempre con lo stesso svolgimento. Campanello: tappetino: ricompensa." },
          { name: "Campanello vero con un aiutante", desc: "Dopo 2 settimane: un aiutante suona dall'esterno, {dogName} dovrebbe correre in automatico sul tappetino. In caso di successo: MAXI-premio." },
          { name: "Routine con ospiti veri", desc: "Quando arrivano ospiti veri: campanello: tappetino: {dogName} resta sdraiato, l'ospite entra, lo ignora per i primi 2 min. Solo allora {dogName} puo alzarsi e salutare in modo amichevole." },
        ],
        frequency: ["Costruisci 2 sessioni/giorno in casa", "Consolida nell'arco di 2-3 settimane", "Test veri del campanello con un aiutante"],
        watchFor: ["Aumento coerente del volume", "Non premiare mai alla porta"],
        gos: ["Tappetino = luogo sicuro della ricompensa", "Porta a termine con coerenza"],
        noGos: ["La zona della porta come area di ricompensa", "Incoerenza con gli ospiti veri"],
      },
      {
        title: "Affama l'abbaiare per attirare attenzione",
        intro: "Quando {dogName} abbaia per ottenere attenzione, ignorare e l'unica soluzione.",
        steps: [
          { name: "Riconosci l'abbaiare per attenzione", desc: "E abbaiare per attenzione quando {dogName} ti guarda mentre abbaia, entra nel tuo campo visivo, pretende. NESSUN vero fattore scatenante all'esterno: il fattore scatenante sei tu." },
          { name: "Voltarsi completamente", desc: "Appena inizia l'abbaiare per attenzione: voltati dando le spalle, nessun contatto visivo, nessun suono. In quel momento non esisti per {dogName}." },
          { name: "Aspetta 5 sec di silenzio", desc: "Ti volti di nuovo solo quando {dogName} non ha abbaiato per 5 sec. Quando c'e silenzio: voltati, un ciao tranquillo." },
          { name: "Al nuovo abbaiare subito via", desc: "Quando l'abbaiare ricomincia: voltati subito di nuovo dando le spalle. Con coerenza, ogni volta. {dogName} impara: „Abbaiare = il padrone se ne va”." },
          { name: "Aspettati il picco dell'affamamento", desc: "IMPORTANTE: nei primi 3-7 giorni l'abbaiare spesso PEGGIORA, non migliora. E l'„esplosione dell'estinzione”. Chi cede qui, ha perso. Resisti." },
          { name: "Dopo 2 settimane visibilmente meno", desc: "Quando la coerenza della famiglia e costante, l'abbaiare per attenzione diminuisce in modo visibile dopo 2-3 settimane. La riunione della famiglia e decisiva." },
        ],
        frequency: ["A ogni abbaiare per attenzione", "Coerenza della famiglia ogni giorno"],
        watchFor: ["Non interpretare male il picco dell'affamamento", "Una sola cedimento costa 1 settimana"],
        gos: ["Voltati completamente, nessuna parola", "Premia il silenzio"],
        noGos: ["Gridare", "Cedere dopo un abbaiare prolungato"],
      },
      {
        title: "Controcondizionamento agli stimoli esterni",
        intro: "Quando {dogName} abbaia alla finestra o in giardino: cambia l'associazione emotiva.",
        steps: [
          { name: "Individua la zona di osservazione", desc: "Dove abbaia di solito {dogName}? Finestra sulla strada, balcone, recinzione del giardino. Questi posti sono i punti critici." },
          { name: "Barattolo con premietti a portata di mano", desc: "Metti un barattolo con premietti di valore direttamente vicino alla zona dell'abbaiare. Devi poter dare un premietto entro 2 secondi appena compare lo stimolo." },
          { name: "Lo stimolo compare: premietto", desc: "Appena compare un potenziale fattore scatenante dell'abbaiare (una persona fuori dalla finestra, un cane alla recinzione): SUBITO dai un premietto. NON aspettare se {dogName} abbaia." },
          { name: "Lo stimolo sparisce: sparisce il premietto", desc: "Quando lo stimolo sparisce, finisce anche la ricompensa. {dogName} collega: „Lo stimolo c'e = qualcosa di buono. Lo stimolo e sparito = niente”. L'associazione emotiva cambia." },
          { name: "Con l'abbaiare NON premiare", desc: "Quando {dogName} inizia gia ad abbaiare PRIMA che tu riesca a dare il premietto: nessuna ricompensa. Devi essere piu veloce dell'abbaiare. Alla comparsa dello stimolo agisci subito." },
          { name: "Associazione nell'arco di 3-4 settimane", desc: "Con coerenza nell'arco di settimane cambia la reazione emotiva di {dogName}. Stimolo = attesa di un premietto, non abbaiare per stress. Questo e il controcondizionamento." },
        ],
        frequency: ["A ogni stimolo nei punti critici", "Con coerenza nell'arco di 3-4 settimane"],
        watchFor: ["Sii piu veloce dell'abbaiare", "Non premiare mai l'abbaiare"],
        gos: ["Barattolo con premietti a portata di mano", "Reagisci subito allo stimolo"],
        noGos: ["Premiare dopo l'inizio dell'abbaiare", "Ignorare il fattore scatenante sperando"],
      },
      {
        title: "Riduci l'abbaiare da frustrazione",
        intro: "Alcuni cani abbaiano per frustrazione. La soluzione: costruire la tolleranza alla frustrazione.",
        steps: [
          { name: "Riconosci l'abbaiare da frustrazione", desc: "L'abbaiare da frustrazione avviene quando {dogName} non puo/non gli e permesso qualcosa: uno scoiattolo fuori portata, un altro cane dietro la recinzione, la porta chiusa della cucina. {dogName} guaisce-abbaia per l'attesa." },
          { name: "Stabilisci il segnale ASPETTA", desc: "In casa: prima del pasto di ASPETTA, la mano davanti alla ciotola, aspetta 5 sec, poi VIA e cibo. Aumenta fino a 10, 20, 30 sec nell'arco di 2 settimane." },
          { name: "Con l'abbaiare durante ASPETTA", desc: "Quando {dogName} abbaia durante l'attesa: ritira la mano, nessun VIA. Quando sta calmo per 3 sec: solo allora lo sblocco." },
          { name: "ASPETTA nelle situazioni quotidiane", desc: "Trasferisci ai fattori scatenanti della frustrazione: ASPETTA alla porta della cucina, ASPETTA al guinzaglio prima della passeggiata, ASPETTA prima del giocattolo. 5-7 mini-situazioni al giorno." },
          { name: "La tolleranza alla frustrazione cresce nell'arco di settimane", desc: "Dopo 3-4 settimane {dogName} capisce: „Abbaiare non mi porta all'obiettivo. Aspettare con calma mi porta all'obiettivo”. L'abbaiare da frustrazione diminuisce in modo visibile." },
          { name: "Non cedere mai all'abbaiare", desc: "Il punto piu importante: non cedere MAI all'abbaiare da frustrazione. Quando {dogName} abbaia e tu allora apri la porta o dai il giocattolo, hai rafforzato l'abbaiare." },
        ],
        frequency: ["5-7 mini-ASPETTA al giorno", "Costruisci nell'arco di 3-4 settimane"],
        watchFor: ["Non aprire mai l'obiettivo mentre abbaia", "ASPETTA deve finire in modo positivo (lo sblocco)"],
        gos: ["ASPETTA come segnale positivo", "Coerenza con l'abbaiare da frustrazione"],
        noGos: ["Sbloccare durante l'abbaiare", "Gridare quando abbaia"],
      },
      {
        title: "Routine della porta con gli ospiti",
        intro: "Una vera sequenza di accoglienza degli ospiti che disinnesca l'abbaiare.",
        steps: [
          { name: "Istruisci gli ospiti in anticipo", desc: "Di agli ospiti prima del loro arrivo: „Per favore ignorate {dogName} finche non dico che va bene”. Nessuna carezza, nessuno sguardo, nessun approccio verbale." },
          { name: "Campanello: tappetino (routine allenata)", desc: "Al vero campanello: {dogName} corre sul tappetino (allenato nell'esercizio 3). Vai alla porta, apri con calma, saluti l'ospite sottovoce." },
          { name: "L'ospite entra, ignora {dogName}", desc: "L'ospite va con calma in salotto, si siede, ignora {dogName} sul tappetino. {dogName} resta sdraiato, ogni 30 sec un premietto." },
          { name: "Dopo 5 min di calma da sdraiato: sblocco", desc: "Quando {dogName} sta sdraiato tranquillo per 5 minuti: segnale OK, puo avvicinarsi con cautela all'ospite. Se scatta in piedi o abbaia: di nuovo sul tappetino." },
          { name: "L'ospite accarezza solo con SEDUTO", desc: "Quando {dogName} si avvicina all'ospite: di SEDUTO. Solo quando sta seduto tranquillo, l'ospite puo accarezzarlo. Se salta: l'ospite si volta." },
          { name: "Consolida la routine con piu ospiti", desc: "Allena per 4-6 settimane con ospiti diversi. Diventa la normalita. {dogName} sa: „Campanello = tappetino, poi un ciao tranquillo”." },
        ],
        frequency: ["A ogni visita di ospiti programmata", "Consolida nell'arco di piu settimane"],
        watchFor: ["La riunione con gli ospiti e decisiva", "Coerenza a ogni visita"],
        gos: ["Informa gli ospiti in anticipo", "Tappetino = standard del saluto"],
        noGos: ["Gli ospiti reagiscono all'abbaiare", "Permettere di salutarsi subito all'ingresso"],
      },
      {
        title: "Igiene dello stress contro le ricadute dell'abbaiare",
        intro: "L'abbaiare torna quando cresce il livello generale di stress. Prevenzione invece di reazione.",
        steps: [
          { name: "Individua i fattori di stress", desc: "Cosa stressa {dogName}? Poco sonno, troppa azione, nuovi membri della famiglia, un trasloco, una malattia. Quando il livello di stress cresce, l'abbaiare torna." },
          { name: "Cura l'igiene del sonno", desc: "I cani adulti hanno bisogno di 16-20h di riposo al giorno. Quando {dogName} dorme meno, e piu reattivo. Pianifica fasi di calma consapevoli, anche quando e sveglio." },
          { name: "Bilancia le attivita", desc: "Non accumulare mai piu attivita molto eccitanti in un solo giorno. Una visita al parco + ospiti + una lunga passeggiata sono un sovraccarico. Al giorno al massimo 2 vere attrazioni." },
          { name: "Regola delle 72 ore di stress", desc: "Dopo un evento stressante (veterinario, un'escalation, un trasloco): 72 ore di giorni consapevolmente tranquilli. Nessun allenamento contro l'abbaiare in questo periodo. Gli ormoni dello stress devono calare." },
          { name: "Attivita generale adeguata", desc: "Abbastanza lavoro olfattivo, lavoro mentale, contatto sociale. Un cane poco stimolato abbaia di piu. Piano giornaliero: 1 fisica, 1 olfattiva, 1 mentale." },
          { name: "Con un'ondata di abbaiare riduci la routine", desc: "Quando l'abbaiare ricomincia all'improvviso: non farti prendere dal panico. Controlla i fattori di stress, calma la routine, per 2 settimane vai „pulito”. Poi si normalizza." },
        ],
        frequency: ["Manutenzione per tutta la vita", "Con un'ondata acuta di abbaiare controlla la routine"],
        watchFor: ["Lo stress si accumula nell'arco di giorni", "L'igiene del sonno spesso sottovalutata"],
        gos: ["Riduci in modo proattivo i fattori di stress", "Pianifica il sonno"],
        noGos: ["In fase di stress piu allenamento", "Ignorare l'abbaiare come sintomo"],
      },
    ],
    abschluss: {
      title: "Conclusione",
      subtitle: "In bocca al lupo",
      paras: [
        "L'abbaiare e comunicazione. {dogName} ha dei motivi per cui abbaia: uno stimolo, la frustrazione, la paura, l'attenzione. Il tuo compito non e „farlo tacere”, ma occuparti della causa giusta.",
        "Premiare il silenzio e il pilastro piu importante. I cani imparano piu in fretta cosa devono OTTENERE che cosa devono EVITARE. Ogni fase di silenzio che finisce con un premietto costruisce la routine.",
        "La coerenza della famiglia e tutto. La persona che di fronte all'abbaiare coccola o grida sabota tutto il lavoro. Riunione all'inizio, tutti partecipano. Nell'arco di settimane ripaga.",
        "Quando l'abbaiare ricompare, guarda il livello generale di stress. Spesso l'abbaiare e un sintomo di sovraccarico o di scarsa stimolazione. Con l'igiene del sonno e un'attivita bilanciata resta stabile.",
      ],
    },
  },

  jumping: {
    coverTitle: "Piano contro il saltare addosso per",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Perche questo piano e costruito proprio cosi",
      subtitle: "Saluti tranquilli al posto del caos",
      paras: [
        "{dogName} salta addosso alle persone, con intenzione amichevole, ma e sgradevole. Non e un errore educativo, ma una mancanza di controllo degli impulsi piu una semplice logica: in passato saltare portava attenzione.",
        "I cani sono maestri nel leggere le reazioni umane. Anche il rimprovero, lo spingere via o un forte „GIU” sono per {dogName} attenzione. L'attenzione rafforza questo comportamento, anche se non e affatto quello che vuoi.",
        "Con {dogName} lavoriamo esattamente al contrario: 4 zampe a terra portano una ricompensa, saltare non porta NIENTE. Gli dai un'alternativa migliore.",
        "Questo piano costruisce la routine in modo sistematico: prima con te stesso, poi con la famiglia, poi con ospiti annunciati, poi con passanti sconosciuti. Con pazienza, con coerenza, in modo amichevole.",
      ],
    },
    how: {
      title: "Come svolgere correttamente gli esercizi",
      paras: [
        "La coerenza e tutto. La persona che una volta di fronte al saltare accarezza pensando „tanto lo fa con affetto” sabota una settimana di progressi. La riunione della famiglia all'inizio e obbligatoria.",
        "SEDUTO come alternativa al saluto e il pilastro piu importante. {dogName} non puo stare seduto e saltare allo stesso tempo. Gli diamo un comportamento che esclude il saltare.",
        "Gli ospiti devono essere istruiti. Di ai visitatori in anticipo: „Per favore, ignora {dogName} finche non si siede”. All'inizio sembra scortese, ma protegge l'allenamento.",
        "La carezza e una ricompensa. Quando {dogName} sta seduto, la persona lo accarezza. Quando {dogName} salta, voltati dando le spalle, nessuna attenzione. In modo chiaro, coerente, uguale con ogni persona.",
      ],
    },
    exercises: [
      {
        title: "Stabilire la regola delle 4 zampe",
        intro: "Il contatto con il suolo diventa la ricompensa standard. Saltare non porta niente.",
        steps: [
          { name: "Attiva la modalita osservazione", desc: "Per 1-2 giorni fai attenzione in modo consapevole a ogni momento in cui {dogName} ti saluta. Quando salta e quando sta fermo tranquillo? Annota i fattori scatenanti tipici." },
          { name: "A ogni incontro controlla le 4 zampe", desc: "Torni a casa, entri in una stanza, torni in cucina. OGNI volta: {dogName} ha 4 zampe a terra? Se si: SUBITO accucciati, un ciao tranquillo, una carezza sottovoce." },
          { name: "Quando salta: voltati dando le spalle", desc: "Appena le zampe anteriori vanno in su: giro di 180 gradi, sguardo di lato, nessun suono. In quel momento non esisti. NESSUN „GIU”, nessuno spingere via: quella e attenzione." },
          { name: "4 zampe di nuovo giu = di nuovo attenzione", desc: "Appena le 4 zampe tornano a terra: voltati, un ciao tranquillo. {dogName} impara in un lampo: „Saltare = il padrone se ne va. Stare fermo = ciao”." },
          { name: "Riunione della famiglia il giorno 1", desc: "Tutti i conviventi ricevono la regola spiegata. Un adesivo sulla porta di casa: „4 zampe = si. Saltare = voltarsi”. L'incoerenza di UNA persona sabota tutto." },
          { name: "Dopo 2-3 settimane di coerenza", desc: "Quando tutti partecipano: saltare diminuisce in modo misurabile dopo 2-3 settimane. La strada non e „spegnere il saltare”, ma „rendere le 4 zampe il saluto standard”." },
        ],
        frequency: ["Applica a ogni incontro", "Coerenza della famiglia ogni giorno"],
        watchFor: ["L'incoerenza costa settimane", "Mai „permettere ogni tanto un bel salto”"],
        gos: ["Voltarsi dando le spalle quando salta", "Premiare le 4 zampe con coerenza"],
        noGos: ["Gridare „GIU” (e attenzione)", "Spingere via con il ginocchio"],
      },
      {
        title: "SEDUTO come alternativa al saluto",
        intro: "Invece di prevenire soltanto il saltare: proponi il comportamento desiderato.",
        steps: [
          { name: "SEDUTO deve essere sicuro", desc: "Condizione: SEDUTO al segnale normale e sicuro in 8 prove su 10. Se no, prima consolida quello, poi l'esercizio contro il saltare." },
          { name: "Agli incontri di SEDUTO", desc: "Agli incontri (famiglia, ospiti, passanti): di SEDUTO PRIMA che la persona sia a portata di salto. {dogName} riceve un compito." },
          { name: "Quando sta seduto: la persona accarezza", desc: "{dogName} sta seduto: subito BRAVO, carezza, una ricompensa sottovoce. La persona diventa la fonte della ricompensa, non una rampa per saltare." },
          { name: "Quando si alza per saltare: fine della carezza", desc: "Appena {dogName} si alza o salta: la persona si volta, fine della carezza. Appena di nuovo SEDUTO: girati, la carezza continua." },
          { name: "Istruisci anche gli ospiti", desc: "Istruisci gli ospiti in anticipo: „Accarezzi solo quando sta seduto. Quando si alza: voltati”. Un'indicazione scritta all'ingresso aiuta con gli ospiti smemorati." },
          { name: "Nell'arco di settimane in automatico", desc: "Dopo 3-4 settimane SEDUTO diventa la routine automatica del saluto. {dogName} si siede da solo, perche e una strategia che ripaga." },
        ],
        frequency: ["A ogni incontro", "Nell'arco di 3-4 settimane fino alla routine"],
        watchFor: ["SEDUTO deve essere molto stabile come condizione", "Non dimenticare la riunione con gli ospiti"],
        gos: ["SEDUTO prima di ogni ciao", "Istruisci gli ospiti con coerenza"],
        noGos: ["Lasciare SEDUTO senza ricompensa", "Continuare ad accarezzare quando si alza"],
      },
      {
        title: "Sdrammatizzare la propria routine di saluto",
        intro: "Il modo in cui ti comporti tu stesso dopo il rientro a casa modella enormemente il saltare.",
        steps: [
          { name: "Coreografia del rientro a casa", desc: "Apri la porta, entri con calma, ti togli le scarpe, posi la borsa: tutto SENZA guardare {dogName}. Anche se salta eccitato: ignora." },
          { name: "Attenzione solo dopo 2 min", desc: "Continua a fare le tue cose normalmente: vai in cucina, preparati un te, appendi il cappotto. Solo quando {dogName} si calma, ti avvicini a lui." },
          { name: "Saluto vicino al suolo", desc: "Accucciati (o siediti), {dogName} si avvicina a te. 4 zampe a terra? SEDUTO? Allora accarezza con calma. Cosi eviti gli inviti a saltare in su." },
          { name: "Voce calma", desc: "Saluta {dogName} con voce bassa e calma. NESSUN „Dov'e il mio tesoro!” eccitato. Questo lo carica. Basso e caldo: „Ehi ciao”." },
          { name: "La famiglia si corregge a vicenda", desc: "I membri della famiglia si ricordano a vicenda. „Ehi, hai salutato di nuovo con voce acuta: e per questo che salta cosi”. Un feedback sincero da progressi." },
          { name: "Nell'arco di settimane il saluto diventa ordinario", desc: "Dopo 4-6 settimane di routine tranquilla: {dogName} e meno eccitato al rientro a casa, perche non e piu un picco emotivo." },
        ],
        frequency: ["A ogni rientro a casa", "Coerenza in famiglia"],
        watchFor: ["Frenare la propria eccitazione", "La famiglia si corregge a vicenda"],
        gos: ["Voce bassa e calma", "Salutare all'altezza del suolo"],
        noGos: ["Un entusiastico „Dov'e il mio tesoro”", "Coccolare subito mentre e in piedi"],
      },
      {
        title: "Routine del campanello e degli ospiti",
        intro: "Con gli ospiti il saltare diventa particolarmente intenso. Costruiamo una sequenza chiara.",
        steps: [
          { name: "Tappetino a 3m dalla porta d'ingresso", desc: "Il tappetino e posizionato a 3m dalla porta, in un posto tranquillo. Questo tappetino diventa il luogo dell'accoglienza degli ospiti." },
          { name: "Campanello = tappetino (routine allenata)", desc: "Quando suona: {dogName} corre sul tappetino (elaborato in precedenza negli esercizi a secco). In caso di successo: premietto sul tappetino." },
          { name: "L'ospite entra, ignora {dogName}", desc: "Apri la porta, l'ospite entra. L'ospite e stato istruito in anticipo: NON approcciare a voce, NON guardare, NON chinarsi verso {dogName}. Va dritto in salotto." },
          { name: "Dopo 2-3 min di calma da sdraiato: OK", desc: "Quando {dogName} e rimasto 2-3 min tranquillo sul tappetino: segnale OK, puo andare dall'ospite. Se no: di nuovo sul tappetino, una nuova pausa di 1 min." },
          { name: "L'ospite accarezza solo con SEDUTO", desc: "Quando {dogName} e dall'ospite: segnale SEDUTO. Quando sta seduto: carezza tranquilla. Quando si alza: fine della carezza, l'ospite si volta." },
          { name: "Consolidare la routine con molti ospiti", desc: "Allena con ospiti diversi per 4-6 settimane. Tipi di persone diversi, energie diverse. {dogName} impara: questo vale per tutti, non solo per la famiglia." },
        ],
        frequency: ["A ogni visita di ospiti", "Consolidare nell'arco di 4-6 settimane"],
        watchFor: ["La riunione con gli ospiti e obbligatoria", "L'incoerenza di UN ospite costa l'esercizio"],
        gos: ["Tappetino = standard dell'accoglienza", "Istruire gli ospiti in anticipo in modo chiaro"],
        noGos: ["Permettere di salutare gli ospiti dritti all'ingresso", "„Ogni tanto” far passare il saltare"],
      },
      {
        title: "Passanti durante la passeggiata",
        intro: "Saltare all'aperto e delicato. Non tutti vogliono un cane amichevole sul cappotto.",
        steps: [
          { name: "Osservazione 1: quando salta?", desc: "Durante 2-3 passeggiate osserva: su quali persone salta {dogName}? Uomini? Donne? Bambini? Statura? Cappello in testa?" },
          { name: "Prima dell'incontro SEDUTO", desc: "Quando un passante entra nel campo visivo (10-15m), dai il segnale SEDUTO ACCANTO alla tua gamba. {dogName} si siede, ricompensa con un premietto." },
          { name: "Mantenere durante il sorpasso", desc: "Quando la persona passa accanto: {dogName} resta seduto, premi ogni 5 sec con un mini-premietto. L'attenzione e su di te, non sul passante." },
          { name: "Istruisci il passante", desc: "Se la persona sembra interessata: „Per favore, ignoralo, stiamo proprio allenandoci”. La maggior parte delle persone lo rispetta." },
          { name: "Dopo il sorpasso: prosegui", desc: "Appena il passante e a 5m dietro di voi: BRAVO, proseguite. Una pausa per annusare come ricompensa bonus." },
          { name: "Nell'arco di settimane il seduto diventa un riflesso", desc: "Dopo 4-6 settimane {dogName} si siede da solo quando arriva un passante. I passanti diventano una routine normale, non un'occasione per saltare." },
        ],
        frequency: ["A ogni incontro in passeggiata", "Automatizzare nell'arco di 4-6 settimane"],
        watchFor: ["Istruire i passanti con rispetto", "Quando salta aumenta la distanza"],
        gos: ["SEDUTO prima di ogni incontro", "Una ricompensa di valore a portata di mano"],
        noGos: ["Permettere ai passanti di interagire con {dogName}", "Rimproverare quando salta"],
      },
      {
        title: "Esercizio di autocalma",
        intro: "I cani che saltano sono spesso caricati in generale. Costruiamo la capacita di calmarsi.",
        steps: [
          { name: "Stabilire il tappetino della calma", desc: "Un tappetino in un posto tranquillo, che {dogName} conosce. E riservato alle fasi di calma, non al gioco." },
          { name: "Prima dell'eccitazione prevista", desc: "Prima che arrivino ospiti, prima di uscire, prima che succeda qualcosa di eccitante: porta {dogName} per 10 min sul tappetino. Siediti accanto, respira con calma, dai ogni 60 sec un premietto morbido per lo stare sdraiato tranquillo." },
          { name: "Riconosci l'eccitazione come fattore scatenante", desc: "L'agitazione prima degli incontri compare spesso gia PRIMA del vero salto. {dogName} inizia prima a diventare nervoso. Proprio allora e importante l'esercizio della calma." },
          { name: "MERAVIGLIA come marcatore", desc: "Collega una parola come MERAVIGLIA ai momenti di calma. Quando {dogName} sta sdraiato tranquillo: di sottovoce MERAVIGLIA, un premietto morbido. Nell'arco di settimane la parola diventa un'ancora contro il saltare." },
          { name: "Sfogare la tensione dopo gli incontri", desc: "Dopo incontri intensi: 5-10 min di distensione sul tappetino. {dogName} impara che dopo l'eccitazione segue la calma, e non un'altra attivita." },
          { name: "Nell'arco di settimane si abbassa il livello della giornata", desc: "Dopo 4-6 settimane di lavoro coerente sulla calma il livello generale di eccitazione di {dogName} durante la giornata e piu basso. Il comportamento contro il saltare parte da una base piu tranquilla." },
        ],
        frequency: ["Pianifica esercizi di calma quotidiani", "Prima e dopo gli incontri"],
        watchFor: ["La calma richiede allenamento come tutto il resto", "Usa il marcatore MERAVIGLIA con parsimonia"],
        gos: ["Curare il tappetino della calma", "Distensioni quotidiane"],
        noGos: ["Dopo l'eccitazione riattivare subito", "Usare il marcatore in modo eccessivo"],
      },
      {
        title: "Bambini e persone timorose",
        intro: "Con i bambini o le persone insicure il saltare e particolarmente delicato.",
        steps: [
          { name: "Individua le persone esposte al salto", desc: "Bambini, persone anziane, persone timorose, persone in abito da lavoro. Con loro il saltare e particolarmente inopportuno e puo causare un danno." },
          { name: "Subito SEDUTO + flusso di premietti", desc: "Quando una persona a rischio e nel campo visivo: SEDUTO, premietti di valore ogni 3-5 sec per {dogName}. Massimo coinvolgimento con te, minima disponibilita a saltare." },
          { name: "Mantieni la distanza", desc: "Con queste persone: mantieni 3-5m di distanza. Nessuno deve essere salutato. Se non sei sicuro: aggira semplicemente con un arco, nessun dramma." },
          { name: "All'avvicinamento: evita", desc: "Quando qualcuno ti si avvicina con l'intenzione di accarezzare: di in modo cortese ma fermo „Per favore no, sta proprio allenandosi”. La maggior parte delle persone capisce." },
          { name: "Con i bambini: chiedi prima", desc: "Quando un bambino vuole accarezzare {dogName}: prima stabilisci SEDUTO, poi chiedi ai genitori, poi solo una carezza tranquilla. Nessun gioco selvaggio, nessun entusiasmo." },
          { name: "Abbi un piano per il caso peggiore", desc: "Se {dogName} nonostante tutto salta addosso a qualcuno: scusati con calma, allontana {dogName}, non scoppiare in una tirata. Dopo la situazione: una breve pausa, poi prosegui il normale allenamento." },
        ],
        frequency: ["Agli incontri a rischio sempre", "Mantenere la distanza in modo consapevole"],
        watchFor: ["Chiedere ai genitori con i bambini", "Comunicare in anticipo"],
        gos: ["La distanza come protezione", "Comunicare in modo cortese ma chiaro"],
        noGos: ["Permettere ai bambini di accarezzare cani insicuri", "Per gentilezza „far passare” il saltare"],
      },
      {
        title: "Stabilire una routine di mantenimento",
        intro: "Quando il saltare sparisce: rinfresca con regolarita, altrimenti torna.",
        steps: [
          { name: "Mantieni la routine nel quotidiano", desc: "Anche quando {dogName} da mesi non salta piu: mantieni con coerenza la ricompensa per le 4 zampe nel quotidiano. Altrimenti il comportamento erode lentamente." },
          { name: "Riunioni della famiglia ogni 2-3 mesi", desc: "Ricorda con regolarita alla famiglia: nessuna scorciatoia verso il vecchio comportamento. Istruisci anche i membri anziani della famiglia che ogni tanto vengono in visita." },
          { name: "Con i nuovi membri della famiglia", desc: "Un nuovo partner, un coinquilino, i bambini: coinvolgili subito nell'allenamento contro il saltare. Altrimenti il saltare torna a causa loro." },
          { name: "Esercizi di rinfresco 1 volta al mese", desc: "1 volta al mese una sessione consapevole di SEDUTO-al-saluto con un membro della famiglia. 5 min, una ricompensa di valore. Questo mantiene fresco il collegamento." },
          { name: "Alla ricaduta: 1 settimana extra-coerente", desc: "Quando {dogName} salta di nuovo: conduci 1 settimana in modo extra-coerente. Non accettare mai „va be', e semplicemente successo”. Coerenza significa: ogni volta." },
          { name: "Inserisci dei test di stress", desc: "Ogni 4-6 settimane test di stress consapevoli: una visita di piu generazioni, bambini, un ospite eccitante. Se {dogName} sotto stress resta tranquillo: la routine e davvero consolidata." },
        ],
        frequency: ["Mantenimento per tutta la vita", "Test di stress ogni 4-6 settimane"],
        watchFor: ["Non spuntare mai come „risolto”", "Coinvolgere subito i nuovi membri della famiglia"],
        gos: ["Coerenza nel quotidiano", "Esercizi di rinfresco regolari"],
        noGos: ["Quando non salta, saltare la ricompensa", "Evitare i test di stress per comodita"],
      },
    ],
    abschluss: {
      title: "Conclusione",
      subtitle: "In bocca al lupo",
      paras: [
        "Saltare e un comportamento appreso, e allo stesso modo si puo imparare che non succede piu. {dogName} ha bisogno di regole chiare e di un'alternativa migliore (SEDUTO), poi riorganizzera da solo questo comportamento.",
        "La coerenza della famiglia e il pilastro piu importante. Un cane che dalla mamma non puo saltare, ma dal papa si, sara disorientato e non sviluppera la routine. Tutti partecipano, altrimenti sara difficile.",
        "Gli ospiti sono la vera prova. Istruiscili in anticipo, appendi un biglietto alla porta, sii cortese ma fermo. La maggior parte delle persone lo capisce e rispetta la regola.",
        "Mantieni la routine anche dopo il successo, per tutta la vita. Il saltare e a una sola incoerenza dal ritorno. Con la ricompensa quotidiana per le 4 zampe e test di stress regolari il comportamento resta stabile.",
      ],
    },
  },

  destructive: {
    coverTitle: "Piano anti-distruzione per",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Perche questo piano e costruito proprio cosi",
      subtitle: "Alternative migliori al posto dei divieti",
      paras: [
        "{dogName} distrugge le cose: scarpe, cuscini, bordi dei mobili, cavi della televisione. Non e un “comportamento fatto per dispetto”, ma ha quasi sempre una causa precisa: noia, bisogno di masticare, ansia da separazione o energia non sfogata.",
        "Riconoscere la causa e il 50% della soluzione. I cani giovani nel periodo del cambio dei denti hanno bisogno di masticare. I cani poco impegnati si annoiano. I cani stressati mettono in atto comportamenti anti-stress.",
        "Con {dogName} non lavoriamo con la punizione (arriva troppo tardi e distrugge la fiducia), ma con la gestione, le alternative e un impegno sufficiente.",
        "Questo piano si costruisce in modo sistematico: analisi delle cause, definizione di oggetti da masticare consentiti, gestione durante le assenze, aumento dell'impegno mentale. Con pazienza, senza conflitto.",
      ],
    },
    how: {
      title: "Come svolgere correttamente gli esercizi",
      paras: [
        "Comincia dall'analisi delle cause, prima di passare all'azione. Cosa, quando, come? Solo allora sai dove agire.",
        "Fai ruotare gli oggetti da masticare. 4-5 diversi masticativi naturali, varianti di Kong, tappetini olfattivi. Non tutti insieme: la rotazione mantiene alta l'attrattiva.",
        "La gestione non e una resa, ma buon senso. Finche l'addestramento e ancora in costruzione, le scarpe finiscono nell'armadio, i cavi nella canalina, le zone a rischio vengono protette.",
        "Non rimproverare mai a fatto compiuto. Se dopo ore trovi un oggetto distrutto, {dogName} non riesce a collegarlo al gesto. Il rimprovero crea solo stress, che paradossalmente rinforza la distruzione.",
      ],
    },
    exercises: [
      {
        title: "Svolgere l'analisi delle cause",
        intro: "Perche {dogName} distrugge? Solo quando e chiaro puoi aiutarlo in modo mirato.",
        steps: [
          { name: "Cosa viene distrutto?", desc: "Scarpe + oggetti personali: spesso legati all'odore (tema del legame). Mobili + tappeti: bisogno di masticare. Porte + telai delle finestre: spesso ansia da separazione." },
          { name: "Quando viene distrutto?", desc: "Solo durante la tua assenza: sospetto di ansia da separazione. Anche quando sei presente: noia o bisogno di masticare. Di notte: eventualmente stress legato al luogo del riposo o masticazione dopo il risveglio." },
          { name: "Considera eta e razza", desc: "I cani giovani (4-9 mesi) sono nel periodo del cambio dei denti: il bisogno di masticare e normale. Alcune razze (terrier, cani da pastore) hanno un impulso a masticare piu forte." },
          { name: "Bilancio dell'impegno", desc: "Quante ore di movimento al giorno? Quanto lavoro mentale (gioco di ricerca, trucchetti)? Quanto sonno? Un cane poco impegnato distrugge, perche l'energia deve uscire." },
          { name: "Documenta per una settimana", desc: "Diario per 7 giorni: cosa e stato distrutto, quando, cosa e successo prima. Di solito gli schemi diventano rapidamente visibili." },
          { name: "Scegli una priorita", desc: "In base all'analisi: contro l'ansia da separazione, contro la noia o gestione del bisogno di masticare. Per cane spesso 1-2 cause principali, che affrontiamo in parallelo." },
        ],
        frequency: ["7 giorni di documentazione", "Valutazione settimanale"],
        watchFor: ["Piu cause spesso si combinano", "Onesta nel bilancio dell'impegno"],
        gos: ["Tenere il diario con costanza", "Cercare gli schemi"],
        noGos: ["Presumere che sia “per dispetto”", "“Allenare e basta” senza analisi"],
      },
      {
        title: "Definire oggetti da masticare consentiti",
        intro: "Soddisfare il bisogno di masticare con un assortimento chiaro invece di vietarlo.",
        steps: [
          { name: "Procurati 5-6 masticativi diversi", desc: "Masticativi naturali (pelle di bufalo, nervi di bue), Kong Classic, tappetino olfattivo, osso di legno naturale, corno di cervo, radici da masticare. La varieta mantiene l'attrattiva." },
          { name: "Costruisci un sistema di rotazione", desc: "Ogni giorno 1-2 oggetti disponibili, gli altri riponili. Dopo 2-3 giorni rotazione. Cosi tutti gli oggetti restano interessanti, niente stanca." },
          { name: "Consenti lunghe sessioni di masticazione", desc: "15-30 min di sessione di masticazione al giorno. Questo tempo di azione e fondamentale: piu breve = nessun effetto sul bisogno di masticare. {dogName} deve davvero far lavorare le mascelle." },
          { name: "Oggetto vietato: scambio invece di rimprovero", desc: "Se sorprendi {dogName} con una scarpa: mostragli con calma un premietto per lo scambio, di' LASCIA, alla consegna BRAVO + proponi un masticativo consentito. Non rimproverare mai ne strattonare." },
          { name: "Mai ossa di pelle grezza", desc: "Le ossa di pelle grezza rischiano lesioni e soffocamento. Attieniti ai masticativi naturali del negozio specializzato. Il corno di cervo va bene, ma puo rompere i denti: attenzione." },
          { name: "Nel giro di settimane il bisogno cala", desc: "Dopo 4-6 settimane con un assortimento attivo di masticativi, la distruzione di altri oggetti diminuisce in modo misurabile. Il bisogno e soddisfatto, fine della frustrazione." },
        ],
        frequency: ["Sessioni di masticazione quotidiane", "Rotazione ogni 2-3 giorni"],
        watchFor: ["Mai pelle grezza", "La qualita conta piu della quantita"],
        gos: ["Curare la rotazione", "Consentire lunghe sessioni"],
        noGos: ["Ossa di pelle grezza", "Rimproverare per l'oggetto vietato"],
      },
      {
        title: "Allestire zone di gestione",
        intro: "Quando e senza sorveglianza: area sicura, nessuna possibilita di distruzione.",
        steps: [
          { name: "Identifica le zone a rischio", desc: "Corridoio con le scarpe, salotto con il cavo della televisione, ufficio con la carta. Sono critiche, qui si arriva spesso alla distruzione." },
          { name: "Definisci una zona sicura", desc: "Cucina con cancelletto di sicurezza, una stanza, un box. Qui non c'e nulla da distruggere. {dogName} riceve i suoi masticativi consentiti e l'acqua." },
          { name: "Costruisci il box come zona positiva", desc: "Se usi un box: condizionalo in modo positivo. Lascia la porta aperta, metti dentro il Kong preferito, {dogName} puo entrare/uscire. Mai come punizione." },
          { name: "Durante l'assenza: zona sicura", desc: "Quando esci: {dogName} nella zona sicura, con un masticativo o un Kong. Nessuna tentazione a distruggere, nessun trauma da rimprovero a fatto compiuto." },
          { name: "Limita anche in tua presenza", desc: "Quando fai la doccia o cucini e non puoi guardare ovunque: {dogName} nella zona sicura. Meglio una porta chiusa che un cane libero nella zona a rischio." },
          { name: "Nel giro di settimane amplia le zone", desc: "Quando {dogName} per 2-3 settimane non distrugge: amplia con cautela le zone. Distrugge di nuovo? Torna a una zona piu piccola." },
        ],
        frequency: ["Routine fissa", "Applicare a ogni assenza"],
        watchFor: ["Mai come punizione", "Condizionare in modo positivo"],
        gos: ["Rendere accogliente la zona sicura", "Porta chiusa nelle fasi a rischio"],
        noGos: ["Box come luogo di punizione", "Rendere disponibile tutta la casa senza sorveglianza"],
      },
      {
        title: "Raddoppiare l'impegno mentale",
        intro: "Testa di cane stanca = zampe tranquille. L'impegno e il pilastro piu importante.",
        steps: [
          { name: "Prepara un piano di impegno", desc: "Ogni giorno: 1 passeggiata (30-60 min con cambi di ritmo), 1 lavoro olfattivo (gioco di ricerca, pista), 1 lavoro mentale (trucchetto, Kong). Piu 2-3 volte a settimana contatto sociale." },
          { name: "Gioco di ricerca al posto della ciotola", desc: "Crocchette non dalla ciotola, ma sparse per casa o nel tappetino olfattivo. 20-30 min di lavoro olfattivo invece di 30 sec di ingurgito." },
          { name: "Kong come sostituto del pasto", desc: "1 pasto al giorno dal Kong (cibo umido, congelato). {dogName} lavora 30-60 min concentrato, poi e stanco." },
          { name: "Trucchetti in shaping per il lavoro mentale", desc: "5-7 min di sessione di shaping al giorno: imparare un nuovo trucchetto (zampa, giro, tocco). Impegnativo a livello mentale, stanca." },
          { name: "Pista all'aperto", desc: "1-2 volte a settimana: pista di 15-20m con premietti su un prato tranquillo. {dogName} segue annusando. Una pista di 15 minuti stanca piu di 30 min di camminata insulsa." },
          { name: "La stanchezza serale come indicatore", desc: "Quando {dogName} la sera e chiaramente stanco e riposa volentieri, l'impegno e adeguato. Quando continua ad agitarsi, serve piu lavoro mentale." },
        ],
        frequency: ["Routine di impegno quotidiana", "Per ogni pilastro (movimento/olfatto/testa) ogni giorno qualcosa"],
        watchFor: ["Qualita > quantita", "Il lavoro mentale spesso sottovalutato"],
        gos: ["Mix dei 3 pilastri", "Pasti come impegno"],
        noGos: ["Solo camminata insulsa", "Trattare l'impegno come “facoltativo”"],
      },
      {
        title: "Baratto invece di punizione",
        intro: "Quando {dogName} viene sorpreso con un oggetto vietato: scambio tranquillo, nessun dramma.",
        steps: [
          { name: "Non rincorrerlo", desc: "Quando {dogName} ha una scarpa: MAI rincorrerlo. Per lui e un piacere di gioco e rinforza molto il raccogliere le cose." },
          { name: "Avvicinati con calma, mostra lo scambio", desc: "Prendi un premietto di valore per lo scambio (pollo, formaggio), avvicinati con calma a {dogName}, di lato, non di fronte." },
          { name: "Di' LASCIA, aspetta", desc: "LASCIA con voce calma, il premietto visibile vicino al suo naso. Aspetta 2-3 sec. {dogName} valuta: scarpa o premietto?" },
          { name: "Alla consegna: BRAVO + scambio", desc: "Appena {dogName} lascia: BRAVO, premietto, poi proponi un masticativo CONSENTITO. La scarpa la togli in silenzio, senza dramma." },
          { name: "Non strattonare mai", desc: "MAI la mano verso la bocca, mai strattonare. Questo avvelena il segnale LASCIA per tutta la vita e puo portare alla difesa delle risorse." },
          { name: "Non rimproverare mai a fatto compiuto", desc: "Se dopo ore trovi un oggetto distrutto: NON rimproverare, NON premere il naso. {dogName} non riesce a collegarlo. Crei solo stress." },
        ],
        frequency: ["A ogni incidente sorpreso", "Stabilire una routine"],
        watchFor: ["Avere a portata di mano una ricompensa di valore", "Mantenere la propria calma"],
        gos: ["Scambiare con calma", "Proporre un masticativo consentito"],
        noGos: ["Rincorrerlo", "Rimproverare a fatto compiuto"],
      },
      {
        title: "Preparare il tempo da soli con il Kong",
        intro: "Quando la causa e l'ansia da separazione: il Kong rende sopportabile il tempo da soli.",
        steps: [
          { name: "Prepara un Kong speciale", desc: "Riempi il Kong con cibo umido, pezzetti di pollo, formaggio. Congela per 4-6 ore. Questo Kong esiste SOLO durante la tua assenza." },
          { name: "Rituale di consegna", desc: "Poco prima di uscire: dai il Kong in un posto fisso (tappetino, box). {dogName} deve lanciarsi sul Kong, non sul tuo saluto." },
          { name: "Esci con noncuranza", desc: "Nessun dramma all'uscita. Apri la porta, esci, chiudi la porta. Al massimo 5 sec tra la consegna del Kong e la porta chiusa." },
          { name: "Controlla con un video", desc: "Imposta la fotocamera dello smartphone. Verifica ogni 5-10 min: {dogName} lavora al Kong? Poi riposa? Distrugge comunque?" },
          { name: "Se distrugge nonostante il Kong: altra causa", desc: "Quando {dogName} ignora il Kong e invece distrugge: probabilmente ansia da separazione troppo alta. Allora passa al percorso contro l'ansia, tempi da soli piu brevi." },
          { name: "Togli il Kong al ritorno", desc: "Quando torni: togli con calma il Kong, anche se c'e ancora del contenuto. Il Kong e uno strumento esclusivamente per il tempo da soli, non per il tempo insieme." },
        ],
        frequency: ["A ogni assenza pianificata", "Congelare una scorta di Kong"],
        watchFor: ["Il controllo video come verita", "In caso di stress verificare un'altra causa"],
        gos: ["Kong solo per il tempo da soli", "Uscire e rientrare con noncuranza"],
        noGos: ["Dramma all'uscita", "In caso di stress restare piu a lungo"],
      },
      {
        title: "Costruire lunghe fasi di riposo",
        intro: "I cani che distruggono hanno spesso bisogno di piu allenamento alla calma, non di piu azione.",
        steps: [
          { name: "Definire il tappetino della calma", desc: "Tappetino in un luogo tranquillo, NON di passaggio. Qui si allena la calma, non il gioco." },
          { name: "Routine quotidiana del tappetino", desc: "Ogni giorno 2-3 volte: 10-15 min di tempo sul tappetino. {dogName} sta sul tappetino, tu sei accanto o lavori nelle vicinanze. Ogni 1-2 min un premietto morbido per lo stare tranquillo." },
          { name: "Kong durante il tempo sul tappetino", desc: "Combina con l'impegno del Kong: metti il Kong, {dogName} ci lavora tranquillo 30-60 min. Poi spesso si addormenta subito." },
          { name: "Cura l'igiene del sonno", desc: "I cani adulti hanno bisogno di 16-20h di riposo al giorno. Quando {dogName} dorme meno, diventa irrequieto e cerca un'occupazione, a volte distruggendo." },
          { name: "Calma prima del tempo da soli", desc: "10-15 min di fase di calma sul tappetino PRIMA di ogni assenza pianificata. Cane stanco + cane rilassato = minor rischio di distruzione." },
          { name: "Nel giro di settimane {dogName} cerca il tappetino", desc: "Dopo 3-4 settimane {dogName} va volentieri sul tappetino quando cerca la calma. Il tappetino diventa una zona sicura, non un luogo di costrizione." },
        ],
        frequency: ["Tempi quotidiani sul tappetino", "Prima di ogni tempo da soli una fase di calma"],
        watchFor: ["Misurare davvero il sonno", "Mantenere il tappetino positivo"],
        gos: ["Combinare con il Kong", "Calma prima dell'assenza"],
        noGos: ["Tappetino come luogo di punizione", "Sottovalutare le ore di sonno"],
      },
      {
        title: "Gestire le fasi di stress",
        intro: "Quando arrivano fasi particolari: intensifica la routine, riduci il rischio.",
        steps: [
          { name: "Riconosci le fasi di stress", desc: "Trasloco, nuovi membri della famiglia, vacanza, malattia, feste. In queste fasi il rischio di distruzione e piu alto." },
          { name: "Intensifica la gestione in modo proattivo", desc: "Durante le fasi di stress: zone piu strette, piu impegno di masticazione, piu tempo da soli con il Kong. Meglio troppa protezione che troppo poca." },
          { name: "Pianifica piu impegno", desc: "Un cane stressato ha bisogno di piu lavoro olfattivo, piu lavoro mentale. Lunghe passeggiate DA SOLE non bastano: tutti i pilastri dell'impegno vanno serviti." },
          { name: "Mantieni le routine extra-rigorose", desc: "Quando la vita e proprio caotica, una rigorosa routine quotidiana per {dogName} e doppiamente importante. Gli stessi orari per passeggiata, pasto, sonno." },
          { name: "Recupero di 72 ore dopo lo stress", desc: "Dopo un evento stressante: 72 ore di giornate volutamente tranquille. Nessuno stimolo aggiuntivo, nessun nuovo contenuto di addestramento. Gli ormoni dello stress devono calare." },
          { name: "Se la distruzione ricompare verifica la routine", desc: "Quando {dogName} all'improvviso distrugge di nuovo: niente panico. Verifica i fattori di stress, intensifica la gestione, conduci con piu calma. Di solito si normalizza in 1-2 settimane." },
        ],
        frequency: ["A ogni fase di stress", "Prepararsi in modo proattivo"],
        watchFor: ["Lo stress si accumula nei giorni", "La routine come stabilizzatore"],
        gos: ["Intensificare la gestione", "Mantenere rigorose le routine"],
        noGos: ["Condurre la fase di stress come “normale”", "Aumentare i contenuti di addestramento sotto stress"],
      },
    ],
    abschluss: {
      title: "Conclusione",
      subtitle: "In bocca al lupo",
      paras: [
        "La distruzione non e un difetto di carattere. {dogName} reagisce a qualcosa: bisogno di masticare, noia, stress, paura. Quando affronti la causa, il sintomo scompare.",
        "Masticativi consentiti e impegno sono i due pilastri piu importanti. Con un assortimento attivo e un impegno mentale quotidiano, la distruzione quasi non si presenta piu.",
        "La gestione non e una resa. Chi ripone le scarpe, mette in sicurezza i cavi e chiude le zone a rischio, protegge sia l'arredamento sia la fiducia tra voi. La punizione a fatto compiuto e sempre dannosa.",
        "Mantieni l'assortimento anche dopo il successo, per tutta la vita. I cani giovani nel periodo del cambio dei denti sono una fase. Ma il bisogno di masticare resta un bisogno per tutta la vita. Cura la routine, includi l'assortimento di masticativi nel budget mensile.",
      ],
    },
  },

  soiling: {
    coverTitle: "Piano di pulizia in casa per",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Perche questo piano e costruito proprio cosi",
      subtitle: "Routine chiara, approccio tranquillo",
      paras: [
        "{dogName} non e affidabilmente pulito in casa. Nei cuccioli e normale e fa parte della curva di apprendimento. Nei cani adulti e spesso una combinazione di mancanza di routine, stress o causa medica.",
        "Prima cosa importante: nei cani adulti con incidenti improvvisi SEMPRE prima un controllo dal veterinario. Cistite, reni, oscillazioni ormonali possono esserne la causa. Solo quando dal punto di vista medico e tutto chiaro, facciamo l'addestramento comportamentale.",
        "Con {dogName} costruiamo la pulizia in casa attraverso la prevedibilita e la ricompensa. La punizione non funziona e fa danni: i cani non capiscono il nesso e in futuro si nascondono.",
        "Questo piano si basa su 6 pilastri: definire una routine, leggere il bisogno di fare i bisogni, premiare nel posto giusto, gestire gli incidenti, ridurre lo stress, ridurre lentamente la frequenza. Con pazienza, senza pressione.",
      ],
    },
    how: {
      title: "Come svolgere correttamente gli esercizi",
      paras: [
        "Prima il veterinario. Nei cani adulti che diventano improvvisamente non puliti, una causa medica e probabile. Nei cuccioli di solito basta la routine.",
        "La routine e tutto. 5-7 giri in bagno al giorno nei cuccioli, 4-5 nei cani giovani, 3-4 negli adulti. Orari fissi: dopo il risveglio, dopo il pasto, dopo il gioco, dopo il sonno, prima di dormire.",
        "Ricompensa direttamente sul posto e SUBITO. Quando {dogName} fa la pipi all'aperto: SUBITO BRAVO + un premietto di valore, proprio nel luogo dell'evento. Un ritardo di 5+ sec non insegna nulla.",
        "In caso di incidenti: usa un prodotto enzimatico (negozio di animali). Un normale prodotto non elimina del tutto l'odore, {dogName} continua a percepire lo stimolo e fa di nuovo la pipi nello stesso punto.",
      ],
    },
    exercises: [
      {
        title: "Controllo dal veterinario e diario di base",
        intro: "Prima di allenare qualsiasi cosa: chiarisci con certezza le cause.",
        steps: [
          { name: "Fissa una visita dal veterinario", desc: "Nei cani adulti con problemi di pulizia: prima il veterinario. Esame delle urine, esame del sangue nei cani anziani. Spesso si trova una causa curabile (infezione, diabete, ormoni)." },
          { name: "Misura l'assunzione di acqua", desc: "Per una settimana: quanto beve {dogName} al giorno? Segna la ciotola dell'acqua al mattino. Un improvviso bere molto puo indicare reni o diabete." },
          { name: "Diario del bisogno di fare i bisogni", desc: "Annota per 7 giorni: quando {dogName} fa pipi/cacca? Quando avvengono gli incidenti? Quando e all'aperto? Di solito gli schemi diventano rapidamente visibili." },
          { name: "Segna i luoghi degli incidenti", desc: "Annota DOVE in casa avvengono gli incidenti. Sempre lo stesso punto? Possibili residui di odore. Sempre diverso? Piuttosto stress o dimenticanza." },
          { name: "Verifica i fattori di stress", desc: "E cambiato qualcosa? Nuovo coinquilino, trasloco, cambiamento negli orari della giornata, nuovo cane in casa? La non pulizia da stress e frequente." },
          { name: "Bilancio dopo 1 settimana", desc: "Dopo 7 giorni di raccolta dati: e medico (diagnosi del veterinario)? Problema di routine (schema visibile)? Problema di stress (fattore scatenante chiaro)? Da questo deriva la priorita." },
        ],
        frequency: ["7 giorni di documentazione", "Visita dal veterinario in fretta"],
        watchFor: ["Mai allenare il comportamento prima che il veterinario chiarisca", "Documentare con onesta"],
        gos: ["Prima il veterinario", "Raccogliere dati"],
        noGos: ["Rimproverare subito senza diagnosi", "Presumere che sia “solo educazione”"],
      },
      {
        title: "Routine del bagno prevedibile",
        intro: "Orari prevedibili per fare i bisogni riducono enormemente gli incidenti.",
        steps: [
          { name: "Orari fissi per il bagno", desc: "Nei cuccioli 5-7 volte al giorno: dopo il risveglio, dopo il pasto (15-30 min dopo), dopo il gioco, dopo il sonno, prima di dormire e a orari fissi della giornata." },
          { name: "Esci puntuale", desc: "Imposta la sveglia per gli orari del bagno. Orari mancati = maggior rischio di incidente. Meglio 5 min troppo presto che 5 min troppo tardi." },
          { name: "Lo stesso posto all'aperto", desc: "Porta {dogName} in un posto fisso per il bagno: un angolo del giardino, un tratto tranquillo di prato. L'odore di ieri aiuta a fare pipi oggi. Curalo attivamente, non cambiare ogni volta." },
          { name: "Aspetta con pazienza", desc: "Nel posto del bagno: concedi 5-10 min di tempo. Non distrarre, non giocare. Aspetta e basta e lascia a {dogName} la calma per fare i bisogni." },
          { name: "Dopo il successo: ricompensa + passeggiata", desc: "Appena {dogName} fa i bisogni: BRAVO, un premietto di valore, una lode tranquilla. Solo ALLORA comincia la vera passeggiata o il gioco. Il bagno diventa la porta alla ricompensa." },
          { name: "In 2-3 settimane la routine viene assimilata", desc: "Dopo 2-3 settimane con orari coerenti {dogName} si aspetta la routine e fa i bisogni puntuale. Gli incidenti diminuiscono in modo misurabile." },
        ],
        frequency: ["5-7 giri in bagno al giorno", "Tenere orari coerenti"],
        watchFor: ["La puntualita e tutto", "Curare il posto del bagno"],
        gos: ["Sveglia per gli orari del bagno", "Lo stesso posto"],
        noGos: ["Spostare gli orari del bagno", "Rientrare a casa subito dopo la pipi"],
      },
      {
        title: "Imparare a leggere il bisogno di fare i bisogni",
        intro: "Chi riconosce presto quando {dogName} deve, puo uscire in tempo.",
        steps: [
          { name: "Attiva la modalita osservazione", desc: "Quando {dogName} e sveglio e si muove liberamente: osserva con consapevolezza. Quali comportamenti compaiono PRIMA della pipi?" },
          { name: "Tipici segnali scatenanti", desc: "Annusare per terra, girare in tondo, improvvisa irrequietezza, guardare la porta, ritirarsi, allontanarsi da te. Sono tutti segnali che precedono." },
          { name: "Esci subito al segnale", desc: "Appena compare uno di questi segnali: esci SUBITO. Non metterti prima le scarpe con calma. In fretta, in fretta. Meglio uscire inutilmente che un incidente." },
          { name: "In giardino/all'aperto: al posto del bagno", desc: "Quando siete all'aperto: porta con calma al posto fisso del bagno. La aspetta finche {dogName} non fa i bisogni." },
          { name: "Ricompensa sul posto", desc: "Appena c'e successo: BRAVO + maxi-ricompensa proprio sul posto. {dogName} associa: “Quando faccio la pipi all'aperto nel posto giusto, arriva qualcosa di fantastico.”" },
          { name: "Nel giro di settimane diventi piu veloce", desc: "Dopo 3-4 settimane riconosci i segnali che precedono quasi automaticamente. Reagisci nel giro di secondi. Gli incidenti diventano un'eccezione." },
        ],
        frequency: ["Attenzione costante con i cuccioli", "Reagire a ogni segnale scatenante"],
        watchFor: ["La velocita e decisiva", "Meglio uscire inutilmente"],
        gos: ["Reagire subito ai segnali", "Maxi-ricompensa sul posto"],
        noGos: ["Mettersi prima le scarpe, poi andare", "Ignorare i segnali"],
      },
      {
        title: "Ricompensa direttamente nel posto del bagno",
        intro: "Il tempismo e decisivo. La ricompensa deve arrivare proprio sul posto e SUBITO.",
        steps: [
          { name: "Abbi SEMPRE i premietti con te", desc: "A ogni giro in bagno: 3-5 premietti di valore in tasca. Pollo, formaggio, premietti morbidi: qualcosa che {dogName} ama davvero." },
          { name: "Durante la pipi: BRAVO sottovoce", desc: "Appena {dogName} inizia a fare i bisogni: di' sottovoce e con delicatezza BRAVO, mentre fa la pipi. Mai all'inizio, disturba." },
          { name: "Subito dopo aver finito: premietto", desc: "Nell'istante in cui {dogName} finisce: dai SUBITO il premietto proprio sul posto. Non aspettare qualche secondo. Un ritardo di 5+ sec indebolisce nettamente l'associazione." },
          { name: "Lode tranquilla", desc: "Lode con voce bassa e tranquilla. Non esaltata, altrimenti {dogName} si eccita e la volta dopo fara piu fatica a fare i bisogni." },
          { name: "Il tempo di gioco come bonus", desc: "Dopo la ricompensa comincia solo allora il vero tempo di gioco o la passeggiata. Cosi {dogName} impara: bagno = porta a tutto cio che e piacevole." },
          { name: "In 2-3 settimane si consolida", desc: "Con una ricompensa coerente {dogName} impara in 2-3 settimane: “Fare la pipi nel posto giusto conviene.” Cerca attivamente la ricompensa." },
        ],
        frequency: ["A ogni giro in bagno riuscito", "Consolidare per 2-3 settimane"],
        watchFor: ["Il tempismo e tutto", "Usare una ricompensa di valore"],
        gos: ["Premiare SUBITO dopo la pipi", "Premietto di valore"],
        noGos: ["Ricompensa solo a casa", "Crocchette come ricompensa"],
      },
      {
        title: "Gestione tranquilla degli incidenti",
        intro: "Quando nonostante tutto succede un incidente: nessun dramma, ma pura routine.",
        steps: [
          { name: "NIENTE rimprovero, NIENTE premere il naso", desc: "Questi metodi non funzionano e fanno danni. {dogName} non capisce il nesso e in futuro si nasconde. Uno degli errori piu frequenti." },
          { name: "Porta {dogName} un momento fuori dalla stanza", desc: "Quando l'incidente e fresco: porta con calma {dogName} in giardino/in un'altra stanza. Magari arriva ancora qualcosa, allora premialo nel posto del bagno." },
          { name: "Pulisci con un prodotto enzimatico", desc: "Il prodotto enzimatico (negozio di animali) e obbligatorio. Un normale prodotto NON elimina del tutto l'odore per i nasi dei cani. {dogName} continua a percepire lo stimolo e fa di nuovo la pipi." },
          { name: "Tratta il posto a fondo", desc: "Applica con generosita il prodotto enzimatico, lascialo agire (secondo la confezione), poi asciuga fino a pulire. Sui tappeti servono piu applicazioni. Alcuni punti vanno trattati 3-4 volte." },
          { name: "Annota nel diario", desc: "Annota: quando, dove, cosa e successo prima. Magari uno schema (“sempre quando piu di 4h senza passeggiata”). I dati aiutano ad adattare la routine." },
          { name: "Adatta la routine, non rimproverare", desc: "In caso di incidenti frequenti: aumenta la frequenza dei giri in bagno. In caso di incidenti da stress: riduci i fattori di stress. Nei cani giovani: piu spesso all'aperto." },
        ],
        frequency: ["A ogni incidente subito", "Prodotto enzimatico sempre di scorta"],
        watchFor: ["Mai rimproverare ne punire", "Eliminare del tutto l'odore"],
        gos: ["Usare un prodotto enzimatico", "Adattare la routine"],
        noGos: ["Rimproverare o premere il naso", "Usare un prodotto normale"],
      },
      {
        title: "Allenamento della vescica notturna",
        intro: "Quando di notte avvengono incidenti: routine mirata per la camera da letto.",
        steps: [
          { name: "Togliere l'acqua 2h prima del riposo notturno", desc: "Togli la ciotola dell'acqua 2 ore prima di andare a dormire. {dogName} ha cosi la vescica piu vuota per la notte. IMPORTANTE: durante il giorno sempre acqua fresca disponibile." },
          { name: "Ultimo giro in bagno prima di dormire", desc: "Poco prima di andare a dormire: un lungo giro in bagno. Rientra solo quando {dogName} ha davvero fatto i bisogni. Meglio aspettare 20 min che rientrare con la vescica piena." },
          { name: "Posto per dormire vicino a te", desc: "Nei cuccioli: box o cesta in camera da letto, vicino a te. Quando {dogName} di notte si agita, lo senti e puoi uscire." },
          { name: "Ai segnali notturni subito all'aperto", desc: "Quando {dogName} si alza, piagnucola, si muove irrequieto: NON ignorare. Alzati subito ed esci verso il posto del bagno. Anche alle 3 di notte." },
          { name: "Sveglia preventiva nei cuccioli", desc: "Nei cuccioli: nelle prime settimane imposta la sveglia, ad es. alle 3 di notte per un giro in bagno extra. Prevenire invece di reagire all'incidente." },
          { name: "Nel giro di settimane riduci la frequenza", desc: "Dopo 4-6 settimane la capacita della vescica aumenta. Puoi ridurre le sveglie notturne. Nei cani adulti dovrebbe essere possibile tutta la notte senza incidenti." },
        ],
        frequency: ["Routine serale quotidiana", "Nei cuccioli sveglia notturna"],
        watchFor: ["Togliere l'acqua SOLO 2h, mai piu a lungo", "Reagire ai segnali notturni"],
        gos: ["Acqua tolta 2h prima di dormire", "Lungo bagno serale"],
        noGos: ["Ignorare {dogName} di notte quando e in ansia", "Togliere del tutto l'acqua"],
      },
      {
        title: "Ridurre gli incidenti legati allo stress",
        intro: "Alcuni cani fanno i bisogni in casa per stress. La soluzione: affrontare lo stress, non il sintomo.",
        steps: [
          { name: "Identifica i fattori scatenanti dello stress", desc: "Temporale? Persone nuove? Cambiamenti in famiglia? Quando dal punto di vista medico e tutto ok e la routine e a posto, lo stress e spesso la causa." },
          { name: "Riduci i fattori scatenanti dello stress", desc: "In caso di stress da temporale: routine calmante con tappetino e Kong. In caso di stress da visite: meno visite o piu preparazione. In caso di cambiamenti di routine: struttura della giornata extra-rigorosa." },
          { name: "Sotto stress piu giri in bagno", desc: "Nelle fasi stressanti: aumenta la frequenza. Meglio ogni 2h all'aperto che ogni 4h. I cani stressati hanno spesso un controllo della vescica piu debole." },
          { name: "Inserisci routine calmanti", desc: "Lavoro olfattivo, distensione sul tappetino, impegno con il Kong: tutto cio che calma {dogName}. Abbassare il livello generale di stress." },
          { name: "Lavora in parallelo sulla tolleranza allo stress", desc: "Inserisci mini-stressori nella quotidianita, sui quali {dogName} puo imparare: “Lo stress lo so sopportare.” Routine contro l'eccessiva eccitazione (stimoli via, tappetino, marcatore)." },
          { name: "In caso di stress cronico: veterinario", desc: "Quando lo stress non si riesce a ridurre: coinvolgi il veterinario. A volte aiuta un supporto medico a breve termine. Anche qui vale: senza chiarimento medico non sprecare mesi in addestramento comportamentale." },
        ],
        frequency: ["Nelle fasi di stress intensificare subito", "Adattare la frequenza delle routine"],
        watchFor: ["Lo stress si accumula", "In caso di stress cronico cercare aiuto"],
        gos: ["Curare le routine calmanti", "Aumentare la frequenza"],
        noGos: ["Sotto stress piu pressione", "Interpretare la non pulizia da stress come “per dispetto”"],
      },
      {
        title: "Riduzione lenta della frequenza",
        intro: "Quando la pulizia in casa funziona: riduci gradualmente i giri in bagno.",
        steps: [
          { name: "Condizione: 3-4 settimane senza incidenti", desc: "Riduci solo quando 3-4 settimane di fila NESSUN incidente. Se nonostante tutto ne succede uno: rimanda la riduzione." },
          { name: "Prima riduzione: 1 giro in meno", desc: "Invece di 5 solo 4 giri in bagno al giorno. Quale si toglie piu facilmente? Di solito quello tra il pomeriggio e la sera, quando gli altri sono ben consolidati." },
          { name: "Osserva 2 settimane", desc: "Per ogni giro ridotto: 2 settimane di osservazione. Se nessun incidente: riduci ancora. Se incidenti: torna alla frequenza piu alta per 4 settimane." },
          { name: "Nei cuccioli: non troppo in fretta", desc: "I cani giovani hanno bisogno piu a lungo di 5-7 giri. Riduzione solo dai 6-7 mesi. Prima: meglio troppo spesso che troppo di rado." },
          { name: "Norma per gli adulti: 3-4 giri", desc: "I cani adulti sani hanno bisogno a lungo termine di 3-4 giri in bagno al giorno. Mattina, mezzogiorno, sera, prima di dormire. Bastano, quando vescica e digestione sono normali." },
          { name: "Negli anziani: intensificare di nuovo", desc: "Quando {dogName} invecchia (10+): aumenta di nuovo la frequenza. Gli anziani hanno spesso vesciche piu deboli e hanno bisogno di piu routine. L'adattamento e un compito per tutta la vita." },
        ],
        frequency: ["Riduzione a passi di 2 settimane", "Mai in modo affrettato"],
        watchFor: ["Gli anziani hanno bisogno di piu, non di meno", "In caso di incidente tornare subito indietro"],
        gos: ["Ridurre con pazienza", "Adattare con l'invecchiamento"],
        noGos: ["Ridurre troppo in fretta", "Trattare i cuccioli come adulti"],
      },
    ],
    abschluss: {
      title: "Conclusione",
      subtitle: "In bocca al lupo",
      paras: [
        "La pulizia in casa e un contenuto da imparare come tutto il resto, e richiede tempo, pazienza e una routine coerente. {dogName} non e un cane “testardo”, ma non ancora del tutto condizionato. Con la giusta routine diventa un'ovvieta.",
        "Il controllo dal veterinario all'inizio e la regola piu importante. I cani adulti che diventano improvvisamente non puliti hanno spesso una causa medica. Senza chiarimento sprechi mesi in un addestramento sbagliato.",
        "La punizione non funziona e fa danni. {dogName} non capisce il nesso, impara solo la paura di te e in futuro si nasconde. Mai rimproverare, mai premere il naso. Al suo posto: routine, ricompensa, pazienza.",
        "Mantieni la routine anche dopo il successo. La pulizia in casa si puo perdere, quando la routine sparisce. In caso di cambiamenti (trasloco, nuovi membri della famiglia, cane che invecchia) meglio aumentare presto la frequenza.",
      ],
    },
  },
};

// Personalisierungs-Helper: ersetzt {dogName} in beliebigem Text.
// WinAnsi-Safe: pdf-lib (Helvetica + WinAnsi) crasht bei Unicode-Sonderzeichen.
// Pfeile, Bullet-Symbole, Smart-Quotes etc. werden vor dem drawText ersetzt.
function winansiSafe(s) {
  if (typeof s !== "string") return s;
  // Code-Point-basiert, um Encoding-Unfälle bei Sed/Replace-All zu vermeiden.
  // Beispiel: → statt direktem Pfeil-Zeichen.
  return s
    .replace(/[→➔➜⇒]/g, ":") // → ➔ ➜ ⇒
    .replace(/[←⇐]/g, "") // ← ⇐
    .replace(/[↑↓]/g, "") // ↑ ↓
    .replace(/[•●◦▪▫]/g, "-") // • ● ◦ ▪ ▫
    .replace(/[✓✔]/g, "ok") // ✓ ✔
    .replace(/[✗✘×]/g, "x") // ✗ ✘ ×
    .replace(/[‘’‚‛]/g, "'") // ‘ ’ ‚ ‛
    .replace(/[“”‟]/g, '"') // “ ” ‟
    .replace(/—/g, ",") // —
    .replace(/–/g, ",") // –
    .replace(/…/g, "..."); // …
}

function personalize(text, dogName) {
  return winansiSafe(String(text || "").replace(/\{dogName\}/g, dogName));
}

// ========= PDF-Aufbau =========
export async function buildPdf(params = {}) {
  const DOG_NAME  = (params.dogName  ?? process.env.DOG_NAME  ?? "Bruno").trim();
  const DOG_BREED = (params.dogBreed ?? process.env.DOG_BREED ?? "Mischling").trim();
  const moduleKey = (params.moduleKey ?? process.env.MODULE_KEY ?? "pulling").trim();

  const mod = MODULES[moduleKey];
  if (!mod) {
    throw new Error(`moduleKey sconosciuto: "${moduleKey}". Disponibili: ${Object.keys(MODULES).join(", ")}`);
  }

  if (params.verbose !== false) {
    console.log(`Genero il modulo extra "${moduleKey}" per ${DOG_NAME} (${DOG_BREED})…`);
  }

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontReg = await doc.embedFont(readFileSync(ARIMO_REG), { subset: true });
  const fontBold = await doc.embedFont(readFileSync(ARIMO_BOLD), { subset: true });
  const fontItalic = await doc.embedFont(readFileSync(ARIMO_ITALIC), { subset: true });

  // logo.png aus pdf-assets/ (nicht public/): public/*.png ist aus den
  // Function-Bundles ausgeschlossen (250-MB-Limit), pdf-assets/ wird gebundelt.
  const logoBytes = readFileSync(pathJoin(__dirname, "pdf-assets", "logo.png"));
  const logoImage = await doc.embedPng(logoBytes);

  // Cover-Bild optional: wenn fuer das Modul ein eigenes Bild definiert
  // ist UND die Datei existiert, wird es im Medaillon angezeigt.
  // Sonst bleibt das pure typografische Design (Pfote im Medaillon).
  let coverImg = null;
  if (mod.coverImage) {
    try {
      const bytes = readFileSync(PUBLIC(mod.coverImage));
      const ext = mod.coverImage.toLowerCase().split(".").pop();
      coverImg = ext === "jpg" || ext === "jpeg"
        ? await doc.embedJpg(bytes)
        : await doc.embedPng(bytes);
    } catch {
      coverImg = null;
    }
  }

  const MARGIN = 70;
  const CONTENT_W = A4_W - 2 * MARGIN;

  let pageNr = 0;
  function newPage() {
    pageNr += 1;
    const p = doc.addPage([A4_W, A4_H]);
    drawPageBackground(p);
    drawHeaderBanner(p, fontBold, logoImage);
    drawCornerSwooshes(p);
    drawPageNumber(p, pageNr, fontReg);
    return p;
  }

  // ===== SEITE 1 — COVER (typografisch, ohne Bild) =====
  {
    const p = newPage();

    // ── Linke Seite: Titel + Hundename ──
    // Sub-Label klein in Gold-Caps
    const subLabel = "IL TUO MODULO EXTRA";
    p.drawText(subLabel, {
      x: MARGIN, y: A4_H - BANNER_H - 80,
      size: 11, font: fontBold, color: GOLD_DARK,
    });
    // Mini-Strich neben Label
    p.drawRectangle({
      x: MARGIN + fontBold.widthOfTextAtSize(subLabel, 11) + 14,
      y: A4_H - BANNER_H - 76,
      width: 60, height: 1.5, color: GOLD,
    });

    // Haupttitel (kann 2 Zeilen sein)
    let y = A4_H - BANNER_H - 130;
    const titleSize = 36;
    const titleStr = mod.coverTitle;
    const titleLines = wrapText(titleStr, fontBold, titleSize, A4_W - 2 * MARGIN - 20);
    for (const line of titleLines) {
      p.drawText(line, { x: MARGIN, y, size: titleSize, font: fontBold, color: DARK_BROWN });
      y -= titleSize + 4;
    }

    // Hundename — groß, in Italic-Stil
    y -= 28;
    p.drawText(DOG_NAME, {
      x: MARGIN, y, size: 64, font: fontItalic, color: GOLD_DARK,
    });

    // ── Mittlerer Bereich: Quote-Box ──
    y -= 80;
    const quoteW = A4_W - 2 * MARGIN;
    const quoteH = 70;
    drawRoundedRect(p, MARGIN, y - quoteH, quoteW, quoteH, 12, BG_BAR);
    // linke goldene Akzent-Linie
    p.drawRectangle({
      x: MARGIN + 12, y: y - quoteH + 12,
      width: 3, height: quoteH - 24, color: GOLD,
    });
    // Quote-Text
    const quoteText = `Ogni cane merita un percorso adatto a lui.`;
    p.drawText(quoteText, {
      x: MARGIN + 28, y: y - 28,
      size: 14, font: fontItalic, color: DARK_BROWN,
    });
    p.drawText(`Questo lo abbiamo preparato con cura per ${DOG_NAME}.`, {
      x: MARGIN + 28, y: y - 48,
      size: 11.5, font: fontReg, color: TEXT_MEDIUM,
    });

    // ── Premium-Footer: drei aufeinander aufbauende Linien als
    //    typografische Signatur (statt der Pfoten-Spur die zu kinderbuch
    //    wirkte). Vermittelt Wertigkeit + Ruhe.
    const footerY = 90;
    // Hauptlinie: kraeftiger gold-stripe rechts ausgerichtet
    p.drawRectangle({
      x: MARGIN, y: footerY,
      width: 80, height: 2.5, color: GOLD,
    });
    // Kleiner Akzent darunter
    p.drawRectangle({
      x: MARGIN, y: footerY - 10,
      width: 40, height: 1.5, color: GOLD_SOFT,
    });
    // Signatur-Text rechts neben den Linien
    p.drawText("ZAMPA-PLAN", {
      x: MARGIN + 100, y: footerY - 4,
      size: 10.5, font: fontBold, color: GOLD_DARK,
    });
    p.drawText("Modulo di addestramento Premium", {
      x: MARGIN + 100, y: footerY - 18,
      size: 9, font: fontReg, color: TEXT_MEDIUM,
    });
  }

  // ===== SEITE 2 — Warum dieser Plan =====
  {
    const p = newPage();
    let y = A4_H - BANNER_H - 50;
    p.drawText(mod.why.title, { x: MARGIN, y, size: 26, font: fontBold, color: DARK_BROWN });
    y -= 6;
    p.drawRectangle({ x: MARGIN, y: y - 4, width: 220, height: 2, color: GOLD });
    y -= 18;
    p.drawText(mod.why.subtitle, { x: MARGIN, y, size: 12, font: fontBold, color: GOLD_DARK });
    y -= 26;
    for (const para of mod.why.paras) {
      y = drawParagraph(p, personalize(para, DOG_NAME), MARGIN, y, CONTENT_W, fontReg, 12, TEXT_DARK, 17);
      y -= 10;
    }
  }

  // ===== SEITE 3 — So setzt du die Übungen richtig um =====
  {
    const p = newPage();
    let y = drawSectionTitle(p, mod.how.title, MARGIN, A4_H - BANNER_H - 50, fontBold, 26);
    y -= 6;
    for (const para of mod.how.paras) {
      y = drawParagraph(p, personalize(para, DOG_NAME), MARGIN, y, CONTENT_W, fontReg, 12, TEXT_DARK, 17);
      y -= 10;
    }
  }

  // ===== SEITE 4-9 — 6 Übungen =====
  for (let i = 0; i < mod.exercises.length; i++) {
    const ex = mod.exercises[i];
    const p = newPage();

    // Layout: links 60% (Steps), rechts 35% (Sidebar)
    const LEFT_W = A4_W * 0.58 - MARGIN;
    const RIGHT_X = MARGIN + LEFT_W + 30;
    const RIGHT_W = A4_W - RIGHT_X - MARGIN;

    // Übungstitel mit Star (Stern aus 2 ineinandergesetzten Rauten)
    let y = A4_H - BANNER_H - 55;
    const starX = MARGIN;
    const starY = y - 4;
    // Goldener Stern als 4-Punkt-Ornament
    p.drawCircle({ x: starX + 12, y: starY, size: 9, color: rgb(240/255, 195/255, 95/255) });
    p.drawText(`Esercizio ${i + 1}: ${ex.title}`, {
      x: MARGIN + 32, y: y - 12,
      size: 22, font: fontBold, color: DARK_BROWN,
    });
    y -= 38;

    // Intro-Text
    y = drawParagraph(p, personalize(ex.intro, DOG_NAME), MARGIN, y, LEFT_W, fontReg, 11.5, TEXT_DARK, 16);
    y -= 14;

    // "Schritt für Schritt"
    p.drawText("Passo dopo passo", { x: MARGIN, y, size: 14, font: fontBold, color: DARK_BROWN });
    y -= 22;

    // 6 Schritte links
    for (let si = 0; si < ex.steps.length; si++) {
      const step = ex.steps[si];
      // Step-Title bold + Number prefix
      const stepHeader = `${si + 1}. ${step.name}`;
      const headerLines = wrapText(stepHeader, fontBold, 11, LEFT_W);
      for (const hl of headerLines) {
        p.drawText(hl, { x: MARGIN, y, size: 11, font: fontBold, color: DARK_BROWN });
        y -= 14;
      }
      y -= 2;
      // Description regular
      y = drawParagraph(p, personalize(step.desc, DOG_NAME), MARGIN, y, LEFT_W, fontReg, 10.5, TEXT_DARK, 13);
      y -= 8;
    }

    // ── Sidebar rechts ──
    let sy = A4_H - BANNER_H - 95;

    function sidebarBlock(title, items, titleColor = DARK_BROWN) {
      p.drawText(title, { x: RIGHT_X, y: sy, size: 12, font: fontBold, color: titleColor });
      sy -= 18;
      for (const it of items) {
        const dot = "•";
        p.drawText(dot, { x: RIGHT_X, y: sy, size: 10, font: fontBold, color: GOLD });
        const lines = wrapText(it, fontReg, 10, RIGHT_W - 14);
        for (let li = 0; li < lines.length; li++) {
          p.drawText(lines[li], { x: RIGHT_X + 12, y: sy, size: 10, font: fontReg, color: TEXT_DARK });
          sy -= 13;
        }
        sy -= 2;
      }
      sy -= 10;
    }

    sidebarBlock("Quanto spesso e quanto a lungo", ex.frequency || []);
    sidebarBlock("A cosa fare attenzione", ex.watchFor || []);
    sidebarBlock("Consigliato", ex.gos || [], rgb(60/255, 130/255, 70/255));
    sidebarBlock("Sconsigliato", ex.noGos || [], rgb(180/255, 60/255, 50/255));
  }

  // ===== SEITE 10 — Abschluss =====
  {
    const p = newPage();
    let y = A4_H - BANNER_H - 50;
    p.drawText(mod.abschluss.title, { x: MARGIN, y, size: 28, font: fontBold, color: DARK_BROWN });
    y -= 8;
    p.drawRectangle({ x: MARGIN, y: y - 4, width: 140, height: 2, color: GOLD });
    y -= 20;
    p.drawText(mod.abschluss.subtitle, { x: MARGIN, y, size: 12, font: fontBold, color: GOLD_DARK });
    y -= 28;
    for (const para of mod.abschluss.paras) {
      y = drawParagraph(p, personalize(para, DOG_NAME), MARGIN, y, CONTENT_W, fontReg, 12, TEXT_DARK, 17);
      y -= 10;
    }
  }

  // ========= Speichern =========
  const bytes = await doc.save();
  if (params.verbose !== false) {
    console.log(`  Seiten: ${pageNr}`);
  }
  return bytes;
}

// ========= CLI-Wrapper =========
const __isMain = import.meta.url === `file://${process.argv[1]}`;
if (__isMain) {
  buildPdf()
    .then((bytes) => {
      const moduleKey = (process.env.MODULE_KEY || "pulling").trim();
      const outPath = PUBLIC(`zusatzmodul-${moduleKey}-TEST.pdf`);
      writeFileSync(outPath, bytes);
      console.log(`✓ PDF salvato: ${outPath}`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
