// Triggert /api/mitglieder/plan/generate fuer einen Test-Account.
// Generiert via Claude einen frischen 1/3/6-Monats-Plan und speichert
// ihn in member_plan_content. Schickt parallel die "Plan ist fertig"-Mail.
//
// Aufruf:
//   node scripts/generate-test-plan.mjs <email>
//   node scripts/generate-test-plan.mjs <email> --force
//   node scripts/generate-test-plan.mjs <email> --months 6 --force
//   node scripts/generate-test-plan.mjs <email> --no-mail
//
// Endpoint streamt NDJSON: jede Zeile ein Event ({event:"ping"/"stage"/"done"}).
// Script liest bis "done" und gibt Status zurueck.

import { readFileSync } from "node:fs";

try {
  const envText = readFileSync(".env.local", "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const email = (process.argv[2] || "").trim().toLowerCase();
const force = process.argv.includes("--force");
const noMail = process.argv.includes("--no-mail");
const monthsIdx = process.argv.indexOf("--months");
const monthsArg =
  monthsIdx >= 0 && process.argv[monthsIdx + 1]
    ? Number(process.argv[monthsIdx + 1])
    : null;
const planLengthMonths =
  monthsArg && [1, 3, 6].includes(monthsArg) ? monthsArg : null;

const baseUrl = (
  process.env.PLAN_GEN_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://www.pfoten-plan.de"
).replace(/\/+$/, "");
const token = (process.env.WORKER_TOKEN || "").trim();

if (!email) {
  console.error(
    "Usage: node scripts/generate-test-plan.mjs <email> [--months 1|3|6] [--force] [--no-mail]"
  );
  process.exit(1);
}
if (!token) {
  console.error("WORKER_TOKEN fehlt in .env.local");
  process.exit(1);
}

console.log(`\n→ Generiere Plan fuer ${email}`);
console.log(`  Endpoint: ${baseUrl}/api/mitglieder/plan/generate`);
console.log(`  Force: ${force} · Mail: ${noMail ? "AUS" : "an"}`);
console.log(
  `  Plan-Länge: ${planLengthMonths ? `${planLengthMonths} Monate (Override)` : "aus selected_plan im Lead"}\n`
);

const reqBody = { email, force };
if (planLengthMonths) reqBody.plan_length_months = planLengthMonths;
if (noMail) reqBody.no_mail = true;

const started = Date.now();
const res = await fetch(`${baseUrl}/api/mitglieder/plan/generate`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Accept: "application/x-ndjson",
  },
  body: JSON.stringify(reqBody),
});

if (!res.ok && res.status !== 200) {
  const txt = await res.text();
  console.error(`✗ HTTP ${res.status}: ${txt.slice(0, 300)}`);
  process.exit(1);
}

// NDJSON-Stream lesen
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let finalEvent = null;
let pingCount = 0;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  let nl;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    try {
      const evt = JSON.parse(line);
      if (evt.event === "ping") {
        pingCount++;
        // Compact: nur jeden 4. Ping zeigen (~20s)
        if (pingCount % 4 === 0) {
          const secs = ((Date.now() - started) / 1000).toFixed(0);
          process.stdout.write(`  …${secs}s (Claude arbeitet)\n`);
        }
      } else if (evt.event === "start") {
        console.log(`  ▸ ${evt.stage}`);
      } else if (evt.event === "stage") {
        const extra =
          evt.stage === "generating"
            ? ` (${evt.months}M / ${evt.weeks} Wochen)`
            : evt.stage === "mail_sent"
              ? evt.ok
                ? " ✓"
                : ` ✗ (${evt.reason})`
              : "";
        console.log(`  ▸ ${evt.stage}${extra}`);
      } else if (evt.event === "done") {
        finalEvent = evt;
      }
    } catch (e) {
      console.warn(`  ⚠ unparseable line: ${line.slice(0, 100)}`);
    }
  }
}

const ms = Date.now() - started;
if (finalEvent?.ok) {
  console.log(`\n  ✓ Plan generiert in ${(ms / 1000).toFixed(1)}s`);
  console.log(`  Plan-Content-ID: ${finalEvent.plan_content_id}`);
  console.log(`  Plan-Länge: ${finalEvent.plan_length_months} Monate`);
  console.log(`  Wochen: ${finalEvent.weeks_count}`);
  if (finalEvent.usage) {
    console.log(
      `  Token: ${finalEvent.usage.input_tokens} in / ${finalEvent.usage.output_tokens} out`
    );
    console.log(
      `  Kosten: ~$${finalEvent.usage.estimated_cost_usd}`
    );
  }
  console.log(
    `\n  Live unter: ${baseUrl}/mitglieder/erfolge/coaching\n`
  );
} else {
  console.error(
    `\n  ✗ Fehler: ${finalEvent?.error || "kein done-Event empfangen"}`
  );
  if (finalEvent?.raw_response) {
    console.error("\n  Claude-Antwort (Anfang):\n", finalEvent.raw_response);
  }
  process.exit(1);
}
