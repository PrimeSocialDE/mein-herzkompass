import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

const PLAN_ID = "61f4f49f-aacd-477d-ab05-36d4574e9aa9";
const LEAD_ID = "9c91ed3e-25bf-4027-92b8-009b68402a24";

const { data: plan } = await sb.from("member_plan_content").select("id, lead_id, created_at, plan_type, dog_name, sent_at, email_sent_to, generation_ms").eq("id", PLAN_ID).maybeSingle();
console.log("=== member_plan_content ===");
console.log(plan);

// Auch nach allen plan_contents für diesen lead
const { data: all } = await sb.from("member_plan_content").select("id, plan_type, sent_at, email_sent_to, created_at").eq("lead_id", LEAD_ID).order("created_at", { ascending: false });
console.log("\n=== Alle plan_contents für diesen Lead ===");
for (const p of all || []) console.log(`  ${p.created_at?.slice(0,16)} | ${p.plan_type} | ${p.id} | sent_at=${p.sent_at || "—"} | sent_to=${p.email_sent_to || "—"}`);
