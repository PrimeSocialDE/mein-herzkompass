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

// Try every plausible name
const candidates = [
  "member_user_challenges",
  "member_challenges",
  "user_challenges",
  "challenges",
  "member_purchases",
  "member_users",
  "member_plan_content",
  "member_chat",
  "member_chat_messages",
];

for (const t of candidates) {
  const { data, error } = await sb.from(t).select("*").limit(1);
  if (error) {
    console.log(`❌ ${t}: ${error.message.slice(0, 80)}`);
  } else {
    console.log(`✅ ${t}: existiert (cols: ${data?.[0] ? Object.keys(data[0]).join(", ") : "leer"})`);
  }
}
