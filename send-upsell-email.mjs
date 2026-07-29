const BREVO_API_KEY = process.env.BREVO_API_KEY;

// Test-Daten (wie sie von der Kampagne kämen)
const dogName = "Buddy";
const breed = "Labrador";
const customerEmail = "kontakt@primesocial.de";
const leadId = "TEST-LEAD-ID";

const brown = '#C4A576';
const brownDark = '#8B7355';
const brownLight = '#FFF9F0';
const textDark = '#1a1a1a';
const textMed = '#555';
const textLight = '#888';

// Link mit UTM + Pre-Fill Parametern
const link = `https://pfoten-plan.de/upsell-ernaehrung.html?email=${encodeURIComponent(customerEmail)}&lead_id=${leadId}&dogName=${encodeURIComponent(dogName)}&breed=${encodeURIComponent(breed)}&utm_source=brevo&utm_medium=email&utm_campaign=ernaehrung_april`;

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ernährung für ${dogName}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

<div style="max-width:560px;margin:0 auto;background:white;">

  <!-- Header -->
  <div style="padding:24px 30px;border-bottom:1px solid #f0f0f0;text-align:center;">
    <div style="font-size:18px;font-weight:800;color:${brown};letter-spacing:-0.3px;">Pfoten-Plan</div>
  </div>

  <!-- Hero Text -->
  <div style="padding:40px 30px 24px;">
    <p style="font-size:13px;color:${textLight};margin:0 0 14px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Für ${dogName}</p>
    <h1 style="font-size:28px;font-weight:800;color:${textDark};line-height:1.25;margin:0 0 16px;letter-spacing:-0.5px;">Die meisten Hundebesitzer füttern falsch - ohne es zu wissen.</h1>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0;">Hallo,</p>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:10px 0 0;">eine kurze Frage: Weißt du genau, wie viel Gramm Futter ${dogName} pro Tag braucht? Oder folgst du nur der Empfehlung auf der Verpackung?</p>
  </div>

  <!-- Problem Section -->
  <div style="padding:0 30px 24px;">
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0 0 14px;">Die Wahrheit: Diese Empfehlungen sind <strong style="color:${textDark};">nicht für ${dogName} gemacht</strong>. Sie sind pauschale Werte - für ein Durchschnitts-Gewicht, eine Durchschnitts-Aktivität, eine Durchschnitts-Rasse.</p>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0;">Das Ergebnis siehst du oft erst, wenn es zu spät ist:</p>
  </div>

  <!-- Problem List -->
  <div style="padding:0 30px 30px;">
    <div style="background:${brownLight};border-radius:10px;padding:18px 22px;border-left:3px solid ${brown};">
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div style="color:${brown};font-weight:800;flex-shrink:0;">•</div>
        <div style="font-size:14px;color:${textDark};line-height:1.6;">Stumpfes Fell trotz teurem Premium-Futter</div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div style="color:${brown};font-weight:800;flex-shrink:0;">•</div>
        <div style="font-size:14px;color:${textDark};line-height:1.6;">Übergewicht das schleichend kommt (besonders bei ${breed} typisch)</div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div style="color:${brown};font-weight:800;flex-shrink:0;">•</div>
        <div style="font-size:14px;color:${textDark};line-height:1.6;">Verdauungsprobleme, die dich und ${dogName} belasten</div>
      </div>
      <div style="display:flex;gap:12px;">
        <div style="color:${brown};font-weight:800;flex-shrink:0;">•</div>
        <div style="font-size:14px;color:${textDark};line-height:1.6;">Gelenkprobleme im Alter, die man mit der richtigen Ernährung verhindern könnte</div>
      </div>
    </div>
  </div>

  <!-- Solution -->
  <div style="padding:0 30px 24px;">
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0 0 14px;">Deshalb haben wir etwas für dich entwickelt: Einen <strong style="color:${textDark};">Ernährungsplan, der wirklich auf ${dogName} zugeschnitten ist</strong>.</p>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0;">Keine pauschalen Tipps. Keine Verpackungs-Empfehlungen. Sondern konkrete Grammangaben, basierend auf Rasse, Alter, Gewicht und Aktivität deines Hundes.</p>
  </div>

  <!-- Was drin ist -->
  <div style="padding:0 30px 30px;">
    <div style="border:1px solid #E8E8E8;border-radius:12px;padding:24px;">
      <p style="font-size:12px;color:${brown};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px;">Das ist drin:</p>

      <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">Tagesplan mit exakten Mengen</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">Morgens, mittags, abends - alles in Gramm. Für ${dogName} berechnet.</div>
      </div>

      <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">5 selbstgemachte Rezepte</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">Gesunde Leckerlis, einfach nachzubacken.</div>
      </div>

      <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">Wochenplan zum Ausdrucken</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">An den Kühlschrank hängen. Jede Woche wiederholbar.</div>
      </div>

      <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">10 giftige Lebensmittel</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">Was ${dogName} niemals fressen darf - mit Symptomen und Notfall-Plan.</div>
      </div>

      <div>
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:3px;">Einkaufsliste mit konkreten Marken</div>
        <div style="font-size:13px;color:${textLight};line-height:1.5;">Welches Futter, welche Zusätze - direkt loslegen.</div>
      </div>
    </div>
  </div>

  <!-- CTA -->
  <div style="padding:10px 30px 30px;text-align:center;">
    <a href="${link}" style="display:inline-block;background:${brown};color:white;text-decoration:none;padding:16px 36px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:-0.2px;">Plan für ${dogName} erstellen →</a>
    <div style="margin-top:14px;font-size:12px;color:${textLight};">3 kurze Fragen · Plan sofort per E-Mail</div>
  </div>

  <!-- Letzter Nudge -->
  <div style="padding:30px;">
    <p style="font-size:14px;color:${textMed};line-height:1.7;margin:0 0 12px;">PS: Die richtige Ernährung ist die Basis für alles - gesundes Fell, Energie, stabile Gelenke und ein langes Hundeleben. Kleine Anpassungen jetzt machen später den größten Unterschied.</p>
    <p style="font-size:14px;color:${textMed};line-height:1.7;margin:0;">Dein Pfoten-Plan Team</p>
  </div>

  <!-- Footer -->
  <div style="padding:20px 30px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
    <p style="font-size:11px;color:${textLight};margin:0 0 6px;">Pfoten-Plan · support@pfoten-plan.de</p>
    <p style="font-size:10px;color:#bbb;margin:0;">Du erhältst diese E-Mail, weil du Kunde bei Pfoten-Plan bist.</p>
  </div>

</div>
</body>
</html>`;

async function run() {
  console.log("Sende Test-Email...");

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Pfoten-Plan', email: 'support@pfoten-plan.de' },
      to: [{ email: 'kontakt@primesocial.de' }],
      subject: `Füttern Sie ${dogName} wirklich richtig?`,
      htmlContent: html
    })
  });

  if (res.ok) console.log("Gesendet!");
  else console.error("Error:", await res.text());
}

run().catch(console.error);
