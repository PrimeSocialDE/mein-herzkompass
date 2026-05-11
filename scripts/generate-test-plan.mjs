// Triggert /api/mitglieder/plan/generate fuer einen Test-Account.
// Generiert via Claude einen frischen 12-Wochen-Plan und speichert ihn
// in member_plan_content. Web-Renderer zeigt ihn dann sofort.
//
// Aufruf:
//   node scripts/generate-test-plan.mjs kontakt@primesocial.de
//   node scripts/generate-test-plan.mjs kontakt@primesocial.de --force
//   node scripts/generate-test-plan.mjs kontakt@primesocial.de --months 6
//   (--months 1|3|6, sonst aus selected_plan im Lead)
//
// Voraussetzung: WORKER_TOKEN in .env.local + ANTHROPIC_API_KEY +
// Server laeuft (lokal: npm run dev, oder gegen Vercel-Deploy).

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
// --months 1 | 3 | 6  (optional, ueberschreibt selected_plan)
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
    "Usage: node scripts/generate-test-plan.mjs <email> [--force]"
  );
  process.exit(1);
}
if (!token) {
  console.error("WORKER_TOKEN fehlt in .env.local");
  process.exit(1);
}

console.log(`\n→ Generiere Plan fuer ${email}`);
console.log(`  Endpoint: ${baseUrl}/api/mitglieder/plan/generate`);
console.log(`  Force: ${force}`);
console.log(
  `  Plan-Länge: ${planLengthMonths ? `${planLengthMonths} Monate (Override)` : "aus selected_plan im Lead"}\n`
);
console.log("  Claude arbeitet... das kann 30-180 Sekunden dauern.\n");

const started = Date.now();
const reqBody = { email, force };
if (planLengthMonths) reqBody.plan_length_months = planLengthMonths;
const res = await fetch(`${baseUrl}/api/mitglieder/plan/generate`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(reqBody),
});

const ms = Date.now() - started;
let data;
try {
  data = await res.json();
} catch {
  console.error(`  Status ${res.status} - keine JSON-Antwort`);
  process.exit(1);
}

if (res.ok && data.ok) {
  console.log(`  ✓ Plan generiert in ${(ms / 1000).toFixed(1)}s`);
  console.log(`  Plan-Content-ID: ${data.plan_content_id}`);
  console.log(`  Plan-Länge: ${data.plan_length_months} Monate`);
  console.log(`  Wochen: ${data.weeks_count}`);
  if (data.usage) {
    console.log(
      `  Token: ${data.usage.input_tokens} in / ${data.usage.output_tokens} out`
    );
    console.log(`  Kosten: ~$${data.usage.estimated_cost_usd}`);
  }
  console.log(
    `\n  Live unter: ${baseUrl}/mitglieder/erfolge/coaching\n`
  );
} else {
  console.error(`  ✗ Fehler (Status ${res.status}):`, data.error || data);
  if (data.raw_response) {
    console.error("\n  Claude-Antwort (Anfang):\n", data.raw_response);
  }
  process.exit(1);
}
