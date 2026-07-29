// Themenbasierter Warmup-/Value-Sender (SES, ue50-Ton).
// Jeder Lead bekommt die Value-Mail zu seinem gewaehlten Problem (dog_problem).
//
//   node warmup-sender.mjs --cap 150            # DRY-RUN (zeigt nur)
//   node warmup-sender.mjs --cap 150 --send     # echter Versand
//   node warmup-sender.mjs --cap 150 --send --theme energy   # nur ein Thema
//
// Schutz: Dry-Run ist Standard. Idempotent via answers.warmup_sent_at.
// Nur frische Gmail-Leads (status email_captured), nicht abgemeldet, DE.
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] ?? true) : d; };
const CAP = parseInt(getArg("--cap", "150"), 10);
const DO_SEND = args.includes("--send");
const ONLY_THEME = getArg("--theme", null);
const SENT_KEY = "warmup_sent_at";

const env = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
for (const l of env.split("\n")) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const RG = process.env.AWS_REGION || "eu-central-1", HOST = `email.${RG}.amazonaws.com`;
const AK = process.env.AWS_ACCESS_KEY_ID, SK = process.env.AWS_SECRET_ACCESS_KEY;
const hmac = (k, d) => crypto.createHmac("sha256", k).update(d).digest(); const sha = (d) => crypto.createHash("sha256").update(d).digest("hex");
async function ses(bodyObj) { const path = "/v2/email/outbound-emails"; const body = JSON.stringify(bodyObj); const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); const ds = amz.slice(0, 8); const ch = `content-type:application/json\nhost:${HOST}\nx-amz-date:${amz}\n`, sh = "content-type;host;x-amz-date"; const creq = ["POST", path, "", ch, sh, sha(body)].join("\n"); const scope = `${ds}/${RG}/ses/aws4_request`; const sts = ["AWS4-HMAC-SHA256", amz, scope, sha(creq)].join("\n"); let k = hmac("AWS4" + SK, ds); k = hmac(k, RG); k = hmac(k, "ses"); k = hmac(k, "aws4_request"); const sig = crypto.createHmac("sha256", k).update(sts).digest("hex"); const auth = `AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=${sh}, Signature=${sig}`; const r = await fetch(`https://${HOST}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Amz-Date": amz, Authorization: auth }, body }); return { status: r.status, data: await r.text() }; }

// dog_problem -> Thema
const MAP = {
  energy: "energy",
  recall: "recall", chasing: "recall", "chasing-cars": "recall", "chasing-movement": "recall", "prey-drive": "recall",
  pulling: "pulling",
  aggression: "aggression", "dog-reactive": "aggression", "leash-reactive": "aggression", overreaction: "aggression", "anxious-overreaction": "aggression",
  mouthing: "mouthing", "eating-unwanted": "mouthing", "eating-objects": "mouthing", "eating-trash": "mouthing",
};

const THEMES = {
  energy: {
    marketing: "marketing-energie.html",
    subject: (d) => `Eine einfache 10-Minuten-Übung, die ${d} abends ruhiger macht`,
    intro: (d) => `vielleicht kennst du das: Ihr wart lange draußen, und trotzdem kommt ${d} abends einfach nicht zur Ruhe.<br><br>Das ist ganz normal, und es liegt nicht an dir.<br><br>Viele denken dann, sie müssten noch mehr rausgehen. Aber das macht ${d} nur wacher, nicht ruhiger. Was wirklich müde macht, ist <b>Kopfarbeit</b>. Hier eine Übung, die du ganz in deinem Tempo machen kannst:`,
    exTitle: "Die Schnüffel-Suche (10 Minuten)",
    steps: (d) => [`Nimm eine Handvoll von ${d}s normalem Futter.`, `Verteile es in der Wohnung, erst offen sichtbar, dann etwas versteckter.`, `Sag ruhig „Such" und lass ${d} in Ruhe arbeiten.`, `Wenn er fertig ist, biete ihm seine Decke an und setz dich ruhig dazu.`],
    after: (d) => `Zwei Wochen lang jeden Abend, und du wirst den Unterschied merken. Du brauchst dafür nichts zu kaufen und keine besondere Ausrüstung.`,
    cta: (d) => `So sieht ${d}s kompletter Plan aus`,
  },
  recall: {
    marketing: "marketing-rueckruf.html",
    subject: (d) => `Damit ${d} wieder zu dir kommt, wenn du rufst`,
    intro: (d) => `kennst du das? Du rufst ${d}, und er läuft einfach weiter.<br><br>Das ist kein Ungehorsam. Meist ist das Wort „Hier" für ${d} nur noch nicht spannend genug. Das lässt sich in Ruhe ändern, hier die Übung:`,
    exTitle: "Der Freuden-Rückruf (5 Minuten, drinnen)",
    steps: (d) => [`Warte einen Moment, in dem ${d} sowieso in deine Richtung schaut.`, `Sag fröhlich seinen Namen und „Hier".`, `Kommt er, gib ihm nicht nur ein Leckerli, sondern drei kleine hintereinander. Das ist der Jackpot.`, `Ruf „Hier" nie, wenn du weißt, dass er gerade nicht kommt. Sonst verliert das Wort seinen Wert.`],
    after: (d) => `So wird „Hier" für ${d} zum besten Wort des Tages. Erst drinnen üben, dann im Garten, dann draußen. Ganz in deinem Tempo.`,
    cta: (d) => `So sieht ${d}s Rückruf-Plan aus`,
  },
  pulling: {
    marketing: "marketing-leinen.html",
    subject: (d) => `Der einfache Trick, mit dem ${d} an der Leine nicht mehr zieht`,
    intro: (d) => `zieht ${d} dich an der Leine hinter sich her? Das ist anstrengend, und es liegt nicht an dir.<br><br>${d} hat einfach gelernt: Ziehen bringt mich schneller ans Ziel. Diese eine Technik dreht das um:`,
    exTitle: "Sei ein Baum",
    steps: (d) => [`Sobald die Leine straff wird, bleib sofort stehen. Ganz ruhig, kein Ruck.`, `Warte, bis ${d} die Spannung von selbst löst und die Leine wieder locker ist.`, `In dem Moment sagst du „Fein" und gehst weiter. Lockere Leine heißt: es geht weiter.`, `Die ersten Tage kommt ihr kaum vom Fleck. Das ist normal und genau der Sinn der Sache.`],
    after: (d) => `${d} lernt so ganz ohne Zwang: nur bei lockerer Leine geht es vorwärts. Nach ein, zwei Wochen wird das Spazieren wieder entspannt.`,
    cta: (d) => `So sieht ${d}s Leinen-Plan aus`,
  },
  aggression: {
    marketing: "marketing-aggression.html",
    subject: (d) => `Wenn ${d} an der Leine bellt: der Abstand, der alles verändert`,
    intro: (d) => `bellt und zieht ${d} an der Leine, sobald ein anderer Hund auftaucht? Das ist meist kein Aggressionsproblem, sondern Stress und Überforderung.<br><br>Die gute Nachricht: der wichtigste Hebel ist ganz einfach, nämlich Abstand. Hier die Übung:`,
    exTitle: "Leckerli-Regen auf Abstand",
    steps: (d) => [`Finde den Abstand, ab dem ${d} einen anderen Hund sieht, aber noch ruhig bleibt. Oft sind das 15 bis 30 Meter.`, `Solange der andere Hund zu sehen ist, gib alle paar Sekunden ein Leckerli.`, `Ist der andere weg, hörst du auf. So lernt ${d}: anderer Hund heißt, bei mir wird es schön.`, `Bellt er doch, war der Abstand zu klein. Geh einfach ein Stück weiter weg.`],
    after: (d) => `Über die Wochen wird der Abstand von ganz allein kleiner. Du veränderst so das Gefühl von ${d}, nicht nur das Verhalten.`,
    cta: (d) => `So sieht ${d}s Plan aus`,
  },
  mouthing: {
    marketing: "kurz-schritt1",
    subject: (d) => `Damit ${d} nichts mehr vom Boden aufnimmt`,
    intro: (d) => `schnappt sich ${d} draußen alles vom Boden? Das ist verständlicherweise ein mulmiges Gefühl.<br><br>Der häufigste Fehler ist, hinterherzujagen, denn das macht es für ${d} zum Spiel. Der Schlüssel ist tauschen, nicht wegnehmen:`,
    exTitle: "Das Tausch-Geschäft",
    steps: (d) => [`Übe zuerst drinnen mit einem langweiligen Gegenstand. Gib ihn ${d} und sag ruhig „Aus".`, `Halt gleichzeitig ein besonders gutes Leckerli an seine Nase.`, `Lässt er los, sagst du „Ja" und gibst das Leckerli. Loslassen lohnt sich also.`, `Jag ihm nie hinterher, wenn er etwas hat. Tausch lieber gegen etwas Besseres.`],
    after: (d) => `Wenn ${d} gelernt hat, dass Hergeben sich lohnt, gibt er auch draußen freiwillig ab. Übe erst ohne Ablenkung, dann steigerst du langsam.`,
    cta: (d) => `So sieht ${d}s Plan aus`,
  },
};

