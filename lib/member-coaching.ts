// Daily-Coaching-Tipps fuer /mitglieder/erfolge/coaching.
// Pro Problem-Key eine Liste von kurzen Trainings-Tipps.
// Tip-of-the-Day per deterministischem Day-of-Year-Index.

export interface DailyTip {
  title: string;
  body: string;
}

const TIPS_BY_PROBLEM: Record<string, DailyTip[]> = {
  pulling: [
    {
      title: "Stehen bleiben statt ziehen",
      body: "Sobald die Leine spannt: stehen bleiben. Sekunde warten. Kommt dein Hund zurück, weiterlaufen. Konsequenz schlägt Strenge.",
    },
    {
      title: "Belohnung neben dir",
      body: "Halt heute beim Spaziergang ein Leckerli auf Knie-Höhe an deiner Seite. Dein Hund lernt: hier ist der spannende Ort.",
    },
    {
      title: "Richtungswechsel als Spiel",
      body: "Wenn die Leine zieht, dreh dich überraschend um und geh in die andere Richtung. Ohne Worte. Bald guckt dein Hund mehr auf dich.",
    },
    {
      title: "5 Min vorher auspowern",
      body: "Vor dem Spaziergang 5 Min Suchspiel im Garten. Halb so viel Energie an der Leine = halb so viel Ziehen.",
    },
  ],
  barking: [
    {
      title: "Erst beobachten, dann handeln",
      body: "Wenn dein Hund bellt: nicht sofort schimpfen. Frag dich: warnt er, hat er Angst, langweilt er sich? Reaktion passt sich der Ursache an.",
    },
    {
      title: "Ruhe-Wort etablieren",
      body: "Wenn dein Hund von selbst ruhig wird, sag ein klares Wort wie 'Schluss' und belohne. Nach 1 Woche reicht das Wort allein.",
    },
    {
      title: "Türklingel-Training",
      body: "Lass jemanden klingeln. Bevor dein Hund bellt, bietest du Decke + Leckerli an. Belohnung für ruhig liegen, nicht für Bellen.",
    },
  ],
  aggression: [
    {
      title: "Distanz ist deine beste Waffe",
      body: "Wenn dein Hund einen Auslöser sieht: vergrössere SOFORT die Distanz. Aus 5 m Stress werden 20 m Entspannung.",
    },
    {
      title: "Kein Ruck an der Leine",
      body: "Bei Aggression NIE ruckartig korrigieren. Das verstärkt die negative Verknüpfung. Lieber: Richtung wechseln, Distanz schaffen.",
    },
    {
      title: "Profi dazu holen",
      body: "Aggression solltest du nicht alleine lösen. Such einen positiv arbeitenden Trainer in deiner Nähe — wir helfen gern bei der Auswahl.",
    },
  ],
  anxiety: [
    {
      title: "Nicht trösten, nicht ignorieren",
      body: "Bei Trennungsangst: kein langes Verabschieden, keine grosse Begrüssung. Komm und geh wie selbstverständlich.",
    },
    {
      title: "Mini-Trennungen üben",
      body: "Heute: 30 Sekunden raus aus dem Raum, ohne Worte. Wieder rein wie nichts. Steigere täglich um 30 Sekunden.",
    },
    {
      title: "Beschäftigung vorm Gehen",
      body: "Vorm Verlassen einen Kong mit Erdnussbutter füllen. Dein Hund verbindet 'Du gehst' mit 'Was Schönes kommt'.",
    },
  ],
  jumping: [
    {
      title: "Vier Pfoten = Aufmerksamkeit",
      body: "Wenn dein Hund springt: sofort wegdrehen, kein Augenkontakt. Sind alle 4 Pfoten am Boden, dreh dich um und begrüsse ruhig.",
    },
    {
      title: "Sitz vor Begrüssung",
      body: "Vor jedem Hallo: 'Sitz' einfordern. Dein Hund lernt: Begrüssung gibt's nur im Sitzen.",
    },
  ],
  recall: [
    {
      title: "Namen positiv aufladen",
      body: "Sag heute den Namen deines Hundes 10x am Tag — und JEDES Mal gibts ein kleines Leckerli. Der Name wird zur besten Belohnung.",
    },
    {
      title: "Kommen lohnt sich immer",
      body: "Wenn dein Hund kommt: dicke Belohnung. Auch wenn du sauer warst. Nur so lernt er: 'kommen' = gut, immer.",
    },
    {
      title: "Pfeifen statt Rufen",
      body: "Pfeife ist klarer als Stimme. Heute 5x trainieren: pfeifen → Hund kommt → Leckerli + Lob.",
    },
  ],
  energy: [
    {
      title: "Kopf vor Beine",
      body: "Mentale Auslastung erschöpft schneller als Rennen. Heute: 10 Min Suchspiel mit versteckten Leckerli ersetzt 30 Min Spaziergang.",
    },
    {
      title: "Ruhe ist eine Übung",
      body: "Auch Nichtstun musst du üben. Decke ausrollen, neben dir setzen, belohnen wenn dein Hund liegen bleibt. Steigerung: 30 Sek → 5 Min.",
    },
  ],
  destructive: [
    {
      title: "Tausch-Spiel als Routine",
      body: "Wenn dein Hund was Falsches im Maul hat: Leckerli zeigen, freundlich 'Tausch' sagen. Niemals reissen, sonst verteidigt er.",
    },
    {
      title: "Kau-Alternativen griffbereit",
      body: "Lege heute 3 Kau-Spielzeuge in verschiedene Räume. Wenn dein Hund auf was Falsches zugeht: erstmal Alternative anbieten.",
    },
  ],
  soiling: [
    {
      title: "Pipi-Pause-Plan",
      body: "Feste Zeiten: nach Schlaf, nach Fressen, nach Spiel, alle 2-3 Stunden. Nach 2 Wochen ist die Routine drin.",
    },
    {
      title: "Erfolg sofort belohnen",
      body: "Pipi draussen → SOFORT (nicht erst zuhause) Leckerli + Lob. Verbindung muss in den ersten 3 Sekunden klick machen.",
    },
  ],
  mouthing: [
    {
      title: "'Aus'-Kommando aufbauen",
      body: "Heute: kleines Spielzeug in der Hand, Hund nimmt es. Sag 'Aus' und biete Leckerli. Tausch klappt, sobald er loslässt.",
    },
    {
      title: "Spazierweg checken",
      body: "Vor dem Spaziergang den Weg kurz mental durchgehen: wo gibt's typischerweise Müll, Essensreste? Da rechtzeitig Aufmerksamkeit umlenken.",
    },
  ],
};

