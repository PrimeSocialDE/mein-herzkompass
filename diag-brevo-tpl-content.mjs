import { readFileSync } from "node:fs";
const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
for (const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)])
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
const H = { "api-key": process.env.BREVO_API_KEY, accept: "application/json" };
const get = async p => { const r=await fetch("https://api.brevo.com"+p,{headers:H}); return r.ok?await r.json():{err:r.status}; };
const strip = h => (h||"").replace(/<style[\s\S]*?<\/style>/gi,"").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();

for(const id of [142, 166]){
  const t = await get(`/v3/smtp/templates/${id}`);
  if(t.err){ console.log(`#${id} -> Fehler ${t.err}`); continue; }
  console.log(`\n===== Template #${id}: ${t.name} =====`);
  console.log("Betreff:", t.subject);
  console.log("Absender:", t.sender?.email, "| aktiv:", t.isActive);
  console.log("Inhalt (Textauszug):");
  console.log(strip(t.htmlContent).slice(0, 700));
}
