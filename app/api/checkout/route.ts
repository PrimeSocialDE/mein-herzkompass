// /app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";

// Stripe initialisieren (nur wenn Secret gesetzt ist)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

// helpers
function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
function isoIn(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    // Eingaben
    const email = String(body.email ?? "").trim();
    const name = String(body.name ?? "").trim();
    const answers = isPlainObject(body.answers) ? body.answers : {};

    if (!email) {
      return NextResponse.json({ error: "E-Mail fehlt" }, { status: 400 });
    }

    // 1) Order in Supabase anlegen
    const { data: order, error: insErr } = await supabase
      .from("orders")
      .insert({
        email,
        name: name || null,
        status: "queued",
        answers,
        due_at: isoIn(10), // Lieferung in 10h
      })
      .select("id")
      .single();

    if (insErr) throw insErr;
    const orderId = order.id as string;

    // 2) Stripe-Checkout-Session erstellen (nur wenn ENV vollständig)
    const hasStripeEnv =
      !!stripe &&
      !!process.env.STRIPE_PRICE_ID &&
      !!process.env.STRIPE_SUCCESS_URL &&
      !!process.env.STRIPE_CANCEL_URL;

    let checkoutUrl: string | null = null;

    if (hasStripeEnv) {
      const session = await stripe!.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID!, // z. B. price_123
            quantity: 1,
          },
        ],

        // 🔑 E-Mail an Stripe geben, damit sie sicher im Webhook ankommt
        customer_email: email,

        // 🔑 Eindeutige Zuordnung im Webhook
        client_reference_id: orderId,
        metadata: {
          order_id: orderId,
          email,
          name: name || "",
        },

        // 🔑 Für PI-Events (z. B. PayPal async) ebenfalls die order_id mitgeben
        payment_intent_data: {
          metadata: { order_id: orderId },
        },

        success_url: `${process.env.STRIPE_SUCCESS_URL}?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: process.env.STRIPE_CANCEL_URL!,
      });

      checkoutUrl = session.url ?? null;

      // 3) Session-ID speichern + Status "pending"
      await supabase
        .from("orders")
        .update({ stripe_session_id: session.id, status: "pending" })
        .eq("id", orderId);
    } else {
      // Stripe nicht konfiguriert: Order existiert, aber keine Session
      // -> checkoutUrl bleibt null
    }

    // 4) Response für Frontend
    return NextResponse.json(
      { ok: true, orderId, url: checkoutUrl },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("CHECKOUT_ERROR:", err);
    return NextResponse.json(
      { error: err?.message || "Fehler beim Checkout" },
      { status: 500 }
    );
  }
}