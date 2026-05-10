// Mollie-Variante von /api/upsell-product-checkout
// Behandelt: ernaehrung, zweithund, abo, reise, erstehilfe
// Returnt { url, paymentId } statt { clientSecret }.

import { NextRequest, NextResponse } from "next/server";
import { getMollie, formatAmountEUR, Locale } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCT_PRICES: Record<string, number> = {
  ernaehrung: 2499,
  zweithund: 1999,
  abo: 999,
  reise: 1999,
  erstehilfe: 1499,
  // Themen-Module (siehe lib/member-themen.ts) — alle einheitlich 14,99
  "thema-leinen": 1499,
  "thema-bellen": 1499,
  "thema-aggression": 1499,
  "thema-trennungsangst": 1499,
  "thema-anspringen": 1499,
  "thema-rueckruf": 1499,
  "thema-energie": 1499,
  "thema-zerstoerung": 1499,
  "thema-stubenrein": 1499,
  "thema-aufnehmen": 1499,
};

const PRODUCT_NAMES: Record<string, string> = {
  ernaehrung: "Personalisierter Ernaehrungsplan",
  zweithund: "Zweithund-Guide",
  abo: "Jahreszeiten-Abo",
  reise: "Reise-Guide mit Hund",
  erstehilfe: "Erste-Hilfe Guide fuer Hunde",
  "thema-leinen": "Themen-Modul Leinenfuehrigkeit",
  "thema-bellen": "Themen-Modul Bellen abgewoehnen",
  "thema-aggression": "Themen-Modul Aggression entschaerfen",
  "thema-trennungsangst": "Themen-Modul Trennungsangst",
  "thema-anspringen": "Themen-Modul Anspringen abgewoehnen",
  "thema-rueckruf": "Themen-Modul Rueckruf trainieren",
  "thema-energie": "Themen-Modul Energie",
  "thema-zerstoerung": "Themen-Modul Zerstoerungsverhalten",
  "thema-stubenrein": "Themen-Modul Stubenreinheit",
  "thema-aufnehmen": "Themen-Modul Nichts vom Boden",
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
    // Optional: direkter Karten-Flow ohne Mollie-Hosted-Page
    const method = body.method as string | undefined; // 'creditcard' | undefined
    const cardToken = body.cardToken as string | undefined;

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

    // Direkt-Karten-Flow: method + cardToken setzt Payment ohne
    // Hosted-Checkout, processed direkt (ggf. mit 3DS-Redirect).
    const paymentBody: any = {
      amount: { currency: "EUR", value: formatAmountEUR(amountCents) },
      description: `Pfoten-Plan ${productName} fuer ${dogName || "Hund"} · kommt sofort per E-Mail`.slice(
        0,
        255
      ),
      redirectUrl: safeReturnUrl,
      webhookUrl: `${webhookBase}/api/mollie/webhook`,
      locale: Locale.de_DE,
      metadata: {
        type: "upsell_product",
        product: type,
        email: email,
        lead_id: leadId || "",
        dog_name: dogName || "",
      },
    };
    if (method === "creditcard" && cardToken) {
      paymentBody.method = "creditcard";
      paymentBody.cardToken = cardToken;
    } else if (method) {
      paymentBody.method = method;
    }

    const payment = await mollie.payments.create(paymentBody);

    const url = payment.getCheckoutUrl();

    // Bei direkter Karte: status kann schon 'paid' sein oder 3DS-Redirect.
    return NextResponse.json({
      url, // bei creditcard direkt: ggf null (paid) oder 3DS-URL
      paymentId: payment.id,
      status: payment.status,
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
