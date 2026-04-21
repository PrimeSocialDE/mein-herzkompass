// app/api/tagebuch/generate/route.ts
// Generiert personalisiertes Trainings-Tagebuch-PDF und verschickt es via Brevo.
// Wird aus dem Stripe-Webhook aufgerufen, wenn bumpId === "tagebuch".

import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { generateTagebuchPdf } from "@/lib/pdf/tagebuch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BREVO_API_KEY = process.env.BREVO_API_KEY;

// bumpDays (30/90/180) → Wochenzahl für PDF (4/12/24)
function daysToWeeks(days: number): number {
  if (days >= 180) return 24;
  if (days >= 90)  return 12;
  return 4;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let {
      email,
      dogName,
      leadId,
      bumpDays,
      dogBreed,
      dogAge,
      mainProblem,
    }: {
      email?: string;
      dogName?: string;
      leadId?: string;
      bumpDays?: number | string;
      dogBreed?: string;
      dogAge?: string;
      mainProblem?: string;
    } = body;

    // Fallback: fehlende Parameter aus wauwerk_leads.answers laden
    if (leadId) {
      try {
        const { data: lead } = await supabase
          .from("wauwerk_leads")
          .select("email, dog_name, answers")
          .eq("id", leadId)
          .single();
        if (lead) {
          email    = email    || lead.email       || "";
          dogName  = dogName  || lead.dog_name    || "";
          const a = (lead.answers || {}) as Record<string, any>;
          dogBreed    = dogBreed    || a.dog_breed           || "";
          dogAge      = dogAge      || a.dog_age             || "";
          mainProblem = mainProblem || a.custom_problem_text || a.dog_problem || "";
        }
      } catch (e) {
        console.error("Tagebuch: Lead-Lookup fehlgeschlagen:", e);
      }
    }

    if (!email) {
      return NextResponse.json({ error: "Email fehlt" }, { status: 400 });
    }
    if (!BREVO_API_KEY) {
      return NextResponse.json({ error: "Brevo nicht konfiguriert" }, { status: 500 });
    }

    const name = (dogName || "deinen Hund").trim();
    const days = Number(bumpDays) > 0 ? Number(bumpDays) : 30;
    const weeks = daysToWeeks(days);

    // PDF generieren
    const pdfBytes = await generateTagebuchPdf({
      dogName: name,
      dogBreed: dogBreed || "",
      dogAge: dogAge || "",
      mainProblem: mainProblem || "",
      weeks,
    });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    const periodLabel = weeks === 4 ? "4-Wochen" : weeks === 12 ? "3-Monats" : weeks === 24 ? "6-Monats" : `${weeks}-Wochen`;

    // Per Brevo senden
    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
        to: [{ email }],
        cc: [{ email: "kontakt@primesocial.de" }],
        subject: `Dein ${periodLabel}-Trainings-Tagebuch für ${name}`,
        htmlContent: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;padding:20px;color:#1a1a1a;">
            <div style="text-align:center;margin-bottom:24px;">
              <h1 style="font-size:24px;margin:0 0 8px;">Dein Trainings-Tagebuch für ${name}!</h1>
              <p style="font-size:15px;color:#666;margin:0;">${weeks} Wochen Fortschritts-Tracking zum Ausdrucken — jeden Tag 2 Minuten, am Ende siehst du schwarz auf weiß, was sich bewegt hat.</p>
            </div>

            <div style="background:#F0FDF4;border-radius:10px;padding:14px 16px;margin-bottom:20px;text-align:center;">
              <p style="font-size:14px;color:#166534;font-weight:600;margin:0;">PDF ist als Anhang beigefügt</p>
            </div>

            <div style="background:#FAFAFA;border-radius:10px;padding:16px;margin-bottom:20px;">
              <p style="font-size:14px;color:#555;margin:0 0 8px;"><strong>So nutzt du's mit ${name}:</strong></p>
              <p style="font-size:13px;color:#666;margin:0 0 4px;">1. PDF ausdrucken (am besten gelocht, in einen Ordner)</p>
              <p style="font-size:13px;color:#666;margin:0 0 4px;">2. Tag 1: Baseline ausfüllen (Seite 3) — das ist dein Startpunkt</p>
              <p style="font-size:13px;color:#666;margin:0 0 4px;">3. Täglich 2 Minuten: Haken, Beobachtung, weiter</p>
              <p style="font-size:13px;color:#666;margin:0;">4. Am Ende: Vergleichs-Tabelle auf der letzten Seite — der Aha-Moment.</p>
            </div>

            <p style="font-size:13px;color:#999;text-align:center;">
              Fragen? Schreib uns an <a href="mailto:support@pfoten-plan.de" style="color:#C4A576;">support@pfoten-plan.de</a><br>
              Liebe Grüße, dein Pfoten-Plan Team
            </p>
          </div>
        `,
        attachment: [
          {
            name: `Trainings-Tagebuch-${name.replace(/\s+/g, "-")}.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    if (!brevoRes.ok) {
      const errData = await brevoRes.text();
      console.error("Brevo error:", brevoRes.status, errData);
      return NextResponse.json(
        { error: "E-Mail konnte nicht gesendet werden" },
        { status: 500 }
      );
    }

    console.log(`📓 Tagebuch (${weeks}w) an ${email} gesendet`);
    return NextResponse.json({
      success: true,
      message: `Tagebuch an ${email} gesendet`,
      weeks,
    });
  } catch (err) {
    console.error("Tagebuch generate error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
