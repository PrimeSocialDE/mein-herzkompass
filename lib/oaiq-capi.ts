// OpenAI / ChatGPT Ads — Server-Side Conversions API (Pendant zu fb-capi.ts).
//
// Warum? Der Browser-Pixel (oaiq) wird oft geblockt (AdBlocker, iOS, Consent).
// Der Server schickt die Conversion ZUVERLÄSSIG an OpenAI — auch wenn der
// Browser nichts trackt.
//
// De-Duplication: Client-Pixel (oaiq("measure","purchase",...)) und dieser
// Server-Call sollten dieselbe event `id` benutzen, dann zählt OpenAI nur EINMAL.
// Wir reichen die vorhandene fb_event_id aus der Mollie/Stripe-Metadata durch.
//
// Setup:
//   1. Conversion-Schlüssel (API-Key) aus dem OpenAI-Ads-Dashboard holen.
//   2. In Vercel-Env adden:
//        OPENAI_PIXEL_API_KEY=<der-Conversion-Schlüssel>
//        OPENAI_PIXEL_ID=EqCK4x27xqXvid8k7ctioD   (optional, sonst Default)
//   NIEMALS in den Client / ins HTML — der Schlüssel bleibt serverseitig.
//
// Wenn OPENAI_PIXEL_API_KEY nicht gesetzt ist: silent skip, kein Crash.

import "server-only";

const OPENAI_PIXEL_ID = process.env.OPENAI_PIXEL_ID || "EqCK4x27xqXvid8k7ctioD";
const OPENAI_PIXEL_API_KEY = process.env.OPENAI_PIXEL_API_KEY || "";
const OAIQ_EVENTS_URL = "https://bzr.openai.com/v1/events";

interface OaiqEventArgs {
  /** Event-Typ, z. B. "order_created", "lead_created", "page_viewed". */
  type?: string;
  valueCents?: number;
  currency?: string;
  /** Event-ID für Dedup mit dem Client-Pixel (z. B. fb_event_id). */
  eventId?: string | null;
  /** Ursprungs-URL der Conversion. */
  sourceUrl?: string | null;
  /** Optionaler Zeitstempel (ms); Default jetzt. */
  timestampMs?: number;
}

export async function sendPurchaseEventOaiq(
  args: OaiqEventArgs
): Promise<{ ok: boolean; reason?: string; trace?: any }> {
  if (!OPENAI_PIXEL_API_KEY) {
    return { ok: false, reason: "no_api_key" };
  }

  const type = args.type || "order_created";
  const data: Record<string, any> = { type: "contents" };
  if (typeof args.valueCents === "number") {
    data.value = args.valueCents / 100;
    data.currency = args.currency || "EUR";
  }

  const event: Record<string, any> = {
    type,
    timestamp_ms: args.timestampMs || Date.now(),
    action_source: "web",
    data,
  };
  if (args.eventId) event.id = args.eventId;
  if (args.sourceUrl) event.source_url = args.sourceUrl;

  const payload = { validate_only: false, events: [event] };

  try {
    const url = `${OAIQ_EVENTS_URL}?pid=${encodeURIComponent(OPENAI_PIXEL_ID)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_PIXEL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const trace = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(
        "[oaiq-capi] event failed:",
        res.status,
        JSON.stringify(trace).slice(0, 300)
      );
      return { ok: false, reason: `http_${res.status}`, trace };
    }
    return { ok: true, trace };
  } catch (e: any) {
    console.error("[oaiq-capi] exception:", e?.message);
    return { ok: false, reason: "exception" };
  }
}
