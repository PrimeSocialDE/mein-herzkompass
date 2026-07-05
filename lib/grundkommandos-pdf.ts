// lib/grundkommandos-pdf.ts
//
// Rendert den "Notfall-Grundkommando-Plan" (Content aus grundkommandos-content.ts)
// als A4-PDF via pdf-lib (server-seitig, kein Browser). Auto-Flow-Pagination:
// Bloecke fliessen ueber beliebig viele Seiten, neue Seite wenn kein Platz.

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import type { GrundkommandosContent } from "./grundkommandos-content";

const A4_W = 595.28,
  A4_H = 841.89,
  MARGIN = 54,
  CONTENT_W = A4_W - 2 * MARGIN,
  BOTTOM = 66;

const GOLD = rgb(196 / 255, 165 / 255, 118 / 255);
const BROWN = rgb(139 / 255, 115 / 255, 85 / 255);
const INK = rgb(26 / 255, 26 / 255, 26 / 255);
const TXT = rgb(66 / 255, 65 / 255, 63 / 255);
const MUT = rgb(95 / 255, 87 / 255, 72 / 255);
const LIGHT = rgb(150 / 255, 150 / 255, 150 / 255);
const WHITE = rgb(1, 1, 1);
const BORDER = rgb(234 / 255, 221 / 255, 197 / 255);
const CREAM = rgb(1, 249 / 255, 240 / 255);
const TINT = rgb(251 / 255, 246 / 255, 236 / 255);
const GREEN = rgb(47 / 255, 122 / 255, 70 / 255);
const GREEN_BG = rgb(238 / 255, 243 / 255, 232 / 255);
const GREEN_BD = rgb(215 / 255, 224 / 255, 203 / 255);
const AMBER = rgb(176 / 255, 137 / 255, 78 / 255);
const AMBER_BG = rgb(254 / 255, 246 / 255, 238 / 255);
const AMBER_BD = rgb(240 / 255, 220 / 255, 196 / 255);
const BLUE = rgb(65 / 255, 100 / 255, 126 / 255);
const BLUE_BG = rgb(238 / 255, 242 / 255, 246 / 255);
const BLUE_BD = rgb(205 / 255, 216 / 255, 226 / 255);
const CHIP_BG = rgb(243 / 255, 234 / 255, 216 / 255);

// pdf-lib StandardFonts koennen nur WinAnsi -> Sonderzeichen ersetzen/strippen.
const S = (t: any): string =>
  String(t == null ? "" : t)
    .replace(/[‘’‚‹›]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•●·]/g, "-")
    .replace(/→/g, "->")
    .replace(/ /g, " ")
    .replace(/[^\x00-\xFF]/g, "")
    .trim();

function wrap(t: string, f: PDFFont, s: number, mw: number): string[] {
  const ws = S(t).split(/\s+/);
  const ls: string[] = [];
  let c = "";
  for (const w of ws) {
    const x = c ? c + " " + w : w;
    if (f.widthOfTextAtSize(x, s) > mw && c) {
      ls.push(c);
      c = w;
    } else c = x;
  }
  if (c) ls.push(c);
  return ls;
}
function rrect(p: PDFPage, x: number, y: number, w: number, h: number, r: number, color: any, border?: any) {
  p.drawRectangle({ x: x + r, y, width: w - 2 * r, height: h, color });
  p.drawRectangle({ x, y: y + r, width: w, height: h - 2 * r, color });
  for (const [cx, cy] of [
    [x + r, y + r],
    [x + w - r, y + r],
    [x + r, y + h - r],
    [x + w - r, y + h - r],
  ])
    p.drawCircle({ x: cx, y: cy, size: r, color });
  if (border) {
    p.drawRectangle({ x, y, width: w, height: h, borderColor: border, borderWidth: 1, color: undefined as any, opacity: 0 });
  }
}

