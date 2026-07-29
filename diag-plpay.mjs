import { readFileSync } from "node:fs";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const sb=(await import("@supabase/supabase-js")).createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE,{auth:{persistSession:false}});
const iso=d=>new Date(Date.now()-d*864e5).toISOString();
const {data,error}=await sb.from("wauwerk_leads").select("status").eq("answers->>lang","pl").gte("created_at",iso(14)).range(0,9999);
if(error){console.log("ERR",error.message);process.exit(1);}
const c={}; for(const r of data||[]) c[r.status]=(c[r.status]||0)+1;
const tot=(data||[]).length;
console.log("PL-Leads (14d) gesamt:",tot);
for(const [k,v] of Object.entries(c).sort((a,b)=>b[1]-a[1])) console.log(`  ${String(k).padEnd(18)} ${v}  (${(v/tot*100).toFixed(1)}%)`);
