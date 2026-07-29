// Generiert die drei neuen Plan-Texte (einleitung, ziele, abschluss) fuer
// Iniko anhand des aktualisierten AI-Prompts, splice't sie in das existierende
// plan_content, rendert PDF und schickt es an max@primesocial.de.
// Die Kundin (egloffdaniela@gmail.com) bekommt NICHTS.

import { readFileSync, writeFileSync } from "node:fs";

try {
  const envText = readFileSync("/Users/maxxx/Documents/nextjs-boilerplate-main/.env.local", "utf8");
  // Defensive: einige Keys haengen aneinander ohne Newline. Greife jede KEY=VALUE-Sequenz.
  const envMatches = [...envText.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)];
  for (const m of envMatches) {
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const BREVO_KEY = process.env.BREVO_API_KEY;
if (!ANTHROPIC_KEY || !BREVO_KEY) {
  console.error("ANTHROPIC_API_KEY oder BREVO_API_KEY fehlt");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CUSTOMER_EMAIL = "egloffdaniela@gmail.com";
const RECIPIENT = "max@primesocial.de";
const PLAN_LENGTH = 6;
const WEEKS = PLAN_LENGTH * 4;

// 1) Lead + plan_content holen
const { data: lead } = await sb
  .from("wauwerk_leads")
  .select("answers,dog_name,customer_name,selected_plan")
  .eq("email", CUSTOMER_EMAIL)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
const { data: planRow } = await sb
  .from("member_plan_content")
  .select("dog_name,dog_breed,content,created_at")
  .eq("email", CUSTOMER_EMAIL)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (!lead || !planRow) {
  console.error("Lead oder plan_content nicht gefunden");
  process.exit(1);
}

const answers = lead.answers || {};
const dogName = planRow.dog_name || lead.dog_name || "Iniko";
const dogBreed = planRow.dog_breed || answers.dog_breed || "Mischling";

const PROBLEM_LABELS_DE = {
  pulling: "Leinenziehen",
  barking: "Bellen",
  aggression: "Aggression / Reaktivitaet",
  anxiety: "Trennungsangst",
  recall: "Rueckruf",
  energy: "Energie-Regulierung",
  jumping: "Anspringen",
  destructive: "Zerstoerung im Haushalt",
  soiling: "Stubenreinheit",
  mouthing: "Aufnehmen / Maulen",
};
const dogProblem = answers.dog_problem || "aggression";
const problemLabel = PROBLEM_LABELS_DE[dogProblem] || dogProblem;

// dog_age "adult" → ~36 Monate als Anker
const dogAgeMonths =
  answers.dog_age === "adult" ? 36 :
  answers.dog_age === "puppy" ? 6 :
  answers.dog_age === "senior" ? 96 :
  null;

const zusatzKontextLines = [];
if (answers.dog_breed) zusatzKontextLines.push(`Rasse: ${answers.dog_breed}`);
if (answers.had_training === "yes") zusatzKontextLines.push(`Halter hat schon Trainings-Erfahrung gemacht.`);
if (Array.isArray(answers.dog_commands) && answers.dog_commands.length) zusatzKontextLines.push(`Bekannte Signale: ${answers.dog_commands.join(", ")}`);
if (answers.territorial_aggression === "yes") zusatzKontextLines.push(`Territoriale Aggression: ja (z.B. an der Haustuer, im eigenen Revier).`);
if (Array.isArray(answers.dog_behaviors) && answers.dog_behaviors.length) zusatzKontextLines.push(`Im Quiz angegebene Verhalten: ${answers.dog_behaviors.join(", ")}`);
if (answers.dog_gender) zusatzKontextLines.push(`Geschlecht: ${answers.dog_gender}`);
if (answers.training_time) zusatzKontextLines.push(`Trainingszeit pro Tag (Minuten): ${answers.training_time}`);

const customProblemText =
  typeof answers.custom_problem_text === "string" && answers.custom_problem_text.trim().length > 0
    ? answers.custom_problem_text.trim()
    : undefined;

console.log(`Hund: ${dogName} (${dogBreed}, ~${dogAgeMonths}M), Problem: ${problemLabel}`);
console.log(`Kontext: ${zusatzKontextLines.length} Zeilen`);

// 2) AI-Call (gleicher Prompt wie in lib/plan-intro-ai.ts)
const ageDesc =
  dogAgeMonths != null
    ? dogAgeMonths < 12
      ? `Welpe (${dogAgeMonths} Monate)`
      : dogAgeMonths < 84
        ? `${Math.floor(dogAgeMonths / 12)} Jahre`
        : "Senior"
    : "unbekanntes Alter";

const tempoBriefing = PLAN_LENGTH === 6
  ? `WICHTIG zum Tonfall: 6 Monate sind viel Zeit, und das ist der entscheidende Vorteil. Erwaehne, dass der Halter Raum hat fuer Tiefe statt Tempo, fuer Festigung statt nur Erstkonditionierung, und dass kleine Rueckschritte ohne Stress aufgefangen werden koennen. Ruhig, fast meditativ im Ton.`
  : PLAN_LENGTH === 3
    ? `WICHTIG zum Tonfall: 12 Wochen sind eine entspannte Strecke. Der Halter hat Zeit, jeden Schritt sauber aufzubauen, statt zu hetzen.`
    : `WICHTIG zum Tonfall: 4 Wochen sind kurz und kompakt. Strafer Schnellstart, in dem die wichtigsten Werkzeuge etabliert werden.`;

const systemPrompt = `Du bist erfahrene Hundetrainerin im Pfoten-Plan-Team. Du schreibst ruhige, fachlich saubere und SPUERBAR persoenliche Texte fuer personalisierte Trainingsplaene. Der Halter soll am Text merken, dass jemand wirklich gelesen hat, was er im Quiz geschrieben hat.

STIL-REGELN (sehr wichtig):
- DUZE den Halter durchgehend ("du", "dein", "dich"). NIE siezen.
- KEINE Anrede wie "Liebe Hundehalterin/Hundehalter" am Anfang. Direkt in den Inhalt einsteigen.
- Deutsche Grammatik MUSS sauber sein: "grosses Glueck" (NICHT "grosse Glueck"), Genus + Kasus korrekt.
- Keine Anglizismen, keine Buzzwords, kein Jargon.
- Ruhig, warm, professionell. Nicht aufgeregt oder pathetisch. Kein Werbe-Ton.
- Konkret statt allgemein: lieber 1 konkretes Bild als 3 generische Aussagen.
- Greife konkrete Quiz-Antworten (Problem, Verhalten, Rasse, Alter, Erfahrung des Halters, schon bekannte Signale) im Text woertlich oder paraphrasiert auf.

ZEICHEN-REGELN (sehr wichtig, sonst wirkt es nach KI):
- VERMEIDE Gedankenstriche jeder Art: KEINE em-dash, KEINE en-dash, auch keine doppelten Bindestriche.
- Stattdessen: Komma, Punkt oder kurzer Satz.
- Wenn du eine Pause oder Betonung brauchst: zwei Saetze oder ein Doppelpunkt. Niemals Gedankenstriche.
- Auch keine Klammern fuer Nebenbemerkungen. Lieber direkt sagen.

AUSGABE-FORMAT (zwingend):
Du antwortest mit EINEM EINZIGEN JSON-Objekt, exakt so:
{"einleitung":"...","ziele":"...","abschluss":"..."}
KEINE Markdown-Code-Fence, KEINE Erklaerung davor/danach. Nur das rohe JSON. Newlines in Texten als \\n\\n zwischen Absaetzen.`;

const userPrompt = `Schreibe DREI personalisierte Text-Bloecke fuer den ${PLAN_LENGTH}-Monatsplan dieses Hundes:

HUND:
- Name: ${dogName}
- Rasse: ${dogBreed}
- Alter: ${ageDesc}
- Hauptthema: ${problemLabel}
- Plan-Laenge: ${WEEKS} Wochen

${tempoBriefing}
${customProblemText ? `\nIndividuelle Problem-Beschreibung des Halters (Freitext aus Quiz):\n"${customProblemText}"\n\nDIESER FREITEXT IST DAS WICHTIGSTE MATERIAL. Greife konkrete Details mehrfach auf. Verallgemeinere NICHT.` : ""}
${zusatzKontextLines.length ? `\nWeitere Quiz-Antworten:\n${zusatzKontextLines.join("\n")}` : ""}

BLOCK 1 – "einleitung" (3-4 Absaetze, je 2-4 Saetze, KOMPAKT):
1. Direkter Einstieg mit ${dogName} und konkretem Bild aus den Quiz-Antworten zum Thema ${problemLabel}. Validiere kurz die Situation.
2. Trainings-Logik dahinter in 2-3 Saetzen. Falls die Rasse relevant ist, halber Satz.
3. Wie der Plan das angeht: Phasen-Logik (Fundament drinnen, Steigerung draussen, Generalisierung). Wenn Halter Erfahrung hat: kurz wertschaetzend.
4. Ruhiger Uebergangs-Satz.

BLOCK 2 – "ziele" (3-4 Absaetze, KOMPAKT):
1. Konkretes End-Bild nach ${WEEKS} Wochen.
2. 2-3 Teilziele in einem Absatz (nicht je auf einer Zeile).
3. Was NICHT versprochen wird (1-2 Saetze). Wie sich Erfolg anfuehlt.
4. Ruhige Schlussbemerkung.

BLOCK 3 – "abschluss" (3-4 Absaetze, KOMPAKT, ans ENDE des PDFs):
1. Anerkennung der Leistung. Was sich veraendert haben sollte (Bezug zu ${problemLabel}).
2. Routinen behalten, kleine Auffrischungen. Bei Rueckschlaegen: kurz zurueck, ohne Drama.
3. Mitglieder-Bereich-Coaching erwaehnen. Persoenlicher Schluss-Satz mit ${dogName}s Namen.

WICHTIG: Antworte mit EXAKT EINEM JSON-Objekt mit den drei Keys "einleitung", "ziele", "abschluss". Keine Markdown-Fences, keine Erklaerung. Newlines zwischen Absaetzen als \\n\\n. Texte in normalem Deutsch, keine Anrede vorne, keine Ueberschrift.`;

console.log("AI-Call gestartet (Sonnet 4.6)...");
const t0 = Date.now();
const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": ANTHROPIC_KEY,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  }),
});
if (!aiRes.ok) {
  const t = await aiRes.text();
  console.error("AI-Call fehlgeschlagen:", aiRes.status, t);
  process.exit(1);
}
const aiData = await aiRes.json();
const rawText = (aiData.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
console.log(`AI fertig in ${Date.now() - t0}ms — ${rawText.length} chars`);

function sanitize(s) {
  return String(s)
    .replace(/\s—\s/g, ", ")
    .replace(/\s–\s/g, ", ")
    .replace(/—/g, ",")
    .replace(/–/g, ",")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/[→➔➜⇒]/g, ":")
    .replace(/[←⇐]/g, "")
    .replace(/[↑↓]/g, "")
    .replace(/[•●◦▪▫]/g, "-")
    .replace(/[✓✔]/g, "ok")
    .replace(/[✗✘×]/g, "x")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .trim();
}

