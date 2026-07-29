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

const email = "afelice@bluewin.ch";
const { data, error } = await sb
  .from("wauwerk_leads")
  .select("*")
  .eq("email", email)
  .order("created_at", { ascending: false });
if (error) { console.error(error); process.exit(1); }

console.log(`=== Leads für ${email}: ${data.length} ===\n`);
for (const l of data) {
  console.log(`ID: ${l.id}`);
  console.log(`  status: ${l.status} | selected_plan: ${l.selected_plan} | price: ${l.price}`);
  console.log(`  dog_name: ${l.dog_name} | paid_at: ${l.paid_at} | created: ${l.created_at}`);
  console.log(`  mollie: ${l.mollie_payment_id} | plan_sent: ${l.plan_sent}`);
  const a = l.answers || {};
  console.log(`  Hund: ${a.dog_name || l.dog_name} | Rasse: ${a.dog_breed} | Alter: ${a.dog_age} | Geschlecht: ${a.dog_gender}`);
  console.log(`  Problem: ${a.dog_problem} | Custom: ${a.custom_problem_text}`);
  console.log(`  Ziel: ${a.dog_goal || a.dog_goals}`);
  console.log();
}
