import puppeteer from "puppeteer-core";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const dogName = "Buddy";
const breed = "Labrador";

async function run() {
  console.log("Generiere Daten...");

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: `Erstelle SEHR ausführliche Erste-Hilfe Daten für Hunde. KEIN Markdown. Antworte NUR als JSON:
{
  "intro": [
    "5-6 Sätze: Warum Erste-Hilfe für Hundebesitzer lebenswichtig ist. Was in den ersten Minuten eines Notfalls zählt. Dass 90% der Hundebesitzer nicht wissen wie man richtig reagiert. Dass eigenes Handeln Leben retten kann bevor der Tierarzt erreichbar ist.",
    "4-5 Sätze: Was dieser Guide enthält - 10 wichtigste Notfälle mit Sofort-Maßnahmen, Notfall-Apotheke, wichtige Telefonnummern. Dass er für ${dogName} und jeden Hund nutzbar ist.",
    "3-4 Sätze: Wie man ihn nutzt - ausdrucken, gut sichtbar aufhängen, im Auto eine Kopie. Bei Fragen support@pfoten-plan.de."
  ],
  "basisregeln": [
    {"titel": "Ruhe bewahren", "text": "2-3 Sätze warum Panik der größte Feind ist und wie du selbst ruhig bleibst"},
    {"titel": "Hund sichern", "text": "2-3 Sätze wie man einen verletzten Hund sicher fixiert ohne ihn zu stressen"},
    {"titel": "Tierarzt anrufen", "text": "2-3 Sätze wie man den Tierarzt informiert - Was sagen, welche Fragen beantworten"},
    {"titel": "Atmung prüfen", "text": "2-3 Sätze wie man Atmung und Puls kontrolliert - Puls in der Leiste oder am Brustkorb"}
  ],
  "notfaelle": [
    {
      "name": "Vergiftung",
      "icon": "⚠️",
      "was_ist_das": "2-3 Sätze was passiert, welche Substanzen am gefährlichsten sind (Schokolade, Xylit, Weintrauben, Rattengift, Frostschutzmittel)",
      "symptome": ["Symptom 1", "Symptom 2", "Symptom 3", "Symptom 4"],
      "sofort": ["Sofort-Maßnahme 1 mit Detail", "Maßnahme 2", "Maßnahme 3", "Maßnahme 4", "Maßnahme 5"],
      "nicht_tun": ["Was NIEMALS tun 1", "Was nicht 2"],
      "tierarzt": "Sofort - jede Minute zählt"
    },
    {
      "name": "Hitzschlag",
      "icon": "🌡️",
      "was_ist_das": "2-3 Sätze",
      "symptome": ["..."],
      "sofort": ["...", "..."],
      "nicht_tun": ["..."],
      "tierarzt": "..."
    },
    "... (10 Notfälle insgesamt: Vergiftung, Hitzschlag, Verletzung/Schnittwunde, Insektenstich, Verschlucken/Fremdkörper, Durchfall akut, Erbrechen wiederholt, Zeckenbiss, Pfotenverletzung, Schock. Jeder mit: was_ist_das (3 Sätze), symptome (4 Items), sofort (5 detaillierte Schritte), nicht_tun (2-3 Items), tierarzt (1 Satz wann)"
  ],
  "notfall_apotheke": [
    {"kategorie": "Wundversorgung", "items": ["Item 1 mit Zweck", "Item 2", "Item 3", "Item 4"]},
    {"kategorie": "Medikamente", "items": ["...", "..."]},
    {"kategorie": "Werkzeuge", "items": ["...", "..."]},
    {"kategorie": "Dokumente", "items": ["Impfpass", "Tierarzt-Nummer", "..."]}
  ],
  "wiederbelebung": {
    "wann": "2 Sätze wann Wiederbelebung (Kreislauf-Stillstand erkennen)",
    "schritte": [
      {"nr": 1, "titel": "Atemwege freimachen", "text": "2-3 Sätze mit Detail"},
      {"nr": 2, "titel": "Beatmung", "text": "2-3 Sätze - wie viele Atemstöße, Rhythmus"},
      {"nr": 3, "titel": "Herzdruckmassage", "text": "2-3 Sätze - wo drücken, wie tief, Frequenz"},
      {"nr": 4, "titel": "Wiederholen", "text": "2-3 Sätze - Zyklus 30:2, wie lange durchhalten"}
    ]
  },
  "wichtige_nummern": [
    {"name": "Giftnotruf Hunde", "nummer": "089 19240", "beschreibung": "24/7 erreichbar"},
    {"name": "Tierrettung München", "nummer": "089 123456", "beschreibung": "Lokale Tierrettung"},
    {"name": "Dein Tierarzt", "nummer": "Eintragen", "beschreibung": "Feste Kontaktnummer"},
    {"name": "Notdienst-Suche", "nummer": "tieraerzteverband.de", "beschreibung": "Tierarzt finden"}
  ],
  "wann_zum_tierarzt": {
    "sofort": ["Zeichen 1", "Z2", "Z3", "Z4", "Z5"],
    "innerhalb_24h": ["Zeichen 1", "Z2", "Z3", "Z4"]
  },
  "alltags_aengste": [
    {
      "name": "Rückwärtsniesen",
      "gefahr": "harmlos",
      "was_ist_das": "2-3 Sätze was genau passiert (schnelle Einatemstöße, klingt beängstigend)",
      "was_tun": ["Ruhig bleiben und den Hund sanft streicheln", "Kurz die Nasenlöcher zuhalten oder Nase massieren", "Normalerweise endet es von selbst nach 10-30 Sekunden"],
      "tierarzt_wenn": "Nur wenn es täglich und über Minuten anhält oder Atemnot dazukommt"
    },
    {
      "name": "Wiederholtes Erbrechen",
      "gefahr": "situationsabhängig",
      "was_ist_das": "2-3 Sätze - einmal erbrechen ist oft harmlos, mehrfach ist Warnsignal",
      "was_tun": ["Futter und Wasser für 6-12 Stunden entziehen", "Nach der Pause Schonkost (Reis + Hühnchen) in kleinen Portionen", "Auf Farbe und Inhalt achten - Blut, Galle, unverdautes Futter"],
      "tierarzt_wenn": "Mehr als 3x in 24h, mit Blut, bei Welpen oder Senioren, mit Schwäche"
    },
    {
      "name": "Durchfall",
      "gefahr": "situationsabhängig",
      "was_ist_das": "2-3 Sätze - meist Futterumstellung oder Stress, kann aber auch ernst werden",
      "was_tun": ["24h fasten lassen, nur Wasser anbieten", "Dann Schonkost (gekochter Reis, Hühnchen, Karotte) für 2-3 Tage", "Beobachte Häufigkeit und Konsistenz"],
      "tierarzt_wenn": "Länger als 48h, mit Blut, bei Welpen/Senioren, mit Erbrechen kombiniert, Fieber"
    },
    {
      "name": "Zittern",
      "gefahr": "situationsabhängig",
      "was_ist_das": "2-3 Sätze - Kälte, Angst, Aufregung sind normal. Kann aber Schmerz oder Vergiftung bedeuten",
      "was_tun": ["Umgebung prüfen - kalt, Gewitter, fremde Geräusche?", "Ruhigen Rückzugsort anbieten", "Körper auf Schmerzreaktionen abtasten"],
      "tierarzt_wenn": "Ohne erkennbaren Grund, mit anderen Symptomen (Erbrechen, Apathie), länger als 1 Stunde"
    },
    {
      "name": "Gras fressen",
      "gefahr": "harmlos",
      "was_ist_das": "2-3 Sätze - normal, hilft bei Magenproblemen oder einfach Geschmack",
      "was_tun": ["Nur darauf achten dass kein gespritztes Gras gefressen wird", "Regelmäßig entwurmen", "Bei übermäßigem Fressen Futter kontrollieren"],
      "tierarzt_wenn": "Wenn es täglich in großen Mengen passiert oder Erbrechen folgt"
    },
    {
      "name": "Humpeln/Hinken",
      "gefahr": "situationsabhängig",
      "was_ist_das": "2-3 Sätze - oft Pfotenverletzung oder Zerrung, kann aber auch Bänder/Gelenke sein",
      "was_tun": ["Pfoten genau absuchen (Steinchen, Dorn, Schnitt)", "Vorsichtig Gelenke abtasten, Reaktion beobachten", "Für 24-48h Ruhe verordnen, keine langen Spaziergänge"],
      "tierarzt_wenn": "Nach 2 Tagen keine Besserung, starke Schmerzen, geschwollenes Gelenk, kann Bein nicht belasten"
    },
    {
      "name": "Ohrkratzen/Kopfschütteln",
      "gefahr": "situationsabhängig",
      "was_ist_das": "2-3 Sätze - oft Ohrenschmalz, aber auch Entzündung, Milben oder Fremdkörper",
      "was_tun": ["Ohren vorsichtig anschauen (nicht mit Wattestäbchen reinigen!)", "Nur mit Hundeohrreiniger säubern, nicht mit Wasser", "Auf Geruch achten - süßlich-ranzig deutet auf Infektion hin"],
      "tierarzt_wenn": "Bei Rötung, Geruch, dunklem Ausfluss, dauerhaftem Kratzen oder Kopfschiefhaltung"
    },
    {
      "name": "Appetitlosigkeit (1-2 Tage)",
      "gefahr": "situationsabhängig",
      "was_ist_das": "2-3 Sätze - kann Stress, Hitze, oder Futterwechsel sein - oder ernste Krankheit",
      "was_tun": ["Wasseraufnahme prüfen (wichtiger als Futter)", "Lieblings-Leckerli anbieten um Appetit zu testen", "Aktivität und Verhalten beobachten"],
      "tierarzt_wenn": "Länger als 48h, mit anderen Symptomen, bei Welpen/Senioren sofort"
    },
    {
      "name": "Husten",
      "gefahr": "situationsabhängig",
      "was_ist_das": "2-3 Sätze - Zwingerhusten, Reizung oder ernstere Ursachen",
      "was_tun": ["Art des Hustens beobachten (trocken, feucht, würgend)", "Umgebung prüfen (Rauch, Staub, Parfum)", "Bei trockenem Husten etwas Wasser anbieten"],
      "tierarzt_wenn": "Länger als 3 Tage, mit Atemnot, blauen Zahnfleisch, Apathie"
    },
    {
      "name": "Ständiges Lecken der Pfoten",
      "gefahr": "situationsabhängig",
      "was_ist_das": "2-3 Sätze - Allergie, Pilz, Verletzung oder Stress",
      "was_tun": ["Pfoten genau absuchen - Rötung, Schnitte, Zwischenräume", "Nach Spaziergängen Pfoten abwischen (Streusalz, Pollen)", "Allergie-Tagebuch führen (Wann tritt es auf?)"],
      "tierarzt_wenn": "Bei Schwellung, Blutung, roter/entzündeter Haut, dauerhaftem Lecken trotz Ablenkung"
    }
  ],
  "checkliste": ["Punkt 1 was regelmäßig checken", "P2", "P3", "P4", "P5", "P6"]
}
Sehr ausführlich, konkret, praktisch. Schreibe als wärst du Tierarzt. Alle Texte in Du-Form.`,
      messages: [{ role: "user", content: `JSON für Erste-Hilfe Guide für ${dogName} (${breed}).` }]
    })
  });

  if (!claudeRes.ok) { console.error(await claudeRes.text()); return; }
  const result = await claudeRes.json();
  let jsonText = result.content[0].text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  jsonText = jsonText.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
  if (!jsonText.endsWith('}')) {
    const ob = (jsonText.match(/{/g) || []).length, cb = (jsonText.match(/}/g) || []).length;
    for (let i = 0; i < ob - cb; i++) jsonText += '}';
    const obk = (jsonText.match(/\[/g) || []).length, cbk = (jsonText.match(/]/g) || []).length;
    for (let i = 0; i < obk - cbk; i++) jsonText += ']';
  }
  let d;
  try { d = JSON.parse(jsonText); }
  catch(e) {
    console.error("JSON Fehler, repariere...", e.message);
    for (let i = jsonText.length; i > 100; i--) {
      try { d = JSON.parse(jsonText.substring(0, i) + ']}]}'); break; } catch {}
      try { d = JSON.parse(jsonText.substring(0, i) + '"]}]}'); break; } catch {}
    }
    if (!d) { console.error("Kann JSON nicht parsen"); return; }
  }
  console.log("Daten OK, baue HTML...");

  const brown = '#C4A576';
  const brownDark = '#8B7355';
  const brownLight = '#FFF9F0';
  const bg = '#FAF8F5';
  const red = '#DC2626';
  const redBg = '#FEF2F2';
  const orange = '#EA580C';
  const orangeBg = '#FFF7ED';

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
  .grid-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
