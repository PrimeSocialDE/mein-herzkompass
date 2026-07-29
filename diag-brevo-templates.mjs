import { readFileSync } from "node:fs";
const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
for (const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)])
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
const H = { "api-key": process.env.BREVO_API_KEY, accept: "application/json" };
const get = async p => { const r=await fetch("https://api.brevo.com"+p,{headers:H}); return {s:r.status, b:r.ok?await r.json():await r.text()}; };

console.log("=== Transaktional-Templates vorhanden? ===");
let r = await get("/v3/smtp/templates?limit=100&sort=desc");
if(r.s===200){
  console.log("count:", r.b.count);
  for(const t of (r.b.templates||[])){
    console.log(`  #${t.id} [${t.isActive?"aktiv":"inaktiv"}] ${String(t.name||"").slice(0,40).padEnd(40)} | Betreff: ${String(t.subject||"").slice(0,50)}`);
  }
} else console.log("  ->", r.s, String(r.b).slice(0,150));
