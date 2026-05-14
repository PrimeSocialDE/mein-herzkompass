// Optional: Claude Haiku schreibt die individuelle Einleitung (3-5s).
// Wird nur fuer den intro.einleitung benutzt — der Rest des Plans
// kommt aus dem deterministischen Composer.
//
// Kosten: ~0.5 ct pro Plan (~500 Token output).

interface IntroArgs {
  dogName: string;
  dogBreed?: string;
  dogAgeMonths?: number;
  problemLabel: string;        // "Leinenziehen"
  planLengthMonths: 1 | 3 | 6;
  zusatzKontext?: string;       // freie Quiz-Antworten
  customProblemText?: string;   // Freitext aus Quiz: individuelle Problembeschreibung
}

// Sonnet 4.6 für bessere deutsche Grammatik + Stil-Konsistenz.
// Bei nur 500-800 Token output dauert das ca. 5-8s — vertretbar.
const INTRO_MODEL = process.env.PLAN_INTRO_MODEL || "claude-sonnet-4-6";

export async function generatePersonalizedIntro(
  args: IntroArgs
): Promise<{ einleitung: string | null; ms: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { einleitung: null, ms: 0 };

  const t0 = Date.now();
  const { dogName, dogBreed, dogAgeMonths, problemLabel, planLengthMonths } = args;
  const ageDesc =
    dogAgeMonths != null
      ? dogAgeMonths < 12
        ? `Welpe (${dogAgeMonths} Monate)`
        : dogAgeMonths < 84
          ? `${Math.floor(dogAgeMonths / 12)} Jahre`
          : "Senior"
      : "unbekanntes Alter";
  const breedDesc = dogBreed || "Mischling";
  const weeksTotal = planLengthMonths * 4;

  const systemPrompt = `Du bist erfahrene Hundetrainerin im Pfoten-Plan-Team. Du schreibst kurze, ruhige, fachlich saubere Einleitungen für personalisierte Trainingspläne.

STIL-REGELN (sehr wichtig):
- DUZE den Halter durchgehend ("du", "dein", "dich"). NIE siezen.
- KEINE Anrede wie "Liebe Hundehalterin/Hundehalter" am Anfang. Direkt in den Inhalt einsteigen.
- Deutsche Grammatik MUSS sauber sein: "großes Glück" (NICHT "große Glück"), Genus + Kasus korrekt.
- Keine Anglizismen, keine Buzzwords, kein Jargon.
- 3-4 kurze Absätze (je 2-4 Sätze).
- Ruhig, warm, professionell. Nicht aufgeregt oder pathetisch.

ZEICHEN-REGELN (sehr wichtig, sonst wirkt es nach KI):
- VERMEIDE Gedankenstriche jeder Art: KEINE em-dash (—), KEINE en-dash (–), auch keine doppelten Bindestriche.
- Stattdessen: Komma, Punkt oder kurzer Satz. "Das ist normal, gehört dazu" statt "Das ist normal — gehört dazu".
- Wenn du eine Pause oder Betonung brauchst: zwei Sätze oder ein Doppelpunkt. Niemals Gedankenstriche.
- Auch keine Klammern für Nebenbemerkungen. Lieber direkt sagen.`;

  const userPrompt = `Schreibe eine persönliche Einleitung (3-4 Absätze) für den ${planLengthMonths}-Monatsplan dieses Hundes:

- Name: ${dogName}
- Rasse: ${breedDesc}
- Alter: ${ageDesc}
- Hauptthema: ${problemLabel}
- Plan-Länge: ${weeksTotal} Wochen
${args.customProblemText ? `\nIndividuelle Problem-Beschreibung des Halters (Freitext aus Quiz):\n"${args.customProblemText}"\n\n→ Gehe in der Einleitung KONKRET auf diese Beschreibung ein. Zeige dass du verstanden hast, was die Person genau erlebt.` : ""}
${args.zusatzKontext ? `\nZusätzlicher Kontext: ${args.zusatzKontext}` : ""}

Steige direkt mit dem Hund ein (z.B. "${dogName} bringt..."). KEINE Anrede vorher. Gehe kurz auf rassen-typische Eigenschaften ein wenn relevant. Erkläre wofür der Plan steht. Schreibe ruhig und in Du-Form ("dein", "du wirst sehen"...).

Antworte NUR mit dem Einleitungs-Text, keine Vorrede, keine Anführungszeichen, keine Überschrift.`;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: INTRO_MODEL,
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const rawText = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();
    // Defensiv: Gedankenstriche raus, Markdown raus — falls Sonnet die
    // Stil-Regeln trotz Prompt nicht 100% einhaelt.
    const text = rawText
      .replace(/\s—\s/g, ", ")
      .replace(/\s–\s/g, ", ")
      .replace(/—/g, ",")
      .replace(/–/g, ",")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1");
    return { einleitung: text || null, ms: Date.now() - t0 };
  } catch (e: any) {
    console.warn("[plan-intro-ai] generation failed:", e?.message);
    return { einleitung: null, ms: Date.now() - t0 };
  }
}
