import { readFileSync } from "node:fs";
const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
for (const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)])
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth:{autoRefreshToken:false,persistSession:false}});
const iso = (d) => new Date(Date.now() - d*864e5).toISOString();
const MK = process.env.MOLLIE_API_KEY;

// Cap-frei: nur nicht-bezahlte Leads MIT payment_id der letzten 7 Tage
const { data, error } = await sb.from("wauwerk_leads")
  .select("id,email,status,mollie_payment_method,mollie_payment_id,created_at")
  .gte("created_at", iso(7))
  .neq("status","paid")
  .not("mollie_payment_id","is",null)
  .order("created_at",{ascending:false});
if (error){console.error(error);process.exit(1);}
console.log(`Nicht-paid Leads mit payment_id (7d): ${data.length}`);

let leaks=0, checked=0, byMethod={};
for(const l of data){
  if(!MK) break;
  let p;
  try{const r=await fetch(`https://api.mollie.com/v2/payments/${l.mollie_payment_id}`,{headers:{Authorization:"Bearer "+MK}});p=await r.json();}catch(err){continue;}
  checked++;
  byMethod[p.method||"?"]=byMethod[p.method||"?"]||{};
  byMethod[p.method||"?"][p.status]=(byMethod[p.method||"?"][p.status]||0)+1;
  if(p.status==="paid"||p.status==="authorized"){
    leaks++;
    console.log(`  ⚠️ LEAK: ${l.created_at?.slice(0,16)} | db=${l.status} | mollie=${p.status} method=${p.method} | ${l.email} | pay=${l.mollie_payment_id} paidAt=${p.paidAt}`);
  }
}
console.log(`\nGeprüft gegen Mollie: ${checked}`);
console.log("Mollie-Status je Methode (nicht-paid DB-Leads):");
for(const [m,st] of Object.entries(byMethod)) console.log(`  ${m}:`, Object.entries(st).map(([s,c])=>`${s}=${c}`).join("  "));
console.log(`\n=> Webhook-LEAKS (bei Mollie bezahlt, bei uns nicht): ${leaks}`);
