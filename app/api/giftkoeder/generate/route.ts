// app/api/giftkoeder/generate/route.ts
//
// Erzeugt das Produkt-PDF "Nichts vom Boden" (Anti-Giftkoeder-Training,
// 20 Uebungen in 4 Stufen) und schickt es per Mail (Google Workspace SMTP,
// Brevo als Fallback). Wird vom Mollie-Webhook nach dem Kauf getriggert.
//
// Body: { leadId?, email, dogName?, breed?, age?, problem?, force? }
// Auth: Bearer WORKER_TOKEN
//
// Laufzeit: Opus schreibt 20 ausfuehrliche Uebungen, das dauert in der Messung
// rund 4 Minuten. Deshalb maxDuration 300 — kuerzer reicht nicht.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { generateGiftkoederContent } from "@/lib/giftkoeder-content";
import { buildGiftkoederPDF } from "@/lib/giftkoeder-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const WORKER_TOKEN = (process.env.WORKER_TOKEN || "").trim();

function htmlBody(dogName: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
    <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:14px;padding:24px">
      <h1 style="font-size:22px;margin:0 0 6px;color:#1a1a1a">${dogName}s Anti-Giftköder-Training ist fertig</h1>
      <p style="font-size:15px;color:#666;margin:0">20 Übungen in vier Stufen</p>
      <p style="font-size:14px;color:#444;margin:16px 0 0;line-height:1.6">Im Anhang liegt das komplette Handbuch als PDF. Es fängt drinnen am Küchentisch an, wo nichts ablenkt, und endet am Laubhaufen und an der Runde ohne Leine.</p>
      <p style="font-size:14px;color:#444;margin:12px 0 0;line-height:1.6">Fang heute mit Übung 1 an — nur mit dieser einen. Jede Übung sagt dir, wie oft du sie wiederholst und woran du merkst, dass sie sitzt. Der 14-Tage-Startplan am Ende nimmt dir die Entscheidung ab, was wann dran ist.</p>
      <p style="font-size:14px;color:#444;margin:12px 0 0;line-height:1.6"><b>Ein Hinweis, der uns wichtig ist:</b> Das Training beugt vor, es ersetzt keinen Tierarzt. Im Handbuch steht eine Notfall-Seite mit den Anzeichen einer Vergiftung. Lies die bitte jetzt und nicht erst, wenn es soweit ist.</p>
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
    let age = String(body?.age || "");
    let problem = String(body?.problem || "");

    // ── Lead nachladen (Fragebogen-Daten) ─────────────────────────────
    let leadAnswers: Record<string, any> | null = null;
    if (leadId) {
      const { data: lead } = await supabase
        .from("wauwerk_leads")
        .select("email,dog_name,answers")
        .eq("id", leadId)
        .maybeSingle();
      if (lead) {
        const a = ((lead.answers as any) || {}) as Record<string, any>;
        leadAnswers = a;
        email = email || String(lead.email || "");
        dogName = dogName || String(lead.dog_name || a.dog_name || "");
        breed = breed || String(a.dog_breed || "");
        age = age || String(a.dog_age || "");
        problem = problem || String(a.dog_problem || "");
        if (a.giftkoeder_sent_at && !force) {
          return NextResponse.json({ ok: true, skipped: "already_sent", sent_at: a.giftkoeder_sent_at });
        }
      }
    }
    if (!email) return NextResponse.json({ error: "email fehlt" }, { status: 400 });
    dogName = dogName || "dein Hund";

    // ── KI-Content + PDF ──────────────────────────────────────────────
    const content = await generateGiftkoederContent({ dogName, breed, age, problem });
    const pdfBytes = await buildGiftkoederPDF(content, { breed });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    const dateiName = dogName.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "") || "Hund";
    const fileName = `Nichts-vom-Boden-${dateiName}.pdf`;
    const subject = `${dogName}s Anti-Giftköder-Training ist fertig`;
    const html = htmlBody(dogName);

    // ── Versand: Google SMTP primaer, Brevo als Fallback ──────────────
    let sentVia: "google" | "brevo" | null = null;
    try {
      const { googleSmtpConfigured, sendViaGoogleSmtp } = await import("@/lib/google-smtp");
      if (googleSmtpConfigured()) {
        await sendViaGoogleSmtp({
          to: email,
          subject,
          html,
          cc: "kontakt@primesocial.de",
          attachments: [{ name: fileName, contentBase64: pdfBase64 }],
        });
        sentVia = "google";
      }
    } catch (e: any) {
      console.error("[giftkoeder/generate] Google-SMTP fehlgeschlagen, Fallback Brevo:", e?.message);
    }
    if (!sentVia) {
      if (!BREVO_API_KEY) return NextResponse.json({ error: "kein Mailweg verfuegbar" }, { status: 500 });
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
          to: [{ email }],
          cc: [{ email: "kontakt@primesocial.de" }],
          subject,
          htmlContent: html,
          attachment: [{ name: fileName, content: pdfBase64 }],
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error("[giftkoeder/generate] Brevo error:", r.status, t);
        return NextResponse.json({ error: "mail_failed", detail: t.slice(0, 200) }, { status: 502 });
      }
      sentVia = "brevo";
    }

    // ── Idempotenz-Marker (frisch lesen und mergen) ───────────────────
    if (leadId) {
      try {
        const { data: fresh } = await supabase.from("wauwerk_leads").select("answers").eq("id", leadId).maybeSingle();
        await supabase
          .from("wauwerk_leads")
          .update({
            answers: {
              ...(((fresh?.answers as any) || leadAnswers) || {}),
              giftkoeder_sent_at: new Date().toISOString(),
            },
          })
          .eq("id", leadId);
      } catch (e: any) {
        console.warn("[giftkoeder/generate] Marker-Update fehlgeschlagen:", e?.message);
      }
    }

    const uebungen = content.sections.filter((x: any) => x?.key === "uebung").length;
    console.log(`[giftkoeder] PDF an ${email} (${dogName}, ${uebungen} Uebungen, via ${sentVia})`);
    return NextResponse.json({ ok: true, pdf_bytes: pdfBytes.length, uebungen, via: sentVia });
  } catch (err: any) {
    console.error("[giftkoeder/generate] error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Interner Fehler" }, { status: 500 });
  }
}
