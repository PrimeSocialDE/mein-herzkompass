import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getMollie, getMolliePL, getMollieIT, formatAmountEUR, formatAmount, Locale } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preise in Cent (identisch zu Stripe-Variante)
const PRICES = {
  "1month": { discount: 2999, normal: 4999 },
  "3month": { discount: 3999, normal: 7999 },
  "6month": { discount: 5999, normal: 11999 },
};

// PL-Preise in Groszy (PLN-Cent) — lapaplan.pl. Rabatt 89,99/119,99/169,99 zł,
// Normal 149,99/239,99/349,99 zł (auf die hoehere Stufe angehoben; A/B beendet,
// beide Varianten identisch teuer). Order-Bump 39 zł (siehe unten).
const PRICES_PL = {
  "1month": { discount: 8999, normal: 14999 },
  "3month": { discount: 11999, normal: 23999 },
  "6month": { discount: 16999, normal: 34999 },
};

// PL-Preis-A/B — Variante B (Test, ~+15-28 % ggue. A). Die Seite (pl/plan.html)
// wuerfelt die Variante, zeigt die passenden Preise UND schickt plPriceVariant.
// Sicherheit: NUR bei plPriceVariant==="B" wird hier B gebucht; bei
// fehlendem/unbekanntem Flag IMMER A (PRICES_PL) -> nie Ueberabbuchung.
const PRICES_PL_B = {
  "1month": { discount: 8999, normal: 14999 },
  "3month": { discount: 11999, normal: 23999 },
  "6month": { discount: 16999, normal: 34999 },
};

