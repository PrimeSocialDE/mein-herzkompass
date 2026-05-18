// Reconciliation-Cron fuer Zusatzmodul-Auslieferung.
//
// Sucht wauwerk_leads mit upsell_module/upsell_modules gesetzt und prueft,
// welche Modul-PDFs noch NICHT per Mail verschickt wurden (Tracking via
// answers.zusatzmodul_sent[]). Triggert /api/zusatzmodul/send fuer jedes
// nicht-gesendete Modul.
//
// Faengt drei Failure-Modes ab:
//   1. Webhook ist nicht angekommen (Mollie/Stripe-Outage)
//   2. Webhook kam, aber Trigger-Fetch im Webhook hat gefailed
//   3. Manueller DB-Update (Admin-Korrektur, Tests)
//
// Auth: ?secret=... query-param (gleicher Mechanismus wie process-paid-leads)
// Schedule: */5 * * * * (alle 5 Min) — in vercel.json eintragen
//
// Manuell triggern (z.B. fuer einen spezifischen Kunden):
//   GET /api/cron/process-upsell-modules?secret=...&email=foo@bar.de

import { NextRequest } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";

const TRAININGS_MODULE_KEYS = new Set([
  "pulling", "energy", "anxiety", "aggression", "mouthing",
  "recall", "barking", "jumping", "destructive", "soiling",
]);

// Aus den Spalten upsell_module + upsell_modules alle gekauften Modul-Keys
// extrahieren (mit Bundle-Splitting "pulling+anxiety" → 2 Keys).
function extractModuleKeys(lead: any): string[] {
  const all = new Set<string>();
  const arr = lead.upsell_modules;
  if (Array.isArray(arr)) {
    for (const m of arr) if (typeof m === "string") all.add(m.trim());
  } else if (typeof arr === "string") {
    for (const m of arr.split(",")) all.add(m.trim());
  }
  if (typeof lead.upsell_module === "string" && lead.upsell_module.trim()) {
    all.add(lead.upsell_module.trim());
  }
  const expanded = new Set<string>();
  for (const m of all) {
    if (m.includes("+")) {
      for (const part of m.split("+")) expanded.add(part.trim());
    } else {
      expanded.add(m);
    }
  }
  return [...expanded].filter((k) => TRAININGS_MODULE_KEYS.has(k));
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createMemberAdminClient();
  const emailFilter = req.nextUrl.searchParams.get("email")?.toLowerCase();

  // Leads mit upsell_module ODER upsell_modules holen.
  // Filter:
  //   - Käufe der letzten 14 Tage (upsell_paid_at >= 14d ago) ODER
  //   - upsell_paid_at IS NULL (manueller DB-Edit oder Mollie-Bug —
  //     in beiden Faellen wollen wir das Modul versenden)
  // Idempotenz via answers.zusatzmodul_sent[] verhindert Doppel-Versand
  // bei alten Leads die das schon mal bekamen.
  // Manuelles Triggern mit ?email= ist unbeschraenkt.
  const fourteenDaysAgo = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000
  ).toISOString();
  let query = admin
    .from("wauwerk_leads")
    .select("id, email, dog_name, upsell_module, upsell_modules, answers")
    .or("upsell_module.not.is.null,upsell_modules.not.is.null")
    .order("upsell_paid_at", { ascending: false, nullsFirst: false });
  if (emailFilter) {
    query = query.ilike("email", emailFilter);
  } else {
    query = query
      .or(
        `upsell_paid_at.gte.${fourteenDaysAgo},upsell_paid_at.is.null`
      )
      .limit(100);
  }
  const { data: leads, error } = await query;

  if (error) {
    console.error("[cron/process-upsell-modules] fetch error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!leads || leads.length === 0) {
    return Response.json({ ok: true, checked: 0, reason: "no_upsell_leads" });
  }

  // Pro Lead: welche Module sind gekauft, welche davon noch nicht gesendet?
  type Job = { lead: any; moduleKey: string };
  const todo: Job[] = [];
  for (const lead of leads as any[]) {
    if (!lead.email) continue;
    const purchased = extractModuleKeys(lead);
    const sent: string[] = Array.isArray((lead.answers as any)?.zusatzmodul_sent)
      ? (lead.answers as any).zusatzmodul_sent
      : [];
    for (const key of purchased) {
      if (!sent.includes(key)) {
        todo.push({ lead, moduleKey: key });
      }
    }
  }

  if (todo.length === 0) {
    return Response.json({
      ok: true,
      checked: leads.length,
      processed: 0,
      reason: "all_already_sent",
    });
  }

  // Production-URL
  const rawBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.pfoten-plan.de";
  const baseUrl = rawBase.replace(/^http:\/\//, "https://").replace(/\/+$/, "");

  // Max 10 pro Cron-Run (PDF-Build ~3s + Mail-Versand ~1s = ~4s/job, 40s
  // bei 10 → unter maxDuration 60s). Bei manueller Email: unlimitiert.
  const TO_PROCESS = todo.slice(0, emailFilter ? todo.length : 10);

  const results = await Promise.allSettled(
    TO_PROCESS.map(async ({ lead, moduleKey }) => {
      const res = await fetch(`${baseUrl}/api/zusatzmodul/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: lead.email,
          dogName: lead.dog_name || "deinen Hund",
          moduleKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      console.log(
        `[cron/process-upsell-modules] ${lead.email} / ${moduleKey}: ${res.status} ok=${data?.ok}`
      );
      return {
        lead_id: lead.id,
        email: lead.email,
        moduleKey,
        http_status: res.status,
        ok: data?.ok ?? res.ok,
        skipped: data?.skipped || false,
        error: data?.error,
      };
    })
  );

  const summary = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          lead_id: TO_PROCESS[i].lead.id,
          email: TO_PROCESS[i].lead.email,
          moduleKey: TO_PROCESS[i].moduleKey,
          ok: false,
          error: (r.reason as any)?.message || "fetch_failed",
        }
  );

  return Response.json({
    ok: true,
    checked: leads.length,
    todo_total: todo.length,
    processed: summary.length,
    results: summary,
  });
}

// POST fuer manuelle Triggers
export async function POST(req: NextRequest) {
  return GET(req);
}
