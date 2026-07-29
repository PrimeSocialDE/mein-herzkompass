import { readFileSync } from "node:fs";
const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
for (const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)])
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
const KEY = process.env.BREVO_API_KEY;
const H = { "api-key": KEY, accept: "application/json" };
async function get(path){ const r=await fetch("https://api.brevo.com"+path,{headers:H}); return {status:r.status, body: r.ok? await r.json(): await r.text()}; }

console.log("=== 1) E-Mail-Kampagnen (classic) mit Statistik ===");
let r = await get("/v3/emailCampaigns?type=classic&limit=10&sort=desc");
if(r.status===200){ console.log("count:", r.body.count);
  for(const c of (r.body.campaigns||[]).slice(0,8)){
    const g=c.statistics?.globalStats||{}; 
    console.log(`  [${c.status}] ${c.name?.slice(0,42).padEnd(42)} sent:${g.sent||0} open:${g.uniqueViews||g.viewed||0} click:${g.uniqueClicks||g.clickers||0}`);
  }
} else console.log("  ->", r.status, String(r.body).slice(0,120));

console.log("\n=== 2) Trigger-/Automation-Kampagnen (type=trigger) ===");
r = await get("/v3/emailCampaigns?type=trigger&limit=10");
if(r.status===200){ console.log("count:", r.body.count);
  for(const c of (r.body.campaigns||[]).slice(0,10)) console.log(`  [${c.status}] ${c.name?.slice(0,50)}`);
} else console.log("  ->", r.status, String(r.body).slice(0,160));

console.log("\n=== 3) Automation-Endpoint vorhanden? ===");
for(const p of ["/v3/automations","/v3/marketing-automation/workflows","/v3/workflows"]){
  const x = await get(p); console.log(`  ${p} -> ${x.status} ${typeof x.body==="string"?x.body.slice(0,80):"JSON"}`);
}

console.log("\n=== 4) Globaler Transaktional-Report (letzte 90 Tage, alle Mails) ===");
const end=new Date().toISOString().slice(0,10), start=new Date(Date.now()-90*864e5).toISOString().slice(0,10);
r = await get(`/v3/smtp/statistics/aggregatedReport?startDate=${start}&endDate=${end}`);
console.log("  ", r.status===200? JSON.stringify(r.body): String(r.body).slice(0,120));
