// lib/mailer.ts
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendAnalysisMail(to: string, name: string, link: string, attach?: Uint8Array) {
  const attachments = attach
    ? [{ filename: "analyse.pdf", content: attach, contentType: "application/pdf" }]
    : undefined;

  await resend.emails.send({
    from: process.env.RESEND_FROM || "Clara <clara@mein-herzkompass.de>",
    to,
    subject: "Deine persönliche Analyse ist fertig",
    html: `
      <p>Hallo ${name},</p>
      <p>deine persönliche Analyse ist fertig. Du kannst sie hier herunterladen:</p>
      <p><a href="${link}">Analyse öffnen</a></p>
      <p>Liebe Grüße<br/>Clara</p>
    `,
    attachments,
  });
}