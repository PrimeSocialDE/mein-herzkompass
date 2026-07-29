import { readFileSync } from "node:fs";
const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
for (const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)])
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
const KEY = process.env.BREVO_API_KEY;
const sb = (await import("@supabase/supabase-js")).createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {auth:{persistSession:false}});

// email_captured Segment-Groesse (DE)
const { count: ec } = await sb.from("wauwerk_leads").select("id",{count:"exact",head:true}).eq("status","email_captured");
console.log("email_captured Leads gesamt:", ec);

const end = new Date().toISOString().slice(0,10);
const start = new Date(Date.now()-90*864e5).toISOString().slice(0,10);
async function tag(t){
  const u=`https://api.brevo.com/v3/smtp/statistics/aggregatedReport?tag=${encodeURIComponent(t)}&startDate=${start}&endDate=${end}`;
  const r=await fetch(u,{headers:{"api-key":KEY,accept:"application/json"}});
  if(!r.ok) return {t, err:r.status};
  const d=await r.json();
  const sent=d.delivered||d.requests||0;
  return {t, sent:d.requests||0, deliv:d.delivered||0, opens:d.opens||0, uniqueOpens:d.uniqueOpens||0, clicks:d.clicks||0,
    openRate: d.delivered? (100*(d.uniqueOpens||0)/d.delivered).toFixed(1)+"%":"-"};
}
const tags=["email-seq-1","email-seq-2","email-seq-3","email-seq-4","email-seq-5",
  "stage-1","stage-2","stage-3","stage-4","stage-5","checkout-recovery","premium-offer",
  "pl-nurture","pl-winback"];
console.log("\nTag                 | zugestellt | uniq.Opens | Öffnungsrate | Klicks");
for(const t of tags){ const x=await tag(t);
  if(x.err){console.log(`${t.padEnd(20)}| Fehler ${x.err}`);continue;}
  console.log(`${x.t.padEnd(20)}| ${String(x.deliv).padStart(10)} | ${String(x.uniqueOpens).padStart(10)} | ${x.openRate.padStart(12)} | ${x.clicks}`);
}
