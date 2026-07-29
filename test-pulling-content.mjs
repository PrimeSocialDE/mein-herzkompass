// Triggert via Postgres-Trigger: 1month-Lead pending->paid,
// wartet auf Plan, zeigt Inhalt.
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

const EMAIL = "max@primesocial.de";

// Plan loeschen
await sb.from("member_plan_content").delete().ilike("email", EMAIL);

// 1month-Lead nehmen, paid_at=null, status=pending
const leadId = "e9f61b78-c11a-4605-8701-2325b53c31af";
await sb.from("wauwerk_leads").update({ status: "pending", paid_at: null }).eq("id", leadId);

console.log("Setze 1month auf paid (Trigger sollte feuern)...");
const t0 = Date.now();
await sb.from("wauwerk_leads").update({
  status: "paid",
  paid_at: new Date().toISOString(),
}).eq("id", leadId);

// Polling
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const { data: plans } = await sb
    .from("member_plan_content")
    .select("content,plan_title,created_at")
    .ilike("email", EMAIL)
    .order("created_at", { ascending: false })
    .limit(1);
  if (plans?.length) {
    const c = plans[0].content;
    console.log(`\nPLAN ERSTELLT nach ${((Date.now()-t0)/1000).toFixed(1)}s`);
    console.log(`  ${plans[0].plan_title}\n`);
    console.log(`Wochen total: ${c.weeks.length}`);

    console.log("\n=== AUFBAU (sollte Equipment-Briefing enthalten) ===");
    console.log(c.intro?.aufbau || "(keiner)");

    console.log("\n=== WOCHEN-UEBERSICHT ===");
    for (const w of c.weeks) {
      const uebs = (w.uebungen || []).map(u => u.name).join(" + ");
      console.log(`W${w.num}: ${w.title}`);
      console.log(`   Schwerpunkt: ${w.schwerpunkt?.slice(0,150)}...`);
      console.log(`   Uebungen: ${uebs}`);
      console.log("");
    }

    // Check kein SCHAU-Duplikat W1/W2
    const w1Ueb = c.weeks[0]?.uebungen?.map(u => u.name) || [];
    const w2Ueb = c.weeks[1]?.uebungen?.map(u => u.name) || [];
    const dup = w1Ueb.filter(x => w2Ueb.includes(x));
    console.log(`\nW1<->W2 doppelte Uebungen: ${dup.length === 0 ? "KEINE (gut)" : dup.join(", ")+" (problem!)"}`);

    process.exit(0);
  }
  process.stdout.write(".");
}
console.log("\nKein Plan nach 60s");
