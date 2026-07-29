import { readFileSync } from "node:fs";
const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
for (const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)])
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth:{autoRefreshToken:false,persistSession:false}});
const iso = (d) => new Date(Date.now() - d*864e5).toISOString();
const cnt = async (b)=> (await b).count;

// Status-Counts (30d) — ohne answers
for (const s of ["email_captured","pending","failed","checkout_started","paid"]) {
  const c = await cnt(sb.from("wauwerk_leads").select("id",{count:"exact",head:true}).eq("status",s).gte("created_at",iso(30)));
  console.log(`  ${String(c).padStart(5)}  ${s}`);
}

// Abbrecher: nur status + method (kleine Spalten)
const { data: ab, error } = await sb.from("wauwerk_leads")
  .select("status, mollie_payment_method")
  .in("status",["pending","failed","checkout_started"])
  .gte("created_at", iso(30)).limit(3000);
if (error){console.error(error);process.exit(1);}
const withM = ab.filter(l=>l.mollie_payment_method);
const meth={}; for(const l of ab){const m=l.mollie_payment_method||"(unbekannt)";meth[m]=(meth[m]||0)+1;}
console.log(`\nAbbrecher (30d): ${ab.length} | Zahlungsart bekannt: ${withM.length} (${(withM.length/ab.length*100).toFixed(0)}%)`);
for(const [k,v] of Object.entries(meth).sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
