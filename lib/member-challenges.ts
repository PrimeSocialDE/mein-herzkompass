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
  // ── Problem-spezifisch ──
  {
    slug: "leine-locker",
    title: "Locker an der Leine",
    description:
      "Schaffe diese Woche 3 kurze Spaziergänge ohne Ziehen. 5 bis 10 Minuten reichen pro Session.",
    target_sessions: 3,
    badge_emoji: "🥇",
    badge_label: "Leinen-Profi",
    problem_match: "pulling",
    is_premium: false,
  },
  {
    slug: "ruhe-signal",
    title: "Ruhe-Signal etablieren",
    description:
      "Übe 5x diese Woche das Ruhe-Signal in einem ruhigen Moment. 2-3 Minuten reichen.",
    target_sessions: 5,
    badge_emoji: "🤫",
    badge_label: "Ruhe-Meister",
    problem_match: "barking",
    is_premium: false,
  },
  {
    slug: "kurze-trennung",
    title: "Kurze Trennung üben",
    description:
      "3x diese Woche kurz aus dem Raum gehen, von 1 Min auf 5 Min steigern. Vorher: Hund auf Decke.",
    target_sessions: 3,
    badge_emoji: "🏠",
    badge_label: "Allein-Profi",
    problem_match: "anxiety",
    is_premium: false,
  },
  {
    slug: "vier-pfoten-boden",
    title: "Vier Pfoten auf dem Boden",
    description:
      "Übe 5x in Begrüßungssituationen: Hund bekommt nur Aufmerksamkeit wenn alle Pfoten am Boden sind.",
    target_sessions: 5,
    badge_emoji: "🐾",
    badge_label: "Begrüßungs-Champ",
    problem_match: "jumping",
    is_premium: false,
  },
  {
    slug: "rueckruf-game",
    title: "Rückruf-Spiel",
    description:
      "3x diese Woche je 10 Wiederholungen vom Rückruf üben — am besten draußen mit Ablenkung.",
    target_sessions: 3,
    badge_emoji: "📣",
    badge_label: "Rückruf-Held",
    problem_match: "recall",
    is_premium: false,
  },
  {
    slug: "auspowern-ruhe",
    title: "Auspowern + Ruhe",
    description:
      "3x diese Woche: 20 Min ordentlich auspowern, dann 30 Min Ruhe-Phase auf der Decke.",
    target_sessions: 3,
    badge_emoji: "⚡",
    badge_label: "Energie-Manager",
    problem_match: "energy",
    is_premium: false,
  },
  {
    slug: "kau-alternative",
    title: "Kau-Alternativen anbieten",
    description:
      "3 Tage diese Woche immer Kau-Spielzeug griffbereit. Wenn er was Falsches anpackt: tauschen.",
    target_sessions: 3,
    badge_emoji: "🦴",
    badge_label: "Tausch-Profi",
    problem_match: "destructive",
    is_premium: false,
  },
  {
    slug: "pipi-routine",
    title: "Pipi-Pause-Routine",
    description:
      "5 Tage diese Woche feste Pipi-Pausen einhalten: nach Schlaf, Fressen, Spiel und alle 2-3h.",
    target_sessions: 5,
    badge_emoji: "💧",
    badge_label: "Routine-König",
    problem_match: "soiling",
    is_premium: false,
  },
  {
    slug: "tausch-spiel",
    title: "Tausch-Spiel üben",
    description:
      "5x diese Woche das Tausch-Spiel mit Spielzeug oder Leckerli üben. Aufnehmen + freiwillig hergeben.",
    target_sessions: 5,
    badge_emoji: "🔄",
    badge_label: "Tausch-Held",
    problem_match: "mouthing",
    is_premium: false,
  },

  // ── Generic (fuer alle User, rotieren als Bonus oder Fallback) ──
  {
    slug: "sitz-profi",
    title: "Sitz-Profi werden",
    description:
      "5x diese Woche je 3 Wiederholungen 'Sitz' üben. In verschiedenen Räumen, dann draußen.",
    target_sessions: 5,
    badge_emoji: "🪑",
    badge_label: "Sitz-Profi",
    problem_match: null,
    is_premium: false,
  },
  {
    slug: "platz-halten",
    title: "Platz halten",
    description:
      "Steigere die Platz-Dauer: Tag 1: 5 Sek, Tag 2: 10 Sek, Tag 3: 20 Sek, Tag 4: 30 Sek.",
    target_sessions: 4,
    badge_emoji: "🛏️",
    badge_label: "Platz-Meister",
    problem_match: null,
    is_premium: true,
  },
  {
    slug: "blickkontakt",
    title: "Aufmerksamkeit durch Blickkontakt",
    description:
      "5x diese Woche je 1 Min Blickkontakt-Training: Name sagen, sobald er guckt, belohnen.",
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
      "5x diese Woche Pfote geben üben — auf beiden Seiten. Süßer Trick fürs Selbstvertrauen.",
    target_sessions: 5,
    badge_emoji: "🤝",
    badge_label: "Trick-Künstler",
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
  recentSlugs: Set<string>
): ChallengeTemplate[] {
  const isPaid = member.purchase_status === "paid";
  const problemKey =
    member.quiz_result?.dog_problem || member.quiz_result?.problem || null;

  const result: ChallengeTemplate[] = [];

  // 1) Problem-spezifische Challenge (wenn nicht erst kürzlich gemacht)
  const problemChallenges = CHALLENGE_TEMPLATES.filter(
    (t) =>
      t.problem_match === problemKey &&
      (isPaid || !t.is_premium) &&
      !recentSlugs.has(t.slug)
  );
  if (problemChallenges.length > 0) {
    result.push(problemChallenges[0]);
  }

  // 2) Wenn Free und schon eine: fertig
  if (!isPaid) {
    if (result.length === 0) {
      // Fallback fuer Free: generic, nicht premium
      const generic = CHALLENGE_TEMPLATES.find(
        (t) =>
          t.problem_match === null &&
          !t.is_premium &&
          !recentSlugs.has(t.slug)
      );
      if (generic) result.push(generic);
    }
    return result;
  }

  // 3) Paid: 1-2 weitere (generic + premium)
  const bonus = CHALLENGE_TEMPLATES.filter(
    (t) =>
      t.problem_match === null &&
      !recentSlugs.has(t.slug) &&
      !result.some((r) => r.slug === t.slug)
  );
  for (const b of bonus.slice(0, 2)) {
    result.push(b);
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

  // 2) Letzte 8 Wochen anschauen damit nicht dieselbe Challenge wieder kommt
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 8 * 7);
  const { data: recent } = await admin
    .from("member_user_challenges")
    .select("challenge_slug")
    .eq("user_id", member.id)
    .gte("week_start_date", eightWeeksAgo.toISOString().slice(0, 10));
  const recentSlugs = new Set<string>(
    (recent || []).map((r: any) => r.challenge_slug)
  );

  // 3) Templates picken
  const templates = pickTemplatesForUser(member, recentSlugs);
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
  return (inserted || []) as UserChallenge[];
}

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
