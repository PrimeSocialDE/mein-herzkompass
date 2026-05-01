// Mollie-Variante von /api/upsell-checkout
// Behandelt: Module (anxiety, pulling, ...), Bundles (modul+modul), Premium, Notfall-Karten
// Returnt { url, paymentId } statt { clientSecret } weil Mollie Hosted Checkout (Redirect) nutzt.

import { NextRequest, NextResponse } from "next/server";
import { getMollie, formatAmountEUR } from "@/lib/mollie";

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
    const module = body.module as string | undefined;
    const leadId = body.leadId as string | undefined;
    const email = body.email as string | undefined;
    const dogName = body.dogName as string | undefined;
    const bundle = body.bundle as boolean | undefined;
    const price = body.price as number | undefined;
    const returnUrl = body.returnUrl as string | undefined;

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

    const origin =
      req.headers.get("origin") &&
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
        : `${origin}/zusatz.html?lead_id=${leadId || ""}`;

    const description = `Pfoten-Plan ${moduleName} für ${dogName || "Hund"}`;

    const payment = await mollie.payments.create({
      amount: { currency: "EUR", value: formatAmountEUR(amountCents) },
      description: description.slice(0, 255),
      // Mollie redirected nach Erfolg/Fail/Cancel hier hin — Frontend prüft selbst
      // ob Mollie-Status paid (oder wir nutzen den /api/mollie/return wenn lead_id vorhanden)
      redirectUrl: safeReturnUrl,
      webhookUrl: `${webhookBase}/api/mollie/webhook`,
      locale: "de_DE",
      metadata: {
        type: isPremium ? "premium" : "upsell",
        module: module,
        module_name: moduleName,
        lead_id: leadId || "",
        dog_name: dogName || "",
        email: email,
        is_bundle: isBundle ? "true" : "false",
        is_premium: isPremium ? "true" : "false",
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
