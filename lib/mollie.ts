import createMollieClient, { MollieClient, Locale } from "@mollie/api-client";

export { Locale };

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

// ── PL-Account (lapaplan.pl) ────────────────────────────────────────────
// Separater Mollie-Account fuer den polnischen Markt (Waehrung PLN). Eigener
// Key MOLLIE_API_KEY_PL. Optionaler Test-Key MOLLIE_TEST_API_KEY_PL, falls
// spaeter vorhanden. Vollstaendig getrennt vom DE-Account oben.
let cachedPL: MollieClient | null = null;

export function getMolliePL(): MollieClient | null {
  if (cachedPL) return cachedPL;
  const mode = (process.env.MOLLIE_MODE || "live").toLowerCase();
  const apiKey =
    mode === "test"
      ? process.env.MOLLIE_TEST_API_KEY_PL || process.env.MOLLIE_API_KEY_PL
      : process.env.MOLLIE_API_KEY_PL;
  if (!apiKey) {
    console.error(
      `[mollie] Kein PL-API-Key gefunden. Setze MOLLIE_API_KEY_PL (live).`
    );
    return null;
  }
  cachedPL = createMollieClient({ apiKey });
  return cachedPL;
}

export function formatAmountEUR(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Waehrungs-agnostischer Betrags-Formatter (Cent/Grosze -> "X.XX").
export function formatAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}
