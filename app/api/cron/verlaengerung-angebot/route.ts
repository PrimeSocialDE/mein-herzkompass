// Plan-Verlängerung: Angebots-Mail nach Planende (Amazon SES, Absender Laura).
//
// WANN: 1-Monats-Plan an Tag 31 nach Planerstellung (= 1 Tag nach Ablauf der
//   30-Tage-Garantie), 3-Monats-Plan an Tag 85, 6-Monats-Plan an Tag 169
//   (jeweils 1 Tag nach Planende). Maßgeblich ist der NEUESTE Trainingsplan
//   der E-Mail (wer zwischendurch neu gekauft hat, läuft nach dem neuen Plan).
// WER NICHT: nicht bezahlt, PL/IT, abgemeldet, schon angeschrieben/in der
//   Kontrollgruppe, schon verlängert, Erstattungsfall im Support, in Mollie
//   (teil)erstattet.
// TEST: 20 % Kontrollgruppe (fest per E-Mail-Hash) bekommt keine Mail
//   (answers.verl_ab = "kontrolle"), damit der Zusatzumsatz messbar ist.
// FREIGABE: system_settings.verl_live = "true", Not-Aus verl_stop,
//   verl_lookback_tage (Standard 2: nur Fälligkeiten der letzten 2 Tage, kein
//   Altbestand), verl_max_pro_lauf (Standard 150).
//   ?dry=1 -> zeigt, wer dran wäre · ?test=mail@x.de&lead=<id> -> Angebots-Mail dieses Leads an die Testadresse

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";
const REGION = process.env.AWS_REGION || "eu-central-1";
const HOST = `email.${REGION}.amazonaws.com`;
const AK = process.env.AWS_ACCESS_KEY_ID || "";
const SK = process.env.AWS_SECRET_ACCESS_KEY || "";
const CONFIG_SET = process.env.SES_CONFIGURATION_SET || "pfoten-tracking";
const FROM = "Laura vom Pfoten-Plan <hallo@pfoten-post.de>";
const CAMPAIGN = "verlaengerung-angebot";
const TAG = 86400000;
const FAELLIG_NACH_TAGEN: Record<number, number> = { 1: 31, 3: 85, 6: 169 };
const PLAN_NAME: Record<number, string> = { 1: "4-Wochen-Plan", 3: "3-Monats-Plan", 6: "6-Monats-Plan" };

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

const kap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const gruppe = (email: string) =>
  parseInt(crypto.createHash("sha1").update(email.toLowerCase()).digest("hex").slice(0, 4), 16) % 5 === 0 ? "kontrolle" : "mail";
const fristText = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });

function link(id: string, email: string) {
  return `https://www.pfoten-plan.de/weiter.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}&utm_source=email&utm_medium=verlaengerung&utm_campaign=verl-angebot`;
}

