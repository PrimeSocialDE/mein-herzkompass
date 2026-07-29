// Diagnose: welche Mollie-Leads sind paid aber ohne member_plan_content?
// Schickt NICHTS. Nur Read-only.
import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Letzte 30 Tage paid-Leads via Mollie
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
const { data: leads, error } = await sb
  .from("wauwerk_leads")
  .select("id, email, dog_name, selected_plan, status, payment_provider, mollie_payment_id, paid_at, created_at, answers")
  .eq("status", "paid")
  .gte("paid_at", thirtyDaysAgo)
  .order("paid_at", { ascending: false });

if (error) {
  console.error("fetch err:", error.message);
  process.exit(1);
}

console.log(`Paid-Leads letzte 30 Tage: ${leads.length}`);
const mollie = leads.filter(l => l.payment_provider === "mollie" || l.mollie_payment_id);
const stripe = leads.filter(l => l.payment_provider === "stripe" && !l.mollie_payment_id);
console.log(`  Mollie: ${mollie.length}, Stripe: ${stripe.length}, andere: ${leads.length - mollie.length - stripe.length}`);

// Welche haben einen Plan?
const emails = [...new Set(leads.map(l => String(l.email || "").toLowerCase()).filter(Boolean))];
const { data: plans } = await sb
  .from("member_plan_content")
  .select("email, plan_slug, created_at, source")
  .in("email", emails)
  .eq("plan_slug", "trainingsplan");

const planByEmail = new Map();
for (const p of plans || []) planByEmail.set(p.email.toLowerCase(), p);

console.log("\n=== MOLLIE-Leads OHNE Plan (letzte 30 Tage) ===");
const stuck = mollie.filter(l => !planByEmail.has(String(l.email).toLowerCase()));
for (const l of stuck) {
  const problem = l.answers?.dog_problem || l.answers?.problem || "(kein problem)";
  console.log(` - ${l.paid_at?.slice(0, 16)} | ${l.selected_plan} | ${problem} | ${l.email} | lead_id=${l.id}`);
}

console.log("\n=== MOLLIE-Leads MIT Plan (letzte 30 Tage) ===");
const ok = mollie.filter(l => planByEmail.has(String(l.email).toLowerCase()));
for (const l of ok) {
  const p = planByEmail.get(String(l.email).toLowerCase());
  console.log(` - ${l.paid_at?.slice(0, 16)} | ${l.email} → plan ${p.created_at?.slice(0, 16)} (${p.source})`);
}

console.log(`\nSummary: ${stuck.length} stuck / ${mollie.length} mollie-paid`);
