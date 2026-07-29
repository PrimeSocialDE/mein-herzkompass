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

// Erst: gibt's eine Spalte ab_variant?
const { data: sample, error: e1 } = await sb.from("wauwerk_leads").select("*").limit(1);
if (e1) { console.error(e1); process.exit(1); }
console.log("=== Spalten in wauwerk_leads ===");
console.log(Object.keys(sample[0]).sort().join(", "));
console.log();

// Wenn ab_variant existiert, hole letzte 2 Tage damit
const since = new Date(Date.now() - 2 * 86400_000).toISOString();
const { data: leads } = await sb
  .from("wauwerk_leads")
  .select("status, ab_variant, answers, created_at")
  .gte("created_at", since);

console.log(`=== A/B Test letzte 2 Tage (n=${leads.length}) ===\n`);

// Beide Quellen vergleichen: ab_variant column vs answers.ab_variant
let colA = 0, colB = 0, colN = 0;
let jsA = 0, jsB = 0, jsN = 0;
for (const l of leads) {
  const c = (l.ab_variant || "").toUpperCase();
  if (c === "A") colA++; else if (c === "B") colB++; else colN++;
  const j = (l.answers?.ab_variant || "").toUpperCase();
  if (j === "A") jsA++; else if (j === "B") jsB++; else jsN++;
}
console.log(`Column ab_variant: A=${colA} B=${colB} null=${colN}`);
console.log(`answers.ab_variant: A=${jsA} B=${jsB} null=${jsN}\n`);

// Hauptauswertung mit COLUMN ab_variant
const stats = {
  A: { email: 0, pending: 0, started: 0, failed: 0, paid: 0, total: 0 },
  B: { email: 0, pending: 0, started: 0, failed: 0, paid: 0, total: 0 },
};

for (const l of leads) {
  const v = (l.ab_variant || "").toUpperCase();
  if (v !== "A" && v !== "B") continue;
  const b = stats[v];
  b.total++;
  if (l.status === "paid") b.paid++;
  else if (l.status === "pending") b.pending++;
  else if (l.status === "checkout_started") b.started++;
  else if (l.status === "failed") b.failed++;
  else if (l.status === "email_captured") b.email++;
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

const a = stats.A, b = stats.B;
if (a.total && b.total) {
  console.log(`\n=== A vs B ===`);
  const aCr = (a.paid / a.total) * 100;
  const bCr = (b.paid / b.total) * 100;
  console.log(`A: ${aCr.toFixed(2)}% (${a.paid}/${a.total})`);
  console.log(`B: ${bCr.toFixed(2)}% (${b.paid}/${b.total})`);
  if (bCr > 0) console.log(`Lift A vs B: ${(((aCr - bCr) / bCr) * 100).toFixed(0)}%`);
  else console.log(`B = 0 → unendlicher Lift A`);
}

// Per Tag
console.log("\n=== Per Tag ===");
const byDay = {};
for (const l of leads) {
  const day = l.created_at.slice(0, 10);
  const v = (l.ab_variant || "").toUpperCase();
  if (v !== "A" && v !== "B") continue;
  if (!byDay[day]) byDay[day] = { A: { t: 0, p: 0 }, B: { t: 0, p: 0 } };
  byDay[day][v].t++;
  if (l.status === "paid") byDay[day][v].p++;
}
for (const d of Object.keys(byDay).sort().reverse()) {
  const s = byDay[d];
  const aCr = s.A.t ? ((s.A.p / s.A.t) * 100).toFixed(1) : "0";
  const bCr = s.B.t ? ((s.B.p / s.B.t) * 100).toFixed(1) : "0";
  console.log(` ${d} | A: ${s.A.p}/${s.A.t} (${aCr}%)  |  B: ${s.B.p}/${s.B.t} (${bCr}%)`);
}
