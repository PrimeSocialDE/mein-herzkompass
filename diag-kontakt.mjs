import { readFileSync } from "node:fs";
try { const e = readFileSync(new URL("./.env.local", import.meta.url),"utf8"); for (const l of e.split("\n")){const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");}} catch {}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth:{autoRefreshToken:false,persistSession:false} });
const EMAIL="kontakt@primesocial.de";
const { data: leads } = await sb.from("wauwerk_leads").select("id,email,status,selected_plan,dog_name,paid_at,answers").ilike("email",EMAIL).order("created_at",{ascending:false});
console.log("Leads für",EMAIL,":",leads?.length||0);
for(const l of (leads||[])) console.log("  ", l.id, "| status:",l.status,"| plan:",l.selected_plan,"| dog:",l.dog_name,"| lang:",l.answers?.lang,"| paid:",l.paid_at?.slice(0,19));
const { data: mpc } = await sb.from("member_plan_content").select("email,plan_slug").ilike("email",EMAIL);
console.log("member_plan_content:", mpc?.length||0);
