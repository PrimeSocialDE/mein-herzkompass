import { readFileSync } from "node:fs";
const envText = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
const m = [...envText.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)];
const env = {};
for (const x of m) if (!(x[1] in env)) env[x[1]] = x[2].replace(/^["']|["']$/g, "");
const base = env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.pfoten-plan.de";
const token = env.WORKER_TOKEN;
if (!token) { console.error("WORKER_TOKEN fehlt in .env.local"); process.exit(1); }
console.log("POST", base + "/api/admin/trigger-delivery", "email=s.rosica@hotmail.com force=true");
const res = await fetch(base + "/api/admin/trigger-delivery", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
  body: JSON.stringify({ email: "s.rosica@hotmail.com", force: true }),
});
console.log("HTTP", res.status);
const txt = await res.text();
try { console.log(JSON.stringify(JSON.parse(txt), null, 2)); } catch { console.log(txt.slice(0, 2000)); }
