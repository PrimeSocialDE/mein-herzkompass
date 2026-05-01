import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getMollie } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Analog zu /api/verify-payment (Stripe), aber für Mollie.
// Frontend kann hierüber serverseitig den Payment-Status prüfen,
// ohne sich auf URL-Parameter verlassen zu müssen.

export async function POST(req: NextRequest) {
  const mollie = getMollie();
  if (!mollie) {
    return NextResponse.json(
      { paid: false, error: "Mollie nicht konfiguriert" },
      { status: 500 }
    );
  }

  try {
    const { orderId, paymentId } = await req.json();
    if (!orderId || !paymentId) {
      return NextResponse.json(
        { paid: false, error: "Fehlende Parameter (orderId, paymentId)" },
        { status: 400 }
      );
    }

    let payment;
    try {
      payment = await mollie.payments.get(paymentId);
    } catch (err) {
      return NextResponse.json(
        { paid: false, error: "Ungültige Payment-ID" },
        { status: 400 }
      );
    }

    // Sicherheitscheck: gehört Payment zur Order?
    const meta = (payment.metadata || {}) as Record<string, any>;
    const metaOrderId = meta.lead_id || meta.order_id;
    if (metaOrderId !== orderId) {
      return NextResponse.json(
        { paid: false, error: "Payment gehört nicht zur Order" },
        { status: 400 }
      );
    }

    const isPaid = payment.status === "paid" || payment.status === "authorized";

    if (isPaid) {
      // Order in DB als paid markieren — falls Webhook noch nicht durchgelaufen ist
      const updateData: any = {
        status: "paid",
        paid_at: new Date().toISOString(),
        mollie_payment_id: paymentId,
        payment_provider: "mollie",
      };
      // Versuche zuerst orders, fall back auf wauwerk_leads
      const { error: orderErr } = await supabase
        .from("orders")
        .update({
          ...updateData,
          due_at: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", orderId);
      if (orderErr) {
        await supabase
          .from("wauwerk_leads")
          .update(updateData)
          .eq("id", orderId);
      }
      return NextResponse.json({ paid: true, status: payment.status });
    }

    return NextResponse.json({ paid: false, status: payment.status });
  } catch (error: any) {
    console.error("Mollie verify-payment Error:", error);
    return NextResponse.json(
      { paid: false, error: error?.message || "Verification failed" },
      { status: 500 }
    );
  }
}
