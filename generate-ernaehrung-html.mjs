const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const dogName = "Buddy";
const breed = "Labrador";
const weight = "30kg";

const brown = '#C4A576';
const brownDark = '#8B7355';
const brownLight = '#FFF9F0';
const bg = '#FAF8F5';
const textDark = '#1a1a1a';
const textMed = '#555';
const textLight = '#999';
const green = '#22C55E';
const red = '#DC2626';
const redBg = '#FEF2F2';

async function run() {
  console.log("Generiere Daten...");

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      system: `Erstelle Ernährungsdaten für ${breed} (${weight}). KEIN Markdown. Antworte NUR als JSON:
{
  "intro": ["4 Sätze warum Ernährung für ${breed} wichtig ist.", "3 Sätze was diesen Plan besonders macht.", "2 Sätze wie man ihn nutzt + Support."],
  "morgens": { "zeit": "7:00 - 8:00 Uhr", "futter": "...", "zusatz": "...", "tipp": "..." },
  "mittags": { "zeit": "12:00 - 13:00 Uhr", "futter": "...", "zusatz": "...", "tipp": "..." },
  "abends": { "zeit": "18:00 - 19:00 Uhr", "futter": "...", "zusatz": "...", "tipp": "..." },
  "portionen": [["Trockenfutter","Xg/Tag"],["Nassfutter","Xg/Tag"],["Mischfütterung","..."],["BARF","..."],["Wasser","Xml/Tag"]],
  "naehrstoffe": [{"name":"Protein","menge":"22-25%","quellen":"Huhn, Rind, Lachs"},{"name":"Fett","menge":"12-15%","quellen":"Lachsöl, Hühnerfett"},{"name":"Ballaststoffe","menge":"3-5%","quellen":"Kürbis, Karotte"},{"name":"Kalzium","menge":"1-1.8%","quellen":"Knochen, Hüttenkäse"}],
  "snacks": [{"name":"...","menge":"...","info":"kurz"}],
  "rezepte": [{"name":"...","zutaten":"...","schritte":["S1","S2","S3","S4"],"haltbar":"..."}],
  "verboten": [{"name":"...","grund":"2 Sätze warum gefährlich"}],
  "notfall": ["Schritt1","Schritt2","Schritt3","Schritt4","Schritt5"],
  "futter_warnung": {"trockenfutter":["W1","W2","W3","W4","W5"],"nassfutter":["W1","W2","W3","W4","W5"],"tipp":"Was gutes Futter ausmacht"},
  "wochenplan": {"Mo":{"m":"Morgens","a":"Abends"},"Di":{"m":"...","a":"..."},"Mi":{"m":"...","a":"..."},"Do":{"m":"...","a":"..."},"Fr":{"m":"...","a":"..."},"Sa":{"m":"...","a":"..."},"So":{"m":"...","a":"..."}},
  "einkauf": [["Trockenfutter",["M1","M2","M3"]],["Nassfutter",["M1","M2","M3"]],["Zusätze",["P1","P2","P3"]],["Gemüse",["G1","G2","G3","G4"]],["Obst",["O1","O2","O3"]]]
}
8 Snacks, 5 Rezepte, 10 verbotene. Konkret für ${breed}, ${weight}.`,
      messages: [{ role: "user", content: `JSON für ${dogName} (${breed}, ${weight}).` }]
    })
  });

  if (!claudeRes.ok) { console.error(await claudeRes.text()); return; }
  const result = await claudeRes.json();
  let jsonText = result.content[0].text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const d = JSON.parse(jsonText);
  console.log("Daten OK, baue HTML...");

  // Helper
  const card = (content, style = '') => `<div style="background:white;border-radius:12px;padding:16px 18px;margin-bottom:8px;${style}">${content}</div>`;
  const badge = (text, color = brown) => `<span style="background:${color};color:white;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">${text}</span>`;

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#e8e4df;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:700px;margin:0 auto;padding:16px;">

