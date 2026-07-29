import { readFileSync } from "node:fs";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const sb=(await import("@supabase/supabase-js")).createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE,{auth:{persistSession:false}});
const iso=d=>new Date(Date.now()-d*864e5).toISOString();
// Alle PL-Leads mit gesetzter Methode (30 Tage), paid vs failed je Methode
const {data}=await sb.from("wauwerk_leads").select("status,mollie_payment_method").eq("answers->>lang","pl").not("mollie_payment_method","is",null).gte("created_at",iso(30)).range(0,9999);
const mix={};
for(const r of data||[]){ const m=r.mollie_payment_method; mix[m]=mix[m]||{paid:0,failed:0,other:0}; if(r.status==="paid")mix[m].paid++; else if(r.status==="failed")mix[m].failed++; else mix[m].other++; }
console.log("PL nach Zahlungsmethode (30d, nur Leads mit Methode):");
console.log("Methode        paid  failed  andere  | Erfolgsquote (paid/(paid+failed))");
for(const [m,v] of Object.entries(mix).sort((a,b)=>(b[1].paid+b[1].failed)-(a[1].paid+a[1].failed))){
  const att=v.paid+v.failed; const rate=att?(v.paid/att*100).toFixed(0)+"%":"-";
  console.log(`  ${m.padEnd(12)} ${String(v.paid).padStart(4)}  ${String(v.failed).padStart(5)}  ${String(v.other).padStart(5)}   | ${rate}`);
}
