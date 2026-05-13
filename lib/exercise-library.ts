// Übungs-Bibliothek fuer den Plan-Composer.
//
// Pro Problem-Typ (pulling, barking, etc.) gibt es eine Liste von
// Übungen mit Schwierigkeit, Phase und Tags. Der Composer waehlt aus
// dieser Liste die passenden Übungen basierend auf Hund-Profil aus
// und verteilt sie ueber die Wochen.
//
// Plus Phasen-Strukturen (Wochenziele, Tagespläne, No-Gos, Fortschritt)
// als Template pro Phase.

export type ProblemKey =
  | "pulling"
  | "barking"
  | "aggression"
  | "anxiety"
  | "recall"
  | "energy"
  | "jumping"
  | "destructive"
  | "soiling"
  | "mouthing";

export type Phase = "fundament" | "steigerung" | "generalisierung";
// fundament:        Wochen 1-4  (drinnen, reizarm)
// steigerung:       Wochen 5-8  (raus, kontrolliert)
// generalisierung:  Wochen 9-12 (Alltag, schwierige Situationen)

export type Difficulty = "easy" | "medium" | "hard";

export interface ExerciseTemplate {
  id: string;
  title: string;        // "SCHAU-Signal etablieren"
  shortDesc: string;    // 1-Satz für Wochen-Overview-Listen
  intro: string;        // 1-2 Sätze, kann {dogName} enthalten
  steps: string[];      // 6-8 Schritte, je Schritt mit "Titel: Beschreibung" Pattern oder freier Text
  phase: Phase;
  difficulty: Difficulty;
  durationMin: number;  // Geschätzte Dauer pro Session
  suitableFor: {
    minAgeMonths?: number;       // z.B. 6 für "nicht für junge Welpen"
    notForBreeds?: string[];     // z.B. ["mastiff"] für Übungen die zu anspruchsvoll
    notForSeniors?: boolean;     // true wenn nicht für Senior-Hunde
  };
  tags?: string[];      // freie Tags für später
}

export interface WeekStructure {
  num: number;
  title: string;
  wochenziele: string[];
  tagesplan: string;
  no_gos: string[];
  fortschritt: string[];
  // Welche Übungen kommen rein — werden vom Composer eingesetzt
  exerciseIds: string[];
}

// ════════════════════════════════════════════════════════════════════
// PULLING (Leinenziehen) — 12 Übungen + 12 Wochen-Templates
// ════════════════════════════════════════════════════════════════════

