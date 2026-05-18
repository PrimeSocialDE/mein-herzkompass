// Facebook Conversions API (CAPI) — Server-Side Purchase Tracking.
//
// Warum CAPI? Browser-Pixel wird oft geblockt (iOS 14+, AdBlocker, Cookie-
// Consent). Server-Side schickt die Conversion ZUVERLAESSIG an Facebook,
// auch wenn der Browser nichts trackt.
//
// De-Duplication: Pixel + CAPI feuern dasselbe Event mit GLEICHER event_id
// (kommt aus Mollie/Stripe-Metadata als fb_event_id). Facebook erkennt
// das Duplikat und zaehlt nur EINMAL — gibt dafuer "Quality"-Boost weil
// beide Quellen matchen.
//
// Setup:
//   1. Im Facebook Business Manager → Events Manager → Pixel "Settings" →
//      "Conversions API" → "Generate Access Token"
//   2. Token in Vercel-Env adden: FB_CAPI_ACCESS_TOKEN=...
//   3. Pixel-ID env (optional): FB_PIXEL_ID=864109602683515 — sonst Default
//
// Wenn FB_CAPI_ACCESS_TOKEN nicht gesetzt: silent skip, kein Crash.

import "server-only";
import { createHash } from "node:crypto";

const FB_PIXEL_ID = process.env.FB_PIXEL_ID || "864109602683515";
const FB_CAPI_ACCESS_TOKEN = process.env.FB_CAPI_ACCESS_TOKEN || "";
const FB_API_VERSION = "v21.0";

function sha256(s: string): string {
  return createHash("sha256").update(s.trim().toLowerCase()).digest("hex");
}

interface PurchaseEventArgs {
  email: string;
  valueCents: number;
  currency?: string;
  fbp?: string | null;
  fbc?: string | null;
  eventId?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  // Optional Custom-Data
  contentName?: string;     // "1-Monatsplan" etc.
  contentIds?: string[];    // ["plan-1month"]
  // Test-Mode: Events landen unter "Test Events" Tab im Event Manager,
  // zaehlen nicht in echten Stats. Erforderlich fuer initiale Tests.
  testEventCode?: string;
}

export async function sendPurchaseEventCAPI(
  args: PurchaseEventArgs
): Promise<{ ok: boolean; reason?: string; trace?: any }> {
  if (!FB_CAPI_ACCESS_TOKEN) {
    return { ok: false, reason: "no_access_token" };
  }
  if (!args.email) {
    return { ok: false, reason: "no_email" };
  }

  const valueEur = args.valueCents / 100;
  const currency = args.currency || "EUR";

  const userData: Record<string, any> = {
    em: [sha256(args.email)],
  };
  if (args.fbp) userData.fbp = args.fbp;
  if (args.fbc) userData.fbc = args.fbc;
  if (args.clientIp) userData.client_ip_address = args.clientIp;
  if (args.clientUserAgent) userData.client_user_agent = args.clientUserAgent;

  const customData: Record<string, any> = {
    value: valueEur,
    currency,
  };
  if (args.contentName) customData.content_name = args.contentName;
  if (args.contentIds && args.contentIds.length > 0) {
    customData.content_ids = args.contentIds;
    customData.content_type = "product";
  }

  const event: Record<string, any> = {
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    action_source: "website",
    user_data: userData,
    custom_data: customData,
  };
  if (args.eventId) event.event_id = args.eventId;

  const payload: Record<string, any> = { data: [event] };
  if (args.testEventCode) payload.test_event_code = args.testEventCode;

  try {
    const url = `https://graph.facebook.com/${FB_API_VERSION}/${FB_PIXEL_ID}/events?access_token=${encodeURIComponent(
      FB_CAPI_ACCESS_TOKEN
    )}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(
        "[fb-capi] Purchase failed:",
        res.status,
        JSON.stringify(data).slice(0, 300)
      );
      return { ok: false, reason: `http_${res.status}`, trace: data };
    }
    return { ok: true, trace: data };
  } catch (e: any) {
    console.error("[fb-capi] exception:", e?.message);
    return { ok: false, reason: "exception" };
  }
}
