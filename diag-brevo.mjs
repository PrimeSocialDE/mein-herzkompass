// Brevo-Konfig auslesen: Listen, Templates, Campaigns, Attribute.
// Read-only — schickt keine Mails.
import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const KEY = process.env.BREVO_API_KEY;
if (!KEY) { console.error("BREVO_API_KEY fehlt"); process.exit(1); }

async function get(path) {
  const res = await fetch(`https://api.brevo.com${path}`, {
    headers: { "api-key": KEY, accept: "application/json" },
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

console.log("=== 1) Listen (mit Count) ===");
const lists = await get("/v3/contacts/lists?limit=50&offset=0");
if (lists.data?.lists) {
  for (const l of lists.data.lists) {
    console.log(` #${String(l.id).padEnd(3)} | ${String(l.uniqueSubscribers).padStart(6)} Subs | ${l.name}`);
  }
} else {
  console.log("ERR:", lists.status, JSON.stringify(lists.data).slice(0, 200));
}

console.log("\n=== 2) Contact-Attribute ===");
const attrs = await get("/v3/contacts/attributes");
if (attrs.data?.attributes) {
  for (const a of attrs.data.attributes) {
    console.log(` ${a.name.padEnd(25)} | ${a.type || a.category} ${a.enumeration ? "(enum)" : ""}`);
  }
}

console.log("\n=== 3) E-Mail-Templates (Transactional) ===");
const tmpl = await get("/v3/smtp/templates?templateStatus=true&limit=50");
if (tmpl.data?.templates) {
  for (const t of tmpl.data.templates) {
    console.log(` #${String(t.id).padEnd(4)} | active=${t.isActive ? "✓" : "✗"} | ${t.name}`);
    console.log(`        Subject: ${t.subject}`);
    if (t.tag) console.log(`        Tag: ${t.tag}`);
  }
}

console.log("\n=== 4) E-Mail-Campaigns (letzte 20) ===");
const camp = await get("/v3/emailCampaigns?status=sent,draft,queued&limit=20");
if (camp.data?.campaigns) {
  for (const c of camp.data.campaigns) {
    const sent = c.statistics?.globalStats?.delivered || "-";
    console.log(` #${String(c.id).padEnd(5)} | ${c.status.padEnd(8)} | sent=${String(sent).padStart(5)} | ${c.name}`);
  }
}

// Automation Workflows — Brevo hat begrenzte API. Versuch's mit /v3/automation/events
console.log("\n=== 5) Automation-Events (letzte 5) ===");
const auto = await get("/v3/contacts/segments?limit=10");
if (auto.data?.segments) {
  console.log(`Segmente: ${auto.data.segments.length}`);
  for (const s of auto.data.segments.slice(0, 10)) {
    console.log(` #${s.id} | ${s.name}`);
  }
} else if (auto.status !== 200) {
  console.log("(Segmente-Endpoint:", auto.status, ")");
}
