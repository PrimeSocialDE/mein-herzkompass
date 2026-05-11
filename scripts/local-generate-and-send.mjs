// Lokaler Vollflow: Plan generieren via Claude + in DB speichern +
// Mail an Kunde mit Auto-Login schicken. Umgeht Vercel/Cloudflare-
// Timeouts (12-Wochen-Plan dauert ~60-90s Claude).
//
// Nutzt direkt:
//   - Anthropic SDK (keine Auth-Hop nötig)
//   - Supabase Service-Role (direkter DB-Insert)
//   - Brevo REST API (direkter Mail-Versand)
//
// Aufruf:
//   node scripts/local-generate-and-send.mjs <email>
//   node scripts/local-generate-and-send.mjs <email> --months 6 --force
//   node scripts/local-generate-and-send.mjs <email> --no-mail

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

try {
  const envText = readFileSync(".env.local", "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const email = (process.argv[2] || "").trim().toLowerCase();
const force = process.argv.includes("--force");
const noMail = process.argv.includes("--no-mail");
const monthsIdx = process.argv.indexOf("--months");
const monthsArg =
  monthsIdx >= 0 && process.argv[monthsIdx + 1]
    ? Number(process.argv[monthsIdx + 1])
    : null;

if (!email) {
  console.error("Usage: node scripts/local-generate-and-send.mjs <email> [--months 1|3|6] [--force] [--no-mail]");
  process.exit(1);
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.pfoten-plan.de"
).replace(/\/+$/, "");

if (!SUPABASE_URL || !SERVICE_ROLE || !ANTHROPIC_API_KEY) {
  console.error("FEHLT: SUPABASE_URL/SERVICE_ROLE/ANTHROPIC_API_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

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

function planLengthFromSelected(p) {
  const s = (p || "").toLowerCase().trim();
  if (s.startsWith("1")) return 1;
  if (s.startsWith("6")) return 6;
  return 3;
}

function buildPhases(weeks) {
  if (weeks <= 4)
    return [
      { range: "Woche 1", thema: "Grundlagen + Alltagsstruktur aufbauen" },
      { range: "Woche 2", thema: "Impulskontrolle + erste Kernuebungen" },
      { range: "Woche 3", thema: "Hauptthema systematisch angehen" },
      { range: "Woche 4", thema: "Stabilisierung + Alltagstauglichkeit" },
    ];
  if (weeks <= 12)
    return [
      { range: "Woche 1-4", thema: "Grundlagen + Alltagsstruktur" },
      { range: "Woche 5-8", thema: "Hauptthema in Tiefe + erste Begegnungen" },
      { range: "Woche 9-12", thema: "Generalisierung + Stabilisierung" },
    ];
  return [
    { range: "Woche 1-4", thema: "Fundament: Vertrauen, Ruhe-Rituale, Grundlagen-Signale" },
    { range: "Woche 5-8", thema: "Hauptthema einfuehren in reizarmer Umgebung" },
    { range: "Woche 9-12", thema: "Erste echte Alltagssituationen + leichte Reize" },
    { range: "Woche 13-16", thema: "Schwierigere Situationen, Begegnungen, mehr Ablenkung" },
    { range: "Woche 17-20", thema: "Generalisierung in neue Orte + Reizkombinationen" },
    { range: "Woche 21-24", thema: "Stabilisierung + Langzeit-Routinen + Rueckfallplan" },
  ];
}

function buildSystemPrompt(weeks, months, phases) {
  const phaseLines = phases.map((p) => `   - ${p.range}: ${p.thema}`).join("\n");
  const monatsSpec = `  "monats_uebersichten": [\n${Array.from(
    { length: months },
    (_, i) => `    { "monat": ${i + 1}, "text": "3-4 Absätze für Monat ${i + 1}." }`
  ).join(",\n")}\n  ],`;

  return `Du bist erfahrene Hundetrainerin im Pfoten-Plan-Team und erstellst personalisierte ${months}-Monats-Trainingspläne (${weeks} Wochen) für Hundehalter zwischen 35 und 55 Jahren. Dein Schreibstil ist ruhig, klar und ohne Jargon — keine Anglizismen, keine Buzzwords.

Du gibst deinen Plan AUSSCHLIESSLICH als valides JSON zurück — kein Markdown, kein Vorspann, kein Nachspann.

{
  "intro": {
    "headline": "${months}-Monatsplan für <Hundename>",
    "einleitung": "3-4 Absätze mit \\n\\n Trennung.",
    "ziele": "3-4 Absätze.",
    "aufbau": "3-4 Absätze."
  },
  "weeks": [
    {
      "num": 1,
      "title": "Kurzer Wochen-Titel max 4 Wörter",
      "wochenziele": ["Ziel 1 mit Hundenamen.", "...5 Ziele insgesamt"],
      "tagesplan": "2 Absätze.",
      "no_gos": ["...6 Stichpunkte max 6 Wörter"],
      "fortschritt": ["...5 Indikatoren, Verb in Grundform"],
      "uebungen": [
        { "name": "Übungs-Titel", "schritte": ["...8 Schritte"] },
        { "name": "Zweite Übung", "schritte": ["...8 Schritte"] }
      ]
    }
  ],
${monatsSpec}
  "abschluss": "3-4 Absätze.",
  "zusatz_spiele": [
    { "nummer": 1, "name": "...", "ziel": "1 Satz", "schritte": ["...8 Schritte"], "warum": "1-2 Sätze." }
  ]
}

LEITPLANKEN:
1. Roter Faden über ${weeks} Wochen, Phasen:
${phaseLines}
2. Hundename in jeder Woche mehrfach.
3. Konkrete Schritte, keine vagen Anweisungen.
4. Trainingszeit respektieren.
5. Bei Aggression/Angst: kein Druck, Distanz + positive Verknüpfung.
6. Bekannte Signale nutzen statt von Null.
7. No-Gos = harte Stichpunkte.
8. Fortschritt = Verben Grundform.
9. 40-50+ Tonfall, Du-Anrede.

Validiere: JSON valide, GENAU ${weeks} Wochen (num 1-${weeks}), ${months} monats_uebersichten, mind 3 zusatz_spiele.`;
}

function buildUserPrompt(input, weeks, months) {
  const problemLabel =
    PROBLEM_LABELS[input.dog_problem] || input.dog_problem;
  return `Erstelle einen ${months}-Monats-Trainingsplan (${weeks} Wochen) für:

Hundename: ${input.dog_name}
Rasse: ${input.dog_breed || "Mischling mittel"}
Alter: ${input.dog_age || "erwachsen"}
Hauptthema: ${problemLabel}
Bekannte Signale: ${(input.bekannte_signale || []).join(", ") || "keine"}
Tägliche Trainingszeit: ${input.trainingszeit_minuten || 15} Minuten

Gib NUR das JSON zurück.`;
}

// ── 1) Lead holen ─────────────────────────────────────────────────────
console.log(`\n→ Hole Lead-Daten fuer ${email}...`);
const { data: lead, error: leadErr } = await sb
  .from("wauwerk_leads")
  .select("id, email, customer_name, dog_name, answers, selected_plan, status, paid_at")
  .ilike("email", email)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (leadErr || !lead) {
  console.error("✗ Lead nicht gefunden:", leadErr?.message);
  process.exit(1);
}
if (lead.status !== "paid") {
  console.error(`✗ Lead nicht paid (status: ${lead.status})`);
  process.exit(1);
}

const answers = lead.answers || {};
const dogName = lead.dog_name || "Bruno";
const dogProblem = answers.dog_problem || answers.problem || "pulling";
const monthsTotal =
  monthsArg && [1, 3, 6].includes(monthsArg)
    ? monthsArg
    : planLengthFromSelected(lead.selected_plan);
const weeksTotal = monthsTotal * 4;

console.log(`  Hund: ${dogName} · Problem: ${PROBLEM_LABELS[dogProblem] || dogProblem}`);
console.log(`  Plan-Länge: ${monthsTotal} Monate (${weeksTotal} Wochen)`);

// ── 2) Existierender Plan? ────────────────────────────────────────────
if (!force) {
  const { data: existing } = await sb
    .from("member_plan_content")
    .select("id, created_at")
    .ilike("email", email)
    .eq("plan_slug", "trainingsplan")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    console.error(`✗ Plan existiert bereits (${existing.id}). Nutze --force zum Überschreiben.`);
    process.exit(1);
  }
}

// ── 3) Claude generieren ──────────────────────────────────────────────
console.log(`\n→ Claude arbeitet... (kann 30-120s dauern)`);
const phases = buildPhases(weeksTotal);
const systemPrompt = buildSystemPrompt(weeksTotal, monthsTotal, phases);
const userPrompt = buildUserPrompt(
  {
    dog_name: dogName,
    dog_breed: answers.dog_breed,
    dog_age: answers.dog_age,
    dog_problem: dogProblem,
    bekannte_signale: answers.dog_commands || answers.bekannte_signale,
    trainingszeit_minuten: answers.trainingszeit_minuten || 15,
  },
  weeksTotal,
  monthsTotal
);

const maxTokens = weeksTotal <= 4 ? 6000 : weeksTotal <= 12 ? 16000 : 32000;
const started = Date.now();

const resp = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: maxTokens,
  system: systemPrompt,
  messages: [{ role: "user", content: userPrompt }],
});

const text = resp.content
  .filter((c) => c.type === "text")
  .map((c) => c.text)
  .join("");

let plan;
try {
  const fenceMatch = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  plan = JSON.parse(fenceMatch ? fenceMatch[1] : text.trim());
} catch (e) {
  console.error("✗ JSON-Parse fehlgeschlagen:", e.message);
  console.error("Erste 500 Zeichen:", text.slice(0, 500));
  process.exit(1);
}

if (!Array.isArray(plan.weeks) || plan.weeks.length === 0) {
  console.error("✗ Plan-Schema ungueltig");
  process.exit(1);
}

const ms = Date.now() - started;
const inTokens = resp.usage?.input_tokens || 0;
const outTokens = resp.usage?.output_tokens || 0;
const costUsd = (inTokens / 1e6) * 3 + (outTokens / 1e6) * 15;
console.log(`  ✓ Plan generiert in ${(ms / 1000).toFixed(1)}s`);
console.log(`  Wochen: ${plan.weeks.length} · Tokens: ${inTokens} in / ${outTokens} out · ~$${costUsd.toFixed(3)}`);

// ── 4) In member_plan_content speichern ───────────────────────────────
console.log(`\n→ Speichere in member_plan_content...`);
const { data: member } = await sb
  .from("member_users")
  .select("id")
  .ilike("email", email)
  .maybeSingle();

const { data: inserted, error: insErr } = await sb
  .from("member_plan_content")
  .insert({
    user_id: member?.id || null,
    email: email,
    plan_slug: "trainingsplan",
    plan_title: `${monthsTotal}-Monats-Trainingsplan für ${dogName}`,
    content: plan,
    pdf_url: null,
    dog_name: dogName,
    dog_breed: answers.dog_breed || null,
    source: "local-claude-script",
    source_payment_id: lead.id,
  })
  .select("id")
  .single();

if (insErr) {
  console.error("✗ Insert fehlgeschlagen:", insErr.message);
  process.exit(1);
}
console.log(`  ✓ Plan-Content angelegt: ${inserted.id}`);

// ── 5) Mail senden ────────────────────────────────────────────────────
if (noMail) {
  console.log("\n→ Mail uebersprungen (--no-mail)");
  console.log(`\nFertig. Web-Plan: ${SITE_URL}/mitglieder/erfolge/coaching\n`);
  process.exit(0);
}

if (!BREVO_API_KEY) {
  console.warn("\n⚠ BREVO_API_KEY fehlt — Mail nicht gesendet");
  process.exit(0);
}

console.log(`\n→ Erstelle Auto-Login-Link...`);
// User in auth.users sicherstellen
try {
  await sb.auth.admin.createUser({ email, email_confirm: true });
} catch {}

const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: {
    redirectTo: `${SITE_URL}/mitglieder/callback?next=/mitglieder/erfolge/coaching`,
  },
});

