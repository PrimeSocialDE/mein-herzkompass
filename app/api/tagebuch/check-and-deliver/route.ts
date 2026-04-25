// app/api/tagebuch/check-and-deliver/route.ts
// Client-side-Fallback: Wird von zusatz.html nach erfolgreicher Zahlung aufgerufen.
// Prüft via Stripe-API ob ein Tagebuch-Bump gekauft wurde und liefert ihn aus.
// Nötig weil der Stripe-Webhook bei vielen Käufen aktuell nicht zuverlässig durchläuft.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(req: NextRequest) {
  try {
    const { leadId } = await req.json();
    if (!leadId) {
      return NextResponse.json({ error: "leadId fehlt" }, { status: 400 });
    }
    if (!stripe) {
      return NextResponse.json({ error: "Stripe nicht konfiguriert" }, { status: 500 });
    }

    // Lead laden
    const { data: lead } = await supabase
      .from("wauwerk_leads")
      .select("id, email, dog_name, stripe_session_id, answers")
      .eq("id", leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ status: "lead-not-found" });
    }

    // Idempotenz: bereits geliefert?
    const answers = (lead.answers || {}) as Record<string, any>;
    if (answers.order_bump_delivered_at) {
      return NextResponse.json({ status: "already-delivered" });
    }

    // Session abrufen — bevorzugt via gespeicherter session_id, sonst über client_reference_id suchen
    let session: Stripe.Checkout.Session | null = null;
    if (lead.stripe_session_id) {
      try {
        session = await stripe.checkout.sessions.retrieve(lead.stripe_session_id);
      } catch (e) {
        console.error("Session retrieve failed:", e);
      }
    }
    if (!session) {
      try {
        const list = await stripe.checkout.sessions.list({
          limit: 5,
          // Stripe filter on client_reference_id direkt nicht möglich; durchsuchen
        });
        session = list.data.find((s) => s.client_reference_id === leadId) || null;
      } catch (e) {
        console.error("Session list failed:", e);
      }
    }

    if (!session) {
      return NextResponse.json({ status: "no-session" });
    }

    // Nur ausliefern wenn auch wirklich bezahlt
    if (session.payment_status !== "paid") {
      return NextResponse.json({ status: "not-paid", payment_status: session.payment_status });
    }

    const bumpId = session.metadata?.order_bump;
    if (bumpId !== "tagebuch") {
      return NextResponse.json({ status: "no-tagebuch-bump", bump: bumpId || null });
    }

    const bumpDays = parseInt(session.metadata?.bump_days || "30", 10) || 30;
    const dogName = lead.dog_name || session.metadata?.dog_name || "deinen Hund";
    const email = lead.email || session.customer_email || session.metadata?.email;

    if (!email) {
      return NextResponse.json({ status: "no-email" }, { status: 400 });
    }

    // Bestehenden Generate-Endpoint nutzen — der hat die ganze Personalisierungs-
    // und Brevo-Logik bereits drin (inkl. CC an kontakt@primesocial.de).
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://pfoten-plan.de";
    const genRes = await fetch(`${baseUrl}/api/tagebuch/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, dogName, leadId, bumpDays }),
    });

    if (!genRes.ok) {
      const errText = await genRes.text();
      console.error("Tagebuch generate failed:", genRes.status, errText);
      return NextResponse.json({ status: "generate-failed", code: genRes.status }, { status: 500 });
    }

    // Idempotenz-Flag setzen
    const weeks = bumpDays >= 180 ? 24 : bumpDays >= 90 ? 12 : 4;
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
