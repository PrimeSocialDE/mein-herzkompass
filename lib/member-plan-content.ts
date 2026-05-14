// Read-Helpers fuer member_plan_content (Plan-Module Inhalte).
// Die Tabelle ist append-only — wir holen immer die NEUESTE Zeile.

import { createMemberAdminClient } from "./member-auth-server";

export interface PlanContent {
  id: string;
  user_id: string | null;
  email: string;
  plan_slug: string;
  plan_title: string | null;
  content: any;                  // jsonb — schema haengt vom Plan-Typ ab
  pdf_url: string | null;
  dog_name: string | null;
  dog_breed: string | null;
  source: string | null;
  source_payment_id: string | null;
  created_at: string;
}

// ── Schema fuer den 12-Wochen-Trainingsplan (plan_slug = "trainingsplan") ──
// Wird von Make.com befuellt nach PDF-Generierung. Der gleiche JSON wird
// im Mitgliederbereich gerendert (CoachingPage), zusaetzlich gibts den
// pdf_url als Download-Link.

export interface TrainingPlanUebung {
  name: string;                  // z.B. "Ritual Haustuer ruhig"
  schritte: string[];            // Schritte ohne "->" prefix
}

export interface TrainingPlanWeek {
  num: number;                   // 1..12
  title: string;                 // "Start Alltagstruktur"
  schwerpunkt?: string;          // 1-2 Saetze: was diese Woche besonders ist
  wochenziele: string[];         // Bullet-Liste
  tagesplan: string;             // Mehrere Absaetze, Newlines erhalten
  no_gos: string[];              // Bullet-Liste
  fortschritt: string[];         // "In dieser Woche sollte ..."
  uebungen: TrainingPlanUebung[];// Meist 2 Uebungen
}

export interface TrainingPlanMonthOverview {
  monat: number;                 // 1, 2 oder 3
  text: string;                  // Mehrere Absaetze
}

export interface TrainingPlanZusatzSpiel {
  nummer: number;
  name: string;                  // "Futter suchen"
  ziel: string;
  schritte: string[];
  warum: string;
}

export interface TrainingPlanContent {
  // Intro-Seiten (1-4 im PDF)
  intro?: {
    headline?: string;           // "3-Monatsplan fuer Eddy"
    einleitung?: string;
    ziele?: string;
    aufbau?: string;
  };
  // 12 Wochen (oder weniger - flexibel)
  weeks: TrainingPlanWeek[];
  // Monats-Uebersichten nach Woche 4 / 8 / 12
  monats_uebersichten?: TrainingPlanMonthOverview[];
  // Abschluss
  abschluss?: string;
  // Bonus-Spiele am Ende
  zusatz_spiele?: TrainingPlanZusatzSpiel[];
}

// Type-Guard fuer die Coaching-Page
export function isTrainingPlanContent(
  content: any
): content is TrainingPlanContent {
  return (
    !!content &&
    typeof content === "object" &&
    Array.isArray(content.weeks) &&
    content.weeks.length > 0 &&
    typeof content.weeks[0]?.num === "number"
  );
}

// Holt den neuesten Inhalt fuer einen User+Slug.
// Versucht erst user_id-Match, dann Email-Fallback (falls Make.com
// noch nicht weiss, dass der User auch einen member_users-Eintrag hat).
export async function getLatestPlanContent(
  userId: string,
  email: string,
  slug: string
): Promise<PlanContent | null> {
  const admin = createMemberAdminClient();

  const { data: byUser } = await admin
    .from("member_plan_content")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_slug", slug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byUser) return byUser as PlanContent;

  const { data: byEmail } = await admin
    .from("member_plan_content")
    .select("*")
    .ilike("email", email)
    .eq("plan_slug", slug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (byEmail as PlanContent) || null;
}

// Liste aller Plan-Inhalte des Users (latest pro slug).
export async function listPlanContents(
  userId: string,
  email: string
): Promise<PlanContent[]> {
  const admin = createMemberAdminClient();

  // Hole alle Inhalte (user_id ODER email-match), sortiert neueste zuerst,
  // dedupliziere im Code per slug damit nur latest behalten wird.
  const [byUser, byEmail] = await Promise.all([
    admin
      .from("member_plan_content")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("member_plan_content")
      .select("*")
      .ilike("email", email)
      .order("created_at", { ascending: false }),
  ]);

  const all = [
    ...((byUser.data || []) as PlanContent[]),
    ...((byEmail.data || []) as PlanContent[]),
  ];

  const latestBySlug = new Map<string, PlanContent>();
  for (const c of all) {
    const existing = latestBySlug.get(c.plan_slug);
    if (!existing || c.created_at > existing.created_at) {
      latestBySlug.set(c.plan_slug, c);
    }
  }
  return [...latestBySlug.values()].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1
  );
}
