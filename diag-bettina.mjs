import { readFileSync } from "node:fs";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const TOKEN=process.env.WORKER_TOKEN;
const sb=(await import("@supabase/supabase-js")).createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE,{auth:{persistSession:false}});
const EMAIL="bettinakrotki@gmail.com";
const {data}=await sb.from("wauwerk_leads").select("id,status,selected_plan,dog_name,plan_sent,paid_at,mollie_payment_method,answers").ilike("email",EMAIL).order("created_at",{ascending:false});
console.log("=== Lead(s) ===");
for(const r of data||[]) console.log(`${r.id} | status=${r.status} | plan=${r.selected_plan} | dog=${r.dog_name} | plan_sent=${r.plan_sent} | method=${r.mollie_payment_method} | lang=${r.answers?.lang}`);
const paid=(data||[]).find(r=>r.status==="paid");
if(!paid){ console.log("\n-> Kein bezahlter Lead gefunden, breche ab."); process.exit(0); }
// Auslieferung triggern (force)
const t=await fetch("https://www.pfoten-plan.de/api/admin/trigger-delivery",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${TOKEN}`},body:JSON.stringify({email:EMAIL,force:true})});
const tj=await t.json().catch(()=>({}));
const hp=(tj.actions||[]).find(a=>a.type==="hauptplan");
console.log(`\n=== Auslieferung ===\nHTTP ${t.status} | hauptplan ok: ${hp?.ok} | plan_id: ${hp?.plan_id||"-"} ${hp?.error?("| err:"+hp.error):""}`);
