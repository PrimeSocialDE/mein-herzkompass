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

const DAYS = 2;
const since = new Date(Date.now() - DAYS * 86400_000).toISOString();

// ===== 1. Upgrades aus dem Mitgliederbereich =====
// Über utm_source='member-area' in answers oder direkt in mollie metadata
const { data: leads, error } = await sb
  .from("wauwerk_leads")
  .select("id, email, status, selected_plan, mollie_payment_id, paid_at, created_at, answers, upsell_module, mollie_upsell_payment_id")
  .gte("created_at", since);
if (error) { console.error(error); process.exit(1); }

const memberLeads = leads.filter(l => l.answers?.utm_source === "member-area" || l.answers?.utm_campaign === "upgrade");
console.log(`=== Upgrades aus Member-Bereich (letzte ${DAYS} Tage) ===\n`);
console.log(`Gefunden: ${memberLeads.length} Plan-Upgrade-Versuche\n`);
const upStats = { paid: 0, pending: 0, checkout_started: 0, failed: 0, other: 0 };
for (const l of memberLeads) {
  upStats[l.status] = (upStats[l.status] || 0) + 1;
  console.log(` ${l.created_at.slice(0,16)} | ${l.status.padEnd(17)} | ${(l.email||"?").padEnd(30)} | sel=${l.selected_plan || "?"} | mollie=${l.mollie_payment_id ? "yes" : "—"}`);
}
console.log("\n Status-Verteilung Upgrades:", upStats);

// ===== 2. Multiple Mollie-Payments pro Email (= Wiederholungs-Käufer) =====
console.log("\n=== Wiederholungs-Käufer (mehrere Mollie-Payments pro Email, letzte 2 Tage) ===\n");
const byEmail = new Map();
for (const l of leads) {
  if (!l.email || !l.mollie_payment_id) continue;
  if (!byEmail.has(l.email)) byEmail.set(l.email, []);
  byEmail.get(l.email).push(l);
}
const repeats = [...byEmail.entries()].filter(([_, ls]) => ls.length > 1);
console.log(`${repeats.length} Emails mit > 1 Mollie-Payment in 2 Tagen:\n`);
for (const [email, ls] of repeats) {
  console.log(`  ${email}:`);
  for (const l of ls) {
    console.log(`     ${l.created_at.slice(11,16)} ${l.status.padEnd(17)} sel=${l.selected_plan} paid=${l.paid_at?.slice(11,16) || "—"}`);
  }
}

// ===== 3. Upsell-Module-Käufe (gesondertes Flow) =====
console.log("\n=== Upsell-Module-Käufe letzte 2 Tage ===\n");
const upsellLeads = leads.filter(l => l.upsell_module || l.mollie_upsell_payment_id);
console.log(`Gefunden: ${upsellLeads.length}\n`);
for (const l of upsellLeads.slice(0, 15)) {
  console.log(`  ${l.created_at.slice(0,16)} | ${l.status.padEnd(17)} | ${l.email} | module=${l.upsell_module || "—"} | upsell_pay=${l.mollie_upsell_payment_id || "—"}`);
}

// ===== 4. Failed/Pending mit utm_source=brevo (Email-Mails an Bestand) =====
console.log("\n=== Email-Funnel-Pending/Failed (utm_source=brevo oder email) ===\n");
const emailFunnel = leads.filter(l => {
  const src = l.answers?.utm_source || "";
  const camp = l.answers?.utm_campaign || "";
  return (src === "brevo" || src === "email" || camp.toLowerCase().includes("email") || camp.toLowerCase().includes("brevo"));
});
console.log(`Gefunden: ${emailFunnel.length}`);
for (const l of emailFunnel.slice(0, 10)) {
  console.log(`  ${l.created_at.slice(0,16)} | ${l.status.padEnd(17)} | ${l.email} | utm_src=${l.answers?.utm_source} | utm_camp=${l.answers?.utm_campaign}`);
}
