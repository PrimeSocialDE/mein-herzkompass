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

// Alle paid-Leads letzte 30 Tage + ihr member_users state
const thirtyDays = new Date(Date.now() - 30 * 86400_000).toISOString();
const { data: leads } = await sb
  .from("wauwerk_leads")
  .select("id, email, status, paid_at, payment_provider, mollie_payment_id")
  .eq("status", "paid")
  .gte("paid_at", thirtyDays)
  .order("paid_at", { ascending: false });

const emails = [...new Set(leads.map(l => String(l.email || "").toLowerCase()))];
const { data: members } = await sb
  .from("member_users")
  .select("id, email, purchase_status, purchased_at, source_lead_id, created_at")
  .in("email", emails);
const memberByEmail = new Map();
for (const m of members || []) memberByEmail.set(m.email.toLowerCase(), m);

const { data: plans } = await sb
  .from("member_plan_content")
  .select("email, created_at")
  .in("email", emails)
  .eq("plan_slug", "trainingsplan");
const planByEmail = new Map();
for (const p of plans || []) planByEmail.set(p.email.toLowerCase(), p);

console.log("Paid-Lead | member_users (status / since) | Plan? | Mollie?");
console.log("─".repeat(120));
for (const l of leads) {
  const m = memberByEmail.get(l.email.toLowerCase());
  const p = planByEmail.get(l.email.toLowerCase());
  const isMollie = l.payment_provider === "mollie" || l.mollie_payment_id;
  const mState = m
    ? `${m.purchase_status} (${m.purchased_at?.slice(0,10) || "no-date"})`
    : "─ kein Profil ─";
  console.log(
    `${l.paid_at?.slice(0, 16)} | ${l.email.padEnd(38)} | ${mState.padEnd(28)} | ${p ? "✅" : "❌"} | ${isMollie ? "Mo" : "Stripe"}`
  );
}

const stuckMembers = leads.filter(l => {
  const m = memberByEmail.get(l.email.toLowerCase());
  return m && m.purchase_status !== "paid";
});
console.log(`\n⚠️  Stuck members (paid lead aber member.purchase_status != paid): ${stuckMembers.length}`);
for (const l of stuckMembers) {
  const m = memberByEmail.get(l.email.toLowerCase());
  console.log(`  - ${l.email}: status=${m.purchase_status}, source_lead=${m.source_lead_id || "null"}`);
}
