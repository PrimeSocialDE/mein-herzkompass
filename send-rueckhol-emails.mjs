// send-rueckhol-emails.mjs
// Re-Engagement-Mails an Leads mit status='checkout_started' der letzten 30 Tage.
//
// Aufbau psychologisch:
//   1. Persönliche Anrede mit Hundenamen
//   2. Konkreter Wert ZUERST (eine Trainings-Übung) — kein Sales-Pitch
//   3. Erst am Ende: dezenter CTA "Wenn das geholfen hat, gibt's mehr im vollen Plan"
//
// Anti-Spam:
//   - 3 Subject-Varianten rotieren
//   - ~5–10s zufälliger Delay zwischen Mails
//   - Idempotenz via answers.rueckhol_mail_sent_at
//   - Default: TEST-MODE → eine Mail an max@primesocial.de mit Daten eines echten Leads
//
// Usage:
//   node --env-file=.env.local send-rueckhol-emails.mjs                  # Test (1 Mail an max@primesocial.de)
//   node --env-file=.env.local send-rueckhol-emails.mjs --dry-run        # zeigt Liste, sendet nix
//   node --env-file=.env.local send-rueckhol-emails.mjs --live           # echter Versand, default limit 150
//   node --env-file=.env.local send-rueckhol-emails.mjs --live --limit 50

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !BREVO_API_KEY) {
  console.error("❌ ENV fehlt: SUPABASE_URL / SUPABASE_SERVICE_ROLE / BREVO_API_KEY");
  process.exit(1);
}

// ─── CLI Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isLive = args.includes("--live");
const isDryRun = args.includes("--dry-run");
const isTest = !isLive && !isDryRun;
const limitArg = args.indexOf("--limit");
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1] || "150", 10) : 150;
const TEST_RECIPIENT = "max@primesocial.de";

console.log("─────────────────────────────────────────");
console.log(`Mode:  ${isTest ? "🧪 TEST (1 Mail an " + TEST_RECIPIENT + ")" : isDryRun ? "👀 DRY-RUN (zeigt Liste)" : "🚀 LIVE (echter Versand)"}`);
console.log(`Limit: ${limit}`);
console.log("─────────────────────────────────────────\n");

// ─── Subject-Varianten (Hundename wird interpoliert) ─────────────────────────
const SUBJECTS = [
  "Eine kleine Übung für {{dog}}",
  "Für {{dog}}: das machen wir oft zuerst",
  "Wie läuft's bei {{dog}}?",
];

// ─── Brand Colors ────────────────────────────────────────────────────────────
const brown = "#C4A576";
const brownDark = "#8B7355";
const brownLight = "#FFF9F0";
const textDark = "#1a1a1a";
const textMed = "#555";
const textLight = "#888";

