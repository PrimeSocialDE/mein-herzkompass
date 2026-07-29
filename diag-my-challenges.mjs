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

const EMAIL = "kontakt@primesocial.de";

// 1) member_users
const { data: member } = await sb.from("member_users").select("*").ilike("email", EMAIL).maybeSingle();
console.log("=== member_users ===");
console.log({
  id: member?.id,
  email: member?.email,
  purchase_status: member?.purchase_status,
  purchased_at: member?.purchased_at?.slice(0, 16),
  source_lead_id: member?.source_lead_id,
  created_at: member?.created_at?.slice(0, 16),
  quiz_result_keys: member?.quiz_result ? Object.keys(member.quiz_result) : null,
  dog_problem: member?.quiz_result?.dog_problem || member?.quiz_result?.problem,
});

// 2) wauwerk_leads
const { data: leads } = await sb.from("wauwerk_leads").select("id, email, status, paid_at, dog_problem, answers, created_at").ilike("email", EMAIL).order("created_at", { ascending: false });
console.log("\n=== wauwerk_leads (all) ===");
for (const l of leads || []) {
  console.log({
    id: l.id,
    status: l.status,
    paid_at: l.paid_at?.slice(0, 16),
    dog_problem: l.dog_problem,
    answers_problem: l.answers?.dog_problem || l.answers?.problem,
    created: l.created_at?.slice(0, 16),
  });
}

// 3) member_user_challenges
if (member?.id) {
  const { data: ch } = await sb.from("member_user_challenges").select("*").eq("user_id", member.id).order("week_start_date", { ascending: false });
  console.log(`\n=== member_user_challenges (${ch?.length || 0} rows) ===`);
  for (const c of (ch || []).slice(0, 10)) {
    console.log(` ${c.week_start_date} | ${c.challenge_slug} | done=${c.sessions_done}/${c.target_sessions} | completed=${c.completed_at?.slice(0, 16) || "no"} | reminder=${c.reminder_sent_at?.slice(0, 16) || "no"}`);
  }

  // 4) Was wuerde getOrAssignWeekChallenges JETZT picken?
  const { CHALLENGE_TEMPLATES } = await import("./lib/member-challenges.ts").catch(() => ({}));
  // Da tsx import zickig — replizieren wir die Logik kurz:
  console.log("\n=== Picker-Simulation ===");
  const problemKey = member.quiz_result?.dog_problem || member.quiz_result?.problem || null;
  const isPaid = member.purchase_status === "paid";
  console.log({ problemKey, isPaid });
}

// 5) Plan-Content
const { data: plan } = await sb.from("member_plan_content").select("id, plan_slug, created_at").ilike("email", EMAIL);
console.log("\n=== member_plan_content ===");
console.log(plan);
