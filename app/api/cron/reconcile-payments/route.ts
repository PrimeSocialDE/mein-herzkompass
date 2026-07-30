// Reconcile-Waechter fuer "bezahlt-aber-falscher-Status".
//
// Problem: Vereinzelt landen Mollie-"paid"-Zahlungen NICHT als paid im Lead
// (verpasstes/gerace-tes Webhook-Event) -> Lead bleibt auf pending/failed,
// Auslieferung wird nie ausgeloest, und der Kunde bekommt faelschlich
// Recovery-Mails. Dieser Cron heilt das selbst:
//   1) pending/failed-Leads mit mollie_payment_id holen
//   2) echten Mollie-Status je Konto (DE/PL/IT) pruefen
//   3) wenn "paid": Status -> paid (CAS-Guard) + Auslieferung ausloesen
//      (plan/generate OHNE force -> liefert nur, wenn noch kein Plan existiert,
//       also KEINE Doppel-Mail an Kunden, die ihren Plan schon haben)
//
// Auth: ?secret=<CRON_SECRET>.  Testlauf ohne Aenderung: ?dry=1
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMollie, getMolliePL, getMollieIT } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";

function mollieForLang(lang: string | null | undefined) {
  return lang === "pl" ? getMolliePL() : lang === "it" ? getMollieIT() : getMollie();
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = url.searchParams.get("dry") === "1";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 150, 400);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: leads, error } = await supabase
    .from("wauwerk_leads")
    .select("id, email, status, mollie_payment_id, paid_at, answers")
    .in("status", ["pending", "failed"])
    .not("mollie_payment_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.pfoten-plan.de";
  const workerToken = process.env.WORKER_TOKEN || "";
  const results: any[] = [];
  let checked = 0;
  let fixed = 0;

  for (const lead of leads || []) {
    const lang = (lead.answers as any)?.lang || "de";
    const mollie = mollieForLang(lang);
    if (!mollie || !lead.mollie_payment_id) continue;
    checked++;

    let p: any;
    try {
      p = await mollie.payments.get(lead.mollie_payment_id);
    } catch {
      continue; // Payment nicht auf diesem Konto / nicht abrufbar
    }
    if (p?.status !== "paid") continue;

    // Treffer: bezahlt, aber Lead-Status pending/failed.
    if (dryRun) {
      results.push({ email: lead.email, id: lead.id, mollie: "paid", would_fix: true });
      fixed++;
      continue;
    }

    // 1) Status korrigieren (CAS-Guard: nur, wenn nicht bereits paid)
    await supabase
      .from("wauwerk_leads")
      .update({ status: "paid", paid_at: lead.paid_at || p.paidAt || new Date().toISOString() })
      .eq("id", lead.id)
      .neq("status", "paid");

    // 2) Auslieferung ausloesen OHNE force -> nur falls noch kein Plan existiert.
    //    Idempotent: Kunden, die ihren Plan schon haben, bekommen KEINE Doppel-Mail.
    let delivered: any = null;
    try {
      const r = await fetch(`${baseUrl}/api/mitglieder/plan/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerToken}` },
        body: JSON.stringify({ lead_id: lead.id, email: lead.email }),
      });
      const txt = await r.text();
      for (const line of txt.split("\n").filter(Boolean)) {
        try {
          const o = JSON.parse(line);
          if (o.event === "done") delivered = { ok: o.ok, error: o.error };
        } catch {}
      }
    } catch (e: any) {
      delivered = { ok: false, error: e?.message };
    }

    fixed++;
    results.push({ email: lead.email, id: lead.id, fixed: true, delivered });
  }

  return NextResponse.json({ ok: true, candidates: (leads || []).length, checked, fixed, dryRun, results });
}
