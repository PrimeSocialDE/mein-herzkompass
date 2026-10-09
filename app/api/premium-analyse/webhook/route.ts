// app/api/premium-analyse/webhook/route.ts
//
// DEDIZIERTER Webhook NUR fuer die Video-Analyse (54,99 EUR). Voellig isoliert
// vom zentralen /api/mollie/webhook (null Risiko fuers Main Business).
// Bei bezahlter Analyse passieren ZWEI Dinge:
//   1) der Operator wird intern benachrichtigt (Intake-Zusammenfassung)
//   2) der KUNDE bekommt die Aufforderung, Video und Sprachnachricht hochzuladen
//      (/analyse-upload.html?lead=...), inklusive der 24-Stunden-Zusage.
// Die 24 h laufen ab Eingang des Materials, nicht ab Kauf.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getMollie } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const esc = (s: any) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.pfoten-plan.de").replace(/\/+$/, "");

// Mail an den KUNDEN: Kaufbestaetigung + Aufforderung zum Hochladen.
// Ohne diese Mail passiert nach dem Kauf nichts — der Kunde weiss nicht, wie es weitergeht.
async function notifyKunde(dogName: string, email: string, leadId: string) {
  if (!BREVO_API_KEY || !email) {
    console.warn("[premium-analyse/webhook] keine Kundenmail moeglich (Key oder E-Mail fehlt)");
    return;
  }
  const link = `${SITE}/analyse-upload.html?lead=${encodeURIComponent(leadId)}&email=${encodeURIComponent(email)}`;
  const hund = esc(dogName || "deinen Hund");
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1F1B16">
      <div style="background:#FFE3B4;padding:22px 24px;border-radius:14px 14px 0 0">
        <div style="font-size:21px;font-weight:800">Deine Video-Analyse für ${hund}</div>
        <div style="font-size:14px;color:#6B5A3E;margin-top:4px">Noch ein Schritt — dann legen wir los.</div>
      </div>
      <div style="background:#FFFDF8;border:1px solid #EADDC5;border-top:none;padding:24px;border-radius:0 0 14px 14px">
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px">
          Danke dir! Damit wir ${hund} wirklich beurteilen können, brauchen wir ihn einmal <b>in Bewegung</b> —
          und dich einmal <b>erzählend</b>.
        </p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 8px"><b>Lade bitte hoch:</b></p>
        <ul style="font-size:15px;line-height:1.8;margin:0 0 18px;padding-left:20px">
          <li><b>Ein kurzes Video</b> der Situation, um die es geht. Ein Handy-Video von ein bis zwei Minuten reicht völlig.</li>
          <li><b>Eine Sprachnachricht</b>, in der du erzählst, was passiert. Einfach sprechen, als würdest du es einer Freundin erzählen — das sagt uns mehr als jedes Formular.</li>
        </ul>
        <div style="text-align:center;margin:22px 0">
          <a href="${link}" style="display:inline-block;background:#2A2118;color:#fff;text-decoration:none;
             padding:15px 30px;border-radius:12px;font-size:16px;font-weight:800">Video &amp; Sprachnachricht hochladen</a>
        </div>
        <p style="font-size:14px;line-height:1.6;color:#6B5A3E;margin:0 0 6px">
          <b>Innerhalb von 24 Stunden</b> nach Eingang bekommst du von uns eine persönliche Rückmeldung
          und einen Zusatzplan, der genau auf die gezeigte Situation zugeschnitten ist.
        </p>
        <p style="font-size:13px;line-height:1.6;color:#8A7A62;margin:14px 0 0">
          Der Link funktioniert vom Handy. Falls etwas klemmt, antworte einfach auf diese Mail.
        </p>
      </div>
    </div>`;
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Max von Pfoten-Plan", email: "hallo@pfoten-plan.de" },
        to: [{ email }],
        subject: `Noch ein Schritt: Video von ${dogName || "deinem Hund"} hochladen`,
        htmlContent: html,
      }),
    });
    if (!r.ok) console.error("[premium-analyse/webhook] Kundenmail fehlgeschlagen", r.status, await r.text());
  } catch (e: any) {
    console.error("[premium-analyse/webhook] Kundenmail Fehler:", e?.message);
  }
}

async function notifyOperator(dogName: string, email: string, leadId: string, intake: any, paymentId: string) {
  if (!BREVO_API_KEY) { console.warn("[premium-analyse/webhook] BREVO_API_KEY fehlt — keine Notification"); return; }
  const photos = intake?.photos?.length || 0;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;color:#1a1a1a">
      <h2 style="margin:0 0 6px">🎬 Video-Analyse gekauft (54,99 €)</h2>
      <p style="margin:0 0 14px;color:#666">Payment: ${esc(paymentId)}</p>
      <table style="font-size:14px;line-height:1.7;border-collapse:collapse">
        <tr><td><b>Hund</b></td><td style="padding-left:14px">${esc(dogName)}</td></tr>
        <tr><td><b>E-Mail</b></td><td style="padding-left:14px">${esc(email)}</td></tr>
        <tr><td><b>Lead-ID</b></td><td style="padding-left:14px">${esc(leadId) || "— (intake_missing)"}</td></tr>
        <tr><td><b>Rasse</b></td><td style="padding-left:14px">${esc(intake?.breed) || "?"}</td></tr>
        <tr><td><b>Alter</b></td><td style="padding-left:14px">${esc(intake?.age) || "?"}</td></tr>
        <tr><td><b>Thema</b></td><td style="padding-left:14px">${esc(intake?.problem) || "?"}</td></tr>
        <tr><td><b>Aufdreh-Tempo</b></td><td style="padding-left:14px">${esc(intake?.arousalSpeed) || "?"}</td></tr>
        <tr><td><b>Beruhigt sich</b></td><td style="padding-left:14px">${esc((intake?.calms || []).join(", ")) || "?"}</td></tr>
        <tr><td><b>Gefühl</b></td><td style="padding-left:14px">${esc(intake?.ownerFeeling) || "?"}</td></tr>
        <tr><td><b>Fotos</b></td><td style="padding-left:14px">${photos} · Video angekündigt: ${intake?.hasVideo ? "ja" : "nein"}</td></tr>
      </table>
      <p style="font-size:14px;margin:14px 0 4px"><b>Freitext-Wunsch:</b><br>${esc(intake?.understandWish) || "—"}</p>
      <p style="font-size:14px;margin:10px 0 4px"><b>Schilderung:</b></p>
      <div style="font-size:14px;background:#FFF9F0;border:1px solid #EADDC5;border-radius:10px;padding:12px;white-space:pre-wrap">${esc(intake?.transcript) || "—"}</div>
      <p style="font-size:13px;color:#666;margin-top:16px">→ Analyse generieren: <code>/api/premium-analyse/generate</code> mit dem Intake dieses Leads (in answers.premium_intake gespeichert). Rueckmeldung + Zusatzplan innerhalb von 24 h nach Eingang des Materials.</p>
    </div>`;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan System", email: "support@pfoten-plan.de" },
      to: [{ email: "kontakt@primesocial.de" }],
      subject: `🎬 Video-Analyse gekauft: ${dogName} (${email})`,
      htmlContent: html,
    }),
  });
  if (!r.ok) throw new Error("Brevo notify failed: " + r.status);
}

