// app/api/notfall-karten/generate/route.ts
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const BREVO_API_KEY = process.env.BREVO_API_KEY!;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, dogName } = body;

    if (!email) {
      return NextResponse.json({ error: "Email fehlt" }, { status: 400 });
    }

    const name = dogName || "deinen Hund";

    // Statische PDF lesen
    const pdfPath = join(process.cwd(), "public", "notfall-karten.pdf");
    const pdfBuffer = readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString("base64");

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
        subject: `Hier sind deine 10 Notfall-Karten für ${name}`,
        htmlContent: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;padding:20px;color:#1a1a1a;">
            <div style="text-align:center;margin-bottom:24px;">
              <h1 style="font-size:24px;margin:0 0 8px;">Hier sind deine Notfall-Karten für ${name}!</h1>
              <p style="font-size:15px;color:#666;margin:0;">10 Sofort-Hilfen für typische Problemsituationen – zum Ausdrucken oder aufs Handy speichern</p>
            </div>

            <div style="background:#F0FDF4;border-radius:10px;padding:14px 16px;margin-bottom:20px;text-align:center;">
              <p style="font-size:14px;color:#166534;font-weight:600;margin:0;">PDF ist als Anhang beigefügt</p>
            </div>

            <div style="background:#FAFAFA;border-radius:10px;padding:16px;margin-bottom:20px;">
              <p style="font-size:14px;color:#555;margin:0 0 8px;"><strong>So nutzt du die Karten für ${name}:</strong></p>
              <p style="font-size:13px;color:#666;margin:0 0 4px;">1. PDF ausdrucken oder auf dem Handy speichern</p>
              <p style="font-size:13px;color:#666;margin:0 0 4px;">2. In der Notfall-Situation die passende Karte raussuchen</p>
              <p style="font-size:13px;color:#666;margin:0;">3. Die 5 Schritte der Reihe nach durchgehen</p>
            </div>

            <p style="font-size:13px;color:#999;text-align:center;">
              Fragen? Schreib uns an <a href="mailto:support@pfoten-plan.de" style="color:#C4A576;">support@pfoten-plan.de</a><br>
              Liebe Grüße, dein Pfoten-Plan Team
            </p>
          </div>
        `,
        attachment: [
          {
            name: `Notfall-Karten-${name.replace(/\s+/g, "-")}.pdf`,
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

    console.log(`Notfall-Karten an ${email} gesendet`);
    return NextResponse.json({
      success: true,
      message: `Notfall-Karten an ${email} gesendet`,
    });
  } catch (err) {
    console.error("Notfall-Karten generate error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
