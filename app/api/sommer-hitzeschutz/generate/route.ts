// app/api/sommer-hitzeschutz/generate/route.ts
//
// Generiert den 18-seitigen Sommer-Sicherheits-Plan (Hitzeschutz) PDF
// dynamisch (Hundename, Rasse, Alter) und schickt ihn als Anhang per
// Brevo-Mail. Wird vom Order-Bump-Flow / Webhook getriggert.
//
// Body: { "email", "dogName", "breed", "age" (puppy|young|adult|senior) }

import { NextResponse } from "next/server";
import { buildSommerHitzeschutzPDF } from "@/lib/sommer-hitzeschutz-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BREVO_API_KEY = process.env.BREVO_API_KEY!;

function htmlBody(dogName: string, breed: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
    <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:14px;padding:24px">
      <h1 style="font-size:22px;margin:0 0 6px;color:#1a1a1a">Dein Sommer-Sicherheits-Plan für ${dogName}</h1>
      <p style="font-size:15px;color:#666;margin:0">18 Seiten · auf ${breed} abgestimmt</p>
      <p style="font-size:13px;color:#666;margin:14px 0 0;line-height:1.55">So schützt du ${dogName} durch den ganzen Sommer: Hitze-Ampel (was bei welcher Temperatur), Hitzschlag erkennen & Erste Hilfe, heißer Asphalt, Abkühl-Rezepte zum Nachmachen, Wochenplan, Reise-Packliste und eine Notfall-Karte zum Ausschneiden. Im Anhang als PDF - druck es aus oder hab es auf dem Handy dabei.</p>
    </div>
  </div>`;
}

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

    const pdfBytes = await buildSommerHitzeschutzPDF({
      dogName: name,
      breed: breedStr,
      age: ageStr,
    });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    if (!BREVO_API_KEY) {
      return NextResponse.json({ error: "BREVO_API_KEY nicht gesetzt" }, { status: 500 });
    }
    const fileName = `Sommer-Sicherheits-Plan-${name.replace(/\s+/g, "-")}.pdf`;
    const shSubject = `Dein Sommer-Sicherheits-Plan für ${name}`;
    const shHtml = htmlBody(name, breedStr);

    // Bezahlte Auslieferung: primär über Google Workspace SMTP, Brevo Fallback.
    try {
      const { googleSmtpConfigured, sendViaGoogleSmtp } = await import(
        "@/lib/google-smtp"
      );
      if (googleSmtpConfigured()) {
        await sendViaGoogleSmtp({
          to: email,
          subject: shSubject,
          html: shHtml,
          cc: "kontakt@primesocial.de",
          attachments: [{ name: fileName, contentBase64: pdfBase64 }],
        });
        console.log(`Sommer-Sicherheits-Plan via Google an ${email} (${name})`);
        return NextResponse.json({
          ok: true,
          message: `Plan an ${email} gesendet`,
          pdf_bytes: pdfBytes.length,
          via: "google",
        });
      }
    } catch (e: any) {
      console.error(
        "[sommer-hitzeschutz] Google-SMTP fehlgeschlagen → Fallback Brevo:",
        e?.message
      );
    }

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
        to: [{ email }],
        cc: [{ email: "kontakt@primesocial.de" }],
        subject: `Dein Sommer-Sicherheits-Plan für ${name}`,
        htmlContent: htmlBody(name, breedStr),
        attachment: [{ name: fileName, content: pdfBase64 }],
      }),
    });

    if (!brevoRes.ok) {
      const errData = await brevoRes.text();
      console.error("Brevo error:", brevoRes.status, errData);
      return NextResponse.json({ error: "E-Mail konnte nicht gesendet werden" }, { status: 500 });
    }

    console.log(`Sommer-Sicherheits-Plan an ${email} gesendet (${name}, ${breedStr})`);
    return NextResponse.json({ ok: true, message: `Plan an ${email} gesendet`, pdf_bytes: pdfBytes.length });
  } catch (err: any) {
    console.error("sommer-hitzeschutz generate error:", err);
    return NextResponse.json({ error: err?.message || "Interner Fehler" }, { status: 500 });
  }
}
