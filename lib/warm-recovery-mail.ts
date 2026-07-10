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
//   5) +7d   — Last-Call (freundliche letzte Erinnerung, kein Rabatt, Stop danach)
//
// Bei Conversion zu paid: Brevo-Webhook entfernt aus Warm-Recovery,
// Cron-Suppression: status != pending/failed → skip.

import "server-only";
import { sendBrevoMail, wrapTemplate, escapeHtml } from "./member-mail";
import type { Lang } from "./lang";
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

const PROBLEM_LABELS_PL: Record<string, string> = {
  pulling: "ciągnięcie na smyczy",
  barking: "nadmierne szczekanie",
  aggression: "agresja podczas spotkań",
  anxiety: "lęk separacyjny",
  jumping: "skakanie na ludzi",
  recall: "niepewne przywołanie",
  energy: "nadmiar energii",
  destructive: "niszczenie rzeczy",
  soiling: "brak czystości w domu",
  mouthing: "podnoszenie rzeczy z ziemi",
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
function buildPlanRecoveryUrl(args: WarmRecoveryArgs, stage: WarmRecoveryStage): string {
  // Warm-Recovery führt auf die Win-Back-Seite rueckhol.html. Diese liest
  // lead_id aus der URL und stellt Hund/E-Mail/Problem wieder her.
  const params = new URLSearchParams({
    lead_id: args.leadId,
    utm_source: "email",
    utm_medium: "drip",
    utm_campaign: "warm-recovery",
    utm_content: `stage-${stage}`,
  });
  return `${SITE_URL}/rueckhol.html?${params.toString()}`;
}

// Claude Haiku — schneller, billig, gut genug fuer kurze Personalisierungsbloecke.
async function generatePersonalizedBlock(
  args: WarmRecoveryArgs,
  stage: WarmRecoveryStage,
  lang: Lang = "de"
): Promise<string | null> {
  if (lang === "pl") return generatePersonalizedBlockPl(args, stage);
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
    4: `Schreibe 3 häufige Fragen + sachliche kurze Antworten (90-130 Wörter total) zu diesem Problem. FORMAT STRIKT: jede Frage steht in einer EIGENEN Zeile und endet mit einem Fragezeichen; in der Zeile direkt darunter die Antwort; zwischen den Frage-Antwort-Paaren eine LEERZEILE. KEIN Markdown, KEIN HTML, keine Sternchen, kein <b>. Fokus auf die Sorgen einer 40+ Halterin — erste Frage MUSS sein: "Schaffe ich das überhaupt allein?" (beruhige: klare Schritt-für-Schritt-Anleitung, kleine Etappen, jederzeit Unterstützung bei Fragen). Danach: "Funktioniert das bei meiner Rasse?" und "Wie viel Zeit brauche ich pro Tag?". Antworten konkret, nicht werbe-typisch.`,
    5: `Schreibe 2-3 Sätze (max 60 Wörter) Last-Call-Ton: sachlich-warm. "Falls Sie sich anders entschieden haben — verständlich." Eine letzte, freundliche Erinnerung dass der Plan bereitsteht. Erwähne die 30-Tage-Geld-zurück-Garantie als Sicherheit. KEIN Rabatt erwähnen, kein Druck, KEIN "Hey", kein Slang.`,
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
- Output: NUR Fließtext. KEIN Markdown, KEIN HTML, KEINE Tags wie <b>, KEINE Sternchen (*), keine Anführungszeichen drumherum. Trenne Absätze mit einer Leerzeile (doppelter Umbruch).
- Viele Halter haben Angst, das Training allein nicht hinzubekommen. Nimm dieser Sorge beiläufig den Druck: der Plan führt Schritt für Schritt in kleinen, machbaren Etappen, und bei Fragen bekommt man jederzeit Antwort — niemand wird allein gelassen.
- KEINE Wörter wie "Hey", "easy", "checken", "klar", "auf jeden Fall".
- NICHT gegendert schreiben: kein ":innen", kein "*innen", kein Binnen-I. Nutze das generische Maskulinum (z.B. "Halter", "Hundebesitzer", "Hundetrainer").`;

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

// Polnische Personalisierung — eigener Zweig, damit der deutsche oben unangetastet bleibt.
async function generatePersonalizedBlockPl(
  args: WarmRecoveryArgs,
  stage: WarmRecoveryStage
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const dog = args.dogName?.trim() || "Twojego psa";
  const breed = args.dogBreed?.trim() || "kundelek";
  const age = args.dogAge?.trim() || "dorosły";
  const problem =
    args.customProblem?.trim() ||
    PROBLEM_LABELS_PL[args.dogProblem || ""] ||
    "problem behawioralny";

  const stagePrompt: Record<WarmRecoveryStage, string> = {
    1: `Napisz 3 rzeczowe, spokojne zdania (maks. 80 słów łącznie) do pierwszego przypominającego e-maila. Ton: pełen szacunku, kompetentny, jak wykwalifikowana trenerka. ŻADNEGO „Hej", żadnego potocznego „jasne" czy „luzik". ŻADNEJ presji sprzedażowej. Raczej: konkretnie wyjaśnij, na czym przy tym profilu psa zwykle jest trudność (uwzględnij rasę i wiek). Wskaż aspekt budujący zaufanie (np. że ten problem da się wytrenować).`,
    2: `Napisz krótką, autentyczną historię (70-100 słów) o zmyślonym innym psie o podobnym profilu i tym samym problemie. Przed → po w konkretne 4 tygodnie. Wymyśl wiarygodne imiona (imię psa + imię właściciela). ŻADNEGO „Hej", żadnego języka potocznego. Pisz jak krótka historia sukcesu z codzienności trenerki — rzeczowo, ale zrozumiale emocjonalnie. Zdanie końcowe: czego właścicielka się przy tym nauczyła.`,
    3: `Napisz osobisty akapit trenerski (70-100 słów) w pierwszej osobie. Jak wykwalifikowana trenerka psów (40+), która pisze list. Zwrot w formie „Drogi/Droga [imię nieznane → po prostu zacznij bez zwrotu, bo nagłówek+wstęp to robią]". Kompetentnie, empatycznie, bez presji sprzedażowej. Wskaż 1 konkretne ćwiczenie pasujące do problemu, które da się zrobić dziś (5-10 min, bez sprzętu). ŻADNEGO „Hej" ani slangu.`,
    4: `Napisz 3 częste pytania + rzeczowe krótkie odpowiedzi (90-130 słów łącznie) do tego problemu. FORMAT ŚCIŚLE: każde pytanie stoi w OSOBNEJ linii i kończy się znakiem zapytania; w linii bezpośrednio pod nim odpowiedź; między parami pytanie-odpowiedź PUSTA LINIA. ŻADNEGO Markdown, ŻADNEGO HTML, żadnych gwiazdek, żadnego <b>. Skup się na obawach właścicielki 40+ — pierwsze pytanie MUSI brzmieć: „Czy w ogóle dam radę sama?" (uspokój: jasna instrukcja krok po kroku, małe etapy, wsparcie przy pytaniach w każdej chwili). Potem: „Czy to zadziała u mojej rasy?" oraz „Ile czasu potrzebuję dziennie?". Odpowiedzi konkretne, nie reklamowe.`,
    5: `Napisz 2-3 zdania (maks. 60 słów) w tonie ostatniego przypomnienia: rzeczowo-ciepłym. „Jeśli zdecydowałeś inaczej — to zrozumiałe." Jedno ostatnie, przyjazne przypomnienie, że plan jest gotowy. Wspomnij o 30-dniowej gwarancji zwrotu pieniędzy jako zabezpieczeniu. ŻADNEGO wspominania o rabacie, żadnej presji, ŻADNEGO „Hej", żadnego slangu.`,
  };

  const prompt = `Grupa docelowa: polscy właściciele psów, głównie 35-55 lat, szukają rzetelnej pomocy w wychowaniu psa. Język: rzeczowy, spokojny, kompetentny. ŻADNEGO slangu, ŻADNEGO „Hej", ŻADNEGO „luzik/spoko/ogarnąć".

Pies: ${dog} (${breed}, ${age})
Główny problem: ${problem}
Wybrany plan: ${args.selectedPlan || "3month"}

${stagePrompt[stage]}

WAŻNE:
- Napisz TYLKO sam blok, ŻADNEGO zwrotu grzecznościowego („Cześć X"), ŻADNEJ formuły pożegnalnej, ŻADNEGO „Oto".
- Forma na „ty" (nie „Pan/Pani"), ale z szacunkiem i spokojnie.
- Wspomnij ${dog} po imieniu, gdy to pasuje.
- Wynik: TYLKO tekst ciągły. ŻADNEGO Markdown, ŻADNEGO HTML, ŻADNYCH tagów jak <b>, ŻADNYCH gwiazdek (*), żadnych cudzysłowów dookoła. Oddzielaj akapity pustą linią (podwójne złamanie).
- Wielu właścicieli boi się, że nie poradzą sobie z treningiem sami. Mimochodem zdejmij tę obawę: plan prowadzi krok po kroku w małych, wykonalnych etapach, a przy pytaniach zawsze można otrzymać odpowiedź — nikt nie zostaje sam.
- ŻADNYCH słów jak „Hej", „luzik", „ogarnąć", „jasne", „na pewno".
- Używaj rodzaju męskiego jako generycznego (np. „właściciel", „trener psów").`;

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
    console.warn(`[warm-recovery] Claude failed (pl) stage=${stage}:`, e?.message);
    return null;
  }
}

