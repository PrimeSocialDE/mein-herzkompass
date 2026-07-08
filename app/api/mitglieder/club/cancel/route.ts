// /api/mitglieder/club/cancel — Club-Abo kuendigen.
// Der eingeloggte Member kuendigt: Mollie-Subscription stoppen, Zugang laeuft
// bis zum Ende der bezahlten Periode (club_access_until = naechster Buchungstag).

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/member-auth-server";
import { getMollie } from "@/lib/mollie";
import { supabase } from "@/lib/db";
import { readClubState, markClubCanceled } from "@/lib/club";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentMember();
  if (!user?.email) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }
  const email = user.email.toLowerCase();

  // Lead mit Club-Abo finden
  const { data: leads } = await supabase
    .from("wauwerk_leads")
    .select("id,answers")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(5);
  const lead = (leads || []).find((l: any) => readClubState(l.answers).active);
  if (!lead) {
    return NextResponse.json({ ok: true, already: true });
  }

  const state = readClubState(lead.answers);
  const mollie = getMollie();

  // Zugang bis Periodenende: naechster Buchungstag der Subscription, sonst +30 Tage
  let accessUntil = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
  try {
    if (mollie && state.subscriptionId && state.customerId) {
      const sub = await (mollie as any).customerSubscriptions.get(
        state.subscriptionId,
        { customerId: state.customerId }
      );
      if (sub?.nextPaymentDate) {
        accessUntil = new Date(sub.nextPaymentDate + "T00:00:00Z").toISOString();
      }
      // Subscription stoppen
      await (mollie as any).customerSubscriptions.delete(state.subscriptionId, {
        customerId: state.customerId,
      });
    }
  } catch (e) {
    console.error("[club/cancel] Mollie-Cancel:", (e as any)?.message);
    // Trotzdem lokal als gekuendigt markieren — sonst haengt der Member fest.
  }

  await markClubCanceled(lead.id, accessUntil);
  return NextResponse.json({ ok: true, accessUntil });
}
