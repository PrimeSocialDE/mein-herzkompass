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

// 1) Plan loeschen, damit der Trigger nicht in "skipped_existing" laeuft
const del = await sb.from("member_plan_content").delete({ count: "exact" }).ilike("email", EMAIL);
console.log(`Plaene fuer ${EMAIL} geloescht: ${del.count}`);

// 2) Den 1month-Lead nehmen und status pending → paid flippen
const { data: lead } = await sb
  .from("wauwerk_leads")
  .select("id, selected_plan, status")
  .ilike("email", EMAIL)
  .eq("selected_plan", "1month")
  .maybeSingle();
if (!lead) { console.error("Test-Lead nicht gefunden"); process.exit(1); }
console.log(`Lead ${lead.id} aktuell status=${lead.status}`);

console.log("--> Setze auf pending...");
await sb.from("wauwerk_leads").update({ status: "pending" }).eq("id", lead.id);

const t0 = Date.now();
console.log("--> Setze auf paid (das sollte den Postgres-Trigger feuern)...");
await sb.from("wauwerk_leads").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", lead.id);

// 3) Warten und pollen, ob ein Plan auftaucht
console.log("\nWarte auf Plan (max 60s)...");
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const { data: plans } = await sb
    .from("member_plan_content")
    .select("id, plan_title, created_at")
    .ilike("email", EMAIL)
    .order("created_at", { ascending: false })
    .limit(1);
  if (plans?.length) {
    const dt = Date.now() - t0;
    console.log(`\n  PLAN ERSTELLT nach ${(dt/1000).toFixed(1)}s !`);
    console.log(`  -> ${plans[0].plan_title} | created_at=${plans[0].created_at}`);
    console.log(`\nTrigger funktioniert ✓`);
    process.exit(0);
  }
  process.stdout.write(".");
}
console.log("\n\n  KEIN Plan nach 60s — Trigger funktioniert nicht.");
console.log("  Check in Supabase SQL Editor:");
console.log("    SELECT * FROM net._http_response ORDER BY id DESC LIMIT 5;");
