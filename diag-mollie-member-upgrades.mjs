import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
const key = process.env.MOLLIE_API_KEY;

// Hole letzte 100 Mollie-Payments
const r = await fetch("https://api.mollie.com/v2/payments?limit=100", {
  headers: { Authorization: `Bearer ${key}` }
});
const j = await r.json();
const payments = j._embedded?.payments || [];

const cutoff = new Date(Date.now() - 2 * 86400_000);
const recent = payments.filter(p => new Date(p.createdAt) >= cutoff);

console.log(`=== Mollie-Payments letzte 2 Tage (n=${recent.length}) ===\n`);

const memberUpgrades = recent.filter(p =>
  p.metadata?.utm_source === "member-area" ||
  p.metadata?.utm_campaign === "upgrade"
);

console.log(`=== Member-Bereich-Upgrades: ${memberUpgrades.length} ===\n`);
for (const p of memberUpgrades) {
  console.log(`  ${p.createdAt.slice(0,16)} | ${p.status.padEnd(10)} | ${(p.method || "—").padEnd(12)} | €${p.amount?.value} | ${p.metadata?.email || "no-email"} | plan=${p.metadata?.plan} | lead_id=${p.metadata?.lead_id?.slice(0,8) || "—"}`);
  if (p.status !== "paid") {
    console.log(`     ↳ failedAt=${p.failedAt || "—"} | expiredAt=${p.expiredAt || "—"} | canceledAt=${p.canceledAt || "—"}`);
  }
}

// Status-Verteilung
const ms = {};
for (const p of memberUpgrades) ms[p.status] = (ms[p.status] || 0) + 1;
console.log(`\n  Status-Verteilung: ${JSON.stringify(ms)}`);
const paid = ms.paid || 0;
const total = memberUpgrades.length;
console.log(`  Conversion: ${paid}/${total} = ${total ? (paid/total*100).toFixed(0) : 0}%`);

// === Alle pending/failed Payments unabhängig vom Source ===
console.log(`\n=== ALLE nicht-paid Payments letzte 2 Tage ===\n`);
const nonPaid = recent.filter(p => p.status !== "paid");
console.log(`${nonPaid.length} von ${recent.length} (${(nonPaid.length/recent.length*100).toFixed(0)}%) nicht-paid:\n`);
const statusGroups = {};
for (const p of nonPaid) {
  if (!statusGroups[p.status]) statusGroups[p.status] = [];
  statusGroups[p.status].push(p);
}
for (const [status, ps] of Object.entries(statusGroups)) {
  console.log(`  ${status}: ${ps.length}`);
  // Per Method
  const byMethod = {};
  for (const p of ps) {
    const m = p.method || "no-method";
    byMethod[m] = (byMethod[m] || 0) + 1;
  }
  for (const [m, c] of Object.entries(byMethod)) {
    console.log(`    ${m.padEnd(15)} ${c}`);
  }
}
