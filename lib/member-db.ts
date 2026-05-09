// DB-Helpers für member_-Tabellen.
// Nutzt Service-Role-Client (createMemberAdminClient) für privilegierte
// Server-Ops wie das Anlegen / Auto-Linking von Member-Profilen.

import { createMemberAdminClient } from "./member-auth";

export interface MemberProfile {
  id: string;
  email: string;
  name: string | null;
  dog_name: string | null;
  dog_breed: string | null;
  quiz_result: any;
  purchase_status: "free" | "paid" | "abo";
  purchased_at: string | null;
  source_lead_id: string | null;
  created_at: string;
}

// ── Profil holen (oder anlegen wenn fehlt) ─────────────────────────────────
// Wird beim ersten Login aufgerufen. Macht Auto-Match gegen wauwerk_leads:
// wenn die Email schon einen Quiz-Lead hat, übernehmen wir Quiz-Daten +
// Kauf-Status. wauwerk_leads selbst wird NICHT angefasst (read-only).
export async function getOrCreateMemberProfile(opts: {
  userId: string;
  email: string;
}): Promise<MemberProfile> {
  const admin = createMemberAdminClient();

  // 1) Profil schon da?
  const { data: existing } = await admin
    .from("member_users")
    .select("*")
    .eq("id", opts.userId)
    .maybeSingle();

  if (existing) return existing as MemberProfile;

  // 2) Quiz-Lead per Email matchen (read-only, nichts ändern dort)
  const { data: lead } = await admin
    .from("wauwerk_leads")
    .select(
      "id, email, customer_name, dog_name, dog_breed, dog_age, dog_problem, status, paid_at, answers"
    )
    .ilike("email", opts.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3) Status ableiten: paid wenn paid_at gesetzt, sonst free
  const isPaid = lead?.status === "paid" && !!lead?.paid_at;
  const purchaseStatus: "free" | "paid" = isPaid ? "paid" : "free";

  // 4) Quiz-Snapshot aus Lead-Answers + Top-Level-Spalten
  const quizResult: Record<string, any> = {};
  if (lead) {
    const answers = (lead.answers || {}) as Record<string, any>;
    if (lead.dog_problem) quizResult.dog_problem = lead.dog_problem;
    if (lead.dog_age) quizResult.dog_age = lead.dog_age;
    if (lead.dog_breed) quizResult.dog_breed = lead.dog_breed;
    // Weitere Quiz-Antworten aus answers übernehmen (alles ausser
    // den intern genutzten Tracking-/Status-Feldern)
    const skipKeys = new Set([
      "rueckhol_mail_sent_at",
      "referral_invite_sent_at",
      "processed_payment_ids",
      "paid_via_safety_net_at",
      "order_bump_delivered_at",
      "order_bump_delivered",
      "tagebuch_sent_at",
      "tagebuch_weeks",
      "notfallkarten_sent_at",
      "exit_bonus_notfallkarten",
    ]);
    for (const [k, v] of Object.entries(answers)) {
      if (!skipKeys.has(k)) quizResult[k] = v;
    }
  }

  // 5) Profil anlegen
  const insertData = {
    id: opts.userId,
    email: opts.email,
    name: lead?.customer_name || null,
    dog_name: lead?.dog_name || null,
    dog_breed: lead?.dog_breed || null,
    quiz_result: quizResult,
    purchase_status: purchaseStatus,
    purchased_at: isPaid ? lead?.paid_at : null,
    source_lead_id: lead?.id || null,
  };

  const { data: created, error } = await admin
    .from("member_users")
    .insert(insertData)
    .select("*")
    .single();

  if (error) {
    console.error("[member-db] insert profile failed:", error);
    throw error;
  }
  return created as MemberProfile;
}

// ── Module + Drip-Status für einen User ────────────────────────────────────
export interface ModuleWithStatus {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  order_index: number;
  is_free: boolean;
  unlock_after_days: number;
  unlocked: boolean;
  unlock_at: string | null;
}

export async function listModulesForMember(
  member: MemberProfile,
  productType = "pfoten-plan"
): Promise<ModuleWithStatus[]> {
  const admin = createMemberAdminClient();
  const { data: modules } = await admin
    .from("member_modules")
    .select("id, slug, title, description, order_index, is_free, unlock_after_days")
    .eq("product_type", productType)
    .order("order_index", { ascending: true });

  if (!modules) return [];

  const purchasedAt = member.purchased_at ? new Date(member.purchased_at) : null;
  const now = new Date();

  return modules.map((m: any) => {
    let unlocked = false;
    let unlockAt: string | null = null;

    if (m.is_free) {
      unlocked = true; // Free-Module immer für alle frei
    } else if (member.purchase_status === "paid" && purchasedAt) {
      const unlockDate = new Date(
        purchasedAt.getTime() + m.unlock_after_days * 86400000
      );
      unlockAt = unlockDate.toISOString();
      unlocked = unlockDate <= now;
    }

    return {
      id: m.id,
      slug: m.slug,
      title: m.title,
      description: m.description,
      order_index: m.order_index,
      is_free: m.is_free,
      unlock_after_days: m.unlock_after_days,
      unlocked,
      unlock_at: unlockAt,
    };
  });
}

// ── Aktive Upsells ─────────────────────────────────────────────────────────
export async function listActiveUpsells(productType = "pfoten-plan") {
  const admin = createMemberAdminClient();
  const { data } = await admin
    .from("member_upsells")
    .select("*")
    .eq("product_type", productType)
    .eq("is_active", true)
    .order("price_cents", { ascending: true });
  return data || [];
}
