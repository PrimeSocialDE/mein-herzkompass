import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { supabase } from "@/lib/db";
import { getMollie, getMolliePL } from "@/lib/mollie";
import { generateRedeemCode } from "@/lib/referral";
import {
  activateClubForLead,
  CLUB_PRICE_EUR,
  CLUB_DESCRIPTION,
} from "@/lib/club";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Plan-Generierung kann 15-25s dauern. after() hält den Worker so lange am
// Leben, der Webhook selbst antwortet Mollie aber sofort.
export const maxDuration = 60;

// Mollie sendet keinen Event-Body, sondern ruft uns nur mit der Payment-ID an.
// Wir holen den vollen Payment-Status per API ab und dispatchen je nach Status.
// Idempotenz: wir bauen alle Updates so, dass sie mehrfach auslösbar sind ohne Schaden.

export async function POST(req: NextRequest) {
  // PL-Zahlungen (Webhook-URL mit ?acct=pl) mit dem PL-Mollie-Key abholen.
  const mollie =
    req.nextUrl.searchParams.get("acct") === "pl" ? getMolliePL() : getMollie();
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

    // ── Club-Abo-Zahlungen VOR dem normalen Plan-Flow abfangen ──────────
    const meta0 = ((payment as any).metadata || {}) as Record<string, any>;
    if (meta0.kind === "club_first" || meta0.kind === "club_sub") {
      await handleClubPayment(payment, meta0);
      return NextResponse.json({ ok: true, club: meta0.kind });
    }

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

  let referenceId = meta.lead_id || meta.order_id;

  // Fallback: kein Reference-ID in Metadata? Versuch Lead via Email zu finden.
  // Passiert bei Dashboard-Checkouts wenn der User noch keinen wauwerk_leads
  // hatte (Magic-Link-Registrierung ohne Quiz).
  let { table, data: existingRecord } = referenceId
    ? await findLeadOrOrder(referenceId)
    : { table: null as string | null, data: null as any };

  if (!table) {
    const fallbackEmail = (extractEmail(payment) || meta.email || "")
      .trim()
      .toLowerCase();
    if (fallbackEmail) {
      const { data: leadByEmail } = await supabase
        .from("wauwerk_leads")
        .select("*")
        .ilike("email", fallbackEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (leadByEmail) {
        referenceId = leadByEmail.id;
        existingRecord = leadByEmail;
        table = "wauwerk_leads";
        console.log(
          `[mollie-webhook] Lead via email-fallback gefunden: ${fallbackEmail} → ${referenceId}`
        );
      }
    }
  }

  if (!table || !referenceId) {
    console.error(
      `[mollie-webhook] Lead weder via Metadata noch Email gefunden fuer payment ${payment.id}`
    );
    return;
  }

  // Bump IMMER zuerst versuchen (Idempotenz via answers.order_bump_delivered_at).
  // Auch wenn Lead bereits paid ist — falls Bump-Delivery beim ersten Mal scheiterte.
  await deliverOrderBumpIfPurchased(payment, existingRecord);

  // Idempotenz NICHT über status (verhindert Re-Käufe), sondern über die
  // KONKRETE Payment-ID. Wir tracken alle prozessierten Payment-IDs in
  // answers.processed_payment_ids — wenn dieser Webhook für GENAU diese
  // payment.id schon mal lief, skip. Bei NEUEM Payment (auch wenn Lead
  // schon paid war) → kommt durch und feuert Make.com.
  // WICHTIG: Frischer Read NACH deliverOrderBumpIfPurchased. Sonst ueberschreibt
  // der Stale-Snapshot existingRecord.answers unten (updateData.answers) die vom
  // Bump gesetzten Flags (order_bump_delivered, grundkommandos_pending_at) wieder
  // -> der Grundkommando-Cron sah die Kaeufer nie. Vgl. webhook-delivery-idempotency.
  let prevAnswers = (existingRecord.answers || {}) as Record<string, any>;
  try {
    const { data: freshLead } = await supabase
      .from(table)
      .select("answers")
      .eq("id", existingRecord.id)
      .maybeSingle();
    if (freshLead?.answers) prevAnswers = freshLead.answers as Record<string, any>;
  } catch {}
  const processedIds: string[] = Array.isArray(prevAnswers.processed_payment_ids)
    ? prevAnswers.processed_payment_ids
    : [];
  if (processedIds.includes(payment.id)) {
    console.log(
      `[mollie-webhook] payment ${payment.id} bereits prozessiert — skip`
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
    answers: {
      ...prevAnswers,
      processed_payment_ids: [...processedIds, payment.id],
    },
  };

  if (customerEmail) updateData.email = customerEmail;
  if (customerName) {
    if (table === "wauwerk_leads") updateData.customer_name = customerName;
    else updateData.name = customerName;
  }

  // ── Mandate-Info fuer One-Click-Upsells speichern ──────────────────
  // Wenn beim Erstkauf sequenceType='first' gesetzt war und die Methode
  // recurring-faehig ist, liefert Mollie nach paid eine mandateId. Damit
  // koennen wir spaeter ueber /api/mollie/upsell-recurring-checkout ohne
  // Redirect chargen.
  if (table === "wauwerk_leads") {
    const mandateId = (payment as any).mandateId;
    const mollieCustomerId = (payment as any).customerId;
    if (mandateId) updateData.mollie_mandate_id = mandateId;
    if (mollieCustomerId) updateData.mollie_customer_id = mollieCustomerId;
    if (payment.method) updateData.mollie_payment_method = payment.method;
  }

  // Safety-Net: selected_plan aus Mollie-Metadata uebernehmen, falls die
  // /wauwerk-checkout-Route den Update nicht geschafft hat (z.B. ohne
  // leadId beim Anstoss, oder DB-Fehler dort). Bei Member-Bereich-Upgrades
  // ist das selected_plan im Lead sonst veraltet, und Plan-Gen produziert
  // die falsche Laenge.
  if (
    table === "wauwerk_leads" &&
    (meta.plan === "1month" || meta.plan === "3month" || meta.plan === "6month") &&
    meta.plan !== existingRecord.selected_plan
  ) {
    updateData.selected_plan = meta.plan;
    console.log(
      `[mollie-webhook] selected_plan aktualisiert: ${existingRecord.selected_plan} → ${meta.plan} (lead ${referenceId})`
    );
  }

  if (table === "orders") {
    updateData.due_at = new Date(
      Date.now() + 10 * 60 * 60 * 1000
    ).toISOString();
  }

  // ── Beleg (Kleinbetragsrechnung) für DE-Verkäufe erzeugen ──────────
  // Bewusst VOR dem status='paid'-Write: der pg_net-Trigger löst danach die
  // Plan-Mail aus, die den Beleg-Footer anzeigen soll → Beleg muss vorher da
  // sein. Idempotent (create_beleg prüft mollie_payment_id) + failure-isoliert
  // (ein Beleg-Fehler darf Zahlung/Plan NIE blockieren). Nur DE, nicht PL.
  if (table === "wauwerk_leads" && customerEmail) {
    const isPlSale = (prevAnswers as any)?.lang === "pl";
    const bruttoCents = Math.round(
      parseFloat(payment.amount?.value || "0") * 100
    );
    if (!isPlSale && bruttoCents > 0) {
      try {
        const { belegDescription } = await import("@/lib/beleg");
        await supabase.rpc("create_beleg", {
          p_mollie_payment_id: payment.id,
          p_lead_id: referenceId,
          p_email: customerEmail,
          p_beschreibung: belegDescription(meta),
          p_brutto_cents: bruttoCents,
          p_leistungsdatum: new Date().toISOString(),
        });
      } catch (e: any) {
        console.error(
          "[mollie-webhook] Beleg-Erstellung fehlgeschlagen (Zahlung läuft weiter):",
          e?.message
        );
      }
    }
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
    `[mollie-webhook] ${table} ${referenceId} → paid (${payment.method}) [payment: ${payment.id}]`
  );

  // Direct-Sync: falls User schon ein member_users-Profil hat (= sich
  // vorher gratis registriert hat), Status sofort auf "paid" setzen.
  // Sonst muesste er sich erst neu einloggen damit Lazy-Sync greift.
  if (table === "wauwerk_leads" && updateData.email) {
    try {
      const { syncMemberPaidStatusFromLead } = await import("@/lib/member-db");
      await syncMemberPaidStatusFromLead({
        email: updateData.email,
        paidAt: updateData.paid_at,
        leadId: referenceId,
      });
    } catch (e: any) {
      console.error("[mollie-webhook] member-sync failed:", e?.message);
    }
  }

  // Plan-Gen wird vom pg_net DB-Trigger (status='paid' → /plan/generate)
  // gefired. Wenn wir HIER auch noch triggerInternalPlanGeneration aufrufen,
  // entsteht eine Race-Condition: 2 parallele Plan-Gen-Calls = 2 Plans + 2
  // Mails an den User. Wenn pg_net mal nicht laeuft, faengt der
  // process-paid-leads Cron das ab (alle 5 Min). Daher hier explizit AUS.
  // Kann via env FORCE_INTERNAL_PLAN_GEN=1 manuell reaktiviert werden
  // falls pg_net + Cron beide tot.
  if (
    table === "wauwerk_leads" &&
    updateData.email &&
    process.env.FORCE_INTERNAL_PLAN_GEN === "1"
  ) {
    const targetEmail = updateData.email;
    after(async () => {
      try {
        await triggerInternalPlanGeneration(referenceId, targetEmail);
      } catch (e: any) {
        console.error("[mollie-webhook] plan-gen trigger failed:", e?.message);
      }
    });
  }

  // Brevo Listen-Sync: Kunde aus Nurture-Liste (#47) entfernen und in
  // Plan-spezifische Liste (#44 / #45 / #46) packen. So bekommen Kaeufer
  // keine "Du hast den Plan nicht gekauft"-Mails mehr.
  // In after() weil das ~500ms zusatzliche API-Calls sind.
  if (table === "wauwerk_leads" && updateData.email) {
    const targetEmail = updateData.email;
    // Prefer den frisch aktualisierten Wert aus updateData (Upgrade-Fall),
    // fallback auf den Lead-Wert vor dem Update.
    const selectedPlan =
      updateData.selected_plan ||
      (existingRecord as any)?.selected_plan ||
      "3month";
    after(async () => {
      try {
        const {
          syncPaidCustomerListsFromSelectedPlan,
          removeFromWarmRecoveryList,
        } = await import("@/lib/brevo-contacts");
        const [res, warmRes] = await Promise.all([
          syncPaidCustomerListsFromSelectedPlan(targetEmail, selectedPlan),
          // Falls der User vorher in Warm-Recovery war: rausnehmen,
          // damit er keine Drip-Mails mehr kriegt (er hat ja jetzt gekauft).
          removeFromWarmRecoveryList(targetEmail),
        ]);
        console.log(
          `[mollie-webhook] brevo-sync ${targetEmail} → ${res.planMonths}M ` +
            `removed=${res.removed} added=${res.added} warm-removed=${warmRes.ok}`
        );
      } catch (e: any) {
        console.error(
          "[mollie-webhook] brevo-sync failed:",
          e?.message
        );
      }
    });
  }

  // Facebook CAPI Purchase Event — server-side Tracking damit auch
  // Browser-Pixel-Blocker (iOS 14+, AdBlocker) den Kauf zu Facebook
  // melden. De-Duplication via fb_event_id (Pixel + CAPI matchen sich).
  if (table === "wauwerk_leads" && updateData.email) {
    const totalCents =
      parseInt(meta.total_amount_cents || "0", 10) ||
      Math.round(parseFloat(payment.amount?.value || "0") * 100);
    const fbEventId = meta.fb_event_id || `mollie-${payment.id}`;
    const planName = meta.plan === "1month"
      ? "1-Monatsplan"
      : meta.plan === "6month"
        ? "6-Monatsplan"
        : "3-Monatsplan";
    const targetEmail = updateData.email;
    const refId = referenceId;
    const metaFbp = meta.fbp || null;
    after(async () => {
      try {
        // fbc/fbp aus dem Lead (VOLLER Wert) holen. Die Mollie-Metadaten kuerzen
        // fbc auf 60 Zeichen → abgeschnittener fbclid → Meta-CAPI-Qualitaetsfehler
        // ("modifizierter fbclid im fbc-Parameter"). Daher den gekuerzten meta.fbc
        // NICHT verwenden; fbp ist kurz, deshalb meta.fbp als Fallback ok.
        let fbc: string | null = null;
        let fbp: string | null = metaFbp;
        let clientIp: string | null = null;
        let clientUserAgent: string | null = null;
        try {
          const { data: leadRow } = await supabase
            .from("wauwerk_leads")
            .select("answers, created_at")
            .eq("id", refId)
            .maybeSingle();
          const ans = ((leadRow?.answers as any) || {}) as Record<string, any>;
          fbc = (ans.fbc as string) || null;
          fbp = (ans.fbp as string) || metaFbp;
          clientIp = (ans.client_ip as string) || null;
          clientUserAgent = (ans.client_user_agent as string) || null;
          // fbc aus fbclid ableiten, falls nicht direkt vorhanden. Meta-Format:
          // fb.1.<ms-timestamp>.<fbclid>. Timestamp = Lead-Erstellzeit (≈ Klickzeit),
          // sonst jetzt.
          if (!fbc && ans.fbclid) {
            const ts = (leadRow as any)?.created_at
              ? new Date((leadRow as any).created_at).getTime()
              : Date.now();
            fbc = `fb.1.${ts}.${ans.fbclid}`;
          }
        } catch (e: any) {
          console.warn("[mollie-webhook] fbc/fbp lead-lookup failed:", e?.message);
        }
        const { sendPurchaseEventCAPI } = await import("@/lib/fb-capi");
        const res = await sendPurchaseEventCAPI({
          email: targetEmail,
          valueCents: totalCents,
          currency: payment.amount?.currency || "EUR",
          fbp,
          fbc,
          eventId: fbEventId,
          clientIp,
          clientUserAgent,
          externalId: refId,
          contentName: planName,
          contentIds: [`plan-${meta.plan || "3month"}`],
        });
        console.log(
          `[mollie-webhook] fb-capi Purchase ${targetEmail} eventId=${fbEventId} ` +
            `value=${totalCents / 100} ok=${res.ok}${res.reason ? ` reason=${res.reason}` : ""}`
        );
      } catch (e: any) {
        console.error("[mollie-webhook] fb-capi failed:", e?.message);
      }
    });
  }

  await enrollInUpsellCampaign(table, referenceId, updateData.email);
  await sendNotfallkartenIfBonus(table, referenceId);

  // Rückhol-Bonus: Wer über die Rückhol-Seite kauft (source_page='rueckhol',
  // gesetzt beim Checkout in der Mollie-Metadata), bekommt den Freilauf-
  // Perfektions-Plan (bonusKey 'freilauf' → PDF-Inhalt aus dem recall-Modul,
  // aber exklusiv benannt + eigener Idempotenz-Key, damit ein spaeterer
  // regulaerer recall-Kauf nicht geblockt wird). after() → Webhook gibt sofort
  // 200 an Mollie zurück; Idempotenz im send-Endpoint verhindert Doppel-Mails.
  // Rückhol-Bonus vorerst DEAKTIVIERT (Produkt-Entscheidung: kein "geschenkter
  // Plan" mehr, um nicht manipulativ zu wirken — der Inhalt war derselbe wie
  // recall). source_page-Tracking bleibt aktiv. Auf true setzen, um den
  // Freilauf-Bonus wieder auszuliefern.
  const RUECKHOL_BONUS_ENABLED = false;
  const sourcePage = meta.source_page || (prevAnswers as any)?.source_page || null;
  if (RUECKHOL_BONUS_ENABLED && sourcePage === "rueckhol" && customerEmail && table === "wauwerk_leads") {
    const bonusDogName = meta.dog_name || existingRecord.dog_name || "deinen Hund";
    const bonusBaseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "https://www.pfoten-plan.de";
    after(async () => {
      try {
        const res = await fetch(`${bonusBaseUrl}/api/zusatzmodul/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: customerEmail,
            dogName: bonusDogName,
            bonusKey: "freilauf",
          }),
        });
        console.log(
          `[mollie-webhook] Rückhol-Bonus freilauf an ${customerEmail}: ${res.status}`
        );
      } catch (e: any) {
        console.error("[mollie-webhook] Rückhol-Bonus freilauf failed:", e?.message);
      }
    });
  }

  // Referral-Reward triggern wenn dieser Lead per Empfehlungs-Link kam.
  // Code kommt entweder aus Metadata (frisch beim Checkout mitgeschickt) oder aus
  // der referred_by_code-Spalte (bei wiederholtem Webhook-Call).
  const refCode =
    meta.referred_by_code || existingRecord.referred_by_code || null;
  if (refCode && table === "wauwerk_leads") {
    await triggerReferralReward({
      referredByCode: refCode,
      newLeadId: referenceId,
      newLeadEmail: updateData.email,
    });
  }

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

  // DB-Spalten: upsell_module (Haupt), upsell_2 (zweiter Slot),
  // upsell_prevention. upsell_modules (plural) und upsell_paid_at existieren
  // NICHT als Spalten. Wir nutzen upsell_module + upsell_2 als
  // Konkatenations-String "pulling+anxiety" da Bundle moeglich.
  const newModuleStr = isPremium
    ? (module ? `${module}+premium` : "premium")
    : (module || null);

  // Wenn upsell_module bereits gefuellt → in upsell_2 packen (zweiter Kauf)
  const updatePayload: any = {
    mollie_upsell_payment_id: payment.id,
  };
  if (!leadData.upsell_module) {
    updatePayload.upsell_module = newModuleStr;
  } else if (!leadData.upsell_2) {
    updatePayload.upsell_2 = newModuleStr;
  } else {
    // Beide Slots voll — append an upsell_module mit + (Bundle-Notation)
    updatePayload.upsell_module = `${leadData.upsell_module}+${newModuleStr}`;
  }

  await supabase
    .from("wauwerk_leads")
    .update(updatePayload)
    .eq("id", leadData.id);

  // Track Auslieferungs-Zeit fuer 14-Tage-Cron-Filter via answers.
  // WICHTIG: Fresh-Read statt des veralteten leadData.answers-Snapshots (vom
  // Webhook-Start). Mollie ruft den Webhook pro Zahlung mehrfach auf (v.a.
  // PayPal: created->pending->paid + Retries). Mit dem Stale-Snapshot
  // ueberschrieb dieser Write Idempotenz-Flags, die ein frueherer Aufruf
  // gesetzt hatte -> Modul wurde mehrfach ausgeliefert (Bug: 5x "Hund
  // verstehen"-Profil). Fresh-Read + Merge erhaelt die Flags.
  {
    const { data: freshA } = await supabase
      .from("wauwerk_leads")
      .select("answers")
      .eq("id", leadData.id)
      .maybeSingle();
    const baseAns = ((freshA?.answers as any) || (leadData.answers as any) || {}) as Record<string, any>;
    await supabase
      .from("wauwerk_leads")
      .update({ answers: { ...baseAns, upsell_paid_at: new Date().toISOString() } })
      .eq("id", leadData.id);
  }

  // Fuer Module-Extraktion: alle gekaufte Module aus beiden Spalten + neuem Kauf
  const allModulesRaw: string[] = [];
  if (leadData.upsell_module) allModulesRaw.push(...String(leadData.upsell_module).split("+"));
  if (leadData.upsell_2) allModulesRaw.push(...String(leadData.upsell_2).split("+"));
  if (module) allModulesRaw.push(...String(module).split("+"));
  if (isPremium) allModulesRaw.push("premium");
  const allModules = [...new Set(allModulesRaw.map((s) => s.trim()).filter(Boolean))];

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

  // Anti-Giftköder als eigenständiges Modul (z.B. Tag-30-Umfrage-Reward).
  // Bisher wurde Anti-Giftköder nur über den Order-Bump-Zweig ausgeliefert;
  // hier zusätzlich für einen direkten Modul-Kauf (module="anti-giftkoeder").
  if (module === "anti-giftkoeder" && (email || leadData.email)) {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL &&
        !process.env.NEXT_PUBLIC_BASE_URL.includes("localhost")
          ? process.env.NEXT_PUBLIC_BASE_URL
          : "https://www.pfoten-plan.de";
      await fetch(`${baseUrl}/api/anti-giftkoeder/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email || leadData.email,
          dogName: meta.dog_name || leadData.dog_name || "deinen Hund",
          breed: (leadData.answers as any)?.dog_breed || undefined,
        }),
      });
    } catch (e) {
      console.error("[mollie-webhook] Anti-Giftköder Delivery Error:", e);
    }
  }

  // "Dein Hund verstehen"-Profil als direkter Modul-Kauf. Der schnelle
  // One-Click-Pfad liefert schon synchron via /api/hund-verstehen/order
  // (inkl. Foto) und setzt answers.hund_verstehen_sent_at. Dieser Zweig ist
  // das Netz für den Redirect-Fallback (kein Mandat) — liefert dann ohne
  // Foto auf Basis der Quiz-Daten. Idempotent über dieselbe Flag.
  if (module === "hund-verstehen" && (email || leadData.email)) {
    try {
      const { data: fresh } = await supabase
        .from("wauwerk_leads")
        .select("answers, dog_breed, dog_name")
        .eq("id", leadData.id)
        .maybeSingle();
      const ans = ((fresh?.answers as any) || (leadData.answers as any) || {}) as Record<string, any>;
      // Atomarer Claim (Compare-and-Swap): nur der ERSTE Aufruf (von mehreren
      // Mollie-Retries / parallel zum /order-Endpoint) setzt das Flag und
      // liefert aus. Der WHERE-Filter auf flag IS NULL macht das Update zum
      // Test-and-Set — konkurrierende Aufrufe matchen 0 Zeilen.
      let claimed = false;
      if (!ans.hund_verstehen_sent_at) {
        const { data: claimRows } = await supabase
          .from("wauwerk_leads")
          .update({ answers: { ...ans, hund_verstehen_sent_at: new Date().toISOString() } })
          .eq("id", leadData.id)
          .is("answers->>hund_verstehen_sent_at", null)
          .select("id");
        claimed = !!(claimRows && claimRows.length);
      }
      if (claimed) {
        const PROBLEM_LABELS: Record<string, string> = {
          pulling: "Leinenziehen", barking: "übermäßiges Bellen", aggression: "Aggression",
          anxiety: "Trennungsangst", jumping: "Anspringen", recall: "Rückruf",
          energy: "viel Energie", destructive: "Zerstörungsverhalten", soiling: "Stubenreinheit",
          mouthing: "Aufnehmen von Gegenständen",
        };
        const pkey = ans.dog_problem || ans.problem;
        const baseUrl =
          process.env.NEXT_PUBLIC_BASE_URL &&
          !process.env.NEXT_PUBLIC_BASE_URL.includes("localhost")
            ? process.env.NEXT_PUBLIC_BASE_URL
            : "https://www.pfoten-plan.de";
        const res = await fetch(`${baseUrl}/api/hund-verstehen/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${(process.env.WORKER_TOKEN || "").trim()}` },
          body: JSON.stringify({
            email: email || leadData.email,
            dogName: meta.dog_name || fresh?.dog_name || leadData.dog_name || "dein Hund",
            breed: fresh?.dog_breed || ans.dog_breed || meta.dog_breed || "Mischling",
            age: ans.dog_age || "adult",
            problem: pkey ? PROBLEM_LABELS[pkey] || pkey : null,
            behaviors: Array.isArray(ans.dog_behaviors) ? ans.dog_behaviors : [],
            hadTraining: ans.had_training || null,
            commands: Array.isArray(ans.dog_commands) ? ans.dog_commands : [],
            goal: ans.dog_goal || null,
          }),
        });
        if (!res.ok) {
          console.error("[mollie-webhook] Hund-verstehen Delivery non-ok:", res.status);
          // Claim freigeben, damit ein spaeterer Retry liefern kann
          const { data: cur } = await supabase
            .from("wauwerk_leads").select("answers").eq("id", leadData.id).maybeSingle();
          const curAns = ((cur?.answers as any) || {}) as Record<string, any>;
          delete curAns.hund_verstehen_sent_at;
          await supabase.from("wauwerk_leads").update({ answers: curAns }).eq("id", leadData.id);
        }
      }
    } catch (e) {
      console.error("[mollie-webhook] Hund-verstehen Delivery Error:", e);
    }
  }

  // Coach-Foto-Premium: schaltet 30 Tage Foto/Video-Analyse im KI-Trainer
  // frei. Speicherung in answers.coach_premium_until (kein Schema-Änderung).
  // Fresh-Read, damit der upsell_paid_at-Write oben nicht überschrieben wird.
  if (module === "coach-foto") {
    try {
      const { data: freshLead } = await supabase
        .from("wauwerk_leads")
        .select("answers")
        .eq("id", leadData.id)
        .maybeSingle();
      const prev = (freshLead?.answers as any) || (leadData.answers as any) || {};
      const until = new Date(Date.now() + 30 * 864e5).toISOString();
      await supabase
        .from("wauwerk_leads")
        .update({
          answers: {
            ...prev,
            coach_premium_until: until,
            coach_premium_purchased_at: new Date().toISOString(),
          },
        })
        .eq("id", leadData.id);
    } catch (e) {
      console.error("[mollie-webhook] Coach-Foto Premium Error:", e);
    }
  }

  // Trainings-Zusatzmodule (pulling/energy/aggression/...): pro Modul-Key
  // ein PDF generieren und per Mail ausliefern. Modul-String kann auch
  // mehrere mit "+" verketten (z.B. "pulling+energy").
  //
  // Wichtig: in after() laufen lassen, damit der Webhook sofort 200 an
  // Mollie zurueckgibt und der Vercel-Container nicht killt bevor der
  // Mail-Versand fertig ist. Idempotenz im send-Endpoint sorgt dafuer,
  // dass eine evtl. doppelte Mail nicht zweimal ankommt.
  const ZUSATZMODUL_KEYS = new Set([
    "pulling", "energy", "anxiety", "aggression", "mouthing",
    "recall", "barking", "jumping", "destructive", "soiling",
  ]);
  const triggeredKeys = (module ? String(module).split("+") : []).filter((k) =>
    ZUSATZMODUL_KEYS.has(k.trim())
  );
  if (triggeredKeys.length > 0 && (email || leadData.email)) {
    const targetEmail = email || leadData.email;
    const dogName = meta.dog_name || leadData.dog_name || "deinen Hund";
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "https://www.pfoten-plan.de";
    after(async () => {
      for (const moduleKey of triggeredKeys) {
        try {
          const res = await fetch(`${baseUrl}/api/zusatzmodul/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: targetEmail, dogName, moduleKey }),
          });
          const data = await res.json().catch(() => ({}));
          console.log(
            `[mollie-webhook] zusatzmodul "${moduleKey}" -> ${res.status} ok=${data?.ok}${data?.skipped ? " (skipped)" : ""}`
          );
        } catch (e: any) {
          console.error(
            `[mollie-webhook] Zusatzmodul "${moduleKey}" Delivery Error:`,
            e?.message
          );
        }
      }
    });
  }

  // Themen-Pläne aus den Marketing-Funnels (bellen-plan, leinen-plan-bild,
  // energie-plan, aggression-plan, rueckruf-plan, ...). Auslieferung per Mail
  // über /api/themenplan/generate. In after(), damit Mollie sofort 200 bekommt;
  // Idempotenz im generate-Endpoint verhindert Doppel-Mails.
  const themenplanModules = (module ? String(module).split("+") : [])
    .map((k) => k.trim())
    .filter((k) => /^(bellen|leinen|energie|aggression|rueckruf)-plan(-bild)?$/.test(k));
  if (themenplanModules.length > 0 && (email || leadData.email)) {
    const targetEmail = email || leadData.email;
    const dogName = meta.dog_name || leadData.dog_name || "deinen Hund";
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "https://www.pfoten-plan.de";
    after(async () => {
      for (const mod of themenplanModules) {
        try {
          const res = await fetch(`${baseUrl}/api/themenplan/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: targetEmail, dogName, module: mod, leadId: leadData.id }),
          });
          const data = await res.json().catch(() => ({}));
          console.log(
            `[mollie-webhook] themenplan "${mod}" -> ${res.status} ok=${data?.ok}${data?.skipped ? " (skipped)" : ""}`
          );
        } catch (e: any) {
          console.error(`[mollie-webhook] Themenplan "${mod}" Delivery Error:`, e?.message);
        }
      }
    });
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

  // DB-Update: nur Spalten die wirklich existieren (upsell_module singular!).
  // Frueherer Bug: Code schrieb upsell_modules + upsell_paid_at (existieren NICHT)
  // → unknown column-Error → ganzes Update silent-failed, mollie_upsell_payment_id
  // wurde nie gespeichert. Plus kein .error-check.
  if (leadData) {
    const { error: updateErr } = await supabase
      .from("wauwerk_leads")
      .update({
        upsell_module: product,
        mollie_upsell_payment_id: payment.id,
      })
      .eq("id", leadData.id);
    if (updateErr) {
      console.error(
        `[mollie-webhook] upsell_product DB-Update fehlgeschlagen lead=${leadData.id}:`,
        updateErr.message
      );
    }
  }

  // ── Beleg (Kleinbetragsrechnung) für Lebensretter erzeugen ────────────────
  // Bewusst VOR der zusatzmodul/send-Auslieferung: die Auslieferungs-Mail lädt
  // den Beleg nach und zeigt ihn im Footer (Transaktionsnummer). Idempotent
  // (create_beleg dedupt über mollie_payment_id) + failure-isoliert. Nur DE.
  if (product === "lebensretter") {
    const isPlSale = (leadData?.answers as any)?.lang === "pl";
    const bruttoCents = Math.round(parseFloat(payment.amount?.value || "0") * 100);
    if (!isPlSale && bruttoCents > 0) {
      try {
        await supabase.rpc("create_beleg", {
          p_mollie_payment_id: payment.id,
          p_lead_id: leadData?.id || null,
          p_email: email,
          p_beschreibung: "Zusatzleistung: Lebensretter-Training (10 Kommandos)",
          p_brutto_cents: bruttoCents,
          p_leistungsdatum: new Date().toISOString(),
        });
      } catch (e: any) {
        console.error(
          "[mollie-webhook] Beleg (lebensretter) fehlgeschlagen (Auslieferung läuft weiter):",
          e?.message
        );
      }
    }
  }

  // Themen-Modul (thema-*) → direkt /api/zusatzmodul/send (interne Mail-Pipeline).
  // Sonst-Upsells (ernaehrung/zweithund/abo/reise/erstehilfe) → an Make.com.
  // Damit der Versand nicht mehr ausschliesslich von Make abhaengt — Make hat
  // bei Theme-Modulen mehrfach silent-failed (Elmar Walter 2x Recall bezahlt,
  // nichts erhalten).
  const themaModuleMap: Record<string, string> = {
    "thema-leinen": "pulling",
    "thema-bellen": "barking",
    "thema-aggression": "aggression",
    "thema-trennungsangst": "anxiety",
    "thema-anspringen": "jumping",
    "thema-rueckruf": "recall",
    "thema-energie": "energy",
    "thema-zerstoerung": "destructive",
    "thema-stubenrein": "soiling",
    "thema-aufnehmen": "mouthing",
    // Lebensretter-Training: eigenes Modul (10 Sicherheits-Kommandos + KI-Einleitung),
    // wird ebenfalls über die interne zusatzmodul/send-Pipeline ausgeliefert.
    lebensretter: "lebensretter",
  };
  const moduleKey = themaModuleMap[product];
  if (moduleKey) {
    after(async () => {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_SITE_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
          "https://www.pfoten-plan.de";
        const r = await fetch(`${baseUrl}/api/zusatzmodul/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            dogName: dogName === "deinen Hund" ? undefined : dogName,
            moduleKey,
          }),
        });
        const j: any = await r.json().catch(() => ({}));
        console.log(
          `[mollie-webhook] zusatzmodul/send ${product}→${moduleKey} ${email}: HTTP ${r.status} ok=${j.ok} skipped=${j.skipped}`
        );
      } catch (e: any) {
        console.error(
          `[mollie-webhook] zusatzmodul/send fehlgeschlagen ${product}:`,
          e?.message
        );
      }
    });
  }

  // Notify Make.com — Make übernimmt ggf. ergaenzende Aktionen + ist die
  // Pipeline fuer Nicht-Theme-Upsells (ernaehrung, zweithund, abo, reise, erstehilfe).
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

  const rawBase =
    process.env.NEXT_PUBLIC_BASE_URL &&
    !process.env.NEXT_PUBLIC_BASE_URL.includes("localhost")
      ? process.env.NEXT_PUBLIC_BASE_URL
      : "https://www.pfoten-plan.de";
  // WICHTIG: apex -> www normalisieren. pfoten-plan.de 307-redirected auf www,
  // und ein Cross-Host-Redirect STRIPPT den Authorization-Header. Der
  // authentifizierte Sofort-Anstoss an /api/grundkommandos/generate landete
  // dadurch mit 401 im Nirwana -> Generierung startete nie (Cron rettete es spaet).
  const baseUrl = rawBase.replace(
    /:\/\/pfoten-plan\.de/,
    "://www.pfoten-plan.de"
  );

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
    return;
  }

  if (bumpId === "antigiftkoeder") {
    try {
      // Rasse + Alter aus dem Lead-Record holen, sonst aus answers
      const ansRaw = (leadRecord?.answers || {}) as Record<string, any>;
      const breed =
        leadRecord?.dog_breed ||
        ansRaw.dog_breed ||
        meta.dog_breed ||
        "Mischling";
      const age =
        ansRaw.dog_age || meta.dog_age || "adult";

      const res = await fetch(`${baseUrl}/api/anti-giftkoeder/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, dogName, breed, age }),
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
              order_bump_delivered: "antigiftkoeder",
              order_bump_delivered_at: new Date().toISOString(),
              order_bump_amount_cents: meta.order_bump_amount_cents || "999",
              antigiftkoeder_sent_at: new Date().toISOString(),
            },
          })
          .eq("id", leadId);
      } else if (!res.ok) {
        console.error(
          "[mollie-webhook] Anti-Giftkoeder Generate failed:",
          res.status,
          await res.text().catch(() => "")
        );
      }
    } catch (e) {
      console.error("[mollie-webhook] Anti-Giftkoeder-Bump Error:", e);
    }
  }

  if (bumpId === "sommer") {
    // Der Bump ist jetzt der NOTFALL-GRUNDKOMMANDO-PLAN (ersetzt Sommer-Hitzeschutz).
    // Die Opus-Generierung (~2-3 Min) laeuft NICHT synchron hier (Mollie-Timeout →
    // Doppel-Auslieferung), sondern der Cron /api/cron/generate-grundkommandos
    // liefert aus. Hier nur Bump-Idempotenz markieren + Pending-Flag setzen.
    try {
      if (leadId) {
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
              order_bump_delivered: "grundkommandos",
              order_bump_delivered_at: new Date().toISOString(),
              order_bump_amount_cents: meta.order_bump_amount_cents || "999",
              grundkommandos_pending_at:
                prev.grundkommandos_pending_at || new Date().toISOString(),
            },
          })
          .eq("id", leadId);

        // SOFORT anstossen: die Generate-Route mit background:true antriggern. Die
        // antwortet SOFORT (202) und generiert per after() im Hintergrund weiter
        // (bis 300s) — wir warten hier also NICHT auf die 2-3 Min. Wichtig: NICHT
        // fetch+abort wie frueher (das killte die Generate-Invocation beim Abort);
        // jetzt kommt die Antwort schnell, die Verbindung wird sauber geschlossen,
        // und after() haelt die Generierung serverseitig am Leben. So kommt das PDF
        // ~2-3 Min nach Kauf. Der Cron ist nur noch Backstop, falls das hier scheitert.
        const workerToken = process.env.WORKER_TOKEN;
        if (workerToken) {
          let triggerStatus = "unknown";
          try {
            const res = await fetch(`${baseUrl}/api/grundkommandos/generate`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${workerToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ lead_id: leadId, background: true }),
              // Redirect wuerde den Authorization-Header strippen (Cross-Host)
              // -> lieber laut scheitern als still 401. baseUrl ist bereits www.
              redirect: "error",
              signal: AbortSignal.timeout(8000),
            });
            triggerStatus = String(res.status); // 202 = erfolgreich angestossen
            if (!res.ok) {
              console.error(
                `[mollie-webhook] Grundkommando-Sofort-Anstoss HTTP ${res.status} (Cron faengt es)`
              );
            }
          } catch (err) {
            triggerStatus = `err:${String((err as any)?.message || "").slice(0, 40)}`;
            console.error(
              "[mollie-webhook] Grundkommando-Sofort-Anstoss fehlgeschlagen (Cron faengt es):",
              (err as any)?.message || err
            );
          }
          // Nachvollziehbarkeit: Zeitpunkt + Ergebnis des Anstosses ins Lead
          // schreiben (frischer Merge). So sieht man pro Kauf, ob der schnelle
          // Pfad feuerte (Status "202") oder ob der Cron uebernehmen musste.
          try {
            const { data: fl } = await supabase
              .from("wauwerk_leads")
              .select("answers")
              .eq("id", leadId)
              .maybeSingle();
            await supabase
              .from("wauwerk_leads")
              .update({
                answers: {
                  ...((fl?.answers as any) || {}),
                  grundkommandos_immediate_trigger_at: new Date().toISOString(),
                  grundkommandos_immediate_trigger_status: triggerStatus,
                },
              })
              .eq("id", leadId);
          } catch {}
        }
      }
    } catch (e) {
      console.error("[mollie-webhook] Grundkommando-Bump Error:", e);
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

// ── Referral-Reward: Empfehler bekommt Coupon nach Conversion ────────────────
async function triggerReferralReward(opts: {
  referredByCode: string;
  newLeadId: string;
  newLeadEmail: string | null | undefined;
}) {
  const { referredByCode, newLeadId, newLeadEmail } = opts;
  try {
    // Empfehler-Lead via Code finden
    const { data: referrer } = await supabase
      .from("wauwerk_leads")
      .select("id, email, dog_name")
      .eq("referral_code", referredByCode)
      .single();

    if (!referrer || !referrer.email) {
      console.log(
        `[mollie-webhook] Referral: Kein Empfehler für Code ${referredByCode} gefunden — skip`
      );
      return;
    }

    // Anti-Fraud: Empfehler darf sich nicht selbst empfehlen
    if (
      newLeadEmail &&
      referrer.email.toLowerCase() === newLeadEmail.toLowerCase()
    ) {
      console.log(
        `[mollie-webhook] Referral: Self-Referral blockiert (${referrer.email}) — skip`
      );
      return;
    }

    // Existiert bereits ein Reward für diesen referred_lead_id? (Idempotenz)
    const { data: existing } = await supabase
      .from("referral_rewards")
      .select("id")
      .eq("referred_lead_id", newLeadId)
      .single();
    if (existing) {
      console.log(
        `[mollie-webhook] Referral: Reward für Lead ${newLeadId} existiert schon — skip`
      );
      return;
    }

    // Neuen Coupon-Code erzeugen + speichern (mit Retry bei unwahrscheinlicher Kollision)
    let redeemCode = generateRedeemCode();
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const { error } = await supabase.from("referral_rewards").insert({
        referrer_lead_id: referrer.id,
        referrer_email: referrer.email,
        referred_lead_id: newLeadId,
        referred_email: newLeadEmail || "",
        redeem_code: redeemCode,
        status: "pending",
      });
      if (!error) {
        inserted = true;
        break;
      }
      // unique violation? neuen Code generieren
      if (String(error.message).toLowerCase().includes("duplicate")) {
        redeemCode = generateRedeemCode();
        continue;
      }
      console.error("[mollie-webhook] Referral insert error:", error);
      return;
    }
    if (!inserted) {
      console.error(
        "[mollie-webhook] Referral insert nach 5 Versuchen fehlgeschlagen"
      );
      return;
    }

    console.log(
      `[mollie-webhook] 🎁 Referral-Reward erstellt: ${redeemCode} für ${referrer.email}`
    );

    // Mail an Empfehler senden
    await sendReferralRewardEmail({
      to: referrer.email,
      referrerDogName: referrer.dog_name || "deinen Hund",
      redeemCode,
    });
  } catch (e) {
    console.error("[mollie-webhook] Referral-Reward Exception:", e);
  }
}

