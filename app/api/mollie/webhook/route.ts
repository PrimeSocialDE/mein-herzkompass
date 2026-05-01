import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getMollie } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mollie sendet keinen Event-Body, sondern ruft uns nur mit der Payment-ID an.
// Wir holen den vollen Payment-Status per API ab und dispatchen je nach Status.
// Idempotenz: wir bauen alle Updates so, dass sie mehrfach auslösbar sind ohne Schaden.

export async function POST(req: NextRequest) {
  const mollie = getMollie();
  if (!mollie) {
    console.error("[mollie-webhook] Mollie nicht konfiguriert");
    // 200 zurückgeben damit Mollie nicht endlos retried bei Konfig-Fehler
    return NextResponse.json({ ok: false, reason: "not_configured" });
  }

  let paymentId: string | null = null;
  try {
    // Mollie schickt application/x-www-form-urlencoded mit body "id=tr_xxx"
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const j = await req.json();
      paymentId = j?.id || null;
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      paymentId = params.get("id");
    }
  } catch (e) {
    console.error("[mollie-webhook] Body-Parsing fehlgeschlagen:", e);
  }

  if (!paymentId) {
    console.error("[mollie-webhook] Keine Payment-ID im Body");
    return NextResponse.json({ ok: false, reason: "no_id" });
  }

  console.log(`[mollie-webhook] Eingehend: ${paymentId}`);

  try {
    const payment = await mollie.payments.get(paymentId);
    console.log(
      `[mollie-webhook] Status: ${payment.status} | Method: ${payment.method} | Amount: ${payment.amount?.value}`
    );

    switch (payment.status) {
      case "paid":
        await handlePaid(payment);
        break;
      case "failed":
      case "canceled":
      case "expired":
        await handleNonSuccess(payment);
        break;
      case "open":
      case "pending":
      case "authorized":
        // Noch nicht final — nichts tun, Mollie ruft uns wieder
        console.log(
          `[mollie-webhook] ${paymentId} noch nicht final (${payment.status}) — warten`
        );
        break;
      default:
        console.log(
          `[mollie-webhook] Unbehandelter Status: ${payment.status}`
        );
    }
  } catch (err: any) {
    console.error("[mollie-webhook] Verarbeitungsfehler:", err);
    // 500 → Mollie retried in steigenden Abständen (gut für transiente Fehler)
    return NextResponse.json(
      { ok: false, error: err?.message || "processing_error" },
      { status: 500 }
    );
  }

  // Mollie erwartet 2xx — sonst retried sie. Body ist egal.
  return NextResponse.json({ ok: true });
}

// ── Hauptpfad: Zahlung erfolgreich ───────────────────────────────────────────
async function handlePaid(payment: any) {
  const meta = (payment.metadata || {}) as Record<string, any>;
  const isUpsell = meta.type === "upsell";
  const isPremium = meta.type === "premium";
  const isUpsellProduct = meta.type === "upsell_product";

  if (isUpsell || isPremium) {
    await handleUpsellPaid(payment);
    return;
  }

  if (isUpsellProduct) {
    await handleUpsellProductPaid(payment);
    return;
  }

  const referenceId = meta.lead_id || meta.order_id;
  if (!referenceId) {
    console.error(
      `[mollie-webhook] Keine Reference-ID in Metadata für ${payment.id}`
    );
    return;
  }

  const { table, data: existingRecord } = await findLeadOrOrder(referenceId);
  if (!table) {
    console.error(
      `[mollie-webhook] Reference-ID ${referenceId} weder in wauwerk_leads noch orders gefunden`
    );
    return;
  }

  // Bump IMMER zuerst versuchen (Idempotenz via answers.order_bump_delivered_at).
  // Auch wenn Lead bereits paid ist — falls Bump-Delivery beim ersten Mal scheiterte.
  await deliverOrderBumpIfPurchased(payment, existingRecord);

  if (existingRecord.status === "paid") {
    console.log(
      `[mollie-webhook] ${referenceId} bereits paid — überspringe DB-Update`
    );
    return;
  }

  // Mollie liefert Customer-Daten je nach Methode unterschiedlich
  const customerEmail = extractEmail(payment) || existingRecord.email;
  const customerName = extractName(payment) || null;

  const updateData: any = {
    status: "paid",
    paid_at: new Date().toISOString(),
    mollie_payment_id: payment.id,
    payment_provider: "mollie",
  };

  if (customerEmail) updateData.email = customerEmail;
  if (customerName) {
    if (table === "wauwerk_leads") updateData.customer_name = customerName;
    else updateData.name = customerName;
  }

  if (table === "orders") {
    updateData.due_at = new Date(
      Date.now() + 10 * 60 * 60 * 1000
    ).toISOString();
  }

  const { error } = await supabase
    .from(table)
    .update(updateData)
    .eq("id", referenceId);

  if (error) {
    console.error("[mollie-webhook] Supabase Update Error:", error);
    return;
  }

  console.log(
    `[mollie-webhook] ${table} ${referenceId} → paid (${payment.method})`
  );

  await enrollInUpsellCampaign(table, referenceId, updateData.email);
  await sendNotfallkartenIfBonus(table, referenceId);
  await notifyMake(referenceId, {
    source: "mollie.payment",
    table,
    email: updateData.email ?? null,
    name: updateData.name ?? updateData.customer_name ?? null,
    mollie_payment_id: payment.id,
    method: payment.method,
  });
}

