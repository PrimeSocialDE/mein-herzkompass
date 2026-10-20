import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

// Leichtgewichtiger A/B-Beacon. Schreibt ein Event in funnel_events (Service-Role,
// funnel = test, event = step; ab_events existiert in der DB nicht),
// umgeht RLS). Fire-and-forget vom Client — bremst den Funnel nicht.
// Beispiel-Events: {test:'intro', variant:'A'|'B', step:'ks1_view'|'quiz_done'|'purchase', sid:'...'}
export const runtime = "nodejs";

const SB = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE || "";

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const test = typeof body.test === "string" ? body.test.slice(0, 40) : "";
    const step = typeof body.step === "string" ? body.step.slice(0, 30) : "";
    if (!test || !step || !SB || !KEY) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }
    const sid = typeof body.sid === "string" ? body.sid.slice(0, 48) : "";
    // session_id ist uuid: aus der sid stabil ableiten, damit Schritte derselben Person zusammenpassen
    const h = createHash("sha1").update(sid || `${Date.now()}-${Math.random()}`).digest("hex");
    const row = {
      session_id: `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`,
      funnel: test,
      event: step,
      variant: typeof body.variant === "string" ? body.variant.slice(0, 10) : null,
      meta: sid ? { sid } : null,
    };
    // Insert abwarten (Vercel beendet die Funktion sonst evtl. vor dem Schreiben); der Client wartet eh nicht (keepalive).
    await fetch(`${SB}/rest/v1/funnel_events`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
