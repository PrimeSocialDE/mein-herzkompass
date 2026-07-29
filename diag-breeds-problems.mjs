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
  .select("status, answers, dog_name, selected_plan")
  .gte("created_at", since)
  // ALLE Leads (Quiz beendet + Plan angeschaut + paid) — egal welcher Status
  .not("answers", "is", null);

console.log(`=== Alle Hunde-Leads der letzten ${DAYS} Tage (Quiz-Submitter + Plan-Anseher + paid) ===`);
console.log(`Total: ${leads.length} Leads\n`);

const PROBLEM_LABELS = {
  pulling: "Leinenziehen",
  barking: "Übermäßiges Bellen",
  aggression: "Aggression",
  anxiety: "Trennungsangst",
  jumping: "Anspringen",
  recall: "Rückruf-Probleme",
  energy: "Zu viel Energie",
  destructive: "Zerstörungsverhalten",
  soiling: "Stubenunreinheit",
  mouthing: "Aufnehmen vom Boden",
};

// Rasse-Normalisierung (case-insensitive, trim)
function normBreed(b) {
  if (!b) return null;
  const s = String(b).trim();
  if (!s || s.toLowerCase() === "unknown") return null;
  // Title-case: erstes Wort gross
  return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

const breedStats = new Map(); // breed → { total, paid }
const problemStats = new Map(); // problem → { total, paid }
const breedProblemStats = new Map(); // "breed|problem" → count

for (const l of leads) {
  const a = l.answers || {};
  const breed = normBreed(a.dog_breed);
  const problem = a.dog_problem || a.custom_problem_key;
  const problemLabel = PROBLEM_LABELS[problem] || a.custom_problem_text || problem || "—";
  const isPaid = l.status === "paid";

  if (breed) {
    if (!breedStats.has(breed)) breedStats.set(breed, { total: 0, paid: 0 });
    const b = breedStats.get(breed);
    b.total++;
    if (isPaid) b.paid++;
  }

  if (problem) {
    if (!problemStats.has(problemLabel)) problemStats.set(problemLabel, { total: 0, paid: 0 });
    const p = problemStats.get(problemLabel);
    p.total++;
    if (isPaid) p.paid++;
  }

  if (breed && problem) {
    const key = `${breed}|${problemLabel}`;
    breedProblemStats.set(key, (breedProblemStats.get(key) || 0) + 1);
  }
}

// Top 10 Rassen
const breedsSorted = [...breedStats.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);
console.log("=== TOP 10 RASSEN ===");
console.log("Rang | Rasse                        | Total | Davon paid | Conv-Rate");
console.log("-".repeat(80));
breedsSorted.forEach(([breed, s], i) => {
  const cr = s.total ? (s.paid/s.total*100).toFixed(0) + "%" : "—";
  console.log(`${String(i+1).padStart(2)}.  | ${breed.padEnd(28)} | ${String(s.total).padStart(5)} | ${String(s.paid).padStart(10)} | ${cr}`);
});

// Top 10 Probleme
const problemsSorted = [...problemStats.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);
console.log(`\n=== TOP 10 PROBLEME ===`);
console.log("Rang | Problem                          | Total | Davon paid | Conv-Rate");
console.log("-".repeat(80));
problemsSorted.forEach(([prob, s], i) => {
  const cr = s.total ? (s.paid/s.total*100).toFixed(0) + "%" : "—";
  console.log(`${String(i+1).padStart(2)}.  | ${prob.padEnd(32)} | ${String(s.total).padStart(5)} | ${String(s.paid).padStart(10)} | ${cr}`);
});

// Top 5 Rasse+Problem-Kombinationen
const bpSorted = [...breedProblemStats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log(`\n=== TOP 8 RASSE × PROBLEM-KOMBINATIONEN ===`);
console.log("Rang | Rasse + Problem");
console.log("-".repeat(80));
bpSorted.forEach(([key, count], i) => {
  const [breed, problem] = key.split("|");
  console.log(`${String(i+1).padStart(2)}.  | ${breed} → ${problem}: ${count}×`);
});

// Summary
const totalPaid = leads.filter(l => l.status === "paid").length;
console.log(`\n=== Summary ===`);
console.log(`Total Plan-Auswähler (5 Tage): ${leads.length}`);
console.log(`Davon paid: ${totalPaid} (${(totalPaid/leads.length*100).toFixed(0)}%)`);
console.log(`Erkannte Rassen: ${breedStats.size}`);
