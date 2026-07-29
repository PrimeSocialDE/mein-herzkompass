// Generiert Zusatzmodul-PDFs frisch und schickt sie per Mail.
// Mail-Texte sind pro Modul individuell formuliert.
//
// Aufruf:
//   node scripts/send-zusatzmodul-samples.mjs <email>
//   node scripts/send-zusatzmodul-samples.mjs <email> pulling energy
//   node scripts/send-zusatzmodul-samples.mjs <email> all   (alle 10)

import { readFileSync } from "node:fs";

try {
  const envText = readFileSync(".env.local", "utf8");
  const matches = [
    ...envText.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm),
  ];
  for (const m of matches) {
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/send-zusatzmodul-samples.mjs <email> [moduleKey...]");
  process.exit(1);
}

const BREVO_API_KEY = process.env.BREVO_API_KEY;
if (!BREVO_API_KEY) {
  console.error("FEHLT: BREVO_API_KEY");
  process.exit(1);
}

const DOG_NAME = process.env.DOG_NAME || "Bruno";
const DOG_BREED = process.env.DOG_BREED || "Labrador-Mix";
const DRY_RUN = process.env.DRY_RUN === "1";

// Modul-Konfiguration: Subject + Mail-Body pro Modul, individuell formuliert.
// Mail-Stil basiert auf der existierenden Vorlage: kurz, persönlich, ohne Marketing.
const MODULE_CONFIG = {
  pulling: {
    label: "Leinenführungs-Plan",
    subject: "Dein Leinenführungs-Plan für {dogName} ist da",
    intro: "der Leinenführungs-Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und so aufgebaut, dass ihr gemeinsam zu entspannten Spaziergängen findet. Die acht Übungen greifen logisch ineinander und helfen euch dabei, ruhige Orientierung an dir aufzubauen, Ziehen sanft auszuhebeln und Ablenkungen souverän zu meistern.",
    closing: "Viel Freude bei der Umsetzung und entspannte Spaziergänge mit {dogName}!",
  },
  energy: {
    label: "Energie- & Ruhe-Plan",
    subject: "Dein Energie- & Ruhe-Plan für {dogName} ist da",
    intro: "der Energie- & Ruhe-Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und so aufgebaut, dass ihr gemeinsam den \"Aus-Knopf\" findet. Die acht Übungen greifen logisch ineinander und helfen euch dabei, Impulskontrolle zu stärken, Frusttoleranz aufzubauen und eine gesunde Balance zwischen Aktivität und wertvoller Entspannung zu finden.",
    closing: "Viel Freude bei der Umsetzung und eine entspannte Zeit mit {dogName}!",
  },
  anxiety: {
    label: "Alleine-bleiben Plan",
    subject: "Dein Alleine-bleiben Plan für {dogName} ist da",
    intro: "der Alleine-bleiben Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und so aufgebaut, dass {dogName} Schritt für Schritt lernt, dass dein Weggehen sicher und vorhersehbar ist. Die acht Übungen greifen logisch ineinander und helfen euch dabei, Vor-Signale zu entkoppeln, Allein-Zeit sanft aufzubauen und eine berechenbare Tagesstruktur zu etablieren.",
    closing: "Viel Geduld bei der Umsetzung und entspanntere Stunden für euch beide!",
  },
  aggression: {
    label: "Aggressions-Kontrolle",
    subject: "Dein Aggressions-Kontroll-Plan für {dogName} ist da",
    intro: "der Aggressions-Kontroll-Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und konsequent unter dem Schwellenwert aufgebaut, ohne Konfrontation oder Druck. Die acht Übungen greifen logisch ineinander und helfen euch dabei, Sicherheit zu schaffen, Reize emotional umzulernen und Begegnungen ruhiger zu gestalten.",
    closing: "Geduld zahlt sich hier besonders aus — viel Erfolg mit {dogName}!",
  },
  mouthing: {
    label: "Anti-Aufnehm Plan",
    subject: "Dein Anti-Aufnehm Plan für {dogName} ist da",
    intro: "der Anti-Aufnehm Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und so aufgebaut, dass ihr gemeinsam sichere Spaziergänge ohne Such-Drama hinbekommt. Die acht Übungen greifen logisch ineinander und helfen euch dabei, AUS und PFUI sauber zu konditionieren, Tausch-Geschäfte zu etablieren und Hochrisiko-Strecken zu meistern.",
    closing: "Viel Freude bei der Umsetzung und sichere Spaziergänge mit {dogName}!",
  },
  recall: {
    label: "Rückruf-Plan",
    subject: "Dein Rückruf-Plan für {dogName} ist da",
    intro: "der Rückruf-Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und so aufgebaut, dass der Rückruf in Stufen zuverlässig wird. Die acht Übungen greifen logisch ineinander und helfen euch dabei, KOMM-HER positiv zu laden, mit Schleppleine zu festigen und Ablenkungen souverän zu meistern.",
    closing: "Viel Erfolg beim Aufbau eures sicheren Rückrufs!",
  },
  barking: {
    label: "Anti-Bell Plan",
    subject: "Dein Anti-Bell Plan für {dogName} ist da",
    intro: "der Anti-Bell Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und setzt darauf, Stille aktiv zu belohnen statt Bellen zu bekämpfen. Die acht Übungen greifen logisch ineinander und helfen euch dabei, Auslöser zu identifizieren, Klingel-Routinen umzulernen und Frust-Bellen zu reduzieren.",
    closing: "Viel Erfolg bei der Umsetzung und ruhigere Stunden mit {dogName}!",
  },
  jumping: {
    label: "Anti-Anspring Plan",
    subject: "Dein Anti-Anspring Plan für {dogName} ist da",
    intro: "der Anti-Anspring Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und so aufgebaut, dass ihr Begrüßungen entspannt gestalten könnt. Die acht Übungen greifen logisch ineinander und helfen euch dabei, die 4-Pfoten-Regel zu etablieren, SITZ als Begrüßung zu festigen und auch mit Gästen ruhige Routinen zu schaffen.",
    closing: "Viel Erfolg mit {dogName} bei euren nächsten Begegnungen!",
  },
  destructive: {
    label: "Anti-Zerstörungs Plan",
    subject: "Dein Anti-Zerstörungs Plan für {dogName} ist da",
    intro: "der Anti-Zerstörungs Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und arbeitet mit besseren Alternativen statt Verboten. Die acht Übungen greifen logisch ineinander und helfen euch dabei, Ursachen zu erkennen, ein attraktives Kau-Sortiment aufzubauen und mentale Auslastung im Alltag zu sichern.",
    closing: "Viel Freude bei der Umsetzung und eine ruhigere Wohnung!",
  },
  soiling: {
    label: "Stubenreinheits-Plan",
    subject: "Dein Stubenreinheits-Plan für {dogName} ist da",
    intro: "der Stubenreinheits-Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und setzt auf klare Routinen und konsequente Belohnung statt Strafe. Die acht Übungen greifen logisch ineinander und helfen euch dabei, eine berechenbare Toiletten-Routine zu etablieren, Auslöser zu lesen und Unfälle sauber zu managen.",
    closing: "Geduld und Routine zahlen sich aus — viel Erfolg mit {dogName}!",
  },
};