// HTML-Block formatieren: Absaetze (Leerzeile) + Zeilenumbrueche (einzelnes \n),
// FAQ-Fragen (enden auf "?") fett. AI-Text wird vorher von Markdown/HTML
// gesaeubert, damit NIE ein rohes <b> o.ae. sichtbar wird.
function formatPersonalizedHtml(text: string): string {
  const clean = text
    .replace(/<\/?[a-z][^>]*>/gi, "") // rohe HTML-Tags raus (z.B. <b>)
    .replace(/\*\*(.*?)\*\*/g, "$1") // **fett** -> Text
    .replace(/__(.*?)__/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?;:])/g, "$1$2"); // *kursiv* -> Text

  // Absaetze an Leerzeilen; wenn keine Leerzeilen da sind, gilt jede Zeile
  // als eigener Absatz (Haiku nutzt oft nur einfache Umbrueche → sonst Wall-of-Text).
  const hasBlankLines = /\n\n/.test(clean);
  const blocks = hasBlankLines
    ? clean.split(/\n\n+/)
    : clean.split(/\n+/);

  return blocks
    .map((block) => {
      const lines = block
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const esc = escapeHtml(l);
          // FAQ-Frage (Zeile endet auf ?) fett hervorheben
          return /\?\s*$/.test(l) ? `<strong>${esc}</strong>` : esc;
        });
      if (!lines.length) return "";
      return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;">${lines.join(
        "<br>"
      )}</p>`;
    })
    .filter(Boolean)
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

function getStageContent(
  args: WarmRecoveryArgs,
  stage: WarmRecoveryStage,
  lang: Lang = "de"
): StageContent {
  if (lang === "pl") return getStageContentPl(args, stage);
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
        headline: `Was Halter uns am häufigsten fragen`,
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
        subject: `Letzte Nachricht zu ${dog}s Plan`,
        preheader: `Danach hörst du nichts mehr von uns.`,
        headline: `Eine letzte Erinnerung`,
        intro: `Hallo, falls du dich gegen den Plan entschieden hast — verständlich, das ist völlig ok. Aber falls du nochmal überlegst:`,
        defaultBlock: `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;">${escapeHtml(
          dog
        )}s persönlicher Plan steht bereit — mit der 30-Tage-Geld-zurück-Garantie. Du kannst ihn jederzeit zurückgeben, wenn er nicht passt. Ohne Risiko.</p>${compareBox}`,
        ctaText: `${escapeHtml(dog)}s Plan ansehen`,
        footerHint: `Das ist die letzte Mail dieser Sequenz. Wenn du nicht reagierst, hörst du nichts mehr von uns.`,
      };
  }
}

// Polnische Stage-Inhalte — eigener Zweig, deutscher oben bleibt byte-identisch.
function getStageContentPl(args: WarmRecoveryArgs, stage: WarmRecoveryStage): StageContent {
  const dog = args.dogName?.trim() || "Twój pies";
  const problemLabel =
    args.customProblem?.trim() ||
    PROBLEM_LABELS_PL[args.dogProblem || ""] ||
    "kwestia behawioralna";

  const whatYouGetBox = `
    <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:10px;padding:16px 18px;margin:18px 0;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#8B7355;">Co dostajesz dla ${escapeHtml(dog)}</p>
      <p style="margin:0 0 6px;font-size:14px;color:#1a1a1a;line-height:1.55;">📄 <strong>Osobisty plan treningowy w PDF</strong> — do pobrania i wydrukowania</p>
      <p style="margin:0 0 6px;font-size:14px;color:#1a1a1a;line-height:1.55;">🐾 <strong>Twój panel członkowski</strong> z codziennymi ćwiczeniami, śledzeniem postępów i tygodniowymi wyzwaniami</p>
      <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.55;">💬 <strong>Czat z trenerem</strong> przy pytaniach — nie jesteś sam</p>
    </div>`;

  const compareBox = `
    <div style="background:#F8F8F8;border-radius:10px;padding:14px 16px;margin:16px 0;font-size:13.5px;color:#1a1a1a;line-height:1.55;">
      <p style="margin:0 0 8px;font-weight:700;color:#8B7355;">W porównaniu ze szkołą dla psów</p>
      <p style="margin:0 0 4px;">🏫 Szkoła dla psów: 60–100 € za godzinę · stałe terminy · zwykle trening grupowy</p>
      <p style="margin:0;">📋 ŁapaPlan: jednorazowo od 30 € · 12 tygodni treści · indywidualnie dla ${escapeHtml(dog)} · w Twoim tempie</p>
    </div>`;

  switch (stage) {
    case 1:
      return {
        subject: `Pytanie o plan treningowy dla ${dog}?`,
        preheader: `Chętnie pomożemy — jeśli coś jest niejasne.`,
        headline: `Może coś jeszcze zostało otwarte`,
        intro: `Cześć, wybrałeś już plan dla ${escapeHtml(
          dog
        )}, ale nie przeszedłeś przez koszyk do końca. Jeśli jakieś pytanie pozostało otwarte — po prostu odpowiedz na tego e-maila, czytamy każdy osobiście.`,
        defaultBlock: `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;">${problemLabel} to jeden z najczęstszych tematów, z którymi zgłaszają się do nas nasi członkowie — i w większości przypadków da się nad tym bardzo dobrze pracować. Plan jest dopasowany dokładnie do profilu ${escapeHtml(
          dog
        )}.</p>${whatYouGetBox}`,
        ctaText: `Zobacz plan dla ${dog}`,
        footerHint: `Ten e-mail przychodzi jednorazowo. Jeśli nic nie zrobisz, usłyszysz od nas ponownie tylko wtedy, gdy będziemy mogli pomóc krótką historią lub pytaniem.`,
      };
    case 2:
      return {
        subject: `Jak inna właścicielka rozwiązała ten sam temat`,
        preheader: `Krótka historia z codzienności trenerki.`,
        headline: `Historia, która pasuje do ${escapeHtml(dog)}`,
        intro: `Cześć, często dostajemy maile od członków, którzy byli w tym samym punkcie co Ty teraz. Oto krótka historia z psem, którego profil przypomina ${escapeHtml(
          dog
        )}:`,
        defaultBlock: `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;font-style:italic;border-left:3px solid #C4A576;padding-left:14px;">„Długo myśleliśmy, że to część jego charakteru. Po dobrych czterech tygodniach z planem ${problemLabel} nie było już punktem spornym — tylko rutyną. Co pomogło: jasne ćwiczenia, które codziennie mogliśmy krótko wykonać."</p><p style="margin:0;font-size:14px;color:#6B7280;line-height:1.5;">— Właścicielka Bruna (mieszaniec husky, 4 lata)</p>`,
        ctaText: `Rozpocznij plan teraz`,
      };
    case 3:
      return {
        subject: `List od nas o ${escapeHtml(dog)}`,
        preheader: `Osobiście od naszej trenerki — żadnego marketingu.`,
        headline: `Kilka osobistych słów`,
        intro: `Cześć, to nie jest mail reklamowy — raczej krótki list. Przez ostatnie lata pracowaliśmy z tysiącami psów, a temat z ${escapeHtml(
          dog
        )} dobrze znamy.`,
        defaultBlock: `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;">Czego wielu nie docenia: ${problemLabel} da się prawie zawsze widocznie zmienić w 4 do 12 tygodni, jeśli konsekwentnie się trzyma. Nie potrzebujesz wcześniejszej wiedzy — plan prowadzi Cię krok po kroku, z 10-minutowymi ćwiczeniami dziennie.</p><p style="margin:0;font-size:14px;color:#6B7280;">— Zespół trenerów ŁapaPlan</p>${compareBox}`,
        ctaText: `Zobacz plan`,
      };
    case 4:
      return {
        subject: `Najczęstsze pytania o nasz plan treningowy`,
        preheader: `Jeśli wciąż masz wątpliwości — tu wszystkie odpowiedzi.`,
        headline: `O co właściciele pytają nas najczęściej`,
        intro: `Cześć, zanim się zdecydujesz, oto najczęstsze pytania naszych członków — zwłaszcza tych, którzy już dłużej zmagają się z ${problemLabel}:`,
        defaultBlock: `${whatYouGetBox}
          <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#1a1a1a;"><strong>Czy to zadziała też u mojej rasy?</strong><br>Tak. Plan jest układany indywidualnie według rasy, wieku i konkretnego zachowania ${escapeHtml(dog)} — żadnego standardowego szablonu.</p>
          <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#1a1a1a;"><strong>Ile czasu potrzebuję dziennie?</strong><br>10 do 20 minut wystarczy. Ćwiczenia są tak zbudowane, żeby pasowały do codzienności.</p>
          <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#1a1a1a;"><strong>Co jeśli ${escapeHtml(dog)} nie współpracuje?</strong><br>Właśnie po to jest czat z trenerem w panelu członkowskim. Nie jesteś sam.</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#1a1a1a;"><strong>A jeśli i tak nic z tego nie wyjdzie?</strong><br>30 dni zwrotu pieniędzy. Bez dyskusji. Wystarczy krótki e-mail.</p>`,
        ctaText: `Zdobądź plan teraz`,
      };
    case 5:
      return {
        subject: `Ostatnia wiadomość o planie dla ${dog}`,
        preheader: `Potem już nic od nas nie usłyszysz.`,
        headline: `Ostatnie przypomnienie`,
        intro: `Cześć, jeśli zdecydowałeś przeciw planowi — to zrozumiałe, całkowicie w porządku. Ale jeśli jeszcze się zastanawiasz:`,
        defaultBlock: `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1a1a;">Osobisty plan dla ${escapeHtml(
          dog
        )} jest gotowy — z 30-dniową gwarancją zwrotu pieniędzy. Możesz go w każdej chwili zwrócić, jeśli nie pasuje. Bez ryzyka.</p>${compareBox}`,
        ctaText: `Zobacz plan dla ${escapeHtml(dog)}`,
        footerHint: `To ostatni e-mail tej sekwencji. Jeśli nie zareagujesz, nic więcej od nas nie usłyszysz.`,
      };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Hauptfunktion: Mail für eine bestimmte Stage senden
