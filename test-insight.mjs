import { readFileSync } from "node:fs";
try { const e=readFileSync(new URL("./.env.local",import.meta.url),"utf8"); for(const l of e.split("\n")){const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");}}catch{}
const Anthropic=(await import("@anthropic-ai/sdk")).default;
const dog="Bruno", breed="Labrador-Mix";
const ctx=`Name: Bruno\nRasse: Labrador-Mix\nAlter: adult\nHauptthema: Leinenziehen\nBeobachtetes Verhalten: zieht stark an der Leine, springt Besucher an, sehr verspielt, liebt Wasser\nKann schon: Sitz, Platz`;
const system=`Du bist der Pfoten-Plan KI-Trainer. Erstelle ein warmes, konkretes "${dog} verstehen"-Profil. SPEZIFISCH + rasse-fundiert, keine Floskeln. Du-Ansprache, deutsch. Gib AUSSCHLIESSLICH gueltiges JSON zurueck: {"title":string,"intro":string,"sections":[{"emoji":string,"heading":string,"text":string}],"note":string}. Erzeuge 4 sections: 1.🧭 "So tickt ${dog}" 2.🧬 "${breed}-Instinkte" 3.💬 "Wie ${dog} mit dir spricht" 4.❤️ "Was ${dog} jetzt braucht".`;
const a=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});
const t=Date.now();
try{
  const r=await a.messages.create({model:"claude-sonnet-4-6",max_tokens:1200,system,messages:[{role:"user",content:"Hier sind die Daten:\n"+ctx}]});
  const raw=r.content.filter(c=>c.type==="text").map(c=>c.text).join("").trim();
  console.log(`Dauer: ${((Date.now()-t)/1000).toFixed(1)}s | Key vorhanden: ${!!process.env.ANTHROPIC_API_KEY}`);
  const j=raw.slice(raw.indexOf("{"),raw.lastIndexOf("}")+1);
  const p=JSON.parse(j);
  console.log("✅ JSON valide. Output:\n");
  console.log("TITLE:",p.title);console.log("INTRO:",p.intro);
  for(const s of p.sections){console.log(`\n${s.emoji} ${s.heading}\n  ${s.text}`);}
  console.log("\nNOTE:",p.note);
}catch(e){ console.log(`Dauer bis Fehler: ${((Date.now()-t)/1000).toFixed(1)}s`); console.error("❌ FEHLER:",e.status||"",e.message); }
