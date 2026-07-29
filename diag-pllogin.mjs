import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const SECRET=process.env.LOGIN_LINK_SECRET||process.env.WORKER_TOKEN||"";
console.log("Secret vorhanden:", SECRET?("ja ("+(process.env.LOGIN_LINK_SECRET?"LOGIN_LINK_SECRET":"WORKER_TOKEN")+")"):"NEIN");
if(!SECRET){ console.log("-> Ohne Secret kann ich lokal keinen gueltigen Link erzeugen. Abbruch."); process.exit(1); }
const EMAIL="byniek661@wp.pl";
const sb=(await import("@supabase/supabase-js")).createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE,{auth:{persistSession:false}});
const {data}=await sb.from("wauwerk_leads").select("dog_name,status,answers,paid_at,selected_plan").ilike("email",EMAIL).order("created_at",{ascending:false}).limit(1);
const lead=data&&data[0];
console.log("Kunde:", lead?`status=${lead.status} dog=${lead.dog_name} plan=${lead.selected_plan} lang=${lead.answers?.lang} paid_at=${lead.paid_at}`:"NICHT in wauwerk_leads gefunden");
// One-Tap-Link bauen (Base = pfoten-plan.de, wie im Auth-Hook auch fuer PL)
const b64url=b=>Buffer.from(b).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const em=EMAIL.trim().toLowerCase();
const exp=Math.floor(Date.now()/1000)+365*86400;
const sig=b64url(createHmac("sha256",SECRET).update(`${em}|${exp}`).digest());
const params=new URLSearchParams({e:b64url(Buffer.from(em,"utf8")),exp:String(exp),sig,next:"/mitglieder"});
const link=`https://www.pfoten-plan.de/api/mitglieder/one-tap?${params.toString()}`;
console.log("\nOne-Tap-Link erzeugt (365 Tage gueltig, wiederverwendbar).");
console.log("LINK_OK:", link.slice(0,60)+"...");
globalThis.__link=link; globalThis.__dog=lead?.dog_name||"";