const GENERIC_TIPS: DailyTip[] = [
  {
    title: "Kurze Sessions, oft",
    body: "5 Min konzentriertes Training schlägt 30 Min halbherzig. Lieber 3x am Tag kurz als einmal lang.",
  },
  {
    title: "Belohnung in Sekunden",
    body: "Lob und Leckerli kommen in den ersten 3 Sekunden — sonst kann dein Hund die Verknüpfung nicht herstellen.",
  },
  {
    title: "Klar, nicht laut",
    body: "Hunde reagieren auf Konsequenz, nicht auf Lautstärke. Ein klares 'Nein' wirkt mehr als ein lautes Schimpfen.",
  },
  {
    title: "Erfolg feiern",
    body: "Was klappt, sofort belohnen. Was nicht klappt: ignorieren oder neu ansetzen. Nie ärgern — Frust macht es schlimmer.",
  },
];

function dayOfYear(d: Date = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getDailyTip(problemKey: string | null): DailyTip {
  const pool =
    (problemKey && TIPS_BY_PROBLEM[problemKey]) || GENERIC_TIPS;
  const day = dayOfYear();
  return pool[day % pool.length];
}

export function getProblemTipsCount(problemKey: string | null): number {
  if (!problemKey) return GENERIC_TIPS.length;
  return (TIPS_BY_PROBLEM[problemKey] || GENERIC_TIPS).length;
}
