// Cross-Sell-Kampagne "Charakterprofil" — serverseitiger Batch-Versand über Amazon SES.
//
// WARUM: 80,8 % unserer Kunden kaufen genau einmal. An Bestandskäufer wird bisher
// nichts nachverkauft. Das Charakterprofil (24,90 €) ist das erste Produkt, das
// sich an sie richtet: Der Trainingsplan sagt, WAS geübt wird, das Profil erklärt,
// WARUM der Hund so ist, plus vier Übungen.
//
// ZIELGRUPPE (strikt, DACH-Käufer):
//   status = paid                        -> hat gekauft
//   answers.lang IS NULL                 -> nur deutscher Funnel (PL/IT haben lang gesetzt)
//   answers.unsubscribed IS NULL         -> nicht abgemeldet
//   answers.charakterprofil_sent_at NULL -> hat das Profil noch nicht gekauft
//   answers.kampagne_cp_sent NULL        -> eigener Dedup-Marker
//   paid_at älter als KARENZ_TAGE        -> frische Käufer bekommen erst ihren Plan
//   + Dedup ÜBER E-MAIL: Wiederholungskäufer haben mehrere paid-Zeilen. Ohne
//     diese Prüfung bekommt dieselbe Person die Mail mehrfach (Fehler aus der
//     Mail-1-Kampagne: 1.436 Personen, 1.665 überzählige Mails).
//
// SEGMENT: system_settings.kampagne_cp_segment steuert, wer drankommt:
//   "rasse" (Standard) -> nur Käufer mit konkreter Rasse. Die sehen auf der
//                         Landingpage KEINE Frage, sondern direkt ihr Profil.
//   "misch"            -> nur Mischlinge (eine Frage dazwischen)
//   "alle"             -> beide
// Die beiden Gruppen haben unterschiedliche Seiten-Logik, deshalb getrennt
// messen statt in einem Rutsch verschicken.
//
// FREIGABE: Der Cron sendet NUR, wenn system_settings.kampagne_cp_live = "true".
// Solange das fehlt, läuft er leer mit. Not-Aus: kampagne_cp_stop = "true".
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
const CAMPAIGN = "charakterprofil-crosssell";
const BATCH = 100;      // pro Lauf, SES erlaubt 14/s
const KARENZ_TAGE = 3;  // so lange nach dem Kauf schreiben wir nicht an

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

const MISCH = /mischling|mieszaniec|meticcio|andere rasse|unbekannt/i;
const istMisch = (r: string) => !r || MISCH.test(r);

function subjectFor(dog: string, rasse: string, id: string): string {
  const c = (id || "").replace(/[^0-9a-f]/gi, "").slice(-1).toLowerCase();
  const variantB = parseInt(c || "0", 16) % 2 === 1;
  if (variantB) return `Warum ${dog} so ist, wie ${dog} ist`;
  return istMisch(rasse) ? `Was in ${dog} eigentlich steckt` : `${dog} ist ein ${rasse}. Was das für euch heißt`;
}

function rasseZeile(dog: string, rasse: string): string {
  return istMisch(rasse)
    ? `Bei dir steht <strong>Mischling</strong> im Fragebogen. Genau da wird es spannend, denn ${dog} hat aus mehreren Richtungen Anlagen mitbekommen.`
    : `Bei dir steht <strong>${rasse}</strong> im Fragebogen. Und ziemlich viel von dem, was ${dog} macht, steht schon in dieser Zucht drin.`;
}
function rasseZeileText(dog: string, rasse: string): string {
  return istMisch(rasse)
    ? `Bei dir steht Mischling im Fragebogen. Genau da wird es spannend, denn ${dog} hat aus mehreren Richtungen Anlagen mitbekommen.`
    : `Bei dir steht ${rasse} im Fragebogen. Und ziemlich viel von dem, was ${dog} macht, steht schon in dieser Zucht drin.`;
}

