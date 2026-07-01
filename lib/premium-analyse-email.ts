// Wiederverwendbares E-Mail-Template fuer die 79-EUR-Premium-Analyse.
// Value-gefuehrt (verstehen statt Feature-Liste). Wird sowohl fuer den
// Tag-17-/2,5-Wochen-Versand als auch fuer Testmails genutzt.

export function buildPremiumAnalyseEmail(opts: {
  dogName?: string | null;
  ctaUrl: string;
}): { subject: string; html: string } {
  const dog = (opts.dogName || "deinen Hund").trim() || "deinen Hund";
  const cta = opts.ctaUrl;
  const subject = `${dog}: verstehst du wirklich, warum er so ist?`;

  const value = [
    ["🔍", "Warum " + dog + " sich so verhält", "die echte Ursache hinter dem Verhalten, nicht nur das Symptom"],
    ["🐾", "Sein wahrer Charakter", "welcher Typ Hund er ist, wie er tickt und was er wirklich braucht"],
    ["🩺", "Klarheit statt Sorge", "was bei seiner Rasse, seinem Körper und seiner Lebensphase normal ist"],
    ["💬", "Deine persönliche Frage", "die eine Sache, die du über " + dog + " verstehen willst — direkt beantwortet"],
  ]
    .map(
      ([ico, t, d]) => `
      <tr>
        <td style="padding:9px 0;vertical-align:top;width:34px;font-size:19px;line-height:1.2">${ico}</td>
        <td style="padding:9px 0;vertical-align:top">
          <div style="font-size:15px;font-weight:700;color:#1a1a1a;line-height:1.3">${t}</div>
          <div style="font-size:13.5px;color:#6B7280;line-height:1.45;margin-top:2px">${d}</div>
        </td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBF7F0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td align="center" style="padding:6px 0 18px">
          <span style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8B7355">Pfoten-Plan</span>
        </td></tr>

        <tr><td style="background:#ffffff;border:1px solid #EADDC5;border-radius:18px;padding:28px 26px">
          <div style="display:inline-block;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#ffffff;background:#C4A576;border-radius:999px;padding:5px 12px;margin-bottom:14px">Neu · Premium-Analyse</div>
          <h1 style="font-size:24px;line-height:1.25;font-weight:800;color:#1a1a1a;margin:0 0 12px">Verstehe ${dog} endlich wirklich</h1>
          <p style="font-size:15px;line-height:1.6;color:#42413f;margin:0 0 6px">Hallo,</p>
          <p style="font-size:15px;line-height:1.6;color:#42413f;margin:0 0 18px">
            dein Trainingsplan zeigt dir das <b>Was</b> — was du üben kannst. Aber verstehst du auch das <b>Warum</b> hinter ${dog}s Verhalten?
            Genau dafür haben wir die persönliche Premium-Analyse gebaut: ein tiefes Verständnis-Gutachten über genau deinen Hund.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;padding:6px 16px;margin:0 0 22px">
            ${value}
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EAF6EE;border:1px solid #cfe9d8;border-radius:12px;margin:0 0 22px">
            <tr><td style="padding:12px 16px;font-size:13.5px;color:#2e7d4f;line-height:1.5">
              <b>79&nbsp;€ einmalig</b> · Lieferung in 48&nbsp;h per E-Mail · 14&nbsp;Tage Geld-zurück-Garantie
            </td></tr>
          </table>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td align="center" style="border-radius:14px;background:#b7945a">
            <a href="${cta}" style="display:inline-block;padding:16px 30px;font-size:17px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:14px">Analyse für ${dog} anfordern →</a>
          </td></tr></table>

          <p style="font-size:12.5px;line-height:1.55;color:#9aa2ad;text-align:center;margin:18px 0 0">
            Deine bekannten Angaben sind auf der Seite schon vorausgefüllt — du ergänzt nur noch ein paar Details.
          </p>
        </td></tr>

        <tr><td align="center" style="padding:18px 10px 0;font-size:12px;color:#9aa2ad;line-height:1.6">
          Pfoten-Plan · Diese Analyse ist ein Verständnis-Gutachten und ersetzt keine tierärztliche Untersuchung.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}