<!-- TITEL -->
<div style="background:${bg};border-radius:16px;padding:50px 40px;margin-bottom:12px;text-align:center;">
  <div style="font-size:11px;font-weight:700;color:${brown};letter-spacing:2px;text-transform:uppercase;">PFOTEN-PLAN</div>
  <div style="width:40px;height:2px;background:${brown};margin:10px auto 20px;border-radius:1px;"></div>
  <h1 style="font-size:28px;font-weight:800;color:${textDark};margin:0 0 8px;">${dogName}'s Ernährungsplan</h1>
  <p style="font-size:13px;color:${textLight};margin:0;">Personalisiert für ${breed} · ${weight} · Erwachsen</p>
  <div style="display:flex;justify-content:center;gap:20px;margin-top:24px;">
    ${['5 Rezepte','8 Snacks','Wochenplan','Einkaufsliste'].map(s => `<span style="font-size:11px;color:${textMed};">${s}</span>`).join('<span style="color:#ddd;">·</span>')}
  </div>
</div>

<!-- EINLEITUNG -->
<div style="background:${bg};border-radius:16px;padding:28px 30px;margin-bottom:12px;">
  <h2 style="font-size:18px;font-weight:800;color:${textDark};margin:0 0 4px;">Warum ein Ernährungsplan für ${breed}?</h2>
  <div style="width:30px;height:2px;background:${brown};border-radius:1px;margin-bottom:16px;"></div>
  ${(d.intro || []).map(p => `<p style="font-size:13px;color:${textMed};line-height:1.7;margin:0 0 12px;">${p}</p>`).join('')}
</div>

<!-- TAGESPLAN -->
<div style="background:${bg};border-radius:16px;padding:28px 30px;margin-bottom:12px;">
  <h2 style="font-size:18px;font-weight:800;color:${textDark};margin:0 0 4px;">${dogName}'s Tagesplan</h2>
  <div style="width:30px;height:2px;background:${brown};border-radius:1px;margin-bottom:16px;"></div>
  <div style="display:flex;gap:10px;">
    ${[d.morgens, d.mittags, d.abends].map((m, i) => {
      const labels = ['Morgens', 'Mittags', 'Abends'];
      const colors = ['#F59E0B', '#22C55E', '#3B82F6'];
      return `<div style="flex:1;background:white;border-radius:12px;padding:16px;border-top:3px solid ${colors[i]};">
        <div style="font-size:14px;font-weight:700;color:${textDark};margin-bottom:2px;">${labels[i]}</div>
        <div style="font-size:11px;color:${textLight};margin-bottom:10px;">${m.zeit}</div>
        <div style="font-size:10px;font-weight:700;color:${brown};margin-bottom:2px;">Futter</div>
        <div style="font-size:12px;color:${textMed};margin-bottom:8px;">${m.futter}</div>
        <div style="font-size:10px;font-weight:700;color:${brown};margin-bottom:2px;">Zusatz</div>
        <div style="font-size:12px;color:${textMed};margin-bottom:8px;">${m.zusatz}</div>
        <div style="border-top:1px solid #eee;padding-top:8px;font-size:11px;color:${textLight};font-style:italic;">${m.tipp}</div>
      </div>`;
    }).join('')}
  </div>
  <div style="background:${brownLight};border-radius:10px;padding:12px 16px;margin-top:12px;">
    <div style="font-size:12px;font-weight:700;color:${brownDark};margin-bottom:6px;">Tägliche Portionen</div>
    ${(d.portionen || []).map(p => `<span style="font-size:11px;color:${textMed};margin-right:16px;"><strong>${p[0]}:</strong> ${p[1]}</span>`).join('')}
  </div>
</div>

<!-- NÄHRSTOFFE -->
<div style="background:${bg};border-radius:16px;padding:28px 30px;margin-bottom:12px;">
  <h2 style="font-size:18px;font-weight:800;color:${textDark};margin:0 0 4px;">Nährstoffe für ${breed}</h2>
  <div style="width:30px;height:2px;background:${brown};border-radius:1px;margin-bottom:16px;"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
    ${(d.naehrstoffe || []).map(n => `<div style="background:white;border-radius:12px;padding:14px 16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:14px;font-weight:700;color:${textDark};">${n.name}</span>
        <span style="font-size:14px;font-weight:700;color:${brown};">${n.menge}</span>
      </div>
      <div style="font-size:11px;color:${textLight};">Quellen: ${n.quellen}</div>
    </div>`).join('')}
  </div>
</div>

