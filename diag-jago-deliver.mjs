import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const TOKEN=process.env.WORKER_TOKEN, BREVO=process.env.BREVO_API_KEY, SECRET=process.env.LOGIN_LINK_SECRET||process.env.WORKER_TOKEN;
const EMAIL="jago.pdae@web.de", DOG="Jago";

// 1) Plan ausliefern (plan-ready-Mail; DE geht primär über Google SMTP -> gut für web.de)
const t=await fetch("https://www.pfoten-plan.de/api/admin/trigger-delivery",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${TOKEN}`},body:JSON.stringify({email:EMAIL,force:true})});
const tj=await t.json().catch(()=>({}));
const hp=(tj.actions||[]).find(a=>a.type==="hauptplan");
console.log("1) Plan-Auslieferung:", t.status, "| hauptplan ok:", hp?.ok, "| plan_id:", hp?.plan_id||"-", hp?.error?("| err:"+hp.error):"");

// 2) Dauerhaften Login-Link erzeugen + testen + senden
const b64url=b=>Buffer.from(b).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const em=EMAIL.toLowerCase();
const exp=Math.floor(Date.now()/1000)+365*86400;
const sig=b64url(createHmac("sha256",SECRET).update(`${em}|${exp}`).digest());
const params=new URLSearchParams({e:b64url(Buffer.from(em,"utf8")),exp:String(exp),sig,next:"/mitglieder"});
const link=`https://www.pfoten-plan.de/api/mitglieder/one-tap?${params.toString()}`;
const r=await fetch(link,{redirect:"manual"});
const okLink=(r.status>=300&&r.status<400)&&/sb-|auth-token/i.test(r.headers.get("set-cookie")||"");
console.log("2) Login-Link-Test:", r.status, okLink?"-> funktioniert":"-> PRUEFEN");

const html=`<!DOCTYPE html><html lang="de"><body style="margin:0;background:#FAF8F5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a;">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;">
  <div style="text-align:center;margin-bottom:24px;"><div style="font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#8B7355;">Pfoten-Plan</div></div>
  <div style="background:#fff;border:1px solid #EADDC5;border-radius:16px;padding:28px 24px;">
    <h1 style="font-size:22px;font-weight:800;margin:0 0 10px;">Hier ist dein Zugang</h1>
    <p style="font-size:16px;line-height:1.55;color:#4B5563;margin:0 0 20px;">Hallo! Dein Trainingsplan für <strong>${DOG}</strong> liegt in deinem Mitgliederbereich. Du brauchst keinen Code, ein Klick genügt:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;width:100%;"><tr><td align="center">
      <a href="${link}" style="display:inline-block;background:#C4A576;color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:17px;font-weight:800;">Jetzt einloggen</a>
    </td></tr></table>
    <p style="font-size:14px;color:#6B7280;line-height:1.55;margin:0;">Dieser Link funktioniert mehrere Monate und ist wiederverwendbar, also <strong>speichere dir diese Mail</strong>. Nach dem Klick landest du direkt bei ${DOG}s Plan zum Ansehen und Ausdrucken.</p>
  </div>
  <p style="font-size:13px;color:#6B7280;text-align:center;margin:18px 0 0;">Fragen? Antworte einfach auf diese Mail: <a href="mailto:support@pfoten-plan.de" style="color:#8B7355;">support@pfoten-plan.de</a><br>Liebe Grüße, dein Pfoten-Plan Team 🐾</p>
</div></body></html>`;
const s=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":BREVO,"Content-Type":"application/json"},body:JSON.stringify({
  sender:{name:"Max von Pfoten-Plan",email:"support@pfoten-plan.de"},
  replyTo:{email:"support@pfoten-plan.de",name:"Pfoten-Plan Support"},
  to:[{email:EMAIL}], subject:`Dein Login für Pfoten-Plan (${DOG}) 🐾`, htmlContent:html, tags:["login-fix"],
})});
console.log("3) Login-Mail an", EMAIL, ":", s.ok?"GESENDET ✅":`FEHLER ${s.status}`);
