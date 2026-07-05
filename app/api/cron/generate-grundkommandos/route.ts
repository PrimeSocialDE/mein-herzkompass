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

  const todo = (data || [])
    .filter((r: any) => !r.answers?.grundkommandos_sent_at)
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
