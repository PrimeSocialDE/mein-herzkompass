import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getMollie, getMolliePL } from "@/lib/mollie";

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
  // Optionaler success-Pfad (Dashboard-Checkout: /mitglieder?bought=1).
  // Wenn nicht gesetzt: default zusatz.html (Marketing-Upsell-Page).
  const successPathRaw = url.searchParams.get("success") || "";
  const successPath =
    successPathRaw.startsWith("/") && !successPathRaw.includes("://")
      ? successPathRaw
      : "";

  // PL-Zahlungen (acct=pl) mit dem PL-Mollie-Key pruefen.
  const isPL = url.searchParams.get("acct") === "pl";
  const mollie = isPL ? getMolliePL() : getMollie();
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

        // selected_plan aus der TATSÄCHLICH bezahlten Mollie-Metadata übernehmen.
        // Sonst bleibt eine veraltete/falsche Länge stehen (z.B. vorausgewähltes
        // 3month) und der Plan-Generator erzeugt den falschen Plan. Der Webhook
        // macht dieselbe Korrektur — aber wenn DIESER Safety-Net die Zahlung
        // zuerst als processed markiert, skippt der Webhook danach (Idempotenz),
        // also muss die Korrektur hier passieren.
        const paidPlan = payment?.metadata?.plan;
        if (
          (paidPlan === "1month" ||
            paidPlan === "3month" ||
            paidPlan === "6month") &&
          paidPlan !== lead.selected_plan
        ) {
          updateData.selected_plan = paidPlan;
          console.log(
            `[mollie-return] selected_plan korrigiert: ${lead.selected_plan} → ${paidPlan} (lead ${leadId})`
          );
        }

        // FRISCHER Read direkt vor dem Schreiben. Bei PayPal feuern Mollie-Webhook
        // (Server→Server) und dieser Return-Redirect (Browser) quasi zeitgleich.
        // Der Webhook liefert den Order-Bump aus und setzt Flags in answers
        // (order_bump_delivered, grundkommandos_pending_at). Unser prevAnswers-
        // Snapshot ist vom Anfang des Handlers — also VOR dem Webhook. Wuerden wir
        // damit schreiben, clobbern wir die Bump-Flags → der Grundkommando-Cron
        // sieht den Kaeufer nie. Deshalb: frisch lesen, und wenn der Webhook uns
        // zuvorgekommen ist (payment.id schon in processed_payment_ids), NICHTS tun
        // (er hat DB-Update, member-sync und Make bereits erledigt). Sonst auf den
        // FRISCHEN Stand mergen, damit evtl. schon gesetzte Flags erhalten bleiben.
        const { data: freshLead } = await supabase
          .from("wauwerk_leads")
          .select("answers")
          .eq("id", leadId)
          .maybeSingle();
        const freshAnswers = (freshLead?.answers || prevAnswers) as Record<
          string,
          any
        >;
        const freshProcessed: string[] = Array.isArray(
          freshAnswers.processed_payment_ids
        )
          ? freshAnswers.processed_payment_ids
          : [];

        if (freshProcessed.includes(lead.mollie_payment_id)) {
          console.log(
            `[mollie-return] Webhook war schneller fuer ${lead.mollie_payment_id} — ` +
              `Safety-Net skip (kein Clobber, kein Doppel-Make)`
          );
        } else {
          updateData.answers = {
            ...freshAnswers,
            processed_payment_ids: [
              ...freshProcessed,
              lead.mollie_payment_id,
            ],
            paid_via_safety_net_at: new Date().toISOString(),
          };

          await supabase
            .from("wauwerk_leads")
            .update(updateData)
            .eq("id", leadId);

          // Direct-Sync member_users falls schon Profil vorhanden
          const leadEmail = lead.email || payment?.metadata?.email || null;
          if (leadEmail) {
            try {
              const { syncMemberPaidStatusFromLead } = await import(
                "@/lib/member-db"
              );
              await syncMemberPaidStatusFromLead({
                email: leadEmail,
                paidAt: updateData.paid_at,
                leadId,
              });
            } catch (e: any) {
              console.error("[mollie-return] member-sync failed:", e?.message);
            }
          }

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
      }
    } catch (e) {
      console.error("[mollie-return] Safety-Net Exception:", e);
      // Trotz Fehler weiterleiten — User darf nicht hängen bleiben
    }

    // Dashboard-Flow (successPath gesetzt): zurueck ins Dashboard mit
    // bought=1-Flag. Marketing-Flow (kein successPath): zur Upsell-Page.
    const successUrl = successPath
      ? `${url.origin}${successPath}${successPath.includes("?") ? "&" : "?"}` +
        `lead_id=${encodeURIComponent(leadId)}` +
        `&redirect_status=succeeded`
      : `${url.origin}/${isPL ? "dziekujemy.html" : "zusatz.html"}` +
        `?lead_id=${encodeURIComponent(leadId)}` +
        `&redirect_status=succeeded` +
        `&mollie_payment_id=${encodeURIComponent(lead.mollie_payment_id)}`;
    return NextResponse.redirect(successUrl, { status: 303 });
  }

  return NextResponse.redirect(cancelUrl, { status: 303 });
}
