// Cross-Sell-Kampagne "Video-Analyse" (54,99 EUR) — serverseitiger Batch-Versand ueber Amazon SES.
//
// WARUM: Der Trainingsplan sagt, WAS geuebt wird. Was er nicht kann: zusehen.
// Die Video-Analyse schliesst genau diese Luecke — der Kunde schickt ein kurzes
// Handy-Video plus Sprachnachricht, wir melden uns innerhalb von 24 Stunden mit
// einer persoenlichen Rueckmeldung und einem Zusatzplan zurueck.
//
// AUFBAU: 1:1 die Mechanik der Charakterprofil-Kampagne (die mit 0,455 % am besten
// lief). Personalisiert wird hier aber nicht ueber die Rasse, sondern ueber das
// angegebene HAUPTPROBLEM — das trifft den Kunden dort, wo es gerade weh tut.
//
// ZIELGRUPPE (strikt, DACH-Kaeufer):
//   status = paid                         -> hat gekauft
//   answers.lang IS NULL                  -> nur deutscher Funnel (PL/IT haben lang gesetzt)
//   answers.unsubscribed IS NULL          -> nicht abgemeldet
//   answers.premium_intake IS NULL        -> hat die Analyse noch nicht gekauft
//   answers.kampagne_va_sent IS NULL      -> eigener Dedup-Marker
//   paid_at aelter als der Karenz-Wert     -> frische Kaeufer bekommen erst ihren Plan
//   + Dedup UEBER E-MAIL: Wiederholungskaeufer haben mehrere paid-Zeilen.
//
// GESAMTLIMIT: kampagne_va_max_gesamt (Standard 2000) stoppt den Test automatisch.
// Die Auslieferung der Analyse ist Handarbeit — ohne Deckel landen an einem
// Sonntag zu viele Videos im Postfach.
//
// FREIGABE: sendet NUR, wenn system_settings.kampagne_va_live = "true".
// Not-Aus: kampagne_va_stop = "true".
//   ?dry=1          -> zeigt nur, wer dran waere
//   ?test=mail@x.de -> eine Mustermail (&problem=energy waehlt die Problemzeile)

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
const CAMPAIGN = "videoanalyse-crosssell";
const BATCH = 100;                 // pro Lauf, SES erlaubt 14/s
const KARENZ_TAGE_STANDARD = 14;   // laenger als beim Charakterprofil: erst mit dem Plan arbeiten
const KARENZ_TAGE_MAX = 3650;
const MAX_GESAMT_STANDARD = 2000;  // Testumfang, per Schalter aenderbar

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

// --- Personalisierung ueber das angegebene Hauptproblem -----------------------
// Jede Zeile nennt das Problem beim Namen UND sagt, was man ausgerechnet auf
// einem Video sieht. Das ist der eigentliche Kaufgrund.
function problemZeile(dog: string, problem: string): string {
  const p = (problem || "").toLowerCase();
  const map: Record<string, string> = {
    energy: `Bei dir steht im Fragebogen, dass ${dog} schwer zur Ruhe kommt. Genau das verrät ein Video sofort — meistens liegt es an Kleinigkeiten im Ablauf, die man selbst gar nicht mehr bemerkt.`,
    recall: `Bei dir steht im Fragebogen, dass der Rückruf nicht zuverlässig klappt. Woran es hakt, sieht man fast immer in den zwei Sekunden, BEVOR du rufst.`,
    aggression: `Bei dir steht im Fragebogen, dass Hundebegegnungen schwierig sind. Auf einem Video erkennt man, wann ${dog} den anderen Hund zuerst wahrnimmt — und das ist fast immer früher, als man denkt.`,
    "dog-reactive": `Bei dir steht im Fragebogen, dass ${dog} auf andere Hunde reagiert. Auf einem Video erkennt man den Moment, in dem es kippt — und der liegt meist deutlich vor dem Bellen.`,
    "leash-reactive": `Bei dir steht im Fragebogen, dass ${dog} an der Leine pöbelt. Auf einem Video sieht man in Sekunden, ob es an der Distanz, an der Leinenführung oder am Timing liegt.`,
    pulling: `Bei dir steht im Fragebogen, dass ${dog} an der Leine zieht. Auf einem Video sieht man in wenigen Sekunden, ob es an der Ausrüstung, am Tempo oder an deinem Timing liegt.`,
    mouthing: `Bei dir steht im Fragebogen, dass ${dog} in die Hände zwickt. Auf einem Video sieht man, in welchem Erregungsmoment es anfängt — und genau da setzt man an.`,
    barking: `Bei dir steht im Fragebogen, dass ${dog} viel bellt. Auf einem Video hört und sieht man, worauf er wirklich reagiert — das ist oft etwas anderes als vermutet.`,
    anxiety: `Bei dir steht im Fragebogen, dass ${dog} unsicher ist. Angst zeigt sich in sehr kleinen Signalen, die man live übersieht und auf einem Video in Ruhe erkennt.`,
    "general-anxiety": `Bei dir steht im Fragebogen, dass ${dog} unsicher ist. Angst zeigt sich in sehr kleinen Signalen, die man live übersieht und auf einem Video in Ruhe erkennt.`,
    soiling: `Bei dir steht im Fragebogen, dass es mit der Stubenreinheit noch hakt. Auf einem Video sieht man die Vorzeichen, die im Alltag untergehen.`,
    chasing: `Bei dir steht im Fragebogen, dass ${dog} jagt. Auf einem Video erkennt man, ab welchem Moment er nicht mehr ansprechbar ist — und davor liegt die Stelle, an der man arbeitet.`,
    destructive: `Bei dir steht im Fragebogen, dass ${dog} Dinge zerlegt. Ein Video aus der Situation zeigt, ob dahinter Langeweile, Stress oder Trennungsangst steckt.`,
    jumping: `Bei dir steht im Fragebogen, dass ${dog} Menschen anspringt. Auf einem Video sieht man, wer das Verhalten ungewollt bestätigt — oft sind es die Gäste.`,
  };
  return (
    map[p] ||
    `Du weißt am besten, woran es bei ${dog} gerade hakt. Nur: Beschreiben ist das eine. Sehen ist etwas anderes — auf einem Video erkennen wir Dinge, die im Alltag untergehen.`
  );
}

