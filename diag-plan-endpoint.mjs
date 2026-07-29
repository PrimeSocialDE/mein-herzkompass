// No-op Test: ruft /plan/generate auf production mit Lead der schon Plan hat.
// Erwartet: "skipped_existing" — Endpoint + Auth funktionieren.
// Sendet NIX (kein Plan-Eintrag, keine Mail).
import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const token = process.env.WORKER_TOKEN;
if (!token) { console.error("WORKER_TOKEN fehlt in .env.local"); process.exit(1); }

const url = "https://www.pfoten-plan.de/api/mitglieder/plan/generate";
console.log(`POST ${url}`);
console.log(`Auth: Bearer ${token.slice(0, 8)}...${token.slice(-4)}`);

const t0 = Date.now();
const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    email: "conny.spe@web.de",
    force: false,
  }),
});

console.log(`HTTP ${res.status} (${Date.now() - t0}ms)`);
console.log(`Content-Type: ${res.headers.get("content-type")}`);

const txt = await res.text();
console.log(`\nResponse body (${txt.length} bytes):`);
console.log(txt.slice(0, 2000));

const lines = txt.split("\n").filter(Boolean);
console.log(`\nNDJSON-Zeilen: ${lines.length}`);
let final = null;
for (const line of lines) {
  try {
    const obj = JSON.parse(line);
    if (obj.event === "done") final = obj;
  } catch {}
}
console.log(`\nFinal:`, final);