async function sendReferralRewardEmail(opts: {
  to: string;
  referrerDogName: string;
  redeemCode: string;
}) {
  const BREVO = process.env.BREVO_API_KEY;
  if (!BREVO) {
    console.warn(
      "[mollie-webhook] BREVO_API_KEY fehlt — Referral-Mail nicht gesendet"
    );
    return;
  }
  const redeemUrl = `https://www.pfoten-plan.de/modul-shop.html?redeem=${encodeURIComponent(opts.redeemCode)}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;background:white;">
  <div style="padding:24px 30px;border-bottom:1px solid #f0f0f0;text-align:center;">
    <div style="font-size:18px;font-weight:800;color:#C4A576;">Pfoten-Plan</div>
  </div>
  <div style="padding:36px 30px 18px;">
    <h1 style="font-size:26px;font-weight:800;color:#1a1a1a;margin:0 0 16px;">Danke fürs Empfehlen 🎁</h1>
    <p style="font-size:15px;color:#555;line-height:1.7;margin:0 0 14px;">Jemand, dem du Pfoten-Plan empfohlen hast, hat seinen Plan gerade gekauft. Als Dankeschön bekommst du <strong>1 Modul deiner Wahl gratis</strong> (Wert €19,99).</p>
    <p style="font-size:15px;color:#555;line-height:1.7;margin:0 0 22px;">Lös deinen Code im Modul-Shop ein und such dir aus, was du brauchst.</p>
  </div>
  <div style="padding:0 30px 24px;text-align:center;">
    <div style="background:#FFF9F0;border:2px dashed #C4A576;border-radius:12px;padding:22px;margin-bottom:18px;">
      <p style="font-size:11px;color:#8B7355;margin:0 0 6px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Dein Gratis-Code</p>
      <p style="font-size:24px;font-family:monospace;color:#1a1a1a;margin:0;font-weight:700;letter-spacing:2px;">${opts.redeemCode}</p>
    </div>
    <a href="${redeemUrl}" style="display:inline-block;background:#C4A576;color:white;text-decoration:none;padding:16px 32px;border-radius:10px;font-size:15px;font-weight:700;">Modul gratis aussuchen →</a>
  </div>
  <div style="padding:24px 30px;border-top:1px solid #f0f0f0;text-align:center;background:#fafafa;">
    <p style="font-size:12px;color:#888;margin:0;">Pfoten-Plan · Dein Trainings-Begleiter</p>
  </div>
</div></body></html>`;
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
        to: [{ email: opts.to }],
        subject: `🎁 Dein Gratis-Modul wartet (${opts.redeemCode})`,
        htmlContent: html,
      }),
    });
    console.log(
      `[mollie-webhook] Referral-Reward-Mail gesendet an ${opts.to}`
    );
  } catch (e) {
    console.error("[mollie-webhook] Brevo Referral-Mail-Fehler:", e);
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

// Internen Plan-Generator triggern nach erfolgreicher Zahlung.
// MUSS awaited werden — fire-and-forget wird auf Vercel beendet,
// sobald der Webhook-Handler returned (container shutdown).
//
// Drei Bug-Fixes vs. vorher:
//   1) VERCEL_URL hat KEIN Protokoll — explizit https:// vorhängen
//   2) /plan/generate streamt NDJSON, kein JSON — Stream einzeln parsen
//   3) Webhook MUSS auf Completion warten, sonst killt Vercel den fetch
async function triggerInternalPlanGeneration(
  leadId: string,
  email: string
): Promise<void> {
  const token = process.env.WORKER_TOKEN;
  if (!token) {
    console.warn(
      "[mollie-webhook] WORKER_TOKEN fehlt — skip internal plan-gen"
    );
    return;
  }

  // Production-URL bevorzugen; VERCEL_URL kommt OHNE Protokoll
  const rawBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.pfoten-plan.de";
  const baseUrl = rawBase
    .replace(/^http:\/\//, "https://")
    .replace(/\/+$/, "");

  try {
    const res = await fetch(`${baseUrl}/api/mitglieder/plan/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lead_id: leadId, email }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(
        `[mollie-webhook] plan-gen non-ok ${res.status}:`,
        txt.slice(0, 200)
      );
      return;
    }

    // NDJSON-Stream: jede Zeile ist ein Event, "done" enthaelt finales Resultat
    const txt = await res.text().catch(() => "");
    let finalResult: any = null;
    for (const line of txt.split("\n").filter(Boolean)) {
      try {
        const obj = JSON.parse(line);
        if (obj.event === "done") finalResult = obj;
      } catch {}
    }

    if (finalResult?.ok) {
      console.log(
        `[mollie-webhook] plan-gen OK: ${finalResult.plan_length_months}M, ` +
          `${finalResult.weeks_count} Wochen (~${finalResult.duration_ms}ms)`
      );
    } else if (finalResult?.error === "skipped_existing") {
      console.log(
        `[mollie-webhook] plan-gen skipped (existing): ${finalResult.existing_plan_id}`
      );
    } else {
      console.error("[mollie-webhook] plan-gen error:", finalResult?.error || "(unknown)");
    }
  } catch (e: any) {
    console.error("[mollie-webhook] plan-gen fetch failed:", e?.message);
  }
}

// ── Club-Abo: Zahlungs-Handling ──────────────────────────────────────
function clubSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://www.pfoten-plan.de";
  return raw
    .replace(/^http:\/\//, "https://")
    .replace(/\/+$/, "")
    .replace(/:\/\/pfoten-plan\.de/, "://www.pfoten-plan.de");
}

async function triggerClubNotfallkarten(email: string, dogName?: string | null) {
  if (!email) return;
  try {
    await fetch(`${clubSiteUrl()}/api/notfall-karten/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, dogName: dogName || "deinen Hund" }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error("[club] Notfall-Karten-Trigger:", (e as any)?.message);
  }
}

async function handleClubPayment(payment: any, meta: Record<string, any>) {
  const leadId = meta.lead_id as string | undefined;
  const email = String(meta.email || "").toLowerCase();
  if (payment.status !== "paid") {
    console.log(`[club] ${payment.id} status=${payment.status} kind=${meta.kind} — keine Freischaltung`);
    return;
  }
  if (!leadId) {
    console.error("[club] kein lead_id in Metadata");
    return;
  }

  const { data: lead } = await supabase
    .from("wauwerk_leads")
    .select("answers,dog_name,mollie_customer_id")
    .eq("id", leadId)
    .maybeSingle();
  const answers = (lead?.answers || {}) as Record<string, any>;
  const customerId = payment.customerId || lead?.mollie_customer_id || null;

  if (meta.kind === "club_first") {
    // Erstzahlung: Mandate steht jetzt. Subscription anlegen (erste RECURRING-
    // Abbuchung in 1 Monat, weil die Erstzahlung gerade lief). Idempotent.
    if (answers.club_subscription_id) {
      console.log(`[club] ${payment.id} — Subscription existiert schon, skip`);
      return;
    }
    const mollie = getMollie();
    let subId: string | null = null;
    try {
      const startDate = new Date(Date.now() + 30 * 86400 * 1000)
        .toISOString()
        .slice(0, 10);
      const sub = await (mollie as any).customerSubscriptions.create({
        customerId,
        amount: { currency: "EUR", value: CLUB_PRICE_EUR },
        interval: "1 month",
        startDate,
        description: CLUB_DESCRIPTION,
        webhookUrl: `${clubSiteUrl()}/api/mollie/webhook`,
        metadata: { kind: "club_sub", email, lead_id: leadId },
      });
      subId = sub?.id || null;
    } catch (e) {
      console.error("[club] Subscription-Anlage fehlgeschlagen:", (e as any)?.message);
    }
    // Mandate-ID sichern (fuer spaetere One-Click-Sachen)
    if (payment.mandateId) {
      await supabase
        .from("wauwerk_leads")
        .update({ mollie_mandate_id: payment.mandateId })
        .eq("id", leadId);
    }
    await activateClubForLead(leadId, { subscriptionId: subId, customerId, email });
    await triggerClubNotfallkarten(email, lead?.dog_name);
    console.log(`[club] aktiviert (first) lead=${leadId} sub=${subId}`);
  } else {
    // club_sub — monatliche Abbuchung erfolgreich. Wenn (noch) nicht aktiv und
    // nicht gekuendigt -> aktivieren (Fallback fuer den Mandate-Pfad). Sonst
    // laeuft alles, Drip NICHT anfassen.
    if (!answers.club_active && !answers.club_canceled_at) {
      await activateClubForLead(leadId, { customerId, email });
      await triggerClubNotfallkarten(email, lead?.dog_name);
      console.log(`[club] aktiviert (sub-fallback) lead=${leadId}`);
    } else {
      console.log(`[club] recurring ok lead=${leadId} — laeuft`);
    }
  }
}

// GET: Mollie schickt initial einen GET zur Webhook-Validierung
export async function GET() {
  return NextResponse.json({ ok: true });
}
