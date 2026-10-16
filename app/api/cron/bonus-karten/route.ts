// GET /api/cron/bonus-karten?secret=pfoten-cron-2024
//
// Sicherheitsnetz fuer den Rueckhol-Bonus (ab_rh_bonus = B, seit 14.10.2026):
// Der Mollie-Webhook verschickt die Notfall-Karten (sendNotfallkartenIfBonus).
// In 3 von 8 ersten Faellen kam der Versand dort nie an. Dieser Cron liefert
// nach: bezahlte Leads mit answers.exit_bonus_notfallkarten, ohne
// notfallkarten_sent_at, Zahlung aelter als 15 Min (Webhook hatte seine Chance)
// und juenger als 7 Tage. Idempotent ueber notfallkarten_sent_at.
// ?dry=1 zeigt nur, wer nachgeliefert wuerde.

import { NextRequest, NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";
const MAX_PER_RUN = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = searchParams.get("dry") === "1";
  const admin = createMemberAdminClient();

  const olderThan = new Date(Date.now() - 15 * 60_000).toISOString();
  const newerThan = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data: leads, error } = await admin
    .from("wauwerk_leads")
    .select("id, email, dog_name, paid_at, answers")
    .eq("status", "paid")
    .eq("answers->>exit_bonus_notfallkarten", "true")
    .is("answers->>notfallkarten_sent_at", null)
    .lte("paid_at", olderThan)
    .gte("paid_at", newerThan)
    .order("paid_at", { ascending: true })
    .limit(MAX_PER_RUN);
  if (error) {
    console.error("[bonus-karten] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.pfoten-plan.de";

  const results: any[] = [];
  for (const lead of leads || []) {
    if (!lead.email) continue;
    if (dryRun) {
      results.push({ id: lead.id, email: lead.email, would_send: true });
      continue;
    }
    try {
      const res = await fetch(`${baseUrl}/api/notfall-karten/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: lead.email, dogName: lead.dog_name || "deinen Hund" }),
      });
      if (!res.ok) {
        results.push({ id: lead.id, email: lead.email, error: `HTTP ${res.status}` });
        continue;
      }
      // Fresh-Read + Merge, damit parallele Webhook-Schreibvorgaenge nichts verlieren.
      const { data: fresh } = await admin
        .from("wauwerk_leads")
        .select("answers")
        .eq("id", lead.id)
        .single();
      const merged = {
        ...(fresh?.answers || lead.answers || {}),
        notfallkarten_sent_at: new Date().toISOString(),
        notfallkarten_via_cron: true,
      };
      await admin.from("wauwerk_leads").update({ answers: merged }).eq("id", lead.id);
      console.log(`[bonus-karten] nachgeliefert an ${lead.email}`);
      results.push({ id: lead.id, email: lead.email, sent: true });
    } catch (e: any) {
      results.push({ id: lead.id, email: lead.email, error: e?.message });
    }
  }

  return NextResponse.json({ ok: true, dryRun, found: leads?.length || 0, results });
}
