// Mollie-Variante von /api/upsell-checkout
// Behandelt: Module (anxiety, pulling, ...), Bundles (modul+modul), Premium, Notfall-Karten
// Returnt { url, paymentId } statt { clientSecret } weil Mollie Hosted Checkout (Redirect) nutzt.

import { NextRequest, NextResponse } from "next/server";
import { getMollie, getMolliePL, formatAmountEUR, formatAmount, Locale } from "@/lib/mollie";
import { createClient } from "@supabase/supabase-js";
import { utmMetaFromAnswers } from "@/lib/attribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const moduleNames: Record<string, string> = {
  anxiety: "Trennungsangst Prävention",
  pulling: "Leinenführigkeit Basics",
  barking: "Anti-Bell Training",
  aggression: "Aggressions-Kontrolle",
  recall: "Rückruf-Training",
  jumping: "Anti-Anspring Training",
  energy: "Energie-Management",
  destructive: "Anti-Zerstörungs Training",
  mouthing: "Anti-Aufnehm Training",
  "video-analyse": "Persönliche Video-Analyse",
  "notfall-karten": "10 Notfall-Karten",
  "anti-giftkoeder": "Anti-Giftköder-Trainingsplan",
  "coach-foto": "KI-Trainer Foto-Analyse (30 Tage)",
  "hund-verstehen": "Dein Hund verstehen — persönliches Profil",
  // Eigenständige Themen-Pläne aus den Marketing-Funnels (per E-Mail ausgeliefert)
  "bellen-plan": "Bellen-Plan", "bellen-plan-bild": "Bellen-Plan (mit Bildern)",
  "leinen-plan": "Leinen-Plan", "leinen-plan-bild": "Leinen-Plan (mit Bildern)",
  "energie-plan": "Energie-Plan", "energie-plan-bild": "Energie-Plan (mit Bildern)",
  "aggression-plan": "Aggressions-Plan",
  "rueckruf-plan": "Rückruf-Plan",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const module = body.module as string | undefined;
    const leadId = body.leadId as string | undefined;
    const email = body.email as string | undefined;
    const dogName = body.dogName as string | undefined;
    const bundle = body.bundle as boolean | undefined;
    const price = body.price as number | undefined;
    const returnUrl = body.returnUrl as string | undefined;
    const referredByCode = body.referredByCode as string | undefined;
    // DataFast-Besucher-ID aus dem First-Party-Cookie (vom datafa.st-Script auf
    // der Landingpage gesetzt) durchreichen — der Webhook meldet damit den
    // Umsatz an DataFast (sonst bleibt der Upsell-Kauf in DataFast unattribuiert).
    const datafastVisitorId = (
      req.cookies.get("datafast_visitor_id")?.value || ""
    ).slice(0, 40);
    // Sprach-/Markt-Weiche: lang="pl" -> polnisches Mollie-Konto (PLN, lapaplan).
    // DE-Pfad bleibt exakt wie bisher (getMollie/EUR).
    const isPL = body.lang === "pl";
    const mollie = isPL ? getMolliePL() : getMollie();
    if (!mollie) {
      return NextResponse.json(
        { error: "Mollie nicht konfiguriert" },
        { status: 500 }
      );
    }

    if (!module || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const isPremium = module === "premium";
    const isBundle = bundle || module.includes("+");

    let amountCents: number;
    if (price) amountCents = price;
    else if (isPremium) amountCents = 24999;
    else if (isBundle) amountCents = 2499;
    else amountCents = 1999;

    let moduleName: string;
    if (isPremium) {
      moduleName = "Pfoten-Plan Premium - Alle Module + 3 Monate Support";
    } else if (isBundle) {
      const mainModule = module.split("+")[0];
      moduleName =
        "Komplett-Paket: " +
        (moduleNames[mainModule] || mainModule) +
        " + Prävention";
    } else {
      moduleName = moduleNames[module] || "Zusatz-Modul";
    }

    const origin = isPL
      ? "https://www.lapaplan.pl"
      : req.headers.get("origin") &&
          req.headers.get("origin")!.includes("pfoten-plan.de")
        ? "https://pfoten-plan.de"
        : req.headers.get("origin") || "https://pfoten-plan.de";

    const webhookBase =
      process.env.NEXT_PUBLIC_BASE_URL &&
      !process.env.NEXT_PUBLIC_BASE_URL.includes("localhost")
        ? process.env.NEXT_PUBLIC_BASE_URL
        : "https://pfoten-plan.de";

    // returnUrl von Frontend kommen (z.B. /danke-final.html?upsell2=true)
    // Fallback: zusatz.html
    const safeReturnUrl =
      returnUrl &&
      typeof returnUrl === "string" &&
      (returnUrl.startsWith("http://") || returnUrl.startsWith("https://") || returnUrl.startsWith("/"))
        ? returnUrl.startsWith("/")
          ? `${origin}${returnUrl}`
          : returnUrl
        : `${origin}/${isPL ? "dodatek.html" : "zusatz.html"}?lead_id=${leadId || ""}`;

    // PL-Modulname + Beschreibung (nur fuer PL; DE unveraendert).
    const PL_MODULE_NAMES: Record<string, string> = {
      "notfall-karten": "10 kart ratunkowych",
      pulling: "Plan: chodzenie na luźnej smyczy",
      energy: "Plan: nadmiar energii i wyciszanie",
      anxiety: "Plan: lęk separacyjny",
      aggression: "Plan: kontrola agresji",
      mouthing: "Plan: podnoszenie rzeczy z ziemi",
      recall: "Plan: przywołanie",
      barking: "Plan: nadmierne szczekanie",
      jumping: "Plan: skakanie na ludzi",
      destructive: "Plan: niszczenie w domu",
      soiling: "Plan: nieczystość w domu",
    };
    const moduleNamePL = isBundle
      ? "Pakiet modułów treningowych"
      : PL_MODULE_NAMES[module] || moduleName;
    const description = isPL
      ? `ŁapaPlan ${moduleNamePL} dla ${dogName || "psa"} · przyjdzie natychmiast e-mailem`
      : `Pfoten-Plan ${moduleName} für ${dogName || "Hund"} · kommt sofort per E-Mail`;

    // First-Touch-Attribution aus dem Lead holen (durabel, cookie-unabhaengig),
    // damit auch dieser Folgekauf der urspruenglichen Anzeige zugeordnet wird.
    let utmMeta: Record<string, string> = {};
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      let lead: any = null;
      if (leadId) {
        const { data } = await supabase
          .from("wauwerk_leads").select("answers").eq("id", leadId).maybeSingle();
        lead = data;
      }
      if (!lead && email) {
        const { data } = await supabase
          .from("wauwerk_leads").select("answers").ilike("email", email)
          .order("paid_at", { ascending: false }).limit(1).maybeSingle();
        lead = data;
      }
      utmMeta = utmMetaFromAnswers(lead?.answers);
    } catch (e: any) {
      console.warn("[upsell-checkout] utm-lookup fehlgeschlagen:", e?.message);
    }

    const payment = await mollie.payments.create({
      amount: isPL
        ? { currency: "PLN", value: formatAmount(amountCents) }
        : { currency: "EUR", value: formatAmountEUR(amountCents) },
      description: description.slice(0, 255),
      // Mollie redirected nach Erfolg/Fail/Cancel hier hin — Frontend prüft selbst
      // ob Mollie-Status paid (oder wir nutzen den /api/mollie/return wenn lead_id vorhanden)
      redirectUrl: safeReturnUrl,
      // PL: ?acct=pl damit der Webhook die Zahlung ueber das PL-Mollie-Konto liest.
      webhookUrl: `${webhookBase}/api/mollie/webhook${isPL ? "?acct=pl" : ""}`,
      locale: isPL ? Locale.pl_PL : Locale.de_DE,
      metadata: {
        type: isPremium ? "premium" : "upsell",
        module: module,
        module_name: isPL ? moduleNamePL : moduleName,
        lead_id: leadId || "",
        dog_name: dogName || "",
        email: email,
        is_bundle: isBundle ? "true" : "false",
        is_premium: isPremium ? "true" : "false",
        referred_by_code: referredByCode || "",
        lang: isPL ? "pl" : "de",
        datafast_visitor_id: datafastVisitorId,
        ...utmMeta,
      },
    });

    const url = payment.getCheckoutUrl();
    if (!url) {
      return NextResponse.json(
        { error: "Mollie Checkout-URL fehlt" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url,
      paymentId: payment.id,
      // Backwards-compat key falls altes Frontend noch nicht angepasst:
      clientSecret: null,
    });
  } catch (err: any) {
    console.error("Mollie upsell-checkout error:", err);
    return NextResponse.json(
      { error: err?.message || "Checkout failed" },
      { status: 500 }
    );
  }
}
