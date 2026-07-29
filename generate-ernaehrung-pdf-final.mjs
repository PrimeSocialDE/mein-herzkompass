import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const dogName = "Buddy";
const breed = "Labrador";
const weight = "30kg";

async function run() {
  console.log("Generiere Daten...");

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: `Erstelle SEHR ausführliche Ernährungsdaten für ${breed} (${weight}). KEIN Markdown. Antworte NUR als JSON:
{
  "intro": [
    "5-6 Sätze: Warum Ernährung speziell für ${breed} besonders wichtig ist. ${breed} neigen zu Übergewicht, haben empfindliche Gelenke und einen unstillbaren Appetit. Was falsche Ernährung langfristig anrichtet (Gelenkprobleme, stumpfes Fell, Energielosigkeit, Verdauungsprobleme). Konkret auf ${breed} bezogen.",
    "4-5 Sätze: Was diesen Plan besonders macht. Dass er auf ${breed} mit ${weight} zugeschnitten ist. Konkrete Grammangaben statt pauschaler Tipps. Von Hundeernährungs-Experten zusammengestellt. Regelmäßig aktualisiert.",
    "3-4 Sätze: Wie man den Plan im Alltag nutzt. Am besten ausdrucken und an den Kühlschrank hängen. Mengen langsam anpassen. Bei Fragen Team unter support@pfoten-plan.de erreichbar."
  ],
  "rasse_besonderheiten": [
    "Besonderheit 1 der Rasse bei Ernährung - 2 Sätze Erklärung",
    "Besonderheit 2 - 2 Sätze",
    "Besonderheit 3 - 2 Sätze",
    "Besonderheit 4 - 2 Sätze"
  ],
  "morgens": { "zeit": "7:00 - 8:00 Uhr", "futter": "konkret mit Gramm", "zusatz": "konkret", "vorbereitung": "wie zubereiten, Temperatur etc.", "tipp": "praktischer Tipp" },
  "mittags": { "zeit": "12:00 - 13:00 Uhr", "futter": "konkret", "zusatz": "konkret", "vorbereitung": "...", "tipp": "..." },
  "abends": { "zeit": "18:00 - 19:00 Uhr", "futter": "konkret mit Gramm", "zusatz": "konkret", "vorbereitung": "...", "tipp": "..." },
  "portionen": [["Trockenfutter","Xg/Tag"],["Nassfutter","Xg/Tag"],["Mischfütterung","Verhältnis"],["BARF","Aufteilung"],["Wasser","Xml/Tag"]],
  "naehrstoffe": [
    {"name":"Protein","menge":"22-25%","quellen":"Huhn, Rind, Lachs, Lamm","erklaerung":"3 Sätze warum Protein für ${breed} wichtig ist und was bei Mangel passiert"},
    {"name":"Fett","menge":"12-15%","quellen":"Lachsöl, Hühnerfett, Leinsamen","erklaerung":"3 Sätze über Fett, Omega-3/6 und Fellgesundheit"},
    {"name":"Ballaststoffe","menge":"3-5%","quellen":"Kürbis, Karotte, Reis","erklaerung":"3 Sätze über Verdauung und warum ${breed} Ballaststoffe braucht"},
    {"name":"Kalzium","menge":"1-1.8%","quellen":"Knochen, Hüttenkäse, Eierschale","erklaerung":"3 Sätze über Knochen und Gelenke, besonders wichtig für ${breed}"},
    {"name":"Omega-3","menge":"0.5-1%","quellen":"Lachsöl, Leinsamen, Fischöl","erklaerung":"3 Sätze über Fell, Haut und Entzündungen"}
  ],
  "snacks": [
    {"name":"...","menge":"...","info":"2-3 Sätze warum gut, wann geben, worauf achten"},
    "... (8 Stück, jeweils ausführlich)"
  ],
  "rezepte": [
    {"name":"...","zutaten":"Zutat1 (Xg), Zutat2 (Xg), Zutat3","schritte":["Schritt 1 ausführlich","S2","S3","S4","S5","S6"],"haltbar":"...","anlass":"Wann geben (Training, Belohnung, etc.)","variation":"Alternative Zutat oder Variation"},
    "... (5 Rezepte, jeweils 6 Schritte + Anlass + Variation)"
  ],
  "verboten": [
    {"name":"...","grund":"2-3 Sätze warum gefährlich","symptome":"Welche Symptome auftreten","sofort":"Was sofort tun"},
    "... (10 Stück, jeweils ausführlich)"
  ],
  "notfall": ["Ausführlicher Schritt 1 mit Erklärung","Schritt 2","Schritt 3","Schritt 4","Schritt 5"],
  "haeufige_fehler": [
    {"fehler":"Fehler 1","warum":"Warum das schlecht ist - 2 Sätze","besser":"Was man stattdessen tun soll"},
    "... (6 häufige Ernährungsfehler bei ${breed})"
  ],
  "gewichtskontrolle": {
    "idealgewicht": "X-Y kg für ${breed}",
    "rippentest": "3 Sätze wie der Rippen-Test funktioniert",
    "wiegen": "Wie oft wiegen und worauf achten",
    "zeichen_uebergewicht": ["Zeichen 1","Z2","Z3","Z4"],
    "zeichen_untergewicht": ["Zeichen 1","Z2","Z3"]
  },
  "futter_warnung": {"trockenfutter":["Warnsignal 1 (1 Satz)","W2","W3","W4","W5"],"nassfutter":["W1","W2","W3","W4","W5"],"tipp":"2 Sätze was gutes Futter ausmacht"},
  "wochenplan": {"Mo":{"m":"Morgens konkret","s":"Mittags-Snack","a":"Abends konkret"},"Di":{"m":"...","s":"...","a":"..."},"Mi":{"m":"...","s":"...","a":"..."},"Do":{"m":"...","s":"...","a":"..."},"Fr":{"m":"...","s":"...","a":"..."},"Sa":{"m":"...","s":"...","a":"..."},"So":{"m":"...","s":"...","a":"..."}},
  "einkauf": [["Trockenfutter",["Marke1","Marke2","Marke3"]],["Nassfutter",["M1","M2","M3"]],["Zusätze",["P1","P2","P3"]],["Gemüse",["G1","G2","G3","G4","G5"]],["Obst",["O1","O2","O3","O4"]]]
}
8 Snacks, 5 Rezepte, 10 verbotene, 6 häufige Fehler. Alles SEHR ausführlich und konkret für ${breed}, ${weight}, erwachsen.`,
      messages: [{ role: "user", content: `Ausführliche JSON-Ernährungsdaten für ${dogName} (${breed}, ${weight}). Bitte so detailliert wie möglich.` }]
    })
  });

  if (!claudeRes.ok) { console.error(await claudeRes.text()); return; }
  const result = await claudeRes.json();
  let jsonText = result.content[0].text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  // Fix common JSON issues from Claude
  jsonText = jsonText.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
  // If JSON is truncated, try to close it
  if (!jsonText.endsWith('}')) {
    const openBraces = (jsonText.match(/{/g) || []).length;
    const closeBraces = (jsonText.match(/}/g) || []).length;
    for (let i = 0; i < openBraces - closeBraces; i++) jsonText += '}';
    const openBrackets = (jsonText.match(/\[/g) || []).length;
    const closeBrackets = (jsonText.match(/]/g) || []).length;
    for (let i = 0; i < openBrackets - closeBrackets; i++) jsonText += ']';
    if (!jsonText.endsWith('}')) jsonText += '}';
  }
  let d;
  try { d = JSON.parse(jsonText); }
  catch(e) {
    console.error("JSON parse error, versuche Reparatur...", e.message);
    // Try fixing by finding last valid position
    for (let i = jsonText.length; i > 100; i--) {
      try { d = JSON.parse(jsonText.substring(0, i) + ']}]}'); break; } catch {}
      try { d = JSON.parse(jsonText.substring(0, i) + '"]}]}'); break; } catch {}
    }
    if (!d) { console.error("JSON konnte nicht repariert werden"); return; }
  }
  console.log("Daten OK, baue HTML...");

  const brown = '#C4A576';
  const brownDark = '#8B7355';
  const brownLight = '#FFF9F0';
  const bg = '#FAF8F5';
  const red = '#DC2626';
  const redBg = '#FEF2F2';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #e8e4df; color: #1a1a1a; }
  .page { width: 297mm; min-height: 210mm; background: ${bg}; padding: 24px 36px; page-break-after: always; position: relative; }
  .page.flow { min-height: auto; page-break-after: auto; page-break-inside: avoid; }
  .page:last-child { page-break-after: auto; }
  .no-break { page-break-inside: avoid; }
  .intro-text { font-size: 12px; color: #888; line-height: 1.5; margin-bottom: 14px; }
  .header { position: absolute; top: 0; left: 0; right: 0; height: 2px; background: ${brown}; }
  .header-text { position: absolute; top: 10px; left: 36px; font-size: 8px; font-weight: 700; color: #bbb; letter-spacing: 1px; }
  .page-num { position: absolute; bottom: 12px; right: 36px; font-size: 9px; color: #bbb; font-weight: 600; }
  h2 { font-size: 22px; font-weight: 800; color: #1a1a1a; margin-bottom: 4px; }
  .accent-line { width: 35px; height: 2px; background: ${brown}; border-radius: 1px; margin-bottom: 18px; }
  .card { background: white; border-radius: 12px; padding: 16px 18px; }
  .card-grid { display: grid; gap: 10px; }
  .grid-2 { grid-template-columns: 1fr 1fr; }
  .grid-3 { grid-template-columns: 1fr 1fr 1fr; }
  .grid-7 { grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .label { font-size: 10px; font-weight: 700; color: ${brown}; margin-bottom: 3px; }
  .value { font-size: 12px; color: #555; line-height: 1.5; }
  .meal-card { border-top: 3px solid; border-radius: 12px; padding: 16px; background: white; }
  .meal-title { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
  .meal-time { font-size: 10px; color: #999; margin-bottom: 10px; }
  .divider { border-top: 1px solid #eee; margin: 8px 0; }
  .tip { font-size: 11px; color: #999; font-style: italic; padding-top: 8px; border-top: 1px solid #eee; }
  .portion-bar { background: ${brownLight}; border-radius: 10px; padding: 12px 18px; margin-top: 12px; font-size: 11px; color: #555; }
  .portion-bar strong { color: ${brownDark}; }
  .nutrient-card { background: white; border-radius: 12px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; }
  .nutrient-name { font-size: 14px; font-weight: 700; }
  .nutrient-amount { font-size: 14px; font-weight: 700; color: ${brown}; }
  .nutrient-sources { font-size: 11px; color: #999; margin-top: 4px; }
  .snack-card { background: white; border-radius: 10px; padding: 12px 14px; }
  .snack-header { display: flex; justify-content: space-between; align-items: center; }
  .snack-name { font-size: 12px; font-weight: 700; }
  .snack-amount { font-size: 10px; font-weight: 600; color: ${brown}; }
  .snack-info { font-size: 11px; color: #999; margin-top: 3px; }
  .recipe-card { background: white; border-radius: 12px; padding: 16px 18px; border-left: 3px solid ${brown}; margin-bottom: 10px; }
  .recipe-title { font-size: 14px; font-weight: 700; }
  .recipe-meta { font-size: 10px; color: #999; }
  .recipe-ingredients { font-size: 11px; color: #555; margin: 6px 0 10px; }
  .step { display: flex; gap: 10px; align-items: center; margin-bottom: 7px; }
  .step-num { width: 24px; height: 24px; background: ${brown}; border-radius: 50%; color: white; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .step-text { font-size: 12px; color: #555; }
  .week-card { background: white; border-radius: 10px; padding: 8px 6px; border-top: 2px solid ${brown}; text-align: center; }
  .week-day { font-size: 11px; font-weight: 700; margin-bottom: 6px; }
  .week-label { font-size: 8px; font-weight: 700; color: ${brown}; text-align: left; margin-bottom: 1px; }
  .week-text { font-size: 8px; color: #555; text-align: left; margin-bottom: 6px; line-height: 1.3; }
  .warn-card { background: ${redBg}; border-radius: 10px; padding: 12px 14px; border-left: 3px solid ${red}; }
  .warn-name { font-size: 12px; font-weight: 700; color: ${red}; margin-bottom: 4px; }
  .warn-reason { font-size: 11px; color: #555; line-height: 1.4; }
  .notfall-step { display: flex; gap: 12px; align-items: center; padding: 14px 16px; border-radius: 10px; margin-bottom: 8px; }
  .notfall-step.first { background: ${redBg}; border-left: 3px solid ${red}; }
  .notfall-step:not(.first) { background: white; }
  .notfall-num { width: 30px; height: 30px; border-radius: 50%; color: white; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .notfall-num.red { background: ${red}; }
  .notfall-num.brown { background: ${brown}; }
  .futter-col { flex: 1; background: white; border-radius: 12px; padding: 16px; border-top: 3px solid ${red}; }
  .futter-title { font-size: 13px; font-weight: 700; color: ${red}; margin-bottom: 10px; }
  .futter-item { font-size: 11px; color: #555; margin-bottom: 6px; padding-left: 14px; position: relative; line-height: 1.4; }
  .futter-item::before { content: "x"; position: absolute; left: 0; color: ${red}; font-weight: 700; }
  .futter-tipp { background: ${brownLight}; border-radius: 10px; padding: 12px 16px; margin-top: 10px; font-size: 11px; color: ${brownDark}; line-height: 1.5; }
  .einkauf-card { background: white; border-radius: 12px; padding: 14px; border-top: 2px solid ${brown}; }
  .einkauf-title { font-size: 12px; font-weight: 700; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  .einkauf-item { font-size: 11px; color: #555; margin-bottom: 5px; padding-left: 18px; position: relative; }
  .einkauf-item::before { content: ""; position: absolute; left: 0; top: 2px; width: 10px; height: 10px; border: 1.5px solid ${brown}; border-radius: 2px; }
</style></head><body>

<!-- TITEL -->
<div class="page" style="display:flex;align-items:center;">
  <div>
    <div style="font-size:10px;font-weight:700;color:${brown};letter-spacing:2px;text-transform:uppercase;">PFOTEN-PLAN</div>
    <div style="width:35px;height:2px;background:${brown};margin:10px 0 24px;border-radius:1px;"></div>
    <h1 style="font-size:36px;font-weight:800;line-height:1.15;margin-bottom:10px;">${dogName}'s<br>Ernährungsplan</h1>
    <p style="font-size:13px;color:#999;">Personalisiert für ${breed} · ${weight} · Erwachsen</p>
    <div style="display:flex;gap:20px;margin-top:30px;">
      ${['5 Rezepte','8 Snacks','Wochenplan','Einkaufsliste'].map(s => `<span style="font-size:11px;color:#aaa;">${s}</span>`).join('<span style="color:#ddd;">·</span>')}
    </div>
  </div>
</div>

<!-- EINLEITUNG -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERNÄHRUNGSPLAN</div>
  <div style="margin-top:20px;">
    <h2>Warum ein Ernährungsplan für ${breed}?</h2>
    <div class="accent-line"></div>
    ${(d.intro||[]).map(p=>`<p style="font-size:13px;color:#555;line-height:1.7;margin-bottom:14px;">${p}</p>`).join('')}
    ${d.rasse_besonderheiten ? `
    <h3 style="font-size:15px;font-weight:700;color:#1a1a1a;margin:20px 0 4px;">Was ${breed} besonders macht</h3>
    <div style="width:25px;height:2px;background:${brown};border-radius:1px;margin-bottom:14px;"></div>
    <div class="card-grid grid-2">
      ${d.rasse_besonderheiten.map((b,i)=>`<div style="background:white;border-radius:10px;padding:12px 14px;display:flex;gap:10px;align-items:flex-start;">
        <div style="width:24px;height:24px;background:${brown};border-radius:50%;color:white;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</div>
        <span style="font-size:12px;color:#555;line-height:1.5;">${b}</span>
      </div>`).join('')}
    </div>` : ''}
  </div>
  <div class="page-num">2</div>
</div>

<!-- TAGESPLAN -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERNÄHRUNGSPLAN</div>
  <div style="margin-top:20px;">
    <h2>${dogName}'s Tagesplan</h2>
    <div class="accent-line"></div>
    <p class="intro-text">So sieht ein optimaler Tag für ${dogName} aus. Halte dich an die Zeiten und Mengen - Regelmäßigkeit ist der Schlüssel zu guter Verdauung.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
      ${[['Morgens','#F59E0B',d.morgens],['Mittags','#22C55E',d.mittags],['Abends','#3B82F6',d.abends]].map(([lbl,col,m])=>`
        <div class="meal-card" style="border-top-color:${col};">
          <div class="meal-title">${lbl}</div>
          <div class="meal-time">${m.zeit}</div>
          <div class="label">Futter</div>
          <div class="value" style="margin-bottom:8px;">${m.futter}</div>
          <div class="label">Zusatz</div>
          <div class="value">${m.zusatz}</div>
          ${m.vorbereitung ? `<div class="label" style="margin-top:6px;">Zubereitung</div><div class="value">${m.vorbereitung}</div>` : ''}
          <div class="tip">${m.tipp}</div>
        </div>`).join('')}
    </div>
    <div class="portion-bar">
      <strong>Tägliche Portionen:</strong>
      ${(d.portionen||[]).map(p=>`<span style="margin-left:14px;"><strong>${p[0]}:</strong> ${p[1]}</span>`).join('')}
    </div>
  </div>
  <div class="page-num">3</div>
</div>

<!-- NÄHRSTOFFE -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERNÄHRUNGSPLAN</div>
  <div style="margin-top:20px;">
    <h2>Nährstoffe für ${breed}</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Das muss in gutem Futter drin sein. Achte bei der Futterauswahl auf diese Werte - sie sind speziell auf ${breed} abgestimmt.</p>
    <div class="card-grid grid-2">
      ${(d.naehrstoffe||[]).map(n=>`<div style="background:white;border-radius:12px;padding:14px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:14px;font-weight:700;">${n.name}</span>
          <span style="font-size:14px;font-weight:700;color:${brown};">${n.menge}</span>
        </div>
        <div style="font-size:11px;color:#999;margin-bottom:6px;">Quellen: ${n.quellen}</div>
        ${n.erklaerung ? `<div style="font-size:11px;color:#555;line-height:1.5;border-top:1px solid #eee;padding-top:6px;">${n.erklaerung}</div>` : ''}
      </div>`).join('')}
    </div>
  </div>
  <div class="page-num">4</div>
</div>

<!-- SNACKS -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERNÄHRUNGSPLAN</div>
  <div style="margin-top:20px;">
    <h2>Gesunde Snacks</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Diese Snacks sind gesund, kalorienarm und perfekt als Belohnung beim Training. Snacks sollten maximal 10% der Tagesration ausmachen.</p>
    <div class="card-grid grid-2">
      ${(d.snacks||[]).map(s=>`<div class="snack-card"><div class="snack-header"><span class="snack-name">${s.name}</span><span class="snack-amount">${s.menge}</span></div><div style="font-size:11px;color:#555;margin-top:4px;line-height:1.5;">${s.info}</div></div>`).join('')}
    </div>
  </div>
  <div class="page-num">5</div>
</div>

<!-- REZEPTE -->
<div class="page flow">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERNÄHRUNGSPLAN</div>
  <div style="margin-top:20px;">
    <h2>Selbstgemachte Rezepte</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Gesunde Leckerlis einfach selbst machen - mit wenigen Zutaten, schnell zubereitet und perfekt als Trainingsbelohnung oder Beschäftigung für ${dogName}.</p>
    ${(d.rezepte||[]).map(r=>`<div class="recipe-card no-break">
      <div style="display:flex;justify-content:space-between;"><span class="recipe-title">${r.name}</span><span class="recipe-meta">${r.haltbar}</span></div>
      <div class="recipe-ingredients">${r.zutaten}</div>
      <div class="divider"></div>
      ${r.schritte.map((s,i)=>`<div class="step"><div class="step-num">${i+1}</div><div class="step-text">${s}</div></div>`).join('')}
      ${r.anlass || r.variation ? `<div style="border-top:1px solid #eee;padding-top:8px;margin-top:4px;display:flex;gap:20px;">
        ${r.anlass ? `<span style="font-size:10px;color:#999;"><strong style="color:${brownDark};">Anlass:</strong> ${r.anlass}</span>` : ''}
        ${r.variation ? `<span style="font-size:10px;color:#999;"><strong style="color:${brownDark};">Variation:</strong> ${r.variation}</span>` : ''}
      </div>` : ''}
    </div>`).join('')}
  </div>
  <div class="page-num">6</div>
</div>

<!-- WOCHENPLAN -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERNÄHRUNGSPLAN</div>
  <div style="margin-top:20px;">
    <h2>Empfohlener Wochenplan</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Eine Empfehlung zur Orientierung - du kannst die Mahlzeiten flexibel anpassen und variieren. Jede Woche wiederholbar.</p>
    <div class="grid-7" style="display:grid;">
      ${Object.entries(d.wochenplan||{}).map(([day,p])=>`<div class="week-card">
        <div class="week-day">${day}</div>
        <div class="week-label">Morgens</div>
        <div class="week-text">${p.m}</div>
        ${p.s ? `<div class="week-label">Snack</div><div class="week-text">${p.s}</div>` : ''}
        <div class="week-label">Abends</div>
        <div class="week-text">${p.a}</div>
      </div>`).join('')}
    </div>
  </div>
  <div class="page-num">7</div>
</div>

<!-- VERBOTEN -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERNÄHRUNGSPLAN</div>
  <div style="margin-top:20px;">
    <h2>Das darf ${dogName} nicht essen</h2>
    <div class="accent-line" style="background:${red};"></div>
    <p style="font-size:12px;color:#888;margin-bottom:14px;">Diese Lebensmittel sind giftig oder gefährlich. Auch kleine Mengen können ernste Folgen haben. Im Zweifelsfall: sofort zum Tierarzt.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      ${(d.verboten||[]).map(v=>`<div style="background:${redBg};border-radius:8px;padding:10px 12px;border-left:3px solid ${red};">
        <div style="font-size:11px;font-weight:700;color:${red};margin-bottom:3px;">${v.name}</div>
        <div style="font-size:10px;color:#555;line-height:1.4;">${v.grund}</div>
        ${v.symptome ? `<div style="font-size:9px;color:#999;margin-top:3px;line-height:1.3;">${v.symptome}</div>` : ''}
      </div>`).join('')}
    </div>
  </div>
  <div class="page-num">8</div>
</div>

<!-- NOTFALL -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERNÄHRUNGSPLAN</div>
  <div style="margin-top:20px;">
    <h2>Notfall: Vergiftung</h2>
    <div class="accent-line" style="background:${red};"></div>
    <p class="intro-text">Wenn ${dogName} etwas Giftiges gefressen hat, zählt jede Minute. Befolge diese 5 Schritte der Reihe nach.</p>
    ${(d.notfall||[]).map((s,i)=>`<div class="notfall-step ${i===0?'first':''}"><div class="notfall-num ${i===0?'red':'brown'}">${i+1}</div><span style="font-size:13px;">${s}</span></div>`).join('')}
  </div>
  <div class="page-num">9</div>
</div>

<!-- FUTTER-WARNUNG -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERNÄHRUNGSPLAN</div>
  <div style="margin-top:20px;">
    <h2>Worauf du beim Futterkauf achten solltest</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Nicht alles was "Premium" draufsteht, ist auch gut. Hier erkennst du auf einen Blick, ob das Futter wirklich hochwertig ist.</p>
    <div style="display:flex;gap:12px;">
      <div class="futter-col"><div class="futter-title">Schlechtes Trockenfutter</div>${(d.futter_warnung?.trockenfutter||[]).map(w=>`<div class="futter-item">${w}</div>`).join('')}</div>
      <div class="futter-col"><div class="futter-title">Schlechtes Nassfutter</div>${(d.futter_warnung?.nassfutter||[]).map(w=>`<div class="futter-item">${w}</div>`).join('')}</div>
    </div>
    ${d.futter_warnung?.tipp?`<div class="futter-tipp">${d.futter_warnung.tipp}</div>`:''}
  </div>
  <div class="page-num">10</div>
</div>

<!-- HÄUFIGE FEHLER -->
${d.haeufige_fehler ? `<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERNÄHRUNGSPLAN</div>
  <div style="margin-top:20px;">
    <h2>Häufige Ernährungsfehler bei ${breed}</h2>
    <div class="accent-line"></div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${d.haeufige_fehler.map((f,i)=>`<div style="background:white;border-radius:12px;padding:14px 18px;display:flex;gap:14px;align-items:flex-start;">
        <div style="width:28px;height:28px;background:${red};border-radius:50%;color:white;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:3px;">${f.fehler}</div>
          <div style="font-size:11px;color:#555;line-height:1.5;margin-bottom:4px;">${f.warum}</div>
          <div style="font-size:11px;color:${brownDark};font-weight:600;">Besser: ${f.besser}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>
  <div class="page-num">12</div>
</div>` : ''}

<!-- GEWICHTSKONTROLLE -->
${d.gewichtskontrolle ? `<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERNÄHRUNGSPLAN</div>
  <div style="margin-top:20px;">
    <h2>Gewichtskontrolle für ${dogName}</h2>
    <div class="accent-line"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      <div style="background:white;border-radius:12px;padding:16px;border-top:3px solid ${brown};">
        <div style="font-size:14px;font-weight:700;margin-bottom:4px;">Idealgewicht</div>
        <div style="font-size:22px;font-weight:800;color:${brown};">${d.gewichtskontrolle.idealgewicht}</div>
      </div>
      <div style="background:white;border-radius:12px;padding:16px;border-top:3px solid ${brown};">
        <div style="font-size:14px;font-weight:700;margin-bottom:4px;">Rippen-Test</div>
        <div style="font-size:12px;color:#555;line-height:1.5;">${d.gewichtskontrolle.rippentest}</div>
      </div>
    </div>
    <div style="background:white;border-radius:12px;padding:16px;margin-bottom:12px;">
      <div style="font-size:13px;font-weight:700;margin-bottom:6px;">Wie oft wiegen?</div>
      <div style="font-size:12px;color:#555;line-height:1.5;">${d.gewichtskontrolle.wiegen}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="background:${redBg};border-radius:12px;padding:14px;border-left:3px solid ${red};">
        <div style="font-size:12px;font-weight:700;color:${red};margin-bottom:8px;">Zeichen für Übergewicht</div>
        ${(d.gewichtskontrolle.zeichen_uebergewicht||[]).map(z=>`<div style="font-size:11px;color:#555;margin-bottom:4px;padding-left:12px;position:relative;"><span style="position:absolute;left:0;color:${red};font-weight:700;">!</span>${z}</div>`).join('')}
      </div>
      <div style="background:${brownLight};border-radius:12px;padding:14px;border-left:3px solid ${brown};">
        <div style="font-size:12px;font-weight:700;color:${brownDark};margin-bottom:8px;">Zeichen für Untergewicht</div>
        ${(d.gewichtskontrolle.zeichen_untergewicht||[]).map(z=>`<div style="font-size:11px;color:#555;margin-bottom:4px;padding-left:12px;position:relative;"><span style="position:absolute;left:0;color:${brownDark};font-weight:700;">!</span>${z}</div>`).join('')}
      </div>
    </div>
  </div>
  <div class="page-num">13</div>
</div>` : ''}

<!-- EINKAUFSLISTE -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERNÄHRUNGSPLAN</div>
  <div style="margin-top:20px;">
    <h2>Einkaufsliste</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Alles was du für ${dogName}'s Ernährung brauchst. Druck diese Seite aus und nimm sie mit zum Einkaufen.</p>
    <div class="card-grid grid-3">
      ${(d.einkauf||[]).map(c=>`<div class="einkauf-card"><div class="einkauf-title">${c[0]}</div>${(c[1]||[]).map(i=>`<div class="einkauf-item">${i}</div>`).join('')}</div>`).join('')}
    </div>
  </div>
  <div class="page-num">11</div>
</div>

<!-- ABSCHLUSS -->
<div class="page" style="display:flex;align-items:center;justify-content:center;text-align:center;">
  <div>
    <h2>Viel Erfolg mit ${dogName}.</h2>
    <div class="accent-line" style="margin:8px auto 18px;"></div>
    <p style="font-size:13px;color:#555;line-height:1.8;max-width:520px;margin:0 auto 14px;">Gute Ernährung ist die Basis für ein gesundes, aktives und langes Hundeleben. Mit diesem Plan hast du alles, was du brauchst, um ${dogName} optimal zu versorgen.</p>
    <p style="font-size:13px;color:#555;line-height:1.8;max-width:520px;margin:0 auto 14px;">Beobachte wie ${dogName} reagiert. Ein glänzendes Fell, konstante Energie und eine gute Verdauung zeigen dir, dass alles passt. Wenn sich etwas verändert, passe die Mengen an oder probiere eine andere Proteinquelle.</p>
    <p style="font-size:13px;color:#555;line-height:1.8;max-width:520px;margin:0 auto 18px;">Ernährung ist kein Sprint, sondern ein Marathon. Kleine, konsequente Verbesserungen machen langfristig den größten Unterschied.</p>
    <div style="background:${brownLight};border-radius:12px;padding:14px 20px;display:inline-block;">
      <p style="font-size:12px;color:${brownDark};font-weight:600;margin-bottom:3px;">Fragen zu ${dogName}'s Ernährung?</p>
      <p style="font-size:11px;color:#555;margin:0;">Unser Team ist erreichbar: support@pfoten-plan.de</p>
    </div>
  </div>
</div>

</body></html>`;

  console.log("HTML fertig, starte Chrome...");

  // Puppeteer PDF
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new'
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    width: '297mm',
    height: '210mm',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await browser.close();
  console.log(`PDF: ${Math.round(pdfBuffer.length / 1024)} KB`);

  const pdfBase64 = pdfBuffer.toString('base64');

  const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
      to: [{ email: "kontakt@primesocial.de" }],
      subject: `[PDF FINAL] Ernährungsplan für ${dogName}`,
      htmlContent: `<div style="font-family:sans-serif;text-align:center;padding:30px;"><h2 style="color:#C4A576;">Ernährungsplan für ${dogName}</h2><p>12 Seiten PDF im Anhang</p></div>`,
      attachment: [{ name: `Ernaehrungsplan-${dogName}.pdf`, content: Buffer.from(pdfBuffer).toString('base64') }]
    })
  });

  if (emailRes.ok) console.log("Email + PDF gesendet!");
  else console.error("Error:", await emailRes.text());
}

run().catch(console.error);
