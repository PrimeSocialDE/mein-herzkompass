// Reaktivierungs-Kampagne "Mail 1" — serverseitiger Batch-Versand über Amazon SES.
//
// WARUM: Mail 1 der ec-Sequenz ist mit Abstand die stärkste E-Mail, die wir haben
// (6.822 Sends in 30 Tagen -> 106 Käufe = 1,55 %, ~665 € je 1.000 Mails). Beim
// Livegang der Sequenz wurde ein Startdatum gesetzt; alle älteren
// email_captured-Leads haben sie nie bekommen. Genau die holen wir hier nach.
// Zum Vergleich: der Laura-Blast vom 06.09. lag bei 0,07 % / 30 € je 1.000.
//
// ZIELGRUPPE (strikt, DACH):
//   status = email_captured           -> hat den Quiz gemacht, nie gekauft
//   answers.lang IS NULL              -> nur deutscher Funnel (PL/IT haben lang gesetzt)
//   answers.ec_seq_stage1_sent_at NULL-> hat Mail 1 noch nie bekommen
//   answers.unsubscribed IS NULL      -> nicht abgemeldet
//   answers.kampagne_mail1_sent NULL  -> eigener Dedup-Marker (kollidiert nicht mit Laura)
//   + Sicherheitsnetz: E-Mails, zu denen es irgendwo einen bezahlten Lead gibt,
//     werden übersprungen (niemand, der schon Kunde ist, bekommt Werbung).
//
// STEUERUNG OHNE VERCEL: Not-Aus über system_settings.kampagne_mail1_stop = true
// (dann sendet der Cron nichts mehr). Kein neues Env nötig; AWS-Keys, Config-Set
// und CRON_SECRET sind dieselben wie bei der Laura-Kampagne.
//   ?dry=1          -> zeigt nur, wer dran wäre
//   ?test=mail@x.de -> eine Mustermail

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
const CAMPAIGN = "mail1-reaktivierung";
const BATCH = 100; // pro Minute -> ~1,6/s, SES erlaubt 14/s

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

