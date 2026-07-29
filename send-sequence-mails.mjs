// Plain-Sequenz-Mails (ohne Bilder, "hässlich simpel") für die 3 Segmente.
// Mail 1 je Segment existiert bereits (mit Bild) — hier die Folge-Mails 2-4.
//
//   email_captured : ec2 (Tag2 Social Proof), ec3 (Tag5 Einwand)
//   pending        : p2  (24h Risiko-Umkehr),  p3  (48-72h sanfter Anstoß)
//   kaeufer        : b2  (Tag2 Aktivierung),    b3 (Tag5 Features), b4 (Tag10 Bewertung)
//
// node send-sequence-mails.mjs            -> Subjects (dry)
// node send-sequence-mails.mjs --write    -> schreibt email-samples/seq-*.html
// node send-sequence-mails.mjs --send     -> sendet an max@primesocial.de

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
for (const m of [...e.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)])
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");

const SEND = process.argv.includes("--send");
const WRITE = process.argv.includes("--write");
const TO = "max@primesocial.de";
const BASE = "https://www.pfoten-plan.de";
const sendBrevoMail = SEND ? (await import("./lib/member-mail.ts")).sendBrevoMail : null;

// ── Beispiel-Lead (echte Sends ziehen das aus den Quizdaten) ──────────
const dogName = "Balu";
const breed = "Mischling";
const problem = "Leinenziehen";        // Hauptthema (für Themen-Satz)
const RUECKHOL = `${BASE}/rueckhol.html`;
const MITGLIEDER = `${BASE}/mitglieder`;

const link = (href, text) => `<a href="${href}" style="color:#1a5e2e;font-weight:600;">${text}</a>`;
const p = (t) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#222;">${t}</p>`;

