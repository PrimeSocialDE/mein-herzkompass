// Plan-Composer — deterministisch + super schnell.
//
// Nimmt:
//   - Problem-Key (pulling, barking, ...)
//   - Hund-Profil (Name, Rasse, Alter, Größe, Trainingszeit)
//   - Plan-Länge (1/3/6 Monate)
//
// Liefert: TrainingPlanContent — das gleiche JSON-Schema das schon
// im PDF-Renderer (generate-plan-from-content.mjs) und im
// Mitgliederbereich gerendert wird.
//
// Geschwindigkeit: <50ms (rein synchron, kein Network-Call).
//
// Optional: lib/plan-intro-ai.ts ergänzt den introText via Claude-Haiku
// (3-5 Sekunden).

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
  dogAgeMonths?: number;     // 6, 24, 84 etc.
  dogSize?: "small" | "medium" | "large";
  trainingsZeitMinuten?: number; // 10/15/20/30
  isSenior?: boolean;        // shortcut
  bekannteSignale?: string[]; // ["Sitz", "Platz"]
}

export interface ComposeArgs {
  problem: ProblemKey;
  planLengthMonths: 1 | 3 | 6;
  dog: DogProfile;
  introText?: string;        // optional: AI-personalisierte Einleitung
  abschlussText?: string;    // optional: AI-personalisierter Abschluss
}

// ── Personalisierungs-Helper ───────────────────────────────────────
function personalize(text: string, dog: DogProfile): string {
  return text.replace(/\{dogName\}/g, dog.dogName || "deinem Hund");
}

// ── Pool-Filter: welche Übungen passen zum Hund? ────────────────────
function filterSuitable(
  pool: ExerciseTemplate[],
  dog: DogProfile
): ExerciseTemplate[] {
  return pool.filter((ex) => {
    const s = ex.suitableFor;
    if (s.minAgeMonths && dog.dogAgeMonths != null && dog.dogAgeMonths < s.minAgeMonths) {
      return false;
    }
    if (s.notForBreeds && dog.dogBreed && s.notForBreeds.includes(dog.dogBreed.toLowerCase())) {
      return false;
    }
    if (s.notForSeniors && dog.isSenior) {
      return false;
    }
    return true;
  });
}

// ── Übungs-Auswahl pro Phase ────────────────────────────────────────
function pickForPhase(
  pool: ExerciseTemplate[],
  phase: Phase,
  count: number
): ExerciseTemplate[] {
  const phasePool = pool.filter((ex) => ex.phase === phase);
  if (phasePool.length === 0) return [];
  // Erst nach Schwierigkeit sortieren (easy → hard), dann nach Index in Pool
  const sorted = phasePool.slice().sort((a, b) => {
    const order = { easy: 0, medium: 1, hard: 2 };
    return order[a.difficulty] - order[b.difficulty];
  });
  // Wenn count > sorted.length, recycle (gleiche Übungen wiederholen)
  const out: ExerciseTemplate[] = [];
  for (let i = 0; i < count; i++) {
    out.push(sorted[i % sorted.length]);
  }
  return out;
}

// ── Wochen-Range pro Phase basierend auf Plan-Länge ───────────────
function phaseRanges(weeksTotal: number) {
  // Aufteilung: ~1/3 fundament, ~1/3 steigerung, ~1/3 generalisierung
  const fundamentEnd = Math.ceil(weeksTotal / 3);
  const steigerungEnd = Math.ceil((weeksTotal * 2) / 3);
  return {
    fundament: { start: 1, end: fundamentEnd },
    steigerung: { start: fundamentEnd + 1, end: steigerungEnd },
    generalisierung: { start: steigerungEnd + 1, end: weeksTotal },
  };
}