// ─── HTML Template (psychologisch: Wert zuerst, Sales am Ende) ───────────────
function buildHtml({ dogName, leadId, email, problem }) {
  const dog = dogName || "deinen Hund";
  const rueckholUrl =
    `https://www.pfoten-plan.de/rueckhol.html?email=${encodeURIComponent(email)}` +
    `&utm_source=brevo&utm_medium=email&utm_campaign=rueckhol_30d`;
  const unsubscribeUrl = `https://www.pfoten-plan.de/unsubscribe?email=${encodeURIComponent(email)}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Eine Übung für ${dog}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

<div style="max-width:560px;margin:0 auto;background:white;">

  <!-- Header -->
  <div style="padding:24px 30px;border-bottom:1px solid #f0f0f0;text-align:center;">
    <div style="font-size:18px;font-weight:800;color:${brown};letter-spacing:-0.3px;">Pfoten-Plan</div>
  </div>

  <!-- Hero -->
  <div style="padding:36px 30px 18px;">
    <p style="font-size:13px;color:${textLight};margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Für ${dog}</p>
    <h1 style="font-size:26px;font-weight:800;color:${textDark};line-height:1.3;margin:0 0 18px;letter-spacing:-0.4px;">Eine Übung, die du heute mit ${dog} machen kannst.</h1>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0 0 12px;">Hallo,</p>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0;">du hast vor Kurzem den Plan für <strong>${dog}</strong> angeschaut – und vermutlich aus tausend guten Gründen war gerade andere Priorität.</p>
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:14px 0 0;">Damit du trotzdem etwas davon hast, schicken wir dir eine kleine Übung, die wir bei <em>fast jedem</em> Hund zuerst machen – egal mit welchem Thema. Probier sie aus, sie kostet dich 5 Minuten.</p>
  </div>

  <!-- Übung Box -->
  <div style="padding:0 30px 30px;">
    <div style="background:${brownLight};border-radius:14px;padding:24px 26px;border-left:4px solid ${brown};">
      <p style="font-size:12px;color:${brownDark};margin:0 0 8px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Übung Nr. 1 · 5 Min</p>
      <h2 style="font-size:20px;font-weight:800;color:${textDark};margin:0 0 18px;line-height:1.3;">Der ruhige Blickkontakt</h2>

      <p style="font-size:14px;color:${textMed};line-height:1.7;margin:0 0 14px;">Warum diese Übung? Aufmerksamkeit ist die Basis für <em>alles</em> Andere. Ein Hund, der dich freiwillig anschaut wenn er aufgeregt ist, ist ein Hund, der hörbereit ist.</p>

      <div style="margin:16px 0 0;">
        <p style="font-size:14px;color:${textDark};line-height:1.7;margin:0 0 10px;"><strong>1.</strong> Setz dich ruhig hin. ${dog} sitzt oder steht vor dir.</p>
        <p style="font-size:14px;color:${textDark};line-height:1.7;margin:0 0 10px;"><strong>2.</strong> Halte ein kleines Leckerli zwischen deinen Fingern, ungefähr auf Brusthöhe. <em>Sag nichts.</em></p>
        <p style="font-size:14px;color:${textDark};line-height:1.7;margin:0 0 10px;"><strong>3.</strong> Warte. ${dog} wird das Leckerli zuerst anstarren. Dann irgendwann ratlos werden – und kurz zu dir hochschauen.</p>
        <p style="font-size:14px;color:${textDark};line-height:1.7;margin:0 0 10px;"><strong>4.</strong> Genau in der Sekunde, in der euer Blick sich trifft: ruhig „Fein" sagen und sofort das Leckerli geben.</p>
        <p style="font-size:14px;color:${textDark};line-height:1.7;margin:0 0 0;"><strong>5.</strong> Wiederhole 5–8 Mal. Mehr nicht. Schluss machen, solange es Spaß macht.</p>
      </div>

      <p style="font-size:13px;color:${textLight};line-height:1.6;margin:18px 0 0;font-style:italic;">Tipp: Mach diese Übung 3 Tage in Folge. Du wirst merken, dass ${dog} dich danach in Alltagssituationen viel öfter „abcheckt" – und das ist der Moment, in dem Training überhaupt erst funktioniert.</p>
    </div>
  </div>

  <!-- Soft Bridge -->
  <div style="padding:0 30px 24px;">
    <p style="font-size:15px;color:${textMed};line-height:1.7;margin:0;">Wenn dir die Übung etwas gebracht hat – im vollen Pfoten-Plan haben wir <strong>noch über 30 davon</strong>, gezielt auf das Thema von ${dog} zugeschnitten (Bellen, Ziehen, Trennungsangst, Rückruf, was bei dir gerade dran ist).</p>
  </div>

  <!-- CTA Button -->
  <div style="padding:0 30px 36px;text-align:center;">
    <a href="${rueckholUrl}" style="display:inline-block;background:${brown};color:white;text-decoration:none;padding:16px 32px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.2px;box-shadow:0 4px 12px rgba(196,165,118,0.25);">
      Plan für ${dog} ansehen →
    </a>
    <p style="font-size:12px;color:${textLight};margin:14px 0 0;">Deine Daten sind noch gespeichert – kein neues Quiz nötig.</p>
  </div>

  <!-- Footer -->
  <div style="padding:24px 30px;border-top:1px solid #f0f0f0;text-align:center;background:#fafafa;">
    <p style="font-size:12px;color:${textLight};margin:0 0 8px;">Pfoten-Plan · Dein Trainings-Begleiter</p>
    <p style="font-size:11px;color:${textLight};margin:0;">
      <a href="${unsubscribeUrl}" style="color:${textLight};text-decoration:underline;">Diese Mails abbestellen</a>
    </p>
  </div>

</div>

</body>
</html>`;
}

