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

  // Aktuell nur PULLING_WEEKS — wenn neue Probleme dazukommen,
  // hier weiteres Mapping. Bis dahin: alle Probleme nutzen pulling-Templates.
  const weekTpls = PULLING_WEEKS;

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

  // Pulling-spezifisches Equipment-Briefing — fuer jedes Pulling-Problem
  // (oder Fallback) wird ein konkreter Geschirr-vs-Halsband-Hinweis
  // angehaengt. Bei anderen Problem-Bereichen (sobald implementiert) kann
  // hier problem-spezifisches Material angefuegt werden.
  const equipmentBriefing = problem === "pulling"
    ? `\n\nAusrüstungs-Check vor Phase 1: arbeite mit einem gut sitzenden Y-Brustgeschirr (Bauchgurt liegt VOR dem Brustkorb, Kreuz ueber den Schultern liegt nie auf dem Hals). Ein Halsband ist fuer Leinenfuehrigkeits-Training NICHT geeignet — bei jedem Zug presst es auf den empfindlichen Hals-Bereich, und genau das wollen wir vermeiden. Halti, Kopfhalfter oder Stachelhalsband sind tabu, sie unterdruecken Verhalten statt es zu veraendern. Die Leine selbst sollte 2-3m lang sein und KEINE Roll-Leine, mit der trainierst du Pullen aktiv an.`
    : "";

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
