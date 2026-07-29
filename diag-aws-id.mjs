import { readFileSync } from "node:fs";
import crypto from "node:crypto";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const AK=process.env.AWS_ACCESS_KEY_ID, SK=process.env.AWS_SECRET_ACCESS_KEY, REGION=process.env.AWS_REGION||"eu-central-1";
const host=`sts.${REGION}.amazonaws.com`, service="sts";
const body="Action=GetCallerIdentity&Version=2011-06-15";
const now=new Date();
const amzdate=now.toISOString().replace(/[:-]|\.\d{3}/g,"").replace(/(\d{8})(\d{6})Z/,"$1T$2Z");
const datestamp=amzdate.slice(0,8);
const hmac=(k,d)=>crypto.createHmac("sha256",k).update(d).digest();
const sha=d=>crypto.createHash("sha256").update(d).digest("hex");
const payloadHash=sha(body);
const canonHeaders=`content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amzdate}\n`;
const signedHeaders="content-type;host;x-amz-date";
const canonReq=`POST\n/\n\n${canonHeaders}\n${signedHeaders}\n${payloadHash}`;
const scope=`${datestamp}/${REGION}/${service}/aws4_request`;
const sts=`AWS4-HMAC-SHA256\n${amzdate}\n${scope}\n${sha(canonReq)}`;
let k=hmac("AWS4"+SK,datestamp); k=hmac(k,REGION); k=hmac(k,service); k=hmac(k,"aws4_request");
const sig=crypto.createHmac("sha256",k).update(sts).digest("hex");
const auth=`AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;
const res=await fetch(`https://${host}/`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","X-Amz-Date":amzdate,"Authorization":auth},body});
const xml=await res.text();
const acct=(xml.match(/<Account>(.*?)<\/Account>/)||[])[1];
const arn=(xml.match(/<Arn>(.*?)<\/Arn>/)||[])[1];
if(res.ok&&acct){ console.log("Account-ID:", acct); console.log("ARN:", arn); }
else { console.log("HTTP", res.status); console.log(xml.slice(0,300)); }
