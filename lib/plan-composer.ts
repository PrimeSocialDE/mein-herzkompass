// Plan-Composer — deterministisch + super schnell (<50ms).
//
// Liefert TrainingPlanContent mit:
//   - WIRKLICH individuellen Wochen (jede Woche eigenes Thema, Ziel, Tagesplan)
//   - 8 unique Wochen-Templates pro Phase → 24 unterschiedliche Wochen für 6-Monat
//   - Ausführliche, problem-spezifische Monats-Übersichten
//
// Optional: lib/plan-intro-ai.ts ergänzt den introText via Claude Sonnet
// (5-8 Sekunden, ~0.5ct).

import {
  EXERCISE_LIBRARY,
  PROBLEM_LABELS_DE,
  type ProblemKey,
  type ExerciseTemplate,
  type Phase,
} from "./exercise-library";
import type { TrainingPlanContent } from "./member-plan-content";

export interface DogProfile {
  dogName: string;
  dogBreed?: string;
  dogAgeMonths?: number;
  dogSize?: "small" | "medium" | "large";
  /** "m" / "rüde" = männlich, sonst weiblich (Default). Beeinflusst Pronomen. */
  dogGender?: string;
  trainingsZeitMinuten?: number;
  isSenior?: boolean;
  bekannteSignale?: string[];
}

export interface ComposeArgs {
  problem: ProblemKey;
  planLengthMonths: 1 | 3 | 6;
  dog: DogProfile;
  introText?: string;
  zieleText?: string;
  abschlussText?: string;
  customProblemText?: string;
}

// ── Personalisierungs-Helper ───────────────────────────────────────
// Pronomen-Mapping: die Texte sind standardmaessig mit weiblichen Pronomen
// (sie/ihr/ihre) geschrieben. Bei maennlichem Hund swappen wir auf er/ihm/seine.
// Best-effort: deckt die haeufigsten Faelle ab, einzelne Deklinations-Ecken
// koennen leicht holprig bleiben.
function isMale(gender?: string): boolean {
  if (!gender) return false;
  const g = gender.toLowerCase();
  return (
    g === "m" ||
    g === "male" ||
    g === "rüde" ||
    g === "ruede" ||
    g === "männlich" ||
    g === "maennlich"
  );
}

function personalize(text: string, dog: DogProfile): string {
  let out = text.replace(/\{dogName\}/g, dog.dogName || "deinem Hund");

  if (isMale(dog.dogGender)) {
    // Pronomen-Swap "sie"→"er" / "ihr"→"ihm" / "ihre/ihren"→"seine/seinen".
    // Wir matchen nach Satz-Kontext (vorangehendes Wort), damit wir nur den Hund
    // erwischen und nicht z.B. eine Person ("die Familie hat sie eingeladen").
    const sieToEr: Array<[RegExp, string]> = [
      // Konjunktionen + Verb-Trigger (Hund als Subjekt)
      [/\b(wenn|Wenn) sie\b/g, "$1 er"],
      [/\b(sobald|Sobald) sie\b/g, "$1 er"],
      [/\b(bis|Bis) sie\b/g, "$1 er"],
      [/\b(dass|Dass) sie\b/g, "$1 er"],
      [/\b(damit|Damit) sie\b/g, "$1 er"],
      [/\b(weil|Weil) sie\b/g, "$1 er"],
      [/\b(ob|Ob) sie\b/g, "$1 er"],
      [/\b(als|Als) sie\b/g, "$1 er"],
      [/\b(wo|Wo) sie\b/g, "$1 er"],
      [/\b(falls|Falls) sie\b/g, "$1 er"],
      [/\b(während|Während) sie\b/g, "$1 er"],
      [/\b(bevor|Bevor) sie\b/g, "$1 er"],
      [/\b(nachdem|Nachdem) sie\b/g, "$1 er"],
      // Häufige Verb-Phrasen mit Hund als Subjekt (Subjekt-Verb) — sehr breit
      [/\bsie (ist|war|hat|hatte|wird|wurde|kann|konnte|soll|sollte|muss|musste|darf|durfte|mag|mochte|will|wollte|liegt|sitzt|steht|läuft|kommt|geht|bleibt|schläft|frisst|trinkt|sucht|reagiert|braucht|zeigt|lernt|versteht|kennt|merkt|fühlt|sieht|hört|schaut|blickt|wirkt|scheint|sich|springt|hüpft|rennt|spielt|schluckt|kotet|pinkelt|hebt|schnüffelt|wittert|akzeptiert|verweigert|verteidigt|trägt|probiert|bellt|knurrt|jault|hechelt|wedelt|atmet|folgt|findet|fasst|erkennt|versucht|schafft|macht|nimmt|gibt|reicht|legt|setzt|stellt|wendet|dreht|wartet|achtet|ignoriert|verfolgt|fixiert|orientiert|verliert|gewinnt|holt|bringt|kaut|tappt|winselt|reagiert)\b/g, "er $1"],
      [/\bSie (ist|war|hat|hatte|wird|wurde|kann|konnte|soll|sollte|muss|musste|darf|durfte|mag|mochte|will|wollte|liegt|sitzt|steht|läuft|kommt|geht|bleibt|schläft|frisst|trinkt|sucht|reagiert|braucht|zeigt|lernt|versteht|kennt|merkt|fühlt|sieht|hört|schaut|blickt|wirkt|scheint|sich|springt|hüpft|rennt|spielt|schluckt|kotet|pinkelt|hebt|schnüffelt|wittert|akzeptiert|verweigert|verteidigt|trägt|probiert|bellt|knurrt|jault|hechelt|wedelt|atmet|folgt|findet|fasst|erkennt|versucht|schafft|macht|nimmt|gibt|reicht|legt|setzt|stellt|wendet|dreht|wartet|achtet|ignoriert|verfolgt|fixiert|orientiert|verliert|gewinnt|holt|bringt|kaut|tappt|winselt|reagiert)\b/g, "Er $1"],
      // Verb-Subjekt-Inversion (nach Frage-/Adverbien): "wann schläft sie",
      // "wo läuft sie", "oft braucht sie", "schon kommt sie", "verliert sie Interesse"
      [/\b(schläft|läuft|kommt|geht|bleibt|sitzt|steht|liegt|frisst|trinkt|sucht|reagiert|braucht|zeigt|lernt|versteht|kennt|merkt|fühlt|sieht|hört|schaut|blickt|wirkt|scheint|kaut|wedelt|atmet|bellt|knurrt|jault|winselt|hechelt|tappt|hüpft|springt|rennt|spielt|schluckt|kotet|pinkelt|hebt|schnüffelt|wittert|akzeptiert|verweigert|verteidigt|trägt|bringt|holt|nimmt|gibt|reicht|legt|setzt|stellt|wendet|dreht|wartet|achtet|ignoriert|verfolgt|fixiert|orientiert|verliert|gewinnt|findet|fasst|erkennt|versucht|schafft|macht|hat|ist|war|wird|wurde|kann|konnte|soll|muss|darf|mag) sie\b/g, "$1 er"],
      [/\b(braucht|zeigt|lernt|kennt|reagiert|sucht|frisst|läuft|kommt|geht|verliert|findet|hat|ist|kann|will|soll|muss|darf|mag) sie (das|den|die|ein|einen|eine|genau|wieder|nicht|schon|noch|jetzt|heute|kurz|Interesse|Lust|Energie|Mühe|Spaß|Zeit|Geduld|Hunger|Durst)\b/g, "$1 er $2"],
      // Imperative + Hund-Akkusativ (inkl. konjugierte Formen "lässt sie")
      [/\b(lass|Lass|lasse|Lasse|lässt|Lässt|lassen|Lassen) sie\b/g, "$1 ihn"],
      [/\b(führe|Führe|fuehre|Fuehre|führst|Führst|führt|Führt|führen|Führen) sie\b/g, "$1 ihn"],
      [/\b(bring|Bring|bringe|Bringe|bringst|Bringst|bringt|Bringt|bringen|Bringen) sie\b/g, "$1 ihn"],
      [/\b(locke|Locke|lockst|Lockst|lockt|Lockt|locken|Locken) sie\b/g, "$1 ihn"],
      [/\b(belohne|Belohne|belohnst|belohnt|belohnen) sie\b/g, "$1 ihn"],
      [/\b(lobe|Lobe|lobst|Lobst|lobt|Lobt|loben|Loben) sie\b/g, "$1 ihn"],
      [/\b(rufe|Rufe|rufst|Rufst|ruft|Ruft|rufen|Rufen) sie\b/g, "$1 ihn"],
      [/\b(hole|Hole|hol|Hol|holst|Holst|holt|Holt|holen|Holen) sie\b/g, "$1 ihn"],
      [/\b(nimm|Nimm|nehme|Nehme|nimmst|Nimmst|nimmt|Nimmt|nehmen|Nehmen) sie\b/g, "$1 ihn"],
      [/\b(setze|Setze|setz|Setz|setzt|Setzt|setzen|Setzen) sie\b/g, "$1 ihn"],
      [/\b(streichle|Streichle|streichele|Streichele|streichelst|streichelt|streicheln) sie\b/g, "$1 ihn"],
      [/\b(beobachte|Beobachte|beobachtest|beobachtet|beobachten) sie\b/g, "$1 ihn"],
      [/\b(siehst|sieht|sehen|seht) sie\b/g, "$1 ihn"],
      [/\b(hörst|hört|hören) sie\b/g, "$1 ihn"],
      [/\b(forderst|fordert|fordern) sie\b/g, "$1 ihn"],
      [/\b(lädst|lade|lädt|laden|Lade) sie\b/g, "$1 ihn"],
      [/\b(hältst|hält|halten|haltest) sie\b/g, "$1 ihn"],
      [/\b(weckst|weckt|wecken) sie\b/g, "$1 ihn"],
      [/\b(ignoriere|Ignoriere|ignorierst|ignoriert|ignorieren) sie\b/g, "$1 ihn"],
      [/\b(belohne|belohnst|belohnt|belohnen) sie\b/g, "$1 ihn"],
      [/\b(siehst|sieht|sehen|seht) sie\b/g, "$1 ihn"],
      [/\b(trainier|Trainier|trainiere|Trainiere|trainierst|trainiert|trainieren) sie\b/g, "$1 ihn"],
      [/\b(kennst|kennt|kennen) sie\b/g, "$1 ihn"],
      [/\b(verstehst|versteht|verstehen) sie\b/g, "$1 ihn"],
      [/\b(brauchst|brauchen) sie\b/g, "$1 ihn"],
      [/\b(zeigst|zeigt|zeigen) sie\b/g, "$1 ihm"],
      [/\b(\w+st) sie (zuverlässig|sicher|stabil|locker|ruhig|entspannt|gezielt|aktiv)\b/g, "$1 er $2"],
      // Dativ
      [/\b(mit|zu|von|bei|nach|vor|aus|seit|gegenüber|hinter|neben|unter|über|an|auf) ihr\b/g, "$1 ihm"],
      // Possessiv: "ihr/ihre/ihren/ihrer/ihrem" → "sein/seine/seinen/seiner/seinem"
      [/\bihren\b/g, "seinen"],
      [/\bihrem\b/g, "seinem"],
      [/\bihrer\b/g, "seiner"],
      [/\bihres\b/g, "seines"],
      [/\bihre\b/g, "seine"],
      [/\bIhren\b/g, "Seinen"],
      [/\bIhrem\b/g, "Seinem"],
      [/\bIhrer\b/g, "Seiner"],
      [/\bIhres\b/g, "Seines"],
      [/\bIhre\b/g, "Seine"],
      // "ihr" als Possessiv vor Nomen: alle Faelle catchen AUSSER 2.-Person-
      // Plural ("ihr seid", "ihr habt", "ihr werdet"). Negativ-Lookahead.
      [/\bihr (?!(seid|seiet|sei|wart|werdet|werden|werdend|habt|hattet|haben|hattest|gewesen|wurdet|euch|untereinander)\b)([A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ-]*)/g, "sein $2"],
      [/\bIhr (?!(seid|seiet|sei|wart|werdet|werden|werdend|habt|hattet|haben|hattest|gewesen|wurdet|euch|untereinander)\b)([A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ-]*)/g, "Sein $2"],
      // "ihr" mit kleinem Anfangsbuchstaben — Spezialfall ohne Substantiv-Großschreibung
      // (z.B. "ihr eigenes", "ihr eigenes Komfort-Niveau")
      [/\bihr (eigenes|eigenen|eigener|eigene)\b/g, "sein $1"],
      // Reflexiv-Genitiv: "ihres", "ihrer Sache" etc. werden oben schon abgedeckt
      // Demonstrativ: "ihretwegen" → "seinetwegen"
      [/\bihretwegen\b/g, "seinetwegen"],
    ];
    for (const [re, repl] of sieToEr) {
      out = out.replace(re, repl);
    }
  }

  return out;
}

function filterSuitable(
  pool: ExerciseTemplate[],
  dog: DogProfile
): ExerciseTemplate[] {
  return pool.filter((ex) => {
    const s = ex.suitableFor;
    if (s.minAgeMonths && dog.dogAgeMonths != null && dog.dogAgeMonths < s.minAgeMonths) return false;
    if (s.notForBreeds && dog.dogBreed && s.notForBreeds.includes(dog.dogBreed.toLowerCase())) return false;
    if (s.notForSeniors && dog.isSenior) return false;
    return true;
  });
}

// ── Wochen-Themen: pro Phase 8 unique Templates ─────────────────────
// Jede Woche hat eigenen Schwerpunkt + Übungs-Auswahl + Tages-Routine.
// Für 6-Monats-Plan werden alle 8 verwendet, für 3-Monats die ersten 4,
// für 1-Monats nur die jeweils ersten.

interface WeekTemplate {
  title: string;
  schwerpunkt: string;        // 1-Satz Theme-Beschreibung
  wochenziele: string[];
  tagesplan: string;
  no_gos: string[];
  fortschritt: string[];
  exerciseIds: string[];      // 1-2 IDs aus dem Pool dieser Phase
}

// ── PULLING-spezifische Wochen-Templates ────────────────────────────
// Aufgebaut wie ein Hundetrainer einen Leinenfuehrigkeits-Plan strukturiert:
// erst Werkzeuge (Marker, Belohnungskommunikation), dann KERNTECHNIK
// (Sei-ein-Baum), dann Anwendung im Alltag, dann Generalisierung.
const PULLING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Marker etablieren: das FEIN-Wort",
      schwerpunkt: "Bevor du an der Leine arbeitest, muss {dogName} verstehen wie Belohnungs-Kommunikation funktioniert. Das SCHAU-Signal + ein klares Markerwort FEIN sind die Grundlage für alles was kommt. Ohne diese Basis ist jede Leinen-Übung später nur Frust.",
      wochenziele: [
        "{dogName} reagiert in der Wohnung in unter 2 Sekunden auf SCHAU.",
        "Du nutzt das Markerwort FEIN konsistent im richtigen Moment.",
        "{dogName} verbindet FEIN mit ruhiger Belohnung, nicht mit Hochfahren.",
      ],
      tagesplan: "Drei Mini-Sessions à 3 Minuten über den Tag in verschiedenen Räumen: morgens vor dem Frühstück, mittags vor dem Spaziergang, abends im Wohnzimmer. {dogName} lernt das Signal von Anfang an in mehreren Kontexten. Wichtig: das Markerwort FEIN kommt IMMER im exakten Moment des erwünschten Verhaltens, NICHT erst beim Leckerli-Geben. Das ist die Markersprache.",
      no_gos: [
        "FEIN als Lockwort missbrauchen (Hund herrufen). FEIN bestätigt nur korrektes Verhalten.",
        "Mehr als 7 Wiederholungen am Stück, das überfordert in der ersten Woche.",
        "SCHAU schon draußen einfordern, das ist Phase 2.",
      ],
      fortschritt: [
        "{dogName} hebt den Kopf bei SCHAU innerhalb von 2 Sekunden.",
        "Der Blickkontakt hält mindestens 1 Sekunde.",
        "Bei FEIN orientiert sich {dogName} schon Richtung Leckerli, ohne dass du es zeigst.",
        "Die Tür-Routine fühlt sich ruhiger an, das Drängeln beim Anziehen der Leine wird seltener.",
      ],
      exerciseIds: ["p-schau", "p-stop-and-go"],
    },
    {
      title: "Sei ein Baum: Die Kerntechnik drinnen",
      schwerpunkt: "Das ist die wichtigste Woche des ganzen Plans. {dogName} lernt die Mechanik, die wir später draußen einsetzen: straffe Leine = du stehst still, lockere Leine = es geht weiter. Wenn das drinnen sauber sitzt, ist 80% der Leinen-Arbeit erledigt.",
      wochenziele: [
        "{dogName} stoppt bei straffer Leine und orientiert sich zurück zu dir.",
        "Du selbst bleibst ruhig, schweigsam und ohne Ruck wenn die Leine straff wird.",
        "{dogName} versteht das Prinzip: Ziehen führt nicht weiter, sondern zum Stillstand.",
      ],
      tagesplan: "Zweimal täglich 5-7 Minuten Lockere-Leine-Training in Wohnung oder Flur. Geh in deinem normalen Tempo, Leine locker. Sobald sie straff wird: sofort stehen bleiben, KEINE Worte, KEIN Ruck. Wenn {dogName} nachgibt: ruhig FEIN, weitergehen. Erwarte in den ersten Tagen 15-25 Stopps pro Session. Das ist nicht Frust, das ist Lernkurve.",
      no_gos: [
        "An der Leine rucken oder ziehen wenn sie straff ist. Das macht Ziehen schlimmer.",
        "Schimpfen oder genervt werden. Du bist nur ruhige Konsequenz.",
        "Drinnen 20 Minuten am Stück. Lieber 2x 5 Minuten als 1x 20.",
      ],
      fortschritt: [
        "Stopps pro Session werden weniger: Tag 1: 20+, Tag 7: unter 10.",
        "{dogName} dreht den Kopf bei Stopp und sucht Blickkontakt.",
        "Beim Weitergehen bleibt die Leine länger locker als zu Wochenbeginn.",
      ],
      exerciseIds: ["p-baum", "p-leinenspiel-drinnen"],
    },
    {
      title: "Bei-Fuß-Position als Goldzone",
      schwerpunkt: "Jetzt baust du den Platz neben deinem Bein als wertvollsten Ort beim Gehen auf. Wenn das sitzt, kommt {dogName} freiwillig dorthin, weil es sich lohnt. Das ist die positive Ergänzung zu Sei-ein-Baum: dort warten = stehen bleiben, hier laufen = Belohnung kommt.",
      wochenziele: [
        "{dogName} sucht aktiv die Bei-Fuß-Position auf, weil sie sich lohnt.",
        "Belohnungen kommen IMMER an der Bein-Naht, niemals vor dir.",
        "Du gehst 10 Schritte am Stück mit {dogName} an der Bein-Position drinnen.",
      ],
      tagesplan: "Eine 7-Minuten-Session täglich in Wohnung oder Flur. Beginne im Stand: 10x belohnen wenn {dogName}s Schulter neben deinem Knie ist. Dann 1 Schritt, belohnen. Dann 2 Schritte. Dann 5. Bei 10 Schritten am Stück ohne Vorlaufen: Jackpot von 3 Leckerlis und beenden. Die Hosentasche auf der Hund-Seite bleibt immer voll mit Leckerlis.",
      no_gos: [
        "Belohnung vor dem Körper geben. Damit lockst du nach vorne und förderst Ziehen.",
        "{dogName} an die Bein-Position locken statt zu warten. Sie soll von selbst kommen.",
        "Mit großen Schritten arbeiten, kleine Schritte machen die Position klarer.",
      ],
      fortschritt: [
        "{dogName} kommt nach 1-2 Sekunden Stand selbstständig in Bein-Position.",
        "10 Schritte am Stück ohne Vorlaufen sind machbar.",
        "Die Leine bleibt während der Bei-Fuß-Sequenz durchgehend locker.",
      ],
      exerciseIds: ["p-bei-fuss-belohnen", "p-schau"],
    },
    {
      title: "Tür-Routine + Decke als Anker",
      schwerpunkt: "Wer aufgeregt loszieht, zieht den ganzen Spaziergang. Diese Woche etablierst du eine ruhige Tür-Routine UND eine Entspannungsdecke als Anker für Pausen und später Café-Situationen. Beide Bausteine entspannen den Start und das Tempo.",
      wochenziele: [
        "{dogName} sitzt oder steht ruhig beim Anlegen der Leine.",
        "Die Tür wird nur bei lockerer Leine geöffnet.",
        "Die Decke wird zum klar erkennbaren Ruhe-Ort.",
      ],
      tagesplan: "Tür-Routine bei jedem Spaziergang. Zusätzlich 2x täglich 5 Minuten Decken-Training, idealerweise nach dem Hauptspaziergang oder in einer ruhigen Tageszeit. Die Decke bleibt fest an einem Ort liegen, damit {dogName} sie auch zwischendurch aufsuchen kann. Ruhige Stimme bei Decken-Belohnung, KEIN aufgeregtes Loben.",
      no_gos: [
        "Leine anlegen wenn {dogName} springt, das verstärkt Vorfreude-Hyperaktivität.",
        "Aus Zeitdruck einfach loslaufen, das wirft die ganze Woche zurück.",
        "Decke für Strafe oder Time-out nutzen, das vergiftet den Ort.",
      ],
      fortschritt: [
        "{dogName} setzt sich automatisch beim Leinen-Anlegen.",
        "Die Tür kann ohne Drängeln geöffnet werden.",
        "{dogName} legt sich auf PLATZ ohne Diskussion auf die Decke ab.",
      ],
      exerciseIds: ["p-stop-and-go", "p-decke-drinnen"],
    },
    // Wochen 5-8 nur für 6-Monats-Plan: Vertiefung Fundament
    {
      title: "Sei ein Baum mit Mini-Ablenkung",
      schwerpunkt: "{dogName} kennt Sei-ein-Baum drinnen. Diese Woche testest du das mit kleinen Ablenkungen: jemand klingelt drinnen, Radio läuft, Wäschekorb steht im Weg. Die Mechanik bleibt gleich, aber die Reize werden härter.",
      wochenziele: [
        "{dogName} hält die Mechanik auch mit Hintergrund-Reizen aufrecht.",
        "Du erkennst, ab welchem Ablenkungs-Level deine Hand zu früh oder zu spät reagiert.",
        "Stopps pro Session bleiben unter 10 trotz Ablenkung.",
      ],
      tagesplan: "Eine 6-Minuten-Session täglich, aber bewusst mit einer kleinen Störung: Radio leise an, oder jemand im Nebenraum macht Geräusche, oder du legst einen Karton auf den Boden als optischen Reiz. Die Übung selbst läuft gleich wie in Woche 2, aber {dogName} muss sich konzentrieren trotz Reiz.",
      no_gos: [
        "Schon mit echten Außen-Reizen arbeiten, dazu sind wir noch nicht bereit.",
        "Mehrere Ablenkungen gleichzeitig stapeln, eine reicht.",
        "Bei steigender Stopps-Frequenz weitermachen, das Ablenkungs-Level senken.",
      ],
      fortschritt: [
        "{dogName} bleibt fokussiert trotz Hintergrund-Reiz.",
        "Die Mechanik fühlt sich für euch beide automatisch an.",
        "Du hast eine klare Vorstellung, welche Reize {dogName} noch überfordern werden draußen.",
      ],
      exerciseIds: ["p-baum", "p-schau"],
    },
    {
      title: "Längere Lockere-Leine-Strecken drinnen",
      schwerpunkt: "Aus 5 Minuten werden 10 Minuten. {dogName} entwickelt Ausdauer im aufmerksamen Mitgehen. Außerdem: du übst Belohnungs-Timing — der Punkt an dem du FEIN sagst macht den ganzen Unterschied.",
      wochenziele: [
        "{dogName} schafft 8-10 Minuten lockere Leine drinnen mit max 5 Stopps.",
        "Du belohnst gezielt LANGE locker-Phasen, nicht jeden Schritt.",
        "Bei-Fuß-Position wird länger als 10 Schritte gehalten.",
      ],
      tagesplan: "Eine 10-Minuten-Session täglich in Wohnung + Flur. Plane bewusste Phasen: 2 Minuten Bei-Fuß intensiv belohnt, 3 Minuten freie lockere Leine mit Stopps wo nötig, 2 Minuten Bei-Fuß, 3 Minuten frei. Variiere die Belohnungs-Frequenz: alle 5 Schritte → alle 10 Schritte → alle 20.",
      no_gos: [
        "Belohnungs-Frequenz zu schnell reduzieren. Lieber zu oft als zu selten in dieser Phase.",
        "Ziehen-Episoden 'durchwinken' weil ihr eilig seid. Konsequenz ist alles.",
        "Mit derselben Strecke arbeiten, lieber 2-3 verschiedene Räume.",
      ],
      fortschritt: [
        "{dogName} hält Konzentration über 10 Minuten.",
        "Du erkennst den Unterschied zwischen 'gerade so locker' und 'wirklich locker', und belohnst nur das echte Locker.",
        "Bei-Fuß-Sequenzen werden zur natürlichen Wahl statt zur Aufforderung.",
      ],
      exerciseIds: ["p-leinenspiel-drinnen", "p-bei-fuss-belohnen"],
    },
    {
      title: "Tempo-Wechsel als neue Variable",
      schwerpunkt: "Bisher gingst du in konstantem Tempo. Diese Woche führst du Tempo-Wechsel ein als Aufmerksamkeits-Tool. {dogName} lernt, sich an dir zu orientieren statt vor zu rennen. Das macht Spaziergänge spielerisch und engagiert.",
      wochenziele: [
        "{dogName} passt das Tempo bei Verlangsamung an, ohne zu drängeln.",
        "Bei Tempo-Erhöhung kommt {dogName} mit, ohne vorzulaufen.",
        "Tempo-Wechsel werden zur normalen Variable, nicht zur Verwirrung.",
      ],
      tagesplan: "Eine 7-Minuten-Session täglich in der Wohnung. Beginne normal, dann plötzlich langsamer (halbes Tempo) für 10 Schritte, normal, schneller (anderthalbfaches Tempo) für 10 Schritte, normal. Wechsle bewusst 6-8x pro Session. Belohne JEDEN korrekten Wechsel mit FEIN + Leckerli an der Bein-Position.",
      no_gos: [
        "Tempo-Wechsel ankündigen mit Stimme oder Blick. Sie sollen unvorhersehbar sein.",
        "Mehr als 8 Wechsel pro Session, das überfordert.",
        "Ruckartig wechseln, lieber flüssig aber klar.",
      ],
      fortschritt: [
        "{dogName} reagiert auf Tempo-Wechsel innerhalb von 2 Schritten.",
        "Die Bein-Position bleibt während der Wechsel stabil.",
        "{dogName} schaut häufiger zu dir hoch, weil dein Tempo unberechenbar geworden ist.",
      ],
      exerciseIds: ["p-tempo-wechsel", "p-bei-fuss-belohnen"],
    },
    {
      title: "Fundament-Check & Übergang vorbereiten",
      schwerpunkt: "Letzte Fundament-Woche. Du wiederholst alle Bausteine: Marker, Sei-ein-Baum, Bei-Fuß, Tempo-Wechsel, Tür-Routine, Decke. Was noch wackelt, kriegt diese Woche Extra-Fokus. Phase 2 beginnt mit echten Außen-Reizen, da darf nichts wackeln.",
      wochenziele: [
        "Alle 6 Bausteine funktionieren reproduzierbar drinnen.",
        "Du hast eine Bilanz: was sitzt, was wackelt, was braucht in Phase 2 Extra-Aufmerksamkeit.",
        "{dogName} hat eine erkennbare Trainings-Routine im Tagesablauf.",
      ],
      tagesplan: "Tag 1+2: Sei-ein-Baum + Bei-Fuß kombiniert in einer 10-Min-Session. Tag 3+4: Tempo-Wechsel + Tür-Routine. Tag 5: Marker-Refresh + lockere Leine drinnen. Tag 6+7: Decken-Sessions verlängert. Mache am Wochenende eine ehrliche Bilanz.",
      no_gos: [
        "Schon mit echten Außen-Reizen arbeiten, Phase 2 ist NÄCHSTE Woche.",
        "Schwachstellen ignorieren, sie zeigen sich draußen sofort.",
        "Aus Ungeduld in die nächste Phase springen. Lieber 1 Woche dranhängen wenn nötig.",
      ],
      fortschritt: [
        "Alle Übungen funktionieren ohne Erinnerung an die Grundregeln.",
        "{dogName} bringt Bei-Fuß und Sei-ein-Baum von selbst ein.",
        "Ihr habt eine Routine, die sich für euch beide normal anfühlt.",
      ],
      exerciseIds: ["p-baum", "p-leinenspiel-drinnen"],
    },
  ],
  steigerung: [
    {
      title: "Sei ein Baum: Erster echter Spaziergang",
      schwerpunkt: "Die Stopp-Technik raus an die ruhige Straße. {dogName} wird verwundert sein, dass die alten Zieh-Routinen plötzlich nicht mehr funktionieren. Erwarte 30-50 Stopps in der ersten Session. Jeder Stopp ist ein Lernmoment, nicht ein Rückschritt.",
      wochenziele: [
        "Sei-ein-Baum funktioniert auf einer ruhigen Straße oder im Hof.",
        "Du planst die Spaziergangs-Zeit verdoppelt ein, ohne Stress.",
        "{dogName} versteht: die Mechanik ist drinnen wie draußen identisch.",
      ],
      tagesplan: "Plane den Hauptspaziergang dieser Woche mit doppelter Zeit ein. Wähle eine ruhige Straße ohne Hauptverkehr, ohne Hundeauslaufzone. Geh los wie immer und mache Sei-ein-Baum bei jeder straffen Leine, ohne Wort, ohne Ruck. Mache zwischendurch alle 30 Schritte ein Leckerli an der Bein-Position wenn locker. Beende immer in einer lockeren Phase, nicht nach Ziehen.",
      no_gos: [
        "Schon Innenstadt oder Park mit vielen Hunden, das ist später Phase 3.",
        "Wenn du Zeitdruck hast: lieber zuhause bleiben und nochmal drinnen üben. Stress beim Halter killt die Übung.",
        "Bei Stopp doch noch nachreden oder gucken. Statue heißt Statue.",
      ],
      fortschritt: [
        "Stopps pro Spaziergang werden von Tag 1 (30+) auf Tag 7 (unter 15) weniger.",
        "{dogName} sucht von selbst Blickkontakt nach 2-3 Stopps.",
        "Du fühlst dich beim Stoppen ruhiger und geübter als in den ersten Versuchen.",
      ],
      exerciseIds: ["p-baum-draußen", "p-bei-fuss-belohnen"],
    },
    {
      title: "Penalty Yards: Wenn Stoppen nicht reicht",
      schwerpunkt: "Manche Hunde brauchen mehr als nur Stillstand. Wenn {dogName} weiter zieht trotz 30 Sekunden Statue, drehst du um und gehst zurück. Ziehen wird zur Sackgasse. Diese Technik nutzt du gezielt, nicht ständig — sonst verliert sie ihre Lerner-Wirkung.",
      wochenziele: [
        "Du setzt Penalty Yards bewusst nur bei hartnäckigem Ziehen ein, max 5x pro Spaziergang.",
        "{dogName} versteht: Ziehen führt nicht zum Ziel, sondern weg davon.",
        "Sei-ein-Baum bleibt die erste Wahl, Penalty Yards die zweite.",
      ],
      tagesplan: "Pro Spaziergang: erstmal weiter Sei-ein-Baum konsequent. NUR wenn {dogName} 30+ Sekunden nicht nachgibt, gehst du Penalty-Yards-Modus: ruhig umdrehen, 5 Schritte zurück, dann wieder in die ursprüngliche Richtung mit Belohnungsdusche an der Bein-Position. Maximal 5 Penalty-Episoden pro Spaziergang, sonst wird's frustrierend.",
      no_gos: [
        "Penalty Yards bei JEDEM Ziehen einsetzen, das stumpft ab.",
        "Ruckartig umdrehen oder genervt wirken. Bewegung ist die Botschaft, nicht Strafe.",
        "Beim Wieder-richtig-laufen NICHT belohnen. Die Belohnung beim Wiederaufnehmen ist der ganze Lerneffekt.",
      ],
      fortschritt: [
        "Penalty-Yards-Episoden pro Spaziergang nehmen über die Woche ab.",
        "{dogName} reagiert schneller auf den ersten Stopp (Sei-ein-Baum) und braucht seltener Penalty.",
        "Du nutzt Penalty Yards ohne nachzudenken, wenn die Situation es braucht.",
      ],
      exerciseIds: ["p-penalty-yards", "p-baum-draussen"],
    },
    {
      title: "Bei-Fuß-Belohnen im echten Setting",
      schwerpunkt: "Was drinnen funktioniert hat, jetzt mit Reizen verstärken. Die Bein-Position wird zur Goldzone gegen alles, was draußen lockt. Belohnungsdichte hoch halten, gerade in dieser Phase. Reduktion kommt in Phase 3.",
      wochenziele: [
        "{dogName} sucht die Bein-Position aktiv beim Spaziergang.",
        "Belohnungen kommen alle 15-20 Schritte an der Bein-Naht wenn locker.",
        "Bei Reizen (Auto, Hund in Distanz) bleibt {dogName} länger als 5 Sekunden an der Bein-Position.",
      ],
      tagesplan: "Beginne JEDEN Spaziergang dieser Woche mit 3 Minuten Bei-Fuß-Belohnen intensiv. Hosentasche voll, jede 5-7 Schritte ein Leckerli an der Bein-Naht. Danach Spaziergang normal weiter, aber: jedes Mal wenn {dogName} von selbst in Bein-Position kommt: Jackpot von 3 Leckerlis. {dogName} lernt: diese Position lohnt sich immer.",
      no_gos: [
        "Belohnung vor dem Körper geben. Damit lockst du nach vorne. Immer an der Bein-Naht.",
        "{dogName} an die Position ziehen wenn sie nicht kommt. Lieber stehen bleiben und warten.",
        "Belohnungsdichte zu schnell reduzieren. Phase 2 = Belohnungs-Investition.",
      ],
      fortschritt: [
        "{dogName} kommt an Kreuzungen oder unsicheren Stellen von selbst in Bein-Position.",
        "Du musst nicht mehr aktiv anlocken, die Position ist eine Gewohnheit.",
        "Auch ohne Leckerli-Sichtkontakt orientiert sich {dogName} an dir.",
      ],
      exerciseIds: ["p-bei-fuss-belohnen", "p-baum-draußen"],
    },
    {
      title: "Tempo-Wechsel & Richtungswechsel draußen",
      schwerpunkt: "Tempo-Wechsel und Richtungswechsel werden zu deinen Aufmerksamkeits-Tools. Du wirst unberechenbar in deinem Gehen. Das verhindert, dass {dogName} in einen Auto-Pilot-Modus geht und du an der Leine hinterher gezerrt wirst.",
      wochenziele: [
        "Du baust 5-8 Tempo-Wechsel pro Spaziergang ein.",
        "Richtungswechsel ohne Ansage werden zur normalen Variable.",
        "{dogName} schaut häufiger zu dir, weil dein Tempo unberechenbar ist.",
      ],
      tagesplan: "Plane Spaziergänge bewusst auf Strecken mit Gabelungen, Wegen, Kreuzungen. Wechsle ohne Worte mal langsamer, mal schneller, mal komplett die Richtung. Belohne JEDEN Anpassungs-Moment an der Bein-Position. Wenn {dogName} stur weiter zieht: Sei-ein-Baum oder Penalty Yards einsetzen.",
      no_gos: [
        "Tempo-Wechsel mit Stimme ankündigen, das nimmt den Lerneffekt.",
        "Mehr als 10 Wechsel pro Spaziergang. Lieber Qualität.",
        "Bei Stress oder Erschöpfung weiter Wechsel produzieren.",
      ],
      fortschritt: [
        "{dogName} reagiert auf Tempo-Änderungen innerhalb von 2 Schritten.",
        "Spaziergänge fühlen sich kommunikativer und weniger zäh an.",
        "Du nutzt Wechsel intuitiv als Aufmerksamkeits-Reset.",
      ],
      exerciseIds: ["p-tempo-wechsel", "p-richtungswechsel-außen"],
    },
    {
      title: "Begegnungen aus Distanz arbeiten",
      schwerpunkt: "Erste kontrollierte Begegnungen mit Hunden oder Joggern, aus 15-20m. {dogName} lernt: Reiz erscheint = Leckerli kommt, nicht Aufregung. Diese Woche ist relevant wenn {dogName}s Ziehen mit Reaktivität verbunden ist.",
      wochenziele: [
        "{dogName} bleibt bei Begegnungen aus 15m Distanz unter dem Schwellenwert.",
        "Die Gegenkonditionierung beginnt zu greifen.",
        "Du erkennst {dogName}s individuellen Schwellenwert sicher.",
      ],
      tagesplan: "Zweimal pro Woche eine Begegnungs-Session: such einen Ort, an dem regelmäßig Hunde oder Jogger in der Distanz vorbeikommen (Parkrand, Joggingstrecke). Bei jedem Reiz: SCHAU und durchgehend füttern solange der Reiz sichtbar ist. Reiz weg = Leckerlis weg. Max 5 Begegnungen pro Session.",
      no_gos: [
        "Zu nah ran. Distanz ist alles in dieser Übung.",
        "Über den Schwellenwert hinaus weiterüben, das ist Rückschritt.",
        "Belohnung erst NACH Reaktion. Das ändert die emotionale Verknüpfung nicht.",
      ],
      fortschritt: [
        "{dogName} schaut bei Reizen erwartungsvoll zu dir, statt zu fixieren.",
        "Stress-Anzeichen werden seltener und kürzer.",
        "Begegnungen werden ohne Bellen oder starkes Ziehen gemeistert.",
      ],
      exerciseIds: ["p-gegenkonditionierung", "p-baum-draußen"],
    },
    {
      title: "Bogen für enge Begegnungen",
      schwerpunkt: "Manche Begegnungen lassen sich nicht aus 15m abarbeiten — der Gegenverkehr ist da. {dogName} bekommt eine konkrete Handlungs-Strategie: den Bogen. Statt direkt aufeinander zu gehen, geht ihr im Halbkreis aus. Das gibt {dogName} Sicherheit.",
      wochenziele: [
        "{dogName} folgt dem Signal BOGEN ohne Widerstand.",
        "Der Bogen wird präventiv eingesetzt, nicht erst wenn Stress da ist.",
        "Du fühlst dich auf Spaziergängen mit Gegenverkehr handlungsfähiger.",
      ],
      tagesplan: "Übe den Bogen die ersten Tage trocken: an Laternen, Mülleimern, Bänken. Sobald die Bewegung sitzt, setze ihn aktiv bei realen Begegnungen ein. 2-3 Bogen-Situationen pro Spaziergang. Nach jeder erfolgreichen Begegnung: Jackpot von 3-4 Leckerlis an der Bein-Position.",
      no_gos: [
        "Bogen mit Anspannung einsetzen, das überträgt sich.",
        "Bogen erst einsetzen wenn {dogName} schon angespannt ist, lieber 10m vorher.",
        "Direkten Augenkontakt mit dem entgegenkommenden Hund oder Mensch.",
      ],
      fortschritt: [
        "{dogName} bewegt sich auf BOGEN automatisch in den Halbkreis.",
        "Begegnungen mit Bogen verlaufen erkennbar entspannter.",
        "Du nutzt den Bogen reflexartig, wenn die Situation es braucht.",
      ],
      exerciseIds: ["p-bogen", "p-baum-draussen"],
    },
    {
      title: "Längere Trainings-Spaziergänge",
      schwerpunkt: "Bis jetzt waren Trainings-Phasen 10-15 Minuten lang. Diese Woche werden sie auf 25-30 Minuten erweitert. {dogName} entwickelt Ausdauer im aufmerksamen Mitgehen. Die Belohnungs-Dichte bleibt aber hoch.",
      wochenziele: [
        "{dogName} bleibt 25-30 Minuten am Stück konzentriert.",
        "Pausen werden aktiv genutzt als Belohnung (Schnüffeln, Trinken).",
        "Die Belohnungs-Dichte ist klar gestaffelt: erste 10 Min hoch, mittlere 10 Min mittel, letzte 5 Min wieder hoch.",
      ],
      tagesplan: "An 3 Tagen dieser Woche einen 25-30-Minuten-Trainings-Spaziergang. Aufbau: 5 Min Bei-Fuß-Aufwärmen mit hoher Belohnungs-Frequenz, 15 Min normale Strecke mit Sei-ein-Baum und Tempo-Wechsel, 5 Min Bei-Fuß-Runterkommen. Bewusste Schnüffel-Pausen alle 7-10 Minuten als BELOHNUNG für lockere Leine.",
      no_gos: [
        "25 Minuten am Stück ohne Pausen, das ermüdet zu schnell.",
        "Bei sichtbarer Erschöpfung weitermachen.",
        "Pausen ohne Auflöse-Signal lassen. {dogName} braucht klare Übergänge.",
      ],
      fortschritt: [
        "{dogName} hält die volle Übungs-Phase ohne Konzentrations-Einbruch durch.",
        "Pausen werden aktiv zur Erholung genutzt, nicht zur Aufregung.",
        "Die Belohnungs-Frequenz kann in der mittleren Phase reduziert werden.",
      ],
      exerciseIds: ["p-baum-draußen", "p-tempo-wechsel"],
    },
    {
      title: "Festigung Steigerung",
      schwerpunkt: "Letzte Steigerungs-Woche. Du kombinierst alle Werkzeuge: Sei-ein-Baum, Penalty Yards, Bei-Fuß, Tempo-Wechsel. {dogName} hat ein komplettes Repertoire. Phase 3 = Anwendung im echten Alltag, ohne kontrollierte Übungs-Sessions.",
      wochenziele: [
        "Alle Werkzeuge können flexibel kombiniert werden.",
        "Du erkennst klar, welches Werkzeug welche Situation braucht.",
        "{dogName} setzt einzelne Strategien (vor allem Bei-Fuß-Suche) schon teilweise selbstständig ein.",
      ],
      tagesplan: "Jeder Spaziergang dieser Woche ist ein Mini-Test. Beobachte aktiv: welche Strategie greift in welcher Situation? Mache am Ende der Woche eine Bilanz: was funktioniert, was wackelt. Notiere typische Zieh-Situationen die übrig bleiben. Die sind dein Schwerpunkt für Phase 3.",
      no_gos: [
        "Werkzeuge nur einzeln einsetzen, sie sollen flexibel kombiniert werden.",
        "{dogName} mit zu vielen neuen Reizen überfordern. Phase 3 wagt sich.",
        "Belohnungs-Frequenz zu früh stark reduzieren. Das passiert in Phase 3.",
      ],
      fortschritt: [
        "{dogName} setzt mindestens 2 Strategien pro Spaziergang aktiv ein.",
        "Du musst weniger eingreifen, {dogName} reguliert sich häufiger selbst.",
        "Spaziergänge fühlen sich erkennbar entspannter an als vor 8 Wochen.",
      ],
      exerciseIds: ["p-baum-draußen", "p-penalty-yards"],
    },
  ],
  generalisierung: [
    {
      title: "Lockere Leine im echten Alltagsspaziergang",
      schwerpunkt: "Phase 3 ist Anwendung. Alle Werkzeuge kommen jetzt auf einer normalen Strecke zum Einsatz, ohne kontrollierte Übungs-Sessions. Schnüffel-Pausen werden zur natürlichsten Belohnung: lockere Leine = du darfst hin und schnüffeln.",
      wochenziele: [
        "{dogName} bewältigt einen 25-Minuten-Alltagsspaziergang mit max 5 echten Zieh-Episoden.",
        "Du nutzt Schnüffel-Pausen bewusst als Belohnung für lockere Leine.",
        "Werkzeuge (Stopp, Bei-Fuß, Tempo) werden flüssig kombiniert ohne Nachdenken.",
      ],
      tagesplan: "An 5 von 7 Tagen einen normalen 25-30-Minuten-Spaziergang auf bekannter Strecke. Starte mit 2-3 Minuten Bei-Fuß-Belohnen, dann frei laufen mit Sei-ein-Baum bei straffer Leine. Alle 30-40 Schritte ein Leckerli an der Bein-Position wenn locker. Schnüffel-Pausen aktiv als Belohnung: 'lockere Leine = du darfst hin und schnüffeln'.",
      no_gos: [
        "Bei Stress oder Eile die Werkzeuge weglassen. Lieber Strecke kürzen.",
        "Schnüffel-Pausen mitten in Zieh-Phase erlauben. Erst Locker-Werden, dann darf geschnuppert werden.",
        "Belohnungs-Frequenz schon stark reduzieren, das passiert in Woche 4.",
      ],
      fortschritt: [
        "Zieh-Episoden pro Spaziergang sind im einstelligen Bereich.",
        "{dogName} sucht von selbst die Bein-Position an unsicheren Stellen.",
        "Du nutzt Schnüffel-Pausen intuitiv als Belohnungs-Instrument.",
      ],
      exerciseIds: ["p-lockere-leine-außen", "p-penalty-yards"],
    },
    {
      title: "Verschiedene Strecken: Generalisierung",
      schwerpunkt: "Was auf der Hausstrecke funktioniert, muss auch auf einer neuen Strecke funktionieren. Erst durch Generalisierung wird Lockere-Leine zur echten Fähigkeit, nicht zur ortsgebundenen Routine.",
      wochenziele: [
        "{dogName} überträgt Lockere-Leine auf mindestens 2 neue Strecken diese Woche.",
        "Du erkennst, dass auf neuen Wegen Stopps wieder häufiger werden — das ist normal.",
        "Die Belohnungs-Frequenz steigt auf neuen Strecken bewusst kurz wieder an.",
      ],
      tagesplan: "Plane in dieser Woche bewusst 3 verschiedene Strecken: deine gewohnte, eine neue im Nachbarort/Park, eine in der Stadt. Pro Strecke max 25 Minuten. Auf neuen Strecken: Belohnungs-Frequenz wie in Phase 2 (alle 15 Schritte). Stopps wieder häufiger erwarten. Werkzeuge bleiben gleich, Setting wechselt.",
      no_gos: [
        "Erwarten dass die neue Strecke wie die gewohnte läuft.",
        "Drei neue Strecken am selben Tag, das überfordert.",
        "Auf einer neuen Strecke die Belohnungs-Frequenz wie auf der gewohnten lassen.",
      ],
      fortschritt: [
        "{dogName} bewältigt eine völlig neue Strecke mit weniger als 10 Stopps.",
        "Du fühlst dich auch auf unbekannten Wegen handlungsfähig.",
        "Zieh-Pattern reduziert sich strecken-übergreifend.",
      ],
      exerciseIds: ["p-lockere-leine-außen", "p-richtungswechsel-außen"],
    },
    {
      title: "Vorbeigehen an Menschen ohne Bogen",
      schwerpunkt: "Bei Hunden mit reaktivem Ziehen-Anteil ist das die nächste Stufe nach BOGEN. {dogName} lernt direkt an Menschen aus 3-5m vorbeizugehen, ohne Bogen, ohne Tempo-Wechsel. Falls {dogName} rein zieht ohne Reaktivität: einfach normale Lockere-Leine-Arbeit weiterführen.",
      wochenziele: [
        "{dogName} geht direkt an Menschen aus 3-5m vorbei, konstantes Tempo.",
        "Begegnungen werden zur normalen Routine, nicht zum Stress-Event.",
        "Du erkennst {dogName}s Schwellenwert für Direktbegegnungen.",
      ],
      tagesplan: "An 4 von 7 Tagen: such bewusst 2-3 direkte Begegnungsmöglichkeiten an wenig frequentierten Wegen. Bereite {dogName} schon aus 15m mit SCHAU + Belohnung an der Bein-Position vor. Halte das Tempo konstant — nicht schneller, nicht langsamer. Während der Passage: dauernde kleine Leckerlis (Pippeling). Nach der Passage: Jackpot.",
      no_gos: [
        "Direkt in voller Innenstadt versuchen, das ist zu viel.",
        "Bei Stress weitermachen, jederzeit zurück zum BOGEN.",
        "Direkten Augenkontakt mit dem Gegenüber. {dogName} liest das als Spannung.",
      ],
      fortschritt: [
        "{dogName} geht ohne sichtbaren Stress an Menschen vorbei.",
        "Du musst während der Passage nicht mehr ständig Strategie wechseln.",
        "Begegnungen werden zur normalen Spaziergangs-Routine.",
      ],
      exerciseIds: ["p-vorbeigang", "p-lockere-leine-außen"],
    },
    {
      title: "Belohnungs-Reduktion bewusst",
      schwerpunkt: "Jetzt reduzierst du systematisch die Belohnungs-Frequenz. {dogName} lernt, dass die Strategie auch ohne Dauer-Leckerli funktioniert. Wichtig: niemals KOMPLETT weglassen — nur seltener und unvorhersehbarer.",
      wochenziele: [
        "Belohnungen kommen alle 50-80 Schritte statt alle 15-20.",
        "Spitzenleistungen werden weiterhin mit Jackpot belohnt.",
        "{dogName} hält die Strategien auch bei dünneren Belohnungs-Lücken.",
      ],
      tagesplan: "Reduziere bewusst und schrittweise: Tag 1-2 alle 30 Schritte, Tag 3-4 alle 50, Tag 5-7 alle 60-80 unregelmäßig. Bei Spitzenleistungen (lange Locker-Phase, gutes Vorbeigehen) immer noch Jackpot von 3-4 Leckerlis. Bei Bröckeln (mehr Pull, schwächere Bei-Fuß-Suche): einen Schritt zurück zur höheren Frequenz.",
      no_gos: [
        "Belohnungen komplett weglassen, das ist zu schnell.",
        "Bei Bröckeln durchziehen statt anzupassen.",
        "Die Reduktion an einem stressigen Tag oder schwierigen Ort testen.",
      ],
      fortschritt: [
        "{dogName} setzt Strategien auch bei dünneren Belohnungs-Lücken ein.",
        "Spaziergänge fühlen sich freier an, weniger wie Training.",
        "Du steckst weniger Leckerlis in die Hand, ohne Qualitäts-Einbußen.",
      ],
      exerciseIds: ["p-wartungs-spaziergang", "p-lockere-leine-aussen"],
    },
    {
      title: "Schwierige Orte gezielt",
      schwerpunkt: "Orte, die bisher gemieden wurden: Tierarzt-Eingang, Bushaltestelle, vor Schulen. Diese Woche werden sie zu möglichen Orten, nicht zu Vermeidungs-Zonen. Das macht den Alltag wirklich besser.",
      wochenziele: [
        "{dogName} bewältigt einen schwierigen Ort 5 Minuten ruhig.",
        "Du kennst {dogName}s Reaktion auf die für euch wichtigsten Hot-Spots.",
        "Die schwierigen Orte werden zur möglichen Option, nicht zur Tabu-Zone.",
      ],
      tagesplan: "Wähle pro Tag genau einen schwierigen Ort und übe dort 5 Minuten. Tag 1: Tierarzt-Eingangsbereich (ohne Termin). Tag 2: Bushaltestelle 200m entfernt. Tag 3: Park-Eingang zur Hundeauslauf-Stoßzeit. Belohnungs-Frequenz wieder höher (wie Phase 2). Schon der Aufenthalt ohne große Eskalation ist Erfolg.",
      no_gos: [
        "Direkt in den Tierarzt rein, nur den Außenbereich nutzen.",
        "{dogName} zwingen, einen Ort auszuhalten der zu viel ist.",
        "Mehrere schwierige Orte am selben Tag stapeln.",
      ],
      fortschritt: [
        "{dogName} bewältigt jeden gewählten Hot-Spot 5 Minuten ohne Eskalation.",
        "Du gehst entspannter an Orte die früher Stress bedeuteten.",
        "Der Alltag wird flexibler, weil weniger Zonen tabu sind.",
      ],
      exerciseIds: ["p-cafe", "p-vorbeigang"],
    },
    {
      title: "Café-Situation als Königsdisziplin",
      schwerpunkt: "Mit der Decke als mobiler Anker lernt {dogName}, 15 Minuten in einer Café-Situation ruhig zu liegen. Das ist die schwierigste Übung des Plans und macht euer Leben langfristig deutlich entspannter.",
      wochenziele: [
        "{dogName} legt sich auf die Decke und bleibt 15 Minuten liegen.",
        "Die Belohnungs-Frequenz wird langsam reduziert ohne dass {dogName} aufsteht.",
        "Das Café wird zur normalen Möglichkeit, nicht zum Hindernis.",
      ],
      tagesplan: "Beginne 2x diese Woche mit einer Mini-Café-Übung im Park: Decke mit, ablegen, daneben hinsetzen für 5 Minuten. Steigere langsam auf einen ruhigen Café-Außenbereich am Vormittag. Belohne in den ersten 3 Minuten alle 15 Sekunden, dann alle 30 Sekunden, dann alle Minute. Beende immer in einer ruhigen Situation, nicht beim Aufstehen.",
      no_gos: [
        "Direkt zur Lunch-Zeit ins Hauptstraßen-Café.",
        "Ohne Decke arbeiten, der Anker ist essenziell.",
        "Aus dem Café flüchten weil's eng wird, sondern ruhig beenden.",
      ],
      fortschritt: [
        "{dogName} liegt 15 Minuten ohne Aufstehen auf der Decke.",
        "Geräusche und Bewegung um euch herum stören kaum.",
        "Du kannst entspannt einen Kaffee trinken, ohne ständig zu kontrollieren.",
      ],
      exerciseIds: ["p-cafe", "p-decke-drinnen"],
    },
    {
      title: "Stadtbummel als finale Königsdisziplin",
      schwerpunkt: "Eine moderate Fußgängerzone. Alle Werkzeuge in echtem Stadtleben. Wenn das funktioniert, hast du keinen Ziehen-Hund mehr, sondern einen Hund der mit dir durch die Welt geht.",
      wochenziele: [
        "{dogName} bewältigt einen 20-25-Minuten-Bummel in moderater Stadt.",
        "Werkzeuge werden flexibel kombiniert je nach Situation.",
        "Ihr findet einen Stadt-Spaziergang der sich für euch beide gut anfühlt.",
      ],
      tagesplan: "Plane einmal in der Woche einen bewussten Stadt-Spaziergang, am besten Sonntagvormittag wenn weniger los ist. Maximal 25 Minuten. Beginne mit 3 Minuten Bei-Fuß-Aufwärmen vor der Tür. Schnüffel-Pausen aktiv als Runterkommen zwischen Reiz-Phasen einsetzen. Beende immer in einer ruhigen Ecke.",
      no_gos: [
        "Den Stadt-Spaziergang als Pflichttermin durchziehen, lieber abbrechen.",
        "Ego-Trip: zeigen wollen, dass {dogName} alles kann.",
        "Andere Hunde direkt provozieren, in Stadt sind Begegnungen oft eng.",
      ],
      fortschritt: [
        "{dogName} bewegt sich in moderater Stadt überraschend entspannt.",
        "Du fühlst dich vorbereitet auch auf unvorhersehbare Reize.",
        "Stadt-Bummel werden zur möglichen Routine, nicht zur Sondernutzung.",
      ],
      exerciseIds: ["p-stadt-spaziergang", "p-lockere-leine-außen"],
    },
    {
      title: "Übergang in den Wartungsmodus",
      schwerpunkt: "Letzte Woche. Was hier passiert, soll dauerhaft funktionieren. Du übergibst Verantwortung schrittweise an {dogName}, ohne dass die Routinen einbrechen. Wartungsplan für die kommenden Monate steht.",
      wochenziele: [
        "{dogName} setzt die Strategien selbstständig im Alltag ein.",
        "Du musst nicht mehr aktiv trainieren, sondern lebst die Routinen.",
        "Ihr habt einen klaren Wartungs-Plan für die kommenden Monate.",
      ],
      tagesplan: "Reduziere aktives Training auf das Minimum. Beobachte stattdessen: was läuft von selbst? Wo musst du noch eingreifen? Plane einen Wartungs-Rhythmus: alle 3-4 Monate ein bewusster Übungs-Spaziergang an einem schwierigen Ort. Das hält die Verknüpfungen frisch und du merkst früh wenn etwas einzubrechen droht.",
      no_gos: [
        "Schlagartig alle Routinen weglassen, das ist Rückschritt-Gefahr.",
        "Sich entspannen und nicht mehr beobachten, kleine Rückfälle früh erkennen.",
        "Den Wartungs-Plan auf nie verschieben, kurze Sessions reichen.",
      ],
      fortschritt: [
        "{dogName} setzt die Strategien ohne aktive Anleitung im Alltag ein.",
        "Du fühlst dich, als ob ihr ein eingespieltes Team seid.",
        "Spaziergänge sind kein Training mehr, sondern gemeinsames Leben.",
      ],
      exerciseIds: ["p-wartungs-spaziergang", "p-lockere-leine-aussen"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// ENERGY (zu viel Energie / Übererregung) — Auslastung & Ruhe-Training
// ────────────────────────────────────────────────────────────────────
const ENERGY_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Energie-Inventur & Schlaf-Hygiene",
      schwerpunkt: "Bevor du an Auslastung arbeitest, schau dir den Tagesablauf an. Erwachsene Hunde brauchen 16-20 Stunden Ruhe pro Tag. Hyperaktive Hunde schlafen oft ZU WENIG. Das ist der häufigste Hund-Fehler überhaupt.",
      wochenziele: [
        "Du dokumentierst eine Woche lang {dogName}s Tagesablauf inkl. Schlaf-Phasen.",
        "Bewusste Ruhe-Phasen werden eingebaut, mind. 14h pro Tag.",
        "Aktivitäts-Phasen werden zwischen Bewegung, Nasenarbeit, Kopfarbeit, Sozial-Kontakt strukturiert.",
      ],
      tagesplan: "Notiere 7 Tage lang in einem kleinen Notizheft: wann wacht {dogName} auf, wann schläft sie, wie lange aktiv, was war die Aktivität (Spaziergang, Spiel, Reizüberflutung). Am Ende der Woche siehst du klar: ist mehr Ruhe nötig? Mehr Mentale Auslastung? Aufgeregte Phasen vor dem Schlafen kappen.",
      no_gos: [
        "Sofort 'mehr Action' machen, ohne erst zu beobachten.",
        "{dogName} ständig stimulieren, weil sie zappelig wirkt — oft braucht sie genau das Gegenteil.",
        "Mehrere aufregende Reize hintereinander stapeln (Spielen + Spaziergang + Besuch am selben Tag).",
      ],
      fortschritt: [
        "Du hast einen klaren Überblick über {dogName}s Tagesrhythmus.",
        "Bewusste Ruhe-Phasen sind im Tagesablauf etabliert.",
        "Du erkennst übermüdete und unterstimulierte Phasen.",
        "{dogName} bringt die WARTE-Geduld bei Futter oder Tür stabil über 5 Sekunden.",
      ],
      exerciseIds: ["e-entspannungs-marker", "e-warte-impuls"],
    },
    {
      title: "Futter wird zur Beschäftigung",
      schwerpunkt: "Statt {dogName} die Schüssel hinzustellen, machst du jede Mahlzeit zur Nasenarbeit. 1 Mahlzeit als Suchspiel + 1 als Kong/Schnüffelmatte ersetzt 1 Stunde stumpfes Toben.",
      wochenziele: [
        "Mind. 1 Mahlzeit pro Tag als Such-Spiel in der Wohnung.",
        "Mind. 1 Mahlzeit pro Tag aus Kong oder Schnüffelmatte.",
        "{dogName} schlingt nicht mehr aus der Schüssel, sondern arbeitet 20-30 Min an Futter.",
      ],
      tagesplan: "Morgens: Schnüffelmatte mit Trockenfutter. {dogName} arbeitet selbstständig. Abends: Trockenfutter portionsweise im Wohnzimmer verteilen, SUCH-Signal, 20 Min Beschäftigung. Mittag (optional): Kong mit Nassfutter, gefroren wenn schwerer. Hebt {dogName}s Tagespegel von 30 Sek auf 60 Min produktive Beschäftigung.",
      no_gos: [
        "{dogName} während des Suchens unterstützen oder Hinweise geben.",
        "Suchspiel als 'schneller Snack' aufbauen — er soll lange dauern.",
        "Schnüffelmatte oder Kong nutzen wenn {dogName} schon hyperaktiv ist, lieber in moderaten Phasen.",
      ],
      fortschritt: [
        "{dogName} fragt selbst nach der Mahlzeit-Routine.",
        "Nach Suchspiel oder Kong ist {dogName} ruhiger als vorher.",
        "Du hast die Schüssel-Fütterung aus dem Alltag eliminiert.",
      ],
      exerciseIds: ["e-such-drinnen", "e-kong-mahlzeit"],
    },
    {
      title: "WARTE: Impulskontrolle aufbauen",
      schwerpunkt: "Impulskontrolle ist die mentale Bremse, die hyperaktiven Hunden oft fehlt. WARTE vor Futter, Tür, Spielzeug baut diese Bremse über Wochen auf. Frust aushalten = Ruhe erlernen.",
      wochenziele: [
        "{dogName} hält 10 Sek WARTE vor dem Futternapf.",
        "WARTE wird vor 3 verschiedenen Situationen täglich eingesetzt.",
        "{dogName} bleibt unter steigender Frustration ruhig.",
      ],
      tagesplan: "Morgens: WARTE vor dem Frühstücks-Napf, langsam von 1 Sek auf 10 Sek steigern über die Woche. Mittags: WARTE vor der Haustür beim Rausgehen. Abends: WARTE vor dem Lieblings-Spielzeug, dann Freigabe. Pro Tag 3-4 Situationen, niemals länger als 15 Sek halten.",
      no_gos: [
        "WARTE als reine Strafe nutzen, ohne Auflösung.",
        "Zu lange Halte-Zeiten in der ersten Woche, das frustriert.",
        "WARTE wenn {dogName} schon im Hyper-Modus ist — erst herunterkommen lassen.",
      ],
      fortschritt: [
        "{dogName} bleibt 10 Sek ruhig vor dem Futternapf sitzen.",
        "Frust-Verhalten (Winseln, Springen) reduziert sich von Tag 1 zu Tag 7 deutlich.",
        "Du nutzt WARTE intuitiv in Alltags-Situationen.",
      ],
      exerciseIds: ["e-warte-impuls", "e-entspannungs-marker"],
    },
    {
      title: "Entspannungs-Anker konditionieren",
      schwerpunkt: "Wir verknüpfen ein Wort wie WUNDERBAR mit Ruhe-Zuständen. Später kannst du das Wort einsetzen, um {dogName} runterzubringen. Klassisches Klassik-Konditionieren wie bei Pavlovs Hunden.",
      wochenziele: [
        "Du verknüpfst täglich 5-7 mal das Wort WUNDERBAR mit echten Ruhe-Momenten.",
        "{dogName} reagiert nach 7-10 Tagen erkennbar auf das Wort.",
        "Der Marker steht als Werkzeug bereit, um Aufregung zu kappen.",
      ],
      tagesplan: "Den ganzen Tag über beobachte: ist {dogName} entspannt? (liegt, Augen halb zu, ruhiger Atem). In genau diesen Momenten: ruhig hingehen, WUNDERBAR in tiefer warmer Stimme, weicher Leckerli ans Maul. Nicht hochholen, nicht aufregen. Pro Tag mind. 5 solche Verknüpfungen.",
      no_gos: [
        "Das Wort in Aufregung benutzen, bevor es konditioniert ist — verwässert die Verknüpfung.",
        "{dogName} aufregen, um dann den Anker einzusetzen — Reihenfolge ist umgekehrt.",
        "Hochwertige Leckerlis nutzen — bei Ruhe-Konditionierung passen ruhige weiche Leckerlis besser.",
      ],
      fortschritt: [
        "Bei WUNDERBAR wendet {dogName} den Kopf, ist aufmerksam ohne hochzufahren.",
        "Die Verknüpfung Ruhe + Wort beginnt zu greifen.",
        "Du nutzt den Marker intuitiv in passenden Momenten.",
      ],
      exerciseIds: ["e-entspannungs-marker", "e-warte-impuls"],
    },
    // 6-Monats: Vertiefungen
    {
      title: "Erste Shape-Tricks: Kopfauslastung",
      schwerpunkt: "Bei Shape lernt {dogName} eigenständig: was bringt mir den Klick? Das ist die intensivste Kopfauslastung überhaupt. Nach 5-7 Min Shape ist auch ein junger Hund müde.",
      wochenziele: [
        "{dogName} kennt 1 neuen Trick (Pfötchen, Touch oder Dreh-Dich).",
        "Shape-Sessions werden zur regelmäßigen Routine.",
        "Du erkennst, wann {dogName} mental ausgelastet ist (gähnen, Pause-machen).",
      ],
      tagesplan: "Eine 5-7 Min Shape-Session täglich, am besten am Nachmittag oder Abend. Wähle einen einfachen Trick. Pro Session 10-15 Klicks. Beende immer in einem Erfolgs-Moment. Nach der Session: Runterkommen auf der Decke.",
      no_gos: [
        "Frustriert werden wenn {dogName} nicht versteht. Lieber Anforderung senken.",
        "Mehrere Tricks gleichzeitig anfangen — einen sauber etablieren.",
        "Shape-Session länger als 10 Min — überfordert mental.",
      ],
      fortschritt: [
        "{dogName} versteht das Klicker-Prinzip: kleine Bewegungen führen zur Belohnung.",
        "Sie probiert aktiv Verhaltensweisen aus.",
        "Nach Shape-Session ist {dogName} sichtbar müder als nach körperlicher Aktivität.",
      ],
      exerciseIds: ["e-shape-trick", "e-warte-impuls"],
    },
    {
      title: "Schnüffelmatte als tägliche Routine",
      schwerpunkt: "Schnüffelmatten und andere intelligente Spielzeuge werden zum festen Tagesritual. Diese Woche etablierst du 2-3 verschiedene davon und rotierst.",
      wochenziele: [
        "{dogName} kennt mind. 2 verschiedene Beschäftigungs-Werkzeuge.",
        "Du rotierst die Werkzeuge, damit es nicht stumpf wird.",
        "{dogName} arbeitet 20-30 Min pro Beschäftigung selbstständig.",
      ],
      tagesplan: "Investiere in 2-3 Tools: Schnüffelmatte, Kong, Intelligenz-Spielzeug (z.B. Trixie Mover). Rotation alle 2-3 Tage. Pro Tag mind. 1 Beschäftigung damit. Idealerweise vor Phase wo {dogName} sonst hochfährt (Tür-Aufmachen, Klingeln).",
      no_gos: [
        "Nur 1 Tool nutzen — wird schnell langweilig.",
        "{dogName} während der Beschäftigung stören oder helfen.",
        "Beschäftigungs-Tools nicht reinigen — Schimmel, Bakterien.",
      ],
      fortschritt: [
        "{dogName} hat klare Favoriten unter den Tools.",
        "Die Routine ist im Tagesablauf etabliert.",
        "Beschäftigungs-Tools werden zu echten Ruhepausen-Vorbereitungen.",
      ],
      exerciseIds: ["e-such-drinnen", "e-kong-mahlzeit"],
    },
    {
      title: "Kombinations-Beschäftigung",
      schwerpunkt: "Du kombinierst jetzt Bewegung + Nasenarbeit + Kopfarbeit in einer Trainings-Einheit. Statt 1h stumpf laufen: 30 Min mit 5 verschiedenen Aktivitäten gemischt.",
      wochenziele: [
        "{dogName} bewältigt 30 Min mit 4-5 verschiedenen Aktivitäten gemischt.",
        "Du erkennst, was {dogName} am meisten erschöpft (meist Nasenarbeit + Shape).",
        "Spaziergänge werden zu vielseitigen Trainings-Sessions.",
      ],
      tagesplan: "Mache 1x täglich einen 30-Min Spaziergang als 'Auslastungs-Hybrid': 5 Min stumpf laufen + 10 Min Such-Spiel mit Leckerlis im Gras + 5 Min Trick-Wiederholung + 5 Min lockerer Spaziergang + 5 Min Runterkommen beim Sitzen unter einem Baum.",
      no_gos: [
        "Aktivitäten zu schnell wechseln — {dogName} kommt nicht rein.",
        "Im Wechsel hektisch werden, ruhiger Übergang ist wichtig.",
        "Nach dieser Session noch eine zweite anstrengende — wäre Übermüdung.",
      ],
      fortschritt: [
        "{dogName} ist nach 30 Min sichtbar erschöpft.",
        "Nach Runterkommen findet {dogName} schnell in Ruhe.",
        "Spaziergänge fühlen sich erfüllend an, nicht wie eine Pflicht.",
      ],
      exerciseIds: ["e-such-drinnen", "e-shape-trick"],
    },
    {
      title: "Fundament-Check",
      schwerpunkt: "Letzte Fundament-Woche. Du wiederholst alle Bausteine: Schlaf-Hygiene, Such-Spiel, Kong, WARTE, Entspannungs-Marker. Was wackelt kriegt Extra-Fokus.",
      wochenziele: [
        "Alle Bausteine sind in der täglichen Routine etabliert.",
        "Du erkennst klar Schwachstellen, die in Phase 2 anzugehen sind.",
        "{dogName}s Ruhe-Niveau ist erkennbar besser als vor 4 Wochen.",
      ],
      tagesplan: "Mache eine ehrliche Bilanz: was läuft täglich (häkchen), was eher selten? Schlaf-Stunden gezählt? Such-Spiel etabliert? WARTE klappt in 3+ Situationen? Entspannungs-Marker konditioniert? Falls etwas wackelt: diese Woche Extra-Fokus drauf.",
      no_gos: [
        "Aus Ungeduld in Phase 2 springen — Phase 1 ist Fundament.",
        "Mehrere Schwachstellen gleichzeitig — fokussiere auf die eine wichtigste.",
        "Den Plan komplett liegen lassen, weil eine Woche schiefging.",
      ],
      fortschritt: [
        "Du fühlst dich als 'Auslastungs-Manager' mit Werkzeugen.",
        "{dogName} ist deutlich ruhiger als zu Plan-Start.",
        "Ihr habt eine Routine, die sich für euch beide normal anfühlt.",
      ],
      exerciseIds: ["e-entspannungs-marker", "e-such-drinnen"],
    },
  ],
  steigerung: [
    {
      title: "Nasenarbeit draußen: Spuren-Suche-Basis",
      schwerpunkt: "Nasenarbeit draußen ist die intensivste Auslastung überhaupt. 15-20 Min Spuren-Suche ersetzen 60 Min stumpfes Laufen, plus {dogName} ist mental erschöpft und zufrieden.",
      wochenziele: [
        "{dogName} folgt einer 10-15m Futterspur selbstständig.",
        "Spuren-Such-Einheit pro Spaziergang etabliert.",
        "{dogName} ist nach der Übung sichtbar erschöpft.",
      ],
      tagesplan: "Pro Spaziergang 1 Spuren-Such-Einheit: 10m Futter-Spur an einer ruhigen Stelle (Garten, Wiese, Park-Rand) auslegen. {dogName} darf 5 Min später folgen. Steigerung: 20m Spur, dann 30m, dann mit kleinen Ablenkungen drumherum.",
      no_gos: [
        "Spuren-Suche in stark frequentierten Bereichen — Konzentration unmöglich.",
        "{dogName} drängen oder die Spur zeigen — Spaß und Lerneffekt weg.",
        "Spur zu lang machen am Anfang — überfordert.",
      ],
      fortschritt: [
        "{dogName} folgt einer 20m Spur selbstständig.",
        "Spuren-Suche wird zur Favoriten-Aktivität.",
        "Nach Spuren-Suche ist {dogName} ruhig und zufrieden.",
        "Beim Stopp-Spiel kommt {dogName} innerhalb von 3 Sekunden zur Ruhe.",
      ],
      exerciseIds: ["e-mantrailing-basis", "e-stop-spiel"],
    },
    {
      title: "Strukturierte Spaziergänge mit Such-Aufgaben",
      schwerpunkt: "Spaziergänge werden zu Trainings-Sessions. Alle 5-10 Min eine kleine Such-Aufgabe oder Trick. {dogName} bleibt mental engagiert, statt in Auto-Pilot-Modus zu gehen.",
      wochenziele: [
        "Jeder Spaziergang enthält mind. 3 Such- oder Trick-Phasen.",
        "{dogName} bleibt im Spaziergang aufmerksam und ansprechbar.",
        "Stumpfes Vorwärtsziehen reduziert sich klar.",
      ],
      tagesplan: "Pro Spaziergang plane Stationen: nach 5 Min: Leckerli werfen + SUCH. Nach 10 Min: 1 Trick. Nach 15 Min: Mini-Such-Spur. Spaziergang wird zur Aktivitäts-Reihe, nicht zur Strecke. Pausen zum Schnüffeln sind aktiv eingebaut.",
      no_gos: [
        "Aktivitäten in {dogName}s Stress-Phase aufdrängen — erst herunterkommen lassen.",
        "Zu viele Aktivitäten in zu kurzer Zeit — Reizüberflutung.",
        "Spaziergänge in Hochaufregung-Zonen (viele Hunde) für strukturiertes Training nutzen.",
      ],
      fortschritt: [
        "{dogName} sucht aktiv Augenkontakt und Aufgaben.",
        "Spaziergänge werden ruhiger und kommunikativer.",
        "Stumpfes Ziehen reduziert sich erkennbar.",
      ],
      exerciseIds: ["e-mantrailing-basis", "e-shape-trick"],
    },
    {
      title: "Stopp-Spiel: Aufregung unterbrechen lernen",
      schwerpunkt: "Hyperaktive Hunde haben oft keinen Off-Schalter. Wir bauen einen: mitten im Spiel STOP, Aufregung kappen, dann erst weitermachen. Ein Lebens-Skill.",
      wochenziele: [
        "{dogName} reagiert auf STOP innerhalb von 3 Sekunden mit Beruhigung.",
        "Du kannst Spiel- und Tobereien jederzeit unterbrechen.",
        "{dogName} fährt nach STOP runter, ohne dass es Frust gibt.",
      ],
      tagesplan: "1x täglich eine 7-Min Spiel-Session mit Spielzeug. Alle 60 Sek ein STOP einbauen. {dogName} hält 5-10 Sek, dann Leckerli, dann nicht sofort Spiel-Wiederaufnahme — 30 Sek Pause. Über die Woche werden die Pause-Phasen länger.",
      no_gos: [
        "STOP nur bei Frust oder schlechter Laune einsetzen.",
        "Spiel sofort weiterführen — die Pause ist der Lerneffekt.",
        "{dogName} körperlich zur Ruhe zwingen — sondern verbal lenken.",
      ],
      fortschritt: [
        "{dogName} sitzt oder steht ruhig bei STOP innerhalb von 3 Sek.",
        "Aufregungs-Phasen werden kürzer.",
        "Du fühlst dich als Spiel-Regisseur, nicht als Mitläufer.",
      ],
      exerciseIds: ["e-stop-spiel", "e-cool-down-decke"],
    },
    {
      title: "Runterkommen nach jedem Spaziergang",
      schwerpunkt: "Nach jeder aufregenden Phase kommt eine bewusste 5-10 Min Runterkommen. {dogName} lernt: Aufregung endet aktiv, nicht von allein. Das ist Ruhe als trainierbare Fähigkeit.",
      wochenziele: [
        "{dogName} kennt die Runterkommen-Sequenz und kommt schneller runter.",
        "Runterkommen wird zur normalen Routine nach Spaziergängen.",
        "{dogName}s Tagespegel ist ruhiger geworden.",
      ],
      tagesplan: "Nach jedem Spaziergang: 5-10 Min Runterkommen auf der Decke. Setze dich daneben, ruhige Hand auf Schulterblatt, tiefes Atmen. Entspannungs-Marker WUNDERBAR alle 60 Sek. Erst nach Runterkommen-Phase darf {dogName} normal aktiv werden.",
      no_gos: [
        "Runterkommen auslassen, weil 'zu eilig'.",
        "Nach Spaziergang sofort {dogName} mit etwas Aufregendem konfrontieren.",
        "Runterkommen erzwingen — {dogName} muss lernen dürfen.",
      ],
      fortschritt: [
        "{dogName} sucht von selbst die Decke nach Aufregung auf.",
        "Runterkommen dauert kürzer, weil schon ankommt.",
        "Spaziergänge enden in Ruhe, nicht im Chaos.",
      ],
      exerciseIds: ["e-cool-down-decke", "e-entspannungs-marker"],
    },
    {
      title: "Längere Kopfarbeits-Sessions",
      schwerpunkt: "Frei-Form-Training wird auf 10-15 Min ausgedehnt, mit mehreren Tricks parallel. {dogName} lernt Konzentration über längere Zeit, was Hyperaktivität direkt entgegenwirkt.",
      wochenziele: [
        "{dogName} bleibt 10-15 Min konzentriert in einer Trick-Session.",
        "Mind. 3 Tricks aktiv im Repertoire.",
        "Aufmerksamkeits-Spanne ist erkennbar erweitert.",
      ],
      tagesplan: "Eine 10-15 Min Trick-Session täglich, ruhiger Ort drinnen oder im Garten. Rotation der Tricks: 5 Min Trick 1, 5 Min Trick 2, 5 Min Trick 3. Pro Trick saubere Wiederholungen mit klarem FEIN, nicht hektisch.",
      no_gos: [
        "Trick-Anforderungen zu schnell steigern — {dogName} braucht Wiederholung.",
        "Mehrere neue Tricks parallel anfangen — Verwirrung.",
        "Trick-Session in Übererregung — erst Runterkommen.",
      ],
      fortschritt: [
        "{dogName} hat 3+ Tricks im Repertoire.",
        "Aufmerksamkeits-Spanne über 10 Min ist normal.",
        "Du erkennst {dogName}s Konzentrations-Grenze sicher.",
      ],
      exerciseIds: ["e-shape-trick", "e-stop-spiel"],
    },
    {
      title: "Sozial-Kontakte kontrolliert",
      schwerpunkt: "Hyperaktive Hunde überdrehen oft mit anderen Hunden. Wir bauen kontrollierte soziale Kontakte ein, mit klaren Pausen und Beruhigungs-Sequenzen.",
      wochenziele: [
        "{dogName} kennt 1-2 berechenbare Hundefreunde mit guter Sozial-Kompetenz.",
        "Sozial-Termine werden mit Pausen strukturiert, nicht stundenlange Tobereien.",
        "Nach Sozial-Kontakt kommt {dogName} schnell runter dank Runterkommen.",
      ],
      tagesplan: "1-2 mal pro Woche ein bewusster Sozial-Termin: 30-45 Min mit einem ruhigen, berechenbaren Hund. Niemals länger. Pausen alle 10-15 Min mit Leinen-Halt und Wasserpause. Direkt nach: 15 Min Runterkommen zu Hause.",
      no_gos: [
        "Stundenlange Tobereien — kontraproduktiv, überreizt.",
        "Sozial-Termin in unbekanntem Setting mit fremden Hunden.",
        "Direkt nach Sozial-Termin noch weitere Aktivitäten.",
      ],
      fortschritt: [
        "{dogName} kommt aus Sozial-Aufregung schneller runter.",
        "Sozial-Kontakte sind erfüllend, nicht reizüberflutend.",
        "Ihr habt eine klare Sozial-Routine pro Woche.",
      ],
      exerciseIds: ["e-stop-spiel", "e-cool-down-decke"],
    },
    {
      title: "Frust-Toleranz aktiv erweitern",
      schwerpunkt: "Hyperaktivität geht oft Hand in Hand mit niedriger Frustrationstoleranz. Wir trainieren bewusst: {dogName} bekommt eine Aufgabe, die etwas schwer ist, lernt durchzuhalten.",
      wochenziele: [
        "{dogName} hält 5+ Min an einer schwierigeren Aufgabe dran.",
        "Frust-Verhalten (Winseln, Aufgeben) reduziert sich.",
        "{dogName} kommt mit kurzen Wartezeiten besser klar.",
      ],
      tagesplan: "Pro Tag eine 'schwierige' Aufgabe: kniffliger Kong, Schnüffelmatte mit kleineren Leckerlis, Such-Aufgabe mit höheren Verstecken. {dogName} muss sich anstrengen. Du beobachtest, aber hilfst NICHT. Frust gehört dazu.",
      no_gos: [
        "Bei Frust sofort helfen — der Lerneffekt geht verloren.",
        "Aufgaben zu schwer machen — Aufgabe braucht 60-80% Erfolgs-Chance.",
        "Frust mit Aufregung kompensieren — Aktivitäts-Wechsel sondern Ruhe.",
      ],
      fortschritt: [
        "{dogName} bleibt länger an Aufgaben dran.",
        "Frust-Anzeichen werden seltener und kürzer.",
        "{dogName} entwickelt Durchhalte-Vermögen.",
      ],
      exerciseIds: ["e-warte-impuls", "e-kong-mahlzeit"],
    },
    {
      title: "Festigung Steigerung",
      schwerpunkt: "Letzte Steigerungs-Woche. Alle Auslastungs-Werkzeuge sind etabliert: Nasenarbeit, Kopfarbeit, Runterkommen, Stopp-Spiel, kontrollierte Sozial-Kontakte. {dogName} ist ein anderer Hund als vor 8 Wochen.",
      wochenziele: [
        "Alle Werkzeuge laufen flüssig im Alltag.",
        "{dogName}s Tagespegel ist deutlich ruhiger.",
        "Du hast einen klaren Plan für Phase 3 (Generalisierung & Wartung).",
      ],
      tagesplan: "Mache eine Bilanz-Woche: was funktioniert super, was wackelt? Welche Werkzeuge nutzt du am meisten, welche selten? Wo ist {dogName} jetzt im Vergleich zu Woche 1? Notiere ehrlich, das ist die Basis für Phase 3.",
      no_gos: [
        "Werkzeuge weglassen weil 'läuft jetzt' — Wartung ist Phase 3.",
        "{dogName} mit zu vielen Reizen testen — wir sind nicht in der finalen Stufe.",
        "Erwartungen zu hoch schrauben — Plateaus sind normal.",
      ],
      fortschritt: [
        "{dogName} hat ein deutlich ruhigeres Energie-Niveau.",
        "Auslastungs-Routine ist im Alltag verankert.",
        "Du fühlst dich als kompetenter Auslastungs-Manager.",
      ],
      exerciseIds: ["e-mantrailing-basis", "e-cool-down-decke"],
    },
  ],
  generalisierung: [
    {
      title: "Auslastungs-Wochenplan etablieren",
      schwerpunkt: "Phase 3 ist Struktur im Alltag. Du erstellst einen klaren 7-Tage-Plan, der körperliche, mentale, soziale Auslastung balanciert. Mit Plan kein Chaos mehr, ohne Plan reichen die Tage nicht.",
      wochenziele: [
        "Du hast einen 7-Tage-Auslastungsplan an der Wand.",
        "{dogName} bekommt jeden Tag 3 Arten Auslastung: Bewegung + Nase + Kopf.",
        "Schlaf-Stunden werden kontinuierlich erreicht (16-20h).",
      ],
      tagesplan: "Erstelle einen Plan: pro Tag 1 körperlich (Spaziergang 30-60 Min), 1 Nasenarbeit (Suchspiel/Spuren-Suche), 1 Kopfarbeit (Shape/Kong). Sozial-Termin 2x pro Woche. Runterkommen nach allem Aufregenden. Plan an die Wand, abends Häkchen setzen.",
      no_gos: [
        "Plan nur für 1 Tag machen — Routine entsteht durch Wiederholung.",
        "Mehr als 2 hochaufregende Aktivitäten am selben Tag.",
        "Plan ohne explizite Ruhe-Phasen — die sind aktiv eingeplant.",
      ],
      fortschritt: [
        "{dogName} kennt die Tagesroutine.",
        "Auslastungs-Lücken zeigen sich am Verhalten — du erkennst das schnell.",
        "Du planst flexibel, aber mit klarer Struktur.",
        "Die 3-Schritt-Anti-Übererregung-Routine sitzt: Reize raus, Decke, Marker.",
      ],
      exerciseIds: ["e-auslastungs-plan", "e-anti-hyperarousal"],
    },
    {
      title: "Ruhe als Default-Modus",
      schwerpunkt: "Diese Woche etablierst du Ruhe als den Standard-Zustand. Aktivität ist die Ausnahme, nicht die Norm. Das klingt langweilig, ist aber die Realität für einen ausgeglichenen Hund.",
      wochenziele: [
        "{dogName} ist mind. 60% des Tages in Ruhe-Phase.",
        "Du forderst {dogName} nicht ständig, sondern lässt sie auch existieren.",
        "Hochfahren ist seltener und kontrollierter.",
      ],
      tagesplan: "Mache dir bewusst: aktive Phasen sind 2-4 mal pro Tag, jeweils 30-60 Min. Dazwischen IST Ruhe. Nicht 'leider Pause', sondern 'aktive Ruhe-Phase'. {dogName} liegt im Korb oder auf der Decke, du arbeitest, ihr seid gemeinsam still im Raum.",
      no_gos: [
        "Schlechtes Gewissen wegen 'zu wenig Action'.",
        "{dogName} ständig ansprechen oder streichheln in Ruhe-Phasen.",
        "Ruhe als 'Leerlauf' sehen — sie ist aktiver Bestandteil der Regeneration.",
      ],
      fortschritt: [
        "{dogName} sucht von selbst Ruhe-Plätze auf.",
        "Du fühlst dich nicht mehr verpflichtet, ständig zu unterhalten.",
        "Ruhe-Phasen sind nicht mehr 'wartezeit', sondern Teil der Beziehung.",
      ],
      exerciseIds: ["e-entspannungs-marker", "e-cool-down-decke"],
    },
    {
      title: "Auslastung an schwierigen Tagen",
      schwerpunkt: "Manche Tage sind schwer: Regen, wenig Zeit, Krank. Wir bauen ein Mini-Auslastungs-Paket für solche Tage, damit {dogName} trotzdem zufrieden ist.",
      wochenziele: [
        "Du hast ein 15-Min Notfall-Auslastungs-Paket parat.",
        "{dogName} bleibt auch an schwierigen Tagen ruhig.",
        "Du fühlst dich vorbereitet, statt überfordert.",
      ],
      tagesplan: "Plane das Notfall-Paket: 10 Min Schnüffelmatte + 5 Min Trick-Wiederholung drinnen. ODER: 15 Min Such-Spur in der Wohnung. ODER: 1 anspruchsvoller Kong + Runterkommen. Test in dieser Woche an einem normalen Tag, damit {dogName} es kennt.",
      no_gos: [
        "Schlechtes Gewissen wegen 'nur 15 Min' — gut investiert ist genug.",
        "{dogName} an schwierigen Tagen einfach 'durchziehen' lassen — frustriert.",
        "Notfall-Paket nicht testen — funktioniert dann im Ernstfall nicht.",
      ],
      fortschritt: [
        "{dogName} bleibt an schwierigen Tagen erkennbar ruhiger.",
        "Du hast Flexibilität ohne Schuldgefühle.",
        "15 Min Quality > 60 Min schlechte Auslastung.",
      ],
      exerciseIds: ["e-kong-mahlzeit", "e-such-drinnen"],
    },
    {
      title: "Belohnungs-Reduktion bei Auslastung",
      schwerpunkt: "Auslastungs-Tools sollten irgendwann auch ohne Dauer-Begleitung von dir laufen. {dogName} kann Schnüffelmatte selbstständig nutzen, Kong allein abarbeiten. Das gibt euch beiden Freiheit.",
      wochenziele: [
        "{dogName} arbeitet 20-30 Min selbstständig an Beschäftigungs-Tools.",
        "Du musst nicht mehr aktiv begleiten.",
        "Du hast eigene 'freie Zeit' während {dogName} beschäftigt ist.",
      ],
      tagesplan: "Beobachte nicht mehr ständig: gib Kong/Schnüffelmatte, gehe in einen anderen Raum, mache deine eigenen Sachen. {dogName} arbeitet selbstständig. Komme erst nach Ende der Beschäftigung zurück. Beide gewöhnen sich an die Eigenständigkeit.",
      no_gos: [
        "Während der Beschäftigung ständig nachschauen.",
        "Beschäftigung zu einfach machen — {dogName} fertigt in 5 Min.",
        "Eigenständigkeit zu schnell erwarten — gewohnter Anfangsphasen mit Begleitung sind ok.",
      ],
      fortschritt: [
        "{dogName} hat eine selbstständige Beschäftigungs-Routine.",
        "Du genießt eigene Zeit ohne Schuldgefühle.",
        "Eure Beziehung wird gesünder durch gemeinsame Freizeit UND Trennzeit.",
      ],
      exerciseIds: ["e-kong-mahlzeit", "e-such-drinnen"],
    },
    {
      title: "Schwierige Auslöser gezielt arbeiten",
      schwerpunkt: "Türklingel, Briefträger, Wildgeruch — die spezifischen Auslöser, die {dogName} regelmäßig hochfahren lassen. Diese Woche arbeitest du gezielt an euren persönlichen Hot-Spots.",
      wochenziele: [
        "Eure 2-3 wichtigsten Auslöser sind klar identifiziert.",
        "{dogName} reagiert auf einen Haupttrigger erkennbar ruhiger.",
        "Du hast eine konkrete Strategie pro Auslöser.",
      ],
      tagesplan: "Tag 1-2: identifiziere die 2-3 wichtigsten Auslöser und notiere {dogName}s Reaktion. Tag 3-7: pro Auslöser spezifische Strategie: Türklingel → KOMM-HER + Belohnung auf Decke. Briefträger → Decke + Kong vorbereiten wenn er sich nähert. Wildgeruch → kurze Leine + Such-Spiel als Ablenkung.",
      no_gos: [
        "Auslöser ignorieren in der Hoffnung, dass es weggeht — passiert nicht.",
        "Strafe oder Lautstärke gegen den Auslöser — verstärkt Übererregung.",
        "Mehrere Auslöser gleichzeitig angehen — fokussiere.",
      ],
      fortschritt: [
        "{dogName} reagiert auf den Haupttrigger erkennbar ruhiger.",
        "Du hast Werkzeuge für jeden Auslöser parat.",
        "Auslöser werden zur Übungsgelegenheit, nicht zum Stress.",
      ],
      exerciseIds: ["e-anti-hyperarousal", "e-entspannungs-marker"],
    },
    {
      title: "Sozial-Setting im Park meistern",
      schwerpunkt: "Hundeparks und Begegnungen mit anderen Hunden überfordern oft. Diese Woche etablierst du Spielregeln: kurze Phasen, klare Runterkommen-Routinen, kein stundenlange Tobereien.",
      wochenziele: [
        "{dogName} bewältigt einen 20-30 Min Park-Aufenthalt ruhig.",
        "Du erkennst {dogName}s Überlastungs-Anzeichen sicher.",
        "Sozial-Kontakte sind erfüllend, nicht reizüberflutend.",
      ],
      tagesplan: "Plane in dieser Woche 2-3 bewusste Park-Termine: max 30 Min, alle 10 Min Pause mit Leinen-Halt und WUNDERBAR. Bei Anzeichen von Überdrehen: aktiv aussteigen, NICHT durchhalten. Direkt nach Park: 15 Min Runterkommen zu Hause.",
      no_gos: [
        "Park-Aufenthalte länger als 45 Min — Reizüberflutung.",
        "{dogName} bei Stress 'durchziehen' lassen.",
        "Mehrere Park-Termine pro Tag — überreizt.",
      ],
      fortschritt: [
        "{dogName} kommt ruhig aus dem Park-Besuch zurück.",
        "Überlastungs-Anzeichen werden früh erkannt.",
        "Park wird zur möglichen Aktivität, nicht zur Pflicht.",
      ],
      exerciseIds: ["e-cool-down-decke", "e-anti-hyperarousal"],
    },
    {
      title: "Anti-Übererregung-Routine etablieren",
      schwerpunkt: "Manche Tage gehen schief. {dogName} kommt nicht runter. Diese Woche festigst du eine klare 3-Schritt-Routine, die du in solchen Momenten reflexartig einsetzen kannst.",
      wochenziele: [
        "Die Anti-Übererregung-Routine sitzt: Reize raus, Decke, Marker.",
        "Du nutzt sie reflexartig, ohne nachzudenken.",
        "{dogName} kommt nach 10-15 Min auch aus stärkerem Übererregung runter.",
      ],
      tagesplan: "Übe die Routine bewusst 2-3 mal in dieser Woche: erzeuge leichte Aufregung (Tür-Klopfen simulieren, kurzes Spiel), dann sofort Routine: Reize reduzieren, auf Decke führen, WUNDERBAR und 10-15 Min daneben sitzen. {dogName} lernt: Aufregung kann immer aktiv beendet werden.",
      no_gos: [
        "Routine nur bei echtem Übererregung nutzen — ohne Übung funktioniert sie nicht im Notfall.",
        "Routine abkürzen — die volle 10-15 Min sind nötig.",
        "Nach Routine sofort wieder aktiv werden — Konsolidierung braucht Zeit.",
      ],
      fortschritt: [
        "Routine ist eingeübt und sitzt.",
        "{dogName} reagiert vorhersehbar auf jeden Schritt.",
        "Du fühlst dich auch in hektischen Momenten handlungsfähig.",
      ],
      exerciseIds: ["e-anti-hyperarousal", "e-cool-down-decke"],
    },
    {
      title: "Übergang in den Wartungsmodus",
      schwerpunkt: "Letzte Woche. Alle Werkzeuge sind etabliert. Auslastungsplan läuft, Ruhe ist Standard, Auslöser-Strategien sitzen. {dogName} ist ein deutlich ausgeglichener Hund. Wartungs-Plan für die Zukunft.",
      wochenziele: [
        "Alle Routinen laufen selbstständig im Alltag.",
        "Du hast einen klaren Wartungs-Rhythmus für die kommenden Monate.",
        "{dogName} ist langfristig ruhiger als zu Plan-Start.",
      ],
      tagesplan: "Reduziere bewusstes Training auf das Minimum. Routinen laufen. Plane alle 4-6 Wochen einen 'Refresh-Tag': bewusst nochmal alle Werkzeuge durchgehen, Schwachstellen identifizieren, neue Tricks lernen. Schlaf-Hygiene überprüfen.",
      no_gos: [
        "Alle Routinen schlagartig weglassen — Rückschritts-Gefahr.",
        "Sich entspannen und nicht mehr beobachten — kleine Rückfälle früh erkennen.",
        "Wartungs-Refresh auf nie verschieben — kurze regelmäßige Refreshes reichen.",
      ],
      fortschritt: [
        "{dogName} ist langfristig ausgeglichener.",
        "Ihr habt eine gemeinsame Routine, die sich selbstverständlich anfühlt.",
        "Übererregung ist Ausnahme, Ruhe ist Standard.",
      ],
      exerciseIds: ["e-auslastungs-plan", "e-anti-hyperarousal"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// AGGRESSION (Aggression in Begegnungen) — Schwellenwert & Gegenkonditionierung
// ────────────────────────────────────────────────────────────────────
const AGGRESSION_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Schwellenwert verstehen & dokumentieren",
      schwerpunkt: "Bevor du an der Reaktivität arbeitest, musst du wissen: ab welcher Distanz kann {dogName} noch LERNEN, ab wann reagiert sie nur noch? Das ist der Schwellenwert. Diese Woche identifizierst und notierst du ihn pro Auslöser-Typ.",
      wochenziele: [
        "Du hast Schwellenwert-Distanzen für jeden Auslöser-Typ notiert.",
        "Du erkennst frühe Stress-Signale (Mimik, Atmung, Schwanz) sicher.",
        "Du verstehst: jede Übung läuft UNTER Schwellenwert, niemals daran kratzen.",
      ],
      tagesplan: "An 4 Tagen dieser Woche: gezielte Beobachtungs-Sessions an einem Ort wo Auslöser berechenbar auftreten. 50m Startdistanz, langsam testen. Notiere pro Auslöser-Typ (Hund, Jogger, Fahrrad, Kind) die exakte Distanz, ab der erste Stress-Signale beginnen. Das sind deine Schwellenwerte für Phase 2.",
      no_gos: [
        "An Schwellenwert kratzen — sofort Distanz vergrößern bei Stress-Signalen.",
        "Mehrere Auslöser gleichzeitig testen — pro Session ein Auslöser.",
        "Aus der Beobachtung in Training übergehen — diese Woche nur Beobachtung.",
      ],
      fortschritt: [
        "Du hast eine schriftliche Karte der Schwellenwerte.",
        "Frühe Stress-Signale werden sicher erkannt.",
        "Du verstehst {dogName}s Reaktivität messbar.",
        "Drinnen reagiert {dogName} auf das Markerwort SCHAU in unter 2 Sekunden.",
      ],
      exerciseIds: ["a-schwellenwert-finden", "a-lat"],
    },
    {
      title: "Maulkorb positiv konditionieren",
      schwerpunkt: "Ein Maulkorb gehört ins Werkzeug-Set jedes reaktiven Hundes — als Sicherheits-Backup. Aber er funktioniert nur, wenn {dogName} ihn positiv verknüpft. Das braucht 2 Wochen.",
      wochenziele: [
        "{dogName} streckt freiwillig die Schnauze in den Maulkorb.",
        "Tragezeit ist auf 5 Min mit positiver Beschäftigung gesteigert.",
        "Maulkorb wird vor jedem 'schwierigen' Spaziergang verfügbar.",
      ],
      tagesplan: "Tag 1-3: Maulkorb in der Wohnung sichtbar liegen, Leckerli durch die Gitterstäbe. Tag 4-7: {dogName} steckt aktiv die Schnauze rein, kassiert. Tag 8-14 (in Phase 2): Tragezeit ausdehnen, mit Kong durch Gitterstäbe füttern. Niemals beim ersten Mal aufsetzen und losgehen.",
      no_gos: [
        "Maulkorb erstmal in einer Stresssituation aufsetzen — vergiftet die Verknüpfung lebenslang.",
        "Maulkorb zu früh als Strafmaßnahme nutzen.",
        "Falschen Typ wählen (Stoff-Maulschlinge) — diese verhindern auch Hecheln und Trinken.",
      ],
      fortschritt: [
        "{dogName} sucht aktiv den Maulkorb auf.",
        "Tragezeit klappt entspannt.",
        "Du hast ein Sicherheits-Werkzeug für Notfälle.",
      ],
      exerciseIds: ["a-maulkorb-positiv", "a-schwellenwert-finden"],
    },
    {
      title: "Reiz-Anschauen (Schau-Hin-Spiel) drinnen aufbauen",
      schwerpunkt: "Schau-Hin ist das wichtigste Spiel im Aggressions-Training. {dogName} darf den Reiz ANSCHAUEN, muss aber dann zu dir zurückschauen. Wir starten drinnen mit harmlosen 'Reizen', bevor wir nach draußen gehen.",
      wochenziele: [
        "{dogName} versteht das Schau-Hin-Prinzip drinnen.",
        "Sie schaut nach dem Reiz innerhalb von 2 Sek zu dir.",
        "Belohnungs-Marker SCHAU + FEIN ist konditioniert.",
      ],
      tagesplan: "Drinnen Übungen mit gestellten 'Reizen': eine Tasse auf den Tisch stellen, ein Buch quer liegen lassen. {dogName} schaut hin → du sagst SCHAU + Klick + Leckerli. Wiederhole 5-7 mal pro Session, 3 Sessions täglich. {dogName} lernt: Reiz sehen = sofort zu dir gucken.",
      no_gos: [
        "Schon mit echten Außen-Auslösern arbeiten — wir sind noch nicht bereit.",
        "{dogName} drängen — sie muss selbst zum Halter schauen.",
        "Belohnung zu spät geben — Timing ist alles bei Schau-Hin.",
      ],
      fortschritt: [
        "{dogName} versteht das Schau-Hin-Prinzip in der Wohnung.",
        "Belohnungs-Marker sind klar konditioniert.",
        "Du bist bereit, Schau-Hin in Phase 2 nach draußen zu übertragen.",
      ],
      exerciseIds: ["a-lat", "a-engage-disengage"],
    },
    {
      title: "Notfall-Protokoll konditionieren",
      schwerpunkt: "Manche Situationen lassen sich nicht vermeiden. Diese Woche etablierst du ein klares 5-Schritt-Notfall-Protokoll, das du reflexartig einsetzen kannst — bevor es eskaliert.",
      wochenziele: [
        "Du kennst die 5 Schritte auswendig und kannst sie reflexartig einsetzen.",
        "{dogName} kennt ein Abbruch-Signal das positiv konditioniert ist.",
        "Du fühlst dich für unvorhersehbare Begegnungen vorbereitet.",
      ],
      tagesplan: "Übe die Sequenz mehrmals in Trockenübungen: simuliere ein Auslöser-Auftauchen, dann sofort: 1. ruhig bleiben, 2. ABBRUCH-Signal, 3. 90 Grad Wendung, 4. ruhig weggehen, 5. nach 50m Beruhigungs-Marker + Leckerli. Trainiere drinnen ohne echten Auslöser.",
      no_gos: [
        "Erste Anwendung in einer echten Notfall-Situation — Routine muss vorher sitzen.",
        "ABBRUCH-Signal als Strafe konditionieren — es ist nur ein 'andere Richtung'-Signal.",
        "Bei echtem Notfall in Panik geraten — Routine durchziehen.",
      ],
      fortschritt: [
        "Du kennst die Sequenz auswendig.",
        "{dogName} kennt das ABBRUCH-Signal.",
        "Du fühlst dich vorbereitet, statt machtlos.",
      ],
      exerciseIds: ["a-emergency-protokoll", "a-bat-distanz"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Maulkorb-Tragezeit ausdehnen",
      schwerpunkt: "Aufbauend auf Woche 2: Tragezeit auf 15-20 Min ausdehnen, mit Beschäftigung. {dogName} soll den Maulkorb als normalen Spaziergangs-Bestandteil akzeptieren.",
      wochenziele: [
        "{dogName} trägt den Maulkorb 15-20 Min entspannt.",
        "Sie kann mit Maulkorb trinken und schnüffeln.",
        "Maulkorb ist Teil der Spaziergangs-Vorbereitung, nicht Drama.",
      ],
      tagesplan: "Tägliche Tragezeit-Sessions: Maulkorb auf, dann Kong durch Gitter füttern. Tag 1-2 5 Min, Tag 3-5 10 Min, Tag 6-7 15 Min. Im Anschluss positive Aktivität: Spiel oder Spaziergang OHNE Maulkorb noch. Verknüpfung: Maulkorb = etwas Gutes folgt.",
      no_gos: [
        "Tragezeit zu schnell ausdehnen — Frust lädt negative Verknüpfung.",
        "Maulkorb-Sessions in Stress oder Übererregung.",
        "Maulkorb für längere Zeit allein lassen — er ist Hilfsmittel, keine Strafe.",
      ],
      fortschritt: [
        "Tragezeit klappt entspannt.",
        "{dogName} reagiert positiv auf Maulkorb-Vorbereitung.",
        "Maulkorb ist routinierter Teil eures Repertoires.",
      ],
      exerciseIds: ["a-maulkorb-positiv", "a-schwellenwert-finden"],
    },
    {
      title: "Schau-Hin mit Mini-Reizen drinnen",
      schwerpunkt: "Schau-Hin wird in der Wohnung mit schwierigeren Reizen geübt: Geräusche, plötzliche Bewegungen, andere Familienmitglieder als 'Auslöser'. {dogName} festigt das Prinzip.",
      wochenziele: [
        "Schau-Hin funktioniert bei 5+ verschiedenen Reizen drinnen.",
        "{dogName} schaut innerhalb von 1-2 Sek zum Halter.",
        "Belohnung kommt schnell und konsistent.",
      ],
      tagesplan: "Trainiere drinnen mit verschiedenen Reizen: Familienmitglied bewegt sich auffällig, Geräusch (Klingel-Aufnahme leise), Spielzeug fliegt durchs Zimmer. Pro Reiz Schau-Hin + Klick + Belohnung. 3-4 Sessions pro Tag, jede 5 Min.",
      no_gos: [
        "Reize zu intensiv — überfordert das junge Schau-Hin.",
        "Reize ohne SCHAU-Marker einsetzen — verwässert die Verknüpfung.",
        "{dogName} drängen — sie muss selbst zum Halter schauen.",
      ],
      fortschritt: [
        "Schau-Hin klappt bei verschiedenen Reizen drinnen.",
        "Reaktionszeit ist unter 2 Sek.",
        "Du bist bereit für echte Außen-Reize.",
      ],
      exerciseIds: ["a-lat", "a-engage-disengage"],
    },
    {
      title: "Stress-Signale lesen lernen",
      schwerpunkt: "Diese Woche lernst du, {dogName}s Körpersprache GENAU zu lesen. Frühe Stress-Signale sind dein Frühwarnsystem. Wer die nicht erkennt, kommt immer zu spät zum Eingreifen.",
      wochenziele: [
        "Du kennst {dogName}s individuelle Stress-Signale (5+ Kategorien).",
        "Du erkennst Stress-Stufen 1-2 sicher (bevor Eskalation kommt).",
        "Du reagierst auf frühe Signale mit Distanz, nicht erst auf späte mit Korrektur.",
      ],
      tagesplan: "Beobachte täglich 30 Min Spaziergang mit gezieltem Fokus auf Körpersprache: Pupillen-Größe, Maul-Spannung, Atmung, Schwanz-Höhe, Gangart, Ohren-Stellung. Notiere am Abend: welche frühe Signale hast du gesehen? In welcher Situation? Lerne {dogName}s individuelles Muster.",
      no_gos: [
        "Erst auf späte Signale (Knurren, Hochziehen) reagieren — dann ist es zu spät.",
        "Stress-Signale ignorieren oder relativieren ('das ist normal').",
        "{dogName} in Stress-Situationen 'durchziehen' — eskaliert nur.",
      ],
      fortschritt: [
        "Du erkennst {dogName}s frühe Signale zuverlässig.",
        "Du reagierst proaktiv mit Distanz.",
        "Eskalationen werden seltener, weil du sie früh kappst.",
      ],
      exerciseIds: ["a-schwellenwert-finden", "a-lat"],
    },
    {
      title: "Fundament-Check vor Phase 2",
      schwerpunkt: "Letzte Fundament-Woche. Maulkorb positiv? Schwellenwerte bekannt? Schau-Hin drinnen sitzt? Notfall-Protokoll geübt? Diese Bausteine sind unverzichtbar für Phase 2 draußen.",
      wochenziele: [
        "Alle 4 Bausteine sind etabliert: Maulkorb, Schwellenwert, Schau-Hin, Notfall.",
        "Du fühlst dich vorbereitet für Außen-Training mit echten Auslösern.",
        "{dogName} kennt die Werkzeuge.",
      ],
      tagesplan: "Mache ehrliche Bilanz: was sitzt, was wackelt? Falls etwas wackelt: 1 Extra-Woche dranhängen. Diese Phase entscheidet über die nächsten 8 Wochen — saubere Vorbereitung ist alles. Notfall-Protokoll nochmal trocken durchspielen.",
      no_gos: [
        "Aus Ungeduld in Phase 2 springen — bei wackligem Fundament eskaliert es.",
        "Mehrere Schwächen gleichzeitig in Phase 2 nachreparieren — chaotisch.",
        "Den Plan aufgeben weil Fundament länger dauert — dranbleiben.",
      ],
      fortschritt: [
        "Du fühlst dich kompetent und vorbereitet.",
        "Werkzeuge sitzen klar.",
        "{dogName} kennt die Bausteine.",
      ],
      exerciseIds: ["a-lat", "a-schwellenwert-finden"],
    },
  ],
  steigerung: [
    {
      title: "Schau-Hin mit echten Auslösern aus großer Distanz",
      schwerpunkt: "Jetzt geht's nach draußen. {dogName} sieht echte Auslöser, aber aus großer Distanz (50m+, UNTER Schwellenwert). Schau-Hin wird zur Standard-Reaktion auf Reize.",
      wochenziele: [
        "Schau-Hin funktioniert outdoor bei 3+ Auslöser-Typen.",
        "{dogName} bleibt unter Schwellenwert.",
        "Belohnungs-Dichte ist hoch (kein Sparen in dieser Phase).",
      ],
      tagesplan: "2 mal pro Woche dedizierte Schau-Hin-Sessions an einem Ort mit berechenbaren Auslösern (Park-Rand, Joggingstrecke). Start-Distanz: 50m+. Pro Session 4-6 Schau-Hin-Wiederholungen, dann beenden. Maulkorb-Backup für Notfälle.",
      no_gos: [
        "An Schwellenwert kratzen — verzweifeltes Lernen wird Reaktion.",
        "Belohnungs-Frequenz reduzieren — die kommt erst in Phase 3.",
        "Außen-Schau-Hin ohne sauberes Indoor-Schau-Hin — Fundament fehlt.",
      ],
      fortschritt: [
        "Schau-Hin funktioniert outdoor.",
        "Auslöser lösen Aufmerksamkeits-Suche aus, nicht Reaktion.",
        "Du erkennst leichte Lernerfolge.",
        "{dogName} wendet sich nach dem Anschauen aktiv ab statt zu fixieren.",
      ],
      exerciseIds: ["a-lat", "a-engage-disengage"],
    },
    {
      title: "Anschauen-und-Abwenden: aktive Reizabwendung",
      schwerpunkt: "Nächste Stufe nach Schau-Hin: {dogName} schaut den Auslöser an und wendet sich DANN selbstständig ab. Du belohnst das Wegschauen mit Jackpot. {dogName} lernt: ich kann die Strategie selbst wählen.",
      wochenziele: [
        "{dogName} schaut nach Auslöser-Sichtung von selbst weg.",
        "Wegschauen wird mit Jackpot belohnt.",
        "{dogName} entwickelt Selbst-Wahl-Verhalten.",
      ],
      tagesplan: "2-3 Anschauen-und-Abwenden-Sessions pro Woche. Distanz wie bei Schau-Hin, aber jetzt warten auf das spontane Wegschauen. Wenn {dogName} hinschaut, dann von selbst wegschaut: Jackpot von 3 Leckerlis hintereinander. Wenn sie weiter starrt: leise SCHAU-Hint.",
      no_gos: [
        "{dogName} drängen oder Wegschauen erzwingen — der Lerneffekt geht verloren.",
        "Schon vor sauberem Schau-Hin zu Anschauen-und-Abwenden übergehen.",
        "Belohnung zu klein machen — Jackpot ist hier essenziell.",
      ],
      fortschritt: [
        "{dogName} wendet sich von Auslösern aktiv ab.",
        "Selbst-Regulation entsteht.",
        "Du musst weniger lenken.",
      ],
      exerciseIds: ["a-engage-disengage", "a-lat"],
    },
    {
      title: "BOGEN als aktive Strategie",
      schwerpunkt: "Wenn Auslöser zu eng kommt: aktiver Bogen mit klarem Plan. Du hast vorher Fluchtwege identifiziert. {dogName} folgt dir in die Sicherheits-Zone, ohne dass Konflikt entsteht.",
      wochenziele: [
        "{dogName} folgt BOGEN-Signal zuverlässig.",
        "Du nutzt 2-3 Bogen-Sequenzen pro Spaziergang aktiv.",
        "Begegnungen werden mit Bogen ohne Eskalation gemeistert.",
      ],
      tagesplan: "Pro Spaziergang plane 2-3 echte Bogen-Situationen ein. Distanz mindestens 15m zum Auslöser. Bogen entschieden, aber nicht panisch. Nach jeder erfolgreichen Begegnung: 3 Leckerlis + Beruhigungs-Marker.",
      no_gos: [
        "Bogen erst einsetzen wenn {dogName} schon angespannt ist — präventiv ist besser.",
        "Direkten Augenkontakt mit dem entgegenkommenden Hund oder Mensch.",
        "Bogen ohne klare Fluchtweg-Vorplanung.",
      ],
      fortschritt: [
        "{dogName} folgt BOGEN-Signal flüssig.",
        "Begegnungen verlaufen kontrolliert.",
        "Du fühlst dich handlungsfähig.",
      ],
      exerciseIds: ["a-bogen-aktiv", "a-lat"],
    },
    {
      title: "Gegenkonditionierung intensiv",
      schwerpunkt: "Diese Woche arbeitest du gezielt an der emotionalen Verknüpfung: Auslöser erscheint = Leckerli kommt. Über Wochen wird der Auslöser zum 'positiven' Signal, statt zum Stress-Auslöser.",
      wochenziele: [
        "{dogName} erwartet Leckerli wenn ein Auslöser auftaucht.",
        "Stress-Anzeichen reduzieren sich.",
        "Die emotionale Verknüpfung verändert sich grundlegend.",
      ],
      tagesplan: "2-3 dedizierte Gegenkonditionierungs-Sessions: Ort mit Auslösern in Distanz. Auslöser taucht auf: SCHAU + füttern durchgehend solange Auslöser sichtbar. Auslöser weg = Leckerlis stop. {dogName} lernt: Auslöser erscheint = Schlaraffenland.",
      no_gos: [
        "Erst nach Reaktion belohnen — verändert die emotionale Verknüpfung nicht.",
        "Belohnungs-Dichte zu niedrig.",
        "Zu nah ran — Distanz ist alles.",
      ],
      fortschritt: [
        "{dogName} schaut bei Auslösern erwartungsvoll zu dir.",
        "Stress-Anzeichen werden kürzer und seltener.",
        "Auslöser lösen positive statt negative Erwartung aus.",
      ],
      exerciseIds: ["a-lat", "a-engage-disengage"],
    },
    {
      title: "Distanz schrittweise reduzieren",
      schwerpunkt: "Nachdem Schau-Hin und Anschauen-und-Abwenden aus großer Distanz sitzen, reduzierst du SCHRITTWEISE die Distanz. Aber: nur 1-2m pro Woche, nicht hektisch. Geduld zahlt sich hier mehr aus als überall sonst.",
      wochenziele: [
        "Schwellenwert-Distanz hat sich um 5-10m reduziert.",
        "{dogName} bleibt bei näheren Auslösern unter Schwellenwert.",
        "Du arbeitest geduldig und mess-bar.",
      ],
      tagesplan: "Tag 1-3: Distanz wie letzte Woche, sehr stabile Sessions. Tag 4-7: 2m näher ran, beobachten. Wenn Stress-Anzeichen: sofort zurück. Wenn klar: dort bleiben für nächste Woche. Distanz-Reduktion ist KEIN Wettbewerb.",
      no_gos: [
        "Distanz radikal verringern — Eskalation.",
        "An schlechten Tagen Druck erhöhen — Plateaus sind normal.",
        "Schwellenwert ignorieren wenn er sich verändert hat.",
      ],
      fortschritt: [
        "Schwellenwert reduziert sich messbar.",
        "{dogName} bleibt unter dem neuen Wert.",
        "Du arbeitest geduldig und systematisch.",
      ],
      exerciseIds: ["a-schwellenwert-finden", "a-lat"],
    },
    {
      title: "Verhaltens-Anpassungs-Training (Verhaltens-Anpassungs-Training) Einstieg",
      schwerpunkt: "Verhaltens-Anpassungs-Training ist die Königs-Methode bei reaktiven Hunden. {dogName} hat eine Schleppleine, mehr Bewegungsfreiheit, und du belohnst SELBSTSTÄNDIGE Stress-Lösungs-Bewegungen mit Distanz. {dogName} bekommt Kontrolle zurück.",
      wochenziele: [
        "{dogName} versteht das Verhaltens-Anpassungs-Training-Prinzip: stress-Lösung = Distanz wird größer.",
        "Sie zeigt eigenständig 3-4 Stress-Lösungs-Bewegungen.",
        "Sie wirkt sicherer und kontrollierter.",
      ],
      tagesplan: "1-2 Verhaltens-Anpassungs-Sessions pro Woche an ruhiger Stelle mit kontrollierbarem Auslöser. Schleppleine 5m. {dogName} schaut Auslöser an: du wartest. Sobald sie eine Stress-Lösung zeigt (Wegschauen, Sich-Schütteln, Boden lecken, schnüffeln): SOFORT mit ihr aktiv weggehen, weg vom Auslöser.",
      no_gos: [
        "Verhaltens-Anpassungs-Training in Reizüberflutung — funktioniert nur in kontrollierter Umgebung.",
        "{dogName} drängen oder Stress-Lösung erzwingen — gehört nicht zum Prinzip.",
        "Belohnung mit Leckerli — funktionale Belohnung (Distanz) ist hier essenziell.",
      ],
      fortschritt: [
        "{dogName} zeigt aktiv Stress-Lösungs-Verhalten.",
        "Sie wirkt sicherer und selbstkontrollierter.",
        "Verhaltens-Anpassungs-Training wird zur normalen Methode.",
      ],
      exerciseIds: ["a-bat-distanz", "a-emergency-protokoll"],
    },
    {
      title: "Variabilität bei Auslösern",
      schwerpunkt: "Bisher hast du an einzelnen Auslöser-Typen gearbeitet. Diese Woche wechselst du gezielt: heute Hunde, morgen Jogger, übermorgen Fahrräder. {dogName} lernt: die Strategie ist immer gleich, egal welcher Auslöser.",
      wochenziele: [
        "{dogName} setzt Schau-Hin/Bogen/Gegenkonditionierung bei verschiedenen Auslösern ein.",
        "Die Strategie ist generalisiert, nicht trigger-spezifisch.",
        "Du fühlst dich vorbereitet für unvorhersehbare Begegnungen.",
      ],
      tagesplan: "Plane gezielt: 1 Spaziergang dieser Woche mit Hund-Fokus, 1 mit Jogger-Fokus, 1 mit Fahrrad-Fokus. Pro Spaziergang dieselbe Strategie anwenden, andere Auslöser gegebenenfalls vermeiden.",
      no_gos: [
        "Mehrere Auslöser-Typen pro Spaziergang stapeln — überfordert.",
        "Strategie wechseln je nach Auslöser — verwirrt.",
        "Erst bei drittem Auslöser merken, dass {dogName} schon überreizt ist.",
      ],
      fortschritt: [
        "Strategien funktionieren trigger-übergreifend.",
        "Du erkennst sicher, welche Strategie passt.",
        "{dogName} reagiert vorhersehbar auf verschiedene Reize.",
      ],
      exerciseIds: ["a-lat", "a-bogen-aktiv"],
    },
    {
      title: "Festigung Steigerung",
      schwerpunkt: "Letzte Steigerungs-Woche. Du kombinierst Schau-Hin, Anschauen-und-Abwenden, Bogen, Gegenkonditionierung, Verhaltens-Anpassungs-Training. {dogName} hat ein komplettes Repertoire. Phase 3 = Anwendung im echten Alltag.",
      wochenziele: [
        "Alle Werkzeuge können flexibel kombiniert werden.",
        "{dogName} setzt teilweise selbstständig Strategien ein.",
        "Du hast eine klare Vorstellung welche Werkzeuge in Phase 3 weitergeführt werden.",
      ],
      tagesplan: "Mache jeden Spaziergang dieser Woche zu einer Bilanz: welche Strategie greift wann? Wo musst du noch eingreifen? Wo läuft es selbstständig? Notiere am Ende der Woche eine ehrliche Bestandsaufnahme.",
      no_gos: [
        "Erfolge als Selbstverständlichkeit nehmen — Aufmerksamkeit bleibt wichtig.",
        "In Phase 3 schon Belohnungs-Dichte stark reduzieren.",
        "Vergleichten mit anderen Hund-Mensch-Teams — eure Reise ist individuell.",
      ],
      fortschritt: [
        "{dogName} setzt mind. 2 Strategien pro Spaziergang aktiv ein.",
        "Du fühlst dich kompetent und handlungsfähig.",
        "Reaktivität ist erkennbar reduziert.",
      ],
      exerciseIds: ["a-bat-distanz", "a-lat"],
    },
  ],
  generalisierung: [
    {
      title: "Verhaltens-Anpassungs-Training im Alltag etablieren",
      schwerpunkt: "Phase 3 = Verhaltens-Anpassungs-Training wird zum Standard. {dogName} bekommt mehr und mehr Kontrolle über ihre Distanz-Wahl. Diese Woche etablierst du Verhaltens-Anpassungs-Training in allen normalen Spaziergangs-Situationen.",
      wochenziele: [
        "Verhaltens-Anpassungs-Training wird täglich in normalen Spaziergängen angewandt.",
        "{dogName} wählt selbst Distanz-Strategien.",
        "Du musst weniger lenken.",
      ],
      tagesplan: "Pro Spaziergang aktiv Verhaltens-Anpassungs-Training-Momente einbauen: bei jedem Auslöser der nicht akut eng kommt, gibst du {dogName} Zeit zur Selbst-Regulation. Sobald Stress-Lösung kommt: mit ihr aktiv weggehen. Funktionale Belohnung wird Standard.",
      no_gos: [
        "Verhaltens-Anpassungs-Training erzwingen — funktioniert nur wenn {dogName} selbst zeigt.",
        "Bei Eskalation Verhaltens-Anpassungs-Training weiterführen — dann Notfall-Protokoll.",
        "Andere Strategien (Schau-Hin, Bogen) komplett weglassen — Verhaltens-Anpassungs-Training ergänzt, ersetzt nicht.",
      ],
      fortschritt: [
        "{dogName} reguliert sich selbstständig in vielen Situationen.",
        "Du fühlst dich als Begleiter, nicht als Lenker.",
        "Spaziergänge sind ruhiger und souveräner.",
        "Bei einer überraschenden Begegnung kennst du die 7-Schritte-Notfall-Sequenz und setzt sie ohne Drama ein.",
      ],
      exerciseIds: ["a-bat-distanz", "a-emergency-protokoll"],
    },
    {
      title: "Auslöser-Hierarchie & Management",
      schwerpunkt: "Identifiziere klar: welche Auslöser sind 'machbar' für {dogName}, welche bleiben Tabu? Management ist genauso wichtig wie Training — und unterscheidet zwischen Realität und Wunschdenken.",
      wochenziele: [
        "Du hast eine klare Auslöser-Hierarchie auf Papier.",
        "Du planst Spaziergänge entsprechend.",
        "Du erkennst, wo Management besser als Training ist.",
      ],
      tagesplan: "Tag 1-2: Erstelle eine Liste eurer Auslöser nach Schwierigkeit. Tag 3-7: plane Spaziergänge entsprechend. Schwierige Auslöser bewusst vermeiden, mittlere aktiv trainieren, einfache zur Routine. Niemals alle Auslöser an einem Tag.",
      no_gos: [
        "Schwierige Auslöser zwingen — eskaliert.",
        "Management als 'Aufgeben' sehen — es ist kluge Realitäts-Anerkennung.",
        "Ohne Plan losziehen — Eskalations-Gefahr.",
      ],
      fortschritt: [
        "Du planst strukturiert.",
        "Eskalationen werden seltener.",
        "Du akzeptierst, dass nicht alles trainierbar ist.",
      ],
      exerciseIds: ["a-schwellenwert-finden", "a-lat"],
    },
    {
      title: "Konfrontations-Pufferzone aufbauen",
      schwerpunkt: "Wenn du weißt, dass eine Begegnung kommt (Park-Eingang, schmaler Weg), arbeitest du mit einer Pufferzone: 20m vorher hörst du auf zu reden, hältst Leckerli bereit, gehst in den 'Trainings-Modus'.",
      wochenziele: [
        "{dogName} kennt die Pufferzone-Routine.",
        "Begegnungen werden vorbereitet, nicht überraschend.",
        "Stress-Reaktionen werden präventiv verhindert.",
      ],
      tagesplan: "Pro Spaziergang plane 3-5 Pufferzonen: 20m vor Hot-Spot in den Trainings-Modus. Hosentaschen-Hand vorbereitet, Leine kürzer, SCHAU-Signal aktiv. Auslöser erscheint: Schau-Hin oder Gegenkonditionierung. Nach 20m außerhalb der Sicht-Linie: entspannen.",
      no_gos: [
        "Pufferzone vergessen, dann reaktiv reagieren.",
        "Pufferzone an einfachen Strecken — verwässert die Strategie.",
        "Zu enge Pufferzone — 5m sind zu wenig.",
      ],
      fortschritt: [
        "{dogName} reagiert auf Pufferzone-Vorbereitung mit ruhiger Erwartung.",
        "Begegnungen verlaufen kontrolliert.",
        "Du nutzt die Strategie reflexartig.",
      ],
      exerciseIds: ["a-bogen-aktiv", "a-lat"],
    },
    {
      title: "Stress-Erholung aktiv steuern",
      schwerpunkt: "Nach jeder schwierigen Begegnung braucht {dogName} Erholungs-Zeit. Stresshormone bauen sich erst nach 72h vollständig ab. Wenn du das berücksichtigst, vermeidest du kumulativen Stress.",
      wochenziele: [
        "Du kennst die 72h-Regel: nach starkem Stress mind. 1-2 Tage Erholung.",
        "{dogName}s Spaziergangs-Plan berücksichtigt Stress-Last.",
        "Kumulativer Stress wird vermieden.",
      ],
      tagesplan: "Notiere nach jedem Spaziergang: hohe Stress-Phase ja/nein? Wenn ja: nächster Tag bewusst ruhig (kürzer Spaziergang, mehr Runterkommen, weniger Auslöser). 72h-Regel: nach starkem Stress 2 Tage 'Erholungs-Modus'.",
      no_gos: [
        "Nach Stress sofort wieder in Auslöser-Bereich gehen — kumuliert.",
        "Stress-Phasen verleugnen — der Hund braucht Erholung.",
        "Erholungs-Modus als 'Verlust' sehen — es ist aktives Training.",
      ],
      fortschritt: [
        "Du erkennst Stress-Last sicher.",
        "{dogName} hat klare Erholungs-Phasen.",
        "Kumulative Stress-Eskalationen werden vermieden.",
      ],
      exerciseIds: ["a-emergency-protokoll", "a-bat-distanz"],
    },
    {
      title: "Belohnungs-Reduktion vorsichtig",
      schwerpunkt: "Nachdem die Strategien sitzen, reduzierst du langsam die Belohnungs-Dichte. Aber: bei Aggression NIEMALS komplett weglassen. Auch nach Jahren bleibt die Verstärkung wichtig.",
      wochenziele: [
        "Belohnungs-Frequenz wird auf ~50% reduziert.",
        "{dogName} hält Strategien auch mit weniger Belohnung.",
        "Spitzenleistungen werden weiterhin mit Jackpot belohnt.",
      ],
      tagesplan: "Bei sicheren, bekannten Auslösern: nicht jedes Mal belohnen. Bei neuen oder schwierigen Auslösern: weiterhin volle Belohnungs-Dichte. {dogName} merkt den Unterschied, sucht aber die Beziehung statt das Leckerli.",
      no_gos: [
        "Belohnungs-Dichte radikal reduzieren — Eskalations-Gefahr.",
        "Bei schwierigen Auslösern Belohnung einsparen — Spitzenleistung kostet.",
        "Reduzierung erzwingen — geduldig schrittweise.",
      ],
      fortschritt: [
        "{dogName} arbeitet auch mit weniger Belohnung.",
        "Die Beziehung wird wertvoller als das Leckerli.",
        "Du steckst weniger Hosentaschen-Hand-Manöver.",
      ],
      exerciseIds: ["a-bat-distanz", "a-lat"],
    },
    {
      title: "Schwierige Orte gezielt",
      schwerpunkt: "Orte, die bisher gemieden wurden: Tierarzt-Wartebereich, Innenstadt zu Trubel-Zeit. Diese Woche arbeitest du bewusst an einzelnen Hot-Spots, immer mit Maulkorb als Sicherheit.",
      wochenziele: [
        "Du bewältigst 1 Hochrisiko-Ort 10 Min ruhig.",
        "Maulkorb wird als Standard für schwierige Orte etabliert.",
        "{dogName} erweitert ihr Komfort-Spektrum.",
      ],
      tagesplan: "Wähle pro Tag genau 1 Hochrisiko-Ort. Maulkorb auf, vorbereitet. 5-10 Min Aufenthalt mit aktiver Schau-Hin/Gegenkonditionierung. Bei Stress: aussteigen, kein Drama. Wichtig: niemals zu lange.",
      no_gos: [
        "Mehrere Hochrisiko-Orte am selben Tag — kumuliert.",
        "Maulkorb-frei in unbekannten Hochrisiko-Bereichen — Sicherheit geht vor.",
        "{dogName} bei Stress 'durchziehen' — eskaliert.",
      ],
      fortschritt: [
        "Hochrisiko-Orte werden bewältigbar.",
        "{dogName} erweitert ihr Repertoire.",
        "Ihr seid flexibler im Alltag.",
      ],
      exerciseIds: ["a-bogen-aktiv", "a-bat-distanz"],
    },
    {
      title: "Bewegte Reize bewältigen",
      schwerpunkt: "Fahrradfahrer, Skateboarder, schnell laufende Jogger — bewegte Reize sind oft die größte Herausforderung bei Aggression. Diese Woche arbeitest du gezielt daran.",
      wochenziele: [
        "{dogName} bewältigt vorbeifahrende Fahrräder aus 10m Distanz ruhig.",
        "Du hast klare Pufferzonen-Strategien für bewegte Reize.",
        "Stress-Reaktionen werden seltener.",
      ],
      tagesplan: "Suche aktiv Wege mit bewegten Reizen (Radwege, Joggingstrecken). Start-Distanz 15m. Schau-Hin bei jedem Vorbeifahren. Belohnungs-Dichte hoch halten. Schrittweise auf 10m reduzieren.",
      no_gos: [
        "Direkt auf schmalen Weg mit ständigem Verkehr.",
        "Bewegte Reize provozieren wollen — Eskalations-Gefahr.",
        "Bei Eskalation einfrieren — Notfall-Protokoll einsetzen.",
      ],
      fortschritt: [
        "{dogName} reagiert ruhiger auf bewegte Reize.",
        "Du fühlst dich auf Multi-Wegen sicher.",
        "Bewegte Reize verlieren ihren Schreck.",
      ],
      exerciseIds: ["a-lat", "a-bogen-aktiv"],
    },
    {
      title: "Übergang in Wartungsmodus",
      schwerpunkt: "Letzte Woche. Aggressions-Arbeit ist Lebensaufgabe, nicht abgeschlossener Prozess. Aber: die Werkzeuge sitzen, Strategien sind eingeübt, du fühlst dich kompetent. Wartungs-Plan steht.",
      wochenziele: [
        "Alle Werkzeuge laufen im Alltag.",
        "Wartungs-Rhythmus ist klar.",
        "Du bist langfristig handlungsfähig.",
      ],
      tagesplan: "Plane den Wartungs-Plan: alle 2-3 Wochen einen 'Trainings-Tag', an dem du gezielt nochmal Schau-Hin/Verhaltens-Anpassungs-Training/Bogen übst. Alle 3 Monate eine Bilanz mit dem Hundetrainer. Maulkorb für Notfälle parat halten. 72h-Regel weiter beachten.",
      no_gos: [
        "Alle Routinen schlagartig weglassen — Rückschritts-Gefahr.",
        "Aggression als 'gelöst' sehen — sie braucht weitere Aufmerksamkeit.",
        "Hochrisiko-Situationen ohne Maulkorb riskieren — Sicherheit bleibt wichtig.",
      ],
      fortschritt: [
        "{dogName} ist langfristig kontrollierbarer.",
        "Du fühlst dich als kompetenter Reaktivitäts-Manager.",
        "Eskalationen sind selten und werden früh erkannt.",
      ],
      exerciseIds: ["a-bat-distanz", "a-emergency-protokoll"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// MOUTHING (Aufnehmen von Gegenständen) — AUS, Tausch, Management
// ────────────────────────────────────────────────────────────────────
const MOUTHING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "AUS-Signal sauber aufbauen",
      schwerpunkt: "AUS ist das wichtigste Signal überhaupt. Es muss POSITIV sein, sonst spuckt {dogName} nichts mehr aus, wenn's wichtig wird. Diese Woche baust du es drinnen mit niedrigwertigen Gegenständen auf.",
      wochenziele: [
        "{dogName} gibt Gegenstände freiwillig her bei AUS.",
        "Das Signal ist mit positiver Belohnung verknüpft.",
        "Du kannst es in ruhigen Situationen sicher einsetzen.",
      ],
      tagesplan: "3-4 Sessions à 5 Min täglich. Starte mit niedrigwertigem Spielzeug. AUS sagen + hochwertiges Leckerli anbieten. {dogName} lässt fallen → FEIN + Leckerli + Spielzeug zurück. {dogName} lernt: AUS bringt was Besseres UND ich kriege das Original zurück.",
      no_gos: [
        "Hand-ins-Maul greifen — vergiftet das Signal.",
        "AUS in drohendem Ton — wird negativ verknüpft.",
        "Hochwertige Gegenstände am Anfang — zu schwer.",
      ],
      fortschritt: [
        "{dogName} gibt einfache Gegenstände bei AUS her.",
        "Reaktionszeit ist unter 3 Sek.",
        "Du hast ein zuverlässiges Werkzeug für Tausch-Situationen.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-pfui-konditionieren"],
    },
    {
      title: "Tausch-Geschäft etablieren",
      schwerpunkt: "Wenn {dogName} draußen was aufgehoben hat, muss ein Tausch die Standard-Reaktion sein. Nicht Konflikt, sondern Aufwertung: ich gebe ab, ich kriege was Besseres.",
      wochenziele: [
        "Du reagierst auf aufgehobenes Objekt mit Tausch, nicht Konflikt.",
        "{dogName} kennt das Tausch-Prinzip.",
        "Hot-Spot-Spaziergänge laufen ohne Drama.",
      ],
      tagesplan: "Übe drinnen mit verschiedenen Gegenständen: {dogName} hat etwas im Maul, du näherst dich ruhig, AUS sagen, Leckerli hochhalten, Tausch. Niemals greifen oder rennen. Pro Tag 5-7 Tausch-Übungen drinnen, dann Übertragung auf Spaziergänge.",
      no_gos: [
        "Dem Hund hinterherrennen wenn er was aufhebt — Spiel-Verstärkung.",
        "Aufgehobenes Objekt zurückgeben — Tausch ist nicht echt dann.",
        "Drohung oder Strafe nutzen — vergiftet die Beziehung.",
      ],
      fortschritt: [
        "{dogName} gibt ab, ohne wegzulaufen.",
        "Tausch ist Standard-Reaktion in Aufhebe-Situationen.",
        "Du fühlst dich nicht mehr machtlos.",
      ],
      exerciseIds: ["m-tausch-protokoll", "m-aus-aufbauen"],
    },
    {
      title: "PFUI als Stop-Signal konditionieren",
      schwerpunkt: "PFUI wird BEVOR {dogName} etwas aufhebt eingesetzt. Sauber konditioniert mit alternativer Belohnung, wird PFUI über Wochen automatisch. Niemals als Strafe.",
      wochenziele: [
        "{dogName} reagiert auf PFUI mit Innehalten.",
        "Sie wendet sich zur Belohnung beim Halter zu.",
        "Das Signal ist drinnen sicher konditioniert.",
      ],
      tagesplan: "Drinnen mit Leckerli auf dem Boden, das {dogName} nicht haben darf: PFUI in fester aber ruhiger Stimme, sofort hochwertiges Leckerli aus der Hand anbieten. {dogName} wendet sich ab vom Boden-Leckerli zur Hand → FEIN + Leckerli. 5-7 Wiederholungen pro Session, 3 Sessions täglich.",
      no_gos: [
        "PFUI als reine Strafe verwenden.",
        "Inflationär nutzen — verwässert die Bedeutung.",
        "Ohne Alternativ-Belohnung — {dogName} versteht die Verknüpfung nicht.",
      ],
      fortschritt: [
        "{dogName} reagiert drinnen sicher auf PFUI.",
        "Reaktionszeit ist unter 2 Sek.",
        "Du bist bereit für die Übertragung nach draußen.",
      ],
      exerciseIds: ["m-pfui-konditionieren", "m-tausch-protokoll"],
    },
    {
      title: "Leinen-Management lernen",
      schwerpunkt: "Die meisten Aufhebe-Situationen sind vermeidbar durch Leinen-Management. An Hotspots (Mülltonnen, Park-Eingänge) hältst du die Leine kurz und lenkst aktiv ab. Prävention statt Reaktion.",
      wochenziele: [
        "Du erkennst eure typischen Hotspots klar.",
        "An Hotspots wird die Leine reflexartig kürzer.",
        "{dogName} lernt: an diesen Stellen ist Aufmerksamkeit beim Halter wertvoller.",
      ],
      tagesplan: "Tag 1-2: notiere bei normalen Spaziergängen, wo {dogName} am häufigsten aufhebt. Tag 3-7: an diesen Stellen aktiv Leine auf 1m, Bei-Fuß-Belohnen während der Passage, alle 5 Schritte ein Leckerli an der Bein-Naht.",
      no_gos: [
        "Hotspots ignorieren — Aufhebe-Erfolg verstärkt das Verhalten.",
        "Leine nur bei {dogName}s sichtbarem Interesse kürzen — präventiv ist besser.",
        "Ohne aktive Belohnung passieren — wird zur Belastung.",
      ],
      fortschritt: [
        "{dogName} sucht an Hotspots die Bein-Position.",
        "Aufhebe-Frequenz an bekannten Stellen reduziert sich.",
        "Du bist proaktiv statt reaktiv.",
      ],
      exerciseIds: ["m-leinen-management", "m-pfui-konditionieren"],
    },
    // Vertiefungen
    {
      title: "AUS unter steigender Wertigkeit",
      schwerpunkt: "Aufbauend auf Woche 1: AUS jetzt mit hochwertigeren Gegenständen, sogar Knochen und Lieblings-Spielzeug. {dogName} muss lernen: auch bei wertvollen Objekten ist Tausch der bessere Deal.",
      wochenziele: [
        "{dogName} gibt auch hochwertige Objekte bei AUS her.",
        "Die Belohnung muss entsprechend wertvoll sein (Hähnchen, Wurst).",
        "Du hast volles Vertrauen in das Signal.",
      ],
      tagesplan: "Steigere Wertigkeit Tag für Tag: Tag 1-2: einfaches Spielzeug. Tag 3-4: Lieblings-Spielzeug. Tag 5-7: Knochen oder Kauartikel. Bei jedem AUS muss die Belohnung dem Objekt entsprechen — bei Knochen MEGA-Hähnchen.",
      no_gos: [
        "Wertigkeit zu schnell steigern — Frust.",
        "Belohnung zu niedrig — {dogName} gibt nicht ab.",
        "AUS bei extrem hochwertigem Objekt (Resourcen-Verteidigung) ohne professionelle Hilfe — gefährlich.",
      ],
      fortschritt: [
        "AUS funktioniert auch bei hochwertigen Objekten.",
        "{dogName} sucht aktiv Tausch-Gelegenheiten.",
        "Du hast Vertrauen in das Werkzeug.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-tausch-protokoll"],
    },
    {
      title: "Maulkorb für Übergangszeit",
      schwerpunkt: "Solange das Training nicht 100% steht, schützt ein Maulkorb {dogName} vor Giftködern und scharfen Gegenständen. Diese Woche konditionierst du ihn positiv.",
      wochenziele: [
        "{dogName} trägt den Maulkorb 10-15 Min entspannt.",
        "Sie kann mit Maulkorb trinken und schnüffeln.",
        "Maulkorb ist Sicherheits-Werkzeug, keine Strafe.",
      ],
      tagesplan: "Tag 1-3: Maulkorb in der Wohnung sichtbar, Leckerli durch Gitterstäbe. Tag 4-5: kurze Tragezeiten 1-2 Min mit Beschäftigung. Tag 6-7: 10-15 Min Tragezeit mit Kong. Übertrag in Phase 2 in echte Hochrisiko-Spaziergänge.",
      no_gos: [
        "Maulkorb zu schnell für lange Zeit aufsetzen — Frust.",
        "Maulkorb als Strafe nutzen — vergiftet die Verknüpfung.",
        "Falschen Typ wählen (Stoff-Schlinge) — auch Hecheln blockiert.",
      ],
      fortschritt: [
        "{dogName} trägt Maulkorb entspannt.",
        "Du hast ein Sicherheits-Backup.",
        "Maulkorb ist Routine, kein Drama.",
      ],
      exerciseIds: ["m-maulkorb-uebergang", "m-leinen-management"],
    },
    {
      title: "Belohnungs-Suche als Alternative",
      schwerpunkt: "Hunde mit Aufnehme-Trieb haben oft starken Such-Trieb. Wir kanalisieren das produktiv: aktiv suchen statt zufällig aufnehmen. Die Nase wird beschäftigt mit ERLAUBTEM Suchen.",
      wochenziele: [
        "{dogName} sucht aktiv geworfenes Futter.",
        "Belohnungs-Suche ersetzt zufälliges Aufnehmen teilweise.",
        "Such-Trieb wird produktiv kanalisiert.",
      ],
      tagesplan: "Pro Spaziergang an sicheren Stellen (Wiese, sauberer Park): kleines Leckerli werfen und SUCH sagen. {dogName} sucht aktiv mit der Nase. 5-7 mal pro Spaziergang. Steigerung: 2 Leckerlis gleichzeitig in verschiedene Richtungen.",
      no_gos: [
        "SUCH-Spiel an Hotspot-Strecken — überfordert.",
        "{dogName} aktiv hinweisen — die selbstständige Suche ist der Lerneffekt.",
        "Belohnungen zu groß — Hund wird satt vor Spaziergangs-Ende.",
      ],
      fortschritt: [
        "{dogName} sucht aktiv geworfene Belohnungen.",
        "Such-Trieb ist produktiv ausgelastet.",
        "Aufhebe-Verhalten reduziert sich teilweise.",
      ],
      exerciseIds: ["m-belohnungs-suche", "m-leinen-management"],
    },
    {
      title: "Fundament-Check",
      schwerpunkt: "Letzte Fundament-Woche. AUS positiv? Tausch sitzt? PFUI klappt drinnen? Maulkorb akzeptiert? Diese Werkzeuge sind die Basis für draußen-Anwendung.",
      wochenziele: [
        "Alle 4 Bausteine sind etabliert: AUS, Tausch, PFUI, Maulkorb.",
        "Du fühlst dich vorbereitet für Außen-Anwendung.",
        "{dogName} kennt die Werkzeuge.",
      ],
      tagesplan: "Mache ehrliche Bilanz: was sitzt, was wackelt? Falls Schwäche: 1 Extra-Woche dranhängen. Sauberes Fundament ist Voraussetzung für draußen.",
      no_gos: [
        "Aus Ungeduld in Phase 2 springen.",
        "Mehrere Schwächen gleichzeitig nachreparieren.",
        "Plan aufgeben weil Fundament länger dauert.",
      ],
      fortschritt: [
        "Du fühlst dich kompetent.",
        "Werkzeuge sitzen klar.",
        "{dogName} kennt die Bausteine.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-tausch-protokoll"],
    },
  ],
  steigerung: [
    {
      title: "AUS draußen an leichten Auslösern",
      schwerpunkt: "Übertragung von drinnen nach draußen. {dogName} hat etwas Niedrigwertiges aufgehoben (Stück Papier, Blatt): AUS-Tausch wie drinnen geübt. Im echten Setting.",
      wochenziele: [
        "AUS funktioniert draußen bei niedrigwertigen Aufnahmen.",
        "Du reagierst ruhig und ohne Drama.",
        "{dogName} versteht: das Prinzip gilt auch draußen.",
      ],
      tagesplan: "Pro Spaziergang erwarte 2-3 Aufhebe-Situationen, sei vorbereitet. Bei Aufnehmen: ruhig ranschauen, AUS sagen, hochwertiges Leckerli anbieten. Belohnungs-Frequenz hoch in dieser Phase.",
      no_gos: [
        "Bei höherwertigen Objekten (Knochen, Fleisch) sofort mit AUS — zu schwer für Phase 2.",
        "Konflikt suchen wenn AUS nicht klappt — eskaliert.",
        "Ohne Leckerli losziehen — Tausch ist unmöglich ohne.",
      ],
      fortschritt: [
        "AUS klappt draußen bei einfachen Objekten.",
        "Reaktionszeit ist akzeptabel.",
        "Du fühlst dich handlungsfähig.",
      ],
      exerciseIds: ["m-pfui-konditionieren", "m-tausch-protokoll"],
    },
    {
      title: "PFUI draußen einsetzen",
      schwerpunkt: "PFUI wird BEVOR {dogName} aufhebt eingesetzt. Wenn du siehst, dass sie sich danach beugt: PFUI + Alternativ-Belohnung. Über Wochen wird PFUI automatisch.",
      wochenziele: [
        "Du erkennst Aufhebe-Anzeichen früh (Nase Boden, Geh-Tempo ändert).",
        "PFUI wird präventiv eingesetzt.",
        "{dogName} reagiert mit Innehalten und Wenden zum Halter.",
      ],
      tagesplan: "Pro Spaziergang 5-10 PFUI-Einsätze, jedesmal präventiv: bevor {dogName} aufhebt. Bei Reaktion: FEIN + Leckerli. Bei Nicht-Reaktion: 1m näher ran, körperlich abblocken, Leckerli anbieten.",
      no_gos: [
        "PFUI inflationär — wirkt nicht mehr.",
        "PFUI ohne Alternativ-Belohnung — Strafe statt Training.",
        "Aufhebe-Anzeichen ignorieren — PFUI kommt zu spät.",
      ],
      fortschritt: [
        "PFUI klappt draußen.",
        "Du erkennst Anzeichen früh.",
        "Aufhebe-Versuche reduzieren sich.",
      ],
      exerciseIds: ["m-pfui-konditionieren", "m-tausch-protokoll"],
    },
    {
      title: "Leinen-Management an Hotspots",
      schwerpunkt: "Aktives Leinen-Management an euren typischen Aufhebe-Hotspots. Leine kurz, Belohnung an der Bein-Position. Prävention durch räumliche Kontrolle.",
      wochenziele: [
        "An Hotspots wird die Leine reflexartig kurz.",
        "{dogName} sucht an Hotspots die Bein-Position.",
        "Aufhebe-Frequenz an bekannten Stellen reduziert sich deutlich.",
      ],
      tagesplan: "Pro Spaziergang an 3-5 Hotspots Leine auf 1m, kontinuierliche Belohnung an der Bein-Naht alle 5 Schritte. {dogName} fokussiert sich auf dich, nicht auf den Boden. Nach Hotspot: Leine wieder lockerer.",
      no_gos: [
        "Leine NUR an Hotspots kürzen — {dogName} merkt sich das.",
        "Ohne aktive Belohnung — wird zur Belastung.",
        "Hotspot-Strecken vermeiden wenn vermeidbar — Vermeidung ist auch Lösung.",
      ],
      fortschritt: [
        "Aufhebe-Verhalten an Hotspots reduziert sich.",
        "{dogName} sucht aktiv die Bein-Position.",
        "Spaziergänge fühlen sich kontrollierter an.",
      ],
      exerciseIds: ["m-leinen-management", "m-pfui-konditionieren"],
    },
    {
      title: "Belohnungs-Suche aktiv nutzen",
      schwerpunkt: "Such-Trieb wird produktiv genutzt: pro Spaziergang mehrere geworfene Belohnungen, {dogName} lernt aktiv mit der Nase zu suchen statt zufällig aufzuheben.",
      wochenziele: [
        "5-7 SUCH-Einheiten pro Spaziergang.",
        "{dogName} sucht aktiv und konzentriert.",
        "Such-Trieb wird kanalisiert.",
      ],
      tagesplan: "Pro Spaziergang an sicheren Stellen (sauber, ohne Müll) 5-7 mal Leckerli werfen + SUCH. Steigerung über die Woche: schwerere Verstecke, 2 Leckerlis gleichzeitig, höheres Gras. Spaziergänge werden zu Mini-Spuren-Such-Sessions.",
      no_gos: [
        "An unsicheren Stellen mit Müll oder Giftköder-Gefahr — Such-Spiel mit kontrollierten Belohnungen, nicht freies Aufnehmen.",
        "Leckerlis zu groß — {dogName} wird satt vor Spaziergangs-Ende.",
        "Such-Spiel als Hauptmahlzeit — sollte zusätzlich sein.",
      ],
      fortschritt: [
        "Such-Spiel ist eingespielt.",
        "{dogName} arbeitet aktiv mit der Nase.",
        "Aufhebe-Verhalten reduziert sich.",
      ],
      exerciseIds: ["m-belohnungs-suche", "m-leinen-management"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "AUS bei höherwertigen Objekten",
      schwerpunkt: "Schwierigkeits-Steigerung: {dogName} hebt einen Knochen oder Lebensmittel auf. AUS muss auch hier funktionieren. Mega-Hähnchen-Belohnung steht bereit.",
      wochenziele: [
        "AUS funktioniert bei hochwertigen Objekten draußen.",
        "Mega-Belohnung wird konsistent angeboten.",
        "{dogName} gibt auch wertvolle Objekte her.",
      ],
      tagesplan: "Vorbereitung: pro Spaziergang Hosentasche mit MEGA-Belohnung (kleines Stück Wurst oder Hähnchen). Bei höherwertigem Aufhebe-Objekt: AUS + Wurst sofort anbieten. Niemals ohne MEGA-Belohnung in diese Situationen.",
      no_gos: [
        "MEGA-Belohnung sparen — bei hochwertigen Objekten kostet es.",
        "Aufgenommenes hochwertiges Objekt zurückgeben — Tausch ist nicht echt.",
        "Konflikt suchen wenn AUS nicht klappt — Resourcen-Verteidigung droht.",
      ],
      fortschritt: [
        "AUS klappt bei verschiedenen Wertigkeiten.",
        "Du fühlst dich gewappnet.",
        "Tausch-Geschäft ist robust etabliert.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-tausch-protokoll"],
    },
    {
      title: "Maulkorb in Hochrisiko-Zonen",
      schwerpunkt: "An besonders schwierigen Strecken (Parkrand mit Müll, Stadt-Spaziergänge) setzt du den Maulkorb ein. Sicherheit geht vor Wunschdenken.",
      wochenziele: [
        "Maulkorb wird in Hochrisiko-Spaziergängen routinemäßig getragen.",
        "{dogName} reagiert positiv auf die Maulkorb-Vorbereitung.",
        "Du fühlst dich sicher in schwierigen Situationen.",
      ],
      tagesplan: "Identifiziere eure Hochrisiko-Strecken. An diesen Tagen vor Spaziergangs-Start: Maulkorb auf mit Kong-Belohnung. Spaziergang normal, AUS-Tausch wo möglich. Nach Spaziergang: Maulkorb ab, MEGA-Belohnung.",
      no_gos: [
        "Maulkorb beim ersten Spaziergang ohne positive Konditionierung — Frust.",
        "Maulkorb für ALLE Spaziergänge — er ist Werkzeug, nicht Standard.",
        "Maulkorb-frei in extrem riskanten Bereichen riskieren — Sicherheits-Versagen.",
      ],
      fortschritt: [
        "Maulkorb-Tragen ist Routine.",
        "Hochrisiko-Spaziergänge sind sicher.",
        "Du bist entspannter in schwierigen Situationen.",
      ],
      exerciseIds: ["m-maulkorb-uebergang", "m-leinen-management"],
    },
    {
      title: "Kombi-Strategie: PFUI + AUS + Tausch",
      schwerpunkt: "Diese Woche kombinierst du alle drei Werkzeuge fließend: PFUI bei Aufhebe-Anzeichen, AUS wenn schon aufgehoben, Tausch zur Belohnung. Sequenz wird automatisch.",
      wochenziele: [
        "Du nutzt die Sequenz reflexartig.",
        "{dogName} versteht das System.",
        "Aufhebe-Situationen werden flexibel gelöst.",
      ],
      tagesplan: "Pro Spaziergang aktiv die Sequenz anwenden: 1. PFUI bei Anzeichen → wenn klappt, FEIN. 2. AUS wenn schon aufgehoben → Tausch. 3. Bei Hochrisiko: Maulkorb. Die Sequenz wird über die Woche flüssig.",
      no_gos: [
        "Werkzeuge in falscher Reihenfolge nutzen — PFUI ist präventiv, AUS reaktiv.",
        "Einzelne Werkzeuge weglassen — System ist mehr als die Summe.",
        "Hektisch wechseln — ruhige Sequenz.",
      ],
      fortschritt: [
        "Du wendest die Sequenz reflexartig an.",
        "{dogName} reagiert vorhersehbar auf jeden Schritt.",
        "Aufhebe-Verhalten ist deutlich reduziert.",
      ],
      exerciseIds: ["m-pfui-konditionieren", "m-aus-aufbauen", "m-tausch-protokoll"],
    },
    {
      title: "Festigung Steigerung",
      schwerpunkt: "Letzte Steigerungs-Woche. Alle Werkzeuge sitzen, Sequenz ist flüssig. Phase 3 = Generalisierung im echten Alltag mit Belohnungs-Reduktion.",
      wochenziele: [
        "Alle Werkzeuge laufen flüssig.",
        "Aufhebe-Frequenz ist deutlich reduziert.",
        "Du bist auf Phase 3 vorbereitet.",
      ],
      tagesplan: "Bilanz-Woche: was funktioniert super, was wackelt? Notiere {dogName}s typische Aufhebe-Muster. Plane für Phase 3 die Belohnungs-Reduktion und neue Strecken.",
      no_gos: [
        "Erfolge als Selbstverständlichkeit nehmen.",
        "Belohnungs-Dichte zu schnell reduzieren.",
        "Maulkorb komplett weglassen wenn noch Hochrisiko-Spaziergänge.",
      ],
      fortschritt: [
        "Aufhebe-Verhalten ist deutlich reduziert.",
        "Du fühlst dich kompetent.",
        "Werkzeuge sitzen flüssig.",
      ],
      exerciseIds: ["m-leinen-management", "m-belohnungs-suche"],
    },
  ],
  generalisierung: [
    {
      title: "Belohnungs-Reduktion mit Vorsicht",
      schwerpunkt: "Phase 3 startet mit vorsichtiger Reduktion der Belohnungs-Dichte. Aber: NIE komplett weglassen, sonst kommt das alte Verhalten zurück. Variable Verstärkung bleibt.",
      wochenziele: [
        "Belohnungs-Frequenz wird auf ~50% reduziert.",
        "{dogName} reagiert auf Werkzeuge auch mit weniger Belohnung.",
        "Spitzenleistungen werden weiterhin mit Jackpot belohnt.",
      ],
      tagesplan: "Bei sicheren Routine-Situationen: nicht jedes AUS oder Tausch mit Leckerli. Bei neuen oder schwierigen Situationen: weiterhin volle Belohnung. {dogName} lernt: das System bleibt, aber nicht jedes Mal Hähnchen.",
      no_gos: [
        "Belohnung komplett streichhen — Rückfall.",
        "Reduktion an schwierigen Strecken — zu früh.",
        "Belohnungs-Dichte radikal senken — schrittweise.",
      ],
      fortschritt: [
        "{dogName} reagiert auch mit weniger Belohnung.",
        "Du steckst seltener in die Hosentasche.",
        "Verhalten wird stabiler ohne Dauer-Verstärkung.",
      ],
      exerciseIds: ["m-belohnungs-suche", "m-leinen-management"],
    },
    {
      title: "Verschiedene Strecken: Generalisierung",
      schwerpunkt: "{dogName} überträgt das Aufhebe-Management auf neue Strecken. Neue Umgebung = neue Aufhebe-Reize, aber dieselbe Strategie.",
      wochenziele: [
        "{dogName} bewältigt 2-3 neue Strecken erfolgreich.",
        "Strategien funktionieren strecken-übergreifend.",
        "Du bist flexibel in der Spaziergangs-Wahl.",
      ],
      tagesplan: "Plane in der Woche 3 verschiedene Strecken: eure gewohnte, eine neue im Nachbarort, eine in der Stadt. Auf neuen Strecken: Belohnungs-Dichte wieder höher, weil neue Reize. PFUI/AUS/Tausch wie geübt.",
      no_gos: [
        "Auf neuen Strecken Belohnung wie auf gewohnten — zu wenig.",
        "Mehrere neue Strecken pro Tag — überfordert.",
        "Erwarten dass es überall genau wie zu Hause klappt.",
      ],
      fortschritt: [
        "Strategien funktionieren in verschiedenen Settings.",
        "Du fühlst dich flexibel.",
        "Aufhebe-Verhalten ist generalisiert reduziert.",
      ],
      exerciseIds: ["m-leinen-management", "m-pfui-konditionieren"],
    },
    {
      title: "Hot-Spots durchspielen",
      schwerpunkt: "Diese Woche arbeitest du bewusst an euren persönlichen Hot-Spots. Tierarzt-Eingang? Bushaltestelle? Park-Eingang? Pro Hot-Spot eine konkrete Strategie.",
      wochenziele: [
        "Du hast eine Strategie pro Haupt-Hotspot.",
        "{dogName} bewältigt die schwierigsten Stellen.",
        "Aufhebe-Frequenz an Hot-Spots reduziert sich messbar.",
      ],
      tagesplan: "Identifiziere eure Top-3 Hot-Spots. Plane pro Hot-Spot eine spezifische Strategie: Maulkorb? Kurze Leine + Bei-Fuß? PFUI präventiv? Übe diese Strategie 3-4 mal an dem jeweiligen Spot.",
      no_gos: [
        "Mehrere Hot-Spots pro Tag — kumulative Reizüberflutung.",
        "Hot-Spots vermeiden statt bewusst zu arbeiten — Verlust eines Übungsmoment.",
        "Strategie pro Hot-Spot wechseln — Konsistenz ist alles.",
      ],
      fortschritt: [
        "Du hast klare Strategien pro Hot-Spot.",
        "{dogName} reagiert vorhersehbar.",
        "Hot-Spots verlieren ihren Schrecken.",
      ],
      exerciseIds: ["m-leinen-management", "m-maulkorb-uebergang"],
    },
    {
      title: "Nasenarbeit als Hauptauslastung",
      schwerpunkt: "{dogName}s Such-Trieb wird intensiv produktiv genutzt: längere Spuren-Such-Sessions, komplexere Suchspiele, Schnüffel-Wanderungen. Mehr Such-Befriedigung = weniger zufälliges Aufhebe-Verhalten.",
      wochenziele: [
        "Mind. 1 längere Nasenarbeit-Session pro Spaziergang.",
        "Such-Trieb wird intensiv kanalisiert.",
        "{dogName} ist nach Nasenarbeit ruhig und zufrieden.",
      ],
      tagesplan: "Pro Spaziergang 1 längere Such-Einheit (10-15 Min): 20-30m Such-Spur, Schnüffel-Wanderung durch hohes Gras mit verteilten Belohnungen, Such-Spiele mit verschiedenen Schwierigkeiten.",
      no_gos: [
        "Nasenarbeit als reine Ablenkung sehen — sie ist primäre Befriedigung.",
        "Such-Aufgaben zu einfach — überfordert nicht, beschäftigt nicht.",
        "Spaziergänge ohne Such-Einheit — Such-Trieb sucht sich was anderes.",
      ],
      fortschritt: [
        "Such-Trieb ist produktiv ausgelastet.",
        "Aufhebe-Verhalten ist deutlich reduziert.",
        "Spaziergänge sind erfüllend.",
      ],
      exerciseIds: ["m-belohnungs-suche", "m-leinen-management"],
    },
    {
      title: "Schwierige Tageszeiten",
      schwerpunkt: "Stoßzeiten, wenn viele Hunde unterwegs sind. Wenn Aufhebe-Risiko hoch ist (Park am Wochenende, Stadt zur Lunch-Zeit). Diese Woche meisterst du auch diese Phasen.",
      wochenziele: [
        "Du bewältigst Stoßzeiten ruhig.",
        "Strategien funktionieren auch unter Reizüberflutung.",
        "Du planst flexibel.",
      ],
      tagesplan: "1-2 mal in der Woche bewusst eine schwierige Tageszeit aussuchen: Sonntagmittag im Park, Schulbeginn an Schule. Vorbereitung: Hand voll Leckerlis, Maulkorb wenn Hochrisiko. Pro Spaziergang 1-2 schwierige Situationen, max.",
      no_gos: [
        "Sich überschätzen und in dichtesten Trubel.",
        "Bei Stress weitermachen — abbrechen.",
        "Schwierige Zeiten generell meiden — schränkt euch zu sehr ein.",
      ],
      fortschritt: [
        "Du bewältigst schwierige Tageszeiten.",
        "Strategien funktionieren auch unter Druck.",
        "Euer Aktivitäts-Radius wird größer.",
      ],
      exerciseIds: ["m-leinen-management", "m-aus-aufbauen"],
    },
    {
      title: "Maulkorb-Reduktion (wenn möglich)",
      schwerpunkt: "Wenn die Werkzeuge nach mehreren Monaten sicher sitzen, kannst du den Maulkorb in bestimmten Situationen weglassen. Aber NUR wenn AUS und PFUI zu 95%+ klappen.",
      wochenziele: [
        "Du hast eine klare Entscheidung: Maulkorb wann ja, wann nein.",
        "Bei Maulkorb-frei sind die Werkzeuge zuverlässig.",
        "Sicherheit bleibt das oberste Prinzip.",
      ],
      tagesplan: "Tag 1-3: bewerte ehrlich, ob AUS und PFUI auf bekannten Strecken zu 95%+ klappen. Wenn ja: Maulkorb-frei auf diesen bekannten Strecken testen. Wenn nein: Maulkorb-Routine beibehalten. Bei Hochrisiko-Strecken: weiter Maulkorb.",
      no_gos: [
        "Maulkorb-Reduktion aus Bequemlichkeit ohne saubere Bewertung.",
        "Maulkorb-frei auf neuen oder schwierigen Strecken — zu riskant.",
        "Komplette Maulkorb-Abschaffung — bei reaktiven Hunden bleibt er Werkzeug.",
      ],
      fortschritt: [
        "Du nutzt Maulkorb gezielt, nicht reflexartig.",
        "Werkzeuge sind zuverlässig.",
        "Sicherheit ist gewährleistet.",
      ],
      exerciseIds: ["m-maulkorb-uebergang", "m-aus-aufbauen"],
    },
    {
      title: "Wartung & Reizüberflutungs-Notfall",
      schwerpunkt: "Wartungs-Routine für die nächsten Monate. Plus: ein klares Notfall-Protokoll für Reizüberflutung (z.B. bei Müll-Müllabfuhr-Tag) wenn {dogName} doch wieder ins alte Verhalten rutscht.",
      wochenziele: [
        "Wartungs-Plan ist klar.",
        "Notfall-Protokoll bei Reizüberflutung ist geübt.",
        "Du fühlst dich langfristig handlungsfähig.",
      ],
      tagesplan: "Wartungs-Plan: alle 2 Wochen einen 'Refresher-Tag' mit allen Werkzeugen. Notfall-Protokoll: bei massiver Reizüberflutung sofort Maulkorb, kurze Leine, Strecke abbrechen, andere Route. Plan-Skizze auf Papier.",
      no_gos: [
        "Alle Routinen schlagartig weglassen.",
        "Rückfälle als 'Aufgabe' sehen — kurze Refresher reichen oft.",
        "Notfall-Protokoll erst im Notfall einüben — vorher trockene Sequenz.",
      ],
      fortschritt: [
        "Du hast eine klare Wartungs-Routine.",
        "Notfall-Protokoll sitzt.",
        "Du fühlst dich langfristig kompetent.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-maulkorb-uebergang"],
    },
    {
      title: "Übergang in Wartungsmodus",
      schwerpunkt: "Letzte Woche. Aufhebe-Verhalten ist deutlich reduziert, Werkzeuge sitzen, Wartungs-Plan steht. {dogName} ist ein anderer Hund als zu Plan-Beginn.",
      wochenziele: [
        "Alle Routinen laufen selbstständig.",
        "Wartungs-Rhythmus ist klar.",
        "{dogName} ist langfristig sicherer in Aufhebe-Situationen.",
      ],
      tagesplan: "Reduziere aktives Training auf Minimum. Beobachte. Plane alle 4-6 Wochen einen Refresher mit AUS/PFUI/Tausch-Wiederholungen. Maulkorb für Hochrisiko-Strecken parat.",
      no_gos: [
        "Routinen schlagartig weglassen.",
        "Beobachten aufhören — kleine Rückfälle früh erkennen.",
        "Wartungs-Refresher auf nie verschieben.",
      ],
      fortschritt: [
        "{dogName} ist langfristig zuverlässiger.",
        "Du fühlst dich kompetent.",
        "Aufhebe-Verhalten ist Ausnahme, nicht Normalfall.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-leinen-management"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// RECALL (unzuverlässiger Rückruf) — HIER laden + Schleppleine
// ────────────────────────────────────────────────────────────────────
const RECALL_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "HIER neu laden mit Top-Belohnungen",
      schwerpunkt: "Wenn HIER nicht 100% positiv ist, kommt {dogName} nicht zuverlässig. Diese Woche lädst du HIER (oder ein neues Wort KOMM-HER) mit absoluten Top-Belohnungen neu auf.",
      wochenziele: [
        "{dogName} reagiert in der Wohnung in unter 2 Sek auf KOMM-HER.",
        "Belohnung ist hochwertig: Hähnchen oder Käse, nicht Trockenfutter.",
        "Die Verknüpfung KOMM-HER = Bester Moment des Tages ist etabliert.",
      ],
      tagesplan: "Drinnen, 3 Sessions täglich. Aus 3m Entfernung: KOMM-HER in fröhlich-ruhigem Ton. {dogName} kommt → JACKPOT von 5 Hähnchen-Stücken hintereinander. Lass sie dann wieder gehen, ohne Forderung. Keine Anleinung, keine Ende-Verknüpfung.",
      no_gos: [
        "KOMM-HER für Negatives nutzen (Bad, Tierarzt, Anleinen) — vergiftet das Signal.",
        "Trockenfutter als Belohnung — zu niedrig wertig.",
        "Verknüpfung mit Spaziergangs-Ende — KOMM-HER endet niemals den Spaß.",
      ],
      fortschritt: [
        "{dogName} kommt drinnen blitzschnell.",
        "Begeisterung beim Hören des Signals ist sichtbar.",
        "Du hast die Basis für Phase 2 gelegt.",
        "Die Hundepfeife ist als zweites Signal positiv verknüpft.",
      ],
      exerciseIds: ["r-hier-laden", "r-pfeife-aufbauen"],
    },
    {
      title: "Festhalte-Rückruf: Festhalte-Spiel",
      schwerpunkt: "Klassisches Spiel mit Helfer: jemand hält {dogName}, du rennst weg, rufst KOMM-HER. {dogName} sprintet mit hoher Energie. Funktioniert fast immer und steigert Motivation massiv.",
      wochenziele: [
        "{dogName} sprintet bei KOMM-HER zu dir.",
        "Sie kommt mit hoher Motivation.",
        "Distanz wird auf 30-50m gesteigert.",
      ],
      tagesplan: "Mit Helfer (Partner): {dogName} wird festgehalten, du gehst 10m weg in Sicht. Du hockst dich tief, ruft fröhlich KOMM-HER + Helfer lässt los. {dogName} sprintet zu dir. JACKPOT von 5-7 Hähnchen + überschwängliches Lob. Wiederhole 4-6 mal pro Session.",
      no_gos: [
        "Ohne Helfer üben — fehlt die Spannung.",
        "Distanz zu schnell steigern — überfordert.",
        "Belohnung schwach machen — Motivation sinkt.",
      ],
      fortschritt: [
        "{dogName} sprintet zuverlässig.",
        "Distanz auf 30-50m gesteigert.",
        "Motivation ist hoch.",
      ],
      exerciseIds: ["r-restraint-recall", "r-hier-laden"],
    },
    {
      title: "Schleppleinen-Arbeit beginnen",
      schwerpunkt: "Bevor Freilauf riskiert wird: Schleppleinen-Arbeit. 5-10m Leine gibt {dogName} Bewegungsfreiheit, du hast Notfall-Kontrolle. Brücke zwischen Drinnen und Freilauf.",
      wochenziele: [
        "Schleppleine ist gut sitzend und benutzbar.",
        "{dogName} ist mit der Schleppleine vertraut.",
        "Erste Schleppleinen-Spaziergänge sind etabliert.",
      ],
      tagesplan: "Investiere in eine 5-10m Biothane-Schleppleine. An ruhigen Orten ohne andere Hunde: {dogName} darf 5-10m schnüffeln. Alle 5 Min: KOMM-HER. Bei Kommen: Jackpot. Bei Nicht-Kommen: ruhig Leine aufnehmen, ohne Drama.",
      no_gos: [
        "Schleppleine als Seil — verbrennt die Hände, Verletzungsgefahr.",
        "An stark frequentierten Orten — Verheddergefahr.",
        "Schleppleine als Strafe nutzen — vergiftet das Werkzeug.",
      ],
      fortschritt: [
        "Schleppleinen-Spaziergänge sind eingespielt.",
        "{dogName} fühlt sich frei aber sicher.",
        "Du hast eine Sicherheits-Brücke.",
      ],
      exerciseIds: ["r-schleppleine", "r-hier-laden"],
    },
    {
      title: "Hundepfeife als Backup-Signal",
      schwerpunkt: "Eine Hundepfeife trägt 200m+, klingt immer gleich, kann nicht 'vergiftet' werden. Diese Woche konditionierst du sie als zweites Rückruf-Signal — Backup für den Notfall.",
      wochenziele: [
        "{dogName} reagiert auf den Pfeifen-Ton zuverlässig.",
        "Die Verknüpfung Pfeife = Jackpot ist etabliert.",
        "Du hast ein lautes Backup-Signal.",
      ],
      tagesplan: "Kaufe eine ACME 211.5 Pfeife. Drinnen: pfeife einen klaren Doppelton, gib Jackpot. 5-7 Wiederholungen pro Session, 2 Sessions täglich. {dogName} verknüpft Pfeife mit Belohnung. Niemals für Negatives nutzen.",
      no_gos: [
        "Pfeife inflationär nutzen — verliert die Magie.",
        "Pfeife für Negatives — wie bei KOMM-HER vergiftet.",
        "Mit verschiedenen Pfeifen-Tönen experimentieren — Konsistenz ist alles.",
      ],
      fortschritt: [
        "{dogName} reagiert auf Pfeife in 2-3 Sek.",
        "Du hast ein Backup für Stimm-Probleme.",
        "Pfeife wird zur Garantie.",
      ],
      exerciseIds: ["r-pfeife-aufbauen", "r-hier-laden"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Schleppleinen-Sicherheit & Routine",
      schwerpunkt: "Schleppleinen-Arbeit wird zur täglichen Routine. {dogName} bewegt sich frei, aber unter Kontrolle. Du übst KOMM-HER an verschiedenen Orten.",
      wochenziele: [
        "Tägliche Schleppleinen-Spaziergänge sind Standard.",
        "{dogName} kommt zuverlässig auf Rückruf.",
        "Du verschiedene Orte abgedeckt.",
      ],
      tagesplan: "Pro Spaziergang Schleppleine. Verschiedene Orte ausprobieren: Wiese, Wald, Park-Randzone. KOMM-HER alle 5-10 Min, Jackpot bei Erfolg. Bei Nicht-Erfolg: ruhig zurückziehen, beim Auftauchen trotzdem 2 Leckerlis.",
      no_gos: [
        "An Hochrisiko-Orten (Straßennähe) — Verletzungsgefahr.",
        "Schleppleine zu stramm halten — {dogName} fühlt sich nicht frei.",
        "Ohne genug Belohnung losziehen.",
      ],
      fortschritt: [
        "Routine ist eingespielt.",
        "{dogName} reagiert zuverlässig.",
        "Du sammelst Schleppleinen-Erfahrung.",
      ],
      exerciseIds: ["r-schleppleine", "r-hier-laden"],
    },
    {
      title: "KOMM-HER unter Mini-Ablenkung",
      schwerpunkt: "Erste leichte Ablenkungen während Rückruf: ein Vogel im Hintergrund, ein anderer Hund in 30m. {dogName} lernt: KOMM-HER funktioniert auch mit Reizen.",
      wochenziele: [
        "{dogName} kommt bei leichter Ablenkung.",
        "Erfolgsrate ist bei 70-80%.",
        "Bei Nicht-Kommen: ruhig zurückziehen, kein Drama.",
      ],
      tagesplan: "Mit Schleppleine an Orten mit leichter Ablenkung. KOMM-HER rufen während {dogName} schnüffelt oder einen Reiz beobachtet. Erfolg: SUPER-Jackpot. Nicht-Erfolg: Leine sanft zur dir, beim Auftauchen 3 Leckerlis.",
      no_gos: [
        "Druck erhöhen wenn Erfolgsrate sinkt — Ablenkung reduzieren.",
        "Ablenkung zu groß für Phase 1 — Schwellenwert respektieren.",
        "KOMM-HER mehrfach rufen — 1 mal ist 1 mal.",
      ],
      fortschritt: [
        "Erfolgsrate steigt unter Ablenkung.",
        "{dogName} versteht: KOMM-HER lohnt sich immer.",
        "Du bist bereit für Phase 2.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-schleppleine"],
    },
    {
      title: "Wann KOMM-HER NICHT nutzen",
      schwerpunkt: "Diese Woche verstehst du wann KOMM-HER NICHT verwendet wird: wenn du nicht sicher bist, ob {dogName} kommt. Jedes Nicht-Kommen schwächt das Signal. Lieber gar nicht rufen als rufen ohne Erfolg.",
      wochenziele: [
        "Du erkennst, wann KOMM-HER sinnlos ist.",
        "Du nutzt es nur bei 80%+ Erfolgswahrscheinlichkeit.",
        "Bei niedrigerer Wahrscheinlichkeit: Schleppleine sanft aufnehmen.",
      ],
      tagesplan: "Bewusste Beobachtung: in welchen Situationen kommt {dogName} 100%, 80%, 50%, 20%? Notiere. Nutze KOMM-HER nur bei 80%+ Wahrscheinlichkeit. Bei niedriger Wahrscheinlichkeit: gar nicht rufen, Schleppleine aufnehmen.",
      no_gos: [
        "KOMM-HER rufen wenn {dogName} jagt — Signal-Vergiftung.",
        "Mehrfach rufen — schwächt jedes Mal.",
        "Bei Nicht-Kommen ärgerlich werden — vergiftet die Verknüpfung.",
      ],
      fortschritt: [
        "Du nutzt KOMM-HER strategisch.",
        "Erfolgsrate bleibt hoch.",
        "Du verstehst Rückruf-Pädagogik.",
      ],
      exerciseIds: ["r-hier-laden", "r-restraint-recall"],
    },
    {
      title: "Fundament-Check",
      schwerpunkt: "Letzte Fundament-Woche. KOMM-HER drinnen sitzt? Festhalte-Rückruf funktioniert? Schleppleine ist Routine? Pfeife konditioniert? Diese Bausteine sind unverzichtbar.",
      wochenziele: [
        "Alle 4 Bausteine sind etabliert.",
        "{dogName} kennt das System.",
        "Du fühlst dich vorbereitet für Steigerung.",
      ],
      tagesplan: "Bilanz: was sitzt zu 90%+, was wackelt? Falls Schwäche: 1 Extra-Woche dranhängen. Phase 2 = Outdoor unter Ablenkung, Fundament muss stehen.",
      no_gos: [
        "Aus Ungeduld in Phase 2 springen.",
        "Mehrere Schwächen gleichzeitig nachreparieren.",
        "Aufgeben weil Fundament länger dauert.",
      ],
      fortschritt: [
        "Du fühlst dich kompetent.",
        "Werkzeuge sitzen.",
        "Phase 2 ist greifbar.",
      ],
      exerciseIds: ["r-hier-laden", "r-pfeife-aufbauen"],
    },
  ],
  steigerung: [
    {
      title: "KOMM-HER unter moderater Ablenkung",
      schwerpunkt: "Outdoor mit Schleppleine, moderate Ablenkungen: andere Hunde in 30m, Jogger, Wildgeruch. {dogName} lernt: KOMM-HER lohnt sich mehr als jede Ablenkung — wenn die Belohnung passt.",
      wochenziele: [
        "Erfolgsrate unter moderater Ablenkung: 80%+.",
        "Belohnung ist konsistent SUPER (Hähnchen, Käse).",
        "{dogName} sucht aktiv den Rückruf-Moment.",
      ],
      tagesplan: "An Orten mit moderater Ablenkung (Park-Rand, Joggingstrecke). Schleppleine 10m. KOMM-HER 4-6 mal pro Spaziergang. Bei Erfolg: SUPER-Jackpot von 5-7 Leckerlis. Bei Nicht-Kommen: Schleppleine ruhig aufnehmen, 2 Leckerlis bei Ankunft trotzdem.",
      no_gos: [
        "Belohnung skimpen — Spitzenleistung kostet.",
        "Erwartungen zu hoch — 80% ist ein guter Wert in Phase 2.",
        "Mehrfach rufen wenn nicht kommt — 1 mal ist 1 mal.",
      ],
      fortschritt: [
        "Erfolgsrate stabilisiert sich.",
        "{dogName} reagiert vorhersehbar.",
        "Du fühlst dich gewappnet.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-schleppleine"],
    },
    {
      title: "Pfeife in echten Situationen",
      schwerpunkt: "Pfeife wird outdoor in echten Rückruf-Situationen eingesetzt. Sie bleibt das Backup-Signal, aber jetzt mit echten Reizen. Konditionierung muss stabil bleiben.",
      wochenziele: [
        "{dogName} reagiert auf Pfeifen-Signal outdoor zuverlässig.",
        "Erfolgsrate bei Pfeife: 90%+ (höher als Stimme).",
        "Pfeife wird zum Garantie-Signal.",
      ],
      tagesplan: "Pro Spaziergang 2-3 Pfeifen-Recalls. Bei Erfolg: MEGA-Jackpot. Bei Nicht-Erfolg: Schleppleine aufnehmen, kein Drama. Nutze Pfeife strategisch: bei großer Distanz oder Reizüberflutung.",
      no_gos: [
        "Pfeife inflationär nutzen — verliert die Magie.",
        "Pfeife in Distanz-frei-Situationen — wenn ohne Pfeife klappt, lass sie weg.",
        "Pfeife bei Stimm-frustration nutzen — eskaliert.",
      ],
      fortschritt: [
        "Pfeife ist zuverlässiges Backup.",
        "Du nutzt sie strategisch.",
        "{dogName} reagiert vorhersehbar.",
      ],
      exerciseIds: ["r-pfeife-aufbauen", "r-hier-laden"],
    },
    {
      title: "Schleppleinen-Routine festigen",
      schwerpunkt: "Schleppleinen-Arbeit wird zur Routine. {dogName} bewegt sich frei in 10m Radius. Du erkennst Reizüberflutungs-Punkte sicher.",
      wochenziele: [
        "Tägliche Schleppleinen-Spaziergänge laufen reibungslos.",
        "{dogName} reagiert auf KOMM-HER mit Schleppleine zu 90%.",
        "Du erkennst Reizüberflutungs-Anzeichen.",
      ],
      tagesplan: "Pro Spaziergang Schleppleine. Verschiedene Strecken. Bei Reizüberflutung (mehrere Hunde, Wildgeruch): Distanz halten, Schleppleine sanft aufnehmen, Spaziergang verkürzen.",
      no_gos: [
        "Schleppleinen-Spaziergänge an Hochrisiko-Orten.",
        "Schleppleine stramm halten — Bewegungsfreiheit ist der Sinn.",
        "Schleppleine vergessen — Sicherheits-Backup fehlt.",
      ],
      fortschritt: [
        "Schleppleinen-Routine ist Standard.",
        "Reizüberflutung wird sicher erkannt.",
        "Spaziergänge sind kontrolliert.",
      ],
      exerciseIds: ["r-schleppleine", "r-hier-mit-ablenkung"],
    },
    {
      title: "Notfall-Rückruf konditionieren",
      schwerpunkt: "Diese Woche etablierst du den Notfall-Rückruf: ein einziges Wort oder Pfiff, das du NUR in echten Notfällen einsetzt. Belohnung: extrem (Rinderfilet, Hähnchen-Brust-Stücke).",
      wochenziele: [
        "{dogName} reagiert auf Notfall-Signal zuverlässig.",
        "Belohnung ist MEGA: echtes Rinderfilet oder Hähnchen-Filet.",
        "Du hast ein Notfall-Backup für echte Krisen.",
      ],
      tagesplan: "Wähle ein Wort/Pfeif-Ton das du sonst NIEMALS nutzt (z.B. STOP-HER). Konditioniere drinnen 2 mal täglich mit MEGA-Belohnung. Übertrag in Phase 3 in echte Notfall-Situationen.",
      no_gos: [
        "Notfall-Rückruf für normale Recalls nutzen — verliert die Magie.",
        "Belohnung skimpen — bei MEGA-Belohnung MEGA-Reaktion.",
        "Mehrfach im Notfall rufen — die erste Reaktion zählt.",
      ],
      fortschritt: [
        "Notfall-Signal ist konditioniert.",
        "Du hast Vertrauen in das Backup.",
        "Im Ernstfall hast du eine Lösung.",
      ],
      exerciseIds: ["r-emergency-recall", "r-pfeife-aufbauen"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Rückruf mit stärkerer Ablenkung",
      schwerpunkt: "Stärkere Ablenkungen: andere Hunde näher, intensive Gerüche, fließendes Wasser. Erfolgsrate sollte bei 70%+ bleiben. Wenn niedriger: zurück, Ablenkung reduzieren.",
      wochenziele: [
        "{dogName} reagiert bei starker Ablenkung zu 70-80%.",
        "Du erkennst, wann Ablenkung zu groß ist.",
        "Belohnungs-Frequenz bleibt hoch.",
      ],
      tagesplan: "Suche bewusst Orte mit stärkerer Ablenkung. Schleppleine. KOMM-HER bei Reizen. Beobachte Erfolgsrate. Bei unter 70%: Ablenkung reduzieren, nicht Druck erhöhen.",
      no_gos: [
        "Druck erhöhen — kontraproduktiv.",
        "Belohnungs-Frequenz reduzieren bei sinkender Erfolgsrate.",
        "Mit Frust arbeiten — überträgt sich.",
      ],
      fortschritt: [
        "Erfolgsrate stabilisiert sich.",
        "{dogName} fokussiert auch in Ablenkung.",
        "Du arbeitest geduldig.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-schleppleine"],
    },
    {
      title: "Festhalte-Rückruf draußen mit Helfer",
      schwerpunkt: "Klassisches Festhalte-Rückruf jetzt draußen mit Helfer. Maßive Motivation, Sprint zu dir. Funktioniert auch wenn andere Methoden hapern.",
      wochenziele: [
        "{dogName} sprintet draußen bei Festhalte-Rückruf.",
        "Helfer-Setting ist eingespielt.",
        "Motivation ist outdoor genauso hoch wie indoor.",
      ],
      tagesplan: "2-3 mal pro Woche Restraint-Sessions draußen. Helfer hält, du läufst 20-30m weg, KOMM-HER. Sprint + JACKPOT. Variation: Helfer wechselt, du wechselst, gleichter Spaß.",
      no_gos: [
        "Ohne Helfer üben — fehlt die Spannung.",
        "Distanz zu schnell extreme — überfordert.",
        "An Hochrisiko-Orten — Sicherheits-Risiko.",
      ],
      fortschritt: [
        "{dogName} sprintet zuverlässig outdoor.",
        "Motivation ist hoch.",
        "Du hast ein Spaß-Werkzeug.",
      ],
      exerciseIds: ["r-restraint-recall", "r-hier-laden"],
    },
    {
      title: "Rückruf-Varianten erweitern",
      schwerpunkt: "Bisher hattest du 1-2 Rückruf-Wörter. Diese Woche etablierst du Varianten: NORMAL-Rückruf (alltäglich, leichte Belohnung), JACKPOT-Rückruf (mittelhart, große Belohnung), NOTFALL (extrem, MEGA-Belohnung).",
      wochenziele: [
        "Du hast 3 unterschiedliche Rückruf-Stufen klar.",
        "{dogName} versteht die unterschiedlichen Signale.",
        "Du nutzt sie situativ.",
      ],
      tagesplan: "Trockenübungen pro Stufe: ALLTAG-Rückruf mit normaler Belohnung, JACKPOT-Rückruf mit großer Belohnung, NOTFALL mit MEGA-Belohnung. Pro Spaziergang ein paar von jeder Stufe.",
      no_gos: [
        "Stufen vermischen — verwässert die Verknüpfungen.",
        "Notfall-Rückruf regelmäßig nutzen — verliert die Magie.",
        "Belohnungs-Niveau verwechseln.",
      ],
      fortschritt: [
        "Stufen sind klar etabliert.",
        "{dogName} reagiert situativ unterschiedlich.",
        "Du hast ein abgestuftes Rückruf-System.",
      ],
      exerciseIds: ["r-hier-laden", "r-emergency-recall"],
    },
    {
      title: "Festigung Steigerung",
      schwerpunkt: "Letzte Steigerungs-Woche. Alle Rückruf-Werkzeuge sitzen, Schleppleine ist Routine, Notfall-Signal konditioniert. Phase 3 = erster Freilauf, kontrolliert.",
      wochenziele: [
        "Alle Werkzeuge sitzen zu 80%+.",
        "Du bist auf ersten Freilauf vorbereitet.",
        "Sicherheits-Backups sind etabliert.",
      ],
      tagesplan: "Bilanz-Woche: was klappt zu 80%+? Schleppleine? Pfeife? Restraint? Notfall? Falls Schwäche: 1 Extra-Woche dranhängen. Phase 3 = riskanter, Fundament muss stehen.",
      no_gos: [
        "Aus Ungeduld in Freilauf springen.",
        "Mehrere Schwächen ignorieren.",
        "Sicherheits-Backups als 'überflüssig' sehen.",
      ],
      fortschritt: [
        "Du fühlst dich gut vorbereitet.",
        "{dogName} kennt das System.",
        "Werkzeuge sitzen.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-pfeife-aufbauen"],
    },
  ],
  generalisierung: [
    {
      title: "Erster kontrollierter Freilauf",
      schwerpunkt: "Phase 3 beginnt mit dem ersten echten Freilauf — aber kontrolliert. Sichere Zone (eingezäunt oder topographisch sicher), Schleppleine fällt aber bleibt am Geschirr.",
      wochenziele: [
        "Erster Freilauf erfolgreich (10-15 Min).",
        "{dogName} reagiert auf KOMM-HER in Freilauf.",
        "Du hast ein Sicherheits-Setting etabliert.",
      ],
      tagesplan: "Wähle die sicherste Zone (eingezäunte Hundewiese, Wald-Lichtung weit weg von Straße). Schleppleine bleibt am Geschirr, aber {dogName} darf sie 5-10m ziehen. KOMM-HER alle 5 Min. Bei zuverlässigem Rückruf: weiter machen.",
      no_gos: [
        "Freilauf an Hochrisiko-Orten — Eskalations-Gefahr.",
        "Schleppleine komplett abnehmen — Sicherheits-Verlust.",
        "Freilauf länger als 15-20 Min — Reizüberflutung droht.",
      ],
      fortschritt: [
        "Erster Freilauf ist erfolgreich.",
        "{dogName} bleibt in Reichweite.",
        "Du fühlst dich (vorsichtig) zuversichtlicher.",
        "Das Notfall-Signal ist konditioniert und steht für echte Krisen bereit.",
      ],
      exerciseIds: ["r-freilauf-erste", "r-emergency-recall"],
    },
    {
      title: "Freilauf-Routine etablieren",
      schwerpunkt: "Freilauf wird zur Routine — an 2-3 sicheren Strecken. Schleppleine wird zur Versicherung, bleibt aber dabei. {dogName} lernt Freilauf-Sicherheit.",
      wochenziele: [
        "2-3 sichere Freilauf-Strecken sind etabliert.",
        "Freilauf-Spaziergänge laufen routiniert.",
        "{dogName} kommt auf KOMM-HER zu 85%+.",
      ],
      tagesplan: "Pro Woche 3-4 Freilauf-Spaziergänge an sicheren Strecken. Schleppleine bleibt am Geschirr. KOMM-HER regelmäßig. Bei Nicht-Kommen: Schleppleine aufnehmen, später wieder lockern.",
      no_gos: [
        "Freilauf an unbekannten Strecken — zu riskant.",
        "Schleppleine vergessen — Sicherheits-Backup.",
        "Freilauf wenn {dogName} angespannt oder ablenkt.",
      ],
      fortschritt: [
        "Freilauf-Routine ist eingespielt.",
        "{dogName} reagiert zuverlässig.",
        "Spaziergänge sind erfüllend.",
      ],
      exerciseIds: ["r-freilauf-erste", "r-hier-laden"],
    },
    {
      title: "Wartungs-Training in Freilauf",
      schwerpunkt: "Auch wenn Freilauf läuft: KOMM-HER bleibt aktiv geübt. Sonst rostet das Signal. 2-3 mal pro Spaziergang KOMM-HER mit Jackpot. {dogName} bleibt motiviert.",
      wochenziele: [
        "KOMM-HER wird in Freilauf aktiv gewartet.",
        "Belohnungs-Dichte bleibt akzeptabel.",
        "{dogName} verliert keine Rückruf-Motivation.",
      ],
      tagesplan: "Pro Spaziergang 3-4 KOMM-HER-Momente, jeder mit Jackpot. Variation: Festhalte-Rückruf mit Helfer einmal pro Woche. Pfeife alle 2 Wochen mit MEGA-Belohnung.",
      no_gos: [
        "KOMM-HER schleifen lassen — Signal verblasst.",
        "Belohnung skimpen — Motivation sinkt.",
        "Pfeife inflationär nutzen.",
      ],
      fortschritt: [
        "KOMM-HER bleibt zuverlässig.",
        "{dogName} bleibt motiviert.",
        "Du wartest das System aktiv.",
      ],
      exerciseIds: ["r-hier-laden", "r-restraint-recall"],
    },
    {
      title: "Belohnungs-Reduktion vorsichtig",
      schwerpunkt: "Nachdem Rückruf sicher sitzt, reduzierst du langsam die Belohnungs-Dichte bei normalen Rückrufs. Aber: bei wertvollen Situationen (echte Notfälle) immer noch JACKPOT.",
      wochenziele: [
        "Belohnungs-Frequenz wird auf ~50-60% reduziert.",
        "Spitzenleistungen werden weiterhin mit Jackpot belohnt.",
        "{dogName} reagiert auch mit weniger Belohnung.",
      ],
      tagesplan: "Bei einfachen Rückruf-Situationen: nicht jedes Mal Hähnchen. Bei schwierigen (starke Ablenkung, lange Distanz): Jackpot. {dogName} merkt den Unterschied, sucht aber den Rückruf-Moment.",
      no_gos: [
        "Belohnung komplett streichhen — Rückfall droht.",
        "Reduktion an schwierigen Strecken — zu früh.",
        "Belohnungs-Niveau-Verwirrung.",
      ],
      fortschritt: [
        "{dogName} reagiert auch mit weniger Belohnung.",
        "Rückruf ist stabilisiert.",
        "Du steckst seltener in die Hosentasche.",
      ],
      exerciseIds: ["r-hier-laden", "r-restraint-recall"],
    },
    {
      title: "Schwierige Situationen meistern",
      schwerpunkt: "Diese Woche bewusst schwierige Situationen einplanen: andere Hunde nah, intensive Gerüche, wechselnde Strecken. {dogName} bewährt sich oder du justierst nach.",
      wochenziele: [
        "{dogName} bewältigt 3 schwierige Situationen.",
        "Du erkennst, wo Schleppleine wieder nötig ist.",
        "Erfolgsrate bleibt bei 70%+.",
      ],
      tagesplan: "Plane bewusst Begegnungen mit anderen Hunden, Wildgeruch, wechselnde Strecken. KOMM-HER bei Reizen. Bei Erfolg: SUPER-Jackpot. Bei Nicht-Erfolg: Schleppleine zurück, später wieder versuchen.",
      no_gos: [
        "Mehrere schwierige Situationen am selben Tag — kumuliert.",
        "Bei sinkender Erfolgsrate weiterziehen — pause.",
        "Erwartungen zu hoch — 70% ist gut in Phase 3.",
      ],
      fortschritt: [
        "{dogName} bewältigt schwierige Situationen.",
        "Du erkennst Grenzen sicher.",
        "Rückruf ist robust.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-pfeife-aufbauen"],
    },
    {
      title: "Notfall-Rückruf in Praxis",
      schwerpunkt: "Diese Woche testest du den Notfall-Rückruf in 1-2 echten Risiko-Situationen (z.B. {dogName} läuft in falsche Richtung). MEGA-Belohnung muss kommen.",
      wochenziele: [
        "Notfall-Rückruf wird in 1-2 echten Situationen erfolgreich eingesetzt.",
        "MEGA-Belohnung wird konsistent gegeben.",
        "Du fühlst dich auf echte Notfälle vorbereitet.",
      ],
      tagesplan: "In kontrollierten 'Quasi-Notfällen' (z.B. {dogName} schnüffelt etwas Interessantes, du rufst Notfall-Signal): SOFORT MEGA-Belohnung beim Auftauchen. Niemals 'wegen Test' oder ohne Belohnung — vergiftet sonst die Magie.",
      no_gos: [
        "Notfall-Rückruf ohne MEGA-Belohnung testen — vergiftet die Verknüpfung.",
        "Notfall-Signal regelmäßig nutzen — Verliert die Macht.",
        "Im echten Notfall in Panik geraten — Routine durchziehen.",
      ],
      fortschritt: [
        "Notfall-Rückruf ist getestet und funktioniert.",
        "Du hast Vertrauen in das Backup.",
        "Echte Notfälle sind beherrschbar.",
      ],
      exerciseIds: ["r-emergency-recall", "r-pfeife-aufbauen"],
    },
    {
      title: "Rückruf-Spaziergänge ohne Schleppleine",
      schwerpunkt: "Wenn Rückruf sicher sitzt (90%+ Erfolg an bekannten Strecken), kannst du Schleppleine in spezifischen Settings weglassen. Aber: NUR an sicheren Strecken, NUR bei guter Konzentration.",
      wochenziele: [
        "Du hast Strecken identifiziert, wo Schleppleine-frei sicher ist.",
        "{dogName} reagiert dort zu 95%+.",
        "Sicherheit bleibt oberstes Prinzip.",
      ],
      tagesplan: "Bewerte ehrlich pro Strecke: Rückruf sicher zu 95%? Hochrisiko-Reize unwahrscheinlich? Wenn ja: Schleppleine-frei testen. Bei jeder Sicht-frei-Situation: KOMM-HER + Jackpot. Bei Zweifel: Schleppleine zurück.",
      no_gos: [
        "Schleppleine-frei an unbekannten Strecken.",
        "Schleppleine-frei wenn andere Hunde nah.",
        "Schleppleine-frei wenn {dogName} hyperaktiv.",
      ],
      fortschritt: [
        "Du nutzt Schleppleine strategisch.",
        "{dogName} reagiert zuverlässig.",
        "Spaziergänge sind freier und erfüllender.",
      ],
      exerciseIds: ["r-freilauf-erste", "r-hier-laden"],
    },
    {
      title: "Übergang in Wartungsmodus",
      schwerpunkt: "Letzte Woche. Rückruf ist zuverlässig, Schleppleine wird gezielt eingesetzt, Notfall-Backup steht. {dogName} ist ein deutlich zuverlässigerer Hund als zu Plan-Beginn.",
      wochenziele: [
        "Alle Rückruf-Werkzeuge laufen routiniert.",
        "Wartungs-Plan steht.",
        "Du fühlst dich langfristig vorbereitet.",
      ],
      tagesplan: "Plane den Wartungs-Modus: alle 2 Wochen einen Festhalte-Rückruf mit MEGA-Belohnung. Alle 4 Wochen einen Notfall-Rückruf-Test (in kontrolliertem Setting). Pfeife alle 2 Wochen mit MEGA-Belohnung. Routine bleibt.",
      no_gos: [
        "Alle Routinen schlagartig weglassen — Rückruf verblasst.",
        "Pfeife oder Notfall-Rückruf vergessen — Werkzeuge brauchen Wartung.",
        "Schleppleine vergessen — Sicherheits-Backup für Notfall.",
      ],
      fortschritt: [
        "Rückruf ist langfristig zuverlässig.",
        "Du fühlst dich kompetent.",
        "{dogName} ist sicherer im Freilauf.",
      ],
      exerciseIds: ["r-hier-laden", "r-emergency-recall"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// BARKING (übermaessiges Bellen) — Auslöser entkoppeln + Ruhe belohnen
// ────────────────────────────────────────────────────────────────────
const BARKING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Auslöser-Tagebuch: was löst das Bellen aus?",
      schwerpunkt: "Bevor du trainierst, brauchst du Daten. Eine Woche lang dokumentierst du WANN, WO und WORAUF {dogName} bellt. Erst dann erkennst du Muster und kannst gezielt arbeiten.",
      wochenziele: [
        "Du hast eine Liste der Top-3 Bell-Auslöser.",
        "Du kennst typische Bell-Zeiten im Tagesablauf.",
        "Du verstehst deine eigene Reaktion und ob sie verstärkt.",
      ],
      tagesplan: "Notizheft dabei. Bei jedem Bell-Vorfall: Uhrzeit, Ort, Auslöser, Dauer + deine Reaktion. Am Ende der Woche siehst du Muster: Klingel? Hund vorbei? Frust? Aufmerksamkeit? Pro Auslöser eigene Strategie ab Woche 2.",
      no_gos: [
        "Schon trainieren ohne zu wissen WAS du angehst.",
        "Schimpfen waehrend du dokumentierst — versaut die Daten.",
        "Auslöser relativieren ('das ist halt seine Art') — ohne Analyse keine Loesung.",
      ],
      fortschritt: [
        "Du hast eine klare Liste der Auslöser.",
        "Du erkennst deine eigene Rolle im Verhalten.",
        "Du bist bereit für gezieltes Training.",
        "Erste Stille-Phasen werden 8-10x pro Tag belohnt, das Schweigen wird verstärkt.",
      ],
      exerciseIds: ["b-trigger-tagebuch", "b-ruhe-marker"],
    },
    {
      title: "RUHE-Marker etablieren",
      schwerpunkt: "Statt das Bellen zu bestrafen, belohnst du das Schweigen. Jede Stille-Phase kriegt einen leisen FEIN-Marker und ein Leckerli. {dogName} lernt: Schweigen lohnt sich.",
      wochenziele: [
        "8-10 Stille-Belohnungen pro Tag.",
        "{dogName} merkt: ruhig sein bringt was.",
        "Du selbst reagierst nicht mehr auf Bellen mit Lautstaerke.",
      ],
      tagesplan: "Beobachte aktiv. Sobald 5 Sek Stille: leise FEIN + Leckerli. Erst 5 Sek, dann 10, 20, 30, 1 Min. Belohnung kommt LEISE und RUHIG. Bei Bellen selbst: nicht anschreien, nicht hinschauen, neutral bleiben.",
      no_gos: [
        "Lautes 'Aus!' oder 'Ruhig!' rufen — Aufmerksamkeit für das Bellen.",
        "Hingehen wenn {dogName} bellt — verstärkt es.",
        "Belohnung mit Aufregung geben — wir wollen Ruhe verknüpfen.",
      ],
      fortschritt: [
        "Stille-Belohnungen werden Routine.",
        "{dogName} sucht aktiv Stille-Phasen.",
        "Bell-Frequenz reduziert sich erkennbar.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-tuerklingel-decke"],
    },
    {
      title: "Türklingel = Decke-Routine",
      schwerpunkt: "Falls Klingelbellen Thema ist, etablieren wir eine konkrete Alternative: bei Klingel rennt {dogName} nicht zur Tür, sondern auf die Decke. Pavlow-Klassiker.",
      wochenziele: [
        "{dogName} reagiert auf Klingel-Aufnahme mit Bewegung zur Decke.",
        "Lautstaerke der Klingel kann gesteigert werden ohne Eskalation.",
        "Die Klingel-Decke-Verknüpfung sitzt.",
      ],
      tagesplan: "Klingel-Aufnahme leise vom Handy, sofort PLATZ + Decke + Leckerli. 10 Wiederholungen pro Session, 2 Sessions taeglich. Steigere Lautstaerke über die Woche. Echte Klingel-Tests in Phase 2 mit Helfer.",
      no_gos: [
        "Echte Klingel-Tests ohne Vorarbeit — zu schwer.",
        "Decke ohne vorherige Entspannungsdecke-Übung — Decke muss positiv besetzt sein.",
        "Bei Bellen: anschreien — kontraproduktiv.",
      ],
      fortschritt: [
        "{dogName} verbindet Klingel mit Decke + Belohnung.",
        "Bewegung zur Decke wird automatisch.",
        "Du bist bereit für echte Klingel-Situation.",
      ],
      exerciseIds: ["b-tuerklingel-decke", "b-ruhe-marker"],
    },
    {
      title: "Frust-Toleranz aufbauen",
      schwerpunkt: "Falls {dogName} aus Frust bellt (Eichhoernchen, was nicht erreichbar ist): wir bauen Frust-Toleranz auf. WARTE-Signal bei Futter und Spielzeug ist das Werkzeug.",
      wochenziele: [
        "{dogName} haelt 10 Sek WARTE vor Futter.",
        "Frust-Anzeichen werden seltener.",
        "Du nutzt WARTE in alltaeglichen Frust-Mini-Situationen.",
      ],
      tagesplan: "3-4 WARTE-Situationen pro Tag: vor Futter, Spielzeug, Tür. Steigere von 1 Sek zu 10 Sek über die Woche. Bei Bellen waehrend WARTE: Hand zurueckziehen, nicht auflöesen. Erst bei 3 Sek Stille: Auflöesung.",
      no_gos: [
        "Bei Bellen auflöesen — verstärkt Frust-Bellen.",
        "Wartezeiten zu schnell verlängern — Frust eskaliert.",
        "Laut werden — verstärkt die Aufregung.",
      ],
      fortschritt: [
        "{dogName} bleibt bei kurzen Wartezeiten ruhig.",
        "Frust-Bellen reduziert sich.",
        "Du hast ein Werkzeug für Mini-Frust-Situationen.",
      ],
      exerciseIds: ["b-frust-management", "b-ruhe-marker"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Gegenkonditionierung bei Außenreizen",
      schwerpunkt: "Falls Außenreize (Hund vorbei, Postbote) Bell-Auslöser sind: Gegenkonditionierung. Reiz auftauchen = Leckerli kommt. Verkehrt die emotionale Verknüpfung.",
      wochenziele: [
        "{dogName} schaut bei Außenreizen zu dir.",
        "Bell-Reaktion auf Reize reduziert sich.",
        "Die emotionale Verknüpfung aendert sich.",
      ],
      tagesplan: "An typischer Bell-Position (Fenster, Garten). Sobald Reiz auftaucht VOR dem Bellen: SCHAU + Leckerli durchgehend solange Reiz sichtbar. Reiz weg: Leckerli weg. Falls {dogName} schon bellt: zu spät, Distanz erhoehen.",
      no_gos: [
        "Erst belohnen wenn {dogName} schon bellt — falsche Verknüpfung.",
        "Reize provozieren — kontraproduktiv.",
        "Belohnung skimpen — Spitzenleistung kostet.",
      ],
      fortschritt: [
        "{dogName} reagiert mit Aufmerksamkeit zu dir bei Reizen.",
        "Bellen reduziert sich erkennbar.",
        "Emotionale Verknüpfung wird positiv.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-ruhe-marker"],
    },
    {
      title: "Aufmerksamkeits-Bellen aushungern",
      schwerpunkt: "Falls {dogName} dich anbellt um was zu kriegen: konsequent ignorieren. Aushungerung über 2-3 Wochen. Erfordert eiserne Konsequenz von allen Familienmitgliedern.",
      wochenziele: [
        "Bei Aufmerksamkeits-Bellen drehst du konsequent den Ruecken zu.",
        "Familienmitglieder ziehen mit.",
        "Aufmerksamkeits-Bellen reduziert sich nach Verstärkungs-Spitze.",
      ],
      tagesplan: "Bei Aufmerksamkeits-Bellen sofort Ruecken zudrehen, Raum verlassen wenn möglich. Komm zurueck wenn 30 Sek ruhig. Erwarte Verstärkungs-Spitze in Tag 3-7: Bellen wird erstmal intensiver, dann verschwindet es. Halte aus.",
      no_gos: [
        "Nachgeben waehrend Verstärkungs-Spitze — sabotiert die Arbeit komplett.",
        "Familienmitglieder die nicht mitziehen — 1 Inkonsistenz = 1 Woche zurueck.",
        "Bei Bellen schimpfen — auch Aufmerksamkeit.",
      ],
      fortschritt: [
        "Aufmerksamkeits-Bellen reduziert sich messbar.",
        "{dogName} sucht andere Wege für Aufmerksamkeit (still kommen).",
        "Du wirst innerlich entspannter.",
      ],
      exerciseIds: ["b-aufmerksamkeits-bellen", "b-ruhe-marker"],
    },
    {
      title: "Auslöser-Distanz schrittweise reduzieren",
      schwerpunkt: "Bei Reiz-bedingtem Bellen reduzierst du langsam die Distanz zum Auslöser. 50m → 40m → 30m. {dogName} bleibt unter Schwellenwert, lernt Reize zu tolerieren.",
      wochenziele: [
        "Distanz zum Auslöser reduziert sich um 5-10m.",
        "{dogName} bleibt unter Schwellenwert.",
        "Du arbeitest geduldig und systematisch.",
      ],
      tagesplan: "Bewusste Sessions an Auslöser-Quellen mit kontrollierbarer Distanz. Gegenkonditionierung bei jedem Reiz. Distanz nur dann reduzieren wenn {dogName} über mehrere Tage stabil ist. Niemals an einem Tag radikal reduzieren.",
      no_gos: [
        "Distanz zu schnell reduzieren — Eskalation.",
        "An schlechten Tagen Druck erhoehen.",
        "Schwellenwert ignorieren wenn er sich aendert.",
      ],
      fortschritt: [
        "Schwellenwert reduziert sich messbar.",
        "{dogName} toleriert Reize besser.",
        "Du arbeitest systematisch.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-ruhe-marker"],
    },
    {
      title: "Fundament-Check",
      schwerpunkt: "Letzte Fundament-Woche. Auslöser-Tagebuch ausgewertet, RUHE-Marker etabliert, Klingel-Decke sitzt, Frust-Toleranz aufgebaut. Phase 2 = echte Anwendung.",
      wochenziele: [
        "Alle Bausteine sitzen.",
        "Bell-Frequenz ist messbar reduziert.",
        "Du bist auf Phase 2 vorbereitet.",
      ],
      tagesplan: "Bilanz: was sitzt, was wackelt? Falls Schwaeche: 1 Extra-Woche dranhaengen. Bei Aufmerksamkeits-Bellen besonders konsequent bleiben.",
      no_gos: [
        "Aus Ungeduld in Phase 2 springen.",
        "Mehrere Schwaechen ignorieren.",
        "Plan aufgeben weil 1 Woche schiefging.",
      ],
      fortschritt: [
        "Du fühlst dich kompetent.",
        "Werkzeuge sitzen.",
        "Phase 2 ist greifbar.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-tuerklingel-decke"],
    },
  ],
  steigerung: [
    {
      title: "Echte Klingel-Tests mit Helfer",
      schwerpunkt: "Nun wagen wir echte Klingel-Tests. Helfer klingelt von draußen, {dogName} muss zur Decke laufen. Konsequenz über 2-3 Wochen, bis es Standard ist.",
      wochenziele: [
        "{dogName} läuft bei echter Klingel zur Decke.",
        "Verhalten ist auch mit echtem Gast stabil.",
        "Tür kann geoeffnet werden, Hund bleibt liegen.",
      ],
      tagesplan: "Vorher: Helfer kommt zu Besuch, Decke vorbereitet. Klingel: {dogName} zur Decke fuehren (oder von selbst). Tür oeffnen, Gast hereinbitten, {dogName} ignorieren. Bleibt auf Decke: alle 30 Sek Leckerli. Nach 5 Min: OK-Signal.",
      no_gos: [
        "Echte Klingel-Tests ohne saubere Vorarbeit drinnen — Frust.",
        "Gast streichhelt waehrend Bellen — sabotiert.",
        "Bei Bellen reflexartig zur Tür rennen — verstärkt.",
      ],
      fortschritt: [
        "{dogName} bewältigt echte Klingel ruhiger.",
        "Gäste-Empfang wird routiniert.",
        "Du fühlst dich vorbereitet.",
        "Bei Außenreizen schaut {dogName} häufiger zu dir statt sofort zu bellen.",
      ],
      exerciseIds: ["b-laeuten-routine", "b-counter-cond-aussen"],
    },
    {
      title: "Außenreize aktiv arbeiten",
      schwerpunkt: "Bei Hund-vorbei, Postbote, Aussengeräusche: Gegenkonditionierung aktiv anwenden. Belohnungs-Dichte hoch, Verknüpfung ändern.",
      wochenziele: [
        "Bell-Reaktion auf Außenreize reduziert sich um 50%+.",
        "{dogName} schaut von selbst zu dir bei Reizen.",
        "Belohnungs-Dichte ist hoch.",
      ],
      tagesplan: "An Fenster oder im Garten aktiv arbeiten. Wenn du Reiz frueher siehst als {dogName}: SCHAU + Leckerli durchgehend. Falls {dogName} schon bellt: Distanz schaffen (anderer Raum), nicht durchziehen.",
      no_gos: [
        "Bei Stress weitermachen.",
        "Belohnungs-Dichte reduzieren.",
        "Zu nah am Reiz arbeiten.",
      ],
      fortschritt: [
        "Reaktion auf Reize reduziert sich messbar.",
        "{dogName} sucht aktiv Augenkontakt.",
        "Du fühlst dich handlungsfähiger.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-ruhe-marker"],
    },
    {
      title: "Aufmerksamkeits-Bellen aushungern",
      schwerpunkt: "Konsequente Aushungerung über 2-3 Wochen. Ruecken zudrehen, ignorieren, nicht nachgeben. Wer hier inkonsistent ist, sabotiert die ganze Arbeit.",
      wochenziele: [
        "Aufmerksamkeits-Bellen reduziert sich um 70%+.",
        "Familienkonsistenz steht.",
        "Du wirst innerlich ruhiger und konsequenter.",
      ],
      tagesplan: "Jeden Bell-Versuch nach Aufmerksamkeit konsequent ignorieren. Ruecken zudrehen, Raum verlassen. Komm zurueck nach 30 Sek Stille. Bei Familienmitgliedern: gemeinsame Regel-Konsistenz besprechen.",
      no_gos: [
        "Inkonsistenz — sabotiert die Arbeit.",
        "Bei Verstärkungs-Spitze nachgeben — perfektioniert das Bellen.",
        "Schimpfen — Aufmerksamkeit ist auch Belohnung.",
      ],
      fortschritt: [
        "Aufmerksamkeits-Bellen reduziert sich messbar.",
        "Du wirst konsequenter.",
        "Familienkonsistenz steht.",
      ],
      exerciseIds: ["b-aufmerksamkeits-bellen", "b-ruhe-marker"],
    },
    {
      title: "Frust-Bellen reduzieren",
      schwerpunkt: "WARTE-Signal wird in mehr Situationen eingesetzt. Frust-Toleranz waechst, Frust-Bellen reduziert sich. Geduldige Arbeit.",
      wochenziele: [
        "{dogName} haelt 30 Sek WARTE in verschiedenen Situationen.",
        "Frust-Bellen reduziert sich erkennbar.",
        "Du nutzt WARTE intuitiv.",
      ],
      tagesplan: "5-7 WARTE-Situationen pro Tag. Steigere von 10 auf 30 Sek. Bei Bellen waehrend WARTE: nicht auflöesen. Erst bei 3 Sek Stille: Auflöesung + Belohnung.",
      no_gos: [
        "Bei Bellen auflöesen.",
        "Wartezeiten radikal steigern.",
        "Laut werden bei Frust-Bellen.",
      ],
      fortschritt: [
        "Frust-Toleranz waechst.",
        "Frust-Bellen reduziert sich.",
        "{dogName} bleibt länger ruhig in Wartesituationen.",
      ],
      exerciseIds: ["b-frust-management", "b-ruhe-marker"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Variabilität bei Auslösern",
      schwerpunkt: "Bisher hast du an einzelnen Auslösern gearbeitet. Diese Woche kombinierst du: Klingel + Außenreize + Aufmerksamkeit. Strategie bleibt konsistent, Auslöser wechseln.",
      wochenziele: [
        "Du wendest die richtige Strategie pro Auslöser an.",
        "Auslöser übergreifend reduziert sich Bellen.",
        "Du fühlst dich vorbereitet auf verschiedene Situationen.",
      ],
      tagesplan: "Pro Spaziergang/Tag verschiedene Auslöser bewusst angehen. Klingel: Decke. Hund vorbei: Gegenkonditionierung. Frust: WARTE. Aufmerksamkeit: Ignorieren. Konsistenz übergreifend.",
      no_gos: [
        "Strategie wechseln je nach Auslöser — Konsistenz wichtig.",
        "Mehrere Auslöser gleichzeitig stapeln — überfordert.",
        "Bei Stress weiterziehen.",
      ],
      fortschritt: [
        "Strategien sind generalisiert.",
        "Du reagierst situativ richtig.",
        "Bell-Frequenz übergreifend reduziert.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-ruhe-marker"],
    },
    {
      title: "Stress-Bellen vs. Bedarfs-Bellen",
      schwerpunkt: "Lerne zu unterscheiden: bellt {dogName} aus Stress (Angst, Überforderung) oder aus Bedarf (Aufmerksamkeit, Frust)? Beide brauchen unterschiedliche Strategien.",
      wochenziele: [
        "Du unterscheidest sicher zwischen Stress- und Bedarfs-Bellen.",
        "Pro Typ wendest du die richtige Strategie an.",
        "{dogName}s emotionale Lage wird besser gelesen.",
      ],
      tagesplan: "Beobachte aktiv: Bellt {dogName} mit gespannter Mimik, hohem Schwanz, gefletschten Lefzen (Stress)? Oder ist sie entspannt, schaut dich an, wedelt (Bedarf)? Stress: Distanz schaffen, beruhigen. Bedarf: ignorieren.",
      no_gos: [
        "Beide Typen gleich behandeln — falsche Reaktion.",
        "Stress-Bellen ignorieren — kann eskalieren.",
        "Bedarfs-Bellen 'beruhigen' — verstärkt es.",
      ],
      fortschritt: [
        "Du liest {dogName}s emotionale Lage sicher.",
        "Reaktionen werden situativ richtig.",
        "Bellen reduziert sich übergreifend.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-counter-cond-aussen"],
    },
    {
      title: "Belohnungs-Reduktion vorsichtig",
      schwerpunkt: "Wenn RUHE-Marker und Gegenkonditionierung sitzen, reduzierst du langsam die Belohnungs-Dichte. Aber: nicht komplett weglassen. Variable Verstaerkung haelt das Verhalten stabiler.",
      wochenziele: [
        "Belohnungs-Frequenz wird auf ~50% reduziert.",
        "{dogName} reagiert auch mit weniger Belohnung.",
        "Spitzenleistungen werden weiterhin mit Jackpot belohnt.",
      ],
      tagesplan: "Bei einfachen Situationen: nicht jede Stille belohnen. Bei schwierigen (Auslöser): weiterhin volle Belohnung. {dogName} merkt: das System bleibt, aber unvorhersehbar.",
      no_gos: [
        "Belohnung komplett streichhen — Rueckfall.",
        "Reduktion an schwierigen Strecken.",
        "Radikale Veränderung.",
      ],
      fortschritt: [
        "Verhalten wird stabiler ohne Dauer-Belohnung.",
        "Du steckst weniger Leckerlis ein.",
        "Bell-Frequenz bleibt niedrig.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-tuerklingel-decke"],
    },
    {
      title: "Festigung Steigerung",
      schwerpunkt: "Letzte Steigerungs-Woche. Alle Werkzeuge sitzen, Auslöser werden flexibel gehandhabt. Phase 3 = Langzeit-Anwendung und Stabilisierung.",
      wochenziele: [
        "Alle Werkzeuge laufen fluessig.",
        "Bell-Frequenz ist deutlich reduziert.",
        "Du bist auf Phase 3 vorbereitet.",
      ],
      tagesplan: "Bilanz-Woche: was funktioniert super, was wackelt? Notiere {dogName}s verbleibende Auslöser. Plane für Phase 3 Wartungs-Routine.",
      no_gos: [
        "Erfolge als Selbstverstaendlichkeit.",
        "Belohnungs-Dichte radikal reduzieren.",
        "Familienkonsistenz aufweichen.",
      ],
      fortschritt: [
        "Bellen ist messbar reduziert.",
        "Du fühlst dich kompetent.",
        "Werkzeuge sitzen fluessig.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-aufmerksamkeits-bellen"],
    },
  ],
  generalisierung: [
    {
      title: "Echte Alltags-Auslöser-Situationen",
      schwerpunkt: "Phase 3 = Anwendung im normalen Alltag. Klingel, Außenreize, Frust, Aufmerksamkeit — alle Auslöser im normalen Tagesablauf. Strategien sitzen flexibel.",
      wochenziele: [
        "Auslöser im Alltag werden flexibel gehandhabt.",
        "{dogName} reagiert vorhersehbar auf Strategien.",
        "Du fühlst dich kompetent im Umgang mit Bellen.",
      ],
      tagesplan: "Jede Auslöser-Situation im Alltag aktiv mit der richtigen Strategie angehen. Beobachten was funktioniert. Refresh bei Bedarf. Familienkonsistenz hochhalten.",
      no_gos: [
        "Alltags-Konsequenz aufweichen.",
        "Schwierige Situationen vermeiden — nicht trainieren.",
        "Stress an dich heranlassen — übertraegt sich.",
      ],
      fortschritt: [
        "Alltag läuft routinierter.",
        "Bellen ist Ausnahme.",
        "Du wirst innerlich ruhiger.",
      ],
      exerciseIds: ["b-laeuten-routine", "b-ruhe-marker"],
    },
    {
      title: "Schwierige Tageszeiten meistern",
      schwerpunkt: "Rush-Hour mit vielen Hunden vorbei, Wochenenden mit viel Klingeln, Stress-Zeiten. Diese Woche bewältigt {dogName} auch dichte Auslöser-Phasen.",
      wochenziele: [
        "{dogName} bewältigt schwierige Tageszeiten.",
        "Auslöser-Stack-Effekt wird vermieden.",
        "Du planst flexibel.",
      ],
      tagesplan: "Plane bewusst 1-2 schwierige Tageszeit-Sessions. Vorher Auslastung, dann gezielt Auslöser-Situation, Runterkommen danach. Belohnungs-Dichte in diesen Phasen hoeher.",
      no_gos: [
        "Mehrere schwierige Phasen pro Tag.",
        "Bei Stress weitermachen.",
        "Auslastung vor schwieriger Phase weglassen.",
      ],
      fortschritt: [
        "Schwierige Phasen werden bewältigt.",
        "Du planst strukturiert.",
        "Bellen bleibt unter Kontrolle.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-ruhe-marker"],
    },
    {
      title: "Gäste-Empfang routinieren",
      schwerpunkt: "Wenn Decke-Routine bei Klingel sitzt, etablieren wir den ganzen Gäste-Empfang als feste Sequenz. Klingel → Decke → Tür → Begruessung mit Konditionen.",
      wochenziele: [
        "Gäste-Empfang läuft als feste Sequenz.",
        "Gäste werden vorab instruiert.",
        "{dogName} bleibt waehrend des Empfangs ruhig.",
      ],
      tagesplan: "Gäste vorab informieren: 'Bitte ignoriere ihn die ersten 5 Min, er muss auf der Decke bleiben.' Klingel: Decke. Tür: Gast rein. Begruessung beider Menschen erstmal ohne Hund. Nach 5 Min: OK-Signal, {dogName} darf vorsichtig hallo sagen.",
      no_gos: [
        "Gäste nicht informieren — sie streichheln den bellenden Hund.",
        "OK-Signal zu frueh.",
        "{dogName} an die Tür lassen waehrend Gast reinkommt.",
      ],
      fortschritt: [
        "Gäste-Empfang ist Routine.",
        "{dogName} bleibt ruhig waehrend Klingel + Eingang.",
        "Du fühlst dich entspannter mit Gästen.",
      ],
      exerciseIds: ["b-laeuten-routine", "b-counter-cond-aussen"],
    },
    {
      title: "Belohnungs-Reduktion stabil halten",
      schwerpunkt: "Belohnungs-Dichte wird weiter reduziert, aber stabilisiert. {dogName} reagiert auf RUHE-Marker auch ohne staendige Leckerlis. Aber: Jackpot bei Spitzenleistung bleibt.",
      wochenziele: [
        "Belohnungs-Frequenz ist auf ~30% reduziert.",
        "{dogName} reagiert auch mit weniger Belohnung.",
        "Bei Auslöser-Situationen: weiterhin volle Belohnung.",
      ],
      tagesplan: "Alltags-Stille: nicht jede Sekunde belohnen, sondern stichprobenhaft. Auslöser-Situationen: weiterhin volle Belohnungs-Dichte. {dogName} merkt: unvorhersehbar, aber lohnenswert.",
      no_gos: [
        "Komplett weglassen.",
        "Auslöser-Belohnung reduzieren.",
        "Inkonsistente Reduktion — verwirrt.",
      ],
      fortschritt: [
        "Verhalten bleibt stabil ohne Dauer-Belohnung.",
        "Du wirst entspannter.",
        "Bellen bleibt selten.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-tuerklingel-decke"],
    },
    {
      title: "Konsistenz langfristig halten",
      schwerpunkt: "Bellen kann zurueckkommen wenn Konsistenz nachlässt. Diese Woche festigst du Familien-Konsistenz und Routinen für die nächsten Monate.",
      wochenziele: [
        "Familienmitglieder bleiben konsequent.",
        "Routinen sind etabliert.",
        "Du erkennst kleine Rueckfaelle frueh.",
      ],
      tagesplan: "Familien-Briefing: kurze Erinnerung an alle Regeln. Schreibe sie an einen Zettel. Beobachte: gibt es kleine Rueckfaelle? Gegen-Steuerung sofort. Routinen wie Klingel-Decke nicht aufweichen.",
      no_gos: [
        "Konsistenz aufweichen — Bellen kommt zurueck.",
        "Rueckfaelle ignorieren.",
        "Routinen schleifen lassen.",
      ],
      fortschritt: [
        "Familienkonsistenz steht.",
        "Routinen sind etabliert.",
        "Rueckfaelle werden frueh erkannt.",
      ],
      exerciseIds: ["b-aufmerksamkeits-bellen", "b-laeuten-routine"],
    },
    {
      title: "Stress-Reduktion im Tagesablauf",
      schwerpunkt: "Bellen ist oft Stress-Symptom. Diese Woche reduzierst du gezielt Stress-Faktoren: mehr Schlaf, mehr Nasenarbeit, weniger Reizüberflutung.",
      wochenziele: [
        "{dogName} hat mind. 16h Schlaf pro Tag.",
        "Reizüberflutung wird gezielt vermieden.",
        "Stress-Level sinkt erkennbar.",
      ],
      tagesplan: "Prüfe Tagesablauf: genug Schlaf? Vorhersehbare Routinen? Nasenarbeit-Phasen? Stress-Faktoren wie Reizüberflutung minimieren. Schlaf-Hygiene wie bei energy-Plan.",
      no_gos: [
        "Stress ignorieren.",
        "Reizüberflutung als 'normal' sehen.",
        "Hund staendig stimulieren.",
      ],
      fortschritt: [
        "Stress-Level sinkt.",
        "Bell-Frequenz reduziert sich weiter.",
        "Du wirst aufmerksamer für Stress-Anzeichen.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-tuerklingel-decke"],
    },
    {
      title: "Notfall-Strategien für Rueckfaelle",
      schwerpunkt: "Falls Bellen plötzlich zunimmt: was tun? Diese Woche etablierst du eine klare Notfall-Sequenz. Frueh erkennen, gegen-steuern, eskalierende Phasen vermeiden.",
      wochenziele: [
        "Du hast einen klaren Notfall-Plan bei Rueckfaellen.",
        "Frueh-Anzeichen werden erkannt.",
        "Rueckfaelle werden in 1 Woche aufgefangen.",
      ],
      tagesplan: "Notfall-Plan: 1) sofort 1 Woche extra-konsequent. 2) Belohnungs-Dichte wieder hoch. 3) Auslöser reduzieren (mehr Management). 4) Auslastung erhoehen. 5) Beobachten was sich geaendert hat (neue Wohnung, andere Routine, neue Auslöser).",
      no_gos: [
        "Rueckfaelle ignorieren — werden schlimmer.",
        "In Panik geraten — übertraegt sich.",
        "Routinen schlagartig ändern.",
      ],
      fortschritt: [
        "Notfall-Plan sitzt.",
        "Rueckfaelle werden frueh aufgefangen.",
        "Du fühlst dich langfristig kompetent.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-counter-cond-aussen"],
    },
    {
      title: "Übergang in Wartungsmodus",
      schwerpunkt: "Letzte Woche. Bellen ist stark reduziert, Auslöser werden gehandhabt, Familienkonsistenz steht. Wartung für die kommenden Monate steht.",
      wochenziele: [
        "Alle Routinen laufen selbststaendig.",
        "Wartungs-Rhythmus ist klar.",
        "{dogName} ist langfristig ruhiger.",
      ],
      tagesplan: "Reduziere aktives Training auf Minimum. Beobachte. Plane alle 4-6 Wochen einen Refresher-Tag mit allen Strategien. Familien-Briefing alle 3 Monate.",
      no_gos: [
        "Alle Routinen schlagartig weglassen.",
        "Familienkonsistenz aufweichen.",
        "Beobachten aufhoeren.",
      ],
      fortschritt: [
        "{dogName} ist langfristig ruhiger.",
        "Bellen ist Ausnahme, nicht Normalfall.",
        "Du fühlst dich kompetent.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-laeuten-routine"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// ANXIETY (Trennungsangst) — Graduelle Allein-Zeit + Kong + Routine
// ────────────────────────────────────────────────────────────────────
const ANXIETY_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Abschieds-Auslöser identifizieren",
      schwerpunkt: "Hunde mit Trennungsangst stressen oft schon BEVOR du gehst. Sie lesen Auslöser wie Schlüssel, Schuhe, Jacke. Diese Woche identifizierst du den vollstaendigen Auslöser-Stack.",
      wochenziele: [
        "Du kennst {dogName}s individuellen Auslöser-Stack.",
        "Du erkennst die ersten Stress-Anzeichen frueh.",
        "Du verstehst, wie der Angst-Prozess abläuft.",
      ],
      tagesplan: "3-5 Tage genau beobachten beim Verlassen. Notiere: ab welchem Moment veraendert sich das Verhalten? Atmung? Lecken? Hecheln? Pacing? Identifiziere den Stack: oft Schlüssel + Schuhe + Tasche + Jacke + Tür-Hand.",
      no_gos: [
        "Schon trainieren ohne den Auslöser-Stack zu kennen.",
        "Auslöser nur einzeln betrachten — sie wirken oft kombiniert.",
        "Stress-Anzeichen relativieren.",
      ],
      fortschritt: [
        "Du hast eine klare Auslöser-Liste.",
        "Du verstehst {dogName}s Angst-Prozess.",
        "Du bist bereit für gezielte Entkopplung.",
        "Erste 2-5 Sekunden Allein-Zeit werden ohne Drama bewältigt.",
      ],
      exerciseIds: ["ax-trigger-stack", "ax-mini-sekunden"],
    },
    {
      title: "Auslöser entkoppeln",
      schwerpunkt: "Die identifizierten Auslöser werden ihrer Bedeutung beraubt. Schlüssel nehmen ohne zu gehen, Schuhe anziehen ohne zu gehen. Über Wochen verlieren die Auslöser ihre angst-auslösende Wirkung.",
      wochenziele: [
        "{dogName} reagiert nicht mehr auf einzelne Auslöser.",
        "Auslöser sind entkoppelt vom Gehen.",
        "Du baust beilaufig in den Tag ein.",
      ],
      tagesplan: "10x am Tag verschiedene Auslöser ohne Konsequenz: Schlüssel nehmen, hinlegen. Schuhe anziehen, ausziehen. Türklinke beruehren, loslassen. {dogName} schaut erst interessiert, dann verliert sie Interesse. Genau das ist der Lerneffekt.",
      no_gos: [
        "Trainings-aehnlich machen — beilaufig ist besser.",
        "Erwarten dass es in 3 Tagen klappt — Wochen-Arbeit.",
        "Bei Stress-Anzeichen weitermachen.",
      ],
      fortschritt: [
        "Auslöser verlieren ihre Wirkung.",
        "{dogName} bleibt entspannter bei Auslöser-Sichtungen.",
        "Du arbeitest entspannt nebenbei.",
        "Vor dem Gehen gibt es jetzt einen gut gestopften Kong als positive Verknüpfung.",
      ],
      exerciseIds: ["ax-trigger-entkoppeln", "ax-kong-beim-gehen"],
    },
    {
      title: "Allein-Sein in Sekunden aufbauen",
      schwerpunkt: "Jetzt baust du Allein-Zeit auf — von 2 Sekunden zu Stunden. Geduldig, über Wochen. Wer zu schnell steigert, baut Angst wieder auf.",
      wochenziele: [
        "{dogName} bleibt 1-3 Min entspannt allein.",
        "Du gehst und kommst ohne Drama.",
        "Stress-Anzeichen reduzieren sich.",
      ],
      tagesplan: "Tag 1: 2 Sek allein, 10 Wiederholungen. Tag 2: 5 Sek. Tag 3: 10 Sek. Tag 4: 30 Sek. Tag 5: 1 Min. Tag 6-7: 2-3 Min. Komm zurueck wenn {dogName} ruhig ist, NICHT auf Stress-Reaktion.",
      no_gos: [
        "Bei Stress-Reaktion zurueckkommen — lehrt 'jaulen = Halter kommt'.",
        "Zu schnell steigern — Angst eskaliert.",
        "Drama bei Begruessung/Verabschiedung.",
      ],
      fortschritt: [
        "Allein-Zeit waechst messbar.",
        "Stress-Anzeichen reduzieren sich.",
        "Du arbeitest geduldig.",
      ],
      exerciseIds: ["ax-mini-sekunden", "ax-kong-beim-gehen"],
    },
    {
      title: "Kong als positive Verknüpfung",
      schwerpunkt: "Der Lieblings-Kong kommt NUR wenn du gehst. Damit wird Gehen positiv verknüpft. {dogName} freut sich aufs Allein-Sein statt davor Angst zu haben.",
      wochenziele: [
        "{dogName} startet Kong-Beschaeftigung wenn du gehst.",
        "Verknüpfung Kong + Abwesenheit ist etabliert.",
        "Stress-Anzeichen beim Gehen reduzieren sich.",
      ],
      tagesplan: "Stopfe Kong sehr gut mit Nassfutter, einfrieren = schwerer. Kurz vor dem Gehen: Kong an festem Platz geben. Geh ohne Drama. Komm zurueck. Kong wegnehmen — er ist NUR für Abwesenheit reserviert.",
      no_gos: [
        "Kong auch ausserhalb Abwesenheit geben — verliert die Magie.",
        "Bei Stress weitermachen — {dogName} ist noch nicht bereit.",
        "Dramatische Verabschiedung waehrend Kong-Übergabe.",
      ],
      fortschritt: [
        "{dogName} freut sich auf Kong-Zeit.",
        "Stress-Anzeichen reduzieren sich.",
        "Du baust positive Verknüpfung erfolgreich auf.",
      ],
      exerciseIds: ["ax-kong-beim-gehen", "ax-mini-sekunden"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Sicherheits-Decke etablieren",
      schwerpunkt: "Die Entspannungsdecke wird zum Sicherheits-Anker für Allein-Zeiten. {dogName} verbringt Allein-Zeit auf der Decke. Pavlov-Konditionierung: Decke = Sicherheit.",
      wochenziele: [
        "Decke ist Sicherheits-Anker etabliert.",
        "{dogName} sucht die Decke auch ausserhalb von Training auf.",
        "Allein-Zeit auf Decke wird Routine.",
      ],
      tagesplan: "Decke an festem Platz, idealerweise mit Sichtschutz (Korb, Hundesofa). Beim Verlassen: {dogName} auf Decke, Kong dazu. Wenn sie hochsteht: ruhig zurueckfuehren. Über Wochen wird Decke zur Allein-Zeit-Insel.",
      no_gos: [
        "Decke für Strafe nutzen.",
        "Decke nur in Stress-Phasen nutzen.",
        "{dogName} zwingen zu liegen.",
      ],
      fortschritt: [
        "{dogName} sucht von selbst die Decke auf.",
        "Decke wird emotional positiv besetzt.",
        "Allein-Zeit-Stress reduziert sich.",
      ],
      exerciseIds: ["ax-sicherheits-decke", "ax-kong-beim-gehen"],
    },
    {
      title: "Stunden-Aufbau mit Video-Beobachtung",
      schwerpunkt: "Wenn kurze Phasen sitzen, baust du langsam Stunden auf. Smartphone als Kamera, damit du genau weisst was {dogName} macht waehrend du weg bist. Nicht raten.",
      wochenziele: [
        "{dogName} bleibt 30-60 Min entspannt allein.",
        "Du beobachtest per Video, was wirklich passiert.",
        "Du erkennst Stress vs Entspannung sicher.",
      ],
      tagesplan: "Installiere Smartphone-Camera oder Smart-Camera mit Live-Stream. Tag 1-3: 30 Min Abwesenheit, beobachten. Tag 4-7: bei Erfolg auf 45 Min, dann 60 Min steigern. Bei Stress: zurueck zur letzten stabilen Stufe.",
      no_gos: [
        "Ohne Video raten was passiert.",
        "Zu schnell steigern.",
        "Bei Stress weitermachen.",
      ],
      fortschritt: [
        "Allein-Zeit waechst stabil.",
        "Du hast Daten, nicht nur Annahmen.",
        "{dogName}s Stress reduziert sich messbar.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Berechenbare Tagesroutine",
      schwerpunkt: "Hunde mit Trennungsangst profitieren massiv von vorhersehbaren Tagesabläufen. Gleichte Zeiten für Spaziergang, Fuetterung, Beschaeftigung, Allein-Zeit.",
      wochenziele: [
        "Tagesroutine ist etabliert und schriftlich.",
        "Auch am Wochenende werden die Zeiten gehalten.",
        "Berechenbarkeit reduziert Angst.",
      ],
      tagesplan: "Schreibe feste Zeiten an den Kuehlschrank: Aufstehen, erste Toilette, Fuetterung, Spaziergang, Allein-Zeit, nächster Spaziergang, Abendessen, Schlafen. Auch am Wochenende einhalten.",
      no_gos: [
        "Zeiten am Wochenende anders machen — verwirrt.",
        "Auslastung vor Allein-Zeit weglassen.",
        "Spontan abweichen ohne triftigen Grund.",
      ],
      fortschritt: [
        "{dogName} kennt die Tagesroutine.",
        "Unsicherheit reduziert sich.",
        "Trennungsangst sinkt mit Berechenbarkeit.",
      ],
      exerciseIds: ["ax-tagesroutine", "ax-kong-beim-gehen"],
    },
    {
      title: "Fundament-Check",
      schwerpunkt: "Letzte Fundament-Woche. Auslöser entkoppelt, Allein-Zeit-Aufbau läuft, Kong-Verknüpfung sitzt, Decke ist Anker. Phase 2 = Stunden-Aufbau.",
      wochenziele: [
        "Alle Bausteine sitzen.",
        "Du bist auf Phase 2 vorbereitet.",
        "{dogName}s Stress reduziert sich messbar.",
      ],
      tagesplan: "Bilanz: was sitzt, was wackelt? Falls Allein-Zeit unter 2 Min noch Stress: 1 Extra-Woche in Phase 1. Phase 2 = längere Zeiten, da darf nichts wackeln.",
      no_gos: [
        "Aus Ungeduld in Phase 2 springen.",
        "Schwellenwert ignorieren.",
        "Druck auf Steigerung machen.",
      ],
      fortschritt: [
        "Du fühlst dich kompetent.",
        "Werkzeuge sitzen.",
        "Phase 2 ist greifbar.",
      ],
      exerciseIds: ["ax-mini-sekunden", "ax-kong-beim-gehen"],
    },
  ],
  steigerung: [
    {
      title: "Minuten-Phasen ausdehnen",
      schwerpunkt: "Aufbauend auf Fundament: Allein-Zeit von 3 Min auf 15-30 Min. Belohnung bleibt Kong, Decke ist Anker, Beobachtung per Video.",
      wochenziele: [
        "{dogName} bleibt 15-30 Min entspannt allein.",
        "Kong wird ruhig verarbeitet.",
        "Stress-Anzeichen treten nicht mehr auf.",
      ],
      tagesplan: "Tag 1: 5 Min. Tag 2: 10. Tag 3: 15. Tag 4: 20. Tag 5: 30. Falls Stress an einem Tag: zurueck zur letzten stabilen Stufe, dort 2-3 Tage bleiben.",
      no_gos: [
        "Zu schnell steigern.",
        "Bei Stress durchziehen.",
        "Drama bei Verabschiedung/Begruessung.",
      ],
      fortschritt: [
        "Allein-Zeit waechst stabil.",
        "Kong-Verknüpfung sitzt.",
        "Stress reduziert sich.",
      ],
      exerciseIds: ["ax-mini-sekunden", "ax-kong-beim-gehen"],
    },
    {
      title: "Erste Stunde alleine",
      schwerpunkt: "Die Magie-Schwelle: 1 Stunde alleine. Wenn das sitzt, ist die meiste Trennungsangst-Arbeit getan. Vorsichtig und mit Video.",
      wochenziele: [
        "{dogName} schafft 1 Stunde entspannt allein.",
        "Video zeigt Ruhephasen waehrend Abwesenheit.",
        "Du fühlst dich erleichtert.",
      ],
      tagesplan: "Tag 1-2: 45 Min. Tag 3-4: 50 Min. Tag 5-7: 60 Min. Video beobachten. Bei Stress: zurueck. Bei Erfolg: vorsichtig weiter.",
      no_gos: [
        "Erwarten dass 1h sofort klappt.",
        "Mehrere Stunden parallel testen.",
        "Bei Stress weitermachen.",
      ],
      fortschritt: [
        "1 Stunde Allein-Zeit ist geschafft.",
        "Du fühlst dich erleichtert.",
        "{dogName} bleibt ruhig.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Außenreize waehrend Allein-Zeit",
      schwerpunkt: "{dogName} muss auch mit Außenreizen wahrend Allein-Zeit klarkommen. Straßenlaerm, Klingel, andere Hunde bellen — alles soll sie ruhig aushalten.",
      wochenziele: [
        "{dogName} bleibt bei Außenreizen waehrend Allein-Zeit ruhig.",
        "Decke bleibt Anker auch unter Reizen.",
        "Stress-Anzeichen treten nicht mehr auf.",
      ],
      tagesplan: "Plane Allein-Zeiten zu Zeiten mit normalem Aussenlaerm. Beobachte per Video. Falls {dogName} reagiert auf Außenreize: 1) Sichtschutz an Fenstern, 2) leise Hintergrundmusik (Adagio-Klassik), 3) Decke wegfueher von Geräuschquellen.",
      no_gos: [
        "Allein-Zeit bei Gewitter testen — zu schwer.",
        "Bei Reiz-Bellen reinkommen — verstärkt.",
        "Ohne Beobachtung lassen.",
      ],
      fortschritt: [
        "{dogName} bleibt unter Außenreizen ruhig.",
        "Anker-Routine ist robust.",
        "Du fühlst dich kompetenter.",
      ],
      exerciseIds: ["ax-sicherheits-decke", "ax-kong-beim-gehen"],
    },
    {
      title: "Auslöser-Entkopplung festigen",
      schwerpunkt: "Auch nach 4 Wochen weiter Auslöser entkoppeln. Schlüssel, Schuhe, Jacke ohne Bedeutung. {dogName} darf NICHT mehr auf einzelne Auslöser reagieren.",
      wochenziele: [
        "Alle ehemaligen Auslöser sind bedeutungslos.",
        "{dogName} reagiert nur noch beim tatsaechlichen Gehen.",
        "Stress-Aufbau beim Vorbereiten ist eliminiert.",
      ],
      tagesplan: "Weiterhin 10x am Tag verschiedene Auslöser ohne Konsequenz. Steigere die Inkonsequenz: manchmal nimmst du Schlüssel UND Schuhe an, gehst aber NICHT. Variabilität ist Schlssel.",
      no_gos: [
        "Auslöser-Entkopplung weglassen.",
        "Nur einzelne Auslöser entkoppeln.",
        "Erwarten dass es ohne weitere Arbeit haelt.",
      ],
      fortschritt: [
        "Auslöser sind dauerhaft entkoppelt.",
        "Stress-Vorbereitung ist eliminiert.",
        "Du arbeitest entspannt im Alltag.",
      ],
      exerciseIds: ["ax-trigger-entkoppeln", "ax-kong-beim-gehen"],
    },
    // Vertiefungen
    {
      title: "2-Stunden-Phasen",
      schwerpunkt: "2 Stunden alleine. Das ist die Schwelle, ab der echtes Alltagsleben möglich wird (Einkauf, Arbeit-Mittagspause). Behutsam, mit Video.",
      wochenziele: [
        "{dogName} schafft 2 Stunden ruhig allein.",
        "Video zeigt Schlaf-Phasen.",
        "Du gewinnst Alltagsfreiheit zurueck.",
      ],
      tagesplan: "Tag 1-2: 90 Min. Tag 3-4: 100 Min. Tag 5-7: 2 Stunden. Belohnung mit Kong + Decke. Falls Stress: zurueck zur stabilen Stufe.",
      no_gos: [
        "Erwarten dass 2h sofort klappt.",
        "Ohne Video raten.",
        "Bei Stress durchziehen.",
      ],
      fortschritt: [
        "2h Allein-Zeit ist erreicht.",
        "Du gewinnst Alltagsfreiheit.",
        "{dogName} bleibt ruhig.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Variable Allein-Zeiten",
      schwerpunkt: "Bisher hattest du feste Allein-Zeiten. Jetzt variierst du: mal 30 Min, mal 2h, mal 90 Min. {dogName} lernt: Allein-Zeit ist unvorhersehbar, aber immer vorübergehend.",
      wochenziele: [
        "{dogName} bleibt unabhaengig von Zeit-Dauer ruhig.",
        "Variabilität ist eingespielt.",
        "Du planst flexibel.",
      ],
      tagesplan: "Pro Tag 2-3 verschiedene Allein-Zeit-Dauer: morgens 30 Min, nachmittags 2h, abends 45 Min. {dogName} lernt: ich weiss nie genau wie lang, also bleibe ich ruhig.",
      no_gos: [
        "Mehr als 3h am Stueck — zu lang für diese Phase.",
        "Zu starke Unterschiede an einem Tag.",
        "Bei Stress nicht zurueckschalten.",
      ],
      fortschritt: [
        "Variabilität wird akzeptiert.",
        "{dogName} bleibt unabhaengig von Dauer ruhig.",
        "Du planst flexibler.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-kong-beim-gehen"],
    },
    {
      title: "Sozial-Kontakt als Stress-Reducer",
      schwerpunkt: "Mehr Sozial-Kontakte mit anderen Hunden waehrend du da bist reduzieren oft Trennungsangst. {dogName} ist weniger fixiert auf dich allein.",
      wochenziele: [
        "{dogName} hat 2-3 berechenbare Hundefreunde.",
        "Sozial-Termine pro Woche sind etabliert.",
        "Fixierung auf dich reduziert sich.",
      ],
      tagesplan: "Pro Woche 2-3 Sozial-Termine: 30-45 Min mit ruhigen, berechenbaren Hunden. Niemals länger. Nach Sozial-Termin: Runterkommen. {dogName} lernt: ich habe mehr soziale Quellen als nur den Halter.",
      no_gos: [
        "Stundenlange Tobereien.",
        "Unbekannte Hunde mit unklarer Sozialkompetenz.",
        "Mehrere Sozial-Termine pro Tag.",
      ],
      fortschritt: [
        "{dogName} hat soziale Netzwerk.",
        "Fixierung auf dich reduziert sich.",
        "Trennungsangst sinkt.",
      ],
      exerciseIds: ["ax-tagesroutine", "ax-kong-beim-gehen"],
    },
    {
      title: "Festigung Steigerung",
      schwerpunkt: "Letzte Steigerungs-Woche. 2h Allein-Zeit gemeistert, Auslöser entkoppelt, Routinen sitzen. Phase 3 = Alltag und Wartung.",
      wochenziele: [
        "Alle Werkzeuge sitzen.",
        "Allein-Zeit bis 2-3h ist machbar.",
        "Du bist auf Phase 3 vorbereitet.",
      ],
      tagesplan: "Bilanz: wo stehst du? Was wackelt? Plane Phase 3: berechenbare Tagesroutine, regelmaessige Refresher, Stress-Reduktion langfristig.",
      no_gos: [
        "Schon 4h+ Allein-Zeit forcieren.",
        "Routinen aufweichen.",
        "Erfolge als selbstverstaendlich nehmen.",
      ],
      fortschritt: [
        "Du fühlst dich erleichtert.",
        "Werkzeuge sitzen.",
        "Allein-Zeit ist machbar.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-sicherheits-decke"],
    },
  ],
  generalisierung: [
    {
      title: "3-4 Stunden im Alltag",
      schwerpunkt: "Phase 3 = realistischer Alltag. 3-4h Allein-Zeit sind machbar für die meisten arbeitenden Halter. Mehr ist auch für ausgeglichene Hunde grenzwertig.",
      wochenziele: [
        "{dogName} bleibt 3-4h ruhig allein.",
        "Alltagsleben (Arbeit, Einkauf) ist machbar.",
        "Du fühlst dich nicht mehr eingeschraenkt.",
      ],
      tagesplan: "Bewusst 3-4h Allein-Zeit testen. Video. Mehrere Tage stabil halten, bevor du länger gehst. Kong + Decke + ruhige Vorbereitung.",
      no_gos: [
        "5h+ ohne Toiletten-Pause — zu lang.",
        "Bei Stress durchziehen.",
        "Spontane Änderungen.",
      ],
      fortschritt: [
        "3-4h sind etabliert.",
        "Alltag ist wieder machbar.",
        "Du fühlst dich frei.",
        "Eine berechenbare Tagesroutine (Spaziergang, Fütterung, Allein-Zeit) hängt am Kühlschrank.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Berechenbare Tagesstruktur halten",
      schwerpunkt: "Auch nach Erfolg: Tagesroutine bleibt. Hunde mit (ehemaliger) Trennungsangst sind anfaellig für Rueckschritte bei Unregelmaessigkeit.",
      wochenziele: [
        "Tagesroutine wird konsequent gehalten.",
        "Auch am Wochenende keine Abweichungen.",
        "Berechenbarkeit ist langfristig etabliert.",
      ],
      tagesplan: "Halte den Routine-Zettel hoch. Wochenenden: gleichte Zeiten wie Wochentage. Spontane Änderungen vermeiden. Bei wirklich noetigen Änderungen: vorher schon angleichten.",
      no_gos: [
        "Wochenend-Schlaraffia ohne Routine.",
        "Spontane Plan-Änderungen.",
        "Auslastung vor Allein-Zeit weglassen.",
      ],
      fortschritt: [
        "Routine ist langfristig etabliert.",
        "{dogName} bleibt stabil.",
        "Du planst strukturiert.",
      ],
      exerciseIds: ["ax-tagesroutine", "ax-kong-beim-gehen"],
    },
    {
      title: "Stress-Reduktion langfristig",
      schwerpunkt: "Stress an anderen Stellen kann Trennungsangst zurueckbringen. Lebenslange Stress-Hygiene: genug Schlaf, gute Auslastung, soziale Kontakte, ruhige Umgebung.",
      wochenziele: [
        "{dogName} hat 16-20h Schlaf pro Tag.",
        "Stress-Faktoren werden aktiv reduziert.",
        "Trennungsangst-Rueckschritte werden vermieden.",
      ],
      tagesplan: "Prüfe regelmaessig: Schlaf-Hygiene? Auslastung? Soziale Kontakte? Ruhe-Phasen? Bei Stress an anderer Stelle: reduzieren bevor Trennungsangst zurueckkommt.",
      no_gos: [
        "Stress an anderer Stelle ignorieren.",
        "Reizüberflutung zulassen.",
        "Schlaf-Hygiene vergessen.",
      ],
      fortschritt: [
        "{dogName} bleibt langfristig ausgeglichen.",
        "Rueckschritte werden vermieden.",
        "Du achtest auf Stress-Hygiene.",
      ],
      exerciseIds: ["ax-tagesroutine", "ax-sicherheits-decke"],
    },
    {
      title: "Kong-Routine festigen",
      schwerpunkt: "Kong bleibt das exklusive Allein-Zeit-Werkzeug. NIEMALS in Anwesenheit geben. Variiere Inhalt damit es spannend bleibt.",
      wochenziele: [
        "Kong-Routine ist langfristig etabliert.",
        "Inhalt variiert genug für Abwechslung.",
        "Kong bleibt magischer Allein-Zeit-Snack.",
      ],
      tagesplan: "Bei jeder Allein-Zeit Kong. Variation: heute Nassfutter+Kaese, morgen Trockenfutter+Wurst, übermorgen Erdnussmus (sparsam). Eingefroren = schwerer. Nach Allein-Zeit: Kong weg.",
      no_gos: [
        "Kong auch ausserhalb Allein-Zeit geben.",
        "Immer derselbe Inhalt — langweilig.",
        "Kong nach 5 Min wegnehmen — frustriert.",
      ],
      fortschritt: [
        "Kong bleibt positiv besetzt.",
        "{dogName} freut sich aufs Allein-Sein.",
        "Verknüpfung haelt langfristig.",
      ],
      exerciseIds: ["ax-kong-beim-gehen", "ax-mini-sekunden"],
    },
    {
      title: "Beobachtungs-Routine",
      schwerpunkt: "Auch nach Erfolg regelmaessig per Video kontrollieren, was {dogName} waehrend Allein-Zeit macht. Rueckschritte werden so frueh erkannt.",
      wochenziele: [
        "Du beobachtest alle 2-3 Wochen per Video.",
        "Rueckschritte werden frueh erkannt.",
        "Du hast Daten, nicht nur Annahmen.",
      ],
      tagesplan: "Alle 2-3 Wochen: 1 Allein-Zeit mit Video aufzeichnen. Anschauen: was hat {dogName} gemacht? Geschlafen? Gekaut? Gepacing? Trends erkennen.",
      no_gos: [
        "Annehmen statt beobachten.",
        "Rueckschritte ignorieren.",
        "Video-Routine schleifen lassen.",
      ],
      fortschritt: [
        "Daten-basierte Sicherheit.",
        "Rueckschritte werden frueh erkannt.",
        "Du fühlst dich kompetenter.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Schwierige Anlässe meistern",
      schwerpunkt: "Tierarzt, Friseur, Notfall-Besuch. Anlässe die dich länger weghalten. Vorher trainieren, nicht im Notfall verstehen.",
      wochenziele: [
        "Du planst schwierige Anlässe strukturiert.",
        "{dogName} bleibt auch bei längeren Phasen ruhig.",
        "Du fühlst dich vorbereitet.",
      ],
      tagesplan: "Bevor schwierige Anlässe anstehen: 1 Woche vorher 1-2 ungewohnt lange Allein-Zeiten üben. Kong-Inhalt aufwerten. Tagesroutine möglichst aehnlich halten. Ggf. Hundesitter im Notfall.",
      no_gos: [
        "Spontane Verlängerung ohne Vorbereitung.",
        "Hundesitter ohne vorherige Bekanntschaft.",
        "{dogName} bei kurzfristiger Notwendigkeit überfordern.",
      ],
      fortschritt: [
        "Schwierige Anlässe werden gemeistert.",
        "Du planst strukturiert.",
        "{dogName} bleibt stabil.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Rueckschritts-Notfall-Protokoll",
      schwerpunkt: "Falls Trennungsangst zurueckkommt (neue Wohnung, Änderungen): klare Notfall-Sequenz. Frueh-Erkennung, gegen-Steuerung, Wochen extra-Konsequenz.",
      wochenziele: [
        "Du hast einen Notfall-Plan.",
        "Frueh-Anzeichen werden erkannt.",
        "Rueckschritte werden in 2-3 Wochen aufgefangen.",
      ],
      tagesplan: "Notfall-Plan: 1) zurueck zu kuerzeren Allein-Zeiten. 2) Kong-Verknüpfung verstärken. 3) Tagesroutine streng halten. 4) Stress-Faktoren reduzieren. 5) Tierarzt-Check ausschließen Medizinisches.",
      no_gos: [
        "Rueckschritte ignorieren.",
        "Bei Rueckschritt mit gewohnter Allein-Zeit weitermachen.",
        "Druck erhoehen.",
      ],
      fortschritt: [
        "Notfall-Plan sitzt.",
        "Rueckschritte werden gemanagt.",
        "Du fühlst dich langfristig kompetent.",
      ],
      exerciseIds: ["ax-mini-sekunden", "ax-kong-beim-gehen"],
    },
    {
      title: "Übergang in Wartungsmodus",
      schwerpunkt: "Letzte Woche. Trennungsangst ist deutlich reduziert, Allein-Zeit funktioniert, Routinen sitzen. Wartung für die nächsten Jahre.",
      wochenziele: [
        "Alle Routinen laufen langfristig.",
        "Wartungs-Rhythmus ist klar.",
        "{dogName} ist langfristig ausgeglichen.",
      ],
      tagesplan: "Reduziere aktives Training auf Minimum. Tagesroutine bleibt. Kong-Routine bleibt. Beobachtung alle 4-6 Wochen. Bei Veränderungen (Umzug, neue Routine): vorsichtig anpassen.",
      no_gos: [
        "Routinen schlagartig weglassen.",
        "Bei Veränderungen nicht anpassen.",
        "Beobachten aufhoeren.",
      ],
      fortschritt: [
        "{dogName} ist langfristig ausgeglichen.",
        "Du fühlst dich frei.",
        "Trennungsangst ist Geschichte.",
      ],
      exerciseIds: ["ax-tagesroutine", "ax-kong-beim-gehen"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// JUMPING (Anspringen) — 4 Pfoten = Belohnung, Springen = Ignorieren
// ────────────────────────────────────────────────────────────────────
const JUMPING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "4 Pfoten am Boden = Belohnung",
      schwerpunkt: "Das wichtigste Prinzip: nur ruhiges Stehen kriegt Aufmerksamkeit. Beim Springen wird {dogName} konsequent ignoriert. Über 2-3 Wochen Konsequenz verschwindet das Anspringen.",
      wochenziele: [
        "Bei 4 Pfoten am Boden: ruhig hallo sagen, streichheln.",
        "Bei Springen: Ruecken zudrehen, ignorieren.",
        "{dogName} merkt: Springen = du gehst weg.",
      ],
      tagesplan: "Bei jedem Wiedersehen aktiv anwenden: 4 Pfoten am Boden = ruhig hallo. Springt? Ruecken zudrehen, kein Augenkontakt. 4 Pfoten zurueck am Boden: wieder zuwenden. Konsistenz mit allen Familienmitgliedern.",
      no_gos: [
        "Beim Springen schimpfen — Aufmerksamkeit ist auch Belohnung.",
        "Familienmitglieder die einmal nachgeben — sabotiert die Arbeit.",
        "Mit dem Knie wegstossen — kann verletzen, Hund versteht es nicht.",
      ],
      fortschritt: [
        "{dogName} springt seltener.",
        "Du wirst konsequenter.",
        "Familie zieht mit.",
        "{dogName} bietet von selbst SITZ an wenn jemand auf {dogName} zukommt.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-sitz-als-gruess"],
    },
    {
      title: "SITZ als Begruessungs-Alternative",
      schwerpunkt: "Statt nur Springen zu unterbinden, geben wir {dogName} eine Alternative: SITZ ist die neue Begruessung. Bei Begegnung sitzt sie, kriegt dafür Aufmerksamkeit.",
      wochenziele: [
        "{dogName} setzt sich auf SITZ vor Begruessung.",
        "Aufmerksamkeit kommt NUR wenn sie sitzt.",
        "SITZ wird zur automatischen Begruessung.",
      ],
      tagesplan: "Bei Begegnungen (Familie, Gäste): SITZ sagen. Sie sitzt: streichheln + Leckerli. Sie steht auf zum Springen: Streicheln stop. Wieder SITZ: zuwenden. Auch Gäste anweisen: 'Nur bei SITZ.'",
      no_gos: [
        "Beim Stehen auch streichheln — falsche Verknüpfung.",
        "Gäste nicht informieren — sie streichheln den springenden Hund.",
        "SITZ nicht zuvor konditionieren.",
      ],
      fortschritt: [
        "SITZ wird Begrüßungs-Standard.",
        "Springen reduziert sich.",
        "Du fühlst dich vorbereitet.",
        "Familien-Konsistenz steht und alle Hausbewohner ziehen mit.",
      ],
      exerciseIds: ["j-sitz-als-gruess", "j-konsistenz-familie"],
    },
    {
      title: "Familien-Konsistenz etablieren",
      schwerpunkt: "Anspringen ist ein Konsistenz-Problem. Wenn 1 Familienmitglied das Springen erlaubt, sabotiert es alle Arbeit. Diese Woche etablierst du Familien-Konsistenz.",
      wochenziele: [
        "Alle Familienmitglieder kennen die Regel.",
        "Inkonsistenz wird auf 0 reduziert.",
        "Gäste werden vorab informiert.",
      ],
      tagesplan: "Familien-Briefing: 4 Pfoten = Hallo, Springen = ignorieren. Auch Kinder mitnehmen. Zettel mit Regel am Eingang für Gäste. Sprich Regel mehrmals pro Woche an.",
      no_gos: [
        "Familienmitglieder die 'nur einmal' das Springen erlauben.",
        "Gäste-Information vergessen.",
        "Inkonsequenz tolerieren.",
      ],
      fortschritt: [
        "Familie zieht mit.",
        "Gäste werden informiert.",
        "Inkonsistenz ist eliminiert.",
      ],
      exerciseIds: ["j-konsistenz-familie", "j-vier-pfoten-belohnen"],
    },
    {
      title: "Wieder-Sehens-Routine",
      schwerpunkt: "Heimkommen ist oft der groesste Spring-Anlass. Diese Woche etablieren wir eine ruhige Wieder-Sehens-Routine: kein Drama, kein Anspringen, ruhiges Hallo.",
      wochenziele: [
        "{dogName} kommt ruhig zur Tür, ohne zu springen.",
        "Begruessung ist ruhig und kontrolliert.",
        "Aufregung beim Wieder-Sehen reduziert sich.",
      ],
      tagesplan: "Kommst nach Hause: wenn {dogName} hochspringt, ignoriere sie 30 Sek. 4 Pfoten am Boden: ruhig hallo. Niemals dramatisch begruessen. Schuhe ausziehen, dann erst zuwenden.",
      no_gos: [
        "Dramatisches 'Hallo mein Schatz!' — verstärkt Aufregung.",
        "Sofort streichheln waehrend Hund springt.",
        "Erwarten dass ruhige Begruessung sofort klappt.",
      ],
      fortschritt: [
        "Wieder-Sehens-Routine wird ruhig.",
        "Aufregung reduziert sich.",
        "Du wirst entspannter beim Heimkommen.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-sitz-als-gruess"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Begegnungen bei Gästen",
      schwerpunkt: "Aufbauend: bei Gästen anwenden, was bei Familie sitzt. Gäste werden ausfuehrlich instruiert, {dogName} muss SITZEN waehrend Gast hereinkommt.",
      wochenziele: [
        "{dogName} bleibt bei Gäste-Empfang ruhig.",
        "Gäste sind informiert und ziehen mit.",
        "Gäste-Empfang ist Routine.",
      ],
      tagesplan: "Vor Gäste-Empfang: Gäste vorab per Nachricht informieren: 'Bitte ignoriere ihn die ersten 5 Min, er muss sitzen lernen.' Klingel: Decke oder SITZ. Gast kommt rein, achtet Hund nicht. Nach 3-5 Min ruhig: OK-Signal.",
      no_gos: [
        "Gäste nicht informieren.",
        "Erwarten dass alle Gäste mitziehen ohne Erklaerung.",
        "OK-Signal zu frueh geben.",
      ],
      fortschritt: [
        "Gäste-Empfang wird routiniert.",
        "{dogName} bleibt beim Empfang ruhig.",
        "Du fühlst dich entspannter.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-sitz-als-gruess"],
    },
    {
      title: "Spaziergangs-Begegnungen meistern",
      schwerpunkt: "Anspringen draußen ist heikel: nicht jeder Mensch will hochgesprungen werden. Wir etablieren SITZ an der Bein-Position bei Vorbeigaengern.",
      wochenziele: [
        "{dogName} setzt sich bei Vorbeigaengern an Bein-Position.",
        "Vorbeigaenger werden nicht angesprungen.",
        "Du fühlst dich vorbereitet auf Spaziergangs-Begegnungen.",
      ],
      tagesplan: "Spaziergaenge mit Vorbeigaenger-Erwartung. Bei Sicht eines Menschen (15m+): SITZ neben deinem Bein. Belohnung waehrend Vorbeigang. Vorbeigaenger gehen vorbei, NICHT mit Hund interagieren.",
      no_gos: [
        "Vorbeigaenger das Hund streichheln lassen waehrend Springen.",
        "Erwarten dass Vorbeigaenger sich darauf einlassen.",
        "Bei Stress weitermachen.",
      ],
      fortschritt: [
        "SITZ bei Vorbeigaengern wird Routine.",
        "Springen draußen reduziert sich.",
        "Spaziergaenge fühlen sich kontrollierter an.",
      ],
      exerciseIds: ["j-spazier-vorbeigaenger", "j-sitz-als-gruess"],
    },
    {
      title: "Decke für schwierige Gäste",
      schwerpunkt: "Bei schwierigen Gästen (Kinder, Ängstliche, alte Menschen) gehoert {dogName} auf die Decke. Klare Trennung, kein Risiko.",
      wochenziele: [
        "{dogName} bleibt bei schwierigen Gästen auf der Decke.",
        "Risikoreiche Begegnungen werden vermieden.",
        "Du fühlst dich verantwortungsvoll vorbereitet.",
      ],
      tagesplan: "Bei Kindern, ängstlichen Gästen oder alten Menschen: {dogName} direkt zur Decke fuehren. Auch waehrend des Besuchs auf der Decke lassen. Belohnung mit Kong. Bei Bedarf: Boxen-Trennung in anderem Raum.",
      no_gos: [
        "Erwarten dass alle Gäste den Hund vertragen.",
        "Riskante Begegnungen erzwingen.",
        "{dogName} bei ängstlichen Gästen frei lassen.",
      ],
      fortschritt: [
        "Risikoreiche Begegnungen werden vermieden.",
        "Decken-Routine ist robust.",
        "Du handelst verantwortungsvoll.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-sitz-als-gruess"],
    },
    {
      title: "Fundament-Festigung",
      schwerpunkt: "Letzte Fundament-Woche. 4-Pfoten-Routine sitzt, SITZ als Begruessung, Familien-Konsistenz, Gäste-Empfang. Phase 2 = mehr Anwendung.",
      wochenziele: [
        "Alle Bausteine sitzen.",
        "Springen ist deutlich reduziert.",
        "Du fühlst dich kompetent.",
      ],
      tagesplan: "Bilanz: was sitzt, was wackelt? Falls Schwaeche: 1 Extra-Woche. Phase 2 = noch mehr Anwendung in echten Situationen.",
      no_gos: [
        "Konsistenz aufweichen.",
        "Schwaechen ignorieren.",
        "Erfolge als selbstverstaendlich nehmen.",
      ],
      fortschritt: [
        "Du fühlst dich kompetent.",
        "Werkzeuge sitzen.",
        "Springen ist seltener.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-sitz-als-gruess"],
    },
  ],
  steigerung: [
    {
      title: "Konsistenz in mehr Situationen",
      schwerpunkt: "Diese Woche wendest du die Regeln in noch mehr Situationen an: morgens beim Aufstehen, beim Fuettern, beim Spielen. Springen kommt von alleinen.",
      wochenziele: [
        "4-Pfoten-Regel in 5+ Situationen pro Tag.",
        "Springen reduziert sich übergreifend.",
        "Du wirst reflexartig konsequent.",
      ],
      tagesplan: "Aktiv anwenden: morgens beim Aufstehen, vor Spaziergang, vor Fuettern, beim Spielen, beim Heimkommen. Jeder Sprung wird ignoriert, jedes 4-Pfoten-Stehen wird belohnt.",
      no_gos: [
        "Regel situativ aufweichen.",
        "Sich rechtfertigen ('ist halt aufgeregt').",
        "Wegen Eile Konsistenz weglassen.",
      ],
      fortschritt: [
        "Konsistenz wächst.",
        "Springen reduziert sich übergreifend.",
        "Du wirst innerlich konsequenter.",
        "Bei Vorbeigängern setzt sich {dogName} mehr und mehr von selbst an dein Bein.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-spazier-vorbeigaenger"],
    },
    {
      title: "Erweiterte Gäste-Sequenz",
      schwerpunkt: "Bei mehreren Gästen gleichzeitig wird's komplex. Diese Woche etablieren wir die Gäste-Sequenz auch bei Gruppen.",
      wochenziele: [
        "{dogName} bewältigt Gruppen-Besuch ruhig.",
        "Decke ist Anker auch bei Aufregung.",
        "Du planst strukturiert.",
      ],
      tagesplan: "Plane Gruppen-Besuche bewusst (3-4 Personen). {dogName} sofort auf Decke. Alle Gäste sind informiert. Begruessungs-Phase 5-10 Min, in der {dogName} auf Decke bleibt. Erst danach OK-Signal.",
      no_gos: [
        "Mehrere unbekannte Personen ohne Vorinfo.",
        "OK-Signal zu frueh.",
        "Decke ohne vorherige Konditionierung.",
      ],
      fortschritt: [
        "Gruppen-Besuche werden gemeistert.",
        "Decken-Routine ist robust.",
        "Du fühlst dich entspannter bei Gruppen.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-sitz-als-gruess"],
    },
    {
      title: "Sit-on-Cue im echten Setting",
      schwerpunkt: "SITZ als Standard-Begruessung wird nicht mehr abgesagt — {dogName} bietet es automatisch an. Belohnungs-Frequenz kann reduziert werden.",
      wochenziele: [
        "{dogName} setzt sich automatisch bei Begruessungen.",
        "Du musst nicht mehr aktiv SITZ sagen.",
        "Belohnungs-Frequenz reduziert sich.",
      ],
      tagesplan: "Bei Begruessungen 2-3 Sek warten — bietet {dogName} SITZ an? Wenn ja: sofort streichheln, gelegentlich Leckerli. Wenn nein: SITZ sagen. Über Wochen wird Automatik etabliert.",
      no_gos: [
        "Bei Stehenbleiben streichheln.",
        "Belohnungs-Frequenz zu schnell reduzieren.",
        "Erwarten dass es ohne Auffrischung haelt.",
      ],
      fortschritt: [
        "SITZ wird automatisch angeboten.",
        "Belohnungs-Frequenz sinkt.",
        "Du fühlst dich entspannter.",
      ],
      exerciseIds: ["j-sitz-als-gruess", "j-konsistenz-familie"],
    },
    {
      title: "Spaziergangs-Begegnungen festigen",
      schwerpunkt: "SITZ bei Vorbeigaengern wird Routine. {dogName} setzt sich automatisch, wenn Menschen nahen.",
      wochenziele: [
        "Automatisches SITZ bei Vorbeigaengern.",
        "Springen draußen ist nahezu eliminiert.",
        "Spaziergaenge sind entspannter.",
      ],
      tagesplan: "Pro Spaziergang aktiv SITZ-Sequenzen bei jeder Begegnung. Belohnung. Bei nicht-automatischem SITZ: Signal geben. Wenn automatisch: SUPER-Belohnung.",
      no_gos: [
        "Vorbeigaenger Hund streichheln lassen waehrend Stehen.",
        "Erwarten dass alle mitziehen.",
        "Bei Stress weitermachen.",
      ],
      fortschritt: [
        "Automatisches SITZ wird etabliert.",
        "Spaziergangs-Begegnungen sind kontrolliert.",
        "Du fühlst dich kompetent.",
      ],
      exerciseIds: ["j-spazier-vorbeigaenger", "j-sitz-als-gruess"],
    },
    // Vertiefungen
    {
      title: "Spielen kontrolliert",
      schwerpunkt: "Beim Spielen ist Anspringen oft erlaubt (oder erwuenscht). Diese Woche differenzieren wir: Spielen = darf, Begruessung = darf nicht. Klare Signale.",
      wochenziele: [
        "{dogName} unterscheidet Spiel-Anspringen von Begruessungs-Anspringen.",
        "Klare Signale für beide Modi.",
        "Spielen bleibt erlaubt, Begruessungs-Springen wird unterbunden.",
      ],
      tagesplan: "Vor Spiel: klares Signal 'LAUF' oder 'SPIEL' — jetzt darf gesprungen werden. Vor Begruessung: klares Signal 'RUHIG' — jetzt nicht. Konsequenz mit beiden Signalen.",
      no_gos: [
        "Signale inkonsistent geben.",
        "Spielen waehrend Begruessungs-Situation.",
        "Erwarten dass Hund selbst differenziert ohne Signal.",
      ],
      fortschritt: [
        "{dogName} unterscheidet die Modi.",
        "Spielen bleibt erlaubt.",
        "Du hast klare Signale etabliert.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-sitz-als-gruess"],
    },
    {
      title: "Begruessungs-Routine perfektionieren",
      schwerpunkt: "Wieder-Sehens-Routine wird zur festen Sequenz. Tür auf, Schuhe ausziehen, ruhig hallo. {dogName} weiss genau was kommt.",
      wochenziele: [
        "Wieder-Sehens-Routine ist eingespielt.",
        "Aufregung beim Heimkommen ist minimal.",
        "Du wirst innerlich ruhig beim Heimkommen.",
      ],
      tagesplan: "Bei jedem Heimkommen die gleichte Sequenz: Tür auf, ignoriere Hund, Schuhe aus, Jacke aus. Dann ruhig zuwenden wenn 4 Pfoten am Boden. {dogName} lernt: dieser Ablauf ist Standard.",
      no_gos: [
        "Spontan abweichen.",
        "Dramatisches Hallo bei Stress des Tages.",
        "Familienmitglieder die mitziehen aber nicht konsequent.",
      ],
      fortschritt: [
        "Wieder-Sehens-Routine ist Standard.",
        "Du wirst ruhiger beim Heimkommen.",
        "{dogName} bleibt entspannt.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-sitz-als-gruess"],
    },
    {
      title: "Decken-Anker für Stress-Situationen",
      schwerpunkt: "Wenn Stress-Begegnungen drohen (mehrere Hunde, viele Gäste): Decke ist Anker. {dogName} darf darauf bleiben statt einzugreifen.",
      wochenziele: [
        "Decke als Anker bei Stress-Situationen.",
        "{dogName} sucht Decke aktiv auf.",
        "Stress-Begegnungen werden entschärft.",
      ],
      tagesplan: "Bei Stress-Begegnung: {dogName} aktiv zur Decke fuehren mit Kong. Sie bleibt dort waehrend der schwierigen Phase. Belohnung mit Beruhigungs-Marker.",
      no_gos: [
        "Stress-Begegnungen ohne Vorbereitung.",
        "Decke ohne vorherige positive Konditionierung.",
        "{dogName} zwingen zu bleiben.",
      ],
      fortschritt: [
        "Decke als Anker funktioniert.",
        "Stress-Begegnungen sind entschärft.",
        "{dogName} reguliert sich selbst.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-sitz-als-gruess"],
    },
    {
      title: "Festigung Steigerung",
      schwerpunkt: "Letzte Steigerungs-Woche. Springen ist deutlich reduziert, Begruessungs-Routinen sitzen. Phase 3 = Langzeit-Anwendung und Stabilisierung.",
      wochenziele: [
        "Springen ist deutlich reduziert.",
        "Begruessungs-Routinen sitzen flussig.",
        "Du fühlst dich kompetent.",
      ],
      tagesplan: "Bilanz: was funktioniert super? Wo gibt es noch Rueckfaelle? Notiere für Phase 3 Wartungs-Strategien.",
      no_gos: [
        "Erfolge als selbstverstaendlich.",
        "Konsistenz aufweichen.",
        "Familienkonsistenz schleifen lassen.",
      ],
      fortschritt: [
        "Springen ist seltener.",
        "Du fühlst dich kompetent.",
        "Werkzeuge sitzen.",
      ],
      exerciseIds: ["j-sitz-als-gruess", "j-konsistenz-familie"],
    },
  ],
  generalisierung: [
    {
      title: "Wartungs-Routine etablieren",
      schwerpunkt: "Anspringen kann zurueckkommen wenn Konsistenz nachlässt. Wartungs-Routine für die nächsten Monate: 1x taeglich bewusst Begruessungen üben.",
      wochenziele: [
        "Du hast eine taegliche Wartungs-Routine.",
        "Wieder-Sehens-Übung wird regelmaessig gemacht.",
        "Du erkennst Rueckschritte frueh.",
      ],
      tagesplan: "Pro Tag 1 bewusste Begruessungs-Übung: aus dem Raum gehen, ruhig zurueckkommen. SITZ + Streicheln + Leckerli. Bei Springen: 30 Sek ignorieren. Aktiv halten statt zu hoffen.",
      no_gos: [
        "Routine schleifen lassen.",
        "Rueckschritte ignorieren.",
        "Familienkonsistenz aufweichen.",
      ],
      fortschritt: [
        "Wartungs-Routine ist etabliert.",
        "Rückschritte werden früh erkannt.",
        "{dogName} bleibt langfristig stabil.",
        "Gäste-Empfang läuft als eingespielte Sequenz, ohne Drama.",
      ],
      exerciseIds: ["j-wartungs-routine", "j-tuergaeste-routine"],
    },
    {
      title: "Stress-Tests",
      schwerpunkt: "Alle 2-3 Wochen: bewusster Stress-Test mit neuen Personen. Wie reagiert {dogName}? Bleibt SITZ-Routine stabil oder springt sie wieder?",
      wochenziele: [
        "{dogName} bewältigt Stress-Tests.",
        "Du erkennst Schwachstellen frueh.",
        "Du justierst nach bei Bedarf.",
      ],
      tagesplan: "Plane 1-2 mal pro Monat einen Stress-Test: Lieferdienst, unbekannter Gast, mehrere Personen gleichzeitig. Beobachte. Bei Springen: 1 Woche extra-konsequent.",
      no_gos: [
        "Stress-Tests vermeiden — wirkliche Reaktivität bleibt verborgen.",
        "Bei Rueckfall ignorieren.",
        "Stress-Tests zu schwer machen.",
      ],
      fortschritt: [
        "Du hast Daten zur Robustheit.",
        "Rueckfaelle werden erkannt.",
        "{dogName}s Verhalten ist getestet stabil.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-sitz-als-gruess"],
    },
    {
      title: "Familien-Konsistenz langfristig",
      schwerpunkt: "Familien-Konsistenz braucht regelmaessige Erinnerung. Diese Woche frischst du die Regeln auf, sprichst sie an, achtest auf neue Inkonsistenz.",
      wochenziele: [
        "Familie ist auf dem aktuellen Stand.",
        "Neue Inkonsistenz wird vermieden.",
        "Du wirst aufmerksamer Beobachter.",
      ],
      tagesplan: "Familien-Briefing wiederholen. Zettel am Eingang aktualisieren. Aktiv auf neue Inkonsistenzen achten: Kind streichhelt im Sprung? Gast lässt sich anspringen? Sofort ansprechen.",
      no_gos: [
        "Familienmitglieder die nicht mitziehen tolerieren.",
        "Briefings vergessen.",
        "Bei Inkonsistenz schweigen.",
      ],
      fortschritt: [
        "Familienkonsistenz bleibt hoch.",
        "Neue Inkonsistenzen werden frueh erkannt.",
        "{dogName} bleibt stabil.",
      ],
      exerciseIds: ["j-konsistenz-familie", "j-vier-pfoten-belohnen"],
    },
    {
      title: "Schwierige Begegnungen meistern",
      schwerpunkt: "Diese Woche bewusst schwierige Begegnungen: ängstliche Menschen, Kinder, alte Menschen. Decke + Distanz statt Konfrontation.",
      wochenziele: [
        "Schwierige Begegnungen werden vorgeplant.",
        "Decke bleibt Anker.",
        "Du fühlst dich verantwortungsvoll vorbereitet.",
      ],
      tagesplan: "Bei erwarteten schwierigen Begegnungen: {dogName} vorher auf Decke. Distanz halten. Falls notwendig: anderer Raum. Niemals erzwingen.",
      no_gos: [
        "Schwierige Begegnungen ohne Vorbereitung.",
        "Kinder oder ängstliche Menschen überraschen.",
        "{dogName} bei ängstlichen Menschen frei lassen.",
      ],
      fortschritt: [
        "Schwierige Begegnungen werden gemeistert.",
        "Du handelst verantwortungsvoll.",
        "Risikoreiche Situationen werden vermieden.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-sitz-als-gruess"],
    },
    {
      title: "Belohnungs-Reduktion vorsichtig",
      schwerpunkt: "SITZ-Begruessung wird so selbstverstaendlich, dass Belohnungs-Dichte reduziert werden kann. Aber: variable Verstaerkung haelt das Verhalten stabiler.",
      wochenziele: [
        "Belohnungs-Frequenz auf ~50% reduziert.",
        "{dogName} setzt sich auch mit weniger Belohnung.",
        "Spitzenleistungen werden weiter mit Jackpot belohnt.",
      ],
      tagesplan: "Bei Familienbegruessungen: alle 2-3 Mal Leckerli statt jedes Mal. Bei Gästen: weiterhin jedes Mal Belohnung. {dogName} merkt: das System bleibt, aber unvorhersehbar.",
      no_gos: [
        "Belohnung komplett streichhen.",
        "Bei Gästen Belohnung reduzieren.",
        "Variabilität aufweichen.",
      ],
      fortschritt: [
        "{dogName} setzt sich auch mit weniger Belohnung.",
        "SITZ ist automatisch.",
        "Du steckst weniger Leckerlis ein.",
      ],
      exerciseIds: ["j-sitz-als-gruess", "j-konsistenz-familie"],
    },
    {
      title: "Spaziergangs-Routine festigen",
      schwerpunkt: "SITZ bei Vorbeigaengern wird Standard. Du musst nicht mehr aktiv SITZ sagen — {dogName} bietet es an, wenn Menschen nahen.",
      wochenziele: [
        "{dogName} bietet SITZ automatisch an.",
        "Vorbeigaenger werden ruhig passiert.",
        "Spaziergaenge fühlen sich kontrolliert an.",
      ],
      tagesplan: "Pro Spaziergang aktiv beobachten: bietet {dogName} SITZ automatisch an? Bei automatischem SITZ: SUPER-Belohnung. Bei Stehen: SITZ-Signal geben.",
      no_gos: [
        "Vorbeigaenger streichheln lassen waehrend Stehen.",
        "Spaziergaenge ohne Beobachtung.",
        "Automatik-Erwartung ohne weitere Belohnung.",
      ],
      fortschritt: [
        "Automatisches SITZ ist etabliert.",
        "Spaziergangs-Begegnungen sind ruhig.",
        "Du fühlst dich kompetent.",
      ],
      exerciseIds: ["j-spazier-vorbeigaenger", "j-sitz-als-gruess"],
    },
    {
      title: "Notfall-Plan bei Rueckfaellen",
      schwerpunkt: "Falls Springen zurueckkommt: klare Notfall-Sequenz. 1 Woche extra-konsequent, Familien-Briefing, Belohnungs-Dichte wieder hoch.",
      wochenziele: [
        "Du hast Notfall-Plan.",
        "Rueckschritte werden frueh erkannt.",
        "Rueckfaelle werden in 1-2 Wochen aufgefangen.",
      ],
      tagesplan: "Notfall-Plan: 1) 1 Woche extra-konsequent mit Ignorieren. 2) Familien-Briefing wiederholen. 3) Belohnungs-Dichte wieder hoch. 4) Beobachten was sich geaendert hat.",
      no_gos: [
        "Rueckschritte ignorieren.",
        "In Panik geraten.",
        "Routinen radikal ändern.",
      ],
      fortschritt: [
        "Notfall-Plan sitzt.",
        "Rueckfaelle werden gemanagt.",
        "Du fühlst dich langfristig kompetent.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-konsistenz-familie"],
    },
    {
      title: "Übergang in Wartungsmodus",
      schwerpunkt: "Letzte Woche. Springen ist stark reduziert, Routinen sitzen, Familienkonsistenz stabil. Wartung für die kommenden Monate.",
      wochenziele: [
        "Alle Routinen laufen langfristig.",
        "Wartungs-Rhythmus ist klar.",
        "{dogName} ist langfristig stabil.",
      ],
      tagesplan: "Reduziere aktives Training auf Minimum. Wartungs-Routine 1x taeglich. Familien-Briefing alle 3 Monate. Stress-Tests alle 4-6 Wochen. Bei Rueckfaellen: Notfall-Plan einsetzen.",
      no_gos: [
        "Alle Routinen schlagartig weglassen.",
        "Familienkonsistenz aufweichen.",
        "Wartung schleifen lassen.",
      ],
      fortschritt: [
        "Springen ist Ausnahme.",
        "{dogName} bleibt langfristig stabil.",
        "Du fühlst dich kompetent.",
      ],
      exerciseIds: ["j-wartungs-routine", "j-tuergaeste-routine"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// DESTRUCTIVE (Zerstoerungsverhalten) — Ursache + Kau-Objekte + Management
// ────────────────────────────────────────────────────────────────────
const DESTRUCTIVE_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Ursachen-Analyse: warum zerstört {dogName}?",
      schwerpunkt: "Zerstoerung hat verschiedene Ursachen, die unterschiedliche Loesungen brauchen. Diese Woche identifizierst du den Hauptgrund: Langeweile, Trennungsangst, Beissduerfnis oder Zahnwechsel.",
      wochenziele: [
        "Du kennst den Hauptgrund für das Zerstören.",
        "Du verstehst, was Hilfsmittel und was Symptom ist.",
        "Du hast den Trainings-Schwerpunkt klar.",
      ],
      tagesplan: "Eine Woche lang dokumentieren: was wird zerstört? Wann? Wie alt ist {dogName}? Welche Auslastung? Welche Allein-Zeit-Verhalten? Identifiziere: Langeweile, Trennungsangst, oder Beissduerfnis als Hauptursache.",
      no_gos: [
        "Schon trainieren ohne Ursache zu kennen.",
        "Ursachen vermischen.",
        "Symptome bekaempfen statt Ursachen.",
      ],
      fortschritt: [
        "Du kennst die Ursache.",
        "Du weißt, welcher Schwerpunkt zu trainieren ist.",
        "Du bist bereit für gezielte Arbeit.",
        "Die ersten 4-5 erlaubten Kau-Objekte sind angeschafft und in Rotation.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-kauobjekte-etablieren"],
    },
    {
      title: "Erlaubte Kau-Objekte etablieren",
      schwerpunkt: "{dogName} hat Beissduerfnis, das gestillt werden muss. Statt es zu unterdruecken, kanalisieren wir es in ERLAUBTE Objekte. 4-5 verschiedene, in Rotation.",
      wochenziele: [
        "4-5 verschiedene Kau-Objekte sind verfuegbar.",
        "Rotation ist etabliert.",
        "{dogName} hat klare Erlaubt-Liste.",
      ],
      tagesplan: "Investiere in 4-5 Kau-Objekte: Naturkauartikel (Bueffelhaut, Ochsenziemer), Kong, Schnüffelmatte, Holzknochen, Geweih. Pro Tag 1-2 verschiedene, Rotation. Lange Kau-Sessions etablieren.",
      no_gos: [
        "Nur 1 Kau-Objekt — wird langweilig.",
        "Alle Objekte gleichzeitig verfuegbar — keine Spannung.",
        "Billige Kauknochen (Rohhaut) — Verletzungsgefahr.",
      ],
      fortschritt: [
        "{dogName} hat Lieblings-Kau-Objekte.",
        "Beißbedürfnis ist kanalisiert.",
        "Zerstörung reduziert sich.",
        "Sichere Management-Zonen für Abwesenheit sind eingerichtet.",
      ],
      exerciseIds: ["d-kauobjekte-etablieren", "d-management-zonen"],
    },
    {
      title: "Management-Zonen einrichten",
      schwerpunkt: "Solange das Training nicht steht, hilft Management. {dogName} hat keine Moeglichkeit, Schuhe oder Moebel zu zerstören — weil sie nicht erreichbar sind.",
      wochenziele: [
        "Sichere Zonen sind eingerichtet.",
        "Risiko-Bereiche sind blockiert.",
        "{dogName} ist bei Abwesenheit nicht in Risiko-Zonen.",
      ],
      tagesplan: "Identifiziere Risiko-Zonen. Bei Abwesenheit oder Unbeobachtetheit: {dogName} in sicherer Zone (Box, Kueche mit Babyschutz). In dieser Zone: erlaubte Kau-Objekte + Wasser. Niemals als Strafe.",
      no_gos: [
        "Sichere Zone als Gefaengnis.",
        "Risiko-Zonen offen lassen aus Bequemlichkeit.",
        "Hund frei lassen wenn Risiko unkalkulierbar.",
      ],
      fortschritt: [
        "Sichere Zone ist etabliert.",
        "Zerstoerung wird verhindert.",
        "Du handelst verantwortungsvoll.",
      ],
      exerciseIds: ["d-management-zonen", "d-kauobjekte-etablieren"],
    },
    {
      title: "Tausch statt Strafe etablieren",
      schwerpunkt: "Wenn {dogName} verbotenes Objekt hat: Tausch ist die richtige Reaktion, nicht Strafe. Ruhig nähern, Leckerli anbieten, Tausch.",
      wochenziele: [
        "Tausch ist Standard-Reaktion auf verbotenes Objekt.",
        "Konflikt-Eskalationen werden vermieden.",
        "Du wirst innerlich ruhiger.",
      ],
      tagesplan: "{dogName} hat verbotenes Objekt: NICHT schreien, NICHT hinterherrennen. Ruhig nähern, AUS, hochwertiges Leckerli. Tausch. Erlaubtes Kau-Objekt anbieten. Niemals verbotenes Objekt zurueckgeben.",
      no_gos: [
        "Schimpfen — kontraproduktiv.",
        "Hinterherrennen — Spiel-Verstaerkung.",
        "Verbotenes Objekt zurueckgeben.",
      ],
      fortschritt: [
        "{dogName} gibt verbotene Objekte freiwillig her.",
        "Du wirst innerlich ruhiger.",
        "Konflikte werden vermieden.",
      ],
      exerciseIds: ["d-tausch-statt-strafe", "d-kauobjekte-etablieren"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Auslastung verdoppeln",
      schwerpunkt: "Falls Langeweile die Ursache ist (oft bei jungen Hunden): Auslastungs-Mischung. Bewegung + Kopfarbeit + Nasenarbeit, nicht nur Bewegung.",
      wochenziele: [
        "Tageausplan mit gemischter Auslastung steht.",
        "Mind. 3 Arten von Auslastung pro Tag.",
        "{dogName} ist abends erschöpft, nicht aufgeregt.",
      ],
      tagesplan: "Pro Tag: 1 Spaziergang (30-60 Min mit Tempo-Wechseln), 1 Nasenarbeit (Suchspiel), 1 Kopfarbeit (Trick, Kong). Falls jung: weniger stumpfes Toben, mehr Kopfarbeit. Falls erwachsen: mehr Spuren-Suche.",
      no_gos: [
        "Nur Bewegung als Auslastung — fuehrt zu Übererregung.",
        "Stundenlange Tobereien — kontraproduktiv.",
        "Nasenarbeit/Kopfarbeit als 'optional'.",
      ],
      fortschritt: [
        "{dogName} ist abends ruhig.",
        "Zerstörung reduziert sich messbar.",
        "Du hast eine Auslastungs-Routine.",
        "Beim Bemerken verbotener Gegenstände reagierst du mit ruhigem Tausch statt Konflikt.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-tausch-statt-strafe"],
    },
    {
      title: "Lange Liege-Phasen",
      schwerpunkt: "Manche Zerstoerung kommt vom Nicht-Stillsitzen-Koennen. {dogName} muss lernen, lange Ruhe-Phasen aktiv zu halten — auch wenn nichts passiert.",
      wochenziele: [
        "{dogName} bleibt 30-60 Min entspannt auf der Decke.",
        "Stillsitzen wird trainiert.",
        "Allein-mit-sich-selbst-Sein wird gelernt.",
      ],
      tagesplan: "Pro Tag 1-2 Decke-Sessions: 30-60 Min auf der Decke, du arbeitest nebenan. {dogName} darf nicht aufstehen, kriegt Kong als Beschaeftigung. Belohnung beim ruhigen Liegen.",
      no_gos: [
        "{dogName} bei Decke-Session staendig stimulieren.",
        "Decke ohne vorherige Konditionierung.",
        "Sessions zu kurz — wirken nicht.",
      ],
      fortschritt: [
        "{dogName} bleibt länger ruhig.",
        "Stillsitzen wird selbstverstaendlich.",
        "Zerstoerung aus Langeweile reduziert sich.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-allein-zeit-kong"],
    },
    {
      title: "Allein-Zeit-Kong für Trennungsangst-Faelle",
      schwerpunkt: "Falls Trennungsangst Mit-Ursache ist: gut gestopfter Kong vor jeder Abwesenheit. 30 Min Beschaeftigung überbrueckt die kritische Phase.",
      wochenziele: [
        "{dogName} startet Kong-Beschaeftigung beim Gehen.",
        "Allein-Zeit-Zerstoerung reduziert sich.",
        "Positive Verknüpfung Abwesenheit-Kong.",
      ],
      tagesplan: "Vor jeder Abwesenheit: gut gestopfter Kong (eingefroren = schwerer). Geh ohne Drama. Kong wegnehmen bei Rueckkehr. Variation: Schnüffelmatte mit Trockenfutter.",
      no_gos: [
        "Kong auch in Anwesenheit geben.",
        "Kong nicht eingefroren — zu schnell fertig.",
        "Dramatisches Abschied/Begruessung.",
      ],
      fortschritt: [
        "Allein-Zeit-Zerstoerung reduziert sich.",
        "Positive Verknüpfung steht.",
        "Du fühlst dich entspannter beim Gehen.",
      ],
      exerciseIds: ["d-allein-zeit-kong", "d-kauobjekte-etablieren"],
    },
    {
      title: "Fundament-Check",
      schwerpunkt: "Letzte Fundament-Woche. Ursache klar, Kau-Objekte etabliert, Management-Zonen sicher, Tausch-Routine sitzt. Phase 2 = mehr Auslastung und Routinen.",
      wochenziele: [
        "Alle Bausteine sitzen.",
        "Zerstoerung ist messbar reduziert.",
        "Du fühlst dich kompetent.",
      ],
      tagesplan: "Bilanz: was funktioniert super, was wackelt? Falls Schwaeche: 1 Extra-Woche. Phase 2 = noch mehr Auslastung und Routinen-Festigung.",
      no_gos: [
        "Aus Ungeduld in Phase 2 springen.",
        "Schwaechen ignorieren.",
        "Management aufweichen.",
      ],
      fortschritt: [
        "Du fühlst dich kompetent.",
        "Werkzeuge sitzen.",
        "Zerstoerung ist seltener.",
      ],
      exerciseIds: ["d-kauobjekte-etablieren", "d-tausch-statt-strafe"],
    },
  ],
  steigerung: [
    {
      title: "Auslastungs-Plan implementieren",
      schwerpunkt: "Strukturierter Tagesplan mit gemischter Auslastung wird zur Routine. Bewegung + Nasenarbeit + Kopfarbeit + Ruhe in klarer Verteilung.",
      wochenziele: [
        "Auslastungs-Plan steht schriftlich.",
        "Plan wird taeglich umgesetzt.",
        "{dogName} ist ausgeglichener.",
      ],
      tagesplan: "Schreibe einen 7-Tage-Plan: pro Tag 1 Bewegung, 1 Nasenarbeit, 1 Kopfarbeit. Mehr-Auslastung an problematischen Tagen. Schlaf-Hygiene 16-20h. Sozialer Kontakt 2-3x pro Woche.",
      no_gos: [
        "Plan ohne Schriftform — wird vergessen.",
        "An Wochenenden anders machen.",
        "Auslastung weglassen bei Eile.",
      ],
      fortschritt: [
        "{dogName} ist ausgeglichener.",
        "Zerstoerung reduziert sich weiter.",
        "Du planst strukturiert.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-kauobjekte-etablieren"],
    },
    {
      title: "Kau-Objekt-Rotation perfektionieren",
      schwerpunkt: "Rotation der Kau-Objekte wird zur taeglichen Routine. {dogName} ist immer beschaeftigt, Beissduerfnis stets befriedigt.",
      wochenziele: [
        "Kau-Objekt-Rotation läuft automatisch.",
        "{dogName} hat immer ein Lieblings-Kau-Objekt verfuegbar.",
        "Beissduerfnis ist befriedigt.",
      ],
      tagesplan: "Taeglich 1-2 Kau-Objekte verfuegbar, rotieren. Pro Woche 1 neues Objekt testen. Lange Kau-Sessions (15-30 Min) bewusst etablieren — Schlafvorbereitung.",
      no_gos: [
        "Rotation vergessen.",
        "Schlechte Qualitaet Kau-Objekte.",
        "Lange Sessions als 'verschwendet' sehen.",
      ],
      fortschritt: [
        "{dogName} hat Lieblings-Sortiment.",
        "Beissduerfnis ist abgedeckt.",
        "Zerstoerung an Moebeln reduziert sich.",
      ],
      exerciseIds: ["d-kauobjekte-etablieren", "d-management-zonen"],
    },
    {
      title: "Management langsam reduzieren",
      schwerpunkt: "Wenn 4 Wochen lang keine Zerstoerung passiert: Management vorsichtig reduzieren. Erst 1 Risiko-Zone, beobachten, dann nächste.",
      wochenziele: [
        "Eine Risiko-Zone wird wieder zugaenglich.",
        "{dogName} bewaehrt sich oder du justierst nach.",
        "Du erkennst, wo Management noetig bleibt.",
      ],
      tagesplan: "Tag 1-2: 1 zuvor gesperrte Zone wird wieder zugaenglich (nur in Anwesenheit). Beobachten. Tag 3-4: bei Erfolg 1-2 Stunden mit Zugang. Tag 5-7: bei Erfolg auch länger.",
      no_gos: [
        "Alle Risiko-Zonen sofort oeffnen.",
        "Bei Zerstoerung weitermachen.",
        "Management komplett aufgeben.",
      ],
      fortschritt: [
        "Sichere Zonen erweitern sich.",
        "{dogName} bewaehrt sich.",
        "Alltag wird flexibler.",
      ],
      exerciseIds: ["d-management-zonen", "d-kauobjekte-etablieren"],
    },
    {
      title: "Tausch-Routine perfektionieren",
      schwerpunkt: "Tausch-Geschaeft sitzt automatisch. {dogName} gibt verbotene Objekte freiwillig her. Du reagierst ruhig und entspannt.",
      wochenziele: [
        "Tausch klappt zu 90%+ zuverlässig.",
        "Du reagierst ruhig auf verbotene Objekte.",
        "Konflikt-Eskalationen sind eliminiert.",
      ],
      tagesplan: "Beim Bemerken eines verbotenen Objekts: ruhig nähern, AUS, Leckerli, Tausch. Kein Drama. Routine wird zur Reflex-Reaktion.",
      no_gos: [
        "Schimpfen aus Frust.",
        "Verbotenes Objekt zurueckgeben.",
        "Hand-ins-Maul greifen.",
      ],
      fortschritt: [
        "Tausch klappt reflexartig.",
        "Du wirst innerlich ruhig.",
        "Konflikte sind selten.",
      ],
      exerciseIds: ["d-tausch-statt-strafe", "d-kauobjekte-etablieren"],
    },
    // Vertiefungen
    {
      title: "Mentale Auslastung intensivieren",
      schwerpunkt: "Bei jungen Hunden mit Zahnwechsel: Kau-Sessions intensivieren. Bei Erwachsenen: mehr Kopfarbeit (Shape, Tricks, neue Aufgaben).",
      wochenziele: [
        "Mehrere intensive Kau-Sessions pro Tag.",
        "Neue Shape-Tricks werden gelernt.",
        "Mentale Auslastung ist hoch.",
      ],
      tagesplan: "Bei Welpen/Junghunden: lange Kau-Sessions mit Naturkauartikeln 2x taeglich. Bei Erwachsenen: 10 Min Frei-Form-Training mit neuem Trick pro Tag. Mentale Erschoepfung als Ziel.",
      no_gos: [
        "Kau-Sessions zu kurz machen.",
        "Frei-Form-Training in Stress-Phasen.",
        "Mentale Auslastung als 'optional'.",
      ],
      fortschritt: [
        "{dogName} ist mental ausgelastet.",
        "Zerstoerung reduziert sich weiter.",
        "Du erkennst müde Phasen.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-kauobjekte-etablieren"],
    },
    {
      title: "Stress-Faktoren reduzieren",
      schwerpunkt: "Zerstoerung kann Stress-Symptom sein. Identifiziere Stress-Faktoren und reduziere sie aktiv: zu wenig Schlaf, Reizüberflutung, unklare Routinen.",
      wochenziele: [
        "Stress-Faktoren sind identifiziert und reduziert.",
        "{dogName} hat genug Schlaf (16-20h).",
        "Reizüberflutung wird vermieden.",
      ],
      tagesplan: "Prüfe Tagesablauf: genug Schlaf? Berechenbare Routinen? Reizüberflutung an Wochenenden? Änderungen kuerzlich (Umzug, neuer Mitbewohner)? Aktiv reduzieren.",
      no_gos: [
        "Stress ignorieren.",
        "Hund staendig stimulieren.",
        "Veränderungen radikal einfuehren.",
      ],
      fortschritt: [
        "Stress-Level sinkt.",
        "Zerstoerung reduziert sich weiter.",
        "Du wirst aufmerksamer für Stress-Anzeichen.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-kauobjekte-etablieren"],
    },
    {
      title: "Allein-Zeit-Routine festigen",
      schwerpunkt: "Allein-Zeit-Kong-Routine wird langfristig etabliert. {dogName} verbindet Abwesenheit mit positivem Snack, nicht mit Zerstoerung.",
      wochenziele: [
        "Allein-Zeit-Routine ist stabil.",
        "Kong wird vor jeder Abwesenheit gegeben.",
        "Zerstoerung waehrend Abwesenheit ist eliminiert.",
      ],
      tagesplan: "Bei jeder Abwesenheit Kong. Variation des Inhalts. Eingefroren = schwerer. Geh ruhig, komm ruhig wieder. {dogName} bleibt waehrenddessen beschaeftigt.",
      no_gos: [
        "Kong vergessen — Allein-Zeit ohne Beschaeftigung.",
        "Inhalt immer gleich — wird langweilig.",
        "Drama bei Verabschiedung.",
      ],
      fortschritt: [
        "Allein-Zeit ist sicher.",
        "Kong-Routine ist robust.",
        "Du fühlst dich entspannter beim Gehen.",
      ],
      exerciseIds: ["d-allein-zeit-kong", "d-kauobjekte-etablieren"],
    },
    {
      title: "Festigung Steigerung",
      schwerpunkt: "Letzte Steigerungs-Woche. Auslastung sitzt, Kau-Routine etabliert, Management gelockert. Phase 3 = Langzeit-Wartung.",
      wochenziele: [
        "Alle Werkzeuge laufen fluessig.",
        "Zerstoerung ist deutlich reduziert.",
        "Du fühlst dich kompetent.",
      ],
      tagesplan: "Bilanz-Woche: was funktioniert super, was wackelt? Plane Phase 3: Wartungs-Routinen, Stress-Hygiene, weiterhin Auslastungs-Plan.",
      no_gos: [
        "Erfolge als selbstverstaendlich.",
        "Management ganz aufgeben.",
        "Auslastungs-Plan aufweichen.",
      ],
      fortschritt: [
        "Zerstoerung ist messbar reduziert.",
        "Du fühlst dich kompetent.",
        "Werkzeuge sitzen.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-kauobjekte-etablieren"],
    },
  ],
  generalisierung: [
    {
      title: "Langzeit-Auslastungsplan",
      schwerpunkt: "Auslastungs-Plan wird langfristig etabliert. Jeden Tag gemischte Auslastung, plus Wartungs-Tage mit Refresh.",
      wochenziele: [
        "Plan läuft langfristig.",
        "Wartungs-Tage sind eingeplant.",
        "{dogName} bleibt langfristig ausgeglichen.",
      ],
      tagesplan: "Pro Tag Standard-Auslastung (Bewegung + Nase + Kopf). 1x pro Woche 'Special-Tag' mit neuem Trick oder neuer Beschaeftigung. Schlaf-Hygiene konstant halten.",
      no_gos: [
        "Plan aufweichen.",
        "Special-Tage vergessen.",
        "Schlaf-Hygiene ignorieren.",
      ],
      fortschritt: [
        "Plan ist langfristig etabliert.",
        "{dogName} bleibt ausgeglichen.",
        "Du planst strukturiert.",
        "Vor jeder Abwesenheit gibt es einen gut gestopften Kong als positive Allein-Zeit-Verknüpfung.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-allein-zeit-kong"],
    },
    {
      title: "Kau-Objekt-Wartung",
      schwerpunkt: "Kau-Objekt-Sortiment wird gewartet: alte ersetzen, neue ausprobieren, Rotation halten. Beissduerfnis bleibt befriedigt.",
      wochenziele: [
        "Sortiment ist aktuell.",
        "{dogName} hat immer Lieblings-Optionen.",
        "Beissduerfnis bleibt abgedeckt.",
      ],
      tagesplan: "Prüfe woechentlich: welche Objekte werden noch gerne genutzt? Welche sind kaputt oder verbraucht? Ersetze. Probiere alle 4-6 Wochen 1 neues Objekt aus.",
      no_gos: [
        "Sortiment veralten lassen.",
        "Defekte Objekte weiter nutzen.",
        "Keine Variation einbauen.",
      ],
      fortschritt: [
        "Sortiment ist aktuell.",
        "Beissduerfnis bleibt abgedeckt.",
        "{dogName} hat immer was.",
      ],
      exerciseIds: ["d-kauobjekte-etablieren", "d-management-zonen"],
    },
    {
      title: "Management-Balance finden",
      schwerpunkt: "Langfristige Management-Balance: was muss zu bleiben, was kann offen sein? {dogName}s Verhalten zeigt es dir.",
      wochenziele: [
        "Du kennst die ideale Management-Balance.",
        "Sichere Zonen sind klar definiert.",
        "Risiko-Bereiche werden klug gehandhabt.",
      ],
      tagesplan: "Prüfe: welche Zonen sind dauerhaft offen ok? Welche brauchen Sperrung bei Abwesenheit? Welche sind generell off-limits? Schreibe es auf.",
      no_gos: [
        "Management ganz weglassen.",
        "Risiko-Bereiche unterschaetzen.",
        "Vergleichten mit anderen Hunden.",
      ],
      fortschritt: [
        "Du hast eine klare Management-Strategie.",
        "Risiko ist minimiert.",
        "Alltag läuft entspannt.",
      ],
      exerciseIds: ["d-management-zonen", "d-kauobjekte-etablieren"],
    },
    {
      title: "Schwierige Phasen meistern",
      schwerpunkt: "Hochstresszeiten (Weihnachten, Urlaub, neue Mitbewohner) sind Risiko für Zerstoerungs-Rueckfaelle. Diese Woche planst du für schwierige Phasen.",
      wochenziele: [
        "Du hast Strategien für schwierige Phasen.",
        "Risiko-Phasen sind vorgeplant.",
        "Du fühlst dich vorbereitet.",
      ],
      tagesplan: "Identifiziere kommende Stress-Phasen. Plane vor: mehr Management, mehr Auslastung, mehr Kau-Objekte. Bei Änderungen: graduell einfuehren.",
      no_gos: [
        "Schwierige Phasen ignorieren.",
        "Spontane Änderungen.",
        "Routine aufweichen unter Stress.",
      ],
      fortschritt: [
        "Schwierige Phasen werden gemeistert.",
        "Du planst vorausschauend.",
        "{dogName} bleibt stabil.",
      ],
      exerciseIds: ["d-management-zonen", "d-langeweile-auslasten"],
    },
    {
      title: "Sozial- und Allein-Balance",
      schwerpunkt: "Hunde mit Trennungsangst-bedingter Zerstoerung profitieren von ausreichend Sozial-Kontakten. Aber: Allein-Zeit muss auch geübt bleiben.",
      wochenziele: [
        "Sozial-Termine 2-3x pro Woche.",
        "Allein-Zeit-Routine bleibt etabliert.",
        "Balance zwischen sozial und allein ist gut.",
      ],
      tagesplan: "Pro Woche 2-3 Sozial-Termine (Hundefreund). Allein-Zeit-Routine bleibt: Kong vor Abwesenheit. Balance halten — nicht alles soziale Sein oder alles allein.",
      no_gos: [
        "Nur Sozial-Kontakt — Allein-Zeit-Routine verlernt.",
        "Nur Allein-Zeit — Trennungsangst eskaliert.",
        "Hochsozial-Phasen ohne Runterkommen.",
      ],
      fortschritt: [
        "Balance ist etabliert.",
        "{dogName} ist sozial und unabhaengig.",
        "Du planst strukturiert.",
      ],
      exerciseIds: ["d-allein-zeit-kong", "d-kauobjekte-etablieren"],
    },
    {
      title: "Tausch-Routine im Alltag festigen",
      schwerpunkt: "Tausch-Routine bleibt langfristig wichtig. Auch nach Monaten ohne Vorfall: aufmerksam bleiben, ruhig reagieren bei verbotenen Objekten.",
      wochenziele: [
        "Tausch bleibt reflexartig.",
        "Bei verbotenen Objekten reagierst du ruhig.",
        "Konflikt-Eskalationen sind eliminiert.",
      ],
      tagesplan: "Bei seltenen verbotenen-Objekt-Situationen: ruhig nähern, AUS, Leckerli, Tausch. Bleibe in der Routine, auch wenn {dogName} mostly brav ist.",
      no_gos: [
        "Bei seltenen Vorfaellen überreagieren.",
        "Tausch-Routine verlernen.",
        "Hand-ins-Maul greifen.",
      ],
      fortschritt: [
        "Tausch-Routine bleibt robust.",
        "Du wirst innerlich ruhig.",
        "Konflikte sind eliminiert.",
      ],
      exerciseIds: ["d-tausch-statt-strafe", "d-kauobjekte-etablieren"],
    },
    {
      title: "Notfall-Plan bei Rueckfaellen",
      schwerpunkt: "Falls Zerstoerung zurueckkommt: klare Notfall-Sequenz. Ursachen-Check, Management wieder enger, Auslastung erhoehen.",
      wochenziele: [
        "Du hast einen Notfall-Plan.",
        "Rueckfaelle werden frueh erkannt.",
        "Aufgefangen in 1-2 Wochen.",
      ],
      tagesplan: "Notfall-Plan: 1) Ursachen-Check (was hat sich geaendert?). 2) Management wieder enger. 3) Auslastung erhoehen. 4) Kau-Sortiment refreshen. 5) Stress-Faktoren reduzieren.",
      no_gos: [
        "Rueckfaelle ignorieren.",
        "In Panik geraten.",
        "Strafe als Reaktion.",
      ],
      fortschritt: [
        "Notfall-Plan sitzt.",
        "Rueckfaelle werden gemanagt.",
        "Du fühlst dich kompetent.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-management-zonen"],
    },
    {
      title: "Übergang in Wartungsmodus",
      schwerpunkt: "Letzte Woche. Zerstoerung ist stark reduziert, Routinen sitzen, Auslastung ist etabliert. Wartung für die kommenden Monate.",
      wochenziele: [
        "Alle Routinen laufen langfristig.",
        "Wartungs-Rhythmus ist klar.",
        "{dogName} ist langfristig ausgeglichen.",
      ],
      tagesplan: "Reduziere aktives Training auf Minimum. Auslastungs-Plan bleibt. Kau-Routine bleibt. Management bleibt situativ. Alle 4-6 Wochen Refresh.",
      no_gos: [
        "Alle Routinen schlagartig weglassen.",
        "Management ganz aufgeben.",
        "Auslastung schleifen lassen.",
      ],
      fortschritt: [
        "{dogName} bleibt langfristig stabil.",
        "Zerstoerung ist Ausnahme.",
        "Du fühlst dich kompetent.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-kauobjekte-etablieren"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// SOILING (Stubenunreinheit) — Routine + Belohnen am Platz
// ────────────────────────────────────────────────────────────────────
const SOILING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Toiletten-Routine etablieren",
      schwerpunkt: "Stubenreinheit baut sich über Routinen auf. {dogName} muss wissen: jetzt ist Toiletten-Zeit, hier ist der Ort. Berechenbarkeit beschleunigt Lernen massiv.",
      wochenziele: [
        "Mind. 5-7 Toilettenrunden pro Tag.",
        "Routine ist berechenbar.",
        "Du hast ein Toiletten-Tagebuch.",
      ],
      tagesplan: "Pro Tag mind. 5-7 Toilettenrunden: morgens, nach Mahlzeiten, nach Schlaf, abends, vor dem Schlafen. Bei jungen oder unreinen Hunden: alle 1-2 Stunden. Immer am selben Ort. Notiere wann was passiert.",
      no_gos: [
        "Routine inkonsistent halten.",
        "Bei Eile auslassen.",
        "Verschiedene Orte als Toilette.",
      ],
      fortschritt: [
        "Routine ist etabliert.",
        "Du kennst {dogName}s Muster.",
        "Erste Verbesserungen sind sichtbar.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    {
      title: "Belohnen am richtigen Platz",
      schwerpunkt: "Belohnung muss DIREKT am richtigen Platz und SOFORT nach dem Loslassen kommen. Timing ist alles — Verzoegerung von 5+ Sek bringt nichts.",
      wochenziele: [
        "Belohnung erfolgt zeitnah am Toiletten-Platz.",
        "{dogName} verknüpft Platz mit Belohnung.",
        "Du hast immer Leckerlis dabei.",
      ],
      tagesplan: "Bei jeder Toilettenrunde Leckerlis dabei. {dogName} lässt los: WAEHREND sie läuft leise FEIN. Sobald fertig: sofort Leckerli direkt am Platz. Lobwort plus Leckerli. Direkte Verknüpfung.",
      no_gos: [
        "Erst zuhause belohnen — zu spät.",
        "Trockenfutter — zu niedrig wertig.",
        "Belohnung ohne FEIN-Marker.",
      ],
      fortschritt: [
        "{dogName} sucht aktiv den Toiletten-Platz.",
        "Verknüpfung Platz-Belohnung steht.",
        "Du hast immer Leckerlis dabei.",
      ],
      exerciseIds: ["s-belohnen-am-platz", "s-trigger-lesen"],
    },
    {
      title: "Auslöser-Lesen lernen",
      schwerpunkt: "Wenn du Toilettendrang FRUEH erkennst, kannst du rechtzeitig rausgehen. Schnüffeln am Boden, im Kreis drehen, plötzlich unruhig werden — das sind die Auslöser.",
      wochenziele: [
        "Du erkennst {dogName}s Auslöser-Anzeichen.",
        "Reaktionszeit ist unter 30 Sek.",
        "Unfaelle in der Wohnung reduzieren sich.",
      ],
      tagesplan: "Beobachte aktiv: am Boden schnüffeln, im Kreis drehen, plötzlich aufstehen, zur Tür schauen. Sobald du eines siehst: SOFORT rausgehen, KEIN Verzoegern. An gewohnten Platz fuehren.",
      no_gos: [
        "Auslöser-Anzeichen ignorieren.",
        "Erst Schuhe anziehen mit langer Verzoegerung.",
        "{dogName} 'später rausnehmen'.",
      ],
      fortschritt: [
        "Du erkennst Auslöser sicher.",
        "Reaktionszeit ist kurz.",
        "Unfaelle werden seltener.",
      ],
      exerciseIds: ["s-trigger-lesen", "s-toiletten-routine"],
    },
    {
      title: "Unfaelle managen ohne Strafe",
      schwerpunkt: "Unfaelle gehoeren zum Lernprozess. Wer schimpft, macht alles schlimmer — {dogName} versteckt sich beim nächsten Mal. Sauber Reinigen + Enzym-Reiniger + Geduld.",
      wochenziele: [
        "Bei Unfaellen reagierst du ruhig.",
        "Enzym-Reiniger ist verfuegbar.",
        "{dogName} entwickelt kein Versteckverhalten.",
      ],
      tagesplan: "Bei Unfall: ruhig saubermachen mit Enzym-Reiniger (Tierhandlung). KEIN Schimpfen, KEIN Nase-rein-druecken. Bringe {dogName} raus, vielleicht kommt noch was. Notiere den Vorfall: wann, was?",
      no_gos: [
        "Schimpfen oder Strafe — kontraproduktiv.",
        "Normaler Reiniger ohne Enzym — Geruch bleibt für Hund.",
        "Hund stehen lassen waehrend du sauber machst — verstärkt Stress.",
      ],
      fortschritt: [
        "Du reagierst ruhig.",
        "Reinigung ist gruendlich.",
        "{dogName} versteckt sich nicht.",
      ],
      exerciseIds: ["s-unfaelle-managen", "s-belohnen-am-platz"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Toilettenrunden engmaschiger",
      schwerpunkt: "Falls Unfaelle häufig: Toilettenrunden engmaschiger. Bei jungen Hunden alle 1-2h, bei aelteren unreinen alle 2-3h. Praevention statt Reaktion.",
      wochenziele: [
        "Toilettenrunden in passender Frequenz.",
        "Unfaelle reduzieren sich messbar.",
        "Du erkennst die optimale Frequenz.",
      ],
      tagesplan: "Bei jungen Welpen (8-16 Wochen): alle 1-2h raus. Bei aelteren unreinen: alle 2-3h. Reduziere Frequenz über Wochen, wenn keine Unfaelle. Bei Unfall: wieder enger.",
      no_gos: [
        "Frequenz zu schnell reduzieren.",
        "Bei Eile Runden auslassen.",
        "Erwarten dass es 'einfach klappt'.",
      ],
      fortschritt: [
        "Optimale Frequenz ist gefunden.",
        "Unfaelle werden selten.",
        "{dogName} entwickelt Blase.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    {
      title: "Stress-Reduktion bei stress-bedingtem Soiling",
      schwerpunkt: "Manche Hunde machen unter Stress in die Wohnung — Gewitter, neue Menschen, Veränderungen. Loesung: Stress aktiv reduzieren.",
      wochenziele: [
        "Stress-Auslöser sind identifiziert.",
        "Stress wird aktiv reduziert.",
        "Stress-Soiling reduziert sich.",
      ],
      tagesplan: "Identifiziere: was stresst {dogName}? Gewitter? Neue Menschen? Änderungen? Reduziere aktiv. Vor erwartetem Stress: extra Toilettenrunde. Bei Stress: ruhig bleiben.",
      no_gos: [
        "Stress ignorieren.",
        "Stress-Soiling als Verhalten 'bekaempfen' — es ist Symptom.",
        "Bei stress-bedingtem Soiling Tierarzt-Check vergessen.",
      ],
      fortschritt: [
        "Stress-Faktoren reduziert.",
        "{dogName} ist ruhiger.",
        "Stress-Soiling reduziert sich.",
      ],
      exerciseIds: ["s-stress-reduktion", "s-toiletten-routine"],
    },
    {
      title: "Naechtliche Stubenreinheit aufbauen",
      schwerpunkt: "Welpen und unreine Hunde brauchen oft eine naechtliche Toilettenrunde. Diese Woche baust du die naechtliche Routine auf.",
      wochenziele: [
        "Naechtliche Routine ist etabliert.",
        "Naechtliche Unfaelle reduzieren sich.",
        "Blase wird langsam staerker.",
      ],
      tagesplan: "Letzte Toilettenrunde direkt vor dem Schlafen. Bei jungen Welpen (8-16 Wochen): einmal nachts raus. Bei aelteren unreinen Hunden: zunächst alle 4-5h, dann reduzieren. Naechtliche Runde: ruhig, kein Spiel.",
      no_gos: [
        "Naechtliche Routine vergessen.",
        "Bei Unfall nachts schimpfen.",
        "Zu lange Phasen erwarten.",
      ],
      fortschritt: [
        "Naechtliche Routine ist eingespielt.",
        "Blase wird staerker.",
        "Naechtliche Unfaelle reduzieren sich.",
      ],
      exerciseIds: ["s-naechtliche-blase", "s-toiletten-routine"],
    },
    {
      title: "Fundament-Check",
      schwerpunkt: "Letzte Fundament-Woche. Routine, Belohnung, Auslöser-Lesen, Unfall-Management — alle Bausteine. Phase 2 = mehr Generalisierung und Festigung.",
      wochenziele: [
        "Alle Bausteine sitzen.",
        "Unfaelle sind deutlich reduziert.",
        "Du fühlst dich kompetent.",
      ],
      tagesplan: "Bilanz: was funktioniert super, was wackelt? Falls Schwaeche: 1 Extra-Woche. Bei haufigen Unfaellen: Tierarzt-Check (Blasenentzuendung etc. ausschließen).",
      no_gos: [
        "Aus Ungeduld zu schnell weitergehen.",
        "Medizinische Ursachen ignorieren.",
        "Routine aufweichen.",
      ],
      fortschritt: [
        "Du fühlst dich kompetent.",
        "Routine sitzt.",
        "Unfaelle sind seltener.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
  ],
  steigerung: [
    {
      title: "Frequenz reduzieren bei Erfolg",
      schwerpunkt: "Wenn Unfaelle seltener werden, reduzierst du langsam die Toiletten-Frequenz. {dogName} entwickelt Blase und Kontrolle.",
      wochenziele: [
        "Toiletten-Frequenz wird langsam reduziert.",
        "{dogName} entwickelt Blase und Kontrolle.",
        "Du hast eine nachhaltige Routine.",
      ],
      tagesplan: "Tag 1-3: 1 Toilettenrunde pro Tag weglassen (z.B. die überzaehlige am Vormittag). Tag 4-7: bei Erfolg eine weitere weglassen. Bei Unfall: zurueck zur engeren Frequenz.",
      no_gos: [
        "Mehrere Toilettenrunden gleichzeitig weglassen.",
        "Bei Unfall durchziehen.",
        "Erwarten dass Reduktion sofort klappt.",
      ],
      fortschritt: [
        "Frequenz wird reduziert.",
        "Blase wird staerker.",
        "Alltag wird flexibler.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    {
      title: "Auslöser-Lesen perfektionieren",
      schwerpunkt: "Auslöser-Lesen wird zur Reflex-Reaktion. Du erkennst auch subtile Anzeichen sicher. Reaktionszeit ist unter 10 Sek.",
      wochenziele: [
        "Auslöser-Lesen ist reflexartig.",
        "Reaktionszeit ist sehr kurz.",
        "Unfaelle werden vermieden.",
      ],
      tagesplan: "Aktive Beobachtung waehrend {dogName} wach ist. Auch subtile Anzeichen erkennen: kurz unruhig werden, kurz schnüffeln, kurz wegschauen. Sofort handeln.",
      no_gos: [
        "Auslöser-Anzeichen unterschaetzen.",
        "Bei Eile Anzeichen ignorieren.",
        "{dogName} nicht im Blick haben.",
      ],
      fortschritt: [
        "Auslöser-Lesen ist reflexartig.",
        "Unfaelle werden eliminiert.",
        "Du bist aufmerksam.",
      ],
      exerciseIds: ["s-trigger-lesen", "s-toiletten-routine"],
    },
    {
      title: "Belohnung schrittweise reduzieren",
      schwerpunkt: "Wenn Stubenreinheit sitzt, kannst du Belohnung langsam reduzieren. Aber: NIEMALS komplett weglassen. Variable Verstaerkung haelt Verhalten stabil.",
      wochenziele: [
        "Belohnungs-Frequenz wird auf ~60% reduziert.",
        "{dogName} bleibt zuverlässig.",
        "Spitzenleistungen werden weiter mit Jackpot belohnt.",
      ],
      tagesplan: "Bei normalen Toilettenrunden: nicht jedes Mal Leckerli. Bei besonderen Erfolgen (an neuem Ort, nach langer Zeit): Jackpot. {dogName} merkt: das System bleibt, aber unvorhersehbar.",
      no_gos: [
        "Belohnung komplett streichhen.",
        "Reduktion bei häufigen Unfaellen.",
        "Variabilität aufweichen.",
      ],
      fortschritt: [
        "{dogName} bleibt zuverlässig.",
        "Du steckst weniger Leckerlis ein.",
        "Variable Verstaerkung sitzt.",
      ],
      exerciseIds: ["s-belohnen-am-platz", "s-trigger-lesen"],
    },
    {
      title: "Verschiedene Strecken generalisieren",
      schwerpunkt: "Bisher war Toilette an einem Ort. Diese Woche generalisierst du: auch an anderen Orten darf erledigt werden. Bei Erfolg: belohnen.",
      wochenziele: [
        "{dogName} erledigt auch an neuen Orten.",
        "Generalisierung der Stubenreinheit.",
        "Du bist flexibler im Alltag.",
      ],
      tagesplan: "Spaziergaenge an neuen Strecken. Wenn {dogName} an einem neuen Ort erledigt: SUPER-Belohnung. Generalisierung ist der echte Lerneffekt.",
      no_gos: [
        "Nur an einem Ort als Toilette akzeptieren.",
        "Erwarten dass es überall klappt sofort.",
        "Bei Stress an neuem Ort weitermachen.",
      ],
      fortschritt: [
        "{dogName} erledigt auch an neuen Orten.",
        "Du bist flexibler.",
        "Generalisierung sitzt.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    // Vertiefungen
    {
      title: "Stress-Toleranz aufbauen",
      schwerpunkt: "Bei stress-bedingtem Soiling: Stress-Toleranz aktiv aufbauen. Mini-Stress-Situationen üben, {dogName} bleibt ruhig.",
      wochenziele: [
        "{dogName} bewältigt Mini-Stress-Situationen ohne Soiling.",
        "Stress-Toleranz waechst.",
        "Du erkennst die Schwellenwerte.",
      ],
      tagesplan: "Plane Mini-Stress-Situationen: kurzer Besuch, neues Geräusch, kurze Veränderung. {dogName} bleibt waehrenddessen ruhig (Decke + Kong). Belohnung für Ruhe.",
      no_gos: [
        "Stress-Toleranz erzwingen — Eskalation.",
        "Zu starke Stressoren am Anfang.",
        "Bei Stress nichts tun.",
      ],
      fortschritt: [
        "Stress-Toleranz waechst.",
        "Stress-Soiling reduziert sich.",
        "Du fühlst dich vorbereitet.",
      ],
      exerciseIds: ["s-stress-reduktion", "s-toiletten-routine"],
    },
    {
      title: "Naechtliche Schlafzeit verlängern",
      schwerpunkt: "Naechtliche Toilettenrunden werden langsam reduziert. Bei jungen Hunden: erst 1x nachts, dann durchschlafen. Bei aelteren unreinen: 4h, dann 6h, dann 8h.",
      wochenziele: [
        "Naechtliche Schlafzeit waechst.",
        "Naechtliche Unfaelle reduzieren sich auf 0.",
        "Blase wird langfristig staerker.",
      ],
      tagesplan: "Verlängere die naechtliche Phase um 30 Min pro Woche. Bei Unfall: zurueck zur kuerzeren Phase. Letzte Toilettenrunde abends so spät wie möglich. Morgens so frueh wie noetig.",
      no_gos: [
        "Zu schnell verlängern.",
        "Bei Unfall durchziehen.",
        "Späte Mahlzeiten — fuelle Blase.",
      ],
      fortschritt: [
        "Naechtliche Schlafzeit waechst.",
        "Blase wird staerker.",
        "Du schlaefst besser.",
      ],
      exerciseIds: ["s-naechtliche-blase", "s-toiletten-routine"],
    },
    {
      title: "Unfaelle managen routiniert",
      schwerpunkt: "Bei seltenen Unfaellen reagierst du routiniert. Ruhig, Enzym-Reiniger, ohne Drama. Notieren was passiert ist.",
      wochenziele: [
        "Bei Unfaellen reagierst du reflexartig ruhig.",
        "Enzym-Reiniger ist immer parat.",
        "Du fuehrst weiter Tagebuch.",
      ],
      tagesplan: "Bei seltenem Unfall: ruhig handhaben. Enzym-Reiniger nutzen. Notiere im Tagebuch: wann, was, vorheriger Toilettengang? Patterns frueh erkennen.",
      no_gos: [
        "Bei Unfall schimpfen oder Strafe.",
        "Normaler Reiniger nutzen.",
        "Tagebuch vergessen.",
      ],
      fortschritt: [
        "Du reagierst routiniert.",
        "Patterns werden erkannt.",
        "{dogName} entwickelt kein Stressverhalten.",
      ],
      exerciseIds: ["s-unfaelle-managen", "s-belohnen-am-platz"],
    },
    {
      title: "Festigung Steigerung",
      schwerpunkt: "Letzte Steigerungs-Woche. Routine sitzt, Frequenz ist optimal, Generalisierung klappt. Phase 3 = Langzeit-Stabilitaet.",
      wochenziele: [
        "Alle Werkzeuge sitzen fluessig.",
        "Unfaelle sind sehr selten.",
        "Du fühlst dich kompetent.",
      ],
      tagesplan: "Bilanz: was funktioniert super, was wackelt noch? Plane Phase 3 mit Langzeit-Routine und Wartung.",
      no_gos: [
        "Routine aufweichen.",
        "Beobachten aufhoeren.",
        "Erfolge als selbstverstaendlich.",
      ],
      fortschritt: [
        "Werkzeuge sitzen.",
        "{dogName} ist stubenrein.",
        "Du fühlst dich kompetent.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-trigger-lesen"],
    },
  ],
  generalisierung: [
    {
      title: "Langfristige Routine",
      schwerpunkt: "Routine wird langfristig etabliert. Pro Tag 3-4 Toilettenrunden in regelmaessigen Abstaenden. Auch im Alter haelt das die Stubenreinheit.",
      wochenziele: [
        "Routine ist langfristig stabil.",
        "{dogName} hat berechenbare Zeiten.",
        "Stubenreinheit ist selbstverstaendlich.",
      ],
      tagesplan: "Pro Tag 3-4 feste Toilettenrunden: morgens, mittags, nachmittags, abends. Vor dem Schlafen ist optional je nach Hund. Routine wird zur Normalitaet.",
      no_gos: [
        "Routine inkonsistent halten.",
        "Bei Eile auslassen.",
        "Erwarten dass es 'einfach klappt'.",
      ],
      fortschritt: [
        "Routine ist Standard.",
        "{dogName} bleibt stubenrein.",
        "Du planst entspannt.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    {
      title: "Neue Umgebungen meistern",
      schwerpunkt: "Bei Urlaub, Besuch, Umzug: stubenreiner Hund muss auch in neuen Umgebungen klar kommen. Diese Woche generalisierst du weiter.",
      wochenziele: [
        "{dogName} bleibt stubenrein auch in neuen Umgebungen.",
        "Erste Toilettenrunde an neuem Ort wird belohnt.",
        "Du planst Urlaubs-Situationen vor.",
      ],
      tagesplan: "Bei neuen Umgebungen: engmaschige Toilettenrunden in den ersten Tagen, plus aktives Beobachten. Erste Erledigung an neuem Ort: SUPER-Belohnung. Generalisierung sitzt mit der Zeit.",
      no_gos: [
        "Erwarten dass es sofort klappt.",
        "Bei Stress in neuer Umgebung nicht handeln.",
        "Routine in neuer Umgebung schleifen lassen.",
      ],
      fortschritt: [
        "{dogName} bleibt auch im Urlaub stubenrein.",
        "Du planst Reisen entspannter.",
        "Generalisierung ist langfristig.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    {
      title: "Alters-Anpassung",
      schwerpunkt: "Mit dem Alter braucht {dogName} eventuell wieder oeftere Toilettenrunden. Beobachte Veränderungen, passe Routine an.",
      wochenziele: [
        "Du erkennst altersbedingte Veränderungen.",
        "Routine wird angepasst bei Bedarf.",
        "Senior bleibt stubenrein.",
      ],
      tagesplan: "Beobachte: braucht {dogName} oeftere Runden? Blasenkapazitaet veraendert? Tierarzt-Check bei deutlichen Veränderungen. Routine flexibel anpassen.",
      no_gos: [
        "Alterungs-Veränderungen ignorieren.",
        "Bei aelterem Hund alte Frequenz erwarten.",
        "Tierarzt-Check vergessen.",
      ],
      fortschritt: [
        "Anpassungen sind etabliert.",
        "Senior bleibt stubenrein.",
        "Du planst flexibel.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    {
      title: "Stress-Soiling-Rueckfall managen",
      schwerpunkt: "Falls Stress-Soiling zurueckkommt (Umzug, neue Mitbewohner, Lebensveränderungen): Stress aktiv reduzieren, Routine engmaschiger.",
      wochenziele: [
        "Du erkennst Stress-Rueckfall-Anzeichen.",
        "Stress wird aktiv reduziert.",
        "Routine wird angepasst.",
      ],
      tagesplan: "Bei Stress-Symptomen: Frequenz wieder enger, Stress-Faktoren reduzieren, Decke als Anker nutzen. Bei staerkerem Stress: Tierarzt-Check ausschließen Medizinisches.",
      no_gos: [
        "Stress-Rueckfall als Verhaltensproblem behandeln.",
        "Schimpfen bei stress-bedingten Unfaellen.",
        "Tierarzt-Check vergessen.",
      ],
      fortschritt: [
        "Stress-Rueckfall wird gemanagt.",
        "Routine ist robust.",
        "Du erkennst Anzeichen frueh.",
      ],
      exerciseIds: ["s-stress-reduktion", "s-toiletten-routine"],
    },
    {
      title: "Belohnungs-Reduktion stabilisieren",
      schwerpunkt: "Belohnung wird langfristig variabel. {dogName} bleibt stubenrein, auch ohne staendige Leckerli. Aber: gelegentlich Jackpot belohnen.",
      wochenziele: [
        "Belohnungs-Frequenz ist auf ~30% stabilisiert.",
        "{dogName} bleibt zuverlässig.",
        "Spitzenleistungen werden belohnt.",
      ],
      tagesplan: "Bei normalen Runden: gelegentlich Leckerli, gelegentlich nicht. Bei besonderen Situationen (neue Umgebung, lange Zeit): immer Jackpot. Variable Verstaerkung.",
      no_gos: [
        "Belohnung komplett streichhen.",
        "Bei besonderen Situationen knausern.",
        "Variabilität aufweichen.",
      ],
      fortschritt: [
        "Variable Verstaerkung sitzt.",
        "{dogName} bleibt zuverlässig.",
        "Du planst entspannt.",
      ],
      exerciseIds: ["s-belohnen-am-platz", "s-trigger-lesen"],
    },
    {
      title: "Notfall-Plan bei Rueckfaellen",
      schwerpunkt: "Falls Stubenreinheit plötzlich nachlässt: Notfall-Plan. Tierarzt-Check, Routine enger, Stress-Faktoren prüfen.",
      wochenziele: [
        "Du hast einen Notfall-Plan.",
        "Rueckschritte werden frueh erkannt.",
        "Aufgefangen in 1-2 Wochen.",
      ],
      tagesplan: "Notfall-Plan: 1) Tierarzt-Check (Blasenentzuendung etc.). 2) Routine enger machen. 3) Stress-Faktoren prüfen. 4) Belohnungs-Dichte wieder hoch. 5) Tagebuch fuehren um Patterns zu finden.",
      no_gos: [
        "Rueckschritte ignorieren.",
        "Medizinische Ursachen vergessen.",
        "Schimpfen aus Frust.",
      ],
      fortschritt: [
        "Notfall-Plan sitzt.",
        "Rueckschritte werden gemanagt.",
        "Du fühlst dich kompetent.",
      ],
      exerciseIds: ["s-unfaelle-managen", "s-stress-reduktion"],
    },
    {
      title: "Lebenslange Stress-Hygiene",
      schwerpunkt: "Stubenreinheit haengt langfristig auch von Stress ab. Gute Stress-Hygiene = stabile Stubenreinheit. Schlaf, Routine, Auslastung.",
      wochenziele: [
        "Stress-Hygiene ist Routine.",
        "{dogName} ist langfristig ausgeglichen.",
        "Stubenreinheit bleibt stabil.",
      ],
      tagesplan: "Prüfe regelmaessig: Schlaf? Routine? Auslastung? Soziale Kontakte? Bei Stress an anderer Stelle: aktiv reduzieren, bevor Stubenreinheit leidet.",
      no_gos: [
        "Stress an anderer Stelle ignorieren.",
        "Routine schleifen lassen.",
        "Auslastung vernachlässigen.",
      ],
      fortschritt: [
        "Stress-Hygiene ist etabliert.",
        "{dogName} bleibt ausgeglichen.",
        "Stubenreinheit ist stabil.",
      ],
      exerciseIds: ["s-stress-reduktion", "s-toiletten-routine"],
    },
    {
      title: "Übergang in Wartungsmodus",
      schwerpunkt: "Letzte Woche. Stubenreinheit ist stabil, Routine sitzt, Generalisierung sitzt. Wartung für die nächsten Jahre.",
      wochenziele: [
        "Alle Routinen laufen langfristig.",
        "Wartungs-Rhythmus ist klar.",
        "{dogName} bleibt stubenrein.",
      ],
      tagesplan: "Reduziere aktives Training auf Minimum. Routine bleibt: 3-4 Toilettenrunden pro Tag. Tagebuch bei Rueckfaellen wieder fuehren. Bei Veränderungen: vorsichtig anpassen.",
      no_gos: [
        "Alle Routinen schlagartig weglassen.",
        "Bei Rueckfall in Panik.",
        "Beobachten aufhoeren.",
      ],
      fortschritt: [
        "{dogName} ist langfristig stubenrein.",
        "Du fühlst dich kompetent.",
        "Unfaelle sind Ausnahme.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
  ],
};

// ── Phasen-Verteilung für 1/3/6-Monats-Plan ────────────────────────
function phaseRanges(weeksTotal: number) {
  const fundamentEnd = Math.ceil(weeksTotal / 3);
  const steigerungEnd = Math.ceil((weeksTotal * 2) / 3);
  return {
    fundament: { start: 1, end: fundamentEnd },
    steigerung: { start: fundamentEnd + 1, end: steigerungEnd },
    generalisierung: { start: steigerungEnd + 1, end: weeksTotal },
  };
}

function phaseForWeek(weekNum: number, weeksTotal: number): Phase {
  const ranges = phaseRanges(weeksTotal);
  if (weekNum <= ranges.fundament.end) return "fundament";
  if (weekNum <= ranges.steigerung.end) return "steigerung";
  return "generalisierung";
}

// ── Monats-Übersichten: problem-spezifisch, kein generischer Ziehen-Text ──
// Jede Phase pro Problem hat eigene Bausteine, eigene Stolperfallen, eigene
// "was du jetzt schon merken solltest" Punkte. Keine Anglizismen.

interface PhaseDaten {
  bausteine: string;       // kurze Liste der in dieser Phase aufgebauten Bausteine
  schon_merken: string;    // konkret: was sollte beobachtbar sein
  jetzt_anpassen: string;  // wie nachjustieren
  stolperfallen: string;   // häufige Fehler in dieser Phase
  vermeidet: string;       // was jetzt nicht tun
}

const PHASE_TEXTE: Record<ProblemKey, Record<Phase, PhaseDaten>> = {
  pulling: {
    fundament: {
      bausteine: "Markerwort FEIN und SCHAU-Signal, Sei-ein-Baum-Mechanik drinnen, Bei-Fuss-Position als Belohnungs-Goldzone, ruhige Tür-Routine und die Entspannungsdecke als Anker",
      schon_merken: "{dogName} reagiert in der Wohnung in unter 2 Sekunden auf SCHAU. Bei einer straffen Leine drinnen dreht {dogName} sich nach 5-10 Sekunden zu dir um, die Stopps pro Session sinken von 20+ auf unter 10. Die Tür wird ohne Drängeln geoeffnet, du steckst Hosentaschen-Hand weniger oft ein als zu Plan-Start. {dogName} hat die Decke als ruhigen Ort erkannt.",
      jetzt_anpassen: "Wenn Sei-ein-Baum drinnen noch nicht ohne deine Hilfe klappt, haenge eine Woche dran und ueb gezielt mit niedrigerer Reiz-Lage. Wenn dagegen schon der Garten oder Hausflur entspannt klappt, kannst du in Phase 2 mutiger werden. Notier dir, welcher der vier Bausteine am schwaechsten sitzt, das wird der Schwerpunkt in Phase 2.",
      stolperfallen: "Viele wollen aus Ungeduld schon in Woche 4 echte Außen-Reize einbauen. Das zerstört das Fundament. Auch klassisch: Belohnung vor dem Koerper statt an der Bein-Naht geben, damit lockst du {dogName} nach vorne und foerderst Ziehen. Halt die Belohnung konsequent neben deinem Knie.",
      vermeidet: "Schon volle Alltags-Spaziergaenge mit der Erwartung dass es funktioniert. Phase 1 ist drinnen-Arbeit. Phase 2 macht den Übergang."
    },
    steigerung: {
      bausteine: "Sei-ein-Baum draußen mit echten Reizen, Gegenrichtung als Konsequenz bei hartnaeckigem Ziehen, Bei-Fuss-Belohnen im echten Alltag, Tempo- und Richtungswechsel als Aufmerksamkeits-Werkzeug",
      schon_merken: "{dogName} bleibt bei einem ersten echten Spaziergang nach ein paar Stopps stehen wenn die Leine straff wird, statt durchzuziehen. Du brauchst die Gegenrichtung-Konsequenz seltener als in der ersten Woche dieser Phase. Stopps pro Spaziergang sind im einstelligen Bereich, und {dogName} sucht von selbst die Bein-Position an Kreuzungen oder unsicheren Stellen.",
      jetzt_anpassen: "Wenn {dogName} draußen noch viele Stopps hat, geh zurueck auf eine ruhigere Strecke und arbeite dort sauber. Distanz und Reiz-Lage sind dein Stellrad, nicht Druck oder lautere Stimme. Wenn dagegen schon ruhige Strecken sehr gut laufen: vorsichtig in dichtere Bereiche, aber immer mit Sei-ein-Baum als Anker.",
      stolperfallen: "Die Belohnungs-Dichte zu schnell reduzieren weil es gerade so gut läuft. Phase 2 ist Investitions-Phase, jede gute Leinen-Phase wird belohnt. Auch verbreitet: bei Stress eines Tages weitermachen, statt eine ruhigere Strecke zu waehlen.",
      vermeidet: "In Stress-Lage durchziehen mit dem Gedanken 'wir sind doch fast da'. Plateaus sind normal. Wer jetzt sauber arbeitet, hat in Phase 3 die deutlichsten Spruenge."
    },
    generalisierung: {
      bausteine: "Lockere Leine im echten Alltagsspaziergang, verschiedene Strecken bewältigen, Schnüffel-Pausen als Belohnung für ruhige Phasen, schrittweise Belohnungs-Reduktion",
      schon_merken: "{dogName} bewältigt einen 20-30 Minuten Alltagsspaziergang mit weniger als 5 echten Zieh-Episoden. Du nutzt Werkzeuge wie Sei-ein-Baum und Bei-Fuss-Belohnen ohne darüber nachzudenken. Auch auf einer neuen Strecke bleibt {dogName} überwiegend ruhig. Schnüffel-Pausen sind aktive Belohnung statt 'Stör-Moment' wie frueher.",
      jetzt_anpassen: "Reduziere die Belohnungs-Frequenz weiter, aber niemals komplett. Bei Spitzenleistungen weiterhin großzuegig belohnen. Wenn {dogName} ohne Belohnung deutlich nachlässt: einen Schritt zurueck zur hoeheren Dichte. Plane einen Wartungs-Rhythmus: alle 3-4 Monate ein bewusster Übungs-Spaziergang an einem schwierigen Ort.",
      stolperfallen: "Komplette Belohnungs-Streichung. Verstaerkung bleibt wichtig, nur Frequenz und Vorhersehbarkeit ändern sich. Auch klassisch: Erfolge als selbstverstaendlich nehmen und nicht mehr beobachten. Kleine Rueckfaelle gibt es, frueh bemerkt sind sie schnell behoben.",
      vermeidet: "Den Plan komplett ablegen und denken 'das ist jetzt für immer gefestigt'. Die guten Routinen bleiben nur wenn du sie weiter pflegst."
    }
  },
  energy: {
    fundament: {
      bausteine: "Schlaf- und Tagesrhythmus-Inventur, Futter als Beschaeftigung statt Schuessel-Fressen, WARTE-Signal als Frust-Toleranz, der Entspannungs-Marker (z.B. WUNDERBAR)",
      schon_merken: "{dogName} arbeitet 20-30 Minuten am Suchspiel oder Kong statt 30 Sekunden zu schlingen. Nach diesen Beschaeftigungen kommt {dogName} ruhig zur Ruhe statt weiter aufgedreht zu sein. WARTE vor dem Futternapf klappt mit 5-10 Sekunden ohne Frust-Bellen. Der Entspannungs-Marker wird beobachtbar mit ruhigen Phasen verknüpft.",
      jetzt_anpassen: "Wenn {dogName} abends weiter aufgedreht ist, prüf den Schlaf: erwachsene Hunde brauchen 16-20 Stunden Ruhe pro Tag. Viele hyperaktive Hunde schlafen zu wenig. Wenn das Suchspiel zu schnell vorbei ist, mach es schwerer (hoehere Verstecke, Kong einfrieren). Wenn WARTE noch wackelt: Wartezeit nochmal verkuerzen.",
      stolperfallen: "Mehr Action liefern weil {dogName} so aufgedreht ist. Das ist genau der Fehler. Übererregung braucht weniger Reize, nicht mehr. Auch klassisch: Kopfarbeit als 'optional' sehen. Suchspiel und Kong ersetzen Tobereien nicht, sie sind die wichtigere Auslastung.",
      vermeidet: "Stundenlange Tobereien oder lange Hunde-Begegnungen. Beides verstärkt Übererregung. Phase 1 ist Innen-Beruhigung-Aufbau."
    },
    steigerung: {
      bausteine: "Nasenarbeit draußen (Spur folgen, gestaffeltes Suchen), strukturierte Spaziergaenge mit Such-Aufgaben, Stopp-Spiel als Aufregung-Schalter, Runterkommen-Routine auf der Decke nach jeder Aufregung",
      schon_merken: "{dogName} folgt einer 20m Futter-Spur konzentriert und ist danach sichtbar müde. Beim Stopp-Spiel kommt {dogName} innerhalb von 3 Sekunden zur Ruhe. Nach Spaziergaengen findet {dogName} dank der Runterkommen-Routine schneller in Ruhe als zu Plan-Start. Die Konzentrations-Spanne waechst erkennbar.",
      jetzt_anpassen: "Wenn {dogName} nach Nasenarbeit noch hochfaehrt, mach die Such-Aufgaben schwerer (komplexer, mehr Verstecke) statt länger. Mehr Schwierigkeit ermüdet mehr als längere stumpfe Bewegung. Wenn das Runterkommen nicht greift: vor jeder Sitzung 10 Minuten ruhige Vorbereitung einbauen.",
      stolperfallen: "Mehrere aufregende Aktivitäten am selben Tag stapeln. Park am Vormittag, Tobereien nachmittags, Besuch abends - das ist Reizflut, nicht Auslastung. Auch verbreitet: das Runterkommen weglassen weil 'der Hund schlaeft ja schon'. Aktive Erholung ist Teil der Routine.",
      vermeidet: "Stundenlange Tobereien mit anderen Hunden. Übererregung wird damit verstärkt, nicht abgebaut."
    },
    generalisierung: {
      bausteine: "Auslastungs-Wochenplan mit klarer Mischung aus Bewegung, Nase, Kopf und Sozial-Kontakt, Ruhe als Default-Modus im Alltag, eine klare Anti-Übererregung-Routine für schwere Tage",
      schon_merken: "{dogName} ist mindestens 60% des Tages in Ruhe-Phase. Du musst nicht mehr staendig für Beschaeftigung sorgen, {dogName} entspannt sich auch von selbst. Bei aufkommendem Übererregung hilft dir die 3-Schritt-Routine zuverlässig. Spaziergaenge sind nicht mehr Pflicht, sondern echte Bereicherung.",
      jetzt_anpassen: "Prüf regelmaessig deinen Wochenplan: bekommt {dogName} taeglich Bewegung plus Nase plus Kopf? Falls eine Saeule fehlt, das ist meist die Quelle erneuter Unruhe. Bei Stress-Phasen (Umzug, Besuch, Änderungen) den Plan engmaschiger machen.",
      stolperfallen: "Den Plan ablegen weil 'jetzt läuft es ja'. Übererregung kann sehr schnell zurueckkommen sobald die Struktur weg ist. Auch klassisch: Ruhe-Phasen mit Streicheln oder Ansprechen unterbrechen. Lass {dogName} schlafen.",
      vermeidet: "Schlaf-Hygiene aufzuweichen. 16-20 Stunden Ruhe sind nicht verhandelbar, auch bei jungen Hunden."
    }
  },
  aggression: {
    fundament: {
      bausteine: "Schwellenwert-Karte für alle Auslöser-Typen, Markerwort SCHAU und Belohnungs-Kommunikation, Maulkorb positiv konditioniert, Reiz-Anschauen-und-zurueck (Schau-Hin) drinnen mit gestellten Reizen, ein klares Notfall-Protokoll bei Eskalation",
      schon_merken: "Du kennst die Distanz, ab der jeder Auslöser bei {dogName} Stress erzeugt, und du erkennst frueh die Stress-Signale (Mimik, Atmung, Schwanz). {dogName} steckt freiwillig die Schnauze in den Maulkorb und akzeptiert kurze Tragezeiten. Drinnen reagiert {dogName} auf das Markerwort SCHAU in unter 2 Sekunden. Die Notfall-Sequenz hast du trocken durchgespielt, du weisst was du tust.",
      jetzt_anpassen: "Wenn die Schwellenwert-Karte noch wackelt, geh nochmal raus und beobachte gezielt. Ohne dieses Wissen ist Phase 2 sinnlos. Wenn der Maulkorb noch zu Frust fuehrt, geh zurueck zu kurzen Tragezeiten mit positiver Beschaeftigung. Geduld zahlt sich hier mehr aus als irgendwo sonst.",
      stolperfallen: "Schon in Phase 1 mit echten Auslösern arbeiten weil 'das muss ja gehen'. Das eskaliert. Auch klassisch: den Maulkorb erst in einer Stress-Situation aufsetzen. Niemals. Er muss vorher 100% positiv besetzt sein. Sonst ist die Verknüpfung lebenslang vergiftet.",
      vermeidet: "Auslöser provozieren oder enge Begegnungen suchen. Phase 1 ist Vorbereitung. Phase 2 ist Anwendung mit großer Distanz."
    },
    steigerung: {
      bausteine: "Reiz-Anschauen-und-zurueck (Schau-Hin) draußen mit echten Auslösern aus 50m+ Distanz, aktive Reiz-Abwendung (das Anschauen-und-Abwenden-Prinzip), Bogen als Ausweich-Strategie und Verhaltens-Anpassungs-Training (Verhaltens-Anpassungs-Training) im Distanz-Setup",
      schon_merken: "{dogName} bleibt bei Auslösern aus großer Distanz unter dem Schwellenwert und schaut zu dir, statt sich auf den Reiz zu fokussieren. Stress-Anzeichen werden kuerzer und seltener. {dogName} folgt dem Bogen-Signal ohne Widerstand. Beim Verhaltens-Anpassungs-Training zeigt {dogName} eigene Stress-Loesungs-Bewegungen (wegschauen, sich abwenden, schnüffeln), die du mit Distanz belohnst.",
      jetzt_anpassen: "Wenn die Schwellenwert-Distanz noch sehr groß bleibt, ist das in Ordnung. Reduktion erfolgt langsam, 2-5m pro Woche, nicht radikal. Wenn dagegen {dogName} schon bei 10m ruhig ist, geh vorsichtig näher ran, aber nur an einem Auslöser-Typ gleichzeitig.",
      stolperfallen: "Mehrere Auslöser-Typen pro Spaziergang stapeln. Hund + Jogger + Radler in einer Session ist Reizflut. Auch klassisch: Belohnung erst nach der Reaktion geben statt waehrend der Reiz sichtbar ist. Dann veraendert sich die emotionale Verknüpfung nicht.",
      vermeidet: "An den Schwellenwert kratzen oder ihn überschreiten, weil 'einmal probieren'. Jede Eskalation kostet 2 Wochen Lerngewinn."
    },
    generalisierung: {
      bausteine: "Verhaltens-Anpassungs-Training (Verhaltens-Anpassungs-Training) im Alltag, klare Auslöser-Hierarchie mit bewusstem Management, eine Konfrontations-Pufferzone vor erwarteten Begegnungen und die 72-Stunden-Stress-Erholungs-Regel",
      schon_merken: "{dogName} reguliert sich in vielen Situationen selbst, du musst seltener eingreifen. Bei erwarteten Begegnungen wendest du die Pufferzone-Routine reflexartig an. Du planst Spaziergaenge bewusst nach Auslöser-Hierarchie und vermeidest kumulativen Stress. Eskalationen werden selten und kurz, weil du sie frueh siehst.",
      jetzt_anpassen: "Reduziere die Belohnungs-Dichte langsam, aber niemals komplett. Bei neuen oder schwierigen Auslösern weiterhin volle Belohnung. Plane regelmaessige Refresher-Tage an einem mittel-schwierigen Auslöser, das haelt die Strategien frisch.",
      stolperfallen: "Den Maulkorb komplett ablegen weil 'es geht ja jetzt'. Bei reaktiven Hunden bleibt er Werkzeug für Hochrisiko-Situationen. Auch klassisch: die 72-Stunden-Regel ignorieren. Stresshormone bauen sich erst nach 3 Tagen vollstaendig ab.",
      vermeidet: "Auslöser-Vermeidung komplett aufgeben mit der Erwartung 'wir trainieren das durch'. Klares Management ist Teil der Loesung, nicht Versagen."
    }
  },
  mouthing: {
    fundament: {
      bausteine: "AUS-Signal sauber aufgebaut mit positivem Tausch, das Tausch-Geschaeft als Reflex-Reaktion bei Aufnahme, PFUI als Stopp-Signal drinnen mit alternativer Belohnung, Leinen-Management an euren Aufnahme-Hotspots",
      schon_merken: "{dogName} gibt einfache Gegenstaende auf AUS freiwillig her, du musst nicht hinterherrennen oder ins Maul greifen. Bei PFUI haelt {dogName} drinnen inne und sucht dich. An bekannten Hotspots im Spaziergang sucht {dogName} schon die Bein-Position. Du hast immer hochwertige Tausch-Belohnung griffbereit.",
      jetzt_anpassen: "Wenn AUS bei hochwertigen Objekten noch nicht klappt, geh zurueck zu niedrigwertigen Sachen drinnen. Wertigkeit langsam steigern. Wenn PFUI inflationaer wird (du nutzt es 20-mal am Tag), reduzier auf 3-5 wirklich wichtige Situationen.",
      stolperfallen: "Hinterherrennen wenn {dogName} ein verbotenes Objekt hat. Das ist für den Hund Spielspass und verstärkt das Aufheben. Auch klassisch: das aufgenommene Objekt nach AUS zurueckgeben. Dann ist der Tausch nicht echt und die Bereitschaft sinkt.",
      vermeidet: "An Hochrisiko-Strecken (viele Müllecken, Giftkoeder-Bereiche) ohne Maulkorb gehen, solange die Werkzeuge noch nicht draußen funktionieren. Sicherheit zuerst."
    },
    steigerung: {
      bausteine: "AUS im echten Spaziergang bei niedrig- bis mittelwertigen Funden, PFUI als Praeventions-Signal vor dem Aufheben, Belohnungs-Suche als Alternativ-Beschaeftigung für den Such-Trieb, Maulkorb als Sicherheits-Standard für Hochrisiko-Strecken",
      schon_merken: "{dogName} reagiert draußen auf PFUI in unter 2 Sekunden und wendet sich dir zu. AUS klappt bei einfachen Funden ohne Drama, du bleibst innerlich ruhig. Auf der Belohnungs-Suche sucht {dogName} aktiv mit der Nase nach geworfenen Leckerli, statt zufaellig aufzuheben.",
      jetzt_anpassen: "Wenn AUS bei mittelwertigen Funden noch nicht klappt, ist die Belohnung wahrscheinlich zu niedrig. Steig auf Hühnchen oder Wurst. Wenn der Such-Trieb auch nach mehr Auslastung weiter zum Aufheben fuehrt, intensivier die Nasenarbeit-Phasen.",
      stolperfallen: "Den Maulkorb als 'Eingestaendnis' sehen. Er ist Werkzeug, keine Strafe. Auch klassisch: PFUI als Schimpf-Wort nutzen. Es muss ein klares Stopp-Signal mit Alternativ-Belohnung bleiben.",
      vermeidet: "An kritischen Strecken (vor Schulen, an Mülltagen) ohne Maulkorb gehen. Praevention ist hier wertvoller als Training nach dem Vorfall."
    },
    generalisierung: {
      bausteine: "Belohnungs-Reduktion auf variable Verstaerkung, AUS bei hochwertigen Funden mit MEGA-Belohnung, Nasenarbeit als Hauptauslastung statt Nebenfach, klare Hot-Spot-Strategien für eure schwierigsten Orte",
      schon_merken: "{dogName} bewältigt Hochrisiko-Strecken ohne Drama, du planst sie bewusst statt sie zu meiden. AUS bei seltenen hochwertigen Funden funktioniert mit MEGA-Belohnung. Du steckst Hosentaschen-Hand seltener ein, weil {dogName} auch ohne dauernde Verstaerkung verlässlich gibt.",
      jetzt_anpassen: "Prüf die Maulkorb-Notwendigkeit pro Strecke einzeln. Bekannte ruhige Strecken: ohne. Hochrisiko: weiter mit. Bei Rueckfaellen wieder enger fuehren. Der Such-Trieb braucht lebenslange Befriedigung, plane Nasenarbeit fest in den Wochenplan ein.",
      stolperfallen: "Die Belohnungs-Frequenz komplett auf null reduzieren. Variable Verstaerkung bedeutet 'manchmal', nicht 'nie'. Auch klassisch: an einem schlechten Tag in eine Hochrisiko-Zone gehen weil 'eigentlich klappt's ja'. Ego kostet im Notfall sehr.",
      vermeidet: "Maulkorb wegen Wahrnehmung weglassen. Er ist verantwortliches Equipment, keine Schande."
    }
  },
  recall: {
    fundament: {
      bausteine: "Das Rueckruf-Wort KOMM-HER neu positiv geladen mit Top-Belohnungen, der Festhalte-Rueckruf mit Helfer für hohe Motivation, Schleppleinen-Arbeit als Sicherheits-Bruecke und die Hundepfeife als zweites Signal-Backup",
      schon_merken: "{dogName} reagiert drinnen blitzschnell auf KOMM-HER und kommt sichtbar begeistert. Beim Festhalte-Spiel sprintet {dogName} mit hoher Energie zu dir. Die Schleppleine ist eine ruhige Routine, kein Drama. Die Hundepfeife ist drinnen sauber konditioniert mit Belohnung.",
      jetzt_anpassen: "Wenn KOMM-HER drinnen noch nicht 100% klappt, ist die Belohnung wahrscheinlich zu niedrig. Geh auf Hühnchen oder Kaese, nicht Trockenfutter. Wenn die Schleppleine zu Verwirrung fuehrt, ueb zuerst nur Tragen ohne Rueckrufe, damit {dogName} sich an das Material gewoehnt.",
      stolperfallen: "Das Rueckruf-Wort für negative Dinge nutzen (Bad, Tierarzt, Anleinen am Spaziergang-Ende). Damit vergiftest du das Signal lebenslang. Nimm für Negatives ein anderes Wort. Auch klassisch: das Signal mehrfach rufen wenn {dogName} nicht kommt. Damit lernt {dogName} dass das erste Mal optional ist.",
      vermeidet: "Schon in Phase 1 echten Freilauf riskieren. Erst muss das Wort 100% sitzen, dann die Schleppleine, dann die Pfeife. Phase 2 macht den Übergang."
    },
    steigerung: {
      bausteine: "KOMM-HER unter moderater Ablenkung mit Schleppleine, die Hundepfeife in echten Situationen draußen, das Notfall-Rueckruf-Wort für echte Krisen (nur in Notfall verwendet, MEGA-Belohnung), drei klare Belohnungs-Stufen",
      schon_merken: "Bei moderater Ablenkung kommt {dogName} zuverlässig (80% oder mehr). Du erkennst sicher, wann die Ablenkung zu groß für einen Rueckruf ist, und überlistest deine eigene Stimme nicht. Die Pfeife funktioniert outdoor genauso zuverlässig wie das Wort. Das Notfall-Signal ist konditioniert und ungenutzt.",
      jetzt_anpassen: "Wenn die Erfolgsrate unter 70% sinkt, ist die Ablenkung zu groß. Reduzier sie statt Druck zu erhoehen. Wenn dagegen alles bei 90% läuft: schwierigere Ablenkungen, aber nur eine Stufe pro Woche.",
      stolperfallen: "Das Notfall-Signal für normale Rueckrufe nutzen. Damit verliert es seine Magie. Auch klassisch: Belohnung skimpen bei schwierigen Rueckrufen. Spitzenleistung kostet, gerade in Phase 2.",
      vermeidet: "Ohne Schleppleine in unbekannten Bereichen. Die Schleppleine bleibt bis Phase 3 die Sicherheits-Bruecke."
    },
    generalisierung: {
      bausteine: "Erste kontrollierte Freilauf-Phasen in sicheren Zonen, Wartungs-Routine für KOMM-HER und Pfeife, Festhalte-Spiel als regelmaessiger Auffrischer, abgestufte Belohnungs-Stufen je nach Schwierigkeit",
      schon_merken: "{dogName} bewältigt einen Freilauf in sicherer Zone und kommt auf das Signal in unter 5 Sekunden. Du nutzt die Schleppleine gezielt statt automatisch. Das Notfall-Signal hast du eingesetzt und es hat funktioniert, du hast Vertrauen in das System.",
      jetzt_anpassen: "Prüf pro Strecke einzeln: Schleppleine ja oder nein? Bei Zweifel: Schleppleine. Auch nach Monaten ohne Vorfall bleibt das Notfall-Signal das exklusive Mega-Belohnung-Wort, niemals für Routine nutzen.",
      stolperfallen: "Den Rueckruf 'schleifen lassen' weil er ja sitzt. Ohne regelmaessige Wartung verblasst die Verknüpfung. Plane 2-3 KOMM-HER-Momente pro Spaziergang mit Jackpot ein.",
      vermeidet: "Freilauf an Strecken mit Straßen-Nähe oder hoher Wildlauf-Wahrscheinlichkeit. Sicherheit geht immer vor Komfort."
    }
  },
  barking: {
    fundament: {
      bausteine: "Auslöser-Tagebuch mit den Top-3-Bell-Auslösern, der RUHE-Marker als Belohnung für Schweigen, die Klingel-Decke-Routine als konkrete Alternative, Frust-Toleranz-Aufbau über WARTE-Signale",
      schon_merken: "Du kennst die wichtigsten Bell-Auslöser bei {dogName} und reagierst nicht mehr reflexartig. {dogName} bekommt pro Tag 8-10 Belohnungen für Schweige-Phasen. Bei der Klingel-Aufnahme rennt {dogName} schon Richtung Decke. WARTE klappt in 3-4 Alltags-Situationen.",
      jetzt_anpassen: "Wenn ein Auslöser-Typ noch staerker bellt als andere, fokussier diesen Schwerpunkt für Phase 2. Wenn der RUHE-Marker noch nicht greift, ist die Belohnungs-Dichte wahrscheinlich zu niedrig. Geh für 1 Woche zurueck auf 10+ Belohnungen pro Tag.",
      stolperfallen: "Anschreien wenn {dogName} bellt. Damit gibt's Aufmerksamkeit für das Bellen, also wird es häufiger. Auch klassisch: die Klingel-Decke-Routine nur drinnen üben, dann mit echtem Besuch überfordert sein. Realistische Tests muessen schrittweise kommen.",
      vermeidet: "Den Hund 'durchbellen lassen' mit der Idee 'irgendwann hoert es schon auf'. Aufmerksamkeits-Bellen wird durch konsequentes Wegdrehen extinkter, nicht durch Aushalten."
    },
    steigerung: {
      bausteine: "Echte Klingel-Tests mit Helfer und Gast, Gegenkonditionierung bei Außenreizen, konsequente Aufmerksamkeits-Bell-Aushungerung über 2-3 Wochen, vertiefte Frust-Toleranz",
      schon_merken: "Bei echter Klingel läuft {dogName} schon zur Decke statt zur Tür. Außenreize fuehren zu Blick zu dir statt zu Bellen. Aufmerksamkeits-Bellen ist erkennbar seltener geworden, der Aushungerungs-Höhepunkt liegt hinter euch. WARTE klappt mit 20+ Sekunden ohne Bellen.",
      jetzt_anpassen: "Wenn der Aushungerungs-Höhepunkt noch nicht abgeebt ist, durchhalten. Ein Familienmitglied das nachgibt sabotiert 2 Wochen Arbeit, daher Familien-Briefing wichtig. Wenn die Decken-Routine bei realer Klingel wackelt, geh zurueck zu Aufnahme + Helfer.",
      stolperfallen: "Mehrere Auslöser-Typen gleichzeitig angehen. Konzentrier dich auf einen Schwerpunkt pro Woche. Auch klassisch: Belohnungs-Dichte zu schnell reduzieren weil 'er bellt ja kaum noch'. Phase 2 braucht weiter hohe Verstaerkung.",
      vermeidet: "An schwierigen Tagen (Gewitter, Feuerwerk, Stress) die Routine durchziehen. Lieber Reize reduzieren und nächsten Tag normal weitermachen."
    },
    generalisierung: {
      bausteine: "Klingel-Decke-Routine im Alltag mit echten Gästen, klare Stress-Hygiene um Bell-Rueckfaelle zu vermeiden, Wartungs-Refresher alle 4-6 Wochen, Notfall-Strategie bei plötzlichem Bell-Schub",
      schon_merken: "Bei Klingel oder Außenreizen reagiert {dogName} ruhig und planbar. Gäste-Empfang ist Routine, nicht Drama. Du erkennst frueh kleine Rueckfaelle und steuerst gegen, bevor sie groesser werden.",
      jetzt_anpassen: "Prüf die Familien-Konsistenz alle paar Wochen. Inkonsistente Reaktionen einzelner Personen sind die häufigste Rueckfall-Quelle. Bei Rueckfaellen: 1 Woche extra-konsequent mit erhoehter Belohnung.",
      stolperfallen: "Die Strategien als 'erledigt' abhaken. Bellen kann sehr schnell zurueckkommen sobald Konsistenz nachlässt. Auch klassisch: Stress an anderer Stelle (Umzug, neues Familienmitglied) ignorieren, dann bellt {dogName} wieder.",
      vermeidet: "Sich entspannen und Bellen-Auslöser absichtlich provozieren um zu testen. Gute Hunde sind nicht 'geprüfte Hunde', sondern stabil-trainierte Hunde."
    }
  },
  anxiety: {
    fundament: {
      bausteine: "Den Abschieds-Auslöser-Stack erkennen, einzelne Auslöser entkoppeln (Schlüssel ohne Gehen, Schuhe ohne Gehen), Allein-Sein in Sekunden bis Minuten aufgebaut, der Lieblings-Kong als positive Verknüpfung mit dem Gehen",
      schon_merken: "Du kennst die Abschieds-Auslöser von {dogName} (Schlüssel, Schuhe, Jacke, Türklinke) und arbeitest beiläufig daran sie zu entkoppeln. Allein-Zeit von 1-3 Minuten wird ohne Stress-Anzeichen bewältigt. {dogName} startet die Kong-Beschaeftigung wenn du gehst, statt schon zu zittern.",
      jetzt_anpassen: "Wenn die Sekunden-Phasen noch wackeln, geh zurueck und arbeite kuerzer. Bei Trennungsangst ist Geduld das ganze Spiel, wer zu schnell steigert baut die Angst wieder auf. Wenn der Kong unbenutzt liegen bleibt, ist die Allein-Zeit zu lang für den aktuellen Stand.",
      stolperfallen: "Dramatisches Verabschieden oder Begruessen. Beides faerbt den Akt 'allein' negativ. Auch klassisch: bei einem Jaul-Moment zurueckkommen. Damit lernt {dogName}, dass Jaulen den Halter zurueckholt, das verfestigt die Angst.",
      vermeidet: "Stunden allein lassen weil ein Termin ansteht. Auch nicht im Auto, auch nicht beim Nachbarn. Phase 1 ist Sekunden- und Minuten-Arbeit. Wenn etwas dazwischen kommt, Hundesitter."
    },
    steigerung: {
      bausteine: "Minuten-Phasen ausgedehnt bis 30-60 Minuten, die Sicherheits-Decke als mobiler Anker, die erste Stunde allein als Meilenstein, regelmaessige Beobachtung per Smartphone-Kamera",
      schon_merken: "{dogName} bleibt 30-60 Minuten allein und ist auf der Decke entspannt, nicht angespannt. Die Auslöser sind weitgehend entkoppelt, Vorbereitungs-Routinen erzeugen keine Stress-Spitzen mehr. Auf dem Video siehst du Ruhephasen statt Pacing oder Bellen.",
      jetzt_anpassen: "Wenn die Stunde noch nicht klappt, bleib bei kuerzeren Phasen und ueb sie stabil. Wenn dagegen alles ruhig ist, kannst du langsam auf 90 Minuten und 2 Stunden gehen. Die Video-Beobachtung ist hier wichtiger als Bauchgefühl, weil Hunde oft erst nach Minuten Stress zeigen.",
      stolperfallen: "Den Verlauf zu spät kontrollieren. Ohne Video raetst du, ob die Allein-Zeit gut war oder nicht. Auch klassisch: an einem Tag radikal verlängern weil 'heute scheint's gut zu sein'. Geduld macht den Unterschied.",
      vermeidet: "Lange Phasen testen wenn außen Stress ist (Gewitter, Straßenarbeiten, Feiertage). Phase 2 braucht stabile Randbedingungen."
    },
    generalisierung: {
      bausteine: "3-4 Stunden Allein-Zeit als Alltagstauglichkeit, eine berechenbare Tagesroutine die {dogName} kennt, Stress-Hygiene für langfristige Stabilitaet, regelmaessige Video-Kontrolle als Frueherkennung von Rueckfaellen",
      schon_merken: "Du kannst arbeiten oder einkaufen und {dogName} bleibt ruhig. Die Tagesroutine ist fest und vorhersehbar. Auf dem Video schlaeft oder ruht {dogName} die meiste Zeit, die Kong-Routine ist eingespielt. Du fühlst dich alltagsfähig.",
      jetzt_anpassen: "Halte die Routine streng, auch am Wochenende. Hunde unterscheiden nicht zwischen Werktag und Sonntag. Bei Lebensänderungen (Umzug, neuer Mitbewohner) erhoeh kurz die Frequenz der kurzen Allein-Phasen wieder.",
      stolperfallen: "Stundenlange Abwesenheit wagen weil 'es läuft ja'. Auch ein stabiler Hund braucht zwischendurch Sozial-Kontakt. Auch klassisch: Stress an anderer Stelle ignorieren, dann kommt Trennungsangst zurueck als Symptom.",
      vermeidet: "Mehr als 4-5 Stunden am Stueck ohne Toiletten-Pause oder Bewegung. Auch ohne Trennungsangst ist das für Hunde zu lang."
    }
  },
  jumping: {
    fundament: {
      bausteine: "Die Vier-Pfoten-am-Boden-Regel als zentrales Prinzip, das SITZ-Signal als Begruessungs-Alternative, Familien-Konsistenz mit allen Hausbewohnern, eine ruhige Wieder-Sehens-Routine ohne Aufregung",
      schon_merken: "{dogName} sucht aktiv die SITZ-Position bei deiner Begruessung. Anspringen ist seltener geworden, die Familie zieht die Regel konsequent durch. Auch deine eigenen Wieder-Sehens-Reaktionen sind ruhiger geworden, ohne dramatisches Hallo.",
      jetzt_anpassen: "Wenn ein Familienmitglied noch nachgibt, ist das die wichtigste Baustelle. Eine Inkonsequenz pro Woche kostet eine Woche Lernfortschritt. Wenn SITZ als Begruessung noch nicht von selbst kommt, ueb es nochmal aktiv in 10 Begruessungen taeglich.",
      stolperfallen: "Den Hund mit dem Knie wegstossen oder anschreien. Beides ist Aufmerksamkeit für das Anspringen, also Belohnung. Auch klassisch: bei Eile das Anspringen 'einmal durchgehen lassen'. Daraus wird sehr schnell ein wiederholtes Muster.",
      vermeidet: "Schon mit komplizierten Gäste-Szenarien arbeiten bevor Familien-Konsistenz steht. Erst Heim, dann Gäste."
    },
    steigerung: {
      bausteine: "Erweiterte Gäste-Sequenz mit Klingel und Decke, SITZ als automatische Begruessungs-Reaktion ohne Signal, die Konsequenz in mehr Alltags-Situationen (Aufstehen, Spaziergang-Start, Spielzeit), kontrollierte Vorbeigaenger-Begegnungen draußen",
      schon_merken: "Bei Klingel läuft {dogName} zur Decke. Gäste sind vorab informiert und werden korrekt eingewiesen. SITZ wird in mehreren Tages-Situationen automatisch angeboten, ohne dass du es ansagen musst. Auch beim Spaziergang setzt sich {dogName} bei Vorbeigaengern.",
      jetzt_anpassen: "Bei schwierigen Gästen (Kinder, ängstliche Menschen) {dogName} auf die Decke fuehren und dort lassen. Erst nach klarem OK-Signal hallo. Wenn Vorbeigaenger-SITZ noch wackelt, geh zurueck zu groesserer Distanz und ueb mit weniger Reizflut.",
      stolperfallen: "Gäste nicht informieren mit der Annahme 'das wird schon'. Sie werden den hochspringenden Hund streichheln und damit das Verhalten verstärken. Auch klassisch: bei sich selbst inkonsequent werden weil 'der hat sich ja gefreut'.",
      vermeidet: "Gruppen-Besuche ohne Vorbereitung. Mehr Personen heisst mehr potenzielle Inkonsistenz."
    },
    generalisierung: {
      bausteine: "Wartungs-Routine mit taeglicher Begruessungs-Übung, regelmaessige Stress-Tests mit neuen Gästen, langfristige Familien-Konsistenz, Notfall-Plan bei Rueckfaellen",
      schon_merken: "Anspringen ist Ausnahme, nicht Norm. Du fühlst dich vorbereitet auf neue Personen oder Gruppen-Besuche. Die Wartungs-Routine läuft beiläufig. Stress-Tests zeigen stabile Reaktionen.",
      jetzt_anpassen: "Bei Rueckfaellen: 1 Woche extra-konsequent, Familien-Briefing wiederholen, Belohnungs-Frequenz wieder hoch. Bei neuen Familienmitgliedern (Partner, Mitbewohner) gleich einbeziehen, sonst kommt das Anspringen über sie zurueck.",
      stolperfallen: "Konsistenz im Alltag schleifen lassen weil 'der ist ja brav geworden'. Anspringen ist immer 1 Inkonsequenz vom Comeback entfernt. Auch klassisch: bei eigener Aufregung (Feiertag, Geburtstag) dem Hund zu erlauben hochzuspringen weil 'heute ist ja was Besonderes'.",
      vermeidet: "Stress-Tests ganz auslassen weil 'es geht ja'. Ohne Stress-Test merkst du Rueckfaelle erst wenn sie schon in der Routine sind."
    }
  },
  destructive: {
    fundament: {
      bausteine: "Ursachen-Analyse abgeschlossen (Langeweile vs Trennungsangst vs Beissduerfnis), 4-5 erlaubte Kau-Objekte in Rotation etabliert, Management-Zonen für Abwesenheit eingerichtet, das Tausch-Geschaeft statt Strafe bei verbotenen Objekten",
      schon_merken: "Du weisst, ob die Zerstoerung aus Langeweile, Angst oder Beissduerfnis kommt, und der Trainings-Schwerpunkt ist klar. {dogName} hat Lieblings-Kau-Objekte und nutzt sie länger als nur ein paar Minuten. Bei verbotenen Objekten reagierst du mit Tausch, nicht mit Schimpfen.",
      jetzt_anpassen: "Wenn ein Kau-Objekt schnell langweilig wird, rotier es weg für 1-2 Wochen, dann ist es wieder interessant. Wenn die Management-Zone nicht akzeptiert wird, baue sie als Lieblings-Ort auf mit positiver Verknüpfung.",
      stolperfallen: "Mit dem Hund schimpfen wenn du ein zerstörtes Objekt findest. {dogName} kann das nicht mit der Tat verknüpfen, der Stress bleibt aber. Auch klassisch: dem Hund hinterherrennen wenn er was im Maul hat. Reines Spielvergnuegen für den Hund.",
      vermeidet: "Das aufgenommene verbotene Objekt nach Tausch zurueckgeben. Dann ist der Tausch nicht echt und die Bereitschaft sinkt."
    },
    steigerung: {
      bausteine: "Strukturierter Auslastungs-Plan implementiert mit Mischung aus Bewegung, Nase und Kopf, Kau-Objekte rotieren routiniert, Management vorsichtig gelockert wo es sicher ist, lange Liege-Phasen bewusst trainiert",
      schon_merken: "{dogName} ist abends erschöpft, nicht aufgedreht. Die Auslastungs-Mischung greift, Zerstoerung in Anwesenheit ist deutlich seltener. Lange Decken-Phasen werden ruhig durchgehalten. Erste freigegebene Zonen werden ohne Zerstoerung akzeptiert.",
      jetzt_anpassen: "Bei jungen Hunden (4-9 Monate): mehr Kopfarbeit, weniger stumpfes Toben. Bei Erwachsenen: mehr Nasenarbeit. Wenn lange Liege-Phasen noch wackeln, geh zurueck zu kuerzeren mit Kong-Beschaeftigung.",
      stolperfallen: "Management komplett aufzugeben weil 'eine Woche ist nix passiert'. Risiko-Bereiche bleiben Risiko-Bereiche. Auch klassisch: Kau-Sessions zu kurz machen. 15-30 Minuten ist die Wirkdauer, nicht 5 Minuten.",
      vermeidet: "Mehrere aufregende Aktivitäten am selben Tag stapeln. Wenn Zerstoerung Stress-Symptom ist, verschärft Stress sie weiter."
    },
    generalisierung: {
      bausteine: "Langfristiger Auslastungs-Wochenplan etabliert, Kau-Objekt-Sortiment regelmaessig gewartet und erweitert, Management-Balance gefunden mit klaren sicheren und off-limits Bereichen, Notfall-Plan bei Stress-Phasen",
      schon_merken: "{dogName} ist langfristig ausgeglichen, Zerstoerung ist Ausnahme. Du hast eine klare Vorstellung, welche Zonen sicher sind und welche nicht. Bei Stress-Phasen (Weihnachten, Urlaub, Änderungen) hast du eine Strategie.",
      jetzt_anpassen: "Halte den Auslastungs-Plan auch am Wochenende. Bei neuen Lebenssituationen (Umzug, Familien-Veränderung) erhoeh kurz wieder Management und Auslastung. Prüf alle paar Wochen das Kau-Sortiment auf Verschleiss.",
      stolperfallen: "Den Auslastungs-Plan aufweichen weil 'er ist ja ruhig geworden'. Die Ruhe kommt vom Plan, nicht aus dem Nichts. Auch klassisch: an stressigen Tagen weniger auslasten weil keine Zeit. Dann zerstört {dogName} aus Frust.",
      vermeidet: "Risiko-Bereiche komplett oeffnen mit der Erwartung 'es klappt jetzt'. Vorsicht ist guenstiger als zerstörtes Sofa."
    }
  },
  soiling: {
    fundament: {
      bausteine: "Berechenbare Toiletten-Routine mit 5-7 festen Runden pro Tag, Belohnung direkt am Platz und im richtigen Moment, Auslöser-Lesen lernen (Schnüffeln, Drehen, Unruhe), ruhiger Umgang mit Unfaellen ohne Strafe",
      schon_merken: "Du kennst {dogName}s Toiletten-Muster und gehst proaktiv raus, nicht reaktiv. Bei den meisten Runden klappt es am gewohnten Platz. Unfaelle sind seltener geworden, und wenn doch, bleibst du ruhig und nutzt Enzym-Reiniger. Auslöser-Anzeichen erkennst du schneller als zu Plan-Start.",
      jetzt_anpassen: "Wenn Unfaelle weiter häufig sind, lass den Tierarzt ausschließen dass es eine Blasenentzuendung oder andere medizinische Ursache ist. Bei jungen Hunden: Frequenz nochmal erhoehen auf alle 1-2 Stunden. Bei stress-bedingtem Soiling: Stress-Faktoren reduzieren.",
      stolperfallen: "Schimpfen oder Nase-rein-druecken bei einem Unfall. Damit lernt {dogName} sich zu verstecken, nicht stubenreiner zu werden. Auch klassisch: nur an einem Platz draußen akzeptieren statt zu generalisieren. Später ist {dogName} dann an anderen Orten verunsichert.",
      vermeidet: "Erwarten dass sich Stubenreinheit von alleine entwickelt. Sie braucht aktive Belohnung und Routine."
    },
    steigerung: {
      bausteine: "Toiletten-Frequenz schrittweise reduziert bei Erfolg, Auslöser-Lesen automatisiert, Belohnung schrittweise variiert, Generalisierung auf verschiedene Strecken",
      schon_merken: "{dogName} schafft längere Phasen ohne Toilettendrang, du planst mit klar mehr Spielraum. An neuen Orten klappt es nach kurzer Eingewoehnung. Auslöser-Anzeichen sind nahezu reflexartig erkannt und beantwortet.",
      jetzt_anpassen: "Wenn die reduzierte Frequenz Unfaelle bringt, geh zurueck zur engeren Routine. Bei stress-bedingtem Soiling: arbeite an Stress-Toleranz mit Mini-Stressoren. Bei aelteren Hunden: Tierarzt-Check wenn die Frequenz wieder steigt.",
      stolperfallen: "Belohnung komplett weglassen weil es klappt. Variable Verstaerkung bleibt wichtig, sonst kann das Verhalten erodieren. Auch klassisch: bei neuen Strecken zu wenig Geduld haben.",
      vermeidet: "Lange Phasen ohne Toilettenrunde wagen in stressigen Tagen oder neuen Umgebungen. Sicherheit zuerst."
    },
    generalisierung: {
      bausteine: "Langfristige Routine mit 3-4 festen Runden pro Tag, Stubenreinheit auch in neuen Umgebungen, lebenslange Stress-Hygiene, Alters-Anpassung bei aelteren Hunden",
      schon_merken: "{dogName} ist langfristig stubenrein, auch bei Reisen oder Besuchen. Du hast eine klare Routine die sich anfühlt wie selbstverstaendlich. Stress an anderen Stellen erkennst du frueh, bevor er Stubenreinheit beeinflusst.",
      jetzt_anpassen: "Mit dem Alter braucht {dogName} eventuell wieder oeftere Runden, beobachte aktiv. Bei aelteren Hunden mit Frequenz-Steigerung: Tierarzt-Check. Bei stress-bedingten Rueckfaellen: kurz die Routine engmaschiger machen.",
      stolperfallen: "Die Routine in der eigenen Hektik vergessen. Stubenreinheit braucht weiter aktive Pflege. Auch klassisch: Alters-Veränderungen ignorieren mit dem Gedanken 'der ist doch stubenrein'. Aeltere Hunde brauchen Anpassungen.",
      vermeidet: "Bei Unfaellen mit dem Schimpfen wieder anfangen. Auch nach Jahren der Stubenreinheit ist Strafe falsch."
    }
  }
};

function phaseName(phase: Phase): string {
  if (phase === "fundament") return "Fundament-Phase";
  if (phase === "steigerung") return "Steigerungs-Phase";
  return "Generalisierungs-Phase";
}

function buildMonatsUebersichten(
  problem: ProblemKey,
  weeksTotal: number,
  monthsTotal: number,
  dog: DogProfile,
  problemLabel: string,
  customProblemText?: string
): Array<{ monat: number; text: string }> {
  const dogName = dog.dogName || "dein Hund";
  const out: Array<{ monat: number; text: string }> = [];
  const ranges = phaseRanges(weeksTotal);

  const customRef = customProblemText
    ? `\n\nSpeziell zu eurer Situation: "${customProblemText.slice(0, 200)}". Halte diesen Bezug aktiv im Kopf, das ist der eigentliche Trainings-Hebel.`
    : "";

  // Fallback auf pulling-Daten, falls ein Problem noch nicht eingetragen ist
  const phaseDaten = PHASE_TEXTE[problem] || PHASE_TEXTE.pulling;

  for (let m = 1; m <= monthsTotal; m++) {
    const endWeek = Math.min(m * 4, weeksTotal);
    const phase = phaseForWeek(endWeek, weeksTotal);
    const isEndOfPhase = endWeek === ranges[phase].end;
    const daten = phaseDaten[phase];

    const phaseHeader = isEndOfPhase
      ? `Nach Woche ${endWeek} ist die ${phaseName(phase)} abgeschlossen. Diese Wochen haben dir die wichtigsten Bausteine etabliert: ${daten.bausteine}.`
      : `Halbzeit in der ${phaseName(phase)} (nach Woche ${endWeek}). Die Bausteine dieser Phase: ${daten.bausteine}. Wir sind noch nicht am Ende, aber die Richtung steht.`;

    const text = `${phaseHeader}

Was du jetzt schon merken solltest: ${daten.schon_merken.replace(/\{dogName\}/g, dogName)}

Was du jetzt anpassen kannst: ${daten.jetzt_anpassen.replace(/\{dogName\}/g, dogName)}

Häufige Stolperfallen jetzt: ${daten.stolperfallen.replace(/\{dogName\}/g, dogName)}

Was vermeidet jetzt: ${daten.vermeidet.replace(/\{dogName\}/g, dogName)}${customRef}`;

    out.push({ monat: m, text });
  }

  return out;
}

// ── Zusatz-Spiele ──────────────────────────────────────────────────
const BONUS_SPIELE = [
  {
    nummer: 1,
    name: "Futter-Suche",
    ziel: "Konzentration, Nasenarbeit und innere Ruhe fördern",
    schritte: [
      "{dogName} sitzt oder steht ruhig",
      "Zeige ein kleines Futterstück",
      "Lege es sichtbar ab",
      "Sage ruhig SUCH",
      "Lass {dogName} selbstständig suchen",
      "Lobe leise nach dem Finden",
      "Wiederhole an anderer Stelle",
    ],
    warum: "Nasenarbeit macht müde, ruhig und zufrieden. Stärkt Selbstständigkeit und Frustrationstoleranz.",
  },
  {
    nummer: 2,
    name: "Hand-Touch",
    ziel: "Aufmerksamkeit und Orientierung an dir stärken",
    schritte: [
      "Halte deine Hand seitlich auf Nasenhöhe",
      "Warte bis {dogName} Interesse zeigt",
      "Berührt {dogName} die Hand mit der Nase: sofort FEIN",
      "Belohne direkt",
      "Wechsle die Position der Hand",
      "Bleibe freundlich und entspannt",
      "Beende nach wenigen Wiederholungen",
    ],
    warum: "{dogName} lernt sich aktiv an dir zu orientieren. Ideal bei Unsicherheit oder Ablenkung.",
  },
  {
    nummer: 3,
    name: "Ruhiges Zerrspiel",
    ziel: "Impulskontrolle und kontrolliertes Spiel lernen",
    schritte: [
      "Nimm ein weiches Spielzeug",
      "Lade ruhig zum Ziehen ein",
      "Spiele langsam und kontrolliert",
      "Stoppe plötzlich die Bewegung",
      "Warte auf Lockerlassen oder Ruhe",
      "Belohne ruhiges Verhalten",
      "Spiele erst dann weiter",
      "Beende das Spiel bewusst",
    ],
    warum: "{dogName} lernt Erregung zu regulieren. Spiel und Kontrolle schließen sich nicht aus.",
  },
];

// ════════════════════════════════════════════════════════════════════
// Hauptfunktion
// ════════════════════════════════════════════════════════════════════

export function composePlan(args: ComposeArgs): TrainingPlanContent {
  const { problem, planLengthMonths, dog, introText, zieleText, abschlussText, customProblemText } = args;
  const weeksTotal = planLengthMonths * 4;
  const monthsTotal = planLengthMonths;

  const problemLabel = PROBLEM_LABELS_DE[problem] || problem;
  const dogName = dog.dogName || "deinem Hund";

  // Pool für Exercise-Lookup
  let rawPool = EXERCISE_LIBRARY[problem] || [];
  if (rawPool.length === 0) {
    rawPool = EXERCISE_LIBRARY.pulling || [];
    console.warn(`[plan-composer] kein Pool für "${problem}" — Fallback pulling`);
  }
  const filteredPool = filterSuitable(rawPool, dog);
  const pool = filteredPool.length > 0 ? filteredPool : rawPool;
  const exById = new Map<string, ExerciseTemplate>();
  for (const e of pool) exById.set(e.id, e);

  // Problem-spezifische Wochen-Templates. Fallback: pulling (Aufmerksamkeit
  // + Impulskontrolle sind universell hilfreich), bis dedizierte Libraries
  // für alle 10 Probleme stehen.
  const WEEK_LIBRARIES: Record<ProblemKey, Record<Phase, WeekTemplate[]>> = {
    pulling: PULLING_WEEKS,
    energy: ENERGY_WEEKS,
    aggression: AGGRESSION_WEEKS,
    mouthing: MOUTHING_WEEKS,
    recall: RECALL_WEEKS,
    barking: BARKING_WEEKS,
    anxiety: ANXIETY_WEEKS,
    jumping: JUMPING_WEEKS,
    destructive: DESTRUCTIVE_WEEKS,
    soiling: SOILING_WEEKS,
  };
  const weekTpls = WEEK_LIBRARIES[problem];

  const ranges = phaseRanges(weeksTotal);
  const weeks = [];

  for (let w = 1; w <= weeksTotal; w++) {
    const phase = phaseForWeek(w, weeksTotal);
    // Position der Woche INNERHALB der Phase (1-basiert)
    const positionInPhase = w - ranges[phase].start + 1;

    // Aus den 8 Templates pro Phase die richtige nehmen.
    // Falls weniger Wochen als Templates, nimm die ersten der Reihe nach.
    const phaseTpls = weekTpls[phase];
    const tpl = phaseTpls[Math.min(positionInPhase - 1, phaseTpls.length - 1)];

    // Übungen aus den im Template hinterlegten IDs ziehen — fallback
    // auf den ersten Pool-Eintrag der Phase falls eine ID nicht existiert.
    const uebungen = tpl.exerciseIds
      .map((id) => exById.get(id))
      .filter((e): e is ExerciseTemplate => !!e)
      .map((e) => ({
        name: personalize(e.title, dog),
        schritte: e.steps.map((s) => personalize(s, dog)),
      }));

    // Falls keine Übung gefunden (anderes Problem mit pulling-fallback und
    // ID nicht im Pool), nimm die erste passende Übung der Phase.
    if (uebungen.length === 0) {
      const fallback = pool.find((e) => e.phase === phase);
      if (fallback) {
        uebungen.push({
          name: personalize(fallback.title, dog),
          schritte: fallback.steps.map((s) => personalize(s, dog)),
        });
      }
    }

    weeks.push({
      num: w,
      title: personalize(tpl.title, dog),
      schwerpunkt: personalize(tpl.schwerpunkt, dog),
      wochenziele: tpl.wochenziele.map((z) => personalize(z, dog)),
      tagesplan: personalize(tpl.tagesplan, dog),
      no_gos: tpl.no_gos.map((n) => personalize(n, dog)),
      fortschritt: tpl.fortschritt.map((f) => personalize(f, dog)),
      uebungen,
    });
  }

  const fallbackEinleitung = `Dieser Trainingsplan wurde speziell für ${dogName} und das Thema ${problemLabel} entwickelt. Er begleitet dich über ${weeksTotal} Wochen Schritt für Schritt, vom ruhigen Fundament drinnen bis zur souveränen Bewältigung schwieriger Alltagssituationen.\n\nJede Übung ist so gestaltet, dass du sie ohne Vorkenntnisse umsetzen kannst. Du brauchst weiche Leckerlis, eine Leine, eine Decke und vor allem Geduld.`;

  // Problem-spezifisches Equipment-Briefing.
  const equipmentBriefings: Record<ProblemKey, string> = {
    pulling: `\n\nAusrüstungs-Check: arbeite mit einem gut sitzenden Y-Brustgeschirr (Bauchgurt liegt VOR dem Brustkorb, Kreuz nie auf dem Hals). Halsband ist für Leinenführigkeit NICHT geeignet, Halti/Kopfhalfter/Stachelhalsband sind tabu. Die Leine sollte 2-3m lang sein, KEINE Roll-Leine.`,
    energy: `\n\nAusrüstungs-Check: Schnüffelmatte (ca. 30€), Kong Classic (Größe passend zu ${dogName}), 2-3 verschiedene Such-Beschäftigungs-Spielzeuge (Trixie Mover, Buster Cube). Hochwertige Trainings-Leckerlis weich und klein. Für später: Schleppleine 5-10m Biothane für Spuren-Suche draußen.`,
    aggression: `\n\nAusrüstungs-Check WICHTIG: Korbmaulkorb (Baskerville Ultra oder BUMAS, individuell angepasst — Stoff-Schlinge NICHT geeignet, blockiert Hecheln). 2m Führleine, KEINE Roll-Leine. Hochwertige Belohnung (Hähnchen, Käse, Wurst) IMMER griffbereit. Brustgeschirr für mehr Sicherheit bei Reaktion.`,
    mouthing: `\n\nAusrüstungs-Check: Korbmaulkorb (Baskerville Ultra) für Hochrisiko-Strecken — er verhindert Aufnahme, blockiert aber NICHT Trinken oder Hecheln. 2m Führleine für Hot-Spots. Hochwertige Tausch-Belohnung immer in der Hosentasche.`,
    recall: `\n\nAusrüstungs-Check: 5-10m Schleppleine aus Biothane (Seil verbrennt die Hände), gut sitzendes Brustgeschirr (Schleppleine NIEMALS am Halsband). Hundepfeife ACME 211.5 als Backup-Signal. Hochwertige Belohnung MEGA: Hähnchen, Käse, kleine Stücke Wurst.`,
    barking: `\n\nAusrüstungs-Check: Entspannungsdecke (mind. 60x80cm, fester Ort), Klingel-Aufnahme auf dem Handy für Türklingel-Training, hochwertige Belohnung für Stille-Verstärkung. Optional: Hintergrundmusik (Adagio-Klassik) bei Außenreiz-Phasen.`,
    anxiety: `\n\nAusrüstungs-Check: Kong Classic (Größe passend zu ${dogName}) als Allein-Zeit-exklusives Werkzeug, Entspannungsdecke als Sicherheits-Anker, Smartphone-Kamera oder Smart-Camera mit Live-Stream für Allein-Zeit-Beobachtung. Hochwertiger Kong-Inhalt (Nassfutter, einfrieren = schwerer).`,
    jumping: `\n\nAusrüstungs-Check: SITZ-Signal muss vorher zuverlässig sitzen. Entspannungsdecke für Gäste-Empfang. Familien-Briefing-Zettel am Eingang für Gäste. Hochwertige Leckerlis griffbereit für jede Begegnung.`,
    destructive: `\n\nAusrüstungs-Check: 4-5 verschiedene Kau-Objekte für Rotation (Naturkauartikel wie Bueffelhaut/Ochsenziemer, Kong Classic, Schnüffelmatte, Holzknochen, Geweih). KEINE Rohhaut-Knochen — Verletzungsgefahr. Box oder Babyschutz für sichere Allein-Zonen. Enzym-Reiniger.`,
    soiling: `\n\nAusrüstungs-Check WICHTIG: Enzym-Reiniger (Tierhandlung) für Unfaelle — normaler Reiniger reicht nicht, der Geruch bleibt für den Hund. Hochwertige Belohnungen griffbereit für jede Toilettenrunde. Bei haufigen Unfaellen erwachsener Hunde: Tierarzt-Check (Blasenentzuendung etc.) vor Trainings-Start.`,
  };
  const equipmentBriefing = equipmentBriefings[problem] || "";

  const fallbackAufbau = `Der Plan ist in drei Phasen gegliedert: Fundament (drinnen, reizarm), Steigerung (raus, kontrolliert) und Generalisierung (echter Alltag). Jede Woche enthält klare Wochenziele, einen Tagesplan und konkrete Übungen mit Schritt-für-Schritt-Anleitung.\n\nEin bis zwei gut gemachte Trainingseinheiten pro Tag reichen. Qualität schlägt Dauer.${equipmentBriefing}`;
  // Problem-spezifischer Ziel-Satz, statt holpriger Direkt-Einsetzung
  const ZIEL_FORMULIERUNGEN: Record<ProblemKey, string> = {
    pulling: "deutlich entspannter an der Leine laufen",
    energy: "seine Energie deutlich besser regulieren und mehr zur Ruhe finden",
    aggression: "Begegnungen mit anderen Hunden, Joggern und Radfahrern deutlich entspannter meistern",
    mouthing: "verbotene Gegenstaende freiwillig hergeben statt sie zu verteidigen",
    recall: "auf den Rückruf zuverlässig und freudig zurückkommen",
    barking: "deutlich seltener und kontrollierter bellen",
    anxiety: "entspannter allein bleiben können, ohne Trennungsstress",
    jumping: "Menschen ruhig begrüßen statt anzuspringen",
    destructive: "deutlich seltener Dinge zerstören und mehr aus erlaubten Beschäftigungen herausholen",
    soiling: "zuverlässig stubenrein werden mit klarer Toiletten-Routine",
  };
  const zielSatz = ZIEL_FORMULIERUNGEN[problem] || "das gemeinsame Leben deutlich entspannter gestalten";
  const fallbackZiele = `Am Ende der ${weeksTotal} Wochen wird ${dogName} ${zielSatz}. Nicht durch Strafe oder Druck, sondern durch positive Verstärkung und klare Routinen. Du wirst ${dogName} besser verstehen und gemeinsam einen ruhigeren Alltag haben.`;

  return {
    intro: {
      headline: `${planLengthMonths}-Monatsplan für ${dogName}`,
      // KI-Text (introText/zieleText/abschlussText) wird von Claude standardmaessig
      // mit weiblichen Pronomen geschrieben — daher auch hier durch personalize(),
      // damit bei Rueden korrekt auf er/ihn/sein geswappt wird.
      einleitung: personalize(introText || fallbackEinleitung, dog),
      aufbau: personalize(fallbackAufbau, dog),
      ziele: personalize(zieleText || fallbackZiele, dog),
    },
    weeks,
    monats_uebersichten: buildMonatsUebersichten(problem, weeksTotal, monthsTotal, dog, problemLabel, customProblemText),
    abschluss: personalize(
      abschlussText ||
      `Du hast ${dogName} über ${weeksTotal} Wochen systematisch begleitet, das ist eine echte Leistung. Halte die Routinen aufrecht, beobachte die kleinen Fortschritte und bleib geduldig mit euch beiden. Veränderung ist keine Linie, sondern eine Welle.`,
      dog
    ),
    zusatz_spiele: BONUS_SPIELE.map((bs) => ({
      ...bs,
      schritte: bs.schritte.map((s) => personalize(s, dog)),
      warum: personalize(bs.warum, dog),
    })),
  };
}
