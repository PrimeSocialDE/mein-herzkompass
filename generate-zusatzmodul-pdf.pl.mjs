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
  const label = "ŁapaPlan";
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
  const label = `Tydzień ${weekNr}`;
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
    coverTitle: "Plan chodzenia na luźnej smyczy dla",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Dlaczego ten plan jest zbudowany właśnie tak",
      subtitle: "Spokojnie od samego początku",
      paras: [
        "{dogName} ma swoją własną historię, temperament i doświadczenia. Właśnie to czyni go wyjątkowym i tłumaczy, dlaczego chodzenie na smyczy bywa czasem wyzwaniem.",
        "Jego energia i potrzeba ruchu nie są problemem, lecz wskazówką, jak ważna jest dla niego jasna orientacja. Gdy {dogName} ciągnie na smyczy, często pokazuje w ten sposób podekscytowanie, oczekiwanie lub wewnętrzne napięcie.",
        "Problemy ze smyczą powstają często, gdy pies jest szybszy niż człowiek, na zewnątrz i wewnętrznie. Nie brakuje wtedy posłuszeństwa, lecz spokojnego, zrozumiałego prowadzenia na co dzień.",
        "Ten plan ma dać tobie i {dogName} jasną, wykonalną drogę. W centrum jest wasza wzajemna orientacja, a nie kontrola czy przymus.",
      ],
    },
    how: {
      title: "Jak prawidłowo wykonywać ćwiczenia",
      paras: [
        "Ćwiczenia w tym planie budują się krok po kroku jedno na drugim. Zaczynacie od spokojnych podstaw, aby {dogName} mógł nauczyć się orientować na ciebie, zanim zrobi się ciekawiej.",
        "Gdy podstawy są opanowane, dochodzą ćwiczenia, które utrwalają jego uwagę i wprawiają ją w ruch. {dogName} zna już kilka sygnałów, wykorzystujemy je, by dać mu pewność i jasność na smyczy.",
        "Później treści są stopniowo przenoszone do waszej codzienności, na przykład na zwykłych spacerach lub w bardziej ekscytujących sytuacjach. Tak {dogName} uczy się, że to, czego się nauczył, opłaca się nie tylko w domu czy w spokojnym otoczeniu.",
        "Nie musisz robić wszystkiego naraz. Jedno lub dwa dobrze wykonane ćwiczenia na spacer wystarczą i są cenniejsze niż wiele szybkich prób bez spokoju i powtórzeń.",
      ],
    },
    exercises: [
      {
        title: "Spokojny start przy drzwiach",
        intro: "Spokojny start z jasnym prowadzeniem wyznacza cały spacer.",
        steps: [
          { name: "Załóż smycz i chwilę poczekaj", desc: "Załóż smycz i spokojnie stój. Żadnego ruchu do przodu, żadnego ruszania. Chwilę czekaj, aż pies się wyciszy." },
          { name: "Dotknij klamki, nie otwierając", desc: "Dotknij klamki. Jeśli pojawia się nerwowość, skakanie lub napieranie, puść klamkę i chwilę czekaj. Spokój umożliwia kolejny krok, niepokój zatrzymuje przebieg." },
          { name: "Uchyl drzwi na szparę", desc: "Otwórz drzwi tylko odrobinę. Jeśli pies napiera do przodu, zamknij drzwi i czekaj. Jeśli jest spokojnie, otwieraj drzwi dalej." },
          { name: "Pierwszy krok na zewnątrz", desc: "Najpierw sam wyjdź na zewnątrz. Pies idzie za tobą, bez wypychania się. Przy napieraniu cofnij się o krok, przymknij drzwi, chwilę czekaj i spróbuj ponownie." },
          { name: "Na zewnątrz chwilę postój", desc: "Na zewnątrz postój 2 do 5 sekund. Trzymaj luźną smycz. Pozwól chwilę dojść do siebie i świadomie spokojnie ruszyć." },
          { name: "Ruszaj dopiero przy luźnej smyczy", desc: "Ruszaj dopiero przy luźnej smyczy. Ciągnięcie oznacza stop. Luz oznacza pójście dalej." },
        ],
        frequency: ["Wykonuj raz na każdym spacerze", "Zaplanuj 2 do 4 minut na początku", "Lepiej dwie krótkie próby niż jedna długa"],
        watchFor: ["Spokój przed szybkością", "Rozluźniona, stabilna postawa", "Smycz pozostaje luźna"],
        gos: ["Drzwi otwierają się tylko przy spokoju", "Świadomie pozwalaj na małe przerwy", "Spokojnie chwal za orientację"],
        noGos: ["Nie ciągnij ani nie szarp", "Nie krzycz ani nie mów nerwowo", "Nie ustępuj przy napieraniu"],
      },
      {
        title: "Orientacja przy nodze",
        intro: "Orientacja na pozycję osoby prowadzącej.",
        steps: [
          { name: "Ruszaj na luzie", desc: "Zacznij zupełnie normalnie. Smycz jest luźna, tempo spokojne. Chodzi o rozluźniony start, nie o perfekcję." },
          { name: "Wyznacz własną strefę", desc: "Niech pies idzie z boku przy tobie, nie przed tobą. Wyobraź sobie małą strefę przy nodze, w której ruch jest dozwolony. Gdy pies wyraźnie wysuwa się do przodu, następuje stop." },
          { name: "Ciągnięcie zatrzymuje natychmiast", desc: "Gdy tylko na smyczy pojawia się napięcie, spokojnie stój. Żadnego odciągania i żadnych słów. Bezruch to jasna konsekwencja." },
          { name: "Czekaj, aż smycz znów się rozluźni", desc: "Chwilę poczekaj. Często następuje odwrócenie się lub krok w tył. W chwili, gdy smycz się rozluźnia, idziecie dalej." },
          { name: "Ruch jest nagrodą", desc: "Pójście dalej następuje tylko przy luźnej smyczy. Tak powstaje skojarzenie: dopasowanie przynosi postęp." },
          { name: "Powtarzaj i idź normalnie dalej", desc: "Powtarza się to wielokrotnie podczas spaceru. Zachowaj spokój, działaj konsekwentnie i nie rób z tego wielkiej sprawy." },
        ],
        frequency: ["Włączaj na każdym spacerze", "5 do 10 minut na rundę", "Lepiej kilka krótkich sekwencji"],
        watchFor: ["Twoje tempo wyznacza przebieg", "Smycz pozostaje luźna", "Zachowaj spokój, nie dyskutuj"],
        gos: ["Stój nieruchomo przy ciągnięciu", "Idź dalej przy luzie", "Spokojnie potwierdzaj bliskość"],
        noGos: ["Nie ciągnij ani nie szarp", "Nie zagaduj bez przerwy", "Nie przyspieszaj przy ciągnięciu"],
      },
      {
        title: "Zmiana kierunku bez zapowiedzi",
        intro: "Uwaga skupiona na opiekunie zamiast ciągnięcia do przodu.",
        steps: [
          { name: "Idź normalnie i trzymaj luźną smycz", desc: "Idź rozluźniony prosto przed siebie. Pies idzie spokojnie obok, bez ciągłego zagadywania. Ćwiczenie działa tylko przy twoim własnym spokoju." },
          { name: "Zmiana kierunku wprost z codzienności", desc: "Nagle zmień kierunek, nic nie mówiąc. Nie nerwowo, ale wyraźnie. Po prostu odwróć się albo idź w lewo lub w prawo." },
          { name: "Uwaga pojawia się sama", desc: "Pies zauważa, dokąd idzie osoba prowadząca. Podążanie z krótkim opóźnieniem jest zupełnie w porządku." },
          { name: "Żadnych słów, żadnych korekt", desc: "Żadnych tłumaczeń, tylko prowadzenie przez ruch. Przy krótkim zdezorientowaniu spokojnie idź dalej w nowym kierunku." },
          { name: "Przy ciągnięciu znów stop", desc: "Gdy na smyczy pojawia się napięcie, spokojnie stój. Gdy smycz znów jest luźna, idź dalej w wybranym kierunku." },
          { name: "Spokojnie potwierdzaj", desc: "Dobre podążanie można krótko pochwalić lub potwierdzić. Spokojnie i jasno, bez ekscytacji." },
        ],
        frequency: ["2 do 3 zmiany kierunku na spacer", "Stosuj krótko i celowo", "Zaczynaj tylko przy luźnej smyczy"],
        watchFor: ["Żadnych zapowiedzi", "Ruch zamiast słów", "Pozostań spokojny i jasny"],
        gos: ["Skręcaj łagodnie, ale jednoznacznie", "Potwierdzaj luz", "Bądź konsekwentny"],
        noGos: ["Nie ostrzegaj wcześniej", "Nie szarp ani nie targaj", "Nie działaj nerwowo"],
      },
      {
        title: "Zatrzymanie przy ciągnięciu",
        intro: "Luźne chodzenie prowadzi do celu.",
        steps: [
          { name: "Ruszaj jak na zwykłym spacerze", desc: "Zacznij rozluźniony i idź. Ćwiczenie wynika wprost z codzienności." },
          { name: "Rozpoznawaj napięcie wcześnie", desc: "Gdy tylko smycz się napina, reaguj natychmiast. Nie dopiero po kilku krokach, lecz od razu przy pierwszym ciągnięciu." },
          { name: "Natychmiast się zatrzymaj", desc: "Zatrzymaj się całkowicie. Żadnego chodzenia dalej, żadnych słów, żadnego nacisku. Po prostu spokojnie czekaj." },
          { name: "Napięcie rozładowuje się samo", desc: "Często następuje odwrócenie się, cofnięcie lub zmiana pozycji. W chwili, gdy smycz znów jest luźna, wszystko gra." },
          { name: "Pójście dalej jako jasna nagroda", desc: "Gdy smycz jest luźna, idź dalej. Logika jest jednoznaczna: luz oznacza postęp." },
          { name: "Zawsze tak samo", desc: "Za każdym razem działaj identycznie. Tak przebieg staje się jasny, zrozumiały i sprawiedliwy." },
        ],
        frequency: ["Stosuj przy każdym ciągnięciu", "Zatrzymania tylko na kilka sekund", "Wielokrotnie na spacer"],
        watchFor: ["Natychmiast stop przy ciągnięciu", "Czekaj cierpliwie", "Idź dalej tylko przy luzie"],
        gos: ["Spokojnie stój", "Konsekwentnie idź dalej", "Nagradzaj luz"],
        noGos: ["Nie idź dalej mimo ciągnięcia", "Nie ciągnij ani nie przytrzymuj", "Nie krzycz"],
      },
      {
        title: "Spokojne mijanie rozproszeń",
        intro: "Spokojny i uważny, także przy rozproszeniu.",
        steps: [
          { name: "Rozpoznawaj rozproszenie wcześnie", desc: "Przy psie, człowieku lub bodźcu wcześnie zdecyduj, jaki dystans umożliwia spokój." },
          { name: "Wykorzystuj dystans jako narzędzie", desc: "Zrób łuk, zmień stronę ulicy lub zwiększ dystans. Dystans to czysty trening." },
          { name: "Utrzymuj tempo", desc: "Spokojnie idź dalej. Żadnego zatrzymywania się do obserwowania. Przy wpatrywaniu się pozostań w ruchu i twórz dystans." },
          { name: "Ciągnięcie zwiększa dystans", desc: "Nie idź w stronę rozproszenia. Zwiększaj dystans lub lekko odbijaj, aż smycz będzie luźna." },
          { name: "Potwierdzaj spokojne momenty", desc: "Kontakt wzrokowy lub luźną smycz spokojnie chwal lub krótko nagradzaj." },
          { name: "Trzymaj trening krótko", desc: "Kilka udanych sytuacji jest lepszych niż wiele przeciążających. Celem są sukcesy." },
        ],
        frequency: ["1 do 2 rozproszeń na spacer", "Zaczynaj z dużym dystansem", "Powoli wydłużaj czas"],
        watchFor: ["Dystans utrzymuje spokój", "Tempo pozostaje stałe", "Nie pozwalaj na wpatrywanie się"],
        gos: ["Chodź łukami", "Wcześnie twórz dystans", "Nagradzaj orientację"],
        noGos: ["Nie wchodź frontalnie", "Nie zatrzymuj się i nie wpatruj", "Nie koryguj ze stresu"],
      },
      {
        title: "Spokojne zakończenie spaceru",
        intro: "Spokojny powrót po spacerze.",
        steps: [
          { name: "Zwolnij tempo w ostatnich minutach", desc: "Tuż przed domem świadomie zwolnij. Spokojne, jasne zakończenie zamiast nerwowości." },
          { name: "Smycz luźna, mowa ciała spokojna", desc: "Pozostań rozluźniony i trzymaj luźną smycz. Spacer wygasza, a nie nakręca." },
          { name: "Przed drzwiami krótko przystań", desc: "Przed otwarciem chwilę postój. Pozwól dojść do siebie, zamiast wpadać do środka." },
          { name: "Otwieraj drzwi tylko przy spokoju", desc: "Przy napieraniu, skakaniu lub ciągnięciu chwilę czekaj. Drzwi otwierają się dopiero przy spokoju." },
          { name: "Spokojnie wejdź", desc: "Najpierw wejdź sam, niech pies idzie za tobą. Bez pośpiechu, bez ciągnięcia. Spokój wprawia w ruch." },
          { name: "Świadomie zakończ spacer", desc: "W środku zdejmij smycz, spokojnie potwierdź, gotowe. Jasne i rozluźnione zakończenie." },
        ],
        frequency: ["Stosuj na każdym spacerze", "Świadomie wykorzystaj ostatnie minuty", "Bez presji czasu na końcu"],
        watchFor: ["Powoli zwalniaj tempo", "Drzwi tylko przy spokoju", "Smycz pozostaje luźna"],
        gos: ["Spokojne zakończenie", "Pozwalaj na krótkie przerwy", "Pozostań jasny i rozluźniony"],
        noGos: ["Nie działaj nerwowo", "Nie pozwalaj ciągnąć", "Nie przepychaj się przy napieraniu"],
      },
      {
        title: "Zmiana tempa jako narzędzie uwagi",
        intro: "Nieprzewidywalne zmiany tempa zmuszają psa, by orientował się na ciebie.",
        steps: [
          { name: "Utrzymuj normalne tempo", desc: "Zacznij spacer w swoim zwykłym tempie. Smycz jest luźna, {dogName} idzie rozluźniony obok. Najpierw rytm, potem zmiana." },
          { name: "Nagle zwolnij", desc: "Bez zapowiedzi zmniejsz tempo o połowę. Krok po kroku wyraźnie zwalniaj. {dogName} musi się dopasować, inaczej wysunie się do przodu." },
          { name: "Natychmiast nagradzaj dopasowanie", desc: "Przy dopasowaniu tempa przy nodze: DOBRZE, mały smakołyk prosto przy nogawce. To ty nadajesz tempo, a nie zapach przed nosem." },
          { name: "Nagle przyspiesz", desc: "Po kilku wolnych krokach: bez ostrzeżenia przejdź w szybkie tempo, niemal trucht. {dogName} musi znów nadążyć." },
          { name: "Na spacer 6 do 10 zmian", desc: "Rozłóż kilka zmian tempa na cały spacer. Bez schematu, nieprzewidywalnie. Właśnie to jest bodźcem." },
          { name: "Wariant ze zwrotami o 90 stopni", desc: "Zamiast zmiany tempa czasem krótki zwrot o 90 stopni. Ta sama mechanika: {dogName} podąża, DOBRZE + smakołyk przy nodze." },
        ],
        frequency: ["Wplataj na każdym spacerze", "6 do 10 zmian rozłożonych"],
        watchFor: ["Zmiana bez zapowiedzi", "Natychmiast nagradzaj dopasowanie"],
        gos: ["Pozostań nieprzewidywalny", "Nagroda przy szwie nogawki"],
        noGos: ["Mówić wcześniej „teraz uważaj”", "Krzyczeć przy wysuwaniu się"],
      },
      {
        title: "Przerwa na węszenie jako nagroda",
        intro: "Węszenie to potrzeba. Wykorzystujemy je jako nagrodę za luźną smycz.",
        steps: [
          { name: "Rozpoznaj luźną fazę", desc: "Obserwuj {dogName} świadomie na spacerze. Kiedy idzie rozluźniony przy luźnej smyczy? Te chwile to okazje do nagrody." },
          { name: "Udostępnij miejsce do węszenia", desc: "Gdy smycz jest luźna i pojawia się miejsce do węszenia: spokojnie powiedz SZUKAJ i popuść smycz nieco dłużej. {dogName} może świadomie i do woli węszyć." },
          { name: "Od 60 do 90 sekund czasu", desc: "Pozwól {dogName} węszyć minutę lub dłużej, jeśli miejsce jest ciekawe. Węszenie redukuje stres i męczy bardziej niż chodzenie." },
          { name: "Zasygnalizuj jasny koniec", desc: "Zakończ przerwę sygnałem jak DALEJ. Krótko zwab {dogName} smakołykiem z powrotem przy nogę. Luźna smycz: idziemy dalej." },
          { name: "Przy ciągnięciu: brak przerwy", desc: "Gdy {dogName} ciągnie do miejsca węszenia, NIE ma przerwy. Najpierw powrót do luźnej smyczy, potem z twojej inicjatywy pozwolenie. To ty decydujesz." },
          { name: "Na spacer 4 do 6 przerw", desc: "Świadomie rozłóż przerwy na węszenie na cały spacer. To nie przerywnik, lecz cenna część spaceru." },
        ],
        frequency: ["4 do 6 przerw na spacer", "Świadomie rozłóż na całą trasę"],
        watchFor: ["Przerwa na węszenie tylko przy luźnej smyczy", "To ty decydujesz, nie pies"],
        gos: ["Przerwa jako świadoma nagroda", "Daj 60 do 90 sek czasu"],
        noGos: ["Przerwa przy ciągnięciu", "Pozwalać iść wprost do miejsca węszenia"],
      },
    ],
    abschluss: {
      title: "Zakończenie",
      subtitle: "Powodzenia",
      paras: [
        "Chodzenie na smyczy z {dogName} to nie jednorazowy projekt, lecz ciągły proces. Będą dni, gdy idzie lekko, i dni, gdy jest bardziej wyboiście, i jedno i drugie do tego należy.",
        "Ważniejsze niż perfekcja jest to, że robicie postępy razem. Już małe zmiany, jak kilka spokojnych kroków bez ciągnięcia, są znakiem, że {dogName} zaczyna bardziej orientować się na ciebie.",
        "Twoja spokojna, jasna konsekwencja jest przy tym decydująca. Gdy pozostajesz przewidywalny dla {dogName} i wprowadzasz zasady życzliwie, ale niezawodnie, może on lepiej się na ciebie nastawić.",
        "Wykorzystuj ten plan jako ramę, do której wciąż wracasz, powtarzasz ją i dopasowujesz do waszej codzienności. Tak chodzenie na smyczy staje się dla ciebie i {dogName} stopniowo coraz bardziej naturalne i rozluźnione.",
      ],
    },
  },

  energy: {
    coverTitle: "Plan energii i spokoju dla",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Dlaczego ten plan jest zbudowany właśnie tak",
      subtitle: "Spokojnie od samego początku",
      paras: [
        "{dogName} z natury ma dużo energii i czujności. Ten poziom energii nie jest ani dobry, ani zły, to po prostu część jego osobowości i typu.",
        "Wiek, rasa i codzienność wspólnie decydują, jak łatwo pies się wycisza. Do tego dochodzą dotychczasowe doświadczenia, na przykład jak często {dogName} uczył się już zbierać w sobie nawet przy podekscytowaniu.",
        "Gdy pies ma w ciągu dnia mało prawdziwego odpoczynku, wewnętrzne napięcie się kumuluje. U {dogName} może się to objawiać rozdrażnieniem, trudniejszym przywołaniem, silniejszym ciągnięciem na smyczy lub większą niepewnością.",
        "Ten plan kładzie nacisk na strukturę, powtarzalne rutyny i dobrze przygotowane przerwy. Celem nie jest maksymalne zmęczenie {dogName}, lecz znalezienie lepszej równowagi między aktywnością, jasnością i spokojem.",
      ],
    },
    how: {
      title: "Jak prawidłowo wykonywać ćwiczenia",
      paras: [
        "Podstawą jest możliwie jasny rytm dnia dla {dogName}. Powtarzalne rutyny pomagają mu przewidzieć, kiedy jest czas na akcję, a kiedy na odpoczynek.",
        "W bardziej aktywnych fazach {dogName} dostaje celowe zadania i krótkie jednostki, które angażują głowę i ciało. Pomiędzy nimi następują świadome fazy spokoju, w których nie jest zabawiany, lecz może uczyć się wyciszać i odłączać.",
        "Zamiast ciągłego zabawiania chodzi o ćwiczenia, które wzmacniają jego samoregulację, na przykład kontrolowane czekanie, spokojne leżenie na macie lub jasno zbudowane przywołanie z przerwą po nim. Tak {dogName} może krok po kroku uczyć się wracać do spokojniejszego wewnętrznego stanu mimo podekscytowania.",
        "Trening odbywa się w normalnej codzienności, na spacerze, w domu i w krótkich, jasno zaplanowanych sekwencjach. Jeden do dwóch punktów ciężkości dziennie wystarczy, bo dla {dogName} jakość ćwiczenia i następujący po nim odpoczynek są ważniejsze niż liczba akcji.",
      ],
    },
    exercises: [
      {
        title: "Ustal miejsce spokoju, by obniżyć energię",
        intro: "To ćwiczenie tworzy w mieszkaniu stałą strefę, która dla twojego psa nierozerwalnie łączy się z poczuciem fizycznego ciężaru i odprężenia.",
        steps: [
          { name: "Wybierz miejsce ubogie w bodźce", desc: "Wybierz miejsce na legowisko lub matę z dala od zgiełku (spokojny kąt, nie w przedpokoju ani przed drzwiami na taras). Tutaj pies nie powinien niczego pilnować ani obserwować. To jego „stacja ładowania”." },
          { name: "Ogranicz smyczą", desc: "Weź psa w mieszkaniu na smycz. To zapobiega nerwowemu bieganiu tam i z powrotem. Zaprowadź go bez słów i w zwolnionym tempie na jego matę. Twój powolny ruch udziela się jemu." },
          { name: "Czekaj, nie naciskaj", desc: "Stój rozluźniony przy macie i czekaj. Nie wydawaj komendy jak „WARUJ”. Po prostu czekaj, aż psu się znudzi i sam usiądzie lub się położy. Chcemy, żeby sam znalazł spokój, a nie dostał go na rozkaz." },
          { name: "Nagradzaj spokój jedzeniem", desc: "Gdy pies leży: zupełnie spokojnie połóż smakołyk między jego przednie łapy. Nie mów przy tym nic albo tylko bardzo cicho i przeciągle („Braaawo”). Nerwowa pochwała znów by go nakręciła." },
          { name: "Wydłużaj odstępy", desc: "Kolejny kawałek jedzenia dołóż dopiero po kilku sekundach. Pies ma się nauczyć: „Leżenie i czekanie się opłaca”. Sam przy tym głęboko wydychaj. Twoim celem jest obniżenie tętna psa swoim spokojem." },
          { name: "Ustal jasny koniec", desc: "Zanim pies się zaniepokoi, kończysz ćwiczenie sygnałem (np. „WOLNO”). Dopiero teraz może wstać. Tak uczy się: na macie jest przerwa, akcja jest dopiero po pozwoleniu." },
        ],
        frequency: ["Ćwicz 3-5 razy dziennie", "Na początku tylko 2-3 minuty"],
        watchFor: ["Twoja własna energia musi być bardzo spokojna", "Nagradzaj tylko, dopóki głowa jest nisko"],
        gos: ["Powoli odkładaj smakołyk", "Oddychaj głęboko i spokojnie"],
        noGos: ["Zmuszać psa na matę", "Piszczeć wysokim głosem", "Grać w ekscytujące gry na macie"],
      },
      {
        title: "Wyciszanie silnika przez żucie",
        intro: "To ćwiczenie pomaga psu po aktywnej fazie odnaleźć fizyczne i psychiczne odprężenie poprzez monotonną czynność.",
        steps: [
          { name: "Wybierz właściwy moment", desc: "Stosuj to ćwiczenie celowo po fazach wysokiego pobudzenia, czyli zaraz po spacerze, po wizycie gości lub dzikiej zabawie. Chcemy ułatwić przejście od „pełnej mocy” do „snu”." },
          { name: "Użyj odpowiedniego materiału", desc: "Wybierz coś, co zajmie psa na co najmniej 10-15 minut. Wypełniony Kong (do wylizywania) lub twarda skóra wołowa (do żucia) nadają się idealnie. Ciężka praca męczy." },
          { name: "Powiąż z miejscem spokoju", desc: "Zaprowadź psa na jego matę z ćwiczenia 1. Daj mu gryzak tylko tam. Ma się nauczyć: „Na tej macie dzieje się odprężenie, tu nie muszę biegać”." },
          { name: "Zaoferuj współregulację", desc: "Czy pies jest bardzo niespokojny i nerwowo nosi kość dookoła? Usiądź przy nim i przytrzymaj gryzak z jednej strony, podczas gdy on żuje z drugiej. Twój spokój i przytrzymanie pomagają mu wyciszyć się w jednym miejscu." },
          { name: "Obserwuj efekt fizyczny", desc: "Zobaczysz, jak zmienia się oddech. Na początku może żuć nerwowo, potem ruchy szczęki stają się wolniejsze, a powieki cięższe. Żucie działa jak zawór dla nagromadzonej energii." },
          { name: "Pozwól na przejście do snu", desc: "Psy często zasypiają wprost nad żuciem. Gdy pies traci zainteresowanie i przewraca się na bok: cicho zabierz resztkę lub zostaw ją. Pozwól teraz psu spać - cel osiągnięty." },
        ],
        frequency: ["Zaplanuj na stałe 1x dziennie (np. wieczorem)", "Czas trwania: ok. 15 do 30 minut"],
        watchFor: ["Gryzak nie może być za trudny (frustracja), ale też nie za szybko zjedzony (brak efektu)", "Przygotuj wodę (żucie wywołuje pragnienie)"],
        gos: ["Przytrzymaj kość dla psa", "Wypełnione zabawki do wylizywania (lizanie uspokaja jeszcze szybciej)"],
        noGos: ["Drażnić lub przeszkadzać psu podczas żucia", "Zabierać gryzak jako karę"],
      },
      {
        title: "Trenuj włącznik i wyłącznik",
        intro: "To ćwiczenie uczy psa, że nawet w najdzikszej zabawie pozostaje uważny i potrafi się regulować.",
        steps: [
          { name: "Trzymaj zabawkę spokojnie", desc: "Weź zabawkę (np. sznur do przeciągania), którą dobrze kontrolujesz. Trzymaj ją najpierw blisko siebie i spokojnie. Pies ma się nauczyć: zabawka w ręce nie oznacza automatycznie chaosu." },
          { name: "Rozpocznij start", desc: "Daj sygnał startu (np. „AKCJA”) i pobaw się krótko (!) i intensywnie z psem. Przeciąganie, ruch, zabawa. Pozwól energii wzrosnąć przez 10 do 15 sekund." },
          { name: "Nagłe zamrożenie", desc: "Zatrzymaj zabawę gwałtownie. Zamień się w słup soli. Przyciśnij zabawkę mocno do ciała lub zwieś ją luźno, ale nie puszczaj. Nie ruszaj się już ani o milimetr." },
          { name: "Wytrzymaj wyczekiwanie", desc: "Twój pies prawdopodobnie będzie dalej ciągnął, szturchał lub szczekał. Ignoruj to. Nic nie mów. Czekaj na moment, w którym zauważy: „Ups, impreza się skończyła” i na chwilę znieruchomieje albo puści sznur." },
          { name: "Spokój ponownie uruchamia zabawę", desc: "Dokładnie w sekundzie, gdy pies odpuszcza, siada lub patrzy na ciebie pytająco: Bum! Zabawa natychmiast trwa dalej. Twój ruch jest nagrodą za jego zatrzymanie." },
          { name: "Spokojnie zakończ zabawę", desc: "Powtórz przełączanie startu i stopu kilka razy. Ważne: kończ ćwiczenie zawsze w spokojnej fazie. Wymień zabawkę na smakołyk i schowaj ją. Nie kończymy w momencie szczytu." },
        ],
        frequency: ["Wplataj w zabawę 1-2 razy dziennie", "Łącznie tylko kilka minut"],
        watchFor: ["Bądź jasny w mowie ciała: aktywny vs. zamrożony", "Zabawka to twój pilot do jego energii"],
        gos: ["Od razu graj dalej, gdy jest spokojny", "Baw się dobrze"],
        noGos: ["Wrzeszczeć „PUŚĆ” lub „NIE”", "Rozdrażniać psa, aż przestaje być uważny"],
      },
      {
        title: "Wytrzymywanie bodźców ruchu, by pozostać niewzruszonym",
        intro: "To ćwiczenie uczy psa, że nie musi automatycznie podążać za lecącymi lub toczącymi się obiektami, lecz lepszą nagrodę znajduje u ciebie.",
        steps: [
          { name: "Załóż zabezpieczenie", desc: "Weź psa na krótką smycz i poproś go do „SIAD” obok siebie. Upewnij się, że smycz jest tak zamocowana, że nie wystartuje, gdyby jednak spróbował. Potrzebujesz piłki lub zabawki w ręce." },
          { name: "Zacznij od słabego bodźca", desc: "Nie rzucaj piłki. Najpierw tylko upuść ją z ręki lub potocz bardzo powoli metr od siebie. Celem jest, by bodziec był obecny, ale nie maksymalnie ekscytujący." },
          { name: "Przechwyć impuls", desc: "Twój pies prawdopodobnie drgnie lub będzie chciał wstać. Stój spokojnie. Smycz uniemożliwia sukces. Nic nie mów, nie odciągaj, po prostu wytrzymaj." },
          { name: "Nagradzaj decyzję", desc: "Gdy pies zauważy „Nie dam rady tam dojść” i znów siada lub patrzy na ciebie: Bingo! Daj mu natychmiast wartościowy smakołyk prosto z ręki. Uczy się: „Piłka się rusza, ale jedzenie jest u człowieka”." },
          { name: "To ty zarządzasz zdobyczą", desc: "Bardzo ważne: pies nie może iść do piłki jako nagroda. To ty podchodzisz, podnosisz piłkę i chowasz ją. To sygnalizuje: ruch kontrolujesz ty, a nie pies." },
          { name: "Zwiększaj intensywność", desc: "Gdy powolne toczenie działa, podrzuć piłkę lekko lub potocz ją szybciej. Zasada pozostaje: pies siedzi i odbiera nagrodę u ciebie. Tylko spokój prowadzi do sukcesu." },
        ],
        frequency: ["5-10 powtórzeń na jednostkę", "Ćwicz na miękkim podłożu (ogród/łąka)"],
        watchFor: ["Psa ma trzymać smycz, nie twój głos", "Nagradzaj u siebie, nie wysyłaj go do piłki"],
        gos: ["Stój spokojnie przy impulsie", "Nagroda pochodzi od ciebie, nie od piłki"],
        noGos: ["Rzucać piłkę, zanim pies usiądzie", "Krzyczeć, gdy drgnie", "Pozwalać psu gonić za nagrodą"],
      },
      {
        title: "Chodzenie w zwolnionym tempie",
        intro: "To ćwiczenie zmusza psa, by skrajnie skupił się na swoich krokach i drastycznie zwolnił tempo, co automatycznie obniża tętno.",
        steps: [
          { name: "Zwolnij tempo do maksimum", desc: "Zacznij na spokojnym odcinku drogi. Trzymaj smycz krótko, ale luźno. Nie idź teraz normalnie, lecz poruszaj się demonstracyjnie w zwolnionym tempie. Zupełnie świadomie stawiaj stopę za stopą, jakbyś balansował na surowych jajkach." },
          { name: "Działaj krok po kroku", desc: "Zrób krok, wydychaj, zrób następny krok. Twój pies będzie na początku zdezorientowany i prawdopodobnie będzie chciał iść szybciej. Ale skoro ledwo się ruszasz, musi czekać i się dopasować." },
          { name: "Łagodne wyhamowanie", desc: "Gdy pies chce cię wyprzedzić, po prostu zatrzymujesz się w swoim zwolnionym tempie lub blokujesz go łagodnie nogą. Nie działaj nerwowo, nie szarp smyczy. Bądź jak ciężka skała, która porusza się tylko powoli." },
          { name: "Nagradzaj skupienie", desc: "Gdy pies dopasuje się do twojego bardzo powolnego rytmu i może spojrzy na ciebie pytająco („Dlaczego się skradamy?”), chwalisz go cicho i dajesz smakołyk. Ważne: daj go w ruchu, nie zatrzymuj się specjalnie." },
          { name: "Poczuj synchronizację", desc: "Zauważysz, jak pies zaczyna świadomiej stawiać łapy. To skupienie na własnym ciele przerywa tunelowe patrzenie i nerwowe skanowanie otoczenia. Poruszacie się w zgodzie." },
          { name: "Wykorzystaj jako wyciszenie", desc: "Stosuj tę technikę zawsze, gdy pies na zewnątrz jest właśnie nakręcony (np. po spotkaniu z innym psem). Zamiast iść dalej normalnie (co utrzymuje pobudzenie), przełączasz się na 20 metrów w tryb zwolnionego tempa, by go znów uziemić." },
        ],
        frequency: ["Co jakiś czas 20-30 metrów na spacerze", "Jako świadomy hamulec przy podekscytowaniu"],
        watchFor: ["Oddychaj głęboko i słyszalnie - to się udziela", "Twoje kolana pozostają luźne, nie usztywniaj ich"],
        gos: ["Zwalniaj skrajnie (slow motion)", "Obserwuj psa, nie koryguj"],
        noGos: ["Szarpać smyczą", "Denerwować się, bo pies ciągnie", "Mówić (tylko rozprasza)"],
      },
      {
        title: "Zasada ławki w parku",
        intro: "To ćwiczenie trenuje tolerancję na frustrację i umiejętność zwykłego obserwowania bodźców bez konieczności reagowania na nie.",
        steps: [
          { name: "Wybierz punkt obserwacyjny", desc: "Znajdź ławkę w parku lub murek w miejscu, gdzie coś się dzieje (np. w parku lub w pobliżu supermarketu), ale panuje wystarczający dystans. Usiądź. Twój pies pozostaje na smyczy." },
          { name: "Ogranicz promień ruchu", desc: "Skróć smycz na tyle, by pies mógł wygodnie siedzieć lub leżeć, ale nie mógł niespokojnie chodzić tam i z powrotem. Ciągłe krążenie utrzymuje wysoki poziom adrenaliny. Ograniczamy go fizycznie do trybu spokoju." },
          { name: "Wytrzymaj nudę", desc: "Teraz robisz: nic. Czytaj książkę, patrz w telefon lub obserwuj chmury. Ignoruj psa. Na początku będzie skomlał, wiercił się lub czegoś żądał. To normalne rozładowanie frustracji. Pozostań niewzruszony i nie reaguj na to." },
          { name: "Czekaj na punkt przełomu", desc: "Nadejdzie moment, w którym pies się poddaje. Głęboko wydycha, opuszcza głowę lub wreszcie się kładzie. Jego mowa ciała zmienia się z „Chcę stąd iść!” na „No dobra, to poczekamy”." },
          { name: "Potwierdź spokój", desc: "Dokładnie w tym momencie odpuszczenia kładziesz mu spokojnie i bez słów smakołyk między przednie łapy (jak w ćwiczeniu 1). Potwierdź mu, że pogodził się z sytuacją." },
          { name: "Spokojne wyruszenie", desc: "Posiedź jeszcze chwilę. Gdy wyruszacie, to powoli i bez nerwowości. Wyruszenie nie jest nagrodą („Hura, wreszcie akcja!”), lecz po prostu zmianą miejsca." },
        ],
        frequency: ["Planuj celowo 1-2 razy w tygodniu", "5 do 15 minut (aż pies się odpręży)"],
        watchFor: ["Gdy pies szczeka: przeczekaj to. Nie odchodź, dopóki się domaga", "Wybierz miejsce tak, by żadne psy nie musiały przechodzić tuż obok was"],
        gos: ["Przydepnij smycz stopą (miej wolne ręce)", "Weź książkę (sygnalizuje: mam czas)"],
        noGos: ["Zagadywać psa („No dobrze, zaraz idziemy”)", "Wyruszać, gdy pies jeszcze się wierci"],
      },
      {
        title: "CZEKAJ jako hamulec impulsów",
        intro: "Najważniejszy sygnał wewnętrznego spokoju: nauka świadomego czekania.",
        steps: [
          { name: "Zacznij od miski z jedzeniem", desc: "Trzymaj pełną miskę na wysokości bioder, {dogName} stoi przed tobą. Powiedz raz spokojnie CZEKAJ i powoli opuszczaj miskę w stronę podłogi." },
          { name: "Przy rzuceniu się: podnieś", desc: "Gdy {dogName} rzuca się do przodu lub chce podskoczyć, zanim miska jest na podłodze: miska znów w górę, bez słowa. Żadnej dyskusji, po prostu ruch ręki." },
          { name: "Dopiero przy spokoju na podłogę", desc: "Gdy {dogName} pozostaje spokojny, miska może dotknąć podłogi. Każ poczekać 1 do 2 sekund. Dopiero wtedy: słowo zwalniające jak WEŹ SOBIE lub OK." },
          { name: "Zwiększanie co sekundę", desc: "W ciągu tygodnia zwiększaj z 1 sek na 3, 5, potem 10 sekund. Przy skuteczności poniżej 7 na 10 wróć na niższy poziom." },
          { name: "Przenieś na inne sytuacje", desc: "Gdy działa 10 sekund przed jedzeniem: stosuj CZEKAJ także przed drzwiami, przed rzutem zabawki, przed wsiadaniem do auta. Trzy codzienne sytuacje dziennie." },
          { name: "CZEKAJ staje się codziennym odruchem", desc: "Po 3 do 4 tygodniach CZEKAJ staje się niezawodnym narzędziem. Używasz go wszędzie na co dzień, bez zastanowienia. Tolerancja na frustrację rośnie wymiernie." },
        ],
        frequency: ["3 do 4 mini-sytuacji dziennie", "Utrwalaj przez 3 do 4 tygodni"],
        watchFor: ["Nigdy nie przetrzymuj dłużej niż 15 sek", "Zbyt długie czekanie staje się karą"],
        gos: ["Powoli wydłużaj czas czekania", "Zwolnienie należy do ćwiczenia"],
        noGos: ["CZEKAJ bez rozwiązania", "Krzyczeć przy wstawaniu"],
      },
      {
        title: "Antystresowa mata węchowa",
        intro: "Praca węchowa na macie węchowej to medytacyjne narzędzie antystresowe.",
        steps: [
          { name: "Przygotuj matę węchową prawidłowo", desc: "Mata węchowa z gęstymi paskami materiału. Wciśnij suchą karmę lub małe smakołyki w paski, niektóre głębiej, niektóre płycej." },
          { name: "Umieść w spokojnym miejscu", desc: "Połóż matę w stałym, spokojnym miejscu. Nie w przejściu, nie przed kanapą. To strefa koncentracji." },
          { name: "Przekaż spokojnym sygnałem", desc: "Zaprowadź {dogName} spokojnie do maty, powiedz SZUKAJ niskim głosem. Usiądź rozluźniony obok lub odejdź, zależnie od tego, co lepiej mu wychodzi." },
          { name: "Nie przeszkadzaj, nie pomagaj", desc: "{dogName} pracuje samodzielnie. Nie ingeruj, nie wskazuj, nie zagaduj. To byłoby przeszkadzanie. Po prostu bądź spokojnie obok lub obserwuj z daleka." },
          { name: "Obserwuj efekt", desc: "Zobaczysz, jak ciało {dogName} powoli się odpręża: oddech się uspokaja, ogon zwisa luźno, powieki stają się cięższe. Po 15 do 20 min potrzeba jest zaspokojona." },
          { name: "Po węszeniu: spokój", desc: "Gdy {dogName} skończy: sprzątnij matę, żadnej bezpośredniej kolejnej aktywności. Często od razu zasypia. To jest dokładnie w porządku. Cel osiągnięty." },
        ],
        frequency: ["1 do 2 razy dziennie", "15 do 25 min na sesję"],
        watchFor: ["Nie ingeruj ani nie pomagaj", "Pierz matę regularnie"],
        gos: ["Samodzielna praca", "Pozwól na spokój po niej"],
        noGos: ["„Pomagać” przy frustracji", "Od razu potem znów aktywować"],
      },
    ],
    abschluss: {
      title: "Zakończenie",
      subtitle: "Powodzenia",
      paras: [
        "Spokój jest dla {dogName} tak samo treścią do nauki jak SIAD czy WARUJ. Dzięki jasnym sygnałom, powtarzalnym rytuałom i dobrze przygotowanym przerwom może krok po kroku uczyć się lepiej porządkować swoją energię.",
        "Zmiana nie powstaje przez pojedyncze intensywne dni, lecz przez wiele podobnych, łatwych do ogarnięcia powtórzeń. Właśnie u czujnego psa jak {dogName} to normalne, że postępy i cofnięcia się przeplatają.",
        "Jasność w codzienności i niezawodny rytm dają {dogName} poczucie bezpieczeństwa. Gdy wie, co mniej więcej stanie się dalej, łatwiej mu się odprężyć i przyjąć twoje decyzje.",
        "Dalsza praca polega na utrzymywaniu tej struktury w codzienności, obserwowaniu jej i ostrożnym dopasowywaniu. Tak {dogName} może utrwalać nowe nawyki, a wy oboje stopniowo znajdujecie spokojniejszą, dobrze planowalną równowagę między aktywnością a odpoczynkiem.",
      ],
    },
  },

  anxiety: {
    coverTitle: "Plan zostawania samemu dla",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Dlaczego ten plan jest zbudowany właśnie tak",
      subtitle: "Spokojnie od samego początku",
      paras: [
        "{dogName} reaguje wrażliwie na zostawanie samemu. To nie błąd w zachowaniu, lecz wyraz silnej więzi z tobą i jego potrzeby bezpieczeństwa.",
        "Stres separacyjny powstaje najczęściej wtedy, gdy zostawania samemu nie ćwiczono małymi, jasnymi krokami. Pies nie wie, kiedy wrócisz, a jego układ nerwowy bije na alarm.",
        "U {dogName} może się to objawiać szczekaniem, skomleniem, chodzeniem w kółko, ślinieniem lub niszczycielskim zachowaniem. To nie reakcje na złość, lecz prawdziwe sygnały stresu.",
        "Ten plan buduje czas w samotności spokojnie i systematycznie, bez dramatyzowania przy wychodzeniu czy powrocie. Celem jest, by {dogName} nauczył się: „Mój człowiek wychodzi i niezawodnie wraca. Jestem bezpieczny”.",
      ],
    },
    how: {
      title: "Jak prawidłowo wykonywać ćwiczenia",
      paras: [
        "Kolejność jest decydująca: najpierw rozłączyć sygnały poprzedzające, potem sekundy samotności, potem minuty, potem godziny. Kto zbyt szybko zwiększa, tylko na nowo buduje lęk.",
        "Obserwuj {dogName} przez wideo, gdy ćwiczysz. Przeczucie nie wystarczy, bo psy często pokazują stres dopiero po minutach. Ustaw kamerę telefonu w pokoju i podglądaj na żywo.",
        "Nigdy nie reaguj na skomlenie powrotem. Również żadnych dramatycznych pożegnań. Im bardziej banalne czynisz wyjście, tym mniejsze znaczenie ma ono dla {dogName}.",
        "Przy ciężkim lęku separacyjnym potrzebna jest też kontrola u weterynarza. Czasem pomaga krótkotrwałe wsparcie medyczne, by trening behawioralny w ogóle mógł zadziałać.",
      ],
    },
    exercises: [
      {
        title: "Rozłącz sygnały poprzedzające",
        intro: "Zanim wyjdziesz, {dogName} musi nauczyć się, że klucze, buty i kurtka nic nie znaczą.",
        steps: [
          { name: "Zidentyfikuj ciąg wyzwalaczy", desc: "Obserwuj dokładnie 2-3 dni, od którego momentu {dogName} się niepokoi. Typowe wyzwalacze: brzęk kluczy, zakładanie butów, sięganie po kurtkę, dotknięcie klamki. Zanotuj kolejność." },
          { name: "Pokaż każdy wyzwalacz osobno", desc: "Chwyć klucze 10x dziennie, potrzymaj je w ręce, odłóż z powrotem. Nie wychodź. {dogName} patrzy, czeka, potem traci zainteresowanie. Właśnie to jest celem nauki." },
          { name: "Zakładaj buty bez wychodzenia", desc: "Kilka razy dziennie załóż buty, przejdź kilka kroków po mieszkaniu, zdejmij buty z powrotem. Nigdy po założeniu nie otwieraj naprawdę drzwi. Wyzwalacz traci swoje znaczenie." },
          { name: "Zdewaluuj rutynę drzwi", desc: "Dotknij klamki, otwórz drzwi minimalnie, znów zamknij. 5-7 razy z rzędu. Żadnego dramatu, żadnego zagadywania. {dogName} uczy się: „drzwi się otwierają” nie oznacza automatycznie „człowiek wychodzi”." },
          { name: "Mieszaj i rób mimochodem", desc: "Wpleć wyzwalacze w swoją zupełnie normalną codzienność: klucze w ręce podczas rozmowy telefonicznej, kurtka noszona podczas sprzątania. Celem jest, by nic już nie było jasnym sygnałem." },
          { name: "Sprawdź sukces", desc: "Po 7-10 dniach {dogName} nie reaguje już na klucze ani buty. Dopiero wtedy przechodzimy do następnego ćwiczenia. Jeśli jeszcze reaguje, zostań tu dłużej." },
        ],
        frequency: ["10-15 powtórzeń na wyzwalacz dziennie", "Konsekwentnie przez 1-2 tygodnie", "Wplataj mimochodem w codzienność"],
        watchFor: ["Rozpoznawaj subtelne oznaki stresu (dyszenie, przełykanie śliny, szeroko otwarte oczy)", "Nigdy nie zwiększaj radykalnie w jeden dzień"],
        gos: ["Używaj wyzwalaczy bez zwracania uwagi", "Pozostań spokojny i swobodny"],
        noGos: ["Naprawdę wychodzić, gdy {dogName} reaguje", "Używać wyzwalaczy tylko do prawdziwego wyjścia"],
      },
      {
        title: "Buduj fazy sekundowe",
        intro: "Zostawanie samemu trenuje się jak mięsień. Zaczynamy od sekund i powoli zwiększamy.",
        steps: [
          { name: "Zacznij w tym samym pokoju", desc: "{dogName} leży rozluźniony w salonie. Wstajesz, idziesz do drzwi, odwracasz się, wracasz. 5 sekund nieobecności z jego perspektywy. Powtórz 5 razy." },
          { name: "Do sąsiedniego pokoju", desc: "Wyjdź z pokoju, przymknij drzwi do połowy, poczekaj 5 sekund, wróć. Przy powrocie: żadnego witania. Idziesz swobodnie dalej, jakby nic się nie stało." },
          { name: "Zamknij drzwi całkowicie", desc: "Ten sam przebieg, ale teraz naprawdę zamykasz drzwi. {dogName} już cię nie słyszy. 5 sekund, 10, potem znów do środka. Zwiększanie w krokach po 5 sekund." },
          { name: "Rozpoznawaj oznaki stresu", desc: "Obserwuj przy wejściu: czy {dogName} wstał? Skomli? Chodzi w kółko? Przy oznakach stresu natychmiast wróć na ostatni poziom, który się udał." },
          { name: "Zwiększ do 1 minuty", desc: "Po 1 tygodniu powinieneś osiągnąć 60 sekund nieobecności bez tego, by {dogName} się stresował. Gdy to działa stabilnie, przechodzisz do następnego ćwiczenia." },
          { name: "Odejmij dramat z wychodzenia i powrotu", desc: "Nigdy nie wołaj „pa” ani „cześć”. Żadnego radosnego powitania. Wychodzisz, wracasz. Banalnie. Właśnie to usuwa napięcie emocjonalne." },
        ],
        frequency: ["3-5 sesji dziennie", "Przez 1-2 tygodnie zwiększaj sekundy do 1 minuty", "Nigdy 2 poziomy w jeden dzień"],
        watchFor: ["Najpierw bez stresu, potem zwiększaj", "Kontrola wideo pomaga w uczciwej ocenie"],
        gos: ["Swobodnie wychodź, swobodnie wracaj", "Konsekwentnie zwiększaj w krokach po 5-10 sek"],
        noGos: ["Wracać przy skomleniu", "Witać wysokim głosem"],
      },
      {
        title: "Kong na czas w samotności",
        intro: "Ekskluzywna, wartościowa zabawka do zajęcia łączy samotność z czymś pozytywnym.",
        steps: [
          { name: "Przygotuj specjalnego Konga", desc: "Napełnij Konga ulubioną zawartością: mokra karma, kawałki kurczaka, miękki ser. Zamroź go na 4-6 godzin. Ten Kong istnieje TYLKO podczas twojej nieobecności." },
          { name: "Ustal rytuał przekazania", desc: "Tuż przed wyjściem: połóż Konga na macie {dogName}. Nie mów nic. {dogName} ma rzucić się na Konga, nie na ciebie." },
          { name: "Jednocześnie drzwi", desc: "Podczas gdy {dogName} pracuje nad Kongiem, idziesz swobodnie do drzwi. Najpierw 30 sekund poza domem, potem 2 minuty, potem 5. {dogName} jest zajęty, ciebie nie ma, wszystko w porządku." },
          { name: "Zabierz Konga po powrocie", desc: "Gdy tylko wrócisz, spokojnie zabierasz Konga, nawet jeśli jest w nim jeszcze zawartość. Kong jest wyłącznie narzędziem na czas w samotności, nigdy na wspólny czas." },
          { name: "Połącz z poziomami", desc: "Połącz Konga z ćwiczeniami faz sekundowych. Im dłużej {dogName} zostaje przy Kongu bez okazywania stresu, tym dłużej możesz pozostać poza domem." },
          { name: "Wprowadź urozmaicenie", desc: "Gdy Kong się znudzi: mata węchowa jako alternatywa lub naturalny gryzak. Ważne pozostaje: narzędzie jest tylko wtedy, gdy naprawdę wychodzisz." },
        ],
        frequency: ["Przy każdej planowanej nieobecności", "Zamroź Kongi na zapas (3-4 sztuki gotowe)", "Nie przy każdym mini-ćwiczeniu, inaczej traci efekt"],
        watchFor: ["Czy {dogName} w ogóle je z Konga? Jeśli nie, stres jest jeszcze za wysoki", "Wybieraj zawartość według upodobań (zamrożone = dłużej)"],
        gos: ["Najcenniejsza zawartość, jaką {dogName} zna", "Przekazanie bez słów i spokojnie"],
        noGos: ["Podawać Konga jeszcze przed wyjściem", "Używać Konga też przy innych okazjach"],
      },
      {
        title: "Rutyna drzwi bez dramatu",
        intro: "Sposób, w jaki wychodzisz i wracasz, kształtuje emocjonalne skojarzenie z samotnością.",
        steps: [
          { name: "Na 10 minut przed wyjściem się wycisz", desc: "Żadnego podekscytowania, żadnego wpatrywania się, żadnego dodatkowego głaskania. Ty żyjesz swoją codziennością, {dogName} swoją. To obniża jego poziom stresu." },
          { name: "Wychodź bez słów", desc: "Żadnych słów pożegnania, żadnego głaskania przed wyjściem, żadnego „bądź grzeczny”. Po prostu wychodzisz. Dokładnie jak do toalety czy do sypialni." },
          { name: "Kong jako pomost", desc: "Daj Konga na czas w samotności, potem spokojnie do drzwi. Drzwi otwarte, na zewnątrz, drzwi zamknięte. Maksymalnie 5 sekund między przekazaniem Konga a zamkniętymi drzwiami." },
          { name: "Po powrocie ignoruj 2 minuty", desc: "Drzwi otwarte, wejdź, zdejmij buty, zajmij się swobodnie mieszkaniem. Dopiero po 2 minutach spokojne „cześć”. {dogName} musi się najpierw uspokoić, zanim dostanie uwagę." },
          { name: "Powitanie tylko przy spokojnym psie", desc: "Gdy {dogName} podekscytowany skacze: odwróć się, ignoruj. Gdy tylko 4 łapy są spokojnie na podłodze: krótkie, spokojne cześć, jedno pogłaskanie, gotowe." },
          { name: "Trzymaj rutynę konsekwentnie", desc: "Przez tygodnie powroty i wyjścia stają się banalne. {dogName} przestaje przeżywać twoją obecność jako wydarzenie emocjonalne. Staje się ona normalnością." },
        ],
        frequency: ["Przy każdym wyjściu i powrocie", "Konsekwencja także przy krótkich sprawunkach", "Ważna odprawa rodziny"],
        watchFor: ["Także inni członkowie rodziny muszą się przyłączyć", "Jedno emocjonalne powitanie kosztuje tydzień efektu nauki"],
        gos: ["Swobodnie, bez słów, spokojnie", "Po powrocie do domu najpierw żyj dalej"],
        noGos: ["Dramat przy wychodzeniu lub powrocie", "Okazywać wyrzuty sumienia"],
      },
      {
        title: "Buduj fazy godzinowe",
        intro: "Gdy minuty działają, powoli budujesz do godzin. Z kontrolą wideo.",
        steps: [
          { name: "Ustaw kamerę", desc: "Ustaw telefon lub kamerę tak, by widoczne było legowisko {dogName}. Transmisja na żywo na twoje drugie urządzenie, byś mógł w każdej chwili sprawdzić." },
          { name: "30 minut jako pierwszy poziom", desc: "Wyjdź na 30 minut (krótki spacer wokół bloku, zakupy). Sprawdzaj co 5-10 minut przez wideo. Jeśli spokojnie: dociągnij do 30 min. Przy stresie: wróć na 15 min." },
          { name: "Zwiększaj w krokach po 15 min", desc: "Po 1 tygodniu stabilnych 30 min: zwiększ do 45 min. Potem 1 godzina, potem 90 min, potem 2 godziny. Na każdy poziom co najmniej 4-5 dni pewności." },
          { name: "Dokumentuj działanie Konga", desc: "Jak długo {dogName} pracuje nad Kongiem? Jeśli po 10 min przestaje i spokojnie leży: super. Jeśli w ogóle nie dotyka Konga: stres za wysoki, krótszy czas w samotności." },
          { name: "Właściwie odczytuj objawy stresu", desc: "Chodzenie w kółko, dyszenie bez upału, ślinienie, szczekanie, lizanie łap: wszystko to stres. Spanie, spokojne leżenie, praca nad Kongiem: wszystko dobrze. Obserwuj uczciwie." },
          { name: "Przy cofnięciu się wycofaj", desc: "Gdy {dogName} pewnego dnia nagle się stresuje, choć poziom wcześniej działał: wróć na ostatni udany poziom. Zostań tam 1 tydzień, potem spróbuj ponownie." },
        ],
        frequency: ["3-4 prawdziwe ćwiczebne nieobecności tygodniowo", "Zwiększanie przez 6-8 tygodni", "Nigdy nie testuj od razu kilku godzin"],
        watchFor: ["Kontrola wideo jest obowiązkowa, żadnego zgadywania", "Prawdziwa przerwa na siusiu przed długim czasem w samotności"],
        gos: ["Trzymaj poziomy czysto, obserwuj uczciwie", "Dostosuj tempo do {dogName}"],
        noGos: ["Ciągnąć dłużej mimo stresu", "Porywać się od razu na kilka godzin"],
      },
      {
        title: "Przewidywalna rutyna dnia",
        intro: "Psy z lękiem separacyjnym odprężają się ogromnie, gdy dzień staje się przewidywalny.",
        steps: [
          { name: "Ustal stałe pory", desc: "Spacer rano 7:00, śniadanie 7:30, odpoczynek w południe 11:00, popołudniowy spacer 16:00, kolacja 18:00, cisza nocna 22:00. Możliwie konkretnie." },
          { name: "Uwidocznij plan", desc: "Napisz rutynę na lodówce. Członkowie rodziny muszą się jej trzymać. Osoba, która przychodzi i wychodzi o nieoczekiwanych porach, sabotuje rutynę." },
          { name: "Zaplanuj czasy w samotności", desc: "Wbuduj na stałe ćwiczebne czasy w samotności. Np. zawsze po śniadaniu krótka faza samotności, zawsze po południu dłuższa. {dogName} może nauczyć się tego wzorca." },
          { name: "Ruch przed czasem w samotności", desc: "15-20 minut spaceru lub pracy węchowej przed każdą planowaną fazą samotności. Zmęczony pies + przewidywalna struktura = o połowę mniejszy lęk separacyjny." },
          { name: "Trzymaj się w weekend", desc: "Psy nie odróżniają dnia roboczego od niedzieli. Gdy w weekend nagle wszystko jest inaczej, rutyna traci swoje działanie. Konsekwencja pozostaje." },
          { name: "Utrwalaj przez 4 tygodnie", desc: "Po 4 tygodniach konsekwentnej rutyny jest ona zinternalizowana. {dogName} wie, co i kiedy nastąpi, i może przeżywać czasy w samotności bez podwyższonego stresu." },
        ],
        frequency: ["Codziennie, także w weekend", "4-6 tygodni na stabilną internalizację", "Powieś plan w widocznym miejscu"],
        watchFor: ["Konsekwencja rodziny jest obowiązkowa", "Nawet 15 min spóźnienia może zaniepokoić {dogName}"],
        gos: ["Zapisz rutynę w widocznym miejscu", "Planuj świadome przerwy"],
        noGos: ["Wywracać rutynę w niektóre dni", "Spontaniczne plany bez przygotowania"],
      },
      {
        title: "Koc bezpieczeństwa jako przenośna kotwica",
        intro: "Specjalny koc staje się symbolem bezpieczeństwa, który można zabrać wszędzie.",
        steps: [
          { name: "Wybierz koc", desc: "Przytulny, średniej wielkości koc (60x80cm), który {dogName} już zna i lubi. Ten koc otrzymuje odtąd status specjalny." },
          { name: "Buduj pozytywne skojarzenie", desc: "Połóż koc w stałym miejscu spokoju. Powiedz spokojnie „WARUJ”, zaprowadź na niego {dogName}. Nagroda miękkim smakołykiem, spokojne głaskanie. 5-7 razy dziennie." },
          { name: "Używaj tylko do spokoju", desc: "Koc NIGDY nie służy do zabawy, NIGDY do podekscytowania. Gdy {dogName} chce bawić się kocem, zabierz go. Oznacza on wyłącznie odprężenie." },
          { name: "Przenieś na czas w samotności", desc: "Podczas twojej nieobecności: koc leży w stałym miejscu, Kong na nim. {dogName} łączy koc + Kong + spokój. Ta triada staje się kotwicą." },
          { name: "Wprowadź wariant przenośny", desc: "Kup mniejszy, podróżny wariant koca lub taki z twoim zapachem. Może pojechać do teściów, do auta, do weterynarza. Wszędzie: koc = bezpieczeństwo." },
          { name: "Utrzymuj świeży zapach", desc: "Nie pierz koca zbyt często. Twój zapach i zapach spokoju {dogName} czynią go cennym. Co 2-3 tygodnie wystarczy dla higieny." },
        ],
        frequency: ["Używaj koca codziennie", "Wariant przenośny w razie potrzeby", "Pielęgnuj skojarzenie zapachu i spokoju"],
        watchFor: ["Używaj koca tylko przy spokoju", "Nigdy jako środek wychowawczy"],
        gos: ["Pielęgnuj koc jako pozytywną kotwicę", "Świadomie ustal wariant przenośny"],
        noGos: ["Prać koc zbyt często", "Pozwalać bawić się kocem"],
      },
      {
        title: "Uczyń długą nieobecność wykonalną na co dzień",
        intro: "Gdy 2-3 godziny działają, robimy krok w stronę prawdziwej nieobecności w pracy.",
        steps: [
          { name: "Zaplanuj próbę generalną", desc: "Wybierz dzień, w którym jesteś elastyczny. Zaplanuj 4-godzinną nieobecność z prawdziwą przerwą na siusiu przed nią, zamrożonym Kongiem i ustawioną kamerą." },
          { name: "Pierwszą godzinę obserwuj na żywo", desc: "W pierwszej godzinie kontroluj co 5-10 min przez wideo. {dogName} powinien pracować nad Kongiem, potem spokojnie leżeć. Przy stresie: wróć." },
          { name: "Faza środkowa jest krytyczna", desc: "Między 1 a 3 godziną: {dogName} ma Konga za sobą, teraz nadchodzi prawdziwy czas w samotności. Czy śpi? Czy leży spokojnie? Właśnie to jest testem." },
          { name: "Obserwuj ostatnią godzinę", desc: "Niektóre psy pod koniec znów się niepokoją (intuicyjnie wyczuwają czas powrotu). Gdy zaczyna się chodzenie w kółko: zanotuj czas, przy kolejnym ćwiczeniu wróć 30 min wcześniej." },
          { name: "Przy sukcesie zwiększ do 5-6 godzin", desc: "Tydzień stabilnych 4 godzin, potem 5, potem 6. Przy 6 godzinach zaplanuj przerwę na siusiu przez opiekuna psa lub spacer w południe." },
          { name: "Ustal plan awaryjny", desc: "Na dni dłuższe niż 5-6 godzin: opiekun psa, dogwalker, sąsiedzi, rodzina. Nawet pies dobrze zostający sam potrzebuje ruchu i kontaktu społecznego." },
        ],
        frequency: ["1-2 prawdziwe próby generalne tygodniowo", "Buduj przez 4-6 tygodni", "Przygotuj plan awaryjny"],
        watchFor: ["Przy cofnięciu się nie ciągnij dalej", "Przerwa na siusiu obowiązkowa dla każdego psa"],
        gos: ["Plan z czasem buforowym", "Buduj opcje awaryjne"],
        noGos: ["Spontanicznie zostawiać samego na 7-8 godzin", "Ufać przeczuciu zamiast wideo"],
      },
    ],
    abschluss: {
      title: "Zakończenie",
      subtitle: "Powodzenia",
      paras: [
        "Pokonanie lęku separacyjnego to nie sprint, lecz maraton małymi krokami. W {dogName} masz wiernego partnera, gotowego nauczyć się, że twoje wyjście nie oznacza straty.",
        "Najważniejsza zmiana zachodzi przy tym często nie u psa, lecz u ciebie. Gdy wychodzisz i wracasz na luzie, bez dramatu, bez wyrzutów sumienia, {dogName} uczy się, że samotność to po prostu normalna część jego dnia.",
        "Bądź cierpliwy, nawet gdy zdarzają się cofnięcia. Stresujące dni, choroba, przeprowadzki lub inne zmiany mogą na chwilę zachwiać tym, czego się nauczył. To normalne, nie porażka.",
        "Narzędzia w tym planie są trwałe. Nawet gdy {dogName} później spokojnie zostaje sam, możesz wciąż używać Konga, koca i rutyny jako konserwacji, by poczucie bezpieczeństwa pozostało stabilne.",
      ],
    },
  },

  aggression: {
    coverTitle: "Kontrola agresji dla",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Dlaczego ten plan jest zbudowany właśnie tak",
      subtitle: "Bezpiecznie i poniżej progu pobudzenia",
      paras: [
        "{dogName} reaguje w pewnych sytuacjach szczekaniem, warczeniem lub próbami rzucania się. To nie wada charakteru, lecz najczęściej zachowanie obronne: czuje się przeciążony i próbuje stworzyć dystans.",
        "Agresja powstaje niemal zawsze z niepewności, złych doświadczeń lub zbyt wąskiego korytarza bodźców. Pies jest powyżej swojego progu pobudzenia, na którym jeszcze potrafi się uczyć, i już tylko reaguje.",
        "U {dogName} różne wyzwalacze mogą działać razem: inne psy, biegacze, rowerzyści, obcy ludzie. Każdy ma swój własny krytyczny dystans, od którego zaczyna się reakcja.",
        "Ten plan pracuje konsekwentnie PONIŻEJ progu pobudzenia. Nigdy nie stawiamy na konfrontację, lecz na dystans, przewidywalność i pozytywne skojarzenia. To jedyna droga, która działa trwale.",
      ],
    },
    how: {
      title: "Jak prawidłowo wykonywać ćwiczenia",
      paras: [
        "Najpierw bezpieczeństwo. Zanim cokolwiek zaczniesz trenować, potrzebujesz pozytywnie zwarunkowanego kagańca i jasnego rozeznania w dystansie progu pobudzenia {dogName} dla każdego typu wyzwalacza.",
        "Ćwiczenia budują się jedno na drugim: najpierw ustal narzędzia (kaganiec, marker), potem obserwuj próg pobudzenia, potem trenuj poniżej progu, potem stopniowo podchodź bliżej.",
        "NIGDY nie zmniejszysz dystansu, dopóki {dogName} reaguje. Dopiero gdy przez trzy sesje z rzędu pozostaje spokojny na danym dystansie, podchodzisz 2-5m bliżej. Nigdy szybciej.",
        "Gdy jednak coś eskaluje, nie przekreślaj postępu treningu. Jedna eskalacja kosztuje ok. 2 tygodnie postępu w nauce. Planuj drogi ucieczki, unikaj tras wysokiego ryzyka, przestrzegaj zasady 72-godzinnej regeneracji po stresie.",
      ],
    },
    exercises: [
      {
        title: "Pozytywne warunkowanie kagańca",
        intro: "Zanim będziesz potrzebować kagańca, {dogName} musi przeżyć go jako coś pozytywnego.",
        steps: [
          { name: "Wybierz właściwy kaganiec", desc: "Kaganiec koszykowy (Baskerville Ultra lub BUMAS), nie materiałowa pętla na pysk. Pies musi móc dyszeć i pić wodę. Dopasowanie u specjalistycznego sprzedawcy lub trenera psów." },
          { name: "Zostaw kaganiec na widoku", desc: "Dzień 1-3: po prostu połóż kaganiec w pokoju, bez reakcji. {dogName} obwąchuje go, ignoruje, może z ciekawości go bada. Dokładnie w porządku." },
          { name: "Podawaj smakołyk przez kratkę", desc: "Dzień 4-6: trzymaj kaganiec w ręce, wsuń smakołyk przez pręty kratki. {dogName} wsuwa nos do środka, odbiera. Kilka razy dziennie, krótkie sesje." },
          { name: "Pozwól aktywnie wsuwać nos", desc: "Dzień 7-10: {dogName} sam wsuwa pysk do kagańca, bo w środku czekają smakołyki. Jeszcze go trzymasz, od razu znów odsuwasz. Pozytywne skojarzenie jest utrwalone." },
          { name: "Pierwsze czasy noszenia", desc: "Dzień 11-14: zapnij kaganiec na 2-5 sekund, od razu znów zdejmij. Smakołyk przez kratkę. Krok po kroku zwiększaj czas noszenia do 1-2 minut." },
          { name: "Nigdy nie stosuj w sytuacjach stresu", desc: "Dopiero po 14-21 dniach pozytywnego skojarzenia: kaganiec na pierwszy spacer. Na spokojnej trasie bez wyzwalaczy. Nigdy nie zakładaj po raz pierwszy w sytuacji stresu." },
        ],
        frequency: ["Kilka razy dziennie krótkie sesje", "Buduj przez 2-3 tygodnie", "Powoli zwiększaj czas noszenia"],
        watchFor: ["Nigdy nie łącz ze stresem", "Przerwa przy oznakach frustracji"],
        gos: ["Wartościowa nagroda przez kratkę", "Postępuj bardzo cierpliwie"],
        noGos: ["Zakładać kaganiec po raz pierwszy w kryzysie", "Używać materiałowej pętli na pysk"],
      },
      {
        title: "Znajdź i udokumentuj próg pobudzenia",
        intro: "Zanim zaczniesz trenować, musisz wiedzieć, od jakiego dystansu {dogName} jeszcze potrafi się uczyć.",
        steps: [
          { name: "Wybierz miejsce obserwacji", desc: "Wejście do parku, trasa biegowa lub podobne miejsce, gdzie wyzwalacze regularnie przechodzą. Musisz móc bezpiecznie oddalić {dogName}, gdyby zrobiło się ciasno." },
          { name: "Zacznij z dużego dystansu", desc: "Zacznij od 50-80 metrów. Obserwuj {dogName} bardzo dokładnie: mimika, oczy, ogon, oddech. Zanotuj wszystko." },
          { name: "Rozpoznaj sygnały progu pobudzenia", desc: "Pierwsze oznaki: napięta mimika, wpatrzone oczy, sztywny ogon, zamknięty pysk, krótka pauza w oddechu. To jest NA progu pobudzenia. Zanotuj dystans." },
          { name: "Reakcja oznacza powyżej", desc: "Szczekanie, próba rzucenia się, warczenie: jesteś POWYŻEJ. Natychmiast podwój dystans. Tam nic się nie uczy, tylko reaguje." },
          { name: "Osobno na każdy typ wyzwalacza", desc: "Psy, biegacze, rower, dziecko, obcy mężczyźni: każdy ma własny dystans. Notuj dla każdego wyzwalacza w dzienniku. To twoja mapa treningowa." },
          { name: "Mapa jako fundament treningu", desc: "Te wartości to twój fundament treningu na najbliższe tygodnie. Pracujesz zawsze PONIŻEJ tych wartości, nigdy nie ocieraj się o nie, nigdy powyżej." },
        ],
        frequency: ["4 dni po 20-30 min sesji obserwacji", "Osobno na każdy typ wyzwalacza", "Prowadź notatki na piśmie"],
        watchFor: ["Rozpoznawaj sygnały stresu wcześnie", "Dystans lepiej za duży niż za mały"],
        gos: ["Dziennik z dystansami dla każdego wyzwalacza", "Obserwuj cierpliwie i dokładnie"],
        noGos: ["Testować próg, podchodząc bliżej", "Godzić się na reakcję dla „informacji zwrotnej”"],
      },
      {
        title: "Gra „patrz na to” z prawdziwymi wyzwalaczami",
        intro: "{dogName} uczy się: spojrzenie na wyzwalacz jest w porządku, potem jest nagroda u mnie.",
        steps: [
          { name: "Ustaw się bezpiecznie poniżej progu", desc: "Z {dogName} w miejscu, gdzie wyzwalacze pojawiają się w twoim zanotowanym bezpiecznym dystansie. Masz w kieszeni coś wartościowego (kurczak, ser, pasztetowa)." },
          { name: "Wyzwalacz się pojawia, ty czekasz", desc: "Gdy tylko {dogName} zauważy wyzwalacz: żadnej reakcji z twojej strony. Czekaj. {dogName} patrzy, rejestruje, ale jest poniżej poziomu reakcji." },
          { name: "Ustaw PATRZ jako marker", desc: "Powiedz w chwili, gdy {dogName} spojrzał: PATRZ + od razu smakołyk, który trzymasz dobrze widocznie w górze, tak by {dogName} spojrzał na ciebie." },
          { name: "Nagroda przy nodze", desc: "Gdy {dogName} patrzy na ciebie: wartościowy smakołyk, spokojnie podany. Uczy się: „widok wyzwalacza = oczekiwanie nagrody u opiekuna”. Skojarzenie emocjonalne się zmienia." },
          { name: "Powtarzaj przy każdym kontakcie wzrokowym", desc: "Przy każdym nowym wyzwalaczu: PATRZ + nagroda. Na sesję 6-10 powtórzeń. Nigdy POWYŻEJ progu pobudzenia, to konfrontacja." },
          { name: "Zmniejszaj dystans dopiero po sukcesie", desc: "Gdy przez 3 sesje z rzędu 8 na 10 reakcji przebiega czysto, podejdź 2-5m bliżej. Nigdy szybciej. Plateau jest normalne." },
        ],
        frequency: ["3-4 sesje w tygodniu, 20-30 min", "Nigdy dwa różne typy wyzwalaczy na sesję"],
        watchFor: ["Dystans jest wszystkim", "Pierwsze sygnały stresu = zwiększ dystans"],
        gos: ["Używaj wartościowej nagrody", "Konsekwentnie pozostań poniżej progu"],
        noGos: ["Prowokować wyzwalacze", "Mieszać kilka typów wyzwalaczy"],
      },
      {
        title: "Technika łuku przy spotkaniach",
        intro: "Gdy wyzwalacz podchodzi zbyt blisko, potrzebujesz jasnej strategii omijania.",
        steps: [
          { name: "Zanotuj drogi ucieczki z wyprzedzeniem", desc: "Przy planowaniu spaceru: gdzie są boczne uliczki, wejścia na podwórka, przystanki? To twoje awaryjne wyjścia. Wizualizuj je w głowie." },
          { name: "Rozpoznawaj wyzwalacz wcześnie", desc: "Wytrenuj się w dostrzeganiu wyzwalaczy 30-50m przed {dogName}. Gdy tylko widoczny: podejmij decyzję o łuku lub pójściu dalej, zanim zareaguje." },
          { name: "Delikatnie zawróć", desc: "Gdy łuk konieczny: powiedz spokojnie ŁUK i odwróć się o 90 stopni. Nie szarpnięciem, nie w panice. Zwab {dogName} smakołykiem w nowym kierunku." },
          { name: "Idź dalej zdecydowanie", desc: "Idź zdecydowanie w nowym kierunku, nie z wahaniem. {dogName} podąża. Nigdy nie oglądaj się ani nie zatrzymuj, by patrzeć, co robi wyzwalacz." },
          { name: "Nagradzaj poza linią wzroku", desc: "Gdy tylko wyjdziecie z linii wzroku (róg, wejście do budynku): 3 smakołyki do pyska, powiedz spokojnie WSPANIALE, chwilę postój. Wygraliście." },
          { name: "Nigdy nie omijaj ot tak", desc: "WAŻNE: nigdy nie omijaj wyzwalacza bez kierowania uwagą {dogName}. Inaczej widzi wyzwalacz, ty idziesz dalej, grozi frustracja i eskalacja." },
        ],
        frequency: ["Przy każdej ostrej sytuacji", "Planuj spacery z mapą dróg ucieczki", "Ćwicz w sytuacjach nieostrych"],
        watchFor: ["Trenuj wczesne rozpoznawanie wyzwalaczy", "Zachowaj własny spokój"],
        gos: ["Zdecydowanie wejdź w drogę ucieczki", "Smakołyk gotowy jako wabik"],
        noGos: ["Uciekać w panice", "Pozwalać wpatrywać się w wyzwalacz"],
      },
      {
        title: "Spojrzenie i odwrócenie się",
        intro: "Kolejny poziom: {dogName} patrzy na wyzwalacz I sam się odwraca.",
        steps: [
          { name: "Warunek: „patrz na to” opanowane", desc: "To ćwiczenie dopiero, gdy „patrz na to” działa niezawodnie (8/10 sesji czysto). Inaczej {dogName} nie jest jeszcze gotowy." },
          { name: "Ustaw się poniżej progu", desc: "Ten sam układ co przy „patrz na to”: wyzwalacz widoczny, {dogName} poniżej progu. Jesteś spokojny, wyczekujący." },
          { name: "Pozwól spojrzeć", desc: "{dogName} widzi wyzwalacz. Tym razem poczekaj kilka sekund, nie mówiąc PATRZ. {dogName} patrzy, obserwuje, rejestruje. Ty pozostajesz cicho." },
          { name: "Poczekaj na odwrócenie wzroku", desc: "Gdy {dogName} SAM odwraca wzrok: NATYCHMIAST jackpot 3-4 smakołyki, spokojne WSPANIALE. To jest właściwy efekt nauki." },
          { name: "Gdy się wpatruje: cichy sygnał PATRZ", desc: "Gdyby {dogName} wpatrywał się dłużej niż 5-10 sek bez odwrócenia się: cichy marker PATRZ. Nagroda przychodzi, ale mniejsza. Celem pozostaje samodzielne odwrócenie się." },
          { name: "Z tygodniami automatycznie", desc: "Po 3-4 tygodniach {dogName} często sam się odwraca, bez twojej interwencji. To samoregulacja na wysokim poziomie." },
        ],
        frequency: ["2-3 sesje w tygodniu", "Dopiero po utrwalonym „patrz na to”", "Na sesję 5-8 powtórzeń"],
        watchFor: ["Cierpliwie czekaj na samodzielne odwrócenie", "Nigdy nie buduj presji"],
        gos: ["Nagradzaj samodzielność", "Pozostań spokojny i wyczekujący"],
        noGos: ["Przedwcześnie mówić PATRZ", "Frustrować się przy długim wpatrywaniu"],
      },
      {
        title: "Strefa buforowa przed spodziewanymi spotkaniami",
        intro: "Przy przewidywalnych spotkaniach przygotowujesz {dogName} mentalnie i przestrzennie.",
        steps: [
          { name: "Zidentyfikuj gorące punkty spotkań", desc: "Gdzie zwykle spotykamy wyzwalacze? Wejście do parku, przed piekarnią, na przystanku. Zapamiętaj te miejsca." },
          { name: "20m wcześniej w tryb", desc: "Zanim dotrzecie do gorącego punktu: smycz nieco krótsza, ręka przy kieszeni gotowa, sygnał PATRZ mentalnie uzbrojony. Jesteś w trybie treningu." },
          { name: "Buduj aktywne chodzenie przy nodze", desc: "20m przed i 20m po gorącym punkcie: {dogName} idzie ciasno przy nodze, nagradzasz co 5-10 kroków. Zwiększona uwaga, nie przez nacisk, lecz przez gęstość nagród." },
          { name: "Wyzwalacz przez PATRZ lub łuk", desc: "Gdy pojawia się wyzwalacz: „patrz na to” jak ćwiczone lub łuk, zależnie od dystansu. Jesteś przygotowany i nie zaskoczony." },
          { name: "Po przejściu się rozluźnij", desc: "Poza gorącym punktem: smycz znów nieco dłuższa, zmniejsz częstotliwość nagród, spokojnie idź dalej. Przerwa na węszenie jako nagroda." },
          { name: "Rutyna staje się odruchem", desc: "Po 3-4 tygodniach rutyna strefy buforowej staje się odruchowa. Nie robisz tego już świadomie, lecz automatycznie. {dogName} reaguje spokojniej na znanych trasach." },
        ],
        frequency: ["Na każdym spacerze przy gorących punktach", "Zrutynizowane przez 3-4 tygodnie"],
        watchFor: ["Planowanie z wyprzedzeniem zamiast reakcji", "Utrzymuj własny poziom"],
        gos: ["Przygotuj gorące punkty w głowie", "Zwiększ gęstość nagród"],
        noGos: ["Dać się zaskoczyć gorącym punktom", "Reagować dopiero, gdy robi się ciasno"],
      },
      {
        title: "Zasada 72-godzinnej regeneracji po stresie",
        intro: "Po eskalacji lub sytuacji stresu {dogName} potrzebuje prawdziwej regeneracji, zanim będzie dalej trenowany.",
        steps: [
          { name: "Rozpoznaj sytuację stresu", desc: "Eskalacja, szczekanie, próba rzucenia się, bardzo bliskie spotkanie, niechciany kontakt z wyzwalaczem: to wszystko jest sytuacją stresu, która uwalnia hormony stresu." },
          { name: "Natychmiast przerwa w treningu", desc: "Zaraz po sytuacji: 72 godziny bez ukierunkowanego treningu z wyzwalaczami. Tylko spokojne, znajome spacery w znanym otoczeniu." },
          { name: "Pozwól poziomowi stresu naturalnie opaść", desc: "Hormony stresu (kortyzol) potrzebują 3 dni na całkowity rozkład. W tym czasie {dogName} jest bardziej reaktywny, szybciej wyzwalany. To biologia, nie psychologia." },
          { name: "Unikaj tras z wyzwalaczami", desc: "Podczas 72 godzin świadomie omijaj gorące punkty. Wybieraj inne trasy, korzystaj ze spokojniejszych pór. To ochrona, nie poddanie się." },
          { name: "Uspokajające aktywności", desc: "Praca węchowa, spokojne spacery z węszeniem, zabawa z Kongiem, masaż. Wszystko, co wycisza {dogName}. Żadnych ekscytujących gier ani kontaktu z psami." },
          { name: "Po 72 godzinach ostrożnie z powrotem", desc: "Po 3 dniach: pierwsza ostrożna sesja treningowa w większym dystansie niż zwykle. Obserwuj, czy poziom wrócił do normy. Jeśli tak: normalny trening dalej." },
        ],
        frequency: ["Przy każdej sytuacji stresu 72h przerwy", "Uspokajające aktywności codziennie"],
        watchFor: ["Stres kumuluje się przez kilka dni", "Cierpliwie utrzymaj przerwę"],
        gos: ["Uspokajające spacery", "Świadomie omijaj gorące punkty"],
        noGos: ["Trenować znów już następnego dnia", "Bagatelizować eskalację jako „jednorazowe zdarzenie”"],
      },
      {
        title: "Protokół awaryjny przy eskalacji",
        intro: "Gdy jednak coś pójdzie źle: jasne kroki, żadnego chaosu.",
        steps: [
          { name: "ŻADNEGO krzyku, ŻADNEGO ciągnięcia", desc: "Krok 1 w eskalacji: zachowaj spokój. Krzyk ogromnie wzmacnia pobudzenie {dogName}. Nerwowe ciągnięcie wzmacnia napięcie." },
          { name: "Obróć się ciałem", desc: "Ustaw swoje ciało między {dogName} a wyzwalaczem. Odbierasz kontakt wzrokowy, nie ciągnąc za smycz." },
          { name: "Odejdź zdecydowanie", desc: "Powiedz raz ŁUK i idź zdecydowanie w bezpiecznym kierunku. Wab smakołykiem, nie szarp. Zbuduj co najmniej 30m dystansu." },
          { name: "Uspokój poza zasięgiem wzroku", desc: "Gdy jesteście poza linią wzroku: zatrzymaj się, podaj spokojnie 3 smakołyki, powiedz WSPANIALE. {dogName} ma się wyciszyć." },
          { name: "Oceń oznaki stresu", desc: "Jak czuje się {dogName}? Czy jeszcze dyszy? Szerokie źrenice? Drży? Jeśli tak: jeszcze więcej dystansu, spokojne miejsce, zaproponuj wodę." },
          { name: "Uruchom zasadę 72 godzin", desc: "Po eskalacji: przejdź w tryb 72-godzinnej regeneracji po stresie (zobacz ćwiczenie 7). Przerwa w treningu, spokojne aktywności, świadome omijanie gorących punktów." },
        ],
        frequency: ["Tylko przy rzeczywistej eskalacji", "Ćwiczenia na sucho w domu 1x w tygodniu"],
        watchFor: ["Zachowanie własnego spokoju jest wszystkim", "Nigdy nie przekazuj nerwowości"],
        gos: ["Spokojnie, zdecydowanie, precz", "Wartościowa nagroda pod ręką"],
        noGos: ["Krzyczeć lub ciągnąć", "Znów zbliżać się do wyzwalacza, by pokazać „nic się nie dzieje”"],
      },
    ],
    abschluss: {
      title: "Zakończenie",
      subtitle: "Powodzenia",
      paras: [
        "Agresja u psów to niemal zawsze samoobrona. {dogName} reaguje tak, bo czuje się przeciążony. Twoim zadaniem nie jest „przeuczyć” go, lecz dać mu poczucie bezpieczeństwa.",
        "Kto używa dystansu, progu pobudzenia i cierpliwości jako narzędzi, ma decydującą przewagę nad każdą metodą konfrontacyjną. Jest wolniej, ale trwale.",
        "Cofnięcia są częścią procesu. Eskalacja nie oznacza, że praca poszła na marne. Dzięki zasadzie 72 godzin i spokojnym aktywnościom szybko wracasz na właściwą drogę.",
        "Nadal prowadź dziennik z progami pobudzenia. Twoja wiedza o reakcjach {dogName} to twoje najważniejsze narzędzie. Z każdym miesiącem będziesz lepiej czytać jego sygnały.",
      ],
    },
  },

  mouthing: {
    coverTitle: "Plan przeciw podnoszeniu z ziemi dla",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Dlaczego ten plan jest zbudowany właśnie tak",
      subtitle: "Bezpieczeństwo na każdym spacerze",
      paras: [
        "{dogName} podnosi na zewnątrz wszystko, co czymś pachnie. To nie błąd wychowawczy, lecz naturalny popęd: popęd węchowy plus instynkt łowiecki plus ciekawość czujnego psa.",
        "Podnoszenie samo w sobie nagradza. {dogName} coś znajduje, połyka, gotowe. Nie ma dla niego powodu, by tego nie robić, dopóki nie dostaje niczego lepszego u ciebie.",
        "Do tego: każdy sukces wzmacnia to zachowanie. Raz ukradkiem połknięty kawałek chleba oznacza, że następny spacer będzie jeszcze intensywniejszym szukaniem.",
        "Ten plan buduje alternatywę: czysty sygnał PUŚĆ, sygnał-stop FUJ, transakcje wymiany o dużej wartości i zabezpieczenie kagańcem na trasy wysokiego ryzyka. Dostajesz kontrolę bez kary.",
      ],
    },
    how: {
      title: "Jak prawidłowo wykonywać ćwiczenia",
      paras: [
        "Najpierw budujesz w domu, zanim ćwiczysz na zewnątrz. W domu {dogName} jest mniej napędzany, sygnały można czysto zwarunkować.",
        "PUŚĆ, FUJ i transakcja wymiany to trzy różne narzędzia. NIGDY nie występują jako kara, lecz jako sygnały z jasną alternatywą nagrody.",
        "Podczas fazy budowania kaganiec jest twoim najlepszym przyjacielem na trasach wysokiego ryzyka (przed szkołami, w dni wywozu śmieci, przy wejściach do parku). To nie przyznanie się do porażki, to rozsądek.",
        "Wartość nagrody musi ZAWSZE być wyższa niż to, co może leżeć na zewnątrz. Sucha karma nie wystarczy. Potrzebujesz kurczaka, kiełbasy, sera, czegoś naprawdę atrakcyjnego.",
      ],
    },
    exercises: [
      {
        title: "Czyste budowanie sygnału PUŚĆ w domu",
        intro: "{dogName} uczy się w domu, że oddawanie się opłaca — zanim wyjdziemy na zewnątrz.",
        steps: [
          { name: "Daj mało wartościowy przedmiot", desc: "Wybierz prostą zabawkę, którą {dogName} lubi, ale nie nad życie. Pozwól mu się nią pobawić, ponosić w pysku, kilka sekund." },
          { name: "Pokaż wartościową nagrodę", desc: "Trzymaj wartościowy smakołyk (kurczak, ser) na wysokości nosa. {dogName} go wącha, widzi. Różnica wartości między zabawką a smakołykiem jest wszystkim." },
          { name: "Spokojnie powiedz PUŚĆ", desc: "Powiedz PUŚĆ spokojnym, nie groźnym głosem. Nie głośno, nie surowo. {dogName} nie jest jeszcze zwarunkowany, słowo musi zostać naładowane pozytywnie." },
          { name: "Czekaj na puszczenie", desc: "{dogName} się zastanawia: zatrzymać zabawkę czy sięgnąć po smakołyk? Najczęściej wybiera smakołyk. Gdy tylko upuści zabawkę: DOBRZE, smakołyk, spokojna pochwała." },
          { name: "Oddaj zabawkę z powrotem", desc: "WAŻNE: po 3-5 sekundach oddajesz zabawkę z powrotem. {dogName} uczy się: PUŚĆ to nie strata, lecz dobra transakcja wymiany, która kończy się pozytywnie." },
          { name: "Powoli zwiększaj wartość", desc: "Po 2 tygodniach z prostą zabawką: ulubiona zabawka, potem gryzak, potem (ostrożnie) kość. Na każdy poziom 5-7 dni." },
        ],
        frequency: ["3-5 sesji PUŚĆ dziennie w domu", "Buduj przez 2-3 tygodnie", "Powoli zwiększaj wartość"],
        watchFor: ["Nagroda musi ZAWSZE być cenniejsza niż przedmiot", "Nigdy nie szarp ani nie wkładaj ręki do pyska"],
        gos: ["Pozostań spokojny i rozluźniony", "Oddawaj zabawkę"],
        noGos: ["Mówić PUŚĆ groźnym głosem", "Wkładać rękę do pyska"],
      },
      {
        title: "FUJ jako sygnał-stop w domu",
        intro: "FUJ zapobiega podniesieniu, ZANIM ono nastąpi. Bardzo ważne: FUJ to nie przekleństwo.",
        steps: [
          { name: "Układ treningowy", desc: "Połóż na podłodze mało wartościowy smakołyk, który {dogName} w zasadzie może mieć. Miej gotowy wartościowy smakołyk do wymiany." },
          { name: "W momencie pochylania się", desc: "Gdy tylko {dogName} pochyla się do smakołyka na podłodze: powiedz FUJ stanowczym, spokojnym głosem. Nie głośno, nie karząco. Jasno i jednoznacznie." },
          { name: "Od razu zwab alternatywą", desc: "FUJ NIGDY nie może stać samo. Zaraz potem: pokaż wartościowy smakołyk z ręki, zwab {dogName} na bok." },
          { name: "Nagradzaj przy odwróceniu się", desc: "Gdy tylko {dogName} odwraca się od smakołyka na podłodze i przychodzi do ciebie: DOBRZE, mega nagroda, spokojna pochwała. Smakołyk z podłogi znika." },
          { name: "Zwiększaj wartość rzeczy na podłodze", desc: "Po 1 tygodniu: kostka sera na podłodze zamiast suchej karmy. Po 2 tygodniach: kawałek kurczaka. Nagroda do wymiany też staje się cenniejsza (pasztetowa)." },
          { name: "Nie nadużywaj znaczenia", desc: "FUJ to nie uniwersalny stop. Tylko na „zostaw ten przedmiot”. Inaczej traci swoje działanie. Inne sygnały-stop (NIE, PUŚĆ) mają inne znaczenia." },
        ],
        frequency: ["3-5 sesji FUJ dziennie w domu", "Utrwalaj przez 2-3 tygodnie", "Zwiększaj wartość stopniowo"],
        watchFor: ["Głos pozostaje spokojny, nie agresywny", "Alternatywa nagrody cenniejsza"],
        gos: ["FUJ + natychmiastowa alternatywa", "Powoli zwiększaj wartość"],
        noGos: ["Nadużywać FUJ jako przekleństwa", "FUJ bez alternatywy nagrody"],
      },
      {
        title: "Transakcja wymiany ze stopniami wartości",
        intro: "Gdy {dogName} ma już coś w pysku: spokojnie wymieniaj zamiast panicznie szarpać.",
        steps: [
          { name: "Nigdy nie biegnij za nim", desc: "Gdy {dogName} już coś podniósł: NIE biegnij za nim. To wzmacnia zachowanie uciekania i zamienia je w zabawę." },
          { name: "Podejdź spokojnie, pokaż wymianę", desc: "Podejdź spokojnie do {dogName}, wartościowy smakołyk do wymiany w ręce. Nie stawaj nad nim, lecz z boku. Nie mów nic." },
          { name: "Powiedz PUŚĆ, poczekaj", desc: "Powiedz PUŚĆ, trzymaj smakołyk widocznie blisko nosa. Poczekaj 2-3 sekundy. {dogName} rozważa: zatrzymać czy wymienić?" },
          { name: "Nagradzaj przy oddaniu", desc: "Gdy {dogName} otwiera pysk i upuszcza przedmiot: DOBRZE + mega nagroda. Podniesiony przedmiot sprzątnij, bez dramatu." },
          { name: "Nigdy nie szarp ani nie sięgaj do pyska", desc: "Gdy {dogName} nie oddaje: czekaj dłużej, pokaż wyższą wartość. NIGDY ręka do pyska, to zatruwa sygnał na całe życie." },
          { name: "Najcenniejsza nagroda pod ręką", desc: "Na spacerze ZAWSZE: kurczak lub pasztetowa w kieszeni. Sucha karma nie wystarczy. Musisz móc przebić podniesiony przedmiot." },
        ],
        frequency: ["Przy każdym prawdziwym podniesieniu", "W domu ćwicz 3-4x dziennie", "Wartościowa nagroda zawsze przy sobie"],
        watchFor: ["Znaj hierarchię wartości", "Zachowaj spokój"],
        gos: ["Wymieniaj za prawdziwą wartość", "Podchodź łagodnie i spokojnie"],
        noGos: ["Biegać za nim", "Szarpać lub wkładać rękę do pyska"],
      },
      {
        title: "Szukanie nagrody jako alternatywa",
        intro: "Dajesz popędowi szukania {dogName} dozwolone źródło zaspokojenia.",
        steps: [
          { name: "Napełnij kieszeń", desc: "Przed każdym spacerem: 15-20 miękkich smakołyków (małe kawałki) do kieszeni. Muszą być małe i szybko dostępne." },
          { name: "Rzucaj przy węszeniu przy ziemi", desc: "Gdy tylko {dogName} idzie węsząc w stronę ziemi (typowa oznaka podnoszenia): rzuć 2-3 smakołyki w trawę, w obszar, który dla niego jest jasno do szukania." },
          { name: "Powiedz SZUKAJ", desc: "Powiedz SZUKAJ, gdy tylko smakołyki lecą. {dogName} szuka teraz aktywnie UDOSTĘPNIONYCH smakołyków, zamiast liczyć na coś przypadkowego na ziemi." },
          { name: "Na spacer 5-7 razy", desc: "Tych faz szukania nie musisz racjonować. Na spacer 5-7 momentów SZUKAJ to dobra średnia. {dogName} wie: „U mojego opiekuna coś się pojawia, nie muszę szukać sam”." },
          { name: "Powiązanie z gorącymi punktami", desc: "Przed waszymi typowymi gorącymi punktami (kosze na śmieci, wejście do parku) celowo wpleć momenty SZUKAJ. Przekierowujesz uwagę, zanim {dogName} w ogóle zacznie węszyć przy ziemi." },
          { name: "Z tygodniami zacznie sprawdzać", desc: "Po 3-4 tygodniach {dogName} przy każdym bodźcu przy ziemi najpierw krótko zerka na ciebie, czy coś rzucasz. Twoja kieszeń stała się jego nowym dostawcą." },
        ],
        frequency: ["Konsekwentnie na każdym spacerze", "Ustal rutynę kieszeni"],
        watchFor: ["Rzucaj TYLKO na bezpieczne podłoże, nie w rejon koszy na śmieci", "Trzymaj smakołyki małe"],
        gos: ["Przekierowuj popęd szukania, nie tłum go", "Kieszeń zawsze pełna"],
        noGos: ["Rzucać tylko suchą karmę (za mało ciekawa)", "Rzucać dopiero po podniesieniu"],
      },
      {
        title: "Kaganiec na trasy wysokiego ryzyka",
        intro: "Najpierw bezpieczeństwo. W krytycznych miejscach kaganiec to twoja najlepsza ochrona.",
        steps: [
          { name: "Pozytywnie zwarunkuj kaganiec", desc: "Jak przy ćwiczeniu agresji: kaganiec koszykowy (Baskerville Ultra), 10-14 dni pozytywnego budowania, zanim wejdzie do użycia na spacerze." },
          { name: "Zidentyfikuj trasy wysokiego ryzyka", desc: "Gdzie najczęściej coś podnosimy? Przed szkołami (kanapki), w dni wywozu śmieci, przy wejściach do parku, na przystankach. Oznacz te trasy." },
          { name: "Ustal obowiązek kagańca", desc: "Na tych trasach: kaganiec założony. Nie do negocjacji. Nawet gdyby „raz nie było źle”. Liczy się konsekwencja." },
          { name: "Na bezpiecznych trasach pomijaj", desc: "Na znanych spokojnych trasach możesz pominąć kaganiec. To daje {dogName} pozytywną swobodę i pokazuje: nie jest on ogólnie czymś negatywnym." },
          { name: "Podczas przejścia treningowego", desc: "Podczas gdy PUŚĆ i FUJ są jeszcze w budowie: używaj kagańca także na „normalnych” trasach. Najpierw bezpieczeństwo. Dopiero gdy sygnały stabilnie siedzą, możesz ograniczać." },
          { name: "Nigdy jako kara czy wychowanie", desc: "Kaganiec NIGDY nie może kojarzyć się z karą. To narzędzie bezpieczeństwa. Gdy {dogName} pokazuje frustrację: powtórz pozytywne warunkowanie, krótsze czasy noszenia." },
        ],
        frequency: ["Zawsze w zidentyfikowanych gorących punktach", "W fazie budowania używaj hojnie"],
        watchFor: ["Pielęgnuj pozytywne skojarzenie", "Nigdy jako środek kary"],
        gos: ["Kaganiec koszykowy, nie materiałowy", "Konsekwentnie na trasach ryzyka"],
        noGos: ["Kaganiec w stresie bez przygotowania", "Używać materiałowej pętli na pysk"],
      },
      {
        title: "Praca węchowa dla zaspokojenia",
        intro: "Kto wystarczająco używa nosa i głowy, mniej szuka na zewnątrz.",
        steps: [
          { name: "Zaplanuj codzienną pracę węchową", desc: "Co najmniej 20-30 min dziennie pracy węchowej: gra w szukanie w mieszkaniu, tropienie na zewnątrz, mata węchowa, Kong. Zmęczony nos = spokojne łapy na zewnątrz." },
          { name: "Pozwól na przerwy na węszenie", desc: "Na spacerze: co 5-10 min przerwa na węszenie 30-60 sek. {dogName} obwąchuje trawę, krzewy, słupki. Nie podnosi, tylko bada." },
          { name: "Wpleć element tropienia", desc: "1-2 razy w tygodniu połóż mały trop: 10-20m tropu ze smakołyków. {dogName} podąża węsząc. 15-minutowy trop zastępuje w działaniu 30 min spaceru." },
          { name: "Mata węchowa w domu", desc: "Zamiast karmienia z miski: rozłóż suchą karmę na macie węchowej. {dogName} pracuje nad nią 15-20 min. Męczy, zaspokaja popęd." },
          { name: "Ciesz się atrakcjami spaceru", desc: "Planuj celowo „spacery szukające”: w spokojnym lesie, mniej uczęszczane ścieżki, gdzie węszenie jest głównym zadaniem. {dogName} uczy się: badanie jest dozwolone i przyjemne." },
          { name: "Efekt: mniej instynktu łowieckiego", desc: "Po 4-6 tygodniach codziennej pracy węchowej potrzeba podnoszenia zauważalnie się zmniejsza. Popęd jest mniej „spiętrzony”." },
        ],
        frequency: ["Codziennie 20-30 min pracy węchowej", "Co najmniej 1 jednostka tropienia w tygodniu"],
        watchFor: ["Jakość ważniejsza niż ilość", "Zakotwicz w rutynie planu dnia"],
        gos: ["Praca węchowa jako stała rutyna", "Planuj przerwy na węszenie"],
        noGos: ["Pomijać pracę węchową jako nagrodę", "Bezmyślne szaleństwo zamiast pracy nosa"],
      },
      {
        title: "Nagradzanie przy nodze w gorących punktach",
        intro: "W krytycznych miejscach pozycja przy nodze staje się najbardziej opłacalną opcją.",
        steps: [
          { name: "Kieszeń pełna najlepszej nagrody", desc: "Kurczak, ser, kiełbasa — to, co {dogName} kocha. Drobno pokrojone, szybko dostępne." },
          { name: "Skróć przy zbliżaniu do gorącego punktu", desc: "20m przed gorącym punktem: skróć smycz do 1m. {dogName} idzie ciasno przy nodze. Jesteś uważny, obserwujesz sytuację przy ziemi." },
          { name: "Co 3-5 kroków smakołyk", desc: "Podczas przechodzenia przez gorący punkt: co 3-5 kroków najlepszy smakołyk prosto przy szwie nogawki. {dogName} patrzy na ciebie, nie na ziemię." },
          { name: "Rzuty SZUKAJ jako bonus", desc: "Gdy jednak coś podejrzanego leży na ziemi: nie zatrzymuj się, lecz rzuć 2-3 smakołyki na BEZPIECZNE miejsce (łąka, czyste miejsce) i powiedz SZUKAJ." },
          { name: "Po przejściu się rozluźnij", desc: "Gdy tylko przejdziecie przez gorący punkt: smycz znów nieco dłuższa, zmniejsz częstotliwość nagród, przerwa na węszenie jako nagroda." },
          { name: "Z tygodniami automatycznie", desc: "Po 3-4 tygodniach {dogName} idzie ciasno przy nodze, gdy rozpoznaje trasę z gorącym punktem. Rutyna staje się odruchem." },
        ],
        frequency: ["Na każdym spacerze przy gorących punktach", "Zautomatyzuj przez 3-4 tygodnie"],
        watchFor: ["Używaj naprawdę wartościowej nagrody", "Pozostań uważny"],
        gos: ["Zwiększ gęstość nagród", "Krótka smycz w gorących punktach"],
        noGos: ["Krzyczeć, gdy {dogName} węszy", "Sucha karma jako nagroda"],
      },
    ],
    abschluss: {
      title: "Zakończenie",
      subtitle: "Powodzenia",
      paras: [
        "Podnoszenie to popęd, nie wada charakteru. {dogName} nie da się „dobrze wychować” w klasycznym sensie, bo podnoszenie samo w sobie nagradza. To, co potrafi: nauczyć się, że u ciebie jest coś lepszego.",
        "Cierpliwość jest wszystkim. PUŚĆ, FUJ i transakcja wymiany potrzebują tygodni, zanim zadziałają na zewnątrz w prawdziwych warunkach. Bądź konsekwentny, wartościowe nagrody pod ręką.",
        "Kaganiec to nie przyznanie się do porażki, lecz narzędzie bezpieczeństwa. Dopóki trening nie siedzi w 100%, na trasach wysokiego ryzyka jest po prostu rozsądkiem. Zatrute przynęty i ostre przedmioty są wszędzie.",
        "Utrzymuj pracę węchową jako stałą rutynę. Pies, którego nos i głowa są codziennie angażowane, ma na zewnątrz mniejszą potrzebę szukania. To najtrwalszy filar twojego planu.",
      ],
    },
  },

  recall: {
    coverTitle: "Plan przywołania dla",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Dlaczego ten plan jest zbudowany właśnie tak",
      subtitle: "Niezawodne przywołanie w każdej sytuacji",
      paras: [
        "{dogName} czasem przychodzi, gdy wołasz, czasem nie. To nie „nieposłuszeństwo”, lecz brak niezawodności. Przywołanie to najważniejsza polisa na życie w psim życiu.",
        "Gdy przywołanie się chwieje, prawie zawsze ma to swoją historię. Może sygnał wołano zbyt często, gdy pies nie mógł przyjść (rozproszenie). Może nauczył się, że przyjście oznacza założenie smyczy — koniec zabawy.",
        "U {dogName} albo odbudowujemy stary sygnał, albo całkiem nowe słowo. Ważne jest: to słowo ZAWSZE jest ładowane pozytywnie, nigdy nie nadużywane do rzeczy negatywnych.",
        "Ten plan buduje przywołanie stopniami: w domu, na zewnątrz na lince, przy rozproszeniu, w wariancie z gwizdkiem jako zabezpieczenie. Dopiero gdy każdy poziom siedzi w 90%, przychodzi następny.",
      ],
    },
    how: {
      title: "Jak prawidłowo wykonywać ćwiczenia",
      paras: [
        "Wartościowa nagroda to obowiązek. Kurczak, ser, pasztetowa — sucha karma nie wystarcza do przywołania. Sygnał musi być najbardziej atrakcyjnym momentem spaceru.",
        "Świadomie wybierz nowe słowo, jeśli stare jest zatrute. DO MNIE lub własne słowo. Ale tylko JEDNO słowo, konsekwentnie takie samo dla wszystkich członków rodziny.",
        "Linka to pomost bezpieczeństwa między domem a wolnym bieganiem. 5-10m biothane (nie sznur — parzy dłonie). Nigdy nie przeskakuj od razu do wolnego biegania bez tego pośredniego etapu.",
        "Nigdy nie używaj sygnału przywołania do rzeczy negatywnych: zapinanie smyczy na końcu spaceru, weterynarz, kąpiel, krzyk. Do tych rzeczy potrzebujesz innego słowa. Sygnał przywołania pozostaje święty.",
      ],
    },
    exercises: [
      {
        title: "Naładuj DO MNIE na nowo pozytywnie",
        intro: "Pierwszy poziom w domu: sygnał staje się najbardziej atrakcyjną rzeczą dnia.",
        steps: [
          { name: "Wybierz nowe słowo", desc: "Gdy stare DO MNIE jest zatrute (pies nie przychodzi niezawodnie), weź inne własne słowo. Konsensus rodziny: wszyscy używają tego samego słowa." },
          { name: "Zacznij w domu z 3m", desc: "{dogName} jest rozluźniony w salonie. Odchodzisz 3m, odwracasz się, przechodzisz do głębokiego przysiadu." },
          { name: "Wołaj radośnie", desc: "Powiedz DO MNIE jasnym, radosnym tonem. NIE rozkazująco, lecz zapraszająco. Jak gdybyś wołał psa do czegoś miłego." },
          { name: "Nagroda-jackpot", desc: "Gdy tylko {dogName} jest przy tobie: 5-7 kawałków kurczaka po kolei, spokojna pochwała, krótkie głaskanie. To nie „zwykły smaczek” — to ŚWIĘTO." },
          { name: "Od razu pozwól znów odejść", desc: "Po 30 sekundach nagrody: „OK”, {dogName} może dalej się bawić, dalej węszyć. Przywołanie NIGDY nie kończy się końcem wolności. To jest sedno." },
          { name: "5 powtórzeń, 3 sesje dziennie", desc: "Na sesję 5 przywołań, 3 sesje dziennie w domu. Tak przez tydzień, potem wydłużaj do 5m, 8m, przez inne pomieszczenia." },
        ],
        frequency: ["3 sesje dziennie w domu", "Buduj przez 1 tydzień", "Od razu pozwól odejść po nagrodzie"],
        watchFor: ["Nagroda musi być NAPRAWDĘ wartościowa", "Ton jest zapraszający, nie rozkazujący"],
        gos: ["Kurczak, nie sucha karma", "Wołaj radośnie"],
        noGos: ["Zapinać smycz zaraz po przywołaniu", "Wołać rozkazująco"],
      },
      {
        title: "Przywołanie z przytrzymaniem dla wysokiej motywacji",
        intro: "Druga osoba przytrzymuje {dogName}, ty uciekasz — aktywuje się instynkt łowiecki.",
        steps: [
          { name: "Zaangażuj pomocnika", desc: "Partner, członek rodziny lub przyjaciel. Ta osoba delikatnie przytrzymuje {dogName} za szelki." },
          { name: "Odchodzisz widocznie", desc: "Odchodzisz 10-15 metrów, w polu widzenia. Odwróć się, przejdź do głębokiego przysiadu, klaśnij radośnie w dłonie." },
          { name: "Wołaj radośnie, pomocnik puszcza", desc: "Wołasz DO MNIE jasnym tonem. Jednocześnie: pomocnik puszcza {dogName}. {dogName} pędzi do ciebie." },
          { name: "MEGA-jackpot przy dotarciu", desc: "{dogName} dobiega z energią: 7-10 kawałków kurczaka, wylewna pochwała, radosne powitanie. To przeżycie-atrakcja." },
          { name: "Znów puść", desc: "Po 30 sek nagrody: „OK”, {dogName} biegnie z powrotem do pomocnika, dalej się bawić lub spacerować. Nigdy nie zapinaj smyczy zaraz po tej zabawie." },
          { name: "Powoli zwiększaj dystans", desc: "Przez tygodnie zwiększaj do 30-50m. Także na zewnątrz na lince. To jedno z najskuteczniejszych ćwiczeń w ogóle — instynkt łowiecki pracuje dla ciebie." },
        ],
        frequency: ["2-3 sesje w tygodniu, po 4-6 powtórzeń", "Na zewnątrz zabezpiecz linką"],
        watchFor: ["Pomocnik trzyma delikatnie, nie surowo", "Ty sam musisz widocznie mieć zabawę"],
        gos: ["Mega nagroda, mega pochwała", "Od razu pozwól znów odejść"],
        noGos: ["Zaraz po przywołaniu zapiąć smycz i iść do domu", "Sprawiać, że pomocnik wygląda na „karzącego”"],
      },
      {
        title: "Praca na lince jako pomost",
        intro: "Zanim zaryzykujesz wolne bieganie: 5-10m linki. {dogName} czuje się wolny, ty masz bezpieczeństwo.",
        steps: [
          { name: "Właściwa linka", desc: "5-10m biothane (nie sznur — parzy dłonie przy przeciąganiu). Szelki (NIGDY nie mocuj do obroży — ryzyko urazu)." },
          { name: "Zacznij w spokojnym miejscu", desc: "Spokojna łąka lub leśna polana bez innych psów. {dogName} biega swobodnie w promieniu 5-10m." },
          { name: "Regularnie przywołuj", desc: "Co 3-5 min: DO MNIE radosnym tonem. {dogName} przychodzi? Jackpot, spokojnie puść, pozwól iść dalej." },
          { name: "Jeśli nie: użyj linki", desc: "Gdy {dogName} NIE przychodzi: żadnego drugiego wezwania. Zamiast tego delikatnie zbierz linkę, przyciągnij go do siebie, spokojnie. Mimo to mała nagroda przy dotarciu." },
          { name: "Nigdy nie wołaj, gdy to niemożliwe", desc: "Gdy {dogName} jest silnie rozproszony (inny pies, zapach zwierzyny) i WIESZ: nie przyjdzie — wtedy NIE wołaj. Delikatnie zbierz linkę, bez słowa." },
          { name: "Z tygodniami niezawodnie", desc: "Po 2-3 tygodniach {dogName} przychodzi na 80-90% przywołań. Dopiero wtedy myślimy o etapie swobody. Do tego czasu: linka pozostaje przypięta." },
        ],
        frequency: ["3-4 spacery na lince w tygodniu", "Buduj przez 3-4 tygodnie"],
        watchFor: ["Biothane zamiast sznura", "Szelki obowiązkowe"],
        gos: ["Ćwicz w spokojnych miejscach", "Utrzymuj wartościową nagrodę"],
        noGos: ["Linka na obroży", "Wołać, gdy jasne, że nie przyjdzie"],
      },
      {
        title: "DO MNIE przy rozproszeniu",
        intro: "Prawdziwy test: przywołanie działa też, gdy kusi coś ciekawszego.",
        steps: [
          { name: "Wybierz umiarkowane rozproszenie", desc: "Skraj parku ze spacerowiczami w 30m, spokojna łąka w zasięgu słyszalności ulicy. NIE bezpośrednio przy innych psach — za intensywne na ten poziom." },
          { name: "Linka dla bezpieczeństwa", desc: "Linka pozostaje przypięta. Bezpieczeństwo jest obowiązkowe, dopóki przywołanie przy rozproszeniu nie siedzi w 90%." },
          { name: "Nagroda wstępna", desc: "Przed każdym planowanym przywołaniem 1-2 mini-nagrody z ręki, aby {dogName} wiedział: „mój opiekun jest właśnie interesujący”." },
          { name: "Wołaj radośnie, raz", desc: "Powiedz DO MNIE jasnym tonem, RAZ. Nie powtarzaj. Gdy {dogName} przychodzi: SUPER-JACKPOT 7-10 smakołyków, przesadna pochwała." },
          { name: "Jeśli nie: linka, bez dramatu", desc: "Gdy {dogName} nie przychodzi: spokojnie zbierz linkę, lekko przyciągnij, żadnego drugiego wezwania, żadnego krzyku. Przy dotarciu: mimo to mini-nagroda." },
          { name: "Utrzymuj skuteczność 80%", desc: "Na sesję 4-6 przywołań. Skuteczność poniżej 70%? Zmniejsz rozproszenie. Powyżej 90%? Odważ się na silniejsze rozproszenie." },
        ],
        frequency: ["3-4 sesje w tygodniu", "Buduj przez 2-4 tygodnie", "Świadomie utrzymuj skuteczność"],
        watchFor: ["Nigdy silniejsze rozproszenie niż do opanowania", "Gdy mniej niż 70%: poziom w tył"],
        gos: ["Dawaj nagrody wstępne", "Wołaj raz, potem linka"],
        noGos: ["Wołać wielokrotnie bez reakcji", "Zwiększać rozproszenie za szybko"],
      },
      {
        title: "Gwizdek jako drugi sygnał",
        intro: "Gwizdek niesie się daleko, brzmi zawsze tak samo i nie da się go „zatruć”.",
        steps: [
          { name: "Właściwy gwizdek", desc: "ACME 211.5 lub podobny gwizdek dla psów. Zawieszka przy obroży, żebyś zawsze miał go przy sobie. Nie za przenikliwy, wyraźnie gwizdalny." },
          { name: "Warunkuj w domu", desc: "W domu: gwizdnij wyraźny podwójny ton (krótko-krótko lub długo-krótko), od razu jackpot. {dogName} łączy: „gwizdek = smakołyk”." },
          { name: "5-7 powtórzeń na sesję", desc: "Na sesję 5-7 powtórzeń gwizdek-nagroda, 2 sesje dziennie, przez tydzień. Warunkowanie musi siedzieć głęboko." },
          { name: "Na zewnątrz z linką", desc: "Przenieś na zewnątrz: linka przypięta, gwizdek: {dogName} przychodzi: mega-jackpot. Gwizdek to nowe, świeże skojarzenie." },
          { name: "Nigdy do rzeczy negatywnych", desc: "Gwizdka NIGDY nie wolno używać do zapinania smyczy, kąpieli, weterynarza. Jest wyłącznie pozytywnym sygnałem zapasowym." },
          { name: "Po 4 tygodniach pewniejszy", desc: "Gwizdek po 4 tygodniach jest pewniejszy niż głos. Brzmi zawsze tak samo (niezależnie jak sfrustrowany jesteś) i niesie się 200m+. Narzędzie awaryjne nr 1." },
        ],
        frequency: ["W domu 2 sesje/dzień przez tydzień", "Potem z linką na zewnątrz", "Nigdy nie nadużywaj"],
        watchFor: ["Jeden gwizdek dla wszystkich członków rodziny", "Nigdy do rzeczy negatywnych"],
        gos: ["Zawsze ten sam podwójny ton", "Mega nagroda przy dotarciu"],
        noGos: ["Gwizdek przy wizycie u weterynarza", "Gwizdać wielokrotnie bez reakcji"],
      },
      {
        title: "Nagroda trzystopniowa",
        intro: "Różne poziomy nagrody dla różnych trudności.",
        steps: [
          { name: "Zdefiniuj trzy poziomy", desc: "CODZIENNE przywołanie (lekkie rozproszenie): normalna nagroda 2-3 smakołyki. JACKPOT (średnio trudne): 5-7 wartościowych smakołyków. AWARIA (skrajnie trudne): 10+ mega nagroda." },
          { name: "Codzienne przywołania na spacer", desc: "3-5 codziennych przywołań na spacer. Proste sytuacje, normalna nagroda. {dogName} uczy się: przywołanie jest normalne i zdarza się często." },
          { name: "Jackpot za sukces przy rozproszeniu", desc: "Gdy {dogName} opanuje wymagającą sytuację (inny pies 50m, sarna w zasięgu wzroku): mega nagroda 7-10 smakołyków. Wyczyn kosztuje." },
          { name: "Oszczędzaj słowo awaryjne", desc: "Dodatkowe słowo (własne) rezerwujesz wyłącznie na sytuacje awaryjne. Nigdy nie używaj na co dzień, inaczej traci magię." },
          { name: "Regularnie testuj słowo awaryjne", desc: "1x w miesiącu „ćwiczebna awaria”: w rozluźnionej sytuacji zawołaj słowo awaryjne, MEGA-jackpot z 15 smakołyków. Tak pozostaje zwarunkowane." },
          { name: "Konsekwentnie trzymaj hierarchię nagród", desc: "Nigdy nie marnuj nagrody awaryjnej na co dzień. Nigdy nie używaj codziennej nagrody w awarii. Poziomy są święte." },
        ],
        frequency: ["Codzienne przywołania: 3-5x na spacer", "Słowo awaryjne: testuj 1x w miesiącu"],
        watchFor: ["Ściśle trzymaj hierarchię wartości", "Trzymaj słowo awaryjne osobno"],
        gos: ["Jasno rozdzielaj poziomy", "Oszczędnie używaj słowa awaryjnego"],
        noGos: ["Słowo awaryjne nadużywane", "Nagradzać wszystkie przywołania tak samo"],
      },
      {
        title: "Pierwsze kontrolowane wolne bieganie",
        intro: "Gdy wszystko wcześniej działa: pierwsza ostrożna faza wolnego biegania.",
        steps: [
          { name: "Wybierz najbezpieczniejszą strefę", desc: "Ogrodzone wybiegisko dla psów, leśna polana daleko od ulicy. Topograficznie najbezpieczniejsza opcja, jaką znasz." },
          { name: "Odłóż linkę, nie zdejmuj", desc: "Linka pozostaje przy szelkach, ale upuszczasz ją na ziemię. {dogName} może biegać swobodnie 10m, ma jednak zabezpieczenie (możesz nadepnąć na linkę)." },
          { name: "Po 1-2 min przywołanie", desc: "Pierwszy test: po 1-2 min wolności DO MNIE + gwizdek (oba sygnały jednocześnie pierwszy raz). Przy niezawodnym przywołaniu w 5 sekund: kontynuuj." },
          { name: "Przy nieprzyjściu: w tył", desc: "Gdy {dogName} nie przychodzi: NATYCHMIAST wróć do fazy linki. 2 kolejne tygodnie linki, potem ponowny test. Cierpliwość się opłaca." },
          { name: "Na wolne bieganie maks 15-20 min", desc: "Pierwsze wolne biegania nie dłuższe niż 15-20 min. Na każde wpleć 3-4 przywołania, wszystkie z jackpotem. Zakończ, zanim {dogName} się zmęczy." },
          { name: "Nigdy przy ulicach", desc: "Niezależnie jak dobre jest przywołanie: NIGDY wolne bieganie w pobliżu ulic, w nieznanych okolicach, przy dużej ilości zwierzyny. Bezpieczeństwo zawsze przed wygodą." },
        ],
        frequency: ["1-2 wolne biegania w tygodniu, krótko", "Nigdy przy ulicach, nigdy dłużej niż 20 min"],
        watchFor: ["Bezpieczne otoczenie jako obowiązek", "Przy nieprzyjściu od razu wróć do linki"],
        gos: ["Preferuj ogrodzoną strefę", "Linka jako pomost bezpieczeństwa"],
        noGos: ["Wolne bieganie przy ulicach", "Przy niepowodzeniu próbować dalej"],
      },
      {
        title: "Konserwacja na całe życie",
        intro: "Dobre przywołanie potrzebuje regularnej konserwacji, inaczej blednie.",
        steps: [
          { name: "Na spacer 2-3 przywołania", desc: "Nawet gdy przywołanie od miesięcy działa niezawodnie: na spacer wpleć co najmniej 2-3 przywołania, zawsze z nagrodą. To utrzymuje skojarzenie świeżym." },
          { name: "Utrzymuj wartościową nagrodę", desc: "Nigdy nie schodź do suchej karmy jako nagrody za przywołanie. To podkopuje wartość. Kurczak, ser, wartościowe smakołyki pozostają standardem." },
          { name: "Co miesiąc nowa trasa", desc: "1x w miesiącu nowa trasa na test przywołania. Generalizację trzeba pielęgnować, inaczej działa tylko w znanych miejscach." },
          { name: "Corocznie odświeżaj słowo awaryjne", desc: "Sygnał awaryjny co 3-6 miesięcy testuj w rozluźnionej sytuacji i dawaj JACKPOT. Tak pozostaje gotowy do użycia, gdy naprawdę go potrzebujesz." },
          { name: "Przy cofnięciu się od razu reaguj", desc: "Gdy {dogName} raz nie przyjdzie: NIE odkładaj linki na stałe. Tydzień z powrotem na lince, potem nowa próba. Bez lęku przed chwilowymi cofnięciami." },
          { name: "Przywołanie z przytrzymaniem jako doładowanie", desc: "Co kilka miesięcy wpleć sesję przywołania z przytrzymaniem z pomocnikiem. To ogromnie napędza entuzjazm i odświeża skojarzenie." },
        ],
        frequency: ["Konserwacja na całe życie", "Co najmniej 2-3 przywołania na spacer"],
        watchFor: ["Utrzymuj wysoki poziom nagrody", "Pielęgnuj generalizację"],
        gos: ["Regularna konserwacja", "Utrzymuj wartościową nagrodę"],
        noGos: ["Uważać przywołanie za oczywiste", "Zmniejszać lub pomijać nagrodę"],
      },
    ],
    abschluss: {
      title: "Zakończenie",
      subtitle: "Powodzenia",
      paras: [
        "Niezawodne przywołanie to najważniejsza polisa na życie twojego psa. {dogName} może mieć wolność tylko wtedy, gdy naprawdę wraca — wszystko inne to ryzyko.",
        "Sekretem jest cierpliwość plus wartościowa nagroda. Nigdy nie przechodź na tańsze smakołyki, nigdy nie uważaj przywołania za oczywiste. Z każdym życzliwie odpowiedzianym przywołaniem utrwalasz skojarzenie.",
        "Używaj linki dłużej, niż myślisz. Opiekunowie psów często zbyt szybko przeskakują do wolnego biegania. Kto używa linki 2-3 miesiące dłużej, ma przywołanie niezawodne w 100% zamiast 80%.",
        "Gwizdek to twoje narzędzie awaryjne. Pielęgnuj go co miesiąc, nigdy o nim nie zapominaj. Gdy nadejdzie dzień, w którym {dogName} znika w wysokiej trawie i niemal wpadasz w panikę — ten gwizdek cię uratuje.",
      ],
    },
  },

  barking: {
    coverTitle: "Plan przeciw szczekaniu dla",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Dlaczego ten plan jest zbudowany właśnie tak",
      subtitle: "Spokój zamiast ciągłego hałasu",
      paras: [
        "{dogName} szczeka za dużo. To nie oznaka dominacji ani złośliwości, lecz prawie zawsze reakcja na bodźce, frustrację, potrzebę uwagi lub niepewność.",
        "Szczekanie ma bardzo różne przyczyny: dzwonek, odgłosy na klatce schodowej, inne psy w ogrodzie, samotność, frustracja na smyczy. Każda przyczyna wymaga własnej odpowiedzi.",
        "Największe nieporozumienie: krzyk NIE zatrzymuje szczekania. Wręcz przeciwnie, dla psa brzmi to jak wspólne szczekanie. U {dogName} każda reakcja na szczekanie wzmacnia to zachowanie.",
        "Ten plan buduje ciszę jako wartościowe zachowanie. Nagradzamy fazy milczenia, ustalamy alternatywy dla dzwonka i systematycznie rozłączamy reakcje na wyzwalacze. Cierpliwie, bez presji.",
      ],
    },
    how: {
      title: "Jak prawidłowo wykonywać ćwiczenia",
      paras: [
        "Najpierw zidentyfikuj wyzwalacze. Kiedy {dogName} szczeka najczęściej? Dzwonek do drzwi, okno, frustracja, samotność? Na każdą przyczynę jest inna technika.",
        "Nagradzaj milczenie aktywnie. Psy szybciej uczą się, co mają DOSTAĆ, niż czego mają ZANIECHAĆ. Każda cisza 5-10-sekundowa dostaje cichy marker CISZA ze smakołykiem.",
        "Bądź konsekwentny w swojej reakcji: szczekanie jest całkowicie ignorowane (odwrócenie się, brak kontaktu wzrokowego). Fazy milczenia są nagradzane. Po 2-3 tygodniach {dogName} uczy się: „Szczekanie nic nie daje. Milczenie daje smakołyk”.",
        "Konsekwencja rodziny jest obowiązkowa. Członek rodziny, który przy szczekaniu przytula lub krzyczy, sabotuje całą pracę. Odprawa na początku, wszyscy się przyłączają.",
      ],
    },
    exercises: [
      {
        title: "Prowadź dziennik wyzwalaczy",
        intro: "Zanim zredukujesz szczekanie, musisz wiedzieć, kiedy i dlaczego się zdarza.",
        steps: [
          { name: "Przygotuj notes", desc: "Zeszycik A5 lub aplikacja do notatek w telefonie. Ważne: szybko dostępny, gdy tylko zaczyna się szczekanie." },
          { name: "Notuj wszystkie epizody szczekania przez 7 dni", desc: "Na epizod: data, godzina, wyzwalacz (dzwonek, odgłos, pies za oknem), czas trwania w minutach, twoja reakcja." },
          { name: "Zidentyfikuj wzorce", desc: "Po 7 dniach przeanalizuj: 3 najczęstsze wyzwalacze, typowe pory dnia, typowy czas trwania. To twoje punkty ciężkości treningu." },
          { name: "Priorytetyzuj główne wyzwalacze", desc: "Zidentyfikuj 1-2 główne wyzwalacze (np. dzwonek + pies za oknem). Nimi zajmujemy się najpierw. Rzadkie wyzwalacze przychodzą później." },
          { name: "Oceń reakcję uczciwie", desc: "Jak sam obecnie reagujesz? Krzyczysz? Przytulasz? Ignorujesz? Notuj uczciwie. Często własna reakcja jest częścią problemu." },
          { name: "Prowadź dziennik dalej w fazie 2", desc: "Po pierwszych 2 tygodniach treningu: prowadź dziennik ponownie. Porównaj częstotliwość. Tak obiektywnie widzisz, czy trening działa." },
        ],
        frequency: ["Dokumentuj konsekwentnie przez 7 dni", "Po 2 tygodniach treningu przeanalizuj ponownie"],
        watchFor: ["Uczciwość jest ważna", "Notuj też mini-epizody"],
        gos: ["Notuj od razu po epizodzie", "Szukaj wzorców"],
        noGos: ["Liczyć tylko „duże” epizody", "Przemilczać własną reakcję"],
      },
      {
        title: "Ustal marker ciszy",
        intro: "Milczenie staje się nagradzaną czynnością. Warunkowanie przez tygodnie.",
        steps: [
          { name: "CISZA jako nowe słowo-marker", desc: "Wybierz słowo, które rzadko pada na co dzień. CISZA lub CICHO nadają się dobrze. To słowo od teraz łączy się z nagrodą za ciszę." },
          { name: "Rozpoznaj 5-sekundową ciszę", desc: "Obserwuj {dogName} świadomie: 5 sekund bez szczekania, bez skomlenia, bez jęczenia. Właśnie w tym momencie jest czas na nagrodę." },
          { name: "Powiedz cicho CISZA + smakołyk", desc: "W momencie ciszy: powiedz cicho CISZA, połóż miękki smakołyk między przednie łapy. Spokojnie, bez ekscytacji." },
          { name: "Przez 1 tydzień codziennie 8-10 razy", desc: "Dziennie 8-10 takich nagród za ciszę. Konsekwentnie. {dogName} uczy się: cisza = czasem pojawia się coś dobrego." },
          { name: "Wydłużaj czas ciszy", desc: "Po 1 tygodniu: poczekaj 10 sek, zanim powiesz CISZA. Potem 20 sek, 30 sek, 1 min. Przez 3 tygodnie zwiększaj do 1-2 minut ciszy." },
          { name: "Nigdy nie wołaj „cicho”, gdy szczeka", desc: "WAŻNE: CISZA nigdy jako sygnał-stop, gdy {dogName} już szczeka. To zatruwa skojarzenie. CISZA pada tylko za ciszę, nie jako korekta." },
        ],
        frequency: ["8-10 nagród dziennie", "Wydłużaj ciszę przez 3 tygodnie"],
        watchFor: ["Nigdy nie używaj CISZA jako przekleństwa", "Nagradzaj cicho i spokojnie"],
        gos: ["Cichy marker, miękki smakołyk", "Konsekwentnie przez tygodnie"],
        noGos: ["Mówić CISZA podczas szczekania", "Nagradzać wysokim głosem (pobudza)"],
      },
      {
        title: "Rutyna dzwonek-mata",
        intro: "Gdy dzwoni, {dogName} biegnie na matę zamiast do drzwi. Pawłow dla początkujących.",
        steps: [
          { name: "Mata w stałym miejscu", desc: "Mata 3m od drzwi wejściowych, w spokojnym miejscu. Ta mata od teraz łączy się z dzwonkiem." },
          { name: "Nagranie dzwonka w telefonie", desc: "Nagraj dźwięk waszego prawdziwego dzwonka (nagraj w telefonie). Potrzebujesz tego dokładnego dźwięku do warunkowania." },
          { name: "Ćwiczenia na sucho w domu", desc: "Odtwarzaj nagranie dzwonka cicho: od razu prowadź {dogName} na matę: smakołyk na macie. 10 powtórzeń na sesję, 2 sesje/dzień." },
          { name: "Zwiększaj głośność", desc: "Przez 1 tydzień stopniowo zwiększaj głośność dzwonka, zawsze z tym samym przebiegiem. Dzwonek: mata: nagroda." },
          { name: "Prawdziwy dzwonek z pomocnikiem", desc: "Po 2 tygodniach: pomocnik dzwoni z zewnątrz, {dogName} powinien automatycznie biec na matę. Przy sukcesie: MEGA-jackpot." },
          { name: "Rutyna przy prawdziwych gościach", desc: "Gdy przychodzą prawdziwi goście: dzwonek: mata: {dogName} zostaje leżeć, gość wchodzi, ignoruje go przez pierwsze 2 min. Dopiero wtedy {dogName} może wstać i przyjaźnie przywitać." },
        ],
        frequency: ["Buduj 2 sesje/dzień w domu", "Utrwalaj przez 2-3 tygodnie", "Prawdziwe testy dzwonka z pomocnikiem"],
        watchFor: ["Spójne zwiększanie głośności", "Nigdy nie nagradzaj przy drzwiach"],
        gos: ["Mata = bezpieczne miejsce nagrody", "Konsekwentnie doprowadzaj do końca"],
        noGos: ["Rejon drzwi jako strefa nagrody", "Niekonsekwencja przy prawdziwych gościach"],
      },
      {
        title: "Zagłodź szczekanie o uwagę",
        intro: "Gdy {dogName} szczeka, by zdobyć uwagę, ignorowanie to jedyne rozwiązanie.",
        steps: [
          { name: "Rozpoznaj szczekanie o uwagę", desc: "To szczekanie o uwagę, gdy {dogName} patrzy na ciebie przy szczekaniu, wchodzi w twoje pole widzenia, domaga się. ŻADNEGO prawdziwego wyzwalacza na zewnątrz — wyzwalaczem jesteś ty." },
          { name: "Całkowite odwrócenie się", desc: "Gdy tylko zaczyna się szczekanie o uwagę: odwróć się plecami, żadnego kontaktu wzrokowego, żadnego dźwięku. Właśnie nie istniejesz dla {dogName}." },
          { name: "Poczekaj na 5 sek ciszy", desc: "Odwracasz się z powrotem dopiero, gdy {dogName} przez 5 sek nie szczekał. Gdy jest cisza: odwróć się, spokojne cześć." },
          { name: "Przy ponownym szczekaniu od razu precz", desc: "Gdy szczekanie znów się zaczyna: od razu znów odwróć się plecami. Konsekwentnie, za każdym razem. {dogName} uczy się: „Szczekanie = opiekun odchodzi”." },
          { name: "Spodziewaj się szczytu zagłodzenia", desc: "WAŻNE: W pierwszych 3-7 dniach szczekanie często robi się GORSZE, nie lepsze. To „wybuch wygaszania”. Kto tu ustąpi, przegrał. Wytrwaj." },
          { name: "Po 2 tygodniach wymiernie mniej", desc: "Gdy konsekwencja rodziny jest konsekwentna, szczekanie o uwagę zmniejsza się po 2-3 tygodniach wymiernie. Odprawa rodziny jest decydująca." },
        ],
        frequency: ["Przy każdym szczekaniu o uwagę", "Konsekwencja rodziny codziennie"],
        watchFor: ["Nie mylnie odczytuj szczytu zagłodzenia", "Jedno ustępstwo kosztuje 1 tydzień"],
        gos: ["Całkowicie odwróć się, żadnego słowa", "Nagradzaj ciszę"],
        noGos: ["Krzyczeć", "Ustępować po dłuższym szczekaniu"],
      },
      {
        title: "Przeciwwarunkowanie na bodźce z zewnątrz",
        intro: "Gdy {dogName} szczeka przy oknie lub w ogrodzie: zmień skojarzenie emocjonalne.",
        steps: [
          { name: "Zidentyfikuj strefę widoku", desc: "Gdzie {dogName} zwykle szczeka? Okno na ulicę, balkon, płot ogrodowy. Te miejsca to punkty krytyczne." },
          { name: "Słoik z nagrodami w zasięgu", desc: "Umieść słoik z wartościowymi smakołykami bezpośrednio przy strefie szczekania. Musisz móc dać smakołyk w ciągu 2 sekund, gdy pojawia się bodziec." },
          { name: "Bodziec się pojawia: smakołyk", desc: "Gdy tylko pojawia się potencjalny wyzwalacz szczekania (człowiek za oknem, pies przy płocie): NATYCHMIAST daj smakołyk. NIE czekaj, czy {dogName} zaszczeka." },
          { name: "Bodziec znika: smakołyk znika", desc: "Gdy bodziec znika, kończy się też nagroda. {dogName} łączy: „Bodziec jest = coś dobrego. Bodziec zniknął = nic”. Skojarzenie emocjonalne się zmienia." },
          { name: "Przy szczekaniu NIE nagradzaj", desc: "Gdy {dogName} już zaczyna szczekać, ZANIM zdążysz dać smakołyk: żadnej nagrody. Musisz być szybszy niż szczekanie. Przy pojawieniu bodźca działaj od razu." },
          { name: "Skojarzenie przez 3-4 tygodnie", desc: "Konsekwentnie przez tygodnie zmienia się reakcja emocjonalna {dogName}. Bodziec = oczekiwanie smakołyka, nie szczekanie ze stresu. To przeciwwarunkowanie." },
        ],
        frequency: ["Przy każdym bodźcu w krytycznych miejscach", "Konsekwentnie przez 3-4 tygodnie"],
        watchFor: ["Bądź szybszy niż szczekanie", "Nigdy nie nagradzaj szczekania"],
        gos: ["Słoik ze smakołykami w zasięgu", "Reaguj od razu na bodziec"],
        noGos: ["Nagradzać po rozpoczęciu szczekania", "Ignorować wyzwalacz w nadziei"],
      },
      {
        title: "Zredukuj szczekanie z frustracji",
        intro: "Niektóre psy szczekają z frustracji. Rozwiązanie: budowanie tolerancji na frustrację.",
        steps: [
          { name: "Rozpoznaj szczekanie z frustracji", desc: "Szczekanie z frustracji zdarza się, gdy {dogName} czegoś nie może/nie wolno mu: wiewiórka poza zasięgiem, inny pies za płotem, zamknięte drzwi do kuchni. {dogName} piszczy-szczeka z oczekiwania." },
          { name: "Ustal sygnał CZEKAJ", desc: "W domu: przed jedzeniem powiedz CZEKAJ, ręka przed miską, poczekaj 5 sek, potem ZWOLNIENIE i jedzenie. Zwiększaj do 10, 20, 30 sek przez 2 tygodnie." },
          { name: "Przy szczekaniu podczas CZEKAJ", desc: "Gdy {dogName} podczas czekania szczeka: cofnij rękę, żadnego ZWOLNIENIA. Gdy 3 sek spokojnie: dopiero wtedy rozwiązanie." },
          { name: "CZEKAJ w codziennych sytuacjach", desc: "Przenieś na wyzwalacze frustracji: CZEKAJ przy drzwiach do kuchni, CZEKAJ przy smyczy przed spacerem, CZEKAJ przed zabawką. 5-7 mini-sytuacji dziennie." },
          { name: "Tolerancja na frustrację rośnie przez tygodnie", desc: "Po 3-4 tygodniach {dogName} rozumie: „Szczekanie nie prowadzi mnie do celu. Spokojne czekanie prowadzi mnie do celu”. Szczekanie z frustracji wymiernie się zmniejsza." },
          { name: "Nigdy nie ustępuj przy szczekaniu", desc: "Najważniejszy punkt: NIGDY nie ustępuj szczekaniu z frustracji. Gdy {dogName} szczeka, a ty wtedy otwierasz drzwi lub dajesz zabawkę, wzmocniłeś szczekanie." },
        ],
        frequency: ["5-7 mini-CZEKAJ dziennie", "Buduj przez 3-4 tygodnie"],
        watchFor: ["Nigdy przy szczekaniu nie otwieraj celu", "CZEKAJ musi kończyć się pozytywnie (rozwiązanie)"],
        gos: ["CZEKAJ jako pozytywny sygnał", "Konsekwencja przy szczekaniu z frustracji"],
        noGos: ["Rozwiązywać podczas szczekania", "Krzyczeć przy szczekaniu"],
      },
      {
        title: "Rutyna drzwi przy gościach",
        intro: "Prawdziwa sekwencja przyjmowania gości, która rozbraja szczekanie.",
        steps: [
          { name: "Poinstruuj gości z wyprzedzeniem", desc: "Powiedz gościom przed ich przyjściem: „Proszę ignorować {dogName}, dopóki nie powiem, że jest ok”. Żadnego głaskania, żadnego patrzenia, żadnego zagadywania." },
          { name: "Dzwonek: mata (wyćwiczona rutyna)", desc: "Przy prawdziwym dzwonku: {dogName} biegnie na matę (ćwiczone w ćwiczeniu 3). Idziesz do drzwi, otwierasz spokojnie, witasz gościa cicho." },
          { name: "Gość wchodzi, ignoruje {dogName}", desc: "Gość idzie spokojnie do salonu, siada, ignoruje {dogName} na macie. {dogName} zostaje leżeć, co 30 sek smakołyk." },
          { name: "Po 5 min spokojnego leżenia: zwolnienie", desc: "Gdy {dogName} leży spokojnie 5 minut: sygnał OK, może ostrożnie podejść do gościa. Gdy zrywa się lub szczeka: z powrotem na matę." },
          { name: "Gość głaszcze tylko przy SIAD", desc: "Gdy {dogName} podchodzi do gościa: powiedz SIAD. Dopiero gdy spokojnie siedzi, gość może głaskać. Przy skakaniu: gość odwraca się." },
          { name: "Utrwalaj rutynę przez wielu gości", desc: "Ćwicz przez 4-6 tygodni z różnymi gośćmi. Staje się to normalnością. {dogName} wie: „Dzwonek = mata, potem spokojne cześć”." },
        ],
        frequency: ["Przy każdej zaplanowanej wizycie gości", "Utrwalaj przez kilka tygodni"],
        watchFor: ["Odprawa gości jest decydująca", "Konsekwencja przy każdej wizycie"],
        gos: ["Informuj gości z wyprzedzeniem", "Mata = standard powitania"],
        noGos: ["Goście reagują na szczekanie", "Pozwalać witać się od razu przy wejściu"],
      },
      {
        title: "Higiena stresu przeciw nawrotom szczekania",
        intro: "Szczekanie wraca, gdy rośnie ogólny poziom stresu. Zapobieganie zamiast reakcji.",
        steps: [
          { name: "Zidentyfikuj czynniki stresu", desc: "Co stresuje {dogName}? Mało snu, za dużo akcji, nowi członkowie rodziny, przeprowadzka, choroba. Gdy poziom stresu rośnie, szczekanie wraca." },
          { name: "Pielęgnuj higienę snu", desc: "Dorosłe psy potrzebują 16-20h odpoczynku dziennie. Gdy {dogName} śpi mniej, jest bardziej reaktywny. Planuj świadome fazy spokoju, nawet gdy jest przebudzony." },
          { name: "Zrównoważ aktywności", desc: "Nigdy nie piętrz kilku silnie ekscytujących aktywności w jednym dniu. Wizyta w parku + goście + długi spacer to przeciążenie. Na dzień maks 2 prawdziwe atrakcje." },
          { name: "Zasada 72 godzin stresu", desc: "Po stresującym wydarzeniu (weterynarz, eskalacja, przeprowadzka): 72 godziny świadomie spokojnych dni. Żadnego treningu przeciw szczekaniu w tym czasie. Hormony stresu muszą opaść." },
          { name: "Odpowiednie ogólne zajęcie", desc: "Wystarczająco pracy węchowej, pracy głową, kontaktu społecznego. Niedociążony pies szczeka więcej. Plan dnia: 1 fizyczna, 1 węchowa, 1 umysłowa." },
          { name: "Przy fali szczekania ogranicz rutynę", desc: "Gdy szczekanie nagle znów się zaczyna: nie panikuj. Sprawdź czynniki stresu, uspokój rutynę, przez 2 tygodnie jedź „czysto”. Potem się normalizuje." },
        ],
        frequency: ["Konserwacja na całe życie", "Przy ostrej fali szczekania sprawdź rutynę"],
        watchFor: ["Stres kumuluje się przez dni", "Higiena snu często niedoceniana"],
        gos: ["Proaktywnie redukuj czynniki stresu", "Planuj sen"],
        noGos: ["W fazie stresu więcej treningu", "Ignorować szczekanie jako objaw"],
      },
    ],
    abschluss: {
      title: "Zakończenie",
      subtitle: "Powodzenia",
      paras: [
        "Szczekanie to komunikacja. {dogName} ma powody, dla których szczeka — bodziec, frustracja, lęk, uwaga. Twoim zadaniem nie jest „uciszyć go”, lecz zająć się właściwą przyczyną.",
        "Nagradzanie ciszy to najważniejszy filar. Psy szybciej uczą się, co mają DOSTAĆ, niż czego mają ZANIECHAĆ. Każda faza ciszy kończąca się smakołykiem buduje rutynę.",
        "Konsekwencja rodziny jest wszystkim. Osoba, która przy szczekaniu przytula lub krzyczy, sabotuje całą pracę. Odprawa na początku, wszyscy się przyłączają. Przez tygodnie to się opłaca.",
        "Gdy szczekanie znów się pojawia, spójrz na ogólny poziom stresu. Często szczekanie to objaw przeciążenia lub niedociążenia. Dzięki higienie snu i zrównoważonemu zajęciu pozostaje stabilnie.",
      ],
    },
  },

  jumping: {
    coverTitle: "Plan przeciw skakaniu dla",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Dlaczego ten plan jest zbudowany właśnie tak",
      subtitle: "Spokojne powitania zamiast chaosu",
      paras: [
        "{dogName} skacze na ludzi, w przyjaznym zamiarze, ale to nieprzyjemne. To nie błąd wychowawczy, lecz brak kontroli impulsów plus prosta logika: skakanie w przeszłości przynosiło uwagę.",
        "Psy są mistrzami w odczytywaniu ludzkich reakcji. Także karcenie, odpychanie czy głośne „PUŚĆ” to dla {dogName} uwaga. Uwaga wzmacnia to zachowanie, choć wcale tego nie chcesz.",
        "Z {dogName} pracujemy dokładnie na odwrót: 4 łapy na ziemi przynoszą nagrodę, skakanie nie przynosi NIC. Dajesz lepszą alternatywę.",
        "Ten plan buduje rutynę systematycznie: najpierw u ciebie samego, potem z rodziną, potem z zapowiedzianymi gośćmi, potem z obcymi przechodniami. Cierpliwie, konsekwentnie, przyjaźnie.",
      ],
    },
    how: {
      title: "Jak poprawnie wykonywać ćwiczenia",
      paras: [
        "Konsekwencja to wszystko. Osoba, która raz przy skakaniu głaszcze z myślą „przecież robi to miło”, sabotuje tydzień postępów. Odprawa rodziny na początku jest obowiązkowa.",
        "SIAD jako alternatywa powitania to najważniejszy filar. {dogName} nie może jednocześnie siedzieć i skakać. Dajemy mu zachowanie, które wyklucza skakanie.",
        "Goście muszą zostać poinstruowani. Powiedz odwiedzającym wcześniej: „Proszę, ignoruj {dogName}, dopóki nie usiądzie.” Na początku wydaje się to niegrzeczne, ale chroni trening.",
        "Głaskanie jest nagrodą. Gdy {dogName} siedzi, człowiek go głaszcze. Gdy {dogName} skacze, odwróć się plecami, żadnej uwagi. Jasno, konsekwentnie, tak samo z każdą osobą.",
      ],
    },
    exercises: [
      {
        title: "Ustanowienie zasady 4 łap",
        intro: "Kontakt z ziemią staje się standardową nagrodą. Skakanie nie przynosi nic.",
        steps: [
          { name: "Włącz tryb obserwacji", desc: "Przez 1-2 dni świadomie zwracaj uwagę na każdy moment, w którym {dogName} cię wita. Kiedy skacze, a kiedy stoi spokojnie? Zapisz typowe wyzwalacze." },
          { name: "Przy każdym spotkaniu sprawdź 4 łapy", desc: "Wracasz do domu, wchodzisz do pokoju, wracasz do kuchni. ZA KAŻDYM razem: czy {dogName} ma 4 łapy na ziemi? Jeśli tak: NATYCHMIAST kucnij, spokojne cześć, ciche głaskanie." },
          { name: "Przy skakaniu: odwróć się plecami", desc: "Gdy tylko przednie łapy pójdą w górę: obrót o 180 stopni, wzrok w bok, żadnego dźwięku. W tej chwili nie istniejesz. ŻADNEGO „PUŚĆ”, żadnego odpychania — to jest uwaga." },
          { name: "4 łapy z powrotem = znów uwaga", desc: "Gdy tylko 4 łapy wrócą na ziemię: obróć się, spokojne cześć. {dogName} uczy się błyskawicznie: „Skakanie = opiekun odchodzi. Stanie = cześć.”" },
          { name: "Odprawa rodziny w dniu 1", desc: "Wszyscy domownicy dostają wyjaśnioną zasadę. Naklejka na drzwiach mieszkania: „4 łapy = tak. Skakanie = odwrócenie.” Niekonsekwencja JEDNEJ osoby sabotuje wszystko." },
          { name: "Po 2-3 tygodniach konsekwencji", desc: "Gdy wszyscy się przyłączą: skakanie zmniejsza się mierzalnie po 2-3 tygodniach. Droga to nie „wyłączyć skakanie”, lecz „uczynić 4 łapy standardowym powitaniem”." },
        ],
        frequency: ["Stosuj przy każdym spotkaniu", "Konsekwencja rodziny codziennie"],
        watchFor: ["Niekonsekwencja kosztuje tygodnie", "Nigdy nie „pozwól czasem miło skoczyć”"],
        gos: ["Odwrócenie plecami przy skakaniu", "Konsekwentne nagradzanie 4 łap"],
        noGos: ["Krzyczeć „PUŚĆ” (to uwaga)", "Odpychać kolanem"],
      },
      {
        title: "SIAD jako alternatywa powitania",
        intro: "Zamiast tylko zapobiegać skakaniu: zaproponuj pożądane zachowanie.",
        steps: [
          { name: "SIAD musi być pewny", desc: "Warunek: SIAD na zwykły sygnał jest pewny w 8 na 10 prób. Jeśli nie, najpierw to utrwal, potem ćwiczenie przeciw skakaniu." },
          { name: "Przy spotkaniach mów SIAD", desc: "Przy spotkaniach (rodzina, goście, spacerowicze): powiedz SIAD, ZANIM człowiek znajdzie się w zasięgu skoku. {dogName} dostaje zadanie." },
          { name: "Przy siedzeniu: człowiek głaszcze", desc: "{dogName} siedzi: natychmiast BRAWO, głaskanie, cicha nagroda. Człowiek staje się źródłem nagrody, a nie rampą do skoku." },
          { name: "Przy wstawaniu do skoku: koniec głaskania", desc: "Gdy tylko {dogName} wstaje lub skacze: człowiek odwraca się, koniec głaskania. Gdy tylko znów SIAD: zwróć się, głaskanie dalej." },
          { name: "Poinstruuj też gości", desc: "Wcześniej poinstruuj gości: „Głaszczesz tylko, gdy siedzi. Gdy wstaje: odwróć się.” Pisemna wskazówka przy wejściu pomaga przy zapominalskich gościach." },
          { name: "Przez tygodnie automatycznie", desc: "Po 3-4 tygodniach SIAD staje się automatyczną rutyną powitania. {dogName} siada sam z siebie, bo to strategia, która się opłaca." },
        ],
        frequency: ["Przy każdym spotkaniu", "Przez 3-4 tygodnie do rutyny"],
        watchFor: ["SIAD musi być bardzo stabilny jako warunek", "Nie zapomnij o odprawie gości"],
        gos: ["SIAD przed każdym cześć", "Konsekwentnie instruuj gości"],
        noGos: ["Zostawiać SIAD bez nagrody", "Przy wstawaniu głaskać dalej"],
      },
      {
        title: "Oddramatyzowanie własnej rutyny powitania",
        intro: "To, jak sam zachowujesz się po powrocie do domu, ogromnie kształtuje skakanie.",
        steps: [
          { name: "Choreografia powrotu do domu", desc: "Otwierasz drzwi, spokojnie wchodzisz, zdejmujesz buty, odkładasz torbę — wszystko BEZ patrzenia na {dogName}. Nawet gdy podekscytowany skacze: ignoruj." },
          { name: "Uwaga dopiero po 2 min", desc: "Żyj dalej normalnie — idź do kuchni, zrób sobie herbatę, odłóż płaszcz. Dopiero gdy {dogName} się uspokoi, podchodzisz do niego." },
          { name: "Powitanie przy ziemi", desc: "Kucnij (lub usiądź), {dogName} podchodzi do ciebie. 4 łapy na ziemi? SIAD? Wtedy spokojnie głaszcz. Tak unikasz zachęt do skoku w górę." },
          { name: "Spokojny głos", desc: "Witaj {dogName} niskim, spokojnym głosem. ŻADNEGO podekscytowanego „Gdzie jest mój skarb!” To go nakręca. Nisko i ciepło: „No cześć.”" },
          { name: "Rodzina uczy się nawzajem", desc: "Członkowie rodziny przypominają sobie nawzajem. „Hej, znów przywitałeś wysokim głosem — dlatego on tak skacze.” Szczera informacja zwrotna daje postęp." },
          { name: "Przez tygodnie powitanie staje się zwyczajne", desc: "Po 4-6 tygodniach spokojnej rutyny: {dogName} jest mniej podekscytowany przy powrocie do domu, bo to już nie emocjonalny szczyt." },
        ],
        frequency: ["Przy każdym powrocie do domu", "Spójność w rodzinie"],
        watchFor: ["Tłumić własne podekscytowanie", "Rodzina uczy się nawzajem"],
        gos: ["Niski, spokojny głos", "Witać na wysokości ziemi"],
        noGos: ["Rozentuzjazmowane „Gdzie jest mój skarb”", "Przytulanie od razu na stojąco"],
      },
      {
        title: "Rutyna dzwonka i gości",
        intro: "Przy gościach skakanie staje się szczególnie intensywne. Budujemy jasną sekwencję.",
        steps: [
          { name: "Mata 3m od drzwi wejściowych", desc: "Mata jest umieszczona 3m od drzwi, w spokojnym miejscu. Ta mata staje się miejscem przyjmowania gości." },
          { name: "Dzwonek = mata (wyćwiczona rutyna)", desc: "Gdy dzwoni: {dogName} biegnie na matę (wcześniej wypracowane w ćwiczeniach na sucho). Przy sukcesie: smakołyk na macie." },
          { name: "Gość wchodzi, ignoruje {dogName}", desc: "Otwierasz drzwi, gość wchodzi. Gość został wcześniej poinstruowany: NIE zagadywać, NIE patrzeć, NIE schylać się do {dogName}. Idzie prosto do salonu." },
          { name: "Po 2-3 min spokojnego leżenia: OK", desc: "Gdy {dogName} pozostał 2-3 min spokojnie na macie: sygnał OK, może iść do gościa. Jeśli nie: z powrotem na matę, nowa 1 min przerwy." },
          { name: "Gość głaszcze tylko przy SIAD", desc: "Gdy {dogName} jest przy gościu: sygnał SIAD. Przy siedzeniu: spokojne głaskanie. Przy wstawaniu: koniec głaskania, gość odwraca się." },
          { name: "Utrwalanie rutyny z wieloma gośćmi", desc: "Ćwicz z różnymi gośćmi przez 4-6 tygodni. Różne typy ludzi, różne energie. {dogName} uczy się: to dotyczy wszystkich, nie tylko rodziny." },
        ],
        frequency: ["Przy każdej wizycie gości", "Utrwalać przez 4-6 tygodni"],
        watchFor: ["Odprawa gości jest obowiązkowa", "Niekonsekwencja JEDNEGO gościa kosztuje ćwiczenie"],
        gos: ["Mata = standard przyjmowania", "Wcześniej jasno instruować gości"],
        noGos: ["Pozwalać witać gości prosto przy wejściu", "„Czasem” przepuszczać skakanie"],
      },
      {
        title: "Przechodnie podczas spaceru",
        intro: "Skakanie na zewnątrz jest delikatne. Nie każdy chce przyjaznego psa na płaszczu.",
        steps: [
          { name: "Obserwacja 1: kiedy skacze?", desc: "Podczas 2-3 spacerów obserwuj: na jakich ludzi skacze {dogName}? Mężczyźni? Kobiety? Dzieci? Wzrost? Kapelusz na głowie?" },
          { name: "Przed spotkaniem SIAD", desc: "Gdy przechodzień wchodzi w pole widzenia (10-15m), daj sygnał SIAD PRZY swojej nodze. {dogName} siada, nagroda smakołykiem." },
          { name: "Utrzymanie podczas mijania", desc: "Gdy człowiek przechodzi obok: {dogName} zostaje w siadzie, nagradzasz co 5 sek mini-smakołykiem. Uwaga jest przy tobie, nie przy przechodniu." },
          { name: "Poinstruuj przechodnia", desc: "Jeśli człowiek wydaje się zainteresowany: „Proszę, ignoruj go, właśnie trenujemy.” Większość ludzi to szanuje." },
          { name: "Po minięciu: idź dalej", desc: "Gdy tylko przechodzień jest 5m za wami: BRAWO, idźcie dalej. Przerwa na węszenie jako nagroda bonusowa." },
          { name: "Przez tygodnie siad staje się odruchem", desc: "Po 4-6 tygodniach {dogName} siada sam z siebie, gdy nadchodzi przechodzień. Przechodnie stają się normalną rutyną, a nie okazją do skoku." },
        ],
        frequency: ["Przy każdym spotkaniu na spacerze", "Automatyzować przez 4-6 tygodni"],
        watchFor: ["Instruować przechodniów z szacunkiem", "Przy skakaniu zwiększyć dystans"],
        gos: ["SIAD przed każdym spotkaniem", "Wartościowa nagroda pod ręką"],
        noGos: ["Pozwalać przechodniom wchodzić w interakcję z {dogName}", "Karcić przy skakaniu"],
      },
      {
        title: "Ćwiczenie samouspokajania",
        intro: "Psy, które skaczą, są często ogólnie nakręcone. Budujemy zdolność do spokoju.",
        steps: [
          { name: "Ustanowienie maty spokoju", desc: "Mata w spokojnym miejscu, którą {dogName} zna. Jest zarezerwowana na fazy spokoju, nie do zabawy." },
          { name: "Przed spodziewanym podekscytowaniem", desc: "Zanim przyjdą goście, zanim wyjdziesz, zanim wydarzy się coś ekscytującego: zaprowadź {dogName} na 10 min na matę. Usiądź obok, oddychaj spokojnie, dawaj co 60 sek miękki smakołyk za spokojne leżenie." },
          { name: "Rozpoznaj podekscytowanie jako wyzwalacz", desc: "Rozdrażnienie przed spotkaniami pojawia się często już PRZED właściwym skokiem. {dogName} zaczyna wcześniej robić się nerwowy. Właśnie wtedy ważne jest ćwiczenie spokoju." },
          { name: "WSPANIALE jako marker", desc: "Powiąż słowo takie jak WSPANIALE z momentami spokoju. Gdy {dogName} spokojnie leży: powiedz cicho WSPANIALE, miękki smakołyk. Przez tygodnie słowo staje się kotwicą przeciw skakaniu." },
          { name: "Wyciszenie po spotkaniach", desc: "Po intensywnych spotkaniach: 5-10 min wyciszenia na macie. {dogName} uczy się, że po podekscytowaniu następuje spokój — a nie kolejna akcja." },
          { name: "Przez tygodnie obniża się poziom dnia", desc: "Po 4-6 tygodniach konsekwentnej pracy nad spokojem ogólny poziom pobudzenia {dogName} w ciągu dnia jest niższy. Zachowanie przeciw skakaniu wychodzi ze spokojniejszej bazy." },
        ],
        frequency: ["Zaplanuj codzienne ćwiczenia spokoju", "Przed i po spotkaniach"],
        watchFor: ["Spokój wymaga ćwiczenia jak wszystko inne", "Marker WSPANIALE stosować oszczędnie"],
        gos: ["Pielęgnować matę spokoju", "Codzienne wyciszenia"],
        noGos: ["Po podekscytowaniu od razu znów aktywować", "Używać markera nadmiernie"],
      },
      {
        title: "Dzieci i lękliwi ludzie",
        intro: "Przy dzieciach lub niepewnych ludziach skakanie jest szczególnie delikatne.",
        steps: [
          { name: "Zidentyfikuj osoby narażone na skok", desc: "Dzieci, osoby starsze, lękliwi ludzie, osoby w stroju biznesowym. Przy nich skakanie jest szczególnie niestosowne i może wyrządzić szkodę." },
          { name: "Natychmiast SIAD + strumień smakołyków", desc: "Gdy osoba ryzyka w polu widzenia: SIAD, wartościowe smakołyki co 3-5 sek dla {dogName}. Maksymalne zajęcie tobą, minimalna dostępność do skakania." },
          { name: "Utrzymuj dystans", desc: "Przy tych osobach: zachowaj 3-5m odstępu. Nikt nie musi być witany. Jeśli nie jesteś pewien: po prostu obejdź łukiem, żadnego dramatu." },
          { name: "Przy zbliżeniu: unikaj", desc: "Gdy ktoś podchodzi do ciebie z zamiarem głaskania: uprzejmie, ale stanowczo powiedz „Proszę nie, on właśnie ćwiczy.” Większość ludzi to rozumie." },
          { name: "Przy dzieciach: pytaj wcześniej", desc: "Gdy dziecko chce pogłaskać {dogName}: najpierw ustanów SIAD, potem zapytaj rodziców, potem dopiero spokojne głaskanie. Żadnej dzikiej zabawy, żadnego rozentuzjazmowania." },
          { name: "Miej plan na najgorszy przypadek", desc: "Jeśli {dogName} mimo wszystko na kogoś skoczy: spokojnie przeproś, odprowadź {dogName}, nie wpadaj w tyradę. Po sytuacji: krótka przerwa, potem kontynuuj normalny trening." },
        ],
        frequency: ["Przy spotkaniach ryzyka zawsze", "Świadomie utrzymywać dystans"],
        watchFor: ["Pytać rodziców przy dzieciach", "Komunikować z wyprzedzeniem"],
        gos: ["Dystans jako ochrona", "Uprzejmie, ale jasno komunikować"],
        noGos: ["Pozwalać dzieciom głaskać niepewne psy", "Z grzeczności „przepuszczać” skakanie"],
      },
      {
        title: "Ustanowienie rutyny podtrzymującej",
        intro: "Gdy skakanie zniknie: regularnie odświeżaj, inaczej wróci.",
        steps: [
          { name: "Utrzymuj rutynę w codzienności", desc: "Nawet gdy {dogName} od miesięcy już nie skacze: konsekwentnie utrzymuj nagrodę za 4 łapy w codzienności. Inaczej zachowanie powoli eroduje." },
          { name: "Odprawy rodziny co 2-3 miesiące", desc: "Regularnie przypominaj rodzinie: żadnych obejść do starego zachowania. Instruuj też starszych członków rodziny, którzy czasem przychodzą z wizytą." },
          { name: "Przy nowych członkach rodziny", desc: "Nowy partner, współlokator, dzieci: od razu włącz do treningu przeciw skakaniu. Inaczej skakanie wróci przez nich." },
          { name: "Ćwiczenia odświeżające 1x w miesiącu", desc: "1x w miesiącu świadoma sesja SIAD-przy-powitaniu z członkiem rodziny. 5 min, wartościowa nagroda. To utrzymuje powiązanie świeżym." },
          { name: "Przy nawrocie: 1 tydzień ekstra-konsekwentnie", desc: "Gdy {dogName} znów skoczy: prowadź 1 tydzień ekstra-konsekwentnie. Nigdy nie akceptuj „no po prostu się zdarzyło”. Konsekwencja znaczy: za każdym razem." },
          { name: "Wbuduj testy stresu", desc: "Co 4-6 tygodni świadome testy stresu: wizyta wielopokoleniowa, dzieci, ekscytujący gość. Jeśli {dogName} pod stresem pozostaje spokojny: rutyna jest naprawdę utrwalona." },
        ],
        frequency: ["Podtrzymanie na całe życie", "Testy stresu co 4-6 tygodni"],
        watchFor: ["Nigdy nie odhaczać jako „załatwione”", "Nowych członków rodziny od razu włączać"],
        gos: ["Konsekwencja w codzienności", "Regularne ćwiczenia odświeżające"],
        noGos: ["Gdy nie skacze, pomijać nagrodę", "Unikać testów stresu z wygody"],
      },
    ],
    abschluss: {
      title: "Zakończenie",
      subtitle: "Powodzenia",
      paras: [
        "Skakanie to wyuczone zachowanie — i tak samo można się nauczyć, że już się nie zdarza. {dogName} potrzebuje jasnych zasad i lepszej alternatywy (SIAD), wtedy sam poukłada to zachowanie na nowo.",
        "Konsekwencja rodziny to najważniejszy filar. Pies, który u mamy nie może skakać, ale u taty tak, będzie zdezorientowany i nie wykształci rutyny. Wszyscy się przyłączają, albo będzie trudno.",
        "Goście to prawdziwy sprawdzian. Poinstruuj ich wcześniej, powieś kartkę na drzwiach, bądź uprzejmie stanowczy. Większość ludzi to rozumie i szanuje zasadę.",
        "Utrzymuj rutynę także po sukcesie, przez całe życie. Skakanie jest tylko o jedną niekonsekwencję od powrotu. Dzięki codziennej nagrodzie za 4 łapy i regularnym testom stresu zachowanie pozostaje stabilne.",
      ],
    },
  },

  destructive: {
    coverTitle: "Plan przeciw niszczeniu dla",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Dlaczego ten plan jest zbudowany właśnie tak",
      subtitle: "Lepsze alternatywy zamiast zakazów",
      paras: [
        "{dogName} niszczy rzeczy: buty, poduszki, krawędzie mebli, kable telewizora. To nie „zachowanie na złość”, lecz prawie zawsze ma konkretną przyczynę: nudę, potrzebę gryzienia, lęk separacyjny lub niewykorzystaną energię.",
        "Rozpoznanie przyczyny to 50% rozwiązania. Młode psy w okresie wymiany zębów mają potrzebę gryzienia. Niedostatecznie zajęte psy się nudzą. Zestresowane psy mają zachowania antystresowe.",
        "Z {dogName} nie pracujemy karą (przychodzi za późno i niszczy zaufanie), lecz zarządzaniem, alternatywami i wystarczającym zajęciem.",
        "Ten plan buduje się systematycznie: analiza przyczyn, ustanowienie dozwolonych obiektów do gryzienia, zarządzanie podczas nieobecności, zwiększenie zajęcia umysłowego. Cierpliwie, bez konfliktu.",
      ],
    },
    how: {
      title: "Jak poprawnie wykonywać ćwiczenia",
      paras: [
        "Zacznij od analizy przyczyn, zanim przejdziesz do działania. Co, kiedy, jak? Dopiero wtedy wiesz, gdzie jest dźwignia.",
        "Rotuj obiekty do gryzienia. 4-5 różnych naturalnych gryzaków, warianty Kong, maty węchowe. Nie wszystkie naraz — rotacja utrzymuje wysoką atrakcyjność.",
        "Zarządzanie to nie poddanie się, lecz rozsądek. Dopóki trening jest jeszcze w budowie, buty trafiają do szafy, kable do kanału kablowego, strefy ryzyka są chronione.",
        "Nigdy nie karć po fakcie. Gdy po godzinach znajdziesz zniszczoną rzecz, {dogName} nie potrafi tego powiązać z czynem. Karcenie tworzy tylko stres, który paradoksalnie wzmacnia niszczenie.",
      ],
    },
    exercises: [
      {
        title: "Przeprowadzenie analizy przyczyn",
        intro: "Dlaczego {dogName} niszczy? Dopiero gdy to jasne, można pomóc celowo.",
        steps: [
          { name: "Co jest niszczone?", desc: "Buty + rzeczy osobiste: najczęściej związane z zapachem (temat więzi). Meble + dywany: potrzeba gryzienia. Drzwi + ramy okienne: najczęściej lęk separacyjny." },
          { name: "Kiedy jest niszczone?", desc: "Tylko podczas twojej nieobecności: podejrzenie lęku separacyjnego. Także gdy jesteś obecny: nuda lub potrzeba gryzienia. W nocy: ewentualnie stres z miejscem do spania lub gryzienie po przebudzeniu." },
          { name: "Uwzględnij wiek i rasę", desc: "Młode psy (4-9 miesięcy) są w okresie wymiany zębów — potrzeba gryzienia jest normalna. Niektóre rasy (teriery, owczarki) mają wyższy popęd do gryzienia." },
          { name: "Bilans zajęcia", desc: "Ile godzin ruchu dziennie? Ile pracy umysłowej (zabawa w szukanie, sztuczki)? Ile snu? Niedostatecznie zajęty pies niszczy, bo energia musi wyjść." },
          { name: "Dokumentuj przez tydzień", desc: "Dziennik przez 7 dni: co zostało zniszczone, kiedy, co się wcześniej wydarzyło. Wzorce zwykle szybko stają się widoczne." },
          { name: "Wybierz priorytet", desc: "Na podstawie analizy: przeciw lękowi separacyjnemu, przeciw nudzie lub zarządzanie potrzebą gryzienia. Na psa często 1-2 główne przyczyny, którymi zajmujemy się równolegle." },
        ],
        frequency: ["7 dni dokumentacji", "Cotygodniowa ocena"],
        watchFor: ["Kilka przyczyn często się łączy", "Szczerość przy bilansie zajęcia"],
        gos: ["Prowadzić dziennik konsekwentnie", "Szukać wzorców"],
        noGos: ["Zakładać, że to „na złość”", "Bez analizy „po prostu trenować”"],
      },
      {
        title: "Ustanowienie dozwolonych obiektów do gryzienia",
        intro: "Zaspokajanie potrzeby gryzienia jasnym asortymentem zamiast zakazywania.",
        steps: [
          { name: "Zdobądź 5-6 różnych gryzaków", desc: "Naturalne gryzaki (skóra bawola, penisy wołowe), Kong Classic, mata węchowa, kość z drewna naturalnego, poroże, korzenie do gryzienia. Różnorodność utrzymuje atrakcyjność." },
          { name: "Zbuduj system rotacji", desc: "Dziennie 1-2 obiekty dostępne, resztę odłóż. Po 2-3 dniach rotacja. Tak wszystkie obiekty pozostają ciekawe, nic się nie nudzi." },
          { name: "Umożliw długie sesje gryzienia", desc: "15-30 min sesji gryzienia dziennie. Ten czas działania jest kluczowy — krócej = brak efektu na potrzebę gryzienia. {dogName} musi naprawdę wykonać pracę szczękami." },
          { name: "Zakazany obiekt: zamiana zamiast karcenia", desc: "Gdy przyłapiesz {dogName} z butem: spokojnie pokaż smakołyk na wymianę, powiedz PUŚĆ, przy oddaniu BRAWO + zaproponuj dozwolony gryzak. Nigdy nie karć ani nie szarp." },
          { name: "Nigdy kości ze skóry surowej", desc: "Kości ze skóry surowej grożą urazem i zadławieniem. Trzymaj się naturalnych gryzaków ze sklepu specjalistycznego. Poroże jest dobre, ale może złamać zęby — ostrożnie." },
          { name: "Przez tygodnie obniża się potrzeba", desc: "Po 4-6 tygodniach z aktywnym asortymentem gryzaków niszczenie innych obiektów zmniejsza się mierzalnie. Potrzeba jest zaspokojona, koniec z frustracją." },
        ],
        frequency: ["Codzienne sesje gryzienia", "Rotacja co 2-3 dni"],
        watchFor: ["Nigdy skóra surowa", "Jakość ważniejsza niż ilość"],
        gos: ["Pielęgnować rotację", "Umożliwiać długie sesje"],
        noGos: ["Kości ze skóry surowej", "Karcić przy zakazanym obiekcie"],
      },
      {
        title: "Urządzenie stref zarządzania",
        intro: "Gdy bez nadzoru: bezpieczny obszar, żadnej możliwości niszczenia.",
        steps: [
          { name: "Zidentyfikuj strefy ryzyka", desc: "Korytarz z butami, salon z kablem telewizora, biuro z papierem. Są krytyczne, tu często dochodzi do niszczenia." },
          { name: "Wyznacz bezpieczną strefę", desc: "Kuchnia z bramką zabezpieczającą, jeden pokój, kojec. Tu nie ma nic do zniszczenia. {dogName} dostaje swoje dozwolone gryzaki i wodę." },
          { name: "Zbuduj kojec jako pozytywną strefę", desc: "Jeśli używasz kojca: warunkuj pozytywnie. Zostaw otwarte drzwi, włóż ulubiony Kong, {dogName} może wchodzić/wychodzić. Nigdy jako kara." },
          { name: "Przy nieobecności: bezpieczna strefa", desc: "Gdy wychodzisz: {dogName} w bezpiecznej strefie, z gryzakiem lub Kongiem. Żadnej pokusy do niszczenia, żadnej traumy przez karcenie po fakcie." },
          { name: "Ograniczaj też przy obecności", desc: "Gdy bierzesz prysznic lub gotujesz i nie możesz wszędzie patrzeć: {dogName} w bezpiecznej strefie. Lepiej zamknięte drzwi niż pies swobodnie w strefie ryzyka." },
          { name: "Przez tygodnie poszerzaj strefy", desc: "Gdy {dogName} przez 2-3 tygodnie nie niszczy: ostrożnie poszerzaj strefy. Znów niszczenie? Wróć do mniejszej strefy." },
        ],
        frequency: ["Stała rutyna", "Stosować przy każdej nieobecności"],
        watchFor: ["Nigdy jako kara", "Warunkować pozytywnie"],
        gos: ["Bezpieczną strefę urządzić przytulnie", "Zamknięte drzwi w fazach ryzyka"],
        noGos: ["Kojec jako miejsce kary", "Udostępniać całe mieszkanie bez nadzoru"],
      },
      {
        title: "Podwojenie zajęcia umysłowego",
        intro: "Zmęczona psia głowa = spokojne łapy. Zajęcie to najważniejszy filar.",
        steps: [
          { name: "Ułóż plan zajęcia", desc: "Dziennie: 1 spacer (30-60 min ze zmianami tempa), 1 praca węchowa (zabawa w szukanie, tropienie), 1 praca umysłowa (sztuczka, Kong). Plus 2-3x w tygodniu kontakt społeczny." },
          { name: "Zabawa w szukanie zamiast miski", desc: "Sucha karma nie z miski, lecz rozrzucona po mieszkaniu lub w macie węchowej. 20-30 min pracy węchowej zamiast 30 sek połykania." },
          { name: "Kong jako zamiennik posiłku", desc: "1 posiłek dziennie z Konga (mokra karma, zamrożona). {dogName} pracuje 30-60 min w skupieniu, potem jest zmęczony." },
          { name: "Sztuczki kształtowane dla pracy umysłowej", desc: "5-7 min sesji kształtowania dziennie: nauka nowej sztuczki (łapka, obrót, dotyk). Wymagające umysłowo, męczy." },
          { name: "Tropienie na zewnątrz", desc: "1-2 razy w tygodniu: 15-20m ślad ze smakołyków na spokojnej łące. {dogName} podąża węsząc. 15-minutowy ślad jest bardziej męczący niż 30 min tępego chodzenia." },
          { name: "Wieczorne zmęczenie jako wskaźnik", desc: "Gdy {dogName} wieczorem jest wyraźnie zmęczony i dobrowolnie odpoczywa — zajęcie pasuje. Gdy nadal się wierci — potrzeba więcej pracy umysłowej." },
        ],
        frequency: ["Codzienna rutyna zajęcia", "Na każdy filar (ruch/węch/głowa) codziennie coś"],
        watchFor: ["Jakość > ilość", "Praca umysłowa często niedoceniana"],
        gos: ["Mieszanka 3 filarów", "Posiłki jako zajęcie"],
        noGos: ["Tylko tępe chodzenie", "Traktować zajęcie jako „opcjonalne”"],
      },
      {
        title: "Handel wymienny zamiast kary",
        intro: "Gdy {dogName} zostanie przyłapany z zakazanym obiektem: spokojna wymiana, żadnego dramatu.",
        steps: [
          { name: "Nie biegnij za nim", desc: "Gdy {dogName} ma but: NIGDY nie biegnij za nim. To dla niego przyjemność zabawy i mocno wzmacnia podnoszenie rzeczy." },
          { name: "Podejdź spokojnie, pokaż wymianę", desc: "Weź wartościowy smakołyk na wymianę (kurczak, ser), podejdź spokojnie do {dogName}, z boku, nie z przodu." },
          { name: "Powiedz PUŚĆ, poczekaj", desc: "PUŚĆ spokojnym głosem, smakołyk widoczny blisko jego nosa. Poczekaj 2-3 sek. {dogName} rozważa: but czy smakołyk?" },
          { name: "Przy oddaniu: BRAWO + wymiana", desc: "Gdy tylko {dogName} puści: BRAWO, smakołyk, potem zaproponuj DOZWOLONY gryzak. But cicho sprzątasz, bez dramatu." },
          { name: "Nigdy nie szarp", desc: "NIGDY ręka do pyska, nigdy nie szarp. To zatruwa sygnał PUŚĆ na całe życie i może prowadzić do obrony zasobów." },
          { name: "Nigdy nie karć po fakcie", desc: "Gdy po godzinach znajdziesz zniszczoną rzecz: NIE karć, NIE wciskaj nosa. {dogName} nie potrafi tego powiązać. Tworzysz tylko stres." },
        ],
        frequency: ["Przy każdym przyłapanym incydencie", "Ustanowić rutynę"],
        watchFor: ["Mieć wartościową nagrodę pod ręką", "Zachować własny spokój"],
        gos: ["Spokojnie wymieniać", "Proponować dozwolony gryzak"],
        noGos: ["Biec za nim", "Karcić po fakcie"],
      },
      {
        title: "Przygotowanie czasu samotności z Kongiem",
        intro: "Gdy przyczyną jest lęk separacyjny: Kong czyni czas samotności znośnym.",
        steps: [
          { name: "Przygotuj specjalny Kong", desc: "Napełnij Kong mokrą karmą, kawałkami kurczaka, serem. Zamroź na 4-6 godzin. Ten Kong istnieje TYLKO podczas twojej nieobecności." },
          { name: "Rytuał przekazania", desc: "Tuż przed wyjściem: daj Kong na stałe miejsce (mata, kojec). {dogName} ma rzucić się na Kong, a nie na twoje pożegnanie." },
          { name: "Wychodź mimochodem", desc: "Żadnego dramatu przy wychodzeniu. Otwórz drzwi, wyjdź, zamknij drzwi. Maksymalnie 5 sek między przekazaniem Konga a zamkniętymi drzwiami." },
          { name: "Kontroluj przez wideo", desc: "Ustaw kamerę smartfona. Sprawdzaj co 5-10 min: czy {dogName} pracuje przy Kongu? Czy potem odpoczywa? Czy mimo to niszczy?" },
          { name: "Przy niszczeniu mimo Konga: inna przyczyna", desc: "Gdy {dogName} ignoruje Kong i zamiast tego niszczy: prawdopodobnie lęk separacyjny zbyt wysoki. Wtedy przejdź na ścieżkę przeciw lękowi, krótsze czasy samotności." },
          { name: "Zabierz Kong po powrocie", desc: "Gdy wrócisz: spokojnie zabierz Kong, nawet jeśli jest jeszcze zawartość. Kong to narzędzie wyłącznie na czas samotności, nie na wspólny czas." },
        ],
        frequency: ["Przy każdej planowanej nieobecności", "Zamrażać zapas Kongów"],
        watchFor: ["Kontrola wideo jako prawda", "Przy stresie sprawdzić inną przyczynę"],
        gos: ["Kong tylko na czas samotności", "Wychodzić i wracać mimochodem"],
        noGos: ["Dramat przy wychodzeniu", "Przy stresie zostawać dłużej"],
      },
      {
        title: "Budowanie długich faz leżenia",
        intro: "Psy, które niszczą, potrzebują często więcej treningu spokoju, nie mniej akcji.",
        steps: [
          { name: "Ustanowienie maty spokoju", desc: "Mata w spokojnym miejscu, NIE w przejściu. Tu trenuje się spokój, nie zabawę." },
          { name: "Codzienna rutyna maty", desc: "Dziennie 2-3 razy: 10-15 min czasu na macie. {dogName} leży na macie, jesteś obok lub pracujesz w pobliżu. Co 1-2 min miękki smakołyk za spokojne leżenie." },
          { name: "Kong podczas czasu na macie", desc: "Połącz z zajęciem Kongiem: włóż Kong, {dogName} pracuje przy nim spokojnie 30-60 min. Potem często od razu zasypia." },
          { name: "Pielęgnuj higienę snu", desc: "Dorosłe psy potrzebują 16-20h odpoczynku dziennie. Gdy {dogName} śpi mniej, robi się niespokojny i szuka zajęcia — czasem przez niszczenie." },
          { name: "Spokój przed czasem samotności", desc: "10-15 min fazy spokoju na macie PRZED każdą planowaną nieobecnością. Zmęczony pies + rozluźniony pies = mniejsze ryzyko niszczenia." },
          { name: "Przez tygodnie {dogName} szuka maty", desc: "Po 3-4 tygodniach {dogName} idzie dobrowolnie na matę, gdy szuka spokoju. Mata staje się bezpieczną strefą, a nie miejscem przymusu." },
        ],
        frequency: ["Codzienne czasy na macie", "Przed każdym czasem samotności faza spokoju"],
        watchFor: ["Naprawdę mierzyć sen", "Utrzymywać matę pozytywnie"],
        gos: ["Łączyć z Kongiem", "Spokój przed nieobecnością"],
        noGos: ["Mata jako miejsce kary", "Niedoceniać godzin snu"],
      },
      {
        title: "Zarządzanie fazami stresu",
        intro: "Gdy nadchodzą szczególne fazy: podkręć rutynę, zredukuj ryzyko.",
        steps: [
          { name: "Rozpoznaj fazy stresu", desc: "Przeprowadzka, nowi członkowie rodziny, urlop, choroba, święta. W tych fazach ryzyko niszczenia jest podwyższone." },
          { name: "Podkręć zarządzanie proaktywnie", desc: "Podczas faz stresu: ciaśniejsze strefy, więcej zajęcia gryzieniem, więcej czasu samotności z Kongiem. Lepiej za dużo ochrony niż za mało." },
          { name: "Zaplanuj więcej zajęcia", desc: "Zestresowany pies potrzebuje więcej pracy węchowej, więcej pracy umysłowej. Długie spacery SAME nie wystarczą — wszystkie filary zajęcia muszą być obsłużone." },
          { name: "Utrzymuj rutyny ekstra-ściśle", desc: "Gdy życie jest właśnie chaotyczne, ścisła rutyna dnia dla {dogName} jest podwójnie ważna. Te same pory na spacer, karmienie, sen." },
          { name: "72-godzinna regeneracja po stresie", desc: "Po stresującym wydarzeniu: 72 godziny świadomie spokojnych dni. Żadnych dodatkowych bodźców, żadnych nowych treści treningowych. Hormony stresu muszą opaść." },
          { name: "Przy nawrocie niszczenia sprawdź rutynę", desc: "Gdy {dogName} nagle znów niszczy: nie panikuj. Sprawdź czynniki stresu, podkręć zarządzanie, prowadź spokojniej. Zwykle normalizuje się w 1-2 tygodnie." },
        ],
        frequency: ["Przy każdej fazie stresu", "Przygotowywać proaktywnie"],
        watchFor: ["Stres kumuluje się przez dni", "Rutyna jako stabilizator"],
        gos: ["Podkręcać zarządzanie", "Utrzymywać rutyny ściśle"],
        noGos: ["Prowadzić fazę stresu jako „normalną”", "Zwiększać treści treningowe przy stresie"],
      },
    ],
    abschluss: {
      title: "Zakończenie",
      subtitle: "Powodzenia",
      paras: [
        "Niszczenie to nie wada charakteru. {dogName} reaguje na coś — potrzebę gryzienia, nudę, stres, lęk. Gdy zajmiesz się przyczyną, objaw znika.",
        "Dozwolone gryzaki i zajęcie to dwa najważniejsze filary. Z aktywnym asortymentem i codziennym zajęciem umysłowym niszczenie prawie w ogóle nie występuje.",
        "Zarządzanie to nie poddanie się. Kto sprząta buty, zabezpiecza kable i zamyka strefy ryzyka, chroni zarówno wyposażenie, jak i zaufanie między wami. Kara po fakcie jest zawsze szkodliwa.",
        "Utrzymuj asortyment także po sukcesie, przez całe życie. Młode psy w okresie wymiany zębów to faza. Ale potrzeba gryzienia pozostaje potrzebą przez całe życie. Pielęgnuj rutynę, uwzględnij asortyment gryzaków w miesięcznym budżecie.",
      ],
    },
  },

  soiling: {
    coverTitle: "Plan czystości w domu dla",
    coverImage: null,
    fallbackCoverImage: null,
    why: {
      title: "Dlaczego ten plan jest zbudowany właśnie tak",
      subtitle: "Jasna rutyna, spokojne podejście",
      paras: [
        "{dogName} nie jest niezawodnie czysty w domu. U szczeniąt to normalne i część krzywej uczenia. U dorosłych psów to często kombinacja braku rutyny, stresu lub przyczyny medycznej.",
        "Najpierw ważne: u dorosłych psów z nagłymi wypadkami ZAWSZE najpierw kontrola u weterynarza. Zapalenie pęcherza, nerki, wahania hormonalne mogą być przyczyną. Dopiero gdy medycznie wszystko jest jasne, robimy trening behawioralny.",
        "U {dogName} budujemy czystość w domu przez przewidywalność i nagrodę. Kara nie działa i szkodzi — psy nie rozumieją związku i w przyszłości się chowają.",
        "Ten plan opiera się na 6 filarach: ustanowić rutynę, czytać potrzebę załatwienia, nagradzać we właściwym miejscu, zarządzać wpadkami, redukować stres, powoli redukować częstotliwość. Cierpliwie, bez presji.",
      ],
    },
    how: {
      title: "Jak poprawnie wykonywać ćwiczenia",
      paras: [
        "Najpierw weterynarz. U dorosłych psów, które nagle stają się nieczyste, przyczyna medyczna jest prawdopodobna. U szczeniąt zwykle wystarczy rutyna.",
        "Rutyna to wszystko. 5-7 rund toaletowych dziennie u szczeniąt, 4-5 u młodych psów, 3-4 u dorosłych. Stałe pory: po przebudzeniu, po jedzeniu, po zabawie, po śnie, przed snem.",
        "Nagroda prosto na miejscu i NATYCHMIAST. Gdy {dogName} sika na zewnątrz: NATYCHMIAST BRAWO + wartościowy smakołyk, prosto w miejscu zdarzenia. Opóźnienie 5+ sek nie uczy niczego.",
        "Przy wpadkach: użyj środka enzymatycznego (sklep zoologiczny). Zwykły środek nie usuwa zapachu całkowicie, {dogName} dalej czuje bodziec i sika ponownie w tym samym miejscu.",
      ],
    },
    exercises: [
      {
        title: "Kontrola u weterynarza i podstawowy dziennik",
        intro: "Zanim cokolwiek zaczniesz trenować: pewnie wyjaśnij przyczyny.",
        steps: [
          { name: "Umów wizytę u weterynarza", desc: "U dorosłych psów z problemami nieczystości: najpierw weterynarz. Test moczu, badanie krwi u starszych psów. Często znajduje się uleczalną przyczynę (infekcja, cukrzyca, hormony)." },
          { name: "Zmierz spożycie wody", desc: "Przez tydzień: ile {dogName} pije dziennie? Zaznacz miskę z wodą rano. Nagłe dużo picia może wskazywać na nerki lub cukrzycę." },
          { name: "Dziennik potrzeby załatwienia", desc: "Notuj przez 7 dni: kiedy {dogName} sika/robi kupę? Kiedy zdarzają się wpadki? Kiedy jest na zewnątrz? Wzorce zwykle szybko stają się widoczne." },
          { name: "Zaznacz miejsca wpadek", desc: "Zanotuj, GDZIE w mieszkaniu zdarzają się wpadki. Zawsze to samo miejsce? Możliwe pozostałości zapachu. Zawsze inne? Raczej stres lub zapominalstwo." },
          { name: "Sprawdź czynniki stresu", desc: "Czy coś się zmieniło? Nowy domownik, przeprowadzka, zmiana w rozkładzie dnia, nowy pies w domu? Nieczystość ze stresu jest częsta." },
          { name: "Bilans po 1 tygodniu", desc: "Po 7 dniach zbierania danych: czy to medyczne (diagnoza weterynarza)? Problem rutyny (wzorzec widoczny)? Problem stresu (wyzwalacz jasny)? Z tego wynika priorytet." },
        ],
        frequency: ["7 dni dokumentacji", "Wizyta u weterynarza szybko"],
        watchFor: ["Nigdy nie trenować zachowania zanim weterynarz wyjaśni", "Dokumentować szczerze"],
        gos: ["Najpierw weterynarz", "Zbierać dane"],
        noGos: ["Od razu karcić bez diagnozy", "Zakładać, że to „tylko wychowanie”"],
      },
      {
        title: "Przewidywalna rutyna toaletowa",
        intro: "Przewidywalne pory na załatwienie się ogromnie redukują wpadki.",
        steps: [
          { name: "Stałe pory toaletowe", desc: "U szczeniąt 5-7x dziennie: po przebudzeniu, po jedzeniu (15-30 min później), po zabawie, po śnie, przed snem oraz o stałych porach dnia." },
          { name: "Wychodź punktualnie", desc: "Ustaw budzik na pory toaletowe. Przegapione pory = wyższe ryzyko wpadki. Lepiej 5 min za wcześnie niż 5 min za późno." },
          { name: "To samo miejsce na zewnątrz", desc: "Prowadź {dogName} do stałego miejsca toaletowego: róg ogrodu, spokojny kawałek łąki. Wczorajszy zapach pomaga dzisiaj sikać. Aktywnie pielęgnuj, nie zmieniaj za każdym razem." },
          { name: "Czekaj cierpliwie", desc: "W miejscu toaletowym: daj 5-10 min czasu. Nie rozpraszaj, nie baw się. Po prostu czekaj i daj {dogName} spokój, by się załatwił." },
          { name: "Po sukcesie: nagroda + spacer", desc: "Gdy tylko {dogName} się załatwi: BRAWO, wartościowy smakołyk, spokojna pochwała. Dopiero WTEDY zaczyna się właściwy spacer lub zabawa. Toaleta staje się bramą do nagrody." },
          { name: "Przez 2-3 tygodnie rutyna zostaje przyswojona", desc: "Po 2-3 tygodniach z konsekwentnymi porami {dogName} oczekuje rutyny i załatwia się punktualnie. Wpadki zmniejszają się mierzalnie." },
        ],
        frequency: ["5-7 rund toaletowych dziennie", "Trzymać konsekwentne godziny"],
        watchFor: ["Punktualność to wszystko", "Pielęgnować miejsce toaletowe"],
        gos: ["Budzik na pory toaletowe", "To samo miejsce"],
        noGos: ["Przesuwać pory toaletowe", "Prosto po siku do domu"],
      },
      {
        title: "Nauka czytania potrzeby załatwienia",
        intro: "Kto wcześnie rozpozna, kiedy {dogName} musi, może wyjść na czas.",
        steps: [
          { name: "Włącz tryb obserwacji", desc: "Gdy {dogName} jest przebudzony i porusza się swobodnie: obserwuj świadomie. Jakie zachowania pojawiają się PRZED sikaniem?" },
          { name: "Typowe sygnały wyzwalające", desc: "Węszenie po ziemi, kręcenie się w kółko, nagła niespokojność, patrzenie na drzwi, wycofywanie się, oddalanie się od ciebie. Wszystkie to sygnały poprzedzające." },
          { name: "Natychmiast wychodź przy sygnale", desc: "Gdy tylko pojawi się jeden z tych sygnałów: NATYCHMIAST wyjdź. Nie zakładaj najpierw butów z opóźnieniem. Szybko, szybko. Lepiej wyjść niepotrzebnie niż wpadka." },
          { name: "W ogrodzie/na zewnątrz: do miejsca toaletowego", desc: "Gdy jesteście na zewnątrz: spokojnie prowadź do stałego miejsca toaletowego. Tam czekaj, aż {dogName} się załatwi." },
          { name: "Nagroda na miejscu", desc: "Gdy tylko sukces: BRAWO + mega-nagroda prosto na miejscu. {dogName} kojarzy: „Gdy sikam na zewnątrz we właściwym miejscu, przychodzi coś super.”" },
          { name: "Przez tygodnie stajesz się szybszy", desc: "Po 3-4 tygodniach rozpoznajesz sygnały poprzedzające niemal automatycznie. Reagujesz w ciągu sekund. Wpadki stają się wyjątkiem." },
        ],
        frequency: ["Stała uwaga przy szczeniętach", "Reagować przy każdym sygnale wyzwalającym"],
        watchFor: ["Szybkość jest decydująca", "Lepiej wyjść niepotrzebnie"],
        gos: ["Natychmiast reagować na sygnały", "Mega-nagroda na miejscu"],
        noGos: ["Najpierw zakładać buty, potem iść", "Ignorować sygnały"],
      },
      {
        title: "Nagroda prosto w miejscu toaletowym",
        intro: "Timing decyduje. Nagroda musi przyjść prosto na miejscu i NATYCHMIAST.",
        steps: [
          { name: "ZAWSZE miej smakołyki przy sobie", desc: "Przy każdej rundzie toaletowej: 3-5 wartościowych smakołyków w kieszeni. Kurczak, ser, miękkie smakołyki — coś, co {dogName} naprawdę uwielbia." },
          { name: "Podczas sikania: cicho BRAWO", desc: "Gdy tylko {dogName} zaczyna się załatwiać: cicho i delikatnie powiedz BRAWO, podczas gdy sika. Nigdy na początku, to przeszkadza." },
          { name: "Zaraz po skończeniu: smakołyk", desc: "W chwili, gdy {dogName} skończy: NATYCHMIAST daj smakołyk prosto na miejscu. Nie czekaj kilku sekund. Opóźnienie 5+ sek wyraźnie osłabia powiązanie." },
          { name: "Spokojna pochwała", desc: "Pochwała niskim, spokojnym głosem. Nie nakręcona, inaczej {dogName} się podekscytuje i trudniej będzie mu następnym razem się załatwić." },
          { name: "Czas zabawy jako bonus", desc: "Po nagrodzie zaczyna się dopiero właściwy czas zabawy lub spacer. Tak {dogName} uczy się: toaleta = brama do wszystkiego, co przyjemne." },
          { name: "Przez 2-3 tygodnie się utrwala", desc: "Przy konsekwentnej nagrodzie {dogName} uczy się w 2-3 tygodnie: „Sikanie we właściwym miejscu się opłaca.” Aktywnie szuka nagrody." },
        ],
        frequency: ["Przy każdej udanej rundzie toaletowej", "Utrwalać przez 2-3 tygodnie"],
        watchFor: ["Timing to wszystko", "Używać wartościowej nagrody"],
        gos: ["Nagradzać NATYCHMIAST po siku", "Wartościowy smakołyk"],
        noGos: ["Nagroda dopiero w domu", "Sucha karma jako nagroda"],
      },
      {
        title: "Spokojne zarządzanie wpadkami",
        intro: "Gdy mimo wszystko zdarzy się wpadka: żadnego dramatu, lecz czysta rutyna.",
        steps: [
          { name: "ŻADNEGO karcenia, ŻADNEGO wciskania nosa", desc: "Te metody nie działają i szkodzą. {dogName} nie rozumie związku i w przyszłości się chowa. Jeden z najczęstszych błędów." },
          { name: "Zabierz {dogName} na chwilę z pokoju", desc: "Gdy wpadka jest świeża: spokojnie zabierz {dogName} do ogrodu/innego pokoju. Może jeszcze coś przyjdzie — wtedy nagrodź w miejscu toaletowym." },
          { name: "Sprzątaj środkiem enzymatycznym", desc: "Środek enzymatyczny (sklep zoologiczny) jest obowiązkowy. Zwykły środek NIE usuwa zapachu dla psich nosów całkowicie. {dogName} dalej czuje bodziec i sika ponownie." },
          { name: "Potraktuj miejsce dokładnie", desc: "Nałóż hojnie środek enzymatyczny, pozwól zadziałać (zgodnie z opakowaniem), potem wytrzyj do czysta. Na dywanach potrzeba kilku aplikacji. Niektóre miejsca trzeba potraktować 3-4x." },
          { name: "Wpisz do dziennika", desc: "Zanotuj: kiedy, gdzie, co było wcześniej. Może wzorzec („zawsze, gdy dłużej niż 4h bez spaceru”). Dane pomagają dostosować rutynę." },
          { name: "Dostosuj rutynę, nie karć", desc: "Przy częstych wpadkach: zwiększ częstotliwość rund toaletowych. Przy wpadkach ze stresu: zredukuj czynniki stresu. U młodych psów: częściej na zewnątrz." },
        ],
        frequency: ["Przy każdej wpadce od razu", "Środek enzymatyczny zawsze w zapasie"],
        watchFor: ["Nigdy nie karcić ani karać", "Usunąć zapach całkowicie"],
        gos: ["Używać środka enzymatycznego", "Dostosować rutynę"],
        noGos: ["Karcić lub wciskać nos", "Używać zwykłego środka"],
      },
      {
        title: "Trening nocnego pęcherza",
        intro: "Gdy nocą zdarzają się wpadki: celowa rutyna dla sypialni.",
        steps: [
          { name: "Odstawienie wody 2h przed nocnym spoczynkiem", desc: "Zabierz miskę z wodą 2 godziny przed pójściem spać. {dogName} ma wtedy bardziej pusty pęcherz na noc. WAŻNE: w ciągu dnia zawsze świeża woda dostępna." },
          { name: "Ostatnia runda toaletowa przed snem", desc: "Tuż przed pójściem spać: długa runda toaletowa. Wracaj dopiero, gdy {dogName} naprawdę się załatwił. Lepiej czekać 20 min niż wrócić z pełnym pęcherzem." },
          { name: "Miejsce do spania blisko ciebie", desc: "U szczeniąt: kojec lub koszyk w sypialni, blisko ciebie. Gdy {dogName} nocą się niepokoi, słyszysz to i możesz wyjść." },
          { name: "Przy nocnych sygnałach od razu na zewnątrz", desc: "Gdy {dogName} wstaje, piszczy, niespokojnie się porusza: NIE ignoruj. Od razu wstań i wyjdź do miejsca toaletowego. Nawet o 3 nad ranem." },
          { name: "Budzik na sucho u szczeniąt", desc: "U szczeniąt: w pierwszych tygodniach ustaw budzik, np. o 3 w nocy dodatkowa runda toaletowa. Zapobieganie zamiast reakcji na wpadkę." },
          { name: "Przez tygodnie redukuj częstotliwość", desc: "Po 4-6 tygodniach pojemność pęcherza rośnie. Możesz zredukować nocne budziki. U dorosłych psów cała noc bez wpadki powinna być możliwa." },
        ],
        frequency: ["Codzienna rutyna wieczorna", "U szczeniąt budzik nocny"],
        watchFor: ["Odstawienie wody TYLKO 2h, nigdy dłużej", "Reagować na sygnały nocne"],
        gos: ["Woda 2h przed snem odstawiona", "Długa wieczorna toaleta"],
        noGos: ["Ignorować {dogName} nocą przy niepokoju", "Zabierać wodę całkowicie"],
      },
      {
        title: "Redukcja wpadek związanych ze stresem",
        intro: "Niektóre psy załatwiają się w mieszkaniu ze stresu. Rozwiązanie: zająć się stresem, nie objawem.",
        steps: [
          { name: "Zidentyfikuj wyzwalacze stresu", desc: "Burza? Nowi ludzie? Zmiany w rodzinie? Gdy medycznie wszystko jest ok, a rutyna siedzi, stres często jest przyczyną." },
          { name: "Zredukuj wyzwalacze stresu", desc: "Przy stresie z burzy: rutyna uspokajająca z matą i Kongiem. Przy stresie z wizyt: mniej wizyt lub więcej przygotowania. Przy zmianach rutyny: ekstra-ścisła struktura dnia." },
          { name: "Przy stresie więcej rund toaletowych", desc: "W stresujących fazach: zwiększ częstotliwość. Lepiej co 2h na zewnątrz niż co 4h. Zestresowane psy mają często słabszą kontrolę pęcherza." },
          { name: "Wbuduj rutyny uspokajające", desc: "Praca węchowa, wyciszenie na macie, zajęcie Kongiem — wszystko, co wycisza {dogName}. Obniżyć ogólny poziom stresu." },
          { name: "Pracuj równolegle nad tolerancją na stres", desc: "Wbuduj mini-stresory w codzienność, na których {dogName} może się nauczyć: „Stres potrafię wytrzymać.” Rutyna przeciw nadmiernemu pobudzeniu (bodźce precz, mata, marker)." },
          { name: "Przy przewlekłym stresie: weterynarz", desc: "Gdy stresu nie da się zredukować: włącz weterynarza. Czasem pomaga krótkotrwałe wsparcie medyczne. Także tu obowiązuje: bez wyjaśnienia medycznego nie marnuj miesięcy na trening behawioralny." },
        ],
        frequency: ["Przy fazach stresu od razu podkręcać", "Dostosowywać częstotliwość rutyn"],
        watchFor: ["Stres kumuluje się", "Przy przewlekłym stresie szukać pomocy"],
        gos: ["Pielęgnować rutyny uspokajające", "Zwiększać częstotliwość"],
        noGos: ["Przy stresie więcej presji", "Interpretować nieczystość ze stresu jako „na złość”"],
      },
      {
        title: "Powolna redukcja częstotliwości",
        intro: "Gdy czystość w domu działa: stopniowo redukuj rundy toaletowe.",
        steps: [
          { name: "Warunek: 3-4 tygodnie bez wpadki", desc: "Redukuj dopiero, gdy 3-4 tygodnie z rzędu ŻADNYCH wpadek. Jeśli mimo to jedna się zdarzy: odłóż redukcję." },
          { name: "Pierwsza redukcja: 1 runda mniej", desc: "Zamiast 5 tylko 4 rundy toaletowe dziennie. Która odpada najłatwiej? Zwykle ta między popołudniem a wieczorem, gdy pozostałe dobrze siedzą." },
          { name: "Obserwuj 2 tygodnie", desc: "Na każdą zredukowaną rundę: 2 tygodnie obserwacji. Jeśli brak wpadek: redukuj dalej. Jeśli wpadki: wróć do wyższej częstotliwości na 4 tygodnie." },
          { name: "U szczeniąt: nie za szybko", desc: "Młode psy potrzebują dłużej 5-7 rund. Redukcja dopiero od 6-7 miesięcy. Wcześniej: lepiej za często niż za rzadko." },
          { name: "Norma dla dorosłych: 3-4 rundy", desc: "Zdrowe dorosłe psy potrzebują długoterminowo 3-4 rund toaletowych dziennie. Rano, w południe, wieczorem, przed snem. Wystarcza, gdy pęcherz i trawienie są normalne." },
          { name: "U seniorów: znów podkręcać", desc: "Gdy {dogName} się starzeje (10+): znów zwiększ częstotliwość. Seniorzy mają często słabsze pęcherze i potrzebują więcej rutyny. Dostosowanie to zadanie na całe życie." },
        ],
        frequency: ["Redukcja w krokach 2-tygodniowych", "Nigdy pochopnie"],
        watchFor: ["Seniorzy potrzebują więcej, nie mniej", "Przy wpadce od razu wracać"],
        gos: ["Redukować cierpliwie", "Dostosowywać przy starzeniu się"],
        noGos: ["Redukować za szybko", "Traktować szczenięta jak dorosłe"],
      },
    ],
    abschluss: {
      title: "Zakończenie",
      subtitle: "Powodzenia",
      paras: [
        "Czystość w domu to treść do nauczenia jak wszystko inne — i wymaga czasu, cierpliwości oraz konsekwentnej rutyny. {dogName} nie jest „upartym” psem, lecz jeszcze nie do końca uwarunkowanym. Z właściwą rutyną staje się to oczywiste.",
        "Kontrola u weterynarza na początku to najważniejsza zasada. Dorosłe psy, które nagle stają się nieczyste, mają często przyczynę medyczną. Bez wyjaśnienia marnujesz miesiące na błędny trening.",
        "Kara nie działa i szkodzi. {dogName} nie rozumie związku, uczy się tylko lęku przed tobą i w przyszłości się chowa. Nigdy nie karcić, nigdy nie wciskać nosa. Zamiast tego: rutyna, nagroda, cierpliwość.",
        "Utrzymuj rutynę także po sukcesie. Czystość w domu można stracić, gdy rutyna zniknie. Przy zmianach (przeprowadzka, nowi członkowie rodziny, starzejący się pies) lepiej wcześnie zwiększyć częstotliwość.",
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
    throw new Error(`Nieznany moduleKey: "${moduleKey}". Dostępne: ${Object.keys(MODULES).join(", ")}`);
  }

  if (params.verbose !== false) {
    console.log(`Generuję moduł dodatkowy "${moduleKey}" dla ${DOG_NAME} (${DOG_BREED})…`);
  }

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontReg = await doc.embedFont(readFileSync(ARIMO_REG), { subset: true });
  const fontBold = await doc.embedFont(readFileSync(ARIMO_BOLD), { subset: true });
  const fontItalic = await doc.embedFont(readFileSync(ARIMO_ITALIC), { subset: true });

  const logoBytes = readFileSync(PUBLIC("logo.png"));
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
    const subLabel = "TWÓJ MODUŁ DODATKOWY";
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
    const quoteText = `Każdy pies zasługuje na drogę, która do niego pasuje.`;
    p.drawText(quoteText, {
      x: MARGIN + 28, y: y - 28,
      size: 14, font: fontItalic, color: DARK_BROWN,
    });
    p.drawText(`Ten przygotowaliśmy starannie dla ${DOG_NAME}.`, {
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
    p.drawText("ŁAPA-PLAN", {
      x: MARGIN + 100, y: footerY - 4,
      size: 10.5, font: fontBold, color: GOLD_DARK,
    });
    p.drawText("Moduł treningowy Premium", {
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
    p.drawText(`Ćwiczenie ${i + 1}: ${ex.title}`, {
      x: MARGIN + 32, y: y - 12,
      size: 22, font: fontBold, color: DARK_BROWN,
    });
    y -= 38;

    // Intro-Text
    y = drawParagraph(p, personalize(ex.intro, DOG_NAME), MARGIN, y, LEFT_W, fontReg, 11.5, TEXT_DARK, 16);
    y -= 14;

    // "Schritt für Schritt"
    p.drawText("Krok po kroku", { x: MARGIN, y, size: 14, font: fontBold, color: DARK_BROWN });
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

    sidebarBlock("Jak często i jak długo", ex.frequency || []);
    sidebarBlock("Na co zwracać uwagę", ex.watchFor || []);
    sidebarBlock("Zalecane", ex.gos || [], rgb(60/255, 130/255, 70/255));
    sidebarBlock("Odradzane", ex.noGos || [], rgb(180/255, 60/255, 50/255));
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
      console.log(`✓ PDF zapisany: ${outPath}`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
