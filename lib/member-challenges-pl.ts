// Polnische Übersetzung der Wochenaufgaben-Templates (CHALLENGE_TEMPLATES).
// Struktur/slugs/problem_match/target/emoji BYTE-IDENTISCH zur DE-Version,
// nur title/description/badge_label übersetzt. lang-Weiche in member-challenges.ts.
// DE-Datei bleibt unangetastet (nichts überschreiben).
import type { ChallengeTemplate } from "./member-challenges";

export const CHALLENGE_TEMPLATES_PL: ChallengeTemplate[] = [
  // ══════════════════════════════════════════════════════════════════
  // PULLING / Leinenziehen, 4 Aufgaben (rotieren ueber 4 Wochen)
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "leine-locker",
    title: "Luźna smycz",
    description:
      "3 krótkie spacery (po 5-10 min) na znajomej trasie bez rozpraszaczy. Gdy tylko smycz się napina: zatrzymaj się, czekaj aż znów będzie luźna.",
    target_sessions: 3,
    badge_emoji: "🥇",
    badge_label: "Mistrz Smyczy",
    problem_match: "pulling",
    is_premium: false,
  },
  {
    slug: "richtungswechsel",
    title: "Trening zmiany kierunku",
    description:
      "4x w tym tygodniu po 5 min zabawy ze zmianą kierunku: gdy tylko pies ciągnie do przodu, obracasz się bez słowa w drugą stronę. Nagroda, gdy cię dogoni.",
    target_sessions: 4,
    badge_emoji: "🔄",
    badge_label: "Mistrz Kierunku",
    problem_match: "pulling",
    is_premium: false,
  },
  {
    slug: "stop-and-go",
    title: "Stop-and-Go przy drzwiach",
    description:
      "5x w tym tygodniu przed drzwiami wejściowymi: ruszacie tylko wtedy, gdy smycz jest luźna. Niecierpliwość = drzwi pozostają zamknięte.",
    target_sessions: 5,
    badge_emoji: "🚪",
    badge_label: "Dyscyplina przy Drzwiach",
    problem_match: "pulling",
    is_premium: false,
  },
  {
    slug: "leine-ablenkung",
    title: "Luźna smycz przy rozpraszaczach",
    description:
      "3x w tym tygodniu świadomie wybierz trasę z bodźcami (psy, przechodnie), przy rozproszeniu uwagi zawracaj zamiast iść dalej.",
    target_sessions: 3,
    badge_emoji: "🎯",
    badge_label: "Opanowanie przy Smyczy",
    problem_match: "pulling",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // BARKING / Bellen, 4 Aufgaben
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "ruhe-signal",
    title: "Budowanie sygnału spokoju",
    description:
      "5x w tym tygodniu, gdy pies jest zrelaksowany, powiedz słowo oznaczające spokój i od razu nagrodź. 2-3 minuty na sesję w zupełności wystarczą.",
    target_sessions: 5,
    badge_emoji: "🤫",
    badge_label: "Mistrz Spokoju",
    problem_match: "barking",
    is_premium: false,
  },
  {
    slug: "tuerklingel-training",
    title: "Oswajanie dzwonka do drzwi",
    description:
      "3x w tym tygodniu symuluj dzwonek (poproś kogoś z rodziny lub sąsiada). Wcześniej wyślij psa na miejsce, spokojnie czekaj → nagroda.",
    target_sessions: 3,
    badge_emoji: "🔔",
    badge_label: "Spokój przy Dzwonku",
    problem_match: "barking",
    is_premium: false,
  },
  {
    slug: "fenster-management",
    title: "Eliminowanie warty przy oknie",
    description:
      "W tym tygodniu każdego dnia: zasłoń okno lub ogranicz dostęp psa do widoku na ulicę i przesuń jego miejsce odpoczynku z dala od okna. Oceń, czy to pomaga.",
    target_sessions: 5,
    badge_emoji: "🪟",
    badge_label: "Menadżer Okna",
    problem_match: "barking",
    is_premium: false,
  },
  {
    slug: "bell-distanz",
    title: "Dystans zamiast konfrontacji",
    description:
      "3x w tym tygodniu przy bodźcu (pies, przechodzień) świadomie zwiększ dystans, ZANIM pies zacznie szczekać. Nagradzaj, gdy pozostaje spokojny.",
    target_sessions: 3,
    badge_emoji: "↔️",
    badge_label: "Mistrz Dystansu",
    problem_match: "barking",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // AGGRESSION, 3 Aufgaben (vorsichtiger, weil sensibles Thema)
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "ausloeser-tagebuch",
    title: "Prowadzenie dziennika wyzwalaczy",
    description:
      "W tym tygodniu zapisuj każde zdarzenie: co było wyzwalaczem, jaki był dystans, pora dnia? Przez 5 dni z rzędu.",
    target_sessions: 5,
    badge_emoji: "📓",
    badge_label: "Uważny Obserwator",
    problem_match: "aggression",
    is_premium: false,
  },
  {
    slug: "umlenken-uebung",
    title: "Przekierowanie uwagi na siebie",
    description:
      "5x w tym tygodniu w bezpiecznych warunkach: pies widzi wyzwalacz → mówisz imię + przystawiasz smakołyk pod nos. Gdy na ciebie spojrzy: jackpot.",
    target_sessions: 5,
    badge_emoji: "👁️",
    badge_label: "Mistrz Przekierowania",
    problem_match: "aggression",
    is_premium: false,
  },
  {
    slug: "sichere-route",
    title: "Ustalenie bezpiecznej trasy",
    description:
      "3x w tym tygodniu świadomie wybierz spokojną trasę, omijaj problematyczne miejsca. Zbieraj sukcesy zamiast generować stres.",
    target_sessions: 3,
    badge_emoji: "🛡️",
    badge_label: "Mistrz Bezpieczeństwa",
    problem_match: "aggression",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // ANXIETY / Trennungsangst, 4 Aufgaben (Mini-Steigerung)
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "kurze-trennung",
    title: "Ćwiczenie mini-rozstań",
    description:
      "5x w tym tygodniu zmień pokój bez żadnego teatru: 30 sek-2 min, potem wróć. Bez pożegnania, bez powitania.",
    target_sessions: 5,
    badge_emoji: "🚪",
    badge_label: "Mistrz Mini-Rozstań",
    problem_match: "anxiety",
    is_premium: false,
  },
  {
    slug: "kong-ritual",
    title: "Budowanie rytuału z Kongiem",
    description:
      "5 dni z rzędu: przed wyjściem daj psu Konga lub zadanie węchowe. Pies uczy się, że 'sam = zajęcie i frajda'.",
    target_sessions: 5,
    badge_emoji: "🦴",
    badge_label: "Mistrz Konga",
    problem_match: "anxiety",
    is_premium: false,
  },
  {
    slug: "wohnung-verlassen",
    title: "Krótkie wyjścia z domu",
    description:
      "3x w tym tygodniu naprawdę wyjdź: wyrzuć śmieci, sprawdź skrzynkę, odpal auto. 5-15 min, bez stresu przy powrocie.",
    target_sessions: 3,
    badge_emoji: "🏠",
    badge_label: "Mistrz Samodzielności",
    problem_match: "anxiety",
    is_premium: false,
  },
  {
    slug: "abschieds-ritual-aus",
    title: "Eliminowanie rytuału pożegnania",
    description:
      "W tym tygodniu każdego dnia: przestań się żegnać. Zakładaj buty i kurtkę już godzinę wcześniej, a potem po prostu wyjdź w dowolnym momencie. Żadnego napięcia.",
    target_sessions: 5,
    badge_emoji: "👋",
    badge_label: "Spokojne Pożegnanie",
    problem_match: "anxiety",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // JUMPING / Anspringen, 3 Aufgaben
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "vier-pfoten-boden",
    title: "Cztery łapy na ziemi",
    description:
      "5x podczas powitań: uwaga i kontakt tylko wtedy, gdy wszystkie łapy są na podłodze. Skacze → odwróć się, wzrok w bok.",
    target_sessions: 5,
    badge_emoji: "🐾",
    badge_label: "Mistrz Powitań",
    problem_match: "jumping",
    is_premium: false,
  },
  {
    slug: "sitz-vor-besuch",
    title: "SIAD przed powitaniem",
    description:
      "3x w tym tygodniu ćwicz z gośćmi lub rodziną: pies musi siąść, zanim ktokolwiek go dotknie. Jasny i czytelny rytuał.",
    target_sessions: 3,
    badge_emoji: "🪑",
    badge_label: "Mistrz Siadu przy Powitaniu",
    problem_match: "jumping",
    is_premium: false,
  },
  {
    slug: "familie-konsequenz",
    title: "Cała rodzina gra do jednej bramki",
    description:
      "W tym tygodniu każdego dnia: wszyscy w domu reagują TAK SAMO na skakanie. Wywieś listę na lodówce.",
    target_sessions: 5,
    badge_emoji: "👨‍👩‍👧",
    badge_label: "Trener Rodzinny",
    problem_match: "jumping",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // RECALL / Rückruf, 4 Aufgaben (Stufen-Aufbau)
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "name-positiv",
    title: "Pozytywne ładowanie imienia",
    description:
      "W tym tygodniu każdego dnia: 10x powiedz imię + jackpot (kiełbaska). Imię ma stać się magnesem.",
    target_sessions: 5,
    badge_emoji: "📛",
    badge_label: "Imię-Magnes",
    problem_match: "recall",
    is_premium: false,
  },
  {
    slug: "rueckruf-game",
    title: "Gra z przywoływaniem w ogrodzie",
    description:
      "3x w tym tygodniu po 10 powtórzeń przywoływania w ogrodzie lub w domu. Najpierw zbuduj pewność siebie tu, potem wychodź na zewnątrz.",
    target_sessions: 3,
    badge_emoji: "📣",
    badge_label: "Bohater Przywoływania",
    problem_match: "recall",
    is_premium: false,
  },
  {
    slug: "schleppleine",
    title: "Przywoływanie na lince treningowej",
    description:
      "3x w tym tygodniu ćwicz na zewnątrz z długą linką. Z rozpraszaczami, ale z bezpieczeństwem dzięki lince. Jackpot przy każdym sukcesie.",
    target_sessions: 3,
    badge_emoji: "🪢",
    badge_label: "Pro Długiej Linki",
    problem_match: "recall",
    is_premium: false,
  },
  {
    slug: "pfeife-aufbau",
    title: "Wprowadzenie gwizdka",
    description:
      "5 dni: przed każdym posiłkiem zagwiżdż → podaj jedzenie. Gwizdek staje się niezawodnym sygnałem, wyraźniejszym niż głos.",
    target_sessions: 5,
    badge_emoji: "🎵",
    badge_label: "Mistrz Gwizdka",
    problem_match: "recall",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // ENERGY, 4 Aufgaben (Mix Bewegung + Kopf + Ruhe)
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "auspowern-ruhe",
    title: "Wyładowanie energii + faza odpoczynku",
    description:
      "3x w tym tygodniu: 20 min solidnego wyładowania energii, a potem 30 min świadomej fazy odpoczynku na miejscu. Bez akcji pomiędzy.",
    target_sessions: 3,
    badge_emoji: "⚡",
    badge_label: "Menadżer Energii",
    problem_match: "energy",
    is_premium: false,
  },
  {
    slug: "schnueffel-spiel",
    title: "Budowanie zabaw węchowych",
    description:
      "5 dni: 10 min zadania węchowego (chowanie smakołyków w trawie lub kocyku). Męczy bardziej niż 30 min spaceru.",
    target_sessions: 5,
    badge_emoji: "👃",
    badge_label: "Mistrz Węszenia",
    problem_match: "energy",
    is_premium: false,
  },
  {
    slug: "ruhe-decke",
    title: "Budowanie miejsca odpoczynku",
    description:
      "5x w tym tygodniu: ćwicz świadomie komendę miejsca. Wydłużaj czas (1 → 5 → 10 min). Nagroda TYLKO na miejscu.",
    target_sessions: 5,
    badge_emoji: "🛏️",
    badge_label: "Kotwica Miejsca",
    problem_match: "energy",
    is_premium: false,
  },
  {
    slug: "kopfarbeit-fortgeschritten",
    title: "Gry dla inteligentnych psów",
    description:
      "3x w tym tygodniu po 15 min z zabawkami inteligentnymi lub domowymi zadaniami (odwracanie kubeczków, rolka z ręcznika).",
    target_sessions: 3,
    badge_emoji: "🧠",
    badge_label: "Mistrz Pracy Umysłowej",
    problem_match: "energy",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // DESTRUCTIVE, 3 Aufgaben
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "kau-alternative",
    title: "Zapewnienie alternatyw do gryzienia",
    description:
      "W tym tygodniu rozłóż 3 zabawki w 3 różnych pokojach. Gdy dopadnie coś niewłaściwego: zamień, nie karz.",
    target_sessions: 3,
    badge_emoji: "🦴",
    badge_label: "Mistrz Gryzienia",
    problem_match: "destructive",
    is_premium: false,
  },
  {
    slug: "tausch-zerstoerung",
    title: "Gra w wymianę jako rutyna",
    description:
      "5x w tym tygodniu: ma coś w pysku (cokolwiek) → wymieniasz na kiełbaskę. Uczy się, że oddawanie się opłaca.",
    target_sessions: 5,
    badge_emoji: "🔄",
    badge_label: "Mistrz Wymiany",
    problem_match: "destructive",
    is_premium: false,
  },
  {
    slug: "management-zerstoerung",
    title: "Bezpieczna przestrzeń dla psa",
    description:
      "W tym tygodniu: schowaj buty, zabezpiecz kable, wynieś kosz na śmieci. 5 dni konsekwentnie. Czego nie dosięgnie, tego nie zniszczy.",
    target_sessions: 5,
    badge_emoji: "🔒",
    badge_label: "Pro Zarządzania Przestrzenią",
    problem_match: "destructive",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // SOILING / Stubenreinheit, 3 Aufgaben
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "pipi-routine",
    title: "Rutyna wyjść na siusiu",
    description:
      "5 dni: stałe wyjścia po śnie, jedzeniu, zabawie + co 2-3h. Konsekwentnie, bez wyjątków.",
    target_sessions: 5,
    badge_emoji: "💧",
    badge_label: "Król Rutyny",
    problem_match: "soiling",
    is_premium: false,
  },
  {
    slug: "lob-draussen",
    title: "Natychmiastowa nagroda za siusiu na zewnątrz",
    description:
      "5 dni konsekwentnie: gdy tylko zrobi siusiu na zewnątrz → nagradzaj wartościowym smakołykiem i chwal w ciągu pierwszych 3 sekund.",
    target_sessions: 5,
    badge_emoji: "🎉",
    badge_label: "Mistrz Pochwały",
    problem_match: "soiling",
    is_premium: false,
  },
  {
    slug: "panne-management",
    title: "Wpadki bez karcenia",
    description:
      "W tym tygodniu przy każdej wpadce: posprzątaj bez komentarza, sprawdź rutynę wyjść. Karcenie sprawia tylko, że pies przestaje ci to sygnalizować.",
    target_sessions: 3,
    badge_emoji: "🤐",
    badge_label: "Pro Cierpliwości",
    problem_match: "soiling",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // MOUTHING / Bodenfresser, 3 Aufgaben
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "tausch-spiel",
    title: "Budowanie gry w wymianę w domu",
    description:
      "5x w tym tygodniu w domu: ma zabawkę → wymieniasz na smakołyk. Buduj zaufanie krok po kroku.",
    target_sessions: 5,
    badge_emoji: "🔄",
    badge_label: "Bohater Wymiany",
    problem_match: "mouthing",
    is_premium: false,
  },
  {
    slug: "aus-kommando",
    title: "Budowanie komendy PUŚĆ",
    description:
      "5 dni: ćwicz z zabawką. Połóż rękę na niej, powiedz PUŚĆ, czekaj, gdy tylko puści, od razu kiełbaska i zabawka wraca.",
    target_sessions: 5,
    badge_emoji: "🛑",
    badge_label: "Mistrz PUŚĆ",
    problem_match: "mouthing",
    is_premium: false,
  },
  {
    slug: "spazier-impulskontrolle",
    title: "Kontrola impulsów podczas spaceru",
    description:
      "3x w tym tygodniu świadomie wybrana trasa z długą linką + skupienie uwagi na tobie. Coś na ziemi = przekieruj zamiast pozwalać jeść.",
    target_sessions: 3,
    badge_emoji: "🧘",
    badge_label: "Mistrz Kontroli Impulsów",
    problem_match: "mouthing",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // GENERIC (fuer alle, rotieren als Bonus / Fallback)
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "sitz-profi",
    title: "Zostań mistrzem komendy SIAD",
    description:
      "5x w tym tygodniu po 3 powtórzenia komendy SIAD, w różnych pokojach, a potem na zewnątrz.",
    target_sessions: 5,
    badge_emoji: "🪑",
    badge_label: "Mistrz Siadu",
    problem_match: null,
    is_premium: false,
  },
  {
    slug: "platz-halten",
    title: "WARUJ, plan stopniowy",
    description:
      "Wydłużaj czas komendy WARUJ: dzień 1: 5 sek, dzień 2: 10 sek, dzień 3: 20 sek, dzień 4: 30 sek, dzień 5: 1 min.",
    target_sessions: 5,
    badge_emoji: "🛏️",
    badge_label: "Mistrz WARUJ",
    problem_match: null,
    is_premium: true,
  },
  {
    slug: "blickkontakt",
    title: "Trening kontaktu wzrokowego",
    description:
      "5x w tym tygodniu po 1 min: powiedz imię, gdy tylko spojrzy, natychmiast nagradzaj. Uwaga to fundament wszystkiego.",
    target_sessions: 5,
    badge_emoji: "👀",
    badge_label: "Mistrz Uwagi",
    problem_match: null,
    is_premium: true,
  },
  {
    slug: "pfote-geben",
    title: "Podaj łapę",
    description:
      "5x w tym tygodniu ćwicz podawanie łapy, z obu stron. Słodki trik dla pewności siebie i budowania więzi.",
    target_sessions: 5,
    badge_emoji: "🤝",
    badge_label: "Mistrz Trików",
    problem_match: null,
    is_premium: true,
  },
  {
    slug: "spiegel-uebung",
    title: "Chodzenie w parze",
    description:
      "3x w tym tygodniu po 5 min: bez smyczy w domu lub ogrodzie, gdy ruszasz, pies idzie za tobą. Trening więzi.",
    target_sessions: 3,
    badge_emoji: "🪞",
    badge_label: "Mistrz Więzi",
    problem_match: null,
    is_premium: true,
  },
];