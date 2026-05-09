// Supabase Auth-Webhook für E-Mail-Versand.
// Supabase ruft diesen Endpoint, wenn er sonst eine Auth-Mail (Magic-Link,
// Sign-up Confirmation, Password-Reset etc.) verschicken würde. Wir
// rendern die Mail selbst (Pfoten-Plan-Branding) und senden via Brevo REST.
//
// Setup im Supabase-Dashboard:
//   Authentication → Hooks → "Send Email Hook" → Type: HTTPS
//   URL: https://www.pfoten-plan.de/api/mitglieder/auth-hook/send-email
//   Secret: <generieren> → in .env.local + Vercel als SUPABASE_AUTH_HOOK_SECRET
//
// Die Signatur-Verifikation folgt dem Standard-Webhooks-Spec den Supabase nutzt.

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOOK_SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET || "";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const BRAND_BROWN = "#C4A576";
const BRAND_DARK = "#1a1a1a";
const BRAND_BG = "#FAF8F5";
const BRAND_ACCENT = "#FFF9F0";

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

function buildLoginUrl(p: SupabaseEmailHookPayload): string {
  // Standard Supabase verify-Endpoint, redirected dann zu unserer Callback-URL
  const base = p.email_data.site_url.replace(/\/+$/, "");
  const params = new URLSearchParams({
    token: p.email_data.token_hash,
    type: p.email_data.email_action_type === "signup" ? "signup" : "magiclink",
    redirect_to: p.email_data.redirect_to,
  });
  return `${base}/auth/v1/verify?${params.toString()}`;
}

function buildSubject(p: SupabaseEmailHookPayload): string {
  switch (p.email_data.email_action_type) {
    case "signup":
      return "Willkommen bei Pfoten-Plan – dein Mitgliederbereich wartet";
    case "recovery":
      return "Dein Zugang zu Pfoten-Plan wieder herstellen";
    case "email_change_current":
    case "email_change_new":
      return "Bestätige deine neue E-Mail bei Pfoten-Plan";
    case "magiclink":
    default:
      return "Dein persönlicher Zugang zum Pfoten-Plan Mitgliederbereich";
  }
}

function buildSubtitle(p: SupabaseEmailHookPayload): string {
  switch (p.email_data.email_action_type) {
    case "signup":
      return "Willkommen im Pfoten-Plan Team! Klick auf den Button und richte deinen Mitgliederbereich ein – dauert keine 5 Sekunden.";
    case "recovery":
      return "Kein Stress – mit einem Klick bist du wieder drin. Wir haben deinen Zugang frisch eingerichtet.";
    case "email_change_current":
    case "email_change_new":
      return "Bitte bestätige deine neue E-Mail-Adresse, damit wir deinen Zugang umstellen können.";
    case "magiclink":
    default:
      return "Mit einem Klick bist du in deinem Mitgliederbereich – kein Passwort, kein Tippen, kein Stress.";
  }
}

function buildHeading(p: SupabaseEmailHookPayload, firstName: string): string {
  switch (p.email_data.email_action_type) {
    case "signup":
      return `Willkommen bei uns${firstName ? ", " + firstName : ""}!`;
    case "recovery":
      return `Dein neuer Zugang ist da${firstName ? ", " + firstName : ""}`;
    case "magiclink":
    default:
      return `Hier ist dein Login${firstName ? ", " + firstName : ""}`;
  }
}

function extractFirstName(email: string): string {
  // Versuch: vor dem @ nehmen, "+" oder "." als Separator, ersten Teil
  // Großschreiben. Nur wenn es plausibel als Name aussieht (>2 chars, kein
  // typischer Random-String).
  const local = email.split("@")[0] || "";
  const candidate = local.split(/[+._-]/)[0];
  if (!candidate || candidate.length < 3 || /\d/.test(candidate)) return "";
  // Erster Buchstabe groß, Rest klein
  return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
}

