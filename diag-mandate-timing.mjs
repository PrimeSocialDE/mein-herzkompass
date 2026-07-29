import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

const since = new Date(Date.now() - 12 * 3600_000).toISOString();
const { data: paid } = await sb
  .from("wauwerk_leads")
  .select("email, paid_at, mollie_customer_id, mollie_mandate_id, mollie_payment_method")
  .eq("status", "paid")
  .gte("paid_at", since)
  .order("paid_at", { ascending: false });

console.log(`=== Paid letzte 12h: ${paid.length} ===\n`);
let withMandate = 0, customerOnly = 0, none = 0;
for (const l of paid) {
  const status = l.mollie_mandate_id ? "MANDATE ✓" : (l.mollie_customer_id ? "customer-only" : "—");
  if (l.mollie_mandate_id) withMandate++;
  else if (l.mollie_customer_id) customerOnly++;
  else none++;
  console.log(`  ${l.paid_at.slice(11,16)} | ${status.padEnd(15)} | ${(l.mollie_payment_method || "—").padEnd(12)} | ${l.email}`);
}
console.log(`\nTotal:           ${paid.length}`);
console.log(`Mit Mandate:     ${withMandate}`);
console.log(`Nur Customer:    ${customerOnly}  ← Webhook hat Mandate noch nicht geschrieben oder Methode unsupported`);
console.log(`Weder noch:      ${none}  ← Erstkauf vor Deploy oder ApplePay/Klarna`);
