// Test-Script: erzeugt einen ECHTEN Supabase Magic-Link via Admin-API
// und schickt unsere gebrandete Pfoten-Plan-Mail dazu.
// Klick auf den Link loggt den User wirklich ein.
//
// Run: node --env-file=.env.local test-magic-link-email.mjs <email>

import { createClient } from "@supabase/supabase-js";

const RECIPIENT = process.argv[2] || "max@primesocial.de";
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const REDIRECT_TO = "https://www.pfoten-plan.de/mitglieder/callback";

if (!BREVO_API_KEY) { console.error("FEHLT: BREVO_API_KEY"); process.exit(1); }
if (!SUPABASE_URL) { console.error("FEHLT: SUPABASE_URL"); process.exit(1); }
if (!SERVICE_ROLE) { console.error("FEHLT: SUPABASE_SERVICE_ROLE"); process.exit(1); }

console.log(`Generiere echten Magic-Link für ${RECIPIENT}...`);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: RECIPIENT,
  options: { redirectTo: REDIRECT_TO },
});

if (linkErr || !linkData) {
  console.error("Link-Generation failed:", linkErr?.message);
  process.exit(1);
}

// linkData.properties enthaelt action_link (Supabase verify-URL),
// email_otp (6-stelliger Code) und hashed_token (fuer unseren callback).
// Wir bauen den Link wie unser auth-hook auf den eigenen callback statt
// auf Supabase's verify-Endpoint zu zeigen.
const code = linkData.properties.email_otp || "------";
const hashedToken =
  linkData.properties.hashed_token || linkData.properties.token_hash;
const link = hashedToken
  ? `https://www.pfoten-plan.de/mitglieder/callback?token_hash=${encodeURIComponent(
      hashedToken
    )}&type=magiclink&next=%2Fmitglieder`
  : linkData.properties.action_link;

console.log(`✓ Link generiert (gueltig 1h)`);
console.log(`  Code: ${code}`);

function extractFirstName(email) {
  const local = (email || "").split("@")[0] || "";
  const candidate = local.split(/[+._-]/)[0];
  if (!candidate || candidate.length < 3 || /\d/.test(candidate)) return "";
  return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
}

