import { readFileSync } from "node:fs";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const sb=(await import("@supabase/supabase-js")).createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE,{auth:{persistSession:false}});
const {data}=await sb.from("wauwerk_leads").select("answers").eq("status","paid").eq("answers->>lang","pl").range(0,9999);
const c={}; for(const r of data||[]){ const s=r.answers?.source_page||"(none)"; c[s]=(c[s]||0)+1; }
console.log("PL-Käufe (lang=pl) nach source_page:");
for(const [k,v] of Object.entries(c).sort((a,b)=>b[1]-a[1])) console.log(`  ${String(k).padEnd(14)} ${v}`);
