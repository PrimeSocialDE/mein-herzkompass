// send-referral-emails.mjs
// Referral-Einladungs-Mails an paid Leads.
// Jeder Lead bekommt einen eindeutigen referral_code zugewiesen (falls noch keiner)
// und einen persönlichen Link, den er an Freunde schicken kann.
//
// Reward-Mechanismus:
//   1. Empfehler bekommt Mail mit Link: pfoten-plan.de?ref=PFOTE-XXXXXX
//   2. Freund klickt → kauft Plan → Mollie-Webhook erkennt referred_by_code
//   3. Empfehler bekommt automatisch Coupon-Mail mit GRATIS-XXXX-XXXX
//   4. Empfehler löst im modul-shop ein → 1 Modul gratis (€19,99 Wert)
//
// Anti-Spam:
//   - 3 Subject-Varianten rotieren
//   - 5-10s Delay zwischen Mails
//   - Idempotenz via answers.referral_invite_sent_at
//
// Usage:
//   node --env-file=.env.local send-referral-emails.mjs                  # Test
//   node --env-file=.env.local send-referral-emails.mjs --dry-run        # nur Liste
//   node --env-file=.env.local send-referral-emails.mjs --live           # Default: 150
//   node --env-file=.env.local send-referral-emails.mjs --live --limit 50

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !BREVO_API_KEY) {
  console.error("❌ ENV fehlt: SUPABASE_URL / SUPABASE_SERVICE_ROLE / BREVO_API_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const isLive = args.includes("--live");
const isDryRun = args.includes("--dry-run");
const isTest = !isLive && !isDryRun;
const limitArg = args.indexOf("--limit");
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1] || "150", 10) : 150;
const TEST_RECIPIENT = "max@primesocial.de";

console.log("─────────────────────────────────────────");
console.log(`Mode:  ${isTest ? "🧪 TEST (1 Mail an " + TEST_RECIPIENT + ")" : isDryRun ? "👀 DRY-RUN" : "🚀 LIVE"}`);
console.log(`Limit: ${limit}`);
console.log("─────────────────────────────────────────\n");

// ─── Code-Generation (mirror of lib/referral.ts) ────────────────────────────
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateReferralCode() {
  let suffix = "";
  for (let i = 0; i < 6; i++)
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `PFOTE-${suffix}`;
}

const SUBJECTS = [
  "Empfiehl Pfoten-Plan weiter — 1 Modul gratis für dich",
  "{{dog}}s Freunde könnten auch profitieren",
  "Dankeschön: 1 Bonus-Modul für jede Empfehlung",
];

const brown = "#C4A576";
const brownDark = "#8B7355";
const brownLight = "#FFF9F0";
const textDark = "#1a1a1a";
const textMed = "#555";
const textLight = "#888";

