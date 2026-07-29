import { readFileSync } from "node:fs";
import crypto from "node:crypto";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const AK=process.env.AWS_ACCESS_KEY_ID, SK=process.env.AWS_SECRET_ACCESS_KEY, REGION=process.env.AWS_REGION||"eu-central-1";
const host=`email.${REGION}.amazonaws.com`, service="ses", path="/v2/email/identities";
const now=new Date();
const amzdate=now.toISOString().replace(/[:-]|\.\d{3}/g,"").replace(/(\d{8})(\d{6})Z/,"$1T$2Z");
const datestamp=amzdate.slice(0,8);
const hmac=(k,d)=>crypto.createHmac("sha256",k).update(d).digest();
const sha=d=>crypto.createHash("sha256").update(d).digest("hex");
const emptyHash=sha("");
const canon=`GET\n${path}\n\nhost:${host}\nx-amz-date:${amzdate}\n\nhost;x-amz-date\n${emptyHash}`;
const scope=`${datestamp}/${REGION}/${service}/aws4_request`;
const sts=`AWS4-HMAC-SHA256\n${amzdate}\n${scope}\n${sha(canon)}`;
let k=hmac("AWS4"+SK,datestamp);k=hmac(k,REGION);k=hmac(k,service);k=hmac(k,"aws4_request");
const sig=crypto.createHmac("sha256",k).update(sts).digest("hex");
const auth=`AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=host;x-amz-date, Signature=${sig}`;
const res=await fetch(`https://${host}${path}`,{method:"GET",headers:{"X-Amz-Date":amzdate,"Authorization":auth}});
const txt=await res.text();
if(res.ok){
  const d=JSON.parse(txt);
  console.log("SES-Lesen OK. Verifizierte Identities:", (d.EmailIdentities||[]).map(x=>`${x.IdentityName}(${x.IdentityType},${x.VerifiedForSendingStatus?"verified":"pending"})`).join(", ")||"(keine)");
  console.log("-> Wahrscheinlich darf ich auch CreateEmailIdentity (Domain anlegen).");
}else{
  console.log("SES-Lesen HTTP", res.status, txt.slice(0,160));
}
