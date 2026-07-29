// Pruefe pg_net-Queue + Response-Log via Supabase RPC.
// Erfordert dass wir SQL ausfuehren koennen — geht ueber service_role
// + die "exec_sql"-RPC.
import { readFileSync } from "node:fs";
try {
  const e = readFileSync("/Users/maxxx/Documents/nextjs-boilerplate-main/.env.local","utf8");
  for (const l of e.split("\n")) {
    const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
  }
} catch {}

// Versuche pgrest-style direkten Zugriff auf net._http_response
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE;

// Via PostgREST kommt man nicht ans "net"-Schema. Stattdessen versuchen wir
// es ueber die /rest/v1/rpc API mit einer eigenen Funktion.
// Wir koennten aber direkt eine SQL-Query bauen via http
const res = await fetch(`${url}/rest/v1/rpc/get_pgnet_recent`, {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: "{}",
});
console.log("HTTP", res.status);
console.log(await res.text());