let ctaUrl = `${SITE_URL}/mitglieder/login?email=${encodeURIComponent(email)}`;
const hashedToken = linkData?.properties?.hashed_token;
if (hashedToken) {
  const params = new URLSearchParams({
    token_hash: hashedToken,
    type: "magiclink",
    next: "/mitglieder/erfolge/coaching",
  });
  ctaUrl = `${SITE_URL}/mitglieder/callback?${params.toString()}`;
  console.log("  ✓ Magic-Link erstellt");
} else {
  console.warn("  ⚠ Magic-Link-Generation fehlgeschlagen — Fallback auf /login:", linkErr?.message);
}

console.log(`\n→ Sende Mail an ${email}...`);
const week1 = plan.weeks[0];
const monthsLabel = `${monthsTotal}-Monats-Plan`;
const escape = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const week1Preview = week1
  ? `<div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;padding:16px 18px;margin:12px 0 20px;">
       <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8B7355;">Woche 1 · ${escape(week1.title)}</p>
       <ul style="margin:8px 0 0;padding-left:18px;">${(week1.wochenziele || [])
         .slice(0, 3)
         .map((z) => `<li style="margin:4px 0;font-size:13px;color:#4B5563;line-height:1.5;">${escape(z)}</li>`)
         .join("")}</ul>
       <p style="margin:10px 0 0;font-size:12px;color:#8B7355;font-style:italic;">+ ${plan.weeks.length - 1} weitere Wochen, ${plan.weeks.reduce((s, w) => s + (w.uebungen?.length || 0), 0)} konkrete Übungen, Monats-Übersichten und Bonus-Spiele.</p>
     </div>`
  : "";