// IT-Preise (zampaplan.it) in Cent — bewusst ~15-20 % unter DE, da geringere
// Kaufkraft in Italien. Rabattpreis (Timer) / durchgestrichener Normalpreis.
const PRICES_IT = {
  "1month": { discount: 1999, normal: 3499 },
  "3month": { discount: 2999, normal: 5499 },
  "6month": { discount: 4999, normal: 8999 },
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
    // IT-Markt (zampaplan.it): eigener Mollie-Account (EUR). Erkennung analog PL.
    // Wichtig: isPL hat Vorrang; IT-Seiten senden market:"it"/lang:"it".
    const isIt =
      !isPL &&
      (body?.market === "it" ||
        body?.lang === "it" ||
        /(^|\.)zampaplan\.it/i.test(req.headers.get("origin") || ""));
    const mollie = isPL ? getMolliePL() : isIt ? getMollieIT() : getMollie();
    if (!mollie) {
      return NextResponse.json(
        { error: "Mollie nicht konfiguriert" },
        { status: 500 }
      );
    }
    // IT nutzt EUR wie DE (nur separater Account). Nur PL ist PLN.
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

    const ORDER_BUMP_PRICE_CENTS = isPL ? 3900 : isIt ? 499 : 999;
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
    // PL-Preis-A/B: Variante B nur bei explizitem Flag, sonst A (nie Ueberabbuchung).
    const plVariantB = isPL && String(body?.plPriceVariant || "") === "B";
    const priceTable = isPL
      ? (plVariantB ? PRICES_PL_B : PRICES_PL)
      : isIt ? PRICES_IT : PRICES;
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
    // PL: polnische Beschreibung für die Mollie-Zahlseite / PayPal-Beleg.
    const planNamesPl: Record<string, string> = {
      "1month": "Twój 4-tygodniowy plan treningowy",
      "3month": "Twój 12-tygodniowy plan treningowy",
      "6month": "Twój 6-miesięczny plan treningowy",
    };
    // IT: italienische Beschreibung fuer Mollie-Zahlseite / PayPal-Beleg.
    const planNamesIt: Record<string, string> = {
      "1month": "Il tuo piano di addestramento di 4 settimane",
      "3month": "Il tuo piano di addestramento di 12 settimane",
      "6month": "Il tuo piano di addestramento di 6 mesi",
    };
    const planName = isPL
      ? planNamesPl[plan] || planNamesPl["1month"]
      : isIt
      ? planNamesIt[plan] || planNamesIt["1month"]
      : planNames[plan] || planNames["1month"];

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
    // Land aus Vercels Geo-Header (x-vercel-ip-country, z.B. "DE"/"AT"/"CH").
    // Keine externe API, kein extra Request. Additiv am Lead gespeichert für
    // saubere Länder-Auswertung (DE/AT/CH-Split) + ggf. USt-Zuordnung.
    const clientCountry =
      (req.headers.get("x-vercel-ip-country") || "").toUpperCase() || null;
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
    // PL-Bump-Label (BUMP_DETAILS ist deutsch + kennt den PL-Grundkommando-Bump
    // nicht → für die PL-Beschreibung ein sauberes polnisches Label statt Fallback).
    const bumpLabelPl = "Plan komend ratunkowych";
    // IT-Bump-Labels (BUMP_DETAILS ist deutsch) fuer die italienische Beschreibung.
    const BUMP_NAMES_IT: Record<string, string> = {
      tagebuch: `Diario di addestramento di ${effectiveBumpDays} giorni`,
      notfallkarten: "Schede di emergenza",
      antigiftkoeder: "Piano anti-veleno (12 pagine, personalizzato)",
      sommer: "Piano sicurezza estate (18 pagine, personalizzato)",
    };
    const bumpLabelIt = BUMP_NAMES_IT[effectiveBumpType] || BUMP_NAMES_IT.tagebuch;
    const description = isPL
      ? `${planName} dla ${dogName || "Twojego psa"}` +
        (bumpApplied ? ` + ${bumpLabelPl}` : "") +
        ` · Płatność jednorazowa, bez abonamentu · od razu e-mailem do pobrania i wydruku`
      : isIt
      ? `${planName} per ${dogName || "il tuo cane"}` +
        (bumpApplied ? ` + ${bumpLabelIt}` : "") +
        ` · Pagamento unico, senza abbonamento · subito via e-mail da scaricare e stampare`
      : `${planName} für ${dogName || "deinen Hund"}` +
        (bumpApplied ? ` + ${bumpDetails.name}` : "") +
        ` · Einmalzahlung, kein Abo · direkt per E-Mail zum Herunterladen & Ausdrucken`;

    const safeCancelPath =
      typeof cancelPath === "string" &&
      cancelPath.startsWith("/") &&
      !cancelPath.includes("://")
        ? cancelPath
        : isPL ? "/plan" : isIt ? "/piano" : "/deinplan3.html";
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
      (isPL ? "&acct=pl" : "") +
      (isIt ? "&acct=it" : "");

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
    // DataFast Revenue-Attribution: Besucher-ID aus der first-party Cookie
    // (same-origin-Fetch sendet sie automatisch mit, wie pp_attr). Der Webhook
    // meldet damit bei "paid" den Umsatz an DataFast. Leer = kein Problem.
    set("datafast_visitor_id", t(req.cookies.get("datafast_visitor_id")?.value || "", 40));

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
      // PL/IT-Zahlungen -> Webhook nutzt den jeweiligen Key (acct=pl / acct=it).
      webhookUrl: `${webhookBase}/api/mollie/webhook${isPL ? "?acct=pl" : isIt ? "?acct=it" : ""}`,
      locale: isPL ? Locale.pl_PL : isIt ? Locale.it_IT : paymentLocale,
      metadata: meta,
    };

    // Hybrid: spezifische Methode + ggf. cardToken.
    // Die gewaehlte Methode wird an Mollie durchgereicht -> Mollie leitet direkt
    // zur jeweiligen Methode weiter (PayPal/BLIK/Przelewy24/Apple/Google) statt
    // die Methoden-Uebersicht anzuzeigen. Gilt jetzt auch fuer PL.
    if (method) {
      paymentParams.method = method;
      // Karten-Token nur fuer DE anhaengen: die PL-Karten-Components laufen noch
      // ueber das DE-Profil (pfl_...), der Token ist auf dem PL-Account nicht
      // gueltig. Fuer PL wird method=creditcard ohne Token gesetzt -> Mollie
      // hostet die Kartenseite auf dem PL-Account (direkt zur Karte, keine
      // Methoden-Uebersicht).
      // DE + IT: cardToken anhaengen (Inline-Karte). IT-Components tokenisieren
      // ueber das IT-Profil (pfl_F5VSSezLzn) -> Token gueltig auf dem IT-Account.
      // Nur PL laeuft weiter ueber die gehostete Kartenseite (kein Token).
      if (method === "creditcard" && cardToken && !isPL) {
        paymentParams.cardToken = cardToken;
      }
      // Przelewy24 verlangt bei Mollie ZWINGEND billingEmail. Fehlt es, lehnt
      // Mollie das Payment-Create mit 422 ab -> die Zahlung wird nie erstellt.
      // Das erklaert 0 durchgegangene P24-Zahlungen trotz aktivierter Methode
      // (der Nutzer sah nur "Nie udało się rozpocząć płatności"). resolvedEmail
      // ist oben validiert (EMAIL_RE), also immer eine gueltige Adresse.
      if (method === "przelewy24" && resolvedEmail) {
        paymentParams.billingEmail = resolvedEmail;
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
    // PL/IT: keine Mandate/Recurring (Hosted-Checkout mit ApplePay/GooglePay/
    // Satispay, kein One-Click-Upsell-Flow) — sonst wie DE.
    const supportsMandate = !isPL && !isIt && (!method || RECURRING_METHODS.has(method));
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
    if (!isPL && !isIt && method === "klarna") {
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
      if (clientCountry) ansMerge.country = clientCountry;
      // PL-Herkunft (lapaplan.pl / PLN-Checkout) am Lead persistieren, damit
      // Webhook + Plan-Generierung + Sequenz-Mails den polnischen Zweig waehlen.
      // Bisher wurde lang NUR im Stripe-Checkout gesetzt, nicht hier → PL-Kaeufer
      // ueber Mollie bekamen faelschlich einen deutschen Plan. DE bleibt unberuehrt
      // (wir setzen lang NUR bei isPL; ohne Flag greift ueberall der DE-Default).
      if (isPL) ansMerge.lang = "pl";
      // IT-Herkunft (zampaplan.it / EUR-Checkout) persistieren, damit Webhook
      // (isItSale → IVA 22 %, IT-Plan/Beleg) + Plan-Generierung + Sequenz-Mails
      // den italienischen Zweig waehlen. DE bleibt unberuehrt.
      if (isIt) ansMerge.lang = "it";

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
