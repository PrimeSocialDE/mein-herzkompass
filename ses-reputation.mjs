// SES-Reputations-Monitor: Bounce-/Beschwerde-/Zustell-Raten auf Konto-Ebene
// direkt aus der SES-eigenen Statistik-API (GetSendStatistics). Kein CloudWatch,
// kein SNS noetig. Zum Warmup-Ueberwachen:  node ses-reputation.mjs
//
// Grenzwerte (Faustregeln): Bounce < 2% (kritisch ab 5%), Beschwerden < 0,1%.
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const env = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
for (const l of env.split("\n")) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/[\r\n]+$/, "").replace(/^["']|["']$/g, "");
}
const RG = process.env.AWS_REGION || "eu-central-1";
const HOST = `email.${RG}.amazonaws.com`;
const AK = process.env.AWS_ACCESS_KEY_ID, SK = process.env.AWS_SECRET_ACCESS_KEY;
const hmac = (k, d) => crypto.createHmac("sha256", k).update(d).digest();
const sha = (d) => crypto.createHash("sha256").update(d).digest("hex");

const body = new URLSearchParams({ Action: "GetSendStatistics", Version: "2010-12-01" }).toString();
const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); const ds = amz.slice(0, 8);
const ch = `content-type:application/x-www-form-urlencoded\nhost:${HOST}\nx-amz-date:${amz}\n`, sh = "content-type;host;x-amz-date";
const creq = ["POST", "/", "", ch, sh, sha(body)].join("\n");
const scope = `${ds}/${RG}/ses/aws4_request`;
const sts = ["AWS4-HMAC-SHA256", amz, scope, sha(creq)].join("\n");
let k = hmac("AWS4" + SK, ds); k = hmac(k, RG); k = hmac(k, "ses"); k = hmac(k, "aws4_request");
const sig = crypto.createHmac("sha256", k).update(sts).digest("hex");
const auth = `AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=${sh}, Signature=${sig}`;
const r = await fetch(`https://${HOST}/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Amz-Date": amz, Authorization: auth }, body });
const xml = await r.text();
if (r.status !== 200) { console.error("Fehler", r.status, xml.slice(0, 300)); process.exit(1); }

const now = Date.now();
const items = [...xml.matchAll(/<member>([\s\S]*?)<\/member>/g)].map((m) => {
  const g = (t) => ((m[1].match(new RegExp(`<${t}>(.*?)</${t}>`)) || [])[1]) || "0";
  return { ts: g("Timestamp"), att: +g("DeliveryAttempts"), bnc: +g("Bounces"), cmp: +g("Complaints"), rej: +g("Rejects") };
});
const pct = (x, y) => (y > 0 ? (x / y * 100).toFixed(2) + "%" : "—");
console.log("SES-Reputation (Konto " + RG + ")");
for (const [lbl, h] of [["letzte 24h", 24], ["letzte 3 Tage", 72], ["letzte 14 Tage", 336]]) {
  const cut = now - h * 3600000;
  let a = 0, b = 0, c = 0, rj = 0;
  for (const it of items) if (new Date(it.ts).getTime() >= cut) { a += it.att; b += it.bnc; c += it.cmp; rj += it.rej; }
  const warn = (b / (a || 1) > 0.02 ? "  BOUNCE>2%!" : "") + (c / (a || 1) > 0.001 ? "  COMPLAINT>0.1%!" : "");
  console.log(` ${lbl.padEnd(14)} Versuche:${String(a).padStart(5)}  Bounces:${b} (${pct(b, a)})  Beschwerden:${c} (${pct(c, a)})  Rejects:${rj}${warn}`);
}
process.exit(0);
