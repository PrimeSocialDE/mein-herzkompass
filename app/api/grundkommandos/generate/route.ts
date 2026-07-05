// app/api/grundkommandos/generate/route.ts
//
// Trigger für den Notfall-Grundkommando-Plan eines Kunden.
// Auth: Bearer WORKER_TOKEN. Body: { email? , lead_id? , force? , background? }.
// Fuehrt die volle Kette aus (Opus-Content -> PDF -> Brevo-Mail).
//
// background:true → Antwort SOFORT (202), Generierung laeuft via after() im
// Hintergrund bis maxDuration (300s) weiter. So kann der Mollie-Webhook diese
// Route antriggern, ohne auf die ~2-3 Min Opus-Generierung zu warten, UND ohne
// dass Vercel die Generierung killt (after() haelt die Invocation am Leben —
// anders als ein fetch+abort, das die Invocation beim Verbindungsabbruch beendet).

import { NextRequest, NextResponse, after } from "next/server";
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
  const background = !!body?.background;

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

  // Hintergrund-Modus (Webhook-Sofort-Anstoss): NICHT auf die 2-3 Min warten.
  // after() laeuft NACH der Antwort weiter und Vercel haelt die Invocation dafuer
  // am Leben (bis maxDuration 300s). Der Generating-Claim in der Deliver-Lib
  // verhindert, dass der Cron parallel denselben Lead nochmal generiert.
  if (background) {
    after(async () => {
      try {
        const res = await deliverGrundkommandosForLead(leadId, { force });
        console.log(
          `[grundkommandos/generate] background done lead=${leadId}: ${JSON.stringify(res)}`
        );
      } catch (e: any) {
        console.error(
          `[grundkommandos/generate] background error lead=${leadId}:`,
          e?.message || e
        );
      }
    });
    return NextResponse.json({ ok: true, scheduled: true }, { status: 202 });
  }

  try {
    const res = await deliverGrundkommandosForLead(leadId, { force });
    return NextResponse.json(res, res.ok ? undefined : { status: 400 });
  } catch (e: any) {
    console.error("[grundkommandos/generate] error:", e?.message || e);
    return NextResponse.json({ ok: false, reason: e?.message || "error" }, { status: 500 });
  }
}
