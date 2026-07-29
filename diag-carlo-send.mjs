import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
const { buildPdfFromContent } = await import("./generate-plan-from-content.mjs");
const BASE="https://www.pfoten-plan.de", TOKEN=process.env.WORKER_TOKEN, KEY=process.env.BREVO_API_KEY;
const LEAD_ID="5102f843-3476-4ea6-9e7b-f6a5ccb5ae5b";
const LEAD_EMAIL="gaby131063@gmail.com";
const USER_ID="992e4770-5c71-4761-8a17-aa8f0c5df307";
const TARGET="gaby@nordberg.info";

// 1) Plan-Content generieren (no_mail)
console.log("=== 1) Plan-Content generieren (no_mail) ===");
const r1 = await fetch(`${BASE}/api/mitglieder/plan/generate`, {
  method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${TOKEN}` },
  body: JSON.stringify({ lead_id: LEAD_ID, email: LEAD_EMAIL, no_mail: true, force: true }),
});
const t1 = await r1.text(); let done=null;
for (const line of t1.split("\n").filter(Boolean)) { try { const o=JSON.parse(line); if(o.event==="done") done=o; } catch {} }
console.log("DONE:", JSON.stringify(done));

// 2) Content holen + PDF bauen
const { data: rows } = await sb.from("member_plan_content").select("*").eq("user_id", USER_ID).order("created_at",{ascending:false}).limit(1);
const content = rows[0].content;
console.log("Plan-Content:", rows[0].id, "weeks:", content.weeks?.length);
const pdf = await buildPdfFromContent({ plan: content, dogName:"Carlo", dogBreed:"Mischling", dogAge:"senior", mainProblem:"Leinenführigkeit & Ziehen an der Leine", planLengthMonths:3, verbose:false });
const b64 = Buffer.from(pdf).toString("base64");
console.log("PDF KB:", (Buffer.from(pdf).length/1024).toFixed(0));

// 3) Plan an TARGET
console.log("=== 2) 3-Monats-Plan an", TARGET, "===");
const r2 = await fetch("https://api.brevo.com/v3/smtp/email", {
  method:"POST", headers:{ "api-key":KEY, "Content-Type":"application/json" },
  body: JSON.stringify({
    sender:{ name:"Max von Pfoten-Plan", email:"support@pfoten-plan.de" },
    to:[{ email: TARGET }],
    subject:"🐾 Dein 3-Monats-Plan für Carlo",
    htmlContent:`<p>Hallo,</p><p>im Anhang findest du <b>Carlos persönlichen 3-Monats-Trainingsplan</b> (12 Wochen) als PDF — digital nutzbar oder zum Ausdrucken.</p><p>Die <b>10 Notfall-Karten</b> für Carlo kommen in einer separaten Mail.</p><p>Liebe Grüße<br>Max von Pfoten-Plan</p>`,
    attachment:[{ name:"Pfoten-Plan-Carlo-3M.pdf", content: b64 }],
  }),
});
console.log("Plan HTTP", r2.status, r2.ok ? "OK" : (await r2.text()).slice(0,200));

// 4) Notfallkarten an TARGET
console.log("=== 3) 10 Notfallkarten an", TARGET, "===");
const r3 = await fetch(`${BASE}/api/notfall-karten/generate`, {
  method:"POST", headers:{ "Content-Type":"application/json" },
  body: JSON.stringify({ email: TARGET, dogName: "Carlo" }),
});
console.log("Notfallkarten HTTP", r3.status, (await r3.text()).slice(0,200));
