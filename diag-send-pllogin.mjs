import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const SECRET=process.env.LOGIN_LINK_SECRET||process.env.WORKER_TOKEN||"";
const BREVO=process.env.BREVO_API_KEY;
const EMAIL="byniek661@wp.pl", DOG="Bruno";
const b64url=b=>Buffer.from(b).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const em=EMAIL.trim().toLowerCase();
const exp=Math.floor(Date.now()/1000)+365*86400;
const sig=b64url(createHmac("sha256",SECRET).update(`${em}|${exp}`).digest());
const params=new URLSearchParams({e:b64url(Buffer.from(em,"utf8")),exp:String(exp),sig,next:"/mitglieder"});
const link=`https://www.pfoten-plan.de/api/mitglieder/one-tap?${params.toString()}`;

// 1. Link gegen Produktion verifizieren (erwartet Redirect + Session-Cookie)
const r=await fetch(link,{redirect:"manual"});
const setc=r.headers.get("set-cookie")||"";
const ok=(r.status>=300&&r.status<400)&&/sb-|auth-token/i.test(setc);
console.log(`Link-Test: HTTP ${r.status} | Session-Cookie: ${/sb-|auth-token/i.test(setc)?"ja":"nein"} -> ${ok?"FUNKTIONIERT":"PRUEFEN"}`);
if(!ok){ console.log("Location:", r.headers.get("location")); console.log("-> Link verifiziert nicht sauber, KEINE Mail gesendet."); process.exit(1); }

// 2. Polnische Login-Mail senden (ŁapaPlan / pomoc@lapaplan.pl)
const html=`<!DOCTYPE html><html lang="pl"><body style="margin:0;background:#FAF8F5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a;">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;">
  <div style="text-align:center;margin-bottom:24px;"><div style="font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#8B7355;">ŁapaPlan</div></div>
  <div style="background:#fff;border:1px solid #EADDC5;border-radius:16px;padding:28px 24px;">
    <h1 style="font-size:22px;font-weight:800;margin:0 0 10px;">Oto Twój link do logowania</h1>
    <p style="font-size:16px;line-height:1.55;color:#4B5563;margin:0 0 20px;">Cześć! Dziękujemy za zakup planu dla <strong>${DOG}</strong> 🐾. Nie musisz szukać żadnego 6-cyfrowego kodu, wystarczy jedno kliknięcie:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;width:100%;"><tr><td align="center">
      <a href="${link}" style="display:inline-block;background:#C4A576;color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:17px;font-weight:800;">Zaloguj się</a>
    </td></tr></table>
    <p style="font-size:14px;color:#6B7280;line-height:1.55;margin:0;">Ten link działa przez długi czas i możesz go używać wielokrotnie, więc <strong>zapisz sobie tę wiadomość</strong>. Po kliknięciu trafisz prosto do swojego panelu z planem dla ${DOG}.</p>
  </div>
  <p style="font-size:13px;color:#6B7280;text-align:center;margin:18px 0 0;">Masz pytania? Napisz do nas: <a href="mailto:pomoc@lapaplan.pl" style="color:#8B7355;">pomoc@lapaplan.pl</a><br>Pozdrawiamy, zespół ŁapaPlan</p>
</div></body></html>`;

const res=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":BREVO,"Content-Type":"application/json"},body:JSON.stringify({
  sender:{name:"ŁapaPlan",email:"pomoc@lapaplan.pl"},
  replyTo:{email:"pomoc@lapaplan.pl",name:"ŁapaPlan"},
  to:[{email:EMAIL}],
  subject:`Twój link do logowania w ŁapaPlan 🐾`,
  htmlContent:html,
  tags:["pl-login-fix"],
})});
console.log("Mail an", EMAIL, ":", res.ok?"GESENDET ✅":`FEHLER ${res.status} ${(await res.text()).slice(0,120)}`);
