// Reconciliation-Cron — laeuft alle 5 Minuten.
//
// Sucht wauwerk_leads mit status=paid die noch KEINEN Eintrag in
// member_plan_content haben (= Plan wurde nicht generiert / Mail kam nicht
// raus). Triggert fuer diese Leads die Plan-Generation nach.
//
// Faengt drei Failure-Modes ab:
//   1. Webhook ist nicht angekommen (Mollie-Outage)
//   2. Webhook kam, aber Trigger-Fetch im Webhook hat gefailed
//   3. Manueller DB-Update von status=paid (Admin-Korrektur, Tests)
//
// Auth: ?secret=... query-param (gleicher Mechanismus wie andere Crons)
// Schedule: */5 * * * * (alle 5 Min) — in vercel.json eintragen

import { NextRequest } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";

export async function GET(req: NextRequest) {
  // Auth via query-secret (genauso wie /api/upsell-cron)
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createMemberAdminClient();

  // Optional: ?email=... filter — nur diesen einen Lead processieren.
  // Nuetzlich fuer manuelles Triggern eines spezifischen Leads.
  const emailFilter = req.nextUrl.searchParams.get("email")?.toLowerCase();

  // 1) Paid-Leads holen, neueste zuerst (max 50 pro Run = nie ein Backlog)
  let query = admin
    .from("wauwerk_leads")
    .select("id, email, dog_name, paid_at, status, selected_plan, answers")
    .eq("status", "paid")
    .order("paid_at", { ascending: false });
  if (emailFilter) {
    query = query.ilike("email", emailFilter);
  } else {
    query = query.limit(50);
  }
  const { data: paidLeads, error: leadErr } = await query;

  if (leadErr) {
    console.error("[cron/process-paid-leads] lead-fetch error:", leadErr);
    return Response.json({ ok: false, error: leadErr.message }, { status: 500 });
  }

  if (!paidLeads || paidLeads.length === 0) {
    return Response.json({ ok: true, processed: 0, reason: "no_paid_leads" });
  }

  // 2) Welche dieser Emails haben schon einen trainingsplan-Content?
  const emails = paidLeads.map((l: any) => l.email).filter(Boolean);
  const { data: existing } = await admin
    .from("member_plan_content")
    .select("email")
    .in("email", emails)
    .eq("plan_slug", "trainingsplan");

  const emailsWithPlan = new Set(
    (existing || []).map((e: any) => String(e.email).toLowerCase())
  );

  // 3) Unbehandelte Leads filtern
  const todo = paidLeads.filter(
    (l: any) => l.email && !emailsWithPlan.has(String(l.email).toLowerCase())
  );

  if (todo.length === 0) {
    return Response.json({
      ok: true,
      processed: 0,
      checked: paidLeads.length,
      reason: "all_have_plans",
    });
  }

  // 4) Pro unbehandelten Lead: /plan/generate triggern (sequenziell, max 5
  //    pro Cron-Run um Claude-API nicht zu fluten)
  const workerToken = process.env.WORKER_TOKEN;
  if (!workerToken) {
    console.error("[cron/process-paid-leads] WORKER_TOKEN fehlt");
    return Response.json({ ok: false, error: "no_worker_token" }, { status: 500 });
  }

  // Production-URL bevorzugen; VERCEL_URL kommt ohne Protokoll, daher prepend
  const rawBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.pfoten-plan.de";
  const baseUrl = rawBase.replace(/^http:\/\//, "https://").replace(/\/+$/, "");

  const results: any[] = [];
  // Auto-run (Cron alle 5 Min): max 1 pro Run — verhindert Claude-Cost-Flood
  // und Function-Timeout (1 Plan-Gen kann 3-5 Min dauern).
  // Manual mit ?email=... fuer gezielte Triggers.
  const TO_PROCESS = todo.slice(0, emailFilter ? todo.length : 1);

  for (const lead of TO_PROCESS) {
    try {
      const res = await fetch(`${baseUrl}/api/mitglieder/plan/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${workerToken}`,
        },
        body: JSON.stringify({ lead_id: lead.id, email: lead.email }),
      });

      // /plan/generate streamt NDJSON — wir lesen alle Zeilen und nehmen
      // die letzte "done"-Event als Result.
      const txt = await res.text().catch(() => "");
      const lines = txt.split("\n").filter(Boolean);
      let finalResult: any = null;
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.event === "done") finalResult = obj;
        } catch {}
      }

      results.push({
        lead_id: lead.id,
        email: lead.email,
        http_status: res.status,
        ok: finalResult?.ok ?? res.ok,
        error: finalResult?.error,
      });

      console.log(
        `[cron/process-paid-leads] ${lead.email}: ${res.status} ok=${finalResult?.ok}`
      );
    } catch (e: any) {
      results.push({
        lead_id: lead.id,
        email: lead.email,
        ok: false,
        error: e?.message || "fetch_failed",
      });
      console.error("[cron/process-paid-leads] error:", lead.email, e?.message);
    }
  }

  return Response.json({
    ok: true,
    found_paid: paidLeads.length,
    todo_total: todo.length,
    processed: results.length,
    results,
  });
}

// Auch POST erlauben fuer manuelle Triggers (Admin-UI / curl)
export async function POST(req: NextRequest) {
  return GET(req);
}