function subjectFor(dog: string, id: string): string {
  const c = (id || '').replace(/[^0-9a-f]/gi, '').slice(-1).toLowerCase();
  return (parseInt(c || '0', 16) % 2 === 0)
    ? `Der schwerste Tag mit ${dog} ist Tag 1`
    : `${dog} braucht nur 5 bis 7 Wiederholungen`;
}
function buildHtml(dog: string, id: string, email: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const cta = `https://www.pfoten-plan.de/rueckhol.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  const wa = 'https://wa.me/4915129892586?text=Hallo%2C%20ich%20habe%20eine%20Frage%20zum%20Trainingsplan%20%F0%9F%90%BE';
  const p = 'margin:0 0 16px;font-size:16px;';
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pfoten-Plan</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;line-height:1.7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Warum es bisher nicht klappt. Und was du heute ändern kannst.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 36px 6px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#8B7355;">🐾 Pfoten-Plan</div></td></tr>
<tr><td style="padding:14px 36px 8px;">
<p style="${p}">Hallo,</p>
<p style="${p}">vor einer Weile hast du dir für <strong>${dog}</strong> mal einen Trainingsplan angesehen. Vielleicht ist seitdem nicht viel passiert. Und ich vermute, das liegt nicht an dir.</p>
<p style="${p}">Was die meisten übersehen: Ein neues Verhalten braucht im Schnitt <strong>5 bis 7 Wiederholungen</strong>, bis es bei ${dog} zum ersten Mal klickt. Die meisten hören nach drei auf und denken, es funktioniert nicht. Dabei waren sie erst auf halber Strecke.</p>
<p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#3a342b;">Eine Sache für heute, ganz ohne uns</p>
<p style="${p}">Nimm den ruhigsten Spaziergang des Tages, nicht den hektischen am Morgen. Sonntagnachmittag ist dafür perfekt. Übe eine einzige Sache, fünf Minuten lang. Nicht zwei Sachen, nicht zehn Minuten. Und hör auf, solange es noch gut läuft.</p>
<p style="${p}">Falls du das Gefühl hast, es klappt trotzdem nichts: Genau an diesem Punkt geben fast alle auf. Und genau da liegen meistens drei bis vier Tage zwischen dir und dem ersten echten Aha-Moment mit ${dog}.</p>
<p style="margin:0 0 20px;font-size:16px;">Wenn du magst, machen wir dir den Plan für ${dog} fertig, abgestimmt auf euer Thema.</p>
</td></tr>
<tr><td style="padding:4px 36px 6px;text-align:center;">
<a href="${cta}" style="display:inline-block;background:#8B7355;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 34px;border-radius:12px;">${dog}s Plan ansehen</a>
<p style="margin:12px 0 0;font-size:14px;color:#166534;font-weight:700;">🛡️ 30 Tage Geld-zurück-Garantie</p>
<p style="margin:4px 0 0;font-size:13px;color:#6B7280;">Ohne Wenn und Aber. Eine kurze E-Mail genügt.</p>
</td></tr>
<tr><td style="padding:20px 36px 4px;">
<p style="margin:0 0 6px;font-size:16px;">Ich drücke euch die Daumen.</p>
<p style="margin:0;font-size:16px;"><strong>Laura</strong> vom Pfoten-Plan-Team</p>
</td></tr>
<tr><td style="padding:6px 36px 26px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F1FAF2;border:1px solid #C9E7CE;border-radius:14px;"><tr><td style="padding:16px 18px;">
<p style="margin:0 0 10px;font-size:15px;color:#1f2937;">Du kommst mit ${dog} nicht weiter oder hast eine Frage? Schreib uns einfach, per E-Mail oder direkt auf <strong>WhatsApp</strong>.</p>
<a href="${wa}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:11px 20px;border-radius:10px;">💬 Auf WhatsApp schreiben</a>
<p style="margin:10px 0 0;font-size:14px;color:#4B5563;">oder direkt speichern: <a href="${wa}" style="color:#166534;font-weight:700;text-decoration:none;">+49 151 29892586</a></p>
<p style="margin:6px 0 0;font-size:12.5px;color:#6B7280;">Wir antworten so schnell wir können, es schreibt dir ein echter Mensch.</p>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;"><p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.7;">Pfoten-Plan · Persönliches Hundetraining<br>Keine Post mehr? <a href="${unsub}" style="color:#9CA3AF;text-decoration:underline;">Hier abmelden</a>.</p></td></tr>
</table></td></tr></table></body></html>`;
}
function buildText(dog: string, id: string, email: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const cta = `https://www.pfoten-plan.de/rueckhol.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  return `Hallo,

vor einer Weile hast du dir für ${dog} mal einen Trainingsplan angesehen. Vielleicht ist seitdem nicht viel passiert. Und ich vermute, das liegt nicht an dir.

Was die meisten übersehen: Ein neues Verhalten braucht im Schnitt 5 bis 7 Wiederholungen, bis es bei ${dog} zum ersten Mal klickt. Die meisten hören nach drei auf und denken, es funktioniert nicht. Dabei waren sie erst auf halber Strecke.

EINE SACHE FÜR HEUTE, GANZ OHNE UNS
Nimm den ruhigsten Spaziergang des Tages, nicht den hektischen am Morgen. Sonntagnachmittag ist dafür perfekt. Übe eine einzige Sache, fünf Minuten lang. Nicht zwei Sachen, nicht zehn Minuten. Und hör auf, solange es noch gut läuft.

Falls du das Gefühl hast, es klappt trotzdem nichts: Genau an diesem Punkt geben fast alle auf. Und genau da liegen meistens drei bis vier Tage zwischen dir und dem ersten echten Aha-Moment mit ${dog}.

Wenn du magst, machen wir dir den Plan für ${dog} fertig:
${cta}

30 Tage Geld-zurück-Garantie. Ohne Wenn und Aber, eine kurze E-Mail genügt.

Ich drücke euch die Daumen.
Laura vom Pfoten-Plan-Team

Du kommst mit ${dog} nicht weiter oder hast eine Frage? Schreib uns einfach,
per Antwort auf diese Mail oder direkt auf WhatsApp: +49 151 29892586
(Wir antworten so schnell wir können, es schreibt dir ein echter Mensch.)

Keine Post mehr? Hier abmelden: ${unsub}`;
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
          Html: { Data: buildHtml(dog, id, email), Charset: "UTF-8" },
          Text: { Data: buildText(dog, id, email), Charset: "UTF-8" },
        },
        Headers: [
          { Name: "List-Unsubscribe", Value: `<https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}>, <mailto:hallo@pfoten-post.de?subject=unsubscribe>` },
          { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
        ],
      },
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!AK || !SK) return NextResponse.json({ error: "aws_credentials_missing" }, { status: 500 });

  const testTo = searchParams.get("test");
  if (testTo) {
    const res = await sendOne(testTo, "Bella", "test-lead-000a");
    return NextResponse.json({ test: testTo, status: res.status, data: res.data.slice(0, 200) });
  }

  // Not-Aus ohne Vercel-Zugriff
  const { data: stop } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "kampagne_mail1_stop")
    .maybeSingle();
  if (String(stop?.value) === "true") {
    return NextResponse.json({ ok: true, gestoppt: true, hinweis: "system_settings.kampagne_mail1_stop ist gesetzt" });
  }

  const dry = searchParams.get("dry") === "1";

  const { data: leads, error } = await supabase
    .from("wauwerk_leads")
    .select("id, email, dog_name, answers")
    .eq("status", "email_captured")
    .not("email", "is", null)
    .is("answers->>lang", null)
    .is("answers->>ec_seq_stage1_sent_at", null)
    .is("answers->>unsubscribed", null)
    .is("answers->>kampagne_mail1_sent", null)
    .order("id", { ascending: true })
    .limit(BATCH);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!leads || leads.length === 0) {
    return NextResponse.json({ ok: true, fertig: true, gesendet: 0, grund: "keine_offenen" });
  }

  // Sicherheitsnetz: niemanden anschreiben, der unter derselben Adresse gekauft hat.
  const mails = leads.map((l) => (l.email || "").toLowerCase()).filter(Boolean);
  const { data: kaeufer } = await supabase
    .from("wauwerk_leads")
    .select("email")
    .eq("status", "paid")
    .in("email", mails);
  const istKunde = new Set((kaeufer || []).map((k) => (k.email || "").toLowerCase()));

  if (dry) {
    const offen = leads.filter((l) => !istKunde.has((l.email || "").toLowerCase()));
    return NextResponse.json({
      ok: true,
      modus: "DRY-RUN",
      im_batch: leads.length,
      davon_bereits_kunde: leads.length - offen.length,
      beispiel: offen[0]
        ? { email: offen[0].email, hund: offen[0].dog_name, betreff: subjectFor(offen[0].dog_name || "deinem Hund", offen[0].id) }
        : null,
    });
  }

  let ok = 0, err = 0, skip = 0;
  for (const l of leads) {
    const mail = (l.email || "").toLowerCase();
    const prev = (l.answers || {}) as Record<string, any>;
    if (istKunde.has(mail)) {
      skip++;
      await supabase
        .from("wauwerk_leads")
        .update({ answers: { ...prev, kampagne_mail1_sent: "skip_ist_kunde" } })
        .eq("id", l.id);
      continue;
    }
    const dog = (l.dog_name || "").trim() || "deinem Hund";
    let res;
    try {
      res = await sendOne(l.email, dog, l.id);
    } catch {
      err++;
      continue; // nicht markieren -> nächster Lauf versucht es erneut
    }
    if (res.status < 300) {
      ok++;
      await supabase
        .from("wauwerk_leads")
        .update({
          answers: {
            ...prev,
            kampagne_mail1_sent: true,
            kampagne_mail1_sent_at: new Date().toISOString(),
            kampagne_mail1_variant: subjectFor("x", l.id).startsWith("Der schwerste") ? "A" : "B",
          },
        })
        .eq("id", l.id);
    } else {
      err++;
    }
  }

  return NextResponse.json({ ok: true, modus: "LIVE", gesendet: ok, uebersprungen_kunde: skip, fehler: err, batch: leads.length });
}
