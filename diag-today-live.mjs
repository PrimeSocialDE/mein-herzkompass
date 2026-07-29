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

const startToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
const { data: leads } = await sb
  .from("wauwerk_leads")
  .select("status, selected_plan, ab_variant, price, created_at, paid_at, dog_name, answers, mollie_payment_id, email")
  .gte("created_at", startToday)
  .order("created_at", { ascending: false });

console.log(`=== Heute (${startToday.slice(0,10)}): ${leads.length} Leads ===\n`);

// Per Stunde
const byHour = {};
for (const l of leads) {
  const h = l.created_at.slice(11, 13);
  if (!byHour[h]) byHour[h] = { total: 0, paid: 0, pending: 0, failed: 0, started: 0, email: 0 };
  byHour[h].total++;
  if (l.status === "paid") byHour[h].paid++;
  else if (l.status === "pending") byHour[h].pending++;
  else if (l.status === "failed") byHour[h].failed++;
  else if (l.status === "checkout_started") byHour[h].started++;
  else if (l.status === "email_captured") byHour[h].email++;
}
console.log("Per Stunde:");
console.log(" Stunde | total | paid | pending | started | failed | email");
for (const h of Object.keys(byHour).sort()) {
  const s = byHour[h];
  console.log(`   ${h}h  |   ${String(s.total).padStart(2)}  |  ${String(s.paid).padStart(2)}  |   ${String(s.pending).padStart(2)}    |    ${String(s.started).padStart(2)}   |   ${String(s.failed).padStart(2)}   |  ${String(s.email).padStart(2)}`);
}

// Pending-Details (haben selected_plan, aber kein Mollie)
const pending = leads.filter(l => l.status === "pending");
console.log(`\n=== Pending heute: ${pending.length} ===`);

// A vs B unter pending
const pA = pending.filter(l => l.ab_variant === "A").length;
const pB = pending.filter(l => l.ab_variant === "B").length;
console.log(`  A (deinplan3): ${pA} pending`);
console.log(`  B (deinplan6): ${pB} pending`);

// Anomalie-Check: Preise ohne €-Symbol / ohne Komma
console.log(`\n=== Preis-Anomalien (Format-Check) ===`);
for (const l of pending) {
  const p = String(l.price || "");
  if (p && !p.includes("€")) {
    console.log(`  ${l.created_at.slice(11,16)} | ${l.dog_name} | price="${p}" | plan=${l.selected_plan}`);
  }
}

// Pending Conversion-Kontext: wie viele pending haben ein mollie_payment_id (also Mollie-Call gemacht)?
const pendingWithMollie = pending.filter(l => l.mollie_payment_id);
console.log(`\n=== Pending mit Mollie-Payment-ID: ${pendingWithMollie.length} / ${pending.length} ===`);
console.log(`(= ${pending.length - pendingWithMollie.length} haben Plan ausgewählt, aber Mollie-Call kam nie an)`);

// Conversion-Rate heute vs gestern
const startYesterday = new Date(new Date().setHours(0,0,0,0) - 86400_000).toISOString();
const { data: yest } = await sb
  .from("wauwerk_leads")
  .select("status")
  .gte("created_at", startYesterday)
  .lt("created_at", startToday);
const yStats = { paid: 0, total: 0 };
for (const l of yest || []) { yStats.total++; if (l.status === "paid") yStats.paid++; }
const tStats = { paid: 0, total: 0 };
for (const l of leads) { tStats.total++; if (l.status === "paid") tStats.paid++; }
console.log(`\n=== CR-Vergleich ===`);
console.log(`  Gestern: ${yStats.paid}/${yStats.total} = ${yStats.total ? (yStats.paid/yStats.total*100).toFixed(1) : 0}%`);
console.log(`  Heute:   ${tStats.paid}/${tStats.total} = ${tStats.total ? (tStats.paid/tStats.total*100).toFixed(1) : 0}%`);
