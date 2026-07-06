// Wochen-Challenges fuer /mitglieder/erfolge.
// Templates leben hier (Single-Source-of-Truth, einfach erweiterbar
// ohne DB-Migration). Per-User-State liegt in member_user_challenges.

import { createMemberAdminClient } from "./member-auth-server";
import type { MemberProfile } from "./member-db";

// ── Challenge-Templates ────────────────────────────────────────────
// problem_match: NULL = generic (jedem User), sonst quiz-problem-key.
// is_premium: Wenn true, nur Paid-User bekommt diese Challenge zugewiesen.

export interface ChallengeTemplate {
  slug: string;
  title: string;
  description: string;
  target_sessions: number;
  badge_emoji: string;
  badge_label: string;
  problem_match: string | null;
  is_premium: boolean;
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  // ══════════════════════════════════════════════════════════════════
  // PULLING / Leinenziehen — 4 Aufgaben (rotieren ueber 4 Wochen)
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "leine-locker",
    title: "Locker an der Leine",
    description:
      "3 kurze Spaziergänge (je 5-10 Min) auf vertrauter Strecke ohne Ablenkung. Sobald die Leine spannt: stehen bleiben, warten bis sie locker ist.",
    target_sessions: 3,
    badge_emoji: "🥇",
    badge_label: "Leinen-Profi",
    problem_match: "pulling",
    is_premium: false,
  },
  {
    slug: "richtungswechsel",
    title: "Richtungswechsel-Training",
    description:
      "4x diese Woche 5 Min Richtungswechsel-Spiel: sobald er nach vorn zieht, drehst du dich kommentarlos um. Belohnung wenn er aufholt.",
    target_sessions: 4,
    badge_emoji: "🔄",
    badge_label: "Richtungs-Profi",
    problem_match: "pulling",
    is_premium: false,
  },
  {
    slug: "stop-and-go",
    title: "Stop-and-Go an der Tür",
    description:
      "5x diese Woche vor der Haustür: nur losgehen wenn die Leine locker ist. Ungeduld = Tür bleibt zu.",
    target_sessions: 5,
    badge_emoji: "🚪",
    badge_label: "Tür-Disziplin",
    problem_match: "pulling",
    is_premium: false,
  },
  {
    slug: "leine-ablenkung",
    title: "Lockere Leine bei Ablenkung",
    description:
      "3x diese Woche bewusst eine Strecke mit Reizen (Hunde/Passanten) wählen — bei Ablenkung umdrehen statt durchziehen.",
    target_sessions: 3,
    badge_emoji: "🎯",
    badge_label: "Leinen-Coolness",
    problem_match: "pulling",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // BARKING / Bellen — 4 Aufgaben
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "ruhe-signal",
    title: "Ruhe-Signal etablieren",
    description:
      "5x diese Woche in entspannter Lage das Ruhe-Wort sagen, sofort belohnen. 2-3 Min reichen pro Session.",
    target_sessions: 5,
    badge_emoji: "🤫",
    badge_label: "Ruhe-Meister",
    problem_match: "barking",
    is_premium: false,
  },
  {
    slug: "tuerklingel-training",
    title: "Türklingel entschärfen",
    description:
      "3x diese Woche Türklingel simulieren (Familie/Nachbar bittet). Vorher Decke, ruhig bleiben → Belohnung.",
    target_sessions: 3,
    badge_emoji: "🔔",
    badge_label: "Klingel-Cool",
    problem_match: "barking",
    is_premium: false,
  },
  {
    slug: "fenster-management",
    title: "Fenster-Posten auflösen",
    description:
      "Diese Woche jeden Tag: Fenster/Sichtkontakt zur Straße abdecken oder Ruhebereich weg vom Fenster. Bewerten ob's hilft.",
    target_sessions: 5,
    badge_emoji: "🪟",
    badge_label: "Fenster-Manager",
    problem_match: "barking",
    is_premium: false,
  },
  {
    slug: "bell-distanz",
    title: "Distanz statt Konfrontation",
    description:
      "3x diese Woche bei einem Auslöser (Hund/Passant) bewusst Distanz vergrößern, BEVOR er bellt. Belohnen wenn ruhig.",
    target_sessions: 3,
    badge_emoji: "↔️",
    badge_label: "Distanz-Profi",
    problem_match: "barking",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // AGGRESSION — 3 Aufgaben (vorsichtiger, weil sensibles Thema)
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "ausloeser-tagebuch",
    title: "Auslöser-Tagebuch führen",
    description:
      "Diese Woche jeden Vorfall in einer Notiz festhalten: Was war Auslöser, Distanz, Tageszeit? 5 Tage am Stück.",
    target_sessions: 5,
    badge_emoji: "📓",
    badge_label: "Beobachter",
    problem_match: "aggression",
    is_premium: false,
  },
  {
    slug: "umlenken-uebung",
    title: "Umlenken auf dich",
    description:
      "5x diese Woche im sicheren Rahmen: er sieht Auslöser → du sagst Name + Leckerli vor die Nase. Schaut er dich an: Jackpot.",
    target_sessions: 5,
    badge_emoji: "👁️",
    badge_label: "Umlenker",
    problem_match: "aggression",
    is_premium: false,
  },
  {
    slug: "sichere-route",
    title: "Sichere Route etablieren",
    description:
      "3x diese Woche eine bewusst ruhige Route gehen — keine Hot-Spots. Erfolg sammeln statt Stress.",
    target_sessions: 3,
    badge_emoji: "🛡️",
    badge_label: "Sicherheits-Profi",
    problem_match: "aggression",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // ANXIETY / Trennungsangst — 4 Aufgaben (Mini-Steigerung)
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "kurze-trennung",
    title: "Mini-Trennungen üben",
    description:
      "5x diese Woche Raumwechsel ohne Drama: 30 Sek-2 Min, dann zurück. Kein Verabschieden, kein Begrüßen.",
    target_sessions: 5,
    badge_emoji: "🚪",
    badge_label: "Mini-Trenner",
    problem_match: "anxiety",
    is_premium: false,
  },
  {
    slug: "kong-ritual",
    title: "Kong-Ritual aufbauen",
    description:
      "5 Tage in Folge: vor dem Weggehen Kong/Schnüffel-Aufgabe geben. Hund verbindet 'Allein = Beschäftigung'.",
    target_sessions: 5,
    badge_emoji: "🦴",
    badge_label: "Kong-Profi",
    problem_match: "anxiety",
    is_premium: false,
  },
  {
    slug: "wohnung-verlassen",
    title: "Wohnung kurz verlassen",
    description:
      "3x diese Woche tatsächlich raus: Mülltonne, Briefkasten, Auto starten. 5-15 Min, ohne Stress beim Zurückkommen.",
    target_sessions: 3,
    badge_emoji: "🏠",
    badge_label: "Allein-Profi",
    problem_match: "anxiety",
    is_premium: false,
  },
  {
    slug: "abschieds-ritual-aus",
    title: "Abschieds-Ritual abbauen",
    description:
      "Diese Woche jeden Tag: nicht mehr verabschieden. Schuhe + Jacke schon eine Stunde vorher anziehen, dann irgendwann gehen. Keine Spannung.",
    target_sessions: 5,
    badge_emoji: "👋",
    badge_label: "Cool-Goodbye",
    problem_match: "anxiety",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // JUMPING / Anspringen — 3 Aufgaben
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "vier-pfoten-boden",
    title: "Vier Pfoten am Boden",
    description:
      "5x in Begrüßungssituationen: Aufmerksamkeit nur wenn alle Pfoten unten. Springt er → wegdrehen, Blick weg.",
    target_sessions: 5,
    badge_emoji: "🐾",
    badge_label: "Begrüßungs-Champ",
    problem_match: "jumping",
    is_premium: false,
  },
  {
    slug: "sitz-vor-besuch",
    title: "Sitz vor Begrüßung",
    description:
      "3x diese Woche mit Besuch oder Familie üben: Hund muss sitzen bevor jemand ihn anfasst. Klarer Ritual.",
    target_sessions: 3,
    badge_emoji: "🪑",
    badge_label: "Sitz-Begrüßer",
    problem_match: "jumping",
    is_premium: false,
  },
  {
    slug: "familie-konsequenz",
    title: "Familie auf einen Nenner",
    description:
      "Diese Woche jeden Tag: alle in der Familie reagieren GLEICH bei Springen. Liste an den Kühlschrank.",
    target_sessions: 5,
    badge_emoji: "👨‍👩‍👧",
    badge_label: "Team-Trainer",
    problem_match: "jumping",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // RECALL / Rückruf — 4 Aufgaben (Stufen-Aufbau)
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "name-positiv",
    title: "Namen positiv aufladen",
    description:
      "Diese Woche jeden Tag: 10x Name sagen + Jackpot-Belohnung (Wurst). Name wird zum Magnet.",
    target_sessions: 5,
    badge_emoji: "📛",
    badge_label: "Name-Magnet",
    problem_match: "recall",
    is_premium: false,
  },
  {
    slug: "rueckruf-game",
    title: "Rückruf-Spiel im Garten",
    description:
      "3x diese Woche je 10 Wiederholungen Rückruf im Garten/zuhause. Erst da Sicherheit aufbauen, dann raus.",
    target_sessions: 3,
    badge_emoji: "📣",
    badge_label: "Rückruf-Held",
    problem_match: "recall",
    is_premium: false,
  },
  {
    slug: "schleppleine",
    title: "Rückruf an der Schleppleine",
    description:
      "3x diese Woche draußen mit Schleppleine üben. Mit Ablenkung, aber Sicherheit durch Leine. Jackpot bei Erfolg.",
    target_sessions: 3,
    badge_emoji: "🪢",
    badge_label: "Schleppleinen-Pro",
    problem_match: "recall",
    is_premium: false,
  },
  {
    slug: "pfeife-aufbau",
    title: "Pfeife einführen",
    description:
      "5 Tage: vor jeder Mahlzeit pfeifen → Futter. Pfeife wird zum verlässlichen Signal, klarer als Stimme.",
    target_sessions: 5,
    badge_emoji: "🎵",
    badge_label: "Pfeifen-Profi",
    problem_match: "recall",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // ENERGY — 4 Aufgaben (Mix Bewegung + Kopf + Ruhe)
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "auspowern-ruhe",
    title: "Auspowern + Ruhe-Phase",
    description:
      "3x diese Woche: 20 Min ordentlich auspowern, danach 30 Min bewusste Ruhe-Phase auf der Decke. Ohne Action dazwischen.",
    target_sessions: 3,
    badge_emoji: "⚡",
    badge_label: "Energie-Manager",
    problem_match: "energy",
    is_premium: false,
  },
  {
    slug: "schnueffel-spiel",
    title: "Schnüffel-Spiele aufbauen",
    description:
      "5 Tage: 10 Min Schnüffel-Aufgabe (Leckerli in Wiese/Decke verstecken). Macht müder als 30 Min Spaziergang.",
    target_sessions: 5,
    badge_emoji: "👃",
    badge_label: "Schnüffel-Profi",
    problem_match: "energy",
    is_premium: false,
  },
  {
    slug: "ruhe-decke",
    title: "Ruhe-Decke etablieren",
    description:
      "5x diese Woche: gezielt 'Decke' üben. Steigere Dauer (1 → 5 → 10 Min). Belohnung NUR auf der Decke.",
    target_sessions: 5,
    badge_emoji: "🛏️",
    badge_label: "Decken-Anker",
    problem_match: "energy",
    is_premium: false,
  },
  {
    slug: "kopfarbeit-fortgeschritten",
    title: "Intelligenz-Spiele",
    description:
      "3x diese Woche je 15 Min Intelligenz-Spielzeug oder selbstgebaute Aufgaben (Becher umdrehen, Handtuch-Rolle).",
    target_sessions: 3,
    badge_emoji: "🧠",
    badge_label: "Kopfsport-Profi",
    problem_match: "energy",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // DESTRUCTIVE — 3 Aufgaben
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "kau-alternative",
    title: "Kau-Alternativen verteilen",
    description:
      "Diese Woche 3 Spielzeuge in 3 Räumen platzieren. Wenn er was Falsches anpackt: tauschen, nicht schimpfen.",
    target_sessions: 3,
    badge_emoji: "🦴",
    badge_label: "Kau-Profi",
    problem_match: "destructive",
    is_premium: false,
  },
  {
    slug: "tausch-zerstoerung",
    title: "Tausch-Spiel als Routine",
    description:
      "5x diese Woche: er hat etwas im Maul (egal was) → du tauschst gegen Wurst. Er lernt: hergeben lohnt sich.",
    target_sessions: 5,
    badge_emoji: "🔄",
    badge_label: "Tausch-Profi",
    problem_match: "destructive",
    is_premium: false,
  },
  {
    slug: "management-zerstoerung",
    title: "Hund-sicherer Raum",
    description:
      "Diese Woche: Schuhe weg, Kabel sichern, Müll oben. 5 Tage konsequent. Was er nicht erreicht, kann er nicht zerstören.",
    target_sessions: 5,
    badge_emoji: "🔒",
    badge_label: "Management-Pro",
    problem_match: "destructive",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // SOILING / Stubenreinheit — 3 Aufgaben
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "pipi-routine",
    title: "Pipi-Pause-Routine",
    description:
      "5 Tage: feste Pipi-Pausen nach Schlaf, Fressen, Spielen + alle 2-3h. Konsequent, ohne Ausnahme.",
    target_sessions: 5,
    badge_emoji: "💧",
    badge_label: "Routine-König",
    problem_match: "soiling",
    is_premium: false,
  },
  {
    slug: "lob-draussen",
    title: "Sofort-Lob beim Pinkeln draußen",
    description:
      "5 Tage konsequent: sobald er draußen pinkelt → in den ersten 3 Sek hochwertig belohnen + freuen.",
    target_sessions: 5,
    badge_emoji: "🎉",
    badge_label: "Lob-Profi",
    problem_match: "soiling",
    is_premium: false,
  },
  {
    slug: "panne-management",
    title: "Pannen ohne Schimpfen",
    description:
      "Diese Woche bei jeder Panne: kommentarlos wegmachen, Routine prüfen. Schimpfen verhindert nur, dass er's dir zeigt.",
    target_sessions: 3,
    badge_emoji: "🤐",
    badge_label: "Geduld-Pro",
    problem_match: "soiling",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // MOUTHING / Bodenfresser — 3 Aufgaben
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "tausch-spiel",
    title: "Tausch-Spiel zuhause aufbauen",
    description:
      "5x diese Woche zuhause: er hat ein Spielzeug → du tauschst gegen ein Leckerli. Vertrauen aufbauen.",
    target_sessions: 5,
    badge_emoji: "🔄",
    badge_label: "Tausch-Held",
    problem_match: "mouthing",
    is_premium: false,
  },
  {
    slug: "aus-kommando",
    title: "'Aus' aufbauen",
    description:
      "5 Tage: mit Spielzeug üben. Hand drauf, sagen 'Aus', warten — sobald er loslässt, sofort Wurst + Spielzeug zurück.",
    target_sessions: 5,
    badge_emoji: "🛑",
    badge_label: "Aus-Profi",
    problem_match: "mouthing",
    is_premium: false,
  },
  {
    slug: "spazier-impulskontrolle",
    title: "Impulskontrolle unterwegs",
    description:
      "3x diese Woche bewusste Strecke mit Schleppleine + Aufmerksamkeit auf dich. Etwas am Boden = umlenken statt fressen lassen.",
    target_sessions: 3,
    badge_emoji: "🧘",
    badge_label: "Impuls-Profi",
    problem_match: "mouthing",
    is_premium: true,
  },

  // ══════════════════════════════════════════════════════════════════
  // GENERIC (fuer alle, rotieren als Bonus / Fallback)
  // ══════════════════════════════════════════════════════════════════
  {
    slug: "sitz-profi",
    title: "Sitz-Profi werden",
    description:
      "5x diese Woche je 3 Wiederholungen 'Sitz' üben — in verschiedenen Räumen, dann draußen.",
    target_sessions: 5,
    badge_emoji: "🪑",
    badge_label: "Sitz-Profi",
    problem_match: null,
    is_premium: false,
  },
  {
    slug: "platz-halten",
    title: "Platz halten — Stufen-Plan",
    description:
      "Steigere die Platz-Dauer: Tag 1: 5 Sek, Tag 2: 10 Sek, Tag 3: 20 Sek, Tag 4: 30 Sek, Tag 5: 1 Min.",
    target_sessions: 5,
    badge_emoji: "🛏️",
    badge_label: "Platz-Meister",
    problem_match: null,
    is_premium: true,
  },
  {
    slug: "blickkontakt",
    title: "Blickkontakt-Training",
    description:
      "5x diese Woche je 1 Min: Name sagen, sobald er guckt, sofort belohnen. Aufmerksamkeit ist die Basis von allem.",
    target_sessions: 5,
    badge_emoji: "👀",
    badge_label: "Aufmerksamkeits-Profi",
    problem_match: null,
    is_premium: true,
  },
  {
    slug: "pfote-geben",
    title: "Pfote geben",
    description:
      "5x diese Woche Pfote geben üben — auf beiden Seiten. Süßer Trick fürs Selbstvertrauen + Bindung.",
    target_sessions: 5,
    badge_emoji: "🤝",
    badge_label: "Trick-Künstler",
    problem_match: null,
    is_premium: true,
  },
  {
    slug: "spiegel-uebung",
    title: "Synchron-Gehen",
    description:
      "3x diese Woche 5 Min: Ohne Leine zuhause/Garten — wenn du losläufst, kommt er mit. Bindungs-Training.",
    target_sessions: 3,
    badge_emoji: "🪞",
    badge_label: "Bindungs-Profi",
    problem_match: null,
    is_premium: true,
  },
];

