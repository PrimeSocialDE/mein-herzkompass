import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Preise in Cent (DE / EUR)
const PRICES = {
  '1month': { discount: 2999, normal: 4999 },
  '3month': { discount: 3999, normal: 7999 },
  '6month': { discount: 5999, normal: 11999 }
};
// Preise in Grosze (PLN-Cent) fuer den polnischen Markt (lang="pl")
// 109/199 · 149/259 · 229/389 zl
const PRICES_PL = {
  '1month': { discount: 10900, normal: 19900 },
  '3month': { discount: 14900, normal: 25900 },
  '6month': { discount: 22900, normal: 38900 }
};

export async function POST(req: NextRequest) {
  if (process.env.STRIPE_DISABLED === "true") {
    return NextResponse.json({ error: "Stripe deaktiviert" }, { status: 503 });
  }
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
      orderBump,     // NEU: Order-Bump Flag (Antizieh-Modul +€12)
      lang           // "de" (Default) | "pl"
    } = body;

    // Markt/Sprache: Default "de" (EUR). "pl" -> PLN; Stripe zeigt via
    // automatic_payment_methods automatisch BLIK/Przelewy24 fuer PLN.
    const isPL = lang === "pl";
    const currency = isPL ? "pln" : "eur";

    // DataFast Cookies aus Request lesen
    const datafastVisitorId = req.cookies.get('datafast_visitor_id')?.value || '';
    const datafastSessionId = req.cookies.get('datafast_session_id')?.value || '';

    // Preis ermitteln (markt-abhaengig)
    const priceTable = isPL ? PRICES_PL : PRICES;
    const priceData = priceTable[plan as keyof typeof priceTable] || priceTable['1month'];
    let amount = timerExpired ? priceData.normal : priceData.discount;

    // Order-Bump: Problem-Intensiv-Modul (DE +€19 / PL +89 zl)
    const ORDER_BUMP_PRICE_CENTS = isPL ? 8900 : 1900;
    // Dog-Problem aus body lesen (für dynamisches Bump-Modul)
    const bumpProblem = body.bumpProblem || 'default';
    const ORDER_BUMP_ID = `intensiv_${bumpProblem}`;
    let orderBumpApplied = false;
    if (orderBump === true || orderBump === 'true') {
      amount += ORDER_BUMP_PRICE_CENTS;
      orderBumpApplied = true;
    }

    // Plan-Namen + Beschreibung markt-abhaengig
    const planNames: Record<string, string> = isPL
      ? { '1month': 'Plan 1-miesięczny', '3month': 'Plan 3-miesięczny', '6month': 'Plan 6-miesięczny' }
      : { '1month': '1-Monats-Plan', '3month': '3-Monats-Plan', '6month': '6-Monats-Plan' };
    const planName = planNames[plan] || planNames['1month'];
    const brand = isPL ? 'ŁapaPlan' : 'Pfoten-Plan';
    const forWord = isPL ? 'dla' : 'für';
    const dog = dogName || (isPL ? 'psa' : 'Hund');
    const bumpWord = isPL ? 'Moduł intensywny' : 'Intensiv-Modul';
    const description = orderBumpApplied
      ? `${brand} ${planName} + ${bumpWord} ${forWord} ${dog}`
      : `${brand} ${planName} ${forWord} ${dog}`;

    // PaymentIntent erstellen
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        lead_id: leadId || '',
        lang: isPL ? 'pl' : 'de',
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