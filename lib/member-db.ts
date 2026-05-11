// DB-Helpers für member_-Tabellen.
// Nutzt Service-Role-Client (createMemberAdminClient) für privilegierte
// Server-Ops wie das Anlegen / Auto-Linking von Member-Profilen.

import { createMemberAdminClient } from "./member-auth-server";

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

  if (existing) {
    const profile = existing as MemberProfile;
    // Lazy-Sync: User hat sich evtl. erst gratis registriert und DANACH
    // den Plan gekauft. Dann wurde nur wauwerk_leads geupdated, nicht
    // unser member_users-Profil. Jedes Mal beim Login pruefen ob wir
    // upgraden muessen.
    if (profile.purchase_status === "free") {
      const upgraded = await maybeUpgradeFromLead(profile, admin);
      if (upgraded) return upgraded;
    }
    return profile;
  }

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

// ── Lazy-Sync Helper: Free-Member → Paid wenn Lead inzwischen bezahlt ───
// Wird beim Login getriggert, falls der User nach der Registrierung
// erst gekauft hat. Idempotent — wenn nichts zu tun ist, returnt null.
async function maybeUpgradeFromLead(
  profile: MemberProfile,
  admin: ReturnType<typeof createMemberAdminClient>
): Promise<MemberProfile | null> {
  // Lead per Email holen (gleiche Logik wie bei Erst-Anlage)
  const { data: lead } = await admin
    .from("wauwerk_leads")
    .select("id, status, paid_at")
    .ilike("email", profile.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const leadIsPaid = lead?.status === "paid" && !!lead?.paid_at;
  if (!leadIsPaid) return null;

  const { data: updated, error } = await admin
    .from("member_users")
    .update({
      purchase_status: "paid",
      purchased_at: lead.paid_at,
      source_lead_id: profile.source_lead_id || lead.id,
    })
    .eq("id", profile.id)
    .select("*")
    .single();

  if (error) {
    console.error("[member-db] lazy upgrade failed:", error.message);
    return null;
  }
  console.log(
    "[member-db] lazy-upgraded member to paid:",
    profile.email,
    lead.paid_at
  );
  return updated as MemberProfile;
}

// ── Direct-Sync vom Bezahl-Endpoint ────────────────────────────────────
// Aufrufen aus mollie/webhook, mollie/return, mollie/verify-payment
// nachdem der Lead auf "paid" gesetzt wurde. Falls der User schon ein
// member_users-Profil hat (= sich vorher gratis registriert), wird das
// Profil sofort auf "paid" geupdated — ohne auf naechsten Login zu warten.
export async function syncMemberPaidStatusFromLead(opts: {
  email: string;
  paidAt: string;
  leadId?: string;
}): Promise<{ updated: boolean; reason?: string }> {
  if (!opts.email) return { updated: false, reason: "no_email" };
  const admin = createMemberAdminClient();
  const { data: existing } = await admin
    .from("member_users")
    .select("id, purchase_status, source_lead_id")
    .ilike("email", opts.email)
    .maybeSingle();
  if (!existing) return { updated: false, reason: "no_member_yet" };
  if (existing.purchase_status === "paid") {
    return { updated: false, reason: "already_paid" };
  }
  const { error } = await admin
    .from("member_users")
    .update({
      purchase_status: "paid",
      purchased_at: opts.paidAt,
      source_lead_id: existing.source_lead_id || opts.leadId || null,
    })
    .eq("id", existing.id);
  if (error) {
    console.error("[syncMemberPaid] update failed:", error.message);
    return { updated: false, reason: "db_error" };
  }
  console.log("[syncMemberPaid] upgraded:", opts.email, "→ paid");
  return { updated: true };
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

// ── Einzelnes Modul holen (per Slug) ───────────────────────────────────────
export async function getModuleBySlug(slug: string) {
  const admin = createMemberAdminClient();
  const { data } = await admin
    .from("member_modules")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}
