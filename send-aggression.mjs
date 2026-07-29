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
const TOKEN = process.env.WORKER_TOKEN;
const LEAD_ID = "e9f61b78-c11a-4605-8701-2325b53c31af";

await sb.from("member_plan_content").delete().ilike("email", EMAIL);

const { data: lead } = await sb.from("wauwerk_leads").select("answers").eq("id", LEAD_ID).single();
await sb.from("wauwerk_leads").update({
  answers: {
    ...(lead?.answers || {}),
    dog_problem: "aggression",
    custom_problem_text: "Bruno bellt und zieht aggressiv in der Leine wenn er andere Hunde sieht. Begegnungen sind sehr schwierig geworden.",
  },
}).eq("id", LEAD_ID);

const t0 = Date.now();
const res = await fetch("https://www.pfoten-plan.de/api/mitglieder/plan/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({ lead_id: LEAD_ID, email: EMAIL, force: true, plan_length_months: 1 }),
});

const txt = await res.text();
let final = null;
for (const line of txt.split("\n").filter(Boolean)) {
  try {
    const obj = JSON.parse(line);
    if (obj.event === "done") final = obj;
    else if (obj.event === "stage") process.stdout.write(`.${obj.stage} `);
  } catch {}
}
console.log(`\nok=${final?.ok} weeks=${final?.weeks_count} dauer=${((Date.now()-t0)/1000).toFixed(1)}s`);
if (final?.error) console.log(`ERROR: ${final.error}`);