// ── Wochentitel + Wochenziele Templates pro Phase ──────────────────
const WEEK_TEMPLATES = {
  fundament: (weekNum: number, dogName: string, problemLabel: string) => ({
    title:
      weekNum === 1
        ? `Fundament, die ersten Schritte`
        : `Fundament Woche ${weekNum}, Grundlagen festigen`,
    wochenziele: [
      `${dogName} lernt die Grund-Signale dieser Woche zuverlässig.`,
      `Die Übungen finden drinnen oder in reizarmen Umgebungen statt.`,
      `Ihr baut eine ruhige, klare Trainings-Routine auf.`,
      `${dogName} erlebt dich als verlässlichen Anker.`,
    ],
    tagesplan: `Starte den Tag mit einer kurzen Übungs-Einheit von 3 Minuten in einem ruhigen Raum.\n\nÜbe mittags und abends weitere kurze Einheiten. Qualität schlägt Dauer. Halte alle Sessions kurz, damit ${dogName} aufmerksam und motiviert bleibt.`,
    no_gos: [
      `${dogName} überfordern mit zu langen Einheiten.`,
      `In aufgeregter Stimmung üben. Lieber später nochmal versuchen.`,
      `Schimpfen oder strafen. Das zerstört die Verknüpfung.`,
    ],
    fortschritt: [
      `${dogName} reagiert auf die Grund-Signale dieser Woche in 2 bis 3 Sekunden.`,
      `Die täglichen Trainingseinheiten sind in den Alltag integriert.`,
      `${dogName} bleibt während des Trainings entspannt und motiviert.`,
    ],
  }),
  steigerung: (weekNum: number, dogName: string, problemLabel: string) => ({
    title: `Steigerung Woche ${weekNum}, raus in die Welt`,
    wochenziele: [
      `${dogName} überträgt das Gelernte in den Außenbereich.`,
      `Ihr begegnet Reizen aus sicherer Distanz und meistert sie.`,
      `${dogName} entwickelt erste eigenständige Strategien.`,
      `Die Trainingseinheiten finden im Alltag statt.`,
    ],
    tagesplan: `Morgens: 15-Minuten-Spaziergang mit einer der Wochen-Übungen.\n\nMittags: kurze Wiederholung in ruhiger Umgebung.\n\nAbends: bewusster Alltags-Spaziergang mit Fokus auf die Hauptaufgabe der Woche. Plane bewusste Pausen zwischen den Reizen ein.`,
    no_gos: [
      `Zu schnell zu schwierige Situationen suchen.`,
      `Bei Stress weitermachen. Lieber Abstand vergrößern.`,
      `Die alte Routine aus Phase 1 vergessen. Sie ist die Basis.`,
    ],
    fortschritt: [
      `${dogName} reagiert draußen auf die Wochen-Signale.`,
      `Erste Begegnungen werden ohne starke Stresszeichen gemeistert.`,
      `Du erkennst ${dogName}s Schwellenwert und arbeitest darunter.`,
    ],
  }),
  generalisierung: (weekNum: number, dogName: string, problemLabel: string) => ({
    title: `Generalisierung Woche ${weekNum}, Alltagsmeisterung`,
    wochenziele: [
      `${dogName} setzt die gelernten Strategien selbstständig im Alltag ein.`,
      `Schwierigere Situationen werden zur Übungsgelegenheit, nicht zum Problem.`,
      `Du reduzierst bewusst dein Eingreifen. ${dogName} entscheidet mehr selbst.`,
      `Eure Routinen werden zur neuen Normalität.`,
    ],
    tagesplan: `Nutze den Hauptspaziergang als tägliche Trainingseinheit mit gezieltem Fokus.\n\nIntegriere die Wochen-Aufgabe in natürliche Alltagssituationen statt sie zu isolieren. Belohne ${dogName}s eigenständige gute Entscheidungen großzügig.`,
    no_gos: [
      `Zu viel Druck aufbauen wenn ${dogName} mal einen schlechten Tag hat.`,
      `Belohnung komplett weglassen. Auch jetzt noch verstärken.`,
      `Stagnation als Rückschritt sehen. Plateaus sind normal.`,
    ],
    fortschritt: [
      `${dogName} setzt mindestens 2 Strategien pro Spaziergang eigenständig ein.`,
      `Komplexe Situationen werden mit klarem Plan gemeistert.`,
      `Die Routinen fühlen sich für euch beide selbstverständlich an.`,
    ],
  }),
};

// ── Phase fuer eine Wochen-Nummer bestimmen ────────────────────────
function phaseForWeek(weekNum: number, weeksTotal: number): Phase {
  const ranges = phaseRanges(weeksTotal);
  if (weekNum <= ranges.fundament.end) return "fundament";
  if (weekNum <= ranges.steigerung.end) return "steigerung";
  return "generalisierung";
}

