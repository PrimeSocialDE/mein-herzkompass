import { readFileSync } from "node:fs";
import crypto from "node:crypto";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const AK=process.env.AWS_ACCESS_KEY_ID, SK=process.env.AWS_SECRET_ACCESS_KEY, REGION=process.env.AWS_REGION||"eu-central-1";
const DOMAIN="primesocial-videos.de";
const host=`email.${REGION}.amazonaws.com`, service="ses", path="/v2/email/identities";
const body=JSON.stringify({EmailIdentity:DOMAIN});
const now=new Date();
const amzdate=now.toISOString().replace(/[:-]|\.\d{3}/g,"").replace(/(\d{8})(\d{6})Z/,"$1T$2Z");
const datestamp=amzdate.slice(0,8);
const hmac=(k,d)=>crypto.createHmac("sha256",k).update(d).digest();
const sha=d=>crypto.createHash("sha256").update(d).digest("hex");
const ph=sha(body);
const canon=`POST\n${path}\n\ncontent-type:application/json\nhost:${host}\nx-amz-date:${amzdate}\n\ncontent-type;host;x-amz-date\n${ph}`;
const scope=`${datestamp}/${REGION}/${service}/aws4_request`;
const sts=`AWS4-HMAC-SHA256\n${amzdate}\n${scope}\n${sha(canon)}`;
let k=hmac("AWS4"+SK,datestamp);k=hmac(k,REGION);k=hmac(k,service);k=hmac(k,"aws4_request");
const sig=crypto.createHmac("sha256",k).update(sts).digest("hex");
const auth=`AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=content-type;host;x-amz-date, Signature=${sig}`;
const res=await fetch(`https://${host}${path}`,{method:"POST",headers:{"Content-Type":"application/json","X-Amz-Date":amzdate,"Authorization":auth},body});
const txt=await res.text();
console.log("HTTP",res.status);
if(res.ok){
  const d=JSON.parse(txt);
  const toks=d.DkimAttributes?.Tokens||[];
  console.log("Domain angelegt:",DOMAIN,"| Region:",REGION);
  console.log("\n=== DKIM-CNAME-Eintraege (im DNS von "+DOMAIN+" anlegen) ===");
  for(const t of toks){
    console.log(`NAME:  ${t}._domainkey.${DOMAIN}`);
    console.log(`TYP:   CNAME`);
    console.log(`WERT:  ${t}.dkim.amazonses.com`);
    console.log("");
  }
}else{
  console.log(txt.slice(0,300));
}
