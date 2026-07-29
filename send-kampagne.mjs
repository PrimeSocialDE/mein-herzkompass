// Kampagnen-Versand über Amazon SES — bewusst mit HARTEN Sicherheitsgrenzen.
//
//   node send-kampagne.mjs --batch 1              # DRY-RUN (zeigt nur, sendet NICHTS)
//   node send-kampagne.mjs --batch 1 --send       # sendet wirklich (max. 50)
//   node send-kampagne.mjs --batch 1 --send --csv /pfad/liste.csv
//
// Schutz gegen böse Rechnung:
//   - Dry-Run ist STANDARD. Ohne --send passiert nie ein echter Versand.
//   - MAX_PER_RUN = 50 hart. Mehr geht pro Lauf NICHT, egal was.
//   - Nur EIN Batch pro Lauf. Kein Loop über die ganze Liste.
//   - Idempotent: bereits gesendete Leads (answers.energie_kampagne_sent_at) werden übersprungen.
//   - Abgemeldete (answers.unsubscribed) werden übersprungen.
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const MAX_PER_RUN = 50; // HARTER Cap — nicht erhöhen ohne guten Grund

// ---- Args ----
const args = process.argv.slice(2);
const getArg = (k, def) => { const i = args.indexOf(k); return i >= 0 ? (args[i+1] ?? true) : def; };
const BATCH = parseInt(getArg("--batch", "0"), 10);
const DO_SEND = args.includes("--send");
const CSV = getArg("--csv", "/Users/maxxx/Downloads/energie-kampagne-bereinigt.csv");
const CAMPAIGN = getArg("--campaign", "energie-launch");
const SENT_KEY = "energie_kampagne_sent_at";
if (!BATCH) { console.error("Fehlt: --batch N"); process.exit(1); }

// ---- Env ----
try { const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8"); for(const l of e.split("\n")){const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");}}catch{}
const REGION=process.env.AWS_REGION||"eu-central-1", HOST=`email.${REGION}.amazonaws.com`;
const AK=process.env.AWS_ACCESS_KEY_ID, SK=process.env.AWS_SECRET_ACCESS_KEY;

// ---- SES (SigV4) ----
const hmac=(k,d)=>crypto.createHmac("sha256",k).update(d).digest(); const sha=d=>crypto.createHash("sha256").update(d).digest("hex");
async function ses(method,path,bodyObj){const body=bodyObj?JSON.stringify(bodyObj):"";const amz=new Date().toISOString().replace(/[:-]|\.\d{3}/g,"");const ds=amz.slice(0,8);const ch=`content-type:application/json\nhost:${HOST}\nx-amz-date:${amz}\n`,sh="content-type;host;x-amz-date";const creq=[method,path,"",ch,sh,sha(body)].join("\n");const scope=`${ds}/${REGION}/ses/aws4_request`;const sts=["AWS4-HMAC-SHA256",amz,scope,sha(creq)].join("\n");let k=hmac("AWS4"+SK,ds);k=hmac(k,REGION);k=hmac(k,"ses");k=hmac(k,"aws4_request");const sig=crypto.createHmac("sha256",k).update(sts).digest("hex");const auth=`AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=${sh}, Signature=${sig}`;const r=await fetch(`https://${HOST}${path}`,{method,headers:{"Content-Type":"application/json","X-Amz-Date":amz,Authorization:auth},body:body||undefined});return {status:r.status,data:await r.text()};}

// ---- CSV lesen ----
function parseCsv(txt){ const lines=txt.trim().split(/\r?\n/); const head=lines[0].split(","); return lines.slice(1).map(l=>{ // simpler split (unsere CSV hat keine Kommas in Werten)
  const c=l.split(","); const o={}; head.forEach((h,i)=>o[h]=c[i]); return o; }); }
const all = parseCsv(readFileSync(CSV,"utf8"));
let batch = all.filter(r => parseInt(r.BATCH,10) === BATCH);
if (batch.length > MAX_PER_RUN) { console.log(`Batch hat ${batch.length} > Cap ${MAX_PER_RUN} → auf ${MAX_PER_RUN} gekürzt.`); batch = batch.slice(0, MAX_PER_RUN); }
console.log(`Kampagne "${CAMPAIGN}" · Batch ${BATCH} · ${batch.length} Empfänger · Modus: ${DO_SEND ? "ECHTER VERSAND" : "DRY-RUN (kein Versand)"}`);

// ---- Supabase: Abgemeldete + bereits Gesendete rausfiltern ----
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth:{autoRefreshToken:false,persistSession:false} });
const ids = batch.map(r=>r.LEAD_ID);
const { data: leadRows } = await sb.from("wauwerk_leads").select("id,answers").in("id", ids);
const stateById = new Map((leadRows||[]).map(r=>[r.id, r.answers||{}]));