function buildHtml({ dogName, referralCode, email }) {
  const dog = dogName || "deinen Hund";
  const link = `https://www.pfoten-plan.de/?ref=${encodeURIComponent(referralCode)}`;
  const unsubscribeUrl = `https://www.pfoten-plan.de/unsubscribe?email=${encodeURIComponent(email)}`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;background:white;">

  <div style="padding:24px 30px;border-bottom:1px solid #f0f0f0;text-align:center;">
    <div style="font-size:18px;font-weight:800;color:${brown};">Pfoten-Plan</div>
  </div>

  <div style="padding:36px 30px 18px;">
    <p style="font-size:13px;color:${textLight};margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Für dich & ${dog}</p>
    <h1 style="font-size:26px;font-weight:800;color:${textDark};line-height:1.3;margin:0 0 18px;">Empfiehl Pfoten-Plan weiter — und bekomm ein Modul gratis.</h1>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0 0 12px;">Hallo,</p>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0;">du trainierst mit ${dog}. Und du kennst bestimmt andere Hundebesitzer, die mit Bellen, Ziehen oder Trennungsangst kämpfen — so wie ihr es vor dem Plan getan habt.</p>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:14px 0 0;">Wenn du Pfoten-Plan an einen Freund weiterempfiehlst und der einen Plan kauft, schenken wir dir <strong>1 Bonus-Modul deiner Wahl gratis</strong> (Wert €19,99). Bellen, Rückruf, Trennungsangst, was bei dir gerade dran ist.</p>
  </div>

  <div style="padding:0 30px 24px;">
    <div style="background:${brownLight};border-radius:14px;padding:24px;text-align:center;">
      <p style="font-size:12px;color:${brownDark};margin:0 0 10px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Dein persönlicher Empfehlungslink</p>
      <p style="font-size:14px;color:${textDark};font-family:monospace;margin:0 0 16px;word-break:break-all;background:white;padding:10px 14px;border-radius:8px;border:1px solid #eaddc5;">${link}</p>
      <a href="${link}" style="display:inline-block;background:${brown};color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:700;">Link teilen →</a>
    </div>
  </div>

  <div style="padding:0 30px 28px;">
    <p style="font-size:13px;color:${textLight};line-height:1.6;margin:0;">So einfach: Schick den Link einfach per WhatsApp, SMS oder Mail. Sobald jemand über deinen Link kauft, bekommst du automatisch eine Mail mit deinem Gratis-Code.</p>
  </div>

  <div style="padding:24px 30px;border-top:1px solid #f0f0f0;text-align:center;background:#fafafa;">
    <p style="font-size:12px;color:${textLight};margin:0 0 8px;">Pfoten-Plan · Dein Trainings-Begleiter</p>
    <p style="font-size:11px;color:${textLight};margin:0;">
      <a href="${unsubscribeUrl}" style="color:${textLight};text-decoration:underline;">Diese Mails abbestellen</a>
    </p>
  </div>

</div>
</body></html>`;
}

function buildPlainText({ dogName, referralCode, email }) {
  const dog = dogName || "deinen Hund";
  const link = `https://www.pfoten-plan.de/?ref=${encodeURIComponent(referralCode)}`;
  const unsubscribeUrl = `https://www.pfoten-plan.de/unsubscribe?email=${encodeURIComponent(email)}`;
  return `Hallo,

du trainierst mit ${dog} — und kennst bestimmt andere Hundebesitzer, die mit Bellen, Ziehen oder Trennungsangst kämpfen.

Wenn du Pfoten-Plan an einen Freund weiterempfiehlst und der einen Plan kauft, schenken wir dir 1 Bonus-Modul deiner Wahl GRATIS (Wert €19,99).

DEIN PERSÖNLICHER EMPFEHLUNGSLINK:
${link}

Schick den Link einfach per WhatsApp, SMS oder Mail. Sobald jemand über deinen Link kauft, bekommst du automatisch eine Mail mit deinem Gratis-Code, den du im Modul-Shop einlösen kannst.

—
Pfoten-Plan
Mails abbestellen: ${unsubscribeUrl}
`;
}

// ─── Supabase ────────────────────────────────────────────────────────────────
async function fetchPaidLeads() {
  const sinceISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const url =
    `${SUPABASE_URL}/rest/v1/wauwerk_leads` +
    `?status=eq.paid` +
    `&created_at=gte.${sinceISO}` +
    `&email=not.is.null&email=neq.` +
    `&select=id,email,dog_name,referral_code,answers,created_at` +
    `&order=created_at.desc`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  const all = await res.json();
  // Idempotenz: keine, denen wir schon Referral-Mail geschickt haben
  return all.filter((l) => !l.answers || !l.answers.referral_invite_sent_at);
}

async function ensureReferralCode(lead) {
  if (lead.referral_code) return lead.referral_code;
  // Generieren + speichern (mit Retry bei Kollision)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/wauwerk_leads?id=eq.${lead.id}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ referral_code: code }),
    });
    if (res.ok) return code;
    const txt = await res.text();
    if (txt.toLowerCase().includes("duplicate")) continue;
    throw new Error(`PATCH failed: ${res.status} ${txt}`);
  }
  throw new Error("Konnte nach 5 Versuchen keinen unique referral_code generieren");
}

