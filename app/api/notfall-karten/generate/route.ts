// app/api/notfall-karten/generate/route.ts
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const BREVO_API_KEY = process.env.BREVO_API_KEY!;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, dogName } = body;
    const isPL = body.lang === "pl";
    const isIt = body.lang === "it";

    if (!email) {
      return NextResponse.json({ error: "Email fehlt" }, { status: 400 });
    }

    const name = dogName || (isPL ? "Twojego psa" : isIt ? "il tuo cane" : "deinen Hund");

    // Statische PDF lesen (PL: polnische Karten, IT: italienische Karten).
    const pdfPath = join(
      process.cwd(),
      "public",
      isPL ? "notfall-karten-pl.pdf" : isIt ? "notfall-karten-it.pdf" : "notfall-karten.pdf"
    );
    const pdfBuffer = readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString("base64");

    const nkSubject = isPL
      ? `Oto Twoje 10 kart ratunkowych dla ${name}`
      : isIt
      ? `Ecco le tue 10 schede di emergenza per ${name}`
      : `Hier sind deine 10 Notfall-Karten für ${name}`;
    const nkFile = isPL
      ? `Karty-ratunkowe-${name.replace(/\s+/g, "-")}.pdf`
      : isIt
      ? `Schede-emergenza-${name.replace(/\s+/g, "-")}.pdf`
      : `Notfall-Karten-${name.replace(/\s+/g, "-")}.pdf`;

    // PL-Auslieferung: ueber Brevo mit pomoc@lapaplan.pl (PL-Mails bleiben auf Brevo).
    if (isPL) {
      const nkHtmlPL = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;padding:20px;color:#1a1a1a;">
            <div style="text-align:center;margin-bottom:24px;">
              <h1 style="font-size:24px;margin:0 0 8px;">Oto Twoje karty ratunkowe dla ${name}!</h1>
              <p style="font-size:15px;color:#666;margin:0;">10 gotowych rozwiązań na typowe trudne sytuacje z psem, do wydrukowania lub zapisania w telefonie</p>
            </div>
            <div style="background:#F0FDF4;border-radius:10px;padding:14px 16px;margin-bottom:20px;text-align:center;">
              <p style="font-size:14px;color:#166534;font-weight:600;margin:0;">PDF znajdziesz w załączniku</p>
            </div>
            <div style="background:#FAFAFA;border-radius:10px;padding:16px;margin-bottom:20px;">
              <p style="font-size:14px;color:#555;margin:0 0 8px;"><strong>Jak korzystać z kart dla ${name}:</strong></p>
              <p style="font-size:13px;color:#666;margin:0 0 4px;">1. Wydrukuj PDF lub zapisz go w telefonie</p>
              <p style="font-size:13px;color:#666;margin:0 0 4px;">2. W trudnej sytuacji wybierz odpowiednią kartę</p>
              <p style="font-size:13px;color:#666;margin:0;">3. Przejdź po kolei przez 5 kroków</p>
            </div>
            <p style="font-size:13px;color:#999;text-align:center;">
              Masz pytania? Napisz do nas na <a href="mailto:pomoc@lapaplan.pl" style="color:#C4A576;">pomoc@lapaplan.pl</a><br>
              Pozdrawiamy, zespół ŁapaPlan
            </p>
          </div>
        `;
      const brevoResPL = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "ŁapaPlan", email: "pomoc@lapaplan.pl" },
          to: [{ email }],
          cc: [{ email: "kontakt@primesocial.de" }],
          subject: nkSubject,
          htmlContent: nkHtmlPL,
          attachment: [{ name: nkFile, content: pdfBase64 }],
        }),
      });
      if (!brevoResPL.ok) {
        const errData = await brevoResPL.text();
        console.error("Brevo PL error:", brevoResPL.status, errData);
        return NextResponse.json(
          { error: "E-Mail konnte nicht gesendet werden" },
          { status: 500 }
        );
      }
      console.log(`Karty ratunkowe an ${email} gesendet (PL/Brevo)`);
      return NextResponse.json({
        success: true,
        message: `Karty ratunkowe an ${email} gesendet`,
        via: "brevo-pl",
      });
    }

    // Per Brevo senden
    const nkHtmlIT = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;padding:20px;color:#1a1a1a;">
            <div style="text-align:center;margin-bottom:24px;">
              <h1 style="font-size:24px;margin:0 0 8px;">Ecco le tue schede di emergenza per ${name}!</h1>
              <p style="font-size:15px;color:#666;margin:0;">10 aiuti immediati per le situazioni difficili più comuni con il cane, da stampare o salvare sul telefono</p>
            </div>
            <div style="background:#F0FDF4;border-radius:10px;padding:14px 16px;margin-bottom:20px;text-align:center;">
              <p style="font-size:14px;color:#166534;font-weight:600;margin:0;">Il PDF è in allegato</p>
            </div>
            <div style="background:#FAFAFA;border-radius:10px;padding:16px;margin-bottom:20px;">
              <p style="font-size:14px;color:#555;margin:0 0 8px;"><strong>Come usare le schede per ${name}:</strong></p>
              <p style="font-size:13px;color:#666;margin:0 0 4px;">1. Stampa il PDF o salvalo sul telefono</p>
              <p style="font-size:13px;color:#666;margin:0 0 4px;">2. Nella situazione critica scegli la scheda giusta</p>
              <p style="font-size:13px;color:#666;margin:0;">3. Segui i 5 passaggi nell'ordine</p>
            </div>
            <p style="font-size:13px;color:#999;text-align:center;">
              Domande? Scrivici a <a href="mailto:supporto@zampaplan.it" style="color:#C4A576;">supporto@zampaplan.it</a><br>
              Un caro saluto, il tuo team ZampaPlan
            </p>
          </div>
        `;
    const nkHtml = isIt ? nkHtmlIT : `
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
        `;

    // Bezahlte Auslieferung: primär über Google Workspace SMTP, Brevo Fallback.
    try {
      const { googleSmtpConfigured, sendViaGoogleSmtp } = await import(
        "@/lib/google-smtp"
      );
      if (googleSmtpConfigured()) {
        await sendViaGoogleSmtp({
          to: email,
          subject: nkSubject,
          html: nkHtml,
          fromName: isIt ? "ZampaPlan" : undefined,
          cc: "kontakt@primesocial.de",
          attachments: [{ name: nkFile, contentBase64: pdfBase64 }],
        });
        console.log(`Notfall-Karten via Google an ${email} gesendet`);
        return NextResponse.json({
          success: true,
          message: `Notfall-Karten an ${email} gesendet`,
          via: "google",
        });
      }
    } catch (e: any) {
      console.error(
        "[notfall-karten] Google-SMTP fehlgeschlagen → Fallback Brevo:",
        e?.message
      );
    }

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: isIt
          ? { name: "ZampaPlan", email: "support@pfoten-plan.de" }
          : { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
        to: [{ email }],
        cc: [{ email: "kontakt@primesocial.de" }],
        subject: nkSubject,
        htmlContent: nkHtml,
        attachment: [{ name: nkFile, content: pdfBase64 }],
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
