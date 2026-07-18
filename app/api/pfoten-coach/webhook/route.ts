// app/api/pfoten-coach/webhook/route.ts
//
// DEDIZIERTER Webhook NUR fuer den 19,99-EUR-Audio-Coach. Voellig isoliert vom
// zentralen /api/mollie/webhook (null Risiko fuers Main Business).
// Manual-MVP: bei bezahltem Coach wird der Operator intern benachrichtigt —
// KEINE Auto-Generierung (kommt spaeter: Skripte aus dem Plan + Ben-Vertonung).
// Idempotent via answers.pfoten_coach.notified_at (Mollie feuert mehrfach).

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getMollie } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const esc = (s: any) =>
  String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function notifyOperator(dogName: string, email: string, leadId: string, paymentId: string) {
  if (!BREVO_API_KEY) {
    console.warn("[pfoten-coach/webhook] BREVO_API_KEY fehlt — keine Notification");
    return;
  }
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;color:#1a1a1a">
      <h2 style="margin:0 0 6px">🎧 Audio-Coach gekauft (19,99 €)</h2>
      <p style="margin:0 0 14px;color:#666">Payment: ${esc(paymentId)}</p>
      <table style="font-size:14px;line-height:1.7;border-collapse:collapse">
        <tr><td><b>Hund</b></td><td style="padding-left:14px">${esc(dogName)}</td></tr>
        <tr><td><b>E-Mail</b></td><td style="padding-left:14px">${esc(email)}</td></tr>
        <tr><td><b>Lead-ID</b></td><td style="padding-left:14px">${esc(leadId) || "— (kein Lead gefunden)"}</td></tr>
      </table>
      <p style="font-size:13px;color:#666;margin-top:16px">→ Audio-Coach für diesen Kunden generieren (Skripte aus dem Plan + Ben-Vertonung) und Coach-Seite/Zugang bereitstellen.</p>
    </div>`;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan System", email: "support@pfoten-plan.de" },
      to: [{ email: "kontakt@primesocial.de" }],
      subject: `🎧 Audio-Coach gekauft: ${dogName} (${email})`,
      htmlContent: html,
    }),
  });
  if (!r.ok) throw new Error("Brevo notify failed: " + r.status);
}

// Bestaetigungsmail an den KUNDEN. Best-effort (Fehler blockiert den Webhook nicht).
async function notifyCustomer(dogName: string, email: string) {
  if (!BREVO_API_KEY || !email) return;
  const dog = dogName && dogName !== "dein Hund" ? dogName : "deinen Hund";
  const base = process.env.NEXT_PUBLIC_BASE_URL && !process.env.NEXT_PUBLIC_BASE_URL.includes("localhost")
    ? process.env.NEXT_PUBLIC_BASE_URL : "https://pfoten-plan.de";
  const coachUrl = `${base}/mitglieder/coach`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#FBF7F0;padding:24px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr><td align="center" style="padding:6px 0 16px;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8B7355">🐾 Pfoten-Plan</td></tr>
        <tr><td style="background:#fff;border:1px solid #EADDC5;border-radius:18px;padding:28px 26px">
          <div style="font-size:30px;text-align:center">🎧</div>
          <h1 style="font-size:23px;font-weight:800;color:#1a1a1a;text-align:center;margin:8px 0 10px">Dein Audio-Coach für ${esc(dog)} ist da!</h1>
          <p style="font-size:15px;line-height:1.6;color:#42413f;margin:0 0 16px">Hallo,<br><br>vielen Dank! Dein persönlicher <b>Audio-Coach</b> begleitet dich ab jetzt Schritt für Schritt durch ${esc(dog)}s Plan — geführte Sessions, SOS-Soforthilfe und Erfolgs-Checks, direkt ins Ohr.</p>
          <p style="font-size:15px;line-height:1.6;color:#42413f;margin:0 0 22px">Wir bereiten deinen Coach gerade auf ${esc(dog)} vor. Du findest ihn in deinem Mitgliederbereich — sobald er bereit ist, kannst du dort einfach auf Play drücken.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td align="center" bgcolor="#b7945a" style="border-radius:14px;background:#b7945a">
            <a href="${coachUrl}" style="display:inline-block;padding:15px 30px;font-size:16px;font-weight:800;color:#fff;text-decoration:none;border-radius:14px">🎧 Zu meinem Coach →</a>
          </td></tr></table>
          <p style="font-size:13px;line-height:1.6;color:#8B7355;text-align:center;font-weight:600;margin:18px 0 0">14 Tage Geld-zurück-Garantie</p>
        </td></tr>
        <tr><td align="center" style="padding:16px 10px 0;font-size:12px;color:#9aa2ad;line-height:1.6">Fragen? Antworte einfach auf diese Mail oder schreib an support@pfoten-plan.de</td></tr>
      </table>
    </td></tr></table>
  </div>`;
  const coachSubject = `🎧 Dein Audio-Coach für ${dog} ist da!`;
  // Bezahlte Auslieferung (Audio-Coach): primär über Google Workspace SMTP,
  // Brevo als Fallback.
  try {
    const { googleSmtpConfigured, sendViaGoogleSmtp } = await import(
      "@/lib/google-smtp"
    );
    if (googleSmtpConfigured()) {
      await sendViaGoogleSmtp({ to: email, subject: coachSubject, html });
      return;
    }
  } catch (e: any) {
    console.error(
      "[pfoten-coach/webhook] Google-SMTP fehlgeschlagen → Fallback Brevo:",
      e?.message || e
    );
  }
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
        to: [{ email }],
        subject: coachSubject,
        htmlContent: html,
      }),
    });
    if (!r.ok) console.warn("[pfoten-coach/webhook] Kunden-Mail fehlgeschlagen:", r.status);
  } catch (e: any) {
    console.warn("[pfoten-coach/webhook] Kunden-Mail Fehler:", e?.message || e);
  }
}

