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

const DAYS = 5;
const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
const { data: leads } = await sb
  .from("wauwerk_leads")
  .select("status, ab_variant, created_at, paid_at, selected_plan")
  .gte("created_at", since);

console.log(`=== A vs B Performance — letzte ${DAYS} Tage ===\n`);

// Per Tag
const byDay = {};
for (const l of leads) {
  const day = l.created_at.slice(0, 10);
  const v = (l.ab_variant || "").toUpperCase();
  if (v !== "A" && v !== "B") continue;
  if (!byDay[day]) byDay[day] = { A: { t: 0, p: 0 }, B: { t: 0, p: 0 } };
  byDay[day][v].t++;
  if (l.status === "paid") byDay[day][v].p++;
}
console.log("Tag        | A (deinplan3)        | B (deinplan6)        | Sieger");
console.log("-".repeat(72));
for (const d of Object.keys(byDay).sort()) {
  const s = byDay[d];
  const aCr = s.A.t ? s.A.p/s.A.t*100 : 0;
  const bCr = s.B.t ? s.B.p/s.B.t*100 : 0;
  const winner = aCr === bCr ? "—" : (aCr > bCr ? "A" : "B");
  const aDisp = `${s.A.p}/${s.A.t}=${aCr.toFixed(1)}%`.padEnd(20);
  const bDisp = `${s.B.p}/${s.B.t}=${bCr.toFixed(1)}%`.padEnd(20);
  console.log(`${d} | ${aDisp} | ${bDisp} | ${winner}`);
}

// Aggregat
let aT = 0, aP = 0, bT = 0, bP = 0;
for (const l of leads) {
  const v = (l.ab_variant || "").toUpperCase();
  if (v === "A") { aT++; if (l.status === "paid") aP++; }
  else if (v === "B") { bT++; if (l.status === "paid") bP++; }
}
const aCr = aT ? aP/aT*100 : 0;
const bCr = bT ? bP/bT*100 : 0;
const lift = bCr ? ((aCr - bCr) / bCr * 100) : 0;
console.log("\n=== Aggregat ===");
console.log(`A (deinplan3): ${aP}/${aT} = ${aCr.toFixed(2)}%`);
console.log(`B (deinplan6): ${bP}/${bT} = ${bCr.toFixed(2)}%`);
if (bCr > 0) {
  console.log(`Lift A vs B: ${lift > 0 ? "+" : ""}${lift.toFixed(0)}%`);
  console.log(`→ ${aCr > bCr ? "A" : "B"} performt besser`);
}

// Heute separately
const startToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
let aT0 = 0, aP0 = 0, bT0 = 0, bP0 = 0;
for (const l of leads) {
  if (l.created_at < startToday) continue;
  const v = (l.ab_variant || "").toUpperCase();
  if (v === "A") { aT0++; if (l.status === "paid") aP0++; }
  else if (v === "B") { bT0++; if (l.status === "paid") bP0++; }
}
console.log("\n=== Heute (laufend) ===");
console.log(`A: ${aP0}/${aT0} = ${aT0 ? (aP0/aT0*100).toFixed(1) : 0}%`);
console.log(`B: ${bP0}/${bT0} = ${bT0 ? (bP0/bT0*100).toFixed(1) : 0}%`);

// Stichproben-Konfidenz (sehr simpler Z-Test)
function zTest(aSucc, aN, bSucc, bN) {
  if (aN < 30 || bN < 30) return "Stichprobe zu klein";
  const p1 = aSucc/aN, p2 = bSucc/bN;
  const p = (aSucc+bSucc)/(aN+bN);
  const se = Math.sqrt(p*(1-p)*(1/aN+1/bN));
  if (se === 0) return "—";
  const z = Math.abs(p1-p2)/se;
  if (z > 1.96) return `>95% Konfidenz (z=${z.toFixed(2)})`;
  if (z > 1.64) return `>90% Konfidenz (z=${z.toFixed(2)})`;
  return `Noch keine Signifikanz (z=${z.toFixed(2)})`;
}
console.log(`\n=== Statistische Signifikanz (5d) ===`);
console.log(zTest(aP, aT, bP, bT));
