// Email-Sequenz nach Plan-Kauf — Mails 2, 3, 4, 6, 7, 8, 9.
// (Mail 1 = bestehende sendPlanReadyEmail bleibt unverändert, Mail 5 = Brevo-Automation.)
//
// Tagliche Cron (/api/cron/email-sequence) bestimmt anhand paid_at + idempotency-flag,
// welche Mail aktuell faellig ist. Drop-out: wenn answers.email_sequence_unsubscribed_at
// gesetzt ist, oder lead.status in ['refunded','cancelled'], wird NICHT versendet.
// Mail 9 (Cross-Sell) filtert dynamisch raus, was der User schon gekauft hat.

const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const BASE = "https://www.pfoten-plan.de";

// ── Schedule ─────────────────────────────────────────────────────────
export const EMAIL_SEQUENCE_SCHEDULE: Array<{
  num: number;
  daysAfterPaid: number;
  label: string;
}> = [
  { num: 2, daysAfterPaid: 1, label: "Tag-1-Normalisierung" },
  { num: 3, daysAfterPaid: 3, label: "Tag-3-Curiosity-Loop" },
  { num: 4, daysAfterPaid: 5, label: "Tag-5-Social-Proof" },
  // Mail 5 = Brevo-Automation am Tag 7 (Übungen-Mail)
  { num: 6, daysAfterPaid: 10, label: "Tag-10-Reflexion" },
  { num: 7, daysAfterPaid: 14, label: "Tag-14-Externe-Validation" },
  { num: 8, daysAfterPaid: 21, label: "Tag-21-Plateau" },
  { num: 9, daysAfterPaid: 30, label: "Tag-30-CrossSell" },
];

// ── Breed-Image-Resolver ─────────────────────────────────────────────
function getImageSet(breed: string | null | undefined): string {
  const k = (breed || "").trim().toLowerCase();
  if (k === "mischling") return "Mischling";
  if (k === "labrador" || k === "labrador retriever") return "Labrador";
  if (k === "australian shepherd" || k === "aussie") return "Aussie";
  if (k === "golden retriever") return "Golden";
  if (
    k === "deutscher schäferhund" ||
    k === "schäferhund" ||
    k === "german shepherd"
  )
    return "Schaeferhund";
  return "Allgemein";
}

export function getEmailImageUrl(breed: string | null | undefined, n: number): string {
  return `${BASE}/email-images/${getImageSet(breed)}Email${n}.jpg`;
}

