// Charakterprofil Welle 2: zweiter Anlauf an Käufer, die Welle 1 bekommen und
// nicht gekauft haben. Batch-Versand über Amazon SES, gleiches Muster wie
// kampagne-charakterprofil.
//
// WARUM: Charakterprofil ist die stärkste Käufer-Kampagne (0,455 % Kaufquote,
// 118 € je 1.000 Mails). Welle 1 ging ab 20.09. an rund 8.800 Käufer, die nicht
// gekauft haben. Welle 2 bringt einen neuen Aufhänger: Statt das Produkt zu
// beschreiben, zeigt sie einen echten Satz aus dem Profil (Zuchtzweck der Rasse
// und was das heute heißt) plus das Thema, das der Kunde selbst angegeben hat.
//
// ZIELGRUPPE (DACH-Käufer):
//   status = paid, answers.lang IS NULL, answers.unsubscribed IS NULL
//   answers.charakterprofil_sent_at NULL      -> Profil nicht gekauft
//   answers.kampagne_cp_sent = true           -> Welle 1 wirklich bekommen
//   answers.kampagne_cp_sent_at älter als ABSTAND_TAGE
//   answers.kampagne_cp2_sent NULL            -> eigener Dedup-Marker
//   + Dedup über die E-Mail (Wiederholungskäufer haben mehrere paid-Zeilen)
//
// DAUER-WORKFLOW: Der Cron läuft sonntags weiter. Neue Käufer bekommen Welle 2
// automatisch, sobald ihre Welle-1-Mail ABSTAND_TAGE alt ist.
//
// FREIGABE: sendet NUR mit system_settings.kampagne_cp2_live = "true".
// Not-Aus: kampagne_cp2_stop = "true".
//   ?dry=1          -> zeigt nur, wer dran wäre
//   ?test=mail@x.de -> eine Mustermail (&rasse=, &thema=, &g=female)

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { infoFuer } from "@/lib/rasse-info";
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
const CAMPAIGN = "charakterprofil-w2";
const BATCH = 100;      // pro Lauf, SES erlaubt 14/s
const ABSTAND_TAGE = 21; // so lange nach Welle 1 frühestens

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
// Freitext aus dem Fragebogen landet im HTML.
const sauber = (s: string) => s.replace(/[<>"&]/g, "").trim();

const THEMEN: Record<string, string> = {
  recall: "der Rückruf", pulling: "die Leinenführigkeit", barking: "das Bellen",
  aggression: "Hundebegegnungen", anxiety: "Unsicherheit und Angst", separation: "das Alleinbleiben",
  mouthing: "das Zwicken", destructive: "das Zerstören", jumping: "das Anspringen",
  energy: "die Unruhe", obedience: "der Grundgehorsam", potty: "die Stubenreinheit",
};

function variantB(id: string): boolean {
  const c = (id || "").replace(/[^0-9a-f]/gi, "").slice(-1).toLowerCase();
  return parseInt(c || "0", 16) % 2 === 1;
}

function subjectFor(dog: string, thema: string, id: string): string {
  const t = THEMEN[thema];
  if (variantB(id) && t) return `${dog} und ${t}: Es liegt nicht an dir`;
  return `Ein Satz über ${dog}, der vieles erklärt`;
}

function pron(g: string) {
  return g === "female" ? { er: "sie", sein: "ihr" } : { er: "er", sein: "sein" };
}

// Der Satz aus dem Profil. Rasse bekannt -> Zuchtzweck + was das heute heißt.
// Mischling oder unbekannte Rasse -> der Mischlings-Satz von der Landingpage.
function zitat(dog: string, rasse: string): { kopf: string; satz: string } {
  const info = istMisch(rasse) ? null : infoFuer(rasse);
  if (info) return { kopf: rasse, satz: `${info[0]} ${info[1]}` };
  return {
    kopf: istMisch(rasse) ? "Mischling" : rasse,
    satz: `${dog} erbt aus mehreren Richtungen gleichzeitig. Welcher Anteil bei ${dog} durchschlägt, entscheidet, woran ihr wirklich arbeiten müsst.`,
  };
}

function ctaUrl(id: string, email: string, thema: string, g: string): string {
  const q = new URLSearchParams({ lead_id: id, email, utm_source: "email", utm_medium: "kampagne", utm_campaign: CAMPAIGN });
  if (THEMEN[thema]) q.set("thema", thema);
  if (g) q.set("g", g);
  return `https://www.pfoten-plan.de/charakterprofil.html?${q.toString()}`;
}

function themaSatz(dog: string, thema: string, p: ReturnType<typeof pron>): string {
  const t = THEMEN[thema];
  if (!t) return `Im Profil steht, warum ${dog} so ist und was ${p.er} jeden Tag wirklich braucht.`;
  return `Im Fragebogen hast du angegeben, dass ${t} euer größtes Thema ist. Im Profil steht, warum das gerade bei ${dog} so ist, und was du deshalb anders machen kannst als bei einem anderen Hund.`;
}

function buildHtml(dog: string, rasse: string, thema: string, g: string, id: string, email: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const cta = ctaUrl(id, email, thema, g);
  const wa = "https://wa.me/4915129892586?text=Hallo%2C%20ich%20habe%20eine%20Frage%20zum%20Charakterprofil%20%F0%9F%90%BE";
  const p = pron(g);
  const z = zitat(dog, rasse);
  const s = "margin:0 0 16px;font-size:16px;";
  const li = "margin:0 0 9px;font-size:15.5px;";
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pfoten-Plan</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;line-height:1.7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Ein echter Satz aus ${dog}s Charakterprofil.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 36px 6px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#8B7355;">🐾 Pfoten-Plan</div></td></tr>
<tr><td style="padding:14px 36px 8px;">
<p style="${s}">Hallo,</p>
<p style="${s}">vor ein paar Wochen habe ich dir vom Charakterprofil für <strong>${dog}</strong> geschrieben. Statt es noch einmal zu beschreiben, zeige ich dir heute einfach einen Satz daraus:</p>
</td></tr>
<tr><td style="padding:0 36px 10px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FBF6EE;border-left:4px solid #C9A46A;border-radius:10px;"><tr><td style="padding:16px 20px;">
<p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#8B7355;">${z.kopf}</p>
<p style="margin:0;font-size:17px;line-height:1.6;color:#3a342b;font-style:italic;">${z.satz}</p>
</td></tr></table>
</td></tr>
<tr><td style="padding:10px 36px 8px;">
<p style="${s}">Viele kennen das: Man übt und übt, und ${dog} macht trotzdem das, was ${p.er} immer macht. Oft liegt das nicht am Training, sondern daran, dass ${p.sein} Grundprogramm gegen die Übung arbeitet.</p>
<p style="${s}">${themaSatz(dog, thema, p)}</p>
<p style="${li}">🚶 Wie viel Bewegung ${dog} wirklich braucht, und welche Art</p>
<p style="${li}">😴 Wie viel Schlaf nötig ist und woran du Übermüdung erkennst</p>
<p style="margin:0 0 16px;font-size:15.5px;">🧠 Vier Übungen, die zu ${p.sein}em Charakter passen, plus ein 7-Tage-Start zum Abhaken</p>
</td></tr>
<tr><td style="padding:4px 36px 6px;text-align:center;">
<a href="${cta}" style="display:inline-block;background:#8B7355;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 34px;border-radius:12px;">${dog}s Charakterprofil ansehen</a>
<p style="margin:10px 0 0;font-size:13.5px;color:#6B7280;">24,90 €, einmalig, kein Abo. Kommt sofort als PDF per E-Mail.</p>
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

function buildText(dog: string, rasse: string, thema: string, g: string, id: string, email: string): string {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${encodeURIComponent(id)}`;
  const p = pron(g);
  const z = zitat(dog, rasse);
  return `Hallo,

vor ein paar Wochen habe ich dir vom Charakterprofil für ${dog} geschrieben. Statt es noch einmal zu beschreiben, zeige ich dir heute einfach einen Satz daraus:

${z.kopf.toUpperCase()}
"${z.satz}"

Viele kennen das: Man übt und übt, und ${dog} macht trotzdem das, was ${p.er} immer macht. Oft liegt das nicht am Training, sondern daran, dass ${p.sein} Grundprogramm gegen die Übung arbeitet.

${themaSatz(dog, thema, p)}

- Wie viel Bewegung ${dog} wirklich braucht, und welche Art
- Wie viel Schlaf nötig ist und woran du Übermüdung erkennst
- Vier Übungen, die zu ${p.sein}em Charakter passen, plus ein 7-Tage-Start zum Abhaken

${dog}s Charakterprofil ansehen:
${ctaUrl(id, email, thema, g)}

24,90 €, einmalig, kein Abo. Kommt sofort als PDF per E-Mail.

Viele Grüße an ${dog},
Laura vom Pfoten-Plan-Team

Eine Frage zu ${dog} oder zum Profil? Schreib uns einfach,
per Antwort auf diese Mail oder direkt auf WhatsApp: +49 151 29892586

Keine Post mehr? Hier abmelden: ${unsub}`;
}

async function sendOne(email: string, dog: string, rasse: string, thema: string, g: string, id: string) {
  return ses("POST", "/v2/email/outbound-emails", {
    FromEmailAddress: FROM,
    Destination: { ToAddresses: [email] },
    ReplyToAddresses: ["support@pfoten-plan.de"],
    ConfigurationSetName: CONFIG_SET,
    EmailTags: [{ Name: "campaign", Value: CAMPAIGN }],
    Content: {
      Simple: {
        Subject: { Data: subjectFor(dog, thema, id), Charset: "UTF-8" },
        Body: {
          Html: { Data: buildHtml(dog, rasse, thema, g, id, email), Charset: "UTF-8" },
          Text: { Data: buildText(dog, rasse, thema, g, id, email), Charset: "UTF-8" },
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
    const res = await sendOne(
      testTo,
      "Bella",
      searchParams.get("rasse") || "Labrador Retriever",
      searchParams.get("thema") || "recall",
      searchParams.get("g") || "female",
      searchParams.get("id") || "test-lead-000b"
    );
    return NextResponse.json({ test: testTo, status: res.status, data: res.data.slice(0, 200) });
  }

  const dry = searchParams.get("dry") === "1";

  const { data: flags } = await supabase
    .from("system_settings")
    .select("key,value")
    .in("key", ["kampagne_cp2_live", "kampagne_cp2_stop"]);
  const flag = (k: string) => String((flags || []).find((f: any) => f.key === k)?.value || "");
  if (!dry && flag("kampagne_cp2_live") !== "true") {
    return NextResponse.json({ ok: true, wartet: true, hinweis: "system_settings.kampagne_cp2_live ist nicht auf true" });
  }
  if (flag("kampagne_cp2_stop") === "true") {
    return NextResponse.json({ ok: true, gestoppt: true, hinweis: "system_settings.kampagne_cp2_stop ist gesetzt" });
  }

  const abstand = new Date(Date.now() - ABSTAND_TAGE * 86400000).toISOString();
  const { data, error } = await supabase
    .from("wauwerk_leads")
    .select("id, email, dog_name, answers")
    .eq("status", "paid")
    .not("email", "is", null)
    .is("answers->>lang", null)
    .is("answers->>unsubscribed", null)
    .is("answers->>charakterprofil_sent_at", null)
    .eq("answers->>kampagne_cp_sent", "true")
    .lt("answers->>kampagne_cp_sent_at", abstand)
    .is("answers->>kampagne_cp2_sent", null)
    .order("paid_at", { ascending: false })
    .limit(BATCH);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Lead = { id: string; email: string | null; dog_name: string | null; answers: Record<string, any> | null };
  const imBatch = (data || []) as Lead[];
  if (imBatch.length === 0) {
    return NextResponse.json({ ok: true, fertig: true, gesendet: 0, grund: "keine_offenen" });
  }

  // Dedup über die E-Mail: schon Welle 2 bekommen oder Profil gekauft.
  const mails = imBatch.map((l) => (l.email || "").toLowerCase()).filter(Boolean);
  const { data: schonMal } = await supabase
    .from("wauwerk_leads")
    .select("email, answers")
    .in("email", mails);
  const bereits = new Set(
    ((schonMal || []) as Array<{ email: string | null; answers: Record<string, any> | null }>)
      .filter((r) => (r.answers || {}).kampagne_cp2_sent || (r.answers || {}).charakterprofil_sent_at)
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
    const a = (b?.answers || {}) as Record<string, any>;
    return NextResponse.json({
      ok: true,
      modus: "DRY-RUN",
      freigabe: flag("kampagne_cp2_live") === "true",
      im_batch: imBatch.length,
      davon_dubletten_oder_schon_versendet: imBatch.length - offen.length,
      beispiel: b
        ? {
            email: b.email,
            hund: b.dog_name,
            rasse: a.dog_breed || "",
            thema: a.dog_problem || "",
            betreff: subjectFor(b.dog_name || "deinem Hund", a.dog_problem || "", b.id),
            satz: zitat(b.dog_name || "dein Hund", String(a.dog_breed || "").trim()).satz,
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
        .update({ answers: { ...prev, kampagne_cp2_sent: "skip_dublette" } })
        .eq("id", l.id);
      continue;
    }
    gesehen.add(mail);
    const dog = sauber(l.dog_name || "");
    // Ohne Namen liest sich die Mail falsch ("Ein Satz über deinem Hund").
    if (!dog) {
      skip++;
      await supabase
        .from("wauwerk_leads")
        .update({ answers: { ...prev, kampagne_cp2_sent: "skip_kein_name" } })
        .eq("id", l.id);
      continue;
    }
    const rasse = sauber(String(prev.dog_breed || ""));
    const thema = String(prev.dog_problem || "");
    const g = String(prev.dog_gender || "");
    let res;
    try {
      res = await sendOne(String(l.email), dog, rasse, thema, g, l.id);
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
            kampagne_cp2_sent: true,
            kampagne_cp2_sent_at: new Date().toISOString(),
            kampagne_cp2_variant: variantB(l.id) && THEMEN[thema] ? "B" : "A",
          },
        })
        .eq("id", l.id);
    } else {
      err++;
    }
  }

  return NextResponse.json({ ok: true, modus: "LIVE", gesendet: ok, uebersprungen_dublette: skip, fehler: err, batch: imBatch.length });
}
