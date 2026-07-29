// Korrigiert Barbara Guenter (paid 6M, aber 3M generiert):
// 1) lead.selected_plan: 3month -> 6month
// 2) Falschen 3M plan_content loeschen (sonst skipped_existing)
// 3) Production /api/admin/trigger-delivery mit force=true aufrufen
//    -> generiert frischen 6M-Plan, sendet Mail an Kundin mit PDF-Anhang

import { readFileSync } from "node:fs";

try {
  const envText = readFileSync("/Users/maxxx/Documents/nextjs-boilerplate-main/.env.local", "utf8");
  const envMatches = [...envText.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)];
  for (const m of envMatches) if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
} catch {}

const EMAIL = "barbaraguenter@bluewin.ch";
const LEAD_ID = "09170260-1d34-4572-93a4-8e5a9ec38a82";
const WRONG_PLAN_ID = "4932e70e-0184-4787-b1af-7886a7b7a4ab";
const TOKEN = process.env.WORKER_TOKEN;
const BASE = "https://www.pfoten-plan.de";

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1) Lead.selected_plan korrigieren
console.log("Step 1: Lead selected_plan korrigieren 3month -> 6month ...");
const { error: leadErr } = await sb
  .from("wauwerk_leads")
  .update({ selected_plan: "6month" })
  .eq("id", LEAD_ID);
if (leadErr) { console.error("Lead-Update fehlgeschlagen:", leadErr.message); process.exit(1); }
const { data: verifyLead } = await sb
  .from("wauwerk_leads")
  .select("selected_plan,status,paid_at")
  .eq("id", LEAD_ID)
  .maybeSingle();
console.log(`  → selected_plan=${verifyLead.selected_plan} status=${verifyLead.status}`);

// 2) Falschen 3M-Plan loeschen
console.log("Step 2: Falschen 3M plan_content loeschen ...");
const { error: delErr } = await sb
  .from("member_plan_content")
  .delete()
  .eq("id", WRONG_PLAN_ID);
if (delErr) { console.error("Delete fehlgeschlagen:", delErr.message); process.exit(1); }
console.log("  → 3M plan_content geloescht.");

// 3) Production trigger-delivery
console.log("Step 3: Production trigger-delivery (force=true) ...");
const res = await fetch(`${BASE}/api/admin/trigger-delivery`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({ email: EMAIL, force: true }),
});
console.log(`HTTP ${res.status}`);
const data = await res.json().catch(() => ({}));
console.log(JSON.stringify(data, null, 2));
if (!res.ok) process.exit(1);
console.log("\n✓ 6-Monatsplan wird generiert und an Kundin gesendet.");