const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>Dein ${monthsLabel} für ${escape(dogName)}</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:24px 28px 8px;border-bottom:1px solid #F0EBE3;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">Pfoten-Plan</p>
      </td></tr>
      <tr><td style="padding:28px 28px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;font-weight:800;color:#1a1a1a;">Dein ${monthsLabel} für ${escape(dogName)} ist fertig</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#4B5563;">Hi, dein persönlicher Trainings-Plan ist soeben erstellt worden — komplett zugeschnitten auf ${escape(dogName)} und euer Haupt-Thema. ${plan.weeks.length} Wochen, mit konkreten Übungen für jeden Tag, Wochenzielen, Fortschritts-Markern und einem klaren roten Faden.</p>
        ${week1Preview}
        <p style="margin:0 0 8px;font-size:13px;color:#4B5563;line-height:1.55;">Im Mitglieder-Bereich kannst du den ganzen Plan durchklicken, Woche für Woche.</p>
      </td></tr>
      <tr><td align="center" style="padding:8px 28px 28px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#C4A576;color:#FFFFFF;font-weight:700;font-size:14px;padding:14px 26px;border-radius:12px;text-decoration:none;box-shadow:0 2px 8px rgba(196,165,118,0.3);">Plan ansehen</a>
      </td></tr>
      <tr><td style="padding:0 28px 24px;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#9CA3AF;text-align:center;">Der Button enthält einen Einmal-Login — du landest direkt eingeloggt im Mitglieder-Bereich. Der Link gilt 1 Stunde.</p>
      </td></tr>
      <tr><td style="padding:16px 28px;background:#FAFAFA;border-top:1px solid #F0EBE3;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#9CA3AF;text-align:center;">Pfoten-Plan · Persönliches Hundetraining · <a href="${SITE_URL}/mitglieder" style="color:#8B7355;text-decoration:underline;">Mein Bereich</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
    replyTo: { email: "support@pfoten-plan.de", name: "Pfoten-Plan Support" },
    to: [{ email }],
    subject: `🐾 Dein ${monthsLabel} für ${dogName} ist da`,
    htmlContent: html,
    tags: ["mitglieder", "plan-ready", "local-script"],
  }),
});

if (!brevoRes.ok) {
  const txt = await brevoRes.text();
  console.error("✗ Brevo-Fehler:", brevoRes.status, txt);
  process.exit(1);
}
console.log("  ✓ Mail gesendet");

console.log(`\nFertig.`);
console.log(`  Web-Plan: ${SITE_URL}/mitglieder/erfolge/coaching`);
console.log(`  Mail-CTA: ${ctaUrl.slice(0, 80)}...`);
console.log();