const jsonStart = rawText.indexOf("{");
const jsonEnd = rawText.lastIndexOf("}");
const parsed = JSON.parse(jsonStart >= 0 && jsonEnd > jsonStart ? rawText.slice(jsonStart, jsonEnd + 1) : rawText);
const einleitung = sanitize(parsed.einleitung);
const ziele = sanitize(parsed.ziele);
const abschluss = sanitize(parsed.abschluss);

console.log(`Einleitung: ${einleitung.length} chars, ${einleitung.split(/\n\n+/).length} Absaetze`);
console.log(`Ziele: ${ziele.length} chars, ${ziele.split(/\n\n+/).length} Absaetze`);
console.log(`Abschluss: ${abschluss.length} chars, ${abschluss.split(/\n\n+/).length} Absaetze`);

// 3) plan_content patchen
const patchedPlan = {
  ...planRow.content,
  intro: {
    ...(planRow.content.intro || {}),
    einleitung,
    ziele,
  },
  abschluss,
};
writeFileSync("/tmp/iniko-plan-patched.json", JSON.stringify(patchedPlan, null, 2));
console.log("Plan-Content gepatcht und in /tmp/iniko-plan-patched.json gespeichert.");

// 4) PDF rendern mit dem aktuellen Generator-Code
const { buildPdfFromContent } = await import("./generate-plan-from-content.mjs");
const pdfBytes = await buildPdfFromContent({
  plan: patchedPlan,
  dogName,
  dogBreed,
  mainProblem: problemLabel,
  planLengthMonths: PLAN_LENGTH,
  verbose: false,
});
const PDF_PATH = "/Users/maxxx/Documents/nextjs-boilerplate-main/public/monatsplan-personalisiert-TEST.pdf";
writeFileSync(PDF_PATH, pdfBytes);
console.log(`PDF geschrieben: ${(pdfBytes.length / 1024).toFixed(0)} KB`);

