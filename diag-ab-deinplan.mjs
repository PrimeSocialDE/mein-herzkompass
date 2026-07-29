import { readFileSync } from "node:fs";
const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
for (const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)])
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth:{autoRefreshToken:false,persistSession:false}});
const iso = (d) => new Date(Date.now() - d*864e5).toISOString();
const cnt = async (b) => (await b).count;

// A = deinplan3 (Control/Champion) · B = deinplan2 (+ "Du bist nicht allein"-Block)
const LABEL = { A: "A · deinplan3 (Control)", B: "B · deinplan2 (+Reassurance)" };

console.log("=== A/B nach Zuweisung (ab_variant, Kohorte created_at) ===");
for (const d of [7, 14, 30]) {
  console.log(`\n--- letzte ${d} Tage ---`);
  const rows = [];
  for (const v of ["A", "B"]) {
    const total = await cnt(sb.from("wauwerk_leads").select("id",{count:"exact",head:true}).eq("ab_variant", v).gte("created_at", iso(d)));
    const paid  = await cnt(sb.from("wauwerk_leads").select("id",{count:"exact",head:true}).eq("ab_variant", v).eq("status","paid").gte("created_at", iso(d)));
    const cr = total ? (paid/total*100) : 0;
    rows.push({ v, total, paid, cr });
    console.log(`  ${LABEL[v].padEnd(30)} | Leads ${String(total).padStart(5)} | zahlend ${String(paid).padStart(4)} | CR ${cr.toFixed(2)}%`);
  }
  const [a,b] = rows;
  if (a.cr && b.cr) {
    const rel = ((b.cr - a.cr)/a.cr*100);
    console.log(`  → B vs A: ${rel>=0?"+":""}${rel.toFixed(1)}% relative CR ${rel>=0?"(B fuehrt)":"(A fuehrt)"}`);
  }
}

// Quer-check ueber source_page (auf welcher Seite tatsaechlich konvertiert)
console.log("\n=== Quer-Check: zahlende Leads nach source_page (30d) ===");
for (const p of ["deinplan3", "deinplan2"]) {
  const paid = await cnt(sb.from("wauwerk_leads").select("id",{count:"exact",head:true}).eq("status","paid").eq("source_page", p).gte("created_at", iso(30)));
  console.log(`  ${p.padEnd(12)} | zahlend ${paid}`);
}