export async function POST(req: NextRequest) {
  const mollie = getMollie();
  if (!mollie) return NextResponse.json({ ok: false, reason: "not_configured" });

  let paymentId: string | null = null;
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) { const j = await req.json(); paymentId = j?.id || null; }
    else { paymentId = new URLSearchParams(await req.text()).get("id"); }
  } catch (e) { console.error("[premium-analyse/webhook] body parse:", e); }
  if (!paymentId) return NextResponse.json({ ok: false, reason: "no_id" });

  try {
    const payment = await mollie.payments.get(paymentId);
    const md: any = payment.metadata || {};
    if (md.type !== "premium-analyse") return NextResponse.json({ ok: true, ignored: true });
    if (payment.status !== "paid") return NextResponse.json({ ok: true, status: payment.status });

    const leadId = String(md.lead_id || "");
    const email = String(md.email || "");
    const dogName = String(md.dog_name || "dein Hund");

    let answers: any = {};
    let intake: any = null;
    if (leadId) {
      const { data } = await supabase.from("wauwerk_leads").select("answers").eq("id", leadId).maybeSingle();
      answers = data?.answers || {};
      intake = answers.premium_intake || null;
      // Idempotenz: schon benachrichtigt -> nichts tun (Mollie feuert mehrfach).
      if (intake?.notified_at) return NextResponse.json({ ok: true, already: true });
    }

    // Benachrichtigen (wirft bei Fehler -> 500 -> Mollie retried; notified_at noch null -> erneuter Versuch).
    await notifyOperator(dogName, email, leadId, intake, paymentId);
    await notifyKunde(dogName, email, leadId);

    // Erst NACH erfolgreichem Versand als benachrichtigt markieren.
    if (leadId) {
      const merged = {
        ...answers,
        premium_intake: { ...(intake || {}), status: "paid", paid_at: intake?.paid_at || new Date().toISOString(), notified_at: new Date().toISOString(), payment_id: paymentId },
      };
      await supabase.from("wauwerk_leads").update({ answers: merged }).eq("id", leadId);
    }

    return NextResponse.json({ ok: true, notified: true });
  } catch (err: any) {
    console.error("[premium-analyse/webhook] error:", err?.message || err);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
