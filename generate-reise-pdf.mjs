import puppeteer from "puppeteer-core";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const dogName = "Buddy";
const breed = "Labrador";
const travelType = "auto"; // auto / zug / flugzeug
const travelDest = "eu";   // deutschland / eu / weltweit

async function run() {
  console.log("Generiere Daten...");

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: `Erstelle SEHR ausführliche Reise-Guide Daten für Hundebesitzer. Hauptsächliches Reisemittel: ${travelType}. Ziel: ${travelDest}. KEIN Markdown. Antworte NUR als JSON:
{
  "intro": [
    "5-6 Sätze: Warum Reisen mit Hund besondere Vorbereitung brauchen. Was alles schiefgehen kann ohne Planung. Welche Stress-Faktoren ${dogName} ausgesetzt ist. Dass mit richtiger Vorbereitung aber jede Reise entspannt werden kann.",
    "3-4 Sätze: Was dieser Guide enthält (Vorbereitung, Packliste, Transport-spezifisch für ${travelType}, Unterkunft, Notfälle, Dokumente). Personalisiert für die Reise-Art.",
    "2-3 Sätze: Wie der Guide zu nutzen ist. Bei Fragen support@pfoten-plan.de."
  ],
  "vorbereitung": {
    "checkliste_vor_reise": [
      {"titel": "Tierarzt-Check", "text": "2-3 Sätze was beim Tierarzt gecheckt werden sollte (Impfstatus, Gesundheits-Check, ggf. Beruhigungsmittel)"},
      {"titel": "Impfstatus prüfen", "text": "2-3 Sätze welche Impfungen Pflicht sind je nach Ziel (Tollwut, EU-Heimtierausweis)"},
      {"titel": "Mikrochip & Tätowierung", "text": "2-3 Sätze warum Mikrochip Pflicht für EU-Reisen ist"},
      {"titel": "Dokumente vorbereiten", "text": "2-3 Sätze welche Papiere mit müssen"},
      {"titel": "Transport-Training", "text": "2-3 Sätze wie man den Hund an Transport-Box/Auto gewöhnt"},
      {"titel": "Tierarzt am Zielort", "text": "2-3 Sätze: Vorher Tierarzt am Urlaubsort raussuchen, Kontaktdaten speichern"}
    ]
  },
  "packliste": [
    {"kategorie": "Grundausstattung", "items": ["Halsband + Leine (2 Ersatz)", "Geschirr", "Transportbox", "Maulkorb", "Hundebett/Decke"]},
    {"kategorie": "Futter & Wasser", "items": ["Gewohntes Futter für gesamte Reise + 2 Tage Reserve", "Wassernapf (2x - reisen + unterwegs)", "Wasserflasche", "Leckerlis", "Kausnacks"]},
    {"kategorie": "Gesundheit", "items": ["Impfpass / EU-Heimtierausweis", "Medikamente wenn nötig", "Zeckenzange", "Erste-Hilfe-Set", "Notfall-Kontakt"]},
    {"kategorie": "Komfort", "items": ["Lieblingsspielzeug", "Gewohnte Decke (beruhigender Geruch)", "Kauartikel für Reise", "Handtücher", "Kotbeutel"]}
  ],
  "transport_tipps": {
    "haupt_thema": "${travelType}",
    "vorbereitung": [
      {"titel": "Schritt 1", "text": "2-3 Sätze detaillierte Vorbereitung für ${travelType}"},
      {"titel": "Schritt 2", "text": "2-3 Sätze"},
      {"titel": "Schritt 3", "text": "2-3 Sätze"},
      {"titel": "Schritt 4", "text": "2-3 Sätze"}
    ],
    "waehrend_fahrt": [
      {"titel": "Pausen", "text": "2-3 Sätze wie oft und wie lange bei ${travelType}"},
      {"titel": "Ernährung", "text": "2-3 Sätze was und wann füttern während Fahrt"},
      {"titel": "Reiseübelkeit", "text": "2-3 Sätze Symptome und was tun"},
      {"titel": "Stress-Signale", "text": "2-3 Sätze was tun wenn Hund gestresst ist"}
    ],
    "regelungen": [
      {"land_oder_situation": "Situation 1", "regelung": "2-3 Sätze konkrete Regel", "strafe": "Wenn bekannt, sonst weglassen"},
      {"land_oder_situation": "Situation 2", "regelung": "...", "strafe": "..."},
      {"land_oder_situation": "Situation 3", "regelung": "...", "strafe": "..."}
    ]
  },
  "unterkunft": {
    "finden": [
      {"titel": "Hundefreundliche Unterkünfte", "text": "3-4 Sätze wo suchen, welche Portale, worauf achten"},
      {"titel": "Vorab klären", "text": "3-4 Sätze was vorher per Email fragen"},
      {"titel": "Zusatzkosten", "text": "3-4 Sätze typische Aufpreise, wie viel"},
      {"titel": "Alternativen", "text": "3-4 Sätze Ferienwohnung vs Hotel vs Camping"}
    ],
    "vor_ort": [
      "Hund am ersten Tag nicht allein lassen - Eingewöhnung",
      "Futter- und Wassernapf direkt einrichten",
      "Rückzugsort schaffen (Hundebett + gewohnte Decke)",
      "Nachbarn kurz informieren falls im Hotel",
      "Keine Möbel schutzlos lassen bei Welpen"
    ]
  },
  "notfaelle_unterwegs": [
    {"situation": "Situation 1 (z.B. Hund erbricht auf Fahrt)", "was_tun": "3-4 konkrete Schritte als Array", "praevention": "1-2 Sätze wie vermeiden"},
    {"situation": "Situation 2", "was_tun": ["..."], "praevention": "..."},
    {"situation": "Situation 3", "was_tun": ["..."], "praevention": "..."},
    {"situation": "Situation 4", "was_tun": ["..."], "praevention": "..."}
  ],
  "einreise_regelungen": [
    {"land": "Deutschland", "anforderungen": ["Impfungen", "Heimtierausweis", "Mikrochip"], "besonderheiten": "2-3 Sätze"},
    {"land": "Österreich", "anforderungen": ["..."], "besonderheiten": "..."},
    {"land": "Italien", "anforderungen": ["..."], "besonderheiten": "..."},
    {"land": "Frankreich", "anforderungen": ["..."], "besonderheiten": "..."},
    {"land": "Spanien", "anforderungen": ["..."], "besonderheiten": "..."},
    {"land": "Schweiz", "anforderungen": ["..."], "besonderheiten": "..."}
  ],
  "tierarzt_notfall": {
    "europa": [
      {"land": "Österreich", "nummer": "Kontakt-Info", "beschreibung": "Tierklinik oder Notdienst"},
      {"land": "Italien", "nummer": "...", "beschreibung": "..."},
      {"land": "Frankreich", "nummer": "...", "beschreibung": "..."}
    ],
    "tipps": [
      "Vor Reise lokale Tierärzte recherchieren",
      "Notfall-Dokumente (Impfpass) griffbereit",
      "Sprachbarriere: Google Translate offline herunterladen"
    ]
  },
  "dos_donts": {
    "dos": ["Vorbereitung mindestens 4 Wochen vorher beginnen", "Ausreichend Pausen einplanen", "Gewohntes Futter mitnehmen", "Hund immer sichern im Auto", "Tierarzt am Zielort raussuchen"],
    "donts": ["Niemals Hund allein im Auto bei Hitze", "Keine plötzliche Futterumstellung", "Hund nicht ungesichert transportieren", "Dokumente nicht vergessen", "Hund nicht überfordern mit zu langen Fahrten"]
  },
  "reise_angst": {
    "intro": "3-4 Sätze: Warum viele Hunde Angst vor Auto/Zug/Flugzeug haben. Ursachen (schlechte Erfahrung, mangelnde Gewöhnung, Reiseübelkeit). Dass das kein Charakterfehler ist und sich mit Geduld trainieren lässt.",
    "symptome": [
      {"name": "Hecheln & Speicheln", "bedeutung": "1 Satz was das bedeutet"},
      {"name": "Zittern", "bedeutung": "..."},
      {"name": "Winseln oder Bellen", "bedeutung": "..."},
      {"name": "Verkriechen & Rückzug", "bedeutung": "..."},
      {"name": "Erbrechen durch Stress", "bedeutung": "..."},
      {"name": "Ungewohnte Aggression", "bedeutung": "..."}
    ],
    "uebungen": [
      {
        "titel": "Übung 1: Positive Verknüpfung aufbauen",
        "zeit": "10 Min täglich · 1 Woche",
        "schritte": [
          "Hund ohne Fahrt ins Auto lassen, Tür offen",
          "Leckerlis und Lieblingsspielzeug ins Auto legen",
          "Ruhig loben, wenn Hund freiwillig einsteigt",
          "Kein Drängeln - nur positive Erfahrung",
          "Nach 10 Min beenden, Hund rauslassen"
        ],
        "ziel": "Auto wird zu etwas Positivem, keine Angst mehr beim Anblick"
      },
      {
        "titel": "Übung 2: Sitzen ohne Fahrt",
        "zeit": "5-10 Min täglich · 3-5 Tage",
        "schritte": [
          "Hund steigt ein, du setzt dich ebenfalls ins Auto",
          "Motor noch nicht starten - nur gemeinsam sitzen",
          "Ruhig sprechen, streicheln, Leckerli geben",
          "Nach ein paar Minuten aussteigen, loben",
          "Dauer langsam steigern"
        ],
        "ziel": "Auto-Innenraum wird vertraut und entspannt"
      },
      {
        "titel": "Übung 3: Motor starten",
        "zeit": "5 Min täglich · 3-5 Tage",
        "schritte": [
          "Hund ist eingestiegen und entspannt",
          "Motor starten, aber nicht losfahren",
          "Beobachten: Zeigt er Stress-Signale?",
          "Wenn ruhig: loben und Leckerli geben",
          "Wenn gestresst: Motor aus und einen Schritt zurück"
        ],
        "ziel": "Motorgeräusch löst keine Angst mehr aus"
      },
      {
        "titel": "Übung 4: Erste kurze Fahrten",
        "zeit": "5 Min Fahrt · 3-4 Mal",
        "schritte": [
          "Start mit nur 2-3 Minuten Fahrt (um den Block)",
          "Ziel: etwas Schönes (Park, Lieblingsplatz)",
          "Langsam fahren, ruhig sprechen",
          "Nach Ankunft ausführlich spielen/belohnen",
          "Heimfahrt = zurück zu entspannter Umgebung"
        ],
        "ziel": "Autofahrt wird mit schönen Erlebnissen verknüpft"
      },
      {
        "titel": "Übung 5: Längere Strecken",
        "zeit": "15-30 Min Fahrt · 2-3 Mal pro Woche",
        "schritte": [
          "Dauer schrittweise steigern (10, 15, 20, 30 Min)",
          "Regelmäßige Pausen mit Beschäftigung",
          "Beobachte: Ist der Hund noch entspannt?",
          "Bei Problemen zurück zu kürzeren Strecken",
          "Immer mit positivem Ziel enden"
        ],
        "ziel": "Der Hund übersteht auch längere Fahrten entspannt"
      }
    ],
    "reiseuebelkeit": {
      "was_tun": [
        "Hund 2-3 Stunden vor Fahrt nicht mehr füttern",
        "Wasser kann immer gegeben werden",
        "Frische Luft im Auto (Fenster kippen)",
        "Ingwer-Keks als natürliches Mittel",
        "Bei starker Übelkeit: Tierarzt nach Medikament fragen"
      ],
      "hinweise": "Reiseübelkeit tritt oft beim ersten Mal auf und bessert sich bei Gewöhnung"
    },
    "beruhigungs_tipps": [
      {"titel": "Gewohnte Decke", "text": "Ein vertrautes Tuch/Decke mit bekanntem Geruch beruhigt"},
      {"titel": "Kauartikel", "text": "Langes Kauen baut Stress ab und beschäftigt"},
      {"titel": "Feromone", "text": "Adaptil-Spray oder -Halsband (Apotheke) - natürlich beruhigend"},
      {"titel": "Ruhige Stimme", "text": "Hektisches Trösten verstärkt die Angst - lieber ruhig und sachlich"},
      {"titel": "Körperliche Auslastung", "text": "Vor der Fahrt eine lange Runde - müde Hunde reisen entspannter"},
      {"titel": "Bei extremer Angst", "text": "Tierarzt konsultieren - es gibt sanfte pflanzliche Mittel"}
    ]
  }
}
Sehr ausführlich und praktisch. Alle Texte in Du-Form. Berücksichtige speziell ${travelType} als Haupt-Thema.`,
      messages: [{ role: "user", content: `Reise-Guide für ${dogName} (${breed}). Reisemittel: ${travelType}, Ziel: ${travelDest}.` }]
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
    if (!d) { console.error("JSON Parse Fehler"); return; }
  }
  console.log("Daten OK, baue HTML...");

  const brown = '#C4A576';
  const brownDark = '#8B7355';
  const brownLight = '#FFF9F0';
  const bg = '#FAF8F5';
  const red = '#DC2626';
  const redBg = '#FEF2F2';
  const blue = '#2563EB';
  const blueBg = '#EFF6FF';
  const green = '#16A34A';
  const greenBg = '#F0FDF4';

  const travelIcon = travelType === 'auto' ? '🚗' : travelType === 'zug' ? '🚂' : travelType === 'flugzeug' ? '✈️' : '🚗';
  const travelLabel = travelType === 'auto' ? 'Auto' : travelType === 'zug' ? 'Bahn' : travelType === 'flugzeug' ? 'Flugzeug' : 'Auto';

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
  .card-grid { display: grid; gap: 10px; }
  .grid-2 { grid-template-columns: 1fr 1fr; }
  .grid-3 { grid-template-columns: 1fr 1fr 1fr; }