// ── Monats-Übersichten ─────────────────────────────────────────────
// Zwischenstand jeweils nach Woche 4, 8, 12 (etc.). Erklärt:
//  1) Was sollte jetzt schon klappen
//  2) Was du als naechstes anpassen kannst
//  3) Wann es Sinn macht eine Stufe zurueckzugehen
function buildMonatsUebersichten(
  weeksTotal: number,
  monthsTotal: number,
  dog: DogProfile,
  problemLabel: string
): Array<{ monat: number; text: string }> {
  const dogName = dog.dogName || "dein Hund";
  const out: Array<{ monat: number; text: string }> = [];

  for (let m = 1; m <= monthsTotal; m++) {
    const isFirst = m === 1;
    const isLast = m === monthsTotal;
    const isMid = !isFirst && !isLast;

    let text: string;

    if (isFirst) {
      text = `Nach den ersten 4 Wochen ist das Fundament gelegt. ${dogName} sollte jetzt die Grund-Signale dieser Phase zuverlässig kennen, sich auf das Trainings-Setting einlassen und in reizarmer Umgebung gut mitarbeiten.

Was du jetzt schon merken solltest: ${dogName} reagiert in 80% der Fälle innerhalb von wenigen Sekunden auf die Signale, die ihr in diesem Monat geübt habt. Ihr habt eine feste Trainings-Routine, die sich für euch beide normal anfühlt. ${dogName} kommt nach Übungen schneller wieder runter als zu Beginn.

Was du jetzt anpassen kannst: Wenn die Grund-Signale noch nicht sitzen, verlängere diese Phase um ein bis zwei Wochen. Lieber sauber aufbauen als zu früh in die nächste Stufe gehen. Wenn dagegen alles spielend leicht ist, kannst du schon zaghaft mit Reizen aus mittlerer Distanz arbeiten.

Was vermeidet: jetzt schon volle Alltags-Situationen suchen. ${dogName} braucht das Fundament, sonst bricht der ganze Plan später ein.`;
    } else if (isMid) {
      text = `Halbzeit. ${dogName} sollte das Gelernte jetzt aus der reizarmen Komfort-Zone nach draußen verlagert haben. Erste Begegnungen, leichte Ablenkungen und kontrollierte Alltags-Situationen werden zunehmend besser bewältigt.

Was du jetzt schon merken solltest: ${dogName} schaut bei Reizen draußen häufiger zu dir, statt zu fixieren. Spaziergänge fühlen sich entspannter an als vor 4 Wochen. Du erkennst ${dogName}s Schwellenwert sicher und arbeitest meist darunter.

Was du jetzt anpassen kannst: Wenn ${dogName} noch viel Stress draußen zeigt, geh nochmal zurück und mach die Reize kleiner oder die Distanz größer. Geduld zahlt sich aus. Wenn ${dogName} dagegen souverän reagiert, kannst du langsam die Schwierigkeit hochfahren: schwierigere Orte, längere Begegnungen, mehr Reize.

Was vermeidet: Erfolge zu schnell als selbstverständlich nehmen. Plateaus sind normal. Wer jetzt durchhält, hat in Monat 3 die deutlichsten Sprünge.`;
    } else {
      text = `Auf der Zielgeraden. In den letzten 4 Wochen geht es darum, dass ${dogName} das Gelernte selbstständig im echten Alltag einsetzt. Ohne ständige Belohnung. Ohne dass du dauernd eingreifen musst.

Was du jetzt schon merken solltest: ${dogName} setzt mindestens zwei der Strategien pro Spaziergang von alleine ein, ohne dass du sie ansagen musst. Komplexe Situationen werden mit klarem Plan gemeistert. Eure Routinen fühlen sich wie eure neue Normalität an, nicht mehr wie Training.

Was du jetzt anpassen kannst: Reduziere bewusst die Belohnungs-Frequenz. Belohne weniger oft, aber bei Spitzenleistungen großzügig. Wenn ${dogName} ohne Belohnung nicht mehr mitmacht, ist die Reduktion zu schnell gegangen, einen Schritt zurück.

Was nach diesem Plan kommt: keine harte Trennung. Die guten Routinen bleiben dauerhaft. Plane dir alle 3 bis 4 Monate ein kleines Wartungs-Ritual ein, ein bewusster Übungs-Spaziergang an einem schwierigen Ort. Das hält die Verknüpfungen frisch.`;
    }

    out.push({ monat: m, text });
  }

  return out;
}

// ── Zusatz-Spiele (kommen aus shared bonus pool) ───────────────────
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
    warum:
      "Nasenarbeit macht müde, ruhig und zufrieden. Stärkt Selbstständigkeit und Frustrationstoleranz.",
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
    warum:
      "{dogName} lernt sich aktiv an dir zu orientieren. Ideal bei Unsicherheit oder Ablenkung.",
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
    warum:
      "{dogName} lernt Erregung zu regulieren. Spiel und Kontrolle schließen sich nicht aus.",
  },
];

// ════════════════════════════════════════════════════════════════════
// Hauptfunktion: Plan zusammenbauen
// ════════════════════════════════════════════════════════════════════

