// Personalisierte Plan-Aufbau-Intros pro Quiz-Problem.
// Wird auf der Uebersicht in der Sektion 'So ist dein Plan aufgebaut'
// gerendert — damit der User sieht WIE sein Plan zu seinem Hund passt
// (nicht nur 'Woche fuer Woche' generisch).
//
// Wording: 40-jaehrige Zielgruppe, klar, ohne Jargon, ohne Pomp.

export interface PlanWeek {
  num: number;
  title: string;
  body: string;
}

export interface PlanIntro {
  headline: string;            // mit {dog} Placeholder
  intro: string;               // mit {dog} Placeholder
  weeks: PlanWeek[];
}

const PLAN_INTROS: Record<string, PlanIntro> = {
  pulling: {
    headline: "Wie wir {dog} ans entspannte Leinen-Laufen bringen",
    intro:
      "Die meisten Hunde ziehen aus zwei Gründen: zu viel Energie aufgestaut, und zu wenig Übung darin, dass die Leine ihnen Grenzen setzt. Genau da setzt der Plan an — erst Grundlagen-Übungen zuhause, dann auf dem Spazierweg in kleinen Schritten.",
    weeks: [
      {
        num: 1,
        title: "Grundlagen: Aufmerksamkeit auf dich",
        body: `Bevor ${"{dog}"} an der Leine entspannt läuft, muss er lernen dich zu beachten. Übungen für drinnen, 5 Min am Tag.`,
      },
      {
        num: 2,
        title: "Lockere Leine im Garten / Hausflur",
        body: "Erste echte Leinen-Übungen in vertrauter Umgebung — ohne Ablenkung.",
      },
      {
        num: 3,
        title: "Erster ruhiger Spazierweg",
        body: "Bekannte Strecke, wenig Ablenkung. Du übst die neuen Regeln im Echt-Setting.",
      },
      {
        num: 4,
        title: "Schwierige Situationen meistern",
        body: "Andere Hunde, Passanten, spannende Gerüche — jetzt wird's stabil.",
      },
    ],
  },
  barking: {
    headline: "Wie wir {dog} das übermäßige Bellen abgewöhnen",
    intro:
      "Bellen hat fast immer einen konkreten Auslöser — Türklingel, andere Hunde, Langeweile, Angst. Der Plan geht jeden davon einzeln an, statt pauschal 'aus' zu rufen. So lernt er nicht 'leise sein bei Druck', sondern 'es ist nichts los, ich kann ruhig bleiben'.",
    weeks: [
      {
        num: 1,
        title: "Auslöser erkennen + Ruhe-Signal aufbauen",
        body: "Du lernst was dein Hund eigentlich kommuniziert. Plus erstes Ruhe-Wort.",
      },
      {
        num: 2,
        title: "Türklingel & Besuchs-Training",
        body: "Häufigster Auslöser — wir trainieren ihn als ersten in echten Situationen.",
      },
      {
        num: 3,
        title: "Außengeräusche & andere Hunde",
        body: "Distanz-Training und Ablenkung. Hier zahlen sich die ersten 2 Wochen aus.",
      },
      {
        num: 4,
        title: "Stabil halten im Alltag",
        body: "Routinen die das gelernte Verhalten dauerhaft sichern.",
      },
    ],
  },
  aggression: {
    headline: "Wie wir Aggression bei {dog} sicher entschärfen",
    intro:
      "Aggression ist fast nie 'böser Wille' — meist Angst oder Überforderung. Der Plan baut Distanz und Sicherheit auf, statt zu konfrontieren. Wichtig: bei akuter Gefahr arbeitest du parallel mit einem Trainer vor Ort, der Plan ergänzt das.",
    weeks: [
      {
        num: 1,
        title: "Auslöser dokumentieren + Distanz",
        body: "Du lernst zu erkennen WANN die Reaktion kommt — und vergrößerst sofort den Abstand.",
      },
      {
        num: 2,
        title: "Aufmerksamkeit auf dich umlenken",
        body: "Statt am Auslöser hängen bleiben: dein Hund schaut auf dich. Übungen ohne Druck.",
      },
      {
        num: 3,
        title: "Kontrollierte Begegnungen üben",
        body: "Erste vorsichtige Begegnungen mit großer Distanz, schrittweise näher.",
      },
      {
        num: 4,
        title: "Alltag entspannter machen",
        body: "Stabile Routinen für Spaziergang, Tierarzt, Besuch.",
      },
    ],
  },
  anxiety: {
    headline: "Wie wir {dog} entspannt allein zuhause lässt",
    intro:
      "Trennungsangst löst man nicht durch 'einfach mal länger weggehen'. Wir gehen in Mini-Schritten vor: erst Sekunden, dann Minuten. Jeder erfolgreiche Schritt ist ein Baustein.",
    weeks: [
      {
        num: 1,
        title: "Mini-Trennungen ohne Drama",
        body: "30 Sekunden Raum-Wechsel ohne Verabschiedung. Klingt klein, ist die Basis.",
      },
      {
        num: 2,
        title: "Bis 5 Minuten allein",
        body: "Schrittweise steigern, mit Beschäftigungs-Tools (Kong etc.).",
      },
      {
        num: 3,
        title: "30 Minuten — der erste echte Test",
        body: "Wohnung verlassen, Auto starten, kurz Einkaufen. Mit klarem Routine-Ritual.",
      },
      {
        num: 4,
        title: "Stundenweise allein, stabil",
        body: "Aufbau auf 2-4 Stunden, mit Sicherheits-Routinen.",
      },
    ],
  },
  jumping: {
    headline: "Wie wir {dog} das Anspringen abgewöhnen",
    intro:
      "Hunde springen weil sie gelernt haben: 'Springen = Aufmerksamkeit'. Der Plan dreht das um — 4 Pfoten am Boden = Aufmerksamkeit, Springen = nichts. Klingt einfach, ist konsequent.",
    weeks: [
      {
        num: 1,
        title: "Familie konsequent machen",
        body: "Alle in der Familie reagieren gleich — keine Aufmerksamkeit beim Springen.",
      },
      {
        num: 2,
        title: "Sitz vor Begrüßung",
        body: "Klares Ritual: bevor er gestreichelt wird → Sitz. Erst zuhause, dann unterwegs.",
      },
      {
        num: 3,
        title: "Besuch und Fremde meistern",
        body: "Schwierigste Situation, weil Besuch oft 'lieb' sein will. Dafür gibts klare Regeln.",
      },
    ],
  },
  recall: {
    headline: "Wie {dog} zuverlässig auf den Rückruf hört",
    intro:
      "Rückruf scheitert meistens an einer simplen Regel: kommen muss IMMER besser sein als nicht-kommen. Der Plan baut den Namen positiv auf, dann das Pfeifen-Signal, dann Ablenkungs-Training.",
    weeks: [
      {
        num: 1,
        title: "Namen positiv aufladen",
        body: `Der Name ist das wichtigste Wort. Wir laden ihn so auf, dass ${"{dog}"} sofort guckt.`,
      },
      {
        num: 2,
        title: "Pfeife einführen",
        body: "Pfeife wirkt klarer als Stimme. Wir bauen sie als 'Magnet' auf.",
      },
      {
        num: 3,
        title: "Erste Ablenkungen",
        body: "Andere Hunde, Spielzeug, Wild — schrittweise, immer mit Belohnung.",
      },
      {
        num: 4,
        title: "Rückruf draußen unter Stress",
        body: "Wenn das jetzt klappt, hast du die wichtigste Übung im Sack.",
      },
    ],
  },
  energy: {
    headline: "Wie wir {dog}s Energie in geordnete Bahnen lenken",
    intro:
      "Zu viel Energie ist selten zu viel Bewegung — meist zu wenig KOPF-Auslastung. Der Plan kombiniert beides: körperlich auspowern + Suchspiele und Kopfarbeit. Plus: Ruhe lernen ist auch eine Übung.",
    weeks: [
      {
        num: 1,
        title: "Suchspiele + Kopfarbeit",
        body: "10 Min Suchspiel macht müder als 30 Min Spaziergang. Wir bauen die Routine auf.",
      },
      {
        num: 2,
        title: "Ruhe-Decke als Anker",
        body: `Wir üben aktiv 'Nichts tun'. Das muss ${"{dog}"} lernen wie jede andere Übung.`,
      },
      {
        num: 3,
        title: "Auspowern + Ruhe abwechseln",
        body: "Klares Tages-Schema: Aktivität, Pause, Aktivität, Pause. Kein Dauer-Hibbeln.",
      },
    ],
  },
  destructive: {
    headline: "Wie wir Möbel, Schuhe & Kabel vor {dog} retten",
    intro:
      "Zerstören ist meist Frust, Langeweile oder Stress — selten Bösartigkeit. Wir bieten Alternativen statt zu schimpfen, und bauen das Tausch-Spiel auf damit er nichts mehr verteidigt.",
    weeks: [
      {
        num: 1,
        title: "Kau-Alternativen anbieten",
        body: "3 Spielzeuge in verschiedenen Räumen. Wenn er was Falsches anpackt: tauschen.",
      },
      {
        num: 2,
        title: "Tausch-Spiel als Routine",
        body: `Damit ${"{dog}"} freiwillig hergibt was er hat — ohne Geknurre.`,
      },
      {
        num: 3,
        title: "Allein-Phasen entstressen",
        body: "Oft passiert Zerstörung wenn der Hund allein ist. Wir gehen dem auf den Grund.",
      },
    ],
  },
  soiling: {
    headline: "Wie {dog} stubenrein wird (oder bleibt)",
    intro:
      "Stubenreinheit ist 80% Routine und 20% Belohnung. Wir bauen feste Pipi-Pause-Zeiten auf und sorgen dafür dass jeder Erfolg sofort verbunden wird mit etwas Gutem.",
    weeks: [
      {
        num: 1,
        title: "Pipi-Pause-Plan etablieren",
        body: "Feste Zeiten: nach Schlafen, Fressen, Spielen. Plus alle 2-3 Stunden tagsüber.",
      },
      {
        num: 2,
        title: "Erfolg sofort belohnen",
        body: "Innerhalb von 3 Sekunden — sonst kann er die Verknüpfung nicht herstellen.",
      },
      {
        num: 3,
        title: "Pannen ohne Schimpfen",
        body: "Was tun wenn doch was schief geht. Spoiler: nicht schimpfen, sondern Routine prüfen.",
      },
    ],
  },
  mouthing: {
    headline: "Wie {dog} aufhört, alles vom Boden aufzunehmen",
    intro:
      "Aufnehmen ist Instinkt — aber wir können beibringen, dass DEIN Wort wichtiger ist als der gefundene Käserest. Der Plan kombiniert Tausch-Spiel mit einem klaren 'Aus'-Signal.",
    weeks: [
      {
        num: 1,
        title: "'Aus'-Kommando aufbauen",
        body: "Drinnen mit Spielzeug üben. Sobald 'Aus' klappt → Belohnung mit was Besserem.",
      },
      {
        num: 2,
        title: "Tausch-Spiel als Backup",
        body: `Wenn ${"{dog}"} schon was im Maul hat: tauschen statt reissen. Nie um den Gegenstand kämpfen.`,
      },
      {
        num: 3,
        title: "Spazierweg üben",
        body: "Erst auf bekannten Strecken, dann Stadt, dann mit Ablenkung.",
      },
    ],
  },
};

