import { readFileSync } from "node:fs";
try { const e = readFileSync(".env.local","utf8"); for (const l of e.split("\n")) { const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); } } catch {}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth:{autoRefreshToken:false,persistSession:false} });
const { data } = await sb.from("member_plan_content").select("id, plan_title, created_at, dog_name").ilike("email","maxidebkowski74@gmail.com").order("created_at",{ascending:false});
console.log(`${data?.length || 0} Plan(e)${data?.length ? ': ' + data[0].plan_title + ' @ ' + data[0].created_at : ''}`);
