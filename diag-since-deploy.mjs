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

// Letzte 4 Stunden
const since = new Date(Date.now() - 4 * 3600_000).toISOString();
const { data: leads } = await sb
  .from("wauwerk_leads")
  .select("status, selected_plan, ab_variant, mollie_payment_id, created_at, paid_at, email, answers")
  .gte("created_at", since)
  .order("created_at", { ascending: false });

console.log(`=== Letzte 4 Stunden: ${leads.length} Leads ===\n`);

// Per 30-Min-Bucket
const byBucket = {};
for (const l of leads) {
  const d = new Date(l.created_at);
  const bucketMin = Math.floor(d.getMinutes() / 30) * 30;
  const key = `${d.getHours().toString().padStart(2,'0')}:${bucketMin.toString().padStart(2,'0')}`;
  if (!byBucket[key]) byBucket[key] = { total: 0, paid: 0, pending: 0, started: 0, failed: 0, email: 0 };
  byBucket[key].total++;
  byBucket[key][l.status === "email_captured" ? "email" : l.status] = (byBucket[key][l.status === "email_captured" ? "email" : l.status] || 0) + 1;
}
console.log("Per 30-Min-Bucket:");
console.log(" Zeit  | total | paid | pending | failed | checkout_started | email");
for (const k of Object.keys(byBucket).sort()) {
  const s = byBucket[k];
  console.log(` ${k} |  ${String(s.total).padStart(2)}   |  ${String(s.paid||0).padStart(2)}  |   ${String(s.pending||0).padStart(2)}    |   ${String(s.failed||0).padStart(2)}   |    ${String(s.checkout_started||0).padStart(2)}            |  ${String(s.email||0).padStart(2)}`);
}

// Pending OHNE Mollie-Payment-ID (= echte Modal-Drops vs ohne Backend-Call)
const pendingNoMollie = leads.filter(l => l.status === "pending" && !l.mollie_payment_id);
const pendingWithMollie = leads.filter(l => l.status === "pending" && l.mollie_payment_id);
console.log(`\n=== Pending-Aufschluesselung ===`);
console.log(`  ohne Mollie-ID: ${pendingNoMollie.length} (Modal geoeffnet, kein Bezahl-Button geklickt)`);
console.log(`  mit Mollie-ID:  ${pendingWithMollie.length} (Bezahl-Button geklickt, Mollie-Payment offen)`);

// Ab- B-Variante Aufschluesselung
const aStats = leads.filter(l => l.ab_variant === "A").reduce((a,l) => ({ ...a, [l.status]: (a[l.status]||0)+1 }), {});
const bStats = leads.filter(l => l.ab_variant === "B").reduce((a,l) => ({ ...a, [l.status]: (a[l.status]||0)+1 }), {});
console.log(`\n=== A vs B (letzte 4h) ===`);
console.log(`  A:`, aStats);
console.log(`  B:`, bStats);

// Failed details
const failed = leads.filter(l => l.status === "failed").slice(0, 5);
console.log(`\n=== Letzte 5 failed ===`);
for (const l of failed) {
  console.log(`  ${l.created_at.slice(11,16)} | ${l.email} | sel=${l.selected_plan} | mollie=${l.mollie_payment_id?.slice(0,15) || "—"}`);
}
