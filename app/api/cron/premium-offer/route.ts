// app/api/cron/premium-offer/route.ts
//
// Versendet die Premium-Analyse-Einladung an bezahlte Kunden — gedrosselt.
// ZWEI Kohorten, ein gemeinsames Idempotenz-Flag (answers.premium_offer_sent_at):
//   • NEU  (paid_at >= LAUNCH): ab Tag 17 nach Kauf, hohe Kappe (neues Volumen ~klein)
//   • ALT  (paid_at <  LAUNCH): Bestandskunden, gedrosselt N/Lauf, älteste zuerst
// Bewusst ISOLIERT von der Laura-Sequenz (kein Risiko fürs Bestehende).
//
// SICHERHEIT: ACTIVE=false → der Cron tut NICHTS. Zum Start: ACTIVE=true + push.
// Auth: ?secret=pfoten-cron-2024  (wie die anderen Crons)  ODER  Bearer WORKER_TOKEN.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { buildPremiumAnalyseEmail } from "@/lib/premium-analyse-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ══════════ STARTSCHUSS ══════════
const ACTIVE = false;                              // <-- auf true setzen + pushen zum Aktivieren
const LAUNCH = new Date("2026-07-02T00:00:00Z");   // davor = Bestandskunde (gedrosselt), ab = neu (Tag-17)
const MIN_DAYS = 17;                               // frühestens 17 Tage nach Kauf
const BACKLOG_PER_RUN = 30;                        // Bestandskunden pro Lauf (gedrosselt fürs Fulfillment)
const NEW_PER_RUN = 100;                           // Neu-Käufer (Tag-17) pro Lauf (Sicherheitskappe)
// ═════════════════════════════════

const SECRET = "pfoten-cron-2024";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const BASE = "https://www.pfoten-plan.de";

function authed(req: NextRequest): boolean {
  const s = req.nextUrl.searchParams.get("secret");
  if (s && s === SECRET) return true;
  const h = req.headers.get("authorization") || "";
  return !!process.env.WORKER_TOKEN && h === `Bearer ${process.env.WORKER_TOKEN}`;
}

async function run(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ACTIVE) {
    return NextResponse.json({ ok: true, inactive: true, note: "premium-offer cron ist AUS — ACTIVE=true setzen + pushen zum Start." });
  }
  if (!BREVO_API_KEY) return NextResponse.json({ error: "no_brevo_key" }, { status: 500 });

  const cutoff = new Date(Date.now() - MIN_DAYS * 86400_000).toISOString(); // paid_at <= cutoff = >=17 Tage her

  const { data: leads, error } = await supabase
    .from("wauwerk_leads")
    .select("id,email,dog_name,paid_at,answers")
    .eq("status", "paid")
    .lte("paid_at", cutoff)
    .not("email", "is", null)
    .order("paid_at", { ascending: true })
    .limit(3000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const eligible = (leads || []).filter((l: any) => {
    const a = l.answers || {};
    if (a.premium_offer_sent_at) return false;                 // schon eingeladen
    if (a.email_sequence_unsubscribed_at) return false;         // abgemeldet
    if (a.premium_intake?.status === "paid") return false;      // hat Premium schon gekauft
    if (/@primesocial\.de$/i.test(l.email)) return false;       // interne Test-Adressen
    return true;
  });

  const neu = eligible.filter((l: any) => new Date(l.paid_at) >= LAUNCH).slice(0, NEW_PER_RUN);
  const backlog = eligible.filter((l: any) => new Date(l.paid_at) < LAUNCH).slice(0, BACKLOG_PER_RUN);
  const batch = [...neu, ...backlog];

  let sent = 0, failed = 0;
  for (const l of batch) {
    try {
      const dogName = (l.dog_name || l.answers?.dog_name || "deinen Hund").trim() || "deinen Hund";
      const ctaUrl = `${BASE}/premium-analyse.html?email=${encodeURIComponent(l.email)}&lead_id=${encodeURIComponent(l.id)}`;
      const { subject, html } = buildPremiumAnalyseEmail({ dogName, ctaUrl });

      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
          to: [{ email: l.email }],
          subject,
          htmlContent: html,
          tags: ["premium-offer"],
        }),
      });
      if (!r.ok) { failed++; continue; }

      // Idempotent markieren (frischer Read + Merge, um answers nicht zu clobbern)
      const { data: fresh } = await supabase.from("wauwerk_leads").select("answers").eq("id", l.id).maybeSingle();
      const merged = { ...((fresh as any)?.answers || {}), premium_offer_sent_at: new Date().toISOString() };
      await supabase.from("wauwerk_leads").update({ answers: merged }).eq("id", l.id);
      sent++;
    } catch (e: any) {
      console.error("[cron/premium-offer]", l.email, e?.message);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    sent, failed,
    neu_versendet: neu.length,
    backlog_versendet: backlog.length,
    verbleibend_gesamt: Math.max(0, eligible.length - batch.length),
  });
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
