// Nicht-Käufer-Kampagne "Plan + Notfall-Karten gratis" — Batch-Versand über SES.
//
// ZIELGRUPPE: status=email_captured (Quiz gemacht, nie gekauft), DACH
//   (answers.lang NULL), nicht abgemeldet, Quiz 26 bis 180 Tage alt (die
//   Code-Sequenz läuft bis Tag 21/25 — keine Überschneidung), eigener Marker
//   answers.kampagne_kb_sent, Käufer-Sperre + Dedup über die E-Mail.
// ANGEBOT: Link auf rueckhol.html mit rhb=B (Bonus-Variante: Banner + Hinweis
//   am Kaufknopf, Auslieferung der Karten über exit_bonus_notfallkarten +
//   Sicherheitsnetz-Cron bonus-karten). utm_campaign=karten-bonus trennt die
//   Kampagnen-Käufe vom laufenden Rückhol-A/B-Test.
// FREIGABE: system_settings.kampagne_kb_live = "true", Not-Aus kampagne_kb_stop,
//   Gesamtdeckel kampagne_kb_max_gesamt (Standard 5000). ?dry=1 · ?test=mail@x.de

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
const CAMPAIGN = "karten-bonus-nichtkaeufer";
const BATCH = 100;      // pro Lauf, SES erlaubt 14/s

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


const MAX_GESAMT_STANDARD = 5000;
const SITE = "https://www.pfoten-plan.de";

// Passende Karte zum Problem aus dem Quiz (Nummern wie im Karten-PDF)
const KARTE: Record<string, { nr: number; titel: string; schritt: string }> = {
  pulling: { nr: 2, titel: "Hund zieht plötzlich los", schritt: "Sofort stehenbleiben, nicht zurückziehen, warten bis die Leine locker ist, dann Richtungswechsel." },
  "leash-reactive": { nr: 3, titel: "Hund bellt anderen Hund an", schritt: "Abstand schaffen, bevor er fixiert, und seine Aufmerksamkeit mit seinem Namen auf dich lenken." },
  "dog-reactive": { nr: 3, titel: "Hund bellt anderen Hund an", schritt: "Abstand schaffen, bevor er fixiert, und seine Aufmerksamkeit mit seinem Namen auf dich lenken." },
  aggression: { nr: 3, titel: "Hund bellt anderen Hund an", schritt: "Abstand schaffen, bevor er fixiert, und seine Aufmerksamkeit mit seinem Namen auf dich lenken." },
  barking: { nr: 1, titel: "Hund bellt an der Tür", schritt: "Ruhig ein Signal geben, auf den festen Platz schicken und erst öffnen, wenn er nicht mehr vor der Tür steht." },
  jumping: { nr: 4, titel: "Hund springt Besucher an", schritt: "Besuch ignoriert ihn zuerst, Begrüßung gibt es nur mit vier Pfoten auf dem Boden." },
  mouthing: { nr: 5, titel: "Hund nimmt etwas vom Boden auf", schritt: "Tauschen statt wegreißen und das Liegenlassen in kleinen Schritten üben." },
  recall: { nr: 6, titel: "Hund jagt Jogger oder Radfahrer", schritt: "Den Reiz früher sehen als er, Abstand halten und eine Alternative belohnen." },
  energy: { nr: 10, titel: "Hund zieht zu anderem Hund hin", schritt: "Nicht hinziehen lassen, erst bei lockerer Leine geht es weiter." },
};
const KARTEN_LISTE = [
  "Hund bellt an der Tür", "Hund zieht plötzlich los", "Hund bellt anderen Hund an", "Hund springt Besucher an",
  "Hund nimmt etwas vom Boden auf", "Hund jagt Jogger oder Radfahrer", "Hund bellt im Auto", "Hund knurrt beim Fressen",
  "Hund dreht durch bei Gewitter", "Hund zieht zu anderem Hund hin",
];

