// Cross-Sell-Kampagne "Körpersprache-Heft" (19,90 €) — Batch-Versand über Amazon SES.
// Aufbau wie kampagne-charakterprofil (Muster dort ausführlich erklärt).
//
// ZIELGRUPPE: DACH-Käufer (status=paid, answers.lang NULL), nicht abgemeldet,
//   Heft noch nicht gekauft (answers.koerpersprache_sent_at NULL), eigener
//   Marker answers.kampagne_ks_sent, Kauf älter als Karenz, Dedup über E-Mail.
// INHALT: Gratis-Kostprobe (3 Signale mit Zeichnung) direkt in der Mail,
//   Problem-Zeile nach dog_problem, Betreff-A/B über die Lead-ID.
// FREIGABE: system_settings.kampagne_ks_live = "true", Not-Aus kampagne_ks_stop,
//   Karenz kampagne_ks_karenz_tage (Standard 7), Gesamtdeckel kampagne_ks_max_gesamt.
//   ?dry=1 · ?test=mail@x.de&problem=leash-reactive

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
const CAMPAIGN = "koerpersprache-crosssell";
const BATCH = 100;      // pro Lauf, SES erlaubt 14/s
const KARENZ_TAGE_STANDARD = 7; // so lange nach dem Kauf schreiben wir nicht an
const KARENZ_TAGE_MAX = 3650;   // Sicherheitsnetz gegen Tippfehler im Schalter

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


const IMG = "https://www.pfoten-plan.de/koerpersprache";

const PROBLEM_SATZ: Record<string, string> = {
  pulling: "Gerade beim Ziehen an der Leine zeigt dein Hund meist Sekunden vorher, dass die Aufregung steigt.",
  "leash-reactive": "Gerade bevor ein Hund an der Leine ausrastet, gibt es fast immer Signale. Wer sie sieht, kann vorher ausweichen.",
  "dog-reactive": "Gerade bei Hundebegegnungen kippt die Stimmung in kleinen Schritten, und jeder Schritt ist sichtbar.",
  aggression: "Gerade bei aggressivem Verhalten gibt es fast immer eine Vorwarnkette, die man lernen kann.",
  barking: "Gerade Bellen ist oft die letzte Stufe. Die Signale davor zeigen dir, wann du ihn noch erreichst.",
  anxiety: "Gerade ängstliche Hunde zeigen ihre Angst zuerst ganz leise.",
  separation: "Gerade beim Alleinbleiben beginnt der Stress oft schon, wenn du die Schuhe anziehst.",
  jumping: "Gerade beim Anspringen siehst du die Aufregung schon, bevor er abhebt.",
  recall: "Gerade kurz bevor ein Hund nicht mehr hört, verändert sich sein Körper.",
  energy: "Gerade bei viel Energie zeigt der Körper früh, wann Spiel in Überdrehtheit kippt.",
};

function subjectFor(dog: string, id: string, gender = ""): string {
  const c = (id || "").replace(/[^0-9a-f]/gi, "").slice(-1).toLowerCase();
  const variantB = parseInt(c || "0", 16) % 2 === 1;
  const pron = gender === "female" ? "sie" : "er";
  return variantB ? `Gähnt ${dog} manchmal, obwohl ${pron} nicht müde ist?` : `Was ${dog} dir eigentlich sagen will`;
}

