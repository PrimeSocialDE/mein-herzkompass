// Themen-Module-Katalog. Eigenstaendige Spezial-Module zu einzelnen
// Verhaltensthemen — verkauft als Einzel-Upsells. Slugs entsprechen
// den 'type'-Werten in /api/mollie/upsell-product-checkout (PRODUCT_PRICES).
// Wird auf /mitglieder/module in der Sektion "Themen-Module" gerendert.

export interface ThemenModule {
  slug: string;
  title: string;
  short: string;          // 1-Liner fuer Kartenvorderseite (alte Beschreibung)
  goal: string;           // Outcome-Versprechen, was der Hund am Ende kann
  features: string[];     // Backside-Inhalte
  emoji: string;
  image_url?: string | null; // optional: ueberschreibt Emoji-Header
  price_cents: number;
  problem_match: string | null; // matched gegen quiz_result.dog_problem
  badge_text: string | null;
  // Italienische Parallel-Felder (DE bleibt unangetastet; PL faellt via ?? auf DE zurueck)
  title_it?: string;
  goal_it?: string;
  short_it?: string;
  features_it?: string[];
  badge_text_it?: string | null;
  image_url_it?: string;
}

const DEFAULT_PRICE = 1499; // 14,99 Euro pro Themen-Modul

export const THEMEN_MODULES: ThemenModule[] = [
  {
    slug: "thema-leinen",
    title: "Leinenführigkeit",
    goal: "Läuft entspannt an der Leine",
    short: "Locker an der Leine in 14 Tagen.",
    features: [
      "Schritt-für-Schritt Aufbau in 14 Tagen",
      "Was Hunde wirklich beruhigt",
      "Übungen für Stadt, Wald & Park",
      "Sofort als PDF im Postfach",
    ],
    emoji: "🦮",
    image_url: "/Leinenfuhr.png",
    price_cents: DEFAULT_PRICE,
    problem_match: "pulling",
    badge_text: "Beliebt",
    title_it: "Condotta al guinzaglio",
    goal_it: "Cammina rilassato al guinzaglio",
    short_it: "Al guinzaglio senza tirare in 14 giorni.",
    features_it: [
      "Percorso passo passo in 14 giorni",
      "Cosa calma davvero i cani",
      "Esercizi per città, bosco e parco",
      "Subito come PDF nella casella",
    ],
    badge_text_it: "Popolare",
    image_url_it: "/Leinenfuhr.it.png",
  },
  {
    slug: "thema-bellen",
    title: "Bellen abgewöhnen",
    goal: "Bellt weniger und kürzer",
    short: "Ruhe-Signal etablieren, ohne Stress.",
    features: [
      "Ursachen verstehen (Angst, Langeweile, Wache)",
      "Ruhe-Signal aufbauen",
      "Übungen für Türklingel, Besuch, Außengeräusche",
      "Sofort als PDF im Postfach",
    ],
    emoji: "🤫",
    image_url: "/BellenAbg.png",
    price_cents: DEFAULT_PRICE,
    problem_match: "barking",
    badge_text: null,
    title_it: "Smettere di abbaiare",
    goal_it: "Abbaia di meno e più brevemente",
    short_it: "Stabilire il segnale di calma, senza stress.",
    features_it: [
      "Capire le cause (paura, noia, guardia)",
      "Costruire il segnale di calma",
      "Esercizi per campanello, visite, rumori esterni",
      "Subito come PDF nella casella",
    ],
    badge_text_it: null,
    image_url_it: "/BellenAbg.it.png",
  },
  {
    slug: "thema-aggression",
    title: "Aggression entschärfen",
    goal: "Bleibt ruhig bei anderen Hunden",
    short: "Sicher umgehen, deeskalieren, vorbeugen.",
    features: [
      "Warum Hunde aggressiv reagieren",
      "Auslöser erkennen & vermeiden",
      "Deeskalations-Techniken Schritt für Schritt",
      "Wann Profi-Hilfe nötig ist",
      "Sofort als PDF im Postfach",
    ],
    emoji: "🛡️",
    image_url: "/Agression.png",
    price_cents: DEFAULT_PRICE,
    problem_match: "aggression",
    badge_text: "Ausführlich",
    title_it: "Gestire l'aggressività",
    goal_it: "Resta calmo con gli altri cani",
    short_it: "Gestire in sicurezza, calmare, prevenire.",
    features_it: [
      "Perché i cani reagiscono in modo aggressivo",
      "Riconoscere ed evitare i fattori scatenanti",
      "Tecniche di de-escalation passo passo",
      "Quando serve l'aiuto di un professionista",
      "Subito come PDF nella casella",
    ],
    badge_text_it: "Dettagliato",
    image_url_it: "/Agression.it.png",
  },
  {
    slug: "thema-trennungsangst",
    title: "Trennungsangst",
    goal: "Bleibt entspannt allein zuhause",
    short: "Allein zuhause ohne Stress.",
    features: [
      "Gewöhnen in kleinen Schritten",
      "Von 1 Min auf 4 Stunden steigern",
      "Was tun bei Rückfällen",
      "Sofort als PDF im Postfach",
    ],
    emoji: "🏠",
    image_url: "/Trennungsangst.png",
    price_cents: DEFAULT_PRICE,
    problem_match: "anxiety",
    badge_text: null,
    title_it: "Ansia da separazione",
    goal_it: "Resta rilassato da solo a casa",
    short_it: "Da solo a casa senza stress.",
    features_it: [
      "Abituarlo con piccoli passi",
      "Passare da 1 minuto a 4 ore",
      "Cosa fare in caso di ricadute",
      "Subito come PDF nella casella",
    ],
    badge_text_it: null,
    image_url_it: "/Trennungsangst.it.png",
  },
  {
    slug: "thema-anspringen",
    title: "Anspringen abgewöhnen",
    goal: "Begrüßt mit allen Pfoten am Boden",
    short: "Begrüßung mit vier Pfoten am Boden.",
    features: [
      "Warum Hunde springen (Aufmerksamkeit)",
      "Konsequente Reaktion einüben",
      "Übungen für Familie, Besuch, Fremde",
      "Sofort als PDF im Postfach",
    ],
    emoji: "🙋",
    image_url: "/Anspringen.png",
    price_cents: DEFAULT_PRICE,
    problem_match: "jumping",
    badge_text: null,
    title_it: "Non saltare addosso",
    goal_it: "Saluta con tutte le zampe a terra",
    short_it: "Saluti con le quattro zampe a terra.",
    features_it: [
      "Perché i cani saltano (attenzione)",
      "Allenare una reazione coerente",
      "Esercizi per famiglia, ospiti, estranei",
      "Subito come PDF nella casella",
    ],
    badge_text_it: null,
    image_url_it: "/Anspringen.it.png",
  },
  {
    slug: "thema-rueckruf",
    title: "Rückruf trainieren",
    goal: "Kommt zuverlässig wenn du rufst",
    short: "Dein Hund kommt zuverlässig.",
    features: [
      "Den Namen positiv aufladen",
      "Pfeifen-Training Schritt für Schritt",
      "Übungen mit steigender Ablenkung",
      "Sofort als PDF im Postfach",
    ],
    emoji: "📣",
    image_url: "/rueckruf.png",
    price_cents: DEFAULT_PRICE,
    problem_match: "recall",
    badge_text: null,
    title_it: "Il richiamo",
    goal_it: "Torna in modo affidabile quando lo chiami",
    short_it: "Il tuo cane torna in modo affidabile.",
    features_it: [
      "Caricare il nome in positivo",
      "Allenamento al fischietto passo passo",
      "Esercizi con distrazioni crescenti",
      "Subito come PDF nella casella",
    ],
    badge_text_it: null,
    image_url_it: "/rueckruf.it.png",
  },
  {
    slug: "thema-energie",
    title: "Übermäßige Energie",
    goal: "Findet Ruhe nach dem Auspowern",
    short: "Auspowern + Ruhe finden.",
    features: [
      "Mentale vs körperliche Auslastung",
      "Snuffle-Mat & Suchspiele",
      "Ruhe-Phase aufbauen",
      "Sofort als PDF im Postfach",
    ],
    emoji: "⚡",
    image_url: "/energie.png",
    price_cents: DEFAULT_PRICE,
    problem_match: "energy",
    badge_text: null,
    title_it: "Energia in eccesso",
    goal_it: "Trova la calma dopo essersi sfogato",
    short_it: "Sfogarsi e poi trovare la calma.",
    features_it: [
      "Stimolazione mentale vs fisica",
      "Tappetino olfattivo e giochi di ricerca",
      "Costruire la fase di riposo",
      "Subito come PDF nella casella",
    ],
    badge_text_it: null,
    image_url_it: "/energie.it.png",
  },
  {
    slug: "thema-zerstoerung",
    title: "Zerstörungsverhalten",
    goal: "Lässt Möbel, Schuhe & Kabel in Ruhe",
    short: "Möbel, Schuhe & Kabel sicher.",
    features: [
      "Warum Hunde zerstören",
      "Kau-Alternativen anbieten",
      "Tausch-Spiel üben",
      "Sofort als PDF im Postfach",
    ],
    emoji: "🦴",
    image_url: "/kaputt.png",
    price_cents: DEFAULT_PRICE,
    problem_match: "destructive",
    badge_text: null,
    title_it: "Stop alla distruzione",
    goal_it: "Lascia in pace mobili, scarpe e cavi",
    short_it: "Mobili, scarpe e cavi al sicuro.",
    features_it: [
      "Perché i cani distruggono",
      "Offrire alternative da masticare",
      "Allenare il gioco dello scambio",
      "Subito come PDF nella casella",
    ],
    badge_text_it: null,
    image_url_it: "/kaputt.it.png",
  },
  {
    slug: "thema-stubenrein",
    title: "Stubenreinheit",
    goal: "Macht es draußen, nicht drinnen",
    short: "Routine etablieren in 21 Tagen.",
    features: [
      "Feste Pipi-Pause-Zeiten",
      "Was tun bei Pannen",
      "Welpen vs erwachsene Hunde",
      "Sofort als PDF im Postfach",
    ],
    emoji: "💧",
    image_url: "/Stubenreinheit.png",
    price_cents: DEFAULT_PRICE,
    problem_match: "soiling",
    badge_text: null,
    title_it: "Pulizia in casa",
    goal_it: "La fa fuori, non dentro casa",
    short_it: "Stabilire la routine in 21 giorni.",
    features_it: [
      "Orari fissi per la pausa pipì",
      "Cosa fare in caso di incidenti",
      "Cuccioli vs cani adulti",
      "Subito come PDF nella casella",
    ],
    badge_text_it: null,
    image_url_it: "/Stubenreinheit.it.png",
  },
  {
    slug: "thema-aufnehmen",
    title: "Nichts vom Boden",
    goal: "Lässt Sachen am Boden liegen",
    short: "Schluss mit Aufnehmen unterwegs.",
    features: [
      "Tausch-Spiel als Basis",
      "'Aus'-Kommando aufbauen",
      "Übungen am Spazierweg",
      "Sofort als PDF im Postfach",
    ],
    emoji: "🚫",
    image_url: "/Nichtsvomboden.png",
    price_cents: DEFAULT_PRICE,
    problem_match: "mouthing",
    badge_text: null,
    title_it: "Niente da terra",
    goal_it: "Lascia gli oggetti a terra dove sono",
    short_it: "Basta raccogliere roba durante la passeggiata.",
    features_it: [
      "Il gioco dello scambio come base",
      "Costruire il comando 'lascia'",
      "Esercizi lungo il percorso della passeggiata",
      "Subito come PDF nella casella",
    ],
    badge_text_it: null,
    image_url_it: "/Nichtsvomboden.it.png",
  },
];

// Sortiert: User-Problem zuerst, dann Rest
export function sortByUserRelevance(
  modules: ThemenModule[],
  userProblemKey: string | null
): ThemenModule[] {
  if (!userProblemKey) return modules;
  const matched = modules.filter((m) => m.problem_match === userProblemKey);
  const rest = modules.filter((m) => m.problem_match !== userProblemKey);
  return [...matched, ...rest];
}