function subjectFor(dog: string, id: string): string {
  const c = (id || "").replace(/[^0-9a-f]/gi, "").slice(-1).toLowerCase();
  const variantB = parseInt(c || "0", 16) % 2 === 1;
  return variantB ? `Was uns ein kurzes Video von ${dog} verrät` : `Zeig uns ${dog} einmal`;
}
const variantOf = (id: string) => {
  const c = (id || "").replace(/[^0-9a-f]/gi, "").slice(-1).toLowerCase();
  return parseInt(c || "0", 16) % 2 === 1 ? "B" : "A";
};

function buildHtml(dog: string, problem: string, id: string, email: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const cta = `https://www.pfoten-plan.de/premium-analyse.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  const wa = "https://wa.me/4915129892586?text=Hallo%2C%20ich%20habe%20eine%20Frage%20zur%20Video-Analyse%20%F0%9F%90%BE";
  const p = "margin:0 0 16px;font-size:16px;";
  const li = "margin:0 0 9px;font-size:15.5px;";
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pfoten-Plan</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;line-height:1.7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Der Plan sagt, was ihr übt. Wir schauen uns an, wie es bei euch wirklich läuft.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 36px 6px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#8B7355;">🐾 Pfoten-Plan</div></td></tr>
<tr><td style="padding:14px 36px 8px;">
<p style="${p}">Hallo,</p>
<p style="${p}">du hast bei uns einen Trainingsplan für <strong>${dog}</strong> geholt. Der sagt dir, <strong>was</strong> ihr übt. Eines kann er aber nicht: <strong>zusehen</strong>.</p>
<p style="${p}">${problemZeile(dog, problem)}</p>
<p style="${p}">Deshalb gibt es jetzt etwas Neues: Du schickst uns ein <strong>kurzes Handy-Video</strong> aus der Situation und erzählst uns per <strong>Sprachnachricht</strong>, was passiert. Wir schauen es uns persönlich an.</p>
<p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#3a342b;">Was du zurückbekommst</p>
<p style="${li}">🎥 Eine persönliche Rückmeldung zu dem, was wir sehen — Körpersprache, Timing, deine eigene Reaktion</p>
<p style="${li}">📋 Einen <strong>Zusatzplan</strong> mit konkreten Übungen für genau diese Situation</p>
<p style="${li}">⏱️ Und zwar <strong>innerhalb von 24 Stunden</strong>, nachdem dein Material bei uns ist</p>
<p style="margin:0 0 16px;font-size:15.5px;">💬 Rückfragen danach jederzeit, es antwortet ein echter Mensch</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F1FAF2;border:1px solid #C9E7CE;border-radius:12px;margin:0 0 18px;"><tr><td style="padding:14px 16px;">
<p style="margin:0;font-size:15px;color:#17412A;"><strong>Du brauchst das Video jetzt noch nicht.</strong> Du buchst heute und filmst, wann die Situation das nächste Mal auftritt. Den Upload-Link bekommst du direkt nach dem Kauf — die 24 Stunden laufen erst, wenn dein Material da ist.</p>
</td></tr></table>
<p style="${p}">Deine Angaben zu ${dog} sind schon hinterlegt, du musst nichts noch einmal ausfüllen.</p>
</td></tr>
<tr><td style="padding:4px 36px 6px;text-align:center;">
<a href="${cta}" style="display:inline-block;background:#8B7355;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 34px;border-radius:12px;">Video-Analyse für ${dog} ansehen</a>
<p style="margin:10px 0 0;font-size:13.5px;color:#6B7280;">Einmalig, kein Abo. 14 Tage Geld-zurück-Garantie.</p>
</td></tr>
<tr><td style="padding:20px 36px 4px;">
<p style="margin:0 0 6px;font-size:16px;">Viele Grüße an ${dog},</p>
<p style="margin:0;font-size:16px;"><strong>Laura</strong> vom Pfoten-Plan-Team</p>
</td></tr>
<tr><td style="padding:6px 36px 26px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F1FAF2;border:1px solid #C9E7CE;border-radius:14px;"><tr><td style="padding:16px 18px;">
<p style="margin:0 0 10px;font-size:15px;color:#1f2937;">Unsicher, ob sich das für ${dog} lohnt? Schreib uns einfach, per E-Mail oder direkt auf <strong>WhatsApp</strong>.</p>
<a href="${wa}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:11px 20px;border-radius:10px;">💬 Auf WhatsApp schreiben</a>
<p style="margin:10px 0 0;font-size:14px;color:#4B5563;">oder direkt speichern: <a href="${wa}" style="color:#166534;font-weight:700;text-decoration:none;">+49 151 29892586</a></p>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;"><p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.7;">Pfoten-Plan · Persönliches Hundetraining<br>Keine Post mehr? <a href="${unsub}" style="color:#9CA3AF;text-decoration:underline;">Hier abmelden</a>.</p></td></tr>
</table></td></tr></table></body></html>`;
}

