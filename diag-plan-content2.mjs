import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url),"utf8");
  for (const l of e.split("\n")) {
    const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
  }
} catch {}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: row } = await sb.from("member_plan_content").select("*").eq("id", "61f4f49f-aacd-477d-ab05-36d4574e9aa9").maybeSingle();
console.log("Plan-Row:");
console.log("  id:", row?.id);
console.log("  plan_slug:", row?.plan_slug);
console.log("  email:", row?.email);
console.log("  user_id:", row?.user_id);
console.log("  created_at:", row?.created_at);
console.log("  Spalten:", row ? Object.keys(row).join(", ") : "—");

const { data: byEmail } = await sb.from("member_plan_content").select("id,plan_slug,created_at,email,user_id").ilike("email", "afelice@bluewin.ch").order("created_at",{ascending:false});
console.log("\n=== Alle Plan-Rows für afelice@bluewin.ch ===");
for (const r of byEmail || []) console.log(`  ${r.created_at?.slice(0,16)} | ${r.plan_slug} | id=${r.id?.slice(0,8)} | user_id=${r.user_id?.slice(0,8) || "—"}`);