function buildHtml(theme, DOG, leadId, email) {
  const t = THEMES[theme];
  const link = `https://www.pfoten-plan.de/${t.marketing}?lead_id=${leadId}&email=${encodeURIComponent(email)}&utm_source=email&utm_medium=warmup&utm_campaign=warmup-${theme}`;
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${leadId}`;
  const p = "margin:0 0 18px;font-size:17px;line-height:1.7;color:#1a1a1a;";
  const steps = t.steps(DOG).map((s, i) => `<p style="margin:0 0 8px;font-size:16px;line-height:1.65;color:#3a342b;"><b>${i + 1}.</b> ${s}</p>`).join("");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px 4px;">
<p style="${p}">Hallo,</p>
<p style="${p}">${t.intro(DOG)}</p>
<div style="background:#FAF8F5;border-left:5px solid #A9884F;border-radius:0 12px 12px 0;padding:20px 22px;margin:0 0 22px;">
<p style="margin:0 0 12px;font-size:18px;font-weight:800;color:#8B7355;">${t.exTitle}</p>
${steps}
</div>
<p style="${p}">${t.after(DOG)}</p>
<p style="text-align:center;margin:30px 0 12px;"><a href="${link}" style="background:#A9884F;color:#fff;text-decoration:none;font-weight:800;font-size:18px;padding:17px 34px;border-radius:12px;display:inline-block;">${t.cta(DOG)}</a></p>
<p style="text-align:center;font-size:15px;color:#6E655A;margin:0 0 24px;line-height:1.6;">Den Plan kannst du dir auch ausdrucken und Woche für Woche abhaken.<br>Einmalig &middot; kein Abo &middot; 30 Tage Geld-zurück.</p>
<p style="${p}color:#6E655A;">Herzliche Grüße<br>Max von Pfoten-Plan</p>
<p style="text-align:center;font-size:12px;color:#9a9186;margin-top:24px;border-top:1px solid #ECE3D5;padding-top:14px;">Pfoten-Plan &middot; Du willst keine Mails mehr? <a href="${unsub}" style="color:#9a9186;">Hier abmelden</a>.</p>
</div>`;
}

