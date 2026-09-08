// Upload-Strecke für die persönliche Verhaltens-/Video-Analyse (49,99 €).
//
// Ablauf:
//   1) Kunde kauft (1-Klick) → bekommt per Mail einen Link auf /analyse-upload?lead=<id>
//   2) Auf der Seite lädt er Video/Fotos hoch. Die Seite holt sich pro Datei eine
//      SIGNIERTE Upload-URL (action=sign) und lädt DIREKT in den Supabase-Storage
//      (Bucket "client-media") — so umgehen wir das Serverless-Body-Limit (große Videos).
//   3) Danach ruft die Seite action=notify → wir schicken dem Team (support@/kontakt@)
//      eine Mail mit Links zum Material + Beschreibung. Der Trainer schaut per Mail
//      drüber und antwortet dem Kunden.
//
// Speicher: Bucket "client-media" (privat). Pfad: analyse/<lead>/<timestamp>-<datei>.

import { NextRequest, NextResponse } from "next/server";
import { sendViaGoogleSmtp } from "@/lib/google-smtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SB_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE || "";
const BUCKET = "client-media";
const TEAM_TO = "support@pfoten-plan.de";
const TEAM_CC = "kontakt@primesocial.de";

function safeName(s: string): string {
  return (s || "datei")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(-80);
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const action = body?.action;
  // sign/notify brauchen Supabase-Storage; invite braucht nur SMTP.
  if (action !== "invite" && (!SB_URL || !SB_KEY)) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });
  }
  const lead = String(body?.lead || "unbekannt").replace(/[^\w-]/g, "").slice(0, 60) || "unbekannt";

  // 0) Nach dem Kauf: Kunde bekommt seinen persönlichen Upload-Link per Mail
  //    (kein Seitenwechsel beim Kauf — genau wie bei den Notfall-Karten).
  if (action === "invite") {
    const email = String(body?.email || "").slice(0, 120);
    const dog = String(body?.dog || "").slice(0, 60);
    if (!email) {
      return NextResponse.json({ error: "no_email" }, { status: 400 });
    }
    const base = process.env.SITE_URL || "https://www.pfoten-plan.de";
    const link = `${base}/analyse-upload.html?lead=${encodeURIComponent(lead)}&email=${encodeURIComponent(email)}&dog=${encodeURIComponent(dog)}`;
    const dogTxt = dog || "deinen Hund";
    const html = `<div style="font-family:Arial,sans-serif;font-size:16px;color:#2C2C2E;line-height:1.6;max-width:520px;margin:0 auto">
      <p style="font-size:20px;font-weight:800;color:#8B7355">🐾 Pfoten-Plan</p>
      <h2 style="font-size:22px;margin:0 0 12px">Deine persönliche Analyse für ${dogTxt}</h2>
      <p>vielen Dank! Deine persönliche Verhaltens-Analyse ist reserviert.</p>
      <p>So geht's weiter: Film in Ruhe eine typische Situation mit ${dogTxt} (z. B. an der Leine, beim Klingeln, bei Begegnungen) oder lade ein paar Fotos hoch. Unser Trainer schaut sich alles persönlich an, erklärt dir genau warum ${dogTxt} sich so verhält, und gibt dir spezielle Übungen, exakt auf ${dogTxt} zugeschnitten. Antwort per E-Mail meist innerhalb von 24 bis 48 Stunden.</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${link}" style="display:inline-block;background:#8B7355;color:#fff;text-decoration:none;font-weight:800;font-size:17px;padding:16px 30px;border-radius:12px">Jetzt Video hochladen</a>
      </p>
      <p style="font-size:14px;color:#777">Du kannst dir dafür Zeit lassen — der Link bleibt für dich gespeichert. Falls der Button nicht geht, kopier diesen Link in den Browser:<br><span style="color:#8B7355">${link}</span></p>
      <p style="font-size:13px;color:#9CA3AF;margin-top:24px">Bei Fragen antworte einfach auf diese E-Mail.</p>
    </div>`;
    try {
      await sendViaGoogleSmtp({
        to: email,
        cc: TEAM_CC, // kontakt@primesocial.de bekommt bei jeder Analyse-Bestellung eine Kopie
        subject: `Deine persönliche Analyse für ${dogTxt} — so lädst du dein Video hoch`,
        html,
        fromName: "Pfoten-Plan",
        replyTo: TEAM_TO,
      });
    } catch (e: any) {
      return NextResponse.json({ error: "invite_mail_failed", detail: e?.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // 1) Signierte Upload-URL für eine Datei erzeugen
  if (action === "sign") {
    const filename = safeName(String(body?.filename || "datei"));
    const path = `analyse/${lead}/${body?.ts || "0"}-${filename}`;
    try {
      const r = await fetch(
        `${SB_URL}/storage/v1/object/upload/sign/${BUCKET}/${encodeURI(path)}`,
        {
          method: "POST",
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.url) {
        return NextResponse.json({ error: "sign_failed", detail: data }, { status: 502 });
      }
      // data.url ist ein relativer Pfad wie /object/upload/sign/<bucket>/<path>?token=...
      return NextResponse.json({ ok: true, path, uploadUrl: `${SB_URL}/storage/v1${data.url}` });
    } catch (e: any) {
      return NextResponse.json({ error: "sign_exception", detail: e?.message }, { status: 500 });
    }
  }

  // 2) Nach dem Upload: Team benachrichtigen
  if (action === "notify") {
    const email = String(body?.email || "").slice(0, 120);
    const dog = String(body?.dog || "").slice(0, 60);
    const note = String(body?.note || "").slice(0, 2000);
    const paths: string[] = Array.isArray(body?.paths) ? body.paths.slice(0, 10) : [];
    if (paths.length === 0) {
      return NextResponse.json({ error: "no_files" }, { status: 400 });
    }
    // Signierte Download-Links (7 Tage) fürs Team erzeugen
    const links: string[] = [];
    for (const p of paths) {
      try {
        const r = await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}/${encodeURI(p)}`, {
          method: "POST",
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
        });
        const d = await r.json().catch(() => null);
        if (d?.signedURL) links.push(`${SB_URL}/storage/v1${d.signedURL}`);
        else links.push(`(Link-Fehler) ${BUCKET}/${p}`);
      } catch {
        links.push(`(Link-Fehler) ${BUCKET}/${p}`);
      }
    }
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.6">
      <h2 style="margin:0 0 8px">🎬 Neue Verhaltens-Analyse zu bearbeiten</h2>
      <p><b>Kunde:</b> ${email || "unbekannt"}<br><b>Hund:</b> ${dog || "unbekannt"}<br><b>Lead:</b> ${lead}</p>
      <p><b>Beschreibung des Kunden:</b><br>${note ? note.replace(/</g, "&lt;").replace(/\n/g, "<br>") : "(keine)"}</p>
      <p><b>Material (${links.length}, Links gültig 7 Tage):</b></p>
      <ul>${links.map((l) => `<li><a href="${l}">${l.split("/").pop()?.split("?")[0] || l}</a></li>`).join("")}</ul>
      <p style="color:#666;font-size:12px">Bitte per Mail an den Kunden antworten (${email}).</p>
    </div>`;
    try {
      await sendViaGoogleSmtp({
        to: TEAM_TO,
        cc: TEAM_CC,
        subject: `🎬 Verhaltens-Analyse: ${dog || email || lead}`,
        html,
        fromName: "Pfoten-Plan Analyse",
        replyTo: email || undefined,
      });
    } catch (e: any) {
      return NextResponse.json({ error: "notify_mail_failed", detail: e?.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, files: links.length });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