function fillTemplate(text: string, dog: string): string {
  return text.replace(/\{dog\}/g, dog);
}

export function getPlanIntro(
  problemKey: string | null,
  dog: string
): PlanIntro | null {
  if (!problemKey) return null;
  const intro = PLAN_INTROS[problemKey];
  if (!intro) return null;
  return {
    headline: fillTemplate(intro.headline, dog),
    intro: fillTemplate(intro.intro, dog),
    weeks: intro.weeks.map((w) => ({
      num: w.num,
      title: fillTemplate(w.title, dog),
      body: fillTemplate(w.body, dog),
    })),
  };
}

// Optional: kurzer Rasse-Hinweis fuer Feinjustierung. Wird nur angezeigt
// wenn breed bekannt + zu einer der bekannten Gruppen passt. Schluesselt
// auf Hund-Typ statt jede Rasse explizit.
export function getBreedNote(
  breed: string | null,
  problemKey: string | null
): string | null {
  if (!breed || !problemKey) return null;
  const lc = breed.toLowerCase();

  // Energie-reiche Rassen + Energy-Problem
  if (
    problemKey === "energy" &&
    /husky|border|aussie|jack russell|terrier|setter|spaniel|retriever|labrador|malinois|schaeferhund/.test(
      lc
    )
  ) {
    return `${breed} ist eine sehr aktive Rasse — der Plan ist genau darauf ausgelegt: viel Kopfarbeit, weniger pures Toben.`;
  }
  // Wachsame / Bell-Rassen + Barking
  if (
    problemKey === "barking" &&
    /spitz|chihuahua|terrier|dackel|schaeferhund|husky/.test(lc)
  ) {
    return `${breed} hat einen ausgepraegten Wach-Instinkt. Wir kanalisieren das, statt es 'wegzutrainieren'.`;
  }
  // Verspielte Aufnehmer + Mouthing
  if (
    problemKey === "mouthing" &&
    /retriever|labrador|spaniel/.test(lc)
  ) {
    return `Apportier-Rassen wie ${breed} haben einen besonders starken Mund-Reflex — der Plan setzt da gezielt an.`;
  }
  return null;
}