function buildText(dog: string, problem: string, id: string, email: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const cta = `https://www.pfoten-plan.de/premium-analyse.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  return `Hallo,

du hast bei uns einen Trainingsplan für ${dog} geholt. Der sagt dir, was ihr übt. Eines kann er aber nicht: zusehen.

${problemZeile(dog, problem).replace(/<[^>]+>/g, "")}

Deshalb gibt es jetzt etwas Neues: Du schickst uns ein kurzes Handy-Video aus der Situation und erzählst uns per Sprachnachricht, was passiert. Wir schauen es uns persönlich an.

WAS DU ZURÜCKBEKOMMST
- Eine persönliche Rückmeldung zu dem, was wir sehen — Körpersprache, Timing, deine eigene Reaktion
- Einen Zusatzplan mit konkreten Übungen für genau diese Situation
- Und zwar innerhalb von 24 Stunden, nachdem dein Material bei uns ist
- Rückfragen danach jederzeit, es antwortet ein echter Mensch

Du brauchst das Video jetzt noch nicht. Du buchst heute und filmst, wann die Situation das nächste Mal auftritt. Den Upload-Link bekommst du direkt nach dem Kauf — die 24 Stunden laufen erst, wenn dein Material da ist.

Deine Angaben zu ${dog} sind schon hinterlegt, du musst nichts noch einmal ausfüllen:
${cta}

Einmalig, kein Abo. 14 Tage Geld-zurück-Garantie.

Viele Grüße an ${dog},
Laura vom Pfoten-Plan-Team

Fragen? WhatsApp: +49 151 29892586

---
Keine Post mehr? ${unsub}`;
}

async function sendOne(email: string, dog: string, problem: string, id: string) {
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
          Html: { Data: buildHtml(dog, problem, id, email), Charset: "UTF-8" },
          Text: { Data: buildText(dog, problem, id, email), Charset: "UTF-8" },
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
    const res = await sendOne(testTo, "Bella", searchParams.get("problem") || "energy", "test-lead-000b");
    return NextResponse.json({ test: testTo, status: res.status, data: res.data.slice(0, 200) });
  }

  const dry = searchParams.get("dry") === "1";

  const { data: flags } = await supabase
    .from("system_settings")
    .select("key,value")
    .in("key", ["kampagne_va_live", "kampagne_va_stop", "kampagne_va_karenz_tage", "kampagne_va_max_gesamt"]);
  const flag = (k: string) =>
    String(((flags || []) as Array<{ key: string; value: string }>).find((f) => f.key === k)?.value ?? "");

  if (flag("kampagne_va_stop") === "true") {
    return NextResponse.json({ ok: true, gestoppt: true, grund: "not_aus" });
  }

  const karenzRoh = Number(flag("kampagne_va_karenz_tage").trim() || NaN);
  const karenzTage =
    Number.isFinite(karenzRoh) && karenzRoh > 0 && karenzRoh <= KARENZ_TAGE_MAX ? karenzRoh : KARENZ_TAGE_STANDARD;
  const karenz = new Date(Date.now() - karenzTage * 86400000).toISOString();

  const maxRoh = Number(flag("kampagne_va_max_gesamt").trim() || NaN);
  const maxGesamt = Number.isFinite(maxRoh) && maxRoh > 0 ? maxRoh : MAX_GESAMT_STANDARD;

  // Gesamtlimit: wie viele haben die Mail schon? Die Auslieferung ist Handarbeit.
  const { count: bisher } = await supabase
    .from("wauwerk_leads")
    .select("id", { count: "exact", head: true })
    .eq("answers->>kampagne_va_sent", "true");
  const schonGesendet = bisher || 0;
  if (schonGesendet >= maxGesamt) {
    return NextResponse.json({ ok: true, fertig: true, gesendet: 0, grund: "limit_erreicht", schonGesendet, maxGesamt });
  }
  const restLimit = Math.min(BATCH, maxGesamt - schonGesendet);

  let abfrage: any = supabase
    .from("wauwerk_leads")
    .select("id, email, dog_name, answers, paid_at")
    .eq("status", "paid")
    .not("email", "is", null)
    .lt("paid_at", karenz)
    .is("answers->>lang", null)
    .is("answers->>unsubscribed", null)
    .is("answers->>premium_intake", null)
    .is("answers->>kampagne_va_sent", null);

  const { data, error } = await abfrage.order("paid_at", { ascending: false }).limit(BATCH * 3);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Lead = { id: string; email: string | null; dog_name: string | null; answers: Record<string, any> | null; paid_at: string | null };
  const leads = (data || []) as Lead[];
  if (leads.length === 0) {
    return NextResponse.json({ ok: true, fertig: true, gesendet: 0, grund: "keine_offenen", schonGesendet });
  }

  // Dedup ueber die E-Mail: Wiederholungskaeufer haben mehrere paid-Zeilen.
  const imBatch = leads.slice(0, restLimit);
  const mails = imBatch.map((l) => (l.email || "").toLowerCase()).filter(Boolean);
  const { data: schonMal } = await supabase.from("wauwerk_leads").select("email, answers").in("email", mails);
  const bereits = new Set(
    ((schonMal || []) as Array<{ email: string | null; answers: Record<string, any> | null }>)
      .filter((r) => (r.answers || {}).kampagne_va_sent || (r.answers || {}).premium_intake)
      .map((r) => (r.email || "").toLowerCase())
  );

  const gesehen = new Set<string>();
  const offen = imBatch.filter((l) => {
    const m = (l.email || "").toLowerCase();
    if (!m || bereits.has(m) || gesehen.has(m)) return false;
    gesehen.add(m);
    return true;
  });

  if (dry) {
    const b = offen[0];
    return NextResponse.json({
      ok: true,
      modus: "DRY-RUN",
      freigabe: flag("kampagne_va_live") === "true",
      karenz_tage: karenzTage,
      limit_gesamt: maxGesamt,
      schon_gesendet: schonGesendet,
      noch_offen_im_limit: Math.max(0, maxGesamt - schonGesendet),
      geladen: leads.length,
      im_batch: imBatch.length,
      nach_dedup: offen.length,
      beispiel: b
        ? {
            email: b.email,
            hund: b.dog_name,
            problem: (b.answers as any)?.dog_problem,
            betreff: subjectFor(b.dog_name || "deinem Hund", b.id),
            variante: variantOf(b.id),
          }
        : null,
    });
  }

  if (flag("kampagne_va_live") !== "true") {
    return NextResponse.json({ ok: true, gesendet: 0, grund: "nicht_freigegeben", bereit: offen.length });
  }

  let gesendet = 0;
  const fehler: Array<{ email: string; status: number; data: string }> = [];
  for (const l of offen) {
    const dog = l.dog_name || (l.answers as any)?.dog_name || "deinem Hund";
    const problem = String((l.answers as any)?.dog_problem || "");
    const res = await sendOne(l.email!, dog, problem, l.id);
    if (res.status >= 200 && res.status < 300) {
      gesendet++;
      const alt = (l.answers || {}) as Record<string, any>;
      await supabase
        .from("wauwerk_leads")
        .update({
          answers: {
            ...alt,
            kampagne_va_sent: true,
            kampagne_va_sent_at: new Date().toISOString(),
            kampagne_va_variant: variantOf(l.id),
          },
        })
        .eq("id", l.id);
    } else {
      fehler.push({ email: l.email!, status: res.status, data: res.data.slice(0, 160) });
    }
    await new Promise((r) => setTimeout(r, 80)); // ~12/s, SES erlaubt 14/s
  }

  return NextResponse.json({
    ok: true,
    gesendet,
    fehler: fehler.length,
    erste_fehler: fehler.slice(0, 3),
    schon_gesendet_gesamt: schonGesendet + gesendet,
    limit_gesamt: maxGesamt,
  });
}
