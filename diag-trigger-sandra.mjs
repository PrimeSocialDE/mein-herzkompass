import { readFileSync } from "node:fs";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const TOKEN=process.env.WORKER_TOKEN;
const res=await fetch("https://www.pfoten-plan.de/api/admin/trigger-delivery",{
  method:"POST",
  headers:{"Content-Type":"application/json","Authorization":`Bearer ${TOKEN}`},
  body:JSON.stringify({email:"sandra@serrano-home.de",force:true})
});
const j=await res.json().catch(()=>({}));
console.log("HTTP",res.status);
console.log(JSON.stringify(j,null,2));
