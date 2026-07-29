import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "fs";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const dogName = "Buddy";
const breed = "Labrador";
const weight = "30kg";

// Premium Farben - gedämpft, edel
const DARK = rgb(0.12, 0.12, 0.12);
const MED = rgb(0.35, 0.35, 0.35);
const LIGHT = rgb(0.6, 0.6, 0.6);
const ACCENT = rgb(0.22, 0.50, 0.35);     // Dunkleres Grün
const ACCENT_L = rgb(0.94, 0.97, 0.95);   // Sehr helles Grün
const WARN = rgb(0.75, 0.2, 0.2);
const WARN_L = rgb(0.98, 0.94, 0.94);
const BG = rgb(1, 1, 1);                  // Weiß statt Beige = moderner
const CARD = rgb(0.97, 0.97, 0.97);
const LINE = rgb(0.88, 0.88, 0.88);
const WHITE = rgb(1, 1, 1);
const GOLD = rgb(0.72, 0.62, 0.44);

const W = 842, H = 595, M = 60;
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
  // Minimalistische Kopfzeile - nur dünne Linie + Text
  p.drawRectangle({ x: 0, y: H - 1, width: W, height: 1, color: ACCENT });
  p.drawText('PFOTEN-PLAN', { x: M, y: H - 20, size: 9, font: fontBold, color: LIGHT });
  p.drawText('|', { x: M + 58, y: H - 20, size: 9, font, color: LINE });
  p.drawText('Ernährungsplan', { x: M + 68, y: H - 20, size: 9, font, color: LIGHT });
  pageCount++;
  return p;
}

function pageNum(p) {
  p.drawText(String(pageCount), { x: W - M, y: 18, size: 9, font, color: LIGHT });
}

function sectionTitle(p, y, title) {
  p.drawText(title, { x: M, y, size: 20, font: fontBold, color: DARK });
  p.drawRectangle({ x: M, y: y - 8, width: 40, height: 2, color: ACCENT });
  return y - 28;
}

function subTitle(p, y, title) {
  p.drawText(title, { x: M, y, size: 11, font: fontBold, color: ACCENT });
  return y - 18;
}

function numCircle(p, x, y, num, color) {
  p.drawCircle({ x, y, size: 10, color: color || ACCENT });
  const s = String(num);
  const tw = fontBold.widthOfTextAtSize(s, 8);
  p.drawText(s, { x: x - tw / 2, y: y - 3, size: 9, font: fontBold, color: WHITE });
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
  "intro": ["Absatz 1: 4 Sätze warum Ernährung für ${breed} wichtig ist, was bei falscher Ernährung passiert, wie es Fell/Energie/Verhalten beeinflusst.", "Absatz 2: 3 Sätze was diesen Plan besonders macht, konkrete Grammangaben, speziell für ${breed}.", "Absatz 3: 2 Sätze wie man den Plan nutzt, bei Fragen Team kontaktieren."],
  "morgens": { "zeit": "7:00 - 8:00 Uhr", "futter": "...", "zusatz": "...", "tipp": "..." },
  "mittags": { "zeit": "12:00 - 13:00 Uhr", "futter": "...", "zusatz": "...", "tipp": "..." },
  "abends": { "zeit": "18:00 - 19:00 Uhr", "futter": "...", "zusatz": "...", "tipp": "..." },
  "portionen": [["Trockenfutter", "Xg/Tag"], ["Nassfutter", "Xg/Tag"], ["Mischfütterung", "..."], ["BARF", "..."], ["Wasser", "Xml/Tag"]],
  "naehrstoffe": [
    { "name": "Protein", "menge": "22-25%", "quellen": "Huhn, Rind, Lachs" },
    { "name": "Fett", "menge": "12-15%", "quellen": "Lachsöl, Hühnerfett" },
    { "name": "Ballaststoffe", "menge": "3-5%", "quellen": "Kürbis, Karotte" },
    { "name": "Kalzium", "menge": "1-1.8%", "quellen": "Knochen, Hüttenkäse" }
  ],
  "snacks": [{ "name": "...", "menge": "...", "info": "kurz" }],
  "rezepte": [{ "name": "...", "zutaten": "...", "schritte": ["S1","S2","S3","S4"], "haltbar": "..." }],
  "verboten": [{ "name": "...", "grund": "2 Sätze Erklärung warum gefährlich und was passiert" }],
  "notfall": ["Schritt1", "Schritt2", "Schritt3", "Schritt4", "Schritt5"],
  "futter_warnung": {
    "trockenfutter": ["Warnsignal 1 (1 Satz)", "W2", "W3", "W4", "W5"],
    "nassfutter": ["Warnsignal 1 (1 Satz)", "W2", "W3", "W4", "W5"],
    "tipp": "2 Sätze was gutes Futter ausmacht"
  },
  "wochenplan": {
    "Mo": { "m": "kurz Morgens", "a": "kurz Abends" },
    "Di": { "m": "...", "a": "..." },
    "Mi": { "m": "...", "a": "..." },
    "Do": { "m": "...", "a": "..." },
    "Fr": { "m": "...", "a": "..." },
    "Sa": { "m": "...", "a": "..." },
    "So": { "m": "...", "a": "..." }
  },
  "einkauf": [["Trockenfutter", ["M1","M2","M3"]], ["Nassfutter", ["M1","M2","M3"]], ["Zusätze", ["P1","P2","P3"]], ["Gemüse", ["G1","G2","G3","G4"]], ["Obst", ["O1","O2","O3"]]]
}

