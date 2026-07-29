import { readFileSync } from "node:fs";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const sb=(await import("@supabase/supabase-js")).createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE,{auth:{persistSession:false}});
const since=new Date(Date.now()-3*3600*1000).toISOString();
// Alle PL-Leads mit Aktivität in den letzten 3h (created_at ODER paid_at)
const {data}=await sb.from("wauwerk_leads").select("id,created_at,status,mollie_payment_method,mollie_payment_id,email").eq("answers->>lang","pl").gte("created_at",since).order("created_at",{ascending:false}).limit(30);
console.log(`PL-Leads letzte 3h: ${data?.length||0}`);
for(const r of data||[]) console.log(`  ${r.created_at.slice(11,19)} | ${String(r.status).padEnd(16)} | method=${r.mollie_payment_method||"-"} | pay=${r.mollie_payment_id?"ja":"nein"} | ${r.email}`);
// Gesamt: jemals ein przelewy24 am Lead?
const {count}=await sb.from("wauwerk_leads").select("id",{count:"exact",head:true}).eq("mollie_payment_method","przelewy24");
console.log("\nP24-Zahlungen jemals am Lead (mollie_payment_method=przelewy24):", count);
