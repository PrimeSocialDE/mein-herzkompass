import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const dogName = "Buddy";
const breed = "Labrador";
const weight = "30kg";

// Colors
const GREEN = rgb(0.176, 0.541, 0.306);
const GREEN_BG = rgb(0.93, 0.97, 0.94);
const GREEN_DARK = rgb(0.106, 0.369, 0.188);
const RED = rgb(0.86, 0.15, 0.15);
const RED_BG = rgb(0.99, 0.94, 0.94);
const BG = rgb(0.976, 0.965, 0.941);
const WHITE = rgb(1, 1, 1);
const TEXT = rgb(0.12, 0.12, 0.12);
const GRAY = rgb(0.5, 0.5, 0.5);
const BROWN = rgb(0.77, 0.65, 0.46);

const W = 842, H = 595, M = 50;

let doc, font, fontBold, pageCount = 0;

function wrap(str, maxWidth, size, f) {
  if (!str) return [''];
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (f.widthOfTextAtSize(test, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function newPage() {
  const p = doc.addPage([W, H]);
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BG });
  p.drawRectangle({ x: 0, y: H - 30, width: W, height: 30, color: GREEN });
  p.drawText('Pfoten-Plan  ·  Ernährungsplan', { x: W / 2 - 72, y: H - 21, size: 10, font: fontBold, color: WHITE });
  pageCount++;
  return p;
}

function pageNum(p) {
  p.drawText(String(pageCount), { x: W - M, y: 12, size: 9, font: fontBold, color: GRAY });
}

// Draw a rounded box (approximated with rectangle)
function box(p, x, y, w, h, color) {
  p.drawRectangle({ x, y, width: w, height: h, color });
}

// Title in box
function titleBox(p, y, title, subtitle) {
  const bh = subtitle ? 50 : 36;
  box(p, M, y - bh, W - M * 2, bh, WHITE);
  p.drawRectangle({ x: M, y: y - bh, width: 4, height: bh, color: GREEN });
  p.drawText(title, { x: M + 16, y: y - 18, size: 16, font: fontBold, color: TEXT });
  if (subtitle) p.drawText(subtitle, { x: M + 16, y: y - 36, size: 10, font, color: GRAY });
  return y - bh - 14;
}

// Info card (icon + title + content)
function infoCard(p, x, y, w, h, title, lines, accentColor) {
  box(p, x, y - h, w, h, WHITE);
  p.drawRectangle({ x, y: y - h, width: w, height: 3, color: accentColor || GREEN });
  p.drawText(title, { x: x + 10, y: y - 16, size: 10, font: fontBold, color: accentColor || GREEN_DARK });
  let ly = y - 32;
  for (const l of lines) {
    const wrapped = wrap(l, w - 20, 9, font);
    for (const wl of wrapped) {
      p.drawText(wl, { x: x + 10, y: ly, size: 9, font, color: TEXT });
      ly -= 12;
    }
  }
  return y - h - 8;
}

async function run() {
  console.log("Generiere kurzen, strukturierten Ernährungsplan...");

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 5000,
      system: `Du erstellst Ernährungsdaten für einen Hund. KEIN Markdown, KEINE Sterne. Antworte NUR im folgenden JSON-Format:

{
  "intro": "2-3 kurze Sätze warum ein Ernährungsplan für ${breed} wichtig ist",
  "morgens": { "zeit": "7:00 - 8:00 Uhr", "futter": "200g hochwertiges Trockenfutter", "zusatz": "1 TL Lachsöl", "tipp": "Immer nach dem Morgenspaziergang füttern" },
  "mittags": { "zeit": "12:00 - 13:00 Uhr", "futter": "Trainings-Leckerlis oder Kausnack", "zusatz": "Karotte oder Apfelstück", "tipp": "Nicht vor dem Spaziergang füttern" },
  "abends": { "zeit": "18:00 - 19:00 Uhr", "futter": "180g hochwertiges Trockenfutter", "zusatz": "50g püriertes Gemüse", "tipp": "Mindestens 2h vor dem Schlafen" },
  "portionen": { "trockenfutter": "350-400g/Tag", "nassfutter": "600-800g/Tag", "misch": "200g Trocken + 400g Nass", "barf": "600-700g/Tag (80% Fleisch, 20% Gemüse/Obst)", "wasser": "500-700ml/Tag" },
  "naehrstoffe": [
    { "name": "Protein", "menge": "22-25%", "quellen": "Huhn, Rind, Lachs, Lamm" },
    { "name": "Fett", "menge": "12-15%", "quellen": "Lachsöl, Hühnerfett, Leinsamen" },
    { "name": "Ballaststoffe", "menge": "3-5%", "quellen": "Kürbis, Karotte, Reis" },
    { "name": "Kalzium", "menge": "1-1.8%", "quellen": "Knochen, Eierschale, Hüttenkäse" }
  ],
  "snacks": [
    { "name": "Karotte", "menge": "1-2 Stück/Tag", "info": "Reinigt Zähne, kalorienarm" },
    { "name": "Apfel (ohne Kerne)", "menge": "2-3 Scheiben", "info": "Vitamine, gut für Verdauung" },
    { "name": "Banane", "menge": "1/4 pro Tag", "info": "Kalium, nur als Belohnung" },
    { "name": "Hüttenkäse", "menge": "1 EL", "info": "Protein, Kalzium" },
    { "name": "Gurke", "menge": "3-4 Scheiben", "info": "Kalorienarm, hydrierend" },
    { "name": "Getrocknetes Hühnerfleisch", "menge": "2-3 Stück", "info": "Hochwertiges Protein" },
    { "name": "Blaubeeren", "menge": "5-8 Stück", "info": "Antioxidantien" },
    { "name": "Wassermelone (ohne Kerne)", "menge": "2-3 Stücke", "info": "Hydrierend, kalorienarm" }
  ],
  "rezepte": [
    { "name": "Hafer-Bananen-Kekse", "zutaten": "200g Haferflocken, 1 Banane, 1 Ei", "schritte": ["Banane zerdrücken", "Alles vermengen", "Kleine Kugeln formen", "180°C, 15 Min backen"], "haltbar": "5 Tage in Dose" },
    { "name": "Hühnchen-Süßkartoffel Bites", "zutaten": "200g Hühnchen, 1 Süßkartoffel, 1 EL Kokosöl", "schritte": ["Hühnchen kochen und zerkleinern", "Süßkartoffel pürieren", "Mischen, kleine Bälle formen", "Im Kühlschrank fest werden lassen"], "haltbar": "3 Tage im Kühlschrank" },
    { "name": "Leberwurst-Eis", "zutaten": "100g Leberwurst, 200ml Joghurt natur, 1 Banane", "schritte": ["Alles pürieren", "In Eisform füllen", "4h einfrieren"], "haltbar": "2 Wochen im Gefrierfach" }
  ],
  "verboten": [
    { "name": "Schokolade", "grund": "Theobromin - Herzversagen" },
    { "name": "Weintrauben/Rosinen", "grund": "Nierenversagen" },
    { "name": "Zwiebeln/Knoblauch", "grund": "Zerstört rote Blutkörperchen" },
    { "name": "Avocado", "grund": "Persin - Herzmuskelschäden" },
    { "name": "Macadamia-Nüsse", "grund": "Lähmungen, Erbrechen" },
    { "name": "Xylitol/Birkenzucker", "grund": "Leberschäden, Unterzucker" },
    { "name": "Rohes Schweinefleisch", "grund": "Aujeszky-Virus (tödlich)" },
    { "name": "Koffein", "grund": "Herzrhythmusstörungen" },
    { "name": "Alkohol", "grund": "Leberschäden, Koma" },
    { "name": "Gekochte Knochen", "grund": "Splittern - Darmverletzungen" }
  ],
  "notfall": ["Ruhe bewahren, Menge und Zeitpunkt notieren", "Tierarzt-Notdienst anrufen: 0800-1110777", "Verpackung/Reste mitnehmen", "NICHT selbst Erbrechen auslösen", "Sofort zum nächsten Tierarzt fahren"],
  "umstellung": [
    { "tag": "Tag 1-2", "alt": "75%", "neu": "25%" },
    { "tag": "Tag 3-4", "alt": "50%", "neu": "50%" },
    { "tag": "Tag 5-6", "alt": "25%", "neu": "75%" },
    { "tag": "Tag 7", "alt": "0%", "neu": "100%" }
  ],
  "einkaufsliste": {
    "trockenfutter": ["Wolfsblut Wild Duck", "Josera Balance", "Happy Dog Supreme"],
    "nassfutter": ["Rinti Kennerfleisch", "Animonda Gran Carno", "MjAMjAM"],
    "zusaetze": ["Lachsöl (Grizzly)", "Bierhefe-Tabletten", "Kokosöl nativ"],
    "gemuese": ["Karotten", "Kürbis", "Zucchini", "Gurke", "Brokkoli (gekocht)"],
    "obst": ["Äpfel", "Bananen", "Blaubeeren", "Wassermelone"]
  }
}

Passe alle Werte an für ${breed}, ${weight}, erwachsen, normal aktiv an. Sei konkret mit Grammangaben.`,
      messages: [{ role: "user", content: `JSON-Ernährungsdaten für ${dogName} (${breed}, ${weight}, erwachsen).` }]
    })
  });

  if (!claudeRes.ok) { console.error(await claudeRes.text()); return; }
  const result = await claudeRes.json();
  let jsonText = result.content[0].text;
  // Strip markdown code blocks if present
  jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const d = JSON.parse(jsonText);
  console.log("Daten erhalten, baue PDF...");

  doc = await PDFDocument.create();
  font = await doc.embedFont(StandardFonts.Helvetica);
  fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // ===== TITELSEITE =====
  let page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BG });
  page.drawText('PFOTEN-PLAN', { x: M, y: H - 80, size: 11, font: fontBold, color: GREEN });
  page.drawText(dogName + "'s persönlicher", { x: M, y: H - 130, size: 30, font: fontBold, color: TEXT });
  page.drawText("Ernährungsplan", { x: M, y: H - 166, size: 30, font: fontBold, color: TEXT });
  page.drawRectangle({ x: M, y: H - 180, width: 60, height: 3, color: GREEN });
  page.drawText(`${breed}  ·  ${weight}  ·  Erwachsen`, { x: M, y: H - 200, size: 11, font, color: GRAY });
  pageCount++;

  // Stats
  const stats = [['8', 'Snacks'], ['3', 'Rezepte'], ['10', 'No-Go\'s'], ['7-Tage', 'Umstellung']];
  stats.forEach((s, i) => {
    const bx = M + i * 105;
    box(page, bx, H - 290, 90, 50, WHITE);
    page.drawText(s[0], { x: bx + (s[0].length > 2 ? 15 : 30), y: H - 268, size: 16, font: fontBold, color: GREEN });
    page.drawText(s[1], { x: bx + 10, y: H - 284, size: 8, font, color: GRAY });
  });

  // ===== SEITE 2: TAGESPLAN =====
  page = newPage();
  let y = titleBox(page, H - 44, `${dogName}'s Tagesplan`, 'Wann, was und wie viel füttern');

  const meals = [
    { label: 'MORGENS', ...d.morgens, color: rgb(1, 0.85, 0.4) },
    { label: 'MITTAGS', ...d.mittags, color: rgb(0.6, 0.85, 0.6) },
    { label: 'ABENDS', ...d.abends, color: rgb(0.55, 0.7, 0.9) }
  ];

  const cardW = (W - M * 2 - 20) / 3;
  meals.forEach((meal, i) => {
    const cx = M + i * (cardW + 10);
    const ch = 160;
    box(page, cx, y - ch, cardW, ch, WHITE);
    page.drawRectangle({ x: cx, y: y, width: cardW, height: 3, color: meal.color });

    page.drawText(meal.label, { x: cx + 10, y: y - 18, size: 11, font: fontBold, color: TEXT });
    page.drawText(meal.zeit, { x: cx + 10, y: y - 32, size: 8, font, color: GRAY });

    page.drawText('Futter:', { x: cx + 10, y: y - 52, size: 8, font: fontBold, color: GREEN_DARK });
    const fw = wrap(meal.futter, cardW - 20, 8, font);
    fw.forEach((l, li) => page.drawText(l, { x: cx + 10, y: y - 64 - li * 10, size: 8, font, color: TEXT }));

    const zusatzY = y - 64 - fw.length * 10 - 8;
    page.drawText('Zusatz:', { x: cx + 10, y: zusatzY, size: 8, font: fontBold, color: GREEN_DARK });
    page.drawText(meal.zusatz, { x: cx + 10, y: zusatzY - 12, size: 8, font, color: TEXT });

    page.drawText('Tipp:', { x: cx + 10, y: zusatzY - 30, size: 8, font: fontBold, color: GREEN_DARK });
    const tw = wrap(meal.tipp, cardW - 20, 8, font);
    tw.forEach((l, li) => page.drawText(l, { x: cx + 10, y: zusatzY - 42 - li * 10, size: 8, font, color: GRAY }));
  });

  y -= 180;

  // Portionen Box
  y -= 10;
  box(page, M, y - 100, W - M * 2, 100, GREEN_BG);
  page.drawText('Tägliche Portionsgrößen', { x: M + 12, y: y - 16, size: 11, font: fontBold, color: GREEN_DARK });
  const portions = [
    ['Trockenfutter', d.portionen.trockenfutter],
    ['Nassfutter', d.portionen.nassfutter],
    ['Mischfütterung', d.portionen.misch],
    ['BARF', d.portionen.barf],
    ['Wasser', d.portionen.wasser]
  ];
  portions.forEach((p, i) => {
    const px = M + 12 + (i % 3) * 240;
    const py = i < 3 ? y - 38 : y - 58;
    page.drawCircle({ x: px + 4, y: py + 3, size: 2, color: GREEN });
    page.drawText(p[0] + ':', { x: px + 10, y: py, size: 8, font: fontBold, color: TEXT });
    page.drawText(p[1], { x: px + 10 + fontBold.widthOfTextAtSize(p[0] + ':', 8) + 4, y: py, size: 8, font, color: GRAY });
  });
  pageNum(page);

  // ===== SEITE 3: NÄHRSTOFFE =====
  page = newPage();
  y = titleBox(page, H - 44, 'Nährstoffe die ' + breed + ' braucht', 'Was in gutem Futter drin sein muss');

  const nCardW = (W - M * 2 - 15) / 2;
  d.naehrstoffe.forEach((n, i) => {
    const cx = M + (i % 2) * (nCardW + 15);
    const cy = i < 2 ? y : y - 75;
    box(page, cx, cy - 60, nCardW, 60, WHITE);
    page.drawText(n.name, { x: cx + 10, y: cy - 16, size: 12, font: fontBold, color: GREEN_DARK });
    page.drawText(n.menge, { x: cx + nCardW - 50, y: cy - 16, size: 12, font: fontBold, color: GREEN });
    page.drawText('Quellen: ' + n.quellen, { x: cx + 10, y: cy - 36, size: 9, font, color: GRAY });
  });
  pageNum(page);

  // ===== SEITE 4: SNACKS =====
  page = newPage();
  y = titleBox(page, H - 44, 'Gesunde Snacks für ' + dogName, 'Erlaubt und empfohlen');

  const sCardW = (W - M * 2 - 10) / 2;
  d.snacks.forEach((s, i) => {
    const cx = M + (i % 2) * (sCardW + 10);
    const row = Math.floor(i / 2);
    const cy = y - row * 55;
    if (cy < 60) return;
    box(page, cx, cy - 45, sCardW, 45, WHITE);
    page.drawText(s.name, { x: cx + 10, y: cy - 14, size: 10, font: fontBold, color: TEXT });
    page.drawText(s.menge, { x: cx + sCardW - fontBold.widthOfTextAtSize(s.menge, 8) - 10, y: cy - 14, size: 8, font: fontBold, color: GREEN });
    page.drawText(s.info, { x: cx + 10, y: cy - 30, size: 8, font, color: GRAY });
  });
  pageNum(page);

  // ===== SEITE 5: REZEPTE =====
  page = newPage();
  y = titleBox(page, H - 44, 'Selbstgemachte Leckerlis', 'Einfache Rezepte zum Nachbacken');

  d.rezepte.forEach((r, ri) => {
    if (y < 120) { pageNum(page); page = newPage(); y = H - 55; }

    const rh = 130;
    box(page, M, y - rh, W - M * 2, rh, WHITE);
    page.drawRectangle({ x: M, y: y - rh, width: 4, height: rh, color: BROWN });

    page.drawText(r.name, { x: M + 14, y: y - 16, size: 12, font: fontBold, color: TEXT });
    page.drawText('Haltbar: ' + r.haltbar, { x: W - M - 120, y: y - 16, size: 8, font, color: GRAY });

    page.drawText('Zutaten:', { x: M + 14, y: y - 36, size: 8, font: fontBold, color: GREEN_DARK });
    page.drawText(r.zutaten, { x: M + 60, y: y - 36, size: 8, font, color: TEXT });

    r.schritte.forEach((s, si) => {
      const sy = y - 56 - si * 16;
      page.drawCircle({ x: M + 22, y: sy + 3, size: 7, color: GREEN });
      page.drawText(String(si + 1), { x: M + 19, y: sy, size: 7, font: fontBold, color: WHITE });
      page.drawText(s, { x: M + 36, y: sy, size: 9, font, color: TEXT });
    });

    y -= rh + 10;
  });
  pageNum(page);

  // ===== SEITE 6: VERBOTEN =====
  page = newPage();
  y = titleBox(page, H - 44, 'Das darf ' + dogName + ' NICHT essen', 'Giftig und gefährlich');

  const vCardW = (W - M * 2 - 10) / 2;
  d.verboten.forEach((v, i) => {
    const cx = M + (i % 2) * (vCardW + 10);
    const row = Math.floor(i / 2);
    const cy = y - row * 42;
    if (cy < 50) return;
    box(page, cx, cy - 34, vCardW, 34, RED_BG);
    page.drawText('X  ' + v.name, { x: cx + 8, y: cy - 14, size: 9, font: fontBold, color: RED });
    page.drawText(v.grund, { x: cx + 8, y: cy - 27, size: 8, font, color: TEXT });
  });
  pageNum(page);

  // ===== SEITE 7: NOTFALL =====
  page = newPage();
  y = titleBox(page, H - 44, 'Notfall: ' + dogName + ' hat etwas Giftiges gefressen', 'So reagierst du richtig');

  d.notfall.forEach((step, i) => {
    const sy = y - i * 50;
    box(page, M, sy - 40, W - M * 2, 40, i === 0 ? RED_BG : WHITE);
    page.drawCircle({ x: M + 20, y: sy - 16, size: 12, color: i === 0 ? RED : GREEN });
    page.drawText(String(i + 1), { x: M + 16, y: sy - 20, size: 10, font: fontBold, color: WHITE });
    const sw = wrap(step, W - M * 2 - 50, 10, font);
    sw.forEach((l, li) => page.drawText(l, { x: M + 40, y: sy - 16 - li * 13, size: 10, font, color: TEXT }));
  });
  pageNum(page);

  // ===== SEITE 8: UMSTELLUNG =====
  page = newPage();
  y = titleBox(page, H - 44, 'Futterumstellung in 7 Tagen', 'Schritt für Schritt umstellen');

  d.umstellung.forEach((u, i) => {
    const uy = y - i * 55;
    box(page, M, uy - 45, W - M * 2, 45, WHITE);
    page.drawText(u.tag, { x: M + 12, y: uy - 16, size: 11, font: fontBold, color: TEXT });

    // Progress bar
    const barX = M + 100;
    const barW = 400;
    const neuPct = parseInt(u.neu) / 100;
    page.drawRectangle({ x: barX, y: uy - 22, width: barW, height: 14, color: rgb(0.9, 0.9, 0.9) });
    page.drawRectangle({ x: barX, y: uy - 22, width: barW * neuPct, height: 14, color: GREEN });
    page.drawText(u.alt + ' altes Futter', { x: barX + barW + 10, y: uy - 12, size: 8, font, color: GRAY });
    page.drawText(u.neu + ' neues Futter', { x: barX + barW + 10, y: uy - 24, size: 8, font: fontBold, color: GREEN_DARK });
  });
  pageNum(page);

  // ===== SEITE 9: EINKAUFSLISTE =====
  page = newPage();
  y = titleBox(page, H - 44, 'Deine Einkaufsliste', 'Alles was du brauchst');

  const cats = [
    ['Trockenfutter', d.einkaufsliste.trockenfutter],
    ['Nassfutter', d.einkaufsliste.nassfutter],
    ['Zusätze', d.einkaufsliste.zusaetze],
    ['Gemüse', d.einkaufsliste.gemuese],
    ['Obst', d.einkaufsliste.obst]
  ];

  const eCardW = (W - M * 2 - 20) / 3;
  cats.forEach((cat, i) => {
    const cx = M + (i % 3) * (eCardW + 10);
    const row = Math.floor(i / 3);
    const cy = y - row * 140;
    const ch = 120;
    box(page, cx, cy - ch, eCardW, ch, WHITE);
    page.drawRectangle({ x: cx, y: cy, width: eCardW, height: 3, color: GREEN });
    page.drawText(cat[0], { x: cx + 10, y: cy - 16, size: 10, font: fontBold, color: GREEN_DARK });
    cat[1].forEach((item, ii) => {
      page.drawRectangle({ x: cx + 10, y: cy - 32 - ii * 14, width: 8, height: 8, borderColor: GREEN, borderWidth: 1, color: WHITE });
      page.drawText(item, { x: cx + 24, y: cy - 32 - ii * 14, size: 9, font, color: TEXT });
    });
  });
  pageNum(page);

  // ===== SEITE 10: ABSCHLUSS =====
  page = newPage();
  y = H - 55;
  page.drawText('Viel Erfolg mit ' + dogName + '!', { x: M, y, size: 20, font: fontBold, color: TEXT });
  y -= 35;

  const outro = [
    `Gute Ernährung ist die Basis für ein gesundes, aktives und glückliches Hundeleben. Mit diesem Plan hast du alles was du brauchst, um ${dogName} optimal zu versorgen.`,
    `Starte langsam mit der Umstellung (7-Tage-Plan auf Seite 8) und beobachte wie ${dogName} reagiert. Jeder Hund ist anders - pass die Mengen an wenn nötig.`,
    `Bei Fragen zu ${dogName}'s Ernährung erreichst du unser Team jederzeit per E-Mail an support@pfoten-plan.de. Wir helfen dir gerne weiter.`
  ];
  outro.forEach(text => {
    const wrapped = wrap(text, W - M * 2, 10, font);
    wrapped.forEach(l => {
      page.drawText(l, { x: M, y, size: 10, font, color: GRAY });
      y -= 14;
    });
    y -= 8;
  });
  pageNum(page);

  // SAVE & SEND
  const pdfBytes = await doc.save();
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
  console.log(`PDF: ${Math.round(pdfBase64.length / 1024)} KB, ${pageCount} Seiten`);

  const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
      to: [{ email: "kontakt@primesocial.de" }],
      subject: `[TEST v6] Ernährungsplan ${dogName} - Card Design`,
      htmlContent: `<div style="font-family:sans-serif;text-align:center;padding:30px;"><h2 style="color:#2D8A4E;">Ernährungsplan für ${dogName}</h2><p>${pageCount} Seiten PDF im Anhang</p></div>`,
      attachment: [{ name: `Ernaehrungsplan-${dogName}.pdf`, content: pdfBase64 }]
    })
  });

  if (emailRes.ok) console.log("Email + PDF gesendet!");
  else console.error("Error:", await emailRes.text());
}

run().catch(console.error);