8 Snacks, 5 Rezepte, 10 verbotene Lebensmittel. Alle Werte konkret für ${breed}, ${weight}, erwachsen.`,
      messages: [{ role: "user", content: `JSON für ${dogName} (${breed}, ${weight}).` }]
    })
  });

  if (!claudeRes.ok) { console.error(await claudeRes.text()); return; }
  const result = await claudeRes.json();
  let jsonText = result.content[0].text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const d = JSON.parse(jsonText);
  console.log("Daten OK");

  doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  font = await doc.embedFont(readFileSync('/System/Library/Fonts/Supplemental/Arial.ttf'));
  fontBold = await doc.embedFont(readFileSync('/System/Library/Fonts/Supplemental/Arial Bold.ttf'));

  // ===== TITEL =====
  let page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BG });
  page.drawRectangle({ x: 0, y: H - 2, width: W, height: 2, color: ACCENT });
  page.drawText('PFOTEN-PLAN', { x: M, y: H - 100, size: 9, font: fontBold, color: ACCENT });
  page.drawRectangle({ x: M, y: H - 108, width: 30, height: 1, color: ACCENT });
  page.drawText(dogName + "'s", { x: M, y: H - 160, size: 36, font: fontBold, color: DARK });
  page.drawText("Ernährungsplan", { x: M, y: H - 200, size: 36, font: fontBold, color: DARK });
  page.drawText(`Personalisiert für ${breed}  ·  ${weight}  ·  Erwachsen`, { x: M, y: H - 230, size: 11, font, color: LIGHT });
  // Dezente Stats unten
  const stats = ['13 Seiten', '5 Rezepte', '8 Snacks', 'Wochenplan'];
  stats.forEach((s, i) => {
    page.drawText(s, { x: M + i * 120, y: 40, size: 9, font, color: LIGHT });
    if (i < 3) page.drawText('·', { x: M + i * 120 + 75, y: 40, size: 9, font, color: LINE });
  });
  pageCount++;

  // ===== EINLEITUNG =====
  page = newPage();
  let y = sectionTitle(page, H - 50, 'Warum ein Ernährungsplan für ' + breed + '?');
  y -= 6;
  (d.intro || []).forEach(abs => {
    wrap(abs, W - M * 2, 11, font).forEach(l => {
      if (y < 40) { pageNum(page); page = newPage(); y = H - 50; }
      page.drawText(l, { x: M, y, size: 11, font, color: MED });
      y -= 16;
    });
    y -= 10;
  });
  pageNum(page);

  // ===== TAGESPLAN =====
  page = newPage();
  y = sectionTitle(page, H - 50, dogName + "'s Tagesplan");
  y -= 8;
  const meals = [
    { label: 'Morgens', ...d.morgens },
    { label: 'Mittags', ...d.mittags },
    { label: 'Abends', ...d.abends }
  ];
  const cw = (W - M * 2 - 30) / 3;
  meals.forEach((meal, i) => {
    const cx = M + i * (cw + 15);
    const ch = 190;
    page.drawRectangle({ x: cx, y: y - ch, width: cw, height: ch, color: CARD });
    page.drawRectangle({ x: cx, y: y - ch, width: cw, height: 1, color: ACCENT });
    page.drawText(meal.label, { x: cx + 14, y: y - 20, size: 13, font: fontBold, color: DARK });
    page.drawText(meal.zeit, { x: cx + 14, y: y - 36, size: 9, font, color: LIGHT });
    page.drawRectangle({ x: cx + 14, y: y - 44, width: cw - 28, height: 1, color: LINE });
    let my = y - 58;
    [['Futter', meal.futter], ['Zusatz', meal.zusatz]].forEach(([lbl, val]) => {
      page.drawText(lbl, { x: cx + 14, y: my, size: 9, font: fontBold, color: ACCENT });
      my -= 13;
      wrap(val, cw - 28, 9, font).forEach(l => { page.drawText(l, { x: cx + 14, y: my, size: 9, font, color: MED }); my -= 12; });
      my -= 6;
    });
    page.drawRectangle({ x: cx + 14, y: my + 2, width: cw - 28, height: 1, color: LINE });
    my -= 10;
    page.drawText('Tipp', { x: cx + 14, y: my, size: 9, font: fontBold, color: LIGHT });
    my -= 11;
    wrap(meal.tipp, cw - 28, 9, font).forEach(l => { page.drawText(l, { x: cx + 14, y: my, size: 9, font, color: LIGHT }); my -= 10; });
  });
  y -= 210;
  // Portionen
  page.drawRectangle({ x: M, y: y - 50, width: W - M * 2, height: 50, color: CARD });
  page.drawText('Tägliche Portionen', { x: M + 14, y: y - 14, size: 9, font: fontBold, color: DARK });
  (d.portionen || []).forEach((p2, i) => {
    const px = M + 14 + (i % 3) * 240;
    const py = y - 30 - Math.floor(i / 3) * 14;
    page.drawText(p2[0] + ':', { x: px, y: py, size: 9, font: fontBold, color: MED });
    page.drawText(p2[1], { x: px + fontBold.widthOfTextAtSize(p2[0] + ':', 8) + 4, y: py, size: 9, font, color: LIGHT });
  });
  pageNum(page);

  // ===== NÄHRSTOFFE =====
  page = newPage();
  y = sectionTitle(page, H - 50, 'Nährstoffe für ' + breed);
  y -= 8;
  const nw = (W - M * 2 - 15) / 2;
  d.naehrstoffe.forEach((n, i) => {
    const cx = M + (i % 2) * (nw + 15);
    const cy = i < 2 ? y : y - 80;
    page.drawRectangle({ x: cx, y: cy - 60, width: nw, height: 60, color: CARD });
    page.drawText(n.name, { x: cx + 14, y: cy - 18, size: 13, font: fontBold, color: DARK });
    page.drawText(n.menge, { x: cx + nw - 55, y: cy - 18, size: 13, font: fontBold, color: ACCENT });
    page.drawText('Quellen: ' + n.quellen, { x: cx + 14, y: cy - 38, size: 9, font, color: LIGHT });
  });
  pageNum(page);

  // ===== SNACKS =====
  page = newPage();
  y = sectionTitle(page, H - 50, 'Gesunde Snacks');
  y -= 8;
  const sw = (W - M * 2 - 15) / 2;
  (d.snacks || []).forEach((s, i) => {
    const cx = M + (i % 2) * (sw + 15);
    const row = Math.floor(i / 2);
    const cy = y - row * 50;
    if (cy < 50) return;
    page.drawRectangle({ x: cx, y: cy - 40, width: sw, height: 40, color: CARD });
    page.drawText(s.name, { x: cx + 14, y: cy - 14, size: 11, font: fontBold, color: DARK });
    page.drawText(s.menge, { x: cx + sw - font.widthOfTextAtSize(s.menge, 8) - 14, y: cy - 14, size: 9, font: fontBold, color: ACCENT });
    page.drawText(s.info, { x: cx + 14, y: cy - 30, size: 9, font, color: LIGHT });
  });
  pageNum(page);

  // ===== REZEPTE =====
  page = newPage();
  y = sectionTitle(page, H - 50, 'Selbstgemachte Rezepte');
  y -= 8;
  (d.rezepte || []).forEach((r) => {
    if (y < 140) { pageNum(page); page = newPage(); y = H - 50; }
    const rh = 24 + 14 + r.schritte.length * 20 + 14;
    page.drawRectangle({ x: M, y: y - rh, width: W - M * 2, height: rh, color: CARD });
    page.drawRectangle({ x: M, y: y - rh, width: 3, height: rh, color: GOLD });
    page.drawText(r.name, { x: M + 16, y: y - 18, size: 13, font: fontBold, color: DARK });
    page.drawText(r.haltbar, { x: W - M - font.widthOfTextAtSize(r.haltbar, 8) - 14, y: y - 18, size: 9, font, color: LIGHT });
    page.drawText(r.zutaten, { x: M + 16, y: y - 34, size: 9, font, color: MED });
    page.drawRectangle({ x: M + 16, y: y - 42, width: W - M * 2 - 32, height: 1, color: LINE });
    r.schritte.forEach((s, si) => {
      const sy = y - 56 - si * 20;
      numCircle(page, M + 28, sy + 2, si + 1);
      page.drawText(s, { x: M + 46, y: sy - 2, size: 9, font, color: MED });
    });
    y -= rh + 12;
  });
  pageNum(page);

  // ===== WOCHENPLAN =====
  page = newPage();
  y = sectionTitle(page, H - 50, 'Wochenplan');
  y -= 8;
  const days = Object.entries(d.wochenplan || {});
  const dw = (W - M * 2 - (days.length - 1) * 4) / days.length;
  days.forEach(([day, plan], i) => {
    const cx = M + i * (dw + 4);
    const ch = 240;
    page.drawRectangle({ x: cx, y: y - ch, width: dw, height: ch, color: CARD });
    page.drawRectangle({ x: cx, y: y, width: dw, height: 2, color: ACCENT });
    page.drawText(day, { x: cx + dw / 2 - fontBold.widthOfTextAtSize(day, 11) / 2, y: y - 20, size: 11, font: fontBold, color: DARK });
    page.drawRectangle({ x: cx + 8, y: y - 28, width: dw - 16, height: 1, color: LINE });
    page.drawText('Morgens', { x: cx + 8, y: y - 44, size: 9, font: fontBold, color: ACCENT });
    wrap(plan.m, dw - 16, 9, font).forEach((l, li) => {
      page.drawText(l, { x: cx + 8, y: y - 56 - li * 10, size: 9, font, color: MED });
    });
    page.drawText('Abends', { x: cx + 8, y: y - 120, size: 9, font: fontBold, color: ACCENT });
    wrap(plan.a, dw - 16, 9, font).forEach((l, li) => {
      page.drawText(l, { x: cx + 8, y: y - 132 - li * 10, size: 9, font, color: MED });
    });
  });
  pageNum(page);

  // ===== VERBOTEN =====
  page = newPage();
  y = sectionTitle(page, H - 50, 'Das darf ' + dogName + ' nicht essen');
  y -= 8;
  const vw = (W - M * 2 - 15) / 2;
  (d.verboten || []).forEach((v, i) => {
    if (y < 80 && i % 2 === 0) { pageNum(page); page = newPage(); y = H - 50; }
    const cx = M + (i % 2) * (vw + 15);
    if (i % 2 === 0 && i > 0 && i < 10) y -= 0;
    const cy = i % 2 === 0 ? y : y;
    page.drawRectangle({ x: cx, y: cy - 55, width: vw, height: 55, color: WARN_L });
    page.drawRectangle({ x: cx, y: cy - 55, width: 3, height: 55, color: WARN });
    page.drawText(v.name, { x: cx + 14, y: cy - 16, size: 11, font: fontBold, color: WARN });
    wrap(v.grund, vw - 28, 9, font).forEach((l, li) => {
      page.drawText(l, { x: cx + 14, y: cy - 32 - li * 11, size: 9, font, color: MED });
    });
    if (i % 2 === 1) y -= 62;
  });
  pageNum(page);

  // ===== NOTFALL =====
  page = newPage();
  y = sectionTitle(page, H - 50, 'Notfall: Vergiftung');
  y -= 8;
  (d.notfall || []).forEach((step, i) => {
    const sy = y - i * 60;
    page.drawRectangle({ x: M, y: sy - 46, width: W - M * 2, height: 46, color: i === 0 ? WARN_L : CARD });
    if (i === 0) page.drawRectangle({ x: M, y: sy - 46, width: 3, height: 46, color: WARN });
    numCircle(page, M + 24, sy - 20, i + 1, i === 0 ? WARN : ACCENT);
    wrap(step, W - M * 2 - 60, 11, font).forEach((l, li) => {
      page.drawText(l, { x: M + 44, y: sy - 18 - li * 14, size: 11, font, color: DARK });
    });
  });
  pageNum(page);

  // ===== FUTTER-WARNUNG =====
  page = newPage();
  y = sectionTitle(page, H - 50, 'Worauf du beim Futterkauf achten solltest');
  y -= 8;
  const fw = d.futter_warnung || {};
  const halfW = (W - M * 2 - 20) / 2;

  // Trockenfutter
  page.drawRectangle({ x: M, y: y - 220, width: halfW, height: 220, color: CARD });
  page.drawRectangle({ x: M, y: y, width: halfW, height: 2, color: WARN });
  page.drawText('Schlechtes Trockenfutter', { x: M + 14, y: y - 20, size: 11, font: fontBold, color: WARN });
  let ty = y - 42;
  (fw.trockenfutter || []).forEach((item) => {
    page.drawText('x', { x: M + 14, y: ty, size: 9, font: fontBold, color: WARN });
    wrap(item, halfW - 40, 9, font).forEach((l, li) => {
      page.drawText(l, { x: M + 28, y: ty - li * 12, size: 9, font, color: MED });
    });
    ty -= 18 + Math.max(0, (wrap(item, halfW - 40, 9, font).length - 1) * 12);
  });

  // Nassfutter
  page.drawRectangle({ x: M + halfW + 20, y: y - 220, width: halfW, height: 220, color: CARD });
  page.drawRectangle({ x: M + halfW + 20, y: y, width: halfW, height: 2, color: WARN });
  page.drawText('Schlechtes Nassfutter', { x: M + halfW + 34, y: y - 20, size: 11, font: fontBold, color: WARN });
  ty = y - 42;
  (fw.nassfutter || []).forEach((item) => {
    page.drawText('x', { x: M + halfW + 34, y: ty, size: 9, font: fontBold, color: WARN });
    wrap(item, halfW - 40, 9, font).forEach((l, li) => {
      page.drawText(l, { x: M + halfW + 48, y: ty - li * 12, size: 9, font, color: MED });
    });
    ty -= 18 + Math.max(0, (wrap(item, halfW - 40, 9, font).length - 1) * 12);
  });

  // Tipp
  if (fw.tipp) {
    page.drawRectangle({ x: M, y: y - 260, width: W - M * 2, height: 30, color: ACCENT_L });
    page.drawText(fw.tipp, { x: M + 14, y: y - 248, size: 9, font, color: ACCENT });
  }
  pageNum(page);

  // ===== EINKAUFSLISTE =====
  page = newPage();
  y = sectionTitle(page, H - 50, 'Einkaufsliste');
  y -= 8;
  const ew = (W - M * 2 - 30) / 3;
  (d.einkauf || []).forEach((cat, i) => {
    const cx = M + (i % 3) * (ew + 15);
    const row = Math.floor(i / 3);
    const cy = y - row * 140;
    const ch = 120;
    page.drawRectangle({ x: cx, y: cy - ch, width: ew, height: ch, color: CARD });
    page.drawRectangle({ x: cx, y: cy, width: ew, height: 2, color: ACCENT });
    page.drawText(cat[0], { x: cx + 12, y: cy - 18, size: 11, font: fontBold, color: DARK });
    page.drawRectangle({ x: cx + 12, y: cy - 24, width: ew - 24, height: 1, color: LINE });
    (cat[1] || []).forEach((item, ii) => {
      page.drawRectangle({ x: cx + 12, y: cy - 38 - ii * 16, width: 7, height: 7, borderColor: ACCENT, borderWidth: 1, color: WHITE });
      page.drawText(item, { x: cx + 26, y: cy - 38 - ii * 16, size: 9, font, color: MED });
    });
  });
  pageNum(page);

  // ===== ABSCHLUSS =====
  page = newPage();
  y = H - 80;
  page.drawText('Viel Erfolg mit ' + dogName + '.', { x: M, y, size: 22, font: fontBold, color: DARK });
  page.drawRectangle({ x: M, y: y - 10, width: 40, height: 2, color: ACCENT });
  y -= 40;
  [
    `Gute Ernährung ist die Basis für ein gesundes, aktives Hundeleben. Mit diesem Plan hast du alles, um ${dogName} optimal zu versorgen.`,
    `Nutze den Wochenplan als Orientierung und beobachte wie ${dogName} reagiert. Fell, Energie und Verdauung zeigen dir, ob alles passt.`,
    `Bei Fragen erreichst du unser Team per E-Mail an support@pfoten-plan.de.`
  ].forEach(t => {
    wrap(t, W - M * 2, 11, font).forEach(l => { page.drawText(l, { x: M, y, size: 11, font, color: MED }); y -= 16; });
    y -= 10;
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
      subject: `[v8 MODERN] Ernährungsplan ${dogName}`,
      htmlContent: `<div style="font-family:sans-serif;text-align:center;padding:30px;"><h2 style="color:#38805A;">Ernährungsplan für ${dogName}</h2><p>${pageCount} Seiten · Premium Design</p></div>`,
      attachment: [{ name: `Ernaehrungsplan-${dogName}.pdf`, content: pdfBase64 }]
    })
  });

  if (emailRes.ok) console.log("Gesendet!");
  else console.error("Error:", await emailRes.text());
}

run().catch(console.error);