</style></head><body>

<!-- TITEL -->
<div class="page" style="display:flex;align-items:center;">
  <div>
    <div style="font-size:10px;font-weight:700;color:${brown};letter-spacing:2px;text-transform:uppercase;">PFOTEN-PLAN</div>
    <div style="width:35px;height:2px;background:${brown};margin:10px 0 24px;border-radius:1px;"></div>
    <h1 style="font-size:36px;font-weight:800;line-height:1.15;margin-bottom:10px;">Reise-Guide<br>für ${dogName}</h1>
    <p style="font-size:13px;color:#999;">Stressfrei unterwegs mit Hund · ${travelLabel} · ${breed}</p>
    <div style="display:flex;gap:20px;margin-top:30px;">
      ${['Vorbereitung','Packliste','Transport-Tipps','Notfälle','EU-Regelungen'].map(s => `<span style="font-size:11px;color:#aaa;">${s}</span>`).join('<span style="color:#ddd;">·</span>')}
    </div>
    <div style="background:${brownLight};border-left:3px solid ${brown};border-radius:8px;padding:14px 18px;margin-top:30px;max-width:500px;">
      <div style="font-size:11px;font-weight:700;color:${brownDark};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Dein Reise-Buddy</div>
      <div style="font-size:12px;color:#555;line-height:1.5;">Druck den Guide aus und nimm ihn mit. Oder speichere ihn auf dem Handy. Für die wichtigsten Momente unterwegs mit ${dogName}.</div>
    </div>
  </div>