// ---- Leads holen ----
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
let rows = [], from = 0; const P = 1000;
while (rows.length < 15000) { const { data } = await sb.from("wauwerk_leads").select("id,email,dog_name,answers").eq("status", "email_captured").or("email.ilike.%@gmail.com,email.ilike.%@googlemail.com").order("created_at", { ascending: false }).range(from, from + P - 1); if (!data || !data.length) break; rows = rows.concat(data); if (data.length < P) break; from += P; }
const pick = [];
for (const r of rows) {
  const a = r.answers || {};
  if (a.unsubscribed || a.lang === "pl" || a.energie_kampagne_sent_at || a[SENT_KEY]) continue;
  const theme = MAP[(a.dog_problem || "").trim()];
  if (!theme) continue;
  if (ONLY_THEME && theme !== ONLY_THEME) continue;
  if (!r.email || !r.email.includes("@")) continue;
  pick.push({ id: r.id, email: r.email.trim(), dog: (r.dog_name || "").trim() || "deinem Hund", theme, ans: a });
  if (pick.length >= CAP) break;
}
const byTheme = {}; pick.forEach(x => byTheme[x.theme] = (byTheme[x.theme] || 0) + 1);
console.log(`Ausgewählt: ${pick.length} (Cap ${CAP}) · Themen: ${JSON.stringify(byTheme)} · Modus: ${DO_SEND ? "ECHTER VERSAND" : "DRY-RUN"}`);
if (!DO_SEND) { pick.slice(0, 6).forEach(x => console.log(`  [DRY] ${x.email} · ${x.theme} · ${x.dog}`)); console.log("\nZum echten Versand: --send anhängen."); process.exit(0); }

let sent = 0, err = 0;
for (const r of pick) {
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${r.id}`;
  const res = await ses({
    FromEmailAddress: "Max von Pfoten-Plan <hallo@pfoten-post.de>",
    Destination: { ToAddresses: [r.email] },
    ReplyToAddresses: ["support@pfoten-plan.de"],
    ConfigurationSetName: "pfoten-tracking",
    EmailTags: [{ Name: "campaign", Value: "warmup-" + r.theme }],
    Content: { Simple: {
      Subject: { Data: THEMES[r.theme].subject(r.dog), Charset: "UTF-8" },
      Body: { Html: { Data: buildHtml(r.theme, r.dog, r.id, r.email), Charset: "UTF-8" } },
      Headers: [{ Name: "List-Unsubscribe", Value: `<${unsub}>, <mailto:hallo@pfoten-post.de?subject=unsubscribe>` }, { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" }],
    } },
  });
  if (res.status < 300) { sent++; try { await sb.from("wauwerk_leads").update({ answers: { ...r.ans, [SENT_KEY]: new Date().toISOString(), warmup_theme: r.theme } }).eq("id", r.id); } catch {} }
  else { err++; console.log("FEHLER", r.email, res.status, res.data.slice(0, 100)); }
  await new Promise(x => setTimeout(x, 1100));
}
console.log(`\n===== Gesendet: ${sent} · Fehler: ${err} =====`);
process.exit(0);
