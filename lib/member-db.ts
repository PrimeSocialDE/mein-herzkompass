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
  // Wenn mehrere Leads existieren (Re-Quiz nach Kauf), nehmen wir den
  // mit paid_at zuerst — sonst den neuesten als Quiz-Daten-Quelle.
  const { data: leads } = await admin
    .from("wauwerk_leads")
    .select(
      "id, email, customer_name, dog_name, dog_breed, dog_age, dog_problem, status, paid_at, answers, created_at"
    )
    .ilike("email", opts.email)
    .order("created_at", { ascending: false })
    .limit(10);

  const paidLead = (leads || []).find((l: any) => !!l.paid_at);
  const lead = paidLead || (leads && leads[0]) || null;

  // 3) Status: paid wenn IRGENDEIN Lead mit dieser Email paid_at hat,
  //    ODER wenn schon ein member_plan_content existiert (= sicherer Kauf-Beweis)
  let isPaid = !!lead?.paid_at;
  let paidAtSource: string | null = lead?.paid_at || null;
  if (!isPaid) {
    const { data: existingPlan } = await admin
      .from("member_plan_content")
      .select("created_at")
      .ilike("email", opts.email)
      .eq("plan_slug", "trainingsplan")
      .limit(1)
      .maybeSingle();
    if (existingPlan) {
      isPaid = true;
      paidAtSource = (existingPlan as any).created_at;
    }
  }
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
      "recovery_mail_sent_at",
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
    purchased_at: isPaid ? paidAtSource : null,
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
  const profile = created as MemberProfile;
  // Direkt nach Anlage: wenn paid → Wochen-Challenges anlegen, damit der
  // User beim ersten Besuch der Challenge-Page nicht "keine Aufgabe" sieht
  if (profile.purchase_status === "paid") {
    void seedWeekChallengesBackground(profile);
  }
  return profile;
}

// Fire-and-forget Helper. Importiert member-challenges dynamisch um
// circulare Imports zu vermeiden (member-challenges importiert MemberProfile
// aus dieser Datei).
function seedWeekChallengesBackground(member: MemberProfile) {
  import("./member-challenges")
    .then((m) => m.getOrAssignWeekChallenges(member))
    .then((cs) => {
      if (cs.length > 0) {
        console.log(
          `[member-db] auto-seeded ${cs.length} challenges for ${member.email}`
        );
      }
    })
    .catch((e) =>
      console.warn(
        "[member-db] auto-seed challenges failed:",
        member.email,
        e?.message
      )
    );
}

