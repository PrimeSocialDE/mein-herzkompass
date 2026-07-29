// Test der Production-Pipeline:
// Ruft https://www.pfoten-plan.de/api/mitglieder/plan/generate 3x auf
// (genauso wie der Mollie-Webhook nach status=paid).
// Mit force=true + plan_length_months damit alle 3 Längen generiert werden.

import { readFileSync } from "node:fs";
try {
  const e = readFileSync("/Users/maxxx/Documents/nextjs-boilerplate-main/.env.local","utf8");
  for (const l of e.split("\n")) {
    const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
  }
} catch {}

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const EMAIL = "max@primesocial.de";
const BASE_URL = "https://www.pfoten-plan.de";
const TOKEN = process.env.WORKER_TOKEN;
if (!TOKEN) { console.error("WORKER_TOKEN fehlt"); process.exit(1); }

// 1) Drei paid-Leads holen, sortiert nach Plan-Länge
const { data: leads } = await sb
  .from("wauwerk_leads")
  .select("id, email, selected_plan, status")
  .ilike("email", EMAIL)
  .eq("status", "paid")
  .order("created_at", { ascending: true });

console.log("Gefundene paid-Leads:");
for (const l of leads || []) console.log(` - ${l.selected_plan} ${l.id}`);
if (!leads || leads.length < 3) { console.error("Erwarte 3 paid-Leads"); process.exit(1); }

const lengths = { "1month": 1, "3month": 3, "6month": 6 };

for (const lead of leads) {
  const months = lengths[lead.selected_plan];
  console.log(`\n=== Lead ${lead.selected_plan} (${months} Monate) ===`);

  // Vorherigen Plan loeschen, damit existing-check uns nicht blockt
  // (auch wenn force=true den check umgeht — sauberer State).
  const { count: del } = await sb
    .from("member_plan_content")
    .delete({ count: "exact" })
    .ilike("email", EMAIL)
    .eq("plan_slug", "trainingsplan");
  console.log(`  -> alte Plaene geloescht: ${del ?? 0}`);

  // /plan/generate aufrufen (NDJSON-Stream lesen)
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/api/mitglieder/plan/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({
      lead_id: lead.id,
      email: EMAIL,
      force: true,
      plan_length_months: months,
    }),
  });
  console.log(`  -> HTTP ${res.status} (${Date.now()-t0}ms gesamt-fetch start)`);

  // Stream lesen
  const txt = await res.text();
  const lines = txt.split("\n").filter(Boolean);
  let final = null;
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.event === "done") final = obj;
      else if (obj.event === "stage") console.log(`     stage=${obj.stage} ${obj.ok != null ? "ok="+obj.ok : ""}`);
    } catch {}
  }
  console.log(`  -> done: ok=${final?.ok} weeks=${final?.weeks_count} months=${final?.plan_length_months} dur=${final?.duration_ms}ms`);
  if (final?.error) console.log(`     ERROR: ${final.error}${final.details ? " ("+final.details+")" : ""}`);
}

// Summary
console.log("\n=== Pruefung ===");
const { data: finalPlans } = await sb
  .from("member_plan_content")
  .select("plan_title, content, created_at")
  .ilike("email", EMAIL)
  .order("created_at", { ascending: false });
for (const p of finalPlans || []) {
  const c = p.content || {};
  const monate = c.intro?.plan_dauer_monate;
  console.log(` - ${p.created_at?.slice(11,19)} | ${monate}M | ${p.plan_title}`);
}
console.log("\nFertig — drei E-Mails sollten an", EMAIL, "rausgegangen sein.");
