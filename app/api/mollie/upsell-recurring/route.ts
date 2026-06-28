// One-Click-Post-Purchase-Upsell via Mollie Mandate (Recurring Payment).
//
// Voraussetzung: Beim Erstkauf via /api/mollie/wauwerk-checkout wurde
// customerId + sequenceType='first' gesetzt → der Webhook hat mandateId
// in wauwerk_leads.mollie_mandate_id gespeichert.
//
// Diese Route chargt mit sequenceType='recurring' SOFORT die hinterlegte
// Methode — kein Mollie-Redirect, kein zweiter Checkout. Erfolg in <2s.
//
// Wenn kein Mandate vorhanden (z.B. Erstkauf mit ApplePay/GooglePay/Klarna
// → kein recurring moeglich): returnt 409 + fallback_to_redirect=true.
// Frontend leitet dann auf den klassischen /api/mollie/upsell-checkout.

import { NextRequest, NextResponse } from "next/server";
import { getMollie, formatAmountEUR, Locale } from "@/lib/mollie";
import { createClient } from "@supabase/supabase-js";
import { utmMetaFromAnswers } from "@/lib/attribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const moduleNames: Record<string, string> = {
  anxiety: "Trennungsangst Prävention",
  pulling: "Leinenführigkeit Basics",
  barking: "Anti-Bell Training",
  aggression: "Aggressions-Kontrolle",
  recall: "Rückruf-Training",
  jumping: "Anti-Anspring Training",
  energy: "Energie-Management",
  destructive: "Anti-Zerstörungs Training",
  mouthing: "Anti-Aufnehm Training",
  "video-analyse": "Persönliche Video-Analyse",
  "notfall-karten": "10 Notfall-Karten",
  "hund-verstehen": "Dein Hund verstehen — persönliches Profil",
};

