import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
const key = process.env.MOLLIE_API_KEY;

// Letzte 50 Mollie-Payments — filtere nach metadata.one_click="true"
const r = await fetch("https://api.mollie.com/v2/payments?limit=100", {
  headers: { Authorization: `Bearer ${key}` }
});
const j = await r.json();
const payments = j._embedded?.payments || [];

const since = new Date(Date.now() - 48 * 3600_000); // letzte 48h
const recent = payments.filter(p => new Date(p.createdAt) >= since);

const oneClickAttempts = recent.filter(p => p.metadata?.one_click === "true");
const upsellAttempts = recent.filter(p => p.metadata?.type === "upsell" || p.metadata?.type === "premium");

console.log(`=== Letzte 48h ===`);
console.log(`  Total Mollie-Payments:   ${recent.length}`);
console.log(`  Upsell-Versuche (alt+neu): ${upsellAttempts.length}`);
console.log(`  Davon One-Click (neu):     ${oneClickAttempts.length}`);

console.log(`\n=== Upsell-Versuche im Detail ===`);
for (const p of upsellAttempts) {
  const isOneClick = p.metadata?.one_click === "true";
  console.log(`  ${p.createdAt.slice(11,16)} | ${p.status.padEnd(10)} | ${(p.method||"—").padEnd(12)} | €${p.amount?.value} | one-click=${isOneClick ? "✓" : "—"} | seq=${p.sequenceType || "—"} | email=${p.metadata?.email || "—"}`);
}

// Frist-Sequenz: gibt es welche?
const firstSeq = recent.filter(p => p.sequenceType === "first");
console.log(`\n=== sequenceType="first" Payments (Erstkäufe mit Mandate-Setup) ===`);
console.log(`  Anzahl: ${firstSeq.length}`);
for (const p of firstSeq.slice(0,10)) {
  console.log(`  ${p.createdAt.slice(11,16)} | ${p.status.padEnd(10)} | ${(p.method||"—").padEnd(12)} | customerId=${p.customerId ? "✓" : "—"} | mandateId=${p.mandateId ? "✓" : "—"}`);
}

// Recurring?
const recurringSeq = recent.filter(p => p.sequenceType === "recurring");
console.log(`\n=== sequenceType="recurring" Payments (1-Click-Upsells) ===`);
console.log(`  Anzahl: ${recurringSeq.length}`);
for (const p of recurringSeq) {
  console.log(`  ${p.createdAt.slice(11,16)} | ${p.status.padEnd(10)} | ${(p.method||"—").padEnd(12)} | €${p.amount?.value} | email=${p.metadata?.email}`);
}
