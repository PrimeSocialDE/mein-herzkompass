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

console.log("=== Letzte 20 Trigger-Fires (public.plan_gen_audit) ===");
const { data: audit, error: aErr } = await sb
  .from("plan_gen_audit")
  .select("id, lead_id, email, old_status, new_status, pg_net_request_id, fired_at, note")
  .order("fired_at", { ascending: false })
  .limit(20);
if (aErr) { console.error("audit ERR:", aErr); }
else {
  if (!audit || audit.length === 0) {
    console.log("LEER — Trigger feuert ueberhaupt nicht.");
  } else {
    for (const r of audit) {
      console.log(` ${r.fired_at?.slice(0, 19)} | ${r.old_status}→${r.new_status} | req=${r.pg_net_request_id} | ${r.note} | ${r.email}`);
    }
  }
}

console.log("\n=== Letzte 20 Responses (public.plan_gen_responses) ===");
const { data: resps, error: rErr } = await sb
  .from("plan_gen_responses")
  .select("audit_id, email, fired_at, audit_note, pg_net_request_id, status_code, response_body, response_error")
  .limit(20);
if (rErr) { console.error("resp ERR:", rErr); }
else {
  if (!resps || resps.length === 0) {
    console.log("LEER");
  } else {
    for (const r of resps) {
      const body = String(r.response_body || "").slice(0, 250).replace(/\n/g, " ");
      console.log(` audit=${r.audit_id} | ${r.fired_at?.slice(0, 19)} | note=${r.audit_note} | http=${r.status_code} | err=${r.response_error || "-"}`);
      if (body) console.log(`   body: ${body}`);
    }
  }
}

console.log("\n=== Trigger im DB registriert? (via raw via auth.uid trick — alt. RPC) ===");
// Kann pg_trigger nicht direkt lesen, aber wenn audit-Inserts kommen → existiert.
