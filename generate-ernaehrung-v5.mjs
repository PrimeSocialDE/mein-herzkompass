import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const dogName = "Buddy";
const breed = "Labrador";
const weight = "30kg";

async function run() {
  console.log("Generiere Ernährungsplan...");

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: `Erstelle einen SEHR ausführlichen Ernährungsplan für Hunde. Deutsch, Du-Form.

ABSOLUT KEIN Markdown. Keine Sterne, Hashtags, Unterstriche. NUR reiner Text.

Trenne Abschnitte mit === auf eigener Zeile.

===
${dogName}'s persönlicher Ernährungsplan

===
ÜBERSCHRIFT: Warum ein individueller Ernährungsplan?
5 Absätze über Ernährung für ${breed}, warum pauschale Tipps falsch sind, wie Ernährung alles beeinflusst. Sehr ausführlich.

===
ÜBERSCHRIFT: ${dogName}'s Tagesplan
Für MORGENS, MITTAGS, ABENDS jeweils: Was füttern (konkret mit Gramm), Zusätze, praktischer Tipp. Sehr detailliert.

===
ÜBERSCHRIFT: Die richtige Menge
Trockenfutter, Nassfutter, Mischfütterung, BARF - alles mit Grammangaben. Rippen-Test. Anpassung Sommer/Winter.

===
ÜBERSCHRIFT: Nährstoffe die ${breed} braucht
Protein, Fett, Kohlenhydrate, Vitamine, Mineralstoffe - jeweils Menge, Quellen, warum wichtig. Rassespezifisch.

===
ÜBERSCHRIFT: 10 Gesunde Snacks
10 Snacks mit Name, warum gut, wie viel, wie geben. Plus 3 Snack-Regeln.

===
ÜBERSCHRIFT: 5 Selbstgemachte Rezepte
5 Rezepte mit: Name, Zutaten (mit Mengen), Zubereitung (4-5 Schritte), Aufbewahrung.

===
ÜBERSCHRIFT: 15 Verbotene Lebensmittel
15 Dinge mit Name, warum giftig, Symptome. Ausführlich.

===
ÜBERSCHRIFT: Notfall - Vergiftung
5 Schritte was tun. Tierarzt-Nummern. Wann sofort handeln.

===
ÜBERSCHRIFT: Futterumstellung in 7 Tagen
Tag-für-Tag Plan mit Prozenten. Was bei Problemen tun.

===
ÜBERSCHRIFT: Einkaufsliste
Nach Kategorie: Trockenfutter, Nassfutter, Öle, Gemüse, Obst, Snacks. Jeweils 3-5 konkrete Empfehlungen.

===
ÜBERSCHRIFT: Abschluss
3 Absätze Zusammenfassung. Support: support@pfoten-plan.de`,
      messages: [{ role: "user", content: `Ernährungsplan für ${dogName} (${breed}, erwachsen, ${weight}, normal aktiv). KEIN Markdown. Sei sehr ausführlich und konkret.` }]
    })
  });

  if (!claudeRes.ok) { console.error(await claudeRes.text()); return; }
  const data = await claudeRes.json();
  let content = data.content[0].text;
  content = content.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/gm, '').replace(/_([^_]+)_/g, '$1');
  console.log(`Text: ${content.length} Zeichen`);

  const sections = content.split(/={3,}/).map(p => p.trim()).filter(p => p.length > 0);
  console.log(`${sections.length} Abschnitte`);

  // PDF
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const green = rgb(0.176, 0.541, 0.306);
  const greenBg = rgb(0.91, 0.96, 0.93);
  const greenDark = rgb(0.106, 0.369, 0.188);
  const text = rgb(0.15, 0.15, 0.15);
  const gray = rgb(0.45, 0.45, 0.45);
  const bg = rgb(0.976, 0.965, 0.941);
  const white = rgb(1, 1, 1);

  const W = 842;
  const H = 595;
  const M = 55; // margin
  const maxW = W - M * 2;

  function wrap(str, maxWidth, size, f) {
    if (!str) return [''];
    const words = str.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  function newPage() {
    const p = doc.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });
    // Header
    p.drawRectangle({ x: 0, y: H - 32, width: W, height: 32, color: green });
    p.drawText('Pfoten-Plan  ·  Ernährungsplan', { x: W / 2 - 75, y: H - 23, size: 11, font: fontBold, color: white });
    return p;
  }

  // TITLE PAGE
  let page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });
  page.drawText('PFOTEN-PLAN', { x: M, y: H - 90, size: 11, font: fontBold, color: green });
  page.drawText(dogName + "'s persönlicher", { x: M, y: H - 150, size: 32, font: fontBold, color: text });
  page.drawText("Ernährungsplan", { x: M, y: H - 188, size: 32, font: fontBold, color: text });
  page.drawRectangle({ x: M, y: H - 205, width: 70, height: 3, color: green });
  page.drawText(`Personalisiert für ${breed}  ·  ${weight}`, { x: M, y: H - 228, size: 12, font, color: gray });

  // Stats
  [['12', 'Kapitel'], ['5', 'Rezepte'], ['15+', 'Tipps']].forEach((s, i) => {
    const bx = M + i * 100;
    const by = H - 300;
    page.drawRectangle({ x: bx, y: by, width: 80, height: 50, color: white, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 1 });
    page.drawText(s[0], { x: bx + 28, y: by + 28, size: 18, font: fontBold, color: green });
    page.drawText(s[1], { x: bx + 22, y: by + 10, size: 8, font, color: gray });
  });

  let pageCount = 1;

  // CONTENT
  for (let s = 1; s < sections.length; s++) {
    const sectionText = sections[s];
    const lines = sectionText.split('\n');

    page = newPage();
    pageCount++;
    let y = H - 55;

    for (let li = 0; li < lines.length; li++) {
      const raw = lines[li].trim();
      if (!raw) { y -= 10; continue; }

      // Check if we need new page
      if (y < 55) {
        // Page number
        page.drawText(String(pageCount), { x: W - M, y: 15, size: 9, font: fontBold, color: gray });
        page = newPage();
        pageCount++;
        y = H - 55;
      }

      // Main heading (ÜBERSCHRIFT: ...)
      const headMatch = raw.match(/^ÜBERSCHRIFT:\s*(.+)/i);
      if (headMatch) {
        const title = headMatch[1];
        const wrapped = wrap(title, maxW, 18, fontBold);
        for (const wl of wrapped) {
          page.drawText(wl, { x: M, y, size: 18, font: fontBold, color: text });
          y -= 24;
        }
        y -= 8;
        continue;
      }

      // Sub heading (MORGENS, Protein:, Tag 1:, Rezept, etc)
      const isSub = raw.match(/^(MORGENS|MITTAGS|ABENDS|VOR DEM|Protein|Fett|Kohlenhydrate|Vitamine|Mineralstoffe|Ballaststoffe|Spezielle|Trockenfutter|Nassfutter|BARF|Mischfütterung|Rippen|Snack-Regel|Aufbewahrung|Zubereitung|Zutaten|Tag \d|Schritt \d|Rezept \d|Hauptfutter|Öle|Frisches|Snacks)/i);
      if (isSub && raw.length < 80) {
        y -= 4;
        const tw = fontBold.widthOfTextAtSize(raw, 10) + 14;
        page.drawRectangle({ x: M, y: y - 3, width: Math.min(tw, maxW), height: 16, color: greenBg });
        page.drawText(raw, { x: M + 7, y, size: 10, font: fontBold, color: greenDark });
        y -= 20;
        continue;
      }

      // Numbered (1. 2. 3.)
      const numMatch = raw.match(/^(\d+)\.\s+(.+)/);
      if (numMatch) {
        const num = numMatch[1];
        const rest = numMatch[2];
        const wrapped = wrap(rest, maxW - 24, 10, font);

        page.drawCircle({ x: M + 7, y: y + 3, size: 7, color: green });
        page.drawText(num, { x: M + 4 + (num.length > 1 ? 0 : 2), y: y + 0, size: 7, font: fontBold, color: white });

        for (let w = 0; w < wrapped.length; w++) {
          if (y < 55) {
            page.drawText(String(pageCount), { x: W - M, y: 15, size: 9, font: fontBold, color: gray });
            page = newPage(); pageCount++; y = H - 55;
          }
          page.drawText(wrapped[w], { x: M + 20, y, size: 10, font, color: text });
          y -= 14;
        }
        y -= 2;
        continue;
      }

      // Bullet
      if (raw.startsWith('- ') || raw.startsWith('• ')) {
        const bText = raw.substring(2);
        const wrapped = wrap(bText, maxW - 16, 10, font);
        page.drawCircle({ x: M + 5, y: y + 3, size: 2, color: green });
        for (let w = 0; w < wrapped.length; w++) {
          if (y < 55) {
            page.drawText(String(pageCount), { x: W - M, y: 15, size: 9, font: fontBold, color: gray });
            page = newPage(); pageCount++; y = H - 55;
          }
          page.drawText(wrapped[w], { x: M + 14, y, size: 10, font, color: text });
          y -= 14;
        }
        y -= 2;
        continue;
      }

      // Check if it looks like a section title (short, no period)
      if (raw.length > 3 && raw.length < 55 && !raw.endsWith('.') && !raw.endsWith(':') && !raw.startsWith('-') && li > 0 && (!lines[li-1].trim())) {
        y -= 4;
        page.drawText(raw, { x: M, y, size: 12, font: fontBold, color: greenDark });
        y -= 18;
        continue;
      }

      // Normal text
      const wrapped = wrap(raw, maxW, 10, font);
      for (const wl of wrapped) {
        if (y < 55) {
          page.drawText(String(pageCount), { x: W - M, y: 15, size: 9, font: fontBold, color: gray });
          page = newPage(); pageCount++; y = H - 55;
        }
        page.drawText(wl, { x: M, y, size: 10, font, color: gray });
        y -= 14;
      }
    }

    // Page number on last content page
    page.drawText(String(pageCount), { x: W - M, y: 15, size: 9, font: fontBold, color: gray });
  }

  const pdfBytes = await doc.save();
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
  console.log(`PDF: ${Math.round(pdfBase64.length / 1024)} KB, ${pageCount} Seiten`);

  const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
      to: [{ email: "kontakt@primesocial.de" }],
      subject: `[TEST v5] Ernährungsplan für ${dogName} - Sauber`,
      htmlContent: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:30px;text-align:center;">
        <h2 style="color:#2D8A4E;">Ernährungsplan für ${dogName}</h2>
        <p>Im Anhang findest du den Ernährungsplan als PDF.</p>
        <p style="color:#999;font-size:13px;">${pageCount} Seiten · ${breed} · ${weight}</p>
      </div>`,
      attachment: [{ name: `Ernaehrungsplan-${dogName}.pdf`, content: pdfBase64 }]
    })
  });

  if (emailRes.ok) console.log("Email + PDF gesendet!");
  else console.error("Error:", await emailRes.text());
}

run().catch(console.error);
