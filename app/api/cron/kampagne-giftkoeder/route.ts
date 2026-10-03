// Herbst-Kampagne "Nichts vom Boden" (Anti-Giftkoeder, 24,99) — SES-Batch.
//
// WARUM JETZT: Im Oktober liegt alles unter dem Laub. Das Aufnehmen vom Boden
// ist dann kein Randthema mehr, sondern der Grund, warum viele die Leine gar
// nicht mehr loslassen. Das Produkt dazu liegt auf /nichts-vom-boden.html.
//
// Aufbau 1:1 wie kampagne-charakterprofil: eigener Freigabe-Schalter, eigener
// Not-Aus, Dedup ueber die E-Mail, Marker im Lead. Nichts davon beruehrt die
// anderen Kampagnen.
//
// ZIELGRUPPE (DACH-Kaeufer):
//   status = paid                       -> hat schon gekauft
//   answers.lang IS NULL                -> nur deutscher Funnel (PL/IT haben lang)
//   answers.unsubscribed IS NULL        -> nicht abgemeldet
//   answers.giftkoeder_sent_at IS NULL  -> hat das Handbuch noch nicht
//   answers.kampagne_gk_sent IS NULL    -> eigener Dedup-Marker
//   paid_at aelter als die Karenz       -> frische Kaeufer bekommen erst ihren Plan
//
// SEGMENT: system_settings.kampagne_gk_segment
//   "alle"     (Standard) -> jeder Kaeufer, das Thema ist saisonal fuer alle da
//   "betroffen"           -> nur Leads, die Aufnehmen/Giftkoeder selbst angegeben haben
//
// FREIGABE: sendet NUR bei system_settings.kampagne_gk_live = "true".
// Not-Aus: kampagne_gk_stop = "true".
//   ?dry=1          -> zeigt nur, wer dran waere
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
const FROM = "Max von Pfoten-Plan <hallo@pfoten-post.de>";
const CAMPAIGN = "giftkoeder-herbst";
const BATCH = 100;
const KARENZ_TAGE_STANDARD = 7;
const KARENZ_TAGE_MAX = 3650;

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

// Betreff-Test: A beschreibt die Jahreszeit, B den Moment beim Kunden selbst.
function variantFor(id: string): "A" | "B" {
  const c = (id || "").replace(/[^0-9a-f]/gi, "").slice(-1).toLowerCase();
  return parseInt(c || "0", 16) % 2 === 1 ? "B" : "A";
}
function subjectFor(dog: string, id: string): string {
  return variantFor(id) === "B"
    ? `${dog} hat es im Maul, bevor du es siehst`
    : "Jetzt liegt alles unter dem Laub";
}

// Selbst angegebenes Aufnehmen-Problem (fuer das Segment "betroffen").
const BETROFFEN = /aufnehm|vom boden|giftk|frisst alles|fressen unterwegs|maul|muell|mülle/i;
function istBetroffen(a: Record<string, any>): boolean {
  const felder = [a?.dog_problem, a?.dog_goal, a?.special_notes, ...(Array.isArray(a?.dog_behaviors) ? a.dog_behaviors : [])];
  return felder.some((f) => f && BETROFFEN.test(String(f)));
}

function ctaUrl(id: string, email: string): string {
  return (
    "https://www.pfoten-plan.de/nichts-vom-boden.html?lead_id=" +
    encodeURIComponent(id) +
    "&email=" +
    encodeURIComponent(email) +
    "&utm_source=email&utm_medium=kampagne&utm_campaign=giftkoeder-herbst"
  );
}

