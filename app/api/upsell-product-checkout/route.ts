// app/api/upsell-product-checkout/route.ts
// Creates Stripe PaymentIntent for upsell product purchases

import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = body.type as string | undefined;
    const email = body.email as string | undefined;
    const leadId = body.leadId as string | undefined;
    const dogName = body.dogName as string | undefined;

    if (!type || !email) {
      return NextResponse.json(
        { error: "Missing required fields (type, email)" },
        { status: 400 }
      );
    }

    const amount = PRODUCT_PRICES[type];
    if (!amount) {
      return NextResponse.json(
        { error: "Unknown product type" },
        { status: 400 }
      );
    }

    const productName = PRODUCT_NAMES[type] || "Pfoten-Plan Produkt";

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "eur",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        type: "upsell_product",
        product: type,
        email: email,
        lead_id: leadId || "",
        dog_name: dogName || "",
      },
      receipt_email: email,
      description: `Pfoten-Plan ${productName} fuer ${dogName || "Hund"}`,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("Upsell product checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
