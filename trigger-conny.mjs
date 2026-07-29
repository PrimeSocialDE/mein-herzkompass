import { readFileSync } from "node:fs";
try {
  const e = readFileSync("/Users/maxxx/Documents/nextjs-boilerplate-main/.env.local","utf8");
  for (const l of e.split("\n")) {
    const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
  }
} catch {}

const TOKEN = process.env.WORKER_TOKEN;
const LEAD_ID = "de2bd8ad-6888-44c7-9a57-7258cdc1c3d4";

const res = await fetch("https://www.pfoten-plan.de/api/mitglieder/plan/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({ lead_id: LEAD_ID, email: "conny.spe@web.de" }),
});
console.log(`HTTP ${res.status}\n`);
const txt = await res.text();
const lines = txt.split("\n").filter(Boolean);
for (const line of lines) {
  try {
    const obj = JSON.parse(line);
    if (obj.event === "ping") continue;
    console.log(JSON.stringify(obj, null, 2));
  } catch {
    console.log("RAW:", line.slice(0, 200));
  }
}