// ── Lazy-Sync Helper: Free-Member → Paid wenn Lead inzwischen bezahlt ───
// Wird beim Login getriggert, falls der User nach der Registrierung
// erst gekauft hat. Idempotent — wenn nichts zu tun ist, returnt null.
async function maybeUpgradeFromLead(
  profile: MemberProfile,
  admin: ReturnType<typeof createMemberAdminClient>
): Promise<MemberProfile | null> {
  // Mehrere Quellen pruefen — robust gegen:
  //  a) Re-Quiz nach Kauf (neuester Lead ist pending, alter Lead paid)
  //  b) Email-Case-Mismatch (ilike loest das, hier nochmal absichern)
  //  c) Stripe-Customer-Email != Quiz-Email (Plan-Content matcht trotzdem)
  // Wir holen ALLE Leads + checken auf paid_at — egal welcher status-String.
  const { data: leads } = await admin
    .from("wauwerk_leads")
    .select("id, status, paid_at")
    .ilike("email", profile.email)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(5);

  const paidLead = (leads || []).find((l: any) => !!l.paid_at);

  // Fallback: existiert ein member_plan_content fuer diese Email?
  // Wenn ja, hat sie definitiv gekauft (Plan wird nur fuer paid Leads gebaut).
  let planFallback: { paid_at: string; lead_id: string | null } | null = null;
  if (!paidLead) {
    const { data: plan } = await admin
      .from("member_plan_content")
      .select("created_at, source_payment_id")
      .ilike("email", profile.email)
      .eq("plan_slug", "trainingsplan")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (plan) {
      planFallback = {
        paid_at: (plan as any).created_at,
        lead_id: (plan as any).source_payment_id || null,
      };
    }
  }

  if (!paidLead && !planFallback) return null;

  const paidAt = paidLead?.paid_at || planFallback!.paid_at;
  const sourceLeadId =
    profile.source_lead_id || paidLead?.id || planFallback?.lead_id || null;

  const { data: updated, error } = await admin
    .from("member_users")
    .update({
      purchase_status: "paid",
      purchased_at: paidAt,
      source_lead_id: sourceLeadId,
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
    paidAt,
    paidLead ? "via_lead" : "via_plan_content"
  );
  // Sicherheitsnetz: nach Upgrade direkt Wochen-Challenges anlegen, damit
  // der User auf /mitglieder/erfolge/challenges nicht "keine Aufgabe" sieht
  void seedWeekChallengesBackground(updated as MemberProfile);
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
  // Sicherheitsnetz: nach Sync direkt Wochen-Challenges anlegen
  // (vollstaendiges Profil ist gerade in der DB — wir holen es nochmal kurz).
  void admin
    .from("member_users")
    .select("*")
    .eq("id", existing.id)
    .single()
    .then(({ data }) => {
      if (data) seedWeekChallengesBackground(data as MemberProfile);
    });
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

// ── Gekaufte Zusatzmodule (Trainings-PDFs) per Email ──────────────────────
// Liest aus wauwerk_leads.upsell_modules welche der 10 Trainings-Zusatz-
// Module der Kunde bezahlt hat. Liefert nur valide Modul-Keys zurueck.
export const TRAININGS_ZUSATZMODUL_KEYS = [
  "pulling", "energy", "anxiety", "aggression", "mouthing",
  "recall", "barking", "jumping", "destructive", "soiling",
] as const;

export type TrainingsZusatzmodulKey = (typeof TRAININGS_ZUSATZMODUL_KEYS)[number];

const TRAININGS_KEY_SET = new Set<string>(TRAININGS_ZUSATZMODUL_KEYS);

// Anzeige-Labels fuer die UI (analog zu generate-zusatzmodul-pdf.mjs).
export const TRAININGS_ZUSATZMODUL_LABELS: Record<TrainingsZusatzmodulKey, string> = {
  pulling: "Leinenführungs-Plan",
  energy: "Energie- & Ruhe-Plan",
  anxiety: "Alleine-bleiben Plan",
  aggression: "Aggressions-Kontrolle",
  mouthing: "Anti-Aufnehm Plan",
  recall: "Rückruf-Plan",
  barking: "Anti-Bell Plan",
  jumping: "Anti-Anspring Plan",
  destructive: "Anti-Zerstörungs Plan",
  soiling: "Stubenreinheits-Plan",
};

export async function listPurchasedZusatzmodule(
  email: string
): Promise<TrainingsZusatzmodulKey[]> {
  if (!email) return [];
  const admin = createMemberAdminClient();
  // Es kann mehrere Lead-Eintraege pro Email geben (alter + neuer Quiz).
  // DB hat DREI Spalten fuer Module: upsell_module (Haupt), upsell_2
  // (zweiter Slot), upsell_prevention (Prevention-Slot). Jede kann String
  // mit Bundle-Notation "a+b" sein. (upsell_modules Plural existiert NICHT.)
  const { data } = await admin
    .from("wauwerk_leads")
    .select("upsell_module, upsell_2, upsell_prevention")
    .ilike("email", email);
  if (!Array.isArray(data)) return [];
  const all = new Set<string>();
  for (const row of data as Array<Record<string, unknown>>) {
    for (const col of ["upsell_module", "upsell_2", "upsell_prevention"]) {
      const v = row[col];
      if (typeof v === "string" && v.trim()) {
        all.add(v.trim());
      }
    }
  }
  // Bundle-Strings wie "pulling+anxiety" auch aufteilen
  const expanded = new Set<string>();
  for (const m of all) {
    if (m.includes("+")) {
      for (const part of m.split("+")) expanded.add(part.trim());
    } else {
      expanded.add(m);
    }
  }
  return [...expanded].filter((k): k is TrainingsZusatzmodulKey =>
    TRAININGS_KEY_SET.has(k)
  );
}