function buildHtml(dog: string, id: string, email: string): string {
  const cta = ctaUrl(id, email);
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4EFE6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Im Herbst liegt alles unter dem Laub. Was du jetzt üben kannst.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE6;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFDF9;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">

  <tr><td style="padding:30px 34px 0;">
    <div style="font-size:15px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#C4A576;">Herbst-Training</div>
    <h1 style="margin:12px 0 0;font-size:31px;line-height:1.2;color:#241E18;font-weight:800;letter-spacing:-0.4px;">
      Jetzt liegt alles unter dem Laub.</h1>
    <p style="margin:14px 0 0;font-size:18px;line-height:1.6;color:#4A4036;">
      Fallobst, Nüsse, Essensreste — und manchmal Dinge, die dort nicht hingehören.
      ${dog} findet sie, bevor du sie siehst.</p>
  </td></tr>

  <tr><td style="padding:24px 34px 0;">
    <img src="https://www.pfoten-plan.de/giftkoeder-laub.jpg" alt="Spaziergang im Laub" width="532"
         style="width:100%;max-width:532px;display:block;border-radius:12px;"></td></tr>

  <tr><td style="padding:26px 34px 0;">
    <p style="margin:0;font-size:18px;line-height:1.62;color:#4A4036;">
      Du kennst den Moment: Der Kopf geht runter, und bis du „Nein" rufst, ist es schon im Maul.
      Dann folgt das Hinterherlaufen, das Festhalten, das Fingern im Maul — und beim nächsten Mal
      ist er noch schneller.</p>
    <p style="margin:16px 0 0;font-size:18px;line-height:1.62;color:#4A4036;">
      <b>Das Problem ist nicht sein Ungehorsam.</b> Aufnehmen ist für ihn normal.
      Was fehlt, ist eine Übung für genau diesen Moment.</p>
  </td></tr>

  <tr><td style="padding:26px 34px 0;">
    <img src="https://www.pfoten-plan.de/giftkoeder-aus.jpg" alt="Hund lässt etwas fallen" width="532"
         style="width:100%;max-width:532px;display:block;border-radius:12px;">
    <p style="margin:12px 0 0;font-size:15.5px;line-height:1.5;color:#8A7A62;text-align:center;">
      So sieht es aus, wenn es sitzt: Er lässt es fallen, bevor du ihn erreichst.</p>
  </td></tr>

  <tr><td style="padding:28px 34px 0;">
    <div style="background:#F7F1E6;border-radius:14px;padding:22px 24px;">
      <div style="font-size:19px;font-weight:800;color:#241E18;margin-bottom:14px;">Der Weg dahin, in 20 Übungen</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:17px;line-height:1.5;color:#4A4036;">
        <tr><td style="padding:6px 0;"><b style="color:#8B6B3A;">Übung 2</b> &nbsp;AUS an der geschlossenen Hand — am Küchentisch</td></tr>
        <tr><td style="padding:6px 0;"><b style="color:#8B6B3A;">Übung 9</b> &nbsp;An einer vorbereiteten Stelle vorbeigehen</td></tr>
        <tr><td style="padding:6px 0;"><b style="color:#8B6B3A;">Übung 11</b> &nbsp;Der Laubhaufen im Herbst</td></tr>
        <tr><td style="padding:6px 0;"><b style="color:#8B6B3A;">Übung 17</b> &nbsp;Er hat schon etwas im Maul — was jetzt</td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:16px;line-height:1.5;color:#6B5E4C;">
        Jede Übung mit Schritt für Schritt, wie oft, wie lange — und was zu tun ist,
        wenn ${dog} nicht reagiert.</p>
    </div>
  </td></tr>

  <tr><td align="center" style="padding:28px 34px 0;">
    <a href="${cta}"
       style="display:inline-block;background:#241E18;color:#FFFDF9;text-decoration:none;font-size:19px;font-weight:800;
              padding:17px 34px;border-radius:999px;">Den Plan für ${dog} ansehen</a>
  </td></tr>

  <tr><td style="padding:22px 34px 24px;">
    <p style="margin:0;font-size:15px;line-height:1.55;color:#8A7A62;">
      Übrigens: Dieses Training beugt vor. Wenn du den Verdacht hast, dass ${dog} etwas
      Giftiges gefressen hat, fahr bitte sofort zum Tierarzt und warte nicht ab.</p>
    <p style="margin:18px 0 0;font-size:15px;color:#A2927A;">
      Viele Grüße<br>Max von Pfoten-Plan</p>
  </td></tr>

  <tr><td style="padding:16px 32px;background:#FAF7F1;border-top:1px solid #EFE7D9;">
    <p style="margin:0;font-size:11px;color:#A2927A;text-align:center;line-height:1.7;">
      Pfoten-Plan · Persönliches Hundetraining<br>
      Keine Post mehr? <a href="${unsub}" style="color:#A2927A;text-decoration:underline;">Hier abmelden</a>.</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

function buildText(dog: string, id: string, email: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  return `Jetzt liegt alles unter dem Laub.

Fallobst, Nüsse, Essensreste - und manchmal Dinge, die dort nicht hingehören.
${dog} findet sie, bevor du sie siehst.

Du kennst den Moment: Der Kopf geht runter, und bis du "Nein" rufst, ist es
schon im Maul. Dann folgt das Hinterherlaufen, das Festhalten, das Fingern im
Maul - und beim nächsten Mal ist er noch schneller.

Das Problem ist nicht sein Ungehorsam. Aufnehmen ist für ihn normal.
Was fehlt, ist eine Übung für genau diesen Moment.

DER WEG DAHIN, IN 20 ÜBUNGEN
- Übung 2: AUS an der geschlossenen Hand, am Küchentisch
- Übung 9: An einer vorbereiteten Stelle vorbeigehen
- Übung 11: Der Laubhaufen im Herbst
- Übung 17: Er hat schon etwas im Maul - was jetzt

Jede Übung mit Schritt für Schritt, wie oft, wie lange - und was zu tun ist,
wenn ${dog} nicht reagiert.

Den Plan für ${dog} ansehen:
${ctaUrl(id, email)}

Übrigens: Dieses Training beugt vor. Wenn du den Verdacht hast, dass ${dog}
etwas Giftiges gefressen hat, fahr bitte sofort zum Tierarzt und warte nicht ab.

Viele Grüße
Max von Pfoten-Plan

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
    const dog = searchParams.get("hund") || "Bella";
    const id = searchParams.get("lead") || "test-lead-000b";
    const res = await sendOne(testTo, dog, id);
    return NextResponse.json({ test: testTo, hund: dog, betreff: subjectFor(dog, id), status: res.status, data: res.data.slice(0, 200) });
  }

  const dry = searchParams.get("dry") === "1";

  const { data: flags } = await supabase
    .from("system_settings")
    .select("key,value")
    .in("key", ["kampagne_gk_live", "kampagne_gk_stop", "kampagne_gk_segment", "kampagne_gk_karenz_tage"]);
  const flag = (k: string) => String((flags || []).find((f: any) => f.key === k)?.value || "");
  if (!dry && flag("kampagne_gk_live") !== "true") {
    return NextResponse.json({ ok: true, wartet: true, hinweis: "system_settings.kampagne_gk_live ist nicht auf true" });
  }
  if (flag("kampagne_gk_stop") === "true") {
    return NextResponse.json({ ok: true, gestoppt: true, hinweis: "system_settings.kampagne_gk_stop ist gesetzt" });
  }
  const segment = ["alle", "betroffen"].includes(flag("kampagne_gk_segment")) ? flag("kampagne_gk_segment") : "alle";

  // Leerer Schalter heisst "nicht gesetzt" (Number("") waere 0 und damit keine Karenz).
  const karenzText = flag("kampagne_gk_karenz_tage").trim();
  const karenzRoh = karenzText === "" ? NaN : Number(karenzText);
  const karenzTage =
    Number.isFinite(karenzRoh) && karenzRoh > 0 && karenzRoh <= KARENZ_TAGE_MAX ? karenzRoh : KARENZ_TAGE_STANDARD;
  const karenz = new Date(Date.now() - karenzTage * 86400000).toISOString();

  const abfrage: any = supabase
    .from("wauwerk_leads")
    .select("id, email, dog_name, answers, paid_at")
    .eq("status", "paid")
    .not("email", "is", null)
    .lt("paid_at", karenz)
    .is("answers->>lang", null)
    .is("answers->>unsubscribed", null)
    .is("answers->>giftkoeder_sent_at", null)
    .is("answers->>kampagne_gk_sent", null);

  const { data, error } = await abfrage.order("paid_at", { ascending: false }).limit(BATCH * 4);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Lead = {
    id: string;
    email: string | null;
    dog_name: string | null;
    answers: Record<string, any> | null;
    paid_at: string | null;
  };
  const leads = (data || []) as Lead[];
  if (leads.length === 0) {
    return NextResponse.json({ ok: true, fertig: true, gesendet: 0, grund: "keine_offenen" });
  }

  const roh = leads.length;
  const imBatch = leads
    .filter((l) => (segment === "alle" ? true : istBetroffen((l.answers || {}) as any)))
    .slice(0, BATCH);
  if (imBatch.length === 0) {
    return NextResponse.json({ ok: true, fertig: true, gesendet: 0, segment, grund: "segment_leer", roh });
  }

  // Dedup ueber die E-Mail: Wiederholungskaeufer haben mehrere paid-Zeilen.
  const mails = imBatch.map((l) => (l.email || "").toLowerCase()).filter(Boolean);
  const { data: schonMal } = await supabase.from("wauwerk_leads").select("email, answers").in("email", mails);
  const bereits = new Set(
    ((schonMal || []) as Array<{ email: string | null; answers: Record<string, any> | null }>)
      .filter((r) => (r.answers || {}).kampagne_gk_sent || (r.answers || {}).giftkoeder_sent_at)
      .map((r) => (r.email || "").toLowerCase())
  );

  if (dry) {
    const gesehen = new Set<string>();
    const offen = imBatch.filter((l) => {
      const m = (l.email || "").toLowerCase();
      if (bereits.has(m) || gesehen.has(m)) return false;
      gesehen.add(m);
      return true;
    });
    const b = offen[0];
    return NextResponse.json({
      ok: true,
      modus: "DRY-RUN",
      freigabe: flag("kampagne_gk_live") === "true",
      segment,
      karenz_tage: karenzTage,
      roh_geladen: roh,
      im_batch: imBatch.length,
      davon_dubletten_oder_schon_versendet: imBatch.length - offen.length,
      beispiel: b ? { email: b.email, hund: b.dog_name, betreff: subjectFor(b.dog_name || "dein Hund", b.id) } : null,
    });
  }

  let ok = 0, err = 0, skip = 0;
  const gesehen = new Set<string>();
  for (const l of imBatch) {
    const mail = (l.email || "").toLowerCase();
    const prev = (l.answers || {}) as Record<string, any>;
    if (bereits.has(mail) || gesehen.has(mail)) {
      skip++;
      await supabase.from("wauwerk_leads").update({ answers: { ...prev, kampagne_gk_sent: "skip_dublette" } }).eq("id", l.id);
      continue;
    }
    gesehen.add(mail);
    const dog = (l.dog_name || "").trim() || "dein Hund";
    let res;
    try {
      res = await sendOne(String(l.email), dog, l.id);
    } catch {
      err++;
      continue; // nicht markieren -> naechster Lauf versucht es erneut
    }
    if (res.status < 300) {
      ok++;
      await supabase
        .from("wauwerk_leads")
        .update({
          answers: {
            ...prev,
            kampagne_gk_sent: true,
            kampagne_gk_sent_at: new Date().toISOString(),
            kampagne_gk_variant: variantFor(l.id),
          },
        })
        .eq("id", l.id);
    } else {
      err++;
    }
  }

  return NextResponse.json({ ok: true, modus: "LIVE", segment, karenz_tage: karenzTage, gesendet: ok, uebersprungen_dublette: skip, fehler: err, batch: imBatch.length });
}
