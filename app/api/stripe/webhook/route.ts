import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Helper: Make nur benachrichtigen wenn URL gesetzt ist
async function notifyMake(orderId: string, payload: Record<string, any>) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, ...payload }),
    });
    console.log("→ Make benachrichtigt");
  } catch (e) {
    console.error("Make-Webhook Fehler:", e);
  }
}

export async function POST(req: NextRequest) {
  if (!stripe || !endpointSecret) {
    console.error("Stripe oder Webhook-Secret fehlt");
    return NextResponse.json({ error: "Stripe nicht konfiguriert" }, { status: 400 });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      console.error("Keine Stripe-Signatur gefunden");
      return NextResponse.json({ error: "Keine Signatur" }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err: any) {
      console.error("Webhook-Signatur-Verifikation fehlgeschlagen:", err.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log(`Stripe Webhook Event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutSuccess(event.data.object as Stripe.Checkout.Session);
        break;

      case "checkout.session.async_payment_failed":
        await handleCheckoutFailed(event.data.object as Stripe.Checkout.Session);
        break;

      case "payment_intent.succeeded":
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "charge.succeeded":
        await handleChargeSuccess(event.data.object as Stripe.Charge);
        break;

      default:
        console.log(`Unbehandelter Event-Typ: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook-Verarbeitungsfehler:", error);
    return NextResponse.json({ error: "Webhook-Verarbeitung fehlgeschlagen" }, { status: 500 });
  }
}

// Helper: Prüfen ob ID zu wauwerk_leads oder orders gehört
async function findLeadOrOrder(id: string): Promise<{ table: 'wauwerk_leads' | 'orders' | null, data: any }> {
  // Erst in wauwerk_leads suchen
  const { data: lead, error: leadError } = await supabase
    .from("wauwerk_leads")
    .select("*")
    .eq("id", id)
    .single();
  
  if (lead && !leadError) {
    console.log("✅ Gefunden in wauwerk_leads");
    return { table: 'wauwerk_leads', data: lead };
  }
  
  // Dann in orders suchen
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();
  
  if (order && !orderError) {
    console.log("✅ Gefunden in orders");
    return { table: 'orders', data: order };
  }
  
  console.log("❌ ID nicht gefunden in wauwerk_leads oder orders");
  return { table: null, data: null };
}

async function handleCheckoutSuccess(session: Stripe.Checkout.Session) {
  console.log("🔍 === CHECKOUT SUCCESS DEBUG ===");
  console.log("🔍 Session ID:", session.id);
  console.log("🔍 Client Reference ID:", session.client_reference_id);
  console.log("🔍 Session Metadata:", JSON.stringify(session.metadata, null, 2));
  
  const referenceId = session.client_reference_id || session.metadata?.order_id;
  console.log("🔍 Extrahierte Reference ID:", referenceId);
  
  if (!referenceId) {
    console.error("❌ Keine Reference-ID in Session gefunden");
    return;
  }

  const { table, data: existingRecord } = await findLeadOrOrder(referenceId);
  
  if (!table) {
    console.error("❌ ID nicht in Datenbank gefunden:", referenceId);
    return;
  }

  // ⬇️ NEU: Skip wenn bereits paid
  if (existingRecord.status === 'paid') {
    console.log(`⚠️ ${referenceId} bereits paid - überspringe (checkout.session)`);
    return;
  }
  
  console.log(`✅ Record gefunden in ${table}:`, JSON.stringify(existingRecord, null, 2));

  let customerEmail = session.customer_email || session.customer_details?.email;
  let customerName = session.customer_details?.name;

  // PayPal-Details aus PaymentIntent abrufen falls nötig
  if (!customerEmail && session.payment_intent && stripe) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        session.payment_intent as string,
        { expand: ['latest_charge'] }
      );
      
      customerEmail = customerEmail || paymentIntent.receipt_email;
      const charge = paymentIntent.latest_charge as Stripe.Charge;
      
      if (charge?.billing_details) {
        customerEmail = customerEmail || charge.billing_details.email;
        customerName = customerName || charge.billing_details.name;
      }

      // PayPal-spezifische Details
      if (charge?.payment_method_details?.paypal) {
        const paypal = charge.payment_method_details.paypal;
        customerEmail = customerEmail || paypal.payer_email;
        
        const paypalName = (paypal.payer_name as any);
        if (paypalName && !customerName) {
          customerName = `${paypalName.given_name || ''} ${paypalName.surname || ''}`.trim();
        }
      }
    } catch (err) {
      console.log("Konnte PaymentIntent nicht erweitern:", err);
    }
  }

  try {
    const updateData: any = {
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_session_id: session.id,
    };

    if (session.payment_intent) {
      updateData.stripe_payment_intent = session.payment_intent as string;
    }
    if (customerEmail) {
      updateData.email = customerEmail;
      console.log(`E-Mail gefunden: ${customerEmail}`);
    }
    if (customerName) {
      if (table === 'wauwerk_leads') {
        updateData.customer_name = customerName;
      } else {
        updateData.name = customerName;
      }
      console.log(`Name gefunden: ${customerName}`);
    }

    // Für orders: due_at setzen
    if (table === 'orders') {
      updateData.due_at = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();
    }

    console.log("🔍 Update Data:", JSON.stringify(updateData, null, 2));
    console.log(`🔍 Update ${table}...`);

    const { data: updatedData, error } = await supabase
      .from(table)
      .update(updateData)
      .eq("id", referenceId)
      .select("*");
    
    if (error) {
      console.error("❌ Supabase Update Error:", JSON.stringify(error, null, 2));
    } else {
      console.log("✅ Supabase Update erfolgreich!");
      console.log("🔍 Aktualisierte Daten:", JSON.stringify(updatedData, null, 2));
      console.log(`${table} ${referenceId} erfolgreich als bezahlt markiert`);
      
      // Make benachrichtigen (orders + wauwerk_leads)
      await notifyMake(referenceId, {
        source: "checkout.session",
        table: table,
        email: updateData.email ?? null,
        name: updateData.name ?? updateData.customer_name ?? null,
        stripe_session_id: session.id,
        stripe_payment_intent: updateData.stripe_payment_intent ?? null,
      });

      // Oster-Bonus: Notfall-Karten gratis bei wauwerk_leads-Käufen
      const emailForKarten = updateData.email || existingRecord.email || customerEmail;
      if (table === 'wauwerk_leads' && emailForKarten) {
        console.log("🐣 Oster-Bonus: Notfall-Karten gratis versenden...");
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://pfoten-plan.de');
          await fetch(`${baseUrl}/api/notfall-karten/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: emailForKarten,
              dogName: session.metadata?.dog_name || existingRecord.dog_name || 'deinen Hund',
              leadId: referenceId,
            }),
          });
          console.log("✅ Oster-Bonus Notfall-Karten versendet an", emailForKarten);
        } catch (bonusErr) {
          console.error("❌ Oster-Bonus Notfall-Karten Fehler:", bonusErr);
        }
      }
    }

    console.log("🔍 === CHECKOUT SUCCESS DEBUG ENDE ===");
  } catch (err) {
    console.error("Supabase-Fehler bei Checkout Session:", err);
  }
}

async function handleCheckoutFailed(session: Stripe.Checkout.Session) {
  const referenceId = session.client_reference_id || session.metadata?.order_id;
  if (!referenceId) {
    console.error("Keine Reference-ID in Session gefunden");
    return;
  }

  const { table } = await findLeadOrOrder(referenceId);
  if (!table) return;

  try {
    const updateData: any = {
      status: "failed",
      stripe_session_id: session.id,
    };

    if (session.payment_intent) {
      updateData.stripe_payment_intent = session.payment_intent as string;
    }

    const { error } = await supabase.from(table).update(updateData).eq("id", referenceId);
    
    if (error) {
      console.error("Fehler beim Markieren der fehlgeschlagenen Session:", error);
    } else {
      console.log(`${table} ${referenceId} als fehlgeschlagen markiert`);
    }
  } catch (err) {
    console.error("Supabase-Fehler bei fehlgeschlagener Session:", err);
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  // === UPSELL PAYMENT HANDLING ===
  const isUpsell = paymentIntent.metadata?.type === 'upsell';
  const isPremium = paymentIntent.metadata?.type === 'premium';

  if (isUpsell || isPremium) {
    await handleUpsellPaymentSuccess(paymentIntent);
    return;
  }

  // === REGULAR PAYMENT HANDLING ===
  const referenceId = paymentIntent.metadata?.order_id || paymentIntent.metadata?.lead_id;
  if (!referenceId) {
    console.error("Keine Reference-ID in PaymentIntent gefunden");
    return;
  }

  const { table, data: existingRecord } = await findLeadOrOrder(referenceId);
  if (!table) return;

  // Skip wenn bereits paid
  if (existingRecord.status === 'paid') {
    console.log(`⚠️ ${referenceId} bereits paid - überspringe (payment_intent.succeeded)`);
    return;
  }

  let customerEmail = paymentIntent.receipt_email;
  let customerName = null;

  // Charge-Details für PayPal abrufen
  if (stripe) {
    try {
      const charges = await stripe.charges.list({ payment_intent: paymentIntent.id, limit: 1 });

      if (charges.data.length > 0) {
        const charge = charges.data[0];

        if (charge.billing_details) {
          customerEmail = customerEmail || charge.billing_details.email;
          customerName = charge.billing_details.name;
        }

        if (charge.payment_method_details?.paypal) {
          const paypal = charge.payment_method_details.paypal;
          customerEmail = customerEmail || paypal.payer_email;

          const paypalName = (paypal.payer_name as any);
          if (paypalName && !customerName) {
            customerName = `${paypalName.given_name || ''} ${paypalName.surname || ''}`.trim();
          }
        }
      }
    } catch (err) {
      console.log("Konnte Charge-Details nicht abrufen:", err);
    }
  }

  try {
    const updateData: any = {
      status: "paid",
      stripe_payment_intent: paymentIntent.id,
      paid_at: new Date().toISOString(),
    };

    if (customerEmail) updateData.email = customerEmail;
    if (customerName) {
      if (table === 'wauwerk_leads') {
        updateData.customer_name = customerName;
      } else {
        updateData.name = customerName;
      }
    }

    const { error } = await supabase.from(table).update(updateData).eq("id", referenceId);

    if (error) {
      console.error("Fehler beim Aktualisieren via PaymentIntent:", error);
    } else {
      console.log(`${table} ${referenceId} via PaymentIntent aktualisiert`);
      await notifyMake(referenceId, {
        source: "payment_intent",
        table: table,
        email: updateData.email ?? null,
        name: updateData.name ?? updateData.customer_name ?? null,
        stripe_payment_intent: paymentIntent.id,
      });

      // Oster-Bonus: Notfall-Karten gratis bei wauwerk_leads-Käufen
      const emailForKarten = updateData.email || existingRecord.email || paymentIntent.metadata?.email;
      if (table === 'wauwerk_leads' && emailForKarten) {
        console.log("🐣 Oster-Bonus: Notfall-Karten gratis versenden...");
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://pfoten-plan.de');
          await fetch(`${baseUrl}/api/notfall-karten/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: emailForKarten,
              dogName: paymentIntent.metadata?.dog_name || existingRecord.dog_name || 'deinen Hund',
              leadId: referenceId,
            }),
          });
          console.log("✅ Oster-Bonus Notfall-Karten versendet an", emailForKarten);
        } catch (bonusErr) {
          console.error("❌ Oster-Bonus Notfall-Karten Fehler:", bonusErr);
        }
      }
    }
  } catch (err) {
    console.error("Fehler bei PaymentIntent-Verarbeitung:", err);
  }
}

