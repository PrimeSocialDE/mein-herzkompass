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

const { data: leads, error: le } = await sb
  .from("wauwerk_leads")
  .select("id,email,selected_plan,status,dog_name,paid_at,created_at")
  .ilike("email","max@primesocial.de")
  .order("created_at",{ascending:false});
if (le) console.error("lead-err:", le.message);
console.log("Leads für max@primesocial.de:");
for (const l of leads || []) console.log(` - ${l.selected_plan} | status=${l.status} | paid_at=${l.paid_at?.slice(0,16)} | id=${l.id}`);

const { data: plans } = await sb
  .from("member_plan_content")
  .select("email,plan_length_months,created_at")
  .ilike("email","max@primesocial.de")
  .order("created_at",{ascending:false});
console.log("\nPläne in member_plan_content:");
for (const p of plans || []) console.log(` - ${p.created_at?.slice(0,16)} | ${p.plan_length_months} Monate`);
