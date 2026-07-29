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

const { data: plans } = await sb
  .from("member_plan_content")
  .select("plan_title, content, created_at")
  .ilike("email", "max@primesocial.de")
  .order("created_at", { ascending: false })
  .limit(1);

if (!plans?.length) { console.log("kein Plan in DB"); process.exit(0); }
const p = plans[0];
const c = p.content;
console.log("Plan-Title:", p.plan_title);
console.log("Wochen total:", c.weeks?.length);
console.log("Monatsuebersichten:", c.monats_uebersichten?.length);
console.log("");
console.log("=== INTRO ===");
console.log(c.intro?.einleitung || "(keine)");
console.log("");
console.log("=== Monats-Uebersicht 1 (nach Woche 4) ===");
const m1 = c.monats_uebersichten?.[0];
if (m1) {
  console.log("Titel:", m1.titel);
  for (const sec of (m1.abschnitte || [])) {
    console.log("  -", sec.heading);
    for (const item of (sec.items || [])) console.log("     *", item);
  }
}
console.log("");
console.log("Em-dashes im Intro:", (c.intro?.einleitung || "").includes("—") ? "JA (schlecht)" : "nein");
console.log("Em-dashes irgendwo:", JSON.stringify(c).includes("—") ? "JA" : "nein");
