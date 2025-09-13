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

  const rawBody = await req.text();             // RAW Body!
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
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const paymentIntent =
        (session.payment_intent as string) || session.id; // Fallback
      const email = session.customer_details?.email || null;
      const name = session.customer_details?.name || null;
      const orderId = session.metadata?.order_id || null;

      const paidAt = new Date().toISOString();
      const dueAt = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(); // +10h

      if (orderId) {
        // gezielt per Order-ID (empfohlen, wenn du sie beim Checkout in metadata setzt)
        const { error } = await supabase
          .from("orders")
          .update({
            status: "paid",
            paid_at: paidAt,
            due_at: dueAt,
            stripe_payment_intent: paymentIntent,
            email: email ?? undefined,
            name: name ?? undefined,
          })
          .eq("id", orderId);
        if (error) throw new Error(error.message);
      } else {
        // Fallback: upsert über stripe_payment_intent
        const { data: existing, error: selErr } = await supabase
          .from("orders")
          .select("id")
          .eq("stripe_payment_intent", paymentIntent)
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
            .eq("stripe_payment_intent", paymentIntent);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from("orders").insert([
            {
              status: "paid",
              paid_at: paidAt,
              due_at: dueAt,
              stripe_payment_intent: paymentIntent,
              email,
              name,
            },
          ]);
          if (error) throw new Error(error.message);
        }
      }
    }
  } catch (e: any) {
    console.error("WEBHOOK_HANDLE_ERROR:", e?.message || e);
    return new Response("handler failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}