// Modul-Shop-Kampagne — 21 Tage nach dem Kauf, serverseitig ueber Amazon SES.
//
// WARUM 21 TAGE: Nach drei Wochen ist der Trainingsplan im Alltag angekommen.
// Der Halter weiss dann, was klappt und was nicht — und genau das Thema, das
// noch hakt, verkauft sich von selbst. Vorher ist es zu frueh, da liest er
// noch den Plan.
//
// Die Mail haengt am EIGENEN Thema aus dem Fragebogen ("Du hast damals
// Leinenziehen angegeben"), nicht an "unser Shop ist umgebaut". Das Thema
// steht bei ueber 8.000 Kaeufern in den Daten, wir muessen es nur einsetzen.
//
// ZIELGRUPPE (strikt, DACH-Kaeufer):
//   status = paid, answers.lang IS NULL, nicht abgemeldet
//   paid_at aelter als der Karenz-Wert (Standard 21 Tage)
//   answers.kampagne_shop_sent IS NULL
//   + Mindestabstand zur letzten Kampagnenmail (Standard 7 Tage). Sonst
//     bekommt der Rueckstand zwei Verkaufsmails in derselben Woche.
//   + Dedup UEBER DIE E-MAIL (Wiederholungskaeufer haben mehrere paid-Zeilen)
//
// FREIGABE: sendet nur bei system_settings.kampagne_shop_live = "true".
// Not-Aus: kampagne_shop_stop = "true". Karenz: kampagne_shop_karenz_tage.
//   ?dry=1          -> zeigt nur, wer dran waere
//   ?test=mail@x.de -> eine Mustermail (?thema=pulling waehlt das Modul)

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
const CAMPAIGN = "modulshop-21tage";
const BATCH = 100;
const KARENZ_TAGE_STANDARD = 21;
const KARENZ_TAGE_MAX = 3650;
const MIN_ABSTAND_TAGE = 7; // zur letzten Kampagnenmail

// Module aus public/modul-shop.html. Schluessel = dog_problem / dog_behaviors.
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

