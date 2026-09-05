// Laura-Sonntags-Kampagne — serverseitiger Batch-Versand über Amazon SES.
//
// Warum als Cron statt lokalem Skript? Damit die Kampagne rausgeht, AUCH WENN
// der Mac aus ist. Vercel-Cron läuft auf dem Server. Ein 34k-Versand dauert bei
// sanfter Rate ~viele Stunden — serverless kann nicht 10 h am Stück laufen,
// deshalb senden wir in KLEINEN MINUTEN-BATCHES: jede Minute ein paar Mails,
// über ein Zeitfenster verteilt (das ist für Deliverability sogar gut).
//
// SICHERHEIT:
//   - Kill-Switch: sendet NUR wenn env LAURA_KAMPAGNE_LIVE=1. Sonst Dry-Run.
//   - Dedup: pro Lead answers.laura_kampagne_sent=true → nie doppelt.
//   - Nur Nicht-Käufer, nicht Abgemeldete.
//   - Test: ?test=dein@mail.de sendet EINE Mustermail (ignoriert Kill-Switch).
//
// Absender/Zustellung 1:1 wie das getestete Skript (send-sonntag.mjs):
//   SES v2, hallo@pfoten-post.de, ConfigurationSet pfoten-tracking,
//   List-Unsubscribe + /api/unsubscribe?lead=<id>.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";
const REGION = process.env.AWS_REGION || "eu-central-1";
const HOST = `email.${REGION}.amazonaws.com`;
const AK = process.env.AWS_ACCESS_KEY_ID || "";
const SK = process.env.AWS_SECRET_ACCESS_KEY || "";
const CONFIG_SET = process.env.SES_CONFIGURATION_SET || "pfoten-tracking";
const FROM = "Laura vom Pfoten-Plan <hallo@pfoten-post.de>";
const CAMPAIGN = "laura-sonntag";
const BATCH = 100; // pro Cron-Lauf (jede Minute) → ~1,6/s im Schnitt, kurze Läufe

const hmac = (k: crypto.BinaryLike | crypto.KeyObject, d: string) =>
  crypto.createHmac("sha256", k as any).update(d).digest();
const sha = (d: string) => crypto.createHash("sha256").update(d).digest("hex");

