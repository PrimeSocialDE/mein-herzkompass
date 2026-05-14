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
const PULLING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Aufmerksamkeit aufbauen",
      schwerpunkt: "Diese Woche legst du das Fundament: {dogName} lernt, auf ein Signal hin sofort Blickkontakt zu dir aufzunehmen. Ohne diese Basis funktioniert keine Leinen-Übung später draußen.",
      wochenziele: [
        "{dogName} reagiert in der Wohnung in unter 2 Sekunden auf SCHAU.",
        "Du nutzt das SCHAU-Signal mehrmals täglich in Mini-Sessions.",
        "{dogName} verbindet das Signal mit ruhiger Belohnung, nicht Aufregung.",
      ],
      tagesplan: "Drei Mini-Sessions à 3 Minuten über den Tag verteilt, in jeweils einem anderen Raum: morgens vor dem Frühstück, mittags vor dem Mittag-Spaziergang, abends im Wohnzimmer. So generalisiert {dogName} das Signal von Anfang an auf verschiedene Orte. Beende jede Session, solange {dogName} noch motiviert ist.",
      no_gos: [
        "Das Signal in lauter, aufgeregter Stimmung üben.",
        "Mehr als 7 Wiederholungen am Stück, das überfordert in der ersten Woche.",
        "SCHAU schon draußen einfordern, das ist Phase 2.",
      ],
      fortschritt: [
        "{dogName} hebt den Kopf bei SCHAU innerhalb von 2 Sekunden.",
        "Der Blickkontakt hält mindestens 1 Sekunde.",
        "{dogName} bleibt während der Sessions ruhig und arbeitet aktiv mit.",
      ],
      exerciseIds: ["p-schau"],
    },
    {
      title: "Ruhe vor dem Loslaufen",
      schwerpunkt: "{dogName} lernt, dass die Haustür nur bei ruhigem Verhalten geöffnet wird. Das setzt den Ton für jeden Spaziergang und entzieht dem späteren Ziehen die Energie.",
      wochenziele: [
        "{dogName} bleibt beim Anlegen der Leine ruhig sitzen oder stehen.",
        "Die Tür wird nur bei lockerer Leine geöffnet.",
        "Der erste Schritt nach draußen erfolgt ohne Vorbeidrängen.",
      ],
      tagesplan: "Trainiere die Tür-Routine bei jedem regulären Spaziergang. Plane für die ersten Tage 5 zusätzliche Minuten ein, in denen du die Tür mehrfach öffnest und schließt, ohne tatsächlich loszugehen. {dogName} lernt: Aufregung verzögert das Rausgehen, Ruhe beschleunigt es.",
      no_gos: [
        "Die Leine anlegen während {dogName} im Sprung ist, das verstärkt Vorfreude-Hyperaktivität.",
        "Aus Zeitdruck einfach loslaufen, das torpediert die ganze Woche.",
        "Mit der Tür rumzicken oder nervös werden, {dogName} liest deine Stimmung.",
      ],
      fortschritt: [
        "{dogName} setzt sich automatisch beim Leinen-Anlegen.",
        "Die Tür kann ohne Drängeln geöffnet werden.",
        "{dogName} wartet 2-3 Sekunden draußen, statt sofort loszuschießen.",
      ],
      exerciseIds: ["p-stop-and-go", "p-schau"],
    },
    {
      title: "Lockere Leine in der Wohnung",
      schwerpunkt: "Die lockere Leine wird in reizarmer Umgebung trainiert, bevor wir nach draußen gehen. {dogName} lernt das Grundprinzip: Zug an der Leine bedeutet Stillstand.",
      wochenziele: [
        "{dogName} läuft drinnen 5 Minuten am lockerem Leinen-Strang.",
        "Bei Zug bleibt {dogName} stehen oder dreht sich zu dir um.",
        "Richtungswechsel werden ruhig mitgemacht.",
      ],
      tagesplan: "Eine längere Session täglich (10 Minuten) in Wohnzimmer und Flur. Verteile über den Raum 3-4 Wendepunkte. Nutze die normalen Wege durch die Wohnung als Trainingsstrecke. Halte Leckerlis griffbereit in der Hosentasche, damit Belohnungen ohne Verzögerung kommen.",
      no_gos: [
        "An der Leine ziehen oder rucken, {dogName} reagiert auf Spannung mit mehr Spannung.",
        "Schimpfen oder genervt werden, das vergiftet das Training.",
        "Drinnen 30 Minuten am Stück durchziehen, lieber kürzer und konzentriert.",
      ],
      fortschritt: [
        "{dogName} läuft entspannt nebenher statt vorzulaufen.",
        "Bei Stopp dreht sich {dogName} zu dir um.",
        "Richtungswechsel funktionieren in 80% der Fälle beim ersten Versuch.",
      ],
      exerciseIds: ["p-leinenspiel-drinnen"],
    },
    {
      title: "Decke als Ruhe-Anker",
      schwerpunkt: "Diese Woche etablierst du die Entspannungsdecke als festen Ort, an dem {dogName} runterkommt. Später wird die Decke draußen zum mobilen Anker, gerade in Cafés oder beim Besuch.",
      wochenziele: [
        "{dogName} betritt die Decke selbstständig auf das Signal PLATZ.",
        "Die Liegezeit wird auf 5-10 Minuten ausgedehnt.",
        "{dogName} verknüpft die Decke mit ruhiger Belohnung, nicht mit Erwartung.",
      ],
      tagesplan: "Zweimal täglich 5 Minuten Decken-Training: einmal vormittags in einer ruhigen Phase, einmal abends nach dem Hauptspaziergang. Die Decke liegt dauerhaft an einem festen Ort, damit {dogName} sie irgendwann auch von selbst aufsucht. Belohne bewusst mit ruhiger Stimme, nicht mit Aufregung.",
      no_gos: [
        "Die Decke bei Strafe oder Time-out nutzen, das vergiftet den Ort.",
        "{dogName} mit Worten zwingen zu liegen, das schafft Druck statt Entspannung.",
        "Auf die Decke setzen wenn {dogName} sehr aufgedreht ist, lieber erst runterkommen lassen.",
      ],
      fortschritt: [
        "{dogName} legt sich auf das Signal PLATZ ohne Diskussion ab.",
        "Die Liegezeit wird ohne ständige Belohnung gehalten.",
        "{dogName} sucht die Decke auch außerhalb des Trainings auf.",
      ],
      exerciseIds: ["p-decke-drinnen"],
    },
    // Wochen 5-8 nur für 6-Monats-Plan: Vertiefung Fundament
    {
      title: "Übergang Drinnen-Draußen",
      schwerpunkt: "{dogName} überträgt das Gelernte langsam nach draußen, an den ruhigsten Ort den ihr habt: vor die Haustür, in den Garten, in den Hausflur. Ein vorsichtiger Übergang.",
      wochenziele: [
        "Die SCHAU-Übung funktioniert auch im Hausflur oder Garten.",
        "Die Tür-Routine läuft entspannt vor jedem Spaziergang.",
        "{dogName} kommt draußen schneller in den Trainingsmodus als zu Beginn.",
      ],
      tagesplan: "Ergänze deinen normalen Spaziergang mit 3 Minuten SCHAU-Übung im Hausflur oder Garten, bevor ihr losgeht. Die ersten 5 Spaziergangs-Minuten sind reines Tür-Routine-Training. Nutze diese Mini-Sessions als Ritual, das den eigentlichen Spaziergang einleitet.",
      no_gos: [
        "Schon längere Distanzen unter Reizen üben, das ist nächste Phase.",
        "Bei Stress weitermachen, lieber zurück in die Wohnung.",
        "Vergleichen mit anderen Hunden, jeder hat sein eigenes Tempo.",
      ],
      fortschritt: [
        "{dogName} reagiert auf SCHAU im Hausflur in unter 3 Sekunden.",
        "Die Tür-Routine fühlt sich für euch beide normal an.",
        "{dogName} wirkt beim Rausgehen ruhiger als noch vor 4 Wochen.",
      ],
      exerciseIds: ["p-schau", "p-stop-and-go"],
    },
    {
      title: "Decke wird mobil",
      schwerpunkt: "Die Entspannungsdecke kommt erstmals mit nach draußen, in Form einer kleinen Reise-Decke. {dogName} lernt: der Anker funktioniert auch außerhalb der Wohnung.",
      wochenziele: [
        "{dogName} legt sich auf die mitgenommene Decke im Garten oder Hof.",
        "Die Decke wird zum mobilen Sicherheitsanker.",
        "Die Liegezeit draußen wird auf 5 Minuten ausgedehnt.",
      ],
      tagesplan: "Nimm die Decke einmal täglich mit in den Garten oder Hof. Wähle einen ruhigen Platz ohne Reize. Lass {dogName} ankommen, dann das Signal PLATZ. Belohne ruhiges Liegen großzügig, gerade weil die Umgebung neu ist. Steigere die Dauer langsam von 1 auf 5 Minuten.",
      no_gos: [
        "Die Decke in stark frequentierten Bereichen ausprobieren, das überfordert.",
        "Erwarten, dass es draußen sofort wie drinnen klappt.",
        "Frustriert werden wenn {dogName} aufsteht, ruhig zurückführen reicht.",
      ],
      fortschritt: [
        "{dogName} legt sich draußen auf die Decke ohne Widerstand.",
        "Die Decke wirkt erkennbar beruhigend, auch in neuer Umgebung.",
        "{dogName} bleibt bis zum Auflöse-Signal liegen.",
      ],
      exerciseIds: ["p-decke-drinnen"],
    },
    {
      title: "Aufmerksamkeit unter Mini-Reizen",
      schwerpunkt: "Diese Woche prüfst du, ob {dogName} das SCHAU-Signal auch hält, wenn ein leiser Reiz dazukommt: ein vorbeifahrendes Auto in 50m Entfernung, ein anderer Hund in der Ferne.",
      wochenziele: [
        "{dogName} reagiert auf SCHAU auch bei Mini-Ablenkung.",
        "Die Reaktionszeit bleibt unter 3 Sekunden auch außerhalb.",
        "Du lernst {dogName}s erste Stress-Anzeichen sicher zu erkennen.",
      ],
      tagesplan: "Suche bei jedem Spaziergang einmal eine Stelle, an der ein leiser Reiz vorhersehbar ist. Übe dort SCHAU mit großzügiger Belohnung. Beobachte gezielt: hechelt {dogName} mehr? Geht der Schwanz tiefer? Wird das Maul angespannt? Diese Beobachtung ist mindestens so wichtig wie die Übung selbst.",
      no_gos: [
        "Sich an stark frequentierte Orte wagen, das ist noch zu früh.",
        "{dogName} in Stress-Lage nochmal SCHAU einfordern, lieber Distanz vergrößern.",
        "Erwarten, dass es jedes Mal funktioniert, Plateaus sind normal.",
      ],
      fortschritt: [
        "{dogName} reagiert auf SCHAU auch wenn ein Reiz in der Ferne ist.",
        "Du erkennst Stress-Signale früher als noch vor 4 Wochen.",
        "{dogName} wirkt beim Spaziergang generell aufmerksamer.",
      ],
      exerciseIds: ["p-schau", "p-leinenspiel-drinnen"],
    },
    {
      title: "Festigung & Routine-Check",
      schwerpunkt: "Letzte Fundament-Woche. Du wiederholst alle vier Grundbausteine SCHAU, Tür-Routine, lockere Leine drinnen, Decke und prüfst, was wirklich sitzt. Was noch wackelt, kriegt nochmal Extra-Fokus.",
      wochenziele: [
        "Alle vier Grund-Übungen funktionieren reproduzierbar.",
        "{dogName} hat eine erkennbare Trainings-Routine im Tagesablauf.",
        "Du erkennst Schwachstellen klar und weißt, wo nachjustiert werden muss.",
      ],
      tagesplan: "Tag 1+2: SCHAU drinnen + im Garten. Tag 3+4: Tür-Routine bewusst trainieren. Tag 5: lockere Leine drinnen mit Wendepunkten. Tag 6+7: Decken-Sessions, längere Liegezeit. Mache am Ende der Woche eine ehrliche Bilanz: was sitzt, was wackelt, was muss nochmal vertieft werden bevor wir in Phase 2 gehen.",
      no_gos: [
        "Schon mit echten Außen-Reizen arbeiten, Phase 2 beginnt nächste Woche.",
        "Schwachstellen ignorieren, das rächt sich später.",
        "Aus Ungeduld in die nächste Phase springen, lieber 1 Woche dranhängen.",
      ],
      fortschritt: [
        "Alle Übungen funktionieren ohne Erinnerung an die Grundregeln.",
        "{dogName} kennt die Trainings-Signale und reagiert darauf.",
        "Ihr habt eine Routine, die sich für euch beide normal anfühlt.",
      ],
      exerciseIds: ["p-schau", "p-decke-drinnen"],
    },
  ],
  steigerung: [
    {
      title: "Erste Außen-Reize gezielt",
      schwerpunkt: "{dogName} überträgt das SCHAU-Signal nach draußen, an einem Ort mit kontrollierbaren Reizen. Du suchst aktiv die Übungs-Situation, statt sie passiv abzuwarten.",
      wochenziele: [
        "{dogName} reagiert auf SCHAU draußen bei leichten Ablenkungen.",
        "Du wählst gezielt Übungs-Orte mit kontrollierbaren Reizen.",
        "Erste Mini-Erfolge an der frischen Luft sind reproduzierbar.",
      ],
      tagesplan: "Pro Spaziergang plane eine 10-Minuten-Übungseinheit ein, möglichst zur gleichen Tageszeit. Suche eine ruhige Ecke an der Straße, an der ab und zu mal ein Auto vorbeikommt oder ein Mensch in 30m Entfernung läuft. Übe SCHAU bei jedem solchen Mini-Reiz und belohne unmittelbar.",
      no_gos: [
        "Direkt in stark frequentierte Innenstadt gehen, das überfordert.",
        "Bei Stress weiterüben, sofort Distanz herstellen.",
        "Ohne Belohnung üben, in dieser Phase ist die Belohnungsdichte essenziell.",
      ],
      fortschritt: [
        "{dogName} reagiert draußen auf SCHAU in unter 4 Sekunden.",
        "Mini-Reize führen zu Aufmerksamkeit zu dir, nicht zu Hochfahren.",
        "{dogName} wirkt im Übungs-Setting ruhiger als im normalen Spaziergang.",
      ],
      exerciseIds: ["p-schau-draussen"],
    },
    {
      title: "Begegnungen aus sicherer Distanz",
      schwerpunkt: "Die Königsdisziplin beginnt: kontrollierte Begegnungen mit anderen Hunden oder Joggern, aber aus 15-20m Distanz. {dogName} lernt: Reiz erscheint = Leckerli, nicht Aufregung.",
      wochenziele: [
        "{dogName} bleibt bei Begegnungen aus 15m Distanz unter dem Schwellenwert.",
        "Die Gegenkonditionierung beginnt zu greifen, Reize lösen positive Erwartung aus.",
        "Du erkennst {dogName}s individuellen Schwellenwert.",
      ],
      tagesplan: "Zweimal pro Woche eine bewusste Begegnungs-Session: stelle dich an einen Ort, an dem regelmäßig Hunde oder Jogger in der Distanz vorbeikommen. Bei jedem Reiz: SCHAU und durchgehend füttern, solange der Reiz sichtbar ist. Reiz weg = Leckerlis weg. Max 5 Begegnungen pro Session.",
      no_gos: [
        "Zu nah ran, Distanz ist alles in dieser Übung.",
        "Über die Schwellenwert-Grenze hinaus weiterüben, das ist Rückschritt.",
        "Belohnung erst nach Reaktion, das verändert die emotionale Verknüpfung nicht.",
      ],
      fortschritt: [
        "{dogName} schaut bei Reizen erwartungsvoll zu dir, statt zu fixieren.",
        "Stress-Anzeichen werden seltener und kürzer.",
        "Erste Begegnungen werden ohne Bellen oder Ziehen gemeistert.",
      ],
      exerciseIds: ["p-gegenkonditionierung", "p-schau-draussen"],
    },
    {
      title: "BOGEN als Ausweich-Strategie",
      schwerpunkt: "{dogName} bekommt eine konkrete Handlungs-Alternative für Begegnungen: den Bogen. Statt zu ziehen oder zu eskalieren, wisst ihr beide, was zu tun ist.",
      wochenziele: [
        "{dogName} folgt dem Signal BOGEN ohne Widerstand.",
        "Der Bogen wird in echten Begegnungen aktiv eingesetzt.",
        "Du fühlst dich auf Spaziergängen handlungsfähiger.",
      ],
      tagesplan: "Übe den Bogen die ersten Tage ohne echte Begegnungen, an Laternen, Mülleimern oder Bänken. Sobald die Bewegung sitzt, setze ihn aktiv bei realen Begegnungen ein. Pro Spaziergang plane 2-3 echte Bogen-Situationen ein. Belohne nach jeder erfolgreichen Begegnung mit einem Jackpot von 3-4 Leckerlis.",
      no_gos: [
        "Den Bogen mit Anspannung einsetzen, das überträgt sich.",
        "Den Bogen erst einsetzen wenn {dogName} schon angespannt ist, lieber präventiv.",
        "Dem entgegenkommenden Menschen oder Hund direkt in die Augen schauen.",
      ],
      fortschritt: [
        "{dogName} bewegt sich auf BOGEN automatisch in den Halbkreis.",
        "Begegnungen mit Bogen verlaufen erkennbar entspannter.",
        "Du nutzt den Bogen ohne nachzudenken, wenn die Situation es braucht.",
      ],
      exerciseIds: ["p-bogen"],
    },
    {
      title: "Aufmerksamkeit durch Bewegung",
      schwerpunkt: "{dogName} lernt, sich an deiner Bewegung zu orientieren statt vor zu rennen. Richtungswechsel ohne Ansage werden zum spielerischen Aufmerksamkeits-Training.",
      wochenziele: [
        "{dogName} folgt unangekündigten Richtungswechseln zuverlässig.",
        "Die Aufmerksamkeit verlagert sich von vorne nach hinten zu dir.",
        "Spaziergänge fühlen sich spielerischer und weniger zäh an.",
      ],
      tagesplan: "Pro Spaziergang plane 3-5 Richtungswechsel ohne Ansage ein. Wähle Wege, die das natürlich hergeben: Parkwege mit Gabelungen, Wendepunkte. Belohne jedes Folgen sofort. Wenn {dogName} stur weiterzieht: stehen bleiben, warten bis die Leine locker wird, dann erneut Richtung wechseln.",
      no_gos: [
        "An der Leine ziehen, das löst nur Gegenzug aus.",
        "Den Richtungswechsel zu früh ankündigen, das nimmt den Lerneffekt raus.",
        "Frustriert werden wenn {dogName} zieht, ruhig stehen bleiben reicht.",
      ],
      fortschritt: [
        "{dogName} folgt Richtungswechseln in 80% der Versuche beim ersten Mal.",
        "Die Aufmerksamkeit zu dir ist während des Spaziergangs spürbar höher.",
        "Spaziergänge fühlen sich kommunikativer an.",
      ],
      exerciseIds: ["p-richtungswechsel-aussen"],
    },
    {
      title: "Geräuschkulisse Stadt",
      schwerpunkt: "{dogName} wird an städtische Geräusche herangeführt: Busse, Mülltonnen, Baustellen, Kindergeschrei. Das passiert kontrolliert und immer mit Rückzugsmöglichkeit.",
      wochenziele: [
        "{dogName} reagiert auf Stadtgeräusche aus 30m Distanz ruhig.",
        "Du hast einen sicheren Ort identifiziert, an dem geübt werden kann.",
        "Die Geräusche werden zum normalen Hintergrund, nicht zum Auslöser.",
      ],
      tagesplan: "Suche zweimal pro Woche bewusst einen halbruhigen Stadt-Bereich auf: Randzone einer Einkaufsstraße, Außenrand eines Marktes, Park nahe einer Hauptstraße. Beobachte und belohne ruhiges Verhalten. Bei steigender Anspannung: weiter zurückziehen, nicht erzwingen.",
      no_gos: [
        "Direkt zur Hauptstraße in der Rush-Hour gehen.",
        "{dogName} bei Hechel-Stress weitermachen lassen.",
        "Geräusche absichtlich auslösen oder verstärken.",
      ],
      fortschritt: [
        "{dogName} bleibt bei plötzlichen Geräuschen aus 20m gelassen.",
        "Die Erholzeit nach einem Schreck wird spürbar kürzer.",
        "Ihr findet euch in moderater Stadt-Umgebung sicher zurecht.",
      ],
      exerciseIds: ["p-gegenkonditionierung", "p-richtungswechsel-aussen"],
    },
    {
      title: "Variabilität bei Reizen",
      schwerpunkt: "Diese Woche kombinierst du verschiedene Reize bewusst: Hunde, Jogger, Fahrradfahrer, Kinder. {dogName} lernt, dass die Strategie immer dieselbe bleibt, egal was kommt.",
      wochenziele: [
        "{dogName} reagiert auf verschiedene Reize mit derselben ruhigen Strategie.",
        "Die Übungs-Erfolge übertragen sich von einem Reiztyp zum anderen.",
        "Du fühlst dich vorbereiteter auf unvorhersehbare Situationen.",
      ],
      tagesplan: "Plane bewusst Spaziergänge in verschiedenen Bereichen: Park (Hunde), Joggingstrecke (Jogger), Wohngebiet (Kinder, Fahrräder). Pro Spaziergang ein Reiztyp im Fokus. Wende immer dasselbe Schema an: SCHAU + füttern bei Reiz, BOGEN bei Bedarf.",
      no_gos: [
        "Mehrere Reize gleichzeitig provozieren wollen.",
        "Die Strategie wechseln, je nachdem was kommt, das verwirrt.",
        "{dogName} schon zur Reaktion drängen, bevor sie selbst die Situation einordnen kann.",
      ],
      fortschritt: [
        "{dogName} setzt SCHAU oder BOGEN bei verschiedenen Reizen ein.",
        "Du musst weniger eingreifen, {dogName} reagiert von selbst.",
        "Das Reiz-Repertoire weitet sich aus, ohne neue Probleme aufzureißen.",
      ],
      exerciseIds: ["p-bogen", "p-schau-draussen"],
    },
    {
      title: "Längere Trainingsphasen",
      schwerpunkt: "{dogName} bekommt jetzt 20 Minuten am Stück Training in einer realen Umgebung. Mit bewussten Mini-Pausen dazwischen. Die Konzentrationsspanne wächst.",
      wochenziele: [
        "{dogName} bleibt 20 Minuten konzentriert an einer Übungs-Einheit dran.",
        "Die Pausen werden aktiv genutzt zur Regulation.",
        "Du erkennst Erschöpfungs-Anzeichen und reagierst rechtzeitig.",
      ],
      tagesplan: "Plane an 3 Tagen pro Woche eine 20-minütige Übungs-Phase ein. Aufbau: 5 Min Aufwärmen mit SCHAU, 10 Min reizvolle Übungs-Phase mit Begegnungen oder Geräuschen, 5 Min Cool-Down mit ruhigem Schnüffeln. Dazwischen Mini-Pausen, in denen {dogName} ankommen darf.",
      no_gos: [
        "20 Minuten am Stück ohne Pausen durchziehen, das ermüdet zu schnell.",
        "Bei sichtbarer Erschöpfung weitermachen.",
        "Pausen ohne Auflöse-Signal lassen, {dogName} braucht klare Übergänge.",
      ],
      fortschritt: [
        "{dogName} hält die volle Übungs-Phase ohne Konzentrations-Einbruch durch.",
        "Pausen werden aktiv zur Erholung genutzt, nicht zur Aufregung.",
        "Die Belohnungsdichte kann reduziert werden, ohne dass die Leistung sinkt.",
      ],
      exerciseIds: ["p-schau-draussen", "p-bogen"],
    },
    {
      title: "Festigung Steigerung",
      schwerpunkt: "Letzte Steigerungs-Woche. Wir kombinieren alle Strategien SCHAU, BOGEN, Richtungswechsel, Gegenkonditionierung in echten Alltags-Situationen. Du erkennst, was sitzt und wo Phase 3 ansetzen muss.",
      wochenziele: [
        "Alle vier Strategien können bewusst eingesetzt werden.",
        "{dogName} wechselt zwischen den Strategien, je nach Situation.",
        "Du hast eine klare Vorstellung, welche Themen in Phase 3 noch vertieft werden müssen.",
      ],
      tagesplan: "Mache jeden Spaziergang dieser Woche zu einem Mini-Test. Beobachte aktiv: in welcher Situation greift welche Strategie? Wo kommt {dogName} ins Schwanken? Mache am Ende der Woche eine ehrliche Bilanz, das ist die Grundlage für die finale Phase.",
      no_gos: [
        "Versuchen, in Phase 3 noch mal von vorne anzufangen.",
        "Die Strategien starr anwenden, sondern flexibel kombinieren.",
        "{dogName} überfordern mit zu vielen neuen Reiz-Settings.",
      ],
      fortschritt: [
        "{dogName} setzt mindestens 2 Strategien pro Spaziergang aktiv ein.",
        "Du hast ein klares Bild, was {dogName} kann und wo noch Lücken sind.",
        "Spaziergänge fühlen sich generell entspannter an als vor 8 Wochen.",
      ],
      exerciseIds: ["p-richtungswechsel-aussen", "p-gegenkonditionierung"],
    },
  ],
  generalisierung: [
    {
      title: "Vorbeigehen statt Ausweichen",
      schwerpunkt: "{dogName} lernt jetzt das direkte Vorbeigehen an Menschen aus 3-5m Distanz, ohne Bogen. Das ist die nächste Stufe nach der reinen Vermeidung.",
      wochenziele: [
        "{dogName} geht direkt an Menschen vorbei, ohne in den Bogen auszuweichen.",
        "Das Tempo bleibt konstant, kein Beschleunigen oder Stopp.",
        "Begegnungen werden zur normalen Routine, nicht zum Stress-Event.",
      ],
      tagesplan: "Suche bei jedem Spaziergang gezielt 2-3 direkte Begegnungs-Möglichkeiten an wenig frequentierten Wegen. Bereite {dogName} schon aus 15m Entfernung mit SCHAU vor. Halte das Tempo konstant, belohne mit Pippeling-Modus während der Passage. Vermeide Augenkontakt mit dem Gegenüber.",
      no_gos: [
        "Schon in voller Innenstadt versuchen, das ist eine Stufe zu hoch.",
        "Bei Stress weitermachen, jederzeit zurück zum Bogen.",
        "Vergleichen mit anderen Hunde-Mensch-Teams, jeder ist anders.",
      ],
      fortschritt: [
        "{dogName} geht ohne sichtbaren Stress an Menschen vorbei.",
        "Du musst während der Passage nicht mehr ständig Strategie wechseln.",
        "Begegnungen werden zur normalen Spaziergangs-Routine.",
      ],
      exerciseIds: ["p-vorbeigang"],
    },
    {
      title: "Café-Situation meistern",
      schwerpunkt: "{dogName} lernt, in einer Café-Situation 15 Minuten ruhig zu liegen. Das ist die Königsdisziplin der Alltagstauglichkeit und macht euer Leben erheblich entspannter.",
      wochenziele: [
        "{dogName} legt sich auf die Decke und bleibt 15 Minuten liegen.",
        "Die Belohnungs-Frequenz kann reduziert werden, ohne dass {dogName} aufsteht.",
        "Das Café wird zur normalen Möglichkeit, nicht zum Hindernis.",
      ],
      tagesplan: "Beginne 2x diese Woche mit einer kurzen Mini-Café-Übung im Park: nimm die Decke mit, leg sie ab, setz dich daneben für 5 Minuten. Steigere langsam auf einen ruhigen Außenbereich eines Cafés, am besten zur Schwachzeit am Vormittag. Halte das Ende immer in einer ruhigen Situation.",
      no_gos: [
        "Direkt in Hauptstraßen-Café zur Lunch-Zeit gehen.",
        "{dogName} ohne Decke arbeiten lassen, der Anker ist essenziell.",
        "Nicht aus dem Café flüchten, sondern ruhig beenden.",
      ],
      fortschritt: [
        "{dogName} liegt 15 Minuten ohne Aufstehen auf der Decke.",
        "Geräusche und Bewegung um euch herum stören kaum.",
        "Du kannst entspannt deinen Kaffee trinken, ohne ständig zu kontrollieren.",
      ],
      exerciseIds: ["p-cafe", "p-decke-drinnen"],
    },
    {
      title: "Stadtbummel als Übung",
      schwerpunkt: "Diese Woche wagt ihr euch in eine moderate Fußgängerzone. Alle bisher gelernten Strategien werden im echten Stadtleben kombiniert.",
      wochenziele: [
        "{dogName} bewältigt einen 20-minütigen Bummel in moderater Stadt.",
        "Alle vier Strategien werden flexibel kombiniert eingesetzt.",
        "Ihr habt einen klaren Stadt-Spaziergang, der sich für beide gut anfühlt.",
      ],
      tagesplan: "Plane einmal in der Woche einen bewussten Stadt-Spaziergang ein, am besten Sonntagvormittag, wenn weniger los ist. Maximal 25 Minuten. Beginne mit SCHAU vor der Tür. Nutze Schnüffel-Pausen aktiv als Cool-Down zwischen Reiz-Phasen. Beende immer in einer ruhigen Ecke.",
      no_gos: [
        "Den Stadt-Spaziergang als Pflichttermin durchziehen, lieber abbrechen.",
        "Ego-Trip: zeigen, dass {dogName} alles kann.",
        "Andere Hunde provozieren, in Stadt sind Begegnungen oft eng.",
      ],
      fortschritt: [
        "{dogName} bewegt sich in moderater Stadt überraschend entspannt.",
        "Du fühlst dich vorbereitet auch auf unvorhersehbare Reize.",
        "Stadt-Bummel werden zur möglichen Routine, statt zur Sondernutzung.",
      ],
      exerciseIds: ["p-stadt-spaziergang", "p-vorbeigang"],
    },
    {
      title: "Belohnungs-Reduktion bewusst",
      schwerpunkt: "Jetzt reduzierst du systematisch die Belohnungs-Frequenz. {dogName} lernt, dass die Strategie auch ohne Dauer-Leckerli funktioniert, der Alltag wird unabhängiger.",
      wochenziele: [
        "{dogName} setzt die Strategien auch ohne Dauer-Belohnung ein.",
        "Belohnungen kommen seltener, dafür großzügiger bei Spitzenleistung.",
        "Spaziergänge funktionieren ohne ständiges Hosentaschen-Greifen.",
      ],
      tagesplan: "Reduziere bewusst pro Spaziergang die Belohnungs-Frequenz: alle 30 Schritte statt alle 10. Belohne aber bei Spitzenleistung weiterhin mit Jackpot von 3-4 Leckerlis. Beobachte: bleibt {dogName}s Strategie stabil oder bröckelt sie? Bei Bröckeln: einen Schritt zurück.",
      no_gos: [
        "Die Belohnung komplett weglassen, das ist zu schnell.",
        "Bei Bröckeln durchziehen statt anzupassen.",
        "Die Reduktion an einem stressigen Tag testen, lieber an entspannten Tagen.",
      ],
      fortschritt: [
        "{dogName} setzt die Strategien auch bei Belohnungs-Lücken ein.",
        "Die Spaziergänge fühlen sich freier an, weniger wie Training.",
        "Du steckst weniger oft Leckerlis in die Hand, ohne dass die Qualität sinkt.",
      ],
      exerciseIds: ["p-wartungs-spaziergang"],
    },
    {
      title: "Schwierige Orte gezielt",
      schwerpunkt: "Ihr arbeitet diese Woche an Orten, die bisher gemieden wurden: Tierarzt-Wartebereich, Bushaltestelle in Stoßzeit, vor Schulen zur Pausen-Zeit. Was den Alltag wirklich besser macht.",
      wochenziele: [
        "{dogName} bewältigt einen schwierigen Ort 5 Minuten ruhig.",
        "Du kennst {dogName}s Reaktion auf die für euch wichtigsten Hot-Spots.",
        "Die schwierigen Orte werden zur möglichen Option, statt zur Vermeidungs-Zone.",
      ],
      tagesplan: "Wähle pro Tag genau einen schwieren Ort und übe dort 5 Minuten. Tag 1: Tierarzt-Eingangsbereich (ohne Termin). Tag 2: Bushaltestelle 200m entfernt. Tag 3: Schule während Pause aus 50m. Schon der Aufenthalt ohne große Eskalation ist ein Erfolg.",
      no_gos: [
        "Direkt in den Tierarzt rein, nur den Außenbereich nutzen.",
        "{dogName} zwingen, einen Ort auszuhalten, der zu viel ist.",
        "Mehrere schwierige Orte am selben Tag stapeln.",
      ],
      fortschritt: [
        "{dogName} bewältigt jeden gewählten Hot-Spot 5 Minuten ohne Eskalation.",
        "Du gehst entspannter an Orte, die früher Stress bedeuteten.",
        "Der Alltag wird flexibler, weil weniger Zonen tabu sind.",
      ],
      exerciseIds: ["p-cafe", "p-vorbeigang"],
    },
    {
      title: "Bewegte Reize",
      schwerpunkt: "Fahrradfahrer, Jogger, Skateboarder, Roller alles, was schnell und ungeplant kommt. {dogName} lernt, auf bewegte Reize gelassen zu reagieren.",
      wochenziele: [
        "{dogName} bleibt bei vorbeifahrenden Fahrrädern aus 5m Distanz ruhig.",
        "Jogger sind kein Auslöser mehr für Hochfahren oder Ziehen.",
        "Du hast einen klaren Notfall-Plan, falls eine Situation eskaliert.",
      ],
      tagesplan: "Suche aktiv Wege, an denen Bewegung passiert: Radwege, Joggingstrecken, Schulwege. Beginne mit hoher Distanz (15m), reduziere langsam auf 5m. Halte SCHAU oder BOGEN parat. Bei Stress: aussteigen, später wiederkommen.",
      no_gos: [
        "Sich auf einen schmalen Weg mit ständigem Verkehr drängen.",
        "Bewegte Reize provozieren wollen, lieber natürliche Situationen nehmen.",
        "Bei Eskalation einfrieren, du brauchst eine Strategie.",
      ],
      fortschritt: [
        "{dogName} reagiert auf vorbeifahrende Räder ohne Bellen oder Ziehen.",
        "Du fühlst dich auf Multi-Wegen sicher unterwegs.",
        "Bewegte Reize sind kein Übungs-Schwerpunkt mehr, sondern Alltag.",
      ],
      exerciseIds: ["p-vorbeigang", "p-richtungswechsel-aussen"],
    },
    {
      title: "Schwierige Tageszeiten",
      schwerpunkt: "Spaziergänge zur Rush-Hour, am Wochenende im Park, beim Feierabend-Verkehr. Die Zeiten, an denen viele Hunde unterwegs sind und Reize gehäuft kommen.",
      wochenziele: [
        "{dogName} bewältigt einen Spaziergang in einer dichten Reiz-Phase.",
        "Du planst bewusst um, wenn nötig, ohne Frust.",
        "Die Spaziergangs-Planung wird flexibler, weniger an wenig-Reiz-Zeiten gebunden.",
      ],
      tagesplan: "Wähle 2x diese Woche eine bewusst schwierige Zeit: Sonntagmittag im Park, Rush-Hour an einer Hauptstraße, Schulbeginn an einer Grundschule. Beobachte, wie {dogName} reagiert. Plane Pausen ein und brich ab, bevor es zu viel wird. Notiere, was funktioniert und was nicht.",
      no_gos: [
        "Sich überschätzen und in den dichtesten Trubel werfen.",
        "Bei Stress weitermachen, lieber zurück und beim nächsten Mal früher abbrechen.",
        "Die schwierigen Zeiten generell meiden, das schränkt euch zu sehr ein.",
      ],
      fortschritt: [
        "{dogName} bewältigt eine schwierige Zeit ohne große Eskalation.",
        "Du planst flexibel, statt um Reize zu meiden.",
        "Euer Spaziergangs-Spielraum wird größer.",
      ],
      exerciseIds: ["p-stadt-spaziergang", "p-wartungs-spaziergang"],
    },
    {
      title: "Übergang in den Wartungsmodus",
      schwerpunkt: "Letzte Woche. Was hier passiert, soll dauerhaft funktionieren. Du übergibst die Verantwortung schrittweise an {dogName}, ohne dass die Routinen einbrechen.",
      wochenziele: [
        "{dogName} setzt die Strategien selbstständig im Alltag ein.",
        "Du musst nicht mehr aktiv trainieren, sondern lebst die Routinen.",
        "Ihr habt einen klaren Wartungs-Plan für die kommenden Monate.",
      ],
      tagesplan: "Reduziere das aktive Training auf das absolute Minimum. Beobachte stattdessen: was läuft von selbst? Wo musst du noch eingreifen? Plane einen lockeren Wartungs-Rhythmus: alle 3-4 Monate ein bewusster Übungs-Spaziergang an einem schwierigen Ort. Das hält die Verknüpfungen frisch.",
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
  const fallbackAufbau = `Der Plan ist in drei Phasen gegliedert: Fundament (drinnen, reizarm), Steigerung (raus, kontrolliert) und Generalisierung (echter Alltag). Jede Woche enthält klare Wochenziele, einen Tagesplan und konkrete Übungen mit Schritt-für-Schritt-Anleitung.\n\nEin bis zwei gut gemachte Trainingseinheiten pro Tag reichen. Qualität schlägt Dauer.`;
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