</style></head><body>

<!-- TITEL -->
<div class="page" style="display:flex;align-items:center;">
  <div>
    <div style="font-size:10px;font-weight:700;color:${brown};letter-spacing:2px;text-transform:uppercase;">PFOTEN-PLAN</div>
    <div style="width:35px;height:2px;background:${brown};margin:10px 0 24px;border-radius:1px;"></div>
    <h1 style="font-size:36px;font-weight:800;line-height:1.15;margin-bottom:10px;">Erste-Hilfe Guide<br>für Hunde</h1>
    <p style="font-size:13px;color:#999;">Notfall-Handbuch für ${dogName} und jeden Hund</p>
    <div style="display:flex;gap:20px;margin-top:30px;">
      ${['10 Notfälle','Sofort-Maßnahmen','Notfall-Apotheke','Tierarzt-Nummern'].map(s => `<span style="font-size:11px;color:#aaa;">${s}</span>`).join('<span style="color:#ddd;">·</span>')}
    </div>
    <div style="background:${redBg};border-left:3px solid ${red};border-radius:8px;padding:14px 18px;margin-top:30px;max-width:500px;">
      <div style="font-size:11px;font-weight:700;color:${red};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Wichtiger Hinweis</div>
      <div style="font-size:12px;color:#555;line-height:1.5;">Dieser Guide ersetzt keinen Tierarztbesuch. Bei jedem ernsten Notfall immer sofort einen Tierarzt kontaktieren.</div>
    </div>
  </div>