// 5) Mail an Max
const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <h2 style="margin:0 0 16px;color:#241714;">Test-PDF: Inikos 6-Monatsplan mit neu personalisierten Texten</h2>
  <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#4B5563;">
    Im Anhang das aktualisierte 6M-PDF: AI generiert jetzt drei Bloecke (Einleitung, Trainingsziel, Abschluss) statt nur die Einleitung. Texte sind laenger und greifen die Quiz-Antworten konkret auf.
  </p>
  <ul style="font-size:13px;line-height:1.7;color:#4B5563;padding-left:18px;">
    <li>Einleitung: ${einleitung.split(/\n\n+/).length} Absaetze, ${einleitung.length} Zeichen</li>
    <li>Trainingsziel: ${ziele.split(/\n\n+/).length} Absaetze, ${ziele.length} Zeichen</li>
    <li>Abschluss: ${abschluss.split(/\n\n+/).length} Absaetze, ${abschluss.length} Zeichen</li>
    <li>Quiz-Daten genutzt: Problem=${problemLabel}, Rasse=${dogBreed}, territoriale Aggression=ja, Halter-Erfahrung=ja</li>
  </ul>
  <p style="margin:16px 0 0;font-size:13px;color:#6B7280;">
    Inhalt von Inikos echtem Plan (egloffdaniela@gmail.com aus DB). Kundin bekommt NICHTS.
  </p>
</div>`;

const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    sender: { name: "Pfoten-Plan Layout-Review", email: "support@pfoten-plan.de" },
    replyTo: { email: "support@pfoten-plan.de", name: "Pfoten-Plan Support" },
    to: [{ email: RECIPIENT }],
    subject: "🐾 Test: Inikos 6M-Plan (laengere personalisierte Intro/Ziele/Abschluss)",
    htmlContent: html,
    tags: ["admin-test", "plan-personalization-v2"],
    attachment: [{ name: "Pfoten-Plan-Iniko-6M-v2.pdf", content: Buffer.from(pdfBytes).toString("base64") }],
  }),
});
console.log(`Brevo: HTTP ${brevoRes.status}`);
console.log(await brevoRes.text());
if (!brevoRes.ok) process.exit(1);
console.log(`\n✓ Mail mit personalisiertem PDF an ${RECIPIENT} raus.`);
