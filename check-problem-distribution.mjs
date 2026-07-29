import { readFileSync } from "node:fs";
try {
  const e = readFileSync("/Users/maxxx/Documents/nextjs-boilerplate-main/.env.local","utf8");
  for (const l of e.split("\n")) {
    const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
  }
} catch {}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth:{autoRefreshToken:false,persistSession:false} });

// Letzte 100 paid-Leads, dog_problem aus answers extrahieren
const { data: leads } = await sb
  .from("wauwerk_leads")
  .select("answers")
  .eq("status", "paid")
  .order("paid_at", { ascending: false })
  .limit(100);

const counts = {};
for (const l of leads || []) {
  const a = l.answers || {};
  const p = a.dog_problem || a.problem || a.main_problem || "(none)";
  counts[p] = (counts[p] || 0) + 1;
}
const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
console.log("Verteilung dog_problem (letzte 100 paid):");
for (const [p, n] of sorted) console.log(`  ${String(n).padStart(3)}x  ${p}`);
