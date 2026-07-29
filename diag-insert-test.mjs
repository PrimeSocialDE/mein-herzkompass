// Teste ob Challenge-Insert fuer kontakt@primesocial.de funktioniert.
// Findet Bug raus: silent insert-fail oder picker-leer.
// Loescht den Test-Eintrag wieder.
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

const USER_ID = "f1569548-70f3-4881-9001-9d8bd3ea286b";

// Aktuelle Woche (Montag-Datum)
const now = new Date();
const day = now.getUTCDay(); // 0=Sonntag
const diff = day === 0 ? -6 : 1 - day;
const monday = new Date(now);
monday.setUTCDate(monday.getUTCDate() + diff);
const weekStart = monday.toISOString().slice(0, 10);

console.log("Test-Insert fuer user_id=", USER_ID, "week_start=", weekStart);

const testRow = {
  user_id: USER_ID,
  challenge_slug: "_test_insert",
  challenge_title: "Test",
  challenge_description: "Test-Beschreibung",
  problem_match: "pulling",
  target_sessions: 3,
  sessions_done: 0,
  badge_emoji: "🧪",
  badge_label: "Test-Badge",
  week_start_date: weekStart,
  is_premium: false,
};

const { data, error } = await sb.from("member_user_challenges").insert(testRow).select("*").single();

if (error) {
  console.error("❌ INSERT FAILED:");
  console.error(error);
} else {
  console.log("✅ Insert OK — ID:", data.id);
  // Cleanup
  await sb.from("member_user_challenges").delete().eq("id", data.id);
  console.log("✅ Cleanup OK");
}
