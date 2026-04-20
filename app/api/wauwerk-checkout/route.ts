import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Preise in Cent
const PRICES = {
  '1month': { discount: 2999, normal: 4999 },
  '3month': { discount: 3999, normal: 7999 },
  '6month': { discount: 5999, normal: 11999 }
};

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe nicht konfiguriert" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const {
      plan,
      timerExpired,
      dogName,
      leadId,
      email,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      fbclid,
      fbp,
      fbc,
      fb_event_id,
      ttclid,
      orderBump      // NEU: Order-Bump Flag (Antizieh-Modul +€12)
    } = body;

    // DataFast Cookies aus Request lesen
    const datafastVisitorId = req.cookies.get('datafast_visitor_id')?.value || '';
    const datafastSessionId = req.cookies.get('datafast_session_id')?.value || '';

    // Preis ermitteln
    const priceData = PRICES[plan as keyof typeof PRICES] || PRICES['1month'];
    let amount = timerExpired ? priceData.normal : priceData.discount;

    // Order-Bump: Problem-Intensiv-Modul +€19 (1900 cents)
    const ORDER_BUMP_PRICE_CENTS = 1900;
    // Dog-Problem aus body lesen (für dynamisches Bump-Modul)
    const bumpProblem = body.bumpProblem || 'default';
    const ORDER_BUMP_ID = `intensiv_${bumpProblem}`;
    let orderBumpApplied = false;
    if (orderBump === true || orderBump === 'true') {
      amount += ORDER_BUMP_PRICE_CENTS;
      orderBumpApplied = true;
    }

    // Plan-Namen
    const planNames: Record<string, string> = {
      '1month': '1-Monats-Plan',
      '3month': '3-Monats-Plan',
      '6month': '6-Monats-Plan'
    };
    const planName = planNames[plan] || '1-Monats-Plan';
    const description = orderBumpApplied
      ? `Pfoten-Plan ${planName} + Intensiv-Modul für ${dogName || 'Hund'}`
      : `Pfoten-Plan ${planName} für ${dogName || 'Hund'}`;

    // PaymentIntent erstellen
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        lead_id: leadId || '',
        plan: plan,
        dog_name: dogName || '',
        timer_expired: timerExpired ? 'true' : 'false',
        email: email || '',
        utm_source: utm_source || '',
        utm_medium: utm_medium || '',
        utm_campaign: utm_campaign || '',
        utm_content: utm_content || '',
        fbclid: fbclid || '',
        fbp: fbp || '',
        fbc: fbc || '',
        fb_event_id: fb_event_id || '',
        ttclid: ttclid || '',
        datafast_visitor_id: datafastVisitorId,
        datafast_session_id: datafastSessionId,
        order_bump: orderBumpApplied ? ORDER_BUMP_ID : '',
        order_bump_amount_cents: orderBumpApplied ? String(ORDER_BUMP_PRICE_CENTS) : '0'
      },
      description,
    });

    // Lead in Supabase speichern/updaten falls noch nicht vorhanden
    if (leadId) {
      await supabase
        .from('wauwerk_leads')
        .update({ 
          stripe_payment_intent: paymentIntent.id,
          status: 'checkout_started'
        })
        .eq('id', leadId);
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      planName
    });

  } catch (error: any) {
    console.error("Checkout Error:", error);
    return NextResponse.json(
      { error: error.message || "Checkout fehlgeschlagen" },
      { status: 500 }
    );
  }
}