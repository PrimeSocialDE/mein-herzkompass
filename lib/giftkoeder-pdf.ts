// lib/giftkoeder-pdf.ts
//
// Rendert das Handbuch "Nichts vom Boden" (Content aus giftkoeder-content.ts)
// als A4-PDF via pdf-lib. Aufbau und Hilfsfunktionen wie grundkommandos-pdf.ts:
// Auto-Flow, Bloecke fliessen ueber beliebig viele Seiten.
//
// Besonderheit gegenueber den anderen Modulen: die Notfall-Sektion ist rot
// gesetzt und steht bewusst eigenstaendig da. Giftkoeder sind ein
// Gesundheitsrisiko — das Training beugt vor, es ersetzt keinen Tierarzt.

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import type { GiftkoederContent } from "./giftkoeder-content";

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
const RED = rgb(155 / 255, 44 / 255, 44 / 255);
const RED_BG = rgb(253 / 255, 236 / 255, 234 / 255);
const RED_BD = rgb(240 / 255, 205 / 255, 200 / 255);
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
    .replace(/ /g, " ")
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

export async function buildGiftkoederPDF(
  content: GiftkoederContent,
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
  const eyebrow = (t: string, color: any = AMBER) => {
    ensure(24);
    st.p.drawText(S(t).toUpperCase(), { x: MARGIN, y: st.y, size: 9.5, font: F.bold, color });
    st.y -= 18;
  };
  const heading = (t: string, badge?: { text: string; fg: any; bg: any }) => {
    ensure(34);
    const hl = wrap(t, F.bold, 17, CONTENT_W - (badge ? 110 : 0));
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
    // 16 statt 8: die Grossbuchstaben der naechsten Zeile ragen nach oben und
    // sassen sonst auf dem unteren Rahmen der Box.
    st.y = top - bh - 16;
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
  const bullets = (items: string[], dotColor: any = AMBER) => {
    for (const p of items || []) {
      const bl = wrap(p, F.regular, 10.5, CONTENT_W - 20);
      ensure(bl.length * 14 + 6);
      st.p.drawText("-", { x: MARGIN + 2, y: st.y, size: 11, font: F.bold, color: dotColor });
      let ty = st.y;
      for (const ln of bl) {
        st.p.drawText(ln, { x: MARGIN + 16, y: ty, size: 10.5, font: F.regular, color: TXT });
        ty -= 14;
      }
      st.y = ty - 2;
    }
  };
  // Trenner, wenn eine neue Stufe beginnt. Faengt immer oben auf einer Seite an,
  // damit die vier Stufen im ausgedruckten Heft auffindbar bleiben.
  const stufenTrenner = (titel: string) => {
    newPage();
    const h = 56;
    const top = st.y;
    rrect(st.p, MARGIN, top - h, CONTENT_W, h, 10, CREAM, BORDER);
    const tl = wrap(titel, F.bold, 15, CONTENT_W - 36);
    let ty = top - 24;
    for (const ln of tl) {
      st.p.drawText(ln, { x: MARGIN + 18, y: ty, size: 15, font: F.bold, color: BROWN });
      ty -= 19;
    }
    st.y = top - h - 16;
  };

  // ---------- COVER ----------
  newPage();
  st.p.drawRectangle({ x: 0, y: A4_H - 320, width: A4_W, height: 320 - 6, color: CREAM });
  topBar(st.p);
  st.p.drawText("PFOTEN-PLAN · TRAININGS-HANDBUCH FÜR " + dog.toUpperCase(), { x: MARGIN, y: A4_H - 120, size: 10, font: F.bold, color: BROWN });
  st.p.drawText("Nichts vom Boden", { x: MARGIN, y: A4_H - 168, size: 30, font: F.bold, color: INK });
  st.p.drawText("Anti-Giftköder-Training in 20 Übungen", { x: MARGIN, y: A4_H - 196, size: 14, font: F.bold, color: BROWN });
  for (const [i, ln] of wrap(S(content.subtitle || "Vom Küchentisch bis zum Laubhaufen - Schritt für Schritt"), F.regular, 12.5, CONTENT_W).entries()) {
    st.p.drawText(ln, { x: MARGIN, y: A4_H - 224 - i * 18, size: 12.5, font: F.regular, color: MUT });
  }
  st.p.drawText("Persönlich erstellt für " + dog + (breed ? " - " + breed : ""), { x: MARGIN, y: A4_H - 288, size: 12, font: F.bold, color: BROWN });

  const sec = (k: string) => content.sections.find((x: any) => x?.key === k);
  const uebungen = content.sections.filter((x: any) => x?.key === "uebung");
  const stufen = Array.from(new Set(uebungen.map((u: any) => S(u.stufe)).filter(Boolean)));

  // Inhalts-Box auf dem Cover: die vier Stufen
  st.y = A4_H - 360;
  const stLines = stufen.map((s) => wrap(s, F.regular, 11, CONTENT_W - 56));
  const boxH = 26 + stLines.reduce((a, l) => a + Math.max(16, l.length * 15), 0) + 22;
  rrect(st.p, MARGIN, st.y - boxH, CONTENT_W, boxH, 12, WHITE, BORDER);
  let by = st.y - 24;
  st.p.drawText("DEIN WEG - " + uebungen.length + " ÜBUNGEN IN " + stufen.length + " STUFEN", { x: MARGIN + 18, y: by, size: 10, font: F.bold, color: BROWN });
  by -= 22;
  for (const l of stLines) {
    st.p.drawCircle({ x: MARGIN + 24, y: by + 4, size: 3.5, color: GOLD });
    let ty = by;
    for (const ln of l) {
      st.p.drawText(ln, { x: MARGIN + 36, y: ty, size: 11, font: F.regular, color: TXT });
      ty -= 15;
    }
    by -= Math.max(16, l.length * 15);
  }

  // ---------- EINLEITUNG ----------
  const warum = sec("warum"),
    sicherheit = sec("sicherheit"),
    methode = sec("methode"),
    notfall = sec("notfall"),
    plan = sec("plan"),
    wenn = sec("wenn");

  newPage();
  if (warum) {
    eyebrow("Warum das passiert");
    heading(warum.title);
    lines(warum.body);
    gap(12);
  }
  if (sicherheit) {
    heading(sicherheit.title);
    if (sicherheit.body) lines(sicherheit.body);
    gap(4);
    bullets(sicherheit.points || []);
    gap(12);
  }
  if (methode) {
    eyebrow("Dein Werkzeugkasten - gilt für jede Übung");
    heading(methode.title);
    if (methode.body) lines(methode.body);
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
  }

  // ---------- DIE 20 ÜBUNGEN ----------
  let letzteStufe = "";
  for (const u of uebungen as any[]) {
    const stufe = S(u.stufe);
    if (stufe && stufe !== letzteStufe) {
      stufenTrenner(stufe);
      letzteStufe = stufe;
    } else {
      ensure(70);
    }
    heading(S(u.title), { text: "Übung " + (u.nummer ?? ""), fg: AMBER, bg: CHIP_BG });
    if (u.intro) lines(u.intro, { size: 10.5, font: F.italic, color: MUT });
    if (u.vorbereitung) box("Das brauchst du", u.vorbereitung, TINT, BORDER, GOLD, BROWN);
    eyebrow("So gehst du vor");
    numberedSteps(u.aufbau || []);
    if (u.wenn_nicht) box("Wenn " + dog + " nicht reagiert", u.wenn_nicht, AMBER_BG, AMBER_BD, AMBER, AMBER);
    if (u.wiederholung) box("Wie oft", u.wiederholung, BLUE_BG, BLUE_BD, BLUE, BLUE);
    if (u.erfolg) box("So erkennst du Erfolg", u.erfolg, GREEN_BG, GREEN_BD, GREEN, GREEN);
    if (u.fehler) box("Häufigster Fehler", u.fehler, AMBER_BG, AMBER_BD, AMBER, AMBER);
    gap(16);
  }

  // ---------- NOTFALL ----------
  if (notfall) {
    newPage();
    const kopfH = 34;
    rrect(st.p, MARGIN, st.y - kopfH, CONTENT_W, kopfH, 8, RED_BG, RED_BD);
    st.p.drawRectangle({ x: MARGIN, y: st.y - kopfH, width: 3.5, height: kopfH, color: RED });
    st.p.drawText("IM NOTFALL - BITTE JETZT LESEN, NICHT ERST DANN", { x: MARGIN + 14, y: st.y - 22, size: 10.5, font: F.bold, color: RED });
    st.y -= kopfH + 28;
    heading(S(notfall.title));
    if (notfall.body) lines(notfall.body);
    gap(8);
    if ((notfall.anzeichen || []).length) {
      eyebrow("Daran erkennst du eine Vergiftung", RED);
      bullets(notfall.anzeichen, RED);
      gap(10);
    }
    if ((notfall.schritte || []).length) {
      eyebrow("In dieser Reihenfolge handeln", RED);
      numberedSteps(notfall.schritte);
      gap(8);
    }
    box(
      "Wichtig",
      "Dieses Training beugt vor. Es ersetzt keinen Tierarzt. Bei Verdacht auf eine Vergiftung fährst du sofort in die Praxis oder Tierklinik und wartest nicht ab, ob es von allein besser wird.",
      RED_BG,
      RED_BD,
      RED,
      RED
    );
    gap(10);
  }

  // ---------- 14-TAGE-PLAN ----------
  if (plan) {
    ensure(60);
    eyebrow("Dein Start");
    heading(S(plan.title));
    // Eine gemeinsame Spaltenbreite fuer alle Tage: sonst ruecken die Texte je
    // nach Laenge des Tag-Labels unterschiedlich weit ein und die linke Kante
    // franst aus.
    const tage = (plan.days || []) as any[];
    const labelW = Math.max(
      54,
      ...tage.map((d: any) => F.bold.widthOfTextAtSize(S(d.tag), 10) + 14)
    );
    for (const d of tage) {
      const text = S(d.fokus) + (d.uebungen ? "  (Übungen " + S(d.uebungen) + ")" : "");
      const bl = wrap(text, F.regular, 10.5, CONTENT_W - labelW - 24);
      const h = Math.max(22, bl.length * 14 + 8);
      ensure(h);
      const top = st.y;
      const lw = labelW;
      rrect(st.p, MARGIN, top - 16, lw, 18, 4, BROWN);
      st.p.drawText(S(d.tag), { x: MARGIN + 7, y: top - 12, size: 10, font: F.bold, color: WHITE });
      let ty = top - 3;
      for (const ln of bl) {
        st.p.drawText(ln, { x: MARGIN + lw + 12, y: ty, size: 10.5, font: F.regular, color: TXT });
        ty -= 14;
      }
      st.y = top - h;
    }
    const checks: string[] = plan.check || [];
    if (checks.length) {
      const chLines = checks.map((c) => wrap(c, F.regular, 10.5, CONTENT_W - 60));
      const chH = 24 + chLines.reduce((a, l) => a + Math.max(16, l.length * 14 + 4), 0) + 12;
      ensure(chH + 12);
      gap(10);
      const top = st.y;
      rrect(st.p, MARGIN, top - chH, CONTENT_W, chH, 10, GREEN_BG, GREEN_BD);
      st.p.drawText("ERFOLGS-CHECK NACH 14 TAGEN", { x: MARGIN + 16, y: top - 18, size: 10, font: F.bold, color: GREEN });
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
      st.y = top - chH - 10;
    }
  }

  // ---------- WENN ES HAKT ----------
  if (wenn) {
    ensure(50);
    eyebrow("Wenn es hakt");
    heading(S(wenn.title));
    for (const c of wenn.cases || []) {
      const bl = wrap(c.tun, F.regular, 10.5, CONTENT_W - 28);
      const titelLines = wrap(c.fall, F.bold, 11, CONTENT_W - 28);
      const h = 4 + titelLines.length * 15 + bl.length * 14 + 16;
      ensure(h + 4);
      gap(4);
      const top = st.y;
      rrect(st.p, MARGIN, top - h, CONTENT_W, h, 8, TINT, BORDER);
      let ty = top - 15;
      for (const ln of titelLines) {
        st.p.drawText(ln, { x: MARGIN + 14, y: ty, size: 11, font: F.bold, color: INK });
        ty -= 15;
      }
      ty -= 2;
      for (const ln of bl) {
        st.p.drawText(ln, { x: MARGIN + 14, y: ty, size: 10.5, font: F.regular, color: MUT });
        ty -= 14;
      }
      st.y = top - h - 4;
    }
  }

  // Footer + Seitenzahlen
  const pages = doc.getPages();
  const total = pages.length;
  pages.forEach((p, i) => {
    p.drawRectangle({ x: 0, y: 0, width: A4_W, height: 3, color: GOLD });
    const meta2 = `Pfoten-Plan - Nichts vom Boden - Seite ${i + 1}/${total}`;
    const mw = F.regular.widthOfTextAtSize(meta2, 8);
    p.drawText(meta2, { x: (A4_W - mw) / 2, y: 16, size: 8, font: F.regular, color: LIGHT });
  });

  return doc.save();
}
