// Test-Versand: komplette 4-Mail-Sequenz fuer Mischling-Halter.
// 4 verschiedene Bilder (MischlingEmail1-4.jpg), Hundename in 3. Person,
// Test-Empfaenger: max@primesocial.de.
//
// Sample-Daten: Bella · Mischling · 4 Jahre · Leinenziehen · 12-Wochen-Plan.

import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const BREVO_API_KEY = process.env.BREVO_API_KEY;
if (!BREVO_API_KEY) { console.error("BREVO_API_KEY fehlt"); process.exit(1); }

const TO = "max@primesocial.de";
const dogName = "Bella";
const dogBreed = "Mischling";
const dogAge = "4 Jahre";
const planLength = "12 Wochen";
const leadId = "TEST-LEAD-ID-PLACEHOLDER";
const ctaUrl =
  "https://www.pfoten-plan.de/rueckhol.html" +
  `?lead_id=${encodeURIComponent(leadId)}&email=${encodeURIComponent(TO)}`;

// Bilder pro Mail (4 verschiedene Mischling-Fotos)
const img = (n) => `https://www.pfoten-plan.de/email-images/MischlingEmail${n}.jpg`;

// ── Template ──────────────────────────────────────────────────────────
function wrap({ subject, preheader, headline, intro, bodyHtml, ctaText, footerHint, heroImg }) {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<span style="display:none;font-size:1px;color:#FAF8F5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:22px 28px 6px;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8B7355;">Pfoten-Plan</p>
      </td></tr>
      <tr><td style="padding:8px 28px 18px;">
        <img src="${heroImg}" alt="${dogBreed}" width="544" style="width:100%;max-width:544px;height:auto;display:block;border-radius:12px;border:1px solid #F0EBE3;">
      </td></tr>
      <tr><td style="padding:0 28px 6px;">
        <h1 style="margin:0 0 14px;font-size:23px;line-height:1.28;font-weight:800;color:#1a1a1a;">${headline}</h1>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">${intro}</p>
        ${bodyHtml}
      </td></tr>
      <tr><td align="center" style="padding:22px 28px 8px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#C4A576;color:#FFFFFF;font-weight:700;font-size:15px;padding:15px 30px;border-radius:12px;text-decoration:none;box-shadow:0 2px 10px rgba(196,165,118,0.32);">${ctaText}</a>
      </td></tr>
      <tr><td style="padding:16px 28px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="padding:14px 16px;background:#FAFAFA;border-radius:10px;">
            <p style="margin:0;font-size:13px;line-height:1.55;color:#6B7280;">${footerHint}</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:14px 28px;background:#FAFAFA;border-top:1px solid #F0EBE3;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#9CA3AF;text-align:center;">
          Pfoten-Plan · <a href="https://www.pfoten-plan.de/mitglieder" style="color:#8B7355;text-decoration:underline;">Mein Bereich</a> · <a href="mailto:support@pfoten-plan.de" style="color:#8B7355;text-decoration:underline;">support@pfoten-plan.de</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

async function send(label, subject, html) {
  console.log(`Sende ${label}...`);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
      to: [{ email: TO }],
      subject,
      htmlContent: html,
    }),
  });
  const t = await res.text();
  console.log(`  HTTP ${res.status} · ${t.slice(0, 80)}`);
}