</div>

<!-- EINLEITUNG -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | REISE-GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Warum ein Reise-Guide?</h2>
    <div class="accent-line"></div>
    ${(d.intro||[]).map(p=>`<p style="font-size:13px;color:#555;line-height:1.7;margin-bottom:14px;">${p}</p>`).join('')}
  </div>
  <div class="page-num">2</div>
</div>

<!-- VORBEREITUNG -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | REISE-GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Vorbereitung vor der Reise</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Die wichtigsten Schritte, die du schon Wochen vor der Reise erledigen solltest. So startest du entspannt in den Urlaub mit ${dogName}.</p>
    <div class="card-grid grid-2">
      ${((d.vorbereitung||{}).checkliste_vor_reise||[]).map((c,i)=>`<div style="background:white;border-radius:12px;padding:14px 16px;display:flex;gap:12px;">
        <div style="width:32px;height:32px;background:${brown};border-radius:50%;color:white;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:3px;">${c.titel}</div>
          <div style="font-size:11px;color:#555;line-height:1.5;">${c.text}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>
  <div class="page-num">3</div>
</div>

<!-- PACKLISTE -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | REISE-GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Deine Packliste</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Alles was ${dogName} für eine entspannte Reise braucht - nach Kategorien sortiert. Druck die Seite aus und hak ab was schon gepackt ist.</p>
    <div class="card-grid grid-2">
      ${(d.packliste||[]).map(cat=>`<div style="background:white;border-radius:12px;padding:14px 16px;border-top:3px solid ${brown};">
        <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:10px;">${cat.kategorie}</div>
        ${(cat.items||[]).map(item=>`<div style="font-size:11px;color:#555;margin-bottom:6px;padding-left:18px;position:relative;line-height:1.4;"><span style="position:absolute;left:0;top:2px;width:10px;height:10px;border:1.5px solid ${brown};border-radius:2px;"></span>${item}</div>`).join('')}
      </div>`).join('')}
    </div>
  </div>
  <div class="page-num">4</div>
</div>

<!-- TRANSPORT: VORBEREITUNG -->
${(d.transport_tipps||{}).vorbereitung ? `<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | REISE-GUIDE</div>
  <div style="margin-top:20px;">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:4px;">
      <div style="width:44px;height:44px;background:${brownLight};border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">${travelIcon}</div>
      <h2 style="margin:0;">Vorbereitung: ${travelLabel}</h2>
    </div>
    <div class="accent-line" style="margin-left:58px;"></div>
    <p class="intro-text" style="margin-left:0;">Speziell zugeschnitten auf deine Reise mit ${travelLabel}. So gewöhnst du ${dogName} optimal an die Fahrt.</p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${d.transport_tipps.vorbereitung.map((s,i)=>`<div style="background:white;border-radius:12px;padding:14px 18px;display:flex;gap:14px;align-items:flex-start;">
        <div style="width:32px;height:32px;background:${brown};border-radius:50%;color:white;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:3px;">${s.titel}</div>
          <div style="font-size:12px;color:#555;line-height:1.5;">${s.text}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>
  <div class="page-num">5</div>
</div>` : ''}

<!-- REISE-ANGST: INTRO + SYMPTOME -->
${d.reise_angst ? `<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | REISE-GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Reise-Angst bei ${dogName}?</h2>
    <div class="accent-line"></div>
    <p style="font-size:13px;color:#555;line-height:1.7;margin-bottom:16px;">${d.reise_angst.intro||''}</p>

    ${d.reise_angst.symptome ? `<div style="background:white;border-radius:12px;padding:16px 18px;margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:${brownDark};margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">So erkennst du Reise-Angst</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${d.reise_angst.symptome.map(s=>`<div style="background:${brownLight};border-radius:8px;padding:10px 12px;">
          <div style="font-size:12px;font-weight:700;color:${brownDark};margin-bottom:2px;">${s.name}</div>
          <div style="font-size:10.5px;color:#555;line-height:1.4;">${s.bedeutung||''}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    ${d.reise_angst.beruhigungs_tipps ? `<div style="background:${blueBg||'#EFF6FF'};border-radius:12px;padding:16px 18px;border-left:3px solid ${blue||'#2563EB'};">
      <div style="font-size:12px;font-weight:700;color:${blue||'#2563EB'};margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Allgemeine Beruhigungs-Tipps</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${d.reise_angst.beruhigungs_tipps.map(t=>`<div>
          <div style="font-size:11px;font-weight:700;color:#1a1a1a;margin-bottom:2px;">${t.titel}</div>
          <div style="font-size:10.5px;color:#555;line-height:1.4;">${t.text}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}
  </div>
</div>

<!-- REISE-ANGST: ÜBUNGEN -->
<div class="page flow">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | REISE-GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Übungen gegen Reise-Angst</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Baue diese Übungen in der Reihenfolge Schritt für Schritt auf. Geh erst zur nächsten Übung über, wenn ${dogName} die vorige entspannt meistert.</p>

    ${(d.reise_angst.uebungen||[]).map((u,i)=>`<div class="no-break" style="background:white;border-radius:12px;padding:16px 18px;margin-bottom:10px;border-left:3px solid ${brown};">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
        <div style="font-size:14px;font-weight:800;color:#1a1a1a;">${u.titel}</div>
        <div style="background:${brownLight};color:${brownDark};padding:3px 10px;border-radius:14px;font-size:10px;font-weight:700;">${u.zeit||''}</div>
      </div>
      ${u.schritte ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
        ${u.schritte.map((s,si)=>`<div style="display:flex;gap:8px;align-items:flex-start;">
          <div style="width:20px;height:20px;background:${brown};border-radius:50%;color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${si+1}</div>
          <div style="font-size:11px;color:#555;line-height:1.4;padding-top:1px;">${s}</div>
        </div>`).join('')}
      </div>` : ''}
      ${u.ziel ? `<div style="font-size:10.5px;color:${brownDark};line-height:1.4;padding-top:6px;border-top:1px solid #eee;"><strong>Ziel:</strong> ${u.ziel}</div>` : ''}
    </div>`).join('')}
  </div>
</div>

<!-- REISEÜBELKEIT -->
${d.reise_angst.reiseuebelkeit ? `<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | REISE-GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Reiseübelkeit bei ${dogName}</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Viele Hunde werden während der Autofahrt übel - vor allem am Anfang. Diese Tipps helfen sofort und langfristig.</p>
    <div style="background:white;border-radius:12px;padding:16px 18px;margin-bottom:14px;">
      <div style="font-size:12px;font-weight:700;color:${brownDark};margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Was du tun kannst</div>
      ${(d.reise_angst.reiseuebelkeit.was_tun||[]).map((t,i)=>`<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;">
        <div style="width:24px;height:24px;background:${brown};border-radius:50%;color:white;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</div>
        <div style="font-size:12px;color:#555;line-height:1.5;padding-top:2px;">${t}</div>
      </div>`).join('')}
    </div>
    ${d.reise_angst.reiseuebelkeit.hinweise ? `<div style="background:${greenBg};border-radius:10px;padding:12px 16px;font-size:12px;color:#166534;line-height:1.5;"><strong>Gute Nachricht:</strong> ${d.reise_angst.reiseuebelkeit.hinweise}</div>` : ''}
  </div>
</div>` : ''}` : ''}

<!-- TRANSPORT: WÄHREND DER FAHRT -->
${(d.transport_tipps||{}).waehrend_fahrt ? `<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | REISE-GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Während der Fahrt</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Was du während der Reise mit ${travelLabel} beachten solltest - Pausen, Ernährung, Reiseübelkeit und Stress-Management.</p>
    <div class="card-grid grid-2">
      ${d.transport_tipps.waehrend_fahrt.map(s=>`<div style="background:white;border-radius:12px;padding:14px 16px;">
        <div style="font-size:13px;font-weight:700;color:${brownDark};margin-bottom:6px;">${s.titel}</div>
        <div style="font-size:12px;color:#555;line-height:1.5;">${s.text}</div>
      </div>`).join('')}
    </div>
  </div>
  <div class="page-num">6</div>
</div>` : ''}

<!-- TRANSPORT: REGELUNGEN -->
${(d.transport_tipps||{}).regelungen ? `<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | REISE-GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Wichtige Regelungen bei ${travelLabel}</h2>
    <div class="accent-line" style="background:${red};"></div>
    <p class="intro-text">Das musst du rechtlich beachten. Verstöße können teuer werden - und im schlimmsten Fall wird ${dogName} von der Fahrt ausgeschlossen.</p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${d.transport_tipps.regelungen.map(r=>`<div style="background:white;border-radius:12px;padding:16px 18px;border-left:3px solid ${red};">
        <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:6px;">${r.land_oder_situation}</div>
        <div style="font-size:12px;color:#555;line-height:1.5;margin-bottom:6px;">${r.regelung}</div>
        ${r.strafe ? `<div style="font-size:11px;color:${red};font-weight:600;">Bei Verstoß: ${r.strafe}</div>` : ''}
      </div>`).join('')}
    </div>
  </div>
  <div class="page-num">7</div>
</div>` : ''}

<!-- UNTERKUNFT -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | REISE-GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Die richtige Unterkunft finden</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Nicht jedes Hotel ist hundefreundlich. So findest du die richtige Unterkunft und bereitest den Aufenthalt vor.</p>
    <div class="card-grid grid-2">
      ${((d.unterkunft||{}).finden||[]).map(u=>`<div style="background:white;border-radius:12px;padding:14px 16px;">
        <div style="font-size:13px;font-weight:700;color:${brownDark};margin-bottom:6px;">${u.titel}</div>
        <div style="font-size:12px;color:#555;line-height:1.5;">${u.text}</div>
      </div>`).join('')}
    </div>

    ${(d.unterkunft||{}).vor_ort ? `<div style="background:${brownLight};border-radius:12px;padding:16px 20px;margin-top:16px;">
      <div style="font-size:12px;font-weight:700;color:${brownDark};margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Die ersten 24 Stunden vor Ort</div>
      ${d.unterkunft.vor_ort.map(v=>`<div style="font-size:12px;color:#555;margin-bottom:5px;padding-left:16px;position:relative;line-height:1.5;"><span style="position:absolute;left:0;color:${brown};font-weight:700;">✓</span>${v}</div>`).join('')}
    </div>` : ''}
  </div>
  <div class="page-num">8</div>
</div>

<!-- NOTFÄLLE UNTERWEGS -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | REISE-GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Typische Notfälle unterwegs</h2>
    <div class="accent-line" style="background:${red};"></div>
    <p class="intro-text">Das sind die häufigsten Probleme auf Reisen - und was du konkret tun kannst wenn sie passieren.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${(d.notfaelle_unterwegs||[]).map(n=>`<div style="background:white;border-radius:10px;padding:12px 14px;border-left:3px solid ${red};">
        <div style="font-size:12px;font-weight:700;color:${red};margin-bottom:6px;">${n.situation}</div>
        <div style="font-size:9px;font-weight:700;color:${brown};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Was tun</div>
        ${(n.was_tun||[]).map((t,ti)=>`<div style="font-size:10px;color:#555;margin-bottom:2px;padding-left:12px;position:relative;line-height:1.4;"><span style="position:absolute;left:0;color:${brown};font-weight:700;">${ti+1}.</span>${t}</div>`).join('')}
        ${n.praevention ? `<div style="font-size:9px;color:#999;margin-top:6px;padding-top:6px;border-top:1px solid #eee;line-height:1.4;"><strong style="color:${brownDark};">Vorbeugen:</strong> ${n.praevention}</div>` : ''}
      </div>`).join('')}
    </div>
  </div>
</div>

<!-- EU EINREISE-REGELUNGEN -->
<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | REISE-GUIDE</div>
  <div style="margin-top:20px;">
    <h2>EU-Einreisebestimmungen</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Die wichtigsten Anforderungen für Reisen innerhalb der EU. Informiere dich immer nochmal tagesaktuell beim jeweiligen Konsulat.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      ${(d.einreise_regelungen||[]).map(e=>`<div style="background:white;border-radius:10px;padding:12px 14px;border-top:2px solid ${brown};">
        <div style="font-size:12px;font-weight:700;color:#1a1a1a;margin-bottom:6px;">${e.land}</div>
        <div style="font-size:9px;font-weight:700;color:${brown};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Anforderungen</div>
        ${(e.anforderungen||[]).map(a=>`<div style="font-size:10px;color:#555;margin-bottom:2px;padding-left:10px;position:relative;line-height:1.4;"><span style="position:absolute;left:0;color:${brown};">•</span>${a}</div>`).join('')}
        ${e.besonderheiten ? `<div style="font-size:9px;color:#999;margin-top:6px;padding-top:6px;border-top:1px solid #eee;line-height:1.4;"><strong style="color:${brownDark};">Besonderheit:</strong> ${e.besonderheiten}</div>` : ''}
      </div>`).join('')}
    </div>
  </div>
</div>

<!-- TIERARZT NOTFALL -->
${d.tierarzt_notfall ? `<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | REISE-GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Tierarzt-Notfall im Ausland</h2>
    <div class="accent-line" style="background:${red};"></div>
    <p class="intro-text">Im Notfall zählt jede Minute. Notiere dir diese Nummern schon vor der Reise - und speichere sie im Handy.</p>

    ${d.tierarzt_notfall.europa ? `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
      ${d.tierarzt_notfall.europa.map(t=>`<div style="background:white;border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px;">
        <div style="width:40px;height:40px;background:${redBg};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📞</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;color:#1a1a1a;">${t.land}</div>
          <div style="font-size:11px;color:#999;">${t.beschreibung||''}</div>
        </div>
        <div style="font-size:14px;font-weight:800;color:${red};">${t.nummer}</div>
      </div>`).join('')}
    </div>` : ''}

    ${d.tierarzt_notfall.tipps ? `<div style="background:${brownLight};border-radius:12px;padding:16px 20px;">
      <div style="font-size:12px;font-weight:700;color:${brownDark};margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Profi-Tipps</div>
      ${d.tierarzt_notfall.tipps.map(t=>`<div style="font-size:12px;color:#555;margin-bottom:5px;padding-left:16px;position:relative;line-height:1.5;"><span style="position:absolute;left:0;color:${brown};font-weight:700;">✓</span>${t}</div>`).join('')}
    </div>` : ''}
  </div>
</div>` : ''}

<!-- DO'S & DONT'S -->
${d.dos_donts ? `<div class="page">
  <div class="header"></div><div class="header-text">PFOTEN-PLAN | REISE-GUIDE</div>
  <div style="margin-top:20px;">
    <h2>Do's & Don'ts auf Reisen</h2>
    <div class="accent-line"></div>
    <p class="intro-text">Auf einen Blick: Was du machen solltest - und was du absolut vermeiden musst.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="background:${greenBg};border-radius:12px;padding:18px;border-left:3px solid ${green};">
        <div style="font-size:13px;font-weight:700;color:${green};margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Do's</div>
        ${(d.dos_donts.dos||[]).map(d=>`<div style="font-size:12px;color:#333;margin-bottom:8px;padding-left:18px;position:relative;line-height:1.5;"><span style="position:absolute;left:0;color:${green};font-weight:700;">✓</span>${d}</div>`).join('')}
      </div>
      <div style="background:${redBg};border-radius:12px;padding:18px;border-left:3px solid ${red};">
        <div style="font-size:13px;font-weight:700;color:${red};margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Don'ts</div>
        ${(d.dos_donts.donts||[]).map(d=>`<div style="font-size:12px;color:#333;margin-bottom:8px;padding-left:18px;position:relative;line-height:1.5;"><span style="position:absolute;left:0;color:${red};font-weight:700;">×</span>${d}</div>`).join('')}
      </div>
    </div>
  </div>
</div>` : ''}

<!-- ABSCHLUSS -->
<div class="page" style="display:flex;align-items:center;justify-content:center;text-align:center;">
  <div style="max-width:550px;">
    <div style="font-size:10px;font-weight:700;color:${brown};letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">PFOTEN-PLAN</div>
    <h2 style="margin-bottom:6px;">Schöne Reise mit ${dogName}!</h2>
    <div class="accent-line" style="margin:0 auto 20px;"></div>
    <p style="font-size:13px;color:#555;line-height:1.8;margin-bottom:14px;">Mit guter Vorbereitung wird jede Reise entspannt. Du hast jetzt alles, was du brauchst um ${dogName} sicher ans Ziel und wieder zurück zu bringen.</p>
    <p style="font-size:13px;color:#555;line-height:1.8;margin-bottom:14px;">Vergiss nicht: Hunde spüren unsere Stimmung. Je ruhiger du die Reise angehst, desto entspannter bleibt auch ${dogName}.</p>
    <p style="font-size:13px;color:#555;line-height:1.8;margin-bottom:20px;">Bei konkreten Fragen zur Reise erreichst du unser Team per E-Mail.</p>
    <div style="background:${brownLight};border-radius:12px;padding:14px 20px;display:inline-block;">
      <p style="font-size:12px;color:${brownDark};font-weight:600;margin-bottom:3px;">Fragen unterwegs?</p>
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
      subject: `[TEST] Reise-Guide für ${dogName}`,
      htmlContent: `<div style="font-family:sans-serif;text-align:center;padding:30px;"><h2 style="color:#C4A576;">Reise-Guide für ${dogName}</h2><p>PDF im Anhang</p></div>`,
      attachment: [{ name: `ReiseGuide-${dogName}.pdf`, content: pdfBase64 }]
    })
  });

  if (emailRes.ok) console.log("Email + PDF gesendet!");
  else console.error("Error:", await emailRes.text());
}

run().catch(console.error);