// dog_problem-Werte, fuer die es KEIN eigenes Modul gibt, auf das naechstbeste
// mappen. mouthing und soiling liegen im Themen-Plan, nicht im Shop.
const ERSATZ: Record<string, string> = {
  mouthing: "destructive",
  soiling: "anxiety",
  "dog-reactive": "aggression",
  "leash-reactive": "pulling",
  obedience: "recall",
  behavior: "energy",
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

/** Welches Modul passt? Hauptthema zuerst, dann das erste genannte Verhalten. */
export function modulFuer(answers: Record<string, any>): string {
  const kandidaten: string[] = [
    String(answers?.dog_problem || ""),
    ...(Array.isArray(answers?.dog_behaviors) ? answers.dog_behaviors.map((b: any) => String(b)) : []),
  ];
  const schonGekauft: string[] = Array.isArray(answers?.zusatzmodul_sent)
    ? answers.zusatzmodul_sent.map((m: any) => String(m))
    : [];
  for (const roh of kandidaten) {
    const k = MODULE[roh] ? roh : ERSATZ[roh] || "";
    if (k && MODULE[k] && !schonGekauft.includes(k)) return k;
  }
  // Alles schon gehabt oder nichts angegeben: das haeufigste Thema unserer Kunden
  return "pulling";
}

function subjectFor(dog: string, modulKey: string, id: string): string {
  const m = MODULE[modulKey];
  const c = (id || "").replace(/[^0-9a-f]/gi, "").slice(-1).toLowerCase();
  return parseInt(c || "0", 16) % 2 === 1
    ? `${dog} und ${m.name.toLowerCase()}: 8 Übungen`
    : `Das Thema, das du bei ${dog} angegeben hast`;
}

function buildHtml(dog: string, modulKey: string, id: string, email: string): string {
  const m = MODULE[modulKey];
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const shop = `https://www.pfoten-plan.de/modul-shop.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  const paket = `https://www.pfoten-plan.de/paket.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  const wa = "https://wa.me/4915129892586?text=Hallo%2C%20ich%20habe%20eine%20Frage%20zu%20den%20Modulen%20%F0%9F%90%BE";
  const p = "margin:0 0 16px;font-size:16px;";
  const punkte = m.punkte
    .map((x) => `<p style="margin:0 0 8px;font-size:15.5px;"><span style="color:#16A34A;font-weight:900;margin-right:7px;">&#10003;</span>${x}</p>`)
    .join("");
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pfoten-Plan</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;line-height:1.7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Acht Übungen für genau das eine Thema.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 36px 6px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#8B7355;">🐾 Pfoten-Plan</div></td></tr>
<tr><td style="padding:14px 36px 8px;">
<p style="${p}">Hallo,</p>
<p style="${p}">als du ${dog}s Plan geholt hast, stand im Fragebogen: <strong>${m.name}</strong>. Der Plan deckt das Thema ab — für genau diesen einen Punkt gibt es aber acht weitere Übungen, die tiefer gehen und über zwei Wochen aufeinander aufbauen.</p>
<p style="${p}">Auch die werden auf ${dog} zugeschnitten, nicht von der Stange.</p>
<p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#3a342b;">${m.name}</p>
<p style="${p}">${m.versprechen}</p>
${punkte}
<p style="margin:16px 0 0;font-size:15px;color:#4B5563;">Zehn Minuten am Tag reichen. Das Modul kommt sofort als PDF, bleibt deins, kein Abo.</p>
</td></tr>
<tr><td style="padding:16px 36px 6px;text-align:center;">
<a href="${shop}" style="display:inline-block;background:#8B7355;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 34px;border-radius:12px;">${m.name} ansehen</a>
<p style="margin:10px 0 0;font-size:13.5px;color:#6B7280;">Einmalig, kein Abo. Sofort im Postfach.</p>
</td></tr>
<tr><td style="padding:10px 36px 6px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFFBF5;border:1px solid #F0E3CE;border-radius:14px;"><tr><td style="padding:16px 18px;">
<p style="margin:0 0 6px;font-size:15px;color:#1f2937;"><strong>Mehr als ein Thema?</strong> Die meisten haben zwei oder drei.</p>
<p style="margin:0 0 10px;font-size:14.5px;color:#4B5563;">Dann lohnt sich das Komplettpaket: alle zwölf Module, das Charakterprofil und die Notfall-Karten zusammen.</p>
<a href="${paket}" style="font-size:15px;font-weight:700;color:#8B7355;text-decoration:underline;">Paket ansehen</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 36px 4px;">
<p style="margin:0 0 6px;font-size:16px;">Viele Grüße an ${dog},</p>
<p style="margin:0;font-size:16px;"><strong>Laura</strong> vom Pfoten-Plan-Team</p>
</td></tr>
<tr><td style="padding:6px 36px 26px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F1FAF2;border:1px solid #C9E7CE;border-radius:14px;"><tr><td style="padding:16px 18px;">
<p style="margin:0 0 10px;font-size:15px;color:#1f2937;">Unsicher, welches Modul zu ${dog} passt? Schreib uns, wir sagen es dir ehrlich.</p>
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
  const paket = `https://www.pfoten-plan.de/paket.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  return `Hallo,

als du ${dog}s Plan geholt hast, stand im Fragebogen: ${m.name}. Der Plan deckt das Thema ab — für genau diesen einen Punkt gibt es aber acht weitere Übungen, die tiefer gehen und über zwei Wochen aufeinander aufbauen.

Auch die werden auf ${dog} zugeschnitten, nicht von der Stange.

${m.name.toUpperCase()}
${m.versprechen}
${m.punkte.map((x) => "- " + x).join("\n")}

Zehn Minuten am Tag reichen. Das Modul kommt sofort als PDF, bleibt deins, kein Abo:
${shop}

Mehr als ein Thema? Die meisten haben zwei oder drei. Dann lohnt sich das
Komplettpaket mit allen zwölf Modulen, dem Charakterprofil und den
Notfall-Karten:
${paket}

Viele Grüße an ${dog},
Laura vom Pfoten-Plan-Team

Unsicher, welches Modul passt? Schreib uns, per Antwort auf diese Mail oder
auf WhatsApp: +49 151 29892586

Keine Post mehr? Hier abmelden: ${unsub}`;
}

// Welche Vorlage verschickt wird. "einzel" = ein Modul passend zum
// Fragebogen-Thema (Standard). "shop" = der ganze Shop auf einen Blick, fuer
// Kaeufer, deren Fragebogen-Thema laengst erledigt sein kann.
// Umschaltbar ueber system_settings.kampagne_shop_variante.
let VARIANTE: "einzel" | "shop" = "einzel";

function subjectForShop(dog: string, id: string): string {
  const c = (id || "").replace(/[^0-9a-f]/gi, "").slice(-1).toLowerCase();
  return parseInt(c || "0", 16) % 2 === 1
    ? `Acht Module für ${dog}, jedes mit acht Übungen`
    : `Was bei ${dog} als Nächstes dran wäre`;
}

/** Das Thema des Kunden steht oben, der Rest folgt. */
function shopReihenfolge(modulKey: string): string[] {
  const alle = Object.keys(MODULE);
  return [modulKey, ...alle.filter((k) => k !== modulKey)];
}

function buildHtmlShop(dog: string, modulKey: string, id: string, email: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const shop = `https://www.pfoten-plan.de/modul-shop.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  const paket = `https://www.pfoten-plan.de/paket.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  const wa = "https://wa.me/4915129892586?text=Hallo%2C%20ich%20habe%20eine%20Frage%20zu%20den%20Modulen%20%F0%9F%90%BE";
  const p = "margin:0 0 16px;font-size:16px;";
  const zeilen = shopReihenfolge(modulKey)
    .map((k, i) => {
      const m = MODULE[k];
      const deins =
        i === 0
          ? `<span style="display:inline-block;background:#F2F8F0;border:1px solid #D6E8D0;color:#2F6B34;border-radius:999px;padding:1px 8px;font-size:11.5px;font-weight:800;margin-left:6px;">dein Thema</span>`
          : "";
      return `<tr><td style="padding:9px 0;border-bottom:1px solid #F2EDE4;">
<p style="margin:0 0 2px;font-size:15.5px;font-weight:700;color:#3a342b;">${m.name}${deins}</p>
<p style="margin:0;font-size:14px;color:#4B5563;line-height:1.5;">${m.versprechen}</p></td></tr>`;
    })
    .join("");
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pfoten-Plan</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;line-height:1.7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Acht Themen, je acht Übungen. Mehrere zusammen kosten weniger.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 36px 6px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#8B7355;">🐾 Pfoten-Plan</div></td></tr>
<tr><td style="padding:14px 36px 8px;">
<p style="${p}">Hallo,</p>
<p style="${p}">${dog}s Trainingsplan deckt das Thema ab, das du im Fragebogen angegeben hast. Für acht Themen gibt es zusätzlich ein eigenes Modul, das tiefer geht: <strong>je acht Übungen</strong>, über zwei Wochen aufeinander aufgebaut und auf ${dog} zugeschnitten.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${zeilen}</table>
<p style="margin:18px 0 6px;font-size:16px;"><strong>Warum die meisten mehr als ein Modul nehmen</strong></p>
<p style="margin:0 0 16px;font-size:15.5px;color:#4B5563;line-height:1.6;">Viele Themen hängen zusammen. Ein Hund, der schlecht allein bleibt, bellt oft auch mehr. Wer zu viel Energie hat, zieht meistens auch an der Leine. Das zweite Modul ist deshalb selten Luxus — es ist das, was das erste hält. Und ein Thema, das noch klein ist, bekommt man deutlich leichter in den Griff als eines, das sich über Monate festgesetzt hat.</p>
<p style="margin:18px 0 0;font-size:16px;"><strong>19 €</strong> pro Modul <span style="color:#9CA3AF;text-decoration:line-through;">29 €</span> — mehrere zusammen kosten deutlich weniger:</p>
</td></tr>
<tr><td style="padding:10px 36px 6px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFFBF5;border:1px solid #F0E3CE;border-radius:14px;"><tr><td style="padding:16px 18px;text-align:center;">
<p style="margin:0;font-size:15.5px;color:#3a342b;line-height:1.9;"><strong>2 Module 25 €</strong> · <strong>3 für 35 €</strong> · <strong>5 für 55 €</strong><br><strong>alle acht für 85 €</strong> statt 152 €</p>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 36px 6px;text-align:center;">
<a href="${shop}" style="display:inline-block;background:#8B7355;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 34px;border-radius:12px;">Alle Module entdecken</a>
<p style="margin:10px 0 0;font-size:13.5px;color:#6B7280;">Einmalig, kein Abo. Sofort im Postfach.</p>
</td></tr>
<tr><td style="padding:10px 36px 6px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFFBF5;border:1px solid #F0E3CE;border-radius:14px;"><tr><td style="padding:16px 18px;">
<p style="margin:0 0 6px;font-size:15px;color:#1f2937;"><strong>Oder gleich alles.</strong></p>
<p style="margin:0 0 10px;font-size:14.5px;color:#4B5563;">Im Komplettpaket sind alle zwölf Themen-Pläne, das Charakterprofil und die Notfall-Karten enthalten — für 99 €.</p>
<a href="${paket}" style="font-size:15px;font-weight:700;color:#8B7355;text-decoration:underline;">Paket ansehen</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 36px 4px;">
<p style="margin:0 0 6px;font-size:16px;">Viele Grüße an ${dog},</p>
<p style="margin:0;font-size:16px;"><strong>Laura</strong> vom Pfoten-Plan-Team</p>
</td></tr>
<tr><td style="padding:6px 36px 26px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F1FAF2;border:1px solid #C9E7CE;border-radius:14px;"><tr><td style="padding:16px 18px;">
<p style="margin:0 0 10px;font-size:15px;color:#1f2937;">Unsicher, welches Modul zu ${dog} passt? Schreib uns, wir sagen es dir ehrlich.</p>
<a href="${wa}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:11px 20px;border-radius:10px;">💬 Auf WhatsApp schreiben</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;"><p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.7;">Pfoten-Plan · Persönliches Hundetraining<br>Keine Post mehr? <a href="${unsub}" style="color:#9CA3AF;text-decoration:underline;">Hier abmelden</a>.</p></td></tr>
</table></td></tr></table></body></html>`;
}

function buildTextShop(dog: string, modulKey: string, id: string, email: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const shop = `https://www.pfoten-plan.de/modul-shop.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  const paket = `https://www.pfoten-plan.de/paket.html?lead_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`;
  const liste = shopReihenfolge(modulKey)
    .map((k, i) => `- ${MODULE[k].name}${i === 0 ? " (dein Thema)" : ""}: ${MODULE[k].versprechen}`)
    .join("\n");
  return `Hallo,

${dog}s Trainingsplan deckt das Thema ab, das du im Fragebogen angegeben hast.
Für acht Themen gibt es zusätzlich ein eigenes Modul, das tiefer geht: je acht
Übungen, über zwei Wochen aufeinander aufgebaut und auf ${dog} zugeschnitten.

${liste}

WARUM DIE MEISTEN MEHR ALS EIN MODUL NEHMEN
Viele Themen haengen zusammen. Ein Hund, der schlecht allein bleibt, bellt oft
auch mehr. Wer zu viel Energie hat, zieht meistens auch an der Leine. Das
zweite Modul ist deshalb selten Luxus, es ist das, was das erste haelt. Und
ein Thema, das noch klein ist, bekommt man deutlich leichter in den Griff als
eines, das sich ueber Monate festgesetzt hat.

19 EUR pro Modul statt 29. Mehrere zusammen kosten deutlich weniger:
2 Module 25 EUR, 3 fuer 35 EUR, 5 fuer 55 EUR, alle acht fuer 85 EUR statt 152.

Alle Module entdecken:
${shop}

Oder gleich alles: Im Komplettpaket sind alle zwoelf Themen-Plaene, das
Charakterprofil und die Notfall-Karten enthalten, fuer 99 EUR:
${paket}

Viele Gruesse an ${dog},
Laura vom Pfoten-Plan-Team

Unsicher, welches Modul passt? Schreib uns, per Antwort auf diese Mail oder
auf WhatsApp: +49 151 29892586

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
        Subject: {
          Data: VARIANTE === "shop" ? subjectForShop(dog, id) : subjectFor(dog, modulKey, id),
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data:
              VARIANTE === "shop"
                ? buildHtmlShop(dog, modulKey, id, email)
                : buildHtml(dog, modulKey, id, email),
            Charset: "UTF-8",
          },
          Text: {
            Data:
              VARIANTE === "shop"
                ? buildTextShop(dog, modulKey, id, email)
                : buildText(dog, modulKey, id, email),
            Charset: "UTF-8",
          },
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
    // Vorlage fuer den Test direkt waehlen, ohne den Schalter fuer den
    // echten Versand anzufassen: ?variante=shop
    VARIANTE = searchParams.get("variante") === "shop" ? "shop" : "einzel";
    const res = await sendOne(testTo, "Bella", modul, "test-lead-000s");
    return NextResponse.json({ test: testTo, modul, variante: VARIANTE, status: res.status, data: res.data.slice(0, 200) });
  }

  const dry = searchParams.get("dry") === "1";

  const { data: flags } = await supabase
    .from("system_settings")
    .select("key,value")
    .in("key", [
      "kampagne_shop_live",
      "kampagne_shop_stop",
      "kampagne_shop_karenz_tage",
      "kampagne_shop_variante",
    ]);
  const flag = (k: string) => String((flags || []).find((f: any) => f.key === k)?.value || "");
  if (!dry && flag("kampagne_shop_live") !== "true") {
    return NextResponse.json({ ok: true, wartet: true, hinweis: "system_settings.kampagne_shop_live ist nicht auf true" });
  }
  if (flag("kampagne_shop_stop") === "true") {
    return NextResponse.json({ ok: true, gestoppt: true, hinweis: "system_settings.kampagne_shop_stop ist gesetzt" });
  }

  // Achtung: Number("") ist 0, nicht NaN. Fehlte der Schalter, ergab die
  // alte Pruefung eine Karenz von 0 Tagen, und es haetten auch Leute Post
  // bekommen, die heute erst gekauft haben. Leerer Wert heisst jetzt
  // "nicht gesetzt" und faellt auf den Standard zurueck.
  VARIANTE = flag("kampagne_shop_variante").trim() === "shop" ? "shop" : "einzel";

  const karenzText = flag("kampagne_shop_karenz_tage").trim();
  const karenzRoh = karenzText === "" ? NaN : Number(karenzText);
  const karenzTage =
    Number.isFinite(karenzRoh) && karenzRoh > 0 && karenzRoh <= KARENZ_TAGE_MAX
      ? karenzRoh
      : KARENZ_TAGE_STANDARD;
  const karenz = new Date(Date.now() - karenzTage * 86400000).toISOString();

  const { data, error } = await supabase
    .from("wauwerk_leads")
    .select("id, email, dog_name, answers, paid_at")
    .eq("status", "paid")
    .not("email", "is", null)
    .lt("paid_at", karenz)
    .is("answers->>lang", null)
    .is("answers->>unsubscribed", null)
    .is("answers->>kampagne_shop_sent", null)
    // Mindestabstand schon hier, nicht erst im Speicher. Vorher lud die
    // Abfrage die 300 neuesten Kaeufe und warf sie danach alle weg, wenn sie
    // zu frisch angeschrieben waren — wer eigentlich dran gewesen waere,
    // stand weiter hinten und wurde nie geladen. Der Lauf lieferte dann
    // dauerhaft null, obwohl Empfaenger offen waren.
    .or(
      `answers->>kampagne_cp_sent_at.is.null,answers->>kampagne_cp_sent_at.lt.${new Date(
        Date.now() - MIN_ABSTAND_TAGE * 86400000
      ).toISOString()}`
    )
    .order("paid_at", { ascending: false })
    .limit(BATCH * 3);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Lead = {
    id: string;
    email: string | null;
    dog_name: string | null;
    answers: Record<string, any> | null;
    paid_at: string | null;
  };
  const roh = (data || []) as Lead[];
  if (roh.length === 0) {
    return NextResponse.json({ ok: true, fertig: true, gesendet: 0, grund: "keine_offenen" });
  }

  // Mindestabstand zur letzten Kampagnenmail: niemand soll zwei Verkaufsmails
  // in derselben Woche bekommen.
  const grenze = Date.now() - MIN_ABSTAND_TAGE * 86400000;
  const passend = roh.filter((l) => {
    const letzte = (l.answers || {}).kampagne_cp_sent_at;
    if (!letzte) return true;
    const t = new Date(letzte).getTime();
    return !Number.isFinite(t) || t < grenze;
  });
  const imBatch = passend.slice(0, BATCH);
  if (imBatch.length === 0) {
    return NextResponse.json({ ok: true, gesendet: 0, grund: "alle_zu_frisch_angeschrieben", geladen: roh.length });
  }

  // Dedup ueber die E-Mail (Wiederholungskaeufer haben mehrere paid-Zeilen)
  const mails = imBatch.map((l) => (l.email || "").toLowerCase()).filter(Boolean);
  const { data: schonMal } = await supabase
    .from("wauwerk_leads")
    .select("email, answers")
    .in("email", mails);
  const bereits = new Set(
    ((schonMal || []) as Array<{ email: string | null; answers: Record<string, any> | null }>)
      .filter((r) => (r.answers || {}).kampagne_shop_sent)
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
      freigabe: flag("kampagne_shop_live") === "true",
      karenz_tage: karenzTage,
      geladen: roh.length,
      zu_frisch_angeschrieben: roh.length - passend.length,
      im_batch: imBatch.length,
      beispiel: b
        ? {
            email: b.email,
            hund: b.dog_name,
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
    if (bereits.has(mail) || gesehen.has(mail)) {
      skip++;
      await supabase
        .from("wauwerk_leads")
        .update({ answers: { ...prev, kampagne_shop_sent: "skip_dublette" } })
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
            kampagne_shop_sent: true,
            kampagne_shop_sent_at: new Date().toISOString(),
            kampagne_shop_modul: modul,
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
    karenz_tage: karenzTage,
    gesendet: ok,
    uebersprungen_dublette: skip,
    fehler: err,
    batch: imBatch.length,
  });
}
