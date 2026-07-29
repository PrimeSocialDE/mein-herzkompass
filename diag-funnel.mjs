import { readFileSync } from "node:fs";
const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
for (const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)])
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth:{autoRefreshToken:false,persistSession:false}});
const iso = (d) => new Date(Date.now() - d*864e5).toISOString();
const cnt = async (b) => (await b).count;

for (const d of [3, 7, 30]) {
  const created = await cnt(sb.from("wauwerk_leads").select("id",{count:"exact",head:true}).gte("created_at", iso(d)));
  const paidByPaidAt = await cnt(sb.from("wauwerk_leads").select("id",{count:"exact",head:true}).eq("status","paid").gte("paid_at", iso(d)));
  // Kohorte: in den letzten d Tagen ERSTELLTE Leads, die jetzt paid sind
  const cohortPaid = await cnt(sb.from("wauwerk_leads").select("id",{count:"exact",head:true}).eq("status","paid").gte("created_at", iso(d)));
  console.log(`${String(d).padStart(2)}d | Leads erstellt: ${String(created).padStart(5)} | bezahlt(paid_at): ${String(paidByPaidAt).padStart(4)} | Kohorten-CR (erstellt→paid): ${(cohortPaid/created*100).toFixed(1)}% (${cohortPaid}/${created})`);
}
// Plan-Mix gesamt letzte 3 Tage
const { data } = await sb.from("wauwerk_leads").select("selected_plan").eq("status","paid").gte("paid_at", iso(3));
const mix={}; for(const r of data||[]) mix[r.selected_plan]=(mix[r.selected_plan]||0)+1;
console.log("\nPlan-Mix bezahlt (3d):", Object.entries(mix).map(([k,v])=>`${k}:${v}`).join("  "));
