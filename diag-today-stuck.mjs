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

// Heutige hängenden + failed Leads — komplettes Bild
const since = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
const { data: leads, error } = await sb
  .from("wauwerk_leads")
  .select("*")
  .gte("created_at", since)
  .order("created_at", { ascending: false });
if (error) { console.error(error); process.exit(1); }

console.log(`=== Alle Leads heute (${since.slice(0,10)}): ${leads.length} ===\n`);
for (const l of leads) {
  const t = l.created_at.slice(11, 16);
  const paid = l.paid_at ? l.paid_at.slice(11,16) : "—";
  const planFromAns = l.answers?.selected_plan || l.answers?.plan || "?";
  const sel = l.selected_plan || "?";
  console.log(`${t} | ${l.status.padEnd(17)} | ${(l.email||"NO_EMAIL").padEnd(30)} | sel=${sel} | ans.plan=${planFromAns} | mollie=${l.mollie_payment_id || "—"} | paid_at=${paid}`);
}

console.log("\n=== Detail: hängenden checkout_started + heutige failed ===\n");
const stuck = leads.filter(l => l.status === "checkout_started" || l.status === "failed");
for (const l of stuck) {
  console.log(`--- ${l.email} (${l.status}) ---`);
  console.log(`  created: ${l.created_at}`);
  console.log(`  selected_plan: ${l.selected_plan}`);
  console.log(`  mollie_payment_id: ${l.mollie_payment_id}`);
  console.log(`  ab_test: ${l.answers?.ab_test || l.ab_test || "?"}`);
  console.log(`  dog_problem: ${l.answers?.dog_problem || l.dog_problem || "?"}`);
  console.log(`  source_page: ${l.answers?.source_page || "?"}`);
  console.log(`  payment_method: ${l.payment_method || "?"}`);
  console.log(`  metadata keys: ${Object.keys(l.answers || {}).join(", ")}`);
  console.log(`  refund_reason: ${l.refund_reason || "—"}`);
  console.log();
}
