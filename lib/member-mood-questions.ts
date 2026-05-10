// Client-safe Konstanten + Typen fuer Stimmungs-/Wochen-Check.
// KEINE server-only Imports! Wird sowohl in Server-Routes als auch
// in Client-Components verwendet. Aus member-mood.ts ausgelagert,
// damit Client-Bundles nicht ueber 'server-only' stolpern.

export type Mood = "gut" | "mittel" | "schwierig";

export interface MoodQuestion {
  key: string;
  text: string;
  options: { value: string; label: string }[];
}

// ── Tagebuch-Fragen pro Modul-Uebung (daily) ──────────────────────────
export const QUESTIONS_BY_PROBLEM: Record<string, MoodQuestion[]> = {
  pulling: [
    {
      key: "leine_dauer",
      text: "Wie viel Zeit lief er locker an der Leine?",
      options: [
        { value: "kaum", label: "Kaum" },
        { value: "kurz", label: "Etwa 1/3" },
        { value: "haelfte", label: "Etwa Hälfte" },
        { value: "meist", label: "Großteil" },
      ],
    },
    {
      key: "richtungswechsel",
      text: "Hat er auf Richtungswechsel reagiert?",
      options: [
        { value: "sofort", label: "Ja, sofort" },
        { value: "mehrmals", label: "Nach 2-3 Versuchen" },
        { value: "nein", label: "Nein" },
      ],
    },
  ],
  barking: [
    {
      key: "ausloeser",
      text: "Was hat das Bellen ausgelöst?",
      options: [
        { value: "tuerklingel", label: "Türklingel/Besuch" },
        { value: "andere_hunde", label: "Andere Hunde" },
        { value: "passanten", label: "Passanten" },
        { value: "geraeusche", label: "Außengeräusche" },
        { value: "langeweile", label: "Langeweile" },
      ],
    },
    {
      key: "ruhe_gefunden",
      text: "Wie schnell wurde er wieder ruhig?",
      options: [
        { value: "sofort", label: "Sofort" },
        { value: "mit_kommando", label: "Mit Kommando" },
        { value: "lange", label: "Hat lange gedauert" },
      ],
    },
  ],
  aggression: [
    {
      key: "ausloeser",
      text: "Was hat ihn aggressiv reagieren lassen?",
      options: [
        { value: "andere_hunde", label: "Andere Hunde" },
        { value: "menschen", label: "Menschen" },
        { value: "ressource", label: "Futter/Spielzeug" },
        { value: "leine", label: "An der Leine" },
      ],
    },
    {
      key: "distanz",
      text: "Wie war die Distanz zum Auslöser?",
      options: [
        { value: "nah", label: "Sehr nah (<3m)" },
        { value: "mittel", label: "Mittel (3-10m)" },
        { value: "weit", label: "Weit (>10m)" },
      ],
    },
  ],
  anxiety: [
    {
      key: "alleinzeit",
      text: "Wie lange war er allein?",
      options: [
        { value: "kurz", label: "Bis 5 Min" },
        { value: "mittel", label: "5-30 Min" },
        { value: "lang", label: "Über 30 Min" },
      ],
    },
    {
      key: "verhalten",
      text: "Wie hat er reagiert?",
      options: [
        { value: "ruhig", label: "Ruhig geblieben" },
        { value: "winselt", label: "Hat gewinselt" },
        { value: "bellt", label: "Hat gebellt" },
        { value: "zerstoert", label: "Was zerstört" },
      ],
    },
  ],
  jumping: [
    {
      key: "haeufigkeit",
      text: "Wie oft hat er gesprungen?",
      options: [
        { value: "gar_nicht", label: "Gar nicht" },
        { value: "1_2", label: "1-2 mal" },
        { value: "oft", label: "Mehrfach" },
      ],
    },
    {
      key: "wer",
      text: "Bei wem ist er gesprungen?",
      options: [
        { value: "familie", label: "Familie" },
        { value: "besuch", label: "Besuch" },
        { value: "fremde", label: "Fremde" },
      ],
    },
  ],
  recall: [
    {
      key: "kam_zurueck",
      text: "Ist er auf den Rückruf gekommen?",
      options: [
        { value: "sofort", label: "Sofort" },
        { value: "spaet", label: "Verspätet" },
        { value: "gar_nicht", label: "Gar nicht" },
      ],
    },
    {
      key: "ablenkung",
      text: "Welche Ablenkung war da?",
      options: [
        { value: "keine", label: "Keine" },
        { value: "hunde", label: "Andere Hunde" },
        { value: "wild", label: "Wild/Vögel" },
        { value: "stark", label: "Stark abgelenkt" },
      ],
    },
  ],
  energy: [
    {
      key: "auspowern",
      text: "Wie lange habt ihr trainiert/gespielt?",
      options: [
        { value: "kurz", label: "Bis 15 Min" },
        { value: "mittel", label: "15-45 Min" },
        { value: "lang", label: "Über 45 Min" },
      ],
    },
    {
      key: "ruhe_danach",
      text: "Hat er danach Ruhe gefunden?",
      options: [
        { value: "ja", label: "Ja, ist eingeschlafen" },
        { value: "etwas", label: "Etwas ruhiger" },
        { value: "nein", label: "Weiter aufgedreht" },
      ],
    },
  ],
  destructive: [
    {
      key: "was",
      text: "Was hat er angefasst/zerstört?",
      options: [
        { value: "schuhe", label: "Schuhe" },
        { value: "moebel", label: "Möbel" },
        { value: "kabel", label: "Kabel" },
        { value: "papier", label: "Papier/Müll" },
        { value: "nichts", label: "Nichts heute" },
      ],
    },
    {
      key: "tausch",
      text: "Hat das Tausch-Spiel geklappt?",
      options: [
        { value: "ja", label: "Ja, gerne hergegeben" },
        { value: "zoegerlich", label: "Zögerlich" },
        { value: "nein", label: "Nein, nicht hergegeben" },
        { value: "nicht_versucht", label: "Nicht probiert" },
      ],
    },
  ],
  soiling: [
    {
      key: "wo",
      text: "Wo wurde gepinkelt?",
      options: [
        { value: "draussen", label: "Nur draußen" },
        { value: "panne", label: "1 Panne drinnen" },
        { value: "mehrfach", label: "Mehrfach drinnen" },
      ],
    },
    {
      key: "pausen",
      text: "Wie viele Pipi-Pausen draußen?",
      options: [
        { value: "wenig", label: "1-2 mal" },
        { value: "normal", label: "3-5 mal" },
        { value: "viel", label: "6+ mal" },
      ],
    },
  ],
  mouthing: [
    {
      key: "aufgenommen",
      text: "Hat er was aufgenommen?",
      options: [
        { value: "nichts", label: "Nichts" },
        { value: "essbares", label: "Essen vom Boden" },
        { value: "muell", label: "Müll" },
        { value: "stoeckchen", label: "Stöckchen/Steine" },
      ],
    },
    {
      key: "aus_kommando",
      text: "Hat das 'Aus' funktioniert?",
      options: [
        { value: "sofort", label: "Sofort hergegeben" },
        { value: "mit_tausch", label: "Mit Tausch" },
        { value: "nein", label: "Nein" },
        { value: "nicht_versucht", label: "Nicht probiert" },
      ],
    },
  ],
};

