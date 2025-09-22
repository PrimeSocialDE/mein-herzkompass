// /app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe initialisieren - OHNE API-Version
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Helper functions
function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function isoIn(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    const email = String(body.email ?? "").trim();
    const name = String(body.name ?? "").trim();
    const answers = isPlainObject(body.answers) ? body.answers : {};
    const answers_raw = isPlainObject(body.answers_raw) ? body.answers_raw : {};

    if (!email) {
      return NextResponse.json({ error: "E-Mail fehlt" }, { status: 400 });
    }

    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        email,
        name: name || null,
        status: "queued",
        answers,
        answers_raw,
        due_at: isoIn(10),
      })
      .select("id")
      .single();

    if (insertError) throw insertError;
    const orderId = order.id as string;

    const hasStripeEnv =
      !!stripe &&
      !!process.env.STRIPE_PRICE_ID &&
      !!process.env.STRIPE_SUCCESS_URL &&
      !!process.env.STRIPE_CANCEL_URL;

    let checkoutUrl: string | null = null;

    if (hasStripeEnv) {
      const session = await stripe!.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
        customer_email: email,
        client_reference_id: orderId,
        metadata: { order_id: orderId, email, name: name || "" },
        payment_intent_data: { metadata: { order_id: orderId } },
        success_url: `${process.env.STRIPE_SUCCESS_URL}?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: process.env.STRIPE_CANCEL_URL!,
      });

      checkoutUrl = session.url;

      await supabase
        .from("orders")
        .update({ stripe_session_id: session.id, status: "pending" })
        .eq("id", orderId);
    }

    return NextResponse.json({ ok: true, orderId, url: checkoutUrl }, { status: 200 });
  } catch (err: any) {
    console.error("CHECKOUT_ERROR:", err);
    return NextResponse.json(
      { error: err?.message || "Fehler beim Checkout" },
      { status: 500 }
    );
  }
}