const PULLING_EXERCISES: ExerciseTemplate[] = [
  // ── Fundament (Woche 1-4) ──────────────────────────────────────
  {
    id: "p-schau",
    title: "SCHAU-Signal etablieren",
    shortDesc: "Aufmerksamkeit auf Signal — die Grundlage für alles weitere",
    intro: "Mit dieser Übung lernt {dogName} auf das Signal SCHAU sofort Blickkontakt mit dir aufzunehmen. Sie ist die Basis für alle weiteren Leinenführungs-Übungen.",
    steps: [
      "Halte ein Leckerli neben dein Gesicht auf Augenhöhe, sage SCHAU und warte, bis {dogName} dich ansieht.",
      "Sobald {dogName}s Blick deine Augen trifft, sage sofort FEIN in warmem Ton und gib das Leckerli.",
      "Wiederhole 5 mal hintereinander, dann eine Pause von 30 Sekunden.",
      "Bewege das Leckerli schrittweise vom Gesicht weg, damit {dogName} dich anschaut statt die Hand.",
      "Steigere die Dauer des Blickkontakts langsam auf 2-3 Sekunden bevor du FEIN sagst.",
      "Übe in verschiedenen Räumen, damit {dogName} das Signal nicht nur mit einem Ort verknüpft.",
      "Belohne besonders ruhigen, weichen Blickkontakt mit einem Jackpot aus 3-4 Leckerlis.",
    ],
    phase: "fundament",
    difficulty: "easy",
    durationMin: 5,
    suitableFor: {},
  },
  {
    id: "p-leinenspiel-drinnen",
    title: "Leinen-Spiel in der Wohnung",
    shortDesc: "Lockere Leine drinnen üben bevor es nach draußen geht",
    intro: "{dogName} lernt das Grundprinzip der lockeren Leinenführung in reizarmer Umgebung. Drinnen, ohne Ablenkung — perfekt für den Anfang.",
    steps: [
      "Lege {dogName} die Leine an und starte in einem ruhigen Raum.",
      "Gehe entspannt los, die Leine locker in der Hand.",
      "Sobald die Leine straff wird, bleibe sofort und kommentarlos stehen wie eine Statue.",
      "Sobald {dogName} sich zu dir umdreht oder die Leine lockert, sage FEIN und gehe weiter.",
      "Übe Richtungswechsel: sage HIER, drehe dich und gehe in die andere Richtung.",
      "Belohne {dogName} großzügig wenn sie den Richtungswechsel mitmacht.",
      "Halte die Übung bei 5-7 Minuten und beende solange sie noch aufmerksam mitarbeitet.",
    ],
    phase: "fundament",
    difficulty: "easy",
    durationMin: 7,
    suitableFor: {},
  },
  {
    id: "p-stop-and-go",
    title: "Stop-and-Go an der Tür",
    shortDesc: "Vor dem Losgehen Ruhe etablieren — Hektik vermeiden",
    intro: "Ein ruhiger Start an der Haustür bestimmt den Rest des Spaziergangs. {dogName} lernt: Tür geht nur bei Ruhe auf.",
    steps: [
      "Leine anlegen, ruhig stehen bleiben — kein Losgehen.",
      "Türgriff anfassen, ohne zu öffnen. Bei Drängeln: Griff loslassen, warten.",
      "Tür einen Spalt öffnen. Bei Drängen: schließen, warten.",
      "Erster Schritt nach draußen: du zuerst, {dogName} folgt ohne vorbeizudrängen.",
      "Draußen 2-5 Sekunden stehen bleiben, ankommen lassen.",
      "Losgehen erst bei lockerer Leine. Ziehen bedeutet Stopp.",
      "Bei jedem Spaziergang anwenden — wird zur Routine.",
    ],
    phase: "fundament",
    difficulty: "easy",
    durationMin: 4,
    suitableFor: {},
  },
  {
    id: "p-decke-drinnen",
    title: "Entspannungsdecke etablieren",
    shortDesc: "Einen Ruhe-Anker für später draußen aufbauen",
    intro: "{dogName} bekommt einen festen Ort drinnen — die Entspannungsdecke. Später nutzen wir den als Anker auch draußen.",
    steps: [
      "Lege eine Decke an einen ruhigen Ort, führe {dogName} hin und belohne das Betreten.",
      "Sobald {dogName} mit allen Pfoten auf der Decke ist, sage PLATZ.",
      "Gib alle 5 Sekunden ruhig ein Leckerli zwischen die Vorderpfoten.",
      "Verlängere die Abstände langsam auf 10 und dann 15 Sekunden.",
      "Sage FEIN in tiefer ruhiger Stimme — Entspannung verknüpfen, nicht Aufregung.",
      "Wenn {dogName} aufsteht: ruhig zurückführen, ohne Worte.",
      "Beende mit klarem Auflöse-Signal wie LAUF.",
    ],
    phase: "fundament",
    difficulty: "easy",
    durationMin: 5,
    suitableFor: {},
  },

  // ── Steigerung (Woche 5-8) ─────────────────────────────────────
  {
    id: "p-schau-draussen",
    title: "SCHAU mit Außenablenkung",
    shortDesc: "Das Signal funktioniert auch wenn draußen was los ist",
    intro: "{dogName} überträgt das gelernte SCHAU-Signal in die Außenwelt — anfangs an ruhigen Orten, dann mit mehr Ablenkung.",
    steps: [
      "Beginne jeden Spaziergang mit einer kurzen SCHAU-Übung vor der Haustür.",
      "Übe 5-7 Minuten lockere Leinenführung an einem ruhigen Ort ohne Passanten.",
      "Bei jedem auffälligen Reiz (Auto, anderer Hund in Distanz): SCHAU und Leckerli.",
      "Wenn {dogName} reagiert ohne SCHAU zu hören — Jackpot von 4-5 Leckerlis.",
      "Steigere die Ablenkung langsam: erst leichte Reize, dann mehr.",
      "Bei Stress-Signalen: Abstand vergrößern, einfacher machen.",
      "Beende immer in einer entspannten Situation — Erfolg festigen.",
    ],
    phase: "steigerung",
    difficulty: "medium",
    durationMin: 10,
    suitableFor: {},
  },
  {
    id: "p-bogen",
    title: "BOGEN bei Begegnungen",
    shortDesc: "Strukturiertes Ausweichen statt Ziehen oder Bellen",
    intro: "Mit dieser Übung lernt {dogName} eine klare Ausweichstrategie — den Bogen — die das Ziehen bei Begegnungen ersetzt.",
    steps: [
      "Übe den Bewegungsablauf ohne echte Begegnung: gehe mit {dogName} um Laternen oder Mülleimer herum.",
      "Sage dabei BOGEN und locke {dogName} mit einem Leckerli in den Halbkreis.",
      "Belohne {dogName} alle 2-3 Schritte während des Bogens.",
      "Fordere während des Bogens SCHAU, um die Aufmerksamkeit zu halten.",
      "Steigere auf echte Begegnungen mit großem Abstand (15+ Meter).",
      "Nach jeder erfolgreichen Begegnung: Jackpot aus 3-4 Leckerlis.",
      "Verringere den Bogenradius erst wenn {dogName} entspannt bleibt.",
    ],
    phase: "steigerung",
    difficulty: "medium",
    durationMin: 10,
    suitableFor: {},
  },
  {
    id: "p-gegenkonditionierung",
    title: "Gegenkonditionierung auf Reize",
    shortDesc: "Reize positiv verknüpfen — vom Stressor zur Belohnung",
    intro: "{dogName} lernt: Reize bedeuten nicht Aufregung, sondern Leckerlis. Wir verändern die emotionale Reaktion grundlegend.",
    steps: [
      "Setze dich mit {dogName} an einen Ort mit Reizen in 15-20m Distanz.",
      "Sobald ein Reiz auftaucht (Mensch, Hund, Auto): sage SCHAU und füttere durchgehend.",
      "Füttere solange der Reiz sichtbar ist, NICHT erst nach Reaktion.",
      "Sobald der Reiz weg ist: Leckerlis stoppen vollständig.",
      "{dogName} lernt: Reiz erscheint = Leckerli, Reiz weg = Leckerli vorbei.",
      "Beobachte Körpersprache: bei Anspannung mehr Abstand schaffen.",
      "Max 5 Begegnungen pro Einheit — Qualität vor Quantität.",
    ],
    phase: "steigerung",
    difficulty: "medium",
    durationMin: 10,
    suitableFor: {},
  },
  {
    id: "p-richtungswechsel-aussen",
    title: "Richtungswechsel ohne Ansage",
    shortDesc: "Aufmerksamkeit bei dir statt nach vorne ziehen",
    intro: "{dogName} entwickelt Aufmerksamkeit für deine Bewegung. Statt vor zu rennen, orientiert sie sich an dir.",
    steps: [
      "Gehe normal weiter, Leine locker.",
      "Plötzlich Richtung wechseln — ohne etwas zu sagen.",
      "Bei Folgen mit kurzer Verzögerung: ruhig bestätigen.",
      "Bei Zug zurück zur richtung: stehen bleiben.",
      "Sobald Leine locker, weitergehen.",
      "2-3 Richtungswechsel pro Spaziergang.",
      "Kein Rucken oder Ankündigen — nur Bewegung als Signal.",
    ],
    phase: "steigerung",
    difficulty: "medium",
    durationMin: 5,
    suitableFor: {},
  },

  // ── Generalisierung (Woche 9-12) ──────────────────────────────
  {
    id: "p-vorbeigang",
    title: "Direktes Vorbeigehen an Menschen",
    shortDesc: "An Menschen vorbei ohne Bogen — die Königsdisziplin",
    intro: "Jetzt geht's an die schwerere Variante: {dogName} lernt direkt an Menschen in 3-5m Distanz vorbeizugehen ohne Bogen.",
    steps: [
      "Wähle zunächst Wege mit niedrigem Menschen-Aufkommen.",
      "Bereite {dogName} schon aus 15m Distanz mit SCHAU vor.",
      "Halte das Tempo konstant — nicht schneller, nicht langsamer.",
      "Belohne während des Vorbeigangs kontinuierlich mit kleinen Leckerlis (Pippeling-Modus).",
      "Wenn {dogName} stress-frei vorbeigeht: 5 Sekunden nach Passage Jackpot.",
      "Vermeide direkten Blickkontakt mit dem entgegenkommenden Menschen.",
      "Bei Anspannung: zurück zum BOGEN, ohne Frust.",
    ],
    phase: "generalisierung",
    difficulty: "hard",
    durationMin: 15,
    suitableFor: {},
  },
  {
    id: "p-cafe",
    title: "Café-Außenbereich-Training",
    shortDesc: "Ruhig liegen während du Kaffee trinkst",
    intro: "{dogName} lernt, in einer Café-Situation ruhig zu warten. Das ist Premium-Alltag — ein echtes Highlight im Plan.",
    steps: [
      "Wähle ein Café mit ruhigem Außenbereich, nicht zentral.",
      "Lege die Decke vor oder unter den Tisch.",
      "Bestelle erst wenn {dogName} sich abgelegt hat.",
      "Belohne in der ersten Minute mehrfach für ruhiges Liegen.",
      "Reduziere die Belohnungs-Frequenz langsam.",
      "Bei Aufstehen: ruhig zurückführen, ohne Worte.",
      "Beende nach 15 Minuten — auch wenn's super lief.",
    ],
    phase: "generalisierung",
    difficulty: "hard",
    durationMin: 15,
    suitableFor: {},
  },
  {
    id: "p-stadt-spaziergang",
    title: "Stadtspaziergang in moderater Fußgängerzone",
    shortDesc: "Die Endprüfung — Stadtbummel mit lockerer Leine",
    intro: "Jetzt zeigt sich was {dogName} gelernt hat: ein Spaziergang durch eine moderate Fußgängerzone, voll mit Reizen.",
    steps: [
      "Wähle eine ruhigere Fußgängerzone, nicht den Hauptboulevard.",
      "Beginne früh mit SCHAU vor der Tür.",
      "Alle bekannten Strategien einsetzen: SCHAU, BOGEN, Richtungswechsel.",
      "Bei Stress: rausgehen, kein Ego-Trip.",
      "Nutze Schnüffel-Pausen aktiv als Cool-Down.",
      "Halte den Spaziergang kurz, max 30 Min.",
      "Beende immer in einer ruhigen Situation.",
    ],
    phase: "generalisierung",
    difficulty: "hard",
    durationMin: 20,
    suitableFor: { minAgeMonths: 12 },
  },
  {
    id: "p-wartungs-spaziergang",
    title: "Wartungs-Spaziergang im Alltag",
    shortDesc: "Was wir gelernt haben in den Alltag tragen",
    intro: "{dogName}s neue Verhaltensmuster werden zur Alltagsroutine. Du musst nicht mehr trainieren — du lebst es.",
    steps: [
      "Reduziere bewusst die Belohnungs-Frequenz: alle 30 Schritte statt alle 10.",
      "Belohne weiterhin Spitzenleistungen mit Jackpot.",
      "Beobachte ob {dogName} ohne Belohnung die Strategien zeigt.",
      "Wenn ja: weiter reduzieren, in kleinen Schritten.",
      "Wenn nein: kurz zurück zur höheren Frequenz.",
      "Über die Zeit entwickelt sich ein Alltagsmodus.",
      "Nicht mehr Training, sondern gemeinsames Leben.",
    ],
    phase: "generalisierung",
    difficulty: "medium",
    durationMin: 10,
    suitableFor: {},
  },
];

// ════════════════════════════════════════════════════════════════════
// Library-Registry
// ════════════════════════════════════════════════════════════════════

export const EXERCISE_LIBRARY: Record<ProblemKey, ExerciseTemplate[]> = {
  pulling: PULLING_EXERCISES,
  // weitere Problem-Bereiche kommen in Phase 2:
  barking: [],
  aggression: [],
  anxiety: [],
  recall: [],
  energy: [],
  jumping: [],
  destructive: [],
  soiling: [],
  mouthing: [],
};

// ════════════════════════════════════════════════════════════════════
// Helper: Problem-Label (deutsch) — fuer Plan-Titel + Intros
// ════════════════════════════════════════════════════════════════════

export const PROBLEM_LABELS_DE: Record<ProblemKey, string> = {
  pulling: "Leinenziehen",
  barking: "übermäßiges Bellen",
  aggression: "Aggression in Begegnungen",
  anxiety: "Trennungsangst",
  recall: "unzuverlässiger Rückruf",
  energy: "zu viel Energie",
  jumping: "Anspringen von Menschen",
  destructive: "Zerstörungsverhalten",
  soiling: "Stubenreinheit",
  mouthing: "Aufnehmen von Gegenständen",
};
