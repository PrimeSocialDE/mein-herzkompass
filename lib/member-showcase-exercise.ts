// Showcase-Uebung fuer den Dashboard-Hero (FirstExerciseCard).
// Hardcoded statt aus DB damit die ALLER-erste Begegnung des Users
// mit dem Plan ein Wow-Moment ist: 'Der Leckerli-Test' — Impulskontrolle.
//
// Warum: kann SOFORT auf dem Sofa gemacht werden, sichtbarer Erfolg
// in unter 5 Minuten, beeindruckend (Hund laesst Leckerli in offener
// Faust liegen). Viel staerker als 'Pfote geben' o.ae.
//
// Slug zeigt auf real existierendes Modul damit 'Im Detail ansehen'
// nicht 404 wirft. Inhalt ist unabhaengig vom DB-Modul.

import type { ContentSection } from "./member-exercise-fallback";

export interface ShowcaseExercise {
  slug: string;          // muss in member_modules existieren (fuer Detail-Link)
  title: string;
  description: string;
  sections: ContentSection[];
}

export function buildShowcaseExercise(
  dog: string,
  fallbackSlug = "uebung-1"
): ShowcaseExercise {
  return {
    slug: fallbackSlug,
    title: "Der Leckerli-Test: Impulskontrolle",
    description:
      "Die wichtigste Basis-Übung überhaupt. Du sitzt auf dem Sofa, brauchst nur eine Handvoll Leckerli — und siehst in 5 Minuten den ersten Aha-Moment.",
    sections: [
      {
        type: "step",
        title: "Setz dich gemütlich hin",
        content: `Schnapp dir ${dog} und 5-6 kleine Leckerli. Ihr beide auf dem Sofa oder Boden, gegenüber. Keine Hektik, kein Druck.`,
      },
      {
        type: "step",
        title: "Mach die Faust",
        content: `Halte 1 Leckerli in der geschlossenen Faust unten vor ${dog}. Er riecht es sofort, will rangehen, leckt, knabbert vielleicht. Du machst NICHTS. Sagst KEIN Wort. Hand bleibt zu.`,
      },
      {
        type: "step",
        title: "Warte den entscheidenden Moment ab",
        content: `Irgendwann — vielleicht nach 3 Sekunden, vielleicht nach 30 — gibt ${dog} auf, schaut weg oder zu dir hoch. GENAU JETZT sagst du klar „JA!" und gibst ihm ein ANDERES Leckerli aus der Tasche (nicht das aus der Faust!).`,
      },
      {
        type: "step",
        title: "Wiederhole 5 mal",
        content: `Mach es nochmal. Du wirst sehen: schon beim 3. Versuch gibt ${dog} viel schneller auf. Beim 5. checkt er die Faust nur noch kurz und schaut dich direkt an. Das ist der Wow-Moment.`,
      },
      {
        type: "step",
        title: "Der Boden-Test",
        content: `Wenn die Faust sicher klappt: leg ein Leckerli OFFEN auf den Boden, halt deine Hand drüber. Wenn ${dog} sich zurückhält und dich anguckt statt zu schnappen → erste Stufe Impulskontrolle geschafft.`,
      },
      {
        type: "do",
        title: "Mach das",
        items: [
          "Belohne IMMER mit einem ANDEREN Leckerli (nicht das in der Faust)",
          "Sei still — kein Wort, kein Schimpfen während er ranggeht",
          "Hör auf wenn er es schafft — Erfolg verbinden, nicht überreizen",
        ],
      },
      {
        type: "dont",
        title: "Bitte nicht",
        items: [
          'Kein „Nein" oder „Aus" sagen — der Hund soll selbst rausfinden was funktioniert',
          "Faust nicht wegziehen wenn er dran kommt — einfach geschlossen lassen",
          "Nicht zu früh aufgeben — der Moment kommt, garantiert",
        ],
      },
      {
        type: "frequency",
        title: "Wie oft",
        content: "Heute 1-2 mal je 3-5 Minuten. Morgen genauso. Nach 2-3 Tagen versteht dein Hund die Regel im Kopf.",
      },
      {
        type: "tip",
        title: "Pfoten-Plan Tipp",
        content: `Sobald ${dog} die Regel verstanden hat (meist nach 2-3 Tagen), kannst du sie auf alles anwenden: was vom Tisch fällt, fremde Sachen unterwegs, Futter im Napf vor dem Freigeben. Das ist die Basis von gefühlt 80% aller Hundetrainings-Themen.`,
      },
    ],
  };
}