// === UPSELL PAYMENT HANDLER ===
async function handleUpsellPaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  console.log("🛒 === UPSELL PAYMENT SUCCESS ===");

  const leadId = paymentIntent.metadata?.lead_id;
  const module = paymentIntent.metadata?.module;
  const email = paymentIntent.metadata?.email;
  const isPremium = paymentIntent.metadata?.is_premium === 'true';

  console.log("🛒 Lead ID:", leadId);
  console.log("🛒 Module:", module);
  console.log("🛒 Email:", email);
  console.log("🛒 Is Premium:", isPremium);

  if (!leadId && !email) {
    console.error("❌ Keine Lead-ID oder Email für Upsell gefunden");
    return;
  }

  try {
    // Lead finden
    let leadData = null;

    if (leadId) {
      const { data, error } = await supabase
        .from("wauwerk_leads")
        .select("*")
        .eq("id", leadId)
        .single();

      if (!error && data) {
        leadData = data;
      }
    }

    // Fallback: über Email suchen
    if (!leadData && email) {
      const { data, error } = await supabase
        .from("wauwerk_leads")
        .select("*")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        leadData = data;
      }
    }

    if (!leadData) {
      console.error("❌ Lead nicht gefunden für Upsell");
      return;
    }

    console.log("✅ Lead gefunden:", leadData.id);

    // Bestehende upsell_modules holen (kann Array oder String sein)
    let existingModules: string[] = [];
    if (leadData.upsell_modules) {
      if (Array.isArray(leadData.upsell_modules)) {
        existingModules = leadData.upsell_modules;
      } else if (typeof leadData.upsell_modules === 'string') {
        existingModules = leadData.upsell_modules.split(',').filter(Boolean);
      }
    }

    // Neue Module hinzufügen
    const newModules = module ? module.split('+') : [];
    if (isPremium) {
      newModules.push('premium');
    }

    // Duplikate vermeiden
    const allModules = [...new Set([...existingModules, ...newModules])];

    console.log("🛒 Bestehende Module:", existingModules);
    console.log("🛒 Neue Module:", newModules);
    console.log("🛒 Alle Module:", allModules);

    // Update in Supabase
    const { error: updateError } = await supabase
      .from("wauwerk_leads")
      .update({
        upsell_modules: allModules,
        upsell_paid_at: new Date().toISOString(),
        upsell_payment_intent: paymentIntent.id,
      })
      .eq("id", leadData.id);

    if (updateError) {
      console.error("❌ Fehler beim Updaten der upsell_modules:", updateError);
    } else {
      console.log("✅ upsell_modules erfolgreich aktualisiert:", allModules);
    }

    // Notfall-Karten: PDF generieren und versenden
    if (module === 'notfall-karten' && email) {
      console.log("📄 Notfall-Karten Delivery triggern...");
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
          || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://pfoten-plan.de');
        await fetch(`${baseUrl}/api/notfall-karten/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            dogName: paymentIntent.metadata?.dog_name || 'deinen Hund',
            leadId: leadData.id,
          }),
        });
        console.log("✅ Notfall-Karten Delivery getriggert");
      } catch (deliveryErr) {
        console.error("❌ Notfall-Karten Delivery Fehler:", deliveryErr);
      }
    }

    // Make benachrichtigen
    await notifyMake(leadData.id, {
      source: "upsell_payment",
      type: isPremium ? "premium" : "upsell",
      module: module,
      modules: allModules,
      email: email,
      stripe_payment_intent: paymentIntent.id,
    });

    console.log("🛒 === UPSELL PAYMENT SUCCESS ENDE ===");

  } catch (err) {
    console.error("❌ Fehler bei Upsell-Verarbeitung:", err);
  }
}

async function handleChargeSuccess(charge: Stripe.Charge) {
  let referenceId = charge.metadata?.order_id || charge.metadata?.lead_id;
  
  if (!referenceId && charge.payment_intent && stripe) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent as string);
      referenceId = paymentIntent.metadata?.order_id || paymentIntent.metadata?.lead_id;
    } catch (err) {
      console.log("Konnte PaymentIntent für Charge nicht abrufen:", err);
    }
  }

  if (!referenceId) {
    console.log("Keine Reference-ID für Charge gefunden - überspringe");
    return;
  }

  const { table, data: existingRecord } = await findLeadOrOrder(referenceId);
  if (!table) return;

  // ⬇️ NEU: Skip wenn bereits paid
  if (existingRecord.status === 'paid') {
    console.log(`⚠️ ${referenceId} bereits paid - überspringe (charge.succeeded)`);
    return;
  }

  let customerEmail = charge.billing_details?.email;
  let customerName = charge.billing_details?.name;

  // PayPal-Details aus Charge
  if (charge.payment_method_details?.paypal) {
    const paypal = charge.payment_method_details.paypal;
    customerEmail = customerEmail || paypal.payer_email;
    
    const paypalName = (paypal.payer_name as any);
    if (paypalName && !customerName) {
      customerName = `${paypalName.given_name || ''} ${paypalName.surname || ''}`.trim();
    }
    console.log(`PayPal Charge - Email: ${customerEmail}, Name: ${customerName}`);
  }

  try {
    const updateData: any = {
      status: "paid",
      paid_at: new Date().toISOString(),
    };

    if (customerEmail) updateData.email = customerEmail;
    if (customerName) {
      if (table === 'wauwerk_leads') {
        updateData.customer_name = customerName;
      } else {
        updateData.name = customerName;
      }
    }

    const { error } = await supabase.from(table).update(updateData).eq("id", referenceId);
    
    if (error) {
      console.error("Fehler beim Aktualisieren via Charge:", error);
    } else {
      console.log(`${table} ${referenceId} via Charge aktualisiert`);
      await notifyMake(referenceId, {
        source: "charge",
        table: table,
        email: updateData.email ?? null,
        name: updateData.name ?? updateData.customer_name ?? null,
        charge_id: charge.id,
      });
    }
  } catch (err) {
    console.error("Fehler bei Charge-Verarbeitung:", err);
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const referenceId = paymentIntent.metadata?.order_id || paymentIntent.metadata?.lead_id;
  if (!referenceId) {
    console.error("Keine Reference-ID in PaymentIntent gefunden");
    return;
  }

  const { table } = await findLeadOrOrder(referenceId);
  if (!table) return;

  try {
    const { error } = await supabase.from(table).update({
      status: "failed",
      stripe_payment_intent: paymentIntent.id,
    }).eq("id", referenceId);

    if (error) {
      console.error("Fehler beim Markieren der fehlgeschlagenen Order:", error);
    } else {
      console.log(`${table} ${referenceId} als fehlgeschlagen markiert`);
    }
  } catch (err) {
    console.error("Fehler bei fehlgeschlagener PaymentIntent-Verarbeitung:", err);
  }
}