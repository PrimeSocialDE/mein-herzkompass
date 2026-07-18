// lib/grundkommandos-deliver.ts
//
// Orchestriert die Auslieferung des Notfall-Grundkommando-Plans fuer EINEN Lead:
// Lead lesen -> Opus-Content (mit dog_commands) -> PDF (pdf-lib) -> Brevo-Mail
// mit PDF-Anhang -> answers.grundkommandos_sent_at setzen (idempotent).
// Wird von /api/grundkommandos/generate (manuell) UND vom Cron genutzt.

import { supabase } from "@/lib/db";

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";

function customerHtml(dog: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;color:#1a1a1a">
    <div style="text-align:center;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8B7355">🐾 Pfoten-Plan</div>
    <h1 style="font-size:23px;font-weight:800;margin:14px 0 10px">Dein Notfall-Grundkommando-Plan für ${dog} ist da! 🎯</h1>
    <p style="font-size:15px;line-height:1.6;color:#42413f">Hallo,<br><br>im Anhang findest du deinen persönlichen Plan für <b>${dog}</b> — Schritt für Schritt: Sitz, Platz, Bleib &amp; Hier so aufgebaut, dass sie auch dann sitzen, wo's zählt (Radfahrer, Jogger, andere Hunde, Besuch).</p>
    <ul style="font-size:14px;line-height:1.7;color:#333">
      <li>Jedes Kommando als echtes Tutorial: Vorbereitung, Schritte, „Wenn er nicht mitmacht", realistische Wiederholungen</li>
      <li>Das Alltags-Playbook: welches Kommando in welcher Situation</li>
      <li>7-Tage-Startplan + Erfolgs-Check</li>
    </ul>
    <p style="font-size:14px;line-height:1.6;color:#42413f">Druck es aus oder hab es auf dem Handy dabei. Viel Freude beim Training mit ${dog}! 🐾</p>
    <p style="font-size:12.5px;color:#9aa2ad;margin-top:16px">Fragen? Antworte einfach auf diese Mail.</p>
  </div>`;
}

// POLNISCHE Kunden-Mail (lang="pl")
function customerHtmlPL(dog: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;color:#1a1a1a">
    <div style="text-align:center;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8B7355">🐾 ŁapaPlan</div>
    <h1 style="font-size:23px;font-weight:800;margin:14px 0 10px">Plan podstawowych komend dla ${dog} jest gotowy! 🎯</h1>
    <p style="font-size:15px;line-height:1.6;color:#42413f">Cześć,<br><br>w załączniku znajdziesz osobisty plan dla <b>${dog}</b> — krok po kroku: Siad, Waruj, Zostań i Do mnie tak zbudowane, żeby działały też tam, gdzie to się liczy (rowerzyści, biegacze, inne psy, goście).</p>
    <ul style="font-size:14px;line-height:1.7;color:#333">
      <li>Każda komenda jako prawdziwy samouczek: przygotowanie, kroki, „gdy nie współpracuje", realistyczne powtórzenia</li>
      <li>Poradnik na co dzień: która komenda w jakiej sytuacji</li>
      <li>7-dniowy plan startowy + check sukcesu</li>
    </ul>
    <p style="font-size:14px;line-height:1.6;color:#42413f">Wydrukuj go albo miej pod ręką w telefonie. Powodzenia w treningu z ${dog}! 🐾</p>
    <p style="font-size:12.5px;color:#9aa2ad;margin-top:16px">Masz pytania? Po prostu odpowiedz na tego maila.</p>
  </div>`;
}

