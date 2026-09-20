// app/api/charakterprofil/generate/route.ts
//
// Erzeugt das Produkt-PDF "Charakterprofil" (rasse-zentriert, mit Uebungen)
// und schickt es per Mail (Google Workspace SMTP, Brevo als Fallback).
// Wird vom Mollie-Webhook nach dem Kauf getriggert.
//
// Body: {
//   leadId?, email, dogName?, breed?, mischRassen?: string[], rasseUnbekannt?: boolean,
//   age?, gender?, problem?, behaviors?: string[], force?: boolean
// }
// Auth: Bearer WORKER_TOKEN

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/db";
import { buildCharakterprofilPDF, type CharakterprofilContent } from "@/lib/charakterprofil-pdf";
import { systemPrompt, datenBlock, parseContent, istMischling } from "@/lib/charakterprofil-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const WORKER_TOKEN = (process.env.WORKER_TOKEN || "").trim();

function htmlBody(dogName: string, breedLabel: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
    <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:14px;padding:24px">
      <h1 style="font-size:22px;margin:0 0 6px;color:#1a1a1a">${dogName}s Charakterprofil ist fertig</h1>
      <p style="font-size:15px;color:#666;margin:0">${breedLabel}</p>
      <p style="font-size:14px;color:#444;margin:16px 0 0;line-height:1.6">Im Anhang findest du das komplette Profil als PDF: wofür ${dogName} gezüchtet wurde, wie viel Bewegung und Schlaf er wirklich braucht, welche Kopfarbeit passt und was du ihm besser ersparst.</p>
      <p style="font-size:14px;color:#444;margin:12px 0 0;line-height:1.6">Dazu vier Übungen mit Schritt-für-Schritt-Anleitung und ein 7-Tage-Start. Fang mit einer einzigen Übung an, nicht mit allen.</p>
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
    if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY fehlt" }, { status: 500 });

    const body = await request.json();
    const leadId = String(body?.leadId || "").trim();
    const force = body?.force === true;

    let email = String(body?.email || "").trim();
    let dogName = String(body?.dogName || "").slice(0, 40);
    let breed = String(body?.breed || "").slice(0, 60);
    let mischRassen: string[] = Array.isArray(body?.mischRassen)
      ? body.mischRassen.slice(0, 3).map((r: any) => String(r).slice(0, 60))
      : [];
    let age = String(body?.age || "");
    let gender = String(body?.gender || "");
    let problem = String(body?.problem || "");
    let behaviors: string[] = Array.isArray(body?.behaviors) ? body.behaviors.slice(0, 8).map((b: any) => String(b)) : [];
    const rasseUnbekannt = body?.rasseUnbekannt === true;

    // ── Lead nachladen (Fragebogen-Daten) ─────────────────────────────
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
        age = age || String(a.dog_age || "");
        gender = gender || String(a.dog_gender || "");
        problem = problem || String(a.dog_problem || "");
        if (!behaviors.length && Array.isArray(a.dog_behaviors)) behaviors = a.dog_behaviors.slice(0, 8).map((b: any) => String(b));
        if (!mischRassen.length && Array.isArray(a.charakterprofil_misch)) mischRassen = a.charakterprofil_misch.slice(0, 3).map((r: any) => String(r));
        if (a.charakterprofil_sent_at && !force) {
          return NextResponse.json({ ok: true, skipped: "already_sent", sent_at: a.charakterprofil_sent_at });
        }
      }
    }
    if (!email) return NextResponse.json({ error: "email fehlt" }, { status: 400 });
    dogName = dogName || "dein Hund";

    const istMisch = istMischling(breed, rasseUnbekannt);
    const breedLabel = mischRassen.length
      ? `Mischling (${mischRassen.join(", ")})`
      : istMisch ? "Mischling" : breed;

    // ── KI-Content ────────────────────────────────────────────────────
    const profil = {
      dogName, breed: istMisch ? "Mischling" : breed, mischRassen, istMisch,
      age, gender, problem, behaviors, goal: leadAnswers?.dog_goal ? String(leadAnswers.dog_goal) : undefined,
    };
    const system = systemPrompt(profil);
    const daten = datenBlock(profil);

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: [{ type: "text", text: `Daten:\n${daten}` }] }],
    });
    const raw = resp.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();

    let content: CharakterprofilContent;
    try {
      content = parseContent(raw);
    } catch (e: any) {
      console.error("[charakterprofil/generate] JSON parse failed:", e?.message);
      return NextResponse.json({ error: "content_generation_failed" }, { status: 500 });
    }

    // ── PDF ───────────────────────────────────────────────────────────
    const pdfBytes = await buildCharakterprofilPDF({
      dogName, breed: istMisch ? "Mischling" : breed, mischRassen, age, gender, content,
    });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
    const fileName = `Charakterprofil-${dogName.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "") || "Hund"}.pdf`;
    const subject = `${dogName}s Charakterprofil ist fertig`;
    const html = htmlBody(dogName, breedLabel);

    // ── Versand: Google SMTP primaer, Brevo als Fallback ──────────────
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
      console.error("[charakterprofil/generate] Google-SMTP fehlgeschlagen, Fallback Brevo:", e?.message);
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
        console.error("[charakterprofil/generate] Brevo error:", r.status, t);
        return NextResponse.json({ error: "mail_failed", detail: t.slice(0, 200) }, { status: 502 });
      }
      sentVia = "brevo";
    }

    // ── Idempotenz-Marker (frisch lesen und mergen) ───────────────────
    if (leadId) {
      try {
        const { data: fresh } = await supabase.from("wauwerk_leads").select("answers").eq("id", leadId).maybeSingle();
        await supabase.from("wauwerk_leads").update({
          answers: {
            ...(((fresh?.answers as any) || leadAnswers) || {}),
            charakterprofil_sent_at: new Date().toISOString(),
            ...(mischRassen.length ? { charakterprofil_misch: mischRassen } : {}),
          },
        }).eq("id", leadId);
      } catch (e: any) {
        console.warn("[charakterprofil/generate] Marker-Update fehlgeschlagen:", e?.message);
      }
    }

    console.log(`[charakterprofil] PDF an ${email} (${dogName}, ${breedLabel}, via ${sentVia})`);
    return NextResponse.json({ ok: true, pdf_bytes: pdfBytes.length, via: sentVia });
  } catch (err: any) {
    console.error("[charakterprofil/generate] error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Interner Fehler" }, { status: 500 });
  }
}
