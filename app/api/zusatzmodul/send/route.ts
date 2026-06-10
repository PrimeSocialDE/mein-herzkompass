// /api/zusatzmodul/send — generiert ein Zusatzmodul-PDF on-the-fly
// und schickt es per Brevo an den Käufer. Wird typischerweise vom
// Mollie/Stripe-Webhook nach einem Upsell-Kauf getriggert.
//
// Body:
//   { email, dogName?, moduleKey }
//
// moduleKey: pulling | energy | anxiety | aggression | mouthing |
//            recall | barking | jumping | destructive | soiling

import { NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";

// Idempotenz-Check: hat dieser Lead für dieses Modul schon eine Mail
// bekommen? Tracking in wauwerk_leads.answers.zusatzmodul_sent (Array).
async function isAlreadySent(email: string, moduleKey: string): Promise<boolean> {
  if (!email) return false;
  const admin = createMemberAdminClient();
  const { data } = await admin
    .from("wauwerk_leads")
    .select("id, answers")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sent = (data?.answers as any)?.zusatzmodul_sent;
  return Array.isArray(sent) && sent.includes(moduleKey);
}

async function markAsSent(email: string, moduleKey: string): Promise<void> {
  if (!email) return;
  const admin = createMemberAdminClient();
  const { data } = await admin
    .from("wauwerk_leads")
    .select("id, answers")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.id) return;
  const prevAnswers = (data.answers || {}) as Record<string, any>;
  const sent: string[] = Array.isArray(prevAnswers.zusatzmodul_sent)
    ? prevAnswers.zusatzmodul_sent
    : [];
  if (sent.includes(moduleKey)) return;
  await admin
    .from("wauwerk_leads")
    .update({
      answers: {
        ...prevAnswers,
        zusatzmodul_sent: [...sent, moduleKey],
        zusatzmodul_sent_at: {
          ...(prevAnswers.zusatzmodul_sent_at || {}),
          [moduleKey]: new Date().toISOString(),
        },
      },
    })
    .eq("id", data.id);
}

// Mail-Texte pro Modul — gleicher Stil wie bei den Sample-Mails.
const MODULE_CONFIG: Record<
  string,
  {
    label: string;
    subject: string;
    intro: string;
    body: string;
    closing: string;
  }
