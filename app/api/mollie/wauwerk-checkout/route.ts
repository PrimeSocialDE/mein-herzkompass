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
      referredByCode,
      // ── Hybrid-Checkout-Parameter (deinplan3) ──────────────────────────
      // method: 'creditcard' (mit cardToken) | 'paypal' | 'klarna' | 'banktransfer' | undefined
      method,
      // cardToken: kommt aus Mollie Components nach mollie.createToken()
      cardToken,
      // billingAddress: Pflicht bei Klarna { givenName, familyName, streetAndNumber, postalCode, city, country }
      billingAddress,
      // Dashboard-Checkout: optionaler success-Pfad. Wenn gesetzt landet
      // der User nach Mollie-Erfolg dort statt auf der default /zusatz.html
      // Marketing-Page (Neukunden-Upsell).
      successPath,
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
      (bumpApplied ? ` + ${bumpDetails.name}` : "") +
      ` · kommt sofort per E-Mail`;

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

    // Optionaler Success-Pfad (z.B. Dashboard-Checkout schickt /mitglieder?bought=1).
    // Wenn nicht gesetzt: Return-Route faellt auf default /zusatz.html zurueck.
    const safeSuccessPath =
      typeof successPath === "string" &&
      successPath.startsWith("/") &&
      !successPath.includes("://")
        ? successPath
        : null;

    const returnUrl =
      `${origin}/api/mollie/return` +
      `?lead_id=${encodeURIComponent(leadId || "")}` +
      `&cancel=${encodeURIComponent(cancelUrl)}` +
      (safeSuccessPath
        ? `&success=${encodeURIComponent(safeSuccessPath)}`
        : "");

    // Payment-Parameter zusammenbauen — method-, cardToken- und billingAddress-
    // Felder nur setzen wenn vom Frontend mitgegeben (rückwärtskompatibel).
    const paymentParams: any = {
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
        referred_by_code: referredByCode || "",
      },
    };

    // Hybrid: spezifische Methode + ggf. cardToken.
    // Wenn KEIN method angegeben: Feld weglassen — Mollie zeigt dann
    // automatisch alle im Konto aktivierten Methoden auf der Hosted-Page.
    // (Vorher hatten wir hier eine explizite Method-Liste mit
    // klarnasliceit/klarnapaylater die Mollie mit 422 abgelehnt hat
    // weil nicht alle aktiviert waren.)
    if (method) {
      paymentParams.method = method;
      if (method === "creditcard" && cardToken) {
        paymentParams.cardToken = cardToken;
      }
    }
    // Klarna braucht zwingend eine billingAddress
    if (billingAddress && typeof billingAddress === "object") {
      paymentParams.billingAddress = {
        givenName: String(billingAddress.givenName || "").slice(0, 100),
        familyName: String(billingAddress.familyName || "").slice(0, 100),
        streetAndNumber: String(billingAddress.streetAndNumber || "").slice(0, 200),
        postalCode: String(billingAddress.postalCode || "").slice(0, 16),
        city: String(billingAddress.city || "").slice(0, 100),
        country: String(billingAddress.country || "DE").slice(0, 2),
        email: email || billingAddress.email || "",
      };
    }

    const payment = await mollie.payments.create(paymentParams);

    // Lead in Supabase updaten — additive Spalten, Stripe-Spalten unangetastet.
    // WICHTIG: selected_plan IMMER auf den frisch gewaehlten Plan setzen.
    // Bei Member-Bereich-Upgrades (z.B. 3M-Kunde kauft 6M) wuerde der alte
    // Wert sonst stehen bleiben → Plan-Generator triggert die falsche Laenge.
    if (leadId) {
      const updateData: any = {
        mollie_payment_id: payment.id,
        payment_provider: "mollie",
        status: "checkout_started",
        selected_plan: plan,
      };
      if (referredByCode) updateData.referred_by_code = referredByCode;
      await supabase.from("wauwerk_leads").update(updateData).eq("id", leadId);
    }

    // Card-Payment-Sonderfall: Wenn paid sofort (kein 3DS), kommt KEIN
    // Checkout-Link — wir leiten Frontend direkt zur Success-URL.
    const status = payment.status;
    let url = payment.getCheckoutUrl();

    if (!url && (status === "paid" || status === "authorized")) {
      // Direkt zur unserer Return-Route → die prüft Status und leitet zu zusatz.html
      url = returnUrl;
    }

    if (!url) {
      console.error("Mollie hat keine URL geliefert", payment);
      return NextResponse.json(
        { error: "Mollie URL fehlt" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url,
      sessionId: payment.id,
      paymentId: payment.id,
      status,
    });
  } catch (error: any) {
    console.error("Mollie Checkout Error:", error);
    return NextResponse.json(
      { error: error?.message || "Checkout fehlgeschlagen" },
      { status: 500 }
    );
  }
}
