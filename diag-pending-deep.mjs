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

const since = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
const { data: all, error: e1 } = await sb
  .from("wauwerk_leads")
  .select("*")
  .gte("created_at", since)
  .order("created_at", { ascending: true });
if (e1) { console.error("err:", e1); process.exit(1); }

console.log(`Total heute: ${all.length}`);

// Variant detection via answers
function getVariant(l) {
  const a = l.answers || {};
  const lp = a.landing_page || "";
  const sp = a.source_page || "";
  if (lp.includes("deinplan3") || sp.includes("deinplan3")) return "A (deinplan3)";
  if (lp.includes("deinplan6") || sp.includes("deinplan6")) return "C (deinplan6)";
  if (lp.includes("deinplan4") || sp.includes("deinplan4")) return "B (deinplan4)";
  // checkout payload may contain plan_origin
  return a.ab_variant || a.ab_test || a.plan_page || "?";
}

console.log("\n=== Status x Variante (heute) ===");
const matrix = new Map();
for (const l of all) {
  const v = getVariant(l);
  const key = `${l.status}|${v}`;
  matrix.set(key, (matrix.get(key) || 0) + 1);
}
for (const [k, v] of [...matrix.entries()].sort()) {
  console.log(`  ${k} = ${v}`);
}

console.log("\n=== Pending-Bucket Details (Plan sichern gedrueckt, KEIN Mollie-Payment) ===");
const pending = all.filter(l => l.status === "pending");
for (const l of pending) {
  const a = l.answers || {};
  const t = l.created_at.slice(11,16);
  console.log(`\n  ${t} | ${l.email} | sel=${l.selected_plan}`);
  console.log(`    landing_page: ${a.landing_page || "—"}`);
  console.log(`    utm_source: ${a.utm_source || "—"} | utm_campaign: ${a.utm_campaign || "—"}`);
  console.log(`    device_type: ${a.device_type || "—"} | in_app_browser: ${a.in_app_browser || "—"}`);
  console.log(`    payment_provider: ${l.payment_provider || "—"}`);
}

console.log("\n=== Checkout_started (Mollie hat tr_ angelegt, aber nicht bezahlt) ===");
const cs = all.filter(l => l.status === "checkout_started");
for (const l of cs) {
  const a = l.answers || {};
  const t = l.created_at.slice(11,16);
  console.log(`\n  ${t} | ${l.email} | sel=${l.selected_plan} | mollie=${l.mollie_payment_id}`);
  console.log(`    device_type: ${a.device_type || "—"} | in_app_browser: ${a.in_app_browser || "—"}`);
  console.log(`    landing_page: ${a.landing_page || "—"}`);
  console.log(`    utm_source: ${a.utm_source || "—"}`);
}

console.log("\n=== Failed (Mollie hat angelegt + Status failed) ===");
const fail = all.filter(l => l.status === "failed");
for (const l of fail) {
  const a = l.answers || {};
  const t = l.created_at.slice(11,16);
  console.log(`\n  ${t} | ${l.email} | sel=${l.selected_plan} | mollie=${l.mollie_payment_id}`);
  console.log(`    device_type: ${a.device_type || "—"} | in_app_browser: ${a.in_app_browser || "—"}`);
  console.log(`    refund_reason: ${l.refund_reason || "—"}`);
}

// Compare: gestern (2026-05-23) zum gleichen Wochentag — wie war der Funnel?
const start23 = new Date("2026-05-23T00:00:00Z").toISOString();
const end23 = new Date("2026-05-24T00:00:00Z").toISOString();
const { data: yesterday } = await sb
  .from("wauwerk_leads")
  .select("status, mollie_payment_id")
  .gte("created_at", start23)
  .lt("created_at", end23);
const ystat = {};
for (const l of yesterday || []) ystat[l.status] = (ystat[l.status] || 0) + 1;
console.log("\n=== Vergleich gestern 2026-05-23 ===");
console.log(ystat);
