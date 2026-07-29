import { readFileSync } from "node:fs";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const sb=(await import("@supabase/supabase-js")).createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE,{auth:{persistSession:false}});
// Ein PL-Lead komplett: welche Spalten/Felder gibt es (Payment-Infos)?
const {data}=await sb.from("wauwerk_leads").select("*").eq("answers->>lang","pl").eq("status","failed").order("created_at",{ascending:false}).limit(1);
if(data&&data[0]){
  const r=data[0];
  console.log("Spalten am Lead:", Object.keys(r).join(", "));
  console.log("\nZahlungs-relevante Felder:");
  for(const k of Object.keys(r)) if(/method|mollie|payment|pay|status|checkout/i.test(k)) console.log(`  ${k}:`, JSON.stringify(r[k])?.slice(0,80));
  console.log("\nanswers-Keys (payment):");
  const a=r.answers||{}; for(const k of Object.keys(a)) if(/method|mollie|payment|pay|checkout|blik|p24/i.test(k)) console.log(`  answers.${k}:`, JSON.stringify(a[k])?.slice(0,80));
}
