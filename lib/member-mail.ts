// Mail-Helper fuer den Mitglieder-Bereich (Brevo REST-API).
// Wird genutzt fuer Welcome-Mail (1x bei erster Anmeldung) und
// Wochen-Erinnerungs-Mail (jeden Montag via Cron).
//
// Sender + Branding identisch zu auth-hook (support@pfoten-plan.de).

import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { UserChallenge } from "./member-challenges";
import type { MemberProfile } from "./member-db";

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://www.pfoten-plan.de";

// ── Auto-Login-Link generieren ────────────────────────────────────────
// Server-seitig per Supabase Admin Magic-Link: User landet beim Klick
// direkt eingeloggt auf der gewuenschten Seite. Falls Generation scheitert
// (User existiert nicht / kein Service-Role), kommt der normale Login-Link
// als Fallback zurueck.
async function buildAutoLoginUrl(
  email: string,
  nextPath: string
): Promise<string> {
  const fallbackUrl = `${SITE_URL}/mitglieder/login?email=${encodeURIComponent(email)}`;

  const supaUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
  if (!supaUrl || !serviceRole || !email) return fallbackUrl;

  const admin = createClient(supaUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Versuche magiclink — funktioniert wenn User schon existiert
    let { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${SITE_URL}/mitglieder/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    // Wenn User noch nicht existiert: erstellen, dann magiclink generieren
    if (error || !data?.properties?.hashed_token) {
      try {
        await admin.auth.admin.createUser({
          email,
          email_confirm: true,
        });
      } catch {
        // User existiert evtl. doch schon (race condition) — ignore
      }
      ({ data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: `${SITE_URL}/mitglieder/callback?next=${encodeURIComponent(nextPath)}`,
        },
      }));
    }

    const hashedToken = data?.properties?.hashed_token;
    if (!hashedToken) return fallbackUrl;

    const params = new URLSearchParams({
      token_hash: hashedToken,
      type: "magiclink",
      next: nextPath,
    });
    return `${SITE_URL}/mitglieder/callback?${params.toString()}`;
  } catch (e: any) {
    console.warn("[member-mail] auto-login link failed:", e?.message);
    return fallbackUrl;
  }
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  tags?: string[];
  attachments?: Array<{ name: string; contentBase64: string }>;
  cc?: string | string[];
}

