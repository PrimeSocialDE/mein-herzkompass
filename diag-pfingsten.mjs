import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
const since = new Date(Date.now() - 8 * 86400_000).toISOString();
const { data: leads } = await sb.from("wauwerk_leads").select("status, created_at, paid_at").gte("created_at", since);
const byDay = {};
for (const l of leads) {
  const d = l.created_at.slice(0, 10);
  if (!byDay[d]) byDay[d] = { total: 0, paid: 0 };
  byDay[d].total++;
  if (l.status === "paid") byDay[d].paid++;
}
console.log("Tag       | Leads | Paid | CR    | Anmerkung");
const notes = {
  "2026-05-22": " Freitag",
  "2026-05-23": " Pfingstsamstag",
  "2026-05-24": " Pfingstsonntag (sonniges Wetter)",
  "2026-05-25": " Pfingstmontag",
  "2026-05-26": " Dienstag (heute)",
};
for (const d of Object.keys(byDay).sort()) {
  const s = byDay[d];
  const cr = s.total ? (s.paid/s.total*100).toFixed(1) : "0";
  console.log(`${d} |  ${String(s.total).padStart(3)}  |  ${String(s.paid).padStart(2)}  | ${cr.padStart(4)}% |${notes[d] || ""}`);
}
