// One-off: einen Test-Account auf "paid" setzen (Lead + Member-Profil).
//
// Aufruf:
//   node scripts/grant-test-plan.mjs kontakt@primesocial.de
//   node scripts/grant-test-plan.mjs kontakt@primesocial.de pulling
//
// Optional zweites Argument: dog_problem-Key (pulling, barking, aggression,
// anxiety, jumping, recall, energy, destructive, soiling, mouthing).
// Default: pulling.
//
// Idempotent: laesst sich mehrfach laufen, ueberschreibt nicht
// versehentlich existierende Felder ausser status/paid_at.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// .env.local manuell laden (kein dotenv-Dependency noetig)
try {
  const envText = readFileSync(".env.local", "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}


const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "FEHLT: SUPABASE_URL + SUPABASE_SERVICE_ROLE in .env.local. " +
      "Script muss aus dem Projekt-Root laufen."
  );
  process.exit(1);
}

const email = (process.argv[2] || "").trim().toLowerCase();
const problem = (process.argv[3] || "pulling").trim();
const VALID_PROBLEMS = new Set([
  "pulling",
  "barking",
  "aggression",
  "anxiety",
  "jumping",
  "recall",
  "energy",
  "destructive",
  "soiling",
  "mouthing",
]);

if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/grant-test-plan.mjs <email> [dog_problem]");
  process.exit(1);
}
if (!VALID_PROBLEMS.has(problem)) {
  console.error(
    `Unbekannter Problem-Key: ${problem}. Erlaubt: ${[...VALID_PROBLEMS].join(", ")}`
  );
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const paidAt = new Date().toISOString();

console.log(`\n→ Test-Plan fuer ${email} (Problem: ${problem})\n`);

// ── 1) Lead: existiert? sonst anlegen ─────────────────────────────────
// dog_problem liegt in answers JSONB, nicht als eigene Spalte
const { data: leadExisting } = await sb
  .from("wauwerk_leads")
  .select("id, status, paid_at, dog_name, email, answers")
  .ilike("email", email)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

let leadId;
if (leadExisting) {
  console.log(`  Lead gefunden: ${leadExisting.id} (status: ${leadExisting.status})`);
  const prevAnswers = leadExisting.answers || {};
  const update = {
    status: "paid",
    paid: true,
    paid_at: leadExisting.paid_at || paidAt,
    answers: {
      ...prevAnswers,
      dog_problem: prevAnswers.dog_problem || problem,
    },
  };
  if (!leadExisting.dog_name) update.dog_name = "Bruno";
  const { error: upErr } = await sb
    .from("wauwerk_leads")
    .update(update)
    .eq("id", leadExisting.id);
  if (upErr) {
    console.error("  Lead-Update fehlgeschlagen:", upErr.message);
    process.exit(1);
  }
  leadId = leadExisting.id;
  console.log("  ✓ Lead auf paid gesetzt");
} else {
  const { data: newLead, error: insErr } = await sb
    .from("wauwerk_leads")
    .insert({
      email,
      customer_name: "Test User",
      dog_name: "Bruno",
      answers: { dog_problem: problem },
      status: "paid",
      paid: true,
      paid_at: paidAt,
      payment_provider: "test",
    })
    .select("id")
    .single();
  if (insErr) {
    console.error("  Lead-Insert fehlgeschlagen:", insErr.message);
    process.exit(1);
  }
  leadId = newLead.id;
  console.log(`  ✓ Neuer Lead angelegt: ${leadId}`);
}

// ── 2) Member-Profil: existiert? dann sofort upgraden ─────────────────
const { data: member } = await sb
  .from("member_users")
  .select("id, purchase_status, dog_name, quiz_result")
  .ilike("email", email)
  .maybeSingle();

if (member) {
  const updates = {
    purchase_status: "paid",
    purchased_at: paidAt,
    source_lead_id: leadId,
  };
  // Falls noch kein quiz_result.dog_problem da: setzen damit die
  // Wochen-Aufgaben + Coaching personalisiert sind
  const qr = (member.quiz_result || {});
  if (!qr.dog_problem) {
    updates.quiz_result = { ...qr, dog_problem: problem };
  }
  if (!member.dog_name) updates.dog_name = "Bruno";
  const { error: memErr } = await sb
    .from("member_users")
    .update(updates)
    .eq("id", member.id);
  if (memErr) {
    console.error("  Member-Update fehlgeschlagen:", memErr.message);
    process.exit(1);
  }
  console.log(`  ✓ Member-Profil auf paid: ${member.id}`);
} else {
  console.log(
    "  ℹ️  Noch kein member_users-Profil — wird automatisch beim ersten Login angelegt (mit paid-Status, weil Lead jetzt paid)."
  );
}

console.log(`\nFertig. Logge dich jetzt auf /mitglieder/login mit ${email} ein.\n`);
