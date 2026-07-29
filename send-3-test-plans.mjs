// Schickt 3 Test-Plaene (energy, pulling, aggression) als 1-Monats-Plaene
// an max@primesocial.de. Jeder neue Plan ueberschreibt den vorherigen
// in member_plan_content, aber jede Mail geht trotzdem raus.

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
const BASE_URL = "https://www.pfoten-plan.de";
const LEAD_ID = "e9f61b78-c11a-4605-8701-2325b53c31af"; // max 1month lead

const TESTS = [
  {
    problem: "energy",
    customText: "Bruno hat unglaublich viel Energie, kommt zuhause kaum runter, hechelt staendig. Auch nach langem Spaziergang bleibt er aufgedreht.",
  },
  {
    problem: "pulling",
    customText: "Bruno zieht extrem an der Leine, sobald andere Hunde oder Jogger in Sicht sind. Zu Hause an der Tuer dreht er komplett auf.",
  },
  {
    problem: "aggression",
    customText: "Bruno bellt und zieht aggressiv in der Leine wenn er andere Hunde sieht. Begegnungen sind sehr schwierig geworden.",
  },
];

for (const test of TESTS) {
  console.log(`\n══════ ${test.problem.toUpperCase()} ══════`);

  // 1) Alten Plan loeschen
  await sb.from("member_plan_content").delete().ilike("email", EMAIL);

  // 2) Lead-Answers anpassen (dog_problem + customProblemText)
  const { data: lead } = await sb
    .from("wauwerk_leads")
    .select("answers")
    .eq("id", LEAD_ID)
    .single();
  const newAnswers = {
    ...(lead?.answers || {}),
    dog_problem: test.problem,
    custom_problem_text: test.customText,
  };
  await sb.from("wauwerk_leads").update({ answers: newAnswers }).eq("id", LEAD_ID);

  // 3) /plan/generate direkt aufrufen mit force=true, plan_length_months=1
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/api/mitglieder/plan/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({
      lead_id: LEAD_ID,
      email: EMAIL,
      force: true,
      plan_length_months: 1,
    }),
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
  const dur = Date.now() - t0;
  console.log(`\n  -> ok=${final?.ok} weeks=${final?.weeks_count} dauer=${(dur/1000).toFixed(1)}s`);
  if (final?.error) console.log(`     ERROR: ${final.error}`);
}

console.log(`\nFertig. Drei Mails sollten in ${EMAIL}s Postfach sein.`);
