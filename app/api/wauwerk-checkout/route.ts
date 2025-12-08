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
  '1month': { discount: 1799, normal: 4999 },
  '3month': { discount: 2999, normal: 7999 },
  '6month': { discount: 4999, normal: 11999 }
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
      leadId
    } = body;

    // Preis ermitteln
    const priceData = PRICES[plan as keyof typeof PRICES] || PRICES['1month'];
    const amount = timerExpired ? priceData.normal : priceData.discount;

    // Plan-Namen
    const planNames: Record<string, string> = {
      '1month': '1-Monats-Plan',
      '3month': '3-Monats-Plan', 
      '6month': '6-Monats-Plan'
    };
    const planName = planNames[plan] || '1-Monats-Plan';

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
        timer_expired: timerExpired ? 'true' : 'false'
      },
      description: `WauWerk ${planName} für ${dogName || 'Hund'}`,
    });

    // Lead in Supabase updaten falls vorhanden
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