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

const LEAD_ID = process.argv[2] || "0eefe1be-9432-491a-906a-19284a01405a";

console.log("=== 1) wauwerk_leads ===");
const { data: lead, error } = await sb.from("wauwerk_leads").select("*").eq("id", LEAD_ID).maybeSingle();
if (error) { console.error("ERR", error); process.exit(1); }
if (!lead) { console.log("Lead nicht gefunden"); process.exit(1); }

console.log({
  id: lead.id,
  email: lead.email,
  status: lead.status,
  payment_provider: lead.payment_provider,
  mollie_payment_id: lead.mollie_payment_id,
  paid_at: lead.paid_at?.slice(0, 19),
  selected_plan: lead.selected_plan,
  dog_name: lead.dog_name,
  dog_problem: lead.dog_problem || lead.answers?.dog_problem,
  customer_name: lead.customer_name,
  created_at: lead.created_at?.slice(0, 19),
  upsell_module: lead.upsell_module,
  upsell_modules: lead.upsell_modules,
  upsell_paid_at: lead.upsell_paid_at?.slice(0, 19),
  referred_by_code: lead.referred_by_code,
  utm_source: lead.utm_source,
  utm_campaign: lead.utm_campaign,
});

console.log("\nanswers (alle keys):", Object.keys(lead.answers || {}));
console.log("processed_payment_ids:", lead.answers?.processed_payment_ids || []);
console.log("paid_via_safety_net_at:", lead.answers?.paid_via_safety_net_at);

console.log("\n=== 2) Trigger-Audit (plan_gen_audit) ===");
const { data: audit } = await sb
  .from("plan_gen_audit")
  .select("*")
  .eq("lead_id", LEAD_ID)
  .order("fired_at", { ascending: false });
console.log(`Audit-Eintraege: ${audit?.length || 0}`);
for (const a of audit || []) {
  console.log(` ${a.fired_at?.slice(0,19)} | ${a.old_status}→${a.new_status} | req=${a.pg_net_request_id} | ${a.note}`);
}

console.log("\n=== 3) Response-Details (plan_gen_responses) ===");
const { data: resps } = await sb
  .from("plan_gen_responses")
  .select("*")
  .eq("lead_id", LEAD_ID)
  .order("fired_at", { ascending: false });
for (const r of resps || []) {
  console.log(` audit=${r.audit_id} | http=${r.status_code} | err=${r.response_error || "-"}`);
  if (r.response_body) console.log(`   body: ${String(r.response_body).slice(0, 300)}`);
}

console.log("\n=== 4) member_plan_content für diese email ===");
if (lead.email) {
  const { data: plans } = await sb
    .from("member_plan_content")
    .select("id, plan_slug, source, source_payment_id, created_at")
    .ilike("email", lead.email)
    .order("created_at", { ascending: false });
  console.log(`Plans: ${plans?.length || 0}`);
  for (const p of plans || []) {
    console.log(` ${p.created_at?.slice(0,19)} | ${p.plan_slug} | source=${p.source} | source_id=${p.source_payment_id}`);
  }
}

console.log("\n=== 5) member_users für diese email ===");
if (lead.email) {
  const { data: m } = await sb
    .from("member_users")
    .select("id, email, purchase_status, purchased_at, source_lead_id")
    .ilike("email", lead.email)
    .maybeSingle();
  console.log(m || "(kein member_users-Eintrag)");
}

// Mollie API direkt prüfen wenn Payment-ID da
if (lead.mollie_payment_id && process.env.MOLLIE_API_KEY) {
  console.log("\n=== 6) Mollie-Payment-Status (live API) ===");
  try {
    const res = await fetch(`https://api.mollie.com/v2/payments/${lead.mollie_payment_id}`, {
      headers: { Authorization: `Bearer ${process.env.MOLLIE_API_KEY}` },
    });
    const data = await res.json();
    console.log({
      id: data.id,
      status: data.status,
      method: data.method,
      amount: data.amount,
      createdAt: data.createdAt,
      paidAt: data.paidAt,
      failedAt: data.failedAt,
      canceledAt: data.canceledAt,
      details: data.details,
      metadata: data.metadata,
    });
  } catch (e) {
    console.error("Mollie API Fehler:", e.message);
  }
}
