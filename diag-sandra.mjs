import { readFileSync } from "node:fs";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const EMAIL="sandra@serrano-home.de";
const sb=(await import("@supabase/supabase-js")).createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE,{auth:{persistSession:false}});
const {data}=await sb.from("wauwerk_leads").select("id,status,dog_name,selected_plan,plan_sent,paid_at,mollie_payment_id,mollie_payment_method,created_at,answers").ilike("email",EMAIL).order("created_at",{ascending:false});
console.log("=== Lead(s) ===");
for(const r of data||[]) console.log(`${r.id} | ${r.created_at?.slice(0,16)} | status=${r.status} | plan=${r.selected_plan} | plan_sent=${r.plan_sent} | method=${r.mollie_payment_method} | paid_at=${r.paid_at} | lang=${r.answers?.lang}`);
// Brevo-Contact-Status
const H={"api-key":process.env.BREVO_API_KEY,accept:"application/json"};
const r=await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(EMAIL)}`,{headers:H});
if(r.ok){ const c=await r.json(); console.log("\n=== Brevo ==="); console.log("emailBlacklisted:",c.emailBlacklisted,"| listUnsubscribed:",c.listUnsubscribed); }
else console.log("\nBrevo-Contact:",r.status,"(nicht gefunden?)");
