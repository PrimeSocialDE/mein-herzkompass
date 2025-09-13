// lib/mailer.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);
const fromAddress = process.env.RESEND_FROM || "Clara <clara@mein-herzkompass.de>";

export async function sendAnalysisMail(
  to: string,
  name: string,
  orderId: string,
  pdfBytes?: Uint8Array,
  downloadUrl?: string
) {
  if (!to) throw new Error("sendAnalysisMail: 'to' fehlt");

  const subject = `Deine persönliche Dating-Analyse (#${orderId.slice(0, 8)})`;

  // <<< HIER: PDF in Base64 umwandeln >>>
  const attachments =
    pdfBytes && pdfBytes.byteLength > 0
      ? [
          {
            filename: `Analyse-${orderId}.pdf`,
            content: Buffer.from(pdfBytes).toString("base64"), // Base64-String
          },
        ]
      : undefined; // statt [] besser undefined, passt zum Typ

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px;">Hallo ${name || "du"},</h2>
      <p>deine persönliche Dating-Analyse ist fertig.</p>
      ${
        downloadUrl
          ? `<p>Optionaler Download-Link:<br><a href="${downloadUrl}" target="_blank" style="color:#4f46e5;">Analyse herunterladen</a></p>`
          : `<p>Die PDF ist als Anhang beigefügt.</p>`
      }
      <p style="margin-top:24px;font-size:13px;color:#555;">
        Bestell-ID: ${orderId}<br/>
        Liebe Grüße<br/>Clara – Herzkompass
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    html,
    attachments, // jetzt korrekt typisiert
  });

  if (error) {
    throw new Error(`Resend send error: ${error.message || String(error)}`);
  }
}