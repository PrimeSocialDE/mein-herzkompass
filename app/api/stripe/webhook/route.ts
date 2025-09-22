// app/api/stripe/webhook/route.ts
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { supabase } from "../../../../lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret || !webhookSecret) {
    console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response("env missing", { status: 500 });
  }

  // ⚠️ Stripe braucht RAW body (kein JSON parse hier!)
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("WEBHOOK_VERIFY_ERROR:", err?.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });
    const type = event.type;

    // Helper: zentrale Paid-Aktualisierung
    async function markPaid({
      orderId,
      stripeSessionId,
      paymentIntentId,
      email,
      name,
    }: {
      orderId?: string | null;
      stripeSessionId?: string | null;
      paymentIntentId?: string | null;
      email?: string | null;
      name?: string | null;
    }) {
      const paidAt = new Date().toISOString();
      const dueAt = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(); // +10h

      if (orderId) {
        const { error } = await supabase
          .from("orders")
          .update({
            status: "paid",
            paid_at: paidAt,
            due_at: dueAt,
            stripe_payment_intent: paymentIntentId ?? undefined,
            email: email ?? undefined,
            name: name ?? undefined,
          })
          .eq("id", orderId);
        if (error) throw new Error(error.message);
        return;
      }

      if (paymentIntentId) {
        // Fallback: per payment_intent zuordnen
        const { data: existing, error: selErr } = await supabase
          .from("orders")
          .select("id")
          .eq("stripe_payment_intent", paymentIntentId)
          .limit(1);
        if (selErr) throw new Error(selErr.message);

        if (existing?.length) {
          const { error } = await supabase
            .from("orders")
            .update({
              status: "paid",
              paid_at: paidAt,
              due_at: dueAt,
              email: email ?? undefined,
              name: name ?? undefined,
            })
            .eq("stripe_payment_intent", paymentIntentId);
          if (error) throw new Error(error.message);
        } else {
          // Letzter Fallback: Insert (sollte selten notwendig sein)
          const { error } = await supabase.from("orders").insert({
            status: "paid",
            paid_at: paidAt,
            due_at: dueAt,
            stripe_payment_intent: paymentIntentId,
            email: email ?? null,
            name: name ?? null,
          });
          if (error) throw new Error(error.message);
        }
        return;
      }

      if (stripeSessionId) {
        const { error } = await supabase
          .from("orders")
          .update({
            status: "paid",
            paid_at: paidAt,
            due_at: dueAt,
            email: email ?? undefined,
            name: name ?? undefined,
          })
          .eq("stripe_session_id", stripeSessionId);
        if (error) throw new Error(error.message);
      }
    }

    // E-Mail aus PaymentIntent/Charge holen (Fallback)
    function extractEmailAndNameFromPI(pi: Stripe.PaymentIntent) {
      let email: string | null = null;
      let name: string | null = null;

      // charges kann eingebettet sein
      if (pi.charges && pi.charges.data && pi.charges.data.length > 0) {
        const charge = pi.charges.data[0];
        if (charge?.billing_details) {
          email = (charge.billing_details.email as string) || null;
          name = (charge.billing_details.name as string) || null;
        }
      }
      return { email, name };
    }

    // 1) Sofortige Abschlüsse (Kartenzahlung etc.)
    if (type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Nur als "paid" markieren, wenn wirklich bezahlt (bei async ggf. 'unpaid')
      if (session.payment_status === "paid") {
        await markPaid({
          orderId:
            (session.client_reference_id as string) ||
            (session.metadata?.order_id as string) ||
            null,
          stripeSessionId: session.id,
          paymentIntentId: (session.payment_intent as string) || null,
          email: session.customer_details?.email || session.customer_email || null,
          name: session.customer_details?.name || null,
        });
      }
    }

    // 2) Asynchrone Zahlungen erfolgreich (z. B. PayPal)
    if (type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      await markPaid({
        orderId:
          (session.client_reference_id as string) ||
          (session.metadata?.order_id as string) ||
          null,
        stripeSessionId: session.id,
        paymentIntentId: (session.payment_intent as string) || null,
        email: session.customer_details?.email || session.customer_email || null,
        name: session.customer_details?.name || null,
      });
    }

    // 3) Fallback über Payment Intent (zusätzliche Sicherheit)
    if (type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const { email, name } = extractEmailAndNameFromPI(pi);
      const orderId =
        (pi.metadata?.order_id as string) ||
        null; // wir geben die order_id in payment_intent_data.metadata mit

      await markPaid({
        orderId,
        paymentIntentId: pi.id,
        email: email ?? null,
        name: name ?? null,
      });
    }

    return new Response("ok", { status: 200 });
  } catch (e: any) {
    console.error("WEBHOOK_HANDLE_ERROR:", e?.message || e);
    return new Response("handler failed", { status: 500 });
  }
}