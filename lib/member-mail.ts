// Mail-Helper fuer den Mitglieder-Bereich (Brevo REST-API).
// Wird genutzt fuer Welcome-Mail (1x bei erster Anmeldung) und
// Wochen-Erinnerungs-Mail (jeden Montag via Cron).
//
// Sender + Branding identisch zu auth-hook (support@pfoten-plan.de).

import "server-only";
import type { UserChallenge } from "./member-challenges";
import type { MemberProfile } from "./member-db";

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://www.pfoten-plan.de";

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  tags?: string[];
}

async function sendBrevoMail({ to, subject, html, tags }: SendArgs) {
  if (!BREVO_API_KEY) {
    console.warn("[member-mail] BREVO_API_KEY fehlt — skipping send to", to);
    return { ok: false, reason: "no_api_key" };
  }
  if (!to) {
    return { ok: false, reason: "no_recipient" };
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
        replyTo: {
          email: "support@pfoten-plan.de",
          name: "Pfoten-Plan Support",
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        tags: tags || ["mitglieder"],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[member-mail] Brevo error:", res.status, text);
      return { ok: false, reason: `brevo_${res.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    console.error("[member-mail] send failed:", e?.message);
    return { ok: false, reason: "exception" };
  }
}

// ── HTML-Template (gemeinsam fuer alle Mitglieder-Mails) ───────────────
function wrapTemplate(opts: {
  preheader: string;
  headline: string;
  intro: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  footerHint?: string;
}): string {
  const { preheader, headline, intro, bodyHtml, ctaText, ctaUrl, footerHint } =
    opts;
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<span style="display:none;font-size:1px;color:#FAF8F5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:24px 28px 8px;border-bottom:1px solid #F0EBE3;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">Pfoten-Plan</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;">
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;font-weight:800;color:#1a1a1a;">${headline}</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#4B5563;">${intro}</p>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:8px 28px 28px;">
            <a href="${ctaUrl}" style="display:inline-block;background:#C4A576;color:#FFFFFF;font-weight:700;font-size:14px;padding:14px 26px;border-radius:12px;text-decoration:none;box-shadow:0 2px 8px rgba(196,165,118,0.3);">${ctaText}</a>
          </td>
        </tr>
        ${
          footerHint
            ? `<tr><td style="padding:0 28px 24px;"><p style="margin:0;font-size:12px;line-height:1.5;color:#9CA3AF;text-align:center;">${footerHint}</p></td></tr>`
            : ""
        }
        <tr>
          <td style="padding:16px 28px;background:#FAFAFA;border-top:1px solid #F0EBE3;">
            <p style="margin:0;font-size:11px;line-height:1.5;color:#9CA3AF;text-align:center;">
              Pfoten-Plan · Persönliches Hundetraining · <a href="${SITE_URL}/mitglieder" style="color:#8B7355;text-decoration:underline;">Mein Bereich</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function challengesAsHtml(challenges: UserChallenge[]): string {
  if (challenges.length === 0) return "";
  const items = challenges
    .map(
      (c) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F0EBE3;vertical-align:top;">
          <div style="display:inline-block;width:38px;height:38px;line-height:38px;text-align:center;background:#FFF9F0;border:1px solid #EADDC5;border-radius:10px;font-size:20px;margin-right:10px;vertical-align:middle;">${c.badge_emoji}</div>
          <div style="display:inline-block;vertical-align:middle;max-width:380px;">
            <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;line-height:1.3;">${c.challenge_title}</p>
            <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.45;">${c.challenge_description}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#8B7355;font-weight:600;">→ Abzeichen: ${c.badge_label}</p>
          </div>
        </td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 20px;">${items}</table>`;
}

// ── Welcome-Mail: 1x bei erster Anmeldung ─────────────────────────────
export async function sendWelcomeChallengesMail(
  member: MemberProfile,
  challenges: UserChallenge[]
) {
  if (!member.email) return { ok: false, reason: "no_email" };
  const dog = member.dog_name?.trim() || "deinem Hund";
  const challengesHtml = challengesAsHtml(challenges);
  const ctaUrl = `${SITE_URL}/mitglieder/erfolge/challenges`;

  const html = wrapTemplate({
    preheader: `Deine ersten Wochen-Aufgaben für ${dog} sind da.`,
    headline: `Willkommen im Pfoten-Plan${
      member.dog_name ? `, ${member.dog_name}` : ""
    }!`,
    intro: `Schön dass du da bist. Damit's nicht beim Lesen bleibt, gibt's bei uns jede Woche kleine Trainings-Aufgaben für ${dog} - direkt zugeschnitten auf euer Thema. Schaffst du sie, sammelst du Abzeichen für die Sammlung.`,
    bodyHtml: `<p style="margin:16px 0 8px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8B7355;">Diese Woche dran:</p>${challengesHtml}<p style="margin:0 0 8px;font-size:13px;color:#4B5563;line-height:1.55;">5-10 Minuten am Tag reichen. Im Mitglieder-Bereich kannst du jede Übung abhaken, sobald sie erledigt ist.</p>`,
    ctaText: "Zu deinen Wochen-Aufgaben",
    ctaUrl,
    footerHint: `Du bekommst diese Mail, weil du dich bei Pfoten-Plan angemeldet hast. Aufgaben + Abzeichen findest du jederzeit unter "Erfolge" im Mitglieder-Bereich.`,
  });

  return sendBrevoMail({
    to: member.email,
    subject: `🐾 Deine Wochen-Aufgaben für ${
      member.dog_name || "deinen Hund"
    } sind da`,
    html,
    tags: ["mitglieder", "challenges-welcome"],
  });
}

// ── Wochen-Erinnerung: jeden Montag ────────────────────────────────────
export async function sendWeeklyChallengesMail(
  member: MemberProfile,
  challenges: UserChallenge[]
) {
  if (!member.email) return { ok: false, reason: "no_email" };
  if (challenges.length === 0) return { ok: false, reason: "no_challenges" };

  const dog = member.dog_name?.trim() || "deinem Hund";
  const challengesHtml = challengesAsHtml(challenges);
  const ctaUrl = `${SITE_URL}/mitglieder/erfolge/challenges`;

  const html = wrapTemplate({
    preheader: `Neue Wochen-Aufgaben für ${dog} - hol dir das nächste Abzeichen.`,
    headline: `Neue Woche, neue Aufgaben für ${dog}`,
    intro: `Diese Woche warten neue kleine Trainings-Übungen auf euch - 5-10 Minuten am Tag reichen. Schaffst du sie alle, gibt's neue Abzeichen für die Sammlung.`,
    bodyHtml: `<p style="margin:16px 0 8px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8B7355;">Diese Woche dran:</p>${challengesHtml}`,
    ctaText: "Aufgaben ansehen",
    ctaUrl,
    footerHint: `Falls du diese Erinnerung nicht mehr möchtest, schreib uns kurz an support@pfoten-plan.de.`,
  });

  return sendBrevoMail({
    to: member.email,
    subject: `🐾 Neue Wochen-Aufgaben für ${
      member.dog_name || "deinen Hund"
    }`,
    html,
    tags: ["mitglieder", "challenges-weekly"],
  });
}
