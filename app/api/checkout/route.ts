// /app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";

// --- Stripe optional initialisieren (falls Keys gesetzt sind) ---
const stripe =
  process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY!)
    : null;

// kleine Helper
function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function isoIn(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    // --- Eingaben lesen & sanitisieren ---
    const email = String(body.email ?? "").trim();
    const name = String(body.name ?? "").trim();

    // saubere/umbenannte Antworten (siehe Frontend-Mapping)
    const answers = isPlainObject(body.answers) ? body.answers : {};
    // optional: Rohdaten (nur zu Debug-Zwecken)
    const answers_raw = isPlainObject(body.answers_raw) ? body.answers_raw : {};

    if (!email) throw new Error("E-Mail fehlt");
    // name ist optional – wenn du willst, erzwingen:
    // if (!name) throw new Error("Name fehlt");

    // --- Order in Supabase anlegen ---
    // Spalten: email (text), name (text), status (text),
    // answers (jsonb), answers_raw (jsonb, optional),
    // due_at (timestamptz), stripe_session_id (text, optional)
    const { data: order, error: insErr } = await supabase
      .from("orders")
      .insert({
        email,
        name,
        status: "queued",                // initialer Status
        answers,                         // <- „schöne“ Keys
        answers_raw,                     // <- optional
        due_at: isoIn(10),               // Lieferung in 10h
      })
      .select("id")
      .single();

    if (insErr) throw insErr;
    const orderId = order.id as string;

    // --- Optional: Stripe-Checkout erstellen ---
    let checkoutUrl: string | null = null;

    if (
      stripe &&
      process.env.STRIPE_PRICE_ID &&
      process.env.STRIPE_SUCCESS_URL &&
      process.env.STRIPE_CANCEL_URL
    ) {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID,
            quantity: 1,
          },
        ],
        success_url: `${process.env.STRIPE_SUCCESS_URL}?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: process.env.STRIPE_CANCEL_URL,
        metadata: {
          order_id: orderId,
          email,
          name,
        },
      });

      checkoutUrl = session.url ?? null;

      // Session-ID in der Order speichern (optional, aber praktisch)
      await supabase
        .from("orders")
        .update({ stripe_session_id: session.id, status: "pending" })
        .eq("id", orderId);
    } else {
      // Stripe ist nicht konfiguriert → nur Order anlegen und zurückgeben
      // (du könntest hier z.B. „Testmodus: direkt bezahlt“ simulieren)
    }

    return NextResponse.json({
      ok: true,
      orderId,
      url: checkoutUrl, // fürs Frontend (redirect)
    });
  } catch (err: any) {
    console.error("CHECKOUT_ERROR:", err);
    return NextResponse.json(
      { error: err?.message || "Fehler beim Checkout" },
      { status: 500 }
    );
  }
}