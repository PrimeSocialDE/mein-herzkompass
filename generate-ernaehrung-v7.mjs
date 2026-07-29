import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "fs";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const dogName = "Buddy";
const breed = "Labrador";
const weight = "30kg";

const GREEN = rgb(0.176, 0.541, 0.306);
const GREEN_BG = rgb(0.93, 0.97, 0.94);
const GREEN_DARK = rgb(0.106, 0.369, 0.188);
const RED = rgb(0.86, 0.15, 0.15);
const RED_BG = rgb(0.98, 0.93, 0.93);
const BG = rgb(0.976, 0.965, 0.941);
const WHITE = rgb(1, 1, 1);
const TEXT = rgb(0.12, 0.12, 0.12);
const GRAY = rgb(0.5, 0.5, 0.5);
const BROWN = rgb(0.77, 0.65, 0.46);
const YELLOW = rgb(1, 0.85, 0.4);
const BLUE = rgb(0.55, 0.7, 0.9);

const W = 842, H = 595, M = 50;
let doc, font, fontBold, pageCount = 0;

function wrap(str, maxW, size, f) {
  if (!str) return [''];
  const words = str.split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (f.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function newPage() {
  const p = doc.addPage([W, H]);
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BG });
  p.drawRectangle({ x: 0, y: H - 30, width: W, height: 30, color: GREEN });
  p.drawText('Pfoten-Plan  |  Ernährungsplan', { x: W / 2 - 78, y: H - 21, size: 10, font: fontBold, color: WHITE });
  pageCount++;
  return p;
}

function pageNum(p) { p.drawText(String(pageCount), { x: W - M, y: 12, size: 9, font: fontBold, color: GRAY }); }

function titleBar(p, y, title, sub) {
  const bh = sub ? 52 : 38;
  p.drawRectangle({ x: M, y: y - bh, width: W - M * 2, height: bh, color: WHITE });
  p.drawRectangle({ x: M, y: y - bh, width: 4, height: bh, color: GREEN });
  p.drawText(title, { x: M + 16, y: y - 20, size: 16, font: fontBold, color: TEXT });
  if (sub) p.drawText(sub, { x: M + 16, y: y - 38, size: 10, font, color: GRAY });
  return y - bh - 18;
}

// Numbered circle - CENTERED
function numCircle(p, x, y, num, color) {
  p.drawCircle({ x: x, y: y, size: 9, color: color || GREEN });
  const numStr = String(num);
  const tw = fontBold.widthOfTextAtSize(numStr, 8);
  p.drawText(numStr, { x: x - tw / 2, y: y - 3, size: 8, font: fontBold, color: WHITE });
}

