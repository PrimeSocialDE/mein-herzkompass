// DE-Nurture-Sequenz fuer email_captured-Leads (pfoten-plan.de).
//
// Ersetzt den Brevo-UI-Automation-Workflow durch eine Code-Sequenz:
//   - einheitliches Marken-Design (wrapTemplate), pro Mail per Tag messbar
//     (ec-seq-N -> Brevo aggregatedReport / workflow-stats)
//   - Wording bewusst fuer aeltere Zielgruppe (ue50): warm, klar, viel Trust,
//     "zum Ausdrucken / grosse Schrift / abhaken", "echte Menschen antworten dir",
//     kein Abo / kein Vertrag / 30 Tage Geld-zurueck, KEINE Fake-Countdowns.
//   - datenbasiert: die Gewinner-Angles aus dem alten Workflow bleiben
//     (Reframe "Das Problem ist nicht {Hund}", Inhaltsverzeichnis), die
//     Verlierer (Rabatt, generische "Effektive Strategien") sind raus.
//
// Takt ab created_at (Cron /api/cron/email-captured):
//   1:+10 Min · 2:+6 Std · 3:+1 Tag · 4:+2 Tage · 5:+3 Tage · 6:+4 Tage
//   7:+5 Tage · 8:+7 Tage · 9:+10 Tage · 10:+14 Tage · 11:+21 Tage
// 9-11 seit 14.10.2026: 144 von 422 Kaeufern dieses Segments kauften erst
// NACH Mail 8 (ueber andere Kanaele) — die Nachfrage ist danach noch da.
// Stoppt automatisch bei Kauf (status wechselt weg von email_captured).
// PL unberuehrt — der Cron filtert strikt auf NICHT-pl.

import { sendBrevoMail, wrapTemplate, escapeHtml } from "./member-mail";

const BASE = "https://www.pfoten-plan.de";

export type EcStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export const EC_LAST_STAGE: EcStage = 11;

// Deutsche Problem-Labels (klein, im Satz).
const PROBLEM_DE: Record<string, string> = {
  pulling: "Ziehen an der Leine",
  barking: "Bellen",
  aggression: "Aggression",
  anxiety: "Trennungsangst",
  jumping: "Anspringen",
  recall: "der Rückruf",
  energy: "zu viel Energie",
  destructive: "Zerstören",
  soiling: "Unsauberkeit im Haus",
  mouthing: "Zwicken und Beißen",
  separation: "Alleinbleiben",
};

// Rassen-Labels (Quiz-Keys -> deutsch). "other"/unbekannt -> keine Nennung.
const BREED_DE: Record<string, string> = {
  labrador: "Labrador",
  german_shepherd: "Schäferhund",
  golden_retriever: "Golden Retriever",
  french_bulldog: "Französische Bulldogge",
  chihuahua: "Chihuahua",
  poodle: "Pudel",
  dachshund: "Dackel",
  beagle: "Beagle",
  husky: "Husky",
  border_collie: "Border Collie",
  mixed: "Mischling",
};
// Alter adjektivisch, passt in "dass {Hund} ein {Rasse} und {Alter} ist".
const AGE_PHRASE: Record<string, string> = {
  puppy: "noch jung",
  young: "jung",
  adult: "erwachsen",
  senior: "schon älter",
};

// Individualisierungs-Satz: benennt Rasse + Alter + Problem konkret ->
// zeigt "wirklich für MEINEN Hund gemacht" (gegen Scam-Eindruck).
// Degradiert sauber, wenn Rasse/Alter fehlen.
function personalNote(
  dog: string,
  breedKey: string | null | undefined,
  ageKey: string | null | undefined,
  problemLabel: string
): string {
  const breed = BREED_DE[String(breedKey || "")];
  const age = AGE_PHRASE[String(ageKey || "")];
  let who = "";
  if (breed && age) who = `dass ${dog} ein ${breed} und ${age} ist, `;
  else if (breed) who = `dass ${dog} ein ${breed} ist, `;
  else if (age) who = `dass ${dog} ${age} ist, `;
  if (who) return `Wir haben berücksichtigt, ${who}und genau dein Thema: ${problemLabel}.`;
  return `Wir haben genau dein Thema berücksichtigt: ${problemLabel}.`;
}

