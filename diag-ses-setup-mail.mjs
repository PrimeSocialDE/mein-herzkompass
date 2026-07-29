import { readFileSync } from "node:fs";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const BREVO=process.env.BREVO_API_KEY;
const html=`<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6;">
<h2 style="margin:0 0 8px;">SES-Setup für die andere KI — primesocial-videos.de</h2>
<p><strong>Eckdaten (nicht geheim):</strong></p>
<ul>
<li>AWS Account-ID: <strong>974436228773</strong></li>
<li>Region: <strong>eu-central-1</strong> (Frankfurt)</li>
<li>Domain in SES: <strong>primesocial-videos.de</strong> — DKIM-Status aktuell <strong>PENDING</strong> (muss erst „verified" werden, dann kann gesendet werden)</li>
</ul>
<p><strong>So bekommt die andere KI Sende-Zugang (empfohlen: eigener User, in der AWS-Console als Root):</strong></p>
<ol>
<li>IAM → Users → <strong>Create user</strong> (z. B. <code>claude-videos</code>)</li>
<li>Policy anhängen (minimal):</li>
</ol>
<pre style="background:#f5f5f5;padding:10px;border-radius:6px;font-size:12px;">{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["ses:SendEmail", "ses:SendRawEmail"],
    "Resource": "*"
  }]
}</pre>
<ol start="3">
<li><strong>Create access key</strong> → Typ „Application outside AWS" → Key ID + Secret kopieren</li>
<li>In der Umgebung der anderen KI setzen:
<pre style="background:#f5f5f5;padding:10px;border-radius:6px;font-size:12px;">AWS_ACCESS_KEY_ID=&lt;neuer Key&gt;
AWS_SECRET_ACCESS_KEY=&lt;neues Secret&gt;
AWS_REGION=eu-central-1</pre></li>
</ol>
<p><strong>Alternative (SMTP statt API):</strong> SES-Console → SMTP settings → Create SMTP credentials → Host <code>email-smtp.eu-central-1.amazonaws.com</code> (Port 587/465) + Username/Passwort.</p>
<p><strong>Schneller Weg ohne Console:</strong> dieselben AWS-Keys wiederverwenden, die das bestehende Projekt nutzt (aus dessen <code>.env.local</code>). Nachteil: beide teilen sich eine Identität.</p>
<p><strong>Wichtig:</strong> (1) Access-Key-Secret nie im Klartext teilen/mailen. (2) Domain muss erst DKIM-verifiziert sein. (3) Falls das SES-Konto noch im Sandbox-Modus ist, kann nur an verifizierte Empfänger gesendet werden — dann Production-Access beantragen.</p>
<p style="color:#6b7280;font-size:12px;">Hinweis: Einen neuen IAM-User/Key kann ich nicht per API anlegen — der SES-Versand-User hat keine IAM-Rechte. Dieser eine Schritt muss in der Console (Root/Admin) passieren.</p>
</div>`;
const res=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":BREVO,"Content-Type":"application/json"},body:JSON.stringify({
  sender:{name:"Setup (Pfoten/PrimeSocial)",email:"support@pfoten-plan.de"},
  to:[{email:"kontakt@primesocial.de"}],
  subject:"SES-Setup für die andere KI (primesocial-videos.de)",
  htmlContent:html,
  tags:["ses-setup-doc"],
})});
console.log("HTTP",res.status, res.ok?"-> GESENDET an kontakt@primesocial.de ✅":"-> FEHLER "+(await res.text()).slice(0,160));
