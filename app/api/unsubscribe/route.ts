// /api/unsubscribe — Abmeldung aus den Marketing-Mails (Kaltakquise/Reaktivierung).
// Link: /api/unsubscribe?lead=<uuid>  (UUID = unerratbarer Token, kein Secret nötig)
// Setzt answers.unsubscribed=true; das Sende-Skript überspringt solche Leads.
// Unterstützt GET (Klick) + POST (RFC 8058 One-Click List-Unsubscribe).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function unsub(lead?: string | null, email?: string | null): Promise<boolean> {
  if (!lead && !email) return false;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  let row: any = null;
  if (lead) {
    const { data } = await supabase.from("wauwerk_leads").select("id,answers").eq("id", lead).maybeSingle();
    row = data;
  }
  if (!row && email) {
    const { data } = await supabase.from("wauwerk_leads").select("id,answers").ilike("email", email).limit(1).maybeSingle();
    row = data;
  }
  if (!row) return false;
  const ans = row.answers || {};
  await supabase
    .from("wauwerk_leads")
    .update({ answers: { ...ans, unsubscribed: true, unsubscribed_at: new Date().toISOString() } })
    .eq("id", row.id);
  return true;
}

function page(): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Abgemeldet · Pfoten-Plan</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#FBF8F2;color:#1F1B16;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;">
<div style="max-width:420px;text-align:center;background:#fff;border:1px solid #ECE3D5;border-radius:16px;padding:32px 28px;box-shadow:0 6px 24px rgba(31,27,22,.06);">
<div style="font-size:36px;">🐾</div>
<h1 style="font-size:22px;margin:12px 0 8px;">Du bist abgemeldet</h1>
<p style="color:#6E655A;font-size:15px;line-height:1.55;">Du bekommst von uns keine weiteren E-Mails zu diesem Thema. Schade, dass du gehst — alles Gute für dich und deinen Hund! 🐶</p>
</div></body></html>`;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  await unsub(p.get("lead"), p.get("e") || p.get("email"));
  return new NextResponse(page(), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  await unsub(p.get("lead"), p.get("e") || p.get("email"));
  return NextResponse.json({ ok: true });
}
