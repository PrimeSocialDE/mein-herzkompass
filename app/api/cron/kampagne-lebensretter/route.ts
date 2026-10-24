// Cross-Sell-Kampagne "Lebensretter-Training" (24,99 €, 10 Sicherheits-Kommandos) — Batch-Versand über Amazon SES.
// Aufbau wie kampagne-koerpersprache. Ersetzt ab 25.10.2026 die Giftköder-Kampagne
// (8.705 Empfänger, nur 4 Käufe) und passt zum Kommando-Angle der Meta-Anzeigen.
//
// ZIELGRUPPE: DACH-Käufer (status=paid, answers.lang NULL), nicht abgemeldet,
//   Lebensretter noch nicht gekauft (upsell_module != lebensretter auf keiner Zeile),
//   eigener Marker answers.kampagne_lr_sent, Kauf älter als Karenz, Dedup über E-Mail,
//   nicht in den letzten 2 Tagen schon die Körpersprache-Mail bekommen, nur mit echtem Hundenamen.
// FREIGABE: system_settings.kampagne_lr_live = "true", Not-Aus kampagne_lr_stop,
//   Karenz kampagne_lr_karenz_tage (Standard 7), Gesamtdeckel kampagne_lr_max_gesamt.
//   ?dry=1 · ?test=mail@x.de&dog=Bella

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
const CAMPAIGN = "lebensretter-crosssell";
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



const SITE = "https://www.pfoten-plan.de";
const KOMMANDOS = [
  "Der Notfall-Rückruf", "Sofort-Aus (Giftköder)", "Lass es", "Distanz-Not-Halt", "Platz auf Distanz",
  "Bleib unter Ablenkung", "Zu mir / Not-Position", "Warte an Tür & Auto", "Schau / Not-Aufmerksamkeit", "Maulkorb ohne Stress",
];

function subjectFor(dog: string, id: string): string {
  const c = (id || "").replace(/[^0-9a-f]/gi, "").slice(-1).toLowerCase();
  const variantB = parseInt(c || "0", 16) % 2 === 1;
  return variantB ? `Würde ${dog} sofort hören, wenn es drauf ankommt?` : `Die 10 Kommandos, die ${dog} schützen`;
}

function link(id: string, email: string): string {
  const p = new URLSearchParams({ lead_id: id, email, utm_source: "email", utm_medium: "email", utm_campaign: "lebensretter-kampagne" });
  return `${SITE}/lebensretter.html?${p.toString()}`;
}

function buildHtml(dog: string, id: string, email: string): string {
  const unsub = `${SITE}/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const cta = link(id, email);
  const p = "margin:0 0 16px;font-size:16px;";
  const liste = KOMMANDOS.map((k, i) => `<tr><td style="padding:5px 0;font-size:15.5px;color:#2A2118;"><span style="display:inline-block;width:24px;height:24px;border-radius:12px;background:#C4A576;color:#fff;font-weight:800;font-size:12px;text-align:center;line-height:24px;margin-right:10px;">${i + 1}</span>${k}</td></tr>`).join("");
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pfoten-Plan</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;line-height:1.7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Eine offene Autotür, ein Reh, ein Giftköder. Dann zählt nur ein Kommando.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 36px 6px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#8B7355;">🐾 Pfoten-Plan</div></td></tr>
<tr><td style="padding:14px 36px 4px;">
<p style="${p}">Hallo,</p>
<p style="${p}">eine offene Autotür. Die Leine rutscht dir aus der Hand. Ein Reh springt über den Weg, oder im Gebüsch liegt etwas, das ${dog} sofort im Maul hat.</p>
<p style="${p}">In solchen Sekunden nützt kein normales „Sitz“. Was zählt, ist ein Kommando, das so tief sitzt, dass ${dog} es auch dann befolgt, wenn alles um euch herum aufregend ist.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF9F0;border:1px solid #EADDC5;border-left:4px solid #C4A576;border-radius:12px;margin:0 0 18px;"><tr><td style="padding:14px 16px;">
<div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8B7355;">Gratis-Tipp für heute</div>
<div style="font-size:16px;font-weight:700;margin:4px 0 4px;color:#2A2118;">Das Notfall-Wort</div>
<div style="font-size:14.5px;color:#4B5563;line-height:1.55;">Nimm für den Notfall-Rückruf ein eigenes Wort, das ${dog} noch nie gehört hat, zum Beispiel „Turbo“. Sag es die ersten zwei Wochen nur drinnen, und jedes Mal gibt es etwas Besonderes wie Käse oder Hähnchen. So wird das Wort zum stärksten Signal überhaupt, und es ist noch nicht „verbraucht“ wie der normale Rückruf.</div>
</td></tr></table>
<p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#3a342b;">Im Lebensretter-Training für ${dog}:</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px;">${liste}</table>
<p style="${p}">Jedes Kommando in 5 klaren Schritten, mit Übungsplan und No-Gos, dazu eine persönliche Einleitung für ${dog}. Ein sicheres Kommando entsteht nicht an dem Tag, an dem man es braucht, sondern in den Wochen davor.</p>
</td></tr>
<tr><td style="padding:4px 36px 6px;text-align:center;">
<a href="${cta}" style="display:inline-block;background:#8B7355;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 34px;border-radius:12px;">Lebensretter-Training für ${dog}</a>
<p style="margin:10px 0 0;font-size:13.5px;color:#6B7280;">Für Pfoten-Plan-Kunden 24,99 € statt 34,99 €. Einmalig, kein Abo. Kommt als PDF per E-Mail.</p>
</td></tr>
<tr><td style="padding:20px 36px 26px;">
<p style="margin:0 0 6px;font-size:16px;">Viele Grüße an ${dog},</p>
<p style="margin:0;font-size:16px;"><strong>Laura</strong> vom Pfoten-Plan-Team</p>
</td></tr>
<tr><td style="padding:16px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;"><p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.7;">Pfoten-Plan · Persönliches Hundetraining<br>Keine Post mehr? <a href="${unsub}" style="color:#9CA3AF;text-decoration:underline;">Hier abmelden</a>.</p></td></tr>
</table></td></tr></table></body></html>`;
}

