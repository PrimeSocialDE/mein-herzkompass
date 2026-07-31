// Oeffentlicher Selbsthilfe-Endpoint: "Plan nicht erhalten? -> nochmal schicken".
// Wird vom Button auf der finalen Danke-Seite getriggert.
//
// SICHERHEIT: Loest die Auslieferung NUR fuer BEZAHLTE Leads aus (sonst
// koennte man sich einen Gratis-Plan schicken). plan/generate hat selbst KEIN
// paid-Gate -> die Pruefung hier ist zwingend. Antwort immer generisch.
//
// Mechanik: verifiziert den Lead (per lead_id, sonst neuester paid-Lead zur
// E-Mail) und ruft serverseitig plan/generate (Bearer WORKER_TOKEN, force) auf,
// damit die Plan-/Login-Mail garantiert erneut rausgeht.
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const generic = NextResponse.json({ ok: true });

  let leadId = "";
  let email = "";
  try {
    const b = await req.json();
    leadId = String(b?.lead_id || b?.leadId || "").trim();
    email = String(b?.email || "").trim().toLowerCase();
  } catch {
    return generic;
  }
  if (!leadId && !email) return generic;

  // Lead finden — bevorzugt per lead_id, sonst neuester PAID-Lead zur E-Mail.
  let lead: { id: string; email: string | null; status: string } | null = null;
  try {
    if (leadId) {
      const { data } = await supabase
        .from("wauwerk_leads")
        .select("id,email,status")
        .eq("id", leadId)
        .limit(1);
      lead = (data && data[0]) || null;
    }
    if ((!lead || lead.status !== "paid") && email) {
      const { data } = await supabase
        .from("wauwerk_leads")
        .select("id,email,status")
        .ilike("email", email)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(1);
      lead = (data && data[0]) || lead;
    }
  } catch (e: any) {
    console.error("[resend-plan] lookup fehlgeschlagen:", e?.message);
    return generic;
  }

  // Nur bezahlte Leads -> keine Gratis-Plaene.
  if (!lead || lead.status !== "paid") return generic;

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.pfoten-plan.de";
  const workerToken = process.env.WORKER_TOKEN || "";
  try {
    await fetch(`${baseUrl}/api/mitglieder/plan/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerToken}`,
      },
      body: JSON.stringify({
        lead_id: lead.id,
        email: lead.email || email,
        force: true,
      }),
    });
  } catch (e: any) {
    console.error("[resend-plan] Auslieferung fehlgeschlagen:", e?.message);
  }

  return generic;
}