export async function buildGrundkommandosPDF(
  content: GrundkommandosContent,
  meta: { breed?: string | null } = {}
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const F = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const dog = S(content.dogName || "dein Hund");
  const breed = S(meta.breed || "");

  const st = { p: null as unknown as PDFPage, y: 0 };
  const topBar = (p: PDFPage) => p.drawRectangle({ x: 0, y: A4_H - 6, width: A4_W, height: 6, color: GOLD });
  const newPage = () => {
    st.p = doc.addPage([A4_W, A4_H]);
    topBar(st.p);
    st.y = A4_H - 54;
  };
  const ensure = (h: number) => {
    if (st.y - h < BOTTOM) newPage();
  };
  const gap = (h: number) => {
    st.y -= h;
  };

  // --- Textbausteine (paginieren pro Zeile/Block) ---
  const lines = (t: string, o: { size?: number; font?: PDFFont; color?: any; lh?: number; x?: number; mw?: number } = {}) => {
    const size = o.size ?? 11,
      font = o.font ?? F.regular,
      color = o.color ?? TXT,
      lh = o.lh ?? size + 4.5,
      x = o.x ?? MARGIN,
      mw = o.mw ?? CONTENT_W;
    for (const ln of wrap(t, font, size, mw)) {
      ensure(lh);
      st.p.drawText(ln, { x, y: st.y, size, font, color });
      st.y -= lh;
    }
  };
  const eyebrow = (t: string) => {
    ensure(24);
    st.p.drawText(S(t).toUpperCase(), { x: MARGIN, y: st.y, size: 9.5, font: F.bold, color: AMBER });
    st.y -= 18;
  };
  const heading = (t: string, badge?: { text: string; fg: any; bg: any }) => {
    ensure(34);
    const hl = wrap(t, F.bold, 17, CONTENT_W - (badge ? 150 : 0));
    let first = true;
    for (const ln of hl) {
      ensure(24);
      st.p.drawText(ln, { x: MARGIN, y: st.y, size: 17, font: F.bold, color: INK });
      if (first && badge) {
        const bw = F.bold.widthOfTextAtSize(badge.text, 8.5) + 16;
        rrect(st.p, A4_W - MARGIN - bw, st.y - 3, bw, 18, 9, badge.bg);
        st.p.drawText(S(badge.text), { x: A4_W - MARGIN - bw + 8, y: st.y + 1, size: 8.5, font: F.bold, color: badge.fg });
      }
      first = false;
      st.y -= 23;
    }
    st.y -= 3;
  };
  const box = (label: string, text: string, bg: any, bd: any, accent: any, labelColor: any) => {
    const bodyLines = wrap(text, F.regular, 10.5, CONTENT_W - 28);
    const bh = 18 + 15 + bodyLines.length * 14 + 12;
    ensure(bh + 6);
    gap(8);
    const top = st.y;
    rrect(st.p, MARGIN, top - bh, CONTENT_W, bh, 8, bg);
    st.p.drawRectangle({ x: MARGIN, y: top - bh, width: 3.5, height: bh, color: accent });
    st.p.drawText(S(label), { x: MARGIN + 14, y: top - 16, size: 10, font: F.bold, color: labelColor });
    let ty = top - 33;
    for (const ln of bodyLines) {
      st.p.drawText(ln, { x: MARGIN + 14, y: ty, size: 10.5, font: F.regular, color: MUT });
      ty -= 14;
    }
    st.y = top - bh - 8;
  };
  const numberedSteps = (steps: string[]) => {
    for (let i = 0; i < steps.length; i++) {
      const bl = wrap(steps[i], F.regular, 10.5, CONTENT_W - 40);
      const h = Math.max(24, bl.length * 14 + 8);
      ensure(h);
      const top = st.y;
      st.p.drawCircle({ x: MARGIN + 12, y: top - 6, size: 11, color: CHIP_BG });
      const num = String(i + 1);
      const nw = F.bold.widthOfTextAtSize(num, 10);
      st.p.drawText(num, { x: MARGIN + 12 - nw / 2, y: top - 9.5, size: 10, font: F.bold, color: AMBER });
      let ty = top - 4;
      for (const ln of bl) {
        st.p.drawText(ln, { x: MARGIN + 32, y: ty, size: 10.5, font: F.regular, color: TXT });
        ty -= 14;
      }
      st.y = top - h;
    }
  };

  // ---------- COVER ----------
  newPage();
  st.p.drawRectangle({ x: 0, y: A4_H - 320, width: A4_W, height: 320 - 6, color: CREAM });
  topBar(st.p);
  st.p.drawText("PFOTEN-PLAN · EXTRA FÜR " + dog.toUpperCase(), { x: MARGIN, y: A4_H - 120, size: 10, font: F.bold, color: BROWN });
  st.p.drawText("Notfall-Grundkommando-Plan", { x: MARGIN, y: A4_H - 165, size: 28, font: F.bold, color: INK });
  for (const [i, ln] of wrap(S(content.subtitle || "Kontroll-Kommandos, die deinem Hund im Alltag Sicherheit geben"), F.regular, 14, CONTENT_W).entries()) {
    st.p.drawText(ln, { x: MARGIN, y: A4_H - 195 - i * 20, size: 14, font: F.regular, color: MUT });
  }
  st.p.drawText("Persönlich erstellt für " + dog + (breed ? " - " + breed : ""), { x: MARGIN, y: A4_H - 258, size: 12, font: F.bold, color: BROWN });

  // Personalisierungs-Box
  const cmds = content.sections.filter((x) => x.key === "cmd");
  const neu = cmds.filter((c) => !/kann/.test(c.status || "")).map((c) => c.command);
  st.y = A4_H - 360;
  const knowsLines = wrap("Kann " + dog + " schon: " + (content.known?.length ? content.known.join(", ") : "-"), F.regular, 11, CONTENT_W - 36);
  const focusLines = wrap("Neu aufgebaut: " + (neu.join(", ") || "Festigung & Sicherheit"), F.bold, 12, CONTENT_W - 36);
  const boxH = 24 + knowsLines.length * 15 + 8 + focusLines.length * 16 + 20;
  rrect(st.p, MARGIN, st.y - boxH, CONTENT_W, boxH, 12, CREAM, BORDER);
  let by = st.y - 22;
  st.p.drawText("AUF " + dog.toUpperCase() + " ZUGESCHNITTEN", { x: MARGIN + 18, y: by, size: 10, font: F.bold, color: BROWN });
  by -= 20;
  for (const ln of knowsLines) {
    st.p.drawText(ln, { x: MARGIN + 18, y: by, size: 11, font: F.regular, color: TXT });
    by -= 15;
  }
  by -= 6;
  for (const ln of focusLines) {
    st.p.drawText(ln, { x: MARGIN + 18, y: by, size: 12, font: F.bold, color: INK });
    by -= 16;
  }

  // ---------- INHALT ----------
  const sec = (k: string) => content.sections.find((x) => x.key === k);
  const warum = sec("warum"),
    haltung = sec("haltung"),
    methode = sec("methode"),
    playbook = sec("playbook"),
    wenn = sec("wenn"),
    woche = sec("woche");

  newPage();
  if (warum) {
    eyebrow("Warum das wichtig ist");
    heading(warum.title);
    lines(warum.body);
    gap(10);
  }
  if (haltung) {
    heading(haltung.title);
    lines(haltung.body);
    gap(4);
    for (const p of haltung.points || []) {
      const bl = wrap(p, F.regular, 10.5, CONTENT_W - 20);
      ensure(bl.length * 14 + 6);
      st.p.drawText("-", { x: MARGIN + 2, y: st.y, size: 11, font: F.bold, color: AMBER });
      let ty = st.y;
      for (const ln of bl) {
        st.p.drawText(ln, { x: MARGIN + 16, y: ty, size: 10.5, font: F.regular, color: TXT });
        ty -= 14;
      }
      st.y = ty - 2;
    }
    gap(10);
  }
  if (methode) {
    eyebrow("Die Methode - gilt für jedes Kommando");
    heading(methode.title);
    lines(methode.body);
    gap(4);
    for (const [i, b] of (methode.bausteine || []).entries()) {
      const bl = wrap(b.text, F.regular, 10.5, CONTENT_W - 30);
      const h = Math.max(20, 16 + bl.length * 14);
      ensure(h + 4);
      const top = st.y;
      const nw = F.bold.widthOfTextAtSize(String(i + 1), 10);
      st.p.drawRectangle({ x: MARGIN, y: top - 18, width: 20, height: 20, color: BROWN });
      st.p.drawText(String(i + 1), { x: MARGIN + 10 - nw / 2, y: top - 14, size: 10, font: F.bold, color: WHITE });
      st.p.drawText(S(b.name), { x: MARGIN + 30, y: top - 2, size: 11, font: F.bold, color: INK });
      let ty = top - 17;
      for (const ln of bl) {
        st.p.drawText(ln, { x: MARGIN + 30, y: ty, size: 10.5, font: F.regular, color: TXT });
        ty -= 14;
      }
      st.y = Math.min(top - h, ty) - 6;
    }
    gap(10);
  }

  // Kommandos
  eyebrow("Die Kommandos - Schritt für Schritt");
  for (const c of cmds) {
    ensure(60);
    const kann = /kann/.test(c.status || "");
    heading(c.title, kann ? { text: dog + " kann das schon", fg: GREEN, bg: GREEN_BG } : { text: "Neu für " + dog, fg: AMBER, bg: CHIP_BG });
    if (c.intro) lines(c.intro, { size: 10.5, font: F.italic, color: MUT });
    if (c.vorbereitung) box("Vorbereitung", c.vorbereitung, TINT, BORDER, GOLD, BROWN);
    eyebrow("So zeigst du es " + dog);
    numberedSteps(c.aufbau || []);
    if (c.wenn_nicht) box("Wenn " + dog + " nicht mitmacht", c.wenn_nicht, AMBER_BG, AMBER_BD, AMBER, AMBER);
    if (c.wiederholung) box("Realistisch bleiben", c.wiederholung, BLUE_BG, BLUE_BD, BLUE, BLUE);
    if (c.erfolg) box("So erkennst du Erfolg", c.erfolg, GREEN_BG, GREEN_BD, GREEN, GREEN);
    if (c.fehler) box("Häufiger Fehler", c.fehler, AMBER_BG, AMBER_BD, AMBER, AMBER);
    gap(14);
  }

  // Playbook
  if (playbook) {
    ensure(50);
    eyebrow("Das Alltags-Playbook");
    heading(playbook.title);
    if (playbook.intro) lines(playbook.intro);
    gap(4);
    const groups: Record<string, any[]> = {};
    for (const s of playbook.situations || []) (groups[s.ort] = groups[s.ort] || []).push(s);
    for (const [ort, arr] of Object.entries(groups)) {
      ensure(30);
      st.p.drawText(S(ort), { x: MARGIN, y: st.y, size: 13, font: F.bold, color: BROWN });
      st.y -= 20;
      for (const s of arr) {
        const bl = wrap(s.tun, F.regular, 10.5, CONTENT_W - 28);
        const h = 20 + bl.length * 14 + 12;
        ensure(h + 6);
        gap(4);
        const top = st.y;
        rrect(st.p, MARGIN, top - h, CONTENT_W, h, 8, WHITE, BORDER);
        st.p.drawText(S(s.situation), { x: MARGIN + 14, y: top - 16, size: 11, font: F.bold, color: INK });
        const kt = S(s.kommando);
        const kw = F.bold.widthOfTextAtSize(kt, 8.5) + 14;
        rrect(st.p, A4_W - MARGIN - kw - 8, top - 18, kw, 16, 8, CHIP_BG);
        st.p.drawText(kt, { x: A4_W - MARGIN - kw - 8 + 7, y: top - 14, size: 8.5, font: F.bold, color: AMBER });
        let ty = top - 33;
        for (const ln of bl) {
          st.p.drawText(ln, { x: MARGIN + 14, y: ty, size: 10.5, font: F.regular, color: TXT });
          ty -= 14;
        }
        st.y = top - h - 4;
      }
      gap(6);
    }
    gap(10);
  }

  // Was tun wenn
  if (wenn) {
    ensure(40);
    eyebrow("Wenn es hakt");
    heading(wenn.title);
    for (const c of wenn.cases || []) {
      const bl = wrap(c.tun, F.regular, 10.5, CONTENT_W - 28);
      const h = 18 + bl.length * 14 + 12;
      ensure(h + 4);
      gap(4);
      const top = st.y;
      rrect(st.p, MARGIN, top - h, CONTENT_W, h, 8, TINT, BORDER);
      st.p.drawText(S(c.fall), { x: MARGIN + 14, y: top - 15, size: 11, font: F.bold, color: INK });
      let ty = top - 31;
      for (const ln of bl) {
        st.p.drawText(ln, { x: MARGIN + 14, y: ty, size: 10.5, font: F.regular, color: MUT });
        ty -= 14;
      }
      st.y = top - h - 4;
    }
    gap(10);
  }

  // 7-Tage-Plan
  if (woche) {
    ensure(50);
    eyebrow("Dein Start");
    heading(woche.title);
    for (const d of woche.days || []) {
      const bl = wrap(d.fokus, F.regular, 10.5, CONTENT_W - 100);
      const h = Math.max(22, bl.length * 14 + 8);
      ensure(h);
      const top = st.y;
      const lw = F.bold.widthOfTextAtSize(S(d.tag), 10) + 14;
      rrect(st.p, MARGIN, top - 16, lw, 18, 4, BROWN);
      st.p.drawText(S(d.tag), { x: MARGIN + 7, y: top - 12, size: 10, font: F.bold, color: WHITE });
      let ty = top - 3;
      for (const ln of bl) {
        st.p.drawText(ln, { x: MARGIN + lw + 12, y: ty, size: 10.5, font: F.regular, color: TXT });
        ty -= 14;
      }
      st.y = top - h;
    }
    // Erfolgs-Check
    gap(6);
    const checks = woche.check || [];
    const chLines = checks.map((c: string) => wrap(c, F.regular, 10.5, CONTENT_W - 60));
    const chH = 24 + chLines.reduce((a: number, l: string[]) => a + Math.max(16, l.length * 14 + 4), 0) + 12;
    ensure(chH + 6);
    gap(6);
    const top = st.y;
    rrect(st.p, MARGIN, top - chH, CONTENT_W, chH, 10, GREEN_BG, GREEN_BD);
    st.p.drawText("ERFOLGS-CHECK", { x: MARGIN + 16, y: top - 18, size: 10, font: F.bold, color: GREEN });
    let cy = top - 38;
    for (const l of chLines) {
      st.p.drawRectangle({ x: MARGIN + 16, y: cy - 2, width: 12, height: 12, borderColor: GREEN, borderWidth: 1.2, color: WHITE });
      let ty = cy;
      for (const ln of l) {
        st.p.drawText(ln, { x: MARGIN + 36, y: ty, size: 10.5, font: F.regular, color: rgb(58 / 255, 83 / 255, 64 / 255) });
        ty -= 14;
      }
      cy -= Math.max(16, l.length * 14 + 4);
    }
    st.y = top - chH;
  }

  // Footer + Seitenzahlen
  const pages = doc.getPages();
  const total = pages.length;
  pages.forEach((p, i) => {
    p.drawRectangle({ x: 0, y: 0, width: A4_W, height: 3, color: GOLD });
    const meta2 = `Pfoten-Plan - Notfall-Grundkommando-Plan - Seite ${i + 1}/${total}`;
    const mw = F.regular.widthOfTextAtSize(meta2, 8);
    p.drawText(meta2, { x: (A4_W - mw) / 2, y: 16, size: 8, font: F.regular, color: LIGHT });
  });

  return doc.save();
}
