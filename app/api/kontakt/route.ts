// app/api/kontakt/route.ts
// Nimmt das Kontaktformular von /kontakt.html entgegen und schickt die Nachricht
// per Brevo an support@pfoten-plan.de. Reply-To = Absender, damit direkt
// geantwortet werden kann. Honeypot-Feld ("website") gegen Bots.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const SUPPORT = "support@pfoten-plan.de";
const esc = (s: any) =>
  String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Honeypot: echte Nutzer füllen dieses Feld nie aus -> stiller Erfolg für Bots
    if (body?.website) return NextResponse.json({ ok: true });

    const name = String(body?.name || "").trim().slice(0, 120);
    const email = String(body?.email || "").trim().slice(0, 160);
    const message = String(body?.message || "").trim().slice(0, 5000);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Bitte gib eine gültige E-Mail-Adresse an." }, { status: 400 });
    }
    if (message.length < 5) {
      return NextResponse.json({ error: "Bitte schreib uns kurz, worum es geht." }, { status: 400 });
    }
    if (!BREVO_API_KEY) {
      console.error("[kontakt] BREVO_API_KEY fehlt");
      return NextResponse.json({ error: "Versand momentan nicht möglich." }, { status: 500 });
    }

    const html = `<div style="font-family:Arial,sans-serif;max-width:640px;color:#1a1a1a">
      <h2 style="margin:0 0 12px">Neue Nachricht über das Kontaktformular</h2>
      <p style="margin:0 0 4px"><b>Name:</b> ${esc(name) || "—"}</p>
      <p style="margin:0 0 4px"><b>E-Mail:</b> ${esc(email)}</p>
      <p style="margin:14px 0 4px"><b>Nachricht:</b></p>
      <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:10px;padding:12px;white-space:pre-wrap">${esc(message)}</div>
      <p style="font-size:12px;color:#888;margin-top:16px">Antworten geht direkt per Reply an diese Mail (Reply-To ist die Absender-Adresse).</p>
    </div>`;

    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Pfoten-Plan Kontaktformular", email: SUPPORT },
        to: [{ email: SUPPORT }],
        replyTo: { email, name: name || email },
        subject: `Kontaktformular: ${name || email}`,
        htmlContent: html,
      }),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("[kontakt] Brevo error:", r.status, t.slice(0, 200));
      return NextResponse.json({ error: "Versand fehlgeschlagen. Bitte schreib uns direkt an support@pfoten-plan.de." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[kontakt] error:", err?.message || err);
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 });
  }
}
