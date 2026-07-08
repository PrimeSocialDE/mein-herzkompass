// /api/mollie/abo-checkout — startet das "Pfoten-Plan Club"-Abo
// (7,99 EUR/Monat, KEIN Gratis-Test).
//
// Faelle:
//  (A) Mitglied hat schon ein gueltiges Mandate (aus einem frueheren Kauf)
//      -> Subscription DIREKT anlegen (startDate = heute => erste Abbuchung
//         sofort), Club sofort aktivieren, Notfall-Karten anstossen. { ok:true }
//  (B) Kein Mandate -> Customer + "first"-Zahlung (7,99) per Redirect. Der
//      Webhook legt nach "paid" die Subscription an (startDate +1 Monat, damit
//      nicht doppelt gebucht wird) und aktiviert den Club. { checkoutUrl }

import { NextRequest, NextResponse } from "next/server";
import { getMollie } from "@/lib/mollie";
import { supabase } from "@/lib/db";
import {
  CLUB_PRICE_EUR,
  CLUB_DESCRIPTION,
  activateClubForLead,
} from "@/lib/club";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://www.pfoten-plan.de";
  return raw
    .replace(/^http:\/\//, "https://")
    .replace(/\/+$/, "")
    .replace(/:\/\/pfoten-plan\.de/, "://www.pfoten-plan.de");
}

// Notfall-Karten fuer den Hund anstossen (best-effort; www-URL, kein apex).
async function triggerNotfallkarten(email: string, dogName?: string | null) {
  try {
    await fetch(`${siteUrl()}/api/notfall-karten/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, dogName: dogName || "deinen Hund" }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error("[abo-checkout] Notfall-Karten-Trigger fehlgeschlagen:", (e as any)?.message);
  }
}

export async function POST(req: NextRequest) {
  const mollie = getMollie();
  if (!mollie) {
    return NextResponse.json({ error: "Mollie nicht konfiguriert" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").toLowerCase().trim();
  const dogName = (body?.dogName as string | undefined) || null;
  let leadId = (body?.leadId as string | undefined) || undefined;
  if (!email) return NextResponse.json({ error: "email fehlt" }, { status: 400 });

  // Lead holen (Customer/Mandate liegen hier)
  let lead: any = null;
  if (leadId) {
    const { data } = await supabase.from("wauwerk_leads").select("*").eq("id", leadId).maybeSingle();
    lead = data;
  }
  if (!lead) {
    const { data } = await supabase
      .from("wauwerk_leads")
      .select("*")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lead = data;
    leadId = lead?.id;
  }
  if (!leadId) {
    return NextResponse.json({ error: "Kein Lead zu dieser E-Mail gefunden" }, { status: 404 });
  }

  const existingCustomerId = lead?.mollie_customer_id || null;
  const existingMandateId = lead?.mollie_mandate_id || null;

  try {
    // ── Fall A: gueltiges Mandate -> Subscription direkt ─────────────────
    if (existingCustomerId && existingMandateId) {
      let mandateValid = false;
      try {
        const mandate = await (mollie as any).customerMandates.get(existingMandateId, {
          customerId: existingCustomerId,
        });
        mandateValid = mandate?.status === "valid";
      } catch {
        mandateValid = false;
      }

      if (mandateValid) {
        const sub = await (mollie as any).customerSubscriptions.create({
          customerId: existingCustomerId,
          amount: { currency: "EUR", value: CLUB_PRICE_EUR },
          interval: "1 month",
          description: CLUB_DESCRIPTION,
          mandateId: existingMandateId,
          webhookUrl: `${siteUrl()}/api/mollie/webhook`,
          metadata: { kind: "club_sub", email, lead_id: leadId },
        });

        await activateClubForLead(leadId, {
          subscriptionId: sub?.id || null,
          customerId: existingCustomerId,
          email,
        });
        await triggerNotfallkarten(email, dogName);

        return NextResponse.json({ ok: true, subscriptionId: sub?.id });
      }
    }

    // ── Fall B: kein Mandate -> Erstzahlung per Redirect ─────────────────
    let customerId = existingCustomerId;
    if (!customerId) {
      const customer = await mollie.customers.create({
        email,
        name: dogName ? `Halter von ${dogName}` : email,
      });
      customerId = customer.id;
      await supabase.from("wauwerk_leads").update({ mollie_customer_id: customerId }).eq("id", leadId);
    }

    const payment = await mollie.payments.create({
      amount: { currency: "EUR", value: CLUB_PRICE_EUR },
      description: CLUB_DESCRIPTION,
      redirectUrl: `${siteUrl()}/mitglieder?club=1`,
      webhookUrl: `${siteUrl()}/api/mollie/webhook`,
      customerId,
      sequenceType: "first",
      metadata: {
        kind: "club_first",
        email,
        lead_id: leadId,
        dog_name: dogName,
      },
    } as any);

    const checkoutUrl = (payment as any)?._links?.checkout?.href;
    if (!checkoutUrl) {
      return NextResponse.json({ error: "Kein Checkout-Link erhalten" }, { status: 502 });
    }
    return NextResponse.json({ checkoutUrl });
  } catch (e: any) {
    console.error("[abo-checkout] error:", e?.message || e);
    return NextResponse.json({ error: e?.message || "Abo-Start fehlgeschlagen" }, { status: 500 });
  }
}
