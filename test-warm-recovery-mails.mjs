// Sendet alle 5 Warm-Recovery-Stages als Test an max@primesocial.de.
// Replikiert exakt was lib/warm-recovery-mail.ts macht — Updates dort
// muessen hier nachgezogen werden (Test bleibt deckungsgleich).

import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const BREVO_KEY = process.env.BREVO_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SITE_URL = "https://www.pfoten-plan.de";

const TEST = {
  to: "max@primesocial.de",
  dogName: "Bruno",
  dogBreed: "Husky-Mix",
  dogAge: "adult",
  dogProblem: "recall",
  customProblem: null,
  selectedPlan: "3month",
  leadId: "test-warm-recovery-" + Date.now(),
  abVariant: "A",
};

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

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPlanRecoveryUrl(stage, withPromo) {
  const variant = TEST.abVariant === "B" ? "deinplan6.html" : "deinplan3.html";
  const params = new URLSearchParams({
    recover: TEST.leadId,
    s: "test-signature",
    utm_source: "email",
    utm_medium: "drip",
    utm_campaign: "warm-recovery",
    utm_content: `stage-${stage}`,
  });
  if (withPromo) params.set("promo", "warm15");
  return `${SITE_URL}/${variant}?${params.toString()}`;
}

async function generatePersonalizedBlock(stage) {
  if (!ANTHROPIC_KEY) return null;
  const dog = TEST.dogName;
  const breed = TEST.dogBreed;
  const age = TEST.dogAge;
  const problem = PROBLEM_LABELS[TEST.dogProblem] || "Verhaltensproblem";

  const stagePrompt = {
    1: `Schreibe 3 sachliche, ruhige Sätze (max 80 Wörter total) für eine erste Erinnerungs-Mail. Ton: respektvoll, kompetent, wie eine ausgebildete Trainerin. KEIN "Hey", KEIN umgangssprachliches "klar" oder "easy". KEIN Verkaufsdruck. Eher: konkret erklären woran es bei diesem Hund-Profil typisch hakt (Rasse + Alter berücksichtigen). Nenne einen Aspekt der Vertrauen schafft (z.B. dass das Problem trainierbar ist).`,
    2: `Schreibe eine kurze, authentische Story (70-100 Wörter) über einen fiktiven anderen Hund mit ähnlichem Profil und gleichem Problem. Vorher → Nachher in konkreten 4 Wochen. Erfinde plausible Namen (Hundename + Besitzer-Vorname). KEIN "Hey", keine Umgangssprache. Schreib wie eine kurze Erfolgsgeschichte aus dem Trainer-Alltag — sachlich, aber emotional verständlich. Schluss-Satz: was die Halterin daran lernte.`,
    3: `Schreibe einen persönlichen Trainer-Absatz (70-100 Wörter) in Ich-Form. Wie eine ausgebildete Hundetrainerin (40+) die einen Brief schreibt. Kompetent, empathisch, kein Verkaufsdruck. Nenne 1 konkrete Übung die zum Problem passt und heute machbar ist (5-10 Min, ohne Ausrüstung). KEIN "Hey" oder Slang.`,
    4: `Schreibe 3 häufige Fragen + sachliche kurze Antworten (90-130 Wörter total) zu diesem Problem. Format: "Frage? Antwort." (Frage fett im html später). Fokus auf die Sorgen einer 40+ Halterin: Funktioniert das bei meiner Rasse? Wie viel Zeit brauche ich pro Tag? Was wenn der Hund nicht mitmacht? Antworten konkret, nicht werbe-typisch.`,
    5: `Schreibe 2-3 Sätze (max 60 Wörter) Last-Call-Ton: sachlich-warm. "Falls Sie sich anders entschieden haben — verständlich." Aber: eine letzte Erinnerung dass der Plan einmalig 15% günstiger verfügbar ist. Erwähne die 30-Tage-Garantie. KEIN "Hey", kein Slang.`,
  };

  const prompt = `Zielgruppe: deutsche Hundebesitzer, vorwiegend 35-55 Jahre, suchen seriöse Hilfe bei Hundeerziehung. Sprache: sachlich, ruhig, kompetent. KEIN Slang, KEIN "Hey", KEIN "easy/cool/checken".

Hund: ${dog} (${breed}, ${age})
Hauptproblem: ${problem}
Plan ausgewählt: ${TEST.selectedPlan}

${stagePrompt[stage]}

WICHTIG:
- Schreibe NUR den Block selbst, KEINE Anrede ("Hallo X"), KEINE Grußformel, KEIN "Hier ist".
- Du-Form (nicht Sie), aber respektvoll und ruhig.
- Erwähne ${dog} bei Namen wenn passend.
- Output: nur der Text, kein Markdown, keine Anführungszeichen drumherum.
- KEINE Wörter wie "Hey", "easy", "checken", "klar", "auf jeden Fall".`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      console.warn(`[Claude ${stage}] HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return null;
    }
    const data = await r.json();
    const text = (data.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();
    return text || null;
  } catch (e) {
    console.warn(`[Claude ${stage}] error:`, e.message);
    return null;
  }
}

function formatPersonalizedHtml(text) {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;">${escapeHtml(p)}</p>`
    )
    .join("\n");
}

