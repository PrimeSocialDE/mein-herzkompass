// Erstellt eine neue Brevo-Liste 'warm-recovery' fuer Pending+Failed-User.
// Diese Liste wird unser Drip-Workflow nutzen, parallel zur existing
// Nurture-Liste (#47). User in dieser Liste sollen NICHT mehr den generischen
// Brevo-Workflow bekommen (User passt das im Brevo-UI an).

import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const key = process.env.BREVO_API_KEY;

// 1) Bestehende Listen auflisten (zum Reference)
console.log("=== Bestehende Brevo-Listen ===");
const listsRes = await fetch("https://api.brevo.com/v3/contacts/lists?limit=50", {
  headers: { "api-key": key, accept: "application/json" }
});
const listsData = await listsRes.json();
for (const l of listsData.lists || []) {
  console.log(`  ${String(l.id).padStart(4)} | ${l.name} (${l.totalSubscribers} subs)`);
}

// 2) Pruefen ob 'warm-recovery' schon existiert
const existing = (listsData.lists || []).find(l =>
  l.name.toLowerCase().includes("warm-recovery") ||
  l.name.toLowerCase().includes("pending") ||
  l.name.toLowerCase().includes("warm")
);

if (existing) {
  console.log(`\n✓ Liste existiert schon: ID=${existing.id} name="${existing.name}"`);
  console.log(`→ In .env.local hinzufuegen: BREVO_LIST_WARM_RECOVERY=${existing.id}`);
  process.exit(0);
}

// 3) Neue Liste erstellen
console.log("\n=== Erstelle Liste 'warm-recovery' ===");
const createRes = await fetch("https://api.brevo.com/v3/contacts/lists", {
  method: "POST",
  headers: { "api-key": key, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "warm-recovery",
    folderId: listsData.lists?.[0]?.folderId || 1,
  })
});
const created = await createRes.json();
if (createRes.status >= 400) {
  console.error("❌ Erstellung fehlgeschlagen:", created);
  process.exit(1);
}
console.log(`✓ Liste erstellt: ID=${created.id}`);
console.log(`\n→ In .env.local hinzufuegen: BREVO_LIST_WARM_RECOVERY=${created.id}`);
