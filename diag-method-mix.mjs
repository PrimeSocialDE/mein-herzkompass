// Method-Mix der letzten N Mollie-Käufe.
import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const N = parseInt(process.argv[2] || "20", 10);

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

const { data: leads } = await sb
  .from("wauwerk_leads")
  .select("id, email, selected_plan, paid_at, mollie_payment_id")
  .eq("status", "paid")
  .eq("payment_provider", "mollie")
  .not("mollie_payment_id", "is", null)
  .order("paid_at", { ascending: false })
  .limit(N);

console.log(`Letzte ${leads?.length || 0} Mollie-Käufe:\n`);

const counts = {};
for (const l of leads || []) {
  try {
    const res = await fetch(`https://api.mollie.com/v2/payments/${l.mollie_payment_id}`, {
      headers: { Authorization: `Bearer ${process.env.MOLLIE_API_KEY}` },
    });
    const p = await res.json();
    const method = p.method || "unknown";
    counts[method] = (counts[method] || 0) + 1;
    const amount = p.amount?.value || "?";
    console.log(` ${l.paid_at?.slice(0, 16)} | ${method.padEnd(15)} | €${amount.padStart(6)} | ${l.selected_plan} | ${l.email}`);
  } catch (e) {
    console.log(` ${l.paid_at?.slice(0, 16)} | ERR ${e.message} | ${l.email}`);
  }
}

console.log("\n=== Method-Verteilung ===");
const total = Object.values(counts).reduce((a, b) => a + b, 0);
const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
for (const [m, c] of sorted) {
  const pct = ((c / total) * 100).toFixed(0);
  console.log(` ${m.padEnd(20)} ${String(c).padStart(3)} (${pct}%)`);
}
