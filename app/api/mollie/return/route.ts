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
    .select("mollie_payment_id, status")
    .eq("id", leadId)
    .single();

  if (!lead?.mollie_payment_id) {
    console.error(`[mollie-return] Kein mollie_payment_id für lead ${leadId}`);
    return NextResponse.redirect(cancelUrl, { status: 303 });
  }

  let isPaid = false;
  try {
    const payment = await mollie.payments.get(lead.mollie_payment_id);
    isPaid = payment.status === "paid" || payment.status === "authorized";
    console.log(
      `[mollie-return] lead=${leadId} payment=${lead.mollie_payment_id} status=${payment.status}`
    );
  } catch (err) {
    console.error("[mollie-return] Mollie API Fehler:", err);
    return NextResponse.redirect(cancelUrl, { status: 303 });
  }

  if (isPaid) {
    const successUrl =
      `${url.origin}/zusatz.html` +
      `?lead_id=${encodeURIComponent(leadId)}` +
      `&redirect_status=succeeded` +
      `&mollie_payment_id=${encodeURIComponent(lead.mollie_payment_id)}`;
    return NextResponse.redirect(successUrl, { status: 303 });
  }

  return NextResponse.redirect(cancelUrl, { status: 303 });
}
