// app/api/hund-verstehen/order/route.ts
//
// Auslieferung des "Dein Hund verstehen"-Profils nach dem One-Click-Kauf.
// Wird vom Angebots-Screen (hund-verstehen-angebot.html) NACH einer
// erfolgreichen Recurring-Charge aufgerufen — mit dem Hundefoto + den
// Quiz-Daten aus dem Browser (die der Webhook nicht hat).
//
// Sicherheit: verifiziert die Mollie-Zahlung serverseitig (richtiges Modul,
// passender Lead, akzeptabler Status), damit niemand ohne Bezahlung ein PDF
// auslösen kann. Idempotent über answers.hund_verstehen_sent_at — der spätere
// Webhook (gleiche Flag) liefert dann nicht doppelt.

import { NextRequest, NextResponse } from "next/server";
import { getMollie } from "@/lib/mollie";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WORKER_TOKEN = (process.env.WORKER_TOKEN || "").trim();
const ALLOWED_IMG = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const SENT_FLAG = "hund_verstehen_sent_at";

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL &&
    !process.env.NEXT_PUBLIC_BASE_URL.includes("localhost")
    ? process.env.NEXT_PUBLIC_BASE_URL
    : "https://www.pfoten-plan.de";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const paymentId = String(body?.paymentId || "").trim();
    const leadId = String(body?.leadId || "").trim();
    const email = String(body?.email || "").toLowerCase().trim();
    if (!paymentId || !email) {
      return NextResponse.json({ error: "paymentId + email Pflicht" }, { status: 400 });
    }

    const mollie = getMollie();
    if (!mollie) return NextResponse.json({ error: "Mollie nicht konfiguriert" }, { status: 500 });

    // ── Zahlung serverseitig verifizieren ──────────────────────────────
    let payment: any;
    try {
      payment = await mollie.payments.get(paymentId);
    } catch {
      return NextResponse.json({ error: "payment_not_found" }, { status: 402 });
    }
    const meta = (payment?.metadata || {}) as Record<string, any>;
    const okModule = String(meta.module || "") === "hund-verstehen";
    const okLead = leadId ? String(meta.lead_id || "") === leadId : true;
    const okEmail = String(meta.email || "").toLowerCase() === email;
    // recurring landet sofort in pending; card oft direkt paid/authorized
    const okStatus = ["paid", "pending", "authorized", "open"].includes(String(payment?.status || ""));
    if (!okModule || !(okLead || okEmail) || !okStatus) {
      return NextResponse.json(
        { error: "payment_not_valid", status: payment?.status, module: meta.module },
        { status: 402 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Lead für Idempotenz + Fallback-Daten holen
    let lead: any = null;
    if (leadId) {
      const { data } = await supabase
        .from("wauwerk_leads")
        .select("id, email, dog_name, dog_breed, answers")
        .eq("id", leadId)
        .maybeSingle();
      lead = data;
    }
    if (!lead) {
      const { data } = await supabase
        .from("wauwerk_leads")
        .select("id, email, dog_name, dog_breed, answers")
        .ilike("email", email)
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      lead = data;
    }

    const ans = ((lead?.answers as any) || {}) as Record<string, any>;
    if (ans[SENT_FLAG]) {
      return NextResponse.json({ ok: true, already_sent: true });
    }

    // ── Quiz-Kontext: Browser-Daten bevorzugt, sonst aus dem Lead ──────
    const dogName = String(body?.dogName || lead?.dog_name || "dein Hund").slice(0, 40);
    const breed = String(body?.breed || lead?.dog_breed || ans.dog_breed || "Mischling");
    const age = String(body?.age || ans.dog_age || "adult");
    const problem = body?.problem ? String(body.problem) : ans.dog_problem || null;
    const behaviors: string[] = Array.isArray(body?.behaviors)
      ? body.behaviors.map((b: any) => String(b)).slice(0, 8)
      : Array.isArray(ans.dog_behaviors)
        ? ans.dog_behaviors.slice(0, 8)
        : [];
    const commands: string[] = Array.isArray(body?.commands)
      ? body.commands.map((c: any) => String(c)).slice(0, 8)
      : Array.isArray(ans.dog_commands)
        ? ans.dog_commands.slice(0, 8)
        : [];
    const hadTraining = body?.hadTraining ? String(body.hadTraining) : ans.had_training || null;
    const goal = body?.goal ? String(body.goal) : ans.dog_goal || null;

    let photoBase64: string | null = null;
    let photoType: string | null = null;
    if (body?.photoBase64 && ALLOWED_IMG.has(String(body?.photoType || ""))) {
      photoBase64 = String(body.photoBase64);
      photoType = String(body.photoType);
    }

    // ── Generate-Route aufrufen (sendet das PDF per Brevo) ─────────────
    const res = await fetch(`${baseUrl()}/api/hund-verstehen/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${WORKER_TOKEN}` },
      body: JSON.stringify({
        email,
        dogName,
        breed,
        age,
        problem,
        behaviors,
        hadTraining,
        commands,
        goal,
        photoBase64,
        photoType,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[hund-verstehen/order] generate failed:", res.status, t.slice(0, 200));
      return NextResponse.json({ error: "delivery_failed" }, { status: 502 });
    }

    // ── Idempotenz-Flag setzen (Fresh-Read, damit nichts überschrieben wird) ──
    if (lead?.id) {
      try {
        const { data: fresh } = await supabase
          .from("wauwerk_leads")
          .select("answers")
          .eq("id", lead.id)
          .maybeSingle();
        const prev = ((fresh?.answers as any) || ans || {}) as Record<string, any>;
        await supabase
          .from("wauwerk_leads")
          .update({ answers: { ...prev, [SENT_FLAG]: new Date().toISOString(), hund_verstehen_with_photo: !!photoBase64 } })
          .eq("id", lead.id);
      } catch (e: any) {
        console.warn("[hund-verstehen/order] flag write failed:", e?.message);
      }
    }

    return NextResponse.json({ ok: true, with_photo: !!photoBase64 });
  } catch (err: any) {
    console.error("[hund-verstehen/order] error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Interner Fehler" }, { status: 500 });
  }
}