interface EcArgs {
  to: string;
  dogName?: string | null;
  dogProblem?: string | null;
  dogBreed?: string | null;
  dogAge?: string | null;
  leadId?: string | null;
}

function planUrl(leadId: string | null | undefined, stage: EcStage): string {
  // deinplan3 (Gewinner-Seite) stellt die Hundedaten per lead_id wieder her.
  const p = new URLSearchParams();
  if (leadId) p.set("lead_id", leadId);
  p.set("utm_source", "email");
  p.set("utm_medium", "nurture");
  p.set("utm_campaign", "ec-sequence");
  p.set("utm_content", `mail-${stage}`);
  return `${BASE}/deinplan3?${p.toString()}`;
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#374151;">${text}</p>`;
}

// Hero-Bild (volle Breite, abgerundet) — z.B. das gedruckte Heftchen.
function heroImage(src: string, alt: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:0 0 18px;">
    <img src="${src}" alt="${escapeHtml(alt)}" width="536" style="width:100%;max-width:536px;height:auto;border-radius:14px;display:block;">
  </td></tr></table>`;
}

// Kleines Bild (zentriert, abgerundet, max 300px).
function imageBlock(src: string, alt: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:2px 0 16px;">
    <img src="${src}" alt="${escapeHtml(alt)}" width="300" style="width:300px;max-width:88%;height:auto;border-radius:14px;display:block;">
  </td></tr></table>`;
}

