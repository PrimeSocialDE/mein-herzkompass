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
const LEAD_ID = "e9f61b78-c11a-4605-8701-2325b53c31af";
const { data } = await sb.from("wauwerk_leads").select("answers").eq("id", LEAD_ID).single();
console.log("Aktuelle answers.dog_gender:", data?.answers?.dog_gender);
await sb.from("wauwerk_leads").update({
  answers: { ...(data?.answers || {}), dog_gender: "m" },
}).eq("id", LEAD_ID);
console.log("Gesetzt: dog_gender = m");