export function composePlan(args: ComposeArgs): TrainingPlanContent {
  const { problem, planLengthMonths, dog, introText, abschlussText } = args;
  const weeksTotal = planLengthMonths * 4;
  const monthsTotal = planLengthMonths;

  const problemLabel = PROBLEM_LABELS_DE[problem] || problem;
  const dogName = dog.dogName || "deinem Hund";

  // Pool fuer das Problem holen + nach Hund filtern
  let rawPool = EXERCISE_LIBRARY[problem] || [];
  let usedFallback = false;
  if (rawPool.length === 0) {
    // Phase 1 POC: nur pulling hat Library-Content. Fallback fuer
    // andere Probleme — bis Phase 2 alle Bereiche befuellt sind.
    rawPool = EXERCISE_LIBRARY.pulling || [];
    usedFallback = true;
    console.warn(
      `[plan-composer] kein Pool fuer "${problem}" — Fallback auf pulling`
    );
  }
  let pool = filterSuitable(rawPool, dog);
  if (pool.length === 0) {
    // Filter zu aggressiv — Filter ignorieren als letzte Notbremse
    pool = rawPool;
  }

  // Pro Phase: wie viele Übungs-Slots brauchen wir? Je Woche 2 Übungen.
  const ranges = phaseRanges(weeksTotal);
  const fundamentWeeks = ranges.fundament.end - ranges.fundament.start + 1;
  const steigerungWeeks = ranges.steigerung.end - ranges.steigerung.start + 1;
  const generalisierungWeeks = ranges.generalisierung.end - ranges.generalisierung.start + 1;

  // Übungen pro Phase: 2 pro Woche
  const fundamentExs = pickForPhase(pool, "fundament", fundamentWeeks * 2);
  const steigerungExs = pickForPhase(pool, "steigerung", steigerungWeeks * 2);
  const generalisierungExs = pickForPhase(pool, "generalisierung", generalisierungWeeks * 2);

  // Alle Phasen-Übungen aneinanderreihen
  const allWeekExercises = [
    ...fundamentExs,
    ...steigerungExs,
    ...generalisierungExs,
  ];

  // Wochen bauen
  const weeks = [];
  for (let w = 1; w <= weeksTotal; w++) {
    const phase = phaseForWeek(w, weeksTotal);
    const tpl = WEEK_TEMPLATES[phase](w, dogName, problemLabel);

    // 2 Übungen pro Woche (Slot 0+1)
    const slotA = allWeekExercises[(w - 1) * 2];
    const slotB = allWeekExercises[(w - 1) * 2 + 1];

    weeks.push({
      num: w,
      title: tpl.title,
      wochenziele: tpl.wochenziele,
      tagesplan: tpl.tagesplan,
      no_gos: tpl.no_gos,
      fortschritt: tpl.fortschritt,
      uebungen: [
        {
          name: personalize(slotA.title, dog),
          schritte: slotA.steps.map((s) => personalize(s, dog)),
        },
        ...(slotB && slotB.id !== slotA.id
          ? [
              {
                name: personalize(slotB.title, dog),
                schritte: slotB.steps.map((s) => personalize(s, dog)),
              },
            ]
          : []),
      ],
    });
  }

  // Intro: personalisiert oder template
  const fallbackEinleitung = `Dieser Trainingsplan wurde speziell für ${dogName} und das Thema ${problemLabel} entwickelt. Er begleitet dich über ${weeksTotal} Wochen Schritt für Schritt, vom ruhigen Fundament drinnen bis zur souveränen Bewältigung schwieriger Alltagssituationen.\n\nJede Übung ist so gestaltet, dass du sie ohne Vorkenntnisse umsetzen kannst. Du brauchst weiche Leckerlis, eine Leine, eine Decke und vor allem Geduld.`;
  const fallbackAufbau = `Der Plan ist in drei Phasen gegliedert: Fundament (drinnen, reizarm), Steigerung (raus, kontrolliert) und Generalisierung (echter Alltag). Jede Woche enthält klare Wochenziele, einen Tagesplan und 2 Kernübungen mit Schritt-für-Schritt-Anleitung.\n\nEin bis zwei gut gemachte Trainingseinheiten pro Tag reichen. Qualität schlägt Dauer.`;
  const fallbackZiele = `Am Ende der ${weeksTotal} Wochen soll ${dogName} ${problemLabel} deutlich besser bewältigen können. Nicht durch Strafe oder Druck, sondern durch positive Verstärkung und klare Routinen. Du wirst ${dogName} besser verstehen und gemeinsam einen ruhigeren Alltag haben.`;

  return {
    intro: {
      headline: `${planLengthMonths}-Monatsplan für ${dogName}`,
      einleitung: introText || fallbackEinleitung,
      aufbau: fallbackAufbau,
      ziele: fallbackZiele,
    },
    weeks,
    monats_uebersichten: buildMonatsUebersichten(weeksTotal, monthsTotal, dog, problemLabel),
    abschluss:
      abschlussText ||
      `Du hast ${dogName} über ${weeksTotal} Wochen systematisch begleitet, das ist eine echte Leistung. Halte die Routinen aufrecht, beobachte die kleinen Fortschritte und bleib geduldig mit euch beiden. Veränderung ist keine Linie, sondern eine Welle.`,
    zusatz_spiele: BONUS_SPIELE.map((bs) => ({
      ...bs,
      schritte: bs.schritte.map((s) => personalize(s, dog)),
      warum: personalize(bs.warum, dog),
    })),
  };
}
