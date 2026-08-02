// POST /api/bewertung/record  { lead_id?, email?, sterne }
//
// Protokolliert die in der Bewertungs-Mail gewaehlte Sternzahl am Lead
// (answers.review_stars + review_stars_at), damit wir die Verteilung messen
// koennen (wie viele 5er vs. 1-3er). Best-effort: wirft nie, blockt nie den
// Redirect auf der /bewertung-Seite. Fresh-Read-Merge gegen Answers-Clobber
// (siehe webhook-delivery-idempotency).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      try { body = JSON.parse(await req.text()); } catch { body = {}; }
    }
    const leadId = String(body?.lead_id || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const sterne = parseInt(String(body?.sterne || ""), 10);

    if (!Number.isFinite(sterne) || sterne < 1 || sterne > 5) {
      return NextResponse.json({ ok: false, reason: "invalid_stars" }, { status: 200 });
    }
    if (!leadId && !email) {
      return NextResponse.json({ ok: false, reason: "no_identifier" }, { status: 200 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ ok: false, reason: "no_db" }, { status: 200 });
    }
    const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    // Frischen Lead lesen (per id bevorzugt, sonst neueste per email)
    let q = sb.from("wauwerk_leads").select("id, answers");
    q = leadId ? q.eq("id", leadId) : q.ilike("email", email).order("created_at", { ascending: false }).limit(1);
    const { data: lead } = await q.maybeSingle();
    if (!lead) {
      return NextResponse.json({ ok: false, reason: "lead_not_found" }, { status: 200 });
    }

    const answers = { ...((lead as any).answers || {}) };
    answers.review_stars = sterne;
    answers.review_stars_at = new Date().toISOString();

    await sb.from("wauwerk_leads").update({ answers }).eq("id", (lead as any).id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    // Nie hart failen — der Redirect auf /bewertung darf nicht blockiert werden.
    return NextResponse.json({ ok: false, reason: "error" }, { status: 200 });
  }
}
