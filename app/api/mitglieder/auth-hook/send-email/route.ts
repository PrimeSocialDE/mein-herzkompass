// Supabase Auth-Webhook für E-Mail-Versand.
// Supabase ruft diesen Endpoint, wenn er sonst eine Auth-Mail (Magic-Link,
// Sign-up Confirmation, Password-Reset etc.) verschicken würde. Wir
// rendern die Mail selbst (Pfoten-Plan-Branding) und senden via Brevo REST.
//
// Setup im Supabase-Dashboard:
//   Authentication → Hooks → "Send Email Hook" → Type: HTTPS
//   URL: https://www.pfoten-plan.de/api/mitglieder/auth-hook/send-email
//   Secret: <generieren> → in .env.local + Vercel als SUPABASE_AUTH_HOOK_SECRET
// Detailliertes Setup: siehe MEMBER-AUTH-EMAIL-SETUP.md im Repo-Root.

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { buildOneTapUrl } from "@/lib/one-tap-login";
import { supabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOOK_SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET || "";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";

interface SupabaseEmailHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, any>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type:
      | "signup"
      | "magiclink"
      | "recovery"
      | "invite"
      | "email_change_current"
      | "email_change_new";
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

// Magic-Link zeigt direkt auf unseren callback-Endpoint mit token_hash.
// Vorteil ggue. Supabase's verify-Endpoint: KEIN PKCE-Verifier noetig →
// Link funktioniert auch wenn User die Mail auf einem ANDEREN Geraet
// oeffnet als wo er die Anmeldung gestartet hat. Server-seitige
// verifyOtp tauscht token_hash gegen eine echte Session.
//
// WICHTIG: NIEMALS payload.email_data.site_url verwenden — Supabase
// fuellt das oft mit der Project-URL (xxx.supabase.co). Wenn der Link
// dorthin zeigt landet der User auf Supabase's REST-Endpoint und
// bekommt "No API key found". Hart auf unsere Domain pinnen.
const PFOTEN_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://www.pfoten-plan.de";

function buildLoginUrl(p: SupabaseEmailHookPayload): string {
  // Wenn redirect_to schon was Sinnvolles enthaelt (z.B. /mitglieder),
  // nutzen wir das als 'next'. Sonst Default auf /mitglieder.
  let next = "/mitglieder";
  try {
    const r = new URL(p.email_data.redirect_to);
    // Wenn redirect_to direkt /mitglieder/callback ist, dann ist
    // 'next' der Default. Wenn aber redirect_to eine echte Ziel-Seite
    // ist (anders als callback), nutze die.
    if (r.pathname && !r.pathname.includes("callback")) {
      next = r.pathname + r.search;
    }
  } catch {}

  const type =
    p.email_data.email_action_type === "signup" ? "signup" : "magiclink";

  const params = new URLSearchParams({
    token_hash: p.email_data.token_hash,
    type,
    next,
  });
  // Zeigt auf die scanner-sichere Bestaetigungsseite (nicht direkt auf callback).
  // Dort loest erst ein echter Klick (POST) den Einmal-Token ein — E-Mail-Scanner
  // (GET-Vorabruf) verbrennen ihn dadurch nicht mehr. Siehe app/mitglieder/anmelden.
  return `${PFOTEN_SITE_URL}/mitglieder/anmelden?${params.toString()}`;
}

type Lang = "de" | "pl";

// Sprache des Users (answers.lang am Lead) via Email nachschlagen — Default "de".
// So bekommt ein polnischer Kunde die Login-Mail auf Polnisch (ŁapaPlan).
async function langForEmail(email: string): Promise<Lang> {
  if (!email) return "de";
  try {
    const { data } = await supabase
      .from("wauwerk_leads")
      .select("answers")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return String((data?.answers as any)?.lang || "").toLowerCase() === "pl" ? "pl" : "de";
  } catch {
    return "de";
  }
}

type ActionKey = "signup" | "recovery" | "email_change" | "magiclink";
function actionKey(p: SupabaseEmailHookPayload): ActionKey {
  switch (p.email_data.email_action_type) {
    case "signup":
      return "signup";
    case "recovery":
      return "recovery";
    case "email_change_current":
    case "email_change_new":
      return "email_change";
    default:
      return "magiclink";
  }
}

// ── Texte je Sprache ──────────────────────────────────────────────
const T = {
  de: {
    brand: "Pfoten-Plan",
    subject: {
      signup: "Willkommen bei Pfoten-Plan – dein Mitgliederbereich wartet",
      recovery: "Dein Zugang zu Pfoten-Plan wieder herstellen",
      email_change: "Bestätige deine neue E-Mail bei Pfoten-Plan",
      magiclink: "Dein Login-Link für Pfoten-Plan",
    },
    heading: {
      signup: (n: string) => `Willkommen bei Pfoten-Plan${n ? ", " + n : ""}!`,
      recovery: (n: string) => `Zugang frisch eingerichtet${n ? ", " + n : ""}`,
      email_change: (n: string) => `Fast geschafft${n ? ", " + n : ""}`,
      magiclink: (n: string) => `Hier ist dein Login${n ? ", " + n : ""}`,
    },
    subtitle: {
      signup: "Schön dass du dabei bist! Klick auf den Button unten — du landest direkt in deinem Mitgliederbereich.",
      recovery: "Kein Stress — mit einem Klick bist du wieder drin. Dein Zugang ist frisch eingerichtet.",
      email_change: "Bitte bestätige deine neue E-Mail-Adresse, damit wir deinen Zugang umstellen können.",
      magiclink: "Ein Klick und du bist in deinem Mitgliederbereich. Kein Passwort, kein Tippen.",
    },
    cta: "Jetzt einloggen →",
    orCode: "— oder Code eingeben —",
    codeHintLabel: "pfoten-plan.de/mitglieder/login",
    codeHintPrefix: "Auf",
    codeHintSuffix: "eintragen",
    stepsTitle: "So einfach geht's",
    steps: [
      "Klick auf den Button oben",
      "Du landest direkt in deinem Mitgliederbereich",
      "Fertig — kein Passwort, keine Tipperei",
    ],
    security:
      "🔒 Der Login-Button funktioniert mehrere Tage lang — du kannst diese Mail also in Ruhe später öffnen. Nur für dich; falls du das nicht warst, ignorier sie einfach.",
    questionsPrefix: "Fragen? Schreib uns an",
    regards: "Liebe Grüße, dein Pfoten-Plan Team 🐾",
    tagline: "Pfoten-Plan · Hundetraining das funktioniert",
    htmlLang: "de",
  },
  pl: {
    brand: "ŁapaPlan",
    subject: {
      signup: "Witaj w ŁapaPlan – Twój panel członkowski czeka",
      recovery: "Odzyskaj dostęp do ŁapaPlan",
      email_change: "Potwierdź swój nowy adres e-mail w ŁapaPlan",
      magiclink: "Twój link do logowania w ŁapaPlan",
    },
    heading: {
      signup: (n: string) => `Witaj w ŁapaPlan${n ? ", " + n : ""}!`,
      recovery: (n: string) => `Dostęp odświeżony${n ? ", " + n : ""}`,
      email_change: (n: string) => `Już prawie${n ? ", " + n : ""}`,
      magiclink: (n: string) => `Oto Twój login${n ? ", " + n : ""}`,
    },
    subtitle: {
      signup: "Cieszymy się, że jesteś! Kliknij przycisk poniżej — trafisz prosto do swojego panelu członkowskiego.",
      recovery: "Bez stresu — jedno kliknięcie i znów jesteś w środku. Twój dostęp został odświeżony.",
      email_change: "Potwierdź swój nowy adres e-mail, żebyśmy mogli przełączyć Twój dostęp.",
      magiclink: "Jedno kliknięcie i jesteś w swoim panelu. Bez hasła, bez wpisywania.",
    },
    cta: "Zaloguj się →",
    orCode: "— albo wpisz kod —",
    codeHintLabel: "pfoten-plan.de/mitglieder/login",
    codeHintPrefix: "Wpisz na",
    codeHintSuffix: "",
    stepsTitle: "To takie proste",
    steps: [
      "Kliknij przycisk powyżej",
      "Trafiasz prosto do swojego panelu członkowskiego",
      "Gotowe — bez hasła, bez wpisywania",
    ],
    security:
      "🔒 Przycisk logowania działa przez kilka dni — możesz spokojnie otworzyć tego maila później. Tylko dla Ciebie; jeśli to nie Ty, po prostu zignoruj tę wiadomość.",
    questionsPrefix: "Masz pytania? Napisz do nas na",
    regards: "Pozdrawiamy serdecznie, zespół ŁapaPlan 🐾",
    tagline: "ŁapaPlan · Trening psa, który działa",
    htmlLang: "pl",
  },
} as const;

function buildSubject(p: SupabaseEmailHookPayload, lang: Lang): string {
  return T[lang].subject[actionKey(p)];
}

function buildHeading(p: SupabaseEmailHookPayload, firstName: string, lang: Lang): string {
  return T[lang].heading[actionKey(p)](firstName);
}

function buildSubtitle(p: SupabaseEmailHookPayload, lang: Lang): string {
  return T[lang].subtitle[actionKey(p)];
}

function extractFirstName(email: string): string {
  const local = email.split("@")[0] || "";
  const candidate = local.split(/[+._-]/)[0];
  if (!candidate || candidate.length < 3 || /\d/.test(candidate)) return "";
  return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
}

function buildHtml(p: SupabaseEmailHookPayload, link: string, code: string, lang: Lang): string {
  const t = T[lang];
  const firstName = extractFirstName(p.user.email);
  const heading = buildHeading(p, firstName, lang);
  const subtitle = buildSubtitle(p, lang);
  // Code fuer bessere Lesbarkeit gruppieren: 482591 → 482 591
  const codePretty = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

  return `<!DOCTYPE html>
<html lang="${t.htmlLang}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">

<div style="max-width:520px;margin:0 auto;padding:32px 20px;">

  <!-- Logo + Brand -->
  <div style="text-align:center;margin-bottom:28px;">
    <img src="https://www.pfoten-plan.de/logo.png" alt="${t.brand}" width="56" height="56" style="display:inline-block;border-radius:14px;border:2px solid #C4A576;">
    <div style="font-size:13px;font-weight:700;color:#8B7355;letter-spacing:1.5px;text-transform:uppercase;margin-top:10px;">${t.brand}</div>
  </div>

  <!-- Card -->
  <div style="background:#ffffff;border:1px solid #EADDC5;border-radius:16px;padding:28px 24px;box-shadow:0 2px 12px rgba(139,115,85,0.06);">

    <h1 style="font-size:22px;font-weight:800;line-height:1.25;margin:0 0 10px;color:#1a1a1a;">${heading}</h1>
    <p style="font-size:15px;color:#4B5563;margin:0 0 24px;line-height:1.55;">${subtitle}</p>

    <!-- Big CTA Button -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px;width:100%;">
      <tr><td align="center">
        <a href="${link}" target="_blank" style="display:inline-block;background:#C4A576;color:#ffffff;text-decoration:none;padding:16px 36px;border-radius:12px;font-size:15px;font-weight:700;box-shadow:0 2px 4px rgba(139,115,85,0.25);">
          ${t.cta}
        </a>
      </td></tr>
    </table>

    <!-- 6-stelliger Code als Alternative -->
    <div style="text-align:center;margin:18px 0 6px;">
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 8px;">${t.orCode}</p>
      <div style="display:inline-block;background:#FFF9F0;border:2px dashed #C4A576;border-radius:10px;padding:14px 24px;font-family:'SF Mono','Monaco','Courier New',monospace;font-size:28px;font-weight:800;color:#1a1a1a;letter-spacing:6px;">
        ${codePretty}
      </div>
      <p style="font-size:11px;color:#9CA3AF;margin:8px 0 0;line-height:1.4;">${t.codeHintPrefix} <a href="https://www.pfoten-plan.de/mitglieder/login" style="color:#8B7355;text-decoration:underline;">${t.codeHintLabel}</a>${t.codeHintSuffix ? " " + t.codeHintSuffix : ""}</p>
    </div>

  </div>

  <!-- So funktioniert's -->
  <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;padding:18px 20px;margin-top:20px;">
    <p style="font-size:12px;font-weight:700;color:#8B7355;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">${t.stepsTitle}</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;">
      <tr>
        <td style="font-size:13px;color:#4B5563;padding:3px 0;line-height:1.5;"><strong style="color:#C4A576;">1.</strong> ${t.steps[0]}</td>
      </tr><tr>
        <td style="font-size:13px;color:#4B5563;padding:3px 0;line-height:1.5;"><strong style="color:#C4A576;">2.</strong> ${t.steps[1]}</td>
      </tr><tr>
        <td style="font-size:13px;color:#4B5563;padding:3px 0;line-height:1.5;"><strong style="color:#C4A576;">3.</strong> ${t.steps[2]}</td>
      </tr>
    </table>
  </div>

  <!-- Hinweis Sicherheit -->
  <p style="font-size:12px;color:#9CA3AF;text-align:center;margin:18px 0 12px;line-height:1.55;">
    ${t.security}
  </p>

  <!-- Footer -->
  <div style="text-align:center;padding-top:8px;border-top:1px solid #F0EBE3;margin-top:20px;">
    <p style="font-size:13px;color:#6B7280;margin:14px 0 4px;line-height:1.5;">
      ${t.questionsPrefix} <a href="mailto:support@pfoten-plan.de" style="color:#C4A576;text-decoration:underline;">support@pfoten-plan.de</a>
    </p>
    <p style="font-size:13px;color:#6B7280;margin:0 0 14px;">
      ${t.regards}
    </p>
    <p style="font-size:10px;color:#C4B998;margin:0;">
      ${t.tagline}
    </p>
  </div>

</div>

</body></html>`;
}

function buildPlainText(p: SupabaseEmailHookPayload, link: string, code: string, lang: Lang): string {
  const firstName = extractFirstName(p.user.email);
  const codePretty = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
  if (lang === "pl") {
    const greeting = firstName ? `Cześć ${firstName},` : "Cześć,";
    return `${greeting}

jednym kliknięciem jesteś w swoim panelu członkowskim ŁapaPlan — bez hasła, bez wpisywania.

Link do logowania:
${link}

ALBO użyj tego 6-cyfrowego kodu na pfoten-plan.de/mitglieder/login:

  ${codePretty}

To takie proste:
1. Kliknij link powyżej (albo wpisz kod)
2. Trafiasz prosto do swojego panelu członkowskiego
3. Gotowe

Link do logowania działa przez kilka dni — możesz spokojnie otworzyć maila później. Kod 6-cyfrowy jest ważny krócej. Oba tylko dla Ciebie; jeśli to nie Ty, po prostu zignoruj.

Masz pytania? pomoc@lapaplan.pl

Pozdrawiamy serdecznie,
zespół ŁapaPlan`;
  }
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
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

Der Login-Link funktioniert mehrere Tage lang — du kannst die Mail in Ruhe später öffnen. Der 6-stellige Code ist kürzer gültig. Beides nur für dich; falls du das nicht warst, einfach ignorieren.

Fragen? support@pfoten-plan.de

Liebe Grüße,
dein Pfoten-Plan Team`;
}

export async function POST(req: NextRequest) {
  // ── Konfig-Check ────────────────────────────────────────────────
  if (!HOOK_SECRET) {
    console.error("[auth-hook] FEHLT: SUPABASE_AUTH_HOOK_SECRET in env");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (!BREVO_API_KEY) {
    console.error("[auth-hook] FEHLT: BREVO_API_KEY in env");
    return NextResponse.json(
      { error: "brevo_not_configured" },
      { status: 500 }
    );
  }
  // ── Signatur-Verifikation ──────────────────────────────────────
  const rawBody = await req.text();
  const headers = {
    "webhook-id": req.headers.get("webhook-id") || "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") || "",
    "webhook-signature": req.headers.get("webhook-signature") || "",
  };

  let payload: SupabaseEmailHookPayload;
  try {
    const wh = new Webhook(
      HOOK_SECRET.startsWith("v1,whsec_")
        ? HOOK_SECRET.replace("v1,whsec_", "")
        : HOOK_SECRET
    );
    payload = wh.verify(rawBody, headers) as SupabaseEmailHookPayload;
  } catch (e: any) {
    console.error(
      "[auth-hook] Signatur-Verifikation FEHLGESCHLAGEN:",
      e?.message,
      "headers:",
      Object.keys(headers).filter((k) => headers[k as keyof typeof headers])
    );
    return NextResponse.json(
      {
        error: "invalid_signature",
        hint: "Pruefe SUPABASE_AUTH_HOOK_SECRET — muss exakt mit dem Secret im Supabase-Dashboard uebereinstimmen (mit oder ohne 'v1,whsec_' Praefix)",
      },
      { status: 401 }
    );
  }

  if (!payload?.user?.email || !payload?.email_data?.token_hash) {
    console.error("[auth-hook] payload ungueltig:", JSON.stringify(payload));
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  // ── Mail bauen + senden ────────────────────────────────────────
  let link: string;
  try {
    link = buildLoginUrl(payload);
  } catch (e: any) {
    console.error("[auth-hook] URL-Build fehlgeschlagen:", e?.message);
    return NextResponse.json(
      { error: "url_build_failed", message: e?.message },
      { status: 500 }
    );
  }

  // Sprache am Lead (answers.lang) → polnische Login-Mail (ŁapaPlan). Default de.
  const lang = await langForEmail(payload.user.email);
  const subject = buildSubject(payload, lang);
  // payload.email_data.token ist der 6-stellige OTP-Code,
  // token_hash ist der laengere Hash fuer den Magic-Link.
  const code = payload.email_data.token || "";

  // Haupt-CTA: bei LOGIN-Aktionen den durable One-Tap-Link nutzen (tagelang
  // gueltig, wiederverwendbar, scanner-sicher) statt des fragilen Einmal-Magic-
  // Links. Genau das behebt "Code/Link schon abgelaufen als ich zurueckkam".
  // Bei E-Mail-Aenderung braucht es den echten Bestaetigungs-Token → Original-Link.
  const action = payload.email_data.email_action_type;
  const isLoginAction =
    action === "magiclink" || action === "signup" || action === "recovery";
  let ctaUrl = link;
  if (isLoginAction) {
    try {
      ctaUrl = buildOneTapUrl(PFOTEN_SITE_URL, payload.user.email, {
        next: "/mitglieder",
      });
    } catch (e: any) {
      console.error(
        "[auth-hook] One-Tap-URL-Build fehlgeschlagen, nutze Magic-Link:",
        e?.message
      );
    }
  }

  const html = buildHtml(payload, ctaUrl, code, lang);
  const text = buildPlainText(payload, ctaUrl, code, lang);

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender:
          lang === "pl"
            ? { name: "ŁapaPlan", email: "pomoc@lapaplan.pl" }
            : { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
        replyTo:
          lang === "pl"
            ? { email: "pomoc@lapaplan.pl", name: "ŁapaPlan" }
            : { email: "support@pfoten-plan.de", name: "Pfoten-Plan Support" },
        to: [{ email: payload.user.email }],
        subject,
        htmlContent: html,
        textContent: text,
        headers: {
          "X-Pfoten-Plan-Auth-Type": payload.email_data.email_action_type,
          "List-Unsubscribe": `<mailto:unsubscribe@pfoten-plan.de?subject=Unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(
        `[auth-hook] Brevo failed: ${res.status} ${errText} (an ${payload.user.email})`
      );
      return NextResponse.json(
        { error: "brevo_send_failed", status: res.status, detail: errText },
        { status: 502 }
      );
    }
    console.log(
      `[auth-hook] ${payload.email_data.email_action_type} mail OK an ${payload.user.email}`
    );
    return NextResponse.json({});
  } catch (e: any) {
    console.error("[auth-hook] Brevo Exception:", e);
    return NextResponse.json(
      { error: "brevo_exception", message: e?.message },
      { status: 500 }
    );
  }
}
