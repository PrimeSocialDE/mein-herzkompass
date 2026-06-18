// Widerruf-Button (gesetzlich vorgeschrieben ab 19.06.2026).
// Nimmt die Widerrufserklärung aus dem Formular auf widerruf-button.html
// entgegen, benachrichtigt kontakt@primesocial.de und schickt dem Kunden
// eine Eingangsbestätigung (gesetzlich: Bestätigung des Eingangs auf einem
// dauerhaften Datenträger).
//
// DSGVO: Es werden nur die freiwillig angegebenen Felder verarbeitet
// (Name, E-Mail, Bestellnummer, optionale Nachricht). Keine Speicherung in
// einer DB — die Benachrichtigung an kontakt@primesocial.de ist der Beleg.

import { NextRequest, NextResponse } from "next/server";
import { sendBrevoMail } from "@/lib/member-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = (body?.name ?? "").toString().trim().slice(0, 200);
  const email = (body?.email ?? "").toString().trim().slice(0, 200);
  const bestellnummer = (body?.bestellnummer ?? "").toString().trim().slice(0, 120);
  const nachricht = (body?.nachricht ?? "").toString().trim().slice(0, 2000);

  if (!name) {
    return NextResponse.json({ error: "name_fehlt" }, { status: 400 });
  }
  if (!email || !isEmail(email)) {
    return NextResponse.json({ error: "email_ungueltig" }, { status: 400 });
  }

  // Zeitpunkt des Widerrufs festhalten (Berlin/MEZ für die interne Mail).
  const now = new Date();
  const eingang = now.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "full",
    timeStyle: "short",
  });

  // 1) Interne Benachrichtigung an kontakt@primesocial.de (= Beleg)
  const internHtml = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#2C2C2E;line-height:1.6">
      <h2 style="color:#C4361A;margin:0 0 12px">🔴 Neuer Widerruf eingegangen</h2>
      <p>Über den gesetzlichen Widerrufs-Button auf der Website wurde ein Widerruf erklärt.</p>
      <table style="border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:4px 14px 4px 0;color:#6B6B6B">Name</td><td><strong>${esc(name)}</strong></td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#6B6B6B">E-Mail</td><td><strong>${esc(email)}</strong></td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#6B6B6B">Bestellnummer</td><td>${esc(bestellnummer) || "—"}</td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#6B6B6B;vertical-align:top">Nachricht</td><td>${esc(nachricht) || "—"}</td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#6B6B6B">Eingang</td><td>${esc(eingang)}</td></tr>
      </table>
      <p style="font-size:13px;color:#6B6B6B">Rückzahlung binnen 14 Tagen ab Eingang veranlassen.</p>
    </div>`;

  let internOk = false;
  try {
    const res = await sendBrevoMail({
      to: "kontakt@primesocial.de",
      subject: `🔴 Widerruf: ${name}${bestellnummer ? ` (${bestellnummer})` : ""}`,
      html: internHtml,
      tags: ["intern", "widerruf"],
    });
    internOk = !!res?.ok;
  } catch (e: any) {
    console.error("[widerruf] intern-Mail failed:", e?.message);
  }

  // Die interne Benachrichtigung ist gesetzlich der entscheidende Teil.
  // Schlägt sie fehl, melden wir Fehler zurück, damit nichts verloren geht.
  if (!internOk) {
    return NextResponse.json({ error: "mail_failed" }, { status: 502 });
  }

  // 2) Eingangsbestätigung an den Kunden (gesetzlich vorgeschrieben:
  //    Bestätigung des Eingangs des Widerrufs). Best-effort.
  const kundeHtml = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#2C2C2E;line-height:1.6">
      <h2 style="color:#8B7355;margin:0 0 12px">Dein Widerruf ist bei uns eingegangen</h2>
      <p>Hallo ${esc(name)},</p>
      <p>hiermit bestätigen wir den Eingang deines Widerrufs vom <strong>${esc(eingang)}</strong>.</p>
      <table style="border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:4px 14px 4px 0;color:#6B6B6B">Name</td><td>${esc(name)}</td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#6B6B6B">E-Mail</td><td>${esc(email)}</td></tr>
        ${bestellnummer ? `<tr><td style="padding:4px 14px 4px 0;color:#6B6B6B">Bestellnummer</td><td>${esc(bestellnummer)}</td></tr>` : ""}
      </table>
      <p>Wir erstatten dir den Kaufpreis innerhalb von 14 Tagen auf dem ursprünglichen Zahlungsweg zurück. Du musst nichts weiter tun.</p>
      <p>Bei Fragen erreichst du uns unter <a href="mailto:support@pfoten-plan.de">support@pfoten-plan.de</a>.</p>
      <p style="margin-top:16px">Liebe Grüße<br>Dein Pfoten-Plan-Team</p>
    </div>`;

  try {
    await sendBrevoMail({
      to: email,
      subject: "Bestätigung deines Widerrufs – Pfoten-Plan",
      html: kundeHtml,
      tags: ["widerruf", "eingangsbestaetigung"],
    });
  } catch (e: any) {
    console.error("[widerruf] kunde-Mail failed:", e?.message);
  }

  return NextResponse.json({ ok: true });
}
