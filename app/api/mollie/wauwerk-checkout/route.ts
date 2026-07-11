import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getMollie, getMolliePL, formatAmountEUR, formatAmount, Locale } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preise in Cent (identisch zu Stripe-Variante)
const PRICES = {
  "1month": { discount: 2999, normal: 4999 },
  "3month": { discount: 3999, normal: 7999 },
  "6month": { discount: 5999, normal: 11999 },
};

// PL-Preise in Groszy (PLN-Cent) — lapaplan.pl. Rabatt 109/149/229 zł,
// Normal 199/259/389 zł. Order-Bump 89 zł (siehe unten).
const PRICES_PL = {
  "1month": { discount: 7999, normal: 12999 },
  "3month": { discount: 9999, normal: 19999 },
  "6month": { discount: 13999, normal: 29999 },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // PL-Markt (lapaplan.pl): eigener Mollie-Account (PLN). Erkennung ueber
    // expliziten body.market ODER den Origin-Host. DE-Flow bleibt unveraendert.
    const isPL =
      body?.market === "pl" ||
      body?.lang === "pl" ||
      /(^|\.)lapaplan\.pl/i.test(req.headers.get("origin") || "");
    const mollie = isPL ? getMolliePL() : getMollie();
    if (!mollie) {
      return NextResponse.json(
        { error: "Mollie nicht konfiguriert" },
        { status: 500 }
      );
    }
    const CURRENCY = isPL ? "PLN" : "EUR";
    const fmtAmt = isPL ? formatAmount : formatAmountEUR;
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
      utm_term,
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
      // Quell-Seite des Kaufs (z.B. 'rueckhol') — fuer Attribution, damit
      // Rueckhol-Kaeufe von normalen deinplan-Kaeufen unterscheidbar sind.
      source_page,
      // A/B-Test-Flags aus dem localStorage — beim Kauf nachreichen, damit sie
      // zuverlaessig am Kaeufer-Lead haengen (vorher nur am email_captured-Lead).
      ab_test_trust,
      ab_variant,
      entry_page,
    } = body;

    const ORDER_BUMP_PRICE_CENTS = isPL ? 3900 : 999;
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
      sommer: {
        id: "sommer",
        name: "Sommer-Sicherheits-Plan (18 Seiten, personalisiert)",
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
    const priceTable = isPL ? PRICES_PL : PRICES;
    const priceData = priceTable[plan as keyof typeof priceTable] || priceTable["1month"];
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
    // Client-IP + User-Agent für Meta-CAPI Match-Quality. Werden am Lead
    // gespeichert und im Webhook ans Purchase-Event gehängt (dort ist die
    // Request-IP die von Mollie, nicht vom Kunden — daher hier erfassen).
    const clientIp =
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const clientUserAgent = req.headers.get("user-agent") || null;
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
        : isPL ? "/plan" : "/deinplan3.html";
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
        : "") +
      (isPL ? "&acct=pl" : "");

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
    // ── First-Touch-Attribution: maßgeblich aus dem `pp_attr`-Cookie ────────
    // Der same-origin-Checkout-Fetch sendet das Cookie automatisch mit. Es trägt
    // die beim ERSTEN Aufruf erfasste Herkunft (utm_*, fbclid, fbp). Das Cookie
    // hat Vorrang vor den Body-Werten (die via `urlParams.get(...)` Last-Touch
    // sein können). So liest der Checkout NIE aus der aktuellen URL.
    let ft: Record<string, string> = {};
    try {
      const raw = req.cookies.get("pp_attr")?.value;
      if (raw) ft = JSON.parse(decodeURIComponent(raw)) || {};
    } catch {
      ft = {};
    }
    const utmSourceF = (ft.utm_source || utm_source || "").trim();
    const utmMediumF = (ft.utm_medium || utm_medium || "").trim();
    const utmCampaignF = (ft.utm_campaign || utm_campaign || "").trim();
    const utmContentF = (ft.utm_content || utm_content || "").trim();
    const utmTermF = (ft.utm_term || utm_term || "").trim();
    const fbclidF = ft.fbclid || fbclid || "";
    const fbpF = ft.fbp || fbp || "";

    // Source-Fallback: KEIN utm_source, aber FB-Signal (fbclid ODER fbp) →
    // facebook/paid. E-Mail-Quellen (brevo/email/newsletter) NIEMALS mit
    // facebook überschreiben — sonst zählen Mail-Sales fälschlich als Ad.
    let finalSource = utmSourceF;
    let finalMedium = utmMediumF;
    const isEmailSrc =
      /brevo|email|newsletter|mail|klaviyo/i.test(utmSourceF) ||
      /email|newsletter/i.test(utmMediumF);
    if (!finalSource && !isEmailSrc && (fbclidF || fbpF)) {
      finalSource = "facebook";
      finalMedium = finalMedium || "paid";
    }

    // utm_source/medium kurz (Klassifizierung). utm_campaign/content NICHT mehr
    // auf 50 kürzen — der CRM matcht utm_content gegen den vollen Meta-
    // Anzeigennamen (z.B. "Video Trainerin (Mit drucken)"). Limit 200 = safe.
    set("utm_source", t(finalSource, 30));
    set("utm_medium", t(finalMedium, 30));
    set("utm_campaign", t(utmCampaignF, 200));
    set("utm_content", t(utmContentF, 200));
    set("utm_term", t(utmTermF, 200));
    set("fbclid", t(fbclidF || fbclid, 60));
    set("fbp", t(fbpF || fbp, 50));
    set("fbc", t(fbc, 60));
    set("fb_event_id", t(fb_event_id, 40));
    set("ttclid", t(ttclid, 50));
    set("referred_by_code", t(referredByCode, 24));
    set("source_page", t(source_page, 20));

    // ── Byte-Budget-Guard (Mollie-Limit ~1024 Bytes) ───────────────────────
    // utm_* sind join-kritisch und MÜSSEN überleben. Falls die Metadata zu groß
    // wird (sehr lange Anzeigennamen), kürzen wir NUR nice-to-have-Keys in
    // Prioritäts-Reihenfolge. fbc für CAPI kommt ohnehin aus answers.fbc, nicht
    // aus der Metadata — Droppen hier schadet der CAPI also nicht.
    const metaBytes = () => Buffer.byteLength(JSON.stringify(meta), "utf8");
    for (const k of ["ttclid", "fb_event_id", "fbc", "fbclid", "fbp"]) {
      if (metaBytes() <= 1000) break;
      if (k in meta) {
        delete meta[k];
        console.warn(`[wauwerk-checkout] metadata > 1000B → "${k}" gedroppt (utm_* bleibt)`);
      }
    }

    // Land bestimmen (DE/AT/CH) — wichtig fuer Klarna: das hartcodierte de_DE
    // zwang AT/CH-Kunden ins falsche Land ("bitte Land wechseln"). Quelle:
    // explizit uebergebene billingAddress.country (Klarna-Modal), sonst Vercel-
    // Geo-Header, sonst DE. Klarna gibt es bei Mollie fuer DE+AT (EUR), NICHT
    // fuer CH — CH-Kunden zahlen mit Karte/PayPal.
    const geoCountry = (req.headers.get("x-vercel-ip-country") || "").toUpperCase();
    const billCountry =
      billingAddress && typeof billingAddress === "object"
        ? String((billingAddress as any).country || "").toUpperCase()
        : "";
    const checkoutCountry = ["DE", "AT", "CH"].includes(billCountry)
      ? billCountry
      : ["DE", "AT", "CH"].includes(geoCountry)
        ? geoCountry
        : "DE";
    const paymentLocale =
      checkoutCountry === "AT"
        ? Locale.de_AT
        : checkoutCountry === "CH"
          ? Locale.de_CH
          : Locale.de_DE;

    const paymentParams: any = {
      amount: { currency: CURRENCY, value: fmtAmt(totalCents) },
      description: description.slice(0, 255),
      redirectUrl: returnUrl,
      // PL-Zahlungen -> Webhook nutzt den PL-Key (acct=pl).
      webhookUrl: `${webhookBase}/api/mollie/webhook${isPL ? "?acct=pl" : ""}`,
      locale: isPL ? Locale.pl_PL : paymentLocale,
      metadata: meta,
    };

    // Hybrid: spezifische Methode + ggf. cardToken.
    // PL: method IGNORIEREN -> immer Mollie-Hosted-Checkout, der genau die im
    // PL-Account aktivierten Methoden (Google Pay / Apple Pay …) anzeigt.
    if (method && !isPL) {
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
    // PL: keine Mandate/Recurring (Hosted-Checkout mit ApplePay/GooglePay,
    // kein One-Click-Upsell-Flow) — sonst wie DE.
    const supportsMandate = !isPL && (!method || RECURRING_METHODS.has(method));
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

    // Klarna (Pay later) verlangt zwingend Order-Lines mit MwSt — ohne lines
    // gibt Mollie 422 "lines required". Preise sind brutto inkl. 19% USt
    // (AGB: "inklusive der gesetzlichen Umsatzsteuer"). Summe der Zeilen = totalCents.
    if (!isPL && method === "klarna") {
      const vat19 = (grossCents: number) =>
        formatAmountEUR(Math.round((grossCents * 19) / 119));
      const lines: any[] = [
        {
          description: planName.slice(0, 255),
          quantity: 1,
          unitPrice: { currency: "EUR", value: formatAmountEUR(planAmountCents) },
          totalAmount: { currency: "EUR", value: formatAmountEUR(planAmountCents) },
          vatRate: "19.00",
          vatAmount: { currency: "EUR", value: vat19(planAmountCents) },
        },
      ];
      if (bumpApplied) {
        lines.push({
          description: ((bumpDetails as any)?.name || "Zusatzmodul").slice(0, 255),
          quantity: 1,
          unitPrice: { currency: "EUR", value: formatAmountEUR(effectiveBumpCents) },
          totalAmount: { currency: "EUR", value: formatAmountEUR(effectiveBumpCents) },
          vatRate: "19.00",
          vatAmount: { currency: "EUR", value: vat19(effectiveBumpCents) },
        });
      }
      paymentParams.lines = lines;
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
      // Quell-Seite + Client-IP/User-Agent/fbclid additiv ins answers-JSONB
      // mergen (keine DB-Migration noetig). Read-modify-write: bestehende
      // Quiz-Antworten bleiben erhalten. IP/UA/fbclid braucht der Webhook fuer
      // die Meta-CAPI Match-Quality (fbc wird dort aus fbclid abgeleitet).
      const ansMerge: Record<string, any> = {};
      if (source_page) ansMerge.source_page = source_page;
      if (clientIp) ansMerge.client_ip = clientIp;
      if (clientUserAgent) ansMerge.client_user_agent = clientUserAgent;
      if (fbclidF) ansMerge.fbclid = fbclidF;
      // A/B-Flags am Kaeufer-Lead persistieren (Mess-Attribution Step-Level-Tests)
      if (ab_test_trust) ansMerge.ab_test_trust = ab_test_trust;
      if (ab_variant) ansMerge.ab_variant = ab_variant;
      if (entry_page) ansMerge.entry_page = entry_page;

      // First-Touch-Attribution set-once am Lead persistieren. So erbt JEDER
      // Folgekauf (Upsells/One-Click) dieselbe Herkunft aus answers — auch wenn
      // das pp_attr-Cookie bis dahin weg ist (Safari ITP kappt JS-gesetzte
      // Cookies nach 7 Tagen). Erste Belegung gewinnt; spaetere Kaeufe
      // ueberschreiben die utm NICHT (First-Touch).
      const ftAttr: Record<string, string> = {};
      if (finalSource) ftAttr.utm_source = t(finalSource, 30);
      if (finalMedium) ftAttr.utm_medium = t(finalMedium, 30);
      if (utmCampaignF) ftAttr.utm_campaign = t(utmCampaignF, 200);
      if (utmContentF) ftAttr.utm_content = t(utmContentF, 200);
      if (utmTermF) ftAttr.utm_term = t(utmTermF, 200);
      if (fbpF) ftAttr.fbp = t(fbpF, 50);

      if (Object.keys(ansMerge).length > 0 || Object.keys(ftAttr).length > 0) {
        const { data: cur, error: ansErr } = await supabase
          .from("wauwerk_leads")
          .select("answers")
          .eq("id", leadId)
          .single();
        // NUR mergen wenn der Read sauber war — sonst answers NICHT anfassen,
        // damit ein fehlgeschlagener Read nie die Quiz-Antworten mit {} ueberschreibt.
        if (!ansErr && cur) {
          const existingAns = (cur.answers || {}) as Record<string, any>;
          // utm/fbp nur setzen, wenn am Lead noch nicht vorhanden → First-Touch
          const utmSetOnce: Record<string, string> = {};
          for (const [k, v] of Object.entries(ftAttr)) {
            if (v && !existingAns[k]) utmSetOnce[k] = v;
          }
          updateData.answers = { ...existingAns, ...utmSetOnce, ...ansMerge };
        }
      }
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
