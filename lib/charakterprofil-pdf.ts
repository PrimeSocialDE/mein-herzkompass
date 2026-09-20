// Produkt-PDF "Charakterprofil" — rasse-zentriert, mit echten Uebungen.
// Baut auf der Optik von lib/hund-verstehen-pdf.ts auf (pdf-lib, A4, Gold/Braun),
// bringt aber einen eigenen Seitenaufbau: zu jedem Thema gehoert etwas zum Tun.
// Export: buildCharakterprofilPDF({ dogName, breed, mischRassen, age, gender, content }) -> Uint8Array

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const A4_W = 595.28, A4_H = 841.89, MARGIN = 50, CONTENT_W = A4_W - 2 * MARGIN;
const GOLD = rgb(196 / 255, 165 / 255, 118 / 255), DARK_BROWN = rgb(139 / 255, 115 / 255, 85 / 255);
const TEXT_DARK = rgb(26 / 255, 26 / 255, 26 / 255), TEXT_MEDIUM = rgb(100 / 255, 100 / 255, 100 / 255), TEXT_LIGHT = rgb(150 / 255, 150 / 255, 150 / 255);
const WHITE = rgb(1, 1, 1), BG_LIGHT = rgb(250 / 255, 248 / 255, 245 / 255), BG_WARM = rgb(255 / 255, 249 / 255, 240 / 255);
const BORDER_LIGHT = rgb(232 / 255, 220 / 255, 200 / 255), ROW_ALT = rgb(250 / 255, 247 / 255, 242 / 255);
const RED_SOFT = rgb(180 / 255, 35 / 255, 24 / 255);

const DISCLAIMER =
  "Dieses Profil erklärt rasse- und verhaltenstypische Tendenzen. Jeder Hund ist individuell, sieh es als Orientierung, nicht als Urteil. Es ersetzt keine tierärztliche oder verhaltenstherapeutische Beratung.";

const S = (s: any) =>
  String(s == null ? "" : s)
    .replace(/[→←⇒▶]/g, "-")
    .replace(/[≥]/g, "ab ")
    .replace(/[≤]/g, "bis ")
    .replace(/[\u{1F000}-\u{1FAFF}☀-➿️✂]/gu, "")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...");

interface Fonts { regular: PDFFont; bold: PDFFont; italic: PDFFont; }

// ── Content-Schnittstelle (KI-generiert) ──────────────────────────────────
export interface Uebung {
  titel: string;
  ziel: string;            // 1 Satz: was die Uebung bringt
  dauer: string;           // z.B. "5 Minuten, 1x taeglich"
  schritte: string[];      // 4-6 konkrete Schritte
  achten: string;          // worauf der Halter achtet
  wennNicht: string;       // was tun, wenn es nicht klappt
}

export interface CharakterprofilContent {
  kurzgesagt: string;                                   // 3-4 Saetze: dieser Hund in kurz
  herkunft: string;                                     // Absatz zur Zuchtgeschichte
  steckbrief: { feld: string; wert: string }[];         // 6-7 Zeilen
  charakterText: string;
  achsen: { label: string; wert: number; notiz: string }[]; // 5 Achsen, wert 1-5
  mischAnteile?: { rasse: string; zeigtSich: string }[] | null;
  tagText: string;
  tagesplan: { zeit: string; was: string; dauer: string }[]; // 5-6 Bloecke
  bewegung: { text: string; faustregel: string; uebung: Uebung };
  schlaf: { text: string; stunden: string; anzeichen: string[]; uebung: Uebung };
  kopfarbeit: { text: string; uebung: Uebung; weitere: { name: string; anleitung: string }[] };
  thema: { titel: string; text: string; uebung: Uebung };
  baustellen: { thema: string; warum: string; sofort: string }[]; // 4
  donts: { dont: string; warum: string; stattdessen: string }[];  // 3
  koerpersprache: { signal: string; bedeutung: string }[];        // 5
  wochenplan: { tag: string; aufgabe: string; dauer: string }[];  // 7
  selfCheck: string[];                                  // 5
  selfCheckResult: string;
  closing: string;
}