export async function deliverGrundkommandosForLead(
  leadId: string,
  opts: { force?: boolean } = {}
): Promise<{ ok: boolean; reason?: string; pages?: number }> {
  if (!BREVO_API_KEY) return { ok: false, reason: "brevo_key_missing" };

  const { data: lead } = await supabase
    .from("wauwerk_leads")
    .select("email,dog_name,answers")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead?.email) return { ok: false, reason: "lead_or_email_missing" };

  const a: any = lead.answers || {};
  if (a.grundkommandos_sent_at && !opts.force) return { ok: true, reason: "already_sent" };

  // Generating-Claim: verhindert, dass Sofort-Anstoss (after()) UND Cron denselben
  // Lead gleichzeitig generieren (Doppel-Mail). Ein Claim <8 Min alt bedeutet: ein
  // anderer Lauf ist gerade dran -> ueberlassen. Aelter = vorheriger Lauf gestorben
  // -> neu generieren. force ueberspringt den Claim (manueller Nachschub).
  const CLAIM_MS = 8 * 60 * 1000;
  if (!opts.force) {
    const claimAt = a.grundkommandos_generating_at
      ? Date.parse(a.grundkommandos_generating_at)
      : 0;
    if (claimAt && Date.now() - claimAt < CLAIM_MS) {
      return { ok: true, reason: "already_generating" };
    }
    // Claim setzen (frischer Read + Merge, um answers nicht zu clobbern)
    const { data: freshClaim } = await supabase
      .from("wauwerk_leads")
      .select("answers")
      .eq("id", leadId)
      .maybeSingle();
    const claimAnswers = (freshClaim?.answers as any) || a;
    const freshClaimAt = claimAnswers.grundkommandos_generating_at
      ? Date.parse(claimAnswers.grundkommandos_generating_at)
      : 0;
    if (
      claimAnswers.grundkommandos_sent_at ||
      (freshClaimAt && Date.now() - freshClaimAt < CLAIM_MS)
    ) {
      return { ok: true, reason: "already_generating" };
    }
    await supabase
      .from("wauwerk_leads")
      .update({
        answers: {
          ...claimAnswers,
          grundkommandos_generating_at: new Date().toISOString(),
        },
      })
      .eq("id", leadId);
  }

  // Sprach-Weiche: PL -> polnischer Opus-Prompt + Unicode-PDF (Arimo) + polnische
  // Mail. Dynamische Imports, damit der deutsche Pfad byte-identisch bleibt.
  const isPL = String((a as any).lang || "").toLowerCase() === "pl";
  const { generateGrundkommandosContent, knownLabelsFromDogCommands } = isPL
    ? await import("./grundkommandos-content.pl")
    : await import("./grundkommandos-content");
  const { buildGrundkommandosPDF } = isPL
    ? await import("./grundkommandos-pdf.pl")
    : await import("./grundkommandos-pdf");

  const dog = (lead.dog_name || a.dog_name || (isPL ? "Twój pies" : "dein Hund")).toString();
  const breed = a.dog_breed ? String(a.dog_breed) : null;
  const problem = a.dog_problem || a.custom_problem_text || (isPL ? "niepewność" : "Unsicherheit");
  const known = knownLabelsFromDogCommands(a.dog_commands);

  // 1) Content generieren (Opus, ~2-3 Min)
  const content = await generateGrundkommandosContent({
    dogName: dog,
    breed,
    problem,
    knownCommands: known,
  });

  // 2) PDF bauen (pdf-lib)
  const pdfBytes = await buildGrundkommandosPDF(content, { breed });
  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

  // 3) Brevo-Mail mit Anhang
  const fileName = isPL
    ? `Plan-komend-${dog.replace(/[^a-zA-Z0-9]/g, "")}.pdf`
    : `Notfall-Grundkommando-Plan-${dog.replace(/[^a-zA-Z0-9]/g, "")}.pdf`;
  const subject = isPL
    ? `🎯 Plan podstawowych komend dla ${dog}`
    : `🎯 Dein Notfall-Grundkommando-Plan für ${dog}`;
  const html = isPL ? customerHtmlPL(dog) : customerHtml(dog);

  // Bezahlte Auslieferung: DE primär über Google Workspace SMTP, Brevo Fallback.
  let sentVia: "google" | "brevo" | null = null;
  if (!isPL) {
    try {
      const { googleSmtpConfigured, sendViaGoogleSmtp } = await import(
        "./google-smtp"
      );
      if (googleSmtpConfigured()) {
        await sendViaGoogleSmtp({
          to: lead.email,
          subject,
          html,
          cc: "kontakt@primesocial.de",
          attachments: [{ name: fileName, contentBase64: pdfBase64 }],
        });
        sentVia = "google";
      }
    } catch (e: any) {
      console.error(
        "[grundkommandos-deliver] Google-SMTP fehlgeschlagen → Fallback Brevo:",
        e?.message
      );
    }
  }

  if (!sentVia) {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: isPL
          ? { name: "ŁapaPlan", email: "support@pfoten-plan.de" }
          : { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
        to: [{ email: lead.email }],
        cc: [{ email: "kontakt@primesocial.de" }],
        subject,
        htmlContent: html,
        attachment: [{ name: fileName, content: pdfBase64 }],
      }),
    });
    if (!r.ok) {
      return { ok: false, reason: `brevo_${r.status}: ${(await r.text()).slice(0, 160)}` };
    }
  }

  // 4) Idempotenz-Marker (frischer Read + Merge, um answers nicht zu clobbern)
  const { data: fresh } = await supabase.from("wauwerk_leads").select("answers").eq("id", leadId).maybeSingle();
  const merged = {
    ...((fresh?.answers as any) || a),
    grundkommandos_sent_at: new Date().toISOString(),
  };
  await supabase.from("wauwerk_leads").update({ answers: merged }).eq("id", leadId);

  return { ok: true, pages: (content.sections || []).length };
}
