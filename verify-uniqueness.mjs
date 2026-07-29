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

if (!plans?.length) { console.log("kein Plan"); process.exit(0); }
const c = plans[0].content;
console.log(`Plan: ${plans[0].plan_title}`);
console.log(`Wochen total: ${c.weeks.length}`);
console.log(`Monatsuebersichten: ${c.monats_uebersichten?.length}\n`);

// Pro Woche: Titel + erste Übung + Anzahl Ziele
console.log("=== Wochen-Uebersicht ===");
for (const w of c.weeks) {
  const uebs = (w.uebungen || []).map(u => u.name).join(" + ");
  console.log(`W${String(w.num).padStart(2,"0")}: ${w.title}  |  ${uebs}`);
}

// Pro Woche: ist Titel unique?
const titles = c.weeks.map(w => w.title);
const uniqueTitles = new Set(titles);
console.log(`\n  -> Unique Wochen-Titel: ${uniqueTitles.size} / ${titles.length}`);

// Sind Wochenziele zwischen den Wochen identisch?
const zieleSig = c.weeks.map(w => (w.wochenziele || []).join("|"));
const uniqueZiele = new Set(zieleSig);
console.log(`  -> Unique Wochenziele-Sets: ${uniqueZiele.size} / ${zieleSig.length}`);

const tagespSig = c.weeks.map(w => w.tagesplan?.slice(0, 50));
const uniqueTagesp = new Set(tagespSig);
console.log(`  -> Unique Tagespläne (erste 50 chars): ${uniqueTagesp.size} / ${tagespSig.length}`);

// Detail: Schwerpunkt-Auszug Woche 1, 4, 8 (für Vergleich)
console.log("\n=== Schwerpunkte W1/W4/W8 ===");
for (const n of [1, 4, 8, 12, 16, 20, 24]) {
  const w = c.weeks.find(x => x.num === n);
  if (!w) continue;
  console.log(`\nW${n}: ${w.title}`);
  console.log(`  -> ${w.schwerpunkt?.slice(0, 200)}...`);
}

// Monats-Uebersichten Auszug
console.log("\n=== Monats-Uebersicht 1 (erste 300 Zeichen) ===");
console.log(c.monats_uebersichten?.[0]?.text?.slice(0, 400));
