// /app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";

// Stripe initialisieren - ohne explizite API-Version
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  if (!stripe || !endpointSecret) {
    console.error("Stripe oder Webhook-Secret fehlt");
    return NextResponse.json({ error: "Stripe nicht konfiguriert" }, { status: 400 });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("Keine Stripe-Signatur gefunden");
      return NextResponse.json({ error: "Keine Signatur" }, { status: 400 });
    }

    // Event verifizieren
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err: any) {
      console.error("Webhook-Signatur-Verifikation fehlgeschlagen:", err.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log(`Stripe Webhook Event erhalten: ${event.type}`);

    // Event-Handler basierend auf Event-Typ
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "invoice.payment_succeeded":
        console.log("Invoice payment succeeded - no action needed");
        break;

      case "customer.subscription.created":
        console.log("Subscription created - no action needed");
        break;

      default:
        console.log(`Unbehandelter Event-Typ: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error("Webhook-Verarbeitungsfehler:", error);
    return NextResponse.json(
      { error: "Webhook-Verarbeitung fehlgeschlagen" },
      { status: 500 }
    );
  }
}

// Handler für erfolgreiche Checkout-Session
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log(`Checkout Session abgeschlossen: ${session.id}`);

  const orderId = session.client_reference_id || session.metadata?.order_id;
  const customerEmail = session.customer_email || session.customer_details?.email;

  if (!orderId) {
    console.error("Keine Order-ID in Session gefunden");
    return;
  }

  try {
    const updateData: any = {
      status: "paid",
      updated_at: new Date().toISOString(),
    };

    if (session.payment_intent) {
      updateData.stripe_payment_intent_id = session.payment_intent as string;
    }

    if (customerEmail) {
      updateData.customer_email = customerEmail;
    }

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      console.error("Fehler beim Aktualisieren der Order:", error);
    } else {
      console.log(`✅ Order ${orderId} erfolgreich als bezahlt markiert`);
    }
  } catch (err) {
    console.error("Supabase-Fehler bei Checkout Session:", err);
  }
}

// Handler für erfolgreiche Payment Intent
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`Payment Intent erfolgreich: ${paymentIntent.id}`);

  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) {
    console.error("Keine Order-ID in PaymentIntent-Metadaten gefunden");
    return;
  }

  try {
    let customerEmail: string | null = null;
    let customerName: string | null = null;

    // E-Mail aus PaymentIntent extrahieren
    if (paymentIntent.receipt_email) {
      customerEmail = paymentIntent.receipt_email;
    }

    // Zusätzliche Informationen aus Charges abrufen
    if (stripe) {
      try {
        const charges = await stripe.charges.list({
          payment_intent: paymentIntent.id,
          limit: 1,
        });

        if (charges.data.length > 0) {
          const charge = charges.data[0];
          if (charge.billing_details) {
            customerEmail = customerEmail || charge.billing_details.email;
            customerName = charge.billing_details.name;
          }
        }
      } catch (chargeError) {
        console.log("Konnte Charge-Details nicht abrufen:", chargeError);
      }
    }

    const updateData: any = {
      status: "paid",
      stripe_payment_intent_id: paymentIntent.id,
      updated_at: new Date().toISOString(),
    };

    if (customerEmail) updateData.customer_email = customerEmail;
    if (customerName) updateData.customer_name = customerName;

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      console.error("Fehler beim Aktualisieren der Order via PaymentIntent:", error);
    } else {
      console.log(`✅ Order ${orderId} erfolgreich über PaymentIntent aktualisiert`);
    }
  } catch (err) {
    console.error("Fehler bei PaymentIntent-Verarbeitung:", err);
  }
}

// Handler für fehlgeschlagene Payment Intent
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log(`Payment Intent fehlgeschlagen: ${paymentIntent.id}`);

  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) {
    console.error("Keine Order-ID in PaymentIntent-Metadaten gefunden");
    return;
  }

  try {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "failed",
        stripe_payment_intent_id: paymentIntent.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      console.error("Fehler beim Markieren der fehlgeschlagenen Order:", error);
    } else {
      console.log(`❌ Order ${orderId} als fehlgeschlagen markiert`);
    }
  } catch (err) {
    console.error("Fehler bei fehlgeschlagener PaymentIntent-Verarbeitung:", err);
  }
}
