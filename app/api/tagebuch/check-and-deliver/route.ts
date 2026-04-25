// app/api/tagebuch/check-and-deliver/route.ts
// Client-side-Fallback: wird von zusatz.html nach erfolgreicher Zahlung aufgerufen.
// Prüft via Stripe-API ob Tagebuch-Bump gekauft wurde und liefert direkt aus.
// Generiert PDF + verschickt via Brevo INLINE — kein interner Self-fetch
// (vorher hatte ich /api/tagebuch/generate per HTTP aufgerufen, das schlug auf
// Vercel mit "fetch failed" fehl. Jetzt direkt die Lib-Funktion + Brevo).

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { generateTagebuchPdf } from "@/lib/pdf/tagebuch";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const BREVO_API_KEY = process.env.BREVO_API_KEY;

function daysToWeeks(days: number): number {
  if (days >= 180) return 24;
  if (days >= 90) return 12;
  return 4;
}

async function sendTagebuchMail(args: {
  email: string;
  dogName: string;
  weeks: number;
  pdfBase64: string;
}): Promise<{ ok: boolean; status?: number; err?: string }> {
  const { email, dogName, weeks, pdfBase64 } = args;
  const periodLabel = weeks === 4 ? "4-Wochen" : weeks === 12 ? "3-Monats" : weeks === 24 ? "6-Monats" : `${weeks}-Wochen`;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
        to: [{ email }],
        cc: [{ email: "kontakt@primesocial.de" }],
        subject: `Dein ${periodLabel}-Trainings-Tagebuch für ${dogName}`,
        htmlContent: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;padding:20px;color:#1a1a1a;">
            <div style="text-align:center;margin-bottom:24px;">
              <h1 style="font-size:24px;margin:0 0 8px;">Dein Trainings-Tagebuch für ${dogName}!</h1>
              <p style="font-size:15px;color:#666;margin:0;">${weeks} Wochen Fortschritts-Tracking zum Ausdrucken — jeden Tag 2 Minuten, am Ende siehst du schwarz auf weiß, was sich bewegt hat.</p>
            </div>
            <div style="background:#F0FDF4;border-radius:10px;padding:14px 16px;margin-bottom:20px;text-align:center;">
              <p style="font-size:14px;color:#166534;font-weight:600;margin:0;">PDF ist als Anhang beigefügt</p>
            </div>
            <div style="background:#FAFAFA;border-radius:10px;padding:16px;margin-bottom:20px;">
              <p style="font-size:14px;color:#555;margin:0 0 8px;"><strong>So nutzt du's mit ${dogName}:</strong></p>
              <p style="font-size:13px;color:#666;margin:0 0 4px;">1. PDF ausdrucken (am besten gelocht, in einen Ordner)</p>
              <p style="font-size:13px;color:#666;margin:0 0 4px;">2. Tag 1: Baseline ausfüllen (Seite 3) — das ist dein Startpunkt</p>
              <p style="font-size:13px;color:#666;margin:0 0 4px;">3. Täglich 2 Minuten: Haken, Beobachtung, weiter</p>
              <p style="font-size:13px;color:#666;margin:0;">4. Am Ende: Vergleichs-Tabelle auf der letzten Seite — der Aha-Moment.</p>
            </div>
            <p style="font-size:13px;color:#999;text-align:center;">
              Fragen? Schreib uns an <a href="mailto:support@pfoten-plan.de" style="color:#C4A576;">support@pfoten-plan.de</a><br>
              Liebe Grüße, dein Pfoten-Plan Team
            </p>
          </div>
        `,
        attachment: [
          { name: `Trainings-Tagebuch-${dogName.replace(/\s+/g, "-")}.pdf`, content: pdfBase64 },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, err: text };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, err: e?.message || String(e) };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { leadId } = await req.json();
    if (!leadId) {
      return NextResponse.json({ error: "leadId fehlt" }, { status: 400 });
    }
    if (!stripe) {
      return NextResponse.json({ error: "Stripe nicht konfiguriert" }, { status: 500 });
    }
    if (!BREVO_API_KEY) {
      return NextResponse.json({ error: "Brevo nicht konfiguriert" }, { status: 500 });
    }

    const { data: lead } = await supabase
      .from("wauwerk_leads")
      .select("id, email, dog_name, stripe_session_id, answers")
      .eq("id", leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ status: "lead-not-found" });
    }

    const answers = (lead.answers || {}) as Record<string, any>;
    if (answers.order_bump_delivered_at) {
      return NextResponse.json({ status: "already-delivered" });
    }

    // Stripe Session abrufen
    let session: Stripe.Checkout.Session | null = null;
    if (lead.stripe_session_id) {
      try {
        session = await stripe.checkout.sessions.retrieve(lead.stripe_session_id);
      } catch (e: any) {
        console.error("Session retrieve failed:", e?.message);
      }
    }
    if (!session) {
      return NextResponse.json({ status: "no-session" });
    }
    if (session.payment_status !== "paid") {
      return NextResponse.json({ status: "not-paid", payment_status: session.payment_status });
    }
    const bumpId = session.metadata?.order_bump;
    if (bumpId !== "tagebuch") {
      return NextResponse.json({ status: "no-tagebuch-bump", bump: bumpId || null });
    }

    const bumpDays = parseInt(session.metadata?.bump_days || "30", 10) || 30;
    const weeks = daysToWeeks(bumpDays);
    const dogName = lead.dog_name || session.metadata?.dog_name || "deinen Hund";
    const email = lead.email || session.customer_email || session.metadata?.email;
    if (!email) {
      return NextResponse.json({ status: "no-email" }, { status: 400 });
    }

    // PDF inline generieren
    const pdfBytes = await generateTagebuchPdf({
      dogName,
      dogBreed: answers.dog_breed || "",
      dogAge: answers.dog_age || "",
      mainProblem: answers.custom_problem_text || answers.dog_problem || "",
      weeks,
    });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    const sendRes = await sendTagebuchMail({ email, dogName, weeks, pdfBase64 });
    if (!sendRes.ok) {
      console.error("Brevo send failed:", sendRes.status, sendRes.err);
      return NextResponse.json({ status: "send-failed", code: sendRes.status, err: sendRes.err }, { status: 500 });
    }

    // Idempotenz-Flag setzen
    await supabase
      .from("wauwerk_leads")
      .update({
        answers: {
          ...answers,
          order_bump_delivered: "tagebuch",
          order_bump_delivered_at: new Date().toISOString(),
          tagebuch_weeks: weeks,
          tagebuch_sent_at: new Date().toISOString(),
          tagebuch_delivery_source: "client-fallback",
        },
      })
      .eq("id", leadId);

    console.log(`📓 Tagebuch via client-fallback an ${email} (Lead ${leadId}, ${weeks}w)`);
    return NextResponse.json({ status: "delivered", weeks });
  } catch (err: any) {
    console.error("check-and-deliver error:", err);
    return NextResponse.json({ error: err?.message || "Interner Fehler" }, { status: 500 });
  }
}
