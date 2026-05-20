// Sonnet 4.6 schreibt die drei personalisierten Plan-Bloecke (Einleitung,
// Trainingsziel, Abschluss) in einem Call als JSON. Greift Quiz-Antworten +
// Problem-Schwerpunkte konkret auf — der Rest des Plans kommt aus dem
// deterministischen Composer.
//
// Kosten: ~3-4 ct pro Plan (~2200 Token output, Sonnet 4.6).

interface IntroArgs {
  dogName: string;
  dogBreed?: string;
  dogAgeMonths?: number;
  problemLabel: string;        // "Leinenziehen"
  planLengthMonths: 1 | 3 | 6;
  zusatzKontext?: string;       // freie Quiz-Antworten
  customProblemText?: string;   // Freitext aus Quiz: individuelle Problembeschreibung
}

interface IntroBundle {
  einleitung: string | null;
  ziele: string | null;
  abschluss: string | null;
  ms: number;
}

const INTRO_MODEL = process.env.PLAN_INTRO_MODEL || "claude-sonnet-4-6";

// WinAnsi-Sanitization: pdf-lib (WinAnsi-Encoding) crasht bei Zeichen ausserhalb
// Latin-1. Halten wir uns kompatibel: Gedankenstriche, Pfeile, Smart-Quotes,
// Aufzaehlungszeichen alle normalisieren.
function sanitizeBlock(raw: string): string {
  return String(raw)
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

export async function generatePersonalizedIntro(args: IntroArgs): Promise<IntroBundle> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { einleitung: null, ziele: null, abschluss: null, ms: 0 };

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

  const systemPrompt = `Du bist erfahrene Hundetrainerin im Pfoten-Plan-Team. Du schreibst ruhige, fachlich saubere und SPÜRBAR persönliche Texte für personalisierte Trainingspläne. Der Halter soll am Text merken, dass jemand wirklich gelesen hat, was er im Quiz geschrieben hat.

STIL-REGELN (sehr wichtig):
- DUZE den Halter durchgehend ("du", "dein", "dich"). NIE siezen.
- KEINE Anrede wie "Liebe Hundehalterin/Hundehalter" am Anfang. Direkt in den Inhalt einsteigen.
- Deutsche Grammatik MUSS sauber sein: "großes Glück" (NICHT "große Glück"), Genus + Kasus korrekt.
- Keine Anglizismen, keine Buzzwords, kein Jargon.
- Ruhig, warm, professionell. Nicht aufgeregt oder pathetisch. Kein Werbe-Ton.
- Konkret statt allgemein: lieber 1 konkretes Bild als 3 generische Aussagen.
- Greife konkrete Quiz-Antworten (Problem, Verhalten, Rasse, Alter, Erfahrung des Halters, schon bekannte Signale) im Text wörtlich oder paraphrasiert auf.

ZEICHEN-REGELN (sehr wichtig, sonst wirkt es nach KI):
- VERMEIDE Gedankenstriche jeder Art: KEINE em-dash (—), KEINE en-dash (–), auch keine doppelten Bindestriche.
- Stattdessen: Komma, Punkt oder kurzer Satz. "Das ist normal, gehört dazu" statt "Das ist normal — gehört dazu".
- Wenn du eine Pause oder Betonung brauchst: zwei Sätze oder ein Doppelpunkt. Niemals Gedankenstriche.
- Auch keine Klammern für Nebenbemerkungen. Lieber direkt sagen.

AUSGABE-FORMAT (zwingend):
Du antwortest mit EINEM EINZIGEN JSON-Objekt, exakt so:
{"einleitung":"...","ziele":"...","abschluss":"..."}
KEINE Markdown-Code-Fence, KEINE Erklaerung davor/danach. Nur das rohe JSON. Newlines in Texten als \\n\\n zwischen Absaetzen.`;

  // Tempo-Charakterisierung der Plan-Länge, damit Sonnet den Tonfall trifft:
  // 1M ist intensiv, 3M ist entspannt-solide, 6M ist tief-ruhig.
  const tempoBriefing =
    planLengthMonths === 1
      ? `WICHTIG zum Tonfall: 4 Wochen sind kurz und kompakt. Erwähne einmal kurz, dass es ein straffer Schnellstart ist, in dem die wichtigsten Werkzeuge etabliert werden. Kein Druck, aber klar, dass jede Woche zählt.`
      : planLengthMonths === 3
        ? `WICHTIG zum Tonfall: 12 Wochen sind eine entspannte Strecke. Erwähne einmal, dass der Halter Zeit hat, jeden Schritt sauber aufzubauen, statt zu hetzen. Pro Woche reicht eine Sache, die wirklich sitzt.`
        : `WICHTIG zum Tonfall: 6 Monate sind viel Zeit, und das ist der entscheidende Vorteil. Erwähne einmal, dass der Halter Raum hat für Tiefe statt Tempo, für Festigung statt nur Erstkonditionierung, und dass kleine Rückschritte ohne Stress aufgefangen werden können. Ruhig, fast meditativ im Ton.`;

  const userPrompt = `Schreibe DREI personalisierte Text-Bloecke fuer den ${planLengthMonths}-Monatsplan dieses Hundes:

HUND:
- Name: ${dogName}
- Rasse: ${breedDesc}
- Alter: ${ageDesc}
- Hauptthema: ${problemLabel}
- Plan-Laenge: ${weeksTotal} Wochen

${tempoBriefing}
${args.customProblemText ? `\nIndividuelle Problem-Beschreibung des Halters (Freitext aus Quiz):\n"${args.customProblemText}"\n\nDIESER FREITEXT IST DAS WICHTIGSTE MATERIAL. Greife konkrete Details mehrfach auf (z.B. "wenn es klingelt", "andere Hunde auf 50 Meter", "Jogger von hinten"). Verallgemeinere NICHT zu Phrasen wie "schwierige Situationen".` : ""}
${args.zusatzKontext ? `\nWeitere Quiz-Antworten:\n${args.zusatzKontext}` : ""}

BLOCK 1 – "einleitung" (3-4 Absaetze, je 2-4 Saetze, KOMPAKT):
1. Direkter Einstieg mit ${dogName} und einem konkreten Bild aus der Halter-Beschreibung oder den Quiz-Antworten zum Thema ${problemLabel}. Validiere kurz die Situation.
2. Trainings-Logik dahinter in 2-3 Saetzen: warum entsteht dieses Verhalten? Falls die Rasse relevant ist, ein halber Satz dazu.
3. Wie der Plan das angeht: Phasen-Logik (Fundament drinnen, Steigerung draussen, Generalisierung). 2 Saetze. Wenn der Halter schon Erfahrung hat, kurz wertschaetzend einbauen.
4. Ruhiger Uebergangs-Satz.

BLOCK 2 – "ziele" (3-4 Absaetze, KOMPAKT):
1. Konkretes End-Bild nach ${weeksTotal} Wochen, mit Bezug zu den Quiz-Antworten.
2. 2-3 Teilziele in einem Absatz (nicht jedes auf einer Zeile), z.B. "Du erkennst Stress-Signale frueh, ${dogName} hat eine Alternative im Moment der Aufregung, eure Begegnungen laufen ruhiger ab".
3. Was NICHT versprochen wird (1-2 Saetze, kein Pathos). Plus: wie sich Erfolg im Alltag anfuehlt.
4. Ruhige Schlussbemerkung zum Trainingsziel.

BLOCK 3 – "abschluss" (3-4 Absaetze, KOMPAKT, ans ENDE des PDFs):
1. Kurze Anerkennung der Leistung. Was sich seit Beginn veraendert haben sollte, mit Bezug auf ${problemLabel}.
2. Wie es weitergeht: Routinen behalten, kleine Auffrischungen. Bei Rueckschlaegen: kurz auf eine fruehere Wochen-Stufe, ohne Drama.
3. Hinweis aufs Mitglieder-Bereich-Coaching (Tagebuch, KI-Trainer, Wochen-Aufgaben). Persoenlicher Schluss-Satz mit ${dogName}s Namen.

WICHTIG: Antworte mit EXAKT EINEM JSON-Objekt mit den drei Keys "einleitung", "ziele", "abschluss". Keine Markdown-Fences, keine Erklaerung. Newlines zwischen Absaetzen als \\n\\n. Die Texte selbst in normalem Deutsch, keine Anrede vorne, keine Ueberschrift.`;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: INTRO_MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const rawText = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    // JSON parsen, defensiv: wenn Markdown-Fence drumherum oder Vorrede,
    // extrahiere das aeusserste JSON-Objekt per Greedy-Match.
    let einleitung: string | null = null;
    let ziele: string | null = null;
    let abschluss: string | null = null;
    try {
      const jsonStart = rawText.indexOf("{");
      const jsonEnd = rawText.lastIndexOf("}");
      const jsonSlice = jsonStart >= 0 && jsonEnd > jsonStart
        ? rawText.slice(jsonStart, jsonEnd + 1)
        : rawText;
      const parsed = JSON.parse(jsonSlice);
      einleitung = typeof parsed.einleitung === "string" ? sanitizeBlock(parsed.einleitung) : null;
      ziele = typeof parsed.ziele === "string" ? sanitizeBlock(parsed.ziele) : null;
      abschluss = typeof parsed.abschluss === "string" ? sanitizeBlock(parsed.abschluss) : null;
    } catch (parseErr: any) {
      console.warn("[plan-intro-ai] JSON-parse fehlgeschlagen, fallback nur einleitung:", parseErr?.message);
      // Fallback: nimm den ganzen Text als einleitung (alte Verhaltensweise)
      einleitung = sanitizeBlock(rawText) || null;
    }

    return { einleitung, ziele, abschluss, ms: Date.now() - t0 };
  } catch (e: any) {
    console.warn("[plan-intro-ai] generation failed:", e?.message);
    return { einleitung: null, ziele: null, abschluss: null, ms: Date.now() - t0 };
  }
}
