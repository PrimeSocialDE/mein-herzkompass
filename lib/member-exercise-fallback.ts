// Geteilte Fallback-Sections fuer Module die in der DB sparse befuellt
// sind. Wird sowohl von FirstExerciseCard (Dashboard) als auch von der
// Modul-Detail-Page (/mitglieder/modul/[slug]) genutzt damit der User
// IMMER eine vollstaendige Schritt-fuer-Schritt-Anleitung sieht —
// statt "Setz dich ruhig hin..." als einzige Zeile.

export interface ContentSection {
  type: "text" | "step" | "tip" | "do" | "dont" | "frequency";
  title?: string;
  content?: string;
  items?: string[];
}

export function buildExerciseFallback(dog: string): ContentSection[] {
  return [
    {
      type: "step",
      title: "Bereite die Situation vor",
      content: `Such dir einen ruhigen Moment ohne Ablenkung. ${dog} sollte entspannt sein, nicht hibbelig oder hungrig. 5 kleine Leckerli bereit halten.`,
    },
    {
      type: "step",
      title: "Starte die Übung in Mini-Schritten",
      content: `Mach den ersten Versuch ganz kurz — 30 Sekunden reichen. Wenn ${dog} mitmacht: sofort belohnen. Wenn nicht: kurz pausieren, neu ansetzen.`,
    },
    {
      type: "step",
      title: "Wiederhole und steigere langsam",
      content: "Mach das gleiche 3 Mal hintereinander. Erst wenn alle 3 klappen, machst du es einen Tick schwerer (länger, mit mehr Ablenkung).",
    },
    {
      type: "do",
      title: "Mach das",
      items: [
        "Belohne IMMER innerhalb von 3 Sekunden",
        "Bleibe ruhig, ohne hektische Bewegungen",
        "Hör auf wenn es klappt — nicht wenn's schief geht",
      ],
    },
    {
      type: "dont",
      title: "Bitte nicht",
      items: [
        "Nicht schimpfen wenn was nicht klappt",
        "Nicht zu lange üben — max 5-10 Min am Stück",
        `Nicht hetzen — ${dog} braucht Zeit zum Lernen`,
      ],
    },
    {
      type: "frequency",
      title: "Wie oft",
      content: "Täglich 1-2 mal je 5 Minuten. Lieber kurz und häufig als lang und selten.",
    },
    {
      type: "tip",
      title: "Pfoten-Plan Tipp",
      content: `Wenn ${dog} es 3 Tage in Folge schafft, ist die Basis sicher. Erst dann zur nächsten Schwierigkeitsstufe gehen.`,
    },
  ];
}
