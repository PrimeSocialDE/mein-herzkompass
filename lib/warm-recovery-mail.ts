// 5-Mail-Warm-Recovery-Drip fuer User die im Checkout abgebrochen haben
// (status=pending oder status=failed). Hochpersonalisiert basierend auf
// dog_name, dog_breed, dog_problem — Claude Haiku generiert einen
// einzigartigen 3-5-Saetze-Block pro Mail.
//
// Stages:
//   1) +2h   — Soft reminder + dog_problem-Bezug + Reply-Aufforderung
//   2) +24h  — Story von einem aehnlichen Hund (Social Proof)
//   3) +72h  — Persoenlicher Trainer-Brief mit Foto
//   4) +5d   — Diagnose / FAQ rund um dog_problem
//   5) +7d   — Last-Call + 15% Discount (Stop nach dieser Mail)
//
// Bei Conversion zu paid: Brevo-Webhook entfernt aus Warm-Recovery,
// Cron-Suppression: status != pending/failed → skip.

import "server-only";
import { sendBrevoMail, wrapTemplate, escapeHtml } from "./member-mail";
import { signRecoveryLead } from "./recovery-link";
import Anthropic from "@anthropic-ai/sdk";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://www.pfoten-plan.de";

const PROBLEM_LABELS: Record<string, string> = {
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

export type WarmRecoveryStage = 1 | 2 | 3 | 4 | 5;

export interface WarmRecoveryArgs {
  to: string;
  dogName: string | null;
  dogBreed: string | null;
  dogAge: string | null;
  dogProblem: string | null;
  customProblem: string | null;
  selectedPlan: string | null;
  leadId: string;
  abVariant?: "A" | "B" | null;
}

// Recovery-Link zur richtigen Plan-Page (deinplan3 oder deinplan6 je AB-Variante)
function buildPlanRecoveryUrl(args: WarmRecoveryArgs, stage: WarmRecoveryStage, withPromo = false): string {
  const variant = args.abVariant === "B" ? "deinplan6.html" : "deinplan3.html";
  const params = new URLSearchParams({
    recover: args.leadId,
    s: signRecoveryLead(args.leadId),
    utm_source: "email",
    utm_medium: "drip",
    utm_campaign: "warm-recovery",
    utm_content: `stage-${stage}`,
  });
  if (withPromo) params.set("promo", "warm15");
  return `${SITE_URL}/${variant}?${params.toString()}`;
}

// Claude Haiku — schneller, billig, gut genug fuer kurze Personalisierungsbloecke.
async function generatePersonalizedBlock(
  args: WarmRecoveryArgs,
  stage: WarmRecoveryStage
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const dog = args.dogName?.trim() || "deinem Hund";
  const breed = args.dogBreed?.trim() || "Mischling";
  const age = args.dogAge?.trim() || "erwachsen";
  const problem =
    args.customProblem?.trim() ||
    PROBLEM_LABELS[args.dogProblem || ""] ||
    "Verhaltensproblem";

  const stagePrompt: Record<WarmRecoveryStage, string> = {
    1: `Schreibe 3 sachliche, ruhige Sätze (max 80 Wörter total) für eine erste Erinnerungs-Mail. Ton: respektvoll, kompetent, wie eine ausgebildete Trainerin. KEIN "Hey", KEIN umgangssprachliches "klar" oder "easy". KEIN Verkaufsdruck. Eher: konkret erklären woran es bei diesem Hund-Profil typisch hakt (Rasse + Alter berücksichtigen). Nenne einen Aspekt der Vertrauen schafft (z.B. dass das Problem trainierbar ist).`,
    2: `Schreibe eine kurze, authentische Story (70-100 Wörter) über einen fiktiven anderen Hund mit ähnlichem Profil und gleichem Problem. Vorher → Nachher in konkreten 4 Wochen. Erfinde plausible Namen (Hundename + Besitzer-Vorname). KEIN "Hey", keine Umgangssprache. Schreib wie eine kurze Erfolgsgeschichte aus dem Trainer-Alltag — sachlich, aber emotional verständlich. Schluss-Satz: was die Halterin daran lernte.`,
    3: `Schreibe einen persönlichen Trainer-Absatz (70-100 Wörter) in Ich-Form. Wie eine ausgebildete Hundetrainerin (40+) die einen Brief schreibt. Anrede in der Form "Liebe/r [Name unbekannt → einfach starten ohne Anrede, da Headline+Intro das machen]". Kompetent, empathisch, kein Verkaufsdruck. Nenne 1 konkrete Übung die zum Problem passt und heute machbar ist (5-10 Min, ohne Ausrüstung). KEIN "Hey" oder Slang.`,
    4: `Schreibe 3 häufige Fragen + sachliche kurze Antworten (90-130 Wörter total) zu diesem Problem. Format: "Frage? Antwort." (Frage fett im html später). Fokus auf die Sorgen einer 40+ Halterin: Funktioniert das bei meiner Rasse? Wie viel Zeit brauche ich pro Tag? Was wenn der Hund nicht mitmacht? Antworten konkret, nicht werbe-typisch.`,
    5: `Schreibe 2-3 Sätze (max 60 Wörter) Last-Call-Ton: sachlich-warm. "Falls Sie sich anders entschieden haben — verständlich." Aber: eine letzte Erinnerung dass der Plan einmalig 15% günstiger verfügbar ist. Erwähne die 30-Tage-Garantie. KEIN "Hey", kein Slang.`,
  };

  const prompt = `Zielgruppe: deutsche Hundebesitzer, vorwiegend 35-55 Jahre, suchen seriöse Hilfe bei Hundeerziehung. Sprache: sachlich, ruhig, kompetent. KEIN Slang, KEIN "Hey", KEIN "easy/cool/checken".

Hund: ${dog} (${breed}, ${age})
Hauptproblem: ${problem}
Plan ausgewählt: ${args.selectedPlan || "3month"}

${stagePrompt[stage]}

WICHTIG:
- Schreibe NUR den Block selbst, KEINE Anrede ("Hallo X"), KEINE Grußformel, KEIN "Hier ist".
- Du-Form (nicht Sie), aber respektvoll und ruhig.
- Erwähne ${dog} bei Namen wenn passend.
- Output: nur der Text, kein Markdown, keine Anführungszeichen drumherum.
- KEINE Wörter wie "Hey", "easy", "checken", "klar", "auf jeden Fall".`;

  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n")
      .trim();
    return text || null;
  } catch (e: any) {
    console.warn(`[warm-recovery] Claude failed stage=${stage}:`, e?.message);
    return null;
  }
}

