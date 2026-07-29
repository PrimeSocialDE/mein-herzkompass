import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
const key = process.env.MOLLIE_API_KEY;
const ids = [
  "tr_69cghWsKzaFgoD23zKeRJ", // janka.m
  "tr_oCt6rEqzhFHRqgSJyzdRJ", // manja_grobe
  "tr_CxXgdXvUFAnNkuRZ7kdRJ", // kathrinr662
  "tr_HYoLwhkGQdTj4ULmf8eRJ", // holgerjaques
  "tr_U2zf8rf4uvbykdZcXsdRJ", // nhana3005
  "tr_ePn5DpkMhB4zk9VCVsdRJ", // tes@gma.de
];
for (const id of ids) {
  const r = await fetch(`https://api.mollie.com/v2/payments/${id}`, {
    headers: { Authorization: `Bearer ${key}` }
  });
  const j = await r.json();
  if (j.status === undefined) { console.log(`${id}: ERR ${JSON.stringify(j).slice(0,200)}`); continue; }
  const meta = j.metadata || {};
  console.log(`\n=== ${id} ===`);
  console.log(`  email: ${meta.email || j.customerId || "—"}`);
  console.log(`  status: ${j.status}${j.isCancelable ? " (cancelable)" : ""}`);
  console.log(`  method: ${j.method || "—"}`);
  console.log(`  amount: ${j.amount?.value} ${j.amount?.currency}`);
  console.log(`  createdAt: ${j.createdAt}`);
  console.log(`  expiresAt: ${j.expiresAt || j.expiredAt || "—"}`);
  console.log(`  paidAt: ${j.paidAt || "—"} | failedAt: ${j.failedAt || "—"} | canceledAt: ${j.canceledAt || "—"}`);
  console.log(`  description: ${j.description}`);
  if (j.details) console.log(`  details: ${JSON.stringify(j.details).slice(0,200)}`);
  if (j._links?.checkout) console.log(`  checkout-url: ${j._links.checkout.href.slice(0,80)}...`);
  console.log(`  metadata.lead_id: ${meta.lead_id || "—"} | plan: ${meta.plan || "—"} | variant: ${meta.variant || meta.ab_test || "—"}`);
}