// ═══════════════════════════════════════════════════════════════════════
// MAIL 1 — T+10min: Plan-Lieferung
// Hundename als REFERENZ (3. Person), nicht als Anrede.
// ═══════════════════════════════════════════════════════════════════════
const m1 = {
  subject: `Dein ${planLength}-Plan für ${dogName} ist fertig`,
  preheader: `Eine Übung für heute — 7 Minuten reichen.`,
  heroImg: img(1),
  headline: `Der Plan für ${dogName} ist da.`,
  intro: `847 Hundebesitzer haben in den letzten Monaten denselben Schritt gemacht wie du heute. Was sie gemeinsam haben: sie hören jetzt nicht mehr auf — weil sie genau wissen, warum sie angefangen haben.`,
  bodyHtml: `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">
      Hier ist ${dogName}s Plan. Komplett auf sie zugeschnitten.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;margin:10px 0 14px;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">${dogName}s Profil</p>
        <p style="margin:0;font-size:14px;line-height:1.55;color:#1a1a1a;">
          <strong>${dogBreed}</strong> · ${dogAge} · Hauptthema: <strong>Leinenziehen</strong>
        </p>
      </td></tr>
    </table>
    <p style="margin:18px 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">Die erste Übung — heute, 7 Minuten</p>
    <h2 style="margin:0 0 10px;font-size:18px;line-height:1.35;font-weight:800;color:#1a1a1a;">Stehen bleiben. Nicht einmal. Jedes Mal.</h2>
    <p style="margin:0 0 8px;font-size:14.5px;line-height:1.6;color:#3a3a3a;">
      Beim ersten Spaziergang heute: sobald ${dogName} an der Leine zieht, bleibst du stehen. Wortlos. Du gehst keinen Schritt weiter, bis die Leine wieder durchhängt.
    </p>
    <p style="margin:0;font-size:14.5px;line-height:1.6;color:#3a3a3a;">
      Drei Wiederholungen heute reichen. Bei Mischlingen ist die Beobachtungsphase der ersten 2 Tage entscheidend — du lernst, was ${dogName} besonders schnell aufnimmt.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:18px 0 6px;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#8B7355;">Was bei Mischlingen wichtig ist</p>
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:#3a3a3a;">
          Jeder Mischling ist anders. Genau deshalb funktioniert dieser Plan: er ist auf das individuelle Verhalten von ${dogName} zugeschnitten, nicht auf eine Standard-Rasse aus dem Lehrbuch. Beobachte in den ersten Tagen, ob ${dogName} eher futtergetrieben oder eher jagdlich motiviert ist — daran richtet sich die Belohnungs-Wahl.
        </p>
      </td></tr>
    </table>`,
  ctaText: `${dogName}s Plan jetzt öffnen`,
  footerHint: `Fragen? Antworte einfach auf diese Mail. Wir melden uns innerhalb von 12 Stunden persönlich. Keine Auto-Antwort, kein Ticket-System.`,
};

// ═══════════════════════════════════════════════════════════════════════
// MAIL 2 — T+1 Tag: Normalisierung
// ═══════════════════════════════════════════════════════════════════════
const m2 = {
  subject: `Tag 1 mit ${dogName} war wahrscheinlich nicht perfekt`,
  preheader: `Das ist normal. Hier ist warum — und was heute leichter wird.`,
  heroImg: img(2),
  headline: `Gestern hat es nicht so geklappt wie gedacht.`,
  intro: `Das ist nicht ungewöhnlich. Bei den meisten unserer Halter ist Tag 1 der schwerste — nicht weil die Übung schwierig wäre, sondern weil ${dogName} noch nicht weiß, was du von ihr willst. Und du selbst dabei unsicher bist, ob du es richtig machst.`,
  bodyHtml: `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">
      Was die meisten am Anfang übersehen: ${dogName} braucht für ein neues Verhaltens-Muster im Schnitt 5 bis 7 Wiederholungen, bis es das erste Mal "klickt". Wenn du gestern nur 3 Versuche geschafft hast, war das nicht zu wenig — du warst erst auf halber Strecke.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:14px 0;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#8B7355;">Heute eine Sache anders machen</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">
          Mach die Übung heute beim ruhigsten Spaziergang des Tages. Nicht morgens, wenn ${dogName} voller Energie ist, nicht abends, wenn ihr beide müde seid. Mittags oder am späten Nachmittag. Du brauchst Konzentration — ${dogName} auch.
        </p>
      </td></tr>
    </table>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">
      Und falls du das Gefühl hast, gar nichts klappt: genau in diesem Moment gibt fast jeder auf. Genau jetzt liegen 3–4 Tage zwischen dir und dem ersten echten Aha-Moment mit ${dogName}.
    </p>`,
  ctaText: `${dogName}s Plan öffnen`,
  footerHint: `Schreib uns, wenn du nicht weiterkommst — wir lesen jede Mail persönlich. Innerhalb von 12 Stunden meldet sich jemand zurück.`,
};

