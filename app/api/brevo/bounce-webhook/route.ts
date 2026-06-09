// Brevo-Webhook fuer Zustell-Probleme (Echtzeit-Alarm).
//
// Brevo POSTet hierher, sobald eine Mail NICHT zugestellt werden konnte.
// Wir benachrichtigen dann sofort kontakt@primesocial.de mit der betroffenen
// Adresse + Grund, damit die Mail manuell rausgeschickt / der Kunde
// kontaktiert werden kann.
//
// Wichtig: Wir ueberwachen hard_bounce UND blocked (+ invalid_email). Der
// Fall v.steinfort@gmx.de war "blocked", NICHT hard_bounce — ein reiner
// Hard-Bounce-Alarm haette ihn verpasst.
//
// SETUP im Brevo-Dashboard (einmalig):
//   Settings → Webhooks → "Add a new webhook"
//   - URL:  https://www.pfoten-plan.de/api/brevo/bounce-webhook?secret=pfoten-cron-2024
//   - Events ankreuzen: "Hard bounce", "Blocked", "Invalid email"
//   (Transaktional; fuer Marketing-Mails ggf. zweiten Webhook gleicher URL anlegen.)
//
// Security: ?secret=... muss gegen BREVO_WEBHOOK_SECRET (Fallback CRON_SECRET,
// Fallback "pfoten-cron-2024") matchen.

import { NextRequest, NextResponse } from "next/server";
import { sendBrevoMail } from "@/lib/member-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET =
  process.env.BREVO_WEBHOOK_SECRET ||
  process.env.CRON_SECRET ||
  "pfoten-cron-2024";

const NOTIFY_TO = "kontakt@primesocial.de";

// Nur diese Events loesen einen Alarm aus (Zustellung fehlgeschlagen).
// soft_bounce ist transient (Mailbox voll o.ae.) und absichtlich NICHT dabei.
const ALERT_EVENTS = new Set(["hard_bounce", "blocked", "invalid_email"]);

const EVENT_LABEL: Record<string, string> = {
  hard_bounce: "Hard Bounce (Adresse existiert nicht / dauerhaft abgewiesen)",
  blocked: "Blocked (Brevo hat den Versand vorab geblockt)",
  invalid_email: "Invalid Email (ungueltige Adresse)",
};

interface BrevoEvent {
  event?: string;
  email?: string;
  subject?: string;
  reason?: string;
  tag?: string;
  tags?: string[];
  date?: string;
  ts?: number;
  "message-id"?: string;
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function extractEvents(body: any): BrevoEvent[] {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.items)) return body.items;
  if (body && Array.isArray(body.events)) return body.events;
  if (body && typeof body === "object") return [body];
  return [];
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, note: "no-json" });
  }

  const events = extractEvents(body);
  // Dedupe innerhalb eines Requests (email+event), falls Brevo Wiederholungen schickt.
  const seen = new Set<string>();
  let alerted = 0;

  for (const ev of events) {
    const type = String(ev.event || "").toLowerCase();
    if (!ALERT_EVENTS.has(type)) continue;
    const email = String(ev.email || "").toLowerCase();
    if (!email) continue;
    const key = `${type}|${email}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const tag = ev.tag || (Array.isArray(ev.tags) ? ev.tags.join(", ") : "");
    const when = ev.date || (ev.ts ? new Date(ev.ts * 1000).toISOString() : "");

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:15px;color:#2C2C2E;line-height:1.6">
        <h2 style="color:#C4A576;margin:0 0 12px">⚠️ E-Mail nicht zugestellt</h2>
        <p>Eine E-Mail konnte <strong>nicht zugestellt</strong> werden. Bitte ggf. manuell erneut senden oder die Adresse prüfen:</p>
        <table style="border-collapse:collapse;margin:12px 0">
          <tr><td style="padding:4px 12px 4px 0;color:#6B6B6B">Adresse</td><td style="padding:4px 0"><strong>${esc(email)}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6B6B6B">Grund</td><td style="padding:4px 0">${esc(EVENT_LABEL[type] || type)}</td></tr>
          ${ev.reason ? `<tr><td style="padding:4px 12px 4px 0;color:#6B6B6B">Detail</td><td style="padding:4px 0">${esc(ev.reason)}</td></tr>` : ""}
          ${ev.subject ? `<tr><td style="padding:4px 12px 4px 0;color:#6B6B6B">Betreff</td><td style="padding:4px 0">${esc(ev.subject)}</td></tr>` : ""}
          ${tag ? `<tr><td style="padding:4px 12px 4px 0;color:#6B6B6B">Tag</td><td style="padding:4px 0">${esc(tag)}</td></tr>` : ""}
          ${when ? `<tr><td style="padding:4px 12px 4px 0;color:#6B6B6B">Zeit</td><td style="padding:4px 0">${esc(when)}</td></tr>` : ""}
        </table>
      </div>`;

    await sendBrevoMail({
      to: NOTIFY_TO,
      subject: `⚠️ Zustell-Problem: ${email} (${type})`,
      html,
      tags: ["intern", "bounce-alert"],
    });
    alerted++;
  }

  // Immer 200, damit Brevo den Webhook nicht wegen Fehlern deaktiviert.
  return NextResponse.json({ ok: true, received: events.length, alerted });
}

// Brevo verifiziert beim Einrichten teils per GET — freundlich antworten.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "brevo-bounce-webhook" });
}
