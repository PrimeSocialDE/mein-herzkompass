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
      system: `Du erstellst einen SEHR ausführlichen, personalisierten Ernährungsplan für Hunde.

EXTREM WICHTIG: Verwende ABSOLUT KEIN Markdown. Keine Sterne (**), keine Hashtags (#), keine Unterstriche (_), keine Backticks. NUR reiner Text mit Zeilenumbrüchen.

Alles auf Deutsch, Du-Form.

Trenne Abschnitte mit === auf einer eigenen Zeile. Überschriften einfach als eigene Zeile schreiben, OHNE Sonderzeichen davor oder drumherum.

ABSCHNITTE:

===
${dogName}'s persönlicher Ernährungsplan
Personalisiert für ${breed}, ${weight}

===
Warum ein individueller Ernährungsplan?

4-5 Absätze über Ernährung speziell für ${breed}, warum pauschale Tipps nicht reichen, wie Ernährung Verhalten/Fell/Energie beeinflusst. Umstellungstipp über 7 Tage.

===
${dogName}'s Tagesplan

MORGENS (7:00 - 8:00 Uhr)
Hauptfutter: [konkret mit Gramm]
Zusatz: [z.B. Lachsöl, Menge]
Tipp: [praktisch]

MITTAGS (12:00 - 13:00 Uhr)
Snack: [konkret]
Tipp: [praktisch]

ABENDS (18:00 - 19:00 Uhr)
Hauptfutter: [konkret mit Gramm]
Zusatz: [z.B. Gemüse]
Tipp: [praktisch]

===
Die richtige Menge für ${dogName}

Trockenfutter: X-Y Gramm pro Tag
Nassfutter: X-Y Gramm pro Tag
Mischfütterung: Verhältnis
BARF: Fleisch X g, Gemüse X g, Öl X ml
Rippen-Test erklären
Anpassung bei Bewegung/Jahreszeit

===
Was ${breed} wirklich braucht

Protein: Menge, Quellen
Fett: Menge, Omega-3/6
Kohlenhydrate: welche
Vitamine: A, D, E, K
Mineralstoffe: Kalzium, Phosphor
Spezielle Bedürfnisse für ${breed}

===
Gesunde Snacks für ${dogName}

10 erlaubte Snacks mit Name, warum gut, wie viel, wie geben.
3 Snack-Regeln.

===
5 Selbstgemachte Leckerli-Rezepte

Pro Rezept:
Name des Rezepts
Zutaten: [mit Mengen]
Zubereitung:
1. Schritt
2. Schritt
3. Schritt
4. Schritt
Aufbewahrung: [wie lange, wo]

===
Giftig und gefährlich

15 verbotene Lebensmittel mit Name, warum gefährlich, Symptome.

===
Notfall - ${dogName} hat etwas Giftiges gefressen

5 Schritte was zu tun ist.
Tierarzt-Notfallnummern.

===
Futterumstellung - So machst du es richtig

7-Tage-Plan mit Prozent-Aufteilung.
Was bei Durchfall tun.
Wann zum Tierarzt.

===
Deine Einkaufsliste

Nach Kategorie: Trockenfutter, Nassfutter, Öle, Gemüse, Obst, Snacks, Aufbewahrung. Jeweils 3-5 konkrete Empfehlungen.

===
Abschluss

3-4 Absätze Zusammenfassung und Support-Hinweis (support@pfoten-plan.de).`,
      messages: [{ role: "user", content: `Erstelle den vollständigen Ernährungsplan für ${dogName} (${breed}, erwachsen, ${weight}, normal aktiv). KEINE Sterne, KEIN Markdown, nur reiner Text.` }]
    })
  });

  if (!claudeRes.ok) { console.error(await claudeRes.text()); return; }
  const data = await claudeRes.json();
  let content = data.content[0].text;
  console.log(`Text: ${content.length} Zeichen`);

  // Sterne und Markdown-Reste entfernen
  content = content.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/gm, '').replace(/_([^_]+)_/g, '$1');

  const sections = content.split(/={3,}/).map(p => p.trim()).filter(p => p.length > 0);
  console.log(`${sections.length} Abschnitte`);

  // PDF erstellen
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const green = rgb(0.176, 0.541, 0.306);       // #2D8A4E
  const greenLight = rgb(0.91, 0.96, 0.93);      // #E8F5ED
  const greenDark = rgb(0.106, 0.369, 0.188);    // #1B5E30
  const textColor = rgb(0.1, 0.1, 0.1);
  const textGray = rgb(0.4, 0.4, 0.4);
  const bgColor = rgb(0.976, 0.965, 0.941);      // #F9F6F0
  const white = rgb(1, 1, 1);

  const W = 842; // A4 landscape
  const H = 595;
  const margin = 50;
  const contentW = W - margin * 2;

  function drawHeader(page) {
    page.drawRectangle({ x: 0, y: H - 36, width: W, height: 36, color: green });
    page.drawText('Pfoten-Plan · Ernährungsplan', { x: W / 2 - 80, y: H - 26, size: 12, font: fontBold, color: white });
  }

  function drawPageNum(page, num) {
    page.drawText(String(num), { x: W - margin, y: 15, size: 10, font: fontBold, color: textGray });
  }

  function wrapText(text, maxWidth, fontSize, usedFont) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (usedFont.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // TITLE PAGE
  let page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bgColor });
  page.drawText('PFOTEN-PLAN', { x: margin, y: H - 80, size: 12, font: fontBold, color: green });
  page.drawText(dogName + "'s persönlicher", { x: margin, y: H - 140, size: 34, font: fontBold, color: textColor });
  page.drawText("Ernährungsplan", { x: margin, y: H - 180, size: 34, font: fontBold, color: textColor });
  page.drawRectangle({ x: margin, y: H - 200, width: 80, height: 4, color: green });
  page.drawText(`Personalisiert für ${breed} · ${weight}`, { x: margin, y: H - 225, size: 13, font: font, color: textGray });

  // Stats boxes
  const stats = [['12', 'Kapitel'], ['5', 'Rezepte'], ['15+', 'Tipps']];
  stats.forEach((s, idx) => {
    const bx = margin + idx * 110;
    page.drawRectangle({ x: bx, y: H - 310, width: 90, height: 60, color: white });
    page.drawText(s[0], { x: bx + 25, y: H - 280, size: 22, font: fontBold, color: green });
    page.drawText(s[1], { x: bx + 20, y: H - 300, size: 9, font: font, color: textGray });
  });

  // CONTENT PAGES
  let pageNum = 1;

  for (let s = 1; s < sections.length; s++) {
    const sectionText = sections[s];
    const lines = sectionText.split('\n');

    page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bgColor });
    drawHeader(page);
    pageNum++;
    drawPageNum(page, pageNum);

    let y = H - 65;
    const lineH = 14;
    const colWidth = (contentW - 30) / 2;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { y -= 8; continue; }

      // New page if needed
      if (y < 50) {
        page = doc.addPage([W, H]);
        page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bgColor });
        drawHeader(page);
        pageNum++;
        drawPageNum(page, pageNum);
        y = H - 65;
      }

      // Detect heading (first line or short line that looks like title)
      const isMainHeading = lines.indexOf(rawLine) === 0 && line.length < 80;
      const isSubHeading = line.match(/^(MORGENS|MITTAGS|ABENDS|VOR DEM|Protein|Fett|Kohlenhydrate|Vitamine|Mineralstoffe|Ballaststoffe|Spezielle|Trockenfutter|Nassfutter|BARF|Snack-Regeln|Aufbewahrung|Zubereitung|Zutaten|Name des)/i);
      const isNumbered = line.match(/^(\d+)\.\s/);
      const isBullet = line.startsWith('- ') || line.startsWith('• ');

      if (isMainHeading) {
        const wrapped = wrapText(line, contentW, 18, fontBold);
        for (const wl of wrapped) {
          page.drawText(wl, { x: margin, y, size: 18, font: fontBold, color: textColor });
          y -= 24;
        }
        y -= 4;
      } else if (isSubHeading) {
        // Green tag background
        const tw = fontBold.widthOfTextAtSize(line, 11) + 16;
        page.drawRectangle({ x: margin, y: y - 4, width: tw, height: 18, color: greenLight });
        page.drawText(line, { x: margin + 8, y, size: 11, font: fontBold, color: greenDark });
        y -= 22;
      } else if (isNumbered) {
        const num = line.match(/^(\d+)\./)[1];
        const rest = line.replace(/^\d+\.\s*/, '');
        const wrapped = wrapText(rest, contentW - 28, 10, font);
        // Green circle
        page.drawCircle({ x: margin + 8, y: y + 3, size: 8, color: green });
        page.drawText(num, { x: margin + 5, y: y, size: 8, font: fontBold, color: white });
        page.drawText(wrapped[0] || '', { x: margin + 22, y, size: 10, font: font, color: textColor });
        y -= lineH;
        for (let w = 1; w < wrapped.length; w++) {
          page.drawText(wrapped[w], { x: margin + 22, y, size: 10, font: font, color: textColor });
          y -= lineH;
        }
      } else if (isBullet) {
        const text = line.substring(2);
        const wrapped = wrapText(text, contentW - 18, 10, font);
        page.drawText('•', { x: margin + 6, y, size: 10, font: fontBold, color: green });
        page.drawText(wrapped[0] || '', { x: margin + 18, y, size: 10, font: font, color: textColor });
        y -= lineH;
        for (let w = 1; w < wrapped.length; w++) {
          page.drawText(wrapped[w], { x: margin + 18, y, size: 10, font: font, color: textColor });
          y -= lineH;
        }
      } else {
        const wrapped = wrapText(line, contentW, 10, font);
        for (const wl of wrapped) {
          if (y < 50) {
            page = doc.addPage([W, H]);
            page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bgColor });
            drawHeader(page);
            pageNum++;
            drawPageNum(page, pageNum);
            y = H - 65;
          }
          page.drawText(wl, { x: margin, y, size: 10, font: font, color: textGray });
          y -= lineH;
        }
      }
    }
  }

  const pdfBytes = await doc.save();
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
  console.log(`PDF: ${Math.round(pdfBase64.length / 1024)} KB, ${pageNum} Seiten`);

  // Per Brevo mit PDF-Anhang senden
  const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
      to: [{ email: "kontakt@primesocial.de" }],
      subject: `[TEST v4 PDF] Ernährungsplan für ${dogName}`,
      htmlContent: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:30px;text-align:center;">
        <h2 style="color:#2D8A4E;">Ernährungsplan für ${dogName}</h2>
        <p>Im Anhang findest du den personalisierten Ernährungsplan als PDF.</p>
        <p style="color:#999;font-size:13px;">${pageNum} Seiten · Personalisiert für ${breed}</p>
      </div>`,
      attachment: [{ name: `Ernaehrungsplan-${dogName}.pdf`, content: pdfBase64 }]
    })
  });

  if (emailRes.ok) console.log("Email + PDF gesendet!");
  else console.error("Error:", await emailRes.text());
}

run().catch(console.error);
