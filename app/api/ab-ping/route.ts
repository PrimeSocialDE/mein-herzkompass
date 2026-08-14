import { NextRequest, NextResponse } from "next/server";

// Leichtgewichtiger A/B-Beacon. Schreibt ein Event in ab_events (Service-Role,
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
    const row = {
      test,
      step,
      variant: typeof body.variant === "string" ? body.variant.slice(0, 10) : null,
      sid: typeof body.sid === "string" ? body.sid.slice(0, 48) : null,
    };
    // Nicht blockieren: Antwort geht sofort raus, Insert läuft nebenbei.
    fetch(`${SB}/rest/v1/ab_events`, {
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
