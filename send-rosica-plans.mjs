// Einmalig: Einmonatsplan (echtes Hauptthema) + Recall-Plan an eine echte
// Kundin schicken. Spiegelt die Produktiv-Route /api/mitglieder/plan/generate
// (Input-Mapping, composePlan, AI-Intro, sendPlanReadyEmail).
//
// Aufruf:
//   node send-rosica-plans.mjs            -> DRY RUN (baut Pläne + PDFs, sendet NICHT)
//   node send-rosica-plans.mjs --send     -> LIVE (DB-Save Hauptplan + beide Mails)
//
// Hauptplan (dog_problem aus Lead) wird in member_plan_content gespeichert,
// damit die Kundin ihn im Mitgliederbereich sieht. Der Recall-Plan geht nur
// per Mail raus (kein DB-Überschreiben des echten Plans).

import { readFileSync } from "node:fs";

const envText = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
const envMatches = [...envText.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)];
for (const m of envMatches) {
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SEND = process.argv.includes("--send");
const EMAIL = "s.rosica@hotmail.com";

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { composePlan } = await import("./lib/plan-composer.ts");
const { PROBLEM_LABELS_DE } = await import("./lib/exercise-library.ts");
const { generatePersonalizedIntro } = await import("./lib/plan-intro-ai.ts");
const { sendPlanReadyEmail } = await import("./lib/member-mail.ts");
const { planLengthFromSelectedPlan } = await import("./lib/plan-generator.ts");

// PROBLEM_LABELS aus der Route (für die Mail-mainProblem-Anzeige)
const PROBLEM_LABELS = {
  pulling: "Leinenziehen",
  barking: "übermäßiges Bellen",
  aggression: "Aggression in Begegnungen",
  anxiety: "Trennungsangst",
  jumping: "Anspringen von Menschen",
  recall: "unzuverlässiger Rückruf",
  energy: "zu viel Energie",
  destructive: "Zerstörungsverhalten",
  soiling: "Stubenunreinheit",
  mouthing: "Aufnehmen vom Boden",
};

function parseAgeToMonths(s) {
  if (typeof s !== "string") return undefined;
  const num = parseFloat(s.replace(/[^0-9.,]/g, "").replace(",", "."));
  if (isNaN(num)) return undefined;
  if (/monat/i.test(s)) return Math.round(num);
  if (/jahr/i.test(s)) return Math.round(num * 12);
  return Math.round(num);
}

// ── Lead laden ──────────────────────────────────────────────────────────
const { data: lead, error: leadErr } = await sb
  .from("wauwerk_leads")
  .select("id, email, customer_name, dog_name, answers, status, selected_plan, created_at")
  .ilike("email", EMAIL)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (leadErr || !lead) {
  console.error("Lead nicht gefunden:", leadErr?.message);
  process.exit(1);
}

const answers = lead.answers || {};
const dogName = lead.dog_name || answers.dog_name || "deinem Hund";
const dogProblem = answers.dog_problem || answers.problem || answers.main_problem || null;
const targetEmail = (lead.email || EMAIL).toLowerCase();

console.log(`MODE: ${SEND ? "LIVE (sendet Mails)" : "DRY RUN (sendet NICHT)"}`);
console.log(`Lead: ${lead.id} | ${targetEmail} | status=${lead.status} | selected_plan=${lead.selected_plan}`);
console.log(`Hund: ${dogName} | Rasse=${answers.dog_breed || "-"} | Alter=${answers.dog_age || "-"} | Gender=${answers.dog_gender || "-"} | Hauptproblem=${dogProblem}`);

// ── Gemeinsame Inputs (wie Route) ───────────────────────────────────────
const bekannteSignale = Array.isArray(answers.dog_commands)
  ? answers.dog_commands
  : Array.isArray(answers.bekannte_signale)
    ? answers.bekannte_signale
    : [];
const trainingszeit =
  typeof answers.trainingszeit_minuten === "number"
    ? answers.trainingszeit_minuten
    : typeof answers.daily_training_minutes === "number"
      ? answers.daily_training_minutes
      : 15;
const customProblemText =
  typeof answers.custom_problem_text === "string" && answers.custom_problem_text.trim().length > 0
    ? answers.custom_problem_text.trim()
    : undefined;
const zusatzKontextLines = [];
if (answers.dog_energy) zusatzKontextLines.push(`Energielevel: ${answers.dog_energy}`);

const VALID = ["pulling", "barking", "aggression", "anxiety", "recall", "energy", "jumping", "destructive", "soiling", "mouthing"];

const mainProblemKey = VALID.includes(dogProblem) ? dogProblem : "pulling";
const planLengthMonths = planLengthFromSelectedPlan(lead.selected_plan); // '1month' -> 1

console.log(`Trainingszeit=${trainingszeit}min | Signale=${bekannteSignale.length} | customText=${customProblemText ? "ja" : "nein"} | planLänge=${planLengthMonths}M\n`);

// ── Plan-Builder (eine Problem-Variante) ────────────────────────────────
async function buildAndMaybeSend({ problemKey, months, save, label }) {
  const problemLabel = PROBLEM_LABELS_DE[problemKey] || problemKey;
  console.log(`▶ ${label}: ${problemKey} (${problemLabel}) · ${months}-Monatsplan`);

  const introResult = await generatePersonalizedIntro({
    dogName,
    dogBreed: answers.dog_breed || undefined,
    dogAgeMonths: parseAgeToMonths(answers.dog_age),
    problemLabel,
    planLengthMonths: months,
    zusatzKontext: zusatzKontextLines.join("\n") || undefined,
    customProblemText,
  });
  console.log(`  AI-Intro: ${introResult.einleitung ? `${introResult.einleitung.length} Zeichen, ${(introResult.ms / 1000).toFixed(1)}s` : "FAIL -> Fallback"}`);

  const plan = composePlan({
    problem: problemKey,
    planLengthMonths: months,
    dog: {
      dogName,
      dogBreed: answers.dog_breed || undefined,
      dogAgeMonths: parseAgeToMonths(answers.dog_age),
      dogSize: answers.dog_size || undefined,
      dogGender: answers.dog_gender || undefined,
      trainingsZeitMinuten: trainingszeit,
      bekannteSignale,
    },
    introText: introResult.einleitung || undefined,
    zieleText: introResult.ziele || undefined,
    abschlussText: introResult.abschluss || undefined,
    customProblemText,
  });
  const totalUebs = plan.weeks.reduce((s, w) => s + (w.uebungen?.length || 0), 0);
  console.log(`  Plan: ${plan.weeks.length} Wochen, ${totalUebs} Übungen`);

  // PDF-Probebau (gleicher Code wie member-mail), um Build-Fehler VOR Versand zu sehen
  try {
    const { buildPlanPdfFromContent, planPdfFilename } = await import("./lib/pdf-builder.ts");
    const pdfBytes = await buildPlanPdfFromContent({
      plan,
      dogName,
      dogBreed: answers.dog_breed || undefined,
      dogAge: answers.dog_age || undefined,
      mainProblem: PROBLEM_LABELS[problemKey] || problemKey,
      planLengthMonths: months,
      verbose: false,
    });
    const len = pdfBytes.length || pdfBytes.byteLength;
    console.log(`  PDF OK: ${planPdfFilename(dogName, months)} (${(len / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.error(`  PDF-BUILD FEHLGESCHLAGEN: ${e?.message} — diese Mail würde NICHT rausgehen.`);
    return { ok: false, reason: "pdf_build_failed" };
  }

  if (save && SEND) {
    await sb.from("member_plan_content").delete().ilike("email", targetEmail).eq("plan_slug", "trainingsplan");
    const { data: ins, error: insErr } = await sb
      .from("member_plan_content")
      .insert({
        user_id: null,
        email: targetEmail,
        plan_slug: "trainingsplan",
        plan_title: `${months}-Monats-Trainingsplan für ${dogName}`,
        content: plan,
        pdf_url: null,
        dog_name: dogName,
        dog_breed: answers.dog_breed || null,
        source: "claude-internal-manual",
        source_payment_id: lead.id,
      })
      .select("id")
      .single();
    if (insErr) console.error(`  DB-Save FEHLER: ${insErr.message}`);
    else console.log(`  DB-Save: member_plan_content ${ins.id}`);
  } else if (save) {
    console.log(`  [dry] würde in member_plan_content speichern (slug trainingsplan)`);
  }

  if (SEND) {
    const mailRes = await sendPlanReadyEmail({
      to: targetEmail,
      dogName,
      dogBreed: answers.dog_breed || null,
      dogAge: answers.dog_age || null,
      mainProblem: PROBLEM_LABELS[problemKey] || problemKey,
      planLengthMonths: months,
      plan,
      customerName: lead.customer_name || null,
    });
    console.log(`  MAIL: ${mailRes.ok ? "✓ gesendet" : "✗ " + mailRes.reason} (an ${targetEmail}, CC kontakt@primesocial.de)`);
    return mailRes;
  } else {
    console.log(`  [dry] würde sendPlanReadyEmail an ${targetEmail} schicken (CC kontakt@primesocial.de)`);
    return { ok: true, dry: true };
  }
}

// ── 1) Einmonatsplan = echtes Hauptthema (mit DB-Save) ──────────────────
await buildAndMaybeSend({ problemKey: mainProblemKey, months: planLengthMonths, save: true, label: "Einmonatsplan (Hauptthema)" });
console.log("");
// ── 2) Recall-Plan (nur Mail) ───────────────────────────────────────────
await buildAndMaybeSend({ problemKey: "recall", months: 1, save: false, label: "Recall-Plan" });

console.log(`\nFertig. ${SEND ? "" : "(DRY RUN — nichts versendet. Mit --send live schicken.)"}`);
process.exit(0);
