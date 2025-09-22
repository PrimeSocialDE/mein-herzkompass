// /app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse }

// Handler für fehlgeschlagene Checkout-Session (PayPal/Klarna abgebrochen)
async function handleCheckoutSessionFailed(session: Stripe.Checkout.Session) {
  console.log(`Checkout Session fehlgeschlagen: ${session.id}`);

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

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      console.error("Fehler beim Markieren der fehlgeschlagenen Session:", error);
    } else {
      console.log(`Order ${orderId} als fehlgeschlagen markiert (async payment failed)`);
    }
  } catch (err) {
    console.error("Supabase-Fehler bei fehlgeschlagener Checkout Session:", err);
  }
} from "next/server";
import { supabase } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

      case "checkout.session.async_payment_succeeded":
        // Wichtig für PayPal/Klarna - asynchrone Zahlungen
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "checkout.session.async_payment_failed":
        // Asynchrone Zahlungen fehlgeschlagen (PayPal/Klarna abgebrochen)
        await handleCheckoutSessionFailed(event.data.object as Stripe.Checkout.Session);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "charge.succeeded":
        // Speziell für PayPal - hier kommen oft die E-Mail-Details an
        await handleChargeSucceeded(event.data.object as Stripe.Charge);
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
  let customerEmail = session.customer_email || session.customer_details?.email;
  let customerName = session.customer_details?.name;

  if (!orderId) {
    console.error("Keine Order-ID in Session gefunden");
    return;
  }

  // Versuche zusätzliche Details aus der Session zu extrahieren
  if (!customerEmail && session.payment_intent && stripe) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        session.payment_intent as string,
        { expand: ['latest_charge'] }
      );
      
      if (paymentIntent.receipt_email) {
        customerEmail = paymentIntent.receipt_email;
      }

      // Charge-Details prüfen
      const charge = paymentIntent.latest_charge as Stripe.Charge;
      if (charge && charge.billing_details) {
        customerEmail = customerEmail || charge.billing_details.email;
        customerName = customerName || charge.billing_details.name;
      }

      // PayPal-spezifische Details
      if (charge && charge.payment_method_details?.paypal) {
        customerEmail = customerEmail || charge.payment_method_details.paypal.payer_email;
        const paypalName = charge.payment_method_details.paypal.payer_name;
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
      due_at: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(), // +10h Lieferzeit
      stripe_session_id: session.id,
    };

    if (session.payment_intent) {
      updateData.stripe_payment_intent = session.payment_intent as string;
    }

    // E-Mail nur aktualisieren wenn eine gefunden wurde
    if (customerEmail) {
      updateData.email = customerEmail;
      console.log(`E-Mail gefunden in Session: ${customerEmail}`);
    }

    // Name nur aktualisieren wenn einer gefunden wurde
    if (customerName) {
      updateData.name = customerName;
      console.log(`Name gefunden in Session: ${customerName}`);
    }

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      console.error("Fehler beim Aktualisieren der Order:", error);
    } else {
      console.log(`Order ${orderId} erfolgreich als bezahlt markiert`);
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

          // PayPal-spezifische Details extrahieren
          if (charge.payment_method_details?.paypal) {
            customerEmail = customerEmail || charge.payment_method_details.paypal.payer_email;
            const paypalName = charge.payment_method_details.paypal.payer_name;
            if (paypalName && !customerName) {
              customerName = `${paypalName.given_name || ''} ${paypalName.surname || ''}`.trim();
            }
            console.log(`PayPal Details gefunden - Email: ${charge.payment_method_details.paypal.payer_email}, Name: ${customerName}`);
          }
        }
      } catch (chargeError) {
        console.log("Konnte Charge-Details nicht abrufen:", chargeError);
      }
    }

    const updateData: any = {
      status: "paid",
      stripe_payment_intent: paymentIntent.id,
      paid_at: new Date().toISOString(),
    };

    if (customerEmail) {
      updateData.email = customerEmail;
      console.log(`E-Mail aus PaymentIntent: ${customerEmail}`);
    }
    
    if (customerName) {
      updateData.name = customerName;
      console.log(`Name aus PaymentIntent: ${customerName}`);
    }

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      console.error("Fehler beim Aktualisieren der Order via PaymentIntent:", error);
    } else {
      console.log(`Order ${orderId} erfolgreich über PaymentIntent aktualisiert`);
    }
  } catch (err) {
    console.error("Fehler bei PaymentIntent-Verarbeitung:", err);
  }
}

// Neuer Handler speziell für Charge Events (wichtig für PayPal)
async function handleChargeSucceeded(charge: Stripe.Charge) {
  console.log(`Charge erfolgreich: ${charge.id}`);

  // Order-ID aus PaymentIntent-Metadaten oder Charge-Metadaten
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
    console.log("Keine Order-ID für Charge gefunden - überspringen");
    return;
  }

  let customerEmail: string | null = null;
  let customerName: string | null = null;

  // E-Mail und Name aus Charge extrahieren
  if (charge.billing_details) {
    customerEmail = charge.billing_details.email;
    customerName = charge.billing_details.name;
  }

  // PayPal-spezifische Details
  if (charge.payment_method_details?.paypal) {
    customerEmail = customerEmail || charge.payment_method_details.paypal.payer_email;
    const paypalName = charge.payment_method_details.paypal.payer_name;
    if (paypalName && !customerName) {
      customerName = `${paypalName.given_name || ''} ${paypalName.surname || ''}`.trim();
    }
    console.log(`PayPal Charge - Email: ${customerEmail}, Name: ${customerName}`);
  }

  // Order auf paid setzen und Details aktualisieren
  try {
    const updateData: any = {
      status: "paid",
      paid_at: new Date().toISOString(),
    };

    if (customerEmail) updateData.email = customerEmail;
    if (customerName) updateData.name = customerName;

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      console.error("Fehler beim Aktualisieren der Order via Charge:", error);
    } else {
      console.log(`Order ${orderId} mit Charge-Details aktualisiert`);
    }
  } catch (err) {
    console.error("Fehler bei Charge-Verarbeitung:", err);
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
        stripe_payment_intent: paymentIntent.id,
      })
      .eq("id", orderId);

    if (error) {
      console.error("Fehler beim Markieren der fehlgeschlagenen Order:", error);
    } else {
      console.log(`Order ${orderId} als fehlgeschlagen markiert`);
    }
  } catch (err) {
    console.error("Fehler bei fehlgeschlagener PaymentIntent-Verarbeitung:", err);
  }
}