// ---- Mail-Template ----
const p="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1a1a1a;";
function buildHtml(DOG, leadId, email){
  const link=`https://www.pfoten-plan.de/marketing-energie.html?lead_id=${leadId}&email=${encodeURIComponent(email)}&utm_source=email&utm_medium=email&utm_campaign=${CAMPAIGN}`;
  const unsub=`https://www.pfoten-plan.de/api/unsubscribe?lead=${leadId}`;
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px 4px;">
<p style="${p}font-size:18px;font-weight:700;margin-bottom:10px;">Wie geht's ${DOG}? &#128062;</p>
<p style="${p}">Kennst du das? Es ist Abend, du willst endlich runterkommen. Und <b>${DOG} dreht schon wieder auf.</b> L&auml;uft durch die Wohnung, findet keine Ruhe. Oder zieht dich drau&szlig;en an der Leine hinter jedem Reiz her.</p>
<p style="${p}"><b>Das liegt nicht an dir.</b><br>Und auch nicht daran, dass ${DOG} &bdquo;einfach zu viel Energie&ldquo; hat.</p>
<p style="${p}">Der h&auml;ufigste Denkfehler: noch mehr rausgehen, noch mehr Ball werfen. Doch das macht ${DOG} nur <b>fitter und aufgedrehter</b>, nicht ruhiger. Was wirklich m&uuml;de macht, ist <b>Kopfarbeit</b> plus echtes <b>Ruhe-Training</b>.</p>
<p style="${p}">Vielleicht gehen dir gerade genau diese Fragen durch den Kopf:</p>
<p style="${p}margin-left:6px;font-style:italic;color:#3a342b;">&bull; Warum kommt ${DOG} einfach nicht zur Ruhe?<br>&bull; Mache ich irgendwas falsch?<br>&bull; Muss ich wirklich noch MEHR mit ihm rausgehen?<br>&bull; Wird das jemals besser?</p>
<p style="${p}">Dann ist <b>jetzt</b> der Moment, Klarheit zu bekommen.</p>
<p style="${p}"><b>Beantworte 3 kurze Fragen zu ${DOG}.</b> Dann bekommst du sofort einen Plan, der genau auf euch zugeschnitten ist: auf ${DOG}, seine Rasse und das, was euch gerade am meisten nervt.</p>
<p style="${p}">Keine allgemeinen Tipps aus dem Internet. Sondern ein <b>Schritt-f&uuml;r-Schritt-Plan f&uuml;r genau ${DOG}.</b> &Uuml;ber <b>2.000 Hundehalter</b> trainieren schon so mit uns.</p>
<p style="text-align:center;margin:26px 0 10px;"><a href="${link}" style="background:#A9884F;color:#fff;text-decoration:none;font-weight:800;font-size:17px;padding:15px 28px;border-radius:12px;display:inline-block;">${DOG}s 3 Fragen beantworten &rarr;</a></p>
<p style="text-align:center;font-size:13px;color:#6E655A;margin:0 0 22px;">Einmalig &middot; kein Abo &middot; 30 Tage Geld-zur&uuml;ck-Garantie</p>
<p style="${p}color:#6E655A;font-size:14px;">Liebe Gr&uuml;&szlig;e<br>Max von Pfoten-Plan</p>
<p style="text-align:center;font-size:11px;color:#9a9186;margin-top:24px;border-top:1px solid #ECE3D5;padding-top:14px;">Pfoten-Plan &middot; Du willst keine Mails mehr? <a href="${unsub}" style="color:#9a9186;">Hier abmelden</a>.</p>
</div>`;
}

// ---- Senden (oder Dry-Run) ----
let sent=0, skipUnsub=0, skipDone=0, errors=0, wouldSend=0;
for (const r of batch) {
  const st = stateById.get(r.LEAD_ID) || {};
  if (st.unsubscribed) { skipUnsub++; continue; }
  if (st[SENT_KEY])    { skipDone++;  continue; }
  const DOG = (r.HUNDENAME && r.HUNDENAME.trim()) ? r.HUNDENAME.trim() : "dein Hund";
  if (!DO_SEND) { wouldSend++; if (wouldSend<=5) console.log(`  [DRY] ${r.EMAIL}  (${DOG})`); continue; }

  const html = buildHtml(DOG, r.LEAD_ID, r.EMAIL);
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${r.LEAD_ID}`;
  const res = await ses("POST","/v2/email/outbound-emails",{
    FromEmailAddress:"Max von Pfoten-Plan <hallo@pfoten-post.de>",
    Destination:{ToAddresses:[r.EMAIL]},
    ReplyToAddresses:["support@pfoten-plan.de"],
    // Config Set + campaign-Tag -> Open/Click/Bounce landen in CloudWatch,
    // pro Kampagne aufschlüsselbar (Dimension "campaign").
    ConfigurationSetName: process.env.SES_CONFIGURATION_SET || "pfoten-tracking",
    EmailTags:[{Name:"campaign",Value:CAMPAIGN.replace(/[^a-zA-Z0-9_-]/g,"-")}],
    Content:{Simple:{
      Subject:{Data:`${DOG} kommt einfach nicht zur Ruhe? Das hat einen Grund.`,Charset:"UTF-8"},
      Body:{Html:{Data:html,Charset:"UTF-8"}},
      Headers:[
        {Name:"List-Unsubscribe",Value:`<${unsub}>, <mailto:hallo@pfoten-post.de?subject=unsubscribe>`},
        {Name:"List-Unsubscribe-Post",Value:"List-Unsubscribe=One-Click"},
      ],
    }},
  });
  if (res.status < 300) {
    sent++;
    try { await sb.from("wauwerk_leads").update({ answers: {...st, [SENT_KEY]: new Date().toISOString(), energie_kampagne_batch: BATCH } }).eq("id", r.LEAD_ID); } catch {}
  } else { errors++; console.log(`  FEHLER ${r.EMAIL}: ${res.status} ${res.data.slice(0,120)}`); }
  await new Promise(r=>setTimeout(r, 1200)); // ~1/Sek — schont Rate + Reputation
}

console.log("\n===== ERGEBNIS =====");
if (!DO_SEND) console.log(`DRY-RUN: würde ${wouldSend} senden (übersprungen: ${skipUnsub} abgemeldet, ${skipDone} schon gesendet). Zum echten Versand: --send anhängen.`);
else console.log(`Gesendet: ${sent} · Fehler: ${errors} · übersprungen: ${skipUnsub} abgemeldet, ${skipDone} schon gesendet.`);
