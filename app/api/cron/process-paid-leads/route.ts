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
  //    /plan/generate speichert Emails ALWAYS lowercase. Wir lowercase
  //    daher auch die Lead-Emails fuer den Lookup, sonst fallen Mixed-Case-
  //    Leads (z.B. "Murli7@gmx.at") durch obwohl der Plan schon existiert.
  const emailsLower = Array.from(
    new Set(
      paidLeads
        .map((l: any) => String(l.email || "").toLowerCase())
        .filter(Boolean)
    )
  );
  const { data: existing } = await admin
    .from("member_plan_content")
    .select("email")
    .in("email", emailsLower)
    .eq("plan_slug", "trainingsplan");

  const emailsWithPlan = new Set(
    (existing || []).map((e: any) => String(e.email).toLowerCase())
  );

  // 3) Unbehandelte Leads filtern (case-insensitive Vergleich)
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
  // Auto-run: max 3 pro Cron-Run.
  // Mit Composer-Architektur kostet 1 Plan-Gen nur ~$0.01 + ~20s.
  // Bei maxDuration=60s ist 3 pro Run sicher; bei Backlog werden in
  // 5-Min-Intervallen schnell viele Leads abgearbeitet.
  // Manual mit ?email=... bleibt unlimitiert fuer gezielte Triggers.
  const TO_PROCESS = todo.slice(0, emailFilter ? todo.length : 3);

  // Parallel ausfuehren: ein Plan-Gen-Request ist ~15-25s, sequentiell
  // wuerden 3 die 60s-maxDuration sprengen. Parallel: max(~25s) ≪ 60s.
  const planRuns = await Promise.allSettled(
    TO_PROCESS.map(async (lead: any) => {
      const res = await fetch(`${baseUrl}/api/mitglieder/plan/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${workerToken}`,
        },
        body: JSON.stringify({ lead_id: lead.id, email: lead.email }),
      });

      const txt = await res.text().catch(() => "");
      let finalResult: any = null;
      for (const line of txt.split("\n").filter(Boolean)) {
        try {
          const obj = JSON.parse(line);
          if (obj.event === "done") finalResult = obj;
        } catch {}
      }

      console.log(
        `[cron/process-paid-leads] ${lead.email}: ${res.status} ok=${finalResult?.ok}`
      );

      return {
        lead_id: lead.id,
        email: lead.email,
        http_status: res.status,
        ok: finalResult?.ok ?? res.ok,
        error: finalResult?.error,
        details: finalResult?.details,
      };
    })
  );

  for (let i = 0; i < planRuns.length; i++) {
    const r = planRuns[i];
    if (r.status === "fulfilled") {
      results.push(r.value);
    } else {
      const lead = TO_PROCESS[i];
      console.error("[cron/process-paid-leads] error:", lead.email, r.reason?.message);
      results.push({
        lead_id: lead.id,
        email: lead.email,
        ok: false,
        error: r.reason?.message || "fetch_failed",
      });
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