async function markInviteSent(leadId, currentAnswers) {
  const newAnswers = {
    ...(currentAnswers || {}),
    referral_invite_sent_at: new Date().toISOString(),
  };
  await fetch(`${SUPABASE_URL}/rest/v1/wauwerk_leads?id=eq.${leadId}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ answers: newAnswers }),
  });
}

// ─── Brevo ──────────────────────────────────────────────────────────────────
async function sendBrevo({ to, subject, html, text }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
      headers: {
        "List-Unsubscribe": `<https://www.pfoten-plan.de/unsubscribe?email=${encodeURIComponent(to)}>, <mailto:unsubscribe@pfoten-plan.de>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!res.ok) throw new Error(`Brevo send failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function pickSubject(dogName, idx) {
  return SUBJECTS[idx % SUBJECTS.length].replace("{{dog}}", dogName || "deinen Hund");
}
function sleepMs(ms) { return new Promise((r) => setTimeout(r, ms)); }
function randomDelay() { return 5000 + Math.floor(Math.random() * 5000); }

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const leads = await fetchPaidLeads();
  console.log(`📊 Eligible paid Leads (mit Email, ohne vorherige Referral-Mail): ${leads.length}\n`);
  if (leads.length === 0) { console.log("Keine eligible Leads. Ende."); return; }

  if (isTest) {
    const sampleLead = leads[0];
    const dogName = sampleLead.dog_name || "Bello";
    const code = await ensureReferralCode(sampleLead);
    console.log(`🧪 Test mit Lead ${sampleLead.id} (Hund: ${dogName}, Code: ${code})`);
    const subject = `[TEST] ${pickSubject(dogName, 0)}`;
    const html = buildHtml({ dogName, referralCode: code, email: TEST_RECIPIENT });
    const text = buildPlainText({ dogName, referralCode: code, email: TEST_RECIPIENT });
    console.log(`📤 Sende an ${TEST_RECIPIENT} ...`);
    const result = await sendBrevo({ to: TEST_RECIPIENT, subject, html, text });
    console.log(`✅ Gesendet — Brevo messageId: ${result.messageId || "?"}`);
    console.log(`\nNächster Schritt: \`node --env-file=.env.local send-referral-emails.mjs --live --limit 150\``);
    return;
  }

  if (isDryRun) {
    console.log(`📋 Würde an folgende ${Math.min(leads.length, limit)} senden:`);
    leads.slice(0, limit).forEach((l, i) =>
      console.log(`  ${i + 1}. ${l.email} (${l.dog_name || "—"}) ${l.referral_code ? "[Code: " + l.referral_code + "]" : "[neuer Code]"}`)
    );
    return;
  }

  const toSend = leads.slice(0, limit);
  console.log(`🚀 Sende ${toSend.length} Mails (5-10s Delay zwischen Mails)...\n`);
  let ok = 0, fail = 0;
  for (let i = 0; i < toSend.length; i++) {
    const lead = toSend[i];
    process.stdout.write(`[${i + 1}/${toSend.length}] ${lead.email} (${lead.dog_name || "—"}) ... `);
    try {
      const code = await ensureReferralCode(lead);
      const subject = pickSubject(lead.dog_name, i);
      const html = buildHtml({ dogName: lead.dog_name, referralCode: code, email: lead.email });
      const text = buildPlainText({ dogName: lead.dog_name, referralCode: code, email: lead.email });
      await sendBrevo({ to: lead.email, subject, html, text });
      await markInviteSent(lead.id, lead.answers);
      console.log(`✓ (${code})`);
      ok++;
    } catch (e) {
      console.log(`✗ ${e.message}`);
      fail++;
    }
    if (i < toSend.length - 1) await sleepMs(randomDelay());
  }
  console.log(`\n─────────────────────────────────────────`);
  console.log(`✅ Gesendet: ${ok} | ❌ Fehler: ${fail}`);
  console.log(`─────────────────────────────────────────`);
})();
