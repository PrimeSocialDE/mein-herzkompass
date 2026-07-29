// Sonnet 4.6 schreibt die drei personalisierten Plan-Bloecke (Einleitung,
// Trainingsziel, Abschluss) in einem Call als JSON. Greift Quiz-Antworten +
// Problem-Schwerpunkte konkret auf — der Rest des Plans kommt aus dem
// deterministischen Composer. (Italienische Variante — gleiche Logik, IT-Texte.)
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
        ? `Cucciolo (${dogAgeMonths} mesi)`
        : dogAgeMonths < 84
          ? `${Math.floor(dogAgeMonths / 12)} anni`
          : "Senior"
      : "età sconosciuta";
  const breedDesc = dogBreed || "Meticcio";
  const weeksTotal = planLengthMonths * 4;

  const systemPrompt = `Sei un'esperta educatrice cinofila del team ZampaPlan. Scrivi testi calmi, tecnicamente corretti e SENSIBILMENTE personali per piani di addestramento personalizzati. Il proprietario deve capire dal testo che qualcuno ha davvero letto ciò che ha scritto nel quiz.

REGOLE DI STILE (molto importante):
- Rivolgiti al proprietario sempre dando del "tu" ("tu", "il tuo", "te"). MAI la forma di cortesia ("Lei").
- NESSUNA formula di saluto tipo "Caro proprietario/Cara proprietaria" all'inizio. Entra subito nel contenuto.
- La grammatica italiana DEVE essere corretta: accordo di genere e numero, articoli, preposizioni e coniugazioni giusti. Fai attenzione all'accordo tra aggettivo e sostantivo.
- Niente anglicismi, niente parole alla moda, niente gergo. Terminologia coerente: usa "premietto" (non "bocconcino"), "marcatore"/"parola marcatore" (non "marker"), "maxi-premio" (non "jackpot"), "contatto visivo". Evita "training", "timing", "outdoor" e simili.
- Con calma, calore, professionalità. Senza eccitazione né enfasi. Nessun tono pubblicitario.
- Concreto invece che generico: meglio 1 immagine concreta che 3 affermazioni generiche.
- Riprendi le risposte concrete del quiz (problema, comportamento, razza, età, esperienza del proprietario, segnali già noti) alla lettera o parafrasandole.

REGOLE SUI SEGNI (molto importante, altrimenti sembra scritto da un'IA):
- EVITA i trattini di ogni tipo: NESSUN trattino lungo (—), NESSUN trattino medio (–), nemmeno doppi trattini.
- Al loro posto: virgola, punto o una frase breve. "È normale, fa parte del percorso" invece di "È normale — fa parte del percorso".
- Quando ti serve una pausa o un'enfasi: due frasi oppure i due punti. Mai i trattini.
- Nemmeno parentesi per note a margine. Meglio dirlo in modo diretto.

FORMATO DI OUTPUT (obbligatorio):
Rispondi con UN UNICO oggetto JSON, esattamente così:
{"einleitung":"...","ziele":"...","abschluss":"..."}
NESSUN blocco di codice Markdown, NESSUNA spiegazione prima/dopo. Solo il JSON grezzo. Le interruzioni di riga nei testi come \\n\\n tra i paragrafi.`;

  // Tempo-Charakterisierung der Plan-Länge, damit Sonnet den Tonfall trifft:
  // 1M ist intensiv, 3M ist entspannt-solide, 6M ist tief-ruhig.
  const tempoBriefing =
    planLengthMonths === 1
      ? `IMPORTANTE sul tono: 4 settimane sono poche e compatte. Accenna una volta brevemente che si tratta di un avvio rapido e intenso, in cui si stabiliscono gli strumenti più importanti. Nessuna pressione, ma chiaro che ogni settimana conta.`
      : planLengthMonths === 3
        ? `IMPORTANTE sul tono: 12 settimane sono un percorso tranquillo. Accenna una volta che il proprietario ha tempo per costruire ogni passo con cura, senza affrettarsi. Per settimana basta una cosa che si consolidi davvero.`
        : `IMPORTANTE sul tono: 6 mesi sono molto tempo, ed è il vantaggio decisivo. Accenna una volta che il proprietario ha spazio per la profondità invece che per la fretta, per il consolidamento invece che per il solo primo condizionamento, e che piccoli passi indietro possono essere assorbiti senza stress. Tono calmo, quasi meditativo.`;

  const userPrompt = `Scrivi TRE blocchi di testo personalizzati per il piano di ${planLengthMonths} mesi di questo cane:

CANE:
- Nome: ${dogName}
- Razza: ${breedDesc}
- Età: ${ageDesc}
- Tema principale: ${problemLabel}
- Durata del piano: ${weeksTotal} settimane

${tempoBriefing}
${args.customProblemText ? `\nDescrizione individuale del problema da parte del proprietario (testo libero dal quiz):\n"${args.customProblemText}"\n\nQUESTO TESTO LIBERO È IL MATERIALE PIÙ IMPORTANTE. Riprendi dettagli concreti più volte (per es. "quando suona il campanello", "altri cani a 50 metri", "un runner da dietro"). NON generalizzare in frasi tipo "situazioni difficili".` : ""}
${args.zusatzKontext ? `\nAltre risposte del quiz:\n${args.zusatzKontext}` : ""}

BLOCCO 1 – "einleitung" (3-4 paragrafi, 2-4 frasi ciascuno, COMPATTO):
1. Ingresso diretto con ${dogName} e un'immagine concreta dalla descrizione del proprietario o dalle risposte del quiz sul tema ${problemLabel}. Convalida brevemente la situazione.
2. La logica di addestramento che sta dietro, in 2-3 frasi: perché nasce questo comportamento? Se la razza è rilevante, mezza frase a riguardo.
3. Come il piano lo affronta: logica delle fasi (fondamenta in casa, aumento all'esterno, generalizzazione). 2 frasi. Se il proprietario ha già esperienza, inseriscila brevemente con apprezzamento.
4. Frase di transizione tranquilla.

BLOCCO 2 – "ziele" (3-4 paragrafi, COMPATTO):
1. Immagine finale concreta dopo ${weeksTotal} settimane, con riferimento alle risposte del quiz.
2. 2-3 obiettivi parziali in un unico paragrafo (non uno per riga), per es. "Riconosci presto i segnali di stress, ${dogName} ha un'alternativa nel momento dell'agitazione, i tuoi incontri con lui si svolgono più tranquilli".
3. Cosa NON viene promesso (1-2 frasi, senza enfasi). Inoltre: come si percepisce il successo nella vita di tutti i giorni.
4. Osservazione conclusiva tranquilla sull'obiettivo dell'addestramento.

BLOCCO 3 – "abschluss" (3-4 paragrafi, COMPATTO, alla FINE del PDF):
1. Breve riconoscimento dell'impegno. Cosa dovrebbe essere cambiato dall'inizio, con riferimento a ${problemLabel}.
2. Come si prosegue: mantenere le routine, piccoli richiami di ripasso. In caso di ricadute: tornare brevemente a una fase settimanale precedente, senza drammi.
3. Accenno al coaching nell'area membri (diario, addestratore IA, compiti settimanali). Frase finale personale con il nome di ${dogName}.

IMPORTANTE: Rispondi con ESATTAMENTE UN oggetto JSON con le tre chiavi "einleitung", "ziele", "abschluss". Niente blocchi di codice Markdown, niente spiegazioni. Le interruzioni di riga tra i paragrafi come \\n\\n. I testi stessi in italiano naturale, senza formula di saluto all'inizio, senza titolo.`;

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
