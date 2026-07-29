import { readFileSync } from "node:fs";
const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8");
for(const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)]) if(!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
const BREVO=process.env.BREVO_API_KEY;
const html=`<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.55;">
<p>Hallo Mollie-Team,</p>
<p>wir haben ein gravierendes Problem mit <strong>Przelewy24</strong> auf unserem PLN-Konto (Organisation <strong>org_19512058</strong>, Profil <strong>pfl_WzzSDJXmrF</strong>, Website lapaplan.pl).</p>
<p>Przelewy24 wird bei uns als <strong>„activated"</strong> angezeigt, aber <strong>jede P24-Zahlung läuft ab, ohne abgeschlossen zu werden</strong>. In den letzten ~24 Stunden waren <strong>0 von ~15</strong> Przelewy24-Zahlungen erfolgreich (alle Status <code>expired</code>), während <strong>BLIK über dieselbe Integration normal funktioniert</strong> (~90% bezahlt).</p>
<p>Zusätzlich gibt das Anlegen einer neuen Przelewy24-Zahlung über die API aktuell einen <strong>503/500-Upstream-/Internal-Fehler</strong> zurück („The service is currently unavailable due to an upstream (503) or internal error (500)."). Wir konnten das 3-mal in Folge reproduzieren.</p>
<p>Unsere Integration ist korrekt: <code>method: „przelewy24"</code>, <code>billingEmail</code> gesetzt, <code>locale: pl_PL</code>, Währung <strong>PLN</strong>, gültige Beträge. BLIK-Zahlungen mit identischem Setup gehen durch.</p>
<p>Beispiele für abgelaufene Przelewy24-Zahlungen:</p>
<ul>
<li><code>tr_qfMWWJMqQitcFa2NAZbUJ</code></li>
<li><code>tr_6yD8kRYNjGUsiiYqBZbUJ</code></li>
<li><code>tr_itQ2iPzgMozsZqbUGYbUJ</code></li>
</ul>
<p>Könntet ihr bitte die <strong>Przelewy24-Acquirer-Anbindung / das Onboarding</strong> für Profil <strong>pfl_WzzSDJXmrF</strong> prüfen? Konkret: Ist Przelewy24 für dieses Profil vollständig live, warum laufen alle P24-Zahlungen ab, und warum gibt das Anlegen einer Zahlung einen 503 zurück? Das kostet uns aktuell rund ein Drittel aller Checkout-Versuche.</p>
<p>Vielen Dank,<br>Max<br>lapaplan.pl / ŁapaPlan</p>
</div>`;
const res=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":BREVO,"Content-Type":"application/json"},body:JSON.stringify({
  sender:{name:"Max — PrimeSocial / ŁapaPlan",email:"support@pfoten-plan.de"},
  replyTo:{email:"kontakt@primesocial.de",name:"Max (PrimeSocial)"},
  to:[{email:"support@mollie.com"}],
  cc:[{email:"kontakt@primesocial.de"}],
  subject:"Przelewy24-Zahlungen schlagen fehl — aktiviert, aber 100% laufen ab, 503 beim Anlegen (Profil pfl_WzzSDJXmrF)",
  htmlContent:html,
  tags:["mollie-support-p24-de"],
})});
console.log("HTTP",res.status, res.ok?"-> GESENDET ✅":"-> FEHLER "+(await res.text()).slice(0,160));
