// app/api/silvester/generate/route.ts
//
// Erzeugt den personalisierten "Silvester-Plan" (Knallangst-Training mit
// Wochenplan bis Silvester + Plan fuer die Nacht) und schickt ihn per Mail
// (Google Workspace SMTP, Brevo als Fallback). Wird vom Mollie-Webhook nach dem
// Kauf getriggert. Aufbau 1:1 wie app/api/giftkoeder/generate.
//
// Body: { leadId?, email, dogName?, breed?, age?, problem?, angst?, lage?, zuhause?, force?, via? }
//   angst: leicht | mittel | stark | unbekannt · lage: stadt | vorort | land
//   zuhause: ja | nein | unsicher · via: "brevo" erzwingt Brevo (Support-Neuversand)
// Auth: Bearer WORKER_TOKEN
//
// Laufzeit: zwei parallele Opus-Haelften, wie bei Nichts vom Boden gut 2-3 Minuten.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { generateSilvesterContent } from "@/lib/silvester-content";
import { buildSilvesterPDF } from "@/lib/silvester-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const WORKER_TOKEN = (process.env.WORKER_TOKEN || "").trim();

function htmlBody(dogName: string, wochen: number, tageBis: number): string {
  const zeit =
    tageBis < 0
      ? "Fang am besten sechs Wochen vor Silvester an."
      : tageBis < 14
      ? `Bis Silvester sind es nur noch ${tageBis} Tage. Der Plan setzt deshalb auf das, was jetzt noch wirkt: den sicheren Ort, die Gassi-Routine und einen genauen Ablauf für die Nacht.`
      : `Bis Silvester sind es noch ${tageBis} Tage. Der Wochenplan teilt sie in ${wochen} Abschnitte mit festen Daten, du musst nichts selbst planen.`;
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
    <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:14px;padding:24px">
      <h1 style="font-size:22px;margin:0 0 6px;color:#1a1a1a">${dogName}s Silvester-Plan ist fertig</h1>
      <p style="font-size:15px;color:#666;margin:0">Knallangst-Training und dein Plan für die Nacht</p>
      <p style="font-size:14px;color:#444;margin:16px 0 0;line-height:1.6">Im Anhang liegt der komplette Plan als PDF. ${zeit}</p>
      <p style="font-size:14px;color:#444;margin:12px 0 0;line-height:1.6">Fang heute mit Übung 1 an, dem sicheren Rückzugsort. Beim Geräusch-Training gilt immer: lieber zu leise als zu laut. Jede Übung sagt dir, woran du merkst, dass es zu viel ist.</p>
      <p style="font-size:14px;color:#444;margin:12px 0 0;line-height:1.6"><b>Ein Hinweis, der uns wichtig ist:</b> Ist die Angst sehr stark, sprich bitte rechtzeitig mit deiner Tierärztin. Manche Mittel brauchen Vorlauf. Im Plan steht eine Seite mit Fragen, die du dort stellen kannst.</p>
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
    let gender = String(body?.gender || "");
    let angst = String(body?.angst || "");
    let lage = String(body?.lage || "");
    let zuhause = String(body?.zuhause || "");
    const viaBrevo = body?.via === "brevo";

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
        gender = gender || String(a.dog_gender || "");
        // Angaben eines frueheren Kaufs (Neuversand ohne Body-Angaben)
        const alt = (a.silvester_angaben || {}) as Record<string, string>;
        angst = angst || String(alt.angst || "");
        lage = lage || String(alt.lage || "");
        zuhause = zuhause || String(alt.zuhause || "");
        if (a.silvester_sent_at && !force) {
          return NextResponse.json({ ok: true, skipped: "already_sent", sent_at: a.silvester_sent_at });
        }
      }
    }
    if (!email) return NextResponse.json({ error: "email fehlt" }, { status: 400 });
    dogName = dogName || "dein Hund";

    // ── KI-Content + PDF ──────────────────────────────────────────────
    const geschlecht = gender === "female" ? "Hündin" : gender === "male" ? "Rüde" : "";
    const content = await generateSilvesterContent({ dogName, breed, age, gender: geschlecht, problem, angst, lage, zuhause });
    const pdfBytes = await buildSilvesterPDF(content, { breed });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    const dateiName = dogName.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "") || "Hund";
    const fileName = `Silvester-Plan-${dateiName}.pdf`;
    const subject = `${dogName}s Silvester-Plan ist fertig`;
    const html = htmlBody(dogName, content.wochen.length, content.tageBisSilvester);

    // ── Versand: Google SMTP primaer, Brevo als Fallback ──────────────
    let sentVia: "google" | "brevo" | null = null;
    try {
      const { googleSmtpConfigured, sendViaGoogleSmtp } = await import("@/lib/google-smtp");
      if (!viaBrevo && googleSmtpConfigured()) {
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
      console.error("[silvester/generate] Google-SMTP fehlgeschlagen, Fallback Brevo:", e?.message);
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
        console.error("[silvester/generate] Brevo error:", r.status, t);
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
              silvester_sent_at: new Date().toISOString(),
              silvester_angaben: { angst, lage, zuhause },
            },
          })
          .eq("id", leadId);
      } catch (e: any) {
        console.warn("[silvester/generate] Marker-Update fehlgeschlagen:", e?.message);
      }
    }

    const uebungen = content.sections.filter((x: any) => x?.key === "uebung").length;
    console.log(`[silvester] PDF an ${email} (${dogName}, ${uebungen} Uebungen, ${content.wochen.length} Wochen, via ${sentVia})`);
    return NextResponse.json({ ok: true, pdf_bytes: pdfBytes.length, uebungen, wochen: content.wochen.length, via: sentVia });
  } catch (err: any) {
    console.error("[silvester/generate] error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Interner Fehler" }, { status: 500 });
  }
}
