// Zentrale Logik fuer das "Pfoten-Plan Club"-Abo (7,99 EUR/Monat).
//
// Zustand liegt in wauwerk_leads.answers (kein Migration noetig):
//   club_active            bool   — Abo laeuft (zahlend)
//   club_subscription_id   str    — Mollie Subscription-ID
//   club_customer_id       str    — Mollie Customer-ID
//   club_started_at        ISO
//   club_unlocked          str[]  — freigeschaltete Themen-Modul-Slugs
//   club_next_unlock_at    YYYY-MM-DD — naechster Drip
//   club_canceled_at       ISO    — Kuendigung angestossen
//   club_access_until      ISO    — Zugang bis (nach Kuendigung bis Periodenende)
//
// member_users.purchase_status = "abo" als grobe Flag; die DEFINITIVE
// Zugangspruefung ist clubHasAccess() (beruecksichtigt access_until).

import { supabase } from "@/lib/db";

export const CLUB_PRICE_CENTS = 799;
export const CLUB_PRICE_EUR = "7.99";
export const DRIP_INTERVAL_DAYS = 14;
export const CLUB_DESCRIPTION = "Pfoten-Plan Club (Monatsabo)";

// Themen-Module in Beliebtheits-Reihenfolge (aus echten Kauf-Segmenten:
// energy > recall > pulling > aggression > mouthing > barking > anxiety > ...).
export const THEMEN_DRIP_ORDER: string[] = [
  "thema-energie",
  "thema-rueckruf",
  "thema-leinen",
  "thema-aggression",
  "thema-aufnehmen",
  "thema-bellen",
  "thema-trennungsangst",
  "thema-anspringen",
  "thema-zerstoerung",
  "thema-stubenrein",
];

// dog_problem (Quiz) -> Themen-Modul-Slug (fuer "Relevanz zuerst")
const PROBLEM_TO_SLUG: Record<string, string> = {
  energy: "thema-energie",
  recall: "thema-rueckruf",
  pulling: "thema-leinen",
  aggression: "thema-aggression",
  mouthing: "thema-aufnehmen",
  barking: "thema-bellen",
  anxiety: "thema-trennungsangst",
  jumping: "thema-anspringen",
  destructive: "thema-zerstoerung",
  soiling: "thema-stubenrein",
};

// Freischalt-Reihenfolge: eigenes Problem zuerst, dann Rest nach Beliebtheit.
export function unlockOrderForProblem(dogProblem?: string | null): string[] {
  const own = dogProblem ? PROBLEM_TO_SLUG[dogProblem] : null;
  const order: string[] = [];
  if (own) order.push(own);
  for (const s of THEMEN_DRIP_ORDER) if (s !== own) order.push(s);
  return order;
}

export interface ClubState {
  active: boolean;
  unlocked: string[];
  nextUnlockAt: string | null;
  startedAt: string | null;
  canceledAt: string | null;
  accessUntil: string | null;
  subscriptionId: string | null;
  customerId: string | null;
}

export function readClubState(answers: any): ClubState {
  const a = (answers || {}) as Record<string, any>;
  return {
    active: !!a.club_active,
    unlocked: Array.isArray(a.club_unlocked) ? a.club_unlocked : [],
    nextUnlockAt: a.club_next_unlock_at || null,
    startedAt: a.club_started_at || null,
    canceledAt: a.club_canceled_at || null,
    accessUntil: a.club_access_until || null,
    subscriptionId: a.club_subscription_id || null,
    customerId: a.club_customer_id || null,
  };
}

// Hat das Mitglied aktuell Club-Zugang? (aktiv ODER gekuendigt-aber-noch-Zugang)
export function clubHasAccess(answers: any): boolean {
  const s = readClubState(answers);
  if (s.active) return true;
  if (s.accessUntil && Date.parse(s.accessUntil) > Date.now()) return true;
  return false;
}

// answers frisch lesen + mergen (nie clobbern)
async function mergeAnswers(
  leadId: string,
  patch: Record<string, any>
): Promise<Record<string, any>> {
  const { data } = await supabase
    .from("wauwerk_leads")
    .select("answers")
    .eq("id", leadId)
    .maybeSingle();
  const prev = (data?.answers || {}) as Record<string, any>;
  const merged = { ...prev, ...patch };
  await supabase.from("wauwerk_leads").update({ answers: merged }).eq("id", leadId);
  return merged;
}

function todayPlusDays(days: number): string {
  return new Date(Date.now() + days * 86400 * 1000).toISOString().slice(0, 10);
}

