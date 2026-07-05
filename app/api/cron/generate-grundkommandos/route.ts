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
const PER_RUN = 3; // pro Lauf (Opus + PDF je Kunde ~2-3 Min, laeuft sequentiell)
// Backstop-Logik: Nach Kauf stoesst der Webhook die Generierung SOFORT an
// (Generate-Route mit background:true → after()). Die Deliver-Lib setzt beim Start
// einen Claim (grundkommandos_generating_at). Der Cron soll NUR einspringen, wenn
// dieser Sofort-Pfad NICHT laeuft — also wenn kein Claim gesetzt ist ODER der Claim
// aelter als CLAIM_MS ist (Sofort-Lauf gestorben). So rennt der Cron nie mit dem
// Sofort-Anstoss um die Wette (kein Doppel-Generieren), faengt aber alles ab, was
// durchrutscht. Zusaetzlich schuetzt der Claim-Check in der Deliver-Lib selbst.
const CLAIM_MS = 8 * 60 * 1000; // 8 Min

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
      const a = r.answers || {};
      if (a.grundkommandos_sent_at) return false; // schon geliefert
      // Frischer Claim (<8 Min) = Sofort-Pfad generiert gerade -> nicht anfassen.
      const claimAt = a.grundkommandos_generating_at
        ? Date.parse(a.grundkommandos_generating_at)
        : 0;
      if (claimAt && now - claimAt < CLAIM_MS) return false;
      return true; // kein/alter Claim -> Backstop greift
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
