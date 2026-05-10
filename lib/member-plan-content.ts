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
