import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getMollie, formatAmountEUR, Locale } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preise in Cent (identisch zu Stripe-Variante)
const PRICES = {
  "1month": { discount: 2999, normal: 4999 },
  "3month": { discount: 3999, normal: 7999 },
  "6month": { discount: 5999, normal: 11999 },
};

export async function POST(req: NextRequest) {
  const mollie = getMollie();
  if (!mollie) {
    return NextResponse.json(
      { error: "Mollie nicht konfiguriert" },
      { status: 500 }
    );
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
      ttclid,
    } = body;

    const ORDER_BUMP_PRICE_CENTS = 999;
    const bumpApplied = orderBump === true || orderBump === "true";
    const effectiveBumpType = (bumpType || "tagebuch").toLowerCase();
    const planDaysMap: Record<string, number> = {
      "1month": 30,
      "3month": 90,
      "6month": 180,
    };
    const effectiveBumpDays =
      Number(bumpDays) > 0 ? Number(bumpDays) : planDaysMap[plan] || 90;
    const BUMP_DETAILS: Record<
      string,
      { name: string; id: string }
    > = {
      tagebuch: {
        id: "tagebuch",
        name: `${effectiveBumpDays}-Tage Trainings-Tagebuch`,
      },
      notfallkarten: {
        id: "notfallkarten",
        name: "Notfall-Karten",
      },
    };
    const bumpDetails =
      BUMP_DETAILS[effectiveBumpType] || BUMP_DETAILS.tagebuch;

    const exitDiscountApplied =
      exitDiscount === true || exitDiscount === "true";

    const datafastVisitorId =
      req.cookies.get("datafast_visitor_id")?.value || "";
    const datafastSessionId =
      req.cookies.get("datafast_session_id")?.value || "";

    // Preis ermitteln (identisch zu Stripe-Logik)
    const priceData = PRICES[plan as keyof typeof PRICES] || PRICES["1month"];
    const baseAmount = timerExpired ? priceData.normal : priceData.discount;
    const planAmountCents = exitDiscountApplied
      ? Math.round(baseAmount * 0.85)
      : baseAmount;
    const effectiveBumpCents = exitDiscountApplied
      ? Math.round(ORDER_BUMP_PRICE_CENTS * 0.85)
      : ORDER_BUMP_PRICE_CENTS;
    const totalCents = planAmountCents + (bumpApplied ? effectiveBumpCents : 0);

    const planNames: Record<string, string> = {
      "1month": "1-Monats-Plan",
      "3month": "3-Monats-Plan",
      "6month": "6-Monats-Plan",
    };
    const planName = planNames[plan] || "1-Monats-Plan";

    // Origin (identische Logik wie Stripe)
    const rawOrigin = req.headers.get("origin") || "https://pfoten-plan.de";
    const origin = rawOrigin.includes("pfoten-plan.de")
      ? "https://pfoten-plan.de"
      : rawOrigin;

    // Webhook-URL: Mollie ruft sie nach Statuswechsel auf.
    // Localhost akzeptiert Mollie nicht — daher Apex nehmen wenn Origin localhost ist.
    const webhookBase =
      process.env.NEXT_PUBLIC_BASE_URL &&
      !process.env.NEXT_PUBLIC_BASE_URL.includes("localhost")
        ? process.env.NEXT_PUBLIC_BASE_URL
        : "https://pfoten-plan.de";

    const description =
      `Pfoten-Plan ${planName} für ${dogName || "deinen Hund"}` +
      (bumpApplied ? ` + ${bumpDetails.name}` : "");

    const safeCancelPath =
      typeof cancelPath === "string" &&
      cancelPath.startsWith("/") &&
      !cancelPath.includes("://")
        ? cancelPath
        : "/deinplan3.html";
    const cancelJoiner = safeCancelPath.includes("?") ? "&" : "?";

    // Mollie redirected nach Abschluss IMMER auf redirectUrl — egal ob paid/canceled/failed.
    // Wir leiten daher zuerst auf /api/mollie/return das den Status prüft und dann
    // mit dem korrekten redirect_status entweder zu zusatz.html (paid) oder zur
    // Cancel-Seite (canceled/failed) redirected — Verhalten identisch zu Stripe.
    const cancelUrl = `${origin}${safeCancelPath}${cancelJoiner}redirect_status=canceled`;
    const returnUrl =
      `${origin}/api/mollie/return` +
      `?lead_id=${encodeURIComponent(leadId || "")}` +
      `&cancel=${encodeURIComponent(cancelUrl)}`;

    const payment = await mollie.payments.create({
      amount: { currency: "EUR", value: formatAmountEUR(totalCents) },
      description: description.slice(0, 255),
      redirectUrl: returnUrl,
      webhookUrl: `${webhookBase}/api/mollie/webhook`,
      locale: Locale.de_DE,
      metadata: {
        lead_id: leadId || "",
        plan: plan,
        dog_name: dogName || "",
        timer_expired: timerExpired ? "true" : "false",
        email: email || "",
        order_bump: bumpApplied ? bumpDetails.id : "",
        order_bump_amount_cents: bumpApplied ? String(effectiveBumpCents) : "0",
        bump_days:
          bumpApplied && effectiveBumpType === "tagebuch"
            ? String(effectiveBumpDays)
            : "",
        exit_discount_15: exitDiscountApplied ? "true" : "false",
        plan_amount_cents: String(planAmountCents),
        base_amount_cents: String(baseAmount),
        total_amount_cents: String(totalCents),
        utm_source: utm_source || "",
        utm_medium: utm_medium || "",
        utm_campaign: utm_campaign || "",
        utm_content: utm_content || "",
        fbclid: fbclid || "",
        fbp: fbp || "",
        fbc: fbc || "",
        fb_event_id: fb_event_id || "",
        ttclid: ttclid || "",
        datafast_visitor_id: datafastVisitorId,
        datafast_session_id: datafastSessionId,
      },
    });

    // Lead in Supabase updaten — additive Spalten, Stripe-Spalten unangetastet
    if (leadId) {
      await supabase
        .from("wauwerk_leads")
        .update({
          mollie_payment_id: payment.id,
          payment_provider: "mollie",
          status: "checkout_started",
        })
        .eq("id", leadId);
    }

    const checkoutUrl = payment.getCheckoutUrl();
    if (!checkoutUrl) {
      console.error("Mollie hat keine Checkout-URL geliefert", payment);
      return NextResponse.json(
        { error: "Mollie Checkout-URL fehlt" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: checkoutUrl,
      sessionId: payment.id,
      paymentId: payment.id,
    });
  } catch (error: any) {
    console.error("Mollie Checkout Error:", error);
    return NextResponse.json(
      { error: error?.message || "Checkout fehlgeschlagen" },
      { status: 500 }
    );
  }
}
