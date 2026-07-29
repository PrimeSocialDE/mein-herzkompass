// Lokal: ITALIENISCHEN Test-Plan generieren (IT-Composer + IT-AI-Intro),
// PDF bauen (mit IT-Trainer-Foto) und über die ECHTE sendPlanReadyEmail-
// Funktion mit lang:"it" versenden — exakt wie ein zahlender IT-Kunde.
//
// Aufruf:  npx tsx send-test-plan-it-local.mjs [problem] [months] [email]
//   npx tsx send-test-plan-it-local.mjs pulling 3 kontakt@primesocial.de
//
// IT-Plan-Mails laufen (transactional, lang!=="pl") über Google Workspace
// SMTP — der noch unverifizierte Brevo-Absender supporto@zampaplan.it ist
// also kein Hindernis.

import { readFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
const envMatches = [...envText.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)];
for (const m of envMatches) {
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const PROBLEM = (process.argv[2] || "pulling").trim().toLowerCase();
const PLAN_LENGTH_MONTHS = Number(process.argv[3]) || 3;
const EMAIL = (process.argv[4] || "kontakt@primesocial.de").trim().toLowerCase();

const VALID_PROBLEMS = [
  "pulling", "energy", "aggression", "mouthing", "recall",
  "barking", "anxiety", "jumping", "destructive", "soiling",
];
if (!VALID_PROBLEMS.includes(PROBLEM)) {
  console.error(`Usage: npx tsx send-test-plan-it-local.mjs <problem> [months=3] [email]`);
  console.error(`Probleme: ${VALID_PROBLEMS.join(", ")}`);
  process.exit(1);
}

// Italienischer Quiz-Freitext, damit der IT-AI-Intro echte Details aufgreift.
const CUSTOM_TEXTS_IT = {
  pulling: "Bruno tira moltissimo al guinzaglio non appena vede altri cani o persone che corrono. A casa, davanti alla porta, si agita completamente quando qualcuno suona il campanello.",
  energy: "La sera Bruno non riesce proprio a calmarsi. Corre per casa, chiede continuamente attenzione e anche dopo due ore di passeggiata resta iperattivo. Io la sera sono distrutto, lui no.",
  aggression: "Bruno abbaia e tira fortissimo al guinzaglio appena vede altri cani. Anche i corridori e i ciclisti scatenano reazioni. Gli incontri sono diventati davvero stressanti.",
  mouthing: "Bruno raccoglie da terra qualsiasi cosa, fazzoletti, vecchi ossi, avanzi di cibo. Ingoia subito, non faccio in tempo a fermarlo.",
  recall: "Bruno torna solo se non c'è niente di più interessante. Appena c'è un altro cane o un odore forte, sparisce e posso chiamarlo all'infinito.",
  barking: "Bruno abbaia subito quando suona il campanello e si calma solo dopo minuti. Anche quando resta solo in auto o sente rumori sulle scale, ricomincia.",
  anxiety: "Appena mi metto le scarpe Bruno diventa nervoso. Quando esco piange e abbaia, i vicini si lamentano. Al ritorno sembra completamente esausto.",
  jumping: "Bruno salta addosso a chiunque entri dalla porta, anche agli ospiti. La mattina, quando mi saluta, quasi mi butta a terra.",
  destructive: "Quando non ci sono, Bruno distrugge tutto. Scarpe, cuscini del divano, una volta ha rosicchiato l'angolo di una porta.",
  soiling: "Bruno continua a sporcare in casa anche se era pulito. Di solito la mattina prima della prima uscita o quando resto fuori a lungo. Il controllo dal veterinario è fatto, fisicamente tutto ok.",
};
const customProblemText = CUSTOM_TEXTS_IT[PROBLEM];

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { composePlan } = await import("./lib/plan-composer.it.ts");
const { PROBLEM_LABELS_IT } = await import("./lib/exercise-library.it.ts");
const { generatePersonalizedIntro } = await import("./lib/plan-intro-ai.it.ts");
const { sendPlanReadyEmail } = await import("./lib/member-mail.ts");

const problemLabel = PROBLEM_LABELS_IT[PROBLEM];
console.log(`→ [IT] ${PROBLEM} (${problemLabel}) · piano di ${PLAN_LENGTH_MONTHS} mesi → ${EMAIL}`);

const introResult = await generatePersonalizedIntro({
  dogName: "Bruno",
  dogBreed: "Labrador (incrocio)",
  dogAgeMonths: 18,
  problemLabel,
  planLengthMonths: PLAN_LENGTH_MONTHS,
  customProblemText,
});
console.log(
  `  ✓ AI-Intro: ${introResult.einleitung ? `${introResult.einleitung.length} Zeichen, ${(introResult.ms / 1000).toFixed(1)}s` : "FAIL — generischer Fallback"}`
);

const plan = composePlan({
  problem: PROBLEM,
  planLengthMonths: PLAN_LENGTH_MONTHS,
  dog: {
    dogName: "Bruno",
    dogBreed: "Labrador (incrocio)",
    dogAgeMonths: 18,
    dogGender: "m",
    trainingsZeitMinuten: 30,
  },
  introText: introResult.einleitung || undefined,
  customProblemText,
});
console.log(`  ✓ Plan composed: ${plan.weeks.length} Wochen`);

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
    plan_title: `Piano di addestramento di ${PLAN_LENGTH_MONTHS} mesi per Bruno`,
    content: plan,
    pdf_url: null,
    dog_name: "Bruno",
    dog_breed: "Labrador (incrocio)",
    source: `local_${PROBLEM}_it_test`,
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
  dogBreed: "Labrador (incrocio)",
  dogAge: "18 mesi",
  mainProblem: problemLabel,
  planLengthMonths: PLAN_LENGTH_MONTHS,
  plan,
  customerName: "Max",
  lang: "it",
});
console.log(`  ${mailRes.ok ? "✓" : "✗"} sendPlanReadyEmail: ok=${mailRes.ok}${mailRes.reason ? " reason=" + mailRes.reason : ""}${mailRes.via ? " via=" + mailRes.via : ""}`);
process.exit(mailRes.ok ? 0 : 1);
