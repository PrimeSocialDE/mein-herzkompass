const BREVO_API_KEY = process.env.BREVO_API_KEY;

const dogName = "Buddy";
const breed = "Labrador";
const customerEmail = "kontakt@primesocial.de";
const leadId = "TEST-LEAD-ID";

const brown = '#C4A576';
const brownDark = '#8B7355';
const brownLight = '#FFF9F0';
const red = '#DC2626';
const redLight = '#FEF2F2';
const textDark = '#1a1a1a';
const textMed = '#555';
const textLight = '#888';

// ===== REISE-GUIDE EMAIL =====
const reiseLink = `https://pfoten-plan.de/upsell-reise.html?email=${encodeURIComponent(customerEmail)}&lead_id=${leadId}&dogName=${encodeURIComponent(dogName)}&utm_source=brevo&utm_medium=email&utm_campaign=reise_april`;

const reiseHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reise mit ${dogName}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

<div style="max-width:560px;margin:0 auto;background:white;">

  <!-- Header -->
  <div style="padding:24px 30px;border-bottom:1px solid #f0f0f0;text-align:center;">
    <div style="font-size:18px;font-weight:800;color:${brown};letter-spacing:-0.3px;">Pfoten-Plan</div>
  </div>

  <!-- Hero -->
  <div style="padding:40px 30px 24px;">
    <p style="font-size:13px;color:${textLight};margin:0 0 14px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Für ${dogName}</p>
    <h1 style="font-size:28px;font-weight:800;color:${textDark};line-height:1.25;margin:0 0 16px;letter-spacing:-0.5px;">Der Urlaub mit ${dogName} kann entspannt werden.</h1>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0 0 10px;">Hallo,</p>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0;">bald steht die Urlaubszeit an. Und mit ihr die Frage: Wie kriegen wir ${dogName} entspannt ans Ziel - und wieder zurück?</p>
  </div>

  <!-- Problem -->
  <div style="padding:0 30px 24px;">
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0 0 14px;">Die meisten Hundebesitzer unterschätzen Reisen mit Hund. Was vorher harmlos klingt, wird unterwegs schnell zum Albtraum:</p>
  </div>

  <div style="padding:0 30px 30px;">
    <div style="background:${brownLight};border-radius:10px;padding:18px 22px;border-left:3px solid ${brown};">
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div style="color:${brown};font-weight:800;flex-shrink:0;">•</div>
        <div style="font-size:14px;color:${textDark};line-height:1.6;">${dogName} zittert und hechelt schon nach 20 Minuten Autofahrt</div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div style="color:${brown};font-weight:800;flex-shrink:0;">•</div>
        <div style="font-size:14px;color:${textDark};line-height:1.6;">Reiseübelkeit - und du hast nichts zum Saubermachen dabei</div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div style="color:${brown};font-weight:800;flex-shrink:0;">•</div>
        <div style="font-size:14px;color:${textDark};line-height:1.6;">Am Zielort: Hotel verbietet Hunde plötzlich doch</div>
      </div>
      <div style="display:flex;gap:12px;">
        <div style="color:${brown};font-weight:800;flex-shrink:0;">•</div>
        <div style="font-size:14px;color:${textDark};line-height:1.6;">Dokumente fehlen an der Grenze - der Urlaub ist vorbei bevor er anfängt</div>
      </div>
    </div>
  </div>

  <!-- Solution -->
  <div style="padding:0 30px 24px;">
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0 0 14px;">Mit der richtigen Vorbereitung wird jede Reise mit ${dogName} stressfrei - auch über mehrere Stunden oder ins Ausland.</p>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0;">Unser <strong style="color:${textDark};">Reise-Guide</strong> ist genau das: Ein kompaktes Handbuch mit allem was du vor, während und am Urlaubsort brauchst.</p>
  </div>

  <!-- Was drin ist -->
  <div style="padding:0 30px 30px;">
    <div style="border:1px solid #E8E8E8;border-radius:12px;padding:24px;">
      <p style="font-size:12px;color:${brown};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px;">Das ist drin:</p>

      <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">Reise-Angst bei ${dogName}?</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">5 konkrete Übungen die ${dogName} Schritt für Schritt an die Fahrt gewöhnen.</div>
      </div>

      <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">Komplette Packliste</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">4 Kategorien mit Checkboxen - einmal drucken, nie wieder was vergessen.</div>
      </div>

      <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">Transport-spezifische Tipps</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">Auto, Zug oder Flugzeug - jeweils mit konkreten Vorbereitungs-Schritten.</div>
      </div>

      <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">EU-Einreisebestimmungen</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">6 beliebte Reiseländer mit allen Anforderungen auf einen Blick.</div>
      </div>

      <div>
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">Notfall-Handling unterwegs</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">Reiseübelkeit, Stress, Durchfall - mit sofort umsetzbaren Lösungen.</div>
      </div>
    </div>
  </div>

  <!-- CTA -->
  <div style="padding:10px 30px 30px;text-align:center;">
    <a href="${reiseLink}" style="display:inline-block;background:${brown};color:white;text-decoration:none;padding:16px 36px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:-0.2px;">Reise-Guide für ${dogName} →</a>
    <div style="margin-top:14px;font-size:12px;color:${textLight};">3 kurze Fragen · Guide sofort per E-Mail</div>
  </div>

  <!-- PS -->
  <div style="padding:30px;">
    <p style="font-size:14px;color:${textMed};line-height:1.7;margin:0 0 12px;">PS: Die Reise-Vorbereitung sollte 4 Wochen vor Abfahrt starten - besonders wenn du ins Ausland reist. Je früher du anfängst, desto entspannter wird ${dogName} am Abreisetag.</p>
    <p style="font-size:14px;color:${textMed};line-height:1.7;margin:0;">Dein Pfoten-Plan Team</p>
  </div>

  <div style="padding:20px 30px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
    <p style="font-size:11px;color:${textLight};margin:0 0 6px;">Pfoten-Plan · support@pfoten-plan.de</p>
    <p style="font-size:10px;color:#bbb;margin:0;">Du erhältst diese E-Mail, weil du Kunde bei Pfoten-Plan bist.</p>
  </div>

