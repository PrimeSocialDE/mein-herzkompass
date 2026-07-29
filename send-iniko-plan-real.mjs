// Echte Plan-Ready-Mail an egloffdaniela@gmail.com:
// 1) Patched plan_content (mit den neuen AI-Texten) in DB schreiben
// 2) PDF lokal rendern mit dem aktuellen Generator-Code
// 3) Mail mit der echten sendPlanReadyEmail-Vorlage + PDF an die Kundin schicken,
//    CC an kontakt@primesocial.de wie der Production-Flow.

import { readFileSync, writeFileSync } from "node:fs";

try {
  const envText = readFileSync("/Users/maxxx/Documents/nextjs-boilerplate-main/.env.local", "utf8");
  const envMatches = [...envText.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)];
  for (const m of envMatches) if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
} catch {}

const BREVO_KEY = process.env.BREVO_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pfoten-plan.de";
if (!BREVO_KEY) { console.error("BREVO_API_KEY fehlt"); process.exit(1); }

const CUSTOMER_EMAIL = "egloffdaniela@gmail.com";
const CC = "kontakt@primesocial.de";
const PLAN_LENGTH = 6;
const monthsLabel = "6-Monats-Plan";

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 1) Plan-Content aus /tmp laden ────────────────────────────
const patchedContent = JSON.parse(readFileSync("/tmp/iniko-plan-patched.json", "utf8"));
console.log(`Patched plan: ${patchedContent.weeks?.length} weeks, intro chars=${patchedContent.intro?.einleitung?.length}, ziele chars=${patchedContent.intro?.ziele?.length}, abschluss chars=${patchedContent.abschluss?.length}`);

// ── 2) Lead-Daten holen ────────────────────────────────────────
const { data: lead } = await sb
  .from("wauwerk_leads")
  .select("dog_name,customer_name,answers")
  .eq("email", CUSTOMER_EMAIL)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

const dogName = patchedContent.intro?.headline ? "Iniko" : (lead?.dog_name || "Iniko");
const answers = lead?.answers || {};
const dogBreed = answers.dog_breed || "Australien Shepherd";
const customerName = lead?.customer_name;

// ── 3) Plan-Content in DB updaten (juengster Eintrag) ─────────
const { data: latestRow } = await sb
  .from("member_plan_content")
  .select("id,created_at")
  .eq("email", CUSTOMER_EMAIL)
  .eq("plan_slug", "trainingsplan")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (!latestRow) { console.error("Kein plan_content gefunden — abbruch"); process.exit(1); }
console.log(`Update plan_content row ${latestRow.id} (${latestRow.created_at})`);

const { error: updErr } = await sb
  .from("member_plan_content")
  .update({ content: patchedContent })
  .eq("id", latestRow.id);
if (updErr) { console.error("DB-Update fehlgeschlagen:", updErr.message); process.exit(1); }
console.log("✓ plan_content in DB aktualisiert.");

// ── 4) PDF rendern ─────────────────────────────────────────────
const { buildPdfFromContent } = await import("./generate-plan-from-content.mjs");
const pdfBytes = await buildPdfFromContent({
  plan: patchedContent,
  dogName,
  dogBreed,
  mainProblem: "Aggression / Reaktivitaet",
  planLengthMonths: PLAN_LENGTH,
  verbose: false,
});
const PDF_PATH = "/Users/maxxx/Documents/nextjs-boilerplate-main/public/monatsplan-personalisiert-TEST.pdf";
writeFileSync(PDF_PATH, pdfBytes);
console.log(`PDF gerendert: ${(pdfBytes.length / 1024).toFixed(0)} KB`);

// ── 5) Mail-Template (replicate von sendPlanReadyEmail) ────────
function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
const weeksTotal = patchedContent.weeks.length;
const greeting = customerName?.trim() ? `Hi ${customerName.trim().split(" ")[0]},` : "Hi,";
const ctaUrl = `${SITE_URL}/mitglieder/erfolge/coaching`;

const pdfHinweis = `
  <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:14px;padding:18px 20px;margin:0 0 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="vertical-align:middle;width:54px;">
          <div style="display:inline-block;width:48px;height:48px;background:#C4A576;border-radius:12px;text-align:center;line-height:48px;font-size:22px;color:#FFFFFF;">📄</div>
        </td>
        <td style="vertical-align:middle;padding-left:14px;">
          <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;line-height:1.3;">Dein Trainings-Plan als PDF</p>
          <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.4;">Im Anhang dieser Mail · druckbar · für unterwegs</p>
        </td>
      </tr>
    </table>
  </div>`;