function getStageContent(stage) {
  const dog = TEST.dogName;
  const problemLabel = PROBLEM_LABELS[TEST.dogProblem] || "Verhaltensthema";

  const whatYouGetBox = `
    <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:10px;padding:16px 18px;margin:18px 0;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#8B7355;">Was du für ${escapeHtml(dog)} bekommst</p>
      <p style="margin:0 0 6px;font-size:14px;color:#1a1a1a;line-height:1.55;">📄 <strong>Persönlicher Trainings-Plan als PDF</strong> — zum Herunterladen und Ausdrucken</p>
      <p style="margin:0 0 6px;font-size:14px;color:#1a1a1a;line-height:1.55;">🐾 <strong>Dein Mitglieder-Dashboard</strong> mit täglichen Übungen, Fortschritts-Tracking und Wochen-Challenges</p>
      <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.55;">💬 <strong>Trainer-Chat</strong> bei Fragen — du bist nicht allein</p>
    </div>`;

  const compareBox = `
    <div style="background:#F8F8F8;border-radius:10px;padding:14px 16px;margin:16px 0;font-size:13.5px;color:#1a1a1a;line-height:1.55;">
      <p style="margin:0 0 8px;font-weight:700;color:#8B7355;">Im Vergleich zur Hundeschule</p>
      <p style="margin:0 0 4px;">🏫 Hundeschule: 60–100 € pro Stunde · feste Termine · meist Gruppentraining</p>
      <p style="margin:0;">📋 Pfoten-Plan: einmalig ab 30 € · 12 Wochen Inhalt · individuell für ${escapeHtml(dog)} · in deinem Tempo</p>
    </div>`;

  switch (stage) {
    case 1:
      return {
        subject: `Eine Frage zu ${dog}s Trainingsplan?`,
        preheader: `Wir helfen gerne — falls etwas unklar ist.`,
        headline: `Vielleicht ist noch etwas offen`,
        intro: `Hallo, du hattest den Plan für ${escapeHtml(dog)} schon ausgewählt, bist aber im Checkout nicht weitergekommen. Falls noch eine Frage offen ist — antworte einfach auf diese Mail, wir lesen jede persönlich.`,
        defaultBlock: `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;">${problemLabel} ist eines der häufigsten Themen, mit dem unsere Mitglieder zu uns kommen — und in den meisten Fällen lässt sich daran sehr gut arbeiten. Der Plan ist genau auf ${escapeHtml(dog)}s Profil zugeschnitten.</p>${whatYouGetBox}`,
        ctaText: `Plan für ${dog} ansehen`,
        footerHint: `Diese Mail kommt einmalig. Wenn du nichts machst, hörst du nur dann wieder von uns, wenn wir dir mit einer kurzen Story oder Frage helfen können.`,
      };
    case 2:
      return {
        subject: `Wie eine andere Halterin das gleiche Thema gelöst hat`,
        preheader: `Eine kurze Geschichte aus dem Trainer-Alltag.`,
        headline: `Eine Geschichte, die zu ${escapeHtml(dog)} passt`,
        intro: `Hallo, wir bekommen oft Mails von Mitgliedern, die am gleichen Punkt waren wie du jetzt. Hier eine kurze Geschichte mit einem Hund, dessen Profil ${escapeHtml(dog)} ähnelt:`,
        defaultBlock: `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;font-style:italic;border-left:3px solid #C4A576;padding-left:14px;">„Wir dachten lange, das gehört zu seinem Charakter. Nach gut vier Wochen mit dem Plan war ${problemLabel} kein Streitpunkt mehr — sondern Routine. Was geholfen hat: die klaren Übungen, die wir täglich kurz machen konnten."</p><p style="margin:0;font-size:14px;color:#6B7280;line-height:1.5;">— Halterin von Bruno (Husky-Mix, 4 Jahre)</p>`,
        ctaText: `Plan jetzt starten`,
      };
    case 3:
      return {
        subject: `Ein Brief von uns zu ${escapeHtml(dog)}`,
        preheader: `Persönlich von unserer Trainerin — kein Marketing.`,
        headline: `Ein paar persönliche Zeilen`,
        intro: `Hallo, das hier ist kein Werbe-Mail — eher ein kurzer Brief. Wir haben in den letzten Jahren mit tausenden Hunden gearbeitet, und das Thema mit ${escapeHtml(dog)} kennen wir gut.`,
        defaultBlock: `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;">Was viele unterschätzen: ${problemLabel} lässt sich fast immer in 4 bis 12 Wochen sichtbar verändern, wenn man konsistent dranbleibt. Du brauchst keine Vorkenntnisse — der Plan führt dich Schritt für Schritt, mit 10-Minuten-Übungen pro Tag.</p><p style="margin:0;font-size:14px;color:#6B7280;">— Pfoten-Plan Trainer-Team</p>${compareBox}`,
        ctaText: `Plan ansehen`,
      };
    case 4:
      return {
        subject: `Die häufigsten Fragen zu unserem Trainingsplan`,
        preheader: `Falls du noch unsicher bist — hier alle Antworten.`,
        headline: `Was Halter:innen uns am häufigsten fragen`,
        intro: `Hallo, bevor du dich entscheidest, hier die häufigsten Fragen unserer Mitglieder — gerade von denen, die schon länger mit ${problemLabel} unterwegs sind:`,
        defaultBlock: `${whatYouGetBox}
          <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#1a1a1a;"><strong>Funktioniert das auch bei meiner Rasse?</strong><br>Ja. Der Plan wird individuell nach Rasse, Alter und konkretem Verhalten von ${escapeHtml(dog)} zusammengestellt — keine Standard-Vorlage.</p>
          <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#1a1a1a;"><strong>Wie viel Zeit brauche ich pro Tag?</strong><br>10 bis 20 Minuten reichen. Die Übungen sind so aufgebaut, dass sie in den Alltag passen.</p>
          <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#1a1a1a;"><strong>Was wenn ${escapeHtml(dog)} nicht mitmacht?</strong><br>Genau dafür gibt es den Trainer-Chat im Mitglieder-Dashboard. Du bist nicht allein.</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#1a1a1a;"><strong>Was wenn es trotzdem nichts wird?</strong><br>30 Tage Geld zurück. Ohne Diskussion. Eine kurze Mail reicht.</p>`,
        ctaText: `Plan jetzt holen`,
      };
    case 5:
      return {
        subject: `Letzte Nachricht — 15% auf ${dog}s Plan`,
        preheader: `Danach hörst du nichts mehr von uns.`,
        headline: `Eine letzte Erinnerung`,
        intro: `Hallo, falls du dich gegen den Plan entschieden hast — verständlich, das ist völlig ok. Aber falls du nochmal überlegst:`,
        defaultBlock: `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;">Heute und morgen ist der Plan für ${escapeHtml(dog)} mit <strong>15% Rabatt</strong> verfügbar. Plus die 30-Tage-Geld-zurück-Garantie wie immer. Du kannst ihn jederzeit zurückgeben, wenn er nicht passt.</p>${compareBox}`,
        ctaText: `Mit 15% sichern`,
        footerHint: `Das ist die letzte Mail dieser Sequenz. Wenn du nicht reagierst, hörst du nichts mehr von uns.`,
      };
  }
}

