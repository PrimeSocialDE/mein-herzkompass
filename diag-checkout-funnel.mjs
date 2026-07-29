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

// Letzte 14 Tage Mollie-Leads, Funnel-Auswertung
const since = new Date(Date.now() - 14 * 86400_000).toISOString();
const { data: leads } = await sb
  .from("wauwerk_leads")
  .select("id, email, status, payment_provider, mollie_payment_id, created_at, paid_at")
  .gte("created_at", since)
  .or("payment_provider.eq.mollie,mollie_payment_id.not.is.null")
  .order("created_at", { ascending: false });

const stats = { total: 0, paid: 0, checkout_started: 0, failed: 0, pending: 0, other: 0 };
const byDay = new Map();
for (const l of leads || []) {
  stats.total++;
  if (l.status === "paid") stats.paid++;
  else if (l.status === "checkout_started") stats.checkout_started++;
  else if (l.status === "failed") stats.failed++;
  else if (l.status === "pending") stats.pending++;
  else stats.other++;
  const day = l.created_at.slice(0, 10);
  if (!byDay.has(day)) byDay.set(day, { total: 0, paid: 0, failed: 0, checkout_started: 0 });
  const d = byDay.get(day);
  d.total++;
  if (l.status === "paid") d.paid++;
  else if (l.status === "failed") d.failed++;
  else if (l.status === "checkout_started") d.checkout_started++;
}

console.log("=== Mollie-Checkout-Funnel letzte 14 Tage ===");
console.log(stats);
console.log(`Conversion (paid/total): ${((stats.paid / stats.total) * 100).toFixed(1)}%`);
console.log(`Drop-off (failed/total): ${((stats.failed / stats.total) * 100).toFixed(1)}%`);
console.log(`Hang (checkout_started/total): ${((stats.checkout_started / stats.total) * 100).toFixed(1)}%`);

console.log("\n=== Per Tag ===");
const days = [...byDay.keys()].sort().reverse();
for (const d of days) {
  const s = byDay.get(d);
  const conv = s.total ? ((s.paid / s.total) * 100).toFixed(0) : "0";
  console.log(` ${d} | total=${s.total} | paid=${s.paid} (${conv}%) | failed=${s.failed} | checkout=${s.checkout_started}`);
}

// Sample 5 letzte failed/checkout_started — gucken ob ein Muster
console.log("\n=== Letzte 5 failed/checkout_started — Email-Pattern? ===");
const stuck = (leads || []).filter(l => l.status === "failed" || l.status === "checkout_started").slice(0, 10);
for (const l of stuck) {
  console.log(` ${l.created_at.slice(0,16)} | ${l.status.padEnd(18)} | ${l.email}`);
}
