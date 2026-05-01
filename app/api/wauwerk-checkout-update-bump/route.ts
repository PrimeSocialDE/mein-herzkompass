// app/api/wauwerk-checkout-update-bump/route.ts
// Aktualisiert einen bestehenden PaymentIntent mit Order-Bump-Betrag (Antizieh-Modul +€12)

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const ORDER_BUMP_PRICE_CENTS = 1900;

export async function POST(req: NextRequest) {
  if (process.env.STRIPE_DISABLED === "true") {
    return NextResponse.json({ error: "Stripe deaktiviert" }, { status: 503 });
  }
  if (!stripe) {
    return NextResponse.json({ error: "Stripe nicht konfiguriert" }, { status: 500 });
  }

  try {
    const { paymentIntentId, orderBump, bumpProblem } = await req.json();

    if (!paymentIntentId) {
      return NextResponse.json({ error: "paymentIntentId fehlt" }, { status: 400 });
    }

    // Aktuellen PaymentIntent holen
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Status prüfen — nur wenn noch update-fähig
    if (!["requires_payment_method", "requires_confirmation", "requires_action"].includes(intent.status)) {
      return NextResponse.json({ error: `PaymentIntent hat Status ${intent.status}, kein Update möglich` }, { status: 400 });
    }

    // Basis-Betrag ermitteln: aktueller Betrag minus eventuell bereits applied Bump
    const currentBumpCents = parseInt(intent.metadata?.order_bump_amount_cents || "0", 10) || 0;
    const baseAmount = intent.amount - currentBumpCents;

    const wantBump = orderBump === true || orderBump === "true";
    const newAmount = wantBump ? baseAmount + ORDER_BUMP_PRICE_CENTS : baseAmount;

    // Nur updaten wenn sich was ändert
    if (newAmount === intent.amount) {
      return NextResponse.json({
        success: true,
        amount: intent.amount,
        orderBump: wantBump,
        unchanged: true
      });
    }

    const planNames: Record<string, string> = {
      '1month': '1-Monats-Plan',
      '3month': '3-Monats-Plan',
      '6month': '6-Monats-Plan'
    };
    const plan = intent.metadata?.plan || '1month';
    const dogName = intent.metadata?.dog_name || 'Hund';
    const effectiveProblem = bumpProblem || intent.metadata?.bump_problem || "default";
    const bumpId = `intensiv_${effectiveProblem}`;
    const description = wantBump
      ? `Pfoten-Plan ${planNames[plan] || plan} + Intensiv-Modul für ${dogName}`
      : `Pfoten-Plan ${planNames[plan] || plan} für ${dogName}`;

    const updated = await stripe.paymentIntents.update(paymentIntentId, {
      amount: newAmount,
      description,
      metadata: {
        ...intent.metadata,
        order_bump: wantBump ? bumpId : "",
        order_bump_amount_cents: wantBump ? String(ORDER_BUMP_PRICE_CENTS) : "0",
        bump_problem: effectiveProblem,
      },
    });

    return NextResponse.json({
      success: true,
      amount: updated.amount,
      orderBump: wantBump,
    });
  } catch (error: any) {
    console.error("Update-Bump Error:", error);
    return NextResponse.json(
      { error: error.message || "Update fehlgeschlagen" },
      { status: 500 }
    );
  }
}
