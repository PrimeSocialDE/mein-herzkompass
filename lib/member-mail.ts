// Mail-Helper fuer den Mitglieder-Bereich (Brevo REST-API).
// Wird genutzt fuer Welcome-Mail (1x bei erster Anmeldung) und
// Wochen-Erinnerungs-Mail (jeden Montag via Cron).
//
// Sender + Branding identisch zu auth-hook (support@pfoten-plan.de).

import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { UserChallenge } from "./member-challenges";
import type { MemberProfile } from "./member-db";
import type { Lang } from "./lang";
import { renderBelegFooterHtml, type BelegRow } from "./beleg";

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
  lang?: Lang;
}

// Absender sprachabhaengig: PL-Mails kommen von pomoc@lapaplan.pl (in Brevo
// verifiziert), DE bleibt exakt wie bisher (support@pfoten-plan.de).
export function mailSender(lang: Lang = "de") {
  return lang === "pl"
    ? { name: "ŁapaPlan", email: "pomoc@lapaplan.pl" }
    : { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" };
}
export function mailReplyTo(lang: Lang = "de") {
  return lang === "pl"
    ? { email: "pomoc@lapaplan.pl", name: "ŁapaPlan" }
    : { email: "support@pfoten-plan.de", name: "Pfoten-Plan Support" };
}

export async function sendBrevoMail({ to, subject, html, tags, attachments, cc, lang }: SendArgs) {
  if (!BREVO_API_KEY) {
    console.warn("[member-mail] BREVO_API_KEY fehlt — skipping send to", to);
    return { ok: false, reason: "no_api_key" };
  }
  if (!to) {
    return { ok: false, reason: "no_recipient" };
  }
  try {
    const payload: Record<string, unknown> = {
      sender: mailSender(lang),
      replyTo: mailReplyTo(lang),
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
export function wrapTemplate(opts: {
  preheader: string;
  headline: string;
  intro: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  footerHint?: string;
  /** Nur fuer Marketing-Mails: sichtbaren Abmelde-Link (Brevo-Tag) einblenden.
   *  NICHT fuer transaktionale Mails (Login, Plan-Auslieferung) setzen. */
  unsubscribe?: boolean;
  /** Sprache: "pl" schaltet Marken-Label + Footer auf Polnisch. Default "de". */
  lang?: Lang;
  /** Optional: Beleg-/Kleinbetragsrechnung-Footer (nur DE-Plan-Mail). */
  belegHtml?: string;
}): string {
  const {
    preheader,
    headline,
    intro,
    bodyHtml,
    ctaText,
    ctaUrl,
    footerHint,
    unsubscribe,
    lang = "de",
    belegHtml,
  } = opts;
  const isPl = lang === "pl";
  const htmlLang = isPl ? "pl" : "de";
  const brandLabel = isPl ? "ŁapaPlan" : "Pfoten-Plan";
  const footerBrandLine = isPl
    ? `ŁapaPlan · Spersonalizowany trening psa · <a href="${SITE_URL}/mitglieder" style="color:#8B7355;text-decoration:underline;">Mój panel</a>`
    : `Pfoten-Plan · Persönliches Hundetraining · <a href="${SITE_URL}/mitglieder" style="color:#8B7355;text-decoration:underline;">Mein Bereich</a>`;
  const unsubscribeText = isPl
    ? "Wypisz się z tych e-maili"
    : "Aus diesen E-Mails abmelden";
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
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
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">${brandLabel}</p>
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
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td align="center" bgcolor="#C4A576" style="background:#C4A576;border-radius:12px;">
                  <a href="${ctaUrl}" style="display:inline-block;padding:15px 30px;font-size:15px;font-weight:700;line-height:1;color:#FFFFFF;text-decoration:none;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${ctaText}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${
          footerHint
            ? `<tr><td style="padding:0 28px 24px;"><p style="margin:0;font-size:12px;line-height:1.5;color:#9CA3AF;text-align:center;">${footerHint}</p></td></tr>`
            : ""
        }
        ${
          belegHtml
            ? `<tr><td style="padding:0 28px 22px;">${belegHtml}</td></tr>`
            : ""
        }
        <tr>
          <td style="padding:16px 28px;background:#FAFAFA;border-top:1px solid #F0EBE3;">
            <p style="margin:0;font-size:11px;line-height:1.6;color:#9CA3AF;text-align:center;">
              ${footerBrandLine}${
                unsubscribe
                  ? `<br><a href="{{ unsubscribe }}" style="color:#9CA3AF;text-decoration:underline;">${unsubscribeText}</a>`
                  : ""
              }
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

function challengesAsHtml(challenges: UserChallenge[], lang: Lang = "de"): string {
  if (challenges.length === 0) return "";
  const badgeLabel = lang === "pl" ? "→ Odznaka:" : "→ Abzeichen:";
  const items = challenges
    .map(
      (c) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F0EBE3;vertical-align:top;">
          <div style="display:inline-block;width:38px;height:38px;line-height:38px;text-align:center;background:#FFF9F0;border:1px solid #EADDC5;border-radius:10px;font-size:20px;margin-right:10px;vertical-align:middle;">${c.badge_emoji}</div>
          <div style="display:inline-block;vertical-align:middle;max-width:380px;">
            <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;line-height:1.3;">${c.challenge_title}</p>
            <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.45;">${c.challenge_description}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#8B7355;font-weight:600;">${badgeLabel} ${c.badge_label}</p>
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
  challenges: UserChallenge[],
  lang: Lang = "de"
) {
  if (!member.email) return { ok: false, reason: "no_email" };

  if (lang === "pl") {
    const dog = member.dog_name?.trim() || "Twojego psa";
    const challengesHtml = challengesAsHtml(challenges, "pl");
    const ctaUrl = `${SITE_URL}/mitglieder/erfolge/challenges`;

    const html = wrapTemplate({
      preheader: `Twoje pierwsze zadania tygodnia dla ${dog} są gotowe.`,
      headline: `Witaj w ŁapaPlan${
        member.dog_name ? `, ${member.dog_name}` : ""
      }!`,
      intro: `Cieszymy się, że jesteś. Żeby nie skończyło się na samym czytaniu, co tydzień dostajesz krótkie zadania treningowe dla ${dog} - skrojone dokładnie pod wasz temat. Gdy je wykonasz, zbierasz odznaki do kolekcji.`,
      bodyHtml: `<p style="margin:16px 0 8px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8B7355;">W tym tygodniu:</p>${challengesHtml}<p style="margin:0 0 8px;font-size:13px;color:#4B5563;line-height:1.55;">Wystarczy 5-10 minut dziennie. W panelu członkowskim możesz odhaczyć każde ćwiczenie, gdy tylko je wykonasz.</p>`,
      ctaText: "Do Twoich zadań tygodnia",
      ctaUrl,
      footerHint: `Otrzymujesz tego e-maila, ponieważ zarejestrowałeś się w ŁapaPlan. Zadania i odznaki znajdziesz w każdej chwili w sekcji „Osiągnięcia" w panelu członkowskim.`,
      lang: "pl",
    });

    return sendBrevoMail({
    lang,
      to: member.email,
      subject: `🐾 Zadania tygodnia dla ${
        member.dog_name || "Twojego psa"
      } są gotowe`,
      html,
      tags: ["mitglieder", "challenges-welcome"],
    });
  }

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
    lang,
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
  lang?: Lang;
  beleg?: BelegRow | null;
}

export async function sendPlanReadyEmail(args: PlanReadyArgs) {
  const { to, dogName, dogBreed, dogAge, mainProblem, planLengthMonths, plan, customerName } = args;
  const lang = args.lang ?? "de";
  if (!to) return { ok: false, reason: "no_email" };

  // Beleg-Footer (Kleinbetragsrechnung) — nur DE, nur wenn ein Beleg vorliegt.
  const belegHtml =
    lang !== "pl" && args.beleg ? renderBelegFooterHtml(args.beleg) : undefined;

  // Auto-Login-Link: User landet direkt eingeloggt auf der Coaching-Seite
  const ctaUrl = await buildAutoLoginUrl(to, "/mitglieder/erfolge/coaching");
  const weeksTotal = plan.weeks.length;

  let html: string;
  let subject: string;

  if (lang === "pl") {
    const greeting = customerName?.trim()
      ? `Cześć ${customerName.trim().split(" ")[0]},`
      : "Cześć,";

    const monthsLabelPl =
      planLengthMonths === 1
        ? "plan na 1 miesiąc"
        : planLengthMonths === 3
          ? "plan na 3 miesiące"
          : "plan na 6 miesięcy";

    const pdfHinweisPl = `
    <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:14px;padding:18px 20px;margin:0 0 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="vertical-align:middle;width:54px;">
            <div style="display:inline-block;width:48px;height:48px;background:#C4A576;border-radius:12px;text-align:center;line-height:48px;font-size:22px;color:#FFFFFF;">📄</div>
          </td>
          <td style="vertical-align:middle;padding-left:14px;">
            <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;line-height:1.3;">Twój plan treningowy w PDF</p>
            <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.4;">W załączniku tej wiadomości · do druku · na drogę</p>
          </td>
        </tr>
      </table>
    </div>`;

    const mitgliederShowcasePl = `
    <div style="border-top:1px solid #F0EBE3;margin:24px 0 16px;"></div>
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">Dostajesz jeszcze więcej</p>
    <h2 style="margin:0 0 10px;font-size:20px;line-height:1.3;font-weight:800;color:#1a1a1a;">Twój panel członkowski</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4B5563;">
      Plan możesz w każdej chwili przejść także online. Automatycznie śledzimy Twoje postępy, nastrój ${escapeHtml(dogName)} i co tydzień wysyłamy Ci nowe zadania — żebyś nie musiał przechodzić przez plan w pojedynkę.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="padding:10px 0;border-bottom:1px solid #F5F1E8;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:top;width:34px;font-size:18px;">📅</td>
            <td style="vertical-align:top;padding-left:6px;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">Prowadzenie przez plan — tydzień po tygodniu</p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Który tydzień jest teraz, co będzie dalej — na pierwszy rzut oka.</p>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #F5F1E8;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:top;width:34px;font-size:18px;">📊</td>
            <td style="vertical-align:top;padding-left:6px;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">Dziennik nastroju z analizą AI</p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Zapisuj co tydzień krótko, jak poszło — AI podsumuje wasz tydzień i da konkretne wskazówki na kolejny.</p>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #F5F1E8;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:top;width:34px;font-size:18px;">🏆</td>
            <td style="vertical-align:top;padding-left:6px;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">Zadania tygodnia i odznaki</p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Co tydzień krótkie zadania treningowe dopasowane do waszego planu. Wykonane = odznaka do kolekcji.</p>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #F5F1E8;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:top;width:34px;font-size:18px;">💬</td>
            <td style="vertical-align:top;padding-left:6px;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">Trener AI na Twoje pytania</p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Zadawaj pytania o każdej porze — trener AI odpowiada całą dobę, korzystając z wiedzy naszego zespołu trenerów psów.</p>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:10px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:top;width:34px;font-size:18px;">📚</td>
            <td style="vertical-align:top;padding-left:6px;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">Moduły specjalne</p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Jeśli ${escapeHtml(dogName)} ma dodatkowe tematy — np. lęk separacyjny, podróże, pierwsza pomoc — są do tego dedykowane moduły.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>`;

    html = wrapTemplate({
      preheader: `Twój ${monthsLabelPl} dla ${dogName} jest gotowy.`,
      headline: `Twój ${monthsLabelPl} dla ${dogName} jest gotowy`,
      intro: `${greeting} Twój osobisty plan treningowy właśnie został dla Ciebie stworzony — w pełni skrojony pod ${dogName} i wasz główny temat. ${weeksTotal} tygodni, z konkretnymi ćwiczeniami na każdy dzień, celami tygodniowymi, znacznikami postępów i jasną nicią przewodnią.`,
      bodyHtml: `${pdfHinweisPl}${mitgliederShowcasePl}`,
      ctaText: "Otwórz panel członkowski →",
      ctaUrl,
      footerHint: `Przycisk zawiera jednorazowe logowanie — trafisz od razu zalogowany do panelu członkowskiego. Link jest ważny 1 godzinę i tylko dla Ciebie.`,
      lang: "pl",
    });
    subject = `🐾 Twój ${monthsLabelPl} dla ${dogName} jest gotowy`;
  } else {

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

  html = wrapTemplate({
    preheader: `Dein ${monthsLabel} für ${dogName} ist fertig.`,
    headline: `Dein ${monthsLabel} für ${dogName} ist fertig`,
    intro: `${greeting} dein persönlicher Trainings-Plan ist soeben für dich erstellt worden — komplett zugeschnitten auf ${dogName} und euer Haupt-Thema. ${weeksTotal} Wochen, mit konkreten Übungen für jeden Tag, Wochenzielen, Fortschritts-Markern und einem klaren roten Faden.`,
    bodyHtml: `${pdfHinweis}${mitgliederShowcase}`,
    ctaText: "Mitglieder-Bereich öffnen →",
    ctaUrl,
    footerHint: `Der Button enthält einen Einmal-Login — du landest direkt eingeloggt im Mitglieder-Bereich. Der Link gilt 1 Stunde und ist nur für dich.`,
    belegHtml,
  });
  subject = `🐾 Dein ${monthsLabel} für ${dogName} ist da`;
  }

  // PDF-Anhang aus dem AI-personalisierten Plan-JSON generieren.
  // WICHTIG: Bei PDF-Build-Fail wird die Mail NICHT geschickt (statt
  // ohne Anhang, was den Kunden frustriert hat in 2 dokumentierten Faellen).
  // Caller bekommt {ok:false} zurueck und kann via process-paid-leads Cron
  // oder /api/admin/trigger-delivery retriggern wenn Build wieder klappt.
  let attachments: Array<{ name: string; contentBase64: string }>;
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
      lang,
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
    // Voller Stack-Trace damit wir Root-Cause finden koennen
    console.error(
      `[member-mail] PDF-Build FEHLGESCHLAGEN für ${to} — Mail wird NICHT gesendet (Re-Trigger via /api/admin/trigger-delivery noetig). Fehler:`,
      e?.message || e
    );
    if (e?.stack) console.error(e.stack);
    return { ok: false, reason: "pdf_build_failed" };
  }

  return sendBrevoMail({
    lang,
    to,
    subject,
    html,
    tags: ["mitglieder", "plan-ready"],
    attachments,
    cc: "kontakt@primesocial.de",
  });
}

// Tiny HTML escape (kein dom-purify, reicht fuer dog names / quiz answers)
export function escapeHtml(s: string): string {
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
  challenges: UserChallenge[],
  lang: Lang = "de"
) {
  if (!member.email) return { ok: false, reason: "no_email" };
  if (challenges.length === 0) return { ok: false, reason: "no_challenges" };

  if (lang === "pl") {
    const dog = member.dog_name?.trim() || "Twojego psa";
    const challengesHtml = challengesAsHtml(challenges, "pl");
    const ctaUrl = `${SITE_URL}/mitglieder/erfolge/challenges`;

    const html = wrapTemplate({
      preheader: `Nowe zadania tygodnia dla ${dog} - zdobądź kolejną odznakę.`,
      headline: `Nowy tydzień, nowe zadania dla ${dog}`,
      intro: `W tym tygodniu czekają na was nowe krótkie ćwiczenia treningowe - wystarczy 5-10 minut dziennie. Gdy wykonasz je wszystkie, są nowe odznaki do kolekcji.`,
      bodyHtml: `<p style="margin:16px 0 8px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8B7355;">W tym tygodniu:</p>${challengesHtml}`,
      ctaText: "Zobacz zadania",
      ctaUrl,
      footerHint: `Jeśli nie chcesz już tego przypomnienia, napisz do nas krótko na pomoc@lapaplan.pl.`,
      lang: "pl",
    });

    return sendBrevoMail({
    lang,
      to: member.email,
      subject: `🐾 Nowe zadania tygodnia dla ${
        member.dog_name || "Twojego psa"
      }`,
      html,
      tags: ["mitglieder", "challenges-weekly"],
    });
  }

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
    lang,
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
  challenges: UserChallenge[],
  lang: Lang = "de"
) {
  if (!member.email) return { ok: false, reason: "no_email" };
  if (challenges.length === 0) return { ok: false, reason: "no_challenges" };

  if (lang === "pl") {
    const dog = member.dog_name?.trim() || "Twój pies";
    const challengesHtml = challengesAsHtml(challenges, "pl");
    const ctaUrl = `${SITE_URL}/mitglieder/erfolge/challenges`;

    const firstBadge = challenges[0]?.badge_label || "nową odznakę";
    const html = wrapTemplate({
      preheader: `Dziś ostatni dzień - zgarnij jeszcze ${firstBadge}!`,
      headline: `Ostatni dzień - zgarnij jeszcze swoją odznakę 🏆`,
      intro: `Już niedziela - a w tym tygodniu jeszcze żadnej sesji. Wystarczy 10 minut i odznaka jest Twoja. Od jutra czekają nowe zadania.`,
      bodyHtml: `<p style="margin:16px 0 8px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8B7355;">Jeszcze dziś do zrobienia:</p>${challengesHtml}<p style="margin:14px 0 0;font-size:13px;color:#6B7280;line-height:1.55;">Wskazówka: Jedna sesja = krótki zestaw ćwiczeń albo spacer ze skupieniem na zadaniu. Odhacz w panelu członkowskim i gotowe.</p>`,
      ctaText: "Ostatnia szansa - zaczynaj teraz",
      ctaUrl,
      footerHint: `Nie chcesz więcej przypomnień? Napisz do nas krótko na pomoc@lapaplan.pl.`,
      lang: "pl",
    });

    return sendBrevoMail({
    lang,
      to: member.email,
      subject: `🐾 Ostatni dzień: ${dog} jest o jedną sesję od odznaki`,
      html,
      tags: ["mitglieder", "challenges-sunday"],
    });
  }

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
    lang,
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
  leadId: string;
  previewFreeView?: boolean;
  lang?: Lang;
}) {
  const { to, dogName, problemLabel, leadId, previewFreeView } = args;
  const lang = args.lang ?? "de";
  if (!to) return { ok: false, reason: "no_recipient" };

  const dog = dogName?.trim() || "deinen Hund";
  const dogPoss = dogName?.trim() ? `${dogName.trim()}s` : "Sein";
  const hasName = !!dogName?.trim();

  // Evergreen-Login-Link: Mail bleibt ewig klickbar, bei jedem Klick wird
  // serverseitig ein frischer Magic-Link generiert. Loest das Problem dass
  // Supabase-Magic-Tokens nur 1h gueltig sind und alte Mails nicht mehr
  // funktionierten. Signatur ueber WORKER_TOKEN verhindert lead_id-Raten.
  const { buildRecoveryUrl } = await import("./recovery-link");
  const loginUrl = buildRecoveryUrl(leadId, { previewFreeView });

  if (lang === "pl") {
    const dogPl = dogName?.trim() || "Twojego psa";

    const bulletsHtmlPl = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 16px;">
      <tr><td style="padding:10px 0;vertical-align:top;">
        <span style="display:inline-block;font-size:18px;width:26px;color:#15803D;">✓</span>
        <span style="font-size:14px;color:#1a1a1a;line-height:1.55;"><strong>Jedno ćwiczenie indywidualnie dla ${escapeHtml(dogPl)} — za darmo do przetestowania.</strong> Do zrobienia już dziś, wystarczy 5 minut. Wyjaśnione krok po kroku, bez wcześniejszej wiedzy.</span>
      </td></tr>
      <tr><td style="padding:10px 0;vertical-align:top;">
        <span style="display:inline-block;font-size:18px;width:26px;color:#15803D;">✓</span>
        <span style="font-size:14px;color:#1a1a1a;line-height:1.55;"><strong>Pomożemy Ci rozwiązać ${problemLabel ? `temat ${escapeHtml(problemLabel)}` : "temat zachowania"}.</strong> Z konkretnymi ćwiczeniami z codziennej pracy trenera, dopasowanymi dokładnie do sytuacji ${escapeHtml(dogPl)}. Plus osobista pomoc, gdy utkniesz.</span>
      </td></tr>
      <tr><td style="padding:10px 0;vertical-align:top;">
        <span style="display:inline-block;font-size:18px;width:26px;color:#15803D;">✓</span>
        <span style="font-size:14px;color:#1a1a1a;line-height:1.55;"><strong>Jeśli zdecydujesz się później:</strong> bez abonamentu, dożywotni dostęp, 30 dni gwarancji zwrotu pieniędzy. Jeśli nie: po prostu zamknij okno i gotowe.</span>
      </td></tr>
    </table>`;

    const trustBoxHtmlPl = `
    <div style="background:#FAFAFA;border-radius:10px;padding:14px 16px;margin:12px 0 4px;border-left:3px solid #C4A576;">
      <p style="margin:0;font-size:13px;color:#4B5563;line-height:1.6;">
        Wiemy, jak frustrujące bywa, gdy porady z internetu po prostu nie działają — i na końcu znów masz frustrację zamiast postępu. Właśnie dlatego stworzyliśmy ŁapaPlan: zespół wykształconych trenerów psów, który krok po kroku jest przy Tobie.<br><br>
        W razie pytań napisz po prostu na <a href="mailto:pomoc@lapaplan.pl" style="color:#8B7355;">pomoc@lapaplan.pl</a> — odpowiadamy osobiście.
      </p>
    </div>`;

    const introTextPl = hasName
      ? `${problemLabel ? `${escapeHtml(problemLabel)} u ${escapeHtml(dogPl)}` : `Temat z ${escapeHtml(dogPl)}`} to nic, z czym musisz radzić sobie sam. Zobacz spokojnie, co przygotowaliśmy <strong>indywidualnie dla ${escapeHtml(dogPl)}</strong> — <strong>za darmo do przetestowania</strong>.`
      : `Temat z Twoim psem to nic, z czym musisz radzić sobie sam. Zobacz spokojnie, co przygotowaliśmy — <strong>za darmo do przetestowania</strong>.`;

    const bodyHtmlPl = `
    ${bulletsHtmlPl}
    <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#4B5563;">
      Jedno kliknięcie w przycisk i jesteś od razu w środku — bez hasła, bez ponownej rejestracji.
    </p>
    ${trustBoxHtmlPl}`;

    const html = wrapTemplate({
      preheader: hasName
        ? `Za darmo przetestuj: indywidualne 5-minutowe ćwiczenie dla ${dogPl}.`
        : `Za darmo przetestuj: indywidualne 5-minutowe ćwiczenie dla Twojego psa.`,
      headline: hasName
        ? `5 minut dziś dla ${dogPl} — jedno ćwiczenie gratis`
        : `5 minut dziś dla Twojego psa — jedno ćwiczenie gratis`,
      intro: introTextPl,
      bodyHtml: bodyHtmlPl,
      ctaText: "Zobacz teraz za darmo",
      ctaUrl: loginUrl,
      footerHint: `Bez zobowiązań — jeśli nie kontynuujesz, przyjdzie tylko ten jeden e-mail.`,
      lang: "pl",
    });

    return sendBrevoMail({
    lang,
      to,
      subject: hasName
        ? `5-minutowe ćwiczenie dla ${dogPl} — do zrobienia już dziś`
        : `5-minutowe ćwiczenie dla Twojego psa — do zrobienia już dziś`,
      html,
      tags: ["checkout-recovery"],
    });
  }

  // Genau 3 Bullets — die 3 stärksten emotionalen Hebel:
  //   1) Geschenk (individuelle Übung kostenfrei, heute machbar)
  //   2) Hilfe-Versprechen (Trainer-Team, persönlich, Problem-bezogen)
  //   3) Sicherheit (kein Abo, Garantie — aber NICHT "kein Kauf")
  const bulletsHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 16px;">
      <tr><td style="padding:10px 0;vertical-align:top;">
        <span style="display:inline-block;font-size:18px;width:26px;color:#15803D;">✓</span>
        <span style="font-size:14px;color:#1a1a1a;line-height:1.55;"><strong>Eine Übung individuell für ${escapeHtml(dog)} — kostenfrei zum Testen.</strong> Heute schon machbar, 5 Minuten reichen. Schritt für Schritt erklärt, kein Vorwissen nötig.</span>
      </td></tr>
      <tr><td style="padding:10px 0;vertical-align:top;">
        <span style="display:inline-block;font-size:18px;width:26px;color:#15803D;">✓</span>
        <span style="font-size:14px;color:#1a1a1a;line-height:1.55;"><strong>Wir helfen dir, das ${problemLabel ? `Thema ${escapeHtml(problemLabel)}` : "Verhaltens-Thema"} zu lösen.</strong> Mit konkreten Übungen aus dem Trainer-Alltag, die genau für ${escapeHtml(dog)}s Situation passen. Plus persönliche Hilfe wenn du nicht weiterkommst.</span>
      </td></tr>
      <tr><td style="padding:10px 0;vertical-align:top;">
        <span style="display:inline-block;font-size:18px;width:26px;color:#15803D;">✓</span>
        <span style="font-size:14px;color:#1a1a1a;line-height:1.55;"><strong>Falls du dich später entscheidest:</strong> kein Abo, lebenslanger Zugang, 30 Tage Geld-zurück. Wenn nicht: einfach Fenster schließen, fertig.</span>
      </td></tr>
    </table>`;

  // Trust-Footer: zeigt dass dahinter echte Menschen + DE stehen
  const trustBoxHtml = `
    <div style="background:#FAFAFA;border-radius:10px;padding:14px 16px;margin:12px 0 4px;border-left:3px solid #C4A576;">
      <p style="margin:0;font-size:13px;color:#4B5563;line-height:1.6;">
        Wir wissen, wie zermürbend es sein kann, wenn die Tipps aus dem Internet einfach nicht greifen — und du am Ende doch wieder Frust hast statt Fortschritt. Genau deshalb haben wir Pfoten-Plan gebaut: ein Team aus ausgebildeten Hundetrainer:innen aus Deutschland, das dir Schritt für Schritt zur Seite steht.<br><br>
        Bei Fragen schreib einfach an <a href="mailto:support@pfoten-plan.de" style="color:#8B7355;">support@pfoten-plan.de</a> — wir antworten persönlich.
      </p>
    </div>`;

  const introText = hasName
    ? `${problemLabel ? `${escapeHtml(problemLabel)} bei ${escapeHtml(dog)}` : `Das Thema mit ${escapeHtml(dog)}`} ist nichts, was du alleine in den Griff kriegen musst. Schau dir in Ruhe an, was wir <strong>individuell für ${escapeHtml(dog)}</strong> zusammengestellt haben — <strong>kostenfrei zum Testen</strong>.`
    : `Das Thema mit deinem Hund ist nichts, was du alleine in den Griff kriegen musst. Schau dir in Ruhe an, was wir vorbereitet haben — <strong>kostenfrei zum Testen</strong>.`;

  const bodyHtml = `
    ${bulletsHtml}
    <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#4B5563;">
      Ein Klick auf den Button und du bist direkt drin — kein Passwort, keine erneute Anmeldung.
    </p>
    ${trustBoxHtml}`;

  const html = wrapTemplate({
    preheader: hasName
      ? `Kostenfrei testen: eine individuelle 5-Min-Übung für ${dog}.`
      : `Kostenfrei testen: eine individuelle 5-Min-Übung für deinen Hund.`,
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
    lang,
    to,
    subject: hasName
      ? `5-Min-Übung für ${dog} — heute schon machbar`
      : `5-Min-Übung für deinen Hund — heute schon machbar`,
    html,
    tags: ["checkout-recovery"],
  });
}
