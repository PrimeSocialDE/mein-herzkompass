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
      orderBump,
      bumpType,
      bumpDays,
      exitDiscount,
      cancelPath,
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

    // Order-Bump Konfiguration (dynamisch je nach bumpType)
    const ORDER_BUMP_PRICE_CENTS = 999; // €9,99
    const bumpApplied = orderBump === true || orderBump === 'true';
    const effectiveBumpType = (bumpType || 'tagebuch').toLowerCase();
    // Tagebuch-Dauer passend zum Plan (Fallback je nach Plan)
    const planDaysMap: Record<string, number> = { '1month': 30, '3month': 90, '6month': 180 };
    const effectiveBumpDays = Number(bumpDays) > 0 ? Number(bumpDays) : (planDaysMap[plan] || 90);
    const BUMP_DETAILS: Record<string, { name: string; desc: string; id: string }> = {
      tagebuch: {
        id: 'tagebuch',
        name: `${effectiveBumpDays}-Tage Trainings-Tagebuch`,
        desc: `Fortschritts-Tagebuch für volle ${effectiveBumpDays} Tage zum Ausdrucken · Wöchentliche Reflexions-Fragen`
      },
      notfallkarten: {
        id: 'notfallkarten',
        name: 'Notfall-Karten',
        desc: '10 Notfall-Karten zum Ausdrucken — Sofort-Hilfe bei Aggression, Panik, Verletzung'
      }
    };
    const bumpDetails = BUMP_DETAILS[effectiveBumpType] || BUMP_DETAILS.tagebuch;
    const bumpModuleName = bumpDetails.name;
    const bumpDescription = bumpDetails.desc;
    const bumpMetadataId = bumpDetails.id;

    // Exit-Popup Rabatt (15% auf Plan-Preis)
    const exitDiscountApplied = exitDiscount === true || exitDiscount === 'true';

    // DataFast Cookies
    const datafastVisitorId = req.cookies.get('datafast_visitor_id')?.value || '';
    const datafastSessionId = req.cookies.get('datafast_session_id')?.value || '';

    // Preis ermitteln
    const priceData = PRICES[plan as keyof typeof PRICES] || PRICES['1month'];
    const baseAmount = timerExpired ? priceData.normal : priceData.discount;
    // 15% Exit-Discount auf BEIDES anwenden (Plan + Bump), falls aktiv
    const amount = exitDiscountApplied
      ? Math.round(baseAmount * 0.85)  // -15%
      : baseAmount;
    const effectiveBumpCents = exitDiscountApplied
      ? Math.round(ORDER_BUMP_PRICE_CENTS * 0.85)
      : ORDER_BUMP_PRICE_CENTS;

    // Plan-Namen
    const planNames: Record<string, string> = {
      '1month': '1-Monats-Plan',
      '3month': '3-Monats-Plan',
      '6month': '6-Monats-Plan'
    };
    const planName = planNames[plan] || '1-Monats-Plan';

    // Origin für Redirect-URLs — IMMER Apex-Domain, weil SSL-Cert nur pfoten-plan.de abdeckt
    // (www.pfoten-plan.de würde "Diese Verbindung ist nicht privat" auslösen)
    const rawOrigin = req.headers.get('origin') || 'https://pfoten-plan.de';
    const origin = rawOrigin.includes('pfoten-plan.de')
      ? 'https://pfoten-plan.de'
      : rawOrigin;

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
                '✓ Kein Abo – lebenslanger Zugang',
              ].join(' · '),
            },
          },
          quantity: 1,
        },
        // Order-Bump als zweites line_item wenn angehakt (mit ggf. 15% Exit-Discount)
        ...(bumpApplied ? [{
          price_data: {
            currency: 'eur',
            unit_amount: effectiveBumpCents,
            product_data: {
              name: bumpModuleName,
              description: bumpDescription,
            },
          },
          quantity: 1,
        }] : []),
      ] as any,
      metadata: {
        lead_id: leadId || '',
        plan: plan,
        dog_name: dogName || '',
        timer_expired: timerExpired ? 'true' : 'false',
        email: email || '',
        order_bump: bumpApplied ? bumpMetadataId : '',
        order_bump_amount_cents: bumpApplied ? String(effectiveBumpCents) : '0',
        bump_days: bumpApplied && effectiveBumpType === 'tagebuch' ? String(effectiveBumpDays) : '',
        exit_discount_15: exitDiscountApplied ? 'true' : 'false',
        base_amount_cents: String(baseAmount),
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
      // Metadata auch auf PaymentIntent propagieren (für Webhook)
      payment_intent_data: {
        metadata: {
          lead_id: leadId || '',
          plan: plan,
          dog_name: dogName || '',
          email: email || '',
          order_bump: bumpApplied ? bumpMetadataId : '',
          order_bump_amount_cents: bumpApplied ? String(effectiveBumpCents) : '0',
          bump_days: bumpApplied && effectiveBumpType === 'tagebuch' ? String(effectiveBumpDays) : '',
        },
      },
      success_url: `${origin}/zusatz.html?lead_id=${leadId || ''}&redirect_status=succeeded`,
      // Cancel führt zurück auf die Seite, von der der User kam (Default: deinplan3)
      cancel_url: (() => {
        const safePath = typeof cancelPath === 'string' && cancelPath.startsWith('/') && !cancelPath.includes('://')
          ? cancelPath
          : '/deinplan3.html';
        const joiner = safePath.includes('?') ? '&' : '?';
        return `${origin}${safePath}${joiner}redirect_status=canceled`;
      })(),
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
