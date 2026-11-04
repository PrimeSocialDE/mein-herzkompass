// Silvester-Plan an Käufer (Sonntag) + Erinnerung an Klicker (Montag).
// Batch-Versand über Amazon SES, gleiches Muster wie kampagne-charakterprofil-w2.
//
// WARUM SONNTAG: Sonntag ist unser stärkster Verkaufstag (14.09.-01.11.: 457 bezahlte
// Zahlungen und 68 Produkt-Käufe am Sonntag gegen 29 am Montag und 3-15 an den
// übrigen Tagen). Der Montag bekommt nur eine kurze Erinnerung an alle, die am
// Sonntag geklickt, aber nicht gekauft haben.
//
// WELLE 1 (?welle=1, Standard), sonntags:
//   status = paid, answers.lang IS NULL, answers.unsubscribed IS NULL
//   answers.silvester_sent_at NULL           -> Plan nicht gekauft
//   answers.kampagne_sv_sent NULL            -> eigener Dedup-Marker
//   paid_at älter als KARENZ_TAGE            -> frische Käufer haben gerade /zusatz gesehen
//   + Dedup über die E-Mail (Wiederholungskäufer, Abmeldung auf anderer Zeile)
// WELLE 2 (?welle=2), montags:
//   answers.kampagne_sv_sent = true, kampagne_sv_klick_at gesetzt (Klick-Route
//   /api/kampagne/klick), silvester_sent_at NULL, kampagne_sv2_sent NULL,
//   Welle-1-Mail mindestens 20 Stunden alt
//
// SAISON: ab dem 21.12. sendet die Route nichts mehr (Training lohnt dann kaum).
// FREIGABE: nur mit system_settings.kampagne_sv_live = "true".
// Not-Aus: kampagne_sv_stop = "true".
//   ?dry=1[&welle=2] -> zeigt nur, wer dran wäre
//   ?test=mail@x.de[&welle=2&g=female] -> eine Mustermail

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { silvesterWochen } from "@/lib/silvester-content";
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
const CAMPAIGN = "silvester-kampagne";
const BATCH = 100;       // pro Lauf, SES erlaubt 14/s
const KARENZ_TAGE = 3;   // so lange nach dem Plankauf frühestens

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