function buildPlainText({ dogName, email }) {
  const dog = dogName || "deinen Hund";
  const rueckholUrl =
    `https://www.pfoten-plan.de/rueckhol.html?email=${encodeURIComponent(email)}` +
    `&utm_source=brevo&utm_medium=email&utm_campaign=rueckhol_30d`;
  const unsubscribeUrl = `https://www.pfoten-plan.de/unsubscribe?email=${encodeURIComponent(email)}`;

  return `Hallo,

du hast vor Kurzem den Pfoten-Plan für ${dog} angeschaut. Damit du trotzdem etwas davon hast, schicken wir dir eine kleine Übung, die wir bei fast jedem Hund zuerst machen.

DER RUHIGE BLICKKONTAKT (5 Min)

Warum: Aufmerksamkeit ist die Basis für alles Andere. Ein Hund, der dich freiwillig anschaut wenn er aufgeregt ist, ist hörbereit.

1. Setz dich ruhig hin. ${dog} sitzt oder steht vor dir.
2. Halte ein kleines Leckerli zwischen deinen Fingern auf Brusthöhe. Sag nichts.
3. Warte. ${dog} wird das Leckerli anstarren, dann ratlos werden – und kurz zu dir hochschauen.
4. Genau in der Sekunde, in der euer Blick sich trifft: ruhig "Fein" sagen, sofort das Leckerli geben.
5. Wiederhole 5–8 Mal. Mehr nicht.

Tipp: Mach das 3 Tage in Folge. Du wirst merken, dass ${dog} dich im Alltag öfter "abcheckt" – das ist der Moment, in dem Training überhaupt erst funktioniert.

Wenn dir die Übung was gebracht hat – im vollen Pfoten-Plan haben wir über 30 davon, gezielt auf das Thema von ${dog} zugeschnitten:
${rueckholUrl}

Deine Daten sind noch gespeichert – kein neues Quiz nötig.

—
Pfoten-Plan
Mails abbestellen: ${unsubscribeUrl}
`;
}

// ─── Supabase Query ──────────────────────────────────────────────────────────
async function fetchLeads() {
  const sinceISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  // Filter: status=checkout_started, last 30 days, email != null, noch keine rueckhol-mail gesendet, mind. 24h alt
  const max24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const url =
    `${SUPABASE_URL}/rest/v1/wauwerk_leads` +
    `?status=eq.checkout_started` +
    `&created_at=gte.${sinceISO}` +
    `&created_at=lte.${max24hAgo}` +
    `&email=not.is.null` +
    `&email=neq.` +
    `&select=id,email,dog_name,answers,created_at` +
    `&order=created_at.desc`;

  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  }
  const all = await res.json();

  // Idempotenz-Filter clientseitig (answers JSONB)
  return all.filter(
    (l) => !l.answers || !l.answers.rueckhol_mail_sent_at
  );
}