</div>
</body>
</html>`;

// ===== ERSTE-HILFE EMAIL =====
const erstehilfeLink = `https://pfoten-plan.de/upsell-erstehilfe.html?email=${encodeURIComponent(customerEmail)}&lead_id=${leadId}&dogName=${encodeURIComponent(dogName)}&utm_source=brevo&utm_medium=email&utm_campaign=erstehilfe_april`;

const erstehilfeHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Notfall bei ${dogName}?</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

<div style="max-width:560px;margin:0 auto;background:white;">

  <!-- Header -->
  <div style="padding:24px 30px;border-bottom:1px solid #f0f0f0;text-align:center;">
    <div style="font-size:18px;font-weight:800;color:${brown};letter-spacing:-0.3px;">Pfoten-Plan</div>
  </div>

  <!-- Hero - Emotionale Frage -->
  <div style="padding:40px 30px 24px;">
    <p style="font-size:13px;color:${red};margin:0 0 14px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Notfall-Vorsorge</p>
    <h1 style="font-size:28px;font-weight:800;color:${textDark};line-height:1.25;margin:0 0 16px;letter-spacing:-0.5px;">Wenn ${dogName} Schokolade frisst - weißt du was zu tun ist?</h1>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0 0 10px;">Hallo,</p>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0;">eine unangenehme Frage zu Beginn. Aber stell dir vor, es ist Samstagabend. Du bist allein zuhause. ${dogName} hat aus der Küche etwas geklaut - und frisst es gerade.</p>
  </div>

  <!-- Problem: Der Moment -->
  <div style="padding:0 30px 24px;">
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0 0 14px;">Der Tierarzt ist nicht erreichbar. Der Notdienst ist 40 Minuten weg. <strong style="color:${textDark};">Was jetzt?</strong></p>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0;">Die meisten Hundebesitzer googeln hektisch. Finden widersprüchliche Antworten. Verlieren wertvolle Minuten. Und machen oft alles schlimmer - weil sie nicht wissen, was man <strong>niemals</strong> tun sollte.</p>
  </div>

  <!-- Schmerzpunkte als Warn-Box -->
  <div style="padding:0 30px 30px;">
    <div style="background:${redLight};border-radius:10px;padding:18px 22px;border-left:3px solid ${red};">
      <div style="font-size:12px;font-weight:700;color:${red};text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Typische Fehler in Panik</div>
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div style="color:${red};font-weight:800;flex-shrink:0;">×</div>
        <div style="font-size:14px;color:${textDark};line-height:1.6;">Erbrechen auslösen (kann die Lage verschlimmern)</div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div style="color:${red};font-weight:800;flex-shrink:0;">×</div>
        <div style="font-size:14px;color:${textDark};line-height:1.6;">Milch geben (stoppt nicht die Vergiftung)</div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div style="color:${red};font-weight:800;flex-shrink:0;">×</div>
        <div style="font-size:14px;color:${textDark};line-height:1.6;">"Erstmal abwarten" - oft tödlich bei Vergiftungen</div>
      </div>
      <div style="display:flex;gap:12px;">
        <div style="color:${red};font-weight:800;flex-shrink:0;">×</div>
        <div style="font-size:14px;color:${textDark};line-height:1.6;">Hausmittel ausprobieren die nur bei Menschen helfen</div>
      </div>
    </div>
  </div>

  <!-- Solution -->
  <div style="padding:0 30px 24px;">
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0 0 14px;">Genau deshalb haben wir einen <strong style="color:${textDark};">Erste-Hilfe Guide</strong> entwickelt - für die Momente wo jede Sekunde zählt.</p>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0;">Druck ihn aus, hänge ihn auf, hab ihn griffbereit. Damit du nie wieder googeln musst, wenn ${dogName} dich braucht.</p>
  </div>

  <!-- Was drin ist -->
  <div style="padding:0 30px 30px;">
    <div style="border:1px solid #E8E8E8;border-radius:12px;padding:24px;">
      <p style="font-size:12px;color:${brown};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px;">Das ist drin:</p>

      <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">10 häufigste Notfälle</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">Vergiftung, Hitzschlag, Verletzungen - mit klaren Schritt-für-Schritt Anleitungen.</div>
      </div>

      <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">Harmlos oder gefährlich?</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">10 Alltags-Situationen die verunsichern - mit klaren Antworten.</div>
      </div>

      <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">Wiederbelebung</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">Anleitung für den absoluten Notfall - wenn ${dogName} nicht mehr atmet.</div>
      </div>

      <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">Notfall-Apotheke Checkliste</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">Was in jede Erste-Hilfe-Tasche gehört - einmal zusammenstellen, immer griffbereit.</div>
      </div>

      <div>
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">Wichtige Notfall-Nummern</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">Giftnotruf, Tierrettung - alle wichtigen Nummern auf einen Blick.</div>
      </div>
    </div>
  </div>

  <!-- CTA -->
  <div style="padding:10px 30px 30px;text-align:center;">
    <a href="${erstehilfeLink}" style="display:inline-block;background:${brown};color:white;text-decoration:none;padding:16px 36px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:-0.2px;">${dogName} jetzt absichern →</a>
    <div style="margin-top:14px;font-size:12px;color:${textLight};">3 kurze Fragen · Guide sofort per E-Mail</div>
  </div>

  <!-- PS -->
  <div style="padding:30px;">
    <p style="font-size:14px;color:${textMed};line-height:1.7;margin:0 0 12px;">PS: Die beste Versicherung ist die, die man hat bevor man sie braucht. Notfälle kommen ohne Vorwarnung - wer den Guide erst im Ernstfall sucht, hat ihn nicht.</p>
    <p style="font-size:14px;color:${textMed};line-height:1.7;margin:0;">Dein Pfoten-Plan Team</p>
  </div>

  <div style="padding:20px 30px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
    <p style="font-size:11px;color:${textLight};margin:0 0 6px;">Pfoten-Plan · support@pfoten-plan.de</p>
    <p style="font-size:10px;color:#bbb;margin:0;">Du erhältst diese E-Mail, weil du Kunde bei Pfoten-Plan bist.</p>
  </div>

</div>
</body>
</html>`;

async function sendEmail(subject, html) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Pfoten-Plan', email: 'support@pfoten-plan.de' },
      to: [{ email: 'kontakt@primesocial.de' }],
      subject,
      htmlContent: html
    })
  });
  if (res.ok) console.log(`✓ Gesendet: ${subject}`);
  else console.error(`✗ Fehler: ${await res.text()}`);
}

async function run() {
  console.log("Sende Email-Templates...\n");
  await sendEmail(`[TEST] ${dogName} entspannt auf Reisen? Hier ist dein Reise-Guide`, reiseHtml);
  await sendEmail(`[TEST] Wenn ${dogName} Schokolade frisst - weißt du was zu tun ist?`, erstehilfeHtml);
}

run().catch(console.error);
