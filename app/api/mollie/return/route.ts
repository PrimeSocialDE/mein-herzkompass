import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getMollie } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mollie redirected nach Abschluss IMMER hierhin (paid/canceled/failed/expired).
// Wir prüfen den Status und leiten dann zur passenden Frontend-Seite weiter:
//   paid  → /zusatz.html?lead_id=...&redirect_status=succeeded
//   sonst → cancelUrl (oder /deinplan3.html?redirect_status=canceled als Fallback)
//
// So bleibt zusatz.html unverändert kompatibel zur bestehenden Stripe-Logik.

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const leadId = url.searchParams.get("lead_id") || "";
  const cancelUrl =
    url.searchParams.get("cancel") || `${url.origin}/deinplan3.html?redirect_status=canceled`;

  const mollie = getMollie();
  if (!mollie || !leadId) {
    return NextResponse.redirect(cancelUrl, { status: 303 });
  }

  // Lead holen → Mollie Payment ID
  const { data: lead } = await supabase
    .from("wauwerk_leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (!lead?.mollie_payment_id) {
    console.error(`[mollie-return] Kein mollie_payment_id für lead ${leadId}`);
    return NextResponse.redirect(cancelUrl, { status: 303 });
  }

  let isPaid = false;
  let payment: any = null;
  try {
    payment = await mollie.payments.get(lead.mollie_payment_id);
    isPaid = payment.status === "paid" || payment.status === "authorized";
    console.log(
      `[mollie-return] lead=${leadId} payment=${lead.mollie_payment_id} status=${payment.status}`
    );
  } catch (err) {
    console.error("[mollie-return] Mollie API Fehler:", err);
    return NextResponse.redirect(cancelUrl, { status: 303 });
  }

  if (isPaid) {
    // ── Safety-Net: Webhook könnte verloren gegangen sein. ─────────────
    // Wir checken hier ob der Lead schon prozessiert wurde (per payment.id-
    // Idempotenz). Wenn NICHT: DB-Update + Make.com-Trigger nachholen.
    // Idempotent — wenn der Webhook später doch noch kommt, wird er
    // skippen (gleicher payment.id im processed_payment_ids).
    try {
      const prevAnswers = (lead.answers || {}) as Record<string, any>;
      const processedIds: string[] = Array.isArray(prevAnswers.processed_payment_ids)
        ? prevAnswers.processed_payment_ids
        : [];

      if (!processedIds.includes(lead.mollie_payment_id)) {
        console.log(
          `[mollie-return] Safety-Net triggert: payment ${lead.mollie_payment_id} ` +
            `noch nicht von Webhook prozessiert — hole nach`
        );

        // DB updaten: status=paid + paid_at + payment_id in processed-Liste
        const updateData: any = {
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_provider: "mollie",
          answers: {
            ...prevAnswers,
            processed_payment_ids: [...processedIds, lead.mollie_payment_id],
            paid_via_safety_net_at: new Date().toISOString(),
          },
        };

        await supabase
          .from("wauwerk_leads")
          .update(updateData)
          .eq("id", leadId);

        // Make.com triggern (Plan-Versand)
        const makeUrl = process.env.MAKE_WEBHOOK_URL;
        if (makeUrl) {
          try {
            await fetch(makeUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: leadId,
                source: "mollie.return.safety_net",
                table: "wauwerk_leads",
                email: lead.email || (payment?.metadata?.email ?? null),
                name: lead.customer_name || null,
                mollie_payment_id: lead.mollie_payment_id,
                method: payment?.method,
              }),
            });
            console.log(`[mollie-return] Safety-Net: Make.com getriggert`);
          } catch (e) {
            console.error("[mollie-return] Safety-Net Make-Fehler:", e);
          }
        }
      }
    } catch (e) {
      console.error("[mollie-return] Safety-Net Exception:", e);
      // Trotz Fehler weiterleiten — User darf nicht hängen bleiben
    }

    const successUrl =
      `${url.origin}/zusatz.html` +
      `?lead_id=${encodeURIComponent(leadId)}` +
      `&redirect_status=succeeded` +
      `&mollie_payment_id=${encodeURIComponent(lead.mollie_payment_id)}`;
    return NextResponse.redirect(successUrl, { status: 303 });
  }

  return NextResponse.redirect(cancelUrl, { status: 303 });
}
