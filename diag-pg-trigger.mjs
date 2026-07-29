// Diagnose: existiert der paid-trigger? Was sagt pg_net?
// Schickt NICHTS. Nur Read-only.
import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// 1) Trigger-Check via pg_trigger NOT (kein RPC vorhanden) — skippe

// 2) Letzte pg_net Requests
console.log("\n=== 2) Letzte HTTP-Requests aus pg_net (net.http_request_queue) ===");
const { data: reqs, error: reqErr } = await sb
  .schema("net")
  .from("http_request_queue")
  .select("id, url, method, created")
  .order("id", { ascending: false })
  .limit(10);
if (reqErr) console.log("ERR queue:", reqErr.message);
else console.log(reqs);

// 3) Letzte Responses
console.log("\n=== 3) Letzte HTTP-Responses (net._http_response) ===");
const { data: resps, error: respErr } = await sb
  .schema("net")
  .from("_http_response")
  .select("id, status_code, content, error_msg, created")
  .order("id", { ascending: false })
  .limit(10);
if (respErr) console.log("ERR resp:", respErr.message);
else {
  for (const r of resps || []) {
    const content = String(r.content || "").slice(0, 200);
    console.log(` id=${r.id} | status=${r.status_code} | created=${r.created?.slice(0, 19)} | err=${r.error_msg || "-"}`);
    if (content) console.log(`   content: ${content}`);
  }
}