// ─────────────────────────────────────────────────────────────────────

export async function sendWarmRecoveryMail(
  args: WarmRecoveryArgs,
  stage: WarmRecoveryStage,
  lang: Lang = "de"
): Promise<{ ok: boolean; reason?: string; aiUsed?: boolean }> {
  if (!args.to) return { ok: false, reason: "no_recipient" };

  const stageContent = getStageContent(args, stage, lang);
  const ctaUrl = buildPlanRecoveryUrl(args, stage);

  // Versuche Claude-Personalisierung, fallback auf defaultBlock
  let personalizedHtml: string;
  let aiUsed = false;
  const aiText = await generatePersonalizedBlock(args, stage, lang);
  if (aiText) {
    personalizedHtml = formatPersonalizedHtml(aiText);
    aiUsed = true;
  } else {
    personalizedHtml = stageContent.defaultBlock;
  }

  // Garantie-Box am Ende (kurz)
  const guaranteeBox =
    lang === "pl"
      ? `
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:14px 16px;margin:18px 0 4px;">
      <p style="margin:0;font-size:13px;color:#166534;line-height:1.5;">
        <strong>✓ Bez abonamentu · Jednorazowa płatność · 30 dni zwrotu pieniędzy.</strong> Nic nie tracisz.
      </p>
    </div>`
      : `
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
    unsubscribe: true, // Marketing-Mail → sichtbarer Abmelde-Link
    lang,
  });

  const res = await sendBrevoMail({
    to: args.to,
    subject: stageContent.subject,
    html,
    tags: ["warm-recovery", `stage-${stage}`],
  });

  return { ok: res.ok, reason: res.reason, aiUsed };
}