// ── Upsell-Pfad ──────────────────────────────────────────────────────────────
async function handleUpsellPaid(payment: any) {
  const meta = (payment.metadata || {}) as Record<string, any>;
  const leadId = meta.lead_id;
  const module = meta.module;
  const email = meta.email || extractEmail(payment);
  const isPremium = meta.is_premium === "true" || meta.type === "premium";

  if (!leadId && !email) {
    console.error("[mollie-webhook] Upsell ohne lead_id und email — skip");
    return;
  }

  let leadData: any = null;
  if (leadId) {
    const { data } = await supabase
      .from("wauwerk_leads")
      .select("*")
      .eq("id", leadId)
      .single();
    leadData = data;
  }
  if (!leadData && email) {
    const { data } = await supabase
      .from("wauwerk_leads")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    leadData = data;
  }

  if (!leadData) {
    console.error("[mollie-webhook] Upsell: Lead nicht gefunden");
    return;
  }

  let existingModules: string[] = [];
  if (leadData.upsell_modules) {
    if (Array.isArray(leadData.upsell_modules))
      existingModules = leadData.upsell_modules;
    else if (typeof leadData.upsell_modules === "string")
      existingModules = leadData.upsell_modules.split(",").filter(Boolean);
  }
  const newModules = module ? String(module).split("+") : [];
  if (isPremium) newModules.push("premium");
  const allModules = [...new Set([...existingModules, ...newModules])];

  await supabase
    .from("wauwerk_leads")
    .update({
      upsell_modules: allModules,
      upsell_paid_at: new Date().toISOString(),
      mollie_upsell_payment_id: payment.id,
    })
    .eq("id", leadData.id);

  if (module === "notfall-karten" && (email || leadData.email)) {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL &&
        !process.env.NEXT_PUBLIC_BASE_URL.includes("localhost")
          ? process.env.NEXT_PUBLIC_BASE_URL
          : "https://www.pfoten-plan.de";
      await fetch(`${baseUrl}/api/notfall-karten/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email || leadData.email,
          dogName: meta.dog_name || leadData.dog_name || "deinen Hund",
          leadId: leadData.id,
        }),
      });
    } catch (e) {
      console.error("[mollie-webhook] Notfall-Karten Delivery Error:", e);
    }
  }

  await notifyMake(leadData.id, {
    source: "mollie.upsell",
    type: isPremium ? "premium" : "upsell",
    module,
    modules: allModules,
    email: email || leadData.email,
    mollie_payment_id: payment.id,
  });
}

// ── Upsell-Product-Pfad (ernaehrung/zweithund/abo/reise/erstehilfe) ──────────
async function handleUpsellProductPaid(payment: any) {
  const meta = (payment.metadata || {}) as Record<string, any>;
  const product = meta.product;
  const leadId = meta.lead_id;
  const email = meta.email || extractEmail(payment);
  const dogName = meta.dog_name || "deinen Hund";

  if (!product || !email) {
    console.error("[mollie-webhook] upsell_product ohne product/email — skip");
    return;
  }

  // Lead finden (optional — manche Käufe haben evtl. keinen lead_id)
  let leadData: any = null;
  if (leadId) {
    const { data } = await supabase
      .from("wauwerk_leads")
      .select("*")
      .eq("id", leadId)
      .single();
    leadData = data;
  }
  if (!leadData && email) {
    const { data } = await supabase
      .from("wauwerk_leads")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    leadData = data;
  }

  // upsell_modules erweitern um product_<type> — Hauptstatus wird NICHT geändert
  if (leadData) {
    let existingModules: string[] = [];
    if (leadData.upsell_modules) {
      if (Array.isArray(leadData.upsell_modules))
        existingModules = leadData.upsell_modules;
      else if (typeof leadData.upsell_modules === "string")
        existingModules = leadData.upsell_modules.split(",").filter(Boolean);
    }
    const productKey = `product_${product}`;
    const allModules = [...new Set([...existingModules, productKey])];

    await supabase
      .from("wauwerk_leads")
      .update({
        upsell_modules: allModules,
        upsell_paid_at: new Date().toISOString(),
        mollie_upsell_payment_id: payment.id,
      })
      .eq("id", leadData.id);
  }

  // Notify Make.com — Make übernimmt PDF-Generierung + E-Mail-Versand für Produkte
  await notifyMake(leadData?.id || email, {
    source: "mollie.upsell_product",
    type: "upsell_product",
    product,
    email,
    dog_name: dogName,
    lead_id: leadData?.id || null,
    mollie_payment_id: payment.id,
  });
}

// ── Failure-Pfad ─────────────────────────────────────────────────────────────
async function handleNonSuccess(payment: any) {
  const meta = (payment.metadata || {}) as Record<string, any>;
  const referenceId = meta.lead_id || meta.order_id;
  if (!referenceId) return;

  const { table } = await findLeadOrOrder(referenceId);
  if (!table) return;

  await supabase
    .from(table)
    .update({
      status: "failed",
      mollie_payment_id: payment.id,
      payment_provider: "mollie",
    })
    .eq("id", referenceId);

  console.log(
    `[mollie-webhook] ${table} ${referenceId} → failed (${payment.status})`
  );
}

// ── Helpers (1:1 portiert vom Stripe-Webhook) ────────────────────────────────

async function findLeadOrOrder(
  id: string
): Promise<{ table: "wauwerk_leads" | "orders" | null; data: any }> {
  const { data: lead } = await supabase
    .from("wauwerk_leads")
    .select("*")
    .eq("id", id)
    .single();
  if (lead) return { table: "wauwerk_leads", data: lead };

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();
  if (order) return { table: "orders", data: order };

  return { table: null, data: null };
}

function extractEmail(payment: any): string | null {
  return (
    payment?.details?.consumerEmail ||
    payment?.details?.billingEmail ||
    payment?.metadata?.email ||
    null
  );
}

function extractName(payment: any): string | null {
  return (
    payment?.details?.consumerName ||
    payment?.details?.cardHolder ||
    payment?.details?.billingName ||
    null
  );
}

async function deliverOrderBumpIfPurchased(payment: any, leadRecord: any) {
  const meta = (payment.metadata || {}) as Record<string, any>;
  const bumpId = meta.order_bump;
  if (!bumpId) return;

  const email = meta.email || extractEmail(payment) || leadRecord?.email;
  const dogName =
    meta.dog_name || leadRecord?.dog_name || "deinen Hund";
  const leadId = meta.lead_id || leadRecord?.id;

  if (!email) {
    console.error(
      `[mollie-webhook] Bump gekauft aber keine Email: ${payment.id}`
    );
    return;
  }

  // Idempotenz-Check via answers
  if (leadId) {
    try {
      const { data: lead } = await supabase
        .from("wauwerk_leads")
        .select("answers")
        .eq("id", leadId)
        .single();
      const answers = (lead?.answers || {}) as Record<string, any>;
      if (answers.order_bump_delivered_at) {
        console.log(
          `[mollie-webhook] Bump bereits geliefert an ${email} — skip`
        );
        return;
      }
    } catch {
      // Egal, dann liefern wir notfalls
    }
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL &&
    !process.env.NEXT_PUBLIC_BASE_URL.includes("localhost")
      ? process.env.NEXT_PUBLIC_BASE_URL
      : "https://pfoten-plan.de";

  if (bumpId === "notfallkarten") {
    try {
      const res = await fetch(`${baseUrl}/api/notfall-karten/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, dogName }),
      });
      if (res.ok && leadId) {
        const { data: lead } = await supabase
          .from("wauwerk_leads")
          .select("answers")
          .eq("id", leadId)
          .single();
        const prev = (lead?.answers || {}) as Record<string, any>;
        await supabase
          .from("wauwerk_leads")
          .update({
            answers: {
              ...prev,
              order_bump_delivered: "notfallkarten",
              order_bump_delivered_at: new Date().toISOString(),
              notfallkarten_sent_at: new Date().toISOString(),
            },
          })
          .eq("id", leadId);
      }
    } catch (e) {
      console.error("[mollie-webhook] Notfallkarten-Bump Error:", e);
    }
    return;
  }

  if (bumpId === "tagebuch") {
    try {
      const bumpDays = parseInt(meta.bump_days || "30", 10) || 30;
      const res = await fetch(`${baseUrl}/api/tagebuch/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, dogName, leadId, bumpDays }),
      });
      if (res.ok && leadId) {
        const { data: lead } = await supabase
          .from("wauwerk_leads")
          .select("answers")
          .eq("id", leadId)
          .single();
        const prev = (lead?.answers || {}) as Record<string, any>;
        await supabase
          .from("wauwerk_leads")
          .update({
            answers: {
              ...prev,
              order_bump_delivered: "tagebuch",
              order_bump_delivered_at: new Date().toISOString(),
              order_bump_amount_cents: meta.order_bump_amount_cents || "0",
              tagebuch_weeks:
                bumpDays >= 180 ? 24 : bumpDays >= 90 ? 12 : 4,
              tagebuch_sent_at: new Date().toISOString(),
            },
          })
          .eq("id", leadId);
      }
    } catch (e) {
      console.error("[mollie-webhook] Tagebuch-Bump Error:", e);
    }
  }
}

async function sendNotfallkartenIfBonus(table: string, leadId: string) {
  if (table !== "wauwerk_leads") return;
  try {
    const { data: lead } = await supabase
      .from("wauwerk_leads")
      .select("email, dog_name, answers")
      .eq("id", leadId)
      .single();
    if (!lead || !lead.email) return;
    const answers = (lead.answers || {}) as Record<string, any>;
    if (!answers.exit_bonus_notfallkarten) return;
    if (answers.notfallkarten_sent_at) return;

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL &&
      !process.env.NEXT_PUBLIC_BASE_URL.includes("localhost")
        ? process.env.NEXT_PUBLIC_BASE_URL
        : "https://pfoten-plan.de";
    const res = await fetch(`${baseUrl}/api/notfall-karten/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: lead.email,
        dogName: lead.dog_name || "deinen Hund",
      }),
    });
    if (res.ok) {
      await supabase
        .from("wauwerk_leads")
        .update({
          answers: {
            ...answers,
            notfallkarten_sent_at: new Date().toISOString(),
          },
        })
        .eq("id", leadId);
    }
  } catch (e) {
    console.error("[mollie-webhook] Notfallkarten-Bonus Error:", e);
  }
}

async function enrollInUpsellCampaign(
  table: string,
  leadId: string,
  email: string | null | undefined
) {
  if (table !== "wauwerk_leads" || !email) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("upsell_schedule").insert({
      lead_id: leadId,
      user_email: email,
      upsell_start_date: today,
      source: "new",
    });
    if (
      error &&
      !String(error.message || "").toLowerCase().includes("duplicate")
    ) {
      console.error("[mollie-webhook] Upsell enroll error:", error);
    }
  } catch (e) {
    console.error("[mollie-webhook] Upsell enroll exception:", e);
  }
}

async function notifyMake(orderId: string, payload: Record<string, any>) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, ...payload }),
    });
  } catch (e) {
    console.error("[mollie-webhook] Make-Webhook Fehler:", e);
  }
}

// GET: Mollie schickt initial einen GET zur Webhook-Validierung
export async function GET() {
  return NextResponse.json({ ok: true });
}
