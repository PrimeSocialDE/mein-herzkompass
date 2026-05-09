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
      return "Willkommen bei Pfoten-Plan — bestätige deine E-Mail";
    case "recovery":
      return "Dein Pfoten-Plan Passwort-Reset";
    case "email_change_current":
    case "email_change_new":
      return "Bestätige deine neue E-Mail bei Pfoten-Plan";
    case "magiclink":
    default:
      return "Dein Login-Link für Pfoten-Plan";
  }
}

function buildHtml(p: SupabaseEmailHookPayload, link: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#fff;">

  <div style="padding:26px 30px 20px;border-bottom:1px solid #F0EBE3;text-align:center;">
    <div style="font-size:18px;font-weight:800;color:${BRAND_BROWN};letter-spacing:-0.3px;">🐾 Pfoten-Plan</div>
  </div>

  <div style="padding:36px 30px 18px;">
    <h1 style="font-size:24px;font-weight:800;color:${BRAND_DARK};line-height:1.3;margin:0 0 14px;letter-spacing:-0.3px;">Dein Login-Link ist da</h1>
    <p style="font-size:15px;color:#555;line-height:1.65;margin:0 0 8px;">Hallo,</p>
    <p style="font-size:15px;color:#555;line-height:1.65;margin:0;">klick auf den Button — dann bist du in deinem Mitgliederbereich. Kein Passwort nötig, kein Quatsch.</p>
  </div>

  <div style="padding:0 30px 36px;text-align:center;">
    <a href="${link}" style="display:inline-block;background:${BRAND_BROWN};color:#fff;text-decoration:none;padding:16px 36px;border-radius:12px;font-size:15px;font-weight:700;box-shadow:0 4px 14px rgba(196,165,118,0.30);">
      Jetzt einloggen →
    </a>
    <p style="font-size:11px;color:#9CA3AF;margin:18px 0 0;line-height:1.5;">Der Link gilt 1 Stunde und nur für dich. Falls du das nicht warst — ignoriere diese Mail einfach, es passiert nichts.</p>
  </div>

  <div style="padding:0 30px 28px;">
    <div style="background:${BRAND_ACCENT};border-radius:10px;padding:14px 16px;font-size:12px;color:#8B7355;line-height:1.55;">
      Button funktioniert nicht? Kopier diesen Link in den Browser:<br>
      <span style="color:${BRAND_DARK};word-break:break-all;font-family:monospace;font-size:11px;">${link}</span>
    </div>
  </div>

  <div style="padding:18px 30px;border-top:1px solid #F0EBE3;background:#FAFAFA;text-align:center;">
    <p style="font-size:11px;color:#9CA3AF;margin:0;">Pfoten-Plan · Trainings-Begleiter für deinen Hund</p>
  </div>

</div></body></html>`;
}

function buildPlainText(p: SupabaseEmailHookPayload, link: string): string {
  return `Hallo,

dein Login-Link für Pfoten-Plan:
${link}

Klick auf den Link, dann bist du drin. Der Link gilt 1 Stunde.

Falls du das nicht warst — einfach ignorieren.

— Pfoten-Plan`;
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
        to: [{ email: payload.user.email }],
        subject,
        htmlContent: html,
        textContent: text,
        headers: {
          "X-Pfoten-Plan-Auth-Type": payload.email_data.email_action_type,
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
