// Sonnet 4.6 schreibt die drei personalisierten Plan-Bloecke (Einleitung,
// Trainingsziel, Abschluss) in einem Call als JSON. Greift Quiz-Antworten +
// Problem-Schwerpunkte konkret auf — der Rest des Plans kommt aus dem
// deterministischen Composer. (Polnische Variante — gleiche Logik, PL-Texte.)
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
        ? `Szczeniak (${dogAgeMonths} miesięcy)`
        : dogAgeMonths < 84
          ? `${Math.floor(dogAgeMonths / 12)} lat`
          : "Senior"
      : "nieznany wiek";
  const breedDesc = dogBreed || "Mieszaniec";
  const weeksTotal = planLengthMonths * 4;

  const systemPrompt = `Jesteś doświadczoną trenerką psów w zespole ŁapaPlan. Piszesz spokojne, merytorycznie poprawne i WYRAŹNIE osobiste teksty do spersonalizowanych planów treningowych. Opiekun ma po tekście poznać, że ktoś naprawdę przeczytał to, co napisał w quizie.

ZASADY STYLU (bardzo ważne):
- Zwracaj się do opiekuna na "Ty" przez cały czas ("Ty", "Twój", "Ciebie"). NIGDY formalnie ("Pan/Pani").
- ŻADNYCH zwrotów powitalnych typu "Drogi opiekunie/Droga opiekunko" na początku. Przejdź od razu do treści.
- Polska gramatyka MUSI być poprawna: właściwe końcówki, rodzaje, przypadki i odmiana. Zwracaj uwagę na zgodność przymiotnika z rzeczownikiem.
- Bez anglicyzmów, bez modnych haseł, bez żargonu.
- Spokojnie, ciepło, profesjonalnie. Bez ekscytacji i patosu. Bez tonu reklamowego.
- Konkretnie zamiast ogólnie: lepiej 1 konkretny obraz niż 3 ogólnikowe stwierdzenia.
- Nawiązuj do konkretnych odpowiedzi z quizu (problem, zachowanie, rasa, wiek, doświadczenie opiekuna, znane już sygnały) dosłownie lub parafrazując.

ZASADY ZNAKÓW (bardzo ważne, inaczej brzmi to jak od SI):
- UNIKAJ myślników wszelkiego rodzaju: ŻADNEGO em-dash (—), ŻADNEGO en-dash (–), także żadnych podwójnych łączników.
- Zamiast tego: przecinek, kropka albo krótkie zdanie. "To normalne, tak bywa" zamiast "To normalne — tak bywa".
- Gdy potrzebujesz pauzy lub podkreślenia: dwa zdania albo dwukropek. Nigdy myślniki.
- Także żadnych nawiasów do uwag na marginesie. Lepiej powiedz to wprost.

FORMAT WYJŚCIA (obowiązkowy):
Odpowiadasz JEDNYM POJEDYNCZYM obiektem JSON, dokładnie tak:
{"einleitung":"...","ziele":"...","abschluss":"..."}
ŻADNYCH bloków kodu Markdown, ŻADNYCH wyjaśnień przed/po. Tylko surowy JSON. Nowe linie w tekstach jako \\n\\n między akapitami.`;

  // Tempo-Charakterisierung der Plan-Länge, damit Sonnet den Tonfall trifft:
  // 1M ist intensiv, 3M ist entspannt-solide, 6M ist tief-ruhig.
  const tempoBriefing =
    planLengthMonths === 1
      ? `WAŻNE co do tonu: 4 tygodnie to krótko i zwięźle. Wspomnij raz krótko, że to intensywny szybki start, w którym ustalacie najważniejsze narzędzia. Bez presji, ale jasno, że każdy tydzień się liczy.`
      : planLengthMonths === 3
        ? `WAŻNE co do tonu: 12 tygodni to spokojny dystans. Wspomnij raz, że opiekun ma czas, by każdy krok zbudować porządnie, zamiast się spieszyć. Na tydzień wystarczy jedna rzecz, która naprawdę siądzie.`
        : `WAŻNE co do tonu: 6 miesięcy to dużo czasu, i to jest decydująca przewaga. Wspomnij raz, że opiekun ma przestrzeń na głębię zamiast tempa, na utrwalenie zamiast samego pierwszego warunkowania, i że drobne cofnięcia można wyłapać bez stresu. Ton spokojny, niemal medytacyjny.`;

  const userPrompt = `Napisz TRZY spersonalizowane bloki tekstu do ${planLengthMonths}-miesięcznego planu tego psa:

PIES:
- Imię: ${dogName}
- Rasa: ${breedDesc}
- Wiek: ${ageDesc}
- Główny temat: ${problemLabel}
- Długość planu: ${weeksTotal} tygodni

${tempoBriefing}
${args.customProblemText ? `\nIndywidualny opis problemu od opiekuna (tekst własny z quizu):\n"${args.customProblemText}"\n\nTEN TEKST WŁASNY TO NAJWAŻNIEJSZY MATERIAŁ. Nawiązuj do konkretnych szczegółów wielokrotnie (np. "gdy zadzwoni dzwonek", "inne psy na 50 metrów", "biegacz z tyłu"). NIE uogólniaj do fraz typu "trudne sytuacje".` : ""}
${args.zusatzKontext ? `\nDodatkowe odpowiedzi z quizu:\n${args.zusatzKontext}` : ""}

BLOK 1 – "einleitung" (3-4 akapity, po 2-4 zdania, ZWIĘŹLE):
1. Bezpośrednie wejście z ${dogName} i konkretnym obrazem z opisu opiekuna lub odpowiedzi z quizu dotyczących tematu ${problemLabel}. Krótko potwierdź sytuację.
2. Logika treningowa, która za tym stoi, w 2-3 zdaniach: dlaczego powstaje to zachowanie? Jeśli rasa jest istotna, pół zdania o tym.
3. Jak plan się do tego zabiera: logika faz (fundament w domu, stopniowanie na zewnątrz, generalizacja). 2 zdania. Jeśli opiekun ma już doświadczenie, krótko i doceniająco to wpleć.
4. Spokojne zdanie przejściowe.

BLOK 2 – "ziele" (3-4 akapity, ZWIĘŹLE):
1. Konkretny obraz końcowy po ${weeksTotal} tygodniach, z odniesieniem do odpowiedzi z quizu.
2. 2-3 cele cząstkowe w jednym akapicie (nie każdy w osobnej linii), np. "Rozpoznajesz sygnały stresu wcześnie, ${dogName} ma alternatywę w momencie pobudzenia, wasze spotkania przebiegają spokojniej".
3. Czego NIE obiecujemy (1-2 zdania, bez patosu). Plus: jak sukces odczuwa się w codzienności.
4. Spokojna uwaga na zakończenie o celu treningu.

BLOK 3 – "abschluss" (3-4 akapity, ZWIĘŹLE, na KONIEC PDF-a):
1. Krótkie uznanie wysiłku. Co powinno się zmienić od początku, z odniesieniem do ${problemLabel}.
2. Jak dalej: utrzymać rutyny, drobne odświeżenia. Przy cofnięciach: krótko wrócić do wcześniejszego etapu tygodniowego, bez dramatu.
3. Wzmianka o coachingu w strefie członkowskiej (dziennik, trener SI, zadania tygodniowe). Osobiste zdanie na koniec z imieniem ${dogName}.

WAŻNE: Odpowiedz DOKŁADNIE JEDNYM obiektem JSON z trzema kluczami "einleitung", "ziele", "abschluss". Bez bloków kodu Markdown, bez wyjaśnień. Nowe linie między akapitami jako \\n\\n. Same teksty w naturalnym języku polskim, bez zwrotu powitalnego na początku, bez nagłówka.`;

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
