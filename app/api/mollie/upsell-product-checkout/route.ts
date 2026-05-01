// Mollie-Variante von /api/upsell-product-checkout
// Behandelt: ernaehrung, zweithund, abo, reise, erstehilfe
// Returnt { url, paymentId } statt { clientSecret }.

import { NextRequest, NextResponse } from "next/server";
import { getMollie, formatAmountEUR } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCT_PRICES: Record<string, number> = {
  ernaehrung: 2499,
  zweithund: 1999,
  abo: 999,
  reise: 1999,
  erstehilfe: 1499,
};

const PRODUCT_NAMES: Record<string, string> = {
  ernaehrung: "Personalisierter Ernaehrungsplan",
  zweithund: "Zweithund-Guide",
  abo: "Jahreszeiten-Abo",
  reise: "Reise-Guide mit Hund",
  erstehilfe: "Erste-Hilfe Guide fuer Hunde",
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
    const type = body.type as string | undefined;
    const email = body.email as string | undefined;
    const leadId = body.leadId as string | undefined;
    const dogName = body.dogName as string | undefined;
    const returnUrl = body.returnUrl as string | undefined;

    if (!type || !email) {
      return NextResponse.json(
        { error: "Missing required fields (type, email)" },
        { status: 400 }
      );
    }

    const amountCents = PRODUCT_PRICES[type];
    if (!amountCents) {
      return NextResponse.json(
        { error: "Unknown product type" },
        { status: 400 }
      );
    }

    const productName = PRODUCT_NAMES[type] || "Pfoten-Plan Produkt";

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

    const safeReturnUrl =
      returnUrl &&
      typeof returnUrl === "string" &&
      (returnUrl.startsWith("http://") || returnUrl.startsWith("https://") || returnUrl.startsWith("/"))
        ? returnUrl.startsWith("/")
          ? `${origin}${returnUrl}`
          : returnUrl
        : `${origin}/zusatz.html?lead_id=${leadId || ""}`;

    const payment = await mollie.payments.create({
      amount: { currency: "EUR", value: formatAmountEUR(amountCents) },
      description: `Pfoten-Plan ${productName} fuer ${dogName || "Hund"}`.slice(
        0,
        255
      ),
      redirectUrl: safeReturnUrl,
      webhookUrl: `${webhookBase}/api/mollie/webhook`,
      locale: "de_DE",
      metadata: {
        type: "upsell_product",
        product: type,
        email: email,
        lead_id: leadId || "",
        dog_name: dogName || "",
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
      clientSecret: null,
    });
  } catch (err: any) {
    console.error("Mollie upsell-product-checkout error:", err);
    return NextResponse.json(
      { error: err?.message || "Checkout failed" },
      { status: 500 }
    );
  }
}