// ─── Brevo Send ──────────────────────────────────────────────────────────────
async function sendBrevo({ to, subject, html, text }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
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
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Brevo send failed: ${res.status} ${errText}`);
  }
  return res.json();
}

// ─── Mark sent in Supabase ───────────────────────────────────────────────────
async function markSent(leadId, currentAnswers) {
  const newAnswers = {
    ...(currentAnswers || {}),
    rueckhol_mail_sent_at: new Date().toISOString(),
  };
  const url = `${SUPABASE_URL}/rest/v1/wauwerk_leads?id=eq.${leadId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ answers: newAnswers }),
  });
  if (!res.ok) {
    console.warn(`⚠️ markSent failed für ${leadId}: ${res.status}`);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pickSubject(dogName, idx) {
  const tpl = SUBJECTS[idx % SUBJECTS.length];
  return tpl.replace("{{dog}}", dogName || "deinen Hund");
}
function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function randomDelay() {
  // 5-10 Sekunden, leicht zufällig — wirkt "menschlich" für Spam-Filter
  return 5000 + Math.floor(Math.random() * 5000);
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const leads = await fetchLeads();
  console.log(`📊 Eligible Leads (mit Email, ohne vorherige Mail, >24h alt): ${leads.length}\n`);

  if (leads.length === 0) {
    console.log("Keine eligible Leads gefunden. Ende.");
    return;
  }

  // ─── TEST-MODE: 1 Mail an max@primesocial.de mit Daten eines echten Leads ─
  if (isTest) {
    const sampleLead = leads[0];
    const dogName = sampleLead.dog_name || "Bello";
    console.log(`🧪 Test-Mail wird gebaut basierend auf Lead ${sampleLead.id} (Hund: ${dogName})`);
    console.log(`   Button-URL nutzt echte Lead-Email ${sampleLead.email} damit rueckhol.html den Lead findet`);
    const subject = `[TEST] ${pickSubject(dogName, 0)}`;
    // Mail geht an TEST_RECIPIENT, aber Link enthält echte Lead-Email →
    // so kann End-to-End getestet werden ob rueckhol.html die Daten korrekt lädt.
    const html = buildHtml({
      dogName,
      leadId: sampleLead.id,
      email: sampleLead.email,
    });
    const text = buildPlainText({ dogName, email: sampleLead.email });

    console.log(`📤 Sende an ${TEST_RECIPIENT} ...`);
    try {
      const result = await sendBrevo({ to: TEST_RECIPIENT, subject, html, text });
      console.log(`✅ Gesendet — Brevo messageId: ${result.messageId || "?"}`);
      console.log(`\nWenn Mail OK aussieht: \`node --env-file=.env.local send-rueckhol-emails.mjs --live --limit 150\``);
    } catch (e) {
      console.error(`❌ Fehler: ${e.message}`);
      process.exit(1);
    }
    return;
  }

  // ─── DRY-RUN: nur Liste zeigen ───────────────────────────────────────────
  if (isDryRun) {
    console.log(`📋 Würde an folgende ${Math.min(leads.length, limit)} Leads senden:`);
    leads.slice(0, limit).forEach((l, i) => {
      console.log(`  ${i + 1}. ${l.email} (${l.dog_name || "—"}) created=${l.created_at?.slice(0, 10)}`);
    });
    return;
  }

  // ─── LIVE: echter Versand mit Throttle + Idempotenz ──────────────────────
  const toSend = leads.slice(0, limit);
  console.log(`🚀 Sende ${toSend.length} Mails (mit 5–10s Delay zwischen Mails)...\n`);
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < toSend.length; i++) {
    const lead = toSend[i];
    const dogName = lead.dog_name;
    const subject = pickSubject(dogName, i);
    const html = buildHtml({
      dogName,
      leadId: lead.id,
      email: lead.email,
    });
    const text = buildPlainText({ dogName, email: lead.email });

    process.stdout.write(`[${i + 1}/${toSend.length}] ${lead.email} (${dogName || "—"}) ... `);
    try {
      await sendBrevo({ to: lead.email, subject, html, text });
      await markSent(lead.id, lead.answers);
      console.log("✓");
      ok++;
    } catch (e) {
      console.log(`✗ ${e.message}`);
      fail++;
    }

    if (i < toSend.length - 1) {
      await sleepMs(randomDelay());
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`✅ Gesendet: ${ok} | ❌ Fehler: ${fail}`);
  console.log(`─────────────────────────────────────────`);
})();
