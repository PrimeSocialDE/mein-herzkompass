import { readFileSync } from "node:fs";
try {
  const e = readFileSync("/Users/maxxx/Documents/nextjs-boilerplate-main/.env.local","utf8");
  for (const l of e.split("\n")) {
    const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
  }
} catch {}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth:{autoRefreshToken:false,persistSession:false} });

const EMAIL = "max@primesocial.de";

// Vorher: Plaene loeschen + alte Leads loeschen, damit der Test sauber laeuft
const delPlans = await sb.from("member_plan_content").delete({ count: "exact" }).ilike("email", EMAIL);
console.log("Geloeschte Plaene:", delPlans.count ?? 0);
const delLeads = await sb.from("wauwerk_leads").delete({ count: "exact" }).ilike("email", EMAIL);
console.log("Geloeschte Leads:", delLeads.count ?? 0);

const baseAnswers = {
  dog_name: "Bruno",
  dog_breed: "Labrador-Mix",
  dog_age_months: 18,
  problem: "pulling",
  custom_problem_text: "Bruno zieht extrem an der Leine, sobald andere Hunde oder Jogger in Sicht sind. Zu Hause an der Tür dreht er komplett auf wenn jemand klingelt.",
  routine: "2x täglich Spaziergang je 45 Min",
  zeit_pro_tag: "20-30 Minuten Training",
};

const plans = [
  { selected_plan: "1month", months: 1 },
  { selected_plan: "3month", months: 3 },
  { selected_plan: "6month", months: 6 },
];

const nowIso = new Date().toISOString();

for (const p of plans) {
  const { data, error } = await sb
    .from("wauwerk_leads")
    .insert({
      email: EMAIL,
      selected_plan: p.selected_plan,
      status: "paid",
      paid_at: nowIso,
      dog_name: baseAnswers.dog_name,
      answers: baseAnswers,
    })
    .select("id, selected_plan, status, paid_at")
    .single();
  if (error) { console.error("Insert-Fehler", p.selected_plan, error.message); continue; }
  console.log(`Lead angelegt: ${data.selected_plan} status=${data.status} -> id=${data.id}`);
}