// HTML-Block formatieren (Newlines → <p>-Absaetze, escapen)
function formatPersonalizedHtml(text: string): string {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;">${escapeHtml(
          p
        )}</p>`
    )
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────
// Stage-spezifische Subject-Lines + Headlines + Default-Bodies
// (Default-Body wird genutzt falls Claude failed)
// ─────────────────────────────────────────────────────────────────────

interface StageContent {
  subject: string;
  preheader: string;
  headline: string;
  intro: string;
  defaultBlock: string;
  ctaText: string;
  footerHint?: string;
}

function getStageContent(args: WarmRecoveryArgs, stage: WarmRecoveryStage): StageContent {
  const dog = args.dogName?.trim() || "dein Hund";
  const problemLabel =
    args.customProblem?.trim() ||
    PROBLEM_LABELS[args.dogProblem || ""] ||
    "Verhaltensthema";

  // "Was du bekommst"-Block — kommt in Stage 1 + 4 vor, weil viele Hundebesitzer
  // unsicher sind ob das ein PDF, eine App oder etwas Physisches ist.
  const whatYouGetBox = `
    <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:10px;padding:16px 18px;margin:18px 0;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#8B7355;">Was du für ${escapeHtml(dog)} bekommst</p>
      <p style="margin:0 0 6px;font-size:14px;color:#1a1a1a;line-height:1.55;">📄 <strong>Persönlicher Trainings-Plan als PDF</strong> — zum Herunterladen und Ausdrucken</p>
      <p style="margin:0 0 6px;font-size:14px;color:#1a1a1a;line-height:1.55;">🐾 <strong>Dein Mitglieder-Dashboard</strong> mit täglichen Übungen, Fortschritts-Tracking und Wochen-Challenges</p>
      <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.55;">💬 <strong>Trainer-Chat</strong> bei Fragen — du bist nicht allein</p>
    </div>`;

  // Hundeschule-Vergleichs-Box — Vertrauen durch Faktenvergleich, kommt Stage 3 + 5
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
        intro: `Hallo, du hattest den Plan für ${escapeHtml(
          dog
        )} schon ausgewählt, bist aber im Checkout nicht weitergekommen. Falls noch eine Frage offen ist — antworte einfach auf diese Mail, wir lesen jede persönlich.`,
        defaultBlock: `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;">${problemLabel} ist eines der häufigsten Themen, mit dem unsere Mitglieder zu uns kommen — und in den meisten Fällen lässt sich daran sehr gut arbeiten. Der Plan ist genau auf ${escapeHtml(
          dog
        )}s Profil zugeschnitten.</p>${whatYouGetBox}`,
        ctaText: `Plan für ${dog} ansehen`,
        footerHint: `Diese Mail kommt einmalig. Wenn du nichts machst, hörst du nur dann wieder von uns, wenn wir dir mit einer kurzen Story oder Frage helfen können.`,
      };
    case 2:
      return {
        subject: `Wie eine andere Halterin das gleiche Thema gelöst hat`,
        preheader: `Eine kurze Geschichte aus dem Trainer-Alltag.`,
        headline: `Eine Geschichte, die zu ${escapeHtml(dog)} passt`,
        intro: `Hallo, wir bekommen oft Mails von Mitgliedern, die am gleichen Punkt waren wie du jetzt. Hier eine kurze Geschichte mit einem Hund, dessen Profil ${escapeHtml(
          dog
        )} ähnelt:`,
        defaultBlock: `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;font-style:italic;border-left:3px solid #C4A576;padding-left:14px;">„Wir dachten lange, das gehört zu seinem Charakter. Nach gut vier Wochen mit dem Plan war ${problemLabel} kein Streitpunkt mehr — sondern Routine. Was geholfen hat: die klaren Übungen, die wir täglich kurz machen konnten."</p><p style="margin:0;font-size:14px;color:#6B7280;line-height:1.5;">— Halterin von Bruno (Husky-Mix, 4 Jahre)</p>`,
        ctaText: `Plan jetzt starten`,
      };
    case 3:
      return {
        subject: `Ein Brief von uns zu ${escapeHtml(dog)}`,
        preheader: `Persönlich von unserer Trainerin — kein Marketing.`,
        headline: `Ein paar persönliche Zeilen`,
        intro: `Hallo, das hier ist kein Werbe-Mail — eher ein kurzer Brief. Wir haben in den letzten Jahren mit tausenden Hunden gearbeitet, und das Thema mit ${escapeHtml(
          dog
        )} kennen wir gut.`,
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
        defaultBlock: `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;">Heute und morgen ist der Plan für ${escapeHtml(
          dog
        )} mit <strong>15% Rabatt</strong> verfügbar. Plus die 30-Tage-Geld-zurück-Garantie wie immer. Du kannst ihn jederzeit zurückgeben, wenn er nicht passt.</p>${compareBox}`,
        ctaText: `Mit 15% sichern`,
        footerHint: `Das ist die letzte Mail dieser Sequenz. Wenn du nicht reagierst, hörst du nichts mehr von uns.`,
      };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Hauptfunktion: Mail für eine bestimmte Stage senden
// ─────────────────────────────────────────────────────────────────────

export async function sendWarmRecoveryMail(
  args: WarmRecoveryArgs,
  stage: WarmRecoveryStage
): Promise<{ ok: boolean; reason?: string; aiUsed?: boolean }> {
  if (!args.to) return { ok: false, reason: "no_recipient" };

  const stageContent = getStageContent(args, stage);
  const ctaUrl = buildPlanRecoveryUrl(args, stage, stage === 5);

  // Versuche Claude-Personalisierung, fallback auf defaultBlock
  let personalizedHtml: string;
  let aiUsed = false;
  const aiText = await generatePersonalizedBlock(args, stage);
  if (aiText) {
    personalizedHtml = formatPersonalizedHtml(aiText);
    aiUsed = true;
  } else {
    personalizedHtml = stageContent.defaultBlock;
  }

  // Garantie-Box am Ende (kurz)
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

  const res = await sendBrevoMail({
    to: args.to,
    subject: stageContent.subject,
    html,
    tags: ["warm-recovery", `stage-${stage}`],
  });

  return { ok: res.ok, reason: res.reason, aiUsed };
}