export function getQuestionsForProblem(
  key: string | null
): MoodQuestion[] {
  if (!key) return [];
  return QUESTIONS_BY_PROBLEM[key] || [];
}

// ── Wochen-Fragen (4-5 konkrete Situations-Fragen pro Problem) ────────
export const WEEKLY_QUESTIONS_BY_PROBLEM: Record<string, MoodQuestion[]> = {
  pulling: [
    {
      key: "leine_locker_pct",
      text: "Wie viel Prozent vom Spaziergang lief er locker?",
      options: [
        { value: "kaum", label: "Kaum (<20%)" },
        { value: "ein_drittel", label: "Etwa 1/3" },
        { value: "haelfte", label: "Etwa Hälfte" },
        { value: "groesster_teil", label: "Großteil (>70%)" },
      ],
    },
    {
      key: "schwierigster_moment",
      text: "Wann hat er am stärksten gezogen?",
      options: [
        { value: "anfang", label: "Direkt am Anfang" },
        { value: "andere_hunde", label: "Bei anderen Hunden" },
        { value: "richtungswechsel", label: "Beim Heimweg/zurück" },
        { value: "ablenkung", label: "Bei Wild/Geruch" },
        { value: "gleichmaessig", label: "Durchgehend" },
      ],
    },
    {
      key: "richtungswechsel_reaktion",
      text: "Wie schnell hat er auf Richtungswechsel reagiert?",
      options: [
        { value: "sofort", label: "Sofort" },
        { value: "2_3_versuche", label: "Nach 2-3 Versuchen" },
        { value: "schwer", label: "Nur mit Druck" },
        { value: "nicht_geuebt", label: "Nicht geübt" },
      ],
    },
    {
      key: "leinen_typ",
      text: "Welche Leine benutzt du gerade?",
      options: [
        { value: "rollleine", label: "Roll-Leine" },
        { value: "kurz_1m", label: "Kurze Leine (1-1,5m)" },
        { value: "fuehrleine_2m", label: "Führleine (2m)" },
        { value: "schleppleine", label: "Schleppleine (5m+)" },
      ],
    },
    {
      key: "uebungs_tage",
      text: "An wie vielen Tagen bewusst geübt?",
      options: [
        { value: "fast_taeglich", label: "Fast täglich" },
        { value: "mehrmals", label: "3-4 Tage" },
        { value: "selten", label: "1-2 Tage" },
        { value: "gar_nicht", label: "Gar nicht" },
      ],
    },
  ],
  barking: [
    {
      key: "ausloeser_woche",
      text: "Was hat diese Woche am häufigsten zum Bellen geführt?",
      options: [
        { value: "tuerklingel", label: "Türklingel/Besuch" },
        { value: "andere_hunde", label: "Andere Hunde draußen" },
        { value: "passanten", label: "Passanten am Fenster" },
        { value: "geraeusche", label: "Außengeräusche" },
        { value: "alleinsein", label: "Wenn allein" },
        { value: "langeweile", label: "Langeweile" },
      ],
    },
    {
      key: "ruhe_dauer",
      text: "Wie schnell wurde er nach dem Bellen wieder ruhig?",
      options: [
        { value: "sofort", label: "Sofort" },
        { value: "mit_kommando", label: "Mit Ruhe-Wort" },
        { value: "minuten", label: "Nach Minuten" },
        { value: "lange", label: "Hat lange gedauert" },
      ],
    },
    {
      key: "tuerklingel_uebung",
      text: "Habt ihr die Türklingel geübt?",
      options: [
        { value: "mehrmals_woche", label: "Mehrmals diese Woche" },
        { value: "1_2_mal", label: "1-2 mal" },
        { value: "nicht_dieses_mal", label: "Diese Woche nicht" },
        { value: "kein_thema", label: "Ist nicht mein Auslöser" },
      ],
    },
    {
      key: "besser_oder_schlechter",
      text: "Im Vergleich zur Vorwoche?",
      options: [
        { value: "deutlich_weniger", label: "Deutlich weniger Bellen" },
        { value: "etwas_weniger", label: "Etwas weniger" },
        { value: "gleich", label: "Wie vorher" },
        { value: "mehr", label: "Eher mehr" },
      ],
    },
  ],
  aggression: [
    {
      key: "vorfaelle_anzahl",
      text: "Wie viele kritische Begegnungen gab es?",
      options: [
        { value: "keine", label: "Keine" },
        { value: "1_2", label: "1-2 mal" },
        { value: "3_5", label: "3-5 mal" },
        { value: "taeglich", label: "Fast täglich" },
      ],
    },
    {
      key: "ausloeser",
      text: "Was war der Hauptauslöser?",
      options: [
        { value: "andere_hunde", label: "Andere Hunde" },
        { value: "menschen", label: "Fremde Menschen" },
        { value: "leine", label: "Nur an der Leine" },
        { value: "ressource", label: "Futter/Spielzeug" },
        { value: "im_haus", label: "Besuch zuhause" },
      ],
    },
    {
      key: "distanz_minimum",
      text: "Wie nah ging der Auslöser ran, bevor er reagierte?",
      options: [
        { value: "sehr_nah", label: "Sehr nah (<3m)" },
        { value: "mittel", label: "Mittel (3-10m)" },
        { value: "weit", label: "Weit (>10m)" },
        { value: "egal", label: "Konnte vorbei ohne Reaktion" },
      ],
    },
    {
      key: "maulkorb_geschirr",
      text: "Welche Sicherheits-Ausrüstung hattest du?",
      options: [
        { value: "maulkorb", label: "Maulkorb" },
        { value: "geschirr_kurz", label: "Geschirr + kurze Leine" },
        { value: "halsband", label: "Nur Halsband" },
        { value: "wechselnd", label: "Wechselnd" },
      ],
    },
    {
      key: "umlenken",
      text: "Hat das Umlenken auf dich geklappt?",
      options: [
        { value: "meist", label: "Meistens" },
        { value: "manchmal", label: "Manchmal" },
        { value: "selten", label: "Selten" },
        { value: "nicht_geuebt", label: "Noch nicht geübt" },
      ],
    },
  ],
  anxiety: [
    {
      key: "max_dauer_ohne_stress",
      text: "Wie lange war er max. allein - OHNE zu stressen?",
      options: [
        { value: "sekunden", label: "Wenige Sekunden" },
        { value: "minuten", label: "Bis 5 Min" },
        { value: "viertel", label: "5-30 Min" },
        { value: "stunde", label: "30-60 Min" },
        { value: "mehrere", label: "Mehrere Stunden" },
      ],
    },
    {
      key: "verhalten_allein",
      text: "Wie hat er beim Alleinsein reagiert?",
      options: [
        { value: "ruhig", label: "Ruhig geblieben" },
        { value: "winselt", label: "Hat gewinselt" },
        { value: "bellt", label: "Hat gebellt" },
        { value: "zerstoert", label: "Hat was zerstört" },
        { value: "ueberall", label: "Pinkel/Kot in Wohnung" },
      ],
    },
    {
      key: "verabschiedung",
      text: "Wie verabschiedest du dich aktuell?",
      options: [
        { value: "kommentar_los", label: "Kommentarlos raus" },
        { value: "kurz_streicheln", label: "Kurz Streicheln" },
        { value: "ritual", label: "Mit Ritual (Kong etc.)" },
        { value: "viel_drumherum", label: "Viel Drumherum" },
      ],
    },
    {
      key: "uebungen_woche",
      text: "Wie viele Mini-Trennungen geübt?",
      options: [
        { value: "taeglich", label: "Täglich mehrere" },
        { value: "ein_paar", label: "Ein paar diese Woche" },
        { value: "kaum", label: "Kaum" },
        { value: "musste_weg", label: "Musste eh weg/keine Übung" },
      ],
    },
  ],
  jumping: [
    {
      key: "haeufigkeit",
      text: "Wie oft hat er diese Woche angesprungen?",
      options: [
        { value: "gar_nicht", label: "Gar nicht" },
        { value: "1_3_mal", label: "1-3 mal" },
        { value: "fast_taeglich", label: "Fast täglich" },
        { value: "jede_begruessung", label: "Bei fast jeder Begrüßung" },
      ],
    },
    {
      key: "wer",
      text: "Wen hat er angesprungen?",
      options: [
        { value: "familie", label: "Familie" },
        { value: "besuch", label: "Besuch" },
        { value: "fremde_unterwegs", label: "Fremde unterwegs" },
        { value: "kinder", label: "Kinder" },
      ],
    },
    {
      key: "sitz_vor_begruessung",
      text: "Klappt das 'Sitz vor Begrüßung'?",
      options: [
        { value: "zuhause_ja", label: "Zuhause meistens" },
        { value: "fremde_nein", label: "Bei Fremden noch nicht" },
        { value: "ueberall", label: "Überall zuverlässig" },
        { value: "nicht_geuebt", label: "Noch nicht geübt" },
      ],
    },
    {
      key: "konsequenz_familie",
      text: "Reagiert die Familie einheitlich?",
      options: [
        { value: "alle_gleich", label: "Ja, alle gleich" },
        { value: "meistens", label: "Meistens" },
        { value: "uneinig", label: "Eher uneinheitlich" },
        { value: "alleine", label: "Trainiere allein" },
      ],
    },
  ],
  recall: [
    {
      key: "kam_zurueck_pct",
      text: "Wie oft kam er beim Rufen?",
      options: [
        { value: "fast_immer", label: "Fast immer" },
        { value: "meistens", label: "Meistens" },
        { value: "manchmal", label: "Etwa Hälfte" },
        { value: "selten", label: "Selten" },
        { value: "nie", label: "Quasi nie" },
      ],
    },
    {
      key: "ablenkung",
      text: "Was hat ihn am stärksten abgelenkt?",
      options: [
        { value: "keine", label: "Hatten keine Ablenkung" },
        { value: "andere_hunde", label: "Andere Hunde" },
        { value: "wild", label: "Wild/Vögel" },
        { value: "menschen", label: "Menschen/Jogger" },
        { value: "spielzeug", label: "Spielzeug/Stöcke" },
        { value: "geruch", label: "Spannender Geruch" },
      ],
    },
    {
      key: "uebungs_setting",
      text: "Wo habt ihr trainiert?",
      options: [
        { value: "garten", label: "Nur Garten/zuhause" },
        { value: "schleppleine", label: "Schleppleine draußen" },
        { value: "freilauf_bekannt", label: "Freilauf bekannte Strecke" },
        { value: "freilauf_neu", label: "Freilauf neue Gegend" },
      ],
    },
    {
      key: "belohnung",
      text: "Was hast du als Belohnung benutzt?",
      options: [
        { value: "leckerli_normal", label: "Normales Leckerli" },
        { value: "leckerli_premium", label: "Hochwertig (Wurst/Käse)" },
        { value: "spielzeug", label: "Spielzeug" },
        { value: "stimme", label: "Nur Stimme/Streicheln" },
        { value: "wechselnd", label: "Wechselnd" },
      ],
    },
    {
      key: "rueckruf_signal",
      text: "Welches Signal nutzt du?",
      options: [
        { value: "name", label: "Den Namen" },
        { value: "kommando", label: "Wort wie 'Hier'" },
        { value: "pfeife", label: "Pfeife" },
        { value: "mix", label: "Mehreres durcheinander" },
      ],
    },
  ],
  energy: [
    {
      key: "ruhe_phasen",
      text: "Wie viele längere Ruhe-Phasen am Tag?",
      options: [
        { value: "viele", label: "Mehrere (gut)" },
        { value: "wenige", label: "1-2" },
        { value: "kaum", label: "Kaum" },
        { value: "gar_keine", label: "Gar keine - dauernd hibbelig" },
      ],
    },
    {
      key: "kopfarbeit",
      text: "Wie oft Suchspiele/Schnüffel-Aufgaben?",
      options: [
        { value: "taeglich", label: "Täglich" },
        { value: "mehrmals", label: "3-4× Woche" },
        { value: "selten", label: "1-2× Woche" },
        { value: "gar_nicht", label: "Gar nicht" },
      ],
    },
    {
      key: "bewegung_taeglich",
      text: "Wie viel Bewegung pro Tag?",
      options: [
        { value: "wenig", label: "Unter 1h" },
        { value: "mittel", label: "1-2h" },
        { value: "viel", label: "2-3h" },
        { value: "sehr_viel", label: "3h+" },
      ],
    },
    {
      key: "ruhe_decke",
      text: "Klappt die Ruhe-Decke / das Platz-Halten?",
      options: [
        { value: "gut", label: "Bleibt gerne dort" },
        { value: "kurz", label: "Nur kurz" },
        { value: "kaum", label: "Steht sofort auf" },
        { value: "nicht_geuebt", label: "Noch nicht geübt" },
      ],
    },
    {
      key: "abends",
      text: "Wie ist er abends?",
      options: [
        { value: "ruhig", label: "Geht runter" },
        { value: "etwas_aufgedreht", label: "Etwas aufgedreht" },
        { value: "voll_an", label: "Voll auf Touren" },
      ],
    },
  ],
  destructive: [
    {
      key: "was_kaputt",
      text: "Was hat er diese Woche zerstört?",
      options: [
        { value: "nichts", label: "Nichts" },
        { value: "schuhe", label: "Schuhe" },
        { value: "moebel", label: "Möbel/Holz" },
        { value: "kabel", label: "Kabel" },
        { value: "papier", label: "Papier/Müll" },
        { value: "kissen", label: "Kissen/Decken" },
      ],
    },
    {
      key: "wann",
      text: "Wann passiert es meistens?",
      options: [
        { value: "alleine", label: "Wenn allein" },
        { value: "abend", label: "Abends/wenn unausgelastet" },
        { value: "morgens", label: "Morgens vor dem Spaziergang" },
        { value: "wenn_da", label: "Auch wenn ich da bin" },
      ],
    },
    {
      key: "kau_alternativen",
      text: "Hast du Kau-Alternativen angeboten?",
      options: [
        { value: "mehrere_raeume", label: "In mehreren Räumen verteilt" },
        { value: "ein_paar", label: "Ein paar Spielzeuge" },
        { value: "kaum", label: "Kaum was" },
      ],
    },
    {
      key: "tausch_klappt",
      text: "Wie klappt das Tausch-Spiel?",
      options: [
        { value: "zuverlaessig", label: "Gibt zuverlässig her" },
        { value: "manchmal", label: "Manchmal" },
        { value: "knurrt", label: "Knurrt/verteidigt" },
        { value: "nicht_geuebt", label: "Noch nicht geübt" },
      ],
    },
    {
      key: "auspowerung",
      text: "Wie ausgelastet war er insgesamt?",
      options: [
        { value: "gut", label: "Genug Bewegung + Kopfarbeit" },
        { value: "nur_bewegung", label: "Viel Bewegung, wenig Kopf" },
        { value: "wenig_zeit", label: "Wenig Zeit gehabt" },
      ],
    },
  ],
  soiling: [
    {
      key: "pannen_anzahl",
      text: "Wie viele Pannen drinnen diese Woche?",
      options: [
        { value: "keine", label: "Keine" },
        { value: "1_2", label: "1-2" },
        { value: "3_5", label: "3-5" },
        { value: "taeglich", label: "Fast täglich" },
      ],
    },
    {
      key: "pausen_pro_tag",
      text: "Wie viele Pipi-Pausen draußen pro Tag?",
      options: [
        { value: "1_2", label: "1-2 mal" },
        { value: "3_5", label: "3-5 mal" },
        { value: "6_8", label: "6-8 mal" },
        { value: "mehr", label: "Sehr oft" },
      ],
    },
    {
      key: "panne_wann",
      text: "Wann passieren die Pannen meistens?",
      options: [
        { value: "morgens", label: "Morgens nach dem Aufstehen" },
        { value: "nach_fressen", label: "Nach dem Fressen" },
        { value: "alleine", label: "Wenn allein" },
        { value: "nachts", label: "Nachts" },
        { value: "egal", label: "Über den Tag verteilt" },
        { value: "keine", label: "Keine Pannen" },
      ],
    },
    {
      key: "lob_draussen",
      text: "Lobst du sofort wenn er draußen pinkelt?",
      options: [
        { value: "sofort_immer", label: "Sofort + Leckerli, jedes Mal" },
        { value: "manchmal", label: "Manchmal" },
        { value: "selten", label: "Selten" },
        { value: "nicht_dran_gedacht", label: "Nicht dran gedacht" },
      ],
    },
    {
      key: "alter_panne",
      text: "Wie alt ist dein Hund?",
      options: [
        { value: "welpe", label: "Welpe (<6 Mon)" },
        { value: "junghund", label: "Junghund (6-18 Mon)" },
        { value: "erwachsen", label: "Erwachsen" },
        { value: "senior", label: "Senior" },
      ],
    },
  ],
  mouthing: [
    {
      key: "haeufigkeit",
      text: "Wie oft hat er was vom Boden aufgenommen?",
      options: [
        { value: "kaum", label: "Kaum noch" },
        { value: "1_3_mal", label: "1-3 mal die Woche" },
        { value: "fast_taeglich", label: "Fast täglich" },
        { value: "mehrmals_taeglich", label: "Mehrmals täglich" },
      ],
    },
    {
      key: "was_aufgenommen",
      text: "Was hat er hauptsächlich aufgenommen?",
      options: [
        { value: "essbares", label: "Essbares (Brötchen, Käse)" },
        { value: "muell", label: "Müll/Verpackung" },
        { value: "stoeckchen", label: "Stöckchen/Steine" },
        { value: "kot", label: "Kot anderer Tiere" },
        { value: "kein", label: "Hat nichts mehr aufgenommen" },
      ],
    },
    {
      key: "aus_signal",
      text: "Wie zuverlässig klappt das 'Aus'?",
      options: [
        { value: "sofort", label: "Sofort hergegeben" },
        { value: "mit_tausch", label: "Mit Tausch (Leckerli)" },
        { value: "nur_zuhause", label: "Nur zuhause" },
        { value: "kaum", label: "Kaum" },
        { value: "nicht_geuebt", label: "Noch nicht geübt" },
      ],
    },
    {
      key: "leinen_situation",
      text: "Wie ist er an der Leine geführt?",
      options: [
        { value: "ohne_leine", label: "Meist ohne Leine" },
        { value: "lang", label: "Lange/Schleppleine" },
        { value: "kurz", label: "Kurz an der Seite" },
        { value: "wechselnd", label: "Wechselnd" },
      ],
    },
    {
      key: "maulkorb_training",
      text: "Hast du Maulkorb-Training erwogen?",
      options: [
        { value: "habe_geuebt", label: "Ja, schon geübt" },
        { value: "ueberlege", label: "Überlege es" },
        { value: "kein_thema", label: "Bisher kein Thema" },
        { value: "abgelehnt", label: "Will ich nicht" },
      ],
    },
  ],
};

// Generische Wochen-Fragen, falls kein Problem-Key bekannt ist
export const WEEKLY_QUESTIONS_GENERIC: MoodQuestion[] = [
  {
    key: "fortschritt",
    text: "Wie ist der Fortschritt diese Woche?",
    options: [
      { value: "deutlich_besser", label: "Deutlich besser" },
      { value: "etwas_besser", label: "Etwas besser" },
      { value: "gleich", label: "Wie vorher" },
      { value: "schlechter", label: "Eher schlechter" },
    ],
  },
  {
    key: "uebungs_tage",
    text: "An wie vielen Tagen habt ihr geübt?",
    options: [
      { value: "fast_taeglich", label: "Fast täglich" },
      { value: "mehrmals", label: "3-4 Tage" },
      { value: "selten", label: "1-2 Tage" },
      { value: "gar_nicht", label: "Gar nicht" },
    ],
  },
];

export function getWeeklyQuestions(
  problemKey: string | null
): MoodQuestion[] {
  if (!problemKey) return WEEKLY_QUESTIONS_GENERIC;
  return WEEKLY_QUESTIONS_BY_PROBLEM[problemKey] || WEEKLY_QUESTIONS_GENERIC;
}
