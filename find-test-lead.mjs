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

// Nimm max@primesocial.de 3month-Lead, flip auf pending, plan loeschen.
// Dann KANNST du in Supabase Dashboard manuell auf paid setzen und es testen.
const EMAIL = "max@primesocial.de";

const { data: lead } = await sb
  .from("wauwerk_leads")
  .select("id, selected_plan, status, email, dog_name")
  .ilike("email", EMAIL)
  .eq("selected_plan", "3month")
  .maybeSingle();
if (!lead) { console.error("Lead nicht gefunden"); process.exit(1); }

await sb.from("member_plan_content").delete().ilike("email", EMAIL).eq("plan_slug", "trainingsplan");
await sb.from("wauwerk_leads").update({ status: "pending", paid_at: null }).eq("id", lead.id);

console.log("Test-Lead vorbereitet:");
console.log(`  email:         ${lead.email}`);
console.log(`  lead_id:       ${lead.id}`);
console.log(`  selected_plan: ${lead.selected_plan}`);
console.log(`  dog_name:      ${lead.dog_name}`);
console.log(`  status JETZT:  pending`);
console.log(``);
console.log(`Jetzt in Supabase Dashboard:`);
console.log(`  1. Table Editor → wauwerk_leads → suche id=${lead.id}`);
console.log(`  2. Status-Feld auf "paid" aendern + speichern`);
console.log(`  3. 20 Sekunden warten`);
console.log(`  4. Plan-Eintrag muesste in member_plan_content stehen`);
console.log(``);
console.log(`Verify danach mit: node check-this-lead.mjs`);
