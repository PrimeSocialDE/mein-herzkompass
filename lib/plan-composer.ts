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
  trainingsZeitMinuten?: number;
  isSenior?: boolean;
  bekannteSignale?: string[];
}

export interface ComposeArgs {
  problem: ProblemKey;
  planLengthMonths: 1 | 3 | 6;
  dog: DogProfile;
  introText?: string;
  abschlussText?: string;
  customProblemText?: string;
}

// ── Personalisierungs-Helper ───────────────────────────────────────
function personalize(text: string, dog: DogProfile): string {
  return text.replace(/\{dogName\}/g, dog.dogName || "deinem Hund");
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
      ],
      exerciseIds: ["p-schau"],
    },
    {
      title: "Sei ein Baum: Die Kerntechnik drinnen",
      schwerpunkt: "Das ist die wichtigste Woche des ganzen Plans. {dogName} lernt die Mechanik, die wir später draußen einsetzen: straffe Leine = du stehst still, lockere Leine = es geht weiter. Wenn das drinnen sauber sitzt, ist 80% der Leinen-Arbeit erledigt.",
      wochenziele: [
        "{dogName} stoppt bei straffer Leine und orientiert sich zurück zu dir.",
        "Du selbst bleibst ruhig, schweigsam und ohne Ruck wenn die Leine straff wird.",
        "{dogName} versteht das Prinzip: Pullen führt nicht weiter, sondern zum Stillstand.",
      ],
      tagesplan: "Zweimal täglich 5-7 Minuten Lockere-Leine-Training in Wohnung oder Flur. Geh in deinem normalen Tempo, Leine locker. Sobald sie straff wird: sofort stehen bleiben, KEINE Worte, KEIN Ruck. Wenn {dogName} nachgibt: ruhig FEIN, weitergehen. Erwarte in den ersten Tagen 15-25 Stopps pro Session. Das ist nicht Frust, das ist Lernkurve.",
      no_gos: [
        "An der Leine rucken oder ziehen wenn sie straff ist. Das macht Pulling schlimmer.",
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
        "Belohnung vor dem Körper geben. Damit lockst du nach vorne und förderst Pullen.",
        "{dogName} an die Bein-Position locken statt zu warten. Sie soll von selbst kommen.",
        "Mit großen Schritten arbeiten, kleine Schritte machen die Position klarer.",
      ],
      fortschritt: [
        "{dogName} kommt nach 1-2 Sekunden Stand selbstständig in Bein-Position.",
        "10 Schritte am Stück ohne Vorlaufen sind machbar.",
        "Die Leine bleibt während der Bei-Fuß-Sequenz durchgehend locker.",
      ],
      exerciseIds: ["p-bei-fuss-belohnen"],
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
    // Wochen 5-8 nur fuer 6-Monats-Plan: Vertiefung Fundament
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
        "Pulling-Episoden 'durchwinken' weil ihr eilig seid. Konsequenz ist alles.",
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
      schwerpunkt: "Die Stopp-Technik raus an die ruhige Straße. {dogName} wird verwundert sein, dass die alten Pull-Routinen plötzlich nicht mehr funktionieren. Erwarte 30-50 Stopps in der ersten Session. Jeder Stopp ist ein Lernmoment, nicht ein Rückschritt.",
      wochenziele: [
        "Sei-ein-Baum funktioniert auf einer ruhigen Straße oder im Hof.",
        "Du planst die Spaziergangs-Zeit verdoppelt ein, ohne Stress.",
        "{dogName} versteht: die Mechanik ist drinnen wie draußen identisch.",
      ],
      tagesplan: "Plane den Hauptspaziergang dieser Woche mit doppelter Zeit ein. Wähle eine ruhige Straße ohne Hauptverkehr, ohne Hundeauslaufzone. Geh los wie immer und mache Sei-ein-Baum bei jeder straffen Leine, ohne Wort, ohne Ruck. Mache zwischendurch alle 30 Schritte ein Leckerli an der Bein-Position wenn locker. Beende immer in einer lockeren Phase, nicht nach Pulling.",
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
      exerciseIds: ["p-baum-draussen"],
    },
    {
      title: "Penalty Yards: Wenn Stoppen nicht reicht",
      schwerpunkt: "Manche Hunde brauchen mehr als nur Stillstand. Wenn {dogName} weiter zieht trotz 30 Sekunden Statue, drehst du um und gehst zurück. Pullen wird zur Sackgasse. Diese Technik nutzt du gezielt, nicht ständig — sonst verliert sie ihre Lerner-Wirkung.",
      wochenziele: [
        "Du setzt Penalty Yards bewusst nur bei hartnäckigem Ziehen ein, max 5x pro Spaziergang.",
        "{dogName} versteht: Pullen führt nicht zum Ziel, sondern weg davon.",
        "Sei-ein-Baum bleibt die erste Wahl, Penalty Yards die zweite.",
      ],
      tagesplan: "Pro Spaziergang: erstmal weiter Sei-ein-Baum konsequent. NUR wenn {dogName} 30+ Sekunden nicht nachgibt, gehst du Penalty-Yards-Modus: ruhig umdrehen, 5 Schritte zurück, dann wieder in die ursprüngliche Richtung mit Belohnungsdusche an der Bein-Position. Maximal 5 Penalty-Episoden pro Spaziergang, sonst wird's frustrierend.",
      no_gos: [
        "Penalty Yards bei JEDEM Pulling einsetzen, das stumpft ab.",
        "Ruckartig umdrehen oder genervt wirken. Bewegung ist die Botschaft, nicht Strafe.",
        "Beim Wieder-richtig-laufen NICHT belohnen. Die Belohnung beim Wiederaufnehmen ist der ganze Lerneffekt.",
      ],
      fortschritt: [
        "Penalty-Yards-Episoden pro Spaziergang nehmen über die Woche ab.",
        "{dogName} reagiert schneller auf den ersten Stopp (Sei-ein-Baum) und braucht seltener Penalty.",
        "Du nutzt Penalty Yards ohne nachzudenken, wenn die Situation es braucht.",
      ],
      exerciseIds: ["p-penalty-yards"],
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
      exerciseIds: ["p-bei-fuss-belohnen", "p-baum-draussen"],
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
      exerciseIds: ["p-tempo-wechsel", "p-richtungswechsel-aussen"],
    },
    {
      title: "Begegnungen aus Distanz arbeiten",
      schwerpunkt: "Erste kontrollierte Begegnungen mit Hunden oder Joggern, aus 15-20m. {dogName} lernt: Reiz erscheint = Leckerli kommt, nicht Aufregung. Diese Woche ist relevant wenn {dogName}s Pullen mit Reaktivität verbunden ist.",
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
      exerciseIds: ["p-gegenkonditionierung", "p-baum-draussen"],
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
      exerciseIds: ["p-bogen"],
    },
    {
      title: "Längere Trainings-Spaziergänge",
      schwerpunkt: "Bis jetzt waren Trainings-Phasen 10-15 Minuten lang. Diese Woche werden sie auf 25-30 Minuten erweitert. {dogName} entwickelt Ausdauer im aufmerksamen Mitgehen. Die Belohnungs-Dichte bleibt aber hoch.",
      wochenziele: [
        "{dogName} bleibt 25-30 Minuten am Stück konzentriert.",
        "Pausen werden aktiv genutzt als Belohnung (Schnüffeln, Trinken).",
        "Die Belohnungs-Dichte ist klar gestaffelt: erste 10 Min hoch, mittlere 10 Min mittel, letzte 5 Min wieder hoch.",
      ],
      tagesplan: "An 3 Tagen dieser Woche einen 25-30-Minuten-Trainings-Spaziergang. Aufbau: 5 Min Bei-Fuß-Aufwärmen mit hoher Belohnungs-Frequenz, 15 Min normale Strecke mit Sei-ein-Baum und Tempo-Wechsel, 5 Min Bei-Fuß-Cool-Down. Bewusste Schnüffel-Pausen alle 7-10 Minuten als BELOHNUNG für lockere Leine.",
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
      exerciseIds: ["p-baum-draussen", "p-tempo-wechsel"],
    },
    {
      title: "Festigung Steigerung",
      schwerpunkt: "Letzte Steigerungs-Woche. Du kombinierst alle Werkzeuge: Sei-ein-Baum, Penalty Yards, Bei-Fuß, Tempo-Wechsel. {dogName} hat ein komplettes Repertoire. Phase 3 = Anwendung im echten Alltag, ohne kontrollierte Übungs-Sessions.",
      wochenziele: [
        "Alle Werkzeuge können flexibel kombiniert werden.",
        "Du erkennst klar, welches Werkzeug welche Situation braucht.",
        "{dogName} setzt einzelne Strategien (vor allem Bei-Fuß-Suche) schon teilweise selbstständig ein.",
      ],
      tagesplan: "Jeder Spaziergang dieser Woche ist ein Mini-Test. Beobachte aktiv: welche Strategie greift in welcher Situation? Mache am Ende der Woche eine Bilanz: was funktioniert, was wackelt. Notiere typische Pull-Situationen die übrig bleiben. Die sind dein Schwerpunkt für Phase 3.",
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
      exerciseIds: ["p-baum-draussen", "p-penalty-yards"],
    },
  ],
  generalisierung: [
    {
      title: "Lockere Leine im echten Alltagsspaziergang",
      schwerpunkt: "Phase 3 ist Anwendung. Alle Werkzeuge kommen jetzt auf einer normalen Strecke zum Einsatz, ohne kontrollierte Übungs-Sessions. Schnüffel-Pausen werden zur natürlichsten Belohnung: lockere Leine = du darfst hin und schnüffeln.",
      wochenziele: [
        "{dogName} bewältigt einen 25-Minuten-Alltagsspaziergang mit max 5 echten Pull-Episoden.",
        "Du nutzt Schnüffel-Pausen bewusst als Belohnung für lockere Leine.",
        "Werkzeuge (Stopp, Bei-Fuß, Tempo) werden flüssig kombiniert ohne Nachdenken.",
      ],
      tagesplan: "An 5 von 7 Tagen einen normalen 25-30-Minuten-Spaziergang auf bekannter Strecke. Starte mit 2-3 Minuten Bei-Fuß-Belohnen, dann frei laufen mit Sei-ein-Baum bei straffer Leine. Alle 30-40 Schritte ein Leckerli an der Bein-Position wenn locker. Schnüffel-Pausen aktiv als Belohnung: 'lockere Leine = du darfst hin und schnüffeln'.",
      no_gos: [
        "Bei Stress oder Eile die Werkzeuge weglassen. Lieber Strecke kürzen.",
        "Schnüffel-Pausen mitten in Pull-Phase erlauben. Erst Locker-Werden, dann darf geschnuppert werden.",
        "Belohnungs-Frequenz schon stark reduzieren, das passiert in Woche 4.",
      ],
      fortschritt: [
        "Pull-Episoden pro Spaziergang sind im einstelligen Bereich.",
        "{dogName} sucht von selbst die Bein-Position an unsicheren Stellen.",
        "Du nutzt Schnüffel-Pausen intuitiv als Belohnungs-Instrument.",
      ],
      exerciseIds: ["p-lockere-leine-aussen"],
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
        "Pull-Pattern reduziert sich strecken-übergreifend.",
      ],
      exerciseIds: ["p-lockere-leine-aussen", "p-richtungswechsel-aussen"],
    },
    {
      title: "Vorbeigehen an Menschen ohne Bogen",
      schwerpunkt: "Bei Hunden mit reaktivem Pulling-Anteil ist das die nächste Stufe nach BOGEN. {dogName} lernt direkt an Menschen aus 3-5m vorbeizugehen, ohne Bogen, ohne Tempo-Wechsel. Falls {dogName} rein zieht ohne Reaktivität: einfach normale Lockere-Leine-Arbeit weiterführen.",
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
      exerciseIds: ["p-vorbeigang", "p-lockere-leine-aussen"],
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
      exerciseIds: ["p-wartungs-spaziergang"],
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
      schwerpunkt: "Eine moderate Fußgängerzone. Alle Werkzeuge in echtem Stadtleben. Wenn das funktioniert, hast du keinen Pulling-Hund mehr, sondern einen Hund der mit dir durch die Welt geht.",
      wochenziele: [
        "{dogName} bewältigt einen 20-25-Minuten-Bummel in moderater Stadt.",
        "Werkzeuge werden flexibel kombiniert je nach Situation.",
        "Ihr findet einen Stadt-Spaziergang der sich für euch beide gut anfühlt.",
      ],
      tagesplan: "Plane einmal in der Woche einen bewussten Stadt-Spaziergang, am besten Sonntagvormittag wenn weniger los ist. Maximal 25 Minuten. Beginne mit 3 Minuten Bei-Fuß-Aufwärmen vor der Tür. Schnüffel-Pausen aktiv als Cool-Down zwischen Reiz-Phasen einsetzen. Beende immer in einer ruhigen Ecke.",
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
      exerciseIds: ["p-stadt-spaziergang", "p-lockere-leine-aussen"],
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
      exerciseIds: ["p-wartungs-spaziergang"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// ENERGY (zu viel Energie / Hyperarousal) — Auslastung & Ruhe-Training
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
      ],
      exerciseIds: ["e-entspannungs-marker"],
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
      exerciseIds: ["e-warte-impuls"],
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
      exerciseIds: ["e-entspannungs-marker"],
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
      tagesplan: "Eine 5-7 Min Shape-Session täglich, am besten am Nachmittag oder Abend. Wähle einen einfachen Trick. Pro Session 10-15 Klicks. Beende immer in einem Erfolgs-Moment. Nach der Session: Cool-Down auf der Decke.",
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
      exerciseIds: ["e-shape-trick"],
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
      tagesplan: "Mache 1x täglich einen 30-Min Spaziergang als 'Auslastungs-Hybrid': 5 Min stumpf laufen + 10 Min Such-Spiel mit Leckerlis im Gras + 5 Min Trick-Wiederholung + 5 Min lockerer Spaziergang + 5 Min Cool-Down beim Sitzen unter einem Baum.",
      no_gos: [
        "Aktivitäten zu schnell wechseln — {dogName} kommt nicht rein.",
        "Im Wechsel hektisch werden, ruhiger Übergang ist wichtig.",
        "Nach dieser Session noch eine zweite anstrengende — wäre Übermüdung.",
      ],
      fortschritt: [
        "{dogName} ist nach 30 Min sichtbar erschöpft.",
        "Nach Cool-Down findet {dogName} schnell in Ruhe.",
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
      title: "Nasenarbeit draußen: Mantrailing-Basis",
      schwerpunkt: "Nasenarbeit draußen ist die intensivste Auslastung überhaupt. 15-20 Min Mantrailing ersetzen 60 Min stumpfes Laufen, plus {dogName} ist mental erschöpft und zufrieden.",
      wochenziele: [
        "{dogName} folgt einer 10-15m Futterspur selbstständig.",
        "Mantrailing-Einheit pro Spaziergang etabliert.",
        "{dogName} ist nach der Übung sichtbar erschöpft.",
      ],
      tagesplan: "Pro Spaziergang 1 Mantrailing-Einheit: 10m Futter-Spur an einer ruhigen Stelle (Garten, Wiese, Park-Rand) auslegen. {dogName} darf 5 Min später folgen. Steigerung: 20m Spur, dann 30m, dann mit kleinen Ablenkungen drumherum.",
      no_gos: [
        "Mantrailing in stark frequentierten Bereichen — Konzentration unmöglich.",
        "{dogName} drängen oder die Spur zeigen — Spaß und Lerneffekt weg.",
        "Spur zu lang machen am Anfang — überfordert.",
      ],
      fortschritt: [
        "{dogName} folgt einer 20m Spur selbstständig.",
        "Mantrailing wird zur Favoriten-Aktivität.",
        "Nach Mantrailing ist {dogName} ruhig und zufrieden.",
      ],
      exerciseIds: ["e-mantrailing-basis"],
    },
    {
      title: "Strukturierte Spaziergänge mit Such-Aufgaben",
      schwerpunkt: "Spaziergänge werden zu Trainings-Sessions. Alle 5-10 Min eine kleine Such-Aufgabe oder Trick. {dogName} bleibt mental engagiert, statt in Auto-Pilot-Modus zu gehen.",
      wochenziele: [
        "Jeder Spaziergang enthält mind. 3 Such- oder Trick-Phasen.",
        "{dogName} bleibt im Spaziergang aufmerksam und ansprechbar.",
        "Stumpfes Vorwärtsziehen reduziert sich klar.",
      ],
      tagesplan: "Pro Spaziergang plane Stationen: nach 5 Min: Leckerli werfen + SUCH. Nach 10 Min: 1 Trick. Nach 15 Min: Mantrailing-Mini-Spur. Spaziergang wird zur Aktivitäts-Reihe, nicht zur Strecke. Pausen zum Schnüffeln sind aktiv eingebaut.",
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
      title: "Stop-Spiel: Aufregung unterbrechen lernen",
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
      exerciseIds: ["e-stop-spiel"],
    },
    {
      title: "Cool-Down nach jedem Spaziergang",
      schwerpunkt: "Nach jeder aufregenden Phase kommt eine bewusste 5-10 Min Cool-Down. {dogName} lernt: Aufregung endet aktiv, nicht von allein. Das ist Ruhe als trainierbare Fähigkeit.",
      wochenziele: [
        "{dogName} kennt die Cool-Down-Sequenz und kommt schneller runter.",
        "Cool-Down wird zur normalen Routine nach Spaziergängen.",
        "{dogName}s Tagespegel ist ruhiger geworden.",
      ],
      tagesplan: "Nach jedem Spaziergang: 5-10 Min Cool-Down auf der Decke. Setze dich daneben, ruhige Hand auf Schulterblatt, tiefes Atmen. Entspannungs-Marker WUNDERBAR alle 60 Sek. Erst nach Cool-Down-Phase darf {dogName} normal aktiv werden.",
      no_gos: [
        "Cool-Down auslassen, weil 'zu eilig'.",
        "Nach Spaziergang sofort {dogName} mit etwas Aufregendem konfrontieren.",
        "Cool-Down erzwingen — {dogName} muss lernen dürfen.",
      ],
      fortschritt: [
        "{dogName} sucht von selbst die Decke nach Aufregung auf.",
        "Cool-Down dauert kürzer, weil schon ankommt.",
        "Spaziergänge enden in Ruhe, nicht im Chaos.",
      ],
      exerciseIds: ["e-cool-down-decke"],
    },
    {
      title: "Längere Kopfarbeits-Sessions",
      schwerpunkt: "Shape-Training wird auf 10-15 Min ausgedehnt, mit mehreren Tricks parallel. {dogName} lernt Konzentration über längere Zeit, was Hyperaktivität direkt entgegenwirkt.",
      wochenziele: [
        "{dogName} bleibt 10-15 Min konzentriert in einer Trick-Session.",
        "Mind. 3 Tricks aktiv im Repertoire.",
        "Aufmerksamkeits-Spanne ist erkennbar erweitert.",
      ],
      tagesplan: "Eine 10-15 Min Trick-Session täglich, ruhiger Ort drinnen oder im Garten. Rotation der Tricks: 5 Min Trick 1, 5 Min Trick 2, 5 Min Trick 3. Pro Trick saubere Wiederholungen mit klarem FEIN, nicht hektisch.",
      no_gos: [
        "Trick-Anforderungen zu schnell steigern — {dogName} braucht Wiederholung.",
        "Mehrere neue Tricks parallel anfangen — Verwirrung.",
        "Trick-Session in Hyperarousal — erst Cool-Down.",
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
        "Nach Sozial-Kontakt kommt {dogName} schnell runter dank Cool-Down.",
      ],
      tagesplan: "1-2 mal pro Woche ein bewusster Sozial-Termin: 30-45 Min mit einem ruhigen, berechenbaren Hund. Niemals länger. Pausen alle 10-15 Min mit Leinen-Halt und Wasserpause. Direkt nach: 15 Min Cool-Down zu Hause.",
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
      schwerpunkt: "Letzte Steigerungs-Woche. Alle Auslastungs-Werkzeuge sind etabliert: Nasenarbeit, Kopfarbeit, Cool-Down, Stop-Spiel, kontrollierte Sozial-Kontakte. {dogName} ist ein anderer Hund als vor 8 Wochen.",
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
      tagesplan: "Erstelle einen Plan: pro Tag 1 körperlich (Spaziergang 30-60 Min), 1 Nasenarbeit (Suchspiel/Mantrailing), 1 Kopfarbeit (Shape/Kong). Sozial-Termin 2x pro Woche. Cool-Down nach allem Aufregenden. Plan an die Wand, abends Häkchen setzen.",
      no_gos: [
        "Plan nur für 1 Tag machen — Routine entsteht durch Wiederholung.",
        "Mehr als 2 hochaufregende Aktivitäten am selben Tag.",
        "Plan ohne explizite Ruhe-Phasen — die sind aktiv eingeplant.",
      ],
      fortschritt: [
        "{dogName} kennt die Tagesroutine.",
        "Auslastungs-Lücken zeigen sich am Verhalten — du erkennst das schnell.",
        "Du planst flexibel, aber mit klarer Struktur.",
      ],
      exerciseIds: ["e-auslastungs-plan"],
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
        "{dogName} ständig ansprechen oder streicheln in Ruhe-Phasen.",
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
      tagesplan: "Plane das Notfall-Paket: 10 Min Schnüffelmatte + 5 Min Trick-Wiederholung drinnen. ODER: 15 Min Mantrailing-Spur in der Wohnung. ODER: 1 anspruchsvoller Kong + Cool-Down. Test in dieser Woche an einem normalen Tag, damit {dogName} es kennt.",
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
      title: "Schwierige Trigger gezielt arbeiten",
      schwerpunkt: "Türklingel, Briefträger, Wildgeruch — die spezifischen Auslöser, die {dogName} regelmäßig hochfahren lassen. Diese Woche arbeitest du gezielt an euren persönlichen Hot-Spots.",
      wochenziele: [
        "Eure 2-3 wichtigsten Trigger sind klar identifiziert.",
        "{dogName} reagiert auf einen Haupttrigger erkennbar ruhiger.",
        "Du hast eine konkrete Strategie pro Trigger.",
      ],
      tagesplan: "Tag 1-2: identifiziere die 2-3 wichtigsten Trigger und notiere {dogName}s Reaktion. Tag 3-7: pro Trigger spezifische Strategie: Türklingel → KOMM-HER + Belohnung auf Decke. Briefträger → Decke + Kong vorbereiten wenn er sich nähert. Wildgeruch → kurze Leine + Such-Spiel als Ablenkung.",
      no_gos: [
        "Trigger ignorieren in der Hoffnung, dass es weggeht — passiert nicht.",
        "Strafe oder Lautstärke gegen den Trigger — verstärkt Hyperarousal.",
        "Mehrere Trigger gleichzeitig angehen — fokussiere.",
      ],
      fortschritt: [
        "{dogName} reagiert auf den Haupttrigger erkennbar ruhiger.",
        "Du hast Werkzeuge für jeden Trigger parat.",
        "Trigger werden zur Übungsgelegenheit, nicht zum Stress.",
      ],
      exerciseIds: ["e-anti-hyperarousal", "e-entspannungs-marker"],
    },
    {
      title: "Sozial-Setting im Park meistern",
      schwerpunkt: "Hundeparks und Begegnungen mit anderen Hunden überfordern oft. Diese Woche etablierst du Spielregeln: kurze Phasen, klare Cool-Down-Routinen, kein stundenlange Tobereien.",
      wochenziele: [
        "{dogName} bewältigt einen 20-30 Min Park-Aufenthalt ruhig.",
        "Du erkennst {dogName}s Überlastungs-Anzeichen sicher.",
        "Sozial-Kontakte sind erfüllend, nicht reizüberflutend.",
      ],
      tagesplan: "Plane in dieser Woche 2-3 bewusste Park-Termine: max 30 Min, alle 10 Min Pause mit Leinen-Halt und WUNDERBAR. Bei Anzeichen von Überdrehen: aktiv aussteigen, NICHT durchhalten. Direkt nach Park: 15 Min Cool-Down zu Hause.",
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
      title: "Anti-Hyperarousal-Routine etablieren",
      schwerpunkt: "Manche Tage gehen schief. {dogName} kommt nicht runter. Diese Woche festigst du eine klare 3-Schritt-Routine, die du in solchen Momenten reflexartig einsetzen kannst.",
      wochenziele: [
        "Die Anti-Hyperarousal-Routine sitzt: Reize raus, Decke, Marker.",
        "Du nutzt sie reflexartig, ohne nachzudenken.",
        "{dogName} kommt nach 10-15 Min auch aus stärkerem Hyperarousal runter.",
      ],
      tagesplan: "Übe die Routine bewusst 2-3 mal in dieser Woche: erzeuge leichte Aufregung (Tür-Klopfen simulieren, kurzes Spiel), dann sofort Routine: Reize reduzieren, auf Decke führen, WUNDERBAR und 10-15 Min daneben sitzen. {dogName} lernt: Aufregung kann immer aktiv beendet werden.",
      no_gos: [
        "Routine nur bei echtem Hyperarousal nutzen — ohne Übung funktioniert sie nicht im Notfall.",
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
      schwerpunkt: "Letzte Woche. Alle Werkzeuge sind etabliert. Auslastungsplan läuft, Ruhe ist Standard, Trigger-Strategien sitzen. {dogName} ist ein deutlich ausgeglichener Hund. Wartungs-Plan für die Zukunft.",
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
        "Hyperarousal ist Ausnahme, Ruhe ist Standard.",
      ],
      exerciseIds: ["e-auslastungs-plan"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// AGGRESSION (Aggression in Begegnungen) — Schwellenwert & Counter-Cond
// ────────────────────────────────────────────────────────────────────
const AGGRESSION_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Schwellenwert verstehen & dokumentieren",
      schwerpunkt: "Bevor du an der Reaktivität arbeitest, musst du wissen: ab welcher Distanz kann {dogName} noch LERNEN, ab wann reagiert sie nur noch? Das ist der Schwellenwert. Diese Woche identifizierst und notierst du ihn pro Trigger-Typ.",
      wochenziele: [
        "Du hast Schwellenwert-Distanzen für jeden Trigger-Typ notiert.",
        "Du erkennst frühe Stress-Signale (Mimik, Atmung, Schwanz) sicher.",
        "Du verstehst: jede Übung läuft UNTER Schwellenwert, niemals daran kratzen.",
      ],
      tagesplan: "An 4 Tagen dieser Woche: gezielte Beobachtungs-Sessions an einem Ort wo Trigger berechenbar auftreten. 50m Startdistanz, langsam testen. Notiere pro Trigger-Typ (Hund, Jogger, Fahrrad, Kind) die exakte Distanz, ab der erste Stress-Signale beginnen. Das sind deine Schwellenwerte für Phase 2.",
      no_gos: [
        "An Schwellenwert kratzen — sofort Distanz vergrößern bei Stress-Signalen.",
        "Mehrere Trigger gleichzeitig testen — pro Session ein Trigger.",
        "Aus der Beobachtung in Training übergehen — diese Woche nur Beobachtung.",
      ],
      fortschritt: [
        "Du hast eine schriftliche Karte der Schwellenwerte.",
        "Frühe Stress-Signale werden sicher erkannt.",
        "Du verstehst {dogName}s Reaktivität messbar.",
      ],
      exerciseIds: ["a-schwellenwert-finden"],
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
      exerciseIds: ["a-maulkorb-positiv"],
    },
    {
      title: "Look at That (LAT) drinnen aufbauen",
      schwerpunkt: "LAT ist das wichtigste Spiel im Aggressions-Training. {dogName} darf den Reiz ANSCHAUEN, muss aber dann zu dir zurückschauen. Wir starten drinnen mit harmlosen 'Reizen', bevor wir nach draußen gehen.",
      wochenziele: [
        "{dogName} versteht das LAT-Prinzip drinnen.",
        "Sie schaut nach dem Reiz innerhalb von 2 Sek zu dir.",
        "Belohnungs-Marker SCHAU + FEIN ist konditioniert.",
      ],
      tagesplan: "Drinnen Übungen mit gestellten 'Reizen': eine Tasse auf den Tisch stellen, ein Buch quer liegen lassen. {dogName} schaut hin → du sagst SCHAU + Klick + Leckerli. Wiederhole 5-7 mal pro Session, 3 Sessions täglich. {dogName} lernt: Reiz sehen = sofort zu dir gucken.",
      no_gos: [
        "Schon mit echten Outdoor-Triggern arbeiten — wir sind noch nicht bereit.",
        "{dogName} drängen — sie muss selbst zum Halter schauen.",
        "Belohnung zu spät geben — Timing ist alles bei LAT.",
      ],
      fortschritt: [
        "{dogName} versteht das LAT-Prinzip in der Wohnung.",
        "Belohnungs-Marker sind klar konditioniert.",
        "Du bist bereit, LAT in Phase 2 nach draußen zu übertragen.",
      ],
      exerciseIds: ["a-lat"],
    },
    {
      title: "Notfall-Protokoll konditionieren",
      schwerpunkt: "Manche Situationen lassen sich nicht vermeiden. Diese Woche etablierst du ein klares 5-Schritt-Notfall-Protokoll, das du reflexartig einsetzen kannst — bevor es eskaliert.",
      wochenziele: [
        "Du kennst die 5 Schritte auswendig und kannst sie reflexartig einsetzen.",
        "{dogName} kennt ein Abbruch-Signal das positiv konditioniert ist.",
        "Du fühlst dich für unvorhersehbare Begegnungen vorbereitet.",
      ],
      tagesplan: "Übe die Sequenz mehrmals in Trockenübungen: simuliere ein Trigger-Auftauchen, dann sofort: 1. ruhig bleiben, 2. ABBRUCH-Signal, 3. 90 Grad Wendung, 4. ruhig weggehen, 5. nach 50m Beruhigungs-Marker + Leckerli. Trainiere drinnen ohne echten Trigger.",
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
      exerciseIds: ["a-emergency-protokoll"],
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
        "Maulkorb-Sessions in Stress oder Hyperarousal.",
        "Maulkorb für längere Zeit allein lassen — er ist Hilfsmittel, keine Strafe.",
      ],
      fortschritt: [
        "Tragezeit klappt entspannt.",
        "{dogName} reagiert positiv auf Maulkorb-Vorbereitung.",
        "Maulkorb ist routinierter Teil eures Repertoires.",
      ],
      exerciseIds: ["a-maulkorb-positiv"],
    },
    {
      title: "LAT mit Mini-Reizen drinnen",
      schwerpunkt: "LAT wird in der Wohnung mit schwierigeren Reizen geübt: Geräusche, plötzliche Bewegungen, andere Familienmitglieder als 'Trigger'. {dogName} festigt das Prinzip.",
      wochenziele: [
        "LAT funktioniert bei 5+ verschiedenen Reizen drinnen.",
        "{dogName} schaut innerhalb von 1-2 Sek zum Halter.",
        "Belohnung kommt schnell und konsistent.",
      ],
      tagesplan: "Trainiere drinnen mit verschiedenen Reizen: Familienmitglied bewegt sich auffällig, Geräusch (Klingel-Aufnahme leise), Spielzeug fliegt durchs Zimmer. Pro Reiz LAT + Klick + Belohnung. 3-4 Sessions pro Tag, jede 5 Min.",
      no_gos: [
        "Reize zu intensiv — überfordert das junge LAT.",
        "Reize ohne SCHAU-Marker einsetzen — verwässert die Verknüpfung.",
        "{dogName} drängen — sie muss selbst zum Halter schauen.",
      ],
      fortschritt: [
        "LAT klappt bei verschiedenen Reizen drinnen.",
        "Reaktionszeit ist unter 2 Sek.",
        "Du bist bereit für echte Outdoor-Reize.",
      ],
      exerciseIds: ["a-lat"],
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
      exerciseIds: ["a-schwellenwert-finden"],
    },
    {
      title: "Fundament-Check vor Phase 2",
      schwerpunkt: "Letzte Fundament-Woche. Maulkorb positiv? Schwellenwerte bekannt? LAT drinnen sitzt? Notfall-Protokoll geübt? Diese Bausteine sind unverzichtbar für Phase 2 draußen.",
      wochenziele: [
        "Alle 4 Bausteine sind etabliert: Maulkorb, Schwellenwert, LAT, Notfall.",
        "Du fühlst dich vorbereitet für Outdoor-Training mit echten Triggern.",
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
      title: "LAT mit echten Triggern aus großer Distanz",
      schwerpunkt: "Jetzt geht's nach draußen. {dogName} sieht echte Trigger, aber aus großer Distanz (50m+, UNTER Schwellenwert). LAT wird zur Standard-Reaktion auf Reize.",
      wochenziele: [
        "LAT funktioniert outdoor bei 3+ Trigger-Typen.",
        "{dogName} bleibt unter Schwellenwert.",
        "Belohnungs-Dichte ist hoch (kein Sparen in dieser Phase).",
      ],
      tagesplan: "2 mal pro Woche dedizierte LAT-Sessions an einem Ort mit berechenbaren Triggern (Park-Rand, Joggingstrecke). Start-Distanz: 50m+. Pro Session 4-6 LAT-Episoden, dann beenden. Maulkorb-Backup für Notfälle.",
      no_gos: [
        "An Schwellenwert kratzen — verzweifeltes Lernen wird Reaktion.",
        "Belohnungs-Frequenz reduzieren — die kommt erst in Phase 3.",
        "Outdoor-LAT ohne sauberes Indoor-LAT — Fundament fehlt.",
      ],
      fortschritt: [
        "LAT funktioniert outdoor.",
        "Trigger lösen Aufmerksamkeits-Suche aus, nicht Reaktion.",
        "Du erkennst leichte Lernerfolge.",
      ],
      exerciseIds: ["a-lat"],
    },
    {
      title: "Engage-Disengage: aktive Reizabwendung",
      schwerpunkt: "Nächste Stufe nach LAT: {dogName} schaut den Trigger an und wendet sich DANN selbstständig ab. Du belohnst das Wegschauen mit Jackpot. {dogName} lernt: ich kann die Strategie selbst wählen.",
      wochenziele: [
        "{dogName} schaut nach Trigger-Sichtung von selbst weg.",
        "Wegschauen wird mit Jackpot belohnt.",
        "{dogName} entwickelt Selbst-Wahl-Verhalten.",
      ],
      tagesplan: "2-3 Engage-Disengage-Sessions pro Woche. Distanz wie bei LAT, aber jetzt warten auf das spontane Wegschauen. Wenn {dogName} hinschaut, dann von selbst wegschaut: Jackpot von 3 Leckerlis hintereinander. Wenn sie weiter starrt: leise SCHAU-Hint.",
      no_gos: [
        "{dogName} drängen oder Wegschauen erzwingen — der Lerneffekt geht verloren.",
        "Schon vor sauberem LAT zu Engage-Disengage übergehen.",
        "Belohnung zu klein machen — Jackpot ist hier essenziell.",
      ],
      fortschritt: [
        "{dogName} wendet sich von Triggern aktiv ab.",
        "Selbst-Regulation entsteht.",
        "Du musst weniger lenken.",
      ],
      exerciseIds: ["a-engage-disengage"],
    },
    {
      title: "BOGEN als aktive Strategie",
      schwerpunkt: "Wenn Trigger zu eng kommt: aktiver Bogen mit klarem Plan. Du hast vorher Fluchtwege identifiziert. {dogName} folgt dir in die Sicherheits-Zone, ohne dass Konflikt entsteht.",
      wochenziele: [
        "{dogName} folgt BOGEN-Signal zuverlässig.",
        "Du nutzt 2-3 Bogen-Sequenzen pro Spaziergang aktiv.",
        "Begegnungen werden mit Bogen ohne Eskalation gemeistert.",
      ],
      tagesplan: "Pro Spaziergang plane 2-3 echte Bogen-Situationen ein. Distanz mindestens 15m zum Trigger. Bogen entschieden, aber nicht panisch. Nach jeder erfolgreichen Begegnung: 3 Leckerlis + Beruhigungs-Marker.",
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
      exerciseIds: ["a-bogen-aktiv"],
    },
    {
      title: "Counter-Conditioning intensiv",
      schwerpunkt: "Diese Woche arbeitest du gezielt an der emotionalen Verknüpfung: Trigger erscheint = Leckerli kommt. Über Wochen wird der Trigger zum 'positiven' Signal, statt zum Stress-Auslöser.",
      wochenziele: [
        "{dogName} erwartet Leckerli wenn ein Trigger auftaucht.",
        "Stress-Anzeichen reduzieren sich.",
        "Die emotionale Verknüpfung verändert sich grundlegend.",
      ],
      tagesplan: "2-3 dedizierte Counter-Cond-Sessions: Ort mit Triggern in Distanz. Trigger taucht auf: SCHAU + füttern durchgehend solange Trigger sichtbar. Trigger weg = Leckerlis stop. {dogName} lernt: Trigger erscheint = Schlaraffenland.",
      no_gos: [
        "Erst nach Reaktion belohnen — verändert die emotionale Verknüpfung nicht.",
        "Belohnungs-Dichte zu niedrig.",
        "Zu nah ran — Distanz ist alles.",
      ],
      fortschritt: [
        "{dogName} schaut bei Triggern erwartungsvoll zu dir.",
        "Stress-Anzeichen werden kürzer und seltener.",
        "Trigger lösen positive statt negative Erwartung aus.",
      ],
      exerciseIds: ["a-lat", "a-engage-disengage"],
    },
    {
      title: "Distanz schrittweise reduzieren",
      schwerpunkt: "Nachdem LAT und Engage-Disengage aus großer Distanz sitzen, reduzierst du SCHRITTWEISE die Distanz. Aber: nur 1-2m pro Woche, nicht hektisch. Geduld zahlt sich hier mehr aus als überall sonst.",
      wochenziele: [
        "Schwellenwert-Distanz hat sich um 5-10m reduziert.",
        "{dogName} bleibt bei näheren Triggern unter Schwellenwert.",
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
      title: "BAT: Behavior Adjustment Training Einstieg",
      schwerpunkt: "BAT ist die Königs-Methode bei reaktiven Hunden. {dogName} hat eine Schleppleine, mehr Bewegungsfreiheit, und du belohnst SELBSTSTÄNDIGE Stress-Lösungs-Bewegungen mit Distanz. {dogName} bekommt Kontrolle zurück.",
      wochenziele: [
        "{dogName} versteht das BAT-Prinzip: stress-Lösung = Distanz wird größer.",
        "Sie zeigt eigenständig 3-4 Stress-Lösungs-Bewegungen.",
        "Sie wirkt sicherer und kontrollierter.",
      ],
      tagesplan: "1-2 BAT-Sessions pro Woche an ruhiger Stelle mit kontrollierbarem Trigger. Schleppleine 5m. {dogName} schaut Trigger an: du wartest. Sobald sie eine Stress-Lösung zeigt (Wegschauen, Sich-Schütteln, Boden lecken, schnüffeln): SOFORT mit ihr aktiv weggehen, weg vom Trigger.",
      no_gos: [
        "BAT in Reizüberflutung — funktioniert nur in kontrollierter Umgebung.",
        "{dogName} drängen oder Stress-Lösung erzwingen — gehört nicht zum Prinzip.",
        "Belohnung mit Leckerli — funktionale Belohnung (Distanz) ist hier essenziell.",
      ],
      fortschritt: [
        "{dogName} zeigt aktiv Stress-Lösungs-Verhalten.",
        "Sie wirkt sicherer und selbstkontrollierter.",
        "BAT wird zur normalen Methode.",
      ],
      exerciseIds: ["a-bat-distanz"],
    },
    {
      title: "Variabilität bei Triggern",
      schwerpunkt: "Bisher hast du an einzelnen Trigger-Typen gearbeitet. Diese Woche wechselst du gezielt: heute Hunde, morgen Jogger, übermorgen Fahrräder. {dogName} lernt: die Strategie ist immer gleich, egal welcher Trigger.",
      wochenziele: [
        "{dogName} setzt LAT/Bogen/Counter-Cond bei verschiedenen Triggern ein.",
        "Die Strategie ist generalisiert, nicht trigger-spezifisch.",
        "Du fühlst dich vorbereitet für unvorhersehbare Begegnungen.",
      ],
      tagesplan: "Plane gezielt: 1 Spaziergang dieser Woche mit Hund-Fokus, 1 mit Jogger-Fokus, 1 mit Fahrrad-Fokus. Pro Spaziergang dieselbe Strategie anwenden, andere Trigger gegebenenfalls vermeiden.",
      no_gos: [
        "Mehrere Trigger-Typen pro Spaziergang stapeln — überfordert.",
        "Strategie wechseln je nach Trigger — verwirrt.",
        "Erst bei drittem Trigger merken, dass {dogName} schon überreizt ist.",
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
      schwerpunkt: "Letzte Steigerungs-Woche. Du kombinierst LAT, Engage-Disengage, Bogen, Counter-Cond, BAT. {dogName} hat ein komplettes Repertoire. Phase 3 = Anwendung im echten Alltag.",
      wochenziele: [
        "Alle Werkzeuge können flexibel kombiniert werden.",
        "{dogName} setzt teilweise selbstständig Strategien ein.",
        "Du hast eine klare Vorstellung welche Werkzeuge in Phase 3 weitergeführt werden.",
      ],
      tagesplan: "Mache jeden Spaziergang dieser Woche zu einer Bilanz: welche Strategie greift wann? Wo musst du noch eingreifen? Wo läuft es selbstständig? Notiere am Ende der Woche eine ehrliche Bestandsaufnahme.",
      no_gos: [
        "Erfolge als Selbstverständlichkeit nehmen — Aufmerksamkeit bleibt wichtig.",
        "In Phase 3 schon Belohnungs-Dichte stark reduzieren.",
        "Vergleichen mit anderen Hund-Mensch-Teams — eure Reise ist individuell.",
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
      title: "BAT im Alltag etablieren",
      schwerpunkt: "Phase 3 = BAT wird zum Standard. {dogName} bekommt mehr und mehr Kontrolle über ihre Distanz-Wahl. Diese Woche etablierst du BAT in allen normalen Spaziergangs-Situationen.",
      wochenziele: [
        "BAT wird täglich in normalen Spaziergängen angewandt.",
        "{dogName} wählt selbst Distanz-Strategien.",
        "Du musst weniger lenken.",
      ],
      tagesplan: "Pro Spaziergang aktiv BAT-Momente einbauen: bei jedem Trigger der nicht akut eng kommt, gibst du {dogName} Zeit zur Selbst-Regulation. Sobald Stress-Lösung kommt: mit ihr aktiv weggehen. Funktionale Belohnung wird Standard.",
      no_gos: [
        "BAT erzwingen — funktioniert nur wenn {dogName} selbst zeigt.",
        "Bei Eskalation BAT weiterführen — dann Notfall-Protokoll.",
        "Andere Strategien (LAT, Bogen) komplett weglassen — BAT ergänzt, ersetzt nicht.",
      ],
      fortschritt: [
        "{dogName} reguliert sich selbstständig in vielen Situationen.",
        "Du fühlst dich als Begleiter, nicht als Lenker.",
        "Spaziergänge sind ruhiger und souveräner.",
      ],
      exerciseIds: ["a-bat-distanz"],
    },
    {
      title: "Trigger-Hierarchie & Management",
      schwerpunkt: "Identifiziere klar: welche Trigger sind 'machbar' für {dogName}, welche bleiben Tabu? Management ist genauso wichtig wie Training — und unterscheidet zwischen Realität und Wunschdenken.",
      wochenziele: [
        "Du hast eine klare Trigger-Hierarchie auf Papier.",
        "Du planst Spaziergänge entsprechend.",
        "Du erkennst, wo Management besser als Training ist.",
      ],
      tagesplan: "Tag 1-2: Erstelle eine Liste eurer Trigger nach Schwierigkeit. Tag 3-7: plane Spaziergänge entsprechend. Schwierige Trigger bewusst vermeiden, mittlere aktiv trainieren, einfache zur Routine. Niemals alle Trigger an einem Tag.",
      no_gos: [
        "Schwierige Trigger zwingen — eskaliert.",
        "Management als 'Aufgeben' sehen — es ist kluge Realitäts-Anerkennung.",
        "Ohne Plan losziehen — Eskalations-Gefahr.",
      ],
      fortschritt: [
        "Du planst strukturiert.",
        "Eskalationen werden seltener.",
        "Du akzeptierst, dass nicht alles trainierbar ist.",
      ],
      exerciseIds: ["a-schwellenwert-finden"],
    },
    {
      title: "Konfrontations-Pufferzone aufbauen",
      schwerpunkt: "Wenn du weißt, dass eine Begegnung kommt (Park-Eingang, schmaler Weg), arbeitest du mit einer Pufferzone: 20m vorher hörst du auf zu reden, hältst Leckerli bereit, gehst in den 'Trainings-Modus'.",
      wochenziele: [
        "{dogName} kennt die Pufferzone-Routine.",
        "Begegnungen werden vorbereitet, nicht überraschend.",
        "Stress-Reaktionen werden präventiv verhindert.",
      ],
      tagesplan: "Pro Spaziergang plane 3-5 Pufferzonen: 20m vor Hot-Spot in den Trainings-Modus. Hosentaschen-Hand vorbereitet, Leine kürzer, SCHAU-Signal aktiv. Trigger erscheint: LAT oder Counter-Cond. Nach 20m außerhalb der Sicht-Linie: entspannen.",
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
      tagesplan: "Notiere nach jedem Spaziergang: hohe Stress-Phase ja/nein? Wenn ja: nächster Tag bewusst ruhig (kürzer Spaziergang, mehr Cool-Down, weniger Trigger). 72h-Regel: nach starkem Stress 2 Tage 'Erholungs-Modus'.",
      no_gos: [
        "Nach Stress sofort wieder in Trigger-Bereich gehen — kumuliert.",
        "Stress-Phasen verleugnen — der Hund braucht Erholung.",
        "Erholungs-Modus als 'Verlust' sehen — es ist aktives Training.",
      ],
      fortschritt: [
        "Du erkennst Stress-Last sicher.",
        "{dogName} hat klare Erholungs-Phasen.",
        "Kumulative Stress-Eskalationen werden vermieden.",
      ],
      exerciseIds: ["a-emergency-protokoll"],
    },
    {
      title: "Belohnungs-Reduktion vorsichtig",
      schwerpunkt: "Nachdem die Strategien sitzen, reduzierst du langsam die Belohnungs-Dichte. Aber: bei Aggression NIEMALS komplett weglassen. Auch nach Jahren bleibt die Verstärkung wichtig.",
      wochenziele: [
        "Belohnungs-Frequenz wird auf ~50% reduziert.",
        "{dogName} hält Strategien auch mit weniger Belohnung.",
        "Spitzenleistungen werden weiterhin mit Jackpot belohnt.",
      ],
      tagesplan: "Bei sicheren, bekannten Triggern: nicht jedes Mal belohnen. Bei neuen oder schwierigen Triggern: weiterhin volle Belohnungs-Dichte. {dogName} merkt den Unterschied, sucht aber die Beziehung statt das Leckerli.",
      no_gos: [
        "Belohnungs-Dichte radikal reduzieren — Eskalations-Gefahr.",
        "Bei schwierigen Triggern Belohnung einsparen — Spitzenleistung kostet.",
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
      tagesplan: "Wähle pro Tag genau 1 Hochrisiko-Ort. Maulkorb auf, vorbereitet. 5-10 Min Aufenthalt mit aktiver LAT/Counter-Cond. Bei Stress: aussteigen, kein Drama. Wichtig: niemals zu lange.",
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
      tagesplan: "Suche aktiv Wege mit bewegten Reizen (Radwege, Joggingstrecken). Start-Distanz 15m. LAT bei jedem Vorbeifahren. Belohnungs-Dichte hoch halten. Schrittweise auf 10m reduzieren.",
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
      tagesplan: "Plane den Wartungs-Plan: alle 2-3 Wochen einen 'Trainings-Tag', an dem du gezielt nochmal LAT/BAT/Bogen übst. Alle 3 Monate eine Bilanz mit dem Hundetrainer. Maulkorb für Notfälle parat halten. 72h-Regel weiter beachten.",
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
      exerciseIds: ["m-aus-aufbauen"],
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
      exerciseIds: ["m-pfui-konditionieren"],
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
      exerciseIds: ["m-leinen-management"],
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
      exerciseIds: ["m-maulkorb-uebergang"],
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
      exerciseIds: ["m-belohnungs-suche"],
    },
    {
      title: "Fundament-Check",
      schwerpunkt: "Letzte Fundament-Woche. AUS positiv? Tausch sitzt? PFUI klappt drinnen? Maulkorb akzeptiert? Diese Werkzeuge sind die Basis für draußen-Anwendung.",
      wochenziele: [
        "Alle 4 Bausteine sind etabliert: AUS, Tausch, PFUI, Maulkorb.",
        "Du fühlst dich vorbereitet für Outdoor-Anwendung.",
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
      title: "AUS draußen an leichten Triggern",
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
      exerciseIds: ["m-aus-aufbauen", "m-tausch-protokoll"],
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
      exerciseIds: ["m-pfui-konditionieren"],
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
      exerciseIds: ["m-leinen-management"],
    },
    {
      title: "Belohnungs-Suche aktiv nutzen",
      schwerpunkt: "Such-Trieb wird produktiv genutzt: pro Spaziergang mehrere geworfene Belohnungen, {dogName} lernt aktiv mit der Nase zu suchen statt zufällig aufzuheben.",
      wochenziele: [
        "5-7 SUCH-Einheiten pro Spaziergang.",
        "{dogName} sucht aktiv und konzentriert.",
        "Such-Trieb wird kanalisiert.",
      ],
      tagesplan: "Pro Spaziergang an sicheren Stellen (sauber, ohne Müll) 5-7 mal Leckerli werfen + SUCH. Steigerung über die Woche: schwerere Verstecke, 2 Leckerlis gleichzeitig, höheres Gras. Spaziergänge werden zu Mini-Mantrailing-Sessions.",
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
      exerciseIds: ["m-belohnungs-suche"],
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
      exerciseIds: ["m-maulkorb-uebergang"],
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
        "Belohnung komplett streichen — Rückfall.",
        "Reduktion an schwierigen Strecken — zu früh.",
        "Belohnungs-Dichte radikal senken — schrittweise.",
      ],
      fortschritt: [
        "{dogName} reagiert auch mit weniger Belohnung.",
        "Du steckst seltener in die Hosentasche.",
        "Verhalten wird stabiler ohne Dauer-Verstärkung.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-leinen-management"],
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
      schwerpunkt: "{dogName}s Such-Trieb wird intensiv produktiv genutzt: längere Mantrailing-Sessions, komplexere Suchspiele, Schnüffel-Wanderungen. Mehr Such-Befriedigung = weniger zufälliges Aufhebe-Verhalten.",
      wochenziele: [
        "Mind. 1 längere Nasenarbeit-Session pro Spaziergang.",
        "Such-Trieb wird intensiv kanalisiert.",
        "{dogName} ist nach Nasenarbeit ruhig und zufrieden.",
      ],
      tagesplan: "Pro Spaziergang 1 längere Such-Einheit (10-15 Min): 20-30m Mantrailing-Spur, Schnüffel-Wanderung durch hohes Gras mit verteilten Belohnungen, Such-Spiele mit verschiedenen Schwierigkeiten.",
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
      exerciseIds: ["m-belohnungs-suche"],
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
      ],
      exerciseIds: ["r-hier-laden"],
    },
    {
      title: "Restraint-Recall: Festhalte-Spiel",
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
      exerciseIds: ["r-restraint-recall"],
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
      exerciseIds: ["r-schleppleine"],
    },
    {
      title: "Hundepfeife als Backup-Signal",
      schwerpunkt: "Eine Hundepfeife trägt 200m+, klingt immer gleich, kann nicht 'vergiftet' werden. Diese Woche konditionierst du sie als zweites Recall-Signal — Backup für den Notfall.",
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
      exerciseIds: ["r-pfeife-aufbauen"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Schleppleinen-Sicherheit & Routine",
      schwerpunkt: "Schleppleinen-Arbeit wird zur täglichen Routine. {dogName} bewegt sich frei, aber unter Kontrolle. Du übst KOMM-HER an verschiedenen Orten.",
      wochenziele: [
        "Tägliche Schleppleinen-Spaziergänge sind Standard.",
        "{dogName} kommt zuverlässig auf Recall.",
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
      schwerpunkt: "Erste leichte Ablenkungen während Recall: ein Vogel im Hintergrund, ein anderer Hund in 30m. {dogName} lernt: KOMM-HER funktioniert auch mit Reizen.",
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
      exerciseIds: ["r-hier-mit-ablenkung"],
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
        "Du verstehst Recall-Pädagogik.",
      ],
      exerciseIds: ["r-hier-laden"],
    },
    {
      title: "Fundament-Check",
      schwerpunkt: "Letzte Fundament-Woche. KOMM-HER drinnen sitzt? Restraint-Recall funktioniert? Schleppleine ist Routine? Pfeife konditioniert? Diese Bausteine sind unverzichtbar.",
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
        "{dogName} sucht aktiv den Recall-Moment.",
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
      schwerpunkt: "Pfeife wird outdoor in echten Recall-Situationen eingesetzt. Sie bleibt das Backup-Signal, aber jetzt mit echten Reizen. Konditionierung muss stabil bleiben.",
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
      exerciseIds: ["r-pfeife-aufbauen"],
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
      title: "Notfall-Recall konditionieren",
      schwerpunkt: "Diese Woche etablierst du den Notfall-Recall: ein einziges Wort oder Pfiff, das du NUR in echten Notfällen einsetzt. Belohnung: extrem (Rinderfilet, Hähnchen-Brust-Stücke).",
      wochenziele: [
        "{dogName} reagiert auf Notfall-Signal zuverlässig.",
        "Belohnung ist MEGA: echtes Rinderfilet oder Hähnchen-Filet.",
        "Du hast ein Notfall-Backup für echte Krisen.",
      ],
      tagesplan: "Wähle ein Wort/Pfeif-Ton das du sonst NIEMALS nutzt (z.B. STOP-HER). Konditioniere drinnen 2 mal täglich mit MEGA-Belohnung. Übertrag in Phase 3 in echte Notfall-Situationen.",
      no_gos: [
        "Notfall-Recall für normale Recalls nutzen — verliert die Magie.",
        "Belohnung skimpen — bei MEGA-Belohnung MEGA-Reaktion.",
        "Mehrfach im Notfall rufen — die erste Reaktion zählt.",
      ],
      fortschritt: [
        "Notfall-Signal ist konditioniert.",
        "Du hast Vertrauen in das Backup.",
        "Im Ernstfall hast du eine Lösung.",
      ],
      exerciseIds: ["r-emergency-recall"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Recall mit stärkerer Ablenkung",
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
      exerciseIds: ["r-hier-mit-ablenkung"],
    },
    {
      title: "Restraint-Recall draußen mit Helfer",
      schwerpunkt: "Klassisches Restraint-Recall jetzt draußen mit Helfer. Massive Motivation, Sprint zu dir. Funktioniert auch wenn andere Methoden hapern.",
      wochenziele: [
        "{dogName} sprintet draußen bei Restraint-Recall.",
        "Helfer-Setting ist eingespielt.",
        "Motivation ist outdoor genauso hoch wie indoor.",
      ],
      tagesplan: "2-3 mal pro Woche Restraint-Sessions draußen. Helfer hält, du läufst 20-30m weg, KOMM-HER. Sprint + JACKPOT. Variation: Helfer wechselt, du wechselst, gleicher Spaß.",
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
      exerciseIds: ["r-restraint-recall"],
    },
    {
      title: "Recall-Varianten erweitern",
      schwerpunkt: "Bisher hattest du 1-2 Recall-Wörter. Diese Woche etablierst du Varianten: NORMAL-Recall (alltäglich, leichte Belohnung), JACKPOT-Recall (mittelhart, große Belohnung), NOTFALL (extrem, MEGA-Belohnung).",
      wochenziele: [
        "Du hast 3 unterschiedliche Recall-Stufen klar.",
        "{dogName} versteht die unterschiedlichen Signale.",
        "Du nutzt sie situativ.",
      ],
      tagesplan: "Trockenübungen pro Stufe: ALLTAG-Recall mit normaler Belohnung, JACKPOT-Recall mit großer Belohnung, NOTFALL mit MEGA-Belohnung. Pro Spaziergang ein paar von jeder Stufe.",
      no_gos: [
        "Stufen vermischen — verwässert die Verknüpfungen.",
        "Notfall-Recall regelmäßig nutzen — verliert die Magie.",
        "Belohnungs-Niveau verwechseln.",
      ],
      fortschritt: [
        "Stufen sind klar etabliert.",
        "{dogName} reagiert situativ unterschiedlich.",
        "Du hast ein abgestuftes Recall-System.",
      ],
      exerciseIds: ["r-hier-laden", "r-emergency-recall"],
    },
    {
      title: "Festigung Steigerung",
      schwerpunkt: "Letzte Steigerungs-Woche. Alle Recall-Werkzeuge sitzen, Schleppleine ist Routine, Notfall-Signal konditioniert. Phase 3 = erster Freilauf, kontrolliert.",
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
      tagesplan: "Wähle die sicherste Zone (eingezäunte Hundewiese, Wald-Lichtung weit weg von Straße). Schleppleine bleibt am Geschirr, aber {dogName} darf sie 5-10m ziehen. KOMM-HER alle 5 Min. Bei zuverlässigem Recall: weiter machen.",
      no_gos: [
        "Freilauf an Hochrisiko-Orten — Eskalations-Gefahr.",
        "Schleppleine komplett abnehmen — Sicherheits-Verlust.",
        "Freilauf länger als 15-20 Min — Reizüberflutung droht.",
      ],
      fortschritt: [
        "Erster Freilauf ist erfolgreich.",
        "{dogName} bleibt in Reichweite.",
        "Du fühlst dich (vorsichtig) zuversichtlicher.",
      ],
      exerciseIds: ["r-freilauf-erste"],
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
        "{dogName} verliert keine Recall-Motivation.",
      ],
      tagesplan: "Pro Spaziergang 3-4 KOMM-HER-Momente, jeder mit Jackpot. Variation: Restraint-Recall mit Helfer einmal pro Woche. Pfeife alle 2 Wochen mit MEGA-Belohnung.",
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
      schwerpunkt: "Nachdem Recall sicher sitzt, reduzierst du langsam die Belohnungs-Dichte bei normalen Recalls. Aber: bei wertvollen Situationen (echte Notfälle) immer noch JACKPOT.",
      wochenziele: [
        "Belohnungs-Frequenz wird auf ~50-60% reduziert.",
        "Spitzenleistungen werden weiterhin mit Jackpot belohnt.",
        "{dogName} reagiert auch mit weniger Belohnung.",
      ],
      tagesplan: "Bei einfachen Recall-Situationen: nicht jedes Mal Hähnchen. Bei schwierigen (starke Ablenkung, lange Distanz): Jackpot. {dogName} merkt den Unterschied, sucht aber den Recall-Moment.",
      no_gos: [
        "Belohnung komplett streichen — Rückfall droht.",
        "Reduktion an schwierigen Strecken — zu früh.",
        "Belohnungs-Niveau-Verwirrung.",
      ],
      fortschritt: [
        "{dogName} reagiert auch mit weniger Belohnung.",
        "Recall ist stabilisiert.",
        "Du steckst seltener in die Hosentasche.",
      ],
      exerciseIds: ["r-hier-laden"],
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
        "Recall ist robust.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-pfeife-aufbauen"],
    },
    {
      title: "Notfall-Recall in Praxis",
      schwerpunkt: "Diese Woche testest du den Notfall-Recall in 1-2 echten Risiko-Situationen (z.B. {dogName} läuft in falsche Richtung). MEGA-Belohnung muss kommen.",
      wochenziele: [
        "Notfall-Recall wird in 1-2 echten Situationen erfolgreich eingesetzt.",
        "MEGA-Belohnung wird konsistent gegeben.",
        "Du fühlst dich auf echte Notfälle vorbereitet.",
      ],
      tagesplan: "In kontrollierten 'Quasi-Notfällen' (z.B. {dogName} schnüffelt etwas Interessantes, du rufst Notfall-Signal): SOFORT MEGA-Belohnung beim Auftauchen. Niemals 'wegen Test' oder ohne Belohnung — vergiftet sonst die Magie.",
      no_gos: [
        "Notfall-Recall ohne MEGA-Belohnung testen — vergiftet die Verknüpfung.",
        "Notfall-Signal regelmäßig nutzen — Verliert die Macht.",
        "Im echten Notfall in Panik geraten — Routine durchziehen.",
      ],
      fortschritt: [
        "Notfall-Recall ist getestet und funktioniert.",
        "Du hast Vertrauen in das Backup.",
        "Echte Notfälle sind beherrschbar.",
      ],
      exerciseIds: ["r-emergency-recall"],
    },
    {
      title: "Recall-Spaziergänge ohne Schleppleine",
      schwerpunkt: "Wenn Recall sicher sitzt (90%+ Erfolg an bekannten Strecken), kannst du Schleppleine in spezifischen Settings weglassen. Aber: NUR an sicheren Strecken, NUR bei guter Konzentration.",
      wochenziele: [
        "Du hast Strecken identifiziert, wo Schleppleine-frei sicher ist.",
        "{dogName} reagiert dort zu 95%+.",
        "Sicherheit bleibt oberstes Prinzip.",
      ],
      tagesplan: "Bewerte ehrlich pro Strecke: Recall sicher zu 95%? Hochrisiko-Reize unwahrscheinlich? Wenn ja: Schleppleine-frei testen. Bei jeder Sicht-frei-Situation: KOMM-HER + Jackpot. Bei Zweifel: Schleppleine zurück.",
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
      schwerpunkt: "Letzte Woche. Recall ist zuverlässig, Schleppleine wird gezielt eingesetzt, Notfall-Backup steht. {dogName} ist ein deutlich zuverlässigerer Hund als zu Plan-Beginn.",
      wochenziele: [
        "Alle Recall-Werkzeuge laufen routiniert.",
        "Wartungs-Plan steht.",
        "Du fühlst dich langfristig vorbereitet.",
      ],
      tagesplan: "Plane den Wartungs-Modus: alle 2 Wochen einen Restraint-Recall mit MEGA-Belohnung. Alle 4 Wochen einen Notfall-Recall-Test (in kontrolliertem Setting). Pfeife alle 2 Wochen mit MEGA-Belohnung. Routine bleibt.",
      no_gos: [
        "Alle Routinen schlagartig weglassen — Recall verblasst.",
        "Pfeife oder Notfall-Recall vergessen — Werkzeuge brauchen Wartung.",
        "Schleppleine vergessen — Sicherheits-Backup für Notfall.",
      ],
      fortschritt: [
        "Recall ist langfristig zuverlässig.",
        "Du fühlst dich kompetent.",
        "{dogName} ist sicherer im Freilauf.",
      ],
      exerciseIds: ["r-hier-laden", "r-emergency-recall"],
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

// ── Monats-Übersichten: ausführlich, problem-spezifisch ────────────
function buildMonatsUebersichten(
  weeksTotal: number,
  monthsTotal: number,
  dog: DogProfile,
  problemLabel: string,
  customProblemText?: string
): Array<{ monat: number; text: string }> {
  const dogName = dog.dogName || "dein Hund";
  const out: Array<{ monat: number; text: string }> = [];

  const customRef = customProblemText
    ? `\n\nSpeziell zu eurer Situation: "${customProblemText.slice(0, 200)}". Halte diesen Bezug aktiv im Kopf, wenn du die Übungen umsetzt. Genau diese Auslöser sind unser Trainingsziel.`
    : "";

  for (let m = 1; m <= monthsTotal; m++) {
    const isFirst = m === 1;
    const isLast = m === monthsTotal;
    const phaseStartWeek = (m - 1) * 4 + 1;
    const phaseEndWeek = Math.min(m * 4, weeksTotal);

    let text: string;

    if (isFirst) {
      text = `Nach Woche ${phaseEndWeek} ist das Fundament gelegt. Diese ersten 4 Wochen sind die wichtigsten des gesamten Plans, denn alles was später kommt, baut auf den Grundbausteinen auf, die du jetzt etabliert hast: Aufmerksamkeit auf Signal, Ruhe vor dem Spaziergang, lockere Leine drinnen, und einen festen Ruhe-Anker.

Was du jetzt schon merken solltest: ${dogName} reagiert in 80% der Fälle innerhalb weniger Sekunden auf SCHAU. Die Tür-Routine fühlt sich für euch beide normal an, das hektische Rausstürmen vom Anfang ist deutlich seltener geworden. ${dogName} kennt die Decke als Ort, an dem runtergekommen wird, und sucht ihn ab und zu auch von selbst auf. Spaziergänge starten ruhiger als noch vor 4 Wochen.

Was du jetzt anpassen kannst: Wenn die Grund-Signale noch nicht bei 80% sitzen, hänge eine Woche dran und vertiefe gezielt das, was wackelt. Verlängern ist immer besser als zu früh weitergehen. Wenn dagegen alles spielend leicht läuft und ${dogName} schon im Garten oder Hausflur entspannt ist, kannst du in der nächsten Phase etwas mutiger werden. Notiere dir kurz, welche der vier Bausteine am besten und am schwächsten sitzen, das hilft dir in Phase 2.

Häufige Stolperfallen jetzt: Ungeduld führt dazu, dass viele schon in Woche 4 mit echten Außen-Reizen arbeiten wollen. Das torpediert das Fundament. Ein anderer Klassiker: aus dem normalen Spaziergang heraus üben. Die Mini-Sessions wirken nur, wenn sie bewusst geplant sind und ${dogName} nicht schon hochgefahren ist. Halte die Übungs-Sessions klar getrennt vom normalen Auslauf.

Was vermeidet jetzt: schon in volle Alltagssituationen zu gehen mit der Erwartung, dass es funktioniert. Phase 1 schafft die Voraussetzung, dass Phase 2 überhaupt greifen kann.${customRef}`;
    } else if (!isLast) {
      text = `Halbzeit. Nach Woche ${phaseEndWeek} sollte die Steigerungs-Phase greifen: ${dogName} hat die Übungs-Strategien aus der reizarmen Komfort-Zone nach draußen verlagert. Ihr habt SCHAU draußen gefestigt, BOGEN als Ausweich-Strategie aufgebaut, Richtungswechsel als Aufmerksamkeits-Tool etabliert und mit Gegenkonditionierung an der emotionalen Reaktion auf Reize gearbeitet.

Was du jetzt schon merken solltest: ${dogName} schaut bei Reizen draußen häufiger zu dir, statt zu fixieren oder zu ziehen. Begegnungen aus 15-20m Distanz werden ohne Bellen oder starkes Drängeln gemeistert. Du erkennst ${dogName}s Schwellenwert sicher und arbeitest meist darunter. Spaziergänge fühlen sich kommunikativer und weniger zäh an als vor 4 Wochen.

Was du jetzt anpassen kannst: Wenn ${dogName} draußen noch viel Stress zeigt, geh nochmal zurück und mach die Reize kleiner oder die Distanz größer. Geduld zahlt sich hier mehr aus als jeder Forcier-Versuch. Wenn ${dogName} dagegen souverän reagiert, kannst du langsam die Schwierigkeit hochfahren: schwierigere Orte, längere Begegnungen, mehr verschiedene Reiztypen. Wichtig: arbeite an der Strategie, nicht an der Toleranz. Wenn ${dogName} noch viel Stress zeigt, ist es nicht "ich muss durchhalten" sondern "ich muss kleinere Reize wählen".

Häufige Stolperfallen jetzt: Die Versuchung ist groß, Erfolge zu schnell als selbstverständlich zu nehmen und die Belohnungsdichte zu schnell zu reduzieren. Halte sie in Phase 2 hoch, das ist Investition. Auch verbreitet: in einer einzigen Übungs-Session zu viele Reize stapeln und dann frustriert sein, dass es nicht klappt. Lieber 5 saubere Begegnungen statt 15 wilde.

Was vermeidet jetzt: in Stress-Lage durchziehen, weil "wir sind doch fast da". Plateaus sind in dieser Phase normal. Wer jetzt durchhält und sauber arbeitet, hat in Phase 3 die deutlichsten Sprünge.${customRef}`;
    } else {
      text = `Auf der Zielgeraden. Nach Woche ${phaseEndWeek} habt ihr die Generalisierungs-Phase abgeschlossen. ${dogName} setzt die Strategien jetzt im echten Alltag ein, ohne ständige Belohnung, ohne dass du dauernd eingreifen musst. Vorbeigehen statt Bogen, Café-Situationen meistern, schwierige Orte und bewegte Reize, all das ist Teil eures Repertoires.

Was du jetzt schon merken solltest: ${dogName} setzt mindestens zwei der gelernten Strategien pro Spaziergang von alleine ein, ohne dass du sie ansagen musst. Komplexe Situationen werden mit klarem Plan gemeistert. Eure Routinen fühlen sich wie eure neue Normalität an, nicht mehr wie Training. Du steckst die Hand seltener in die Hosentasche und ${dogName} reagiert trotzdem.

Was du jetzt anpassen kannst: Reduziere bewusst die Belohnungs-Frequenz weiter. Belohne weniger oft, aber bei Spitzenleistungen großzügig. Wenn ${dogName} ohne Belohnung nicht mehr mitmacht, ist die Reduktion zu schnell gegangen, einen Schritt zurück. Plane den Wartungs-Modus: alle 3-4 Monate ein bewusster Übungs-Spaziergang an einem schwierigen Ort. Das hält die Verknüpfungen frisch und zeigt dir früh, wenn etwas einzubrechen droht.

Häufige Stolperfallen jetzt: Komplette Belohnungs-Streichung. Verstärkung bleibt wichtig, nur die Frequenz und Vorhersehbarkeit ändern sich. Auch verbreitet: Erfolge als Selbstverständlichkeit nehmen und das Beobachten einstellen. Kleine Rückfälle gibt es immer, früh bemerkt sind sie schnell behoben.

Was nach diesem Plan kommt: keine harte Trennung. Die guten Routinen bleiben dauerhaft. Du hast jetzt das Werkzeug, um auch unbekannte Situationen einschätzen und meistern zu können. Falls einzelne Themen wiederkommen, weißt du, welche Übung gegen welches Problem hilft. Das ist langfristig wertvoller als ein Plan, der dich abhängig macht.${customRef}`;
    }

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
  const { problem, planLengthMonths, dog, introText, abschlussText, customProblemText } = args;
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
  // fuer alle 10 Probleme stehen.
  const WEEK_LIBRARIES: Partial<Record<ProblemKey, Record<Phase, WeekTemplate[]>>> = {
    pulling: PULLING_WEEKS,
    energy: ENERGY_WEEKS,
    aggression: AGGRESSION_WEEKS,
    mouthing: MOUTHING_WEEKS,
    recall: RECALL_WEEKS,
  };
  const weekTpls = WEEK_LIBRARIES[problem] || PULLING_WEEKS;

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
      title: tpl.title,
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
  const equipmentBriefings: Partial<Record<ProblemKey, string>> = {
    pulling: `\n\nAusrüstungs-Check: arbeite mit einem gut sitzenden Y-Brustgeschirr (Bauchgurt liegt VOR dem Brustkorb, Kreuz nie auf dem Hals). Halsband ist für Leinenführigkeit NICHT geeignet, Halti/Kopfhalfter/Stachelhalsband sind tabu. Die Leine sollte 2-3m lang sein, KEINE Roll-Leine.`,
    energy: `\n\nAusrüstungs-Check: Schnüffelmatte (ca. 30€), Kong Classic (Größe passend zu ${dogName}), 2-3 verschiedene Such-Beschäftigungs-Spielzeuge (Trixie Mover, Buster Cube). Hochwertige Trainings-Leckerlis weich und klein. Für später: Schleppleine 5-10m Biothane für Mantrailing draußen.`,
    aggression: `\n\nAusrüstungs-Check WICHTIG: Korbmaulkorb (Baskerville Ultra oder BUMAS, individuell angepasst — Stoff-Schlinge NICHT geeignet, blockiert Hecheln). 2m Führleine, KEINE Roll-Leine. Hochwertige Belohnung (Hähnchen, Käse, Wurst) IMMER griffbereit. Brustgeschirr für mehr Sicherheit bei Reaktion.`,
    mouthing: `\n\nAusrüstungs-Check: Korbmaulkorb (Baskerville Ultra) für Hochrisiko-Strecken — er verhindert Aufnahme, blockiert aber NICHT Trinken oder Hecheln. 2m Führleine für Hot-Spots. Hochwertige Tausch-Belohnung immer in der Hosentasche.`,
    recall: `\n\nAusrüstungs-Check: 5-10m Schleppleine aus Biothane (Seil verbrennt die Hände), gut sitzendes Brustgeschirr (Schleppleine NIEMALS am Halsband). Hundepfeife ACME 211.5 als Backup-Signal. Hochwertige Belohnung MEGA: Hähnchen, Käse, kleine Stücke Wurst.`,
  };
  const equipmentBriefing = equipmentBriefings[problem] || "";

  const fallbackAufbau = `Der Plan ist in drei Phasen gegliedert: Fundament (drinnen, reizarm), Steigerung (raus, kontrolliert) und Generalisierung (echter Alltag). Jede Woche enthält klare Wochenziele, einen Tagesplan und konkrete Übungen mit Schritt-für-Schritt-Anleitung.\n\nEin bis zwei gut gemachte Trainingseinheiten pro Tag reichen. Qualität schlägt Dauer.${equipmentBriefing}`;
  const fallbackZiele = `Am Ende der ${weeksTotal} Wochen soll ${dogName} ${problemLabel} deutlich besser bewältigen können. Nicht durch Strafe oder Druck, sondern durch positive Verstärkung und klare Routinen. Du wirst ${dogName} besser verstehen und gemeinsam einen ruhigeren Alltag haben.`;

  return {
    intro: {
      headline: `${planLengthMonths}-Monatsplan für ${dogName}`,
      einleitung: introText || fallbackEinleitung,
      aufbau: fallbackAufbau,
      ziele: fallbackZiele,
    },
    weeks,
    monats_uebersichten: buildMonatsUebersichten(weeksTotal, monthsTotal, dog, problemLabel, customProblemText),
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