function buildHtml(p: SupabaseEmailHookPayload, link: string): string {
  const firstName = extractFirstName(p.user.email);
  const heading = buildHeading(p, firstName);
  const subtitle = buildSubtitle(p);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
<div style="max-width:500px;margin:0 auto;padding:20px;">

  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="font-size:24px;margin:0 0 8px;color:#1a1a1a;">${heading}</h1>
    <p style="font-size:15px;color:#666;margin:0;line-height:1.55;">${subtitle}</p>
  </div>

  <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:10px;padding:14px 16px;margin-bottom:20px;text-align:center;">
    <p style="font-size:13px;color:#8B7355;font-weight:600;margin:0;">Ein Klick. Kein Passwort. Direkt drin.</p>
  </div>

  <div style="text-align:center;margin-bottom:24px;">
    <a href="${link}" style="display:inline-block;background:#C4A576;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
      Jetzt einloggen →
    </a>
  </div>

  <div style="background:#FAFAFA;border-radius:10px;padding:16px;margin-bottom:20px;">
    <p style="font-size:14px;color:#555;margin:0 0 8px;"><strong>So funktioniert's:</strong></p>
    <p style="font-size:13px;color:#666;margin:0 0 4px;">1. Klick auf den Button oben</p>
    <p style="font-size:13px;color:#666;margin:0 0 4px;">2. Du landest direkt in deinem Mitgliederbereich</p>
    <p style="font-size:13px;color:#666;margin:0;">3. Fertig – kein Passwort, keine Tipperei</p>
  </div>

  <p style="font-size:12px;color:#999;text-align:center;margin:0 0 18px;line-height:1.55;">
    Der Link gilt 1 Stunde und ist nur für dich. Falls du das nicht warst – ignorier die Mail einfach, es passiert nichts.
  </p>

  <p style="font-size:13px;color:#999;text-align:center;margin:0;">
    Fragen? Schreib uns an <a href="mailto:support@pfoten-plan.de" style="color:#C4A576;">support@pfoten-plan.de</a><br>
    Liebe Grüße, dein Pfoten-Plan Team
  </p>

</div>
</body></html>`;
}

function buildPlainText(p: SupabaseEmailHookPayload, link: string): string {
  const firstName = extractFirstName(p.user.email);
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return `${greeting}

mit einem Klick bist du in deinem Pfoten-Plan Mitgliederbereich – kein Passwort, kein Tippen, kein Stress.

Hier ist dein Login-Link:
${link}

Der Link gilt 1 Stunde und ist nur für dich. Falls du das nicht warst – einfach ignorieren.

Fragen? Schreib uns an support@pfoten-plan.de

Liebe Grüße,
dein Pfoten-Plan Team`;
}

export async function POST(req: NextRequest) {
  if (!HOOK_SECRET) {
    console.error("[auth-hook] SUPABASE_AUTH_HOOK_SECRET fehlt");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (!BREVO_API_KEY) {
    console.error("[auth-hook] BREVO_API_KEY fehlt");
    return NextResponse.json({ error: "brevo_not_configured" }, { status: 500 });
  }

  // Signatur-Verifikation (Standard-Webhooks-Spec)
  const rawBody = await req.text();
  const headers = {
    "webhook-id": req.headers.get("webhook-id") || "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") || "",
    "webhook-signature": req.headers.get("webhook-signature") || "",
  };

  let payload: SupabaseEmailHookPayload;
  try {
    // Standardwebhooks erwartet Secret im Format "v1,<base64>"; Supabase gibt
    // ihn meist roh als "v1,..." heraus. Falls User nur den raw-secret eintippt,
    // prefixen wir.
    const wh = new Webhook(
      HOOK_SECRET.startsWith("v1,") ? HOOK_SECRET : HOOK_SECRET
    );
    payload = wh.verify(rawBody, headers) as SupabaseEmailHookPayload;
  } catch (e: any) {
    console.error("[auth-hook] Signatur-Verifikation fehlgeschlagen:", e?.message);
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  if (!payload?.user?.email || !payload?.email_data?.token_hash) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const link = buildLoginUrl(payload);
  const subject = buildSubject(payload);
  const html = buildHtml(payload, link);
  const text = buildPlainText(payload, link);

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
        replyTo: { email: "support@pfoten-plan.de", name: "Pfoten-Plan Support" },
        to: [{ email: payload.user.email }],
        subject,
        htmlContent: html,
        textContent: text,
        headers: {
          "X-Pfoten-Plan-Auth-Type": payload.email_data.email_action_type,
          // Anti-Spam: List-Unsubscribe (Mailbox-Provider erwarten das selbst
          // bei transaktionalen Mails und werten es positiv für Spam-Score)
          "List-Unsubscribe": `<mailto:unsubscribe@pfoten-plan.de?subject=Unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[auth-hook] Brevo failed: ${res.status} ${errText}`);
      return NextResponse.json(
        { error: "brevo_send_failed", status: res.status },
        { status: 502 }
      );
    }
    console.log(
      `[auth-hook] ${payload.email_data.email_action_type} mail sent to ${payload.user.email}`
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