function personalize(s, name) {
  return String(s || "").replace(/\{dogName\}/g, name);
}

function buildHtml({ moduleKey, dogName }) {
  const cfg = MODULE_CONFIG[moduleKey];
  if (!cfg) throw new Error(`Unbekannter Modul-Key: ${moduleKey}`);

  const intro = personalize(cfg.intro, dogName);
  const body = personalize(cfg.body, dogName);
  const closing = personalize(cfg.closing, dogName);

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;line-height:1.6;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:36px 36px 12px;">
<p style="margin:0 0 18px;font-size:15px;color:#1a1a1a;">Hallo,</p>
<p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;">${intro}</p>
<p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;">${body}</p>
<p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;">Wenn während des Trainings Fragen auftauchen, melde dich jederzeit gern.</p>
<p style="margin:0 0 8px;font-size:15px;color:#1a1a1a;">${closing}</p>
</td></tr>
<tr><td style="padding:8px 36px 32px;">
<div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;padding:14px 16px;">
<p style="margin:0;font-size:13px;color:#4B5563;line-height:1.5;">📄 Der vollständige Plan liegt als PDF im Anhang — druckbar oder unterwegs auf dem Handy dabei.</p>
</div>
</td></tr>
<tr><td style="padding:18px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;">
<p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;">Pfoten-Plan · Persönliches Hundetraining</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// Welche Module senden? Default: pulling + energy
const requestedModules = process.argv.slice(3).map((s) => s.toLowerCase());
let modulesToSend;
if (requestedModules.length === 0) {
  modulesToSend = ["pulling", "energy"];
} else if (requestedModules.includes("all")) {
  modulesToSend = Object.keys(MODULE_CONFIG);
} else {
  modulesToSend = requestedModules;
}

const { buildPdf } = await import("../generate-zusatzmodul-pdf.mjs");

for (const moduleKey of modulesToSend) {
  const cfg = MODULE_CONFIG[moduleKey];
  if (!cfg) {
    console.error(`✗ Unbekannter Modul-Key: ${moduleKey}`);
    continue;
  }

  console.log(`\n→ ${cfg.label} für ${DOG_NAME} an ${email}`);
  const pdfBytes = await buildPdf({
    dogName: DOG_NAME, dogBreed: DOG_BREED, moduleKey, verbose: false,
  });
  console.log(`  PDF: ${(pdfBytes.length / 1024).toFixed(0)} KB`);

  const html = buildHtml({ moduleKey, dogName: DOG_NAME });
  const subject = personalize(cfg.subject, DOG_NAME);

  if (DRY_RUN) {
    console.log(`  (DRY-RUN: NICHT gesendet) Subject: "${subject}"`);
    continue;
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
      replyTo: { email: "support@pfoten-plan.de", name: "Pfoten-Plan Support" },
      to: [{ email }],
      subject,
      htmlContent: html,
      attachment: [
        {
          name: `Pfoten-Plan-${cfg.label.replace(/[^a-zA-Z0-9-]/g, "-")}-${DOG_NAME}.pdf`,
          content: Buffer.from(pdfBytes).toString("base64"),
        },
      ],
      tags: [`zusatzmodul-${moduleKey}`],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`  ✗ Brevo ${res.status}:`, txt.slice(0, 200));
  } else {
    const data = await res.json();
    console.log(`  ✓ Mail gesendet (Brevo-ID: ${data.messageId || "?"})`);
  }
  await new Promise((r) => setTimeout(r, 1000));
}

console.log(`\nFertig. ${modulesToSend.length} Zusatzmodul-Mails an ${email}.\n`);
