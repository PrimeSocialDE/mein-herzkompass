// Schickt das bereits gerenderte 6M-PDF (Iniko, Daten von egloffdaniela@gmail.com)
// als Mail-Anhang an max@primesocial.de — direkt ueber Brevo-API.
// KEIN neuer AI-Run, KEINE Mail an die echte Kundin.

import { readFileSync } from "node:fs";

try {
  const e = readFileSync("/Users/maxxx/Documents/nextjs-boilerplate-main/.env.local", "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const BREVO_API_KEY = process.env.BREVO_API_KEY;
if (!BREVO_API_KEY) {
  console.error("BREVO_API_KEY fehlt in .env.local");
  process.exit(1);
}

const PDF_PATH = "/Users/maxxx/Documents/nextjs-boilerplate-main/public/monatsplan-personalisiert-TEST.pdf";
const pdfBytes = readFileSync(PDF_PATH);
const pdfBase64 = pdfBytes.toString("base64");

console.log(`PDF: ${(pdfBytes.length / 1024).toFixed(0)} KB`);

const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <h2 style="margin:0 0 16px;color:#241714;">Test-PDF: Inikos 6-Monatsplan (Layout-Review)</h2>
  <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#4B5563;">
    Im Anhang das neu generierte 6-Monats-PDF mit den Layout-Fixes:
  </p>
  <ul style="font-size:13px;line-height:1.7;color:#4B5563;padding-left:18px;">
    <li>"Phase X" Box statt "Woche X" (doppelte Wochen-Anzeige weg)</li>
    <li>Sub-Label "Woche A–B" / "Woche A" korrekt rechts neben Box</li>
    <li>Phasen-Check-Seite hat jetzt Sub-Label</li>
    <li>Spalten-Header "Ziele · Woche X" mit mehr Atemraum</li>
    <li>Schritte-Spacing kompakter, aber alle Steps sichtbar</li>
    <li>56 Seiten (statt 80 nach Zwischenversion mit Page-Splits)</li>
  </ul>
  <p style="margin:16px 0 0;font-size:13px;color:#6B7280;">
    Daten von Iniko (Australien Shepherd, 24 Wochen) — echter Plan-Content aus DB,
    aber NICHT an die Kundin egloffdaniela@gmail.com geschickt.
  </p>
</div>`;

const payload = {
  sender: { name: "Pfoten-Plan Layout-Review", email: "support@pfoten-plan.de" },
  replyTo: { email: "support@pfoten-plan.de", name: "Pfoten-Plan Support" },
  to: [{ email: "max@primesocial.de" }],
  subject: "🐾 Test: Inikos 6-Monatsplan (Layout-Review)",
  htmlContent: html,
  tags: ["admin-test", "plan-layout-review"],
  attachment: [
    {
      name: "Pfoten-Plan-Iniko-6M.pdf",
      content: pdfBase64,
    },
  ],
};

const res = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    "api-key": BREVO_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

console.log(`HTTP ${res.status}`);
const text = await res.text();
console.log(text);
if (!res.ok) process.exit(1);
console.log("\n✓ Mail an max@primesocial.de raus.");