// Rasse-Display (für intros)
function displayBreed(breed: string | null | undefined): string {
  if (!breed) return "Mischling";
  const s = String(breed).trim();
  if (!s || /unknown/i.test(s)) return "Mischling";
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
function pluralBreed(breed: string | null | undefined): string {
  const k = (breed || "").trim().toLowerCase();
  if (k === "labrador" || k === "labrador retriever") return "Labradoren";
  if (k === "golden retriever") return "Golden Retrievern";
  if (
    k === "deutscher schäferhund" ||
    k === "schäferhund" ||
    k === "german shepherd"
  )
    return "Schäferhunden";
  if (k === "australian shepherd" || k === "aussie") return "Aussies";
  if (k === "border collie") return "Border Collies";
  if (k === "dackel") return "Dackeln";
  if (k === "beagle") return "Beagles";
  if (k === "mischling") return "Mischlingen";
  if (k === "havaneser" || k === "havanese") return "Havanesern";
  if (k === "goldendoodle") return "Goldendoodles";
  return "Hunden wie deinem";
}

// ── HTML-Template (bulletproof Button, target=_blank, Plain-Link-Fallback) ──
function buildHtml(opts: {
  subject: string;
  preheader: string;
  heroImg: string;
  dogBreed: string;
  headline: string;
  intro: string;
  bodyHtml: string;
  ctaUrl: string;
  ctaText: string;
  footerHint: string;
}): string {
  const {
    subject,
    preheader,
    heroImg,
    dogBreed,
    headline,
    intro,
    bodyHtml,
    ctaUrl,
    ctaText,
    footerHint,
  } = opts;
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<span style="display:none;font-size:1px;color:#FAF8F5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:22px 28px 6px;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8B7355;">Pfoten-Plan</p>
      </td></tr>
      <tr><td style="padding:8px 28px 18px;">
        <img src="${heroImg}" alt="${dogBreed}" width="544" style="width:100%;max-width:544px;height:auto;display:block;border-radius:12px;border:1px solid #F0EBE3;">
      </td></tr>
      <tr><td style="padding:0 28px 6px;">
        <h1 style="margin:0 0 14px;font-size:23px;line-height:1.28;font-weight:800;color:#1a1a1a;">${headline}</h1>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">${intro}</p>
        ${bodyHtml}
      </td></tr>
      <tr><td align="center" style="padding:24px 28px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
          <tr><td align="center" bgcolor="#C4A576" style="border-radius:12px;background:#C4A576;">
            <a href="${ctaUrl}" target="_blank" rel="noopener" style="display:inline-block;color:#FFFFFF;font-weight:700;font-size:15px;padding:16px 32px;text-decoration:none;border-radius:12px;line-height:1.2;">${ctaText}</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:0 28px 24px;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#9CA3AF;">
          Funktioniert der Button nicht? Kopier diesen Link:<br><a href="${ctaUrl}" target="_blank" rel="noopener" style="color:#8B7355;text-decoration:underline;word-break:break-all;">${ctaUrl}</a>
        </p>
      </td></tr>
      <tr><td style="padding:6px 28px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="padding:14px 16px;background:#FAFAFA;border-radius:10px;">
            <p style="margin:0;font-size:13px;line-height:1.55;color:#6B7280;">${footerHint}</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:14px 28px;background:#FAFAFA;border-top:1px solid #F0EBE3;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#9CA3AF;text-align:center;">
          Pfoten-Plan · <a href="${BASE}/mitglieder" style="color:#8B7355;text-decoration:underline;">Mein Bereich</a> · <a href="mailto:support@pfoten-plan.de" style="color:#8B7355;text-decoration:underline;">support@pfoten-plan.de</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── Mail-Content per Nummer ──────────────────────────────────────────
export interface SequenceLead {
  id: string;
  email: string;
  dog_name: string | null;
  dog_breed: string | null;
  selected_plan: string | null;
  answers: Record<string, any> | null;
}

interface MailDef {
  subject: string;
  preheader: string;
  headline: string;
  intro: string;
  bodyHtml: string;
  ctaText: string;
  footerHint: string;
}

function ctaUrlFor(lead: SequenceLead): string {
  return `${BASE}/rueckhol.html?lead_id=${encodeURIComponent(lead.id)}&email=${encodeURIComponent(lead.email)}`;
}

function buildMailDef(n: number, lead: SequenceLead): MailDef | null {
  const dogName = (lead.dog_name || "deinen Hund").trim() || "deinen Hund";
  const breed = displayBreed(lead.dog_breed);
  const plural = pluralBreed(lead.dog_breed);

  if (n === 2) {
    return {
      subject: `Tag 1 mit ${dogName} war wahrscheinlich nicht perfekt`,
      preheader: `Das ist normal. Hier ist warum.`,
      headline: `Gestern hat es nicht so geklappt wie gedacht.`,
      intro: `Das ist nicht ungewöhnlich. Bei den meisten unserer Halter ist Tag 1 der schwerste — nicht weil die Übung schwierig wäre, sondern weil ${dogName} noch nicht weiß, was du von ihr willst.`,
      bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">Was die meisten am Anfang übersehen: ${dogName} braucht für ein neues Verhaltens-Muster im Schnitt 5 bis 7 Wiederholungen, bis es das erste Mal &quot;klickt&quot;. Wenn du gestern nur 3 Versuche geschafft hast, war das nicht zu wenig — du warst erst auf halber Strecke.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:14px 0;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#8B7355;">Heute eine Sache anders machen</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">Mach die Übung heute beim ruhigsten Spaziergang des Tages. Mittags oder am späten Nachmittag. Du brauchst Konzentration — ${dogName} auch.</p>
          </td></tr>
        </table>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">Falls du das Gefühl hast, gar nichts klappt: genau in diesem Moment gibt fast jeder auf. Genau jetzt liegen 3–4 Tage zwischen dir und dem ersten echten Aha-Moment mit ${dogName}.</p>`,
      ctaText: `${dogName}s Plan öffnen`,
      footerHint: `Schreib uns, wenn du nicht weiterkommst — wir lesen jede Mail persönlich. Innerhalb von 12 Stunden meldet sich jemand zurück.`,
    };
  }

  if (n === 3) {
    return {
      subject: `Bei ${plural} entscheidet Tag 5`,
      preheader: `Was du heute machst, bestimmt ob der Aha-Moment kommt.`,
      headline: `${dogName} ist mittendrin im wichtigsten Fenster.`,
      intro: `Drei Tage Training mit ${dogName} liegen hinter dir. In den nächsten 48 Stunden entscheidet sich, ob aus dem Training eine Routine wird oder ob es wieder einschläft. Das ist Erfahrungswert aus über 800 Plänen.`,
      bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">Bei ${plural} wie ${dogName} ist die Belohnung der wichtigste Hebel — wichtiger als die Anzahl der Wiederholungen. Mach einen Test: dieselbe Übung einmal mit Trockenfutter, einmal mit Käse, einmal mit kurzem Spielen. Du siehst sofort, was bei ${dogName} zieht.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:14px 0;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#8B7355;">Für heute und morgen</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">Erhöhe die Wertigkeit deiner Belohnung — nur in der schwierigsten Übungs-Situation. Käse oder Wurst statt Trockenfutter. Genau dann, wenn ${dogName} am ehesten &quot;abdriftet&quot;.</p>
          </td></tr>
        </table>`,
      ctaText: `Die Tag-5-Übung öffnen`,
      footerHint: `Falls du dich fragst, ob du auf dem richtigen Weg bist: schick uns kurz, wie ${dogName} auf welche Belohnung reagiert. Wir geben dir eine ehrliche Einschätzung.`,
    };
  }

  if (n === 4) {
    return {
      subject: `Nina aus Köln hatte einen ${breed} wie ${dogName}`,
      preheader: `Was sie nach 14 Tagen geschrieben hat.`,
      headline: `Eine Mail, die letzten Monat reingekommen ist.`,
      intro: `Nina aus Köln hat mit unserem Plan begonnen. Ihre ${breed}-Hündin Sage ist 2 Jahre alt. Auch sie hatte das gleiche Hauptthema wie ${dogName}. Nach 14 Tagen kam folgende Mail bei uns rein:`,
      bodyHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;margin:8px 0 16px;">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0 0 10px;font-size:14.5px;line-height:1.7;color:#1a1a1a;font-style:italic;">&quot;Ich hatte nach Tag 3 fast aufgegeben. Tag 8 war der erste Spaziergang, bei dem die Leine nicht ein einziges Mal stramm war. Ich habe geweint.&quot;</p>
            <p style="margin:0;font-size:13px;color:#6B7280;">— Nina S., ${breed} &quot;Sage&quot;, 2 Jahre, Köln</p>
          </td></tr>
        </table>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3a3a3a;">Wir schicken dir das nicht, damit du dich besser fühlst. Sondern damit du weißt: das, was du gerade mit ${dogName} durchmachst, hat schon jemand vor dir geschafft.</p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#3a3a3a;">Ninas Sage ist heute, 8 Monate später, einer der entspanntesten Hunde in ihrer Nachbarschaft. Nicht durch ein Wunder. Sondern weil sie Tag 4 nicht abgebrochen hat.</p>`,
      ctaText: `${dogName}s Plan öffnen`,
      footerHint: `Du bekommst Ninas Mail, weil du jetzt an genau der Stelle bist, an der sie damals war. Du schaffst das auch.`,
    };
  }

  if (n === 6) {
    return {
      subject: `Eine Frage zu ${dogName} — vor Woche 2`,
      preheader: `30 Sekunden lesen, eine Sekunde nachdenken.`,
      headline: `Woche 1 ist gleich vorbei.`,
      intro: `Bevor du in Woche 2 startest, eine Frage an dich. Sie ist nicht rhetorisch — antworte gerne direkt auf diese Mail.`,
      bodyHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;margin:8px 0 16px;">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0;font-size:15.5px;line-height:1.7;color:#1a1a1a;font-weight:700;">Wann genau hast du das letzte Mal mit ${dogName} bewusst geübt?</p>
          </td></tr>
        </table>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3a3a3a;">Wenn die Antwort &quot;heute&quot; oder &quot;gestern&quot; ist — du bist auf Kurs. Mach weiter wie bisher.</p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#3a3a3a;">Wenn die Antwort &quot;vor 3 Tagen&quot; oder länger ist — kein Stress. Aber heute eine kurze Session (5 Minuten reichen) bringt euch wieder rein. Woche 2 baut auf Woche 1 auf, und ohne Routine bricht das ganze Konstrukt zusammen.</p>`,
      ctaText: `${dogName}s Plan öffnen`,
      footerHint: `Antworte auf diese Mail mit einer Zahl: vor wie vielen Tagen war die letzte Session? Wir antworten persönlich.`,
    };
  }

  if (n === 7) {
    return {
      subject: `Was Familie und Nachbarn an ${dogName} zuerst bemerken`,
      preheader: `Du übersiehst die Veränderung, weil du jeden Tag dabei bist.`,
      headline: `Andere sehen es bevor du es siehst.`,
      intro: `Wenn du ${dogName} jeden Tag siehst, fallen kleine Veränderungen kaum auf. Das ist der Grund, warum unsere Halter oft denken &quot;nichts passiert&quot; — bis Besuch kommt und sagt: &quot;Was ist denn mit ${dogName} los? Die ist ja viel ruhiger als letzten Monat.&quot;`,
      bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">Das sind die drei Veränderungen, die anderen meistens als erstes auffallen:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 16px;">
          <tr><td style="padding:10px 0;border-bottom:1px solid #F0EBE3;"><strong style="color:#1a1a1a;">Reaktionszeit auf deinen Namens-Ruf</strong><br><span style="color:#6B7280;font-size:13.5px;line-height:1.5;">Statt 5 Sekunden Verzögerung → sofort.</span></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #F0EBE3;"><strong style="color:#1a1a1a;">Spannung an der Leine</strong><br><span style="color:#6B7280;font-size:13.5px;line-height:1.5;">Schon nach 2 Wochen meist deutlich nachweisbar — selbst wenn du es im Moment nicht spürst.</span></td></tr>
          <tr><td style="padding:10px 0;"><strong style="color:#1a1a1a;">Ruhe-Phasen zuhause</strong><br><span style="color:#6B7280;font-size:13.5px;line-height:1.5;">Hunde, die strukturiert trainieren, schalten zuhause schneller ab. Ohne dass du was änderst.</span></td></tr>
        </table>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">Frag heute einmal jemanden aus deinem Umfeld, der ${dogName} kennt: &quot;Hast du was an ihr bemerkt?&quot;. Die Antwort wird dich überraschen.</p>`,
      ctaText: `${dogName}s Plan öffnen`,
      footerHint: `Wenn jemand etwas Konkretes bemerkt — schreib uns. Wir sammeln diese Momente und nutzen sie (anonym), um andere zu motivieren.`,
    };
  }

  if (n === 8) {
    return {
      subject: `Ab jetzt fühlt es sich schwerer an. Warum das ein gutes Zeichen ist.`,
      preheader: `Das &quot;Plateau&quot; — fast alle erleben es zwischen Tag 20 und 25.`,
      headline: `Wenn jetzt der Frust kommt — du bist genau im Plan.`,
      intro: `Du bist in Woche 3 mit ${dogName}. Wenn sich jetzt das Gefühl einschleicht &quot;wir machen keine Fortschritte mehr&quot; — willkommen im Plateau. Fast jeder erlebt es genau jetzt. Das ist kein Bug, das ist Verhaltens-Biologie.`,
      bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">In den ersten 2 Wochen lernen Hunde extrem schnell — jede Übung bringt sichtbare Fortschritte. In Woche 3 verlangsamt sich das. Nicht weil ${dogName} aufhört zu lernen, sondern weil das Gelernte sich gerade festigt (Neurowissenschaftler nennen das Konsolidierung).</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:14px 0;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#8B7355;">Was du JETZT tun solltest</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">Trainings-Intensität reduzieren, nicht erhöhen. Statt 3× am Tag → 1× am Tag, dafür konsequenter. Das Plateau dauert 5–8 Tage, danach kommt der nächste Sprung — sichtbar und oft größer als der erste.</p>
          </td></tr>
        </table>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">Genau hier hören 70 % der Hundebesitzer auf. Die anderen 30 % erleben in Woche 4 den größten Aha-Moment des gesamten Plans.</p>`,
      ctaText: `${dogName}s Plan öffnen`,
      footerHint: `Frust ist hier kein Warnsignal, sondern ein Meilenstein. Schreib uns wenn du Zweifel hast — wir bestätigen dir gerne, dass du auf Kurs bist.`,
    };
  }

  if (n === 9) {
    // Cross-Sell — nur Module die User noch NICHT gekauft hat
    const ans = lead.answers || {};
    const hasNotfall = !!ans.notfallkarten_sent_at;
    const hasAntiGift = !!ans.antigiftkoeder_sent_at;
    const hasTagebuch = !!ans.tagebuch_sent_at;

    const modules: Array<{ title: string; desc: string; price: string }> = [];
    if (!hasAntiGift) {
      modules.push({
        title: "Anti-Giftköder-Trainingsplan",
        desc: "12 Seiten, personalisiert. Schritt-für-Schritt-Training für „Aus", „Zeig mir" und 5 Notfall-Szenarien für draußen.",
        price: "9,99 €",
      });
    }
    if (!hasNotfall) {
      modules.push({
        title: "Notfall-Karten",
        desc: "10 Sofort-Hilfen für typische Problem-Situationen. Druckbar oder aufs Handy.",
        price: "9,99 €",
      });
    }
    if (!hasTagebuch) {
      modules.push({
        title: "Trainings-Tagebuch",
        desc: "90-Tage-Fortschritts-Tagebuch zum Ausdrucken. Wöchentliche Reflexions-Fragen — Erfolge schwarz auf weiß.",
        price: "9,99 €",
      });
    }
    if (modules.length === 0) {
      // User hat schon alle 3 Bumps → diese Mail komplett ueberspringen
      return null;
    }

    const moduleRows = modules
      .map(
        (m) => `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;margin:10px 0;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 4px;font-size:14.5px;font-weight:800;color:#1a1a1a;">${m.title} <span style="color:#C4A576;">· ${m.price}</span></p>
            <p style="margin:0;font-size:13px;line-height:1.55;color:#6B7280;">${m.desc}</p>
          </td></tr>
        </table>`
      )
      .join("");

    return {
      subject: `30 Tage geschafft — drei Module, die jetzt sinnvoll werden`,
      preheader: `Was Halter nach 30 Tagen am häufigsten zusätzlich brauchen.`,
      headline: `${dogName} und du — 30 Tage gemeinsam.`,
      intro: `Das ist ein echter Meilenstein. Die meisten Trainings-Programme werden nach 14 Tagen abgebrochen. Du bist über doppelt so weit. Drei Module, die wir nach den ersten 30 Tagen am häufigsten empfohlen bekommen — weil sie auf das aufbauen, was du gerade etabliert hast:`,
      bodyHtml: `${moduleRows}
        <p style="margin:16px 0 0;font-size:13.5px;line-height:1.6;color:#6B7280;">Du bekommst diese Empfehlung nur einmal. Wenn etwas davon für ${dogName} relevant ist, lohnt sich der Klick. Wenn nicht — auch okay, dann konzentriere dich weiter auf den Haupt-Plan.</p>`,
      ctaText: `Module ansehen`,
      footerHint: `Antworte auf diese Mail wenn du nicht sicher bist welches Modul für ${dogName} am besten passt — wir geben dir eine ehrliche Einschätzung statt zu pushen.`,
    };
  }

  return null;
}

// ── Send-Funktion ────────────────────────────────────────────────────
export async function sendSequenceMail(
  mailNum: number,
  lead: SequenceLead
): Promise<{ ok: boolean; reason?: string }> {
  const def = buildMailDef(mailNum, lead);
  if (!def) return { ok: false, reason: "no_content_for_mail" };
  if (!lead.email) return { ok: false, reason: "no_email" };

  const html = buildHtml({
    subject: def.subject,
    preheader: def.preheader,
    heroImg: getEmailImageUrl(lead.dog_breed, mailNum > 4 ? mailNum - 5 + 1 : mailNum), // Bilder 1-4 wiederverwenden für Mails 6-9
    dogBreed: displayBreed(lead.dog_breed),
    headline: def.headline,
    intro: def.intro,
    bodyHtml: def.bodyHtml,
    ctaUrl: ctaUrlFor(lead),
    ctaText: def.ctaText,
    footerHint: def.footerHint,
  });

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
      to: [{ email: lead.email }],
      subject: def.subject,
      htmlContent: html,
      tags: [`email-seq-${mailNum}`],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, reason: `brevo_${res.status}_${t.slice(0, 80)}` };
  }
  return { ok: true };
}

// Helper für Cron: welche Mail ist heute fällig?
export function getDueMail(daysAfterPaid: number): number | null {
  // Wir nehmen die NEUESTE Mail die <= daysAfterPaid und noch nicht gesendet wurde.
  // (Senden bzgl. Idempotenz prueft die Cron via answers.email_sequence_sent[]).
  // Toleranz: ±1 Tag fuer Cron-Drift.
  let due: number | null = null;
  for (const s of EMAIL_SEQUENCE_SCHEDULE) {
    if (daysAfterPaid >= s.daysAfterPaid - 1) due = s.num;
  }
  return due;
}