function wrapTemplate(opts) {
  const { preheader, headline, intro, bodyHtml, ctaText, ctaUrl, footerHint } = opts;
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>${headline}</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<span style="display:none;font-size:1px;color:#FAF8F5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:24px 28px 8px;border-bottom:1px solid #F0EBE3;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">Pfoten-Plan</p>
      </td></tr>
      <tr><td style="padding:28px 28px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;font-weight:800;color:#1a1a1a;">${headline}</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#4B5563;">${intro}</p>
        ${bodyHtml}
      </td></tr>
      <tr><td align="center" style="padding:8px 28px 28px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#C4A576;color:#FFFFFF;font-weight:700;font-size:14px;padding:14px 26px;border-radius:12px;text-decoration:none;box-shadow:0 2px 8px rgba(196,165,118,0.3);">${ctaText}</a>
      </td></tr>
      ${footerHint ? `<tr><td style="padding:0 28px 24px;"><p style="margin:0;font-size:12px;line-height:1.5;color:#9CA3AF;text-align:center;">${footerHint}</p></td></tr>` : ""}
      <tr><td style="padding:16px 28px;background:#FAFAFA;border-top:1px solid #F0EBE3;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#9CA3AF;text-align:center;">Pfoten-Plan · Persönliches Hundetraining</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

async function sendStage(stage) {
  console.log(`\n=== Stage ${stage} ===`);
  const stageContent = getStageContent(stage);
  const ctaUrl = buildPlanRecoveryUrl(stage, stage === 5);

  let personalizedHtml;
  let aiUsed = false;
  console.log(`  → KI-Personalisierung...`);
  const aiText = await generatePersonalizedBlock(stage);
  if (aiText) {
    personalizedHtml = formatPersonalizedHtml(aiText);
    aiUsed = true;
    console.log(`  ✓ Claude generierte ${aiText.length} chars`);
    console.log(`  Preview: ${aiText.slice(0, 140).replace(/\n/g, " ")}...`);
  } else {
    personalizedHtml = stageContent.defaultBlock;
    console.log(`  ⚠ Fallback auf Default-Block`);
  }

  const guaranteeBox = `
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:14px 16px;margin:18px 0 4px;">
      <p style="margin:0;font-size:13px;color:#166534;line-height:1.5;">
        <strong>✓ Kein Abo · Einmalzahlung · 30 Tage Geld-zurück.</strong> Du verlierst nichts.
      </p>
    </div>`;

  const bodyHtml = `${personalizedHtml}${stage >= 3 ? guaranteeBox : ""}`;

  const html = wrapTemplate({
    preheader: stageContent.preheader,
    headline: stageContent.headline,
    intro: stageContent.intro,
    bodyHtml,
    ctaText: stageContent.ctaText,
    ctaUrl,
    footerHint: stageContent.footerHint,
  });

  console.log(`  → Sende via Brevo an ${TEST.to}...`);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_KEY, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan (TEST)", email: "info@pfoten-plan.de" },
      to: [{ email: TEST.to, name: "Test" }],
      subject: `[TEST Stage ${stage}] ${stageContent.subject}`,
      htmlContent: html,
      tags: ["warm-recovery-test", `stage-${stage}`],
    }),
  });
  if (res.ok) {
    const j = await res.json();
    console.log(`  ✓ gesendet: ${j.messageId}`);
  } else {
    const txt = await res.text();
    console.log(`  ❌ Brevo error ${res.status}: ${txt.slice(0, 200)}`);
  }
}

console.log(`\n🐾 Sende alle 5 Warm-Recovery-Stages an ${TEST.to}`);
console.log(`Test-Hund: ${TEST.dogName} (${TEST.dogBreed}, ${TEST.dogAge}) · Problem: ${PROBLEM_LABELS[TEST.dogProblem]}`);
console.log(`KI-Personalisierung: ${ANTHROPIC_KEY ? "ON ✓" : "OFF (kein ANTHROPIC_API_KEY in .env.local)"}\n`);
for (const stage of [1, 2, 3, 4, 5]) {
  await sendStage(stage);
  await new Promise((r) => setTimeout(r, 1500));
}
console.log(`\n✓ Alle 5 Stages gesendet. Check dein Inbox (${TEST.to}).`);
