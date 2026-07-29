// SES-Kampagnen-Statistik aus CloudWatch lesen (Opens, Klicks, Bounces, ...).
//
//   node ses-stats.mjs --campaign so-gmail-energy          # letzte 14 Tage
//   node ses-stats.mjs --campaign so-gmail-energy --days 7
//   node ses-stats.mjs                                      # ALLE Kampagnen gesamt (Dimension leer)
//
// Voraussetzung: Versand lief mit ConfigurationSet "pfoten-tracking" + EmailTag
// "campaign" (siehe lib/ses.ts / send-kampagne.mjs). Kampagnen, die VOR dem
// Anlegen des Config Sets versendet wurden, tauchen hier NICHT auf.
//
// Hinweis: CloudWatch zaehlt Open/Click als EREIGNISSE (Mehrfach-Öffnungen
// zaehlen mit). Die Raten sind damit eine Richtgroesse, keine Unique-Rate.
// Fuer Unique-pro-Lead dient der SNS-Webhook (app/api/ses-events).
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const getArg = (k, def) => { const i = args.indexOf(k); return i >= 0 ? (args[i+1] ?? true) : def; };
const CAMPAIGN = getArg("--campaign", null);
const DAYS = parseInt(getArg("--days", "14"), 10);

try { const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8"); for(const l of e.split("\n")){const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");}}catch{}
const REGION=process.env.AWS_REGION||"eu-central-1";
const HOST=`monitoring.${REGION}.amazonaws.com`;
const AK=process.env.AWS_ACCESS_KEY_ID, SK=process.env.AWS_SECRET_ACCESS_KEY;

const hmac=(k,d)=>crypto.createHmac("sha256",k).update(d).digest();
const sha=d=>crypto.createHash("sha256").update(d).digest("hex");

async function cw(params){
  const body=new URLSearchParams({Version:"2010-08-01",...params}).toString();
  const amz=new Date().toISOString().replace(/[:-]|\.\d{3}/g,""); const ds=amz.slice(0,8);
  const ch=`content-type:application/x-www-form-urlencoded\nhost:${HOST}\nx-amz-date:${amz}\n`;
  const sh="content-type;host;x-amz-date";
  const creq=["POST","/","",ch,sh,sha(body)].join("\n");
  const scope=`${ds}/${REGION}/monitoring/aws4_request`;
  const sts=["AWS4-HMAC-SHA256",amz,scope,sha(creq)].join("\n");
  let k=hmac("AWS4"+SK,ds);k=hmac(k,REGION);k=hmac(k,"monitoring");k=hmac(k,"aws4_request");
  const sig=crypto.createHmac("sha256",k).update(sts).digest("hex");
  const auth=`AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=${sh}, Signature=${sig}`;
  const r=await fetch(`https://${HOST}/`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","X-Amz-Date":amz,Authorization:auth},body});
  return await r.text();
}

// Sum eines Metrics ueber den Zeitraum (mit optionaler campaign-Dimension).
async function sumMetric(metric){
  const end=new Date(); const start=new Date(end.getTime()-DAYS*86400000);
  const params={
    Action:"GetMetricStatistics",
    Namespace:"AWS/SES",
    MetricName:metric,
    StartTime:start.toISOString(),
    EndTime:end.toISOString(),
    Period:String(Math.max(60, DAYS*86400)),
    "Statistics.member.1":"Sum",
  };
  if (CAMPAIGN){ params["Dimensions.member.1.Name"]="campaign"; params["Dimensions.member.1.Value"]=CAMPAIGN; }
  const xml=await cw(params);
  // Alle <Sum>..</Sum> aufaddieren (kann mehrere Datenpunkte geben)
  const sums=[...xml.matchAll(/<Sum>([\d.eE+-]+)<\/Sum>/g)].map(m=>parseFloat(m[1]));
  if (!sums.length && /<Error>|InvalidClient|SignatureDoesNotMatch|AccessDenied/.test(xml)) {
    return {err:(xml.match(/<Message>(.*?)<\/Message>/)||[])[1]||xml.slice(0,160)};
  }
  return {sum:sums.reduce((a,b)=>a+b,0)};
}

const metrics=["Send","Delivery","Open","Click","Bounce","Complaint","Reject"];
const out={};
for (const m of metrics){ const r=await sumMetric(m); if(r.err){console.error("Fehler:",r.err);process.exit(1);} out[m]=r.sum; }

const pct=(a,b)=> b>0 ? ((a/b)*100).toFixed(1)+"%" : "—";
const base = out.Delivery || out.Send || 0;
console.log(`\n=== SES-Statistik ${CAMPAIGN?`Kampagne "${CAMPAIGN}"`:"(ALLE)"} · letzte ${DAYS} Tage ===`);
console.log(` Versendet:   ${out.Send}`);
console.log(` Zugestellt:  ${out.Delivery}  (${pct(out.Delivery,out.Send)})`);
console.log(` Öffnungen:   ${out.Open}  (${pct(out.Open,base)} der Zustellungen*)`);
console.log(` Klicks:      ${out.Click}  (${pct(out.Click,base)})`);
console.log(` Bounces:     ${out.Bounce}  (${pct(out.Bounce,out.Send)})`);
console.log(` Beschwerden: ${out.Complaint}  (${pct(out.Complaint,out.Send)})`);
console.log(` Abgelehnt:   ${out.Reject}`);
console.log(` * Öffnungen/Klicks = Ereignisse inkl. Mehrfach (Richtgröße, keine Unique-Rate).`);
if (out.Bounce/(out.Send||1) > 0.02) console.log(" ⚠️  Bounce-Rate über 2% — vor dem Skalieren prüfen!");
if (out.Complaint/(out.Send||1) > 0.001) console.log(" ⚠️  Complaint-Rate über 0,1% — vorsichtig!");
process.exit(0);
