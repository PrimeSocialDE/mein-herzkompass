import { readFileSync } from "node:fs";
import crypto from "node:crypto";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const AK=process.env.AWS_ACCESS_KEY_ID, SK=process.env.AWS_SECRET_ACCESS_KEY;
const REGION="us-east-1", host="iam.amazonaws.com", service="iam";
const body="Action=ListUsers&Version=2010-05-08";
const now=new Date();
const amzdate=now.toISOString().replace(/[:-]|\.\d{3}/g,"").replace(/(\d{8})(\d{6})Z/,"$1T$2Z");
const datestamp=amzdate.slice(0,8);
const hmac=(k,d)=>crypto.createHmac("sha256",k).update(d).digest();
const sha=d=>crypto.createHash("sha256").update(d).digest("hex");
const canon=`POST\n/\n\ncontent-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amzdate}\n\ncontent-type;host;x-amz-date\n${sha(body)}`;
const scope=`${datestamp}/${REGION}/${service}/aws4_request`;
const sts=`AWS4-HMAC-SHA256\n${amzdate}\n${scope}\n${sha(canon)}`;
let k=hmac("AWS4"+SK,datestamp);k=hmac(k,REGION);k=hmac(k,service);k=hmac(k,"aws4_request");
const sig=crypto.createHmac("sha256",k).update(sts).digest("hex");
const auth=`AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=content-type;host;x-amz-date, Signature=${sig}`;
const res=await fetch(`https://${host}/`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","X-Amz-Date":amzdate,"Authorization":auth},body});
const xml=await res.text();
if(res.ok){
  const users=[...xml.matchAll(/<UserName>(.*?)<\/UserName>/g)].map(m=>m[1]);
  console.log("IAM-User im Account:", users.length?users.join(", "):"(keine)");
} else {
  const code=(xml.match(/<Code>(.*?)<\/Code>/)||[])[1]||res.status;
  console.log("Kein Zugriff auf ListUsers:", code, "-> der Claude-User darf keine IAM-User auflisten.");
}
