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

const upsellCallers = [
  "eva.niel@gmx.net",
  "schabes.anna@gmail.com",
  "claudia.schnider@gmx.net",
  "tes@gma.de",
];

console.log(`=== Mandate-Status der Upsell-Versucher in den letzten 48h ===\n`);
for (const email of upsellCallers) {
  const { data } = await sb.from("wauwerk_leads")
    .select("paid_at, status, mollie_customer_id, mollie_mandate_id, mollie_payment_method, mollie_payment_id")
    .ilike("email", email)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!data) {
    console.log(`${email}: KEIN LEAD GEFUNDEN`);
    continue;
  }
  console.log(`${email}:`);
  console.log(`  paid_at: ${data.paid_at || "—"}`);
  console.log(`  status: ${data.status}`);
  console.log(`  mollie_customer_id: ${data.mollie_customer_id || "—"}`);
  console.log(`  mollie_mandate_id:  ${data.mollie_mandate_id || "—"} ← entscheidet 1-Click`);
  console.log(`  mollie_method:      ${data.mollie_payment_method || "—"}`);
  console.log();
}
