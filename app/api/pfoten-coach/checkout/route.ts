// app/api/pfoten-coach/checkout/route.ts
//
// Checkout fuer den 19,99-EUR-Audio-Coach ("Coach nebenbei"). Bewusst ISOLIERT
// vom Haupt-Funnel: eigener, dedizierter Webhook (/api/pfoten-coach/webhook) —
// der zentrale Mollie-Webhook bleibt unberuehrt (null Risiko fuers Main Business).
// Kein Intake noetig: die Audios werden spaeter aus dem bestehenden Plan des
// Kunden generiert. Wir verknuepfen nur per E-Mail/Lead + Metadaten.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getMollie, formatAmountEUR, Locale } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRICE_CENTS = 1999;

export async function POST(req: NextRequest) {
  const mollie = getMollie();
  if (!mollie) return NextResponse.json({ error: "Mollie nicht konfiguriert" }, { status: 500 });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim();
    const dogName = String(body?.dogName || body?.dog || "dein Hund").slice(0, 40);
    if (!email) return NextResponse.json({ error: "E-Mail nötig" }, { status: 400 });

    // Neuesten Lead per E-Mail finden (nur zum Verknuepfen — kein Intake).
    let leadId = "";
    const { data: lead } = await supabase
      .from("wauwerk_leads")
      .select("id")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lead?.id) leadId = String(lead.id);

    const base =
      process.env.NEXT_PUBLIC_BASE_URL && !process.env.NEXT_PUBLIC_BASE_URL.includes("localhost")
        ? process.env.NEXT_PUBLIC_BASE_URL
        : "https://pfoten-plan.de";

    const payment = await mollie.payments.create({
      amount: { currency: "EUR", value: formatAmountEUR(PRICE_CENTS) },
      description: `Pfoten-Plan Audio-Coach für ${dogName}`.slice(0, 255),
      redirectUrl: `${base}/pfoten-coach-danke?dog=${encodeURIComponent(dogName)}`,
      webhookUrl: `${base}/api/pfoten-coach/webhook`,
      locale: Locale.de_DE,
      metadata: {
        type: "pfoten-coach",
        lead_id: leadId,
        email,
        dog_name: dogName,
      },
    });

    const url = payment.getCheckoutUrl();
    if (!url) return NextResponse.json({ error: "Mollie Checkout-URL fehlt" }, { status: 500 });

    return NextResponse.json({ checkoutUrl: url, paymentId: payment.id });
  } catch (err: any) {
    console.error("[pfoten-coach/checkout] error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Checkout fehlgeschlagen" }, { status: 500 });
  }
}