</div>

<!-- EINLEITUNG -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERSTE-HILFE GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Warum ein Erste-Hilfe Guide?</h2>
    <div class="accent-line"></div>
    ${(d.intro||[]).map(p=>`<p style="font-size:13px;color:#555;line-height:1.7;margin-bottom:14px;">${p}</p>`).join('')}
  </div>
  <div class="page-num">2</div>
</div>

<!-- BASIS-REGELN -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERSTE-HILFE GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Die 4 wichtigsten Basis-Regeln</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Egal was passiert - diese 4 Schritte sind immer der Anfang jeder Erste-Hilfe Maßnahme.</p>
    <div class="card-grid grid-2">
      ${(d.basisregeln||[]).map((r,i)=>`<div style="background:white;border-radius:12px;padding:16px 18px;display:flex;gap:14px;">
        <div style="width:40px;height:40px;background:${brown};border-radius:50%;color:white;font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</div>
        <div>
          <div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:4px;">${r.titel}</div>
          <div style="font-size:12px;color:#555;line-height:1.5;">${r.text}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>
  <div class="page-num">3</div>
</div>

<!-- NOTFÄLLE (je 1 Seite) -->
${(d.notfaelle||[]).map((n,i)=>`
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERSTE-HILFE GUIDE</div>
  <div style="margin-top:20px;">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:4px;">
      <div style="width:44px;height:44px;background:${redBg};border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">${n.icon||'⚠️'}</div>
      <h2 style="margin:0;">Notfall ${i+1}: ${n.name}</h2>
    </div>
    <div class="accent-line" style="background:${red};margin-left:58px;"></div>

    <p style="font-size:13px;color:#555;line-height:1.6;margin:0 0 16px;">${n.was_ist_das||''}</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <!-- Symptome -->
      <div style="background:${orangeBg};border-radius:10px;padding:14px 16px;border-left:3px solid ${orange};">
        <div style="font-size:11px;font-weight:700;color:${orange};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Symptome erkennen</div>
        ${(n.symptome||[]).map(s=>`<div style="font-size:12px;color:#555;margin-bottom:5px;padding-left:14px;position:relative;line-height:1.4;"><span style="position:absolute;left:0;color:${orange};font-weight:700;">!</span>${s}</div>`).join('')}
      </div>

      <!-- Was nicht tun -->
      <div style="background:${redBg};border-radius:10px;padding:14px 16px;border-left:3px solid ${red};">
        <div style="font-size:11px;font-weight:700;color:${red};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Niemals tun</div>
        ${(n.nicht_tun||[]).map(s=>`<div style="font-size:12px;color:#555;margin-bottom:5px;padding-left:14px;position:relative;line-height:1.4;"><span style="position:absolute;left:0;color:${red};font-weight:700;">×</span>${s}</div>`).join('')}
      </div>
    </div>

    <!-- Sofort-Maßnahmen -->
    <div style="background:white;border-radius:10px;padding:16px 18px;border-left:3px solid ${brown};">
      <div style="font-size:11px;font-weight:700;color:${brown};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Sofort-Maßnahmen in Reihenfolge</div>
      ${(n.sofort||[]).map((s,si)=>`<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;">
        <div style="width:24px;height:24px;background:${brown};border-radius:50%;color:white;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${si+1}</div>
        <div style="font-size:12px;color:#333;line-height:1.5;padding-top:2px;">${s}</div>
      </div>`).join('')}
    </div>

    ${n.tierarzt ? `<div style="background:${redBg};border-radius:8px;padding:10px 14px;margin-top:10px;font-size:12px;color:${red};font-weight:600;"><strong>Zum Tierarzt:</strong> ${n.tierarzt}</div>` : ''}
  </div>
  <div class="page-num">${4+i}</div>
</div>`).join('')}

<!-- WIEDERBELEBUNG -->
${d.wiederbelebung ? `<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERSTE-HILFE GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Wiederbelebung</h2>
    <div class="accent-line" style="background:${red};"></div>
    <p class="intro-text">${d.wiederbelebung.wann||''}</p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${(d.wiederbelebung.schritte||[]).map(s=>`<div style="background:white;border-radius:12px;padding:14px 18px;display:flex;gap:14px;align-items:flex-start;">
        <div style="width:40px;height:40px;background:${red};border-radius:50%;color:white;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${s.nr}</div>
        <div>
          <div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:3px;">${s.titel}</div>
          <div style="font-size:12px;color:#555;line-height:1.5;">${s.text}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>
  <div class="page-num">${4+(d.notfaelle||[]).length}</div>
</div>` : ''}

<!-- ALLTAGS-ÄNGSTE: Harmlos oder gefährlich -->
${(d.alltags_aengste||[]).length ? `
<div class="page flow">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERSTE-HILFE GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Harmlos oder gefährlich?</h2>
    <div class="accent-line"></div>
    <p class="intro-text">10 Situationen die Hundebesitzer verunsichern - mit klaren Antworten, was du tun kannst und wann ein Tierarzt-Besuch nötig ist.</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${(d.alltags_aengste||[]).map(a=>{
        const color = a.gefahr === 'harmlos' ? '#16A34A' : (a.gefahr === 'gefaehrlich' ? red : orange);
        const bgc = a.gefahr === 'harmlos' ? '#F0FDF4' : (a.gefahr === 'gefaehrlich' ? redBg : orangeBg);
        const label = a.gefahr === 'harmlos' ? 'Meist harmlos' : (a.gefahr === 'gefaehrlich' ? 'Gefährlich' : 'Situationsabhängig');
        return `<div class="no-break" style="background:white;border-radius:12px;padding:14px 16px;border-left:3px solid ${color};">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">
            <div style="font-size:13px;font-weight:700;color:#1a1a1a;">${a.name}</div>
            <div style="background:${bgc};color:${color};padding:3px 9px;border-radius:20px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
          </div>
          <div style="font-size:11px;color:#555;line-height:1.5;margin-bottom:8px;">${a.was_ist_das||''}</div>
          <div style="font-size:10px;font-weight:700;color:${brown};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Was tun</div>
          ${(a.was_tun||[]).map(t=>`<div style="font-size:10.5px;color:#555;margin-bottom:3px;padding-left:12px;position:relative;line-height:1.4;"><span style="position:absolute;left:0;color:${brown};font-weight:700;">•</span>${t}</div>`).join('')}
          ${a.tierarzt_wenn ? `<div style="background:${redBg};border-radius:6px;padding:6px 10px;margin-top:8px;font-size:10px;color:${red};line-height:1.4;"><strong>Tierarzt wenn:</strong> ${a.tierarzt_wenn}</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>
</div>` : ''}

<!-- NOTFALL-APOTHEKE -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERSTE-HILFE GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Deine Notfall-Apotheke</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Das gehört in jede Erste-Hilfe-Tasche für Hunde. Einmal zusammenstellen und am besten griffbereit halten.</p>
    <div class="card-grid grid-2">
      ${(d.notfall_apotheke||[]).map(cat=>`<div style="background:white;border-radius:12px;padding:14px 16px;border-top:3px solid ${brown};">
        <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:10px;">${cat.kategorie}</div>
        ${(cat.items||[]).map(item=>`<div style="font-size:12px;color:#555;margin-bottom:5px;padding-left:18px;position:relative;line-height:1.4;"><span style="position:absolute;left:0;top:2px;width:10px;height:10px;border:1.5px solid ${brown};border-radius:2px;display:inline-block;"></span>${item}</div>`).join('')}
      </div>`).join('')}
    </div>
  </div>
  <div class="page-num">${5+(d.notfaelle||[]).length}</div>
</div>

<!-- WICHTIGE NUMMERN -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERSTE-HILFE GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Wichtige Notfall-Nummern</h2>
    <div class="accent-line" style="background:${red};"></div>
    <p class="intro-text">Diese Nummern solltest du im Handy speichern und zusätzlich sichtbar in deiner Wohnung anbringen.</p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${(d.wichtige_nummern||[]).map(n=>`<div style="background:white;border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:16px;">
        <div style="width:44px;height:44px;background:${redBg};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📞</div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:700;color:#1a1a1a;">${n.name}</div>
          <div style="font-size:11px;color:#999;">${n.beschreibung||''}</div>
        </div>
        <div style="font-size:16px;font-weight:800;color:${red};">${n.nummer}</div>
      </div>`).join('')}
    </div>
  </div>
  <div class="page-num">${6+(d.notfaelle||[]).length}</div>
</div>

<!-- WANN ZUM TIERARZT -->
${d.wann_zum_tierarzt ? `<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERSTE-HILFE GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Wann zum Tierarzt?</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Nicht jeder Vorfall ist ein echter Notfall. Diese Checkliste hilft dir zu entscheiden.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="background:${redBg};border-radius:12px;padding:16px 18px;border-left:3px solid ${red};">
        <div style="font-size:13px;font-weight:700;color:${red};margin-bottom:12px;">Sofort zum Tierarzt</div>
        ${(d.wann_zum_tierarzt.sofort||[]).map(z=>`<div style="font-size:12px;color:#555;margin-bottom:6px;padding-left:14px;position:relative;line-height:1.5;"><span style="position:absolute;left:0;color:${red};font-weight:700;">!</span>${z}</div>`).join('')}
      </div>
      <div style="background:${orangeBg};border-radius:12px;padding:16px 18px;border-left:3px solid ${orange};">
        <div style="font-size:13px;font-weight:700;color:${orange};margin-bottom:12px;">Innerhalb 24 Stunden</div>
        ${(d.wann_zum_tierarzt.innerhalb_24h||[]).map(z=>`<div style="font-size:12px;color:#555;margin-bottom:6px;padding-left:14px;position:relative;line-height:1.5;"><span style="position:absolute;left:0;color:${orange};font-weight:700;">!</span>${z}</div>`).join('')}
      </div>
    </div>
  </div>
  <div class="page-num">${7+(d.notfaelle||[]).length}</div>
</div>` : ''}

<!-- CHECKLISTE -->
${d.checkliste ? `<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | ERSTE-HILFE GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Regelmäßige Gesundheits-Checkliste</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Was du regelmäßig bei ${dogName} prüfen solltest - Früherkennung ist die beste Notfall-Vorsorge.</p>
    <div style="background:white;border-radius:12px;padding:20px 24px;">
      ${d.checkliste.map((p,i)=>`<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;${i<d.checkliste.length-1?'border-bottom:1px solid #eee;':''}">
        <div style="width:22px;height:22px;border:2px solid ${brown};border-radius:5px;flex-shrink:0;margin-top:2px;"></div>
        <div style="font-size:13px;color:#333;line-height:1.5;flex:1;">${p}</div>
      </div>`).join('')}
    </div>
  </div>
  <div class="page-num">${8+(d.notfaelle||[]).length}</div>
</div>` : ''}

<!-- ABSCHLUSS -->
<div class="page" style="display:flex;align-items:center;justify-content:center;text-align:center;">
  <div style="max-width:550px;">
    <div style="font-size:10px;font-weight:700;color:${brown};letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">PFOTEN-PLAN</div>
    <h2 style="margin-bottom:6px;">Sei vorbereitet.</h2>
    <div class="accent-line" style="margin:0 auto 20px;"></div>
    <p style="font-size:13px;color:#555;line-height:1.8;margin-bottom:14px;">Niemand rechnet mit einem Notfall. Aber wenn er passiert, macht es einen Unterschied ob du weißt was zu tun ist - oder in Panik gerätst.</p>
    <p style="font-size:13px;color:#555;line-height:1.8;margin-bottom:14px;">Druck diesen Guide aus, hänge ihn sichtbar auf, nimm eine Kopie ins Auto. Und geh regelmäßig durch, damit du im Ernstfall automatisch richtig reagierst.</p>
    <p style="font-size:13px;color:#555;line-height:1.8;margin-bottom:20px;">Für ${dogName} und für deine Ruhe.</p>
    <div style="background:${brownLight};border-radius:12px;padding:14px 20px;display:inline-block;">
      <p style="font-size:12px;color:${brownDark};font-weight:600;margin-bottom:3px;">Fragen zum Guide?</p>
      <p style="font-size:11px;color:#555;margin:0;">support@pfoten-plan.de</p>
    </div>
  </div>
</div>

</body></html>`;

  console.log("HTML fertig, starte Chrome...");

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

  const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

  const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
      to: [{ email: "kontakt@primesocial.de" }],
      subject: `[TEST] Erste-Hilfe Guide für ${dogName}`,
      htmlContent: `<div style="font-family:sans-serif;text-align:center;padding:30px;"><h2 style="color:#C4A576;">Erste-Hilfe Guide</h2><p>PDF im Anhang</p></div>`,
      attachment: [{ name: `ErsteHilfe-Guide.pdf`, content: pdfBase64 }]
    })
  });

  if (emailRes.ok) console.log("Email + PDF gesendet!");
  else console.error("Error:", await emailRes.text());
}

run().catch(console.error);
