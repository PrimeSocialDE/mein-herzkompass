// app/api/grundkommandos/generate/route.ts
//
// Manueller Trigger für den Notfall-Grundkommando-Plan eines Kunden.
// Auth: Bearer WORKER_TOKEN. Body: { email? , lead_id? , force? }.
// Fuehrt die volle Kette aus (Opus-Content -> PDF -> Brevo-Mail).

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { deliverGrundkommandosForLead } from "@/lib/grundkommandos-deliver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WORKER_TOKEN = (process.env.WORKER_TOKEN || "").trim();

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = (auth.match(/^Bearer\s+(.+)$/i)?.[1] || auth).trim();
  if (!WORKER_TOKEN || token !== WORKER_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  let leadId = String(body?.lead_id || body?.leadId || "").trim();
  const email = String(body?.email || "").trim();
  const force = !!body?.force;

  if (!leadId && email) {
    const { data } = await supabase
      .from("wauwerk_leads")
      .select("id")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) leadId = String(data.id);
  }
  if (!leadId) return NextResponse.json({ error: "email oder lead_id nötig" }, { status: 400 });

  try {
    const res = await deliverGrundkommandosForLead(leadId, { force });
    return NextResponse.json(res, res.ok ? undefined : { status: 400 });
  } catch (e: any) {
    console.error("[grundkommandos/generate] error:", e?.message || e);
    return NextResponse.json({ ok: false, reason: e?.message || "error" }, { status: 500 });
  }
}
