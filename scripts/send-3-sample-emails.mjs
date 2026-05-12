// Schickt 3 Sample-"Plan ist fertig"-Mails (1-, 3- und 6-Monats-Plan)
// an eine Email-Adresse via Brevo direkt. Umgeht Vercel/Cloudflare/
// Anthropic — pure Local-Demo, damit man das Mail-Design + den
// Auto-Login-Flow sehen kann.
//
// Aufruf:
//   node scripts/send-3-sample-emails.mjs max@primesocial.de

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
  console.error("Usage: node scripts/send-3-sample-emails.mjs <email>");
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
  console.error("FEHLT: BREVO_API_KEY/SUPABASE_URL/SERVICE_ROLE in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Sample-Content je Plan-Länge ──────────────────────────────────────
const SAMPLES = {
  1: {
    months: 1,
    dog: "Bruno",
    week1Title: "Start Alltagstruktur",
    week1Ziele: [
      "Bruno soll erste kurze Ruhemomente vor Aktivität aushalten können.",
      "Die Leine soll bei drei Schritten locker bleiben in vertrauter Umgebung.",
      "Bruno reagiert auf seinen Namen mit Blickkontakt.",
    ],
    totalUebungen: 8, // 4 Wochen × 2 Übungen
  },
  3: {
    months: 3,
    dog: "Bruno",
    week1Title: "Start Alltagstruktur",
    week1Ziele: [
      "Bruno soll erste kurze Ruhemomente vor Aktivität aushalten können.",
      "Die Leine soll bei kurzen Sequenzen locker bleiben.",
      "Bruno reagiert auf seinen Namen mit Blickkontakt.",
    ],
    totalUebungen: 24, // 12 Wochen × 2 Übungen
  },
  6: {
    months: 6,
    dog: "Bruno",
    week1Title: "Fundament: Vertrauen aufbauen",
    week1Ziele: [
      "Bruno soll die Bezugsperson als sichere Basis erfahren.",
      "Erste Mini-Ruhemomente von 30 Sekunden aushalten können.",
      "Auf seinen Namen mit Blickkontakt reagieren.",
    ],
    totalUebungen: 48, // 24 Wochen × 2 Übungen
  },
};

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ── Auto-Login Magic-Link generieren ──────────────────────────────────
async function buildAutoLoginUrl(email, nextPath) {
  const fallback = `${SITE_URL}/mitglieder/login?email=${encodeURIComponent(email)}`;
  try {
    // User in auth.users sicherstellen
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

function buildEmailHtml(sample, ctaUrl) {
  const { months, dog, week1Title, week1Ziele, totalUebungen } = sample;
  const monthsLabel =
    months === 1 ? "1-Monats-Plan" : months === 3 ? "3-Monats-Plan" : "6-Monats-Plan";
  const weeksTotal = months * 4;

  const ziele = week1Ziele
    .map(
      (z) =>
        `<li style="margin:4px 0;font-size:13px;color:#4B5563;line-height:1.5;">${escapeHtml(z)}</li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>Dein ${monthsLabel} für ${escapeHtml(dog)}</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:24px 28px 8px;border-bottom:1px solid #F0EBE3;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">Pfoten-Plan</p>
      </td></tr>
      <tr><td style="padding:28px 28px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;font-weight:800;color:#1a1a1a;">Dein ${monthsLabel} für ${escapeHtml(dog)} ist fertig</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#4B5563;">Hi, dein persönlicher Trainings-Plan ist soeben für dich erstellt worden — komplett zugeschnitten auf ${escapeHtml(dog)} und euer Haupt-Thema. ${weeksTotal} Wochen, mit konkreten Übungen für jeden Tag, Wochenzielen, Fortschritts-Markern und einem klaren roten Faden.</p>
        <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;padding:16px 18px;margin:12px 0 20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8B7355;">Woche 1 · ${escapeHtml(week1Title)}</p>
          <ul style="margin:8px 0 0;padding-left:18px;">${ziele}</ul>
          <p style="margin:10px 0 0;font-size:12px;color:#8B7355;font-style:italic;">+ ${weeksTotal - 1} weitere Wochen, ${totalUebungen} konkrete Übungen, Monats-Übersichten und Bonus-Spiele.</p>
        </div>
        <p style="margin:0 0 8px;font-size:13px;color:#4B5563;line-height:1.55;">Im Mitglieder-Bereich kannst du den ganzen Plan durchklicken, Woche für Woche.</p>
      </td></tr>
      <tr><td align="center" style="padding:8px 28px 28px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#C4A576;color:#FFFFFF;font-weight:700;font-size:14px;padding:14px 26px;border-radius:12px;text-decoration:none;box-shadow:0 2px 8px rgba(196,165,118,0.3);">Plan ansehen</a>
      </td></tr>
      <tr><td style="padding:0 28px 24px;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#9CA3AF;text-align:center;">Der Button enthält einen Einmal-Login — du landest direkt eingeloggt im Mitglieder-Bereich. Der Link gilt 1 Stunde.</p>
      </td></tr>
      <tr><td style="padding:16px 28px;background:#FAFAFA;border-top:1px solid #F0EBE3;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#9CA3AF;text-align:center;">Pfoten-Plan · Persönliches Hundetraining · <a href="${SITE_URL}/mitglieder" style="color:#8B7355;text-decoration:underline;">Mein Bereich</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── Run: 3 Mails nacheinander ─────────────────────────────────────────
for (const months of [1, 3, 6]) {
  const sample = SAMPLES[months];
  console.log(`\n→ ${months}-Monats-Plan an ${email}`);

  // Each mail has its own fresh magic-link (1h gültig pro Link)
  const ctaUrl = await buildAutoLoginUrl(email, "/mitglieder/erfolge/coaching");
  console.log(`  Magic-Link: ${ctaUrl.slice(0, 70)}...`);

  const html = buildEmailHtml(sample, ctaUrl);
  const subject = `🐾 [SAMPLE ${months}M] Dein ${months}-Monats-Plan für ${sample.dog} ist da`;

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
      tags: ["sample", `plan-ready-${months}m`],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`  ✗ Brevo ${res.status}:`, txt.slice(0, 200));
  } else {
    const data = await res.json();
    console.log(`  ✓ Mail gesendet (Brevo-ID: ${data.messageId || "?"})`);
  }

  // kleine Pause zwischen den Mails
  await new Promise((r) => setTimeout(r, 1000));
}

console.log(`\nFertig. 3 Mails an ${email}.\n`);
