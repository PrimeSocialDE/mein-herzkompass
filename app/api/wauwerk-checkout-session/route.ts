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
      ttclid
    } = body;

    // DataFast Cookies
    const datafastVisitorId = req.cookies.get('datafast_visitor_id')?.value || '';
    const datafastSessionId = req.cookies.get('datafast_session_id')?.value || '';

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

    // Origin für Redirect-URLs
    const origin = req.headers.get('origin') || 'https://pfoten-plan.de';

    // Stripe Checkout Session erstellen
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card', 'paypal', 'klarna'],
      client_reference_id: leadId || undefined,
      customer_email: email || undefined,
      custom_text: {
        submit: { message: '✓ 30 Tage Geld-zurück-Garantie · Einmalzahlung – kein Abo' },
      },
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: amount,
            product_data: {
              name: `Pfoten-Plan ${planName} für ${dogName || 'deinen Hund'}`,
              description: [
                `✓ ${plan === '1month' ? '10+' : '20+'} gezielte Übungen`,
                '✓ 24/7 Trainer-Support',
                '✓ Sofort per E-Mail nach Kauf',
                '✓ 6 Bonus-Alltagstipps gratis dazu',
              ].join(' · '),
            },
          },
          quantity: 1,
        },
      ],
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
        datafast_session_id: datafastSessionId
      },
      success_url: `${origin}/zusatz.html?lead_id=${leadId || ''}&redirect_status=succeeded`,
      cancel_url: `${origin}/deinplan3.html`,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Lead in Supabase updaten
    if (leadId) {
      await supabase
        .from('wauwerk_leads')
        .update({
          stripe_session_id: session.id,
          status: 'checkout_started'
        })
        .eq('id', leadId);
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });

  } catch (error: any) {
    console.error("Checkout Session Error:", error);
    return NextResponse.json(
      { error: error.message || "Checkout Session fehlgeschlagen" },
      { status: 500 }
    );
  }
}
