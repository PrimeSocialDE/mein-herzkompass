import { readFileSync } from "node:fs";
try {
  const e = readFileSync("/Users/maxxx/Documents/nextjs-boilerplate-main/.env.local","utf8");
  for (const l of e.split("\n")) {
    const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
  }
} catch {}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth:{autoRefreshToken:false,persistSession:false} });

const EMAIL = "conny.spe@web.de";

// 1) Lead-Details voll auflisten
const { data: leads } = await sb
  .from("wauwerk_leads")
  .select("*")
  .ilike("email", EMAIL)
  .order("created_at", { ascending: false });

console.log(`Leads für ${EMAIL}: ${leads?.length || 0}\n`);
for (const l of leads || []) {
  console.log(`--- Lead ${l.id} ---`);
  console.log(`  created_at:      ${l.created_at}`);
  console.log(`  paid_at:         ${l.paid_at}`);
  console.log(`  status:          ${l.status}`);
  console.log(`  selected_plan:   ${l.selected_plan}`);
  console.log(`  dog_name:        ${l.dog_name}`);
  console.log(`  customer_name:   ${l.customer_name}`);
  console.log(`  mollie_payment_id: ${l.mollie_payment_id || "(keiner)"}`);
  console.log(`  stripe_session_id: ${l.stripe_session_id || "(keiner)"}`);
  console.log(`  answers keys:    ${Object.keys(l.answers || {}).join(", ")}`);
  const a = l.answers || {};
  console.log(`  dog_problem:     ${a.dog_problem || a.problem || a.main_problem || "(none)"}`);
  console.log(`  dog_age:         ${a.dog_age}`);
  console.log(`  dog_breed:       ${a.dog_breed}`);
  console.log(`  custom_problem_text: ${(a.custom_problem_text || "").slice(0,120)}`);
  console.log();
}

// 2) Plan in DB?
const { data: plans } = await sb
  .from("member_plan_content")
  .select("id, plan_title, plan_slug, source, created_at, source_payment_id")
  .ilike("email", EMAIL)
  .order("created_at", { ascending: false });
console.log(`Plan-Eintrage in member_plan_content: ${plans?.length || 0}`);
for (const p of plans || []) {
  console.log(` - ${p.created_at?.slice(0,16)} | ${p.plan_slug} | ${p.plan_title} | source=${p.source} | src_payment=${p.source_payment_id}`);
}
