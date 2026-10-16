// app/api/koerpersprache/generate/route.ts
//
// Erzeugt das Produkt-PDF "Was dein Hund dir sagen will — Körpersprache lesen"
// (19,90 €) und schickt es per Mail (Google Workspace SMTP, Brevo als Fallback).
// Fester Inhalt, personalisiert nur Name/Rasse/Problem -> keine KI, sofort fertig.
// Wird vom Mollie-Webhook nach dem Kauf getriggert.
//
// Body: { leadId?, email, dogName?, breed?, problem?, force?: boolean }
// Auth: Bearer WORKER_TOKEN

import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { buildKoerperspracheHeft } from "@/lib/koerpersprache-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const WORKER_TOKEN = (process.env.WORKER_TOKEN || "").trim();

function htmlBody(dogName: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
    <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:14px;padding:24px">
      <h1 style="font-size:22px;margin:0 0 6px;color:#1a1a1a">Was ${dogName} dir sagen will</h1>
      <p style="font-size:15px;color:#666;margin:0">Dein Körpersprache-Heft ist da</p>
      <p style="font-size:14px;color:#444;margin:16px 0 0;line-height:1.6">Im Anhang findest du das komplette Heft als PDF: 24 Signale mit Zeichnung, jeweils was du siehst, was es bedeutet und was du dann tust. Dazu die Seite mit den wichtigsten Signalen für ${dogName}, vier Alltagssituationen und deinen 7-Tage-Beobachtungsplan.</p>
      <p style="font-size:14px;color:#444;margin:12px 0 0;line-height:1.6">Auf der letzten Seite ist dein Spickzettel mit den 5 Warnsignalen. Druck ihn aus und steck ihn in die Jackentasche.</p>
      <p style="font-size:13px;color:#666;margin:18px 0 0;line-height:1.6">Fragen? Antworte einfach auf diese Mail, wir lesen jede selbst.</p>
    </div>
  </div>`;
}

export async function POST(request: Request) {
  try {
    const auth = request.headers.get("authorization") || "";
    const token = (auth.match(/^Bearer\s+(.+)$/i)?.[1] || auth).trim();
    if (!WORKER_TOKEN || token !== WORKER_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const leadId = String(body?.leadId || "").trim();
    const force = body?.force === true;
    let email = String(body?.email || "").trim();
    let dogName = String(body?.dogName || "").slice(0, 40);
    let breed = String(body?.breed || "").slice(0, 60);
    let problem = String(body?.problem || "");

    let leadAnswers: Record<string, any> | null = null;
    if (leadId) {
      const { data: lead } = await supabase
        .from("wauwerk_leads")
        .select("email,dog_name,answers")
        .eq("id", leadId)
        .maybeSingle();
      if (lead) {
        const a = (lead.answers as any) || {};
        leadAnswers = a;
        email = email || String(lead.email || "");
        dogName = dogName || String(lead.dog_name || a.dog_name || "");
        breed = breed || String(a.dog_breed || "");
        problem = problem || String(a.dog_problem || "");
        if (a.koerpersprache_sent_at && !force) {
          return NextResponse.json({ ok: true, skipped: "already_sent", sent_at: a.koerpersprache_sent_at });
        }
      }
    }
    if (!email) return NextResponse.json({ error: "email fehlt" }, { status: 400 });
    dogName = dogName || "dein Hund";

    const pdfBytes = await buildKoerperspracheHeft({ dogName, breed, problem });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
    const fileName = `Koerpersprache-${dogName.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "") || "Hund"}.pdf`;
    const subject = `Was ${dogName} dir sagen will: dein Körpersprache-Heft`;
    const html = htmlBody(dogName);

    let sentVia: "google" | "brevo" | null = null;
    try {
      const { googleSmtpConfigured, sendViaGoogleSmtp } = await import("@/lib/google-smtp");
      if (googleSmtpConfigured()) {
        await sendViaGoogleSmtp({
          to: email, subject, html, cc: "kontakt@primesocial.de",
          attachments: [{ name: fileName, contentBase64: pdfBase64 }],
        });
        sentVia = "google";
      }
    } catch (e: any) {
      console.error("[koerpersprache/generate] Google-SMTP fehlgeschlagen, Fallback Brevo:", e?.message);
    }
    if (!sentVia) {
      if (!BREVO_API_KEY) return NextResponse.json({ error: "kein Mailweg verfuegbar" }, { status: 500 });
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
          to: [{ email }], cc: [{ email: "kontakt@primesocial.de" }],
          subject, htmlContent: html,
          attachment: [{ name: fileName, content: pdfBase64 }],
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error("[koerpersprache/generate] Brevo error:", r.status, t);
        return NextResponse.json({ error: "mail_failed", detail: t.slice(0, 200) }, { status: 502 });
      }
      sentVia = "brevo";
    }

    if (leadId) {
      try {
        const { data: fresh } = await supabase.from("wauwerk_leads").select("answers").eq("id", leadId).maybeSingle();
        await supabase.from("wauwerk_leads").update({
          answers: { ...(((fresh?.answers as any) || leadAnswers) || {}), koerpersprache_sent_at: new Date().toISOString() },
        }).eq("id", leadId);
      } catch (e: any) {
        console.warn("[koerpersprache/generate] Marker-Update fehlgeschlagen:", e?.message);
      }
    }

    console.log(`[koerpersprache] PDF an ${email} (${dogName}, ${problem || "-"}, via ${sentVia})`);
    return NextResponse.json({ ok: true, pdf_bytes: pdfBytes.length, via: sentVia });
  } catch (err: any) {
    console.error("[koerpersprache/generate] error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Interner Fehler" }, { status: 500 });
  }
}
