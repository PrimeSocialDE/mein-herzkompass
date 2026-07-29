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

const since = new Date(Date.now() - 2 * 86400_000).toISOString();
const { data: leads, error } = await sb
  .from("wauwerk_leads")
  .select("status, answers, created_at, paid_at, selected_plan")
  .gte("created_at", since);
if (error) { console.error(error); process.exit(1); }

console.log(`=== A/B Test letzte 2 Tage (n=${leads.length}) ===\n`);

const stats = {
  A: { email: 0, pending: 0, started: 0, failed: 0, paid: 0, total: 0 },
  B: { email: 0, pending: 0, started: 0, failed: 0, paid: 0, total: 0 },
  "?": { email: 0, pending: 0, started: 0, failed: 0, paid: 0, total: 0 },
};

for (const l of leads) {
  const v = (l.answers?.ab_variant || "?").toUpperCase();
  const bucket = stats[v] || stats["?"];
  bucket.total++;
  if (l.status === "paid") bucket.paid++;
  else if (l.status === "pending") bucket.pending++;
  else if (l.status === "checkout_started") bucket.started++;
  else if (l.status === "failed") bucket.failed++;
  else if (l.status === "email_captured") bucket.email++;
}

function row(name, s) {
  const cr = s.total ? ((s.paid / s.total) * 100).toFixed(1) : "0";
  const planSelects = s.pending + s.started + s.failed + s.paid;
  const planToPaid = planSelects ? ((s.paid / planSelects) * 100).toFixed(0) : "—";
  console.log(`${name}: total=${s.total} | email=${s.email} | pending=${s.pending} | started=${s.started} | failed=${s.failed} | paid=${s.paid}`);
  console.log(`   → CR (paid/total): ${cr}%   |   Plan→Paid: ${planToPaid}% (${s.paid}/${planSelects})`);
}

row("A (deinplan3)", stats.A);
row("B (deinplan6)", stats.B);
if (stats["?"].total > 0) row("? (no variant)", stats["?"]);

// Vergleich
const a = stats.A, b = stats.B;
if (a.total && b.total) {
  const lift = (((a.paid / a.total) - (b.paid / b.total)) / (b.paid / b.total)) * 100;
  console.log(`\n=== A vs B Lift ===`);
  console.log(`A Conversion: ${((a.paid / a.total) * 100).toFixed(1)}%`);
  console.log(`B Conversion: ${((b.paid / b.total) * 100).toFixed(1)}%`);
  console.log(`Lift A vs B: ${lift > 0 ? "+" : ""}${lift.toFixed(0)}%`);
}

// Per Tag aufgesplittet
console.log("\n=== Per Tag x Variante ===");
const byDay = {};
for (const l of leads) {
  const day = l.created_at.slice(0, 10);
  const v = (l.answers?.ab_variant || "?").toUpperCase();
  if (!byDay[day]) byDay[day] = { A: { t: 0, p: 0 }, B: { t: 0, p: 0 } };
  if (v === "A" || v === "B") {
    byDay[day][v].t++;
    if (l.status === "paid") byDay[day][v].p++;
  }
}
for (const d of Object.keys(byDay).sort().reverse()) {
  const s = byDay[d];
  const aCr = s.A.t ? ((s.A.p / s.A.t) * 100).toFixed(1) : "0";
  const bCr = s.B.t ? ((s.B.p / s.B.t) * 100).toFixed(1) : "0";
  console.log(` ${d} | A: ${s.A.p}/${s.A.t} (${aCr}%)  |  B: ${s.B.p}/${s.B.t} (${bCr}%)`);
}