// Freitext aus dem Fragebogen landet im HTML.
const sauber = (s: string) => s.replace(/[<>"&]/g, "").trim();

function variantB(id: string): boolean {
  const c = (id || "").replace(/[^0-9a-f]/gi, "").slice(-1).toLowerCase();
  return parseInt(c || "0", 16) % 2 === 1;
}

function pron(g: string) {
  return g === "female" ? { er: "sie", ihn: "sie", sein: "ihr" } : { er: "er", ihn: "ihn", sein: "sein" };
}

// Tage bis Silvester, Trainingswochen und Start der ersten Woche, wie im Plan.
function zeit() {
  const { wochen, tageBis } = silvesterWochen(new Date());
  const start = (wochen[0]?.zeitraum || "").split("–")[0].trim();
  return { tage: tageBis, wochen: wochen.length, start };
}

function subjectFor(dog: string, id: string, welle: 1 | 2): string {
  const { tage } = zeit();
  if (welle === 2) return `${dog} und Silvester: Woche 1 beginnt jetzt`;
  if (variantB(id)) return `${dog} und Silvester: Jetzt ist der beste Zeitpunkt`;
  return `Noch ${tage} Tage: So kommt ${dog} ruhiger durch Silvester`;
}

// Der Link geht über die Klick-Route: sie vermerkt den Klick am Lead (für die
// Montags-Erinnerung) und leitet dann auf die Landingpage weiter.
function ctaUrl(id: string, email: string, welle: 1 | 2): string {
  const ziel = new URLSearchParams({ lead_id: id, email, utm_source: "email", utm_medium: "kampagne", utm_campaign: welle === 2 ? `${CAMPAIGN}-erinnerung` : CAMPAIGN });
  const q = new URLSearchParams({ l: id, k: "sv", u: `/silvester-plan?${ziel.toString()}` });
  return `https://www.pfoten-plan.de/api/kampagne/klick?${q.toString()}`;
}

function absaetze(dog: string, g: string, welle: 1 | 2): string[] {
  const p = pron(g);
  const { tage, wochen, start } = zeit();
  if (welle === 2) {
    return [
      `nur ein kurzer Nachtrag zu gestern: Bis Silvester sind es noch ${tage} Tage.`,
      `Wenn du ${dog}s Silvester-Plan heute bestellst, hat ${p.er} noch ${wochen} volle Trainingswochen. Woche 1 beginnt ${start ? "am " + start : "morgen"} und dauert jeden Tag nur ein paar Minuten: einen sicheren Rückzugsort einrichten, ein Wort für Ruhe aufbauen, und Kauen als eingebaute Beruhigung.`,
      `Je später du anfängst, desto weniger Gewöhnung schafft ${dog} bis zur Nacht. Darum melde ich mich heute noch einmal.`,
    ];
  }
  return [
    `in ${tage} Tagen ist Silvester. Für viele Hunde ist das die schlimmste Nacht des Jahres: Zittern, Hecheln, Verstecken, und manche brauchen danach Tage, bis sie wieder ruhig sind.`,
    `Das Gute: Knallangst lässt sich trainieren. Nur eben nicht in einer Nacht, sondern in kleinen Schritten über ein paar Wochen. Wer jetzt anfängt, hat diese Wochen noch.`,
    `Deshalb gibt es jetzt den <strong>Silvester-Plan für ${dog}</strong>. Er rechnet aus, wie viel Zeit euch bleibt, und legt fest, was wann dran ist. Wenn du heute startest, sind das ${wochen} Trainingswochen, die erste beginnt ${start ? "am " + start : "morgen"}.`,
  ];
}

function bullets(dog: string): string[] {
  return [
    `📅 Ein Wochenplan bis zum 31.12. mit festen Daten, jeden Tag nur ein paar Minuten`,
    `🔈 12 Übungen: sicherer Rückzugsort, Gewöhnung an Knallgeräusche, Gassi-Routine für Dezember`,
    `🕛 Der Ablauf für die Silvesternacht, vom 30.12. bis zum Neujahrsmorgen`,
    `🩺 Wann du mit der Tierärztin sprechen solltest, und was du dort fragen kannst`,
  ];
}

function buildHtml(dog: string, g: string, id: string, email: string, welle: 1 | 2): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const cta = ctaUrl(id, email, welle);
  const wa = "https://wa.me/4915129892586?text=Hallo%2C%20ich%20habe%20eine%20Frage%20zum%20Silvester-Plan%20%F0%9F%90%BE";
  const s = "margin:0 0 16px;font-size:16px;";
  const li = "margin:0 0 9px;font-size:15.5px;";
  const { tage } = zeit();
  const text = absaetze(dog, g, welle).map((t) => `<p style="${s}">${t}</p>`).join("\n");
  const liste = welle === 1 ? bullets(dog).map((t, i, a) => `<p style="${i === a.length - 1 ? "margin:0 0 16px;font-size:15.5px;" : li}">${t}</p>`).join("\n") : "";
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pfoten-Plan</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;line-height:1.7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Noch ${tage} Tage. Wer jetzt anfängt, hat die Wochen noch, die ${dog} braucht.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 36px 6px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#8B7355;">🐾 Pfoten-Plan</div></td></tr>
<tr><td style="padding:14px 36px 8px;">
<p style="${s}">Hallo,</p>
${text}
${liste}
</td></tr>
<tr><td style="padding:4px 36px 6px;text-align:center;">
<a href="${cta}" style="display:inline-block;background:#8B7355;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 34px;border-radius:12px;">${dog}s Silvester-Plan ansehen</a>
<p style="margin:10px 0 0;font-size:13.5px;color:#6B7280;">24,99 €, einmalig, kein Abo. Kommt in wenigen Minuten als PDF per E-Mail.</p>
</td></tr>
<tr><td style="padding:20px 36px 4px;">
<p style="margin:0 0 6px;font-size:16px;">Viele Grüße an ${dog},</p>
<p style="margin:0;font-size:16px;"><strong>Laura</strong> vom Pfoten-Plan-Team</p>
</td></tr>
<tr><td style="padding:6px 36px 26px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F1FAF2;border:1px solid #C9E7CE;border-radius:14px;"><tr><td style="padding:16px 18px;">
<p style="margin:0 0 10px;font-size:15px;color:#1f2937;">Eine Frage zu ${dog} oder zum Plan? Schreib uns einfach, per E-Mail oder direkt auf <strong>WhatsApp</strong>.</p>
<a href="${wa}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:11px 20px;border-radius:10px;">💬 Auf WhatsApp schreiben</a>
<p style="margin:6px 0 0;font-size:12.5px;color:#6B7280;">Es schreibt dir ein echter Mensch.</p>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;"><p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.7;">Pfoten-Plan · Persönliches Hundetraining<br>Keine Post mehr? <a href="${unsub}" style="color:#9CA3AF;text-decoration:underline;">Hier abmelden</a>.</p></td></tr>
</table></td></tr></table></body></html>`;
}

function buildText(dog: string, g: string, id: string, email: string, welle: 1 | 2): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const text = absaetze(dog, g, welle).map((t) => t.replace(/<\/?strong>/g, "")).join("\n\n");
  const liste = welle === 1 ? "\n\n" + bullets(dog).map((t) => "- " + t.replace(/^\S+\s/, "")).join("\n") : "";
  return `Hallo,

${text}${liste}

${dog}s Silvester-Plan ansehen:
${ctaUrl(id, email, welle)}

24,99 €, einmalig, kein Abo. Kommt in wenigen Minuten als PDF per E-Mail.

Viele Grüße an ${dog},
Laura vom Pfoten-Plan-Team

Eine Frage? Antworte einfach auf diese Mail oder schreib uns auf WhatsApp: +49 151 29892586

Keine Post mehr? Hier abmelden: ${unsub}`;
}

async function sendOne(email: string, dog: string, g: string, id: string, welle: 1 | 2) {
  return ses("POST", "/v2/email/outbound-emails", {
    FromEmailAddress: FROM,
    Destination: { ToAddresses: [email] },
    ReplyToAddresses: ["support@pfoten-plan.de"],
    ConfigurationSetName: CONFIG_SET,
    EmailTags: [{ Name: "campaign", Value: welle === 2 ? `${CAMPAIGN}-erinnerung` : CAMPAIGN }],
    Content: {
      Simple: {
        Subject: { Data: subjectFor(dog, id, welle), Charset: "UTF-8" },
        Body: {
          Html: { Data: buildHtml(dog, g, id, email, welle), Charset: "UTF-8" },
          Text: { Data: buildText(dog, g, id, email, welle), Charset: "UTF-8" },
        },
        Headers: [
          { Name: "List-Unsubscribe", Value: `<https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}>, <mailto:hallo@pfoten-post.de?subject=unsubscribe>` },
          { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
        ],
      },
    },
  });
}

// Marker frisch lesen und mergen: zwischen Abfrage und Versand kann z. B. der
// Webhook silvester_sent_at gesetzt haben (answers-Merge-Regel).
async function markiere(id: string, felder: Record<string, any>) {
  const { data } = await supabase.from("wauwerk_leads").select("answers").eq("id", id).maybeSingle();
  await supabase
    .from("wauwerk_leads")
    .update({ answers: { ...(((data?.answers as any) || {}) as Record<string, any>), ...felder } })
    .eq("id", id);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!AK || !SK) return NextResponse.json({ error: "aws_credentials_missing" }, { status: 500 });
  const welle: 1 | 2 = searchParams.get("welle") === "2" ? 2 : 1;

  const testTo = searchParams.get("test");
  if (testTo) {
    const res = await sendOne(testTo, "Bella", searchParams.get("g") || "female", searchParams.get("id") || "test-lead-000b", welle);
    return NextResponse.json({ test: testTo, welle, status: res.status, data: res.data.slice(0, 200) });
  }

  const dry = searchParams.get("dry") === "1";
  const { tage } = zeit();
  if (tage < 10) {
    return NextResponse.json({ ok: true, saison_vorbei: true, hinweis: "ab dem 21.12. keine Silvester-Kampagne mehr" });
  }

  const { data: flags } = await supabase
    .from("system_settings")
    .select("key,value")
    .in("key", ["kampagne_sv_live", "kampagne_sv_stop"]);
  const flag = (k: string) => String((flags || []).find((f: any) => f.key === k)?.value || "");
  if (!dry && flag("kampagne_sv_live") !== "true") {
    return NextResponse.json({ ok: true, wartet: true, hinweis: "system_settings.kampagne_sv_live ist nicht auf true" });
  }
  if (flag("kampagne_sv_stop") === "true") {
    return NextResponse.json({ ok: true, gestoppt: true, hinweis: "system_settings.kampagne_sv_stop ist gesetzt" });
  }

  let abfrage = (supabase as any)
    .from("wauwerk_leads")
    .select("id, email, dog_name, answers")
    .eq("status", "paid")
    .not("email", "is", null)
    .is("answers->>lang", null)
    .is("answers->>unsubscribed", null)
    .is("answers->>silvester_sent_at", null);
  if (welle === 1) {
    abfrage = abfrage
      .is("answers->>kampagne_sv_sent", null)
      .lt("paid_at", new Date(Date.now() - KARENZ_TAGE * 86400000).toISOString());
  } else {
    abfrage = abfrage
      .eq("answers->>kampagne_sv_sent", "true")
      .not("answers->>kampagne_sv_klick_at", "is", null)
      .lt("answers->>kampagne_sv_sent_at", new Date(Date.now() - 20 * 3600000).toISOString())
      .is("answers->>kampagne_sv2_sent", null);
  }
  const { data, error } = await abfrage.order("paid_at", { ascending: false }).limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Lead = { id: string; email: string | null; dog_name: string | null; answers: Record<string, any> | null };
  const imBatch = (data || []) as Lead[];
  if (imBatch.length === 0) {
    return NextResponse.json({ ok: true, welle, fertig: true, gesendet: 0, grund: "keine_offenen" });
  }

  // Dedup über die E-Mail: schon angeschrieben, schon gekauft oder auf einer
  // anderen Zeile abgemeldet.
  const marker = welle === 1 ? "kampagne_sv_sent" : "kampagne_sv2_sent";
  const mails = imBatch.map((l) => (l.email || "").toLowerCase()).filter(Boolean);
  const { data: andere } = await supabase.from("wauwerk_leads").select("email, answers").in("email", mails);
  const bereits = new Set(
    ((andere || []) as Array<{ email: string | null; answers: Record<string, any> | null }>)
      .filter((r) => {
        const a = r.answers || {};
        return a[marker] || a.silvester_sent_at || a.unsubscribed;
      })
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
      welle,
      freigabe: flag("kampagne_sv_live") === "true",
      im_batch: imBatch.length,
      davon_dubletten_oder_schon_versendet: imBatch.length - offen.length,
      beispiel: b ? { email: b.email, hund: b.dog_name, betreff: subjectFor(sauber(b.dog_name || "") || "deinem Hund", b.id, welle) } : null,
    });
  }

  let ok = 0, err = 0, skip = 0;
  const gesehen = new Set<string>();
  for (const l of imBatch) {
    const mail = (l.email || "").toLowerCase();
    if (bereits.has(mail) || gesehen.has(mail)) {
      skip++;
      await markiere(l.id, { [marker]: "skip_dublette" });
      continue;
    }
    gesehen.add(mail);
    const dog = sauber(l.dog_name || "");
    if (!dog) {
      skip++;
      await markiere(l.id, { [marker]: "skip_kein_name" });
      continue;
    }
    const g = String((l.answers || {}).dog_gender || "");
    let res;
    try {
      res = await sendOne(String(l.email), dog, g, l.id, welle);
    } catch {
      err++;
      continue; // nicht markieren -> nächster Lauf versucht es erneut
    }
    if (res.status < 300) {
      ok++;
      await markiere(
        l.id,
        welle === 1
          ? { kampagne_sv_sent: true, kampagne_sv_sent_at: new Date().toISOString(), kampagne_sv_variant: variantB(l.id) ? "B" : "A" }
          : { kampagne_sv2_sent: true, kampagne_sv2_sent_at: new Date().toISOString() }
      );
    } else {
      err++;
    }
  }

  return NextResponse.json({ ok: true, modus: "LIVE", welle, gesendet: ok, uebersprungen: skip, fehler: err, batch: imBatch.length });
}
