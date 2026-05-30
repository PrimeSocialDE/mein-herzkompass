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
      antigiftkoeder: {
        id: "antigiftkoeder",
        name: "Anti-Giftköder-Trainingsplan (12 Seiten, personalisiert)",
      },
    };
    const bumpDetails =
      BUMP_DETAILS[effectiveBumpType] || BUMP_DETAILS.tagebuch;

    const exitDiscountApplied =
      exitDiscount === true || exitDiscount === "true";

    // EMAIL-VALIDATION: ohne Email kann der Plan-Generator nichts ausliefern
    // (keine Mail, keine Personalisierung). Bei Apple Pay / Klick-Buttons ohne
    // vorherigem Quiz blieb die Email leer und der Kunde bezahlte ins Leere
    // (siehe Mollie tr_xayhX7Ma5JHovYNSWYYRJ 22.05.). Wir fordern jetzt eine
    // valide Email VOR Anlage der Mollie-Zahlung. Wenn das Frontend keine
    // mitschickt aber eine leadId, versuchen wir die DB-Email als Fallback.
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    let resolvedEmail = (typeof email === "string" ? email : "").trim().toLowerCase();
    if (!EMAIL_RE.test(resolvedEmail) && leadId) {
      try {
        const { data: leadRow } = await supabase
          .from("wauwerk_leads")
          .select("email")
          .eq("id", leadId)
          .maybeSingle();
        const fallback = (leadRow?.email || "").trim().toLowerCase();
        if (EMAIL_RE.test(fallback)) resolvedEmail = fallback;
      } catch (e: any) {
        console.warn("[wauwerk-checkout] email-fallback DB-lookup failed:", e?.message);
      }
    }
    if (!EMAIL_RE.test(resolvedEmail)) {
      return NextResponse.json(
        {
          error: "email_required",
          message:
            "Bitte gib zuerst deine E-Mail-Adresse ein, damit wir dir den Plan zustellen können.",
        },
        { status: 400 }
      );
    }

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
      "1month": "Dein 4-Wochen-Trainingsplan",
      "3month": "Dein 12-Wochen-Trainingsplan",
      "6month": "Dein 6-Monats-Trainingsplan",
    };
    const planName = planNames[plan] || "Dein 4-Wochen-Trainingsplan";

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

    // Beschreibung im Mollie-Checkout sichtbar (Hosted-Page, PayPal-Receipt,
    // Bank-Statement bei manchen Methoden). 'Pfoten-Plan' hier raus, weil der
    // Markenname schon aus dem Mollie-Profile-Trade-Name im Header steht
    // — sonst doppelt.
    const description =
      `${planName} für ${dogName || "deinen Hund"}` +
      (bumpApplied ? ` + ${bumpDetails.name}` : "") +
      ` · Einmalzahlung, kein Abo · direkt per E-Mail zum Herunterladen & Ausdrucken`;

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

    // Payment-Parameter zusammenbauen — Mollie metadata-Limit ist ~1024 bytes.
    // Vorher haben wir leere Felder + ungekuerzte FB-Tracking-IDs reingeschoben
    // → Mollie returnte "metadata storage limited" Error → User sah roten Banner
    // im Modal → bricht ab. Fix: nur non-empty Felder + Truncate auf safe-Laengen.
    // datafast_* raus (wird im Webhook nicht ausgelesen, Datafast tracked selbst).
    const t = (v: any, max: number) => String(v ?? "").slice(0, max);
    const meta: Record<string, string> = {};
    const set = (k: string, v: string) => { if (v) meta[k] = v; };

    set("lead_id", t(leadId, 36));
    set("plan", plan);
    set("dog_name", t(dogName, 60));
    set("email", t(resolvedEmail, 80));
    set("plan_amount_cents", String(planAmountCents));
    set("total_amount_cents", String(totalCents));
    if (timerExpired) set("timer_expired", "1");
    if (exitDiscountApplied) set("exit_discount_15", "1");
    if (bumpApplied) {
      set("order_bump", t(bumpDetails.id, 32));
      set("order_bump_amount_cents", String(effectiveBumpCents));
      if (effectiveBumpType === "tagebuch") set("bump_days", String(effectiveBumpDays));
    }
    set("utm_source", t(utm_source, 30));
    set("utm_medium", t(utm_medium, 30));
    set("utm_campaign", t(utm_campaign, 50));
    set("utm_content", t(utm_content, 50));
    set("fbclid", t(fbclid, 60));
    set("fbp", t(fbp, 50));
    set("fbc", t(fbc, 60));
    set("fb_event_id", t(fb_event_id, 40));
    set("ttclid", t(ttclid, 50));
    set("referred_by_code", t(referredByCode, 24));

    const paymentParams: any = {
      amount: { currency: "EUR", value: formatAmountEUR(totalCents) },
      description: description.slice(0, 255),
      redirectUrl: returnUrl,
      webhookUrl: `${webhookBase}/api/mollie/webhook`,
      locale: Locale.de_DE,
      metadata: meta,
    };

    // Hybrid: spezifische Methode + ggf. cardToken.
    if (method) {
      paymentParams.method = method;
      if (method === "creditcard" && cardToken) {
        paymentParams.cardToken = cardToken;
      }
    }

    // ── Customer + Mandate fuer One-Click-Upsells ─────────────────────
    // Beim Erstkauf erstellen wir einen Mollie-Customer + sequenceType='first'.
    // Nach paid speichert der Webhook die Mandate-ID. Bei Upsell-Klick auf
    // zusatz.html chargen wir dann ohne Redirect (sequenceType='recurring').
    //
    // Recurring funktioniert nur mit creditcard/paypal/sepadirectdebit/etc.
    // ApplePay/GooglePay/Klarna unterstuetzen kein recurring → kein Mandate
    // → User muss bei Upsell den alten Redirect-Flow nutzen (Fallback).
    const RECURRING_METHODS = new Set([
      "creditcard",
      "paypal",
      "sepadirectdebit",
      "bancontact",
      "ideal",
    ]);
    const supportsMandate = !method || RECURRING_METHODS.has(method);
    let createdCustomerId: string | null = null;
    if (supportsMandate && resolvedEmail) {
      try {
        const customer = await mollie.customers.create({
          email: resolvedEmail,
          name: (dogName || resolvedEmail.split("@")[0]).slice(0, 100),
          locale: Locale.de_DE,
          metadata: {
            lead_id: leadId || "",
            source: "wauwerk-checkout",
          },
        });
        createdCustomerId = customer.id;
        paymentParams.customerId = customer.id;
        paymentParams.sequenceType = "first";
      } catch (e: any) {
        // Customer-Erstellung darf den Checkout nie blockieren — fallback auf
        // klassischen one-off payment ohne Mandate.
        console.warn(
          "[wauwerk-checkout] Customer-Create fehlgeschlagen, fahre ohne Mandate fort:",
          e?.message
        );
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
        email: resolvedEmail || billingAddress.email || "",
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
        // Email auch in den Lead schreiben falls bisher leer (z.B. Apple-Pay
        // direkt ohne vorheriges Quiz). Damit hat die DB einen Ansprechpartner.
        email: resolvedEmail,
      };
      if (referredByCode) updateData.referred_by_code = referredByCode;
      // Customer-ID schon jetzt speichern (auch wenn Zahlung noch open ist).
      // Webhook ergaenzt spaeter die Mandate-ID + Payment-Method bei paid.
      if (createdCustomerId) updateData.mollie_customer_id = createdCustomerId;
      const { error: leadUpdErr } = await supabase
        .from("wauwerk_leads")
        .update(updateData)
        .eq("id", leadId);
      if (leadUpdErr) {
        console.error(
          `[wauwerk-checkout] Lead-Update fehlgeschlagen lead=${leadId}:`,
          leadUpdErr.message
        );
      }
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
