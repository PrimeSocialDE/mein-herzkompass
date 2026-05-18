// Einmalig laufen lassen: schiebt alle existing paid-Kunden aus
// Liste #47 (Nurture) raus und in #44/#45/#46 (Plan-Listen) rein.
//
// Idempotent — Brevo skipped silent wenn Contact schon in der
// Ziel-Liste oder schon raus aus Quell-Liste.
//
// Run: node backfill-brevo-lists.mjs [--dry] [--limit=N]

import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 1000;

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const LIST_NURTURE = parseInt(process.env.BREVO_LIST_NURTURE || "47", 10);
const LIST_1M = parseInt(process.env.BREVO_LIST_1M || "44", 10);
const LIST_3M = parseInt(process.env.BREVO_LIST_3M || "45", 10);
const LIST_6M = parseInt(process.env.BREVO_LIST_6M || "46", 10);

if (!BREVO_API_KEY) {
  console.error("BREVO_API_KEY fehlt in .env.local");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

console.log(`Modus: ${dryRun ? "DRY RUN (nichts ändern)" : "LIVE"} · Limit: ${limit}`);
console.log(`Listen: nurture=#${LIST_NURTURE} · 1M=#${LIST_1M} · 3M=#${LIST_3M} · 6M=#${LIST_6M}\n`);

// Alle paid-Leads holen (egal wie alt — Backfill ist einmalig)
const { data: paidLeads, error } = await sb
  .from("wauwerk_leads")
  .select("id, email, selected_plan, paid_at")
  .eq("status", "paid")
  .not("email", "is", null)
  .order("paid_at", { ascending: false, nullsFirst: false })
  .limit(limit);

if (error) {
  console.error("Supabase-Fehler:", error.message);
  process.exit(1);
}

console.log(`Gefunden: ${paidLeads.length} paid-Leads\n`);

const stats = {
  total: paidLeads.length,
  by_plan: { 1: 0, 3: 0, 6: 0 },
  removed_ok: 0,
  added_ok: 0,
  errors: 0,
};

function listIdForPlan(plan) {
  if (plan === "1month") return LIST_1M;
  if (plan === "6month") return LIST_6M;
  return LIST_3M; // default + 3month
}

function planMonths(plan) {
  if (plan === "1month") return 1;
  if (plan === "6month") return 6;
  return 3;
}

async function removeFromList(email, listId) {
  const res = await fetch(
    `https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`,
    {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ emails: [email] }),
    }
  );
  if (res.ok) return true;
  const txt = await res.text();
  if (txt.includes("already removed") || txt.includes("not in list")) return true;
  console.warn(`  remove err: ${res.status} ${txt.slice(0, 100)}`);
  return false;
}

async function addToList(email, listId) {
  const res = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, listIds: [listId], updateEnabled: true }),
  });
  if (res.ok) return true;
  const data = await res.json().catch(() => ({}));
  if (data.code === "duplicate_parameter") return true;
  console.warn(`  add err: ${res.status} ${JSON.stringify(data)}`);
  return false;
}

let i = 0;
for (const lead of paidLeads) {
  i++;
  const email = lead.email.trim().toLowerCase();
  const plan = lead.selected_plan;
  const months = planMonths(plan);
  const targetList = listIdForPlan(plan);
  stats.by_plan[months]++;

  process.stdout.write(
    `[${i}/${paidLeads.length}] ${email.padEnd(40)} → #${targetList} (${months}M)`
  );

  if (dryRun) {
    console.log(" — DRY");
    continue;
  }

  const [r1, r2] = await Promise.all([
    removeFromList(email, LIST_NURTURE),
    addToList(email, targetList),
  ]);
  if (r1) stats.removed_ok++;
  if (r2) stats.added_ok++;
  if (!r1 || !r2) stats.errors++;
  console.log(` removed=${r1 ? "✓" : "✗"} added=${r2 ? "✓" : "✗"}`);

  // Brevo Rate-Limit: ~10/s safe — kleine Pause
  await new Promise((r) => setTimeout(r, 120));
}

console.log("\n=== Summary ===");
console.log(stats);
