// /app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe initialisieren (ohne explizite API-Version)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// --- Helper: PayPal Name/E-Mail sicher extrahieren ---
function extractPaypalNameAndEmail(pmDetails: any): { email: string | null; name: string | null } {
  const paypal = pmDetails?.paypal;
  if (!paypal) return { email: null, name: null };

  const email: string | null = paypal.payer_email ?? null;

  const pn = paypal.payer_name;
  let name: string | null = null;
  if (pn && typeof pn === "object") {
    const full = `${pn.given_name ?? ""} ${pn.surname ?? ""}`.trim();
    name = full || null;
  } else if (typeof pn === "string") {
    name = pn || null;
  }
  return { email, name };
}

export async function POST(req: NextRequest) {
  if (!stripe || !endpointSecret) {
    console.error("Stripe oder Webhook-Secret fehlt");
    return NextResponse.json({ error: "Stripe nicht konfiguriert" }, { status: 400 });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) return NextResponse.json({ error: "Keine Signatur" }, { status: 400 });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err: any) {
      console.error("Webhook Verify Error:", err?.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log("Stripe Webhook:", event.type);

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.async_payment_failed":
        await handleCheckoutSessionFailed(event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.succeeded":
        await handleChargeSucceeded(event.data.object as Stripe.Charge);
        break;
      default:
        // andere Events ignorieren
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook Handler Error:", err);
    return NextResponse.json({ error: "Webhook-Verarbeitung fehlgeschlagen" }, { status: 500 });
  }
}

// -------- Handlers --------

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.client_reference_id || session.metadata?.order_id;
  let customerEmail = session.customer_email || session.customer_details?.email || null;
  let customerName = session.customer_details?.name || null;
  if (!orderId) return;

  // fehlende Details aus PI / Charge nachladen (z.B. PayPal)
  if (!customerEmail && session.payment_intent && stripe) {
    try {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string, { expand: ["latest_charge"] });
      if (pi.receipt_email) customerEmail = pi.receipt_email;

      const latest = pi.latest_charge as Stripe.Charge | string | null;
      const charge = typeof latest === "string" ? null : latest;

      if (charge?.billing_details) {
        customerEmail = customerEmail || charge.billing_details.email || null;
        customerName  = customerName  || charge.billing_details.name  || null;
      }

      if (charge?.payment_method_details) {
        const { email, name } = extractPaypalNameAndEmail(charge.payment_method_details);
        if (!customerEmail && email) customerEmail = email;
        if (!customerName && name)   customerName  = name;
      }
    } catch (e) {
      console.log("PI expand latest_charge fehlgeschlagen:", e);
    }
  }

  const update: any = {
    status: "paid",
    paid_at: new Date().toISOString(),
    due_at: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
    stripe_session_id: session.id,
  };
  if (session.payment_intent) update.stripe_payment_intent = String(session.payment_intent);
  if (customerEmail) update.email = customerEmail;
  if (customerName) update.name = customerName;

  const { error } = await supabase.from("orders").update(update).eq("id", orderId);
  if (error) console.error("Supabase update (session.completed) error:", error);
}

async function handleCheckoutSessionFailed(session: Stripe.Checkout.Session) {
  const orderId = session.client_reference_id || session.metadata?.order_id;
  if (!orderId) return;

  const update: any = {
    status: "failed",
    stripe_session_id: session.id,
  };
  if (session.payment_intent) update.stripe_payment_intent = String(session.payment_intent);

  const { error } = await supabase.from("orders").update(update).eq("id", orderId);
  if (error) console.error("Supabase update (session.failed) error:", error);
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) return;

  let customerEmail: string | null = paymentIntent.receipt_email ?? null;
  let customerName: string | null = null;

  if (stripe) {
    try {
      const charges = await stripe.charges.list({ payment_intent: paymentIntent.id, limit: 1 });
      const charge = charges.data[0];
      if (charge?.billing_details) {
        customerEmail = customerEmail || charge.billing_details.email || null;
        customerName  = customerName  || charge.billing_details.name  || null;
      }
      const { email, name } = extractPaypalNameAndEmail(charge?.payment_method_details);
      if (!customerEmail && email) customerEmail = email;
      if (!customerName && name)   customerName  = name;
    } catch (e) {
      console.log("charges.list fehlgeschlagen:", e);
    }
  }

  const update: any = {
    status: "paid",
    stripe_payment_intent: paymentIntent.id,
    paid_at: new Date().toISOString(),
  };
  if (customerEmail) update.email = customerEmail;
  if (customerName) update.name = customerName;

  const { error } = await supabase.from("orders").update(update).eq("id", orderId);
  if (error) console.error("Supabase update (pi.succeeded) error:", error);
}

async function handleChargeSucceeded(charge: Stripe.Charge) {
  // Order-ID aus Charge oder zugehörigem PI ziehen
  let orderId = charge.metadata?.order_id || null;
  if (!orderId && charge.payment_intent && stripe) {
    try {
      const pi = await stripe.paymentIntents.retrieve(charge.payment_intent as string);
      orderId = pi.metadata?.order_id || null;
    } catch (e) {
      console.log("PI für Charge nicht abrufbar:", e);
    }
  }
  if (!orderId) return;

  let customerEmail: string | null = charge.billing_details?.email ?? null;
  let customerName: string | null  = charge.billing_details?.name  ?? null;

  const { email, name } = extractPaypalNameAndEmail(charge.payment_method_details);
  if (!customerEmail && email) customerEmail = email;
  if (!customerName && name)   customerName  = name;

  const update: any = {
    status: "paid",
    paid_at: new Date().toISOString(),
  };
  if (customerEmail) update.email = customerEmail;
  if (customerName) update.name = customerName;

  const { error } = await supabase.from("orders").update(update).eq("id", orderId);
  if (error) console.error("Supabase update (charge.succeeded) error:", error);
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) return;

  const { error } = await supabase
    .from("orders")
    .update({ status: "failed", stripe_payment_intent: paymentIntent.id })
    .eq("id", orderId);

  if (error) console.error("Supabase update (pi.failed) error:", error);
}