// Club aktivieren (nach erfolgreicher 1. Abbuchung / Subscription-Start).
// Schaltet SOFORT das erste Modul frei (Relevanz = eigenes Problem) und setzt
// den naechsten Drip in 14 Tagen. Idempotent.
export async function activateClubForLead(
  leadId: string,
  opts: {
    subscriptionId?: string | null;
    customerId?: string | null;
    email?: string | null;
  } = {}
): Promise<{ unlocked: string[]; nextUnlockAt: string }> {
  const { data: lead } = await supabase
    .from("wauwerk_leads")
    .select("answers,email")
    .eq("id", leadId)
    .maybeSingle();
  const answers = (lead?.answers || {}) as Record<string, any>;
  const state = readClubState(answers);
  const problem = (answers.dog_problem as string | null) ?? null;
  const order = unlockOrderForProblem(problem);
  const firstModule = order[0]; // Tag 0: erstes (relevantestes) Modul
  const unlocked = Array.from(
    new Set([...state.unlocked, ...(firstModule ? [firstModule] : [])])
  );

  await mergeAnswers(leadId, {
    club_active: true,
    club_started_at: state.startedAt || new Date().toISOString(),
    club_unlocked: unlocked,
    club_next_unlock_at: todayPlusDays(DRIP_INTERVAL_DAYS),
    club_subscription_id: opts.subscriptionId ?? state.subscriptionId ?? null,
    club_customer_id: opts.customerId ?? state.customerId ?? null,
    club_canceled_at: null,
    club_access_until: null,
  });

  const email = opts.email || lead?.email;
  if (email) {
    await supabase
      .from("member_users")
      .update({ purchase_status: "abo" })
      .ilike("email", email);
  }
  return { unlocked, nextUnlockAt: todayPlusDays(DRIP_INTERVAL_DAYS) };
}

// Naechstes Modul freischalten (Drip). Gibt den neu freigeschalteten Slug
// zurueck oder null, wenn alles frei ist.
export async function dripUnlockForLead(lead: {
  id: string;
  dog_problem?: string | null;
  answers: any;
}): Promise<string | null> {
  const state = readClubState(lead.answers);
  if (!state.active) return null;
  const order = unlockOrderForProblem(
    lead.dog_problem ?? (lead.answers || {}).dog_problem
  );
  const next = order.find((slug) => !state.unlocked.includes(slug));
  if (!next) {
    // Alles frei -> Drip pausieren (kein next_unlock mehr noetig)
    await mergeAnswers(lead.id, { club_next_unlock_at: null });
    return null;
  }
  await mergeAnswers(lead.id, {
    club_unlocked: [...state.unlocked, next],
    club_next_unlock_at: todayPlusDays(DRIP_INTERVAL_DAYS),
  });
  return next;
}

// Kuendigung: Zugang bis Periodenende (accessUntil), danach gesperrt.
export async function markClubCanceled(
  leadId: string,
  accessUntilISO: string
): Promise<void> {
  await mergeAnswers(leadId, {
    club_active: false,
    club_canceled_at: new Date().toISOString(),
    club_access_until: accessUntilISO,
  });
}

// Club-Zustand fuer eine E-Mail holen (fuers Dashboard-Gating).
export async function getClubStateForEmail(email: string): Promise<{
  state: ClubState;
  leadId: string | null;
  dogProblem: string | null;
}> {
  const { data } = await supabase
    .from("wauwerk_leads")
    .select("id,answers")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(5);
  const rows = data || [];
  const lead =
    rows.find((l: any) => {
      const s = readClubState(l.answers);
      return s.active || s.accessUntil;
    }) || rows[0];
  if (!lead) return { state: readClubState({}), leadId: null, dogProblem: null };
  return {
    state: readClubState(lead.answers),
    leadId: lead.id,
    dogProblem: (lead.answers || {}).dog_problem || null,
  };
}

// Aufraeumen, wenn der Zugang nach Kuendigung abgelaufen ist:
// member zurueck auf "paid" (Basis-Plan bleibt), Drip aus.
export async function expireClubIfDue(lead: {
  id: string;
  email?: string | null;
  answers: any;
}): Promise<boolean> {
  const s = readClubState(lead.answers);
  if (s.active) return false;
  if (!s.accessUntil) return false;
  if (Date.parse(s.accessUntil) > Date.now()) return false; // noch Zugang
  await mergeAnswers(lead.id, { club_next_unlock_at: null });
  if (lead.email) {
    await supabase
      .from("member_users")
      .update({ purchase_status: "paid" })
      .ilike("email", lead.email);
  }
  return true;
}
