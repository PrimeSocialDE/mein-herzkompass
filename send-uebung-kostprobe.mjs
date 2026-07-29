// Muster: "Übungs-Kostprobe" an NICHT-Käufer (Interessent / warm-recovery).
// Eine echte Übung aus lib/exercise-library.ts (p-baum) als Gratis-Probe,
// danach Pitch: "20-30 weitere Übungen im kompletten Plan".
//
// Aufruf: node send-uebung-kostprobe.mjs            (DRY: zeigt nur Subject)
//         node send-uebung-kostprobe.mjs --write     (schreibt email-samples/seq-ec-kostprobe.html)
//         node send-uebung-kostprobe.mjs --send      (sendet an max@primesocial.de)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
for (const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)])
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");

const SEND = process.argv.includes("--send");
const WRITE = process.argv.includes("--write");
const TO = "max@primesocial.de";
const BASE = "https://www.pfoten-plan.de";
const dogName = "Balu";
const dogBreed = "Mischling";
const heroImg = (n) => `${BASE}/email-images/MischlingEmail${n}.jpg`;

const sendBrevoMail = SEND ? (await import("./lib/member-mail.ts")).sendBrevoMail : null;

// ── Echte Übung aus lib/exercise-library.ts (id: p-baum), {dogName} ersetzt ──
const exercise = {
  title: "Sei ein Baum: Stopp bei straffer Leine",
  meta: "Übung · 6 Min · ohne Vorkenntnisse",
  intro: `${dogName} lernt mit dieser Übung: zieht die Leine, geht es nicht weiter. Lässt ${dogName} nach, geht es weiter. Keine Strafe, keine Aufregung – einfach Konsequenz.`,
  steps: [
    "Leine anlegen, beginne in einem ruhigen Flur oder Zimmer mit mindestens 4 Schritten Strecke.",
    "Geh entspannt los. Die Leine hängt locker, du hältst sie ohne Spannung.",
    `Sobald die Leine straff wird: SOFORT stehen bleiben. Keine Worte, kein Ruck, kein Blick zu ${dogName}.`,
    "Stehe wie ein Baum. Schau geradeaus oder neutral weg. Halte die Leine an dem Punkt fest, an dem sie war.",
    `Warte. ${dogName} wird irgendwann nachgeben oder sich umdrehen.`,
    "Sobald die Leine wieder locker ist (auch nur einen Moment): ruhig FEIN sagen und ohne Aufregung weitergehen.",
    "Pro Session 5–7 Minuten. Erwarte 15–25 Stopps am Anfang, das ist normal.",
    "Niemals an der Leine rucken oder schimpfen. Du bist nur ruhige Konsequenz, keine Strafe.",
  ],
};

const box = (label, text) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:14px 0;">
    <tr><td style="padding:14px 18px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#8B7355;">${label}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">${text}</p>
    </td></tr>
  </table>`;

// Nummerierte Schritt-Liste: zweispaltige Tabelle (Nummer | Text), damit das
// Badge IMMER oben-links sitzt — unabhaengig von der Textlaenge. Mailclient-sicher.
const numbered = (items) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 4px;">
    ${items.map((t, i) => `<tr>
      <td width="34" valign="top" style="padding:7px 0;width:34px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" width="26" height="26" bgcolor="#C4A576" style="width:26px;height:26px;background:#C4A576;color:#FFFFFF;font-size:13px;font-weight:700;text-align:center;border-radius:13px;line-height:26px;">${i + 1}</td></tr></table></td>
      <td valign="top" style="padding:7px 0;font-size:14.5px;line-height:1.55;color:#3a3a3a;">${t}</td>
    </tr>`).join("")}
  </table>`;

// Übungs-Karte
const exerciseCard = `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #EADDC5;border-radius:12px;background:#FFFDF9;margin:8px 0 14px;">
    <tr><td style="padding:16px 18px 6px;">
      <p style="margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8B7355;">${exercise.meta}</p>
      <p style="margin:0 0 8px;font-size:17px;font-weight:800;color:#1a1a1a;">${exercise.title}</p>
      <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#3a3a3a;">${exercise.intro}</p>
      ${numbered(exercise.steps)}
    </td></tr>
  </table>`;