// ── Wochen-Helper (ISO-Woche, Montag als Start) ────────────────────

export function getWeekStartDate(d: Date = new Date()): string {
  // Lokale Zeit, Montag = 0
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun, 1 Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // auf Montag der KW
  date.setDate(date.getDate() + diff);
  // YYYY-MM-DD
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ── User-Challenge-Type aus DB ─────────────────────────────────────

export interface UserChallenge {
  id: string;
  user_id: string;
  challenge_slug: string;
  challenge_title: string;
  challenge_description: string;
  problem_match: string | null;
  target_sessions: number;
  sessions_done: number;
  badge_emoji: string;
  badge_label: string;
  week_start_date: string;
  is_premium: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Picker: welche Challenges bekommt der User diese Woche? ────────
// Free: 1 Challenge (problem-match wenn vorhanden, sonst generic)
// Paid: 1 problem-match + 1-2 zusaetzliche generic/premium

function pickTemplatesForUser(
  member: MemberProfile,
  recentSlugs: Set<string>,
  weekStart: string
): ChallengeTemplate[] {
  const isPaid = member.purchase_status === "paid";
  const problemKey =
    member.quiz_result?.dog_problem || member.quiz_result?.problem || null;

  // Wochen-Rotationszahl (Wochen seit Epoch) — aendert sich jede Woche um 1.
  // Damit rotieren "recycelte" Picks von Woche zu Woche DURCH den Pool, statt
  // stur die erste Aufgabe zu wiederholen. Das war der Bug: sobald der Pool
  // "verbraucht" war (alle recent), kam immer problemPool[0] = z.B. 4x "Sitz".
  const rot = Math.floor((Date.parse(weekStart) || 0) / (7 * 86400 * 1000));

  // Nimmt bis zu `count` Aufgaben aus pool: zuerst frische (nicht recent),
  // dann — falls noetig — rotierend ab dem Wochen-Offset aufgefuellt (nie stur
  // die erste). Ueberspringt bereits gewaehlte Slugs. So gibt es auch bei
  // erschoepftem Pool jede Woche eine ANDERE Aufgabe statt Wiederholung.
  const pick = (
    pool: ChallengeTemplate[],
    count: number,
    chosen: ChallengeTemplate[]
  ): ChallengeTemplate[] => {
    const out: ChallengeTemplate[] = [];
    const taken = new Set(chosen.map((c) => c.slug));
    for (const t of pool) {
      if (out.length >= count) break;
      if (recentSlugs.has(t.slug) || taken.has(t.slug)) continue;
      out.push(t);
      taken.add(t.slug);
    }
    if (out.length < count && pool.length > 0) {
      for (let i = 0; i < pool.length && out.length < count; i++) {
        const idx = (((rot + i) % pool.length) + pool.length) % pool.length;
        const t = pool[idx];
        if (taken.has(t.slug)) continue;
        out.push(t);
        taken.add(t.slug);
      }
    }
    return out;
  };

  const result: ChallengeTemplate[] = [];

  // 1) Problem-spezifisch (Paid: bis 2, Free: 1) — bevorzugt frisch, sonst rotierend
  const problemPool = CHALLENGE_TEMPLATES.filter(
    (t) => t.problem_match === problemKey && (isPaid || !t.is_premium)
  );
  result.push(...pick(problemPool, isPaid ? 2 : 1, result));

  // 2) Generic — Mindestgarantie (falls kein Problem-Match griff) + Paid-Bonus
  const genericPool = CHALLENGE_TEMPLATES.filter(
    (t) => t.problem_match === null && (isPaid || !t.is_premium)
  );
  const wantGeneric = isPaid
    ? result.length === 0
      ? 3
      : 2
    : result.length === 0
    ? 1
    : 0;
  if (wantGeneric > 0) {
    result.push(...pick(genericPool, wantGeneric, result));
  }

  return result;
}

// ── Hauptfunktion: Challenges fuer aktuelle Woche holen/anlegen ────

export async function getOrAssignWeekChallenges(
  member: MemberProfile
): Promise<UserChallenge[]> {
  const admin = createMemberAdminClient();
  const weekStart = getWeekStartDate();

  // 1) Schon Challenges fuer diese Woche?
  const { data: existing } = await admin
    .from("member_user_challenges")
    .select("*")
    .eq("user_id", member.id)
    .eq("week_start_date", weekStart)
    .order("created_at", { ascending: true });

  if (existing && existing.length > 0) {
    return existing as UserChallenge[];
  }

  // 2) Letzte 8 Wochen + Lifetime-Count parallel holen
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 8 * 7);
  const [recentRes, countRes] = await Promise.all([
    admin
      .from("member_user_challenges")
      .select("challenge_slug")
      .eq("user_id", member.id)
      .gte("week_start_date", eightWeeksAgo.toISOString().slice(0, 10)),
    admin
      .from("member_user_challenges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", member.id),
  ]);
  const recentSlugs = new Set<string>(
    (recentRes.data || []).map((r: any) => r.challenge_slug)
  );
  const isFirstEver = (countRes.count || 0) === 0;

  // 3) Templates picken
  const templates = pickTemplatesForUser(member, recentSlugs, weekStart);
  if (templates.length === 0) {
    // Notfall: alle wurden schon mal gemacht — recyclen, nimm irgendeine generic
    const fallback = CHALLENGE_TEMPLATES.filter(
      (t) =>
        t.problem_match === null &&
        (member.purchase_status === "paid" || !t.is_premium)
    );
    if (fallback.length > 0) templates.push(fallback[0]);
  }

  // 4) Anlegen
  const rows = templates.map((t) => ({
    user_id: member.id,
    challenge_slug: t.slug,
    challenge_title: t.title,
    challenge_description: t.description,
    problem_match: t.problem_match,
    target_sessions: t.target_sessions,
    sessions_done: 0,
    badge_emoji: t.badge_emoji,
    badge_label: t.badge_label,
    week_start_date: weekStart,
    is_premium: t.is_premium,
  }));

  if (rows.length === 0) return [];

  const { data: inserted, error } = await admin
    .from("member_user_challenges")
    .insert(rows)
    .select("*");

  if (error) {
    console.error("[challenges] insert failed:", error);
    return [];
  }

  const insertedChallenges = (inserted || []) as UserChallenge[];

  // 5) Welcome-Mail nur beim allerersten Mal (idempotent ohne neue Spalte:
  //    danach hat der User immer mind. eine Zeile, also lifetimeCount > 0)
  if (isFirstEver && insertedChallenges.length > 0) {
    // Fire-and-forget — Mail-Fail darf den Page-Load nicht blockieren
    import("./member-mail")
      .then((m) => m.sendWelcomeChallengesMail(member, insertedChallenges))
      .then((res) => {
        if (!res.ok) {
          console.warn(
            "[challenges] welcome mail not sent:",
            res.reason
          );
        }
      })
      .catch((e) => console.error("[challenges] welcome mail error:", e));
  }

  return insertedChallenges;
}

// HINWEIS: seedInitialChallengesForEmail lebt jetzt in
// lib/seed-initial-challenges.ts (Bundle-Size-Optimierung: nicht von
// der Challenges-Page mitgeladen).

// ── Earned Badges (alle abgeschlossenen Challenges, neueste zuerst) ─

export async function getEarnedBadges(userId: string, limit = 24) {
  const admin = createMemberAdminClient();
  const { data } = await admin
    .from("member_user_challenges")
    .select(
      "id, challenge_slug, badge_emoji, badge_label, completed_at, week_start_date"
    )
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(limit);
  return data || [];
}