function plain(o) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${o.subject}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222;">
<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${o.preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:30px 18px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
<tr><td>
${o.body}
<p style="margin:24px 0 0;font-size:16px;line-height:1.6;color:#222;">Viele Grüße<br>Max · Pfoten-Plan</p>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#999;">Pfoten-Plan · <a href="mailto:support@pfoten-plan.de" style="color:#999;">support@pfoten-plan.de</a><br><a href="{{ unsubscribe }}" style="color:#999;">Aus diesen E-Mails abmelden</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

const mails = [
  // ───────── email_captured ─────────
  {
    key: "seq-ec2-socialproof",
    subject: `Wie Rocky in 3 Wochen aufgehört hat zu ziehen`,
    preheader: `Eine kurze Geschichte aus dieser Woche.`,
    body:
      p(`kurz eine Geschichte, die gut zu ${dogName} passt:`) +
      p(`Rocky, ein ${breed} wie ${dogName}, hat bei jedem Spaziergang gezogen wie ein Schlittenhund. Seine Halterin Anja war kurz davor, gar nicht mehr rauszugehen.`) +
      p(`Sie hat mit unserem Plan angefangen — 10 Minuten am Tag. Nach Woche 1 nichts. Nach Woche 2 die ersten lockeren Meter. Nach Woche 3 schrieb sie uns: „Zum ersten Mal seit zwei Jahren ein Spaziergang ohne Schmerzen im Arm."`) +
      p(`${problem} ist genau das, womit die meisten bei uns starten — und ehrlich, bei Hunden wie ${dogName} sehen wir da oft die schnellsten Fortschritte, weil sie schnell lernen, sobald die Übungen klar aufgebaut sind.`) +
      p(`Wenn du sehen willst, wie ${dogName}s Plan aussieht: ${link(RUECKHOL, `${dogName}s Plan ansehen →`)}`),
  },
  {
    key: "seq-ec3-einwand",
    subject: `Funktioniert das auch bei einem sturen Hund?`,
    preheader: `Die Frage, die uns am häufigsten erreicht.`,
    body:
      p(`das ist die Frage, die wir am häufigsten bekommen — also ganz ehrlich:`) +
      p(`Ja. Gerade bei „sturen" Hunden liegt es fast nie am Hund, sondern daran, dass die Übungen vorher zu schwer angesetzt waren. ${dogName} ist nicht stur — er weiß nur noch nicht genau, was du von ihm willst.`) +
      p(`Deshalb baut der Plan in winzigen Schritten auf. Jede Übung ist so klein, dass ${dogName} sie schaffen *kann* — und Erfolg ist der einzige Weg, wie Hunde dauerhaft lernen.`) +
      p(`Falls es nach 30 Tagen nichts bringt, bekommst du jeden Cent zurück. Das Risiko liegt komplett bei uns.`) +
      p(`${link(RUECKHOL, `${dogName}s Plan ansehen →`)}`),
  },
  // ───────── pending ─────────
  {
    key: "seq-p2-risiko",
    subject: `Kein Risiko für dich, ${dogName}s Plan ist abgesichert`,
    preheader: `30 Tage Geld-zurück. Kein Abo. Kein Kleingedrucktes.`,
    body:
      p(`du warst gestern kurz davor, ${dogName}s Plan zu holen — und hast dann doch gezögert. Völlig okay. Meistens liegt es nicht am Plan, sondern an der Frage „und wenn's nichts bringt?".`) +
      p(`Deshalb ganz klar: <strong>30 Tage Geld-zurück-Garantie.</strong> Bringt der Plan in einem Monat keine Veränderung, schreibst du uns eine Zeile und bekommst alles zurück. <strong>Kein Abo</strong>, einmal zahlen, der Zugang bleibt.`) +
      p(`Du gehst also kein Risiko ein — wir schon. Und wir machen das, weil es bei den allermeisten funktioniert.`) +
      p(`Beim letzten Mal ist der Abschluss einfach nicht ganz durchgelaufen — das passiert, kein Problem. Ein neuer Anlauf dauert nur eine Minute, du machst genau da weiter: ${link(RUECKHOL, `${dogName}s Plan abschließen →`)}`),
  },
  {
    key: "seq-p3-anstoss",
    subject: `Wir halten ${dogName}s Plan noch für dich bereit`,
    preheader: `Kein Druck, nur eine kurze Erinnerung.`,
    body:
      p(`kurze Erinnerung, ganz ohne Druck: ${dogName}s personalisierter Plan liegt bei uns bereit — mit allen Daten, die du schon eingegeben hast.`) +
      p(`Wir wissen, der Alltag kommt dazwischen. Deshalb haben wir nichts gelöscht. Du müsstest nur einmal kurz abschließen, dann ist ${dogName}s Plan sofort per E-Mail bei dir.`) +
      p(`Und damit der Start sich richtig lohnt, legen wir dir bei Abschluss heute eine kurze Bonus-Anleitung „Die ersten 7 Tage" dazu — die Sachen, die am Anfang den größten Unterschied machen.`) +
      p(`${link(RUECKHOL, `${dogName}s Plan jetzt sichern →`)}`),
  },
  // ───────── kaeufer ─────────
  {
    key: "seq-b2-aktivierung",
    subject: `${dogName} wartet auf Tag 1`,
    preheader: `Der wichtigste Tag ist der erste. Er dauert 10 Minuten.`,
    body:
      p(`du hast ${dogName}s Plan geholt — stark. Eine Sache fehlt noch: der erste Schritt.`) +
      p(`Wir sehen es in den Daten ganz klar: Wer Tag 1 macht, bleibt dran. Wer wartet, vergisst es. Und Tag 1 dauert keine 10 Minuten.`) +
      p(`Log dich einmal ein, öffne ${dogName}s Plan und mach <strong>nur die erste Übung</strong>. Mehr nicht. Der Rest kommt von allein.`) +
      p(`${link(MITGLIEDER, `${dogName}s Plan öffnen →`)}`),
  },
  {
    key: "seq-b3-features",
    subject: `Die zwei Funktionen, die den Unterschied machen`,
    preheader: `Damit du mit ${dogName} nicht alleine durchgehst.`,
    body:
      p(`du bist jetzt ein paar Tage dabei — Zeit für die zwei Sachen, die die meisten übersehen, obwohl sie am meisten bringen:`) +
      p(`<strong>1. Das Stimmungs-Tagebuch.</strong> Trag wöchentlich kurz ein, wie's mit ${dogName} lief. Die KI wertet es aus und sagt dir konkret, woran du als Nächstes arbeiten solltest. So bleibt der Plan auf ${dogName} abgestimmt, nicht auf den Durchschnittshund.`) +
      p(`<strong>2. Der KI-Trainer.</strong> Steckst du fest, frag ihn — rund um die Uhr, mit dem Wissen unseres Trainer-Teams. Keine Frage ist zu klein.`) +
      p(`${link(MITGLIEDER, `Im Mitglieder-Bereich ausprobieren →`)}`),
  },
  {
    key: "seq-b4-bewertung",
    subject: `Wie läuft's mit ${dogName}?`,
    preheader: `Zwei Minuten ehrliches Feedback?`,
    body:
      p(`du bist jetzt rund 10 Tage mit ${dogName} dabei — ich bin ehrlich neugierig, wie's läuft.`) +
      p(`Wenn schon was besser geworden ist: Würdest du uns mit zwei Sätzen eine kurze Bewertung dalassen? Das hilft anderen Hundehaltern enorm bei der Entscheidung — und uns, dass wir das hier weitermachen können. ${link(RUECKHOL, `Ja, gerne bewerten →`)}`) +
      p(`Und falls etwas <strong>nicht</strong> rund läuft: antworte einfach auf diese Mail. Schreib mir, woran's hakt — wir finden eine Lösung für ${dogName}, bevor du ans Aufgeben denkst. Ich lese das persönlich.`),
  },
];

if (WRITE) mkdirSync("email-samples", { recursive: true });

for (const m of mails) {
  const html = plain(m);
  console.log(`\n▶ ${m.key}`);
  console.log(`  Subject: ${m.subject}`);
  if (WRITE) { writeFileSync(`email-samples/${m.key}.html`, html, "utf8"); console.log(`  ✓ geschrieben: email-samples/${m.key}.html`); }
  if (SEND) { const r = await sendBrevoMail({ to: TO, subject: "[Seq] " + m.subject, html, tags: ["seq-plain", m.key] }); console.log(`  ${r.ok ? "✓ gesendet" : "✗ " + r.reason}`); }
  if (!WRITE && !SEND) console.log(`  [dry]`);
}
console.log(`\nFertig.${SEND ? "" : " (dry/write — mit --send an " + TO + ")"}`);
