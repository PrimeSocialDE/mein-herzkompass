import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
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

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err: any) {
      console.error("Webhook-Signatur-Verifikation fehlgeschlagen:", err.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log(`Stripe Webhook Event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutSuccess(event.data.object as Stripe.Checkout.Session);
        break;

      case "checkout.session.async_payment_failed":
        await handleCheckoutFailed(event.data.object as Stripe.Checkout.Session);
        break;

      case "payment_intent.succeeded":
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "charge.succeeded":
        await handleChargeSuccess(event.data.object as Stripe.Charge);
        break;

      default:
        console.log(`Unbehandelter Event-Typ: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook-Verarbeitungsfehler:", error);
    return NextResponse.json({ error: "Webhook-Verarbeitung fehlgeschlagen" }, { status: 500 });
  }
}

async function handleCheckoutSuccess(session: Stripe.Checkout.Session) {
  const orderId = session.client_reference_id || session.metadata?.order_id;
  if (!orderId) {
    console.error("Keine Order-ID in Session gefunden");
    return;
  }

  let customerEmail = session.customer_email || session.customer_details?.email;
  let customerName = session.customer_details?.name;

  // PayPal-Details aus PaymentIntent abrufen falls nötig
  if (!customerEmail && session.payment_intent && stripe) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        session.payment_intent as string,
        { expand: ['latest_charge'] }
      );
      
      customerEmail = customerEmail || paymentIntent.receipt_email;
      const charge = paymentIntent.latest_charge as Stripe.Charge;
      
      if (charge?.billing_details) {
        customerEmail = customerEmail || charge.billing_details.email;
        customerName = customerName || charge.billing_details.name;
      }

      // PayPal-spezifische Details
      if (charge?.payment_method_details?.paypal) {
        const paypal = charge.payment_method_details.paypal;
        customerEmail = customerEmail || paypal.payer_email;
        
        const paypalName = (paypal.payer_name as any);
        if (paypalName && !customerName) {
          customerName = `${paypalName.given_name || ''} ${paypalName.surname || ''}`.trim();
        }
      }
    } catch (err) {
      console.log("Konnte PaymentIntent nicht erweitern:", err);
    }
  }

  try {
    const updateData: any = {
      status: "paid",
      paid_at: new Date().toISOString(),
      due_at: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
      stripe_session_id: session.id,
    };

    if (session.payment_intent) {
      updateData.stripe_payment_intent = session.payment_intent as string;
    }
    if (customerEmail) {
      updateData.email = customerEmail;
      console.log(`E-Mail gefunden: ${customerEmail}`);
    }
    if (customerName) {
      updateData.name = customerName;
      console.log(`Name gefunden: ${customerName}`);
    }

    const { error } = await supabase.from("orders").update(updateData).eq("id", orderId);
    
    if (error) {
      console.error("Fehler beim Aktualisieren der Order:", error);
    } else {
      console.log(`Order ${orderId} erfolgreich als bezahlt markiert`);
    }
  } catch (err) {
    console.error("Supabase-Fehler bei Checkout Session:", err);
  }
}