const mitgliederShowcase = `
  <div style="border-top:1px solid #F0EBE3;margin:24px 0 16px;"></div>
  <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">Du bekommst noch mehr</p>
  <h2 style="margin:0 0 10px;font-size:20px;line-height:1.3;font-weight:800;color:#1a1a1a;">Dein Mitglieder-Bereich</h2>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4B5563;">
    Den Plan kannst du jederzeit auch online durchgehen. Wir tracken automatisch deinen Fortschritt, ${escapeHtml(dogName)}s Stimmung und schicken dir jede Woche neue Aufgaben, damit du nicht alleine durch den Plan musst.
  </p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="padding:10px 0;border-bottom:1px solid #F5F1E8;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td style="vertical-align:top;width:34px;font-size:18px;">📅</td>
        <td style="vertical-align:top;padding-left:6px;">
          <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">Plan-Begleitung Woche für Woche</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Welche Woche ist gerade dran, was kommt als Nächstes, auf einen Blick.</p>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #F5F1E8;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td style="vertical-align:top;width:34px;font-size:18px;">📊</td>
        <td style="vertical-align:top;padding-left:6px;">
          <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">Stimmungs-Tagebuch mit KI-Analyse</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Trag wöchentlich kurz ein wie's lief, die KI fasst eure Woche zusammen und gibt konkrete Tipps für die nächste.</p>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #F5F1E8;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td style="vertical-align:top;width:34px;font-size:18px;">🏆</td>
        <td style="vertical-align:top;padding-left:6px;">
          <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">Wochen-Aufgaben &amp; Abzeichen</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Jede Woche kleine Trainings-Aufgaben passend zu eurem Plan. Geschafft, Abzeichen für die Sammlung.</p>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #F5F1E8;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td style="vertical-align:top;width:34px;font-size:18px;">💬</td>
        <td style="vertical-align:top;padding-left:6px;">
          <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">KI-Trainer für Rückfragen</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Stell jederzeit Fragen, der KI-Trainer antwortet rund um die Uhr mit dem Wissen unseres Hundetrainer-Teams.</p>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:10px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td style="vertical-align:top;width:34px;font-size:18px;">📚</td>
        <td style="vertical-align:top;padding-left:6px;">
          <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;">Spezial-Module</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#6B7280;">Wenn ${escapeHtml(dogName)} weitere Themen hat, z.B. Trennungsangst, Reise, Erste-Hilfe, gibt's gezielte Module dazu.</p>
        </td>
      </tr></table>
    </td></tr>
  </table>`;

const headline = `Dein ${monthsLabel} für ${dogName} ist fertig`;
const intro = `${greeting} dein persönlicher Trainings-Plan ist soeben für dich erstellt worden, komplett zugeschnitten auf ${dogName} und euer Haupt-Thema. ${weeksTotal} Wochen, mit konkreten Übungen für jeden Tag, Wochenzielen, Fortschritts-Markern und einem klaren roten Faden.`;
const footerHint = `Logg dich im Mitglieder-Bereich ein, um deinen Plan online zu sehen, das Tagebuch zu nutzen und Fragen an den KI-Trainer zu stellen.`;
const preheader = `Dein ${monthsLabel} für ${dogName} ist fertig.`;

const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>${headline}</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<span style="display:none;font-size:1px;color:#FAF8F5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:24px 28px 8px;border-bottom:1px solid #F0EBE3;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B7355;">Pfoten-Plan</p>
      </td></tr>
      <tr><td style="padding:28px 28px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;font-weight:800;color:#1a1a1a;">${headline}</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#4B5563;">${intro}</p>
        ${pdfHinweis}${mitgliederShowcase}
      </td></tr>
      <tr><td align="center" style="padding:8px 28px 28px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#C4A576;color:#FFFFFF;font-weight:700;font-size:14px;padding:14px 26px;border-radius:12px;text-decoration:none;box-shadow:0 2px 8px rgba(196,165,118,0.3);">Mitglieder-Bereich öffnen →</a>
      </td></tr>
      <tr><td style="padding:0 28px 24px;"><p style="margin:0;font-size:12px;line-height:1.5;color:#9CA3AF;text-align:center;">${footerHint}</p></td></tr>
      <tr><td style="padding:16px 28px;background:#FAFAFA;border-top:1px solid #F0EBE3;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#9CA3AF;text-align:center;">
          Pfoten-Plan · Persönliches Hundetraining · <a href="${SITE_URL}/mitglieder" style="color:#8B7355;text-decoration:underline;">Mein Bereich</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;

const filenameSafe = dogName.replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, "");
const filename = `Pfoten-Plan-${filenameSafe}-${PLAN_LENGTH}M.pdf`;

const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
    replyTo: { email: "support@pfoten-plan.de", name: "Pfoten-Plan Support" },
    to: [{ email: CUSTOMER_EMAIL }],
    cc: [{ email: CC }],
    subject: `🐾 Dein ${monthsLabel} für ${dogName} ist da`,
    htmlContent: html,
    tags: ["mitglieder", "plan-ready"],
    attachment: [{ name: filename, content: Buffer.from(pdfBytes).toString("base64") }],
  }),
});
console.log(`Brevo: HTTP ${brevoRes.status}`);
console.log(await brevoRes.text());
if (!brevoRes.ok) process.exit(1);
console.log(`\n✓ Plan-Ready-Mail an ${CUSTOMER_EMAIL} raus (CC ${CC}).`);