> = {
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
    body: 'Der Plan wurde individuell auf {dogName} abgestimmt und so aufgebaut, dass ihr gemeinsam den "Aus-Knopf" findet. Die acht Übungen greifen logisch ineinander und helfen euch dabei, Impulskontrolle zu stärken, Frusttoleranz aufzubauen und eine gesunde Balance zwischen Aktivität und wertvoller Entspannung zu finden.',
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

// Bonus-Varianten: nutzen den PDF-Inhalt eines bestehenden Moduls (pdfModuleKey),
// aber mit eigenem, exklusiverem Mail-Namen UND eigenem Idempotenz-Key. Wichtig:
// der eigene Key (z.B. "freilauf") verhindert, dass ein spaeterer regulaerer
// Kauf desselben Moduls (z.B. "recall" im Shop) faelschlich als "schon gesendet"
// geblockt wird. Der Shop/MODULE_CONFIG bleibt unangetastet.
const BONUS_CONFIG: Record<
  string,
  {
    pdfModuleKey: string;
    label: string;
    subject: string;
    intro: string;
    body: string;
    closing: string;
  }
> = {
  freilauf: {
    pdfModuleKey: "recall",
    label: "Freilauf-Perfektions-Plan",
    subject: "🎁 Dein Freilauf-Perfektions-Plan für {dogName} ist da",
    intro: "dein exklusiver Freilauf-Perfektions-Plan für {dogName} ist freigeschaltet — heute geschenkt zu deinem Trainingsplan dazu.",
    body: "Dieser Bonus bringt {dogName} aufs nächste Level: zuverlässig kommen — auch aus dem Spiel, bei Ablenkung oder auf Distanz — und entspannter Freilauf, dem du wirklich vertrauen kannst. Die acht Übungen bauen logisch aufeinander auf: vom sicheren KOMM-HER über die Schleppleinen-Phase bis zur souveränen Freilauf-Routine.",
    closing: "Viel Freude mit eurem neuen Freilauf — Schritt für Schritt zur Perfektion!",
  },
};

function personalize(s: string, name: string): string {
  return String(s || "").replace(/\{dogName\}/g, name);
}

function buildHtml(
  cfg: { intro: string; body: string; closing: string },
  dogName: string
): string {
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
<p style="margin:0;font-size:13px;color:#4B5563;line-height:1.5;">Der vollständige Plan liegt als PDF im Anhang — druckbar oder unterwegs auf dem Handy dabei.</p>
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, dogName, moduleKey, bonusKey, force } = body || {};

    if (!email) return NextResponse.json({ error: "email fehlt" }, { status: 400 });

    // Entweder regulaeres Modul (moduleKey → MODULE_CONFIG) ODER Bonus-Variante
    // (bonusKey → BONUS_CONFIG mit eigenem Namen + eigenem Idempotenz-Key).
    const bonus = bonusKey ? BONUS_CONFIG[bonusKey] : null;
    if (bonusKey && !bonus) {
      return NextResponse.json(
        { error: `bonusKey ungültig: "${bonusKey}". Verfügbar: ${Object.keys(BONUS_CONFIG).join(", ")}` },
        { status: 400 }
      );
    }
    if (!bonus && (!moduleKey || !MODULE_CONFIG[moduleKey])) {
      return NextResponse.json(
        { error: `moduleKey ungültig: "${moduleKey}". Verfügbar: ${Object.keys(MODULE_CONFIG).join(", ")}` },
        { status: 400 }
      );
    }

    // Effektive Werte: Bonus hat eigenen Track-Key + eigenen Mail-Text,
    // das PDF kommt aber aus pdfModuleKey (bestehender Modul-Inhalt).
    const cfg = bonus ? bonus : MODULE_CONFIG[moduleKey];
    const pdfModuleKey: string = bonus ? bonus.pdfModuleKey : moduleKey;
    const trackKey: string = bonus ? bonusKey : moduleKey;
    if (!BREVO_API_KEY) {
      return NextResponse.json({ error: "BREVO_API_KEY fehlt" }, { status: 500 });
    }

    // Idempotenz: wenn dieses Modul schon an diese Email gesendet wurde,
    // skip — ausser ?force=true (Re-Send vom Dashboard / Admin).
    if (!force) {
      const alreadySent = await isAlreadySent(email, trackKey);
      if (alreadySent) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "already_sent",
          moduleKey: trackKey,
          email,
        });
      }
    }

    const name = (dogName || "deinen Hund").trim();

    // PDF on-the-fly bauen — kein Vorab-File nötig.
    const { buildPdf } = await import("@/generate-zusatzmodul-pdf.mjs");
    const pdfBytes = await buildPdf({
      dogName: name,
      dogBreed: "Mischling",
      moduleKey: pdfModuleKey,
      verbose: false,
    });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    const subject = personalize(cfg.subject, name);
    const html = buildHtml(cfg, name);
    const filename = `Pfoten-Plan-${cfg.label.replace(/[^a-zA-Z0-9-]/g, "-")}-${name.replace(/[^a-zA-Z0-9-]/g, "")}.pdf`;

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
        replyTo: { email: "support@pfoten-plan.de", name: "Pfoten-Plan Support" },
        to: [{ email }],
        cc: [{ email: "kontakt@primesocial.de" }],
        subject,
        htmlContent: html,
        attachment: [{ name: filename, content: pdfBase64 }],
        tags: [`zusatzmodul-${trackKey}`, "auto-trigger"],
      }),
    });

    if (!brevoRes.ok) {
      const txt = await brevoRes.text();
      return NextResponse.json(
        { error: `Brevo ${brevoRes.status}: ${txt.slice(0, 200)}` },
        { status: 500 }
      );
    }
    const data = await brevoRes.json();
    // Idempotenz-Marker setzen (best-effort, blockiert die Response nicht)
    try {
      await markAsSent(email, trackKey);
    } catch (e: any) {
      console.warn("[zusatzmodul/send] markAsSent failed:", e?.message);
    }
    return NextResponse.json({
      ok: true,
      moduleKey: trackKey,
      email,
      brevoMessageId: data.messageId || null,
    });
  } catch (e: any) {
    console.error("[zusatzmodul/send] error:", e);
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