function buildText(dog: string, id: string, email: string): string {
  return `Hallo,

eine offene Autotür. Die Leine rutscht dir aus der Hand. Ein Reh springt über den Weg, oder im Gebüsch liegt etwas, das ${dog} sofort im Maul hat.

In solchen Sekunden nützt kein normales "Sitz". Was zählt, ist ein Kommando, das so tief sitzt, dass ${dog} es auch dann befolgt, wenn alles aufregend ist.

Gratis-Tipp: Nimm für den Notfall-Rückruf ein eigenes Wort, das ${dog} noch nie gehört hat, zum Beispiel "Turbo". Die ersten zwei Wochen nur drinnen, und jedes Mal gibt es etwas Besonderes.

Im Lebensretter-Training für ${dog}: ${KOMMANDOS.join(" · ")}

${link(id, email)}

Für Pfoten-Plan-Kunden 24,99 € statt 34,99 €. Einmalig, kein Abo. Kommt als PDF per E-Mail.

Viele Grüße an ${dog},
Laura vom Pfoten-Plan-Team

Keine Post mehr? Hier abmelden: ${SITE}/api/unsubscribe?lead=${encodeURIComponent(id)}`;
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
          { Name: "List-Unsubscribe", Value: `<${SITE}/api/unsubscribe?lead=${encodeURIComponent(id)}>, <mailto:hallo@pfoten-post.de?subject=unsubscribe>` },
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
    const res = await sendOne(testTo, searchParams.get("dog") || "Bella", searchParams.get("id") || "test-lead-000a");
    return NextResponse.json({ test: testTo, status: res.status, data: res.data.slice(0, 200) });
  }

  const dry = searchParams.get("dry") === "1";
  const { data: flags } = await supabase
    .from("system_settings")
    .select("key,value")
    .in("key", ["kampagne_lr_live", "kampagne_lr_stop", "kampagne_lr_karenz_tage", "kampagne_lr_max_gesamt"]);
  const flag = (k: string) => String((flags || []).find((f: any) => f.key === k)?.value || "");
  if (!dry && flag("kampagne_lr_live") !== "true") {
    return NextResponse.json({ ok: true, wartet: true, hinweis: "system_settings.kampagne_lr_live ist nicht auf true" });
  }
  if (flag("kampagne_lr_stop") === "true") {
    return NextResponse.json({ ok: true, gestoppt: true });
  }
  const karenzText = flag("kampagne_lr_karenz_tage").trim();
  const karenzRoh = karenzText === "" ? NaN : Number(karenzText);
  const karenzTage = Number.isFinite(karenzRoh) && karenzRoh > 0 && karenzRoh <= KARENZ_TAGE_MAX ? karenzRoh : KARENZ_TAGE_STANDARD;
  const karenz = new Date(Date.now() - karenzTage * 86400000).toISOString();

  // Gesamtdeckel (optional): zaehlt bisher markierte Sends
  const maxText = flag("kampagne_lr_max_gesamt").trim();
  const maxGesamt = maxText === "" ? Infinity : Number(maxText);
  let schonGesendet = 0;
  if (Number.isFinite(maxGesamt)) {
    const { count } = await supabase
      .from("wauwerk_leads")
      .select("id", { count: "exact", head: true })
      .eq("answers->>kampagne_lr_sent", "true");
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
    .or("upsell_module.is.null,upsell_module.neq.lebensretter")
    .is("answers->>kampagne_lr_sent", null)
    .order("paid_at", { ascending: false })
    .limit(Math.min(BATCH, rest));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Lead = { id: string; email: string | null; dog_name: string | null; answers: Record<string, any> | null; paid_at: string | null };
  const batch = (data || []) as Lead[];
  if (batch.length === 0) return NextResponse.json({ ok: true, fertig: true, gesendet: 0 });

  // Dedup über die E-Mail (Wiederholungskäufer, Abgemeldete auf anderer Zeile)
  const mails = batch.map((l) => (l.email || "").toLowerCase()).filter(Boolean);
  const { data: schonMal } = await supabase.from("wauwerk_leads").select("email, answers, upsell_module").in("email", mails);
  const bereits = new Set(
    ((schonMal || []) as Array<{ email: string | null; answers: Record<string, any> | null; upsell_module: string | null }>)
      .filter((r) => { const a = r.answers || {}; return a.kampagne_lr_sent || a.unsubscribed || r.upsell_module === "lebensretter" || (a.kampagne_ks_sent_at && Date.now() - new Date(a.kampagne_ks_sent_at).getTime() < 2 * 86400000); })
      .map((r) => (r.email || "").toLowerCase())
  );

  if (dry) {
    const g = new Set<string>();
    const offen = batch.filter((l) => { const m = (l.email || "").toLowerCase(); if (bereits.has(m) || g.has(m)) return false; g.add(m); return true; });
    const b = offen[0];
    return NextResponse.json({
      ok: true, modus: "DRY-RUN", freigabe: flag("kampagne_lr_live") === "true", karenz_tage: karenzTage,
      im_batch: batch.length, offen: offen.length, gesendet_gesamt: schonGesendet,
      beispiel: b ? { email: b.email, hund: b.dog_name, problem: (b.answers as any)?.dog_problem || "", betreff: subjectFor(b.dog_name || "deinem Hund", b.id) } : null,
    });
  }

  let ok = 0, err = 0, skip = 0;
  const gesehen = new Set<string>();
  for (const l of batch) {
    const mail = (l.email || "").toLowerCase();
    const prev = (l.answers || {}) as Record<string, any>;
    if (bereits.has(mail) || gesehen.has(mail)) {
      skip++;
      await supabase.from("wauwerk_leads").update({ answers: { ...prev, kampagne_lr_sent: "skip_dublette" } }).eq("id", l.id);
      continue;
    }
    gesehen.add(mail);
    const roh = (l.dog_name || "").trim();
    const lokal = mail.split("@")[0].replace(/[^a-zäöüß]+/g, " ");
    const woerter = roh.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
    if (!roh || (woerter.length >= 2 && woerter.every((w) => lokal.includes(w)))) {
      skip++;
      await supabase.from("wauwerk_leads").update({ answers: { ...prev, kampagne_lr_sent: "skip_name" } }).eq("id", l.id);
      continue;
    }
    const dog = roh.charAt(0).toUpperCase() + roh.slice(1);
    let res;
    try { res = await sendOne(String(l.email), dog, l.id); } catch { err++; continue; }
    if (res.status < 300) {
      ok++;
      await supabase.from("wauwerk_leads").update({
        answers: { ...prev, kampagne_lr_sent: true, kampagne_lr_sent_at: new Date().toISOString(), kampagne_lr_variant: subjectFor("x", l.id).startsWith("Würde") ? "B" : "A" },
      }).eq("id", l.id);
    } else err++;
  }
  return NextResponse.json({ ok: true, modus: "LIVE", gesendet: ok, uebersprungen_dublette: skip, fehler: err, batch: batch.length });
}
