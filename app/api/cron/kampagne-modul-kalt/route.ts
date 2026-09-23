// Modul-Kampagne an KALTE Nichtkaeufer — serverseitig ueber Amazon SES.
//
// WARUM: Diese Leute haben den Fragebogen gemacht und trotzdem nicht gekauft,
// der Kauf liegt mehr als 30 Tage zurueck. Fuer sie ist das 40-Euro-Angebot
// nachweislich gescheitert. Das einzelne Modul zu ihrem eigenen Thema ist die
// kleinste Stufe, die ihr Problem loest: sechs Uebungen, 19 Euro, kein Abo.
//
// Rein rechnerisch schlaegt das die Plan-Mail nicht (die bringt 75 Euro je
// 1.000). Der Wert liegt darin, aus "nie bezahlt" ein "einmal bezahlt" zu
// machen: Modulkaeufer landen danach in der Kaeufer-Leiter (Charakterprofil
// an Tag 7, Shop-Mail an Tag 21).
//
// ZIELGRUPPE (bewusst nur die kalten):
//   status = email_captured, answers.lang IS NULL, nicht abgemeldet
//   Lead aelter als KARENZ_TAGE (Standard 30)
//   answers.zusatzmodul_sent IS NULL  -> hat noch kein Modul
//   answers.kampagne_kalt_sent IS NULL
//   + Sicherheitsnetz: Adressen mit irgendeinem bezahlten Lead fallen raus
//   + Dedup ueber die E-Mail
//   + Obergrenze ueber kampagne_kalt_limit (Standard 5000), damit ein Test
//     ein Test bleibt und nicht versehentlich die ganze Liste verbraucht
//
// FREIGABE: system_settings.kampagne_kalt_live = "true".
// Not-Aus: kampagne_kalt_stop. Obergrenze: kampagne_kalt_limit.
//   ?dry=1          -> zeigt nur, wer dran waere
//   ?test=mail@x.de -> Mustermail (?thema=pulling waehlt das Modul)

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
const CAMPAIGN = "modul-kalt";
const BATCH = 100;
const KARENZ_TAGE = 30;       // so lange muss der Lead mindestens her sein
const LIMIT_STANDARD = 5000;  // Testgroesse, ueber system_settings aenderbar
const MODUL_PREIS = "19";     // steht so auf modul-shop.html, nicht abweichen

// Module aus public/modul-shop.html
const MODULE: Record<string, { name: string; versprechen: string; punkte: string[] }> = {
  pulling: {
    name: "Leinenführigkeit",
    versprechen: "Schluss mit Ziehen, für Spaziergänge ohne Armziehen.",
    punkte: ["Bei-Fuß gehen", "Richtungswechsel", "Ablenkungen meistern"],
  },
  recall: {
    name: "Rückruf-Training",
    versprechen: "Damit er zuverlässig kommt, auch wenn etwas Spannenderes lockt.",
    punkte: ["Sicherer Rückruf", "Auch bei Ablenkung", "Mehr Freilauf"],
  },
  aggression: {
    name: "Aggressionskontrolle",
    versprechen: "Für entspannte Begegnungen mit anderen Hunden.",
    punkte: ["Auslöser verstehen", "Ruhe bewahren", "Sichere Begegnungen"],
  },
  barking: {
    name: "Bellen reduzieren",
    versprechen: "Damit nicht jedes Geräusch im Treppenhaus zum Konzert wird.",
    punkte: ["Ruhe-Signal", "Auslöser erkennen", "Kontrolle gewinnen"],
  },
  anxiety: {
    name: "Trennungsangst",
    versprechen: "Damit er entspannt alleine bleibt, ohne Bellen oder Zerstörung.",
    punkte: ["Sanfter Aufbau", "Abschiedsrituale", "Ruhe-Signale"],
  },
  energy: {
    name: "Energie minimieren",
    versprechen: "Für Hunde, die abends immer wilder werden statt ruhiger.",
    punkte: ["Ruheübungen", "Mentale Auslastung", "Entspannungssignale"],
  },
  jumping: {
    name: "Anspringen abgewöhnen",
    versprechen: "Er lernt, Gäste ruhig zu begrüßen statt sie umzurennen.",
    punkte: ["Höfliche Begrüßung", "Vier-Pfoten-Regel", "Besuchertraining"],
  },
  destructive: {
    name: "Zerstörung verhindern",
    versprechen: "Schluss mit kaputten Schuhen und zerbissenen Möbeln.",
    punkte: ["Kau-Alternativen", "Langeweile vorbeugen", "Klare Grenzen"],
  },
};

