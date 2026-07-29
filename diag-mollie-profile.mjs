import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
const key = process.env.MOLLIE_API_KEY;
const pid = process.env.MOLLIE_PROFILE_ID;

const r = await fetch(`https://api.mollie.com/v2/profiles/${pid}`, {
  headers: { Authorization: `Bearer ${key}` }
});
const j = await r.json();
console.log("=== Mollie Profile ===");
console.log(`id: ${j.id}`);
console.log(`mode: ${j.mode}`);
console.log(`name (= Trade name): ${j.name}`);
console.log(`website: ${j.website}`);
console.log(`email: ${j.email}`);
console.log(`phone: ${j.phone}`);
console.log(`businessCategory: ${j.businessCategory}`);
console.log(`status: ${j.status}`);

// Letztes Payment angucken — welches statementDescriptor wird tatsaechlich gesendet?
const list = await fetch(`https://api.mollie.com/v2/payments?limit=1`, {
  headers: { Authorization: `Bearer ${key}` }
});
const lj = await list.json();
const p = lj._embedded?.payments?.[0];
if (p) {
  console.log("\n=== Letzter Payment ===");
  console.log(`id: ${p.id}`);
  console.log(`description (sieht User im Mollie-Checkout): ${p.description}`);
  console.log(`profileId: ${p.profileId}`);
  console.log(`amount: ${p.amount?.value} ${p.amount?.currency}`);
}