async function sendBrevoMail({ to, subject, html, tags, attachments, cc }: SendArgs) {
  if (!BREVO_API_KEY) {
    console.warn("[member-mail] BREVO_API_KEY fehlt — skipping send to", to);
    return { ok: false, reason: "no_api_key" };
  }
  if (!to) {
    return { ok: false, reason: "no_recipient" };
  }
  try {
    const payload: Record<string, unknown> = {
      sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
      replyTo: {
        email: "support@pfoten-plan.de",
        name: "Pfoten-Plan Support",
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      tags: tags || ["mitglieder"],
    };
    if (cc) {
      const ccArr = Array.isArray(cc) ? cc : [cc];
      payload.cc = ccArr.filter(Boolean).map((email) => ({ email }));
    }
    if (attachments && attachments.length > 0) {
      payload.attachment = attachments.map((a) => ({
        name: a.name,
        content: a.contentBase64,
      }));
    }
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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

// ── "Dein Plan ist fertig": einmalig nach erfolgreicher Generation ────
import type { TrainingPlanContent } from "./member-plan-content";

interface PlanReadyArgs {
  to: string;
  dogName: string;
  dogBreed?: string | null;
  dogAge?: string | null;
  mainProblem?: string | null;
  planLengthMonths: 1 | 3 | 6;
  plan: TrainingPlanContent;
  customerName?: string | null;
}

export async function sendPlanReadyEmail(args: PlanReadyArgs) {
  const { to, dogName, dogBreed, dogAge, mainProblem, planLengthMonths, plan, customerName } = args;
  if (!to) return { ok: false, reason: "no_email" };

  // Auto-Login-Link: User landet direkt eingeloggt auf der Coaching-Seite
  const ctaUrl = await buildAutoLoginUrl(to, "/mitglieder/erfolge/coaching");
  const weeksTotal = plan.weeks.length;
  const greeting = customerName?.trim()
    ? `Hi ${customerName.trim().split(" ")[0]},`
    : "Hi,";

  // (Plan-Vorschau wurde entfernt — User soll direkt in den Mitglieder-Bereich)

  const monthsLabel =
    planLengthMonths === 1
      ? "1-Monats-Plan"
      : planLengthMonths === 3
        ? "3-Monats-Plan"
        : "6-Monats-Plan";

  // PDF-Hinweis-Box
  const pdfHinweis = `
    <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:14px;padding:18px 20px;margin:0 0 20px;">
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
    </div>`;

  // Mitgliederbereich-Showcase mit 5 Features
  const mitgliederShowcase = `
    <div style="border-top:1px solid #F0EBE3;margin:24px 0 16px;"></div>
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">Du bekommst noch mehr</p>
    <h2 style="margin:0 0 10px;font-size:20px;line-height:1.3;font-weight:800;color:#1a1a1a;">Dein Mitglieder-Bereich</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4B5563;">
      Den Plan kannst du jederzeit auch online durchgehen. Wir tracken automatisch deinen Fortschritt, ${escapeHtml(dogName)}s Stimmung und schicken dir jede Woche neue Aufgaben — damit du nicht alleine durch den Plan musst.
    </p>
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
              <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Wenn ${escapeHtml(dogName)} weitere Themen hat — z.B. Trennungsangst, Reise, Erste-Hilfe — gibt's gezielte Module dazu.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>`;

  const html = wrapTemplate({
    preheader: `Dein ${monthsLabel} für ${dogName} ist fertig.`,
    headline: `Dein ${monthsLabel} für ${dogName} ist fertig`,
    intro: `${greeting} dein persönlicher Trainings-Plan ist soeben für dich erstellt worden — komplett zugeschnitten auf ${dogName} und euer Haupt-Thema. ${weeksTotal} Wochen, mit konkreten Übungen für jeden Tag, Wochenzielen, Fortschritts-Markern und einem klaren roten Faden.`,
    bodyHtml: `${pdfHinweis}${mitgliederShowcase}`,
    ctaText: "Mitglieder-Bereich öffnen →",
    ctaUrl,
    footerHint: `Der Button enthält einen Einmal-Login — du landest direkt eingeloggt im Mitglieder-Bereich. Der Link gilt 1 Stunde und ist nur für dich.`,
  });

  // PDF-Anhang aus dem AI-personalisierten Plan-JSON generieren.
  // Fallback: Wenn aus irgendeinem Grund das nicht klappt — Mail trotzdem
  // rausgehen lassen, dann ohne PDF. User sieht den Plan jedenfalls im
  // Mitglieder-Bereich (Magic-Link im Mail-CTA).
  let attachments: Array<{ name: string; contentBase64: string }> | undefined;
  try {
    const { buildPlanPdfFromContent, planPdfFilename } = await import("./pdf-builder");
    const pdfBytes = await buildPlanPdfFromContent({
      plan,
      dogName,
      dogBreed: dogBreed || undefined,
      dogAge: dogAge || undefined,
      mainProblem: mainProblem || "Verhaltens-Themen im Alltag",
      planLengthMonths,
      verbose: false,
    });
    const buf =
      pdfBytes instanceof Buffer
        ? pdfBytes
        : Buffer.from(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength);
    attachments = [
      {
        name: planPdfFilename(dogName, planLengthMonths),
        contentBase64: buf.toString("base64"),
      },
    ];
    console.log(
      `[member-mail] PDF angehängt: ${attachments[0].name} (${(buf.length / 1024).toFixed(0)} KB)`
    );
  } catch (e: any) {
    console.error(
      "[member-mail] PDF-Build fehlgeschlagen — Mail wird ohne Anhang gesendet:",
      e?.message || e
    );
  }

  return sendBrevoMail({
    to,
    subject: `🐾 Dein ${monthsLabel} für ${dogName} ist da`,
    html,
    tags: ["mitglieder", "plan-ready"],
    attachments,
    cc: "kontakt@primesocial.de",
  });
}

// Tiny HTML escape (kein dom-purify, reicht fuer dog names / quiz answers)
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

// ── Sonntag-Reminder: letzter Push fuer User die noch nicht angefangen haben ─
// Sonntag = letzter Tag der Wochen-Aufgaben → "Heute noch schaffen".
// Wird intern noch midweek-Reminder genannt (Routen-Pfad, DB-Spalte),
// inhaltlich ist's aber die Sonntags-Mail.
export async function sendMidweekReminderMail(
  member: MemberProfile,
  challenges: UserChallenge[]
) {
  if (!member.email) return { ok: false, reason: "no_email" };
  if (challenges.length === 0) return { ok: false, reason: "no_challenges" };

  const dog = member.dog_name?.trim() || "deinem Hund";
  const challengesHtml = challengesAsHtml(challenges);
  const ctaUrl = `${SITE_URL}/mitglieder/erfolge/challenges`;

  const firstBadge = challenges[0]?.badge_label || "ein neues Abzeichen";
  const html = wrapTemplate({
    preheader: `Heute ist der letzte Tag - schnapp dir noch das ${firstBadge}-Abzeichen!`,
    headline: `Letzter Tag - schnapp dir noch dein Badge 🏆`,
    intro: `Schon Sonntag - und noch keine Sessions diese Woche geloggt. 10 Minuten reichen, dann gibt's das Abzeichen. Ab morgen warten neue Aufgaben.`,
    bodyHtml: `<p style="margin:16px 0 8px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8B7355;">Heute noch zu schaffen:</p>${challengesHtml}<p style="margin:14px 0 0;font-size:13px;color:#6B7280;line-height:1.55;">Tipp: Eine Session = ein kurzes Übungs-Set oder ein Spaziergang mit Fokus auf die Aufgabe. Im Mitglieder-Bereich abhaken, fertig.</p>`,
    ctaText: "Letzte Chance - jetzt loslegen",
    ctaUrl,
    footerHint: `Keine Erinnerungen mehr? Schreib uns kurz an support@pfoten-plan.de.`,
  });

  return sendBrevoMail({
    to: member.email,
    subject: `🐾 Letzter Tag: ${dog} ist eine Session vom Badge entfernt`,
    html,
    tags: ["mitglieder", "challenges-sunday"],
  });
}

// ── Recovery-Mail: User hat Checkout abgebrochen (Mollie expired) ───────
// Geht ~10 Min nach Lead-Erstellung raus wenn status != paid.
// Magic-Link fuehrt direkt ins Dashboard wo Quiz-Daten als "Profil" sichtbar
// sind. Kein Druck, kein Discount — erstmal Engagement-Touchpoint schaffen.

// Zielgruppe: aeltere DE-Hundehalter, oft skeptisch gegenueber digitalen
// Produkten. Wichtigste psychologische Hebel:
//   1) Tangibility: konkrete Bullets was sie bekommen (echte Uebung,
//      Auswertung, Empfehlung) — anfassbar statt "Dashboard"-Sprache
//   2) Risikofrei: "kostenlos ansehen", "kein Kauf noetig", "keine
//      weiteren Daten", "ohne Verpflichtung" — explizit + mehrfach
//   3) Trust: ausgebildete Hundetrainer:innen aus Deutschland, persoenliche
//      Antwort per Mail — gegen "irgendwas Anonymes im Internet"-Sorge
//   4) Sofort verfuegbar: "heute schon mit deinem Hund machbar"
export async function sendCheckoutRecoveryMail(args: {
  to: string;
  dogName: string | null;
  problemLabel: string | null;
  planLengthMonths: 1 | 3 | 6;
}) {
  const { to, dogName, problemLabel } = args;
  if (!to) return { ok: false, reason: "no_recipient" };

  const dog = dogName?.trim() || "deinen Hund";
  const dogPoss = dogName?.trim() ? `${dogName.trim()}s` : "Sein";
  const hasName = !!dogName?.trim();

  // Magic-Link direkt ins Dashboard. Quiz-Daten werden beim ersten Login
  // automatisch vom Lead ins member_users.quiz_result synced.
  const loginUrl = await buildAutoLoginUrl(to, "/mitglieder?from=recovery");

  // 3 Bullets — konkret, anfassbar, gegen die "trau-mich-nicht"-Skepsis
  const bulletsHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 16px;">
      <tr><td style="padding:8px 0;vertical-align:top;">
        <span style="display:inline-block;font-size:18px;width:26px;color:#15803D;">✓</span>
        <span style="font-size:14px;color:#1a1a1a;line-height:1.5;"><strong>${escapeHtml(dogPoss)} persönliche Auswertung</strong> — was wir aus dem Quiz erkennen${problemLabel ? `, plus konkrete Tipps für ${escapeHtml(problemLabel)}` : ""}.</span>
      </td></tr>
      <tr><td style="padding:8px 0;vertical-align:top;">
        <span style="display:inline-block;font-size:18px;width:26px;color:#15803D;">✓</span>
        <span style="font-size:14px;color:#1a1a1a;line-height:1.5;"><strong>Eine erste Übung gratis</strong> — Schritt für Schritt erklärt, in 5 Minuten heute schon mit ${escapeHtml(dog)} machbar.</span>
      </td></tr>
      <tr><td style="padding:8px 0;vertical-align:top;">
        <span style="display:inline-block;font-size:18px;width:26px;color:#15803D;">✓</span>
        <span style="font-size:14px;color:#1a1a1a;line-height:1.5;"><strong>Kein Kauf, keine weiteren Daten</strong> — ein Klick, du bist drin. Gefällt's nicht: Fenster schließen, fertig.</span>
      </td></tr>
    </table>`;

  // Extra-Sektion: Mitgliederbereich-Features. Macht klar: das ist mehr als
  // nur eine Demo — da steht ein richtiges Tool dahinter. Plus alles
  // kostenlos erkundbar = noch ein "no risk" Beweis.
  const extraFeaturesHtml = `
    <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:10px;padding:14px 16px;margin:4px 0 18px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">Plus diese Bereiche kostenlos erkundbar:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#4B5563;line-height:1.5;">
            <span style="display:inline-block;width:24px;font-size:15px;">💬</span> <strong style="color:#1a1a1a;">KI-Trainer</strong> — Fragen stellen, sofort Antwort
          </td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#4B5563;line-height:1.5;">
            <span style="display:inline-block;width:24px;font-size:15px;">🏆</span> <strong style="color:#1a1a1a;">Wochen-Aufgaben &amp; Abzeichen</strong> — kleine Trainings-Ziele, sichtbarer Fortschritt
          </td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#4B5563;line-height:1.5;">
            <span style="display:inline-block;width:24px;font-size:15px;">📊</span> <strong style="color:#1a1a1a;">Stimmungs-Tagebuch</strong> — wöchentlich eintragen, KI fasst zusammen
          </td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#4B5563;line-height:1.5;">
            <span style="display:inline-block;width:24px;font-size:15px;">📚</span> <strong style="color:#1a1a1a;">Module-Bibliothek</strong> — Reise, Erste-Hilfe, Trennungsangst &amp; mehr
          </td>
        </tr>
      </table>
    </div>`;

  // Trust-Footer: zeigt dass dahinter echte Menschen + DE stehen
  const trustBoxHtml = `
    <div style="background:#FAFAFA;border-radius:10px;padding:12px 14px;margin:8px 0 4px;border-left:3px solid #C4A576;">
      <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.5;">
        <strong style="color:#1a1a1a;">Hinter Pfoten-Plan:</strong> ein Team aus ausgebildeten Hundetrainer:innen aus Deutschland. Bei Fragen schreib einfach kurz an <a href="mailto:support@pfoten-plan.de" style="color:#8B7355;">support@pfoten-plan.de</a> — wir antworten persönlich.
      </p>
    </div>`;

  const introText = hasName
    ? `Du hast vorhin das Quiz für ${escapeHtml(dog)} ausgefüllt — aber den Plan nicht gekauft. Verstehen wir. Deshalb hier ein Vorschlag: schau dir <strong>kostenlos</strong> an, was wir für ${escapeHtml(dog)} schon erkannt haben.`
    : `Du hast vorhin das Quiz ausgefüllt — aber den Plan nicht gekauft. Verstehen wir. Deshalb hier ein Vorschlag: schau dir <strong>kostenlos</strong> an, was wir für deinen Hund schon erkannt haben.`;

  const bodyHtml = `
    <p style="margin:14px 0 6px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8B7355;">Was du sofort siehst:</p>
    ${bulletsHtml}
    ${extraFeaturesHtml}
    <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#4B5563;">
      Ein Klick auf den Button und du bist direkt drin — <strong>kein Passwort, keine erneute Anmeldung</strong>.
    </p>
    ${trustBoxHtml}`;

  const html = wrapTemplate({
    preheader: hasName
      ? `Kostenlos: ${dog}s Auswertung + eine 5-Min-Übung. Kein Kauf nötig.`
      : `Kostenlos: deine Auswertung + eine 5-Min-Übung. Kein Kauf nötig.`,
    headline: hasName
      ? `5 Minuten heute für ${dog} — eine Übung gratis`
      : `5 Minuten heute für deinen Hund — eine Übung gratis`,
    intro: introText,
    bodyHtml,
    ctaText: "Jetzt kostenlos ansehen",
    ctaUrl: loginUrl,
    footerHint: `Ohne Verpflichtung — wenn du nicht weitermachst, kommt nur diese eine Mail.`,
  });

  return sendBrevoMail({
    to,
    subject: hasName
      ? `5-Min-Übung für ${dog} — heute schon machbar`
      : `5-Min-Übung für deinen Hund — heute schon machbar`,
    html,
    tags: ["checkout-recovery"],
  });
}
