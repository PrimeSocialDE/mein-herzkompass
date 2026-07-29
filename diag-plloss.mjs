import { readFileSync } from "node:fs";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const sb=(await import("@supabase/supabase-js")).createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE,{auth:{persistSession:false}});
// PL paid all-time + Methoden + Preisspanne + frühestes/spätestes paid
const {data}=await sb.from("wauwerk_leads").select("mollie_payment_method,price,paid_at").eq("answers->>lang","pl").eq("status","paid").not("mollie_payment_method","is",null).range(0,9999);
const mix={}; let sum=0,n=0,minD=null,maxD=null;
for(const r of data||[]){ const mth=r.mollie_payment_method; mix[mth]=(mix[mth]||0)+1;
  const p=parseFloat(String(r.price||"").replace(/[^0-9.,]/g,"").replace(",",".")); if(!isNaN(p)){sum+=p;n++;}
  if(r.paid_at){ if(!minD||r.paid_at<minD)minD=r.paid_at; if(!maxD||r.paid_at>maxD)maxD=r.paid_at; }
}
const tot=(data||[]).length;
console.log("PL paid gesamt (mit Methode):",tot);
console.log("Methoden:",JSON.stringify(mix));
console.log("Ø Preis:", n?(sum/n).toFixed(2):"-", " (Währung zł)");
console.log("Zeitraum paid:", minD?.slice(0,10),"bis",maxD?.slice(0,10));
