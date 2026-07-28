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
//   7:+5 Tage · 8:+7 Tage
// Stoppt automatisch bei Kauf (status wechselt weg von email_captured).
// PL unberuehrt — der Cron filtert strikt auf NICHT-pl.

import { sendBrevoMail, wrapTemplate, escapeHtml } from "./member-mail";

const BASE = "https://www.pfoten-plan.de";

export type EcStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

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

interface EcArgs {
  to: string;
  dogName?: string | null;
  dogProblem?: string | null;
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
  return `${BASE}/deinplan3.html?${p.toString()}`;
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#374151;">${text}</p>`;
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
          intro: `Danke, dass du das Quiz für ${dog} ausgefüllt hast. Auf Basis deiner Antworten haben wir einen persönlichen Trainingsplan vorbereitet, genau auf ${dog} zugeschnitten.`,
          bodyHtml:
            p(`Wir arbeiten <strong>ausschließlich mit Belohnung</strong>, ohne Schreien, ohne Strafen, ohne Stachelhalsband. Nur klare, einfache Übungen, die du sofort starten kannst.`) +
            p(`Der Plan ist einmalig (kein Abo) und du kannst ihn dir <strong>ausdrucken</strong>, große Schrift, zum Abhaken. Und wenn du eine Frage hast, antwortest du einfach auf diese Mail, ein <strong>echter Mensch</strong> antwortet dir.`),
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
          bodyHtml: tocBlock(dog),
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
      return {
        subject: `„Aber mein Hund ist anders"`,
        html: wrapTemplate({
          ...common,
          preheader: "Kurz und ehrlich.",
          headline: `„Aber ${dog} ist anders"`,
          intro: `Hören wir oft. Und ja, jeder Hund ist anders, deshalb ist der Plan kein Standard-PDF, sondern entsteht aus deinen Antworten.`,
          bodyHtml:
            p(`Rasse, Alter, Charakter und genau das Thema, das du angekreuzt hast (${problem}), fließen ein. Die Übungen sind so gemacht, dass du sie <strong>ohne Vorerfahrung</strong> schaffst.`) +
            p(`Und du gehst kein Risiko ein:`) +
            p(`🔒 <strong>Einmal zahlen</strong>, kein Abo, kein Vertrag, der weiterläuft.<br>
               🛡️ <strong>30 Tage Geld-zurück.</strong> Passt der Plan nicht, schreib uns kurz, du bekommst dein Geld zurück.<br>
               💬 Wenn du nicht weiterweißt, hilft dir der <strong>Trainer-Chat rund um die Uhr</strong>, und echte Menschen per Mail.`),
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
          intro: `Das ist die letzte Mail dieser Reihe, wir wollen dein Postfach nicht vollmachen.`,
          bodyHtml:
            p(`Vielleicht denkst du: es wird von allein besser, oder ich schaffe es später. Verständlich. Aber jeder Tag mit klaren Regeln macht es für ${dog} <strong>leichter, nicht schwerer</strong>.`) +
            p(`Du musst dich heute nicht festlegen. Aber du kannst dir ${dog}s Plan in Ruhe ansehen. Alles kommt sofort per Mail, <strong>zum Ausdrucken</strong>, einmal zahlen, kein Abo. Und wenn es doch nicht passt: 30 Tage Geld-zurück.`),
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
