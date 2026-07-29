// Muster-Mails der 3 Lead-Segmente an max@primesocial.de schicken.
// Branding 1:1 wie email-sequence.ts (Hero-Bild + wrapTemplate-Optik).
//
//   1) email_captured  -> Verständnis aufbauen          -> Rückholseite
//   2) pending/failed  -> Einwände/Zahlung entkräften    -> Bezahlung abschliessen (Rückholseite)
//   3) Käufer (paid)   -> Onboarding / Tag-1-Start        -> Mitgliederbereich
//
// Aufruf: node send-segment-samples.mjs            (DRY: zeigt nur Subjects)
//         node send-segment-samples.mjs --send     (sendet an max@primesocial.de)

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

const box = (label, text) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:14px 0;">
    <tr><td style="padding:14px 18px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#8B7355;">${label}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">${text}</p>
    </td></tr>
  </table>`;
const checks = (items) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 10px;">
    ${items.map(t => `<tr><td style="padding:7px 0;vertical-align:top;"><span style="color:#15803D;font-size:16px;width:24px;display:inline-block;">✓</span><span style="font-size:14.5px;line-height:1.55;color:#3a3a3a;">${t}</span></td></tr>`).join("")}
  </table>`;

function buildHtml(o) {
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
      ${o.bodyHtml}
    </td></tr>
    <tr><td align="center" style="padding:24px 28px 12px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr><td align="center" bgcolor="#C4A576" style="border-radius:12px;background:#C4A576;"><a href="${o.ctaUrl}" target="_blank" rel="noopener" style="display:inline-block;color:#FFFFFF;font-weight:700;font-size:15px;padding:16px 32px;text-decoration:none;border-radius:12px;line-height:1.2;">${o.ctaText}</a></td></tr></table></td></tr>
    <tr><td style="padding:6px 28px 22px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:14px 16px;background:#FAFAFA;border-radius:10px;"><p style="margin:0;font-size:13px;line-height:1.55;color:#6B7280;">${o.footerHint}</p></td></tr></table></td></tr>
    <tr><td style="padding:14px 28px;background:#FAFAFA;border-top:1px solid #F0EBE3;"><p style="margin:0;font-size:11px;line-height:1.6;color:#9CA3AF;text-align:center;">Pfoten-Plan · <a href="${BASE}/mitglieder" style="color:#8B7355;text-decoration:underline;">Mein Bereich</a> · <a href="mailto:support@pfoten-plan.de" style="color:#8B7355;text-decoration:underline;">support@pfoten-plan.de</a><br><a href="{{ unsubscribe }}" style="color:#9CA3AF;text-decoration:underline;">Aus diesen E-Mails abmelden</a></p></td></tr>
  </table>
</td></tr></table></body></html>`;
}

const segments = [
  {
    key: "1-email-captured",
    subject: `[Muster · Segment 1: Email-Captured] ${dogName}s Trainingsplan steht bereit – einmal reinschauen?`,
    preheader: `In 60 Sekunden siehst du, was für ${dogName} drinsteht.`,
    heroImg: heroImg(1),
    headline: `Du hast den ersten Schritt für ${dogName} schon gemacht.`,
    intro: `Du hast uns ${dogName}s Infos bereits gegeben – das Wichtigste liegt also schon vor. Was an dieser Stelle vielen noch fehlt, ist ein klares Bild davon, was so ein Plan eigentlich für euch tut. Genau das zeigen wir dir jetzt in einer Minute.`,
    bodyHtml: `
      <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#3a3a3a;">Das bekommst ${dogName} und du konkret:</p>
      ${checks([
        `Einen Trainingsplan, der <strong>genau auf ${dogName}s Thema</strong> zugeschnitten ist – keine Standard-Tipps aus dem Internet.`,
        `Kurze Übungen für jeden Tag – <strong>5–10 Minuten reichen</strong>, Schritt für Schritt erklärt.`,
        `Begleitung Woche für Woche, damit du <strong>nicht alleine</strong> durchmusst.`,
        `Ausgebildete Hundetrainer:innen aus Deutschland, die bei Fragen <strong>persönlich</strong> helfen.`,
      ])}
      ${box("Warum das wirkt", `Die meisten Probleme im Alltag lösen sich nicht durch mehr Tipps, sondern durch <strong>einen klaren roten Faden</strong> – jeden Tag eine kleine Sache, die aufeinander aufbaut. Genau das ist ${dogName}s Plan.`)}
      <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">Schau ihn dir in Ruhe an – unverbindlich. Du entscheidest danach.</p>`,
    ctaText: `${dogName}s Plan ansehen`,
    ctaUrl: `${BASE}/rueckhol.html`,
    footerHint: `Noch unsicher, ob das zu ${dogName} passt? Antworte einfach auf diese Mail – wir lesen jede persönlich und sagen dir ehrlich, ob es Sinn ergibt.`,
  },
  {
    key: "2-pending-failed",
    subject: `[Muster · Segment 2: Abgebrochen] Fast geschafft – ${dogName}s Plan wartet auf dich`,
    preheader: `Beim Bezahlen ist etwas dazwischengekommen?`,
    heroImg: heroImg(2),
    headline: `Bei der Bezahlung hat es nicht ganz geklappt.`,
    intro: `Du warst schon fast am Ziel – ${dogName}s Plan war nur einen Klick entfernt. Manchmal kommt im letzten Moment etwas dazwischen: eine Frage, ein kurzer Zweifel oder einfach das Leben. Alles gut. Dein Fortschritt ist gespeichert, du kannst genau dort weitermachen.`,
    bodyHtml: `
      <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#3a3a3a;">Falls du gezögert hast – das Wichtigste vorab:</p>
      ${checks([
        `<strong>Kein Abo.</strong> Du zahlst einmal, der Zugang bleibt.`,
        `<strong>30 Tage Geld-zurück.</strong> Bringt der Plan nichts, bekommst du dein Geld zurück – ohne Diskussion.`,
        `<strong>Sofort verfügbar</strong> – ${dogName}s Plan kommt direkt per E-Mail, du kannst heute starten.`,
        `<strong>Persönliche Hilfe inklusive</strong>, wenn du an einer Stelle nicht weiterkommst.`,
      ])}
      ${box("Hat technisch etwas geklemmt?", `Zahlungen brechen manchmal einfach ab – Bank-Bestätigung, Verbindung, PayPal-Fenster. Ein neuer Anlauf dauert keine Minute und es entstehen dir dabei keine Doppelkosten.`)}
      <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">Mach genau da weiter, wo du aufgehört hast:</p>`,
    ctaText: `Bezahlung abschließen`,
    ctaUrl: `${BASE}/rueckhol.html`,
    footerHint: `Hat etwas nicht funktioniert oder hast du eine Frage zur Zahlung? Schreib uns kurz – wir helfen dir persönlich weiter.`,
  },
  {
    key: "3-kaeufer",
    subject: `[Muster · Segment 3: Käufer] Willkommen – so startest du heute mit ${dogName}`,
    preheader: `Dein Plan ist startklar. Der erste Schritt dauert 5 Minuten.`,
    heroImg: heroImg(3),
    headline: `${dogName}s Plan ist da – jetzt geht's los.`,
    intro: `Schön, dass du dabei bist. Ab jetzt musst du nichts mehr alleine herausfinden – wir gehen den Weg mit dir, Woche für Woche. Das Wichtigste für heute: einmal in deinen Bereich einloggen und die erste Übung ansehen.`,
    bodyHtml: `
      <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#3a3a3a;">In deinem Mitglieder-Bereich wartet:</p>
      ${checks([
        `${dogName}s <strong>kompletter Trainingsplan</strong> – Woche für Woche, mit Übungen für jeden Tag.`,
        `<strong>Wochen-Aufgaben &amp; Abzeichen</strong> – kleine Ziele, die motiviert dranbleiben lassen.`,
        `Ein <strong>Stimmungs-Tagebuch mit KI-Auswertung</strong> – trag kurz ein, wie's lief, du bekommst konkrete Tipps für die nächste Woche.`,
        `Ein <strong>KI-Trainer für Rückfragen</strong>, rund um die Uhr – mit dem Wissen unseres Trainer-Teams.`,
      ])}
      ${box("Dein erster Schritt heute", `Logg dich ein, öffne ${dogName}s Plan und mach <strong>nur die erste Übung</strong>. Mehr nicht. Der wichtigste Tag ist Tag 1 – und der dauert keine 10 Minuten.`)}`,
    ctaText: `Mitglieder-Bereich öffnen`,
    ctaUrl: `${BASE}/mitglieder`,
    footerHint: `Kommst du an einer Stelle nicht weiter? Antworte auf diese Mail – innerhalb von 12 Stunden meldet sich jemand persönlich.`,
  },
];

if (WRITE) mkdirSync("email-samples", { recursive: true });

for (const s of segments) {
  console.log(`\n▶ ${s.key}`);
  console.log(`  Subject: ${s.subject}`);
  console.log(`  CTA: ${s.ctaText} -> ${s.ctaUrl}`);
  console.log(`  Hero: ${s.heroImg}`);
  if (WRITE) {
    const path = `email-samples/${s.key}.html`;
    writeFileSync(path, buildHtml(s), "utf8");
    console.log(`  ✓ geschrieben: ${path}`);
  }
  if (SEND) {
    const res = await sendBrevoMail({
      to: TO,
      subject: s.subject,
      html: buildHtml(s),
      tags: ["muster-segment", s.key],
    });
    console.log(`  ${res.ok ? "✓ gesendet an " + TO : "✗ " + res.reason}`);
  } else {
    console.log(`  [dry] würde an ${TO} senden`);
  }
}
console.log(`\nFertig. ${SEND ? "" : "(DRY RUN – mit --send wirklich schicken.)"}`);
