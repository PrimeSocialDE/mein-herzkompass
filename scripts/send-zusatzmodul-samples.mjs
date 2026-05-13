// Schickt 2 Sample-Mails mit den Zusatzmodul-PDFs (pulling + energy)
// an die uebergebene Email-Adresse. Lokal lauffaehig.
//
// Voraussetzungen:
//   node generate-zusatzmodul-pdf.mjs (mit MODULE_KEY=pulling und energy)
//
// Aufruf:
//   node scripts/send-zusatzmodul-samples.mjs max@primesocial.de

import { readFileSync } from "node:fs";

try {
  const envText = readFileSync(".env.local", "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/send-zusatzmodul-samples.mjs <email>");
  process.exit(1);
}

const BREVO_API_KEY = process.env.BREVO_API_KEY;
if (!BREVO_API_KEY) {
  console.error("FEHLT: BREVO_API_KEY");
  process.exit(1);
}

const MODULES_TO_SEND = [
  {
    moduleKey: "pulling",
    label: "Leinenführungs-Plan",
    subject: "Dein Leinenführungs-Plan für Bruno ist da",
    pdfPath: "public/zusatzmodul-pulling-TEST.pdf",
    benefit: "6 Schritt-für-Schritt-Übungen für ruhiges Spazierengehen — vom Start an der Haustür bis zum ruhigen Ankommen zuhause.",
  },
  {
    moduleKey: "energy",
    label: "Energie- & Ruhe-Plan",
    subject: "Dein Energie- & Ruhe-Plan für Bruno ist da",
    pdfPath: "public/zusatzmodul-energy-TEST.pdf",
    benefit: "6 Übungen die Bruno helfen, seine Energie zu sortieren und tief zu entspannen — Ruhe-Ort etablieren, An-/Ausschalter, Parkbank-Prinzip.",
  },
];

function buildHtml({ label, benefit, dogName }) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:32px 32px 8px;">
<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">🐾 ${label} · Zusatz-Modul</p>
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:800;color:#1a1a1a;">Dein ${label} für ${dogName} ist da</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#4B5563;">Hallo, dein neues Zusatz-Modul für ${dogName} ist fertig — als druckbares PDF im Anhang.</p>
</td></tr>
<tr><td style="padding:20px 32px 4px;">
<div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:14px;padding:18px 20px;">
<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1a1a1a;line-height:1.4;">Was dich erwartet</p>
<p style="margin:0;font-size:13px;color:#4B5563;line-height:1.6;">${benefit}</p>
</div>
</td></tr>
<tr><td style="padding:24px 32px 32px;">
<p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">Druck es aus oder hab es unterwegs auf dem Handy dabei — viele Übungen lassen sich direkt auf dem Spaziergang umsetzen.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;">
<p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;">Pfoten-Plan · Persönliches Hundetraining</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

for (const m of MODULES_TO_SEND) {
  console.log(`\n→ ${m.label} an ${email}`);
  const pdfBytes = readFileSync(m.pdfPath);
  const pdfBase64 = pdfBytes.toString("base64");
  console.log(`  PDF: ${(pdfBytes.length / 1024).toFixed(0)} KB`);

  const html = buildHtml({ label: m.label, benefit: m.benefit, dogName: "Bruno" });
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
      replyTo: { email: "support@pfoten-plan.de", name: "Pfoten-Plan Support" },
      to: [{ email }],
      subject: `🐾 [SAMPLE] ${m.subject}`,
      htmlContent: html,
      attachment: [
        { name: `Pfoten-Plan-${m.label}-Bruno.pdf`, content: pdfBase64 },
      ],
      tags: ["sample", `zusatzmodul-${m.moduleKey}`],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`  ✗ Brevo ${res.status}:`, txt.slice(0, 200));
  } else {
    const data = await res.json();
    console.log(`  ✓ Mail gesendet (Brevo-ID: ${data.messageId || "?"})`);
  }
  await new Promise((r) => setTimeout(r, 1000));
}

console.log(`\nFertig. 2 Zusatzmodul-Samples an ${email}.\n`);
