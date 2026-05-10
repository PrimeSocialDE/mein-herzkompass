// Showcase-Uebung fuer den Dashboard-Hero (FirstExerciseCard).
// Hardcoded statt aus DB damit die ALLER-erste Begegnung des Users
// mit dem Plan ein Wow-Moment ist.
//
// Aktuell: 'Der Blickkontakt' — Klassiker mit konkreten Metern und
// Steigerung. Funktioniert sofort, sichtbarer Erfolg in <5 Min,
// Basis fuer Rueckruf/Leinen/etc.
//
// Slug zeigt auf real existierendes Modul damit 'Im Detail ansehen'
// nicht 404 wirft. Inhalt ist unabhaengig vom DB-Modul.

import type { ContentSection } from "./member-exercise-fallback";

export interface ShowcaseExercise {
  slug: string;
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
    title: "Der Blickkontakt: Aufmerksamkeit aufbauen",
    description:
      "Die wichtigste Basis-Übung. Mit ein paar Metern Abstand und einem klaren Signal lernst du, dass dein Hund dich anschaut, egal was um euch herum passiert. 5 Minuten reichen für den ersten Aha-Moment.",
    sections: [
      {
        type: "step",
        title: "Such einen ruhigen Platz",
        content: `Wohnzimmer, Flur oder ruhiger Garten. ${dog} sollte entspannt sein, nicht hibbelig oder hungrig. 5 bis 10 kleine Leckerli bereit halten.`,
      },
      {
        type: "step",
        title: `Setz ${dog} 2-3 Meter von dir entfernt hin`,
        content: `Wenn er Sitz oder Platz schon kann: nutze das. Sonst halt ihn kurz an der Leine. Du stehst ihm gegenüber, ihr seht euch an.`,
      },
      {
        type: "step",
        title: "Ruf seinen Namen einmal klar",
        content: `Sobald ${dog} zu dir guckt: begeistert „Ja!" sagen und sofort belohnen — entweder zu ihm gehen oder ihn zu dir locken. Wenn er nicht reagiert: 5 Sekunden warten, dann nochmal. Nicht hektisch.`,
      },
      {
        type: "step",
        title: "Distanz schrittweise vergrößern",
        content: `Beim nächsten Versuch: 4-5 Meter. Wieder Name, wieder belohnen. Beim 3. Mal: 7-8 Meter. Steigere nur wenn die kürzere Distanz sicher klappt.`,
      },
      {
        type: "step",
        title: "Mit kleiner Ablenkung üben",
        content: `Im Garten mit jemandem im Hintergrund, oder im Park abseits vom Weg. Ziel: ${dog} guckt zuverlässig zu dir, egal was um euch herum passiert.`,
      },
      {
        type: "do",
        title: "Mach das",
        items: [
          "Kurze Sessions: max 5-10 Min am Stück",
          "Belohne IMMER innerhalb von 3 Sekunden",
          "Steigere langsam — Distanz UND Ablenkung getrennt",
        ],
      },
      {
        type: "dont",
        title: "Bitte nicht",
        items: [
          "Den Namen nicht mehrfach hintereinander rufen — sonst wird er zu Hintergrund-Lärm",
          "Nicht schimpfen wenn er nicht guckt — einfach warten oder Distanz reduzieren",
          "Nicht schon in der Stadt üben — erst die Basis daheim sicher machen",
        ],
      },
      {
        type: "frequency",
        title: "Wie oft",
        content: "Täglich 1-2 mal je 5 Minuten. Erste sichtbare Verbesserung meist nach 3-4 Tagen.",
      },
      {
        type: "tip",
        title: "Pfoten-Plan Tipp",
        content: `Sobald ${dog} bei 5 Metern zuverlässig zu dir guckt, ist das die Basis für vieles weitere — Rückruf, Leinen-Training, Begegnungen mit anderen Hunden. Nicht überspringen, lieber sicher beherrschen.`,
      },
    ],
  };
}
