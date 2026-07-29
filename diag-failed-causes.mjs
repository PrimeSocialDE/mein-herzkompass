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

const since = new Date(Date.now() - 14 * 86400_000).toISOString();
const { data: failedLeads } = await sb
  .from("wauwerk_leads")
  .select("id, email, status, mollie_payment_id, created_at, dog_name, selected_plan")
  .eq("status", "failed")
  .eq("payment_provider", "mollie")
  .gte("created_at", since)
  .order("created_at", { ascending: false });

console.log(`Failed Mollie-Leads letzte 14 Tage: ${failedLeads?.length || 0}\n`);

const statusCounter = {};
for (const lead of failedLeads || []) {
  if (!lead.mollie_payment_id) {
    statusCounter['no_payment_id'] = (statusCounter['no_payment_id'] || 0) + 1;
    console.log(` ${lead.created_at.slice(0,16)} | ${lead.email.padEnd(35)} | ❌ keine mollie_payment_id`);
    continue;
  }
  try {
    const res = await fetch(`https://api.mollie.com/v2/payments/${lead.mollie_payment_id}`, {
      headers: { Authorization: `Bearer ${process.env.MOLLIE_API_KEY}` },
    });
    const data = await res.json();
    const key = data.status || 'unknown';
    statusCounter[key] = (statusCounter[key] || 0) + 1;
    const method = data.method || '(none)';
    const failReason = data.details?.failureReason || data.details?.failureMessage || '';
    console.log(` ${lead.created_at.slice(0,16)} | ${(lead.email || '').padEnd(35)} | ${key.padEnd(10)} | method=${method.padEnd(15)} ${failReason ? '| ' + failReason : ''}`);
  } catch (e) {
    statusCounter['api_err'] = (statusCounter['api_err'] || 0) + 1;
  }
}

console.log("\n=== Mollie-Status-Verteilung der failed Leads ===");
console.log(statusCounter);
