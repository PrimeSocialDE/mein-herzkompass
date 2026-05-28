// Brevo Listen-Sync fuer Kunden-Status.
//
// Flow:
//   Quiz-Abschluss   → Lead landet in #47 (email_captured) via /api/brevo-contact
//   Kauf erfolgreich → /api/mollie/webhook ruft syncPaidCustomerLists()
//                       - removed aus #47 (sonst kriegt Kunde Nurture-Mails)
//                       - added in #44 / #45 / #46 je nach Plan-Laenge
//
// IDs sind ueber env ueberschreibbar falls die Listen mal umgezogen werden.
// Defaults entsprechen dem aktuellen Brevo-Setup (Stand 2026-05).

import "server-only";

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";

// Listen-IDs — default-Werte aus aktuellem Brevo-Setup
const LIST_NURTURE = parseInt(process.env.BREVO_LIST_NURTURE || "47", 10);
const LIST_1M = parseInt(process.env.BREVO_LIST_1M || "44", 10);
const LIST_3M = parseInt(process.env.BREVO_LIST_3M || "45", 10);
const LIST_6M = parseInt(process.env.BREVO_LIST_6M || "46", 10);
// Warm-Recovery: User die im Checkout abgebrochen haben (pending/failed).
// Sie verlassen Nurture und kriegen unseren eigenen 5-Mail-Drip statt des
// generischen Brevo-Workflows. Bei Conversion zu paid landen sie in
// LIST_1M/3M/6M — diese Sync-Logik ist in syncPaidCustomerLists().
const LIST_WARM_RECOVERY = parseInt(
  process.env.BREVO_LIST_WARM_RECOVERY || "82",
  10
);

type PlanLength = 1 | 3 | 6;

function listIdForPlan(months: PlanLength): number {
  if (months === 1) return LIST_1M;
  if (months === 6) return LIST_6M;
  return LIST_3M;
}

async function brevoRemoveFromList(email: string, listId: number) {
  if (!BREVO_API_KEY) return { ok: false, reason: "no_api_key" };
  try {
    const res = await fetch(
      `https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`,
      {
        method: "POST",
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emails: [email] }),
      }
    );
    if (res.ok) return { ok: true };
    const txt = await res.text();
    // 400 mit "Contact already removed from list" = success, idempotent
    if (txt.includes("already removed") || txt.includes("not in list")) {
      return { ok: true };
    }
    console.warn(
      `[brevo] removeFromList ${listId} for ${email} failed:`,
      res.status,
      txt.slice(0, 200)
    );
    return { ok: false, reason: `http_${res.status}` };
  } catch (e: any) {
    console.error("[brevo] removeFromList exception:", e?.message);
    return { ok: false, reason: "exception" };
  }
}

async function brevoAddToList(email: string, listId: number) {
  if (!BREVO_API_KEY) return { ok: false, reason: "no_api_key" };
  try {
    // POST /v3/contacts mit listIds + updateEnabled funktioniert sowohl
    // fuer neue als auch fuer existing contacts. Atomar in einem Call.
    const res = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        listIds: [listId],
        updateEnabled: true,
      }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    // duplicate_parameter = User existiert schon und ist evtl. schon in Liste
    if (data.code === "duplicate_parameter") return { ok: true };
    console.warn(
      `[brevo] addToList ${listId} for ${email} failed:`,
      res.status,
      data
    );
    return { ok: false, reason: `http_${res.status}` };
  } catch (e: any) {
    console.error("[brevo] addToList exception:", e?.message);
    return { ok: false, reason: "exception" };
  }
}

// Hauptfunktion: bei Kauf aufrufen. Idempotent — kann safe mehrfach
// gerufen werden ohne Schaden (z.B. Mollie-Webhook + Stripe-Webhook +
// pg_net Reconciliation).
export async function syncPaidCustomerLists(
  email: string,
  planLengthMonths: PlanLength
): Promise<{ removed: boolean; added: boolean }> {
  if (!email) return { removed: false, added: false };
  const lower = email.trim().toLowerCase();
  if (!lower) return { removed: false, added: false };

  const targetList = listIdForPlan(planLengthMonths);

  // Parallel — kein gegenseitiges Warten noetig
  const [removeRes, addRes] = await Promise.all([
    brevoRemoveFromList(lower, LIST_NURTURE),
    brevoAddToList(lower, targetList),
  ]);

  return {
    removed: removeRes.ok,
    added: addRes.ok,
  };
}

// Bei pending/failed (User hat Checkout begonnen, aber nicht abgeschlossen):
// User aus Nurture rausnehmen + in Warm-Recovery rein. Damit kriegen sie
// nicht doppelt Mails (Brevo-Workflow + unser Drip). User muss den generischen
// Brevo-Workflow im UI auf "nur Nurture-Liste" filtern lassen.
//
// Idempotent — kann safe mehrfach gerufen werden.
export async function syncWarmRecoveryLists(email: string): Promise<{
  movedFromNurture: boolean;
  addedToWarmRecovery: boolean;
}> {
  if (!email) return { movedFromNurture: false, addedToWarmRecovery: false };
  const lower = email.trim().toLowerCase();
  if (!lower) return { movedFromNurture: false, addedToWarmRecovery: false };

  const [removeRes, addRes] = await Promise.all([
    brevoRemoveFromList(lower, LIST_NURTURE),
    brevoAddToList(lower, LIST_WARM_RECOVERY),
  ]);

  return {
    movedFromNurture: removeRes.ok,
    addedToWarmRecovery: addRes.ok,
  };
}

// Bei paid (User hat doch noch gekauft): aus Warm-Recovery entfernen.
// Wird vom Mollie-Webhook zusammen mit syncPaidCustomerLists aufgerufen.
export async function removeFromWarmRecoveryList(
  email: string
): Promise<{ ok: boolean }> {
  if (!email) return { ok: false };
  const lower = email.trim().toLowerCase();
  if (!lower) return { ok: false };
  const res = await brevoRemoveFromList(lower, LIST_WARM_RECOVERY);
  return { ok: res.ok };
}

// Helper fuer Backfill — wenn jemand schon paid ist aber Listen noch alt
export async function syncPaidCustomerListsFromSelectedPlan(
  email: string,
  selectedPlan: string | null
): Promise<{ removed: boolean; added: boolean; planMonths: PlanLength }> {
  const months: PlanLength =
    selectedPlan === "1month" ? 1 : selectedPlan === "6month" ? 6 : 3;
  const res = await syncPaidCustomerLists(email, months);
  return { ...res, planMonths: months };
}