function buildHtml(dog: string, rasse: string, id: string, email: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const cta = `https://www.pfoten-plan.de/charakterprofil.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  const wa = "https://wa.me/4915129892586?text=Hallo%2C%20ich%20habe%20eine%20Frage%20zum%20Charakterprofil%20%F0%9F%90%BE";
  const p = "margin:0 0 16px;font-size:16px;";
  const li = "margin:0 0 9px;font-size:15.5px;";
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pfoten-Plan</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;line-height:1.7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Der Plan sagt, was ihr übt. Das hier erklärt, warum er so ist.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 36px 6px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#8B7355;">🐾 Pfoten-Plan</div></td></tr>
<tr><td style="padding:14px 36px 8px;">
<p style="${p}">Hallo,</p>
<p style="${p}">du hast bei uns einen Trainingsplan für <strong>${dog}</strong> geholt. Der sagt dir, <strong>was</strong> ihr übt. Es gibt aber eine Frage, die der Plan nicht beantwortet: warum ${dog} überhaupt so ist.</p>
<p style="${p}">${rasseZeile(dog, rasse)}</p>
<p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#3a342b;">Das Charakterprofil für ${dog}</p>
<p style="${li}">🧬 Wofür seine Rasse gezüchtet wurde und was davon heute bei dir im Wohnzimmer ankommt</p>
<p style="${li}">🚶 Wie viel Gassi ${dog} wirklich braucht, wie lange und in welchem Tempo</p>
<p style="${li}">😴 Wie viele Stunden Schlaf nötig sind und woran du Übermüdung erkennst</p>
<p style="${li}">🧠 Welche Kopfarbeit zu ihm passt, und wie viel davon am Tag genug ist</p>
<p style="${li}">⚠️ Die typischen Baustellen seiner Rasse, jeweils mit Sofortmaßnahme</p>
<p style="margin:0 0 16px;font-size:15.5px;">🚫 Und die drei Dinge, die gut gemeint sind und ihm trotzdem schaden</p>
<p style="${p}">Dazu <strong>vier Übungen</strong> mit Schritt-für-Schritt-Anleitung und ein 7-Tage-Start zum Abhaken. Also nicht nur erklärt, sondern auch etwas zum Machen.</p>
<p style="${p}">Zwei Fragen beantworten reicht, das Profil kommt anschließend als PDF per E-Mail.</p>
</td></tr>
<tr><td style="padding:4px 36px 6px;text-align:center;">
<a href="${cta}" style="display:inline-block;background:#8B7355;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 34px;border-radius:12px;">${dog}s Charakterprofil ansehen</a>
<p style="margin:10px 0 0;font-size:13.5px;color:#6B7280;">Einmalig, kein Abo. Kommt sofort per E-Mail.</p>
</td></tr>
<tr><td style="padding:20px 36px 4px;">
<p style="margin:0 0 6px;font-size:16px;">Viele Grüße an ${dog},</p>
<p style="margin:0;font-size:16px;"><strong>Laura</strong> vom Pfoten-Plan-Team</p>
</td></tr>
<tr><td style="padding:6px 36px 26px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F1FAF2;border:1px solid #C9E7CE;border-radius:14px;"><tr><td style="padding:16px 18px;">
<p style="margin:0 0 10px;font-size:15px;color:#1f2937;">Eine Frage zu ${dog} oder zum Profil? Schreib uns einfach, per E-Mail oder direkt auf <strong>WhatsApp</strong>.</p>
<a href="${wa}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:11px 20px;border-radius:10px;">💬 Auf WhatsApp schreiben</a>
<p style="margin:10px 0 0;font-size:14px;color:#4B5563;">oder direkt speichern: <a href="${wa}" style="color:#166534;font-weight:700;text-decoration:none;">+49 151 29892586</a></p>
<p style="margin:6px 0 0;font-size:12.5px;color:#6B7280;">Wir antworten so schnell wir können, es schreibt dir ein echter Mensch.</p>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;"><p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.7;">Pfoten-Plan · Persönliches Hundetraining<br>Keine Post mehr? <a href="${unsub}" style="color:#9CA3AF;text-decoration:underline;">Hier abmelden</a>.</p></td></tr>
</table></td></tr></table></body></html>`;
}

