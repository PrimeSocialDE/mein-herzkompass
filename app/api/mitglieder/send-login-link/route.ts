// Selbsthilfe-Endpoint: schickt dem Kunden auf Anforderung einen DURABLEN
// One-Tap-Login-Link per E-Mail — statt des 6-stelligen OTP-Codes, den
// E-Mail-Scanner (web.de/GMX/t-online) verbrennen.
//
// Getriggert vom "Direkt-Login-Link schicken"-Button auf /mitglieder/login,
// wenn der Code nicht ankommt. Der Link ist wiederverwendbar + tagelang
// gueltig -> ein Scanner-Prefetch schadet nicht (siehe lib/one-tap-login.ts).
//
// SICHERHEIT: Der One-Tap-Endpoint legt bei Bedarf einen Auth-User an, loggt
// also JEDE signierte E-Mail ein. Deshalb schicken wir den Link NUR an echte
// Mitglieder/zahlende Kunden. Die Antwort ist IMMER generisch { ok: true },
// damit man nicht per Endpoint herausfinden kann, welche E-Mails Kunden sind.
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { buildOneTapUrl } from "@/lib/one-tap-login";
import { sendBrevoMail } from "@/lib/member-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "de" | "pl" | "it";

function langFromHost(host: string): Lang {
  if (/(^|\.)lapaplan\.pl$/i.test(host)) return "pl";
  if (/(^|\.)zampaplan\.it$/i.test(host)) return "it";
  return "de";
}

function buildMail(lang: Lang, link: string): { subject: string; html: string } {
  const btn = (label: string) =>
    `<div style="text-align:center;margin:0 0 26px;"><a href="${link}" style="display:inline-block;background:#8B7355;color:#fff;text-decoration:none;font-size:17px;font-weight:600;padding:16px 34px;border-radius:12px;">${label}</a></div>`;
  const wrap = (inner: string) =>
    `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f6f3ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#3a3a3a;"><div style="max-width:560px;margin:0 auto;padding:32px 20px;"><div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 2px 12px rgba(0,0,0,0.05);">${inner}</div></div></body></html>`;

  if (lang === "pl") {
    return {
      subject: "Twój bezpośredni link do logowania 🐾",
      html: wrap(
        `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Cześć,</p>
         <p style="font-size:16px;line-height:1.6;margin:0 0 22px;">oto Twój <strong>bezpośredni link do logowania</strong> — bez kodu. Wystarczy kliknąć, działa też przy web.de/GMX i pozostaje ważny przez długi czas:</p>
         ${btn("Zaloguj się teraz →")}
         <p style="font-size:13px;line-height:1.6;color:#777;margin:0;">Link jest tylko dla Ciebie i możesz go używać wielokrotnie. Najlepiej zapisz stronę w zakładkach po zalogowaniu.</p>`
      ),
    };
  }
  if (lang === "it") {
    return {
      subject: "Il tuo link di accesso diretto 🐾",
      html: wrap(
        `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Ciao,</p>
         <p style="font-size:16px;line-height:1.6;margin:0 0 22px;">ecco il tuo <strong>link di accesso diretto</strong> — senza codice. Basta un clic, funziona anche con web.de/GMX e resta valido a lungo:</p>
         ${btn("Accedi ora →")}
         <p style="font-size:13px;line-height:1.6;color:#777;margin:0;">Il link è solo per te e riutilizzabile. Salva la pagina nei preferiti una volta entrato.</p>`
      ),
    };
  }
  return {
    subject: "Dein Direkt-Login-Link 🐾",
    html: wrap(
      `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hallo,</p>
       <p style="font-size:16px;line-height:1.6;margin:0 0 22px;">hier ist dein <strong>Direkt-Login-Link</strong> — ganz ohne Code. Einfach draufklicken; funktioniert auch bei web.de/GMX/t-online und bleibt lange gültig:</p>
       ${btn("Jetzt direkt einloggen →")}
       <p style="font-size:13px;line-height:1.6;color:#777;margin:0;">Der Link ist nur für dich und beliebig oft nutzbar. Speicher dir die Seite am besten als Lesezeichen, sobald du drin bist.</p>`
    ),
  };
}

export async function POST(req: NextRequest) {
  const generic = NextResponse.json({ ok: true });

  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email || "").trim().toLowerCase();
  } catch {
    return generic;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return generic;

  const host = req.headers.get("host") || "";
  const lang = langFromHost(host);
  const origin = new URL(req.url).origin;

  // Nur echte Mitglieder / zahlende Kunden. Sonst generisch zurueck (keine
  // Enumeration, kein Link).
  let isMember = false;
  try {
    const { data: mu } = await supabase
      .from("member_users")
      .select("email")
      .ilike("email", email)
      .limit(1);
    if (mu && mu.length) isMember = true;
    if (!isMember) {
      const { data: lead } = await supabase
        .from("wauwerk_leads")
        .select("id")
        .ilike("email", email)
        .eq("status", "paid")
        .limit(1);
      if (lead && lead.length) isMember = true;
    }
  } catch (e: any) {
    console.error("[send-login-link] member-check fehlgeschlagen:", e?.message);
  }
  if (!isMember) return generic;

  try {
    const link = buildOneTapUrl(origin, email, { ttlDays: 365, next: "/mitglieder" });
    const { subject, html } = buildMail(lang, link);
    await sendBrevoMail({
      to: email,
      subject,
      html,
      lang,
      transactional: true,
      tags: ["login-link", "self-service"],
    });
  } catch (e: any) {
    console.error("[send-login-link] Versand fehlgeschlagen:", e?.message);
  }

  return generic;
}
