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

// Paid-Käufer letzte 14 Tage mit plan_sent IS NULL
const since = new Date(Date.now() - 14 * 86400_000).toISOString();
const { data: leads, error } = await sb
  .from("wauwerk_leads")
  .select("id, email, dog_name, selected_plan, paid_at, plan_sent, created_at, answers")
  .eq("status", "paid")
  .gte("paid_at", since)
  .is("plan_sent", null)
  .order("paid_at", { ascending: false });
if (error) { console.error(error); process.exit(1); }

console.log(`=== Paid Käufer letzte 14 Tage OHNE plan_sent: ${leads.length} ===\n`);
for (const l of leads) {
  // Schau ob ein member_plan_content schon existiert
  const { data: planContent } = await sb
    .from("member_plan_content")
    .select("id, created_at")
    .ilike("email", l.email)
    .eq("plan_slug", "trainingsplan")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const hasPdf = !!planContent;
  console.log(`${l.paid_at.slice(0,16)} | ${l.email.padEnd(35)} | ${l.selected_plan} | dog=${l.dog_name || "—"} | plan-content=${hasPdf ? "✓" : "❌"}`);
}

// Wie viele haben ein plan_content trotz plan_sent=null? Das sind die "stuck" Cases.
let stuck = 0;
for (const l of leads) {
  const { data: planContent } = await sb
    .from("member_plan_content")
    .select("id")
    .ilike("email", l.email)
    .eq("plan_slug", "trainingsplan")
    .maybeSingle();
  if (planContent) stuck++;
}
console.log(`\n=== Davon "stuck" (Plan-Content existiert, aber plan_sent=null) ===`);
console.log(`${stuck} / ${leads.length}`);
