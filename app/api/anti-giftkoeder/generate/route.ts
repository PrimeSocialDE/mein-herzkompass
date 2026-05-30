// app/api/anti-giftkoeder/generate/route.ts
//
// Generiert den 12-seitigen Anti-Giftkoeder-Trainingsplan PDF dynamisch
// (Hundename, Rasse, Alter, rasse-spezifischer Tipp) und schickt ihn als
// Anhang per Brevo-Mail an die uebergebene Email.
//
// Body:
//   {
//     "email":   "kunde@example.com",
//     "dogName": "Bruno",
//     "breed":   "Deutscher Schäferhund",
//     "age":     "young"            // puppy|young|adult|senior
//   }
//
// Auth: keine — Endpoint wird vom Order-Bump-Flow / Webhook getriggert.
//       Vor Production: Bearer-Token oder Internal-only.

import { NextResponse } from "next/server";
import { generateAntiGiftkoederPDF } from "@/lib/anti-giftkoeder-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BREVO_API_KEY = process.env.BREVO_API_KEY!;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, dogName, breed, age } = body || {};

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email fehlt" }, { status: 400 });
    }

    const name = (dogName || "deinen Hund").toString();
    const breedStr = (breed || "Mischling").toString();
    const ageStr = (age || "adult").toString();

    // PDF generieren
    const pdfBytes = await generateAntiGiftkoederPDF({
      dogName: name,
      breed: breedStr,
      age: ageStr,
    });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    // Brevo-Mail mit PDF-Anhang
    if (!BREVO_API_KEY) {
      return NextResponse.json(
        { error: "BREVO_API_KEY nicht gesetzt" },
        { status: 500 }
      );
    }
    const fileName = `Anti-Giftkoeder-Plan-${name.replace(/\s+/g, "-")}.pdf`;
    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
        to: [{ email }],
        cc: [{ email: "kontakt@primesocial.de" }],
        subject: `Dein Anti-Giftköder-Trainingsplan für ${name}`,
        htmlContent: htmlBody(name, breedStr),
        attachment: [{ name: fileName, content: pdfBase64 }],
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

    console.log(`Anti-Giftkoeder-Plan an ${email} gesendet (${name}, ${breedStr})`);
    return NextResponse.json({
      ok: true,
      message: `Plan an ${email} gesendet`,
      pdf_bytes: pdfBytes.length,
    });
  } catch (err: any) {
    console.error("anti-giftkoeder generate error:", err);
    return NextResponse.json(
      { error: err?.message || "Interner Fehler" },
      { status: 500 }
    );
  }
}

function htmlBody(dogName: string, breed: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="font-size:24px;margin:0 0 8px;">Dein Anti-Giftköder-Plan für ${dogName}</h1>
        <p style="font-size:15px;color:#666;margin:0;">4-Wochen-Trainingsplan · auf ${breed} abgestimmt</p>
      </div>

      <div style="background:#FAF8F5;border:1px solid #E8DCC8;border-radius:10px;padding:16px 18px;margin-bottom:20px;">
        <p style="font-size:14px;color:#8B7355;font-weight:700;margin:0 0 6px;">PDF im Anhang</p>
        <p style="font-size:13px;color:#666;margin:0;line-height:1.55;">12 Seiten Schritt-für-Schritt — vom „Aus"-Signal bis zum Freilauf ohne Sorge. Druck es aus oder lass es auf dem Handy.</p>
      </div>

      <div style="background:#FAFAFA;border-radius:10px;padding:16px;margin-bottom:20px;">
        <p style="font-size:14px;color:#333;margin:0 0 8px;font-weight:600;">So gehst du vor:</p>
        <p style="font-size:13px;color:#666;margin:0 0 4px;">1. Druck den Plan einmal aus oder speicher ihn aufs Handy</p>
        <p style="font-size:13px;color:#666;margin:0 0 4px;">2. Starte mit Seite 3 — das „Aus"-Signal ist die Basis</p>
        <p style="font-size:13px;color:#666;margin:0 0 4px;">3. 5–10 Min täglich reichen — Konsequenz ist wichtiger als Dauer</p>
        <p style="font-size:13px;color:#666;margin:0;">4. Trag deine Erfolgsrate in den 4-Wochen-Tracker auf Seite 12 ein</p>
      </div>

      <p style="font-size:11px;color:#999;line-height:1.6;background:#FFF8E8;padding:10px 12px;border-radius:6px;border-left:3px solid #C4A576;margin-bottom:20px;">
        <strong>Wichtig:</strong> Dieses Modul trainiert präventives Verhalten und ersetzt keinen Tierarzt. Bei Verdacht auf Vergiftung sofort Tierarzt kontaktieren.
      </p>

      <p style="font-size:13px;color:#999;text-align:center;">
        Fragen? Schreib uns an <a href="mailto:support@pfoten-plan.de" style="color:#C4A576;">support@pfoten-plan.de</a><br>
        Liebe Grüße, dein Pfoten-Plan Team
      </p>
    </div>
  `;
}