export async function POST(req: NextRequest) {
  const mollie = getMollie();
  if (!mollie) return NextResponse.json({ ok: false, reason: "not_configured" });

  let paymentId: string | null = null;
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await req.json();
      paymentId = j?.id || null;
    } else {
      paymentId = new URLSearchParams(await req.text()).get("id");
    }
  } catch (e) {
    console.error("[pfoten-coach/webhook] body parse:", e);
  }
  if (!paymentId) return NextResponse.json({ ok: false, reason: "no_id" });

  try {
    const payment = await mollie.payments.get(paymentId);
    const md: any = payment.metadata || {};
    if (md.type !== "pfoten-coach") return NextResponse.json({ ok: true, ignored: true });
    if (payment.status !== "paid") return NextResponse.json({ ok: true, status: payment.status });

    const leadId = String(md.lead_id || "");
    const email = String(md.email || "");
    const dogName = String(md.dog_name || "dein Hund");

    let answers: any = {};
    let flag: any = null;
    if (leadId) {
      const { data } = await supabase.from("wauwerk_leads").select("answers").eq("id", leadId).maybeSingle();
      answers = data?.answers || {};
      flag = answers.pfoten_coach || null;
      // Idempotenz: schon benachrichtigt -> nichts tun.
      if (flag?.notified_at) return NextResponse.json({ ok: true, already: true });
    }

    // Operator benachrichtigen (wirft bei Fehler -> 500 -> Mollie retried; notified_at noch null).
    await notifyOperator(dogName, email, leadId, paymentId);
    // Kunden-Bestaetigung (best-effort, blockiert nicht).
    await notifyCustomer(dogName, email);

    // Erst NACH erfolgreichem Versand als benachrichtigt markieren.
    if (leadId) {
      const merged = {
        ...answers,
        pfoten_coach: {
          ...(flag || {}),
          status: "paid",
          paid_at: flag?.paid_at || new Date().toISOString(),
          notified_at: new Date().toISOString(),
          payment_id: paymentId,
        },
      };
      await supabase.from("wauwerk_leads").update({ answers: merged }).eq("id", leadId);
    }

    return NextResponse.json({ ok: true, notified: true });
  } catch (err: any) {
    console.error("[pfoten-coach/webhook] error:", err?.message || err);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
