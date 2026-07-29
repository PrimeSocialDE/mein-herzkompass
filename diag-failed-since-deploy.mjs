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
  "tr_Pq3DpiT4AjNV",   // silvia, 20:00
  "tr_Msg4bNZryuyY",   // anke, 19:34
  "tr_qZnDtYcDyGfp",   // de06849, 18:50
  "tr_my6BiuyPUUgt",   // info goettmann, 18:45
  "tr_tRzSUj26HJ4z",   // timberwolf, 18:07
  // Auch der erfolgreiche zum Vergleich
];

console.log(`=== Mollie-Status nach Deploy ===\n`);
for (const id of ids) {
  // Full IDs brauchen wir — die obige Liste hat nur Anfang. Schauen wir nochmal in DB.
  const r = await fetch(`https://api.mollie.com/v2/payments?limit=30`, {
    headers: { Authorization: `Bearer ${key}` }
  });
  const j = await r.json();
  const matches = j._embedded?.payments?.filter(p => p.id.startsWith(id)) || [];
  for (const p of matches) {
    console.log(`${id}* full=${p.id}`);
    console.log(`  status: ${p.status} | method: ${p.method || "—"} | amount: €${p.amount?.value}`);
    console.log(`  email: ${p.metadata?.email || "—"} | plan: ${p.metadata?.plan} | lead_id: ${p.metadata?.lead_id?.slice(0,8)}`);
    console.log(`  metadata-size: ${JSON.stringify(p.metadata).length} bytes`);
    console.log(`  createdAt: ${p.createdAt}`);
    console.log(`  failedAt: ${p.failedAt || "—"} | expiredAt: ${p.expiredAt || "—"} | canceledAt: ${p.canceledAt || "—"}`);
    if (p.details) console.log(`  details: ${JSON.stringify(p.details).slice(0,200)}`);
    console.log();
  }
}

// Zeige alle in den letzten 4h erstellte Payments
const cutoff = new Date(Date.now() - 4 * 3600_000);
const r2 = await fetch(`https://api.mollie.com/v2/payments?limit=30`, {
  headers: { Authorization: `Bearer ${key}` }
});
const j2 = await r2.json();
const recent4h = j2._embedded?.payments?.filter(p => new Date(p.createdAt) >= cutoff) || [];
console.log(`\n=== Alle Mollie-Payments letzte 4h: ${recent4h.length} ===`);
const status = {}; const methods = {};
for (const p of recent4h) {
  status[p.status] = (status[p.status]||0)+1;
  methods[p.method || "no-method"] = (methods[p.method || "no-method"]||0)+1;
}
console.log(" Status:", status);
console.log(" Method:", methods);

console.log(`\n=== metadata-bytes der recent Payments ===`);
for (const p of recent4h.slice(0, 10)) {
  const bytes = JSON.stringify(p.metadata || {}).length;
  console.log(`  ${p.createdAt.slice(11,16)} | ${p.status.padEnd(10)} | ${(p.method || "—").padEnd(12)} | ${bytes} bytes | ${p.metadata?.email || "—"}`);
}