function buildHtml(email, link, code) {
  const firstName = extractFirstName(email);
  const heading = `Hier ist dein Login${firstName ? ", " + firstName : ""}`;
  const subtitle = "Ein Klick und du bist in deinem Mitgliederbereich. Kein Passwort, kein Tippen.";
  const codePretty = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

  return `<!DOCTYPE html>
<html lang="de"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">

<div style="max-width:520px;margin:0 auto;padding:32px 20px;">

  <div style="text-align:center;margin-bottom:28px;">
    <img src="https://www.pfoten-plan.de/logo.png" alt="Pfoten-Plan" width="56" height="56" style="display:inline-block;border-radius:14px;border:2px solid #C4A576;">
    <div style="font-size:13px;font-weight:700;color:#8B7355;letter-spacing:1.5px;text-transform:uppercase;margin-top:10px;">Pfoten-Plan</div>
  </div>

  <div style="background:#ffffff;border:1px solid #EADDC5;border-radius:16px;padding:28px 24px;box-shadow:0 2px 12px rgba(139,115,85,0.06);">

    <h1 style="font-size:22px;font-weight:800;line-height:1.25;margin:0 0 10px;color:#1a1a1a;">${heading}</h1>
    <p style="font-size:15px;color:#4B5563;margin:0 0 24px;line-height:1.55;">${subtitle}</p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px;width:100%;">
      <tr><td align="center">
        <a href="${link}" target="_blank" style="display:inline-block;background:#C4A576;color:#ffffff;text-decoration:none;padding:16px 36px;border-radius:12px;font-size:15px;font-weight:700;box-shadow:0 2px 4px rgba(139,115,85,0.25);">
          Jetzt einloggen →
        </a>
      </td></tr>
    </table>

    <div style="text-align:center;margin:18px 0 6px;">
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 8px;">— oder Code eingeben —</p>
      <div style="display:inline-block;background:#FFF9F0;border:2px dashed #C4A576;border-radius:10px;padding:14px 24px;font-family:'SF Mono','Monaco','Courier New',monospace;font-size:28px;font-weight:800;color:#1a1a1a;letter-spacing:6px;">
        ${codePretty}
      </div>
      <p style="font-size:11px;color:#9CA3AF;margin:8px 0 0;line-height:1.4;">Auf <a href="https://www.pfoten-plan.de/mitglieder/login" style="color:#8B7355;text-decoration:underline;">pfoten-plan.de/mitglieder/login</a> eintragen</p>
    </div>

  </div>

  <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;padding:18px 20px;margin-top:20px;">
    <p style="font-size:12px;font-weight:700;color:#8B7355;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">So einfach geht's</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;">
      <tr><td style="font-size:13px;color:#4B5563;padding:3px 0;line-height:1.5;"><strong style="color:#C4A576;">1.</strong> Klick auf den Button oben</td></tr>
      <tr><td style="font-size:13px;color:#4B5563;padding:3px 0;line-height:1.5;"><strong style="color:#C4A576;">2.</strong> Du landest direkt in deinem Mitgliederbereich</td></tr>
      <tr><td style="font-size:13px;color:#4B5563;padding:3px 0;line-height:1.5;"><strong style="color:#C4A576;">3.</strong> Fertig — kein Passwort, keine Tipperei</td></tr>
    </table>
  </div>

  <p style="font-size:12px;color:#9CA3AF;text-align:center;margin:18px 0 12px;line-height:1.55;">
    🔒 Der Link gilt 1 Stunde und ist nur für dich. Falls du das nicht warst — ignorier die Mail einfach, es passiert nichts.
  </p>

  <div style="text-align:center;padding-top:8px;border-top:1px solid #F0EBE3;margin-top:20px;">
    <p style="font-size:13px;color:#6B7280;margin:14px 0 4px;line-height:1.5;">
      Fragen? Schreib uns an <a href="mailto:support@pfoten-plan.de" style="color:#C4A576;text-decoration:underline;">support@pfoten-plan.de</a>
    </p>
    <p style="font-size:13px;color:#6B7280;margin:0 0 14px;">
      Liebe Grüße, dein Pfoten-Plan Team 🐾
    </p>
    <p style="font-size:10px;color:#C4B998;margin:0;">
      Pfoten-Plan · Hundetraining das funktioniert
    </p>
  </div>

</div>

</body></html>`;
}

function buildPlainText(email, link, code) {
  const firstName = extractFirstName(email);
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const codePretty = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
  return `${greeting}

mit einem Klick bist du in deinem Pfoten-Plan Mitgliederbereich — kein Passwort, kein Tippen.

Login-Link:
${link}

ODER nutze diesen 6-stelligen Code auf pfoten-plan.de/mitglieder/login:

  ${codePretty}

So einfach geht's:
1. Klick auf den Link oben (oder gib den Code ein)
2. Du landest direkt in deinem Mitgliederbereich
3. Fertig

Link + Code gelten 1 Stunde und sind nur für dich. Falls du das nicht warst — einfach ignorieren.

Fragen? support@pfoten-plan.de

Liebe Grüße,
dein Pfoten-Plan Team`;
}

const html = buildHtml(RECIPIENT, link, code);
const text = buildPlainText(RECIPIENT, link, code);

console.log(`Sende Mail an ${RECIPIENT}...`);

const res = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    "api-key": BREVO_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
    replyTo: { email: "support@pfoten-plan.de", name: "Pfoten-Plan Support" },
    to: [{ email: RECIPIENT }],
    subject: "Dein Login-Link für Pfoten-Plan",
    htmlContent: html,
    textContent: text,
    headers: {
      "List-Unsubscribe": `<mailto:unsubscribe@pfoten-plan.de?subject=Unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  }),
});

if (res.ok) {
  const data = await res.json();
  console.log(`✓ Mail abgeschickt. Message-ID: ${data.messageId}`);
  console.log(`  Link gueltig 1h, fuehrt nach Klick zu /mitglieder/callback`);
} else {
  const errText = await res.text();
  console.error(`✗ Brevo failed: ${res.status} ${errText}`);
  process.exit(1);
}
