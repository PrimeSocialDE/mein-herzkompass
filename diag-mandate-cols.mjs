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

const { data: sample, error } = await sb.from("wauwerk_leads").select("mollie_customer_id, mollie_mandate_id, mollie_payment_method").limit(1);
console.log("=== Migration-Check ===");
if (error) {
  console.log("❌ Spalten fehlen noch:", error.message);
} else {
  console.log("✓ Alle 3 Mandate-Spalten existieren in wauwerk_leads");
  console.log("  Beispiel-Row Keys:", Object.keys(sample[0] || {}));
}

// Schau ob schon einer der heutigen Kaeufer Mandate hat
const today = new Date(new Date().setHours(0,0,0,0)).toISOString();
const { data: paid } = await sb
  .from("wauwerk_leads")
  .select("email, paid_at, mollie_customer_id, mollie_mandate_id, mollie_payment_method")
  .eq("status", "paid")
  .gte("paid_at", today)
  .order("paid_at", { ascending: false });
console.log(`\n=== Heutige paid Käufer: ${paid?.length || 0} ===`);
let withMandate = 0;
for (const l of paid || []) {
  const hasMandate = !!l.mollie_mandate_id;
  if (hasMandate) withMandate++;
  console.log(`  ${l.paid_at?.slice(11,16)} | ${l.email} | mandate=${l.mollie_mandate_id ? "✓" : "—"} | method=${l.mollie_payment_method || "—"}`);
}
console.log(`\n→ Mit Mandate: ${withMandate}/${paid?.length || 0} (alte Käufer ohne, neue ab jetzt mit)`);