export async function POST(req: NextRequest) {
  const mollie = getMollie();
  if (!mollie) {
    return NextResponse.json(
      { error: "Mollie nicht konfiguriert" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const module = body.module as string | undefined;
    const leadId = body.leadId as string | undefined;
    const email = (body.email as string | undefined)?.toLowerCase().trim();
    const dogName = body.dogName as string | undefined;
    const bundle = body.bundle as boolean | undefined;
    const price = body.price as number | undefined;

    if (!module || !email) {
      return NextResponse.json(
        { error: "module + email Pflicht" },
        { status: 400 }
      );
    }

    // Lead + Mandate aus DB lookup
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    let lead: any = null;
    if (leadId) {
      const { data } = await supabase
        .from("wauwerk_leads")
        .select(
          "id, email, dog_name, mollie_customer_id, mollie_mandate_id, mollie_payment_method, referred_by_code, answers"
        )
        .eq("id", leadId)
        .maybeSingle();
      lead = data;
    }
    if (!lead) {
      const { data } = await supabase
        .from("wauwerk_leads")
        .select(
          "id, email, dog_name, mollie_customer_id, mollie_mandate_id, mollie_payment_method, referred_by_code, answers"
        )
        .ilike("email", email)
        .not("mollie_mandate_id", "is", null)
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      lead = data;
    }

    // ── Safety-Net: Mandat fehlt in DB, ist aber evtl. bei Mollie da ──────
    // Race beim Erstkauf (v.a. PayPal): der paid-Webhook feuerte, BEVOR Mollie
    // method/mandateId am Payment gesetzt hatte → mollie_mandate_id blieb null,
    // und die Idempotenz (processed_payment_ids) sperrte den Korrektur-Webhook
    // aus. Beim Upsell (Sekunden nach paid) sind die Mandat-Daten settled. Wir
    // holen das Mandat hier live nach, damit der One-Click greift statt auf den
    // schwächeren Redirect zurückzufallen.
    // WICHTIG: schreibt NUR mollie_*-Spalten zurück → der Plan-Trigger
    // (AFTER UPDATE OF status) feuert NICHT; es gehen keine Pläne/Mails raus.
    if (lead && lead.mollie_customer_id && !lead.mollie_mandate_id) {
      try {
        const mandates = await mollie.customerMandates.page({
          customerId: lead.mollie_customer_id,
        });
        const valid =
          mandates.find((m: any) => m.status === "valid") ||
          mandates.find((m: any) => m.status === "pending") ||
          null;
        if (valid?.id) {
          lead.mollie_mandate_id = valid.id;
          const mandateMethod = (valid as any).method as string | undefined;
          if (!lead.mollie_payment_method && mandateMethod) {
            lead.mollie_payment_method = mandateMethod;
          }
          await supabase
            .from("wauwerk_leads")
            .update({
              mollie_mandate_id: valid.id,
              ...(mandateMethod ? { mollie_payment_method: mandateMethod } : {}),
            })
            .eq("id", lead.id);
          console.log(
            `[upsell-recurring] Mandat live nachgeholt für ${lead.id}: ${valid.id} (${mandateMethod || "?"})`
          );
        }
      } catch (e: any) {
        // Kein Mandat / Lookup-Fehler → unten regulärer 409/Redirect-Fallback
        console.warn(
          `[upsell-recurring] Mandate-Live-Lookup fehlgeschlagen für ${lead.id}: ${e?.message || e}`
        );
      }
    }

    if (!lead?.mollie_customer_id || !lead?.mollie_mandate_id) {
      return NextResponse.json(
        {
          error: "no_mandate",
          fallback_to_redirect: true,
          reason:
            "Kein Mandate fuer diesen Kunden gespeichert (Erstkauf war evtl. ApplePay/GooglePay/Klarna).",
        },
        { status: 409 }
      );
    }

    // Preis-Logik 1:1 zur klassischen upsell-checkout-Route
    const isPremium = module === "premium";
    const isBundle = bundle || module.includes("+");
    let amountCents: number;
    if (price) amountCents = price;
    else if (isPremium) amountCents = 24999;
    else if (isBundle) amountCents = 2499;
    else amountCents = 1999;

    let moduleName: string;
    if (isPremium) {
      moduleName = "Pfoten-Plan Premium - Alle Module + 3 Monate Support";
    } else if (isBundle) {
      const mainModule = module.split("+")[0];
      moduleName =
        "Komplett-Paket: " +
        (moduleNames[mainModule] || mainModule) +
        " + Prävention";
    } else {
      moduleName = moduleNames[module] || "Zusatz-Modul";
    }

    const webhookBase =
      process.env.NEXT_PUBLIC_BASE_URL &&
      !process.env.NEXT_PUBLIC_BASE_URL.includes("localhost")
        ? process.env.NEXT_PUBLIC_BASE_URL
        : "https://pfoten-plan.de";

    const description = `${moduleName} für ${
      dogName || lead.dog_name || "deinen Hund"
    } · kommt sofort per E-Mail`;

    // Recurring-Charge: kein redirectUrl, kein User-Interaction noetig.
    // Mollie chargt sofort gegen die hinterlegte Mandate-Methode.
    // Cast als any weil das Mollie-SDK redirectUrl im Type required hat,
    // bei recurring aber nicht — die API akzeptiert es ohne.
    const recurringParams: any = {
      amount: { currency: "EUR", value: formatAmountEUR(amountCents) },
      description: description.slice(0, 255),
      webhookUrl: `${webhookBase}/api/mollie/webhook`,
      locale: Locale.de_DE,
      customerId: lead.mollie_customer_id,
      mandateId: lead.mollie_mandate_id,
      sequenceType: "recurring",
      metadata: {
        type: isPremium ? "premium" : "upsell",
        module: module,
        module_name: moduleName.slice(0, 80),
        lead_id: lead.id || "",
        dog_name: (dogName || lead.dog_name || "").slice(0, 60),
        email: email,
        is_bundle: isBundle ? "true" : "false",
        is_premium: isPremium ? "true" : "false",
        one_click: "true",
        // First-Touch-Attribution aus dem Lead erben (CRM-Join pro Anzeige)
        ...utmMetaFromAnswers(lead.answers),
      },
    };
    const payment = await mollie.payments.create(recurringParams);

    // Bei recurring landet payment typisch sofort in 'pending' oder 'paid'.
    // 'pending' = Mollie verarbeitet; webhook setzt spaeter status=paid.
    // Frontend zeigt "Hinzugefuegt — wird ausgeliefert" und braucht nicht
    // auf den Webhook warten.
    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      method: payment.method || lead.mollie_payment_method,
    });
  } catch (e: any) {
    console.error("[upsell-recurring] error:", e?.message || e);
    return NextResponse.json(
      {
        error: e?.message || "Recurring-Charge fehlgeschlagen",
        fallback_to_redirect: true,
      },
      { status: 500 }
    );
  }
}
