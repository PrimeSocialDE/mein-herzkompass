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

// Konvention im Pfoten-Plan: jede Uebung hat IMMER 5 Schritte.
// Fallback haelt sich dran damit User keinen Unterschied zur echten
// Anleitung sieht.
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
      title: "Wiederhole bis es sicher klappt",
      content: `Mach das gleiche 3 Mal hintereinander. Solange es noch hakt, bleib auf dieser Stufe. ${dog} braucht die Sicherheit der Wiederholung bevor es weitergeht.`,
    },
    {
      type: "step",
      title: "Steigere die Schwierigkeit",
      content: "Erst wenn alle 3 sauber klappen, machst du es einen Tick schwerer: etwas länger, etwas mehr Ablenkung, etwas weiter weg.",
    },
    {
      type: "step",
      title: "Übe im echten Alltag",
      content: `Wenn die Übung kontrolliert sitzt, baut ihr sie schrittweise in normale Spaziergänge oder Alltagssituationen ein. Damit ${dog} es nicht nur als 'Trainings-Spiel' kennt.`,
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