async function ses(method: string, path: string, bodyObj: any) {
  const body = bodyObj ? JSON.stringify(bodyObj) : "";
  const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const ds = amz.slice(0, 8);
  const ch = `content-type:application/json\nhost:${HOST}\nx-amz-date:${amz}\n`;
  const sh = "content-type;host;x-amz-date";
  const creq = [method, path, "", ch, sh, sha(body)].join("\n");
  const scope = `${ds}/${REGION}/ses/aws4_request`;
  const sts = ["AWS4-HMAC-SHA256", amz, scope, sha(creq)].join("\n");
  let k = hmac("AWS4" + SK, ds);
  k = hmac(k, REGION);
  k = hmac(k, "ses");
  k = hmac(k, "aws4_request");
  const sig = crypto.createHmac("sha256", k).update(sts).digest("hex");
  const auth = `AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=${sh}, Signature=${sig}`;
  const r = await fetch(`https://${HOST}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Amz-Date": amz, Authorization: auth },
    body: body || undefined,
  });
  return { status: r.status, data: await r.text() };
}

// Betreff-A/B: A = Neugier, D = persönlich mit Hundename. Split über Lead-ID.
function variantOf(id: string): "A" | "D" {
  const c = (id || "").replace(/[^0-9a-f]/gi, "").slice(-1).toLowerCase();
  const n = parseInt(c || "0", 16);
  return n % 2 === 0 ? "A" : "D";
}
function subjectFor(dog: string, id: string): string {
  return variantOf(id) === "A"
    ? "Ehrlich gesagt, ich wollte fast aufgeben"
    : `Ich weiß genau, wie du dich mit ${dog} fühlst`;
}

function buildHtml(dog: string, id: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;line-height:1.7;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 36px 6px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#8B7355;">🐾 Pfoten-Plan</div></td></tr>
<tr><td style="padding:14px 36px 8px;">
<p style="margin:0 0 16px;font-size:16px;">Hallo, na wie geht es ${dog}? 🐾</p>
<p style="margin:0 0 16px;font-size:16px;">Ich bin <strong>Laura</strong>, und weil ich selbst weiß, wie sehr so ein Hund einem ans Herz wächst, wollte ich dir heute mal ganz persönlich schreiben.</p>
<p style="margin:0 0 16px;font-size:16px;">Vor gar nicht langer Zeit war ich nämlich richtig verzweifelt mit meinem eigenen Hund. Er hat an der Leine gezogen, nicht auf mich gehört, und manchmal saß ich abends da und habe gedacht, dass ich einfach zu ungeschickt dafür bin.</p>
<p style="margin:0 0 16px;font-size:16px;">Eine Freundin hat mir dann den Pfoten-Plan gezeigt. Ich war ehrlich skeptisch. Aber ich habe es einfach probiert, jeden Tag nur ein paar Minuten, ganz in unserem Tempo. Und nach zwei Wochen ist etwas passiert, das ich nicht für möglich gehalten hätte. Mein Hund hat mich zum ersten Mal richtig angeschaut und gewartet, was ich sage.</p>
<p style="margin:0 0 16px;font-size:16px;">Dieses Gefühl vergesse ich nie. Ich war so begeistert, dass ich einfach ein Teil davon sein wollte. Also habe ich mich bei Max beworben, und heute darf ich wirklich hier im Pfoten-Plan-Team arbeiten und anderen Menschen genau so helfen, wie damals mir geholfen wurde.</p>
<p style="margin:0 0 16px;font-size:16px;">Und genau deshalb schreibe ich dir. Ich weiß, wie du dich mit ${dog} gerade vielleicht fühlst. Du musst das nicht alleine schaffen, und du bist ganz sicher nicht zu ungeschickt dafür. Ihr braucht nur einen klaren Weg, den ihr in eurem Tempo gehen könnt.</p>
<p style="margin:0 0 20px;font-size:16px;">Wenn du magst, machen wir dir den Plan für ${dog} fertig, genau auf euer Thema abgestimmt.</p>
</td></tr>
<tr><td style="padding:4px 36px 8px;text-align:center;"><a href="https://www.pfoten-plan.de/" style="display:inline-block;background:#8B7355;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 34px;border-radius:12px;">Jetzt ${dog}s Plan starten</a></td></tr>
<tr><td style="padding:16px 36px 6px;"><p style="margin:0 0 6px;font-size:16px;">Ich drücke euch von Herzen die Daumen.</p><p style="margin:0 0 4px;font-size:16px;"><strong>Laura</strong> vom Pfoten-Plan-Team</p></td></tr>
<tr><td style="padding:14px 36px 30px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#EEF6EF;border:2px solid #B8DDBE;border-radius:14px;"><tr><td style="padding:18px 20px;">
<p style="margin:0;font-size:16px;color:#166534;font-weight:800;">✓ Du gehst kein Risiko ein.</p>
<p style="margin:8px 0 0;font-size:16px;color:#166534;">Wenn dir der Plan für ${dog} nicht gefällt, kannst du innerhalb von <strong>30 Tagen ganz einfach zurücktreten</strong> und bekommst <strong>dein Geld zurück</strong>. Ganz ohne Wenn und Aber.</p>
</td></tr></table></td></tr>
<tr><td style="padding:16px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;"><p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.7;">Pfoten-Plan · Persönliches Hundetraining<br>Wenn du keine Post mehr von uns möchtest, kannst du dich <a href="${unsub}" style="color:#9CA3AF;text-decoration:underline;">hier abmelden</a>.</p></td></tr>
</table></td></tr></table></body></html>`;
}

function buildText(dog: string, id: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  return `Hallo, na wie geht es ${dog}?

ich bin Laura, und weil ich selbst weiß, wie sehr so ein Hund einem ans Herz wächst, wollte ich dir heute mal ganz persönlich schreiben.

Vor gar nicht langer Zeit war ich nämlich richtig verzweifelt mit meinem eigenen Hund. Er hat an der Leine gezogen, nicht auf mich gehört, und manchmal saß ich abends da und habe gedacht, dass ich einfach zu ungeschickt dafür bin.

Eine Freundin hat mir dann den Pfoten-Plan gezeigt. Ich war ehrlich skeptisch. Aber ich habe es einfach probiert, jeden Tag nur ein paar Minuten. Und nach zwei Wochen hat mein Hund mich zum ersten Mal richtig angeschaut und gewartet, was ich sage.

Ich war so begeistert, dass ich mich bei Max beworben habe. Heute arbeite ich hier im Pfoten-Plan-Team und helfe anderen genau so, wie damals mir geholfen wurde.

Wenn du magst, machen wir dir den Plan für ${dog} fertig: https://www.pfoten-plan.de/

Ich drücke euch von Herzen die Daumen.
Laura vom Pfoten-Plan-Team

Du gehst kein Risiko ein: Wenn dir der Plan nicht gefällt, kannst du innerhalb von 30 Tagen zurücktreten und bekommst dein Geld zurück.

Keine Mails mehr? Hier abmelden: ${unsub}`;
}

async function sendOne(email: string, dog: string, id: string) {
  return ses("POST", "/v2/email/outbound-emails", {
    FromEmailAddress: FROM,
    Destination: { ToAddresses: [email] },
    ReplyToAddresses: ["support@pfoten-plan.de"],
    ConfigurationSetName: CONFIG_SET,
    EmailTags: [{ Name: "campaign", Value: CAMPAIGN }],
    Content: {
      Simple: {
        Subject: { Data: subjectFor(dog, id), Charset: "UTF-8" },
        Body: {
          Html: { Data: buildHtml(dog, id), Charset: "UTF-8" },
          Text: { Data: buildText(dog, id), Charset: "UTF-8" },
        },
        Headers: [
          { Name: "List-Unsubscribe", Value: `<https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}>, <mailto:hallo@pfoten-post.de?subject=unsubscribe>` },
          { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
        ],
      },
    },
  });
}

const EXCLUDED = ["paid", "refunded", "cancelled", "canceled", "chargeback"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!AK || !SK) return NextResponse.json({ error: "aws_credentials_missing" }, { status: 500 });

  // Test-Modus: eine Mustermail, ignoriert Kill-Switch + Dedup.
  const testTo = searchParams.get("test");
  if (testTo) {
    const res = await sendOne(testTo, "Bella", "test-lead-000a");
    return NextResponse.json({ test: testTo, status: res.status, data: res.data.slice(0, 200) });
  }

  const LIVE = process.env.LAURA_KAMPAGNE_LIVE === "1";

  // Nicht-Käufer, mit E-Mail, noch nicht gesendet, nicht abgemeldet.
  const { data: leads, error } = await supabase
    .from("wauwerk_leads")
    .select("id, email, dog_name, status, answers")
    .not("email", "is", null)
    .not("status", "in", `(${EXCLUDED.join(",")})`)
    .is("answers->>laura_kampagne_sent", null)
    .is("answers->>email_sequence_unsubscribed_at", null)
    .order("id", { ascending: true })
    .limit(BATCH);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!leads || leads.length === 0) {
    return NextResponse.json({ ok: true, done: true, sent: 0, reason: "keine_offenen" });
  }

  if (!LIVE) {
    return NextResponse.json({
      ok: true,
      modus: "DRY-RUN (LAURA_KAMPAGNE_LIVE!=1) — es wird NICHTS gesendet",
      offen_in_diesem_batch: leads.length,
      beispiel: { email: leads[0].email, dog: leads[0].dog_name, betreff: subjectFor(leads[0].dog_name || "deinem Hund", leads[0].id) },
    });
  }

  let ok = 0, err = 0;
  for (const l of leads) {
    const dog = (l.dog_name || "").trim() || "deinem Hund";
    let res;
    try {
      res = await sendOne(l.email, dog, l.id);
    } catch {
      err++;
      continue; // beim nächsten Lauf erneut versucht (nicht markiert)
    }
    if (res.status < 300) {
      ok++;
      const prev = (l.answers || {}) as Record<string, any>;
      await supabase
        .from("wauwerk_leads")
        .update({ answers: { ...prev, laura_kampagne_sent: true, laura_kampagne_sent_at: new Date().toISOString(), laura_kampagne_variant: variantOf(l.id) } })
        .eq("id", l.id);
    } else {
      err++;
    }
  }

  return NextResponse.json({ ok: true, modus: "LIVE", gesendet: ok, fehler: err, batch: leads.length });
}
