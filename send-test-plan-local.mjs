// Lokal: Test-Plan generieren (Composer + AI-Intro), PDF bauen, in
// member_plan_content speichern und über die ECHTE sendPlanReadyEmail-
// Funktion versenden — exakt so, wie ein zahlender Kunde die Mail bekommt.
//
// Aufruf:
//   npx tsx send-test-plan-local.mjs <problem> [months] [email]
//   npx tsx send-test-plan-local.mjs aggression 1
//   npx tsx send-test-plan-local.mjs energy 1 max@primesocial.de
//
// Probleme: pulling, energy, aggression, mouthing, recall, barking,
//           anxiety, jumping, destructive, soiling
//
// Voraussetzung: node_modules/server-only/ als lokaler Shim.

import { readFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
// Defensive parsing: einige Keys in .env.local sind ohne Newline aneinander
// gehängt (z.B. MAKE_WEBHOOK_URL=...ANTHROPIC_API_KEY=...). Wir greifen
// jede KEY=VALUE-Sequenz, egal wo.
const envMatches = [...envText.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)];
for (const m of envMatches) {
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const PROBLEM = (process.argv[2] || "").trim().toLowerCase();
const PLAN_LENGTH_MONTHS = Number(process.argv[3]) || 1;
const EMAIL = (process.argv[4] || "max@primesocial.de").trim().toLowerCase();

const VALID_PROBLEMS = [
  "pulling", "energy", "aggression", "mouthing", "recall",
  "barking", "anxiety", "jumping", "destructive", "soiling",
];
if (!VALID_PROBLEMS.includes(PROBLEM)) {
  console.error(`Usage: npx tsx send-test-plan-local.mjs <problem> [months=1] [email=max@primesocial.de]`);
  console.error(`Probleme: ${VALID_PROBLEMS.join(", ")}`);
  process.exit(1);
}

// Problem-spezifischer Freitext aus dem Quiz — bewusst konkret, damit der
// AI-Intro echte Details aufgreifen kann.
const CUSTOM_TEXTS = {
  pulling: "Bruno zieht extrem an der Leine sobald andere Hunde oder Jogger in Sicht sind. Zu Hause an der Tür dreht er komplett auf wenn jemand klingelt.",
  energy: "Bruno kommt abends einfach nicht runter. Er rennt durch die Wohnung, fordert ständig Beschäftigung, kann auch nach 2 Stunden Spaziergang nicht entspannen. Ich bin abends fertig, er nicht.",
  aggression: "Bruno bellt und zieht sehr stark in der Leine, sobald er andere Hunde sieht. Auch Jogger und Radfahrer lösen Reaktionen aus. Begegnungen sind richtig anstrengend geworden.",
  mouthing: "Bruno hebt draußen alles auf was rumliegt, Papiertaschentücher, alte Knochen, Essensreste. Bei Maisstärke-Kügelchen vom Bäcker schluckt er sofort, ich komme gar nicht hinterher.",
  recall: "Bruno kommt nur wenn nichts spannenderes los ist. Sobald ein anderer Hund oder ein Geruch da ist, ist er weg und ich kann ewig rufen.",
  barking: "Bruno bellt sofort wenn es klingelt und beruhigt sich erst nach Minuten. Auch wenn er allein im Auto bleibt oder Geräusche im Treppenhaus hört, geht es los.",
  anxiety: "Sobald ich die Schuhe anziehe wird Bruno unruhig. Wenn ich gehe winselt und bellt er, Nachbarn beschweren sich. Beim Heimkommen wirkt er völlig fertig.",
  jumping: "Bruno springt jeden an der zur Tür reinkommt, auch fremde Gäste. Bei der Begrüßung morgens drückt er mich fast um. Wir haben das schon mit Wegdrehen probiert, klappt nicht.",
  destructive: "Wenn ich nicht da bin, zerlegt Bruno alles. Schuhe, Sofakissen, einmal sogar eine Tür-Ecke angenagt. Mit Spielzeug ablenken hilft nur kurz.",
  soiling: "Bruno macht immer wieder in die Wohnung, obwohl er stubenrein war. Meist morgens vor dem ersten Rausgehen oder wenn ich länger weg war. Tierarzt-Check ist gemacht, körperlich alles ok.",
};
const customProblemText = CUSTOM_TEXTS[PROBLEM];

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { composePlan } = await import("./lib/plan-composer.ts");
const { PROBLEM_LABELS_DE } = await import("./lib/exercise-library.ts");
const { generatePersonalizedIntro } = await import("./lib/plan-intro-ai.ts");
const { sendPlanReadyEmail } = await import("./lib/member-mail.ts");

const problemLabel = PROBLEM_LABELS_DE[PROBLEM];
console.log(`→ ${PROBLEM} (${problemLabel}) · ${PLAN_LENGTH_MONTHS}-Monatsplan → ${EMAIL}`);

const introResult = await generatePersonalizedIntro({
  dogName: "Bruno",
  dogBreed: "Labrador-Mix",
  dogAgeMonths: 18,
  problemLabel,
  planLengthMonths: PLAN_LENGTH_MONTHS,
  customProblemText,
});
console.log(
  `  ✓ AI-Intro: ${introResult.einleitung ? `${introResult.einleitung.length} Zeichen, ${(introResult.ms / 1000).toFixed(1)}s` : "FAIL — fällt auf generischen Fallback zurück"}`
);

const plan = composePlan({
  problem: PROBLEM,
  planLengthMonths: PLAN_LENGTH_MONTHS,
  dog: {
    dogName: "Bruno",
    dogBreed: "Labrador-Mix",
    dogAgeMonths: 18,
    dogGender: "m",
    trainingsZeitMinuten: 30,
  },
  introText: introResult.einleitung || undefined,
  customProblemText,
});
console.log(`  ✓ Plan composed: ${plan.weeks.length} Wochen`);
const totalUebs = plan.weeks.reduce((sum, w) => sum + (w.uebungen?.length || 0), 0);
console.log(`  ✓ Übungen: ${totalUebs} gesamt (avg ${(totalUebs / plan.weeks.length).toFixed(1)} pro Woche)`);

await sb
  .from("member_plan_content")
  .delete()
  .ilike("email", EMAIL)
  .eq("plan_slug", "trainingsplan");
const { data: inserted, error: insErr } = await sb
  .from("member_plan_content")
  .insert({
    user_id: null,
    email: EMAIL,
    plan_slug: "trainingsplan",
    plan_title: `${PLAN_LENGTH_MONTHS}-Monats-Trainingsplan für Bruno`,
    content: plan,
    pdf_url: null,
    dog_name: "Bruno",
    dog_breed: "Labrador-Mix",
    source: `local_${PROBLEM}_test`,
  })
  .select("id")
  .single();
if (insErr) {
  console.error("DB-Insert fehlgeschlagen:", insErr);
  process.exit(1);
}
console.log(`  ✓ DB-Eintrag: ${inserted.id}`);

const mailRes = await sendPlanReadyEmail({
  to: EMAIL,
  dogName: "Bruno",
  dogBreed: "Labrador-Mix",
  dogAge: "18 Monate",
  mainProblem: problemLabel,
  planLengthMonths: PLAN_LENGTH_MONTHS,
  plan,
  customerName: "Max",
});
console.log(`  ${mailRes.ok ? "✓" : "✗"} sendPlanReadyEmail: ok=${mailRes.ok}${mailRes.reason ? " reason=" + mailRes.reason : ""}`);
process.exit(mailRes.ok ? 0 : 1);
