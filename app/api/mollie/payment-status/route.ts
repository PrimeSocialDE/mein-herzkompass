// Minimaler Status-Endpoint fuer In-Place-Checkout im Mitgliederbereich.
// Frontend pollt nach Card-Submit bis status=paid (oder failed).
// Im Gegensatz zu verify-payment erwartet KEINE orderId — checkt
// nur den Mollie-Status. Webhook bleibt verantwortlich fuer DB-Updates.

import { NextRequest, NextResponse } from "next/server";
import { getMollie } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const mollie = getMollie();
  if (!mollie) {
    return NextResponse.json(
      { error: "Mollie nicht konfiguriert" },
      { status: 500 }
    );
  }

  try {
    const { paymentId } = await req.json();
    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json(
        { error: "paymentId fehlt" },
        { status: 400 }
      );
    }

    const payment = await mollie.payments.get(paymentId);
    const status = payment.status;
    const isPaid = status === "paid" || status === "authorized";
    const isPending = status === "open" || status === "pending";
    const isFailed =
      status === "failed" || status === "canceled" || status === "expired";

    return NextResponse.json({
      paid: isPaid,
      pending: isPending,
      failed: isFailed,
      status,
      checkoutUrl: !isPaid ? payment.getCheckoutUrl() : null,
    });
  } catch (err: any) {
    console.error("[payment-status] error:", err);
    return NextResponse.json(
      { error: err?.message || "Status check failed" },
      { status: 500 }
    );
  }
}