function buildText(dog: string, rasse: string, id: string, email: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const cta = `https://www.pfoten-plan.de/charakterprofil.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  return `Hallo,

du hast bei uns einen Trainingsplan für ${dog} geholt. Der sagt dir, was ihr übt. Es gibt aber eine Frage, die der Plan nicht beantwortet: warum ${dog} überhaupt so ist.

${rasseZeileText(dog, rasse)}

DAS CHARAKTERPROFIL FÜR ${dog.toUpperCase()}
- Wofür seine Rasse gezüchtet wurde und was davon heute bei dir im Wohnzimmer ankommt
- Wie viel Gassi ${dog} wirklich braucht, wie lange und in welchem Tempo
- Wie viele Stunden Schlaf nötig sind und woran du Übermüdung erkennst
- Welche Kopfarbeit zu ihm passt, und wie viel davon am Tag genug ist
- Die typischen Baustellen seiner Rasse, jeweils mit Sofortmaßnahme
- Und die drei Dinge, die gut gemeint sind und ihm trotzdem schaden

Dazu vier Übungen mit Schritt-für-Schritt-Anleitung und ein 7-Tage-Start zum Abhaken. Also nicht nur erklärt, sondern auch etwas zum Machen.

Zwei Fragen beantworten reicht, das Profil kommt anschließend als PDF per E-Mail:
${cta}

Einmalig, kein Abo. Kommt sofort per E-Mail.

Viele Grüße an ${dog},
Laura vom Pfoten-Plan-Team

Eine Frage zu ${dog} oder zum Profil? Schreib uns einfach,
per Antwort auf diese Mail oder direkt auf WhatsApp: +49 151 29892586
(Wir antworten so schnell wir können, es schreibt dir ein echter Mensch.)

Keine Post mehr? Hier abmelden: ${unsub}`;
}

async function sendOne(email: string, dog: string, rasse: string, id: string) {
  return ses("POST", "/v2/email/outbound-emails", {
    FromEmailAddress: FROM,
    Destination: { ToAddresses: [email] },
    ReplyToAddresses: ["support@pfoten-plan.de"],
    ConfigurationSetName: CONFIG_SET,
    EmailTags: [{ Name: "campaign", Value: CAMPAIGN }],
    Content: {
      Simple: {
        Subject: { Data: subjectFor(dog, rasse, id), Charset: "UTF-8" },
        Body: {
          Html: { Data: buildHtml(dog, rasse, id, email), Charset: "UTF-8" },
          Text: { Data: buildText(dog, rasse, id, email), Charset: "UTF-8" },
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
    const res = await sendOne(testTo, "Bella", searchParams.get("rasse") || "Labrador Retriever", "test-lead-000b");
    return NextResponse.json({ test: testTo, status: res.status, data: res.data.slice(0, 200) });
  }

  const dry = searchParams.get("dry") === "1";

  // Freigabe + Not-Aus (beides ohne Vercel-Zugriff schaltbar)
  const { data: flags } = await supabase
    .from("system_settings")
    .select("key,value")
    .in("key", ["kampagne_cp_live", "kampagne_cp_stop", "kampagne_cp_segment"]);
  const flag = (k: string) => String((flags || []).find((f: any) => f.key === k)?.value || "");
  if (!dry && flag("kampagne_cp_live") !== "true") {
    return NextResponse.json({ ok: true, wartet: true, hinweis: "system_settings.kampagne_cp_live ist nicht auf true" });
  }
  if (flag("kampagne_cp_stop") === "true") {
    return NextResponse.json({ ok: true, gestoppt: true, hinweis: "system_settings.kampagne_cp_stop ist gesetzt" });
  }
  const segment = ["rasse", "misch", "alle"].includes(flag("kampagne_cp_segment"))
    ? flag("kampagne_cp_segment")
    : "rasse";
  const imSegment = (a: Record<string, any>) => {
    if (segment === "alle") return true;
    const m = istMisch(String(a?.dog_breed || "").trim());
    return segment === "misch" ? m : !m;
  };

  const karenz = new Date(Date.now() - KARENZ_TAGE * 86400000).toISOString();

  let abfrage = supabase
    .from("wauwerk_leads")
    .select("id, email, dog_name, answers, paid_at")
    .eq("status", "paid")
    .not("email", "is", null)
    .lt("paid_at", karenz)
    .is("answers->>lang", null)
    .is("answers->>unsubscribed", null)
    .is("answers->>charakterprofil_sent_at", null)
    .is("answers->>kampagne_cp_sent", null);

  // Segment "rasse" schon in der Abfrage eingrenzen. Sonst koennten am Ende der
  // Runde einzelne Rasse-Kaeufer hinter einer Wand von Mischlingen haengen
  // bleiben und nie eine Mail bekommen. Der JS-Filter unten bleibt als zweite
  // Sicherung (faengt z.B. leere Strings).
  if (segment === "rasse") {
    for (const wort of ["mischling", "mieszaniec", "meticcio", "andere rasse", "unbekannt"]) {
      abfrage = abfrage.not("answers->>dog_breed", "ilike", `%${wort}%`);
    }
    abfrage = abfrage.not("answers->>dog_breed", "is", null);
  }

  const { data: leads, error } = await abfrage
    .order("paid_at", { ascending: false })
    .limit(BATCH * 4); // grob ziehen, danach auf das Segment filtern

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!leads || leads.length === 0) {
    return NextResponse.json({ ok: true, fertig: true, gesendet: 0, grund: "keine_offenen" });
  }
  // Nur das freigegebene Segment, dann auf die Batch-Groesse kuerzen.
  // Uebersprungene werden NICHT markiert, die kommen in ihrer eigenen Runde dran.
  const roh = leads.length;
  const imBatch = leads.filter((l) => imSegment((l.answers || {}) as any)).slice(0, BATCH);
  if (imBatch.length === 0) {
    return NextResponse.json({ ok: true, fertig: true, gesendet: 0, segment, grund: "segment_leer", roh });
  }

  // Dedup über die E-Mail: Wiederholungskäufer haben mehrere paid-Zeilen.
  const mails = imBatch.map((l) => (l.email || "").toLowerCase()).filter(Boolean);
  const { data: schonMal } = await supabase
    .from("wauwerk_leads")
    .select("email, answers")
    .in("email", mails);
  const bereits = new Set(
    (schonMal || [])
      .filter((r: any) => (r.answers || {}).kampagne_cp_sent || (r.answers || {}).charakterprofil_sent_at)
      .map((r: any) => (r.email || "").toLowerCase())
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
      freigabe: flag("kampagne_cp_live") === "true",
      segment,
      roh_geladen: roh,
      im_batch: imBatch.length,
      davon_dubletten_oder_schon_versendet: imBatch.length - offen.length,
      beispiel: b
        ? {
            email: b.email,
            hund: b.dog_name,
            rasse: (b.answers as any)?.dog_breed || "",
            betreff: subjectFor(b.dog_name || "deinem Hund", (b.answers as any)?.dog_breed || "", b.id),
          }
        : null,
    });
  }

  let ok = 0, err = 0, skip = 0;
  const gesehen = new Set<string>();
  for (const l of imBatch) {
    const mail = (l.email || "").toLowerCase();
    const prev = (l.answers || {}) as Record<string, any>;
    if (bereits.has(mail) || gesehen.has(mail)) {
      skip++;
      await supabase
        .from("wauwerk_leads")
        .update({ answers: { ...prev, kampagne_cp_sent: "skip_dublette" } })
        .eq("id", l.id);
      continue;
    }
    gesehen.add(mail);
    const dog = (l.dog_name || "").trim() || "deinem Hund";
    const rasse = String(prev.dog_breed || "").trim();
    let res;
    try {
      res = await sendOne(l.email, dog, rasse, l.id);
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
            kampagne_cp_sent: true,
            kampagne_cp_sent_at: new Date().toISOString(),
            kampagne_cp_variant: subjectFor("x", rasse, l.id).startsWith("Warum") ? "B" : "A",
          },
        })
        .eq("id", l.id);
    } else {
      err++;
    }
  }

  return NextResponse.json({ ok: true, modus: "LIVE", segment, gesendet: ok, uebersprungen_dublette: skip, fehler: err, batch: imBatch.length });
}
