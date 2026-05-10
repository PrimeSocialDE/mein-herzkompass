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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOOK_SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET || "";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

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

// WICHTIG: Verify-Endpoint liegt auf der SUPABASE-Project-URL, NICHT
// auf unserer Site-URL. site_url im Payload ist die App-URL (pfoten-plan.de),
// die brauchen wir nur fuer redirect_to. Verify selbst muss auf
// {SUPABASE_URL}/auth/v1/verify zeigen, sonst gibt's 404.
function buildLoginUrl(p: SupabaseEmailHookPayload): string {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL env var fehlt — Magic-Link kann nicht gebaut werden");
  }
  const base = SUPABASE_URL.replace(/\/+$/, "");
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
      return "Dein Login-Link für Pfoten-Plan";
  }
}

function buildHeading(p: SupabaseEmailHookPayload, firstName: string): string {
  switch (p.email_data.email_action_type) {
    case "signup":
      return `Willkommen bei Pfoten-Plan${firstName ? ", " + firstName : ""}!`;
    case "recovery":
      return `Zugang frisch eingerichtet${firstName ? ", " + firstName : ""}`;
    case "magiclink":
    default:
      return `Hier ist dein Login${firstName ? ", " + firstName : ""}`;
  }
}

function buildSubtitle(p: SupabaseEmailHookPayload): string {
  switch (p.email_data.email_action_type) {
    case "signup":
      return "Schön dass du dabei bist! Klick auf den Button unten — du landest direkt in deinem Mitgliederbereich.";
    case "recovery":
      return "Kein Stress — mit einem Klick bist du wieder drin. Dein Zugang ist frisch eingerichtet.";
    case "email_change_current":
    case "email_change_new":
      return "Bitte bestätige deine neue E-Mail-Adresse, damit wir deinen Zugang umstellen können.";
    case "magiclink":
    default:
      return "Ein Klick und du bist in deinem Mitgliederbereich. Kein Passwort, kein Tippen.";
  }
}

function extractFirstName(email: string): string {
  const local = email.split("@")[0] || "";
  const candidate = local.split(/[+._-]/)[0];
  if (!candidate || candidate.length < 3 || /\d/.test(candidate)) return "";
  return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
}

function buildHtml(p: SupabaseEmailHookPayload, link: string, code: string): string {
  const firstName = extractFirstName(p.user.email);
  const heading = buildHeading(p, firstName);
  const subtitle = buildSubtitle(p);
  // Code fuer bessere Lesbarkeit gruppieren: 482591 → 482 591
  const codePretty = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

  return `<!DOCTYPE html>
<html lang="de"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">

<div style="max-width:520px;margin:0 auto;padding:32px 20px;">

  <!-- Logo + Brand -->
  <div style="text-align:center;margin-bottom:28px;">
    <img src="https://www.pfoten-plan.de/logo.png" alt="Pfoten-Plan" width="56" height="56" style="display:inline-block;border-radius:14px;border:2px solid #C4A576;">
    <div style="font-size:13px;font-weight:700;color:#8B7355;letter-spacing:1.5px;text-transform:uppercase;margin-top:10px;">Pfoten-Plan</div>
  </div>

  <!-- Card -->
  <div style="background:#ffffff;border:1px solid #EADDC5;border-radius:16px;padding:28px 24px;box-shadow:0 2px 12px rgba(139,115,85,0.06);">

    <h1 style="font-size:22px;font-weight:800;line-height:1.25;margin:0 0 10px;color:#1a1a1a;">${heading}</h1>
    <p style="font-size:15px;color:#4B5563;margin:0 0 24px;line-height:1.55;">${subtitle}</p>

    <!-- Big CTA Button -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px;width:100%;">
      <tr><td align="center">
        <a href="${link}" target="_blank" style="display:inline-block;background:#C4A576;color:#ffffff;text-decoration:none;padding:16px 36px;border-radius:12px;font-size:15px;font-weight:700;box-shadow:0 2px 4px rgba(139,115,85,0.25);">
          Jetzt einloggen →
        </a>
      </td></tr>
    </table>

    <!-- 6-stelliger Code als Alternative -->
    <div style="text-align:center;margin:18px 0 6px;">
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 8px;">— oder Code eingeben —</p>
      <div style="display:inline-block;background:#FFF9F0;border:2px dashed #C4A576;border-radius:10px;padding:14px 24px;font-family:'SF Mono','Monaco','Courier New',monospace;font-size:28px;font-weight:800;color:#1a1a1a;letter-spacing:6px;">
        ${codePretty}
      </div>
      <p style="font-size:11px;color:#9CA3AF;margin:8px 0 0;line-height:1.4;">Auf <a href="https://www.pfoten-plan.de/mitglieder/login" style="color:#8B7355;text-decoration:underline;">pfoten-plan.de/mitglieder/login</a> eintragen</p>
    </div>

  </div>

  <!-- So funktioniert's -->
  <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;padding:18px 20px;margin-top:20px;">
    <p style="font-size:12px;font-weight:700;color:#8B7355;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">So einfach geht's</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;">
      <tr>
        <td style="font-size:13px;color:#4B5563;padding:3px 0;line-height:1.5;"><strong style="color:#C4A576;">1.</strong> Klick auf den Button oben</td>
      </tr><tr>
        <td style="font-size:13px;color:#4B5563;padding:3px 0;line-height:1.5;"><strong style="color:#C4A576;">2.</strong> Du landest direkt in deinem Mitgliederbereich</td>
      </tr><tr>
        <td style="font-size:13px;color:#4B5563;padding:3px 0;line-height:1.5;"><strong style="color:#C4A576;">3.</strong> Fertig — kein Passwort, keine Tipperei</td>
      </tr>
    </table>
  </div>

  <!-- Hinweis Sicherheit -->
  <p style="font-size:12px;color:#9CA3AF;text-align:center;margin:18px 0 12px;line-height:1.55;">
    🔒 Der Link gilt 1 Stunde und ist nur für dich. Falls du das nicht warst — ignorier die Mail einfach, es passiert nichts.
  </p>

  <!-- Footer -->
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

function buildPlainText(p: SupabaseEmailHookPayload, link: string, code: string): string {
  const firstName = extractFirstName(p.user.email);
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
  if (!SUPABASE_URL) {
    console.error(
      "[auth-hook] FEHLT: NEXT_PUBLIC_SUPABASE_URL — Magic-Link-URL nicht baubar"
    );
    return NextResponse.json(
      { error: "supabase_url_not_configured" },
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

  const subject = buildSubject(payload);
  // payload.email_data.token ist der 6-stellige OTP-Code,
  // token_hash ist der laengere Hash fuer den Magic-Link.
  const code = payload.email_data.token || "";
  const html = buildHtml(payload, link, code);
  const text = buildPlainText(payload, link, code);

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
