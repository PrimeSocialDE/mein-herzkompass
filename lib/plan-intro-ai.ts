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
}

const HAIKU_MODEL = process.env.PLAN_INTRO_MODEL || "claude-haiku-4-5-20251001";

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

  const systemPrompt = `Du bist erfahrene Hundetrainerin im Pfoten-Plan-Team. Du schreibst kurze, ruhige, fachliche Einleitungen für Trainingspläne. Stil: ruhig, klar, ohne Jargon, keine Anglizismen, keine Buzzwords. 3-4 Absätze.`;

  const userPrompt = `Schreibe die persönliche Einleitung (3-4 Absätze) für den ${planLengthMonths}-Monatsplan eines Hundes:

- Name: ${dogName}
- Rasse: ${breedDesc}
- Alter: ${ageDesc}
- Hauptproblem: ${problemLabel}
- Plan-Länge: ${weeksTotal} Wochen
${args.zusatzKontext ? `\nZusätzlicher Kontext: ${args.zusatzKontext}` : ""}

Schreibe so, als würdest du persönlich mit dem Halter sprechen. Geh auf Rasse-spezifische Merkmale ein (wenn relevant). Erkläre kurz warum dieser Plan genau so aufgebaut ist. Gib Hoffnung und Klarheit. NICHT zu lang — 3-4 Absätze reichen.

Antworte NUR mit dem Einleitungs-Text, keine Vorrede, keine Anführungszeichen.`;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();
    return { einleitung: text || null, ms: Date.now() - t0 };
  } catch (e: any) {
    console.warn("[plan-intro-ai] generation failed:", e?.message);
    return { einleitung: null, ms: Date.now() - t0 };
  }
}