// Themen ohne eigenes Shop-Modul auf das naechstbeste mappen
const ERSATZ: Record<string, string> = {
  mouthing: "destructive",
  soiling: "anxiety",
  "dog-reactive": "aggression",
  "leash-reactive": "pulling",
  "postman-reactive": "aggression",
  obedience: "recall",
  behavior: "energy",
  chasing: "recall",
  "prey-drive": "recall",
  "general-anxiety": "anxiety",
  "stranger-anxiety": "aggression",
};

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

export function modulFuer(answers: Record<string, any>): string {
  const kandidaten: string[] = [
    String(answers?.dog_problem || ""),
    ...(Array.isArray(answers?.dog_behaviors) ? answers.dog_behaviors.map((b: any) => String(b)) : []),
  ];
  for (const roh of kandidaten) {
    const k = MODULE[roh] ? roh : ERSATZ[roh] || "";
    if (k && MODULE[k]) return k;
  }
  return "pulling"; // haeufigstes Thema unserer Kunden
}

function subjectFor(dog: string, modulKey: string, id: string): string {
  const m = MODULE[modulKey];
  const c = (id || "").replace(/[^0-9a-f]/gi, "").slice(-1).toLowerCase();
  return parseInt(c || "0", 16) % 2 === 1
    ? `${m.name} bei ${dog}: 6 Übungen`
    : `Das Thema von damals ist wahrscheinlich noch da`;
}

