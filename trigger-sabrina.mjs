import { readFileSync } from "node:fs";
try {
  const e = readFileSync("/Users/maxxx/Documents/nextjs-boilerplate-main/.env.local","utf8");
  for (const l of e.split("\n")) {
    const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
  }
} catch {}

const TOKEN = process.env.WORKER_TOKEN;
const LEAD_ID = "56e56433-397f-4db5-a558-fedbdc48c3d4";

const res = await fetch("https://www.pfoten-plan.de/api/mitglieder/plan/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({ lead_id: LEAD_ID, email: "sabrinaswegner@aol.com" }),
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
