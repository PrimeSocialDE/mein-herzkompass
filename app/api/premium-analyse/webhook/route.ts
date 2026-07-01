// app/api/premium-analyse/webhook/route.ts
//
// DEDIZIERTER Webhook NUR fuer die Premium-Analyse (79 EUR). Voellig isoliert
// vom zentralen /api/mollie/webhook (null Risiko fuers Main Business).
// Manual-MVP: bei bezahlter Premium-Analyse wird der Operator intern per E-Mail
// benachrichtigt (Intake-Zusammenfassung) — KEINE Auto-Generierung. Sobald
// validiert, kann hier der Generierungs-Call ergaenzt werden.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getMollie } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const esc = (s: any) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function notifyOperator(dogName: string, email: string, leadId: string, intake: any, paymentId: string) {
  if (!BREVO_API_KEY) { console.warn("[premium-analyse/webhook] BREVO_API_KEY fehlt — keine Notification"); return; }
  const photos = intake?.photos?.length || 0;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;color:#1a1a1a">
      <h2 style="margin:0 0 6px">💎 Premium-Analyse gekauft (79 €)</h2>
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
      <p style="font-size:13px;color:#666;margin-top:16px">→ Analyse generieren: <code>/api/premium-analyse/generate</code> mit dem Intake dieses Leads (in answers.premium_intake gespeichert). Liefert das PDF in ~48 h.</p>
    </div>`;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan System", email: "support@pfoten-plan.de" },
      to: [{ email: "kontakt@primesocial.de" }],
      subject: `💎 Premium-Analyse gekauft: ${dogName} (${email})`,
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