function buildHtml(dog: string, monate: number, id: string, email: string, frist: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const cta = link(id, email);
  const p = "margin:0 0 16px;font-size:16px;";
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pfoten-Plan</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;line-height:1.7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">3 kurze Fragen, dann weißt du, wie es mit ${dog} weitergeht.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 36px 6px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#8B7355;">🐾 Pfoten-Plan</div></td></tr>
<tr><td style="padding:14px 36px 4px;">
<p style="${p}">Hallo,</p>
<p style="${p}">${dog}s ${PLAN_NAME[monate]} ist jetzt durch. Schön, dass ihr drangeblieben seid!</p>
<p style="${p}">Uns interessiert ehrlich: <strong>Was klappt schon, und wo hakt es noch?</strong> Nimm dir eine Minute für 3 kurze Fragen.</p>
<p style="${p}">Wenn du magst, bauen wir daraus ${dog}s <strong>Aufbauplan</strong>: frische Übungen für die nächsten 3 oder 6 Monate, die auf dem aufbauen, was ${dog} schon kann, und genau da ansetzen, wo es noch hakt.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;margin:0 0 18px;"><tr><td style="padding:14px 18px;font-size:15px;color:#3a342b;">
<strong>Bestandskunden-Preis bis ${frist}:</strong><br>3 Monate für 29,99 € · 6 Monate für 44,99 €<br><span style="color:#6B7280;font-size:13.5px;">Einmalzahlung, kein Abo. Als PDF zum Ausdrucken.</span>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 36px 6px;text-align:center;">
<a href="${cta}" style="display:inline-block;background:#8B7355;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 34px;border-radius:12px;">3 Fragen beantworten</a>
</td></tr>
<tr><td style="padding:20px 36px 26px;">
<p style="margin:0 0 6px;font-size:16px;">Viele Grüße an ${dog},</p>
<p style="margin:0;font-size:16px;"><strong>Laura</strong> vom Pfoten-Plan-Team</p>
</td></tr>
<tr><td style="padding:16px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;"><p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.7;">Pfoten-Plan · Persönliches Hundetraining<br>Keine Post mehr? <a href="${unsub}" style="color:#9CA3AF;text-decoration:underline;">Hier abmelden</a>.</p></td></tr>
</table></td></tr></table></body></html>`;
}

function buildText(dog: string, monate: number, id: string, email: string, frist: string): string {
  return `Hallo,

${dog}s ${PLAN_NAME[monate]} ist jetzt durch. Schön, dass ihr drangeblieben seid!

Uns interessiert ehrlich: Was klappt schon, und wo hakt es noch? Nimm dir eine Minute für 3 kurze Fragen.

Wenn du magst, bauen wir daraus ${dog}s Aufbauplan: frische Übungen für die nächsten 3 oder 6 Monate, die auf dem aufbauen, was ${dog} schon kann, und genau da ansetzen, wo es noch hakt.

Bestandskunden-Preis bis ${frist}: 3 Monate für 29,99 €, 6 Monate für 44,99 €. Einmalzahlung, kein Abo.

${link(id, email)}

Viele Grüße an ${dog},
Laura vom Pfoten-Plan-Team

Keine Post mehr? Hier abmelden: https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
}

