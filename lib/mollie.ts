import createMollieClient, { MollieClient } from "@mollie/api-client";

let cached: MollieClient | null = null;

export function getMollie(): MollieClient | null {
  if (cached) return cached;

  const mode = (process.env.MOLLIE_MODE || "live").toLowerCase();
  const apiKey =
    mode === "test"
      ? process.env.MOLLIE_TEST_API_KEY
      : process.env.MOLLIE_API_KEY;

  if (!apiKey) {
    console.error(
      `[mollie] Kein API-Key gefunden für mode=${mode}. ` +
        `Setze MOLLIE_API_KEY (live) bzw. MOLLIE_TEST_API_KEY (test).`
    );
    return null;
  }

  cached = createMollieClient({ apiKey });
  return cached;
}

export function formatAmountEUR(cents: number): string {
  return (cents / 100).toFixed(2);
}