async function run() {
  console.log("Generiere Daten...");

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      system: `Erstelle Ernährungsdaten für ${breed} (${weight}). KEIN Markdown. Antworte NUR als JSON:

{
  "intro_titel": "Warum ein Ernährungsplan für ${breed}?",
  "intro_absaetze": ["Absatz 1: 3-4 Sätze warum ein individueller Ernährungsplan für ${breed} wichtig ist. Was passiert bei falscher Ernährung. Wie Ernährung Fell, Energie und Verhalten beeinflusst.", "Absatz 2: 3-4 Sätze was diesen Plan besonders macht. Dass er speziell auf ${breed} mit ${weight} zugeschnitten ist. Konkrete Grammangaben statt pauschaler Tipps.", "Absatz 3: 2-3 Sätze wie man den Plan nutzt. Langsam umstellen über 7 Tage. Bei Fragen Team kontaktieren."],
  "morgens": { "zeit": "7:00-8:00", "futter": "...", "zusatz": "...", "tipp": "..." },
  "mittags": { "zeit": "12:00-13:00", "futter": "...", "zusatz": "...", "tipp": "..." },
  "abends": { "zeit": "18:00-19:00", "futter": "...", "zusatz": "...", "tipp": "..." },
  "portionen": { "trockenfutter": "Xg/Tag", "nassfutter": "Xg/Tag", "misch": "...", "barf": "...", "wasser": "Xml/Tag" },
  "naehrstoffe": [
    { "name": "Protein", "menge": "22-25%", "quellen": "Huhn, Rind, Lachs" },
    { "name": "Fett", "menge": "12-15%", "quellen": "Lachsoel, Huehnerfett" },
    { "name": "Ballaststoffe", "menge": "3-5%", "quellen": "Kuerbis, Karotte" },
    { "name": "Kalzium", "menge": "1-1.8%", "quellen": "Knochen, Huettenkaese" }
  ],
  "snacks": [
    { "name": "...", "menge": "...", "info": "kurz" },
    ... (8 Stueck)
  ],
  "rezepte": [
    { "name": "...", "zutaten": "...", "schritte": ["Schritt1","Schritt2","Schritt3","Schritt4"], "haltbar": "..." },
    ... (5 Stueck, einfache Rezepte)
  ],
  "verboten": [
    { "name": "...", "grund": "1 Satz warum giftig und was passiert", "symptome": "kurze Symptome" },
    ... (10 Stueck, jeweils mit ausfuehrlicher Erklärung)
  ],
  "notfall": ["Schritt1", "Schritt2", "Schritt3", "Schritt4", "Schritt5"],
  "futter_warnung": {
    "trockenfutter_schlecht": ["Zeichen 1 woran man schlechtes Trockenfutter erkennt (1 Satz)", "Zeichen 2", "Zeichen 3", "Zeichen 4", "Zeichen 5"],
    "nassfutter_schlecht": ["Zeichen 1 woran man schlechtes Nassfutter erkennt (1 Satz)", "Zeichen 2", "Zeichen 3", "Zeichen 4", "Zeichen 5"],
    "tipp": "1-2 Saetze was gutes Futter ausmacht"
  },
  "wochenplan": {
    "montag": { "morgens": "...", "abends": "..." },
    "dienstag": { "morgens": "...", "abends": "..." },
    "mittwoch": { "morgens": "...", "abends": "..." },
    "donnerstag": { "morgens": "...", "abends": "..." },
    "freitag": { "morgens": "...", "abends": "..." },
    "samstag": { "morgens": "...", "abends": "..." },
    "sonntag": { "morgens": "...", "abends": "..." }
  },
  "einkaufsliste": {
    "trockenfutter": ["Marke1","Marke2","Marke3"],
    "nassfutter": ["Marke1","Marke2","Marke3"],
    "zusaetze": ["Produkt1","Produkt2","Produkt3"],
    "gemuese": ["Gemuese1","Gemuese2","Gemuese3","Gemuese4","Gemuese5"],
    "obst": ["Obst1","Obst2","Obst3","Obst4"]
  }
}

Alle Werte konkret für ${breed}, ${weight}, erwachsen, normal aktiv.`,
      messages: [{ role: "user", content: `JSON für ${dogName} (${breed}, ${weight}).` }]
    })
  });

  if (!claudeRes.ok) { console.error(await claudeRes.text()); return; }
  const result = await claudeRes.json();
  let jsonText = result.content[0].text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const d = JSON.parse(jsonText);
  console.log("Daten OK, baue PDF...");

  doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const arialBytes = readFileSync('/System/Library/Fonts/Supplemental/Arial.ttf');
  const arialBoldBytes = readFileSync('/System/Library/Fonts/Supplemental/Arial Bold.ttf');
  font = await doc.embedFont(arialBytes);
  fontBold = await doc.embedFont(arialBoldBytes);

  // ===== S1: TITEL =====
  let page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BG });
  page.drawText('PFOTEN-PLAN', { x: M, y: H - 80, size: 11, font: fontBold, color: GREEN });
  page.drawText(dogName + "'s persönlicher", { x: M, y: H - 130, size: 30, font: fontBold, color: TEXT });
  page.drawText("Ernährungsplan", { x: M, y: H - 166, size: 30, font: fontBold, color: TEXT });
  page.drawRectangle({ x: M, y: H - 180, width: 60, height: 3, color: GREEN });
  page.drawText(`${breed}  |  ${weight}  |  Erwachsen`, { x: M, y: H - 200, size: 11, font, color: GRAY });
  [['10', 'Seiten'], ['5', 'Rezepte'], ['8', 'Snacks'], ['7-Tage', 'Wochenplan']].forEach((s, i) => {
    const bx = M + i * 105;
    page.drawRectangle({ x: bx, y: H - 290, width: 90, height: 50, color: WHITE });
    page.drawText(s[0], { x: bx + (s[0].length > 2 ? 18 : 32), y: H - 268, size: 16, font: fontBold, color: GREEN });
    page.drawText(s[1], { x: bx + 15, y: H - 284, size: 8, font, color: GRAY });
  });
  pageCount++;

  // ===== S2: EINLEITUNG =====
  page = newPage();
  let y = titleBar(page, H - 44, d.intro_titel || 'Warum ein Ernährungsplan?', 'Was du wissen solltest');
  y -= 8; // Extra Abstand nach Titel
  const absaetze = d.intro_absaetze || d.intro_punkte || [];
  absaetze.forEach((absatz) => {
    const lines = wrap(absatz, W - M * 2, 11, font);
    lines.forEach((l) => {
      if (y < 50) { pageNum(page); page = newPage(); y = H - 55; }
      page.drawText(l, { x: M, y, size: 11, font, color: GRAY });
      y -= 17;
    });
    y -= 12; // Absatz-Abstand
  });
  pageNum(page);

  // ===== S3: TAGESPLAN =====
  page = newPage();
  y = titleBar(page, H - 44, dogName + "'s Tagesplan", 'Wann, was und wie viel');
  const meals = [
    { label: 'MORGENS', ...d.morgens, color: YELLOW },
    { label: 'MITTAGS', ...d.mittags, color: GREEN_BG },
    { label: 'ABENDS', ...d.abends, color: BLUE }
  ];
  const cw = (W - M * 2 - 20) / 3;
  meals.forEach((meal, i) => {
    const cx = M + i * (cw + 10);
    const ch = 180;
    page.drawRectangle({ x: cx, y: y - ch, width: cw, height: ch, color: WHITE });
    page.drawRectangle({ x: cx, y: y, width: cw, height: 3, color: meal.color });
    page.drawText(meal.label, { x: cx + 10, y: y - 18, size: 11, font: fontBold, color: TEXT });
    page.drawText(meal.zeit, { x: cx + 10, y: y - 32, size: 8, font, color: GRAY });
    let my = y - 50;
    [['Futter', meal.futter], ['Zusatz', meal.zusatz], ['Tipp', meal.tipp]].forEach(([lbl, val]) => {
      page.drawText(lbl + ':', { x: cx + 10, y: my, size: 8, font: fontBold, color: GREEN_DARK });
      my -= 12;
      wrap(val, cw - 20, 8, font).forEach(l => { page.drawText(l, { x: cx + 10, y: my, size: 8, font, color: TEXT }); my -= 10; });
      my -= 6;
    });
  });
  y -= 195;
  // Portionen
  page.drawRectangle({ x: M, y: y - 70, width: W - M * 2, height: 70, color: GREEN_BG });
  page.drawText('Tägliche Portionen', { x: M + 12, y: y - 14, size: 10, font: fontBold, color: GREEN_DARK });
  const pItems = Object.entries(d.portionen);
  pItems.forEach((p2, i) => {
    const px = M + 12 + (i % 3) * 240;
    const py = y - 32 - Math.floor(i / 3) * 16;
    page.drawText(p2[0] + ': ' + p2[1], { x: px, y: py, size: 8, font, color: TEXT });
  });
  pageNum(page);

  // ===== S4: NAEHRSTOFFE =====
  page = newPage();
  y = titleBar(page, H - 44, 'Nährstoffe für ' + breed, 'Was gutes Futter enthalten muss');
  const nw = (W - M * 2 - 15) / 2;
  d.naehrstoffe.forEach((n, i) => {
    const cx = M + (i % 2) * (nw + 15);
    const cy = i < 2 ? y : y - 80;
    page.drawRectangle({ x: cx, y: cy - 65, width: nw, height: 65, color: WHITE });
    page.drawText(n.name, { x: cx + 12, y: cy - 18, size: 13, font: fontBold, color: GREEN_DARK });
    page.drawText(n.menge, { x: cx + nw - 55, y: cy - 18, size: 13, font: fontBold, color: GREEN });
    page.drawText('Quellen: ' + n.quellen, { x: cx + 12, y: cy - 40, size: 9, font, color: GRAY });
  });
  pageNum(page);

  // ===== S5: SNACKS =====
  page = newPage();
  y = titleBar(page, H - 44, 'Gesunde Snacks für ' + dogName, '8 empfohlene Snacks');
  const sw = (W - M * 2 - 10) / 2;
  d.snacks.forEach((s, i) => {
    const cx = M + (i % 2) * (sw + 10);
    const row = Math.floor(i / 2);
    const cy = y - row * 52;
    if (cy < 50) return;
    page.drawRectangle({ x: cx, y: cy - 42, width: sw, height: 42, color: WHITE });
    page.drawText(s.name, { x: cx + 10, y: cy - 14, size: 10, font: fontBold, color: TEXT });
    const mw = fontBold.widthOfTextAtSize(s.menge, 8);
    page.drawText(s.menge, { x: cx + sw - mw - 10, y: cy - 14, size: 8, font: fontBold, color: GREEN });
    page.drawText(s.info, { x: cx + 10, y: cy - 30, size: 8, font, color: GRAY });
  });
  pageNum(page);

  // ===== S6: REZEPTE =====
  page = newPage();
  y = titleBar(page, H - 44, '5 Selbstgemachte Rezepte', 'Einfach, gesund, schnell');
  d.rezepte.forEach((r, ri) => {
    if (y < 130) { pageNum(page); page = newPage(); y = H - 55; }
    const rh = 14 + 14 + r.schritte.length * 18 + 14;
    page.drawRectangle({ x: M, y: y - rh, width: W - M * 2, height: rh, color: WHITE });
    page.drawRectangle({ x: M, y: y - rh, width: 4, height: rh, color: BROWN });
    page.drawText(r.name, { x: M + 14, y: y - 14, size: 12, font: fontBold, color: TEXT });
    page.drawText('Haltbar: ' + r.haltbar, { x: W - M - 130, y: y - 14, size: 8, font, color: GRAY });
    page.drawText('Zutaten: ' + r.zutaten, { x: M + 14, y: y - 30, size: 8, font, color: TEXT });
    r.schritte.forEach((s, si) => {
      const sy = y - 48 - si * 18;
      numCircle(page, M + 24, sy + 2, si + 1);
      page.drawText(s, { x: M + 40, y: sy - 2, size: 9, font, color: TEXT });
    });
    y -= rh + 10;
  });
  pageNum(page);

  // ===== S7: WOCHENPLAN (größer) =====
  page = newPage();
  y = titleBar(page, H - 44, 'Dein Wochenplan', 'Jede Woche wiederholbar');
  const days = Object.entries(d.wochenplan);
  const dw = (W - M * 2 - 12) / 7;
  const dayH = 220;
  days.forEach((day, i) => {
    const cx = M + i * (dw + 2);
    page.drawRectangle({ x: cx, y: y - dayH, width: dw, height: dayH, color: WHITE });
    page.drawRectangle({ x: cx, y: y, width: dw, height: 3, color: GREEN });
    const dayName = day[0].charAt(0).toUpperCase() + day[0].slice(1, 2);
    page.drawText(dayName, { x: cx + dw / 2 - 6, y: y - 18, size: 11, font: fontBold, color: TEXT });
    page.drawText('Morgens:', { x: cx + 6, y: y - 40, size: 8, font: fontBold, color: GREEN_DARK });
    wrap(day[1].morgens, dw - 12, 7, font).forEach((l, li) => {
      page.drawText(l, { x: cx + 6, y: y - 52 - li * 10, size: 7, font, color: TEXT });
    });
    page.drawText('Abends:', { x: cx + 6, y: y - 110, size: 8, font: fontBold, color: GREEN_DARK });
    wrap(day[1].abends, dw - 12, 7, font).forEach((l, li) => {
      page.drawText(l, { x: cx + 6, y: y - 122 - li * 10, size: 7, font, color: TEXT });
    });
  });
  pageNum(page);

  // ===== S8: VERBOTEN (mit Erklärung) =====
  page = newPage();
  y = titleBar(page, H - 44, 'Das darf ' + dogName + ' NICHT essen', 'Giftig und gefährlich');
  const vw = (W - M * 2 - 10) / 2;
  d.verboten.forEach((v, i) => {
    const cx = M + (i % 2) * (vw + 10);
    const row = Math.floor(i / 2);
    const cy = y - row * 52;
    if (cy < 60) { if (i === 10) { pageNum(page); page = newPage(); y = H - 55; } }
    const actualCy = i >= 10 ? (H - 55) - (Math.floor((i - 10) / 2)) * 52 : cy;
    const actualCx = M + (i % 2) * (vw + 10);
    page.drawRectangle({ x: actualCx, y: actualCy - 44, width: vw, height: 44, color: RED_BG });
    page.drawText('X  ' + v.name, { x: actualCx + 8, y: actualCy - 14, size: 10, font: fontBold, color: RED });
    const grund = v.grund || '';
    wrap(grund, vw - 16, 8, font).forEach((l, li) => {
      page.drawText(l, { x: actualCx + 8, y: actualCy - 28 - li * 10, size: 8, font, color: TEXT });
    });
  });
  pageNum(page);

  // ===== S9: NOTFALL =====
  page = newPage();
  y = titleBar(page, H - 44, 'Notfall: Vergiftung', 'So reagierst du richtig');
  d.notfall.forEach((step, i) => {
    const sy = y - i * 55;
    page.drawRectangle({ x: M, y: sy - 42, width: W - M * 2, height: 42, color: i === 0 ? RED_BG : WHITE });
    numCircle(page, M + 22, sy - 18, i + 1, i === 0 ? RED : GREEN);
    wrap(step, W - M * 2 - 55, 10, font).forEach((l, li) => {
      page.drawText(l, { x: M + 42, y: sy - 16 - li * 14, size: 10, font, color: TEXT });
    });
  });
  pageNum(page);

  // ===== S10: FUTTER-WARNUNG (NEU) =====
  page = newPage();
  y = titleBar(page, H - 44, 'Worauf du beim Futterkauf achten solltest', 'Nicht alles was Futter heißt ist gut');
  const fw = d.futter_warnung || {};

  // Trockenfutter Box
  const halfW = (W - M * 2 - 15) / 2;
  page.drawRectangle({ x: M, y: y - 220, width: halfW, height: 220, color: WHITE });
  page.drawRectangle({ x: M, y: y, width: halfW, height: 3, color: RED });
  page.drawText('Schlechtes Trockenfutter erkennen', { x: M + 10, y: y - 18, size: 10, font: fontBold, color: RED });
  let ty = y - 36;
  (fw.trockenfutter_schlecht || []).forEach((item) => {
    page.drawText('X', { x: M + 10, y: ty, size: 8, font: fontBold, color: RED });
    wrap(item, halfW - 30, 8, font).forEach((l, li) => {
      page.drawText(l, { x: M + 22, y: ty - li * 11, size: 8, font, color: TEXT });
      if (li > 0) ty -= 11;
    });
    ty -= 16;
  });

  // Nassfutter Box
  page.drawRectangle({ x: M + halfW + 15, y: y - 220, width: halfW, height: 220, color: WHITE });
  page.drawRectangle({ x: M + halfW + 15, y: y, width: halfW, height: 3, color: RED });
  page.drawText('Schlechtes Nassfutter erkennen', { x: M + halfW + 25, y: y - 18, size: 10, font: fontBold, color: RED });
  ty = y - 36;
  (fw.nassfutter_schlecht || []).forEach((item) => {
    page.drawText('X', { x: M + halfW + 25, y: ty, size: 8, font: fontBold, color: RED });
    wrap(item, halfW - 30, 8, font).forEach((l, li) => {
      page.drawText(l, { x: M + halfW + 37, y: ty - li * 11, size: 8, font, color: TEXT });
      if (li > 0) ty -= 11;
    });
    ty -= 16;
  });

  // Tipp unten
  if (fw.tipp) {
    page.drawRectangle({ x: M, y: y - 265, width: W - M * 2, height: 35, color: GREEN_BG });
    page.drawText('Tipp: ' + fw.tipp, { x: M + 12, y: y - 250, size: 9, font: fontBold, color: GREEN_DARK });
  }
  pageNum(page);

  // ===== S11: EINKAUFSLISTE =====
  page = newPage();
  y = titleBar(page, H - 44, 'Deine Einkaufsliste', 'Alles was du brauchst');
  const ew = (W - M * 2 - 20) / 3;
  const cats = Object.entries(d.einkaufsliste);
  cats.forEach((cat, i) => {
    const cx = M + (i % 3) * (ew + 10);
    const row = Math.floor(i / 3);
    const cy = y - row * 140;
    const ch = 120;
    page.drawRectangle({ x: cx, y: cy - ch, width: ew, height: ch, color: WHITE });
    page.drawRectangle({ x: cx, y: cy, width: ew, height: 3, color: GREEN });
    page.drawText(cat[0], { x: cx + 10, y: cy - 16, size: 10, font: fontBold, color: GREEN_DARK });
    cat[1].forEach((item, ii) => {
      page.drawRectangle({ x: cx + 10, y: cy - 34 - ii * 16, width: 8, height: 8, borderColor: GREEN, borderWidth: 1, color: WHITE });
      page.drawText(item, { x: cx + 24, y: cy - 34 - ii * 16, size: 9, font, color: TEXT });
    });
  });
  pageNum(page);

  // ===== S12: ABSCHLUSS =====
  page = newPage();
  y = H - 60;
  page.drawText('Viel Erfolg mit ' + dogName + '!', { x: M, y, size: 20, font: fontBold, color: TEXT });
  y -= 35;
  [
    `Gute Ernährung ist die Basis für ein gesundes, aktives Hundeleben. Mit diesem Plan hast du alles um ${dogName} optimal zu versorgen.`,
    `Nutze den Wochenplan als Orientierung und passe die Mengen an wenn nötig. Beobachte wie ${dogName} reagiert - Fell, Energie und Verdauung zeigen dir ob alles passt.`,
    `Bei Fragen erreichst du unser Team per E-Mail an support@pfoten-plan.de. Wir helfen dir gerne weiter.`
  ].forEach(t => {
    wrap(t, W - M * 2, 10, font).forEach(l => { page.drawText(l, { x: M, y, size: 10, font, color: GRAY }); y -= 14; });
    y -= 8;
  });
  pageNum(page);

  // SAVE
  const pdfBytes = await doc.save();
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
  console.log(`PDF: ${Math.round(pdfBase64.length / 1024)} KB, ${pageCount} Seiten`);

  const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
      to: [{ email: "kontakt@primesocial.de" }],
      subject: `[TEST v7] Ernährungsplan ${dogName} - Final`,
      htmlContent: `<div style="font-family:sans-serif;text-align:center;padding:30px;"><h2 style="color:#2D8A4E;">Ernährungsplan für ${dogName}</h2><p>${pageCount} Seiten PDF im Anhang</p></div>`,
      attachment: [{ name: `Ernährungsplan-${dogName}.pdf`, content: pdfBase64 }]
    })
  });

  if (emailRes.ok) console.log("Email + PDF gesendet!");
  else console.error("Error:", await emailRes.text());
}

run().catch(console.error);