async function handleCheckoutFailed(session: Stripe.Checkout.Session) {
  const orderId = session.client_reference_id || session.metadata?.order_id;
  if (!orderId) {
    console.error("Keine Order-ID in Session gefunden");
    return;
  }

  try {
    const updateData: any = {
      status: "failed",
      stripe_session_id: session.id,
    };

    if (session.payment_intent) {
      updateData.stripe_payment_intent = session.payment_intent as string;
    }

    const { error } = await supabase.from("orders").update(updateData).eq("id", orderId);
    
    if (error) {
      console.error("Fehler beim Markieren der fehlgeschlagenen Session:", error);
    } else {
      console.log(`Order ${orderId} als fehlgeschlagen markiert`);
    }
  } catch (err) {
    console.error("Supabase-Fehler bei fehlgeschlagener Session:", err);
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) {
    console.error("Keine Order-ID in PaymentIntent gefunden");
    return;
  }

  let customerEmail = paymentIntent.receipt_email;
  let customerName = null;

  // Charge-Details für PayPal abrufen
  if (stripe) {
    try {
      const charges = await stripe.charges.list({ payment_intent: paymentIntent.id, limit: 1 });
      
      if (charges.data.length > 0) {
        const charge = charges.data[0];
        
        if (charge.billing_details) {
          customerEmail = customerEmail || charge.billing_details.email;
          customerName = charge.billing_details.name;
        }

        if (charge.payment_method_details?.paypal) {
          const paypal = charge.payment_method_details.paypal;
          customerEmail = customerEmail || paypal.payer_email;
          
          const paypalName = (paypal.payer_name as any);
          if (paypalName && !customerName) {
            customerName = `${paypalName.given_name || ''} ${paypalName.surname || ''}`.trim();
          }
        }
      }
    } catch (err) {
      console.log("Konnte Charge-Details nicht abrufen:", err);
    }
  }

  try {
    const updateData: any = {
      status: "paid",
      stripe_payment_intent: paymentIntent.id,
      paid_at: new Date().toISOString(),
    };

    if (customerEmail) updateData.email = customerEmail;
    if (customerName) updateData.name = customerName;

    const { error } = await supabase.from("orders").update(updateData).eq("id", orderId);
    
    if (error) {
      console.error("Fehler beim Aktualisieren der Order via PaymentIntent:", error);
    } else {
      console.log(`Order ${orderId} via PaymentIntent aktualisiert`);
    }
  } catch (err) {
    console.error("Fehler bei PaymentIntent-Verarbeitung:", err);
  }
}

async function handleChargeSuccess(charge: Stripe.Charge) {
  let orderId = charge.metadata?.order_id;
  
  if (!orderId && charge.payment_intent && stripe) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent as string);
      orderId = paymentIntent.metadata?.order_id;
    } catch (err) {
      console.log("Konnte PaymentIntent für Charge nicht abrufen:", err);
    }
  }

  if (!orderId) {
    console.log("Keine Order-ID für Charge gefunden - überspringe");
    return;
  }

  let customerEmail = charge.billing_details?.email;
  let customerName = charge.billing_details?.name;

  // PayPal-Details aus Charge
  if (charge.payment_method_details?.paypal) {
    const paypal = charge.payment_method_details.paypal;
    customerEmail = customerEmail || paypal.payer_email;
    
    const paypalName = (paypal.payer_name as any);
    if (paypalName && !customerName) {
      customerName = `${paypalName.given_name || ''} ${paypalName.surname || ''}`.trim();
    }
    console.log(`PayPal Charge - Email: ${customerEmail}, Name: ${customerName}`);
  }

  try {
    const updateData: any = {
      status: "paid",
      paid_at: new Date().toISOString(),
    };

    if (customerEmail) updateData.email = customerEmail;
    if (customerName) updateData.name = customerName;

    const { error } = await supabase.from("orders").update(updateData).eq("id", orderId);
    
    if (error) {
      console.error("Fehler beim Aktualisieren der Order via Charge:", error);
    } else {
      console.log(`Order ${orderId} via Charge aktualisiert`);
    }
  } catch (err) {
    console.error("Fehler bei Charge-Verarbeitung:", err);
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) {
    console.error("Keine Order-ID in PaymentIntent gefunden");
    return;
  }

  try {
    const { error } = await supabase.from("orders").update({
      status: "failed",
      stripe_payment_intent: paymentIntent.id,
    }).eq("id", orderId);

    if (error) {
      console.error("Fehler beim Markieren der fehlgeschlagenen Order:", error);
    } else {
      console.log(`Order ${orderId} als fehlgeschlagen markiert`);
    }
  } catch (err) {
    console.error("Fehler bei fehlgeschlagener PaymentIntent-Verarbeitung:", err);
  }
}