const o = {
  key: "seq-ec-kostprobe",
  subject: `Probier diese eine Übung mit ${dogName} aus – gratis`,
  preheader: `Die wichtigste Anti-Zieh-Übung. 6 Minuten, heute.`,
  heroImg: heroImg(1),
  headline: `Statt nur zu erzählen, was drin ist – probier's einfach aus.`,
  intro: `Du hast ${dogName}s Plan noch nicht geholt – völlig okay. Deshalb gebe ich dir heute eine echte Übung daraus, zum Mitnehmen. Eine der ersten, die fast jeder Hund braucht, der an der Leine zieht. Du brauchst nur Leine, ein paar Leckerlis und 6 Minuten.`,
  ctaText: `${dogName}s kompletten Plan ansehen`,
  ctaUrl: `${BASE}/rueckhol.html`,
  footerHint: `Hat die Übung schon ein bisschen was gebracht? Antworte einfach auf diese Mail und erzähl's mir – ich lese jede persönlich.`,
};

const bodyHtml = `
  ${exerciseCard}
  ${box("Warum das funktioniert", `Kein Ruck, kein Schimpfen – nur ruhige Konsequenz. ${dogName} lernt von selbst: Ziehen bringt ihn nicht ans Ziel. Genau dieses Prinzip zieht sich durch den ganzen Plan.`)}
  <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#3a3a3a;">Das war <strong>eine von über 25 Übungen</strong>, die in ${dogName}s Plan Schritt für Schritt aufeinander aufbauen – abgestimmt auf sein Hauptthema. Du musst nichts mehr selbst zusammensuchen oder raten, was als Nächstes kommt.</p>
  <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">Wenn dir diese eine Übung schon hilft, stell dir vor, was der ganze Plan für euch tut.</p>`;

function buildHtml(o, bodyHtml) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${o.subject}</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<span style="display:none;font-size:1px;color:#FAF8F5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${o.preheader}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:16px;overflow:hidden;">
    <tr><td style="padding:22px 28px 6px;"><p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8B7355;">Pfoten-Plan</p></td></tr>
    <tr><td style="padding:8px 28px 18px;"><img src="${o.heroImg}" alt="${dogBreed}" width="544" style="width:100%;max-width:544px;height:auto;display:block;border-radius:12px;border:1px solid #F0EBE3;"></td></tr>
    <tr><td style="padding:0 28px 6px;">
      <h1 style="margin:0 0 14px;font-size:23px;line-height:1.28;font-weight:800;color:#1a1a1a;">${o.headline}</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">${o.intro}</p>
      ${bodyHtml}
    </td></tr>
    <tr><td align="center" style="padding:24px 28px 12px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr><td align="center" bgcolor="#C4A576" style="border-radius:12px;background:#C4A576;"><a href="${o.ctaUrl}" target="_blank" rel="noopener" style="display:inline-block;color:#FFFFFF;font-weight:700;font-size:15px;padding:16px 32px;text-decoration:none;border-radius:12px;line-height:1.2;">${o.ctaText}</a></td></tr></table></td></tr>
    <tr><td style="padding:6px 28px 22px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:14px 16px;background:#FAFAFA;border-radius:10px;"><p style="margin:0;font-size:13px;line-height:1.55;color:#6B7280;">${o.footerHint}</p></td></tr></table></td></tr>
    <tr><td style="padding:14px 28px;background:#FAFAFA;border-top:1px solid #F0EBE3;"><p style="margin:0;font-size:11px;line-height:1.6;color:#9CA3AF;text-align:center;">Pfoten-Plan · <a href="mailto:support@pfoten-plan.de" style="color:#8B7355;text-decoration:underline;">support@pfoten-plan.de</a><br><a href="{{ unsubscribe }}" style="color:#9CA3AF;text-decoration:underline;">Aus diesen E-Mails abmelden</a></p></td></tr>
  </table>
</td></tr></table></body></html>`;
}

const html = buildHtml(o, bodyHtml);
console.log(`▶ ${o.key}\n  Subject: ${o.subject}`);
if (WRITE) { mkdirSync("email-samples", { recursive: true }); writeFileSync(`email-samples/${o.key}.html`, html, "utf8"); console.log(`  ✓ geschrieben: email-samples/${o.key}.html`); }
if (SEND) { const r = await sendBrevoMail({ to: TO, subject: "[Muster · Kostprobe] " + o.subject, html, tags: ["seq-kostprobe", o.key] }); console.log(`  ${r.ok ? "✓ gesendet an " + TO : "✗ " + r.reason}`); }
if (!WRITE && !SEND) console.log(`  [dry] – mit --send an ${TO}`);
