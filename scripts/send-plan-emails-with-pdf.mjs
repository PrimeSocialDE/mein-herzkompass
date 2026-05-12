// Schickt 3 Sample-"Plan ist fertig"-Mails (1/3/6 Monate) mit dem
// jeweils passenden PDF im Anhang + Mitgliederbereich-Showcase.
//
// Voraussetzung: alle drei PDFs sind generiert:
//   node generate-monatsplan-pdf.mjs   → public/monatsplan-1monat-TEST.pdf
//   node generate-3monatsplan-pdf.mjs  → public/monatsplan-3monat-TEST.pdf
//   node generate-6monatsplan-pdf.mjs  → public/monatsplan-6monat-TEST.pdf
//
// Aufruf:
//   node scripts/send-plan-emails-with-pdf.mjs max@primesocial.de

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
  console.error("Usage: node scripts/send-plan-emails-with-pdf.mjs <email>");
  process.exit(1);
}

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.pfoten-plan.de"
).replace(/\/+$/, "");
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!BREVO_API_KEY || !SUPABASE_URL || !SERVICE_ROLE) {
  console.error("FEHLT: BREVO_API_KEY/SUPABASE_URL/SERVICE_ROLE");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Alle drei PDFs vorab einlesen (1 / 3 / 6 Monate)
const PDF_BY_MONTHS = {
  1: "public/monatsplan-1monat-TEST.pdf",
  3: "public/monatsplan-3monat-TEST.pdf",
  6: "public/monatsplan-6monat-TEST.pdf",
};
const PDF_CACHE = {};
for (const [m, path] of Object.entries(PDF_BY_MONTHS)) {
  try {
    const bytes = readFileSync(path);
    PDF_CACHE[m] = bytes.toString("base64");
    console.log(`✓ ${m}-Monats PDF: ${(bytes.length / 1024).toFixed(0)} KB (${path})`);
  } catch (e) {
    console.error(`✗ ${m}-Monats PDF nicht gefunden: ${path}`);
    process.exit(1);
  }
}

// ── Auto-Login Magic-Link generieren ──────────────────────────────────
async function buildAutoLoginUrl(email, nextPath) {
  const fallback = `${SITE_URL}/mitglieder/login?email=${encodeURIComponent(email)}`;
  try {
    try {
      await sb.auth.admin.createUser({ email, email_confirm: true });
    } catch {}
    const { data, error } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${SITE_URL}/mitglieder/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
    const hashedToken = data?.properties?.hashed_token;
    if (!hashedToken) {
      console.warn("  ⚠ generateLink fail:", error?.message);
      return fallback;
    }
    const params = new URLSearchParams({
      token_hash: hashedToken,
      type: "magiclink",
      next: nextPath,
    });
    return `${SITE_URL}/mitglieder/callback?${params.toString()}`;
  } catch (e) {
    console.warn("  ⚠ magic-link error:", e.message);
    return fallback;
  }
}

// ── Email-HTML ────────────────────────────────────────────────────────
function buildEmailHtml({ months, dogName, ctaUrl }) {
  const monthsLabel =
    months === 1
      ? "1-Monats-Plan"
      : months === 3
        ? "3-Monats-Plan"
        : "6-Monats-Plan";
  const weeksTotal = months * 4;
  const introByLength = {
    1: `dein 1-Monats-Plan für ${dogName} ist fertig. 4 Wochen, ein klarer Fokus, konkrete Übungen für jeden Tag — alles als druckbares PDF im Anhang.`,
    3: `dein 3-Monats-Plan für ${dogName} ist fertig. 12 Wochen, drei Phasen, ein systematischer Aufbau vom Fundament bis zur Stabilisierung — alles als druckbares PDF im Anhang.`,
    6: `dein 6-Monats-Plan für ${dogName} ist fertig. 24 Wochen, sechs Phasen, der Plan mit der höchsten Tiefe und Generalisierung in den Alltag — alles als druckbares PDF im Anhang.`,
  };

  return `<!DOCTYPE html>
<html lang="de"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dein ${monthsLabel} für ${dogName}</title>
</head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">

<span style="display:none;font-size:1px;color:#FAF8F5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Dein ${monthsLabel} für ${dogName} ist fertig — PDF im Anhang.</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;">
  <tr><td align="center" style="padding:32px 16px;">

    <!-- Brand-Header -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
      <tr><td align="center" style="padding-bottom:20px;">
        <div style="display:inline-flex;align-items:center;gap:10px;">
          <span style="font-size:14px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#8B7355;">🐾 Pfoten-Plan</span>
        </div>
      </td></tr>
    </table>

    <!-- Haupt-Karte -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(139,115,85,0.06);">

      <!-- Headline-Bereich -->
      <tr><td style="padding:32px 32px 8px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">${monthsLabel} · ${weeksTotal} Wochen</p>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:800;color:#1a1a1a;">Dein Plan für ${dogName} ist da</h1>
        <p style="margin:0 0 0;font-size:15px;line-height:1.6;color:#4B5563;">Hallo, ${introByLength[months]}</p>
      </td></tr>

      <!-- PDF-Hinweis -->
      <tr><td style="padding:20px 32px 4px;">
        <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:14px;padding:18px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="vertical-align:middle;width:54px;">
                <div style="display:inline-block;width:48px;height:48px;background:#C4A576;border-radius:12px;text-align:center;line-height:48px;font-size:22px;color:#FFFFFF;">📄</div>
              </td>
              <td style="vertical-align:middle;padding-left:14px;">
                <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;line-height:1.3;">Dein Trainings-Plan als PDF</p>
                <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.4;">Im Anhang dieser Mail · druckbar · für unterwegs</p>
              </td>
            </tr>
          </table>
        </div>
      </td></tr>

      <!-- Trenner -->
      <tr><td style="padding:24px 32px 4px;">
        <div style="border-top:1px solid #F0EBE3;"></div>
      </td></tr>

      <!-- Mitgliederbereich-Showcase -->
      <tr><td style="padding:16px 32px 8px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">Du bekommst noch mehr</p>
        <h2 style="margin:0 0 10px;font-size:20px;line-height:1.3;font-weight:800;color:#1a1a1a;">Dein Mitglieder-Bereich</h2>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4B5563;">
          Den Plan kannst du jederzeit auch online durchgehen. Wir tracken automatisch deinen Fortschritt, ${dogName}s Stimmung und schicken dir jede Woche neue Aufgaben — damit du nicht alleine durch den Plan musst.
        </p>
      </td></tr>

      <!-- Feature-Liste -->
      <tr><td style="padding:0 32px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="padding:10px 0;border-bottom:1px solid #F5F1E8;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:top;width:34px;font-size:18px;">📅</td>
                <td style="vertical-align:top;padding-left:6px;">
                  <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">Plan-Begleitung — Woche für Woche</p>
                  <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Welche Woche ist gerade dran, was kommt als Nächstes — auf einen Blick.</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #F5F1E8;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:top;width:34px;font-size:18px;">📊</td>
                <td style="vertical-align:top;padding-left:6px;">
                  <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">Stimmungs-Tagebuch mit KI-Analyse</p>
                  <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Trag wöchentlich kurz ein wie's lief — die KI fasst eure Woche zusammen und gibt konkrete Tipps für die nächste.</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #F5F1E8;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:top;width:34px;font-size:18px;">🏆</td>
                <td style="vertical-align:top;padding-left:6px;">
                  <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">Wochen-Aufgaben &amp; Abzeichen</p>
                  <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Jede Woche kleine Trainings-Aufgaben passend zu eurem Plan. Geschafft = Abzeichen für die Sammlung.</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #F5F1E8;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:top;width:34px;font-size:18px;">💬</td>
                <td style="vertical-align:top;padding-left:6px;">
                  <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">KI-Trainer für Rückfragen</p>
                  <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Stell jederzeit Fragen — der KI-Trainer antwortet rund um die Uhr mit dem Wissen unseres Hundetrainer-Teams.</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:10px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:top;width:34px;font-size:18px;">📚</td>
                <td style="vertical-align:top;padding-left:6px;">
                  <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">Spezial-Module</p>
                  <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Wenn ${dogName} weitere Themen hat — z. B. Aggression, Trennungsangst, Reise — gibt's gezielte Module dazu.</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

      <!-- CTA-Button -->
      <tr><td align="center" style="padding:24px 32px 8px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#1a1a1a;color:#FFFFFF;font-weight:700;font-size:15px;padding:16px 36px;border-radius:14px;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,0.18);">Mitglieder-Bereich öffnen →</a>
      </td></tr>

      <!-- Login-Hinweis -->
      <tr><td style="padding:8px 32px 28px;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#9CA3AF;text-align:center;">
          Der Button enthält einen Einmal-Login — du landest direkt eingeloggt im Mitglieder-Bereich. Der Link gilt 1 Stunde.
        </p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:18px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;">
        <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#9CA3AF;text-align:center;">
          Fragen? Schreib uns an <a href="mailto:support@pfoten-plan.de" style="color:#8B7355;text-decoration:underline;">support@pfoten-plan.de</a>
        </p>
        <p style="margin:0;font-size:11px;line-height:1.5;color:#C4B998;text-align:center;">
          Pfoten-Plan · Persönliches Hundetraining
        </p>
      </td></tr>

    </table>

    <!-- Outer-Footer-Spacer -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
      <tr><td style="padding:16px 0 0;">
        <p style="margin:0;font-size:10px;color:#C4B998;text-align:center;">Du erhältst diese Mail, weil du den Pfoten-Plan gekauft hast.</p>
      </td></tr>
    </table>

  </td></tr>
</table>

</body></html>`;
}

// ── Run: 3 Mails ──────────────────────────────────────────────────────
for (const months of [1, 3, 6]) {
  console.log(`\n→ ${months}-Monats-Plan an ${email}`);

  const ctaUrl = await buildAutoLoginUrl(email, "/mitglieder/erfolge/coaching");
  console.log(`  Magic-Link: ${ctaUrl.slice(0, 70)}...`);

  const html = buildEmailHtml({ months, dogName: "Bruno", ctaUrl });
  const monthsLabel =
    months === 1 ? "1-Monats-Plan" : months === 3 ? "3-Monats-Plan" : "6-Monats-Plan";
  const subject = `🐾 [SAMPLE] Dein ${monthsLabel} für Bruno ist da`;
  const filename = `Pfoten-Plan-Bruno-${months}M.pdf`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
      replyTo: {
        email: "support@pfoten-plan.de",
        name: "Pfoten-Plan Support",
      },
      to: [{ email }],
      subject,
      htmlContent: html,
      attachment: [
        {
          name: filename,
          content: PDF_CACHE[months],
        },
      ],
      tags: ["sample", `plan-ready-${months}m`, "with-pdf"],
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

console.log(`\nFertig. 3 Mails mit jeweils passendem PDF an ${email}.\n`);
