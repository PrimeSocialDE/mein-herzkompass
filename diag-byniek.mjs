import { readFileSync } from "node:fs";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const sb=(await import("@supabase/supabase-js")).createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE,{auth:{persistSession:false}});
const {data}=await sb.from("wauwerk_leads").select("id,status,dog_name,mollie_payment_id,mollie_payment_method,payment_provider,paid_at,created_at,answers").ilike("email","byniek661@wp.pl").order("created_at",{ascending:false});
for(const r of data||[]){
  console.log(`lead ${r.id} | ${r.created_at?.slice(0,16)} | status=${r.status} | method=${r.mollie_payment_method} | pay=${r.mollie_payment_id} | lang=${r.answers?.lang}`);
}
