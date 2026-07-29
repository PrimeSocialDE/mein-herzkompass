import { readFileSync } from "node:fs";
const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
for (const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)])
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PRICE = { "1month": 29.99, "3month": 39.99, "6month": 59.99 };
const iso = (d) => new Date(Date.now() - d * 864e5).toISOString();

// Exakte Counts (head:true -> nur count, keine Zeilen, kein 1000er-Cap)
async function countPaid(since, emailOnly) {
  let q = sb.from("wauwerk_leads").select("id", { count: "exact", head: true }).eq("status", "paid").gte("paid_at", since);
  if (emailOnly) q = q.or("answers->>utm_source.eq.brevo,answers->>utm_medium.eq.email");
  const { count, error } = await q;
  if (error) { console.error(error); return null; }
  return count;
}

console.log("Bezahlte Conversions — gesamt vs. E-Mail (utm_source=brevo ODER utm_medium=email)\n");
console.log("Fenster |  gesamt | E-Mail | Anteil");
for (const d of [7, 30, 90]) {
  const total = await countPaid(iso(d), false);
  const mail = await countPaid(iso(d), true);
  console.log(`  ${String(d).padStart(2)}d   |  ${String(total).padStart(5)}  |  ${String(mail).padStart(4)} | ${((mail / total) * 100).toFixed(1)}%`);
}

// Detail: die E-Mail-Conversions der letzten 90 Tage voll laden
const { data: mailLeads, error } = await sb
  .from("wauwerk_leads")
  .select("id, email, selected_plan, paid_at, answers")
  .eq("status", "paid")
  .gte("paid_at", iso(90))
  .or("answers->>utm_source.eq.brevo,answers->>utm_medium.eq.email")
  .order("paid_at", { ascending: false });
if (error) { console.error(error); process.exit(1); }

const byPlan = {};
let rev = 0;
for (const l of mailLeads) { byPlan[l.selected_plan] = (byPlan[l.selected_plan] || 0) + 1; rev += PRICE[l.selected_plan] || 0; }
console.log(`\n=== E-Mail-Conversions letzte 90 Tage: ${mailLeads.length} ===`);
console.log("Plan-Mix:", Object.entries(byPlan).map(([k, v]) => `${k}:${v}`).join("  "));
console.log(`Umsatz (nur Hauptplan, ohne Upsells): ~€${rev.toFixed(2)}`);

console.log("\n=== utm_campaign der E-Mail-Conversions ===");
const camp = {};
for (const l of mailLeads) { const c = l.answers?.utm_campaign || "(leer)"; camp[c] = (camp[c] || 0) + 1; }
for (const [k, v] of Object.entries(camp).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`);

console.log("\n=== Alle E-Mail-Conversions (90d) ===");
for (const l of mailLeads) {
  const a = l.answers || {};
  console.log(`  ${l.paid_at?.slice(0, 16)} | ${(l.selected_plan || "?").padEnd(7)} | src=${(a.utm_source || "-").padEnd(8)} med=${(a.utm_medium || "-").padEnd(6)} camp=${(a.utm_campaign || "-")}`);
}

// Kontroll-Check: landet überhaupt jemand zahlend auf geld-zurueck?
const { count: gz } = await sb.from("wauwerk_leads").select("id", { count: "exact", head: true })
  .eq("status", "paid").gte("paid_at", iso(90)).ilike("answers->>landing_page", "%geld-zurueck%");
console.log(`\nKontroll-Check: bezahlte Leads mit landing_page enthält 'geld-zurueck' (90d): ${gz}`);
