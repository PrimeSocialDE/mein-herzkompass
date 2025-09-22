import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

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

    if (!process.env.STRIPE_PRICE_ID || !process.env.STRIPE_SUCCESS_URL || !process.env.STRIPE_CANCEL_URL) {
      throw new Error("Stripe-ENV unvollständig");
    }

    // Order anlegen (queued)
    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        email: email || null,
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

    let checkoutUrl: string | null = null;

    if (stripe) {
      // --- HIER: Session-Params aufbauen
      const params: Stripe.Checkout.SessionCreateParams = {
        mode: "payment",
        line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
        client_reference_id: orderId,
        metadata: { order_id: orderId, name: name || "" },
        payment_intent_data: { metadata: { order_id: orderId } },
        success_url: `${process.env.STRIPE_SUCCESS_URL}?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: process.env.STRIPE_CANCEL_URL!,
        customer_creation: "always",
      };

      // Nur echte E-Mails vorbefüllen – sonst Stripe eintippen lassen
      const isRealEmail =
        !!email && email !== "kunde@test.de" && /.+@.+\..+/.test(email);
      if (isRealEmail) {
        params.customer_email = email;
      }

      const session = await stripe.checkout.sessions.create(params);
      checkoutUrl = session.url ?? null;

      // Session-ID + pending speichern
      await supabase
        .from("orders")
        .update({ stripe_session_id: session.id, status: "pending" })
        .eq("id", orderId);
    }

    return NextResponse.json({ ok: true, orderId, url: checkoutUrl }, { status: 200 });
  } catch (err: any) {
    console.error("CHECKOUT_ERROR:", err);
    return NextResponse.json({ error: err?.message || "Fehler beim Checkout" }, { status: 500 });
  }
}