import { readFileSync } from "node:fs";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const sb=(await import("@supabase/supabase-js")).createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE,{auth:{persistSession:false}});
const OLD="sandra@serrano-home.de", NEW="jago.pdae@web.de";
// Den heutigen bezahlten Lead finden (1month, paid)
const {data}=await sb.from("wauwerk_leads").select("id,email,status,selected_plan,dog_name,plan_sent,paid_at,created_at").ilike("email",OLD).eq("status","paid").order("created_at",{ascending:false});
console.log("Bezahlte Sandra-Leads:");
for(const r of data||[]) console.log(`  ${r.id} | ${r.created_at?.slice(0,16)} | ${r.selected_plan} | dog=${r.dog_name} | plan_sent=${r.plan_sent}`);
// Den NEUESTEN (heutigen) umstellen
const target=(data||[])[0];
if(!target){ console.log("Kein bezahlter Lead gefunden."); process.exit(1); }
const {error}=await sb.from("wauwerk_leads").update({email:NEW}).eq("id",target.id);
console.log(error?`\nUpdate-Fehler: ${error.message}`:`\n✅ E-Mail umgestellt: Lead ${target.id} (${target.selected_plan}, ${target.dog_name}) -> ${NEW}`);