<!-- SNACKS -->
<div style="background:${bg};border-radius:16px;padding:28px 30px;margin-bottom:12px;">
  <h2 style="font-size:18px;font-weight:800;color:${textDark};margin:0 0 4px;">Gesunde Snacks</h2>
  <div style="width:30px;height:2px;background:${brown};border-radius:1px;margin-bottom:16px;"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
    ${(d.snacks || []).map(s => `<div style="background:white;border-radius:10px;padding:12px 14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;font-weight:700;color:${textDark};">${s.name}</span>
        <span style="font-size:10px;font-weight:600;color:${brown};">${s.menge}</span>
      </div>
      <div style="font-size:11px;color:${textLight};margin-top:3px;">${s.info}</div>
    </div>`).join('')}
  </div>
</div>

<!-- REZEPTE -->
<div style="background:${bg};border-radius:16px;padding:28px 30px;margin-bottom:12px;">
  <h2 style="font-size:18px;font-weight:800;color:${textDark};margin:0 0 4px;">Selbstgemachte Rezepte</h2>
  <div style="width:30px;height:2px;background:${brown};border-radius:1px;margin-bottom:16px;"></div>
  ${(d.rezepte || []).map(r => `<div style="background:white;border-radius:12px;padding:16px 18px;margin-bottom:10px;border-left:3px solid ${brown};">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <span style="font-size:14px;font-weight:700;color:${textDark};">${r.name}</span>
      <span style="font-size:10px;color:${textLight};">${r.haltbar}</span>
    </div>
    <div style="font-size:11px;color:${textMed};margin-bottom:10px;">${r.zutaten}</div>
    <div style="border-top:1px solid #eee;padding-top:8px;">
      ${r.schritte.map((s, i) => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
        <div style="width:22px;height:22px;background:${brown};border-radius:50%;color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</div>
        <span style="font-size:12px;color:${textMed};">${s}</span>
      </div>`).join('')}
    </div>
  </div>`).join('')}
</div>

<!-- WOCHENPLAN -->
<div style="background:${bg};border-radius:16px;padding:28px 30px;margin-bottom:12px;">
  <h2 style="font-size:18px;font-weight:800;color:${textDark};margin:0 0 4px;">Wochenplan</h2>
  <div style="width:30px;height:2px;background:${brown};border-radius:1px;margin-bottom:16px;"></div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;">
    ${Object.entries(d.wochenplan || {}).map(([day, plan]) => `<div style="background:white;border-radius:10px;padding:10px 8px;border-top:2px solid ${brown};">
      <div style="font-size:12px;font-weight:700;color:${textDark};text-align:center;margin-bottom:8px;">${day}</div>
      <div style="font-size:9px;font-weight:700;color:${brown};margin-bottom:2px;">Morgens</div>
      <div style="font-size:9px;color:${textMed};margin-bottom:8px;line-height:1.4;">${plan.m}</div>
      <div style="font-size:9px;font-weight:700;color:${brown};margin-bottom:2px;">Abends</div>
      <div style="font-size:9px;color:${textMed};line-height:1.4;">${plan.a}</div>
    </div>`).join('')}
  </div>
</div>

<!-- VERBOTEN -->
<div style="background:${bg};border-radius:16px;padding:28px 30px;margin-bottom:12px;">
  <h2 style="font-size:18px;font-weight:800;color:${textDark};margin:0 0 4px;">Das darf ${dogName} nicht essen</h2>
  <div style="width:30px;height:2px;background:${red};border-radius:1px;margin-bottom:16px;"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
    ${(d.verboten || []).map(v => `<div style="background:${redBg};border-radius:10px;padding:12px 14px;border-left:3px solid ${red};">
      <div style="font-size:12px;font-weight:700;color:${red};margin-bottom:4px;">${v.name}</div>
      <div style="font-size:11px;color:${textMed};line-height:1.4;">${v.grund}</div>
    </div>`).join('')}
  </div>
</div>

<!-- NOTFALL -->
<div style="background:${bg};border-radius:16px;padding:28px 30px;margin-bottom:12px;">
  <h2 style="font-size:18px;font-weight:800;color:${textDark};margin:0 0 4px;">Notfall: Vergiftung</h2>
  <div style="width:30px;height:2px;background:${red};border-radius:1px;margin-bottom:16px;"></div>
  ${(d.notfall || []).map((s, i) => `<div style="background:${i === 0 ? redBg : 'white'};border-radius:10px;padding:14px 16px;margin-bottom:8px;display:flex;gap:12px;align-items:center;${i === 0 ? `border-left:3px solid ${red};` : ''}">
    <div style="width:28px;height:28px;background:${i === 0 ? red : brown};border-radius:50%;color:white;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</div>
    <span style="font-size:13px;color:${textDark};">${s}</span>
  </div>`).join('')}
</div>

<!-- FUTTER-WARNUNG -->
<div style="background:${bg};border-radius:16px;padding:28px 30px;margin-bottom:12px;">
  <h2 style="font-size:18px;font-weight:800;color:${textDark};margin:0 0 4px;">Worauf du beim Futterkauf achten solltest</h2>
  <div style="width:30px;height:2px;background:${brown};border-radius:1px;margin-bottom:16px;"></div>
  <div style="display:flex;gap:12px;">
    <div style="flex:1;background:white;border-radius:12px;padding:16px;border-top:3px solid ${red};">
      <div style="font-size:13px;font-weight:700;color:${red};margin-bottom:10px;">Schlechtes Trockenfutter</div>
      ${(d.futter_warnung?.trockenfutter || []).map(w => `<div style="font-size:11px;color:${textMed};margin-bottom:6px;padding-left:14px;position:relative;line-height:1.4;"><span style="position:absolute;left:0;color:${red};font-weight:700;">x</span>${w}</div>`).join('')}
    </div>
    <div style="flex:1;background:white;border-radius:12px;padding:16px;border-top:3px solid ${red};">
      <div style="font-size:13px;font-weight:700;color:${red};margin-bottom:10px;">Schlechtes Nassfutter</div>
      ${(d.futter_warnung?.nassfutter || []).map(w => `<div style="font-size:11px;color:${textMed};margin-bottom:6px;padding-left:14px;position:relative;line-height:1.4;"><span style="position:absolute;left:0;color:${red};font-weight:700;">x</span>${w}</div>`).join('')}
    </div>
  </div>
  ${d.futter_warnung?.tipp ? `<div style="background:${brownLight};border-radius:10px;padding:12px 16px;margin-top:10px;font-size:11px;color:${brownDark};line-height:1.5;">${d.futter_warnung.tipp}</div>` : ''}
</div>

<!-- EINKAUFSLISTE -->
<div style="background:${bg};border-radius:16px;padding:28px 30px;margin-bottom:12px;">
  <h2 style="font-size:18px;font-weight:800;color:${textDark};margin:0 0 4px;">Einkaufsliste</h2>
  <div style="width:30px;height:2px;background:${brown};border-radius:1px;margin-bottom:16px;"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
    ${(d.einkauf || []).map(cat => `<div style="background:white;border-radius:12px;padding:14px;border-top:2px solid ${brown};">
      <div style="font-size:12px;font-weight:700;color:${textDark};margin-bottom:8px;">${cat[0]}</div>
      ${(cat[1] || []).map(item => `<div style="font-size:11px;color:${textMed};margin-bottom:4px;padding-left:16px;position:relative;"><span style="position:absolute;left:0;width:10px;height:10px;border:1.5px solid ${brown};border-radius:2px;display:inline-block;"></span>${item}</div>`).join('')}
    </div>`).join('')}
  </div>
</div>

<!-- ABSCHLUSS -->
<div style="background:${bg};border-radius:16px;padding:28px 30px;margin-bottom:12px;text-align:center;">
  <h2 style="font-size:18px;font-weight:800;color:${textDark};margin:0 0 4px;">Viel Erfolg mit ${dogName}.</h2>
  <div style="width:30px;height:2px;background:${brown};border-radius:1px;margin:8px auto 16px;"></div>
  <p style="font-size:13px;color:${textMed};line-height:1.7;max-width:500px;margin:0 auto 12px;">Gute Ernährung ist die Basis für ein gesundes Hundeleben. Beobachte wie ${dogName} reagiert - Fell, Energie und Verdauung zeigen dir ob alles passt.</p>
  <p style="font-size:12px;color:${textLight};">Fragen? support@pfoten-plan.de</p>
</div>

<p style="text-align:center;font-size:10px;color:#bbb;padding:10px 0;">Pfoten-Plan · Ernährungsplan für ${dogName}</p>
</div></body></html>`;

  console.log("HTML fertig, sende...");

  const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
      to: [{ email: "kontakt@primesocial.de" }],
      subject: `[HTML FINAL] Ernährungsplan für ${dogName}`,
      htmlContent: html
    })
  });

  if (emailRes.ok) console.log("Gesendet!");
  else console.error("Error:", await emailRes.text());
}

run().catch(console.error);