// ═══════════════════════════════════════════════════════════════════════
// MAIL 3 — T+3 Tage: Curiosity-Loop + Rasse-Hinweis
// ═══════════════════════════════════════════════════════════════════════
const m3 = {
  subject: `Bei Mischlingen entscheidet Tag 5`,
  preheader: `Was du heute machst, bestimmt ob der Aha-Moment kommt.`,
  heroImg: img(3),
  headline: `${dogName} ist mittendrin im wichtigsten Fenster.`,
  intro: `Drei Tage Training mit ${dogName} liegen hinter dir. In den nächsten 48 Stunden entscheidet sich, ob aus dem Training eine Routine wird oder ob es wieder einschläft. Das ist nicht Zufall, sondern Erfahrungswert aus über 800 Plänen.`,
  bodyHtml: `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">
      Bei Mischlingen wie ${dogName} ist die Belohnung der wichtigste Hebel — wichtiger als die Anzahl der Wiederholungen. Weil jeder Mischling anders auf Belohnungen reagiert, lohnt sich ein kurzer Test: dieselbe Übung einmal mit Trockenfutter, einmal mit Käse, einmal mit kurzem Spielen. Du siehst sofort, was bei ${dogName} zieht.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:14px 0;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#8B7355;">Für heute und morgen</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">
          Erhöhe die Wertigkeit deiner Belohnung — und zwar nur bei der schwierigsten Übungs-Situation. Käse oder Wurst statt Trockenfutter. Genau in dem Moment, wo ${dogName} am ehesten "abdriftet". Das ist der Hebel, der bei Mischlingen am stärksten zieht.
        </p>
      </td></tr>
    </table>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">
      Im Dashboard findest du heute eine zusätzliche Übung speziell für den Übergang von Tag 3 zu Tag 5. Sie dauert 4 Minuten und ist genau auf den Belohnungs-Test zugeschnitten.
    </p>`,
  ctaText: `Die Tag-5-Übung öffnen`,
  footerHint: `Falls du dich fragst, ob du auf dem richtigen Weg bist: schick uns kurz, wie ${dogName} auf welche Belohnung reagiert. Wir geben dir eine ehrliche Einschätzung.`,
};

// ═══════════════════════════════════════════════════════════════════════
// MAIL 4 — T+5 Tage: Social-Proof-Story
// ═══════════════════════════════════════════════════════════════════════
const m4 = {
  subject: `Nina aus Köln hatte einen Mischling wie ${dogName}`,
  preheader: `Was sie nach 14 Tagen geschrieben hat.`,
  heroImg: img(4),
  headline: `Eine Mail, die letzten Monat reingekommen ist.`,
  intro: `Nina aus Köln hat im März mit unserem Plan begonnen. Ihre Mischlings-Hündin Sage ist 2 Jahre alt. Auch sie hatte das gleiche Hauptthema wie ${dogName}: Leinenziehen. Nach 14 Tagen kam folgende Mail bei uns rein:`,
  bodyHtml: `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;margin:8px 0 16px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 10px;font-size:14.5px;line-height:1.7;color:#1a1a1a;font-style:italic;">
          "Ich hatte nach Tag 3 fast aufgegeben. Nichts hat geklappt, Sage hat mich angeschaut, als wäre ich verrückt. Ich habe trotzdem weitergemacht — vor allem, weil ihr in Mail 2 geschrieben hattet, dass das normal ist. Tag 8 war der erste Spaziergang, bei dem die Leine nicht ein einziges Mal stramm war. Ich habe geweint."
        </p>
        <p style="margin:0;font-size:13px;color:#6B7280;">— Nina S., Mischling "Sage", 2 Jahre, Köln</p>
      </td></tr>
    </table>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3a3a3a;">
      Wir schicken dir das nicht, damit du dich besser fühlst. Sondern damit du weißt: das, was du gerade mit ${dogName} durchmachst, hat schon jemand vor dir geschafft — mit fast identischen Voraussetzungen wie deinen.
    </p>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#3a3a3a;">
      Ninas Sage ist heute, 8 Monate später, einer der entspanntesten Hunde in ihrer Nachbarschaft. Nicht durch ein Wunder. Sondern weil sie Tag 4 nicht abgebrochen hat.
    </p>`,
  ctaText: `${dogName}s Plan öffnen`,
  footerHint: `Du bekommst Ninas Mail, weil du jetzt an genau der Stelle bist, an der sie damals war. Du schaffst das auch.`,
};

// ── Versand ──────────────────────────────────────────────────────────
(async () => {
  for (const [label, mail] of [["Mail 1 (T+10min)", m1], ["Mail 2 (T+1 Tag)", m2], ["Mail 3 (T+3 Tage)", m3], ["Mail 4 (T+5 Tage)", m4]]) {
    await send(label, mail.subject, wrap(mail));
  }
  console.log("\n✓ 4 Mischling-Mails an", TO);
})();