// ── Inhaltsverzeichnis-Block (Mail 4) — E-Mail-sichere Inline-Styles ──
function tocBlock(dog: string): string {
  const phase = (
    no: string,
    name: string,
    weeks: string,
    tier: string,
    tierGreen: boolean,
    items: string[]
  ) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #EADDC5;border-radius:12px;margin:0 0 10px;background:#ffffff;">
    <tr><td style="padding:14px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:#C4A576;color:#fff;font-weight:800;font-size:13px;width:24px;height:24px;border-radius:12px;text-align:center;line-height:24px;">${no}</td>
        <td style="padding-left:10px;font-size:17px;font-weight:800;color:#2A2723;">${name}</td>
        <td style="padding-left:8px;"><span style="font-size:11px;font-weight:800;color:${tierGreen ? "#2F7A4F" : "#8B7355"};background:${tierGreen ? "#E7F1EA" : "#F1E7D5"};padding:3px 9px;border-radius:20px;white-space:nowrap;">${tier}</span></td>
      </tr></table>
      <div style="font-size:13px;font-weight:700;color:#8B7355;margin:6px 0 6px 34px;">${weeks}</div>
      <div style="font-size:15px;line-height:1.6;color:#5C574F;margin-left:34px;">${items.map((i) => `• ${i}`).join("<br>")}</div>
    </td></tr>
  </table>`;

  const chip = (t: string) =>
    `<td width="50%" style="padding:5px;"><div style="background:#EFF7F0;border:1px solid #CDE7D3;border-radius:12px;padding:11px 13px;font-size:14px;font-weight:700;color:#20402f;line-height:1.35;">${t}</div></td>`;

  return `
  ${phase("1", "Das Fundament", "Woche 1 bis 4", "schon ab 1 Monat", false, ["Sei ein Baum: Stopp bei straffer Leine", "Das SCHAU-Signal etablieren", "Bei-Fuß als Goldzone", "Entspannungsdecke als Ruhe-Anker"])}
  ${phase("2", "Reize meistern", "Woche 5 bis 12", "ab 3 Monate", false, ["SCHAU mit Außenablenkung", "Bogen bei Begegnungen", "Ruhig an Menschen und Hunden vorbei"])}
  ${phase("3", "Souverän im Alltag", "Woche 13 bis 24, entspannter, mehr Übungen", "im 6-Monats-Plan", true, ["Café- und Stadt-Training", "Vertiefung in deinem Tempo", "Wartungs-Spaziergang für immer"])}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EFF7F0;border:1px solid #CDE7D3;border-radius:12px;margin:14px 0 4px;">
    <tr><td style="padding:14px 16px;">
      <div style="font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#2F7A4F;margin-bottom:6px;">Du bestimmst dein Tempo</div>
      <div style="font-size:15px;line-height:1.6;color:#254433;">Kompakt (1 Monat) für den schnellen Einstieg, ausgewogen (3 Monate), oder ganz entspannt (6 Monate) mit den meisten Übungen, Schritt für Schritt in deinem Tempo. Egal welche Länge: <strong>einmal zahlen, kein Abo</strong>.</div>
    </td></tr>
  </table>

  <div style="font-size:16px;line-height:1.6;color:#374151;margin:18px 0 8px;"><strong>Das bekommst du dazu:</strong></div>
  ${p("🆘 <strong>Notfall-Protokoll</strong> für schwierige Momente, Schritt für Schritt.")}
  ${p(`💬 <strong>Trainer-Chat rund um die Uhr.</strong> Stell jede Frage, du kannst sogar ein Foto von ${dog} schicken.`)}
  ${p("🖨️ <strong>Alles zum Ausdrucken</strong>, große Schrift, zum Abhaken. Kein Smartphone nötig.")}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 4px;"><tr>
    ${chip("🔒 Einmal zahlen, kein Abo")}${chip("🛡️ 30 Tage Geld-zurück")}
  </tr><tr>
    ${chip("👩‍🏫 Echte Trainer, per Mail da")}${chip("🖨️ Zum Ausdrucken, große Schrift")}
  </tr></table>`;
}

/** Baut Betreff + HTML fuer eine Stage. */
export function buildEmailCaptured(
  stage: EcStage,
  args: EcArgs
): { subject: string; html: string } {
  const dog = (args.dogName || "").trim() || "deinen Hund";
  const dogCap = (args.dogName || "").trim() || "Dein Hund";
  const problem = PROBLEM_DE[String(args.dogProblem || "")] || "das Verhalten";
  const breedLabel = BREED_DE[String(args.dogBreed || "")] || "";
  const note = personalNote(dog, args.dogBreed, args.dogAge, problem);
  const cta = planUrl(args.leadId, stage);
  const common = { ctaUrl: cta, unsubscribe: true, lang: "de" as const };

  switch (stage) {
    case 1:
      return {
        subject: `${dogCap}s Trainingsplan ist fertig 🐾`,
        html: wrapTemplate({
          ...common,
          preheader: "Deine Antworten sind gespeichert, hier geht es weiter.",
          headline: `Schön, dass du da bist`,
          intro: `Danke, dass du das Quiz für ${dog} ausgefüllt hast. ${note} Auf Basis deiner Antworten haben wir einen persönlichen Trainingsplan vorbereitet.`,
          bodyHtml:
            heroImage(
              `${BASE}/deinplan-heft.jpg`,
              "Der ausgedruckte PfotenPlan als Heft auf dem Tisch, daneben Kaffee und Lesebrille"
            ) +
            p(`Das bekommt ${dog}: einen persönlichen Plan, den du dir als <strong>richtiges Heft zum Anfassen</strong> ausdrucken kannst, große Schrift, zum Abhaken. Kein Wisch-PDF.`) +
            p(`Wir arbeiten <strong>ausschließlich mit Belohnung</strong>, ohne Schreien, ohne Strafen, ohne Stachelhalsband. Nur klare, einfache Übungen, die du sofort starten kannst.`) +
            p(`Und wenn du eine Frage hast, antwortest du einfach auf diese Mail, ein <strong>echter Mensch</strong> antwortet dir.`),
          ctaText: `${dogCap}s Plan ansehen`,
        }),
      };

    case 2:
      return {
        subject: `Das Problem ist nicht ${dog}`,
        html: wrapTemplate({
          ...common,
          preheader: "Warum mehr Training oft nicht die Lösung ist.",
          headline: `Das Problem ist nicht ${dog}, es fehlt Orientierung`,
          intro: `Viele denken, ihr Hund bräuchte mehr Training. Meistens fehlt aber etwas anderes: klare, ruhige Orientierung.`,
          bodyHtml:
            p(`Hunde verstehen keine langen Sätze. Sie orientieren sich an <strong>ruhiger Körpersprache</strong> und klaren Signalen. Je hektischer wir werden, desto weniger kommt an.`) +
            p(`Genau da setzt der Plan an: einfache, immer gleiche Abläufe, die ${dog} versteht. Kein Drill, sondern Klarheit. Schon <strong>5 bis 10 Minuten am Tag</strong> reichen.`),
          ctaText: `Sehen, wie das für ${dog} aussieht`,
        }),
      };

    case 3:
      return {
        subject: `Eine Übung für ${dog}, die du heute machen kannst`,
        html: wrapTemplate({
          ...common,
          preheader: "Kostenlos, dauert 5 Minuten.",
          headline: `Die 5-Minuten-Übung vor der Haustür`,
          intro: `Bevor du irgendetwas kaufst, hier eine Übung, die du sofort ausprobieren kannst, ganz umsonst.`,
          bodyHtml:
            p(`<strong>So geht es:</strong> Bevor ihr rausgeht, bleib an der geschlossenen Tür ruhig stehen. Erst wenn ${dog} kurz ruhig ist, öffnest du. Zieht er wieder an, schließt du die Tür. Ruhig sein heißt: die Tür geht auf.`) +
            p(`Das klingt klein, aber es setzt den Ton für den ganzen Spaziergang. Viele merken schon nach ein paar Tagen einen Unterschied.`) +
            p(`Im Plan bekommst du <strong>Woche für Woche</strong> solche Übungen, zum Ausdrucken und Abhaken.`),
          ctaText: `Mehr Übungen für ${dog}`,
        }),
      };

    case 4:
      return {
        subject: `So ist ${dog}s Plan aufgebaut, Woche für Woche`,
        html: wrapTemplate({
          ...common,
          preheader: "Ein offener Blick ins Inhaltsverzeichnis.",
          headline: `So ist ${dog}s Plan aufgebaut`,
          intro: `Kein geheimnisvolles PDF, sondern ein klar aufgebautes Programm zum Abhaken. Und du wählst selbst, wie viel Zeit ihr euch nehmt.`,
          bodyHtml:
            heroImage(
              `${BASE}/deinplan-heft.jpg`,
              "Der ausgedruckte PfotenPlan als Heft auf dem Tisch, daneben Kaffee und Lesebrille"
            ) +
            p(`So sieht ${dog}s Plan aus, wenn du ihn dir <strong>ausdruckst</strong>: ein richtiges Heft zum Anfassen und Abhaken, kein Wisch-PDF.`) +
            tocBlock(dog),
          ctaText: `${dogCap}s Plan ansehen`,
        }),
      };

    case 5:
      // ⚠️ UWG: Das Zitat ist ein Beispiel. Vor Live durch eine ECHTE
      // Kundenstimme ersetzen/bestaetigen. Bild = deinplan-proof.jpg (illustrativ).
      return {
        subject: `„Ich dachte, mein Hund lernt das nicht mehr"`,
        html: wrapTemplate({
          ...common,
          preheader: "Eine Geschichte, die dir vielleicht bekannt vorkommt.",
          headline: `„Ich dachte, er lernt das in seinem Alter nicht mehr"`,
          intro: `Das schreiben uns viele. Deshalb möchten wir dir Renate vorstellen.`,
          bodyHtml:
            imageBlock(
              `${BASE}/deinplan-proof.jpg`,
              "Ältere Hundehalterin mit ihrem ausgedruckten Plan an lockerer Leine"
            ) +
            p(`💬 <em>„Ich bin 68 und dachte ehrlich, mein Rocky lernt das in seinem Alter nicht mehr. Ich habe mir den Plan ausgedruckt und hake jeden Tag ab. Nach zwei Wochen zieht er nicht mehr an der Leine. Wenn ich unsicher war, war über den Trainer-Chat sofort jemand für mich da."</em><br><strong>Renate, 68, mit Rocky</strong>`) +
            p(`Über <strong>3.000 Hunde</strong> haben den Plan schon durchlaufen. ${dogCap} kann der nächste sein.`),
          ctaText: `${dogCap}s Plan ansehen`,
        }),
      };

    case 6:
      // 14.10.2026 ersetzt: "Aber mein Hund ist anders" war die schwaechste Mail
      // (13,9 % Oeffnung / 2,7 % Klick). Neu: die echten Fragen aus WhatsApp und
      // Support, als Betreff in Kundensprache.
      return {
        subject: `Kann ich erst mal klein anfangen?`,
        html: wrapTemplate({
          ...common,
          preheader: "Die vier Fragen, die uns am häufigsten gestellt werden.",
          headline: `Deine Fragen, ehrlich beantwortet`,
          intro: `Viele schreiben uns vor dem Kauf dieselben vier Fragen. Hier sind unsere ehrlichen Antworten, damit du in Ruhe entscheiden kannst.`,
          bodyHtml:
            p(`<strong>„Kann ich erst mal klein anfangen?“</strong><br>Ja. Viele starten mit dem 4-Wochen-Plan. Die ersten vier Wochen sind das Fundament, auf dem alles Weitere aufbaut, du verpasst also nichts Wichtiges. Wenn ihr danach weitermachen wollt, schreib uns einfach, wir finden mit dir den passenden nächsten Schritt.`) +
            p(`<strong>„Ich war mir beim Alter unsicher.“</strong><br>Kein Problem. Als Faustregel: unter 6 Monaten ist Welpe, 6 bis 18 Monate Junghund. Hast du dich vertan, antworte einfach auf diese Mail, wir passen die Angaben an. Und auch nach dem Kauf gilt: Passt etwas nicht, bauen wir ${dog}s Plan um.`) +
            p(`<strong>„Unser Problem stand gar nicht in der Liste.“</strong><br>Das hören wir oft, jeder Hund ist anders. Wähl das, was am nächsten dran ist, und schreib uns kurz, was bei euch los ist. Der Plan wird aus deinen Antworten gebaut, und für alles Besondere gibt es den Trainer-Chat und echte Menschen per Mail.`) +
            p(`<strong>„Ist das ein Abo?“</strong><br>Nein. Du zahlst <strong>einmal</strong>, es verlängert sich nichts, es gibt keinen Vertrag. Und wenn der Plan nicht passt: <strong>30 Tage Geld-zurück</strong>.`) +
            p(`Noch eine andere Frage? Antworte einfach auf diese Mail, ein echter Mensch liest mit.`),
          ctaText: `${dogCap}s Plan ansehen`,
        }),
      };

    case 7:
      return {
        subject: `Diese 3 Fehler machen fast alle`,
        html: wrapTemplate({
          ...common,
          preheader: "Nummer 2 überrascht die meisten.",
          headline: `Diese 3 Fehler machen fast alle`,
          intro: `Weil sie sich richtig anfühlen. Dabei bewirken sie oft das Gegenteil.`,
          bodyHtml:
            p(`<strong>Fehler 1: Zu viel reden.</strong> „Nein, aus, komm her, ${dog}, nein!" Dein Hund hört irgendwann nur noch Rauschen. Weniger Worte, mehr klare Körpersprache.`) +
            p(`<strong>Fehler 2: Immer vorneweg laufen lassen.</strong> Fühlt sich normal an, gibt dem Hund aber das Gefühl, er muss führen. Kleine Änderung, große Wirkung.`) +
            p(`<strong>Fehler 3: Zu selten, dafür zu lang.</strong> Fünf Minuten täglich schlagen eine Stunde am Sonntag. ${dog} lernt in kleinen, ruhigen Wiederholungen.`) +
            p(`Genau so ist der Plan aufgebaut: kurz, klar, jeden Tag ein Schritt.`),
          ctaText: `${dogCap}s Plan ansehen`,
        }),
      };

    case 8:
      return {
        subject: `Der beste Tag zu starten ist heute`,
        html: wrapTemplate({
          ...common,
          preheader: "Kein Druck, nur ein ehrlicher Gedanke.",
          headline: `Der beste Tag, mit ${dog} zu starten, ist heute`,
          intro: `Ab jetzt melden wir uns seltener, wir wollen dein Postfach nicht vollmachen.`,
          bodyHtml:
            p(`Vielleicht denkst du: es wird von allein besser, oder ich schaffe es später. Verständlich. Aber jeder Tag mit klaren Regeln macht es für ${dog} <strong>leichter, nicht schwerer</strong>.`) +
            p(`Du musst dich heute nicht festlegen. Aber du kannst dir ${dog}s Plan in Ruhe ansehen. Alles kommt sofort per Mail, <strong>zum Ausdrucken</strong>, einmal zahlen, kein Abo. Und wenn es doch nicht passt: 30 Tage Geld-zurück.`),
          ctaText: `${dogCap}s Plan ansehen`,
        }),
      };

    case 9:
      return {
        subject: `Was sich bei ${dog} in der ersten Woche ändert`,
        html: wrapTemplate({
          ...common,
          preheader: "Ehrlich: keine Wunder, aber spürbare kleine Schritte.",
          headline: `Die erste Woche mit dem Plan`,
          intro: `Viele fragen uns: Was passiert eigentlich, wenn wir anfangen? Hier ist ein ehrlicher Blick auf die ersten sieben Tage.`,
          bodyHtml:
            p(`<strong>Tag 1 bis 2:</strong> Ihr lernt ein einziges, klares Signal. Fünf bis zehn Minuten, mehr nicht. ${dogCap} merkt: Wenn ich zu dir schaue, passiert etwas Gutes.`) +
            p(`<strong>Tag 3 bis 5:</strong> Das Signal klappt zu Hause zuverlässig. Jetzt nehmt ihr es mit vor die Tür, erst dort, wo wenig los ist.`) +
            p(`<strong>Tag 6 bis 7:</strong> Die meisten merken einen ersten kleinen Unterschied, zum Beispiel einen ruhigeren Start in den Spaziergang. Kein Wunder, aber ein Anfang, auf dem alles aufbaut.`) +
            p(`Jeder Tag steht im Plan, zum <strong>Ausdrucken und Abhaken</strong>. Du musst dir nichts merken.`),
          ctaText: `${dogCap}s Plan ansehen`,
        }),
      };

    case 10:
      return {
        subject: `Noch eine Übung für ${dog}: das SCHAU-Signal`,
        html: wrapTemplate({
          ...common,
          preheader: "Kostenlos, dauert 3 Minuten, funktioniert überall.",
          headline: `Das SCHAU-Signal, in 3 Minuten erklärt`,
          intro: `Die Übung vor der Haustür kennst du schon. Hier ist die zweite, die bei fast allen Themen hilft, ob Leine, Bellen oder andere Hunde.`,
          bodyHtml:
            p(`<strong>So geht es:</strong> Nimm ein Leckerli in die Hand und halte es kurz neben dein Gesicht. In dem Moment, in dem ${dog} dir in die Augen schaut, sagst du ruhig „Schau" und gibst das Leckerli.`) +
            p(`Fünfmal hintereinander, dann Pause. Nach ein paar Tagen schaut ${dog} schon auf das Wort hin zu dir, ganz ohne Leckerli neben dem Gesicht.`) +
            p(`<strong>Warum das so viel bringt:</strong> Wer zu dir schaut, kann nicht gleichzeitig nach vorne ziehen, bellen oder fixieren. Im Plan baut ihr das Woche für Woche aus, bis es auch draußen klappt.`),
          ctaText: `Alle Übungen für ${dog}`,
        }),
      };

    case 11:
      return {
        subject: `Wie läuft es mit ${dog}?`,
        html: wrapTemplate({
          ...common,
          preheader: "Eine kurze, persönliche Frage.",
          headline: `Wie läuft es bei euch?`,
          intro: `Vor drei Wochen hast du das Quiz für ${dog} ausgefüllt. Uns interessiert ehrlich, wie es euch seitdem geht.`,
          bodyHtml:
            p(`Ist es besser geworden, gleich geblieben oder schwieriger? Antworte einfach mit einem Satz auf diese Mail. Ein echter Mensch liest mit und gibt dir, wenn du magst, einen Tipp für ${dog}.`) +
            p(`Und falls du doch noch starten willst: ${dog}s Plan liegt weiter für dich bereit. Einmal zahlen, kein Abo, 30 Tage Geld-zurück.`) +
            p(`Das ist die letzte Mail dieser Reihe. Danke, dass du dir die Zeit genommen hast.`),
          ctaText: `${dogCap}s Plan ansehen`,
        }),
      };
  }
}

/** Sendet die Stage-Mail via Brevo-Transaktional (Absender support@pfoten-plan.de).
 *  Tag ec-seq-N -> Öffnung/Klick pro Mail per API messbar. */
export async function sendEmailCapturedMail(
  stage: EcStage,
  args: EcArgs
): Promise<{ ok: boolean; reason?: string }> {
  const { subject, html } = buildEmailCaptured(stage, args);
  return sendBrevoMail({
    to: args.to,
    subject,
    html,
    lang: "de",
    tags: ["ec-seq", `ec-seq-${stage}`],
  });
}