export interface CharakterprofilInput {
  dogName?: string | null;
  breed?: string | null;
  mischRassen?: string[] | null;
  age?: string | null;
  gender?: string | null;
  content: CharakterprofilContent;
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
function ageLabel(age?: string | null): string {
  const a = (age || "").toLowerCase();
  if (a === "puppy" || a === "welpe") return "Welpe";
  if (a === "young" || a === "junghund") return "Junghund";
  if (a === "senior") return "Senior";
  return "Erwachsen";
}

export async function buildCharakterprofilPDF(input: CharakterprofilInput): Promise<Uint8Array> {
  const DOG = S(input.dogName || "dein Hund").slice(0, 40) || "dein Hund";
  const misch = (input.mischRassen || []).filter(Boolean).map((r) => S(r));
  const BREED = S(input.breed || "Mischling").trim() || "Mischling";
  const BREED_TITEL = misch.length ? `Mischling (${misch.join(", ")})` : BREED;
  const breedKey = (misch[0] || input.breed || "").trim().toLowerCase();
  const AGE = ageLabel(input.age);
  const weiblich = String(input.gender || "").toLowerCase() === "female";
  const ER = weiblich ? "sie" : "er", IHM = weiblich ? "ihr" : "ihm", SEIN = weiblich ? "ihr" : "sein", SEINE = weiblich ? "ihre" : "seine";
  const C = input.content;

  const doc = await PDFDocument.create();
  const F: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const pages: PDFPage[] = [];
  const BOTTOM = 92; // unterhalb davon beginnt der Fussbereich

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
  const newPage = () => {
    const p = doc.addPage([A4_W, A4_H]);
    p.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
    p.drawRectangle({ x: 0, y: A4_H - 6, width: A4_W, height: 6, color: GOLD });
    pages.push(p); return p;
  };
  const header = (p: PDFPage, pill: string, title: string): number => {
    let y = A4_H - 60; const pw = F.bold.widthOfTextAtSize(S(pill), 9) + 18;
    rrect(p, MARGIN, y - 18, pw, 22, 4, GOLD);
    p.drawText(S(pill), { x: MARGIN + 9, y: y - 12, size: 9, font: F.bold, color: WHITE });
    y -= 56;
    for (const line of wrap(title, F.bold, 21, CONTENT_W)) { p.drawText(line, { x: MARGIN, y, size: 21, font: F.bold, color: TEXT_DARK }); y -= 27; }
    y -= 10; p.drawRectangle({ x: MARGIN, y, width: CONTENT_W, height: 1, color: BORDER_LIGHT });
    return y - 24;
  };

  // Seiten-Kontext: erlaubt automatischen Umbruch mitten im Abschnitt
  type Ctx = { p: PDFPage; y: number; pill: string; titel: string };
  const start = (pill: string, titel: string): Ctx => { const p = newPage(); return { p, y: header(p, pill, titel), pill, titel }; };
  const platz = (c: Ctx, noetig: number) => {
    if (c.y - noetig >= BOTTOM) return;
    c.p = newPage(); c.y = header(c.p, c.pill, c.titel + " (Fortsetzung)");
  };

  const para = (c: Ctx, t: string, o: any = {}) => {
    const size = o.size ?? 11, color = o.color ?? TEXT_DARK, font = o.font ?? F.regular, gap = o.gap ?? 7;
    for (const line of wrap(t, font, size, CONTENT_W)) {
      platz(c, size + gap);
      c.p.drawText(line, { x: MARGIN, y: c.y, size, font, color }); c.y -= size + gap;
    }
    c.y -= 5;
  };
  const subhead = (c: Ctx, t: string) => { platz(c, 40); c.p.drawText(S(t), { x: MARGIN, y: c.y, size: 13, font: F.bold, color: DARK_BROWN }); c.y -= 21; };
  const bullet = (c: Ctx, t: string, farbe: any = GOLD) => {
    const ls = wrap(t, F.regular, 10.5, CONTENT_W - 20); platz(c, ls.length * 15 + 6);
    c.p.drawCircle({ x: MARGIN + 4, y: c.y + 3, size: 2.2, color: farbe });
    ls.forEach((line, i) => c.p.drawText(line, { x: MARGIN + 16, y: c.y - i * 15, size: 10.5, font: F.regular, color: TEXT_MEDIUM }));
    c.y -= ls.length * 15 + 6;
  };
  const box = (c: Ctx, label: string, t: string, o: any = {}) => {
    const bg = o.bg ?? BG_LIGHT, akzent = o.akzent ?? GOLD, size = o.size ?? 10;
    const ls = wrap(t, F.regular, size, CONTENT_W - 32); const bh = 44 + ls.length * (size + 4);
    platz(c, bh + 20); c.y -= 18;
    rrect(c.p, MARGIN, c.y - bh + 14, CONTENT_W, bh, 7, bg);
    c.p.drawRectangle({ x: MARGIN, y: c.y - bh + 14, width: 3, height: bh, color: akzent });
    c.p.drawText(S(label), { x: MARGIN + 14, y: c.y - 4, size: 10, font: F.bold, color: DARK_BROWN });
    c.y -= 24;
    for (const line of ls) { c.p.drawText(line, { x: MARGIN + 14, y: c.y, size, font: F.regular, color: TEXT_MEDIUM }); c.y -= size + 4; }
    c.y -= 16;
  };
  const table = (c: Ctx, colW: number[], headers: string[], rows: string[][]) => {
    const x = MARGIN, pad = 7, fs = 9.5, lh = 12.5, tw = colW.reduce((a, b) => a + b, 0), hH = 22;
    const kopf = () => {
      c.p.drawRectangle({ x, y: c.y - hH, width: tw, height: hH, color: DARK_BROWN });
      let cx = x;
      for (let i = 0; i < headers.length; i++) { c.p.drawText(S(headers[i]), { x: cx + pad, y: c.y - 15, size: 9.5, font: F.bold, color: WHITE }); cx += colW[i]; }
      c.y -= hH;
    };
    platz(c, hH + 40); kopf();
    rows.forEach((row, ri) => {
      const wr = row.map((cell, i) => wrap(cell, F.regular, fs, colW[i] - 2 * pad));
      const rh = Math.max(...wr.map((w) => w.length)) * lh + 9;
      if (c.y - rh < BOTTOM) { c.p = newPage(); c.y = header(c.p, c.pill, c.titel + " (Fortsetzung)"); kopf(); }
      if (ri % 2 === 1) c.p.drawRectangle({ x, y: c.y - rh, width: tw, height: rh, color: ROW_ALT });
      let cx = x;
      for (let i = 0; i < wr.length; i++) {
        let ty = c.y - 13;
        for (const line of wr[i]) { c.p.drawText(line, { x: cx + pad, y: ty, size: fs, font: i === 0 ? F.bold : F.regular, color: TEXT_DARK }); ty -= lh; }
        cx += colW[i];
      }
      c.p.drawRectangle({ x, y: c.y - rh, width: tw, height: 0.5, color: BORDER_LIGHT });
      c.y -= rh;
    });
    c.y -= 6;
  };
  // Charakter-Achse als Balken (1-5)
  const achse = (c: Ctx, label: string, wert: number, notiz: string) => {
    platz(c, 46);
    c.p.drawText(S(label), { x: MARGIN, y: c.y, size: 10.5, font: F.bold, color: TEXT_DARK });
    const bw = 190, bx = A4_W - MARGIN - bw, by = c.y - 2;
    rrect(c.p, bx, by, bw, 9, 4.5, BG_LIGHT);
    const v = Math.max(1, Math.min(5, Math.round(wert || 3)));
    rrect(c.p, bx, by, (bw / 5) * v, 9, 4.5, GOLD);
    for (let i = 1; i < 5; i++) c.p.drawRectangle({ x: bx + (bw / 5) * i, y: by, width: 1, height: 9, color: WHITE });
    c.y -= 16;
    for (const line of wrap(notiz, F.regular, 9.5, CONTENT_W - 10)) { c.p.drawText(line, { x: MARGIN, y: c.y, size: 9.5, font: F.regular, color: TEXT_MEDIUM }); c.y -= 13; }
    c.y -= 9;
  };
  // Uebungskarte: Ziel, Dauer, nummerierte Schritte, Achten-Zeile, Plan-B
  // geschaetzte Hoehe einer Uebungskarte, damit sie nicht mit 2 Zeilen auf eine neue Seite rutscht
  const hoeheUebung = (u: Uebung): number => {
    let h = 40 + (u.dauer ? 16 : 0);
    if (u.ziel) h += wrap("Ziel: " + u.ziel, F.regular, 10, CONTENT_W).length * 14 + 6;
    for (const st of u.schritte || []) h += wrap(S(st), F.regular, 10.5, CONTENT_W - 30).length * 15 + 8;
    for (const t of [u.achten, u.wennNicht]) if (t) h += 78 + wrap(t, F.regular, 10, CONTENT_W - 32).length * 14;
    return h;
  };
  const uebung = (c: Ctx, u: Uebung, nummer?: number) => {
    if (!u || !u.titel) return;
    c.y -= 12;
    // ganze Karte am Stueck, solange sie ueberhaupt auf eine Seite passt
    platz(c, Math.min(hoeheUebung(u), A4_H - 200));
    const titel = (nummer ? `Übung ${nummer}: ` : "") + u.titel;
    const kopfH = 30;
    rrect(c.p, MARGIN, c.y - kopfH + 12, CONTENT_W, kopfH, 6, DARK_BROWN);
    c.p.drawText(S(titel), { x: MARGIN + 12, y: c.y - 6, size: 11.5, font: F.bold, color: WHITE });
    c.y -= kopfH + 10;
    if (u.dauer) {
      c.p.drawText(S("Dauer: " + u.dauer), { x: MARGIN, y: c.y, size: 9.5, font: F.bold, color: DARK_BROWN });
      c.y -= 16;
    }
    if (u.ziel) { for (const line of wrap("Ziel: " + u.ziel, F.regular, 10, CONTENT_W)) { platz(c, 14); c.p.drawText(line, { x: MARGIN, y: c.y, size: 10, font: F.regular, color: TEXT_MEDIUM }); c.y -= 14; } c.y -= 6; }
    (u.schritte || []).forEach((st, i) => {
      const ls = wrap(S(st), F.regular, 10.5, CONTENT_W - 30);
      platz(c, ls.length * 15 + 8);
      c.p.drawCircle({ x: MARGIN + 7, y: c.y + 3, size: 8, color: BG_WARM });
      c.p.drawText(String(i + 1), { x: MARGIN + 4.5, y: c.y, size: 9, font: F.bold, color: DARK_BROWN });
      ls.forEach((line, li) => c.p.drawText(line, { x: MARGIN + 24, y: c.y - li * 15, size: 10.5, font: F.regular, color: TEXT_DARK }));
      c.y -= ls.length * 15 + 8;
    });
    c.y -= 4;
    if (u.achten) box(c, "Worauf du achtest", u.achten, { bg: BG_WARM });
    if (u.wennNicht) box(c, "Wenn es nicht klappt", u.wennNicht, { bg: BG_LIGHT });
  };
  const checkZeile = (c: Ctx, t: string, extra?: string) => {
    platz(c, 26);
    c.p.drawRectangle({ x: MARGIN, y: c.y - 2, width: 12, height: 12, borderColor: DARK_BROWN, borderWidth: 1, color: WHITE });
    const ls = wrap(t, F.regular, 10.5, CONTENT_W - 120);
    ls.forEach((line, i) => c.p.drawText(line, { x: MARGIN + 22, y: c.y + 0.5 - i * 14, size: 10.5, font: F.regular, color: TEXT_DARK }));
    if (extra) c.p.drawText(S(extra), { x: A4_W - MARGIN - F.regular.widthOfTextAtSize(S(extra), 9.5), y: c.y + 0.5, size: 9.5, font: F.regular, color: TEXT_MEDIUM });
    c.y -= ls.length * 14 + 9;
  };
  const ratingRow = (c: Ctx, t: string) => {
    platz(c, 50);
    for (const line of wrap(t, F.bold, 10.5, CONTENT_W)) { c.p.drawText(line, { x: MARGIN, y: c.y, size: 10.5, font: F.bold, color: TEXT_DARK }); c.y -= 14; }
    c.y -= 3; let bx = MARGIN + 4;
    for (const o of ["oft", "manchmal", "selten"]) {
      c.p.drawRectangle({ x: bx, y: c.y - 9, width: 11, height: 11, borderColor: DARK_BROWN, borderWidth: 1, color: WHITE });
      c.p.drawText(o, { x: bx + 15, y: c.y - 8, size: 9, font: F.regular, color: TEXT_MEDIUM });
      bx += 15 + F.regular.widthOfTextAtSize(o, 9) + 24;
    }
    c.y -= 22;
  };

  async function embedBreed(): Promise<any | null> {
    try { const ip = join(process.cwd(), "public", "breeds", breedFileName(breedKey)); if (existsSync(ip)) return await doc.embedJpg(readFileSync(ip)); } catch { /* */ }
    return null;
  }

  // ── 1 Cover ───────────────────────────────────────────────────────────
  {
    const p = newPage(); const pill = "CHARAKTERPROFIL";
    const pw = F.bold.widthOfTextAtSize(pill, 9) + 18;
    rrect(p, MARGIN, A4_H - 95, pw, 22, 4, GOLD);
    p.drawText(pill, { x: MARGIN + 9, y: A4_H - 89, size: 9, font: F.bold, color: WHITE });
    p.drawText(S(`${DOG}s Charakterprofil`), { x: MARGIN, y: A4_H - 140, size: 30, font: F.bold, color: TEXT_DARK });
    for (const [i, line] of wrap(`${BREED_TITEL} · ${AGE}`, F.regular, 13, CONTENT_W).entries()) {
      p.drawText(line, { x: MARGIN, y: A4_H - 168 - i * 18, size: 13, font: F.regular, color: TEXT_MEDIUM });
    }
    let imgY = A4_H - 470;
    const img = await embedBreed();
    if (img) { const iw = CONTENT_W, ih = Math.min((img.height / img.width) * iw, 290); imgY = A4_H - 210 - ih; p.drawImage(img, { x: MARGIN, y: imgY, width: iw, height: ih }); }
    let y = imgY - 34;
    for (const line of wrap(`Warum ${DOG} so ist, wie ${ER} ist. Und was das für euren Alltag heißt: Bewegung, Schlaf, Kopfarbeit, typische Baustellen. Mit Übungen, die du sofort umsetzen kannst.`, F.regular, 11, CONTENT_W)) {
      p.drawText(line, { x: MARGIN, y, size: 11, font: F.regular, color: TEXT_MEDIUM }); y -= 18;
    }
    y -= 10;
    rrect(p, MARGIN, y - 54, CONTENT_W, 50, 7, BG_WARM);
    p.drawText("So liest du dieses Profil", { x: MARGIN + 14, y: y - 18, size: 10, font: F.bold, color: DARK_BROWN });
    p.drawText(S("Erst verstehen (Seite 2 bis 6), dann umsetzen. Jede Übung ist einzeln machbar."), { x: MARGIN + 14, y: y - 36, size: 10, font: F.regular, color: TEXT_MEDIUM });
  }

  // ── 2 Kurz gesagt ─────────────────────────────────────────────────────
  {
    const c = start("KURZ GESAGT", `${DOG} in drei Sätzen`);
    box(c, `Das ist ${DOG}`, C.kurzgesagt, { bg: BG_WARM, size: 11 });
    para(c, C.herkunft);
    if (C.steckbrief?.length) {
      subhead(c, "Steckbrief");
      table(c, [150, CONTENT_W - 150], ["Merkmal", "Bei " + DOG], C.steckbrief.map((r) => [r.feld, r.wert]));
    }
  }

  // ── 3 So tickt er (Achsen) ────────────────────────────────────────────
  {
    const c = start("CHARAKTER", `So tickt ${DOG}`);
    para(c, C.charakterText);
    if (C.achsen?.length) {
      subhead(c, "Auf einen Blick");
      for (const a of C.achsen) achse(c, a.label, a.wert, a.notiz);
      box(c, "Was das praktisch heißt", `Die Balken sind kein Zeugnis. Sie zeigen, wo ${DOG} von Haus aus viel mitbringt. Genau da setzen die Übungen in diesem Profil an.`, { bg: BG_LIGHT });
    }
  }

  // ── 4 Mischlings-Anteile (nur wenn vorhanden) ─────────────────────────
  if (C.mischAnteile?.length) {
    const c = start("MISCHUNG", `Was in ${DOG} steckt`);
    para(c, `${DOG} ist kein halber Hund von jeder Rasse. ${ER.charAt(0).toUpperCase() + ER.slice(1)} hat aus jeder Richtung Anlagen mitbekommen, und die zeigen sich in ganz unterschiedlichen Situationen.`);
    table(c, [150, CONTENT_W - 150], ["Anteil", "Zeigt sich bei " + DOG + " so"], C.mischAnteile.map((m) => [m.rasse, m.zeigtSich]));
    box(c, "Merke", `Wenn etwas nicht passt: Streich es. Du kennst ${DOG} besser als jede Rassetabelle.`, { bg: BG_WARM });
  }

  // ── 5 Sein Tag ────────────────────────────────────────────────────────
  {
    const c = start("SEIN TAG", `Wie ${DOG}s Tag aussehen sollte`);
    para(c, C.tagText);
    if (C.tagesplan?.length) {
      table(c, [95, 105, CONTENT_W - 200], ["Zeit", "Dauer", "Was"], C.tagesplan.map((t) => [t.zeit, t.dauer, t.was]));
      box(c, "Nicht in Stein gemeißelt", `Verschieb die Bloecke, wie es zu deinem Tag passt. Wichtig ist die Reihenfolge: erst Reiz, dann Ruhe. Nicht umgekehrt.`, { bg: BG_LIGHT });
    }
  }

  // ── 6 Bewegung + Uebung 1 ─────────────────────────────────────────────
  {
    const c = start("BEWEGUNG", `Wie viel Gassi ${DOG} wirklich braucht`);
    para(c, C.bewegung?.text || "");
    if (C.bewegung?.faustregel) box(c, "Faustregel", C.bewegung.faustregel, { bg: BG_WARM });
    uebung(c, C.bewegung?.uebung, 1);
  }

  // ── 7 Schlaf + Uebung 2 ───────────────────────────────────────────────
  {
    const c = start("SCHLAF & RUHE", `Warum Ruhe bei ${DOG} Training ist`);
    para(c, C.schlaf?.text || "");
    if (C.schlaf?.stunden) box(c, `${SEIN.charAt(0).toUpperCase() + SEIN.slice(1)} Bedarf`, C.schlaf.stunden, { bg: BG_WARM });
    if (C.schlaf?.anzeichen?.length) {
      subhead(c, "Daran erkennst du Übermüdung");
      for (const a of C.schlaf.anzeichen) bullet(c, a, RED_SOFT);
    }
    uebung(c, C.schlaf?.uebung, 2);
  }

  // ── 8 Kopfarbeit + Uebung 3 ───────────────────────────────────────────
  {
    const c = start("KOPFARBEIT", `Beschäftigung, die zu ${DOG} passt`);
    para(c, C.kopfarbeit?.text || "");
    uebung(c, C.kopfarbeit?.uebung, 3);
    if (C.kopfarbeit?.weitere?.length) {
      subhead(c, "Zwei weitere Ideen für zwischendurch");
      table(c, [150, CONTENT_W - 150], ["Idee", "So geht es"], C.kopfarbeit.weitere.map((w) => [w.name, w.anleitung]));
    }
  }

  // ── 9 Euer Thema + Uebung 4 ───────────────────────────────────────────
  if (C.thema?.titel) {
    const c = start("EUER THEMA", C.thema.titel);
    para(c, C.thema.text);
    uebung(c, C.thema.uebung, 4);
  }

  // ── 10 Typische Baustellen ────────────────────────────────────────────
  if (C.baustellen?.length) {
    const c = start("BAUSTELLEN", `Was bei ${BREED} häufiger schwierig wird`);
    para(c, `Kein Muss, aber gut zu kennen, bevor daraus ein Problem wird. Das sind ${SEINE} typischen Baustellen, und zu jedem Punkt steht, was du sofort tun kannst.`);
    for (const b of C.baustellen) {
      subhead(c, b.thema);
      para(c, b.warum, { size: 10.5, color: TEXT_MEDIUM });
      box(c, "Sofort umsetzbar", b.sofort, { bg: BG_WARM });
    }
  }

  // ── 11 Don'ts ─────────────────────────────────────────────────────────
  if (C.donts?.length) {
    const c = start("BESSER NICHT", `Was du ${DOG} ersparst`);
    para(c, `Diese drei Dinge sind fast immer gut gemeint. Bei ${DOG} bewirken sie das Gegenteil.`);
    table(c, [150, 175, CONTENT_W - 325], ["Besser nicht", "Warum", "Stattdessen"], C.donts.map((d) => [d.dont, d.warum, d.stattdessen]));
  }

  // ── 12 Koerpersprache ─────────────────────────────────────────────────
  if (C.koerpersprache?.length) {
    const c = start("KÖRPERSPRACHE", `Wie ${DOG} mit dir spricht`);
    para(c, `${DOG} sagt dir ständig, wie es ${IHM} geht. Diese fünf Signale siehst du bei ${IHM} am häufigsten.`);
    table(c, [160, CONTENT_W - 160], ["Signal", "Was es bedeutet"], C.koerpersprache.map((k) => [k.signal, k.bedeutung]));
  }

  // ── 13 7-Tage-Start ───────────────────────────────────────────────────
  if (C.wochenplan?.length) {
    const c = start("DIE ERSTE WOCHE", `${DOG}s 7-Tage-Start`);
    para(c, `Sieben Tage, sieben kleine Aufgaben aus diesem Profil. Nichts davon dauert lange. Hak ab, was ihr geschafft habt.`);
    for (const t of C.wochenplan) checkZeile(c, `${t.tag}: ${t.aufgabe}`, t.dauer);
    box(c, "Wenn ein Tag ausfällt", `Dann fällt er aus. Mach am nächsten Tag weiter, statt zwei Aufgaben nachzuholen. ${DOG} braucht Regelmäßigkeit, keine Rekorde.`, { bg: BG_WARM });
  }

  // ── 14 Selbst-Check ───────────────────────────────────────────────────
  if (C.selfCheck?.length) {
    const c = start("SELBST-CHECK", `Wie gut kennst du ${DOG}?`);
    para(c, `Kreuz spontan an, wie oft das auf ${DOG} zutrifft. Die Auflösung steht darunter.`);
    for (const s of C.selfCheck.slice(0, 5)) ratingRow(c, s);
    if (C.selfCheckResult) box(c, "Deine Auflösung", C.selfCheckResult, { bg: BG_WARM, size: 10.5 });
  }

  // ── 15 Fortschritt (4 Wochen zum Ausfuellen) ──────────────────────────
  {
    const c = start("DRANBLEIBEN", `${DOG}s nächste vier Wochen`);
    para(c, `Trag einmal pro Woche ein, was sich verändert hat. In vier Wochen siehst du schwarz auf weiss, ob es besser wird. Das ist ehrlicher als jedes Gefuehl.`);
    const zeilen = ["Woche 1", "Woche 2", "Woche 3", "Woche 4"];
    for (const z of zeilen) {
      platz(c, 76);
      rrect(c.p, MARGIN, c.y - 62, CONTENT_W, 58, 7, BG_LIGHT);
      c.p.drawText(S(z), { x: MARGIN + 14, y: c.y - 18, size: 10, font: F.bold, color: DARK_BROWN });
      c.p.drawText("Datum: ______________", { x: MARGIN + 90, y: c.y - 18, size: 9.5, font: F.regular, color: TEXT_MEDIUM });
      c.p.drawText("Was besser läuft:", { x: MARGIN + 14, y: c.y - 36, size: 9.5, font: F.regular, color: TEXT_MEDIUM });
      c.p.drawRectangle({ x: MARGIN + 120, y: c.y - 40, width: CONTENT_W - 140, height: 0.6, color: BORDER_LIGHT });
      c.p.drawText("Was noch hängt:", { x: MARGIN + 14, y: c.y - 52, size: 9.5, font: F.regular, color: TEXT_MEDIUM });
      c.p.drawRectangle({ x: MARGIN + 120, y: c.y - 56, width: CONTENT_W - 140, height: 0.6, color: BORDER_LIGHT });
      c.y -= 72;
    }
    box(c, "Kleiner Hinweis", `Veränderung bei Hunden kommt in Wellen. Eine schlechte Woche nach zwei guten ist normal und kein Rückschritt.`, { bg: BG_WARM });
  }

  // ── 16 Abschluss ──────────────────────────────────────────────────────
  {
    const c = start("ZUM SCHLUSS", `${DOG} & du`);
    para(c, C.closing);
    box(c, "Und jetzt?", `Nimm dir eine einzige Übung aus diesem Profil vor. Die, bei der du beim Lesen genickt hast. Der Rest läuft ${DOG} nicht weg.`, { bg: BG_WARM, size: 10.5 });
    box(c, "Fragen?", `Schreib uns an support@pfoten-plan.de. Wir lesen jede Mail selbst.`, { bg: BG_LIGHT });
  }

  // ── Footer ────────────────────────────────────────────────────────────
  const TOTAL = pages.length;
  pages.forEach((p, i) => {
    const dl = wrap(DISCLAIMER, F.italic, 7.5, CONTENT_W); let dy = 32 + dl.length * 9;
    for (const line of dl) { const w = F.italic.widthOfTextAtSize(line, 7.5); p.drawText(line, { x: (A4_W - w) / 2, y: dy, size: 7.5, font: F.italic, color: TEXT_LIGHT }); dy -= 9; }
    const meta = S(`Pfoten-Plan · ${DOG}s Charakterprofil · Seite ${i + 1}/${TOTAL}`);
    const mw = F.regular.widthOfTextAtSize(meta, 8);
    p.drawText(meta, { x: (A4_W - mw) / 2, y: 18, size: 8, font: F.regular, color: TEXT_LIGHT });
    p.drawRectangle({ x: 0, y: 0, width: A4_W, height: 3, color: GOLD });
  });

  return await doc.save();
}
