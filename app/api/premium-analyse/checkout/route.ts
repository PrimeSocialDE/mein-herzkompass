// app/api/premium-analyse/checkout/route.ts
//
// Checkout fuer die 79-EUR-Premium-Analyse. Speichert das Intake (Schilderung,
// Quiz, optionale Fotos) am Lead (answers.premium_intake) und legt eine
// Mollie-Zahlung an. Bewusst ISOLIERT vom Haupt-Funnel: eigener, dedizierter
// Webhook (/api/premium-analyse/webhook) — der zentrale Mollie-Webhook bleibt
// unberuehrt. Auslieferung im Manual-MVP ueber die interne Benachrichtigung
// des dedizierten Webhooks (keine Auto-Generierung).

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getMollie, formatAmountEUR, Locale } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRICE_CENTS = 7900;
const ALLOWED_IMG = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_PHOTOS = 4;

export async function POST(req: NextRequest) {
  const mollie = getMollie();
  if (!mollie) return NextResponse.json({ error: "Mollie nicht konfiguriert" }, { status: 500 });

  try {
    const body = await req.json();
    const email = String(body?.email || "").trim();
    const leadIdIn = body?.leadId ? String(body.leadId) : "";
    const dogName = String(body?.dogName || "dein Hund").slice(0, 40);
    if (!email && !leadIdIn) {
      return NextResponse.json({ error: "email oder leadId nötig" }, { status: 400 });
    }

    const transcript = String(body?.transcript || "").trim();
    const photos = (Array.isArray(body?.photos) ? body.photos : [])
      .slice(0, MAX_PHOTOS)
      .filter((p: any) => p?.base64 && ALLOWED_IMG.has(String(p.type)))
      .map((p: any) => ({ base64: String(p.base64), type: String(p.type) }));
    if (!transcript && photos.length === 0) {
      return NextResponse.json({ error: "Bitte beschreibe die Situation kurz oder lade ein Foto hoch." }, { status: 400 });
    }

    // Intake-Snapshot (text + quiz + fotos) — fuer die spaetere Generierung.
    const intake = {
      submitted_at: new Date().toISOString(),
      status: "pending",
      dogName,
      breed: String(body?.breed || ""),
      age: String(body?.age || ""),
      weight: String(body?.weight || ""),
      problem: String(body?.problem || ""),
      transcript,
      arousalSpeed: body?.arousalSpeed != null ? String(body.arousalSpeed) : "",
      calms: Array.isArray(body?.calms) ? body.calms.slice(0, 4).map((c: any) => String(c)) : [],
      ownerFeeling: String(body?.ownerFeeling || ""),
      understandWish: String(body?.understandWish || "").slice(0, 400),
      hasVideo: !!body?.hasVideo,
      videoName: String(body?.videoName || "").slice(0, 140),
      photos, // base64 — nur in der premium_intake DIESES Kaeufers, vom Premium-Webhook gelesen
      utm: body?.utm && typeof body.utm === "object" ? body.utm : {},
    };

    // Lead finden (per id, sonst per E-Mail) und answers.premium_intake mergen
    // (frischer Read + Merge, damit bestehende answers nicht ueberschrieben werden).
    let lead: { id: string; email: string | null; answers: any } | null = null;
    if (leadIdIn) {
      const { data } = await supabase.from("wauwerk_leads").select("id,email,answers").eq("id", leadIdIn).maybeSingle();
      lead = data as any;
    }
    if (!lead && email) {
      const { data } = await supabase
        .from("wauwerk_leads").select("id,email,answers")
        .ilike("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
      lead = data as any;
    }

    const resolvedEmail = email || lead?.email || "";
    if (!resolvedEmail) return NextResponse.json({ error: "Keine E-Mail gefunden" }, { status: 400 });

    if (lead?.id) {
      const merged = { ...(lead.answers || {}), premium_intake: intake };
      const { error: upErr } = await supabase.from("wauwerk_leads").update({ answers: merged }).eq("id", lead.id);
      if (upErr) console.error("[premium-analyse/checkout] intake save error:", upErr.message);
    } else {
      // Kein Lead (Direktaufruf ohne lead_id) — Intake kann nicht persistiert werden.
      // Im MVP kommen Kaeufer ueber Dashboard/E-Mail-Link (immer mit Lead). Wir lassen
      // den Kauf zu, der Webhook benachrichtigt dann mit Hinweis intake_missing.
      console.warn("[premium-analyse/checkout] kein Lead gefunden, Intake nicht gespeichert:", resolvedEmail);
    }

    const base =
      process.env.NEXT_PUBLIC_BASE_URL && !process.env.NEXT_PUBLIC_BASE_URL.includes("localhost")
        ? process.env.NEXT_PUBLIC_BASE_URL
        : "https://pfoten-plan.de";

    const payment = await mollie.payments.create({
      amount: { currency: "EUR", value: formatAmountEUR(PRICE_CENTS) },
      description: `Pfoten-Plan Premium-Analyse für ${dogName}`.slice(0, 255),
      redirectUrl: `${base}/premium-analyse-danke.html?dog=${encodeURIComponent(dogName)}`,
      webhookUrl: `${base}/api/premium-analyse/webhook`,
      locale: Locale.de_DE,
      metadata: {
        type: "premium-analyse",
        lead_id: lead?.id || leadIdIn || "",
        email: resolvedEmail,
        dog_name: dogName,
      },
    });

    const url = payment.getCheckoutUrl();
    if (!url) return NextResponse.json({ error: "Mollie Checkout-URL fehlt" }, { status: 500 });

    return NextResponse.json({ checkoutUrl: url, paymentId: payment.id });
  } catch (err: any) {
    console.error("[premium-analyse/checkout] error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Checkout fehlgeschlagen" }, { status: 500 });
  }
}
