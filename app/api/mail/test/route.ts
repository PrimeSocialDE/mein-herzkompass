import { NextRequest } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return new Response("RESEND_API_KEY fehlt", { status: 500 });
    }

    const { to } = await req.json();
    if (!to) {
      return new Response(JSON.stringify({ error: "Bitte 'to' (E-Mail) angeben" }), { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: "Clara <onboarding@resend.dev>", // für Tests
      to,
      subject: "Testmail funktioniert ✅",
      html: `<p>Hallo ${to},<br>Dein Mailversand mit Resend klappt!</p>`,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e: any) {
    console.error("MAIL_TEST_ERROR:", e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || "Mail fehlgeschlagen" }), { status: 500 });
  }
}