// Themen-Module-Katalog. Eigenstaendige Spezial-Module zu einzelnen
// Verhaltensthemen — verkauft als Einzel-Upsells. Slugs entsprechen
// den 'type'-Werten in /api/mollie/upsell-product-checkout (PRODUCT_PRICES).
// Wird auf /mitglieder/module in der Sektion "Themen-Module" gerendert.

export interface ThemenModule {
  slug: string;
  title: string;
  short: string;          // 1-Liner fuer Kartenvorderseite
  features: string[];     // Backside-Inhalte
  emoji: string;
  image_url?: string | null; // optional: ueberschreibt Emoji-Header
  price_cents: number;
  problem_match: string | null; // matched gegen quiz_result.dog_problem
  badge_text: string | null;
}

const DEFAULT_PRICE = 999; // 9,99 Euro pro Themen-Modul

export const THEMEN_MODULES: ThemenModule[] = [
  {
    slug: "thema-leinen",
    title: "Leinenführigkeit",
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
  },
  {
    slug: "thema-bellen",
    title: "Bellen abgewöhnen",
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
  },
  {
    slug: "thema-aggression",
    title: "Aggression entschärfen",
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
    price_cents: 1499,
    problem_match: "aggression",
    badge_text: "Ausführlich",
  },
  {
    slug: "thema-trennungsangst",
    title: "Trennungsangst",
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
  },
  {
    slug: "thema-anspringen",
    title: "Anspringen abgewöhnen",
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
  },
  {
    slug: "thema-rueckruf",
    title: "Rückruf trainieren",
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
  },
  {
    slug: "thema-energie",
    title: "Übermäßige Energie",
    short: "Auspowern + Ruhe finden.",
    features: [
      "Mentale vs körperliche Auslastung",
      "Snuffle-Mat & Suchspiele",
      "Ruhe-Phase aufbauen",
      "Sofort als PDF im Postfach",
    ],
    emoji: "⚡",
    price_cents: DEFAULT_PRICE,
    problem_match: "energy",
    badge_text: null,
  },
  {
    slug: "thema-zerstoerung",
    title: "Zerstörungsverhalten",
    short: "Möbel, Schuhe & Kabel sicher.",
    features: [
      "Warum Hunde zerstören",
      "Kau-Alternativen anbieten",
      "Tausch-Spiel üben",
      "Sofort als PDF im Postfach",
    ],
    emoji: "🦴",
    price_cents: DEFAULT_PRICE,
    problem_match: "destructive",
    badge_text: null,
  },
  {
    slug: "thema-stubenrein",
    title: "Stubenreinheit",
    short: "Routine etablieren in 21 Tagen.",
    features: [
      "Feste Pipi-Pause-Zeiten",
      "Was tun bei Pannen",
      "Welpen vs erwachsene Hunde",
      "Sofort als PDF im Postfach",
    ],
    emoji: "💧",
    price_cents: DEFAULT_PRICE,
    problem_match: "soiling",
    badge_text: null,
  },
  {
    slug: "thema-aufnehmen",
    title: "Nichts vom Boden",
    short: "Schluss mit Aufnehmen unterwegs.",
    features: [
      "Tausch-Spiel als Basis",
      "'Aus'-Kommando aufbauen",
      "Übungen am Spazierweg",
      "Sofort als PDF im Postfach",
    ],
    emoji: "🚫",
    price_cents: DEFAULT_PRICE,
    problem_match: "mouthing",
    badge_text: null,
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