function buildHtml(dog: string, modulKey: string, id: string, email: string): string {
  const m = MODULE[modulKey];
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const shop = `https://www.pfoten-plan.de/modul-shop.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  const wa = "https://wa.me/4915129892586?text=Hallo%2C%20ich%20habe%20eine%20Frage%20zu%20den%20Modulen%20%F0%9F%90%BE";
  const p = "margin:0 0 16px;font-size:16px;";
  const punkte = m.punkte
    .map((x) => `<p style="margin:0 0 8px;font-size:15.5px;"><span style="color:#16A34A;font-weight:900;margin-right:7px;">&#10003;</span>${x}</p>`)
    .join("");
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pfoten-Plan</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;line-height:1.7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Kein ganzer Plan. Nur das eine Thema, sechs Übungen.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 36px 6px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#8B7355;">🐾 Pfoten-Plan</div></td></tr>
<tr><td style="padding:14px 36px 8px;">
<p style="${p}">Hallo,</p>
<p style="${p}">du hast dir vor einiger Zeit für <strong>${dog}</strong> einen Trainingsplan angesehen und dich dann anders entschieden. Völlig in Ordnung, das muss nicht jeder.</p>
<p style="${p}">Aber das eine Thema, wegen dem du damals hier warst, ist wahrscheinlich noch da. Bei dir stand im Fragebogen: <strong>${m.name}</strong>.</p>
<p style="${p}">Dafür brauchst du keinen ganzen Plan. Es gibt das Thema auch einzeln.</p>
<p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#3a342b;">${m.name}</p>
<p style="${p}">${m.versprechen}</p>
${punkte}
<p style="margin:16px 0 0;font-size:15px;color:#4B5563;">Sechs Übungen, aufgebaut über zwei Wochen. Zehn Minuten am Tag reichen. Kommt sofort als PDF, bleibt deins. Kein Abo, kein Plan, keine Folgekosten.</p>
</td></tr>
<tr><td style="padding:18px 36px 6px;text-align:center;">
<a href="${shop}" style="display:inline-block;background:#8B7355;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 34px;border-radius:12px;">${m.name} ansehen</a>
<p style="margin:12px 0 0;font-size:15px;color:#3a342b;"><strong>${MODUL_PREIS} €</strong> einmalig <span style="color:#9CA3AF;text-decoration:line-through;">29 €</span></p>
<p style="margin:4px 0 0;font-size:13.5px;color:#6B7280;">Sofort im Postfach · 30 Tage Geld-zurück-Garantie</p>
</td></tr>
<tr><td style="padding:18px 36px 4px;">
<p style="margin:0 0 6px;font-size:16px;">Viele Grüße an ${dog},</p>
<p style="margin:0;font-size:16px;"><strong>Laura</strong> vom Pfoten-Plan-Team</p>
</td></tr>
<tr><td style="padding:6px 36px 26px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F1FAF2;border:1px solid #C9E7CE;border-radius:14px;"><tr><td style="padding:16px 18px;">
<p style="margin:0 0 10px;font-size:15px;color:#1f2937;">Unsicher, ob das zu ${dog} passt? Schreib uns, wir sagen dir ehrlich, ob es hilft.</p>
<a href="${wa}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:11px 20px;border-radius:10px;">💬 Auf WhatsApp schreiben</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;"><p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.7;">Pfoten-Plan · Persönliches Hundetraining<br>Keine Post mehr? <a href="${unsub}" style="color:#9CA3AF;text-decoration:underline;">Hier abmelden</a>.</p></td></tr>
</table></td></tr></table></body></html>`;
}

function buildText(dog: string, modulKey: string, id: string, email: string): string {
  const m = MODULE[modulKey];
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const shop = `https://www.pfoten-plan.de/modul-shop.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  return `Hallo,

du hast dir vor einiger Zeit für ${dog} einen Trainingsplan angesehen und dich dann anders entschieden. Völlig in Ordnung, das muss nicht jeder.

Aber das eine Thema, wegen dem du damals hier warst, ist wahrscheinlich noch da. Bei dir stand im Fragebogen: ${m.name}.

Dafür brauchst du keinen ganzen Plan. Es gibt das Thema auch einzeln.

${m.name.toUpperCase()}
${m.versprechen}
${m.punkte.map((x) => "- " + x).join("\n")}

Sechs Übungen, aufgebaut über zwei Wochen. Zehn Minuten am Tag reichen.
Kommt sofort als PDF, bleibt deins. Kein Abo, kein Plan, keine Folgekosten.

${MODUL_PREIS} Euro einmalig statt 29, mit 30 Tagen Geld-zurück-Garantie:
${shop}

Viele Grüße an ${dog},
Laura vom Pfoten-Plan-Team

Unsicher, ob das zu ${dog} passt? Schreib uns, per Antwort auf diese Mail
oder auf WhatsApp: +49 151 29892586

Keine Post mehr? Hier abmelden: ${unsub}`;
}

async function sendOne(email: string, dog: string, modulKey: string, id: string) {
  return ses("POST", "/v2/email/outbound-emails", {
    FromEmailAddress: FROM,
    Destination: { ToAddresses: [email] },
    ReplyToAddresses: ["support@pfoten-plan.de"],
    ConfigurationSetName: CONFIG_SET,
    EmailTags: [
      { Name: "campaign", Value: CAMPAIGN },
      { Name: "modul", Value: modulKey },
    ],
    Content: {
      Simple: {
        Subject: { Data: subjectFor(dog, modulKey, id), Charset: "UTF-8" },
        Body: {
          Html: { Data: buildHtml(dog, modulKey, id, email), Charset: "UTF-8" },
          Text: { Data: buildText(dog, modulKey, id, email), Charset: "UTF-8" },
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
    const thema = searchParams.get("thema") || "pulling";
    const modul = MODULE[thema] ? thema : "pulling";
    const res = await sendOne(testTo, "Bella", modul, "test-lead-000k");
    return NextResponse.json({ test: testTo, modul, status: res.status, data: res.data.slice(0, 200) });
  }

  const dry = searchParams.get("dry") === "1";

  const { data: flags } = await supabase
    .from("system_settings")
    .select("key,value")
    .in("key", ["kampagne_kalt_live", "kampagne_kalt_stop", "kampagne_kalt_limit"]);
  const flag = (k: string) => String((flags || []).find((f: any) => f.key === k)?.value || "");
  if (!dry && flag("kampagne_kalt_live") !== "true") {
    return NextResponse.json({ ok: true, wartet: true, hinweis: "system_settings.kampagne_kalt_live ist nicht auf true" });
  }
  if (flag("kampagne_kalt_stop") === "true") {
    return NextResponse.json({ ok: true, gestoppt: true, hinweis: "system_settings.kampagne_kalt_stop ist gesetzt" });
  }

  // Obergrenze. Leerer Wert heisst "nicht gesetzt", nicht "null erlaubt".
  const limitText = flag("kampagne_kalt_limit").trim();
  const limitRoh = limitText === "" ? NaN : Number(limitText);
  const limit =
    Number.isFinite(limitRoh) && limitRoh > 0 && limitRoh <= 100000 ? limitRoh : LIMIT_STANDARD;

  const { count: bereitsGesendet } = await supabase
    .from("wauwerk_leads")
    .select("id", { count: "exact", head: true })
    .eq("answers->>kampagne_kalt_sent", "true");
  const schonRaus = bereitsGesendet || 0;
  if (schonRaus >= limit) {
    return NextResponse.json({ ok: true, fertig: true, gesendet: 0, grund: "limit_erreicht", limit, bisher: schonRaus });
  }

  const karenz = new Date(Date.now() - KARENZ_TAGE * 86400000).toISOString();
  const { data, error } = await supabase
    .from("wauwerk_leads")
    .select("id, email, dog_name, answers, created_at")
    .eq("status", "email_captured")
    .not("email", "is", null)
    .lt("created_at", karenz)
    .is("answers->>lang", null)
    .is("answers->>unsubscribed", null)
    .is("answers->>zusatzmodul_sent", null)
    .is("answers->>kampagne_kalt_sent", null)
    .order("created_at", { ascending: false })
    .limit(BATCH * 3);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Lead = { id: string; email: string | null; dog_name: string | null; answers: Record<string, any> | null; created_at: string };
  const roh = (data || []) as Lead[];
  if (roh.length === 0) {
    return NextResponse.json({ ok: true, fertig: true, gesendet: 0, grund: "keine_offenen" });
  }

  const platz = Math.max(0, limit - schonRaus);
  const imBatch = roh.slice(0, Math.min(BATCH, platz));

  // Sicherheitsnetz: niemanden anschreiben, der unter dieser Adresse gekauft hat
  const mails = imBatch.map((l) => (l.email || "").toLowerCase()).filter(Boolean);
  const { data: kaeufer } = await supabase
    .from("wauwerk_leads")
    .select("email")
    .eq("status", "paid")
    .in("email", mails);
  const istKunde = new Set(((kaeufer || []) as Array<{ email: string | null }>).map((k) => (k.email || "").toLowerCase()));

  if (dry) {
    const gesehen = new Set<string>();
    const offen = imBatch.filter((l) => {
      const m = (l.email || "").toLowerCase();
      if (istKunde.has(m) || gesehen.has(m)) return false;
      gesehen.add(m);
      return true;
    });
    const b = offen[0];
    return NextResponse.json({
      ok: true,
      modus: "DRY-RUN",
      freigabe: flag("kampagne_kalt_live") === "true",
      limit,
      bisher_gesendet: schonRaus,
      im_batch: offen.length,
      davon_schon_kunde: imBatch.length - offen.length,
      beispiel: b
        ? {
            email: b.email,
            hund: b.dog_name,
            lead_vom: (b.created_at || "").slice(0, 10),
            modul: modulFuer(b.answers || {}),
            betreff: subjectFor(b.dog_name || "deinem Hund", modulFuer(b.answers || {}), b.id),
          }
        : null,
    });
  }

  let ok = 0, err = 0, skip = 0;
  const gesehen = new Set<string>();
  for (const l of imBatch) {
    const mail = (l.email || "").toLowerCase();
    const prev = (l.answers || {}) as Record<string, any>;
    if (istKunde.has(mail) || gesehen.has(mail)) {
      skip++;
      await supabase
        .from("wauwerk_leads")
        .update({ answers: { ...prev, kampagne_kalt_sent: "skip_ist_kunde_oder_dublette" } })
        .eq("id", l.id);
      continue;
    }
    gesehen.add(mail);
    const dog = (l.dog_name || "").trim() || "deinem Hund";
    const modul = modulFuer(prev);
    let res;
    try {
      res = await sendOne(String(l.email), dog, modul, l.id);
    } catch {
      err++;
      continue;
    }
    if (res.status < 300) {
      ok++;
      await supabase
        .from("wauwerk_leads")
        .update({
          answers: {
            ...prev,
            kampagne_kalt_sent: true,
            kampagne_kalt_sent_at: new Date().toISOString(),
            kampagne_kalt_modul: modul,
          },
        })
        .eq("id", l.id);
    } else {
      err++;
    }
  }

  return NextResponse.json({
    ok: true,
    modus: "LIVE",
    limit,
    bisher_gesendet: schonRaus + ok,
    gesendet: ok,
    uebersprungen: skip,
    fehler: err,
  });
}
