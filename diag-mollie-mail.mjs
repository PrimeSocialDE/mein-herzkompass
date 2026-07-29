import { readFileSync } from "node:fs";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const BREVO=process.env.BREVO_API_KEY;
const html=`<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.55;">
<p>Hello Mollie team,</p>
<p>We have a serious issue with <strong>Przelewy24</strong> on our PLN account (organisation <strong>org_19512058</strong>, profile <strong>pfl_WzzSDJXmrF</strong>, website lapaplan.pl).</p>
<p>Przelewy24 shows as <strong>"activated"</strong> in our settings, but <strong>every P24 payment expires without completing</strong>. In the last ~24h, <strong>0 of ~15</strong> Przelewy24 payments succeeded (all status <code>expired</code>), while <strong>BLIK works normally</strong> (~90% paid) through the exact same integration.</p>
<p>In addition, creating a <strong>new Przelewy24 payment via the API currently returns a 503/500 upstream/internal error</strong> ("The service is currently unavailable due to an upstream (503) or internal error (500)."). We reproduced this 3 times in a row.</p>
<p>Our integration is correct: <code>method: "przelewy24"</code>, <code>billingEmail</code> set, <code>locale: pl_PL</code>, currency <strong>PLN</strong>, valid amounts. BLIK payments with the identical setup succeed.</p>
<p>Example expired Przelewy24 payments:</p>
<ul>
<li><code>tr_qfMWWJMqQitcFa2NAZbUJ</code></li>
<li><code>tr_6yD8kRYNjGUsiiYqBZbUJ</code></li>
<li><code>tr_itQ2iPzgMozsZqbUGYbUJ</code></li>
</ul>
<p>Could you please check the <strong>Przelewy24 acquirer connection / onboarding</strong> for profile <strong>pfl_WzzSDJXmrF</strong>? Specifically: is Przelewy24 fully live for this profile, why do all P24 payments expire, and why does payment creation return a 503? This is currently costing us roughly a third of our checkout attempts.</p>
<p>Thank you very much,<br>PrimeSocial / ŁapaPlan (lapaplan.pl)<br>Reply to: kontakt@primesocial.de</p>
</div>`;
const res=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":BREVO,"Content-Type":"application/json"},body:JSON.stringify({
  sender:{name:"PrimeSocial / ŁapaPlan",email:"support@pfoten-plan.de"},
  replyTo:{email:"kontakt@primesocial.de",name:"PrimeSocial"},
  to:[{email:"support@mollie.com"}],
  cc:[{email:"kontakt@primesocial.de"}],
  subject:"Przelewy24 payments failing — activated but 100% expired, 503 on create (profile pfl_WzzSDJXmrF)",
  htmlContent:html,
  tags:["mollie-support-p24"],
})});
console.log("HTTP",res.status, res.ok?"-> GESENDET ✅":"-> FEHLER "+(await res.text()).slice(0,160));
