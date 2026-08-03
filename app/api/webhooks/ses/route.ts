// POST /api/webhooks/ses — Amazon SNS -> SES Bounce/Complaint-Notifications.
//
// Sicherheit: Jede SNS-Nachricht wird gegen das AWS-Signaturzertifikat geprueft
// (SigningCertURL MUSS ein amazonaws.com-Host sein -> SSRF/Spoofing-Schutz).
// Ungueltige Signatur -> 403.
//
// Verarbeitung:
//  - SubscriptionConfirmation: bestaetigt das Abo automatisch (ruft SubscribeURL).
//  - Notification (Bounce/Complaint): markiert die betroffene Adresse am Lead
//    (answers.ses_bounced_at / ses_complained_at + unsubscribed=true) — die
//    Sende-Skripte (send-kampagne*.mjs) ueberspringen answers.unsubscribed und
//    schuetzen so die Absender-Reputation.
//
// ENV: SES_SNS_TOPIC_ARN (Topic-Check), SUPABASE_SERVICE_ROLE.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_TOPIC = process.env.SES_SNS_TOPIC_ARN || "";

// Feld-Reihenfolge fuer den String-to-Sign je Nachrichtentyp (SNS-Spezifikation).
const SIGN_FIELDS: Record<string, string[]> = {
  Notification: ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"],
  SubscriptionConfirmation: ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"],
  UnsubscribeConfirmation: ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"],
};

function buildStringToSign(msg: any): string | null {
  const fields = SIGN_FIELDS[msg?.Type];
  if (!fields) return null;
  let out = "";
  for (const f of fields) {
    if (f === "Subject" && !(f in msg)) continue; // Subject ist optional
    if (msg[f] === undefined || msg[f] === null) return null;
    out += f + "\n" + msg[f] + "\n";
  }
  return out;
}

function isAwsHost(url: string): boolean {
  try {
    return /(^|\.)amazonaws\.com$/i.test(new URL(url).host);
  } catch {
    return false;
  }
}

const certCache = new Map<string, string>();
async function getCert(url: string): Promise<string | null> {
  if (!isAwsHost(url)) return null; // nur AWS-Zertifikate laden
  const cached = certCache.get(url);
  if (cached) return cached;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const pem = await r.text();
    certCache.set(url, pem);
    return pem;
  } catch {
    return null;
  }
}

async function verifySignature(msg: any): Promise<boolean> {
  try {
    const sts = buildStringToSign(msg);
    if (!sts || !msg.Signature || !msg.SigningCertURL) return false;
    const pem = await getCert(msg.SigningCertURL);
    if (!pem) return false;
    const algo = String(msg.SignatureVersion) === "2" ? "RSA-SHA256" : "RSA-SHA1";
    const v = crypto.createVerify(algo);
    v.update(sts, "utf8");
    return v.verify(pem, msg.Signature, "base64");
  } catch {
    return false;
  }
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Betroffene Adresse unterdruecken: Flag + unsubscribed (Fresh-Read-Merge, damit
// die uebrigen answers nicht ueberschrieben werden).
async function suppress(email: string, kind: "bounce" | "complaint") {
  const e = (email || "").trim().toLowerCase();
  if (!e) return;
  const sb = admin();
  const { data: leads } = await sb
    .from("wauwerk_leads")
    .select("id, answers")
    .ilike("email", e);
  const now = new Date().toISOString();
  for (const lead of leads || []) {
    const a = { ...(((lead as any).answers as Record<string, any>) || {}) };
    if (kind === "bounce") a.ses_bounced_at = now;
    else a.ses_complained_at = now;
    a.unsubscribed = true;
    await sb.from("wauwerk_leads").update({ answers: a }).eq("id", (lead as any).id);
  }
}

export async function POST(req: NextRequest) {
  let msg: any;
  try {
    msg = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  // Topic-Check (falls ARN gesetzt) — Nachrichten fremder Topics ablehnen.
  if (EXPECTED_TOPIC && msg.TopicArn && msg.TopicArn !== EXPECTED_TOPIC) {
    return NextResponse.json({ ok: false, reason: "topic_mismatch" }, { status: 403 });
  }

  if (!(await verifySignature(msg))) {
    return NextResponse.json({ ok: false, reason: "bad_signature" }, { status: 403 });
  }

  // 1) Abo bestaetigen (SNS ruft das einmal beim Anlegen der Subscription auf).
  if (msg.Type === "SubscriptionConfirmation") {
    if (msg.SubscribeURL && isAwsHost(msg.SubscribeURL)) {
      try {
        await fetch(msg.SubscribeURL);
      } catch {}
    }
    return NextResponse.json({ ok: true, confirmed: true });
  }

  // 2) Bounce/Complaint verarbeiten.
  if (msg.Type === "Notification") {
    let ev: any = {};
    try {
      ev = JSON.parse(msg.Message);
    } catch {}
    const type = ev.notificationType || ev.eventType;
    try {
      if (type === "Bounce" && ev.bounce) {
        // Nur permanente Bounces unterdruecken (transiente sind oft temporaer).
        if (ev.bounce.bounceType === "Permanent") {
          for (const r of ev.bounce.bouncedRecipients || []) {
            await suppress(r.emailAddress, "bounce");
          }
        }
      } else if (type === "Complaint" && ev.complaint) {
        for (const r of ev.complaint.complainedRecipients || []) {
          await suppress(r.emailAddress, "complaint");
        }
      }
    } catch (e: any) {
      console.error("[ses-webhook] processing error:", e?.message);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