function variantB(id: string): boolean {
  const c = (id || "").replace(/[^0-9a-f]/gi, "").slice(-1).toLowerCase();
  return parseInt(c || "0", 16) % 2 === 1;
}
function subjectFor(dog: string, id: string): string {
  return variantB(id) ? `Was tun, wenn ${dog} wieder loslegt?` : `${dog}s Plan + 10 Notfall-Karten gratis dazu`;
}
function ctaUrl(id: string, email: string): string {
  const p = new URLSearchParams({ lead_id: id, email, rhb: "B", utm_source: "email", utm_medium: "kampagne", utm_campaign: "karten-bonus" });
  return `${SITE}/rueckhol.html?${p.toString()}`;
}

function buildHtml(dog: string, problem: string, id: string, email: string): string {
  const unsub = `${SITE}/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const cta = ctaUrl(id, email);
  const k = KARTE[problem];
  const p = "margin:0 0 16px;font-size:16px;";
  const karteBox = k
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF9F0;border:1px solid #EADDC5;border-left:4px solid #C4A576;border-radius:12px;margin:0 0 18px;"><tr><td style="padding:14px 16px;">
<div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8B7355;">Für euch besonders wichtig: Karte ${k.nr}</div>
<div style="font-size:16px;font-weight:700;margin:4px 0 4px;color:#2A2118;">${k.titel}</div>
<div style="font-size:14.5px;color:#4B5563;line-height:1.5;">Kurz gesagt: ${k.schritt} Auf der Karte steht jeder Schritt einzeln, dazu ein Tipp und was du tust, wenn ${dog} nicht mitmacht.</div>
</td></tr></table>`
    : "";
  const liste = KARTEN_LISTE.map((t, i) => `<span style="display:inline-block;background:#F5EFE6;border-radius:999px;padding:4px 10px;margin:0 4px 6px 0;font-size:13px;color:#5C5143;">${i + 1}. ${t}</span>`).join("");
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pfoten-Plan</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;line-height:1.7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">10 Sofort-Hilfen für die schwierigen Momente, gratis zu ${dog}s Plan.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 36px 6px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#8B7355;">🐾 Pfoten-Plan</div></td></tr>
<tr><td style="padding:14px 36px 4px;">
<p style="${p}">Hallo,</p>
<p style="${p}">vor einiger Zeit hast du das Quiz für <strong>${dog}</strong> gemacht. Dein persönlicher Trainingsplan liegt noch für dich bereit.</p>
<p style="${p}">Damit sich der Start jetzt richtig lohnt, bekommst du zu ${dog}s Plan <strong>die 10 Notfall-Karten gratis dazu</strong> (sonst 9,99 €). Das sind Sofort-Hilfen für genau die Momente, in denen man sonst nicht weiß, was man tun soll.</p>
</td></tr>
<tr><td style="padding:0 36px 14px;"><img src="${SITE}/notfall-karten-vorschau.jpg" width="528" alt="Die Notfall-Karten von Pfoten-Plan" style="width:100%;max-width:528px;height:auto;border-radius:12px;display:block;"></td></tr>
<tr><td style="padding:0 36px 4px;">
${karteBox}
<p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#3a342b;">Jede Karte erklärt dir:</p>
<p style="margin:0 0 6px;font-size:15.5px;">✓ die Situation, wie du sie kennst</p>
<p style="margin:0 0 6px;font-size:15.5px;">✓ 5 klare Schritte, was du sofort tust</p>
<p style="margin:0 0 6px;font-size:15.5px;">✓ einen Tipp aus der Praxis</p>
<p style="margin:0 0 14px;font-size:15.5px;">✓ was du machst, wenn ${dog} nicht mitmacht</p>
<p style="margin:0 0 8px;font-size:15px;color:#4B5563;">Alle 10 Karten:</p>
<div style="margin:0 0 16px;">${liste}</div>
<p style="${p}">Zum Ausdrucken oder fürs Handy, damit du sie dabei hast, wenn es drauf ankommt. Der Plan sagt dir Woche für Woche, was ihr übt, die Karten helfen dir im Moment selbst.</p>
</td></tr>
<tr><td style="padding:4px 36px 6px;text-align:center;">
<a href="${cta}" style="display:inline-block;background:#8B7355;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 34px;border-radius:12px;">${dog}s Plan + Karten holen</a>
<p style="margin:10px 0 0;font-size:13.5px;color:#6B7280;">Einmal zahlen, kein Abo. 30 Tage Geld-zurück. Die Karten kommen mit dem Plan per E-Mail.</p>
</td></tr>
<tr><td style="padding:20px 36px 26px;">
<p style="margin:0 0 6px;font-size:16px;">Viele Grüße an ${dog},</p>
<p style="margin:0;font-size:16px;"><strong>Laura</strong> vom Pfoten-Plan-Team</p>
</td></tr>
<tr><td style="padding:16px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;"><p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.7;">Pfoten-Plan · Persönliches Hundetraining<br>Keine Post mehr? <a href="${unsub}" style="color:#9CA3AF;text-decoration:underline;">Hier abmelden</a>.</p></td></tr>
</table></td></tr></table></body></html>`;
}

function buildText(dog: string, problem: string, id: string, email: string): string {
  const unsub = `${SITE}/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const k = KARTE[problem];
  return `Hallo,

vor einiger Zeit hast du das Quiz für ${dog} gemacht. Dein persönlicher Trainingsplan liegt noch für dich bereit.

Damit sich der Start jetzt richtig lohnt, bekommst du zu ${dog}s Plan die 10 Notfall-Karten gratis dazu (sonst 9,99 €): Sofort-Hilfen für genau die Momente, in denen man sonst nicht weiß, was man tun soll.
${k ? `\nFür euch besonders wichtig: Karte ${k.nr}, "${k.titel}". Kurz gesagt: ${k.schritt}\n` : ""}
Jede Karte erklärt: die Situation, 5 klare Schritte, einen Tipp aus der Praxis und was du machst, wenn ${dog} nicht mitmacht.

Alle 10 Karten: ${KARTEN_LISTE.join(" · ")}

${ctaUrl(id, email)}

Einmal zahlen, kein Abo. 30 Tage Geld-zurück. Die Karten kommen mit dem Plan per E-Mail.

Viele Grüße an ${dog},
Laura vom Pfoten-Plan-Team

Keine Post mehr? Hier abmelden: ${unsub}`;
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
    const res = await sendOne(testTo, searchParams.get("dog") || "Bella", searchParams.get("problem") || "leash-reactive", searchParams.get("id") || "test-lead-000a");
    return NextResponse.json({ test: testTo, status: res.status, data: res.data.slice(0, 200) });
  }

  const dry = searchParams.get("dry") === "1";
  const { data: flags } = await supabase
    .from("system_settings")
    .select("key,value")
    .in("key", ["kampagne_kb_live", "kampagne_kb_stop", "kampagne_kb_max_gesamt"]);
  const flag = (k: string) => String((flags || []).find((f: any) => f.key === k)?.value || "");
  if (!dry && flag("kampagne_kb_live") !== "true") {
    return NextResponse.json({ ok: true, wartet: true, hinweis: "system_settings.kampagne_kb_live ist nicht auf true" });
  }
  if (flag("kampagne_kb_stop") === "true") return NextResponse.json({ ok: true, gestoppt: true });

  const maxText = flag("kampagne_kb_max_gesamt").trim();
  const maxRoh = maxText === "" ? NaN : Number(maxText);
  const maxGesamt = Number.isFinite(maxRoh) && maxRoh > 0 ? maxRoh : MAX_GESAMT_STANDARD;
  const { count } = await supabase
    .from("wauwerk_leads")
    .select("id", { count: "exact", head: true })
    .eq("answers->>kampagne_kb_sent", "true");
  const schonGesendet = count || 0;
  if (!dry && schonGesendet >= maxGesamt) {
    return NextResponse.json({ ok: true, deckel_erreicht: true, gesendet_gesamt: schonGesendet, max: maxGesamt });
  }

  const bis = new Date(Date.now() - 26 * 86400000).toISOString();
  const von = new Date(Date.now() - 180 * 86400000).toISOString();
  const { data, error } = await (supabase as any)
    .from("wauwerk_leads")
    .select("id, email, dog_name, answers, created_at")
    .eq("status", "email_captured")
    .not("email", "is", null)
    .gte("created_at", von)
    .lte("created_at", bis)
    .is("answers->>lang", null)
    .is("answers->>unsubscribed", null)
    .is("answers->>kampagne_kb_sent", null)
    .order("created_at", { ascending: false })
    .limit(Math.min(BATCH, maxGesamt - schonGesendet || BATCH));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Lead = { id: string; email: string | null; dog_name: string | null; answers: Record<string, any> | null };
  const batch = (data || []) as Lead[];
  if (batch.length === 0) return NextResponse.json({ ok: true, fertig: true, gesendet: 0 });

  // Käufer-Sperre + Abmeldung auf anderer Zeile + schon angeschrieben (Dedup über E-Mail)
  const mails = batch.map((l) => (l.email || "").toLowerCase()).filter(Boolean);
  const { data: andere } = await supabase.from("wauwerk_leads").select("email, status, answers").in("email", mails);
  const gesperrt = new Set(
    ((andere || []) as Array<{ email: string | null; status: string | null; answers: Record<string, any> | null }>)
      .filter((r) => r.status === "paid" || (r.answers || {}).unsubscribed || (r.answers || {}).kampagne_kb_sent)
      .map((r) => (r.email || "").toLowerCase())
  );

  if (dry) {
    const g = new Set<string>();
    const offen = batch.filter((l) => { const m = (l.email || "").toLowerCase(); if (gesperrt.has(m) || g.has(m)) return false; g.add(m); return true; });
    const b = offen[0];
    return NextResponse.json({
      ok: true, modus: "DRY-RUN", freigabe: flag("kampagne_kb_live") === "true", max_gesamt: maxGesamt, gesendet_gesamt: schonGesendet,
      im_batch: batch.length, offen: offen.length,
      beispiel: b ? { email: b.email, hund: b.dog_name, problem: (b.answers as any)?.dog_problem || "", betreff: subjectFor(b.dog_name || "deinem Hund", b.id) } : null,
    });
  }

  let ok = 0, err = 0, skip = 0;
  const gesehen = new Set<string>();
  for (const l of batch) {
    const mail = (l.email || "").toLowerCase();
    const prev = (l.answers || {}) as Record<string, any>;
    if (gesperrt.has(mail) || gesehen.has(mail)) {
      skip++;
      await supabase.from("wauwerk_leads").update({ answers: { ...prev, kampagne_kb_sent: "skip" } }).eq("id", l.id);
      continue;
    }
    gesehen.add(mail);
    const dog = (l.dog_name || "").trim() || "deinem Hund";
    let res;
    try { res = await sendOne(String(l.email), dog, String(prev.dog_problem || ""), l.id); } catch { err++; continue; }
    if (res.status < 300) {
      ok++;
      await supabase.from("wauwerk_leads").update({
        answers: { ...prev, kampagne_kb_sent: true, kampagne_kb_sent_at: new Date().toISOString(), kampagne_kb_variant: variantB(l.id) ? "B" : "A" },
      }).eq("id", l.id);
    } else err++;
  }
  return NextResponse.json({ ok: true, modus: "LIVE", gesendet: ok, uebersprungen: skip, fehler: err, batch: batch.length });
}