async function sendOne(to: string, dog: string, monate: number, id: string, email: string, frist: string) {
  return ses("POST", "/v2/email/outbound-emails", {
    FromEmailAddress: FROM,
    Destination: { ToAddresses: [to] },
    ReplyToAddresses: ["support@pfoten-plan.de"],
    ConfigurationSetName: CONFIG_SET,
    EmailTags: [{ Name: "campaign", Value: CAMPAIGN }],
    Content: {
      Simple: {
        Subject: { Data: `Wie geht es ${dog} nach dem Plan?`, Charset: "UTF-8" },
        Body: {
          Html: { Data: buildHtml(dog, monate, id, email, frist), Charset: "UTF-8" },
          Text: { Data: buildText(dog, monate, id, email, frist), Charset: "UTF-8" },
        },
        Headers: [
          { Name: "List-Unsubscribe", Value: `<https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}>, <mailto:hallo@pfoten-post.de?subject=unsubscribe>` },
          { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
        ],
      },
    },
  });
}

async function mollieErstattet(paymentId: string | null): Promise<boolean> {
  const key = process.env.MOLLIE_API_KEY;
  if (!paymentId || !key) return false;
  try {
    const r = await fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return false;
    const p: any = await r.json();
    return parseFloat(p?.amountRefunded?.value || "0") > 0 || parseFloat(p?.amountChargedBack?.value || "0") > 0;
  } catch {
    return false;
  }
}

type Plan = { email: string; plan_title: string | null; created_at: string; source_payment_id: string | null; dog_name: string | null };
type Lead = { id: string; email: string | null; status: string | null; dog_name: string | null; mollie_payment_id: string | null; answers: Record<string, any> | null };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!AK || !SK) return NextResponse.json({ error: "aws_credentials_missing" }, { status: 500 });

  // ── Testmail für einen bestimmten Lead ──
  const testTo = searchParams.get("test");
  if (testTo) {
    const id = searchParams.get("lead") || "";
    const { data: l } = await supabase.from("wauwerk_leads").select("id, email, dog_name").eq("id", id).maybeSingle();
    const dog = kap(String(l?.dog_name || "Bella").trim());
    const monate = Number(searchParams.get("monate") || 1);
    const res = await sendOne(testTo, dog, monate, l?.id || "test", String(l?.email || testTo), fristText(new Date(Date.now() + 7 * TAG).toISOString()));
    return NextResponse.json({ test: testTo, status: res.status, link: l ? link(l.id, String(l.email)) : null });
  }

  const dry = searchParams.get("dry") === "1";
  const { data: flags } = await supabase
    .from("system_settings").select("key,value")
    .in("key", ["verl_live", "verl_stop", "verl_lookback_tage", "verl_max_pro_lauf"]);
  const flag = (k: string) => String((flags || []).find((f: any) => f.key === k)?.value || "").trim();
  if (!dry && flag("verl_live") !== "true") {
    return NextResponse.json({ ok: true, wartet: true, hinweis: "system_settings.verl_live ist nicht auf true" });
  }
  if (flag("verl_stop") === "true") return NextResponse.json({ ok: true, gestoppt: true });
  const lb = Number(flag("verl_lookback_tage"));
  const lookback = Number.isFinite(lb) && lb > 0 && lb <= 60 ? lb : 2;
  const mx = Number(flag("verl_max_pro_lauf"));
  const maxProLauf = Number.isFinite(mx) && mx > 0 ? mx : 150;

  // ── 1) Neueste Trainingspläne je E-Mail (Fenster deckt auch 6-Monats-Pläne ab) ──
  const jetzt = Date.now();
  const ab = new Date(jetzt - (169 + lookback + 3) * TAG).toISOString();
  const plaene: Plan[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await supabase
      .from("member_plan_content")
      .select("email, plan_title, created_at, source_payment_id, dog_name")
      .eq("plan_slug", "trainingsplan")
      .gte("created_at", ab)
      .order("id", { ascending: true })
      .range(off, off + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    plaene.push(...((data || []) as Plan[]));
    if (!data || data.length < 1000) break;
  }
  const neuester = new Map<string, Plan>();
  for (const p of plaene) {
    const m = String(p.email || "").trim().toLowerCase();
    if (!m) continue;
    const alt = neuester.get(m);
    if (!alt || p.created_at > alt.created_at) neuester.set(m, p);
  }

  // ── 2) Fällig im Lookback-Fenster? ──
  const faellig: Array<{ email: string; plan: Plan; monate: number }> = [];
  for (const [email, p] of neuester) {
    const m = /^(\d+)-Monats/.exec(p.plan_title || "");
    const monate = m ? Number(m[1]) : 0;
    const nachTagen = FAELLIG_NACH_TAGEN[monate];
    if (!nachTagen || !p.source_payment_id) continue;
    const due = new Date(p.created_at).getTime() + nachTagen * TAG;
    if (due <= jetzt && due > jetzt - lookback * TAG) faellig.push({ email, plan: p, monate });
  }
  if (faellig.length === 0) return NextResponse.json({ ok: true, faellig: 0 });

  // ── 3) Leads + Ausschlüsse ──
  const ids = faellig.map((f) => f.plan.source_payment_id!) as string[];
  const leads = new Map<string, Lead>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase
      .from("wauwerk_leads")
      .select("id, email, status, dog_name, mollie_payment_id, answers")
      .in("id", ids.slice(i, i + 100));
    for (const l of (data || []) as Lead[]) leads.set(l.id, l);
  }
  const mails = faellig.map((f) => f.email);
  const schonDran = new Set<string>();
  const abgemeldet = new Set<string>();
  for (let i = 0; i < mails.length; i += 100) {
    const { data } = await supabase.from("wauwerk_leads").select("email, answers").in("email", mails.slice(i, i + 100));
    for (const r of (data || []) as Array<{ email: string | null; answers: Record<string, any> | null }>) {
      const a = r.answers || {};
      const m = String(r.email || "").toLowerCase();
      if (a.verl_ab || a.verl_bestellt) schonDran.add(m);
      if (a.unsubscribed) abgemeldet.add(m);
    }
  }
  const erstattung = new Set<string>();
  {
    const { data } = await supabase.from("support_cases").select("from_email").eq("status", "erstattung");
    for (const r of (data || []) as Array<{ from_email: string | null }>) erstattung.add(String(r.from_email || "").toLowerCase());
  }

  const grund: Record<string, number> = {};
  const zaehle = (g: string) => { grund[g] = (grund[g] || 0) + 1; };
  const kandidaten: Array<{ lead: Lead; email: string; monate: number }> = [];
  for (const f of faellig) {
    const l = leads.get(f.plan.source_payment_id!);
    const a = l?.answers || {};
    if (!l) { zaehle("kein_lead"); continue; }
    if (l.status !== "paid") { zaehle("nicht_bezahlt"); continue; }
    if (a.lang === "pl" || a.lang === "it") { zaehle("ausland"); continue; }
    if (a.unsubscribed || abgemeldet.has(f.email)) { zaehle("abgemeldet"); continue; }
    if (schonDran.has(f.email)) { zaehle("schon_dran"); continue; }
    if (erstattung.has(f.email)) { zaehle("erstattung_support"); continue; }
    kandidaten.push({ lead: l, email: f.email, monate: f.monate });
  }

  if (dry) {
    const kontrolle = kandidaten.filter((k) => gruppe(k.email) === "kontrolle").length;
    return NextResponse.json({
      ok: true, modus: "DRY-RUN", freigabe: flag("verl_live") === "true", lookback_tage: lookback,
      faellig: faellig.length, ausgeschlossen: grund, kandidaten: kandidaten.length,
      davon_mail: kandidaten.length - kontrolle, davon_kontrolle: kontrolle,
      nach_planlaenge: kandidaten.reduce((o: Record<string, number>, k) => { o[k.monate] = (o[k.monate] || 0) + 1; return o; }, {}),
      beispiel: kandidaten[0] ? { email: kandidaten[0].email, hund: kandidaten[0].lead.dog_name, monate: kandidaten[0].monate } : null,
    });
  }

  // ── 4) Versand ──
  let gesendet = 0, kontrolle = 0, erstattet = 0, fehler = 0;
  for (const k of kandidaten.slice(0, maxProLauf)) {
    if (await mollieErstattet(k.lead.mollie_payment_id)) {
      erstattet++;
      await mergeAnswers(k.lead.id, { verl_ab: "ausgeschlossen_erstattet" });
      continue;
    }
    const g = gruppe(k.email);
    if (g === "kontrolle") {
      kontrolle++;
      await mergeAnswers(k.lead.id, { verl_ab: "kontrolle", verl_kontrolle_at: new Date().toISOString(), verl_planlaenge: k.monate });
      continue;
    }
    const dog = kap(String(k.lead.dog_name || "").trim()) || "deinem Hund";
    const fristIso = new Date(Date.now() + 7 * TAG).toISOString();
    let res;
    try { res = await sendOne(String(k.lead.email), dog, k.monate, k.lead.id, String(k.lead.email), fristText(fristIso)); } catch { fehler++; continue; }
    if (res.status < 300) {
      gesendet++;
      await mergeAnswers(k.lead.id, { verl_ab: "mail", verl_angebot_at: new Date().toISOString(), verl_frist: fristIso, verl_planlaenge: k.monate });
    } else fehler++;
  }
  return NextResponse.json({ ok: true, modus: "LIVE", faellig: faellig.length, ausgeschlossen: grund, gesendet, kontrolle, erstattet, fehler });
}

async function mergeAnswers(id: string, patch: Record<string, any>) {
  const { data } = await supabase.from("wauwerk_leads").select("answers").eq("id", id).maybeSingle();
  await supabase.from("wauwerk_leads").update({ answers: { ...((data?.answers as any) || {}), ...patch } }).eq("id", id);
}
