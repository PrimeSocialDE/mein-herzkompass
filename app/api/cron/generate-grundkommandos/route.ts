// app/api/cron/generate-grundkommandos/route.ts
//
// Liefert bezahlte Notfall-Grundkommando-Pläne aus, die noch nicht generiert sind
// (answers.grundkommandos_pending_at gesetzt & grundkommandos_sent_at NICHT).
// Entkoppelt vom Mollie-Webhook (Opus dauert ~2-3 Min -> wuerde Webhook timeouten).
// Auth: ?secret=... (gleiches Muster wie die anderen Crons).

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { deliverGrundkommandosForLead } from "@/lib/grundkommandos-deliver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";
const PER_RUN = 2; // pro Lauf (Opus + PDF je Kunde ~2-3 Min)
// Der Mollie-Webhook stoesst die Generierung nach Kauf SOFORT an (best-effort).
// Der Cron ist nur der Backstop: er greift nur bei Pending, die aelter als
// STALE_MS sind — so rennt er nicht mit dem Sofort-Anstoss um die Wette (kein
// doppeltes Generieren desselben Leads). Idempotenz-Check (grundkommandos_sent_at)
// in deliverGrundkommandosForLead faengt Restrennen zusaetzlich ab.
const STALE_MS = 8 * 60 * 1000; // 8 Min

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: true, skipped: "anthropic_key_missing" });
  }

  const { data, error } = await supabase
    .from("wauwerk_leads")
    .select("id,email,answers")
    .not("answers->>grundkommandos_pending_at", "is", null)
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const now = Date.now();
  const todo = (data || [])
    .filter((r: any) => {
      if (r.answers?.grundkommandos_sent_at) return false;
      // Nur "alte" Pending anfassen — junge uebernimmt der Sofort-Anstoss im Webhook.
      const pendingAt = Date.parse(r.answers?.grundkommandos_pending_at || "");
      if (!Number.isFinite(pendingAt)) return true; // kein Datum -> sicherheitshalber liefern
      return now - pendingAt >= STALE_MS;
    })
    .slice(0, PER_RUN);

  const results: any[] = [];
  for (const r of todo) {
    try {
      results.push({ id: r.id, ...(await deliverGrundkommandosForLead(String(r.id))) });
    } catch (e: any) {
      results.push({ id: r.id, ok: false, reason: e?.message || "error" });
    }
  }
  return NextResponse.json({ ok: true, found: todo.length, results });
}