function signalBlock(img: string, farbe: string, label: string, titel: string, text: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #EADDC5;border-radius:12px;margin:0 0 10px;background:#FFFFFF;"><tr>
<td width="120" style="padding:10px;"><img src="${IMG}/${img}" width="110" alt="" style="width:110px;height:auto;border-radius:8px;display:block;"></td>
<td style="padding:10px 12px 10px 0;"><span style="display:inline-block;background:${farbe};color:#fff;font-size:11px;font-weight:700;border-radius:999px;padding:2px 9px;">${label}</span>
<div style="font-size:16px;font-weight:700;margin:4px 0 2px;color:#2A2118;">${titel}</div>
<div style="font-size:14.5px;color:#4B5563;line-height:1.5;">${text}</div></td></tr></table>`;
}

function buildHtml(dog: string, problem: string, id: string, email: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const cta = `https://www.pfoten-plan.de/koerpersprache.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  const p = "margin:0 0 16px;font-size:16px;";
  const li = "margin:0 0 8px;font-size:15.5px;";
  const satz = PROBLEM_SATZ[problem] ? `<p style="${p}">${PROBLEM_SATZ[problem]}</p>` : "";
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pfoten-Plan</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;line-height:1.7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Drei Signale gratis, die fast alle übersehen.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 36px 6px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#8B7355;">🐾 Pfoten-Plan</div></td></tr>
<tr><td style="padding:14px 36px 4px;">
<p style="${p}">Hallo,</p>
<p style="${p}"><strong>${dog}</strong> spricht ständig mit dir. Nur eben nicht mit Worten, sondern mit dem Körper. Viele Missverständnisse entstehen nicht, weil ein Hund „nicht hört“, sondern weil wir seine Signale übersehen.</p>
${satz}
<p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#3a342b;">Drei Signale, die fast alle übersehen (gratis für dich):</p>
${signalBlock("k03.jpg", "#C99628", "Gelb", "Gähnen", "Ist er dabei nicht müde, beruhigt er sich selbst: „Ich will keinen Ärger.“ Nimm Druck raus, sprich leiser, geh einen Schritt zurück.")}
${signalBlock("k08.jpg", "#C99628", "Gelb", "Das Weiße im Auge", "Kopf weg, Blick zurück, man sieht einen weißen Halbmond: deutliches Unwohlsein, oft kurz vor dem Erstarren. Sofort loslassen.")}
${signalBlock("k14.jpg", "#B23A2C", "Rot", "Knurren", "Keine Unart, sondern seine Warnung. Wer Knurren bestraft, bekommt einen Hund, der ohne Vorwarnung schnappt.")}
</td></tr>
<tr><td style="padding:10px 36px 4px;">
<p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#3a342b;">Im Heft „Was ${dog} dir sagen will“:</p>
<p style="${li}">🚦 18 Körpersignale mit Ampel, jeweils: was du siehst, was es bedeutet, was du dann tust</p>
<p style="${li}">🎯 Eine eigene Seite mit den 4 wichtigsten Signalen für ${dog}</p>
<p style="${li}">🚪 Was er von dir will: Kratzen an der Tür, Winseln, Unruhe</p>
<p style="${li}">🛋️ So bringst du ihn zur Ruhe, und wie du ihn richtig auslastest</p>
<p style="${li}">🩺 Keine Panik: Rückwärtsniesen und Co., was harmlos ist und wann zum Tierarzt</p>
<p style="margin:0 0 16px;font-size:15.5px;">🎁 Gratis dazu: Spickzettel mit den 5 Warnsignalen für die Jackentasche</p>
</td></tr>
<tr><td style="padding:4px 36px 6px;text-align:center;">
<a href="${cta}" style="display:inline-block;background:#8B7355;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 34px;border-radius:12px;">Heft für ${dog} ansehen</a>
<p style="margin:10px 0 0;font-size:13.5px;color:#6B7280;">Einmalig, kein Abo. Kommt sofort als PDF per E-Mail.</p>
</td></tr>
<tr><td style="padding:20px 36px 26px;">
<p style="margin:0 0 6px;font-size:16px;">Viele Grüße an ${dog},</p>
<p style="margin:0;font-size:16px;"><strong>Laura</strong> vom Pfoten-Plan-Team</p>
</td></tr>
<tr><td style="padding:16px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;"><p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.7;">Pfoten-Plan · Persönliches Hundetraining<br>Keine Post mehr? <a href="${unsub}" style="color:#9CA3AF;text-decoration:underline;">Hier abmelden</a>.</p></td></tr>
</table></td></tr></table></body></html>`;
}

function buildText(dog: string, problem: string, id: string, email: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const cta = `https://www.pfoten-plan.de/koerpersprache.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  return `Hallo,

${dog} spricht ständig mit dir. Nur eben nicht mit Worten, sondern mit dem Körper.
${PROBLEM_SATZ[problem] ? "\n" + PROBLEM_SATZ[problem] + "\n" : ""}
Drei Signale, die fast alle übersehen (gratis für dich):
- Gähnen: Ist er dabei nicht müde, beruhigt er sich selbst. Nimm Druck raus.
- Das Weiße im Auge: deutliches Unwohlsein, oft kurz vor dem Erstarren. Sofort loslassen.
- Knurren: seine Warnung. Wer Knurren bestraft, bekommt einen Hund, der ohne Vorwarnung schnappt.

Im Heft "Was ${dog} dir sagen will": 18 Körpersignale mit Ampel, die 4 wichtigsten Signale für ${dog}, was er von dir will (Kratzen an der Tür, Winseln), so bringst du ihn zur Ruhe, richtig auslasten, und "Keine Panik" (Rückwärtsniesen und Co.). Gratis dazu: Spickzettel mit den 5 Warnsignalen.

${cta}

Einmalig, kein Abo. Kommt sofort als PDF per E-Mail.

Viele Grüße an ${dog},
Laura vom Pfoten-Plan-Team

Keine Post mehr? Hier abmelden: ${unsub}`;
}

async function sendOne(email: string, dog: string, problem: string, id: string, gender = "") {
  return ses("POST", "/v2/email/outbound-emails", {
    FromEmailAddress: FROM,
    Destination: { ToAddresses: [email] },
    ReplyToAddresses: ["support@pfoten-plan.de"],
    ConfigurationSetName: CONFIG_SET,
    EmailTags: [{ Name: "campaign", Value: CAMPAIGN }],
    Content: {
      Simple: {
        Subject: { Data: subjectFor(dog, id, gender), Charset: "UTF-8" },
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
    const res = await sendOne(testTo, searchParams.get("dog") || "Bella", searchParams.get("problem") || "leash-reactive", searchParams.get("id") || "test-lead-000a", searchParams.get("gender") || "");
    return NextResponse.json({ test: testTo, status: res.status, data: res.data.slice(0, 200) });
  }

  const dry = searchParams.get("dry") === "1";
  const { data: flags } = await supabase
    .from("system_settings")
    .select("key,value")
    .in("key", ["kampagne_ks_live", "kampagne_ks_stop", "kampagne_ks_karenz_tage", "kampagne_ks_max_gesamt"]);
  const flag = (k: string) => String((flags || []).find((f: any) => f.key === k)?.value || "");
  if (!dry && flag("kampagne_ks_live") !== "true") {
    return NextResponse.json({ ok: true, wartet: true, hinweis: "system_settings.kampagne_ks_live ist nicht auf true" });
  }
  if (flag("kampagne_ks_stop") === "true") {
    return NextResponse.json({ ok: true, gestoppt: true });
  }
  const karenzText = flag("kampagne_ks_karenz_tage").trim();
  const karenzRoh = karenzText === "" ? NaN : Number(karenzText);
  const karenzTage = Number.isFinite(karenzRoh) && karenzRoh > 0 && karenzRoh <= KARENZ_TAGE_MAX ? karenzRoh : KARENZ_TAGE_STANDARD;
  const karenz = new Date(Date.now() - karenzTage * 86400000).toISOString();

  // Gesamtdeckel (optional): zaehlt bisher markierte Sends
  const maxText = flag("kampagne_ks_max_gesamt").trim();
  const maxGesamt = maxText === "" ? Infinity : Number(maxText);
  let schonGesendet = 0;
  if (Number.isFinite(maxGesamt)) {
    const { count } = await supabase
      .from("wauwerk_leads")
      .select("id", { count: "exact", head: true })
      .eq("answers->>kampagne_ks_sent", "true");
    schonGesendet = count || 0;
    if (!dry && schonGesendet >= maxGesamt) {
      return NextResponse.json({ ok: true, deckel_erreicht: true, gesendet_gesamt: schonGesendet, max: maxGesamt });
    }
  }
  const rest = Number.isFinite(maxGesamt) ? Math.max(0, maxGesamt - schonGesendet) : BATCH;

  const { data, error } = await (supabase as any)
    .from("wauwerk_leads")
    .select("id, email, dog_name, answers, paid_at")
    .eq("status", "paid")
    .not("email", "is", null)
    .lt("paid_at", karenz)
    .is("answers->>lang", null)
    .is("answers->>unsubscribed", null)
    .is("answers->>koerpersprache_sent_at", null)
    .is("answers->>kampagne_ks_sent", null)
    .order("paid_at", { ascending: false })
    .limit(Math.min(BATCH, rest));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Lead = { id: string; email: string | null; dog_name: string | null; answers: Record<string, any> | null; paid_at: string | null };
  const batch = (data || []) as Lead[];
  if (batch.length === 0) return NextResponse.json({ ok: true, fertig: true, gesendet: 0 });

  // Dedup über die E-Mail (Wiederholungskäufer, Abgemeldete auf anderer Zeile)
  const mails = batch.map((l) => (l.email || "").toLowerCase()).filter(Boolean);
  const { data: schonMal } = await supabase.from("wauwerk_leads").select("email, answers").in("email", mails);
  const bereits = new Set(
    ((schonMal || []) as Array<{ email: string | null; answers: Record<string, any> | null }>)
      .filter((r) => { const a = r.answers || {}; return a.kampagne_ks_sent || a.koerpersprache_sent_at || a.unsubscribed; })
      .map((r) => (r.email || "").toLowerCase())
  );

  if (dry) {
    const g = new Set<string>();
    const offen = batch.filter((l) => { const m = (l.email || "").toLowerCase(); if (bereits.has(m) || g.has(m)) return false; g.add(m); return true; });
    const b = offen[0];
    return NextResponse.json({
      ok: true, modus: "DRY-RUN", freigabe: flag("kampagne_ks_live") === "true", karenz_tage: karenzTage,
      im_batch: batch.length, offen: offen.length, gesendet_gesamt: schonGesendet,
      beispiel: b ? { email: b.email, hund: b.dog_name, problem: (b.answers as any)?.dog_problem || "", betreff: subjectFor(b.dog_name || "deinem Hund", b.id, (b.answers as any)?.dog_gender || "") } : null,
    });
  }

  let ok = 0, err = 0, skip = 0;
  const gesehen = new Set<string>();
  for (const l of batch) {
    const mail = (l.email || "").toLowerCase();
    const prev = (l.answers || {}) as Record<string, any>;
    if (bereits.has(mail) || gesehen.has(mail)) {
      skip++;
      await supabase.from("wauwerk_leads").update({ answers: { ...prev, kampagne_ks_sent: "skip_dublette" } }).eq("id", l.id);
      continue;
    }
    gesehen.add(mail);
    const dog = (l.dog_name || "").trim() || "deinem Hund";
    const problem = String(prev.dog_problem || "");
    let res;
    try { res = await sendOne(String(l.email), dog, problem, l.id, String(prev.dog_gender || "")); } catch { err++; continue; }
    if (res.status < 300) {
      ok++;
      await supabase.from("wauwerk_leads").update({
        answers: { ...prev, kampagne_ks_sent: true, kampagne_ks_sent_at: new Date().toISOString(), kampagne_ks_variant: subjectFor("x", l.id).startsWith("Gähnt") ? "B" : "A" },
      }).eq("id", l.id);
    } else err++;
  }
  return NextResponse.json({ ok: true, modus: "LIVE", gesendet: ok, uebersprungen_dublette: skip, fehler: err, batch: batch.length });
}
