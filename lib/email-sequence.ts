// Email-Sequenz nach Plan-Kauf — Mails 2, 3, 4, 6, 7, 8, 9.
// (Mail 1 = bestehende sendPlanReadyEmail bleibt unverändert, Mail 5 = Brevo-Automation.)
//
// Tagliche Cron (/api/cron/email-sequence) bestimmt anhand paid_at + idempotency-flag,
// welche Mail aktuell faellig ist. Drop-out: wenn answers.email_sequence_unsubscribed_at
// gesetzt ist, oder lead.status in ['refunded','cancelled'], wird NICHT versendet.
// Mail 9 (Cross-Sell) filtert dynamisch raus, was der User schon gekauft hat.

import type { Lang } from "./lang";

const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const BASE = "https://www.pfoten-plan.de";

// PL-Marketing-Mails: waren pausiert, während lapaplan.pl auf dem
// Verifizierungs-Halteserver hing (SPF/DKIM/DMARC weg). Domain + E-Mail-Auth
// sind wieder online (25.07.), daher wieder aktiv. DE ist ohnehin nie betroffen.
export const PL_MAILS_PAUSED = false;

// ── Schedule ─────────────────────────────────────────────────────────
export const EMAIL_SEQUENCE_SCHEDULE: Array<{
  num: number;
  daysAfterPaid: number;
  label: string;
}> = [
  // Bewusst sehr minimal gehalten — Käufer sollen nicht vollgespammt werden.
  // Tag 1 = die Plan-Auslieferung selbst, Tag 7 = Brevo-Automation (Übungen-Mail).
  // Entscheidung: NUR noch die Tag-30-Laura-Umfrage. Tag-14 (#7) ist bewusst
  // DEAKTIVIERT (nicht im Schedule) → es geht ab Tag 14 nichts raus, nur ab
  // Tag 30 die Laura-Mail. Inhalte zu #7 liegen weiter in buildMailDef (dormant).
  { num: 9, daysAfterPaid: 30, label: "Tag-30-Laura-Umfrage" },
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
// Polnische Plural-Formen (Genitiv, passt zu „U ...“) für den PL-Zweig.
function pluralBreedPl(breed: string | null | undefined): string {
  const k = (breed || "").trim().toLowerCase();
  if (k === "labrador" || k === "labrador retriever") return "labradorów";
  if (k === "golden retriever") return "golden retrieverów";
  if (
    k === "deutscher schäferhund" ||
    k === "schäferhund" ||
    k === "german shepherd"
  )
    return "owczarków niemieckich";
  if (k === "australian shepherd" || k === "aussie")
    return "owczarków australijskich";
  if (k === "border collie") return "border collie";
  if (k === "dackel") return "jamników";
  if (k === "beagle") return "beagle";
  if (k === "mischling") return "kundelków";
  if (k === "havaneser" || k === "havanese") return "hawańczyków";
  if (k === "goldendoodle") return "goldendoodle";
  return "psów takich jak twój";
}
// Italienische Plural-Formen (passt zu „Per i ...“ / „Nei ...“) für den IT-Zweig.
function pluralBreedIt(breed: string | null | undefined): string {
  const k = (breed || "").trim().toLowerCase();
  if (k === "labrador" || k === "labrador retriever") return "Labrador";
  if (k === "golden retriever") return "Golden Retriever";
  if (
    k === "deutscher schäferhund" ||
    k === "schäferhund" ||
    k === "german shepherd"
  )
    return "pastori tedeschi";
  if (k === "australian shepherd" || k === "aussie")
    return "pastori australiani";
  if (k === "border collie") return "Border Collie";
  if (k === "dackel") return "bassotti";
  if (k === "beagle") return "Beagle";
  if (k === "mischling") return "meticci";
  if (k === "havaneser" || k === "havanese") return "Havanese";
  if (k === "goldendoodle") return "Goldendoodle";
  return "cani come il tuo";
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
  lang?: Lang;
  unsubUrl?: string;
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
    lang = "de",
    unsubUrl,
  } = opts;
  // PL-/IT-Weiche für Marke + Template-Texte (Footer/Abmelden). DE bleibt identisch.
  const isPl = lang === "pl";
  const isIt = lang === "it";
  const htmlLang = isPl ? "pl" : isIt ? "it" : "de";
  const brand = isPl ? "ŁapaPlan" : isIt ? "ZampaPlan" : "Pfoten-Plan";
  const linkFallback = isPl
    ? "Przycisk nie działa? Skopiuj ten link:"
    : isIt
    ? "Il pulsante non funziona? Copia questo link:"
    : "Funktioniert der Button nicht? Kopier diesen Link:";
  const myArea = isPl ? "Mój obszar" : isIt ? "La mia area" : "Mein Bereich";
  const unsub = isPl
    ? "Wypisz się z tych e-maili"
    : isIt
    ? "Annulla l'iscrizione a queste e-mail"
    : "Aus diesen E-Mails abmelden";
  // WhatsApp-Hilfe: nur DE, mittig unter dem Body
  const waHelp =
    isPl || isIt
      ? ""
      : `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0 0;">
          <tr><td style="padding:14px 16px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;">
            <p style="margin:0;font-size:14px;line-height:1.6;color:#166534;"><img src="${BASE}/whatsapp-logo.png" width="18" height="18" alt="WhatsApp" style="width:18px;height:18px;vertical-align:-4px;margin-right:5px;border:0;" /><strong>Fragen zu deinem Hund?</strong> Schreib uns direkt auf <a href="https://wa.me/4915129892586?text=Hallo%2C%20ich%20habe%20eine%20Frage" style="color:#166534;font-weight:800;text-decoration:underline;">WhatsApp</a> — wir helfen dir persönlich weiter, meist innerhalb weniger Stunden.</p>
          </td></tr>
        </table>`;
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<span style="display:none;font-size:1px;color:#FFFFFF;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFFFFF;">
  <tr><td align="center" style="padding:28px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;">
      <tr><td style="padding:0 2px;">
        <img src="${heroImg}" alt="${dogBreed}" width="200" style="width:100%;max-width:200px;height:auto;display:block;border-radius:10px;margin:0 0 18px;">
        <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;font-weight:700;color:#1a1a1a;">${headline}</h1>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#333333;">${intro}</p>
        ${bodyHtml}
        ${waHelp}
        <p style="margin:22px 0 0;">
          <a href="${ctaUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:700;line-height:1;color:#FFFFFF;background:#C4A576;text-decoration:none;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${ctaText}</a>
        </p>
        <p style="margin:12px 0 0;font-size:11px;line-height:1.5;color:#9CA3AF;">${linkFallback}<br><a href="${ctaUrl}" target="_blank" rel="noopener" style="color:#8B7355;text-decoration:underline;word-break:break-all;">${ctaUrl}</a></p>
        <p style="margin:18px 0 0;font-size:13px;line-height:1.55;color:#6B7280;">${footerHint}</p>
        <p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #EEEAE3;font-size:11px;line-height:1.6;color:#9CA3AF;">
          ${brand} · <a href="${BASE}/mitglieder" style="color:#8B7355;text-decoration:underline;">${myArea}</a> · <a href="mailto:support@pfoten-plan.de" style="color:#8B7355;text-decoration:underline;">support@pfoten-plan.de</a><br><a href="${unsubUrl || "{{ unsubscribe }}"}" style="color:#9CA3AF;text-decoration:underline;">${unsub}</a>
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
  // Optionaler Absender-Name (sonst Default "Max von Pfoten-Plan").
  senderName?: string;
  // Wenn gesetzt, wird dieses HTML direkt als Mail verwendet (schlichte,
  // persönliche Mail) und das Design-Template (buildHtml) übersprungen.
  plainHtml?: string;
  // Optionaler CTA-Ziel-Override (sonst ctaUrlFor → rueckhol).
  ctaUrl?: string;
  preheader?: string;
  headline?: string;
  intro?: string;
  bodyHtml?: string;
  ctaText?: string;
  footerHint?: string;
}

function ctaUrlFor(lead: SequenceLead): string {
  return `${BASE}/rueckhol.html?lead_id=${encodeURIComponent(lead.id)}&email=${encodeURIComponent(lead.email)}`;
}

// ── email_captured-Nurture: problem-personalisierte Bausteine (DE) ──
// Pro Quiz-Problem: Betreff-Hook, Schmerz-Satz, Gratis-Sofort-Übung (Punkt 2),
// und ein "Warum es nicht von allein weggeht"-Satz. Fallback deckt alles ab.
type EcBits = { label: string; subj: string; pain: string; tipTitle: string; tip: string; why: string };
function ecProblemBits(lead: SequenceLead): EcBits {
  const dn = (lead.dog_name || "dein Hund").trim() || "dein Hund";
  const a = lead.answers || {};
  const key = String(a.custom_problem_key || a.dog_problem || "").toLowerCase();
  const M: Record<string, EcBits> = {
    pulling: {
      label: "Ziehen an der Leine",
      subj: `${dn} zieht an der Leine? Fang mit dieser einen Sache an`,
      pain: `Ziehen an der Leine macht jeden Spaziergang zum Kraftakt, für dich und für ${dn}.`,
      tipTitle: "Sofort-Übung: Stehenbleiben",
      tip: `Sobald die Leine straff wird, bleibst du sofort stehen. Kein Wort, kein Gegenziehen. Erst wenn die Leine wieder locker durchhängt, geht es weiter. 5 Minuten pro Spaziergang reichen. ${dn} lernt so: Ziehen führt zu Stillstand, lockere Leine führt vorwärts.`,
      why: `Ziehen ist keine Sturheit. Für ${dn} hat es sich bisher immer gelohnt, denn es ging ja jedes Mal weiter. Der Plan dreht genau diese Logik konsequent um.`,
    },
    recall: {
      label: "Rückruf",
      subj: `${dn} kommt nicht zuverlässig? Das ändert sich hiermit`,
      pain: `Wenn ${dn} nicht zuverlässig kommt, wird jeder Freilauf zur Zitterpartie.`,
      tipTitle: "Sofort-Übung: Der Lohn-Rückruf",
      tip: `Ruf ${dn} zuerst nur im Haus, in fröhlichem Ton. Kommt er, gibt es sofort etwas richtig Gutes (Lieblingsleckerli, kurzes Spiel). 3× am Tag. Wichtig: Schimpf nie, wenn er zögert. Rückruf muss sich für ${dn} immer lohnen, dann kommt er später auch draußen.`,
      why: `${dn} kommt nicht, weil das Kommen sich bisher seltener gelohnt hat als das Weiterschnüffeln. Der Plan baut den Rückruf systematisch als das bessere Angebot auf.`,
    },
    aggression: {
      label: "Aggression",
      subj: `Ein wichtiger erster Schritt bei ${dn}`,
      pain: `Wenn ${dn} in bestimmten Momenten ausrastet, ist das für alle stressig und oft auch beschämend.`,
      tipTitle: "Sofort-Übung: Abstand ist dein Werkzeug",
      tip: `Vergrößere bei einem Auslöser sofort den Abstand, BEVOR ${dn} reagiert. Belohne ruhiges Verhalten schon unterhalb der Schwelle, an der er sonst hochgeht. Lauf nie in die Reaktion hinein, das verfestigt sie nur.`,
      why: `Aggression ist meist Überforderung, kein Charakter. ${dn} braucht mehr Abstand und klare Führung, genau das trainiert der Plan in kleinen, sicheren Schritten.`,
    },
    "dog-reactive": {
      label: "Reaktivität gegen Hunde",
      subj: `Wenn ${dn} bei anderen Hunden ausrastet`,
      pain: `Anderen Hunden ausweichen, die Straßenseite wechseln, das kostet Nerven bei jedem Gang.`,
      tipTitle: "Sofort-Übung: Abstand + Belohnung",
      tip: `Sieh den anderen Hund früh und vergrößere sofort den Abstand, so weit, dass ${dn} noch ruhig bleibt. Genau dort fütterst du ruhig weiter. Du trainierst: anderer Hund in Sicht bedeutet gute Dinge, nicht Alarm.`,
      why: `Reaktivität ist Stress, nicht Bosheit. ${dn} lernt über wachsende, kontrollierte Nähe, dass andere Hunde keine Bedrohung sind. Der Plan führt das Schritt für Schritt.`,
    },
    anxiety: {
      label: "Trennungsangst",
      subj: `${dn} allein zu Hause? Fang klein an`,
      pain: `Wenn ${dn} nicht allein bleiben kann, wird jeder Weg aus dem Haus zum schlechten Gewissen.`,
      tipTitle: "Sofort-Übung: Die 30-Sekunden-Regel",
      tip: `Verlass den Raum für nur 30 Sekunden und komm ruhig wieder rein, ohne große Begrüßung. Steigere die Zeit langsam über Tage. ${dn} lernt in kleinen Dosen: Alleinsein ist kurz und ungefährlich, du kommst immer zurück.`,
      why: `Trennungsangst löst man nicht mit „durchhalten", sondern mit winzigen, positiven Schritten. Genau so ist der Plan aufgebaut.`,
    },
    barking: {
      label: "übermäßiges Bellen",
      subj: `${dn} bellt zu viel? Das hilft sofort`,
      pain: `Dauerbellen zerrt an den Nerven, und an denen der Nachbarn gleich mit.`,
      tipTitle: "Sofort-Übung: Ruhe belohnen",
      tip: `In der Sekunde, in der ${dn} aufhört zu bellen, lobst du ruhig und belohnst. Schimpfen befeuert das Bellen oft noch, weil es Aufmerksamkeit ist. Du belohnst gezielt die Stille, nicht den Lärm.`,
      why: `Bellen hat immer einen Auslöser. ${dn} hört nicht auf, weil er merkt, dass Bellen wirkt. Der Plan zeigt dir, wie du den Auslöser entschärfst und Ruhe zur besseren Option machst.`,
    },
    jumping: {
      label: "Anspringen",
      subj: `${dn} springt Menschen an? Eine einfache Regel`,
      pain: `Anspringen ist niedlich beim Welpen und unangenehm beim ausgewachsenen Hund, vor allem bei Gästen.`,
      tipTitle: "Sofort-Übung: Vier Pfoten am Boden",
      tip: `Springt ${dn} hoch, dreh dich wortlos weg und ignoriere ihn. Erst wenn alle vier Pfoten am Boden sind, gibt es Aufmerksamkeit und Lob. Wichtig: alle im Haushalt machen es genau gleich, sonst lernt er es nie.`,
      why: `Anspringen ist ein Gruß, der bisher belohnt wurde (mit Aufmerksamkeit). ${dn} braucht eine klare Alternative, die sich mehr lohnt. Der Plan baut die auf.`,
    },
    energy: {
      label: "zu viel Energie",
      subj: `${dn} kommt nie zur Ruhe? Probier das`,
      pain: `Ein Hund, der nie runterfährt, macht müde, nicht der Hund, sondern dich.`,
      tipTitle: "Sofort-Übung: Kopfarbeit statt nur Rennen",
      tip: `Verstecke eine Handvoll Leckerli in der Wohnung oder im Garten und lass ${dn} suchen. 10 Minuten Schnüffeln ermüden ihn mehr als eine Stunde Rennen, und danach ist er wirklich zufrieden ruhig.`,
      why: `Mehr Auspowern macht oft nur einen fitteren, unruhigeren Hund. ${dn} braucht die richtige Mischung aus Kopf und Körper plus echte Ruhe-Signale. Genau das strukturiert der Plan.`,
    },
    destructive: {
      label: "zerstörerisches Verhalten",
      subj: `${dn} zerkaut alles? Der erste Schritt`,
      pain: `Zerkaute Schuhe und Möbel sind teuer und frustrierend, besonders wenn es immer wieder passiert.`,
      tipTitle: "Sofort-Übung: Erlaubte Alternative",
      tip: `Biete ${dn} eine klar erlaubte Kau-Alternative an (Kauartikel, gefüllte Kong) und lobe ruhig, wenn er sie nutzt. Zerstörung ist fast immer Langeweile oder Stress, eine gute Beschäftigung nimmt den Druck raus.`,
      why: `${dn} zerstört nicht aus Trotz, sondern weil ihm etwas fehlt. Der Plan deckt Auslastung und Ruhe ab, damit gar nicht erst Frust entsteht.`,
    },
    soiling: {
      label: "Unsauberkeit",
      subj: `${dn} macht in die Wohnung? Das hilft`,
      pain: `Immer wieder Pfützen oder Häufchen drinnen, das zermürbt und macht ratlos.`,
      tipTitle: "Sofort-Übung: Feste Zeiten plus sofort loben",
      tip: `Bring ${dn} nach Fressen, Schlafen und Spielen sofort raus. Löst er sich draußen, lobst du im selben Moment ruhig. Drinnen niemals schimpfen, das macht nur ängstlich und verschlimmert es oft.`,
      why: `Unsauberkeit ist meist eine Frage von Timing und Routine, nicht von Ungehorsam. Der Plan gibt dir genau diese verlässliche Struktur.`,
    },
    mouthing: {
      label: "Zwicken und Beißen",
      subj: `${dn} zwickt mit den Zähnen? Fang hier an`,
      pain: `Zwicken tut weh und wird mit einem größeren Hund schnell zum echten Problem.`,
      tipTitle: "Sofort-Übung: Zähne beenden das Spiel",
      tip: `Zwickt ${dn}, sag einmal kurz „Autsch", zieh die Hand ruhig weg und ignoriere ihn 10 Sekunden. Er lernt: Zähne an der Haut beenden sofort den Spaß. Danach ruhig weitermachen mit einem erlaubten Spielzeug.`,
      why: `Zwicken ist normales Erkunden, muss aber klare Grenzen bekommen. Der Plan zeigt dir, wie ${dn} lernt, sein Maul kontrolliert einzusetzen.`,
    },
  };
  return (
    M[key] || {
      label: "das Verhalten",
      subj: `${dn}s persönlicher Trainingsplan wartet noch`,
      pain: `Das Verhalten, das dich bei ${dn} stört, lässt sich mit den richtigen kleinen Schritten wirklich ändern.`,
      tipTitle: "Sofort-Übung: Die 3-Minuten-Regel",
      tip: `Übe lieber 3× am Tag je 3 Minuten als einmal lang am Stück. Kurze, erfolgreiche Einheiten bauen bei ${dn} viel schneller Verlässlichkeit auf als lange, frustige Sessions.`,
      why: `Verhalten ändert sich über klare, wiederholte Muster, nicht über Strenge. Genau das macht der Plan mit ${dn} Schritt für Schritt.`,
    }
  );
}

function buildMailDef(
  n: number,
  lead: SequenceLead,
  lang: Lang = "de"
): MailDef | null {
  const dogName =
    lang === "pl"
      ? (lead.dog_name || "twojego psa").trim() || "twojego psa"
      : lang === "it"
      ? (lead.dog_name || "il tuo cane").trim() || "il tuo cane"
      : (lead.dog_name || "deinen Hund").trim() || "deinen Hund";
  const breed = displayBreed(lead.dog_breed);
  const plural =
    lang === "pl"
      ? pluralBreedPl(lead.dog_breed)
      : lang === "it"
      ? pluralBreedIt(lead.dog_breed)
      : pluralBreed(lead.dog_breed);

  // ── email_captured-Nurture (Mails 101–104), problem-personalisiert, DE only ──
  if (n >= 101 && n <= 106) {
    if (lang !== "de") return null;
    const pb = ecProblemBits(lead);
    const cta = `${dogName}s Plan ansehen`;
    // Proof: aggregiert + problem-bezogen, grammatik-sicher über "wenn es um … geht"
    const proof = `Über 3.400 Hunde wurden mit Pfoten-Plan schon trainiert. Wenn es um ${pb.label} geht, berichten die meisten Halter schon nach wenigen Tagen von den ersten spürbaren Veränderungen bei ${dogName}.`;
    const tipBox = `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:16px 0;">
          <tr><td style="padding:15px 18px;">
            <p style="margin:0 0 5px;font-size:12px;font-weight:700;color:#8B7355;text-transform:uppercase;letter-spacing:.3px;">${pb.tipTitle}</p>
            <p style="margin:0;font-size:14px;line-height:1.65;color:#3a3a3a;">${pb.tip}</p>
          </td></tr>
        </table>`;

    // 101 — Tag 0 (~10 Min nach Eingabe): Problem-Hook + Gratis-Übung + Proof
    if (n === 101) {
      return {
        subject: pb.subj,
        preheader: `Eine Sache, die du heute schon gratis ausprobieren kannst.`,
        headline: pb.pain,
        intro: `Du hast gerade das Quiz zu ${dogName} gemacht, also kennen wir das Thema: ${pb.label}. Bevor du überhaupt etwas kaufst, hier eine Übung, die du heute sofort ausprobieren kannst.`,
        bodyHtml: `${tipBox}
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">Das ist bewusst nur EIN Baustein. Der vollständige, auf ${dogName} zugeschnittene Schritt-für-Schritt-Plan setzt genau hier an und führt dich Woche für Woche weiter.</p>
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:#6B7280;">${proof}</p>`,
        ctaText: cta,
        footerHint: `Antworte einfach auf diese Mail, wenn du eine Frage zu ${dogName} hast. Wir lesen jede persönlich.`,
      };
    }

    // 102 — Tag 1: Warum es nicht von allein weggeht
    if (n === 102) {
      return {
        subject: `Warum ${dogName} das nicht „einfach so" ablegt`,
        preheader: `Es liegt fast nie am Hund.`,
        headline: `${dogName} ist nicht stur. Es fehlt nur ein klarer Weg.`,
        intro: `Die meisten denken, ihr Hund „müsste es doch langsam kapieren". Aber ${dogName} macht nichts falsch.`,
        bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">${pb.why}</p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#3a3a3a;">Genau deshalb funktionieren einzelne YouTube-Tipps oft nicht dauerhaft: Sie sind Puzzleteile ohne Reihenfolge. Ein Plan gibt ${dogName} die Reihenfolge, in der ein Schritt auf dem nächsten aufbaut.</p>`,
        ctaText: cta,
        footerHint: `Fragen zu ${dogName}? Antworte einfach, wir helfen dir gern weiter.`,
      };
    }

    // 103 — Tag 3: Proof / Social Proof, problem-bezogen
    if (n === 103) {
      return {
        subject: `Du bist mit ${dogName}s Thema nicht allein`,
        preheader: `Kurz, warum das kein Zufall ist.`,
        headline: `${pb.label.charAt(0).toUpperCase() + pb.label.slice(1)} ist eins der häufigsten Themen bei uns.`,
        intro: proof,
        bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">Der Unterschied war bei ihnen nie ein „besserer Hund" oder mehr Strenge. Es war jedes Mal das Gleiche: ein klarer Plan, kleine tägliche Schritte, in der richtigen Reihenfolge.</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">Genau das liegt für ${dogName} bereit, zugeschnitten auf ${pb.label}.</p>`,
        ctaText: cta,
        footerHint: `Fragen zu ${dogName}? Antworte einfach auf diese Mail.`,
      };
    }

    // 104 — Tag 5: Check-in (Reaktivierung, zweiter Value-Touch)
    if (n === 104) {
      return {
        subject: `Hast du die Übung mit ${dogName} probiert?`,
        preheader: `Kurzer Check-in.`,
        headline: `Wie lief es mit ${dogName}?`,
        intro: `Vor ein paar Tagen hast du von uns die Sofort-Übung für ${dogName} bekommen. Hast du sie ausprobiert?`,
        bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">Falls ja: super, das ist genau der richtige Anfang. Falls noch nicht: völlig okay, hier ist sie nochmal.</p>
        ${tipBox}
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">Diese eine Übung ist Schritt 1 von vielen. Der komplette Plan gibt dir den Rest, in der Reihenfolge, in der ${dogName} ihn wirklich braucht.</p>`,
        ctaText: cta,
        footerHint: `Steckst du irgendwo fest? Antworte einfach, wir helfen persönlich.`,
      };
    }

    // 105 — Tag 8: Einwände räumen
    if (n === 105) {
      return {
        subject: `Kurz gefragt zu ${dogName}`,
        preheader: `Falls dich noch etwas zögern lässt.`,
        headline: `Was hält dich noch zurück?`,
        intro: `Viele zögern aus den gleichen drei Gründen. Vielleicht ist deiner dabei.`,
        bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3a3a3a;"><strong>„Ich hab vielleicht was falsch angegeben."</strong><br>Kein Problem, das lässt sich jederzeit anpassen, auch nach dem Kauf. Schreib uns einfach.</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3a3a3a;"><strong>„Ist das ein Abo?"</strong><br>Nein. Einmal zahlen, der komplette Plan für ${dogName} gehört dir. Keine Folgekosten.</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3a3a3a;"><strong>„Und wenn es nicht passt?"</strong><br>30 Tage Geld-zurück-Garantie. Du gehst also kein Risiko ein.</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">Wenn dich sonst noch etwas zurückhält, antworte einfach auf diese Mail.</p>`,
        ctaText: cta,
        footerHint: `Wir lesen jede Antwort persönlich, meist meldet sich jemand innerhalb von 12 Stunden.`,
      };
    }

    // 106 — Tag 12: letzter Anstoß
    return {
      subject: `${dogName}s Plan liegt noch bereit`,
      preheader: `Der letzte Anstoß, dann lassen wir dich in Ruhe.`,
      headline: `Der erste Schritt ist oft der schwerste.`,
      intro: `Du wolltest etwas für ${dogName} ändern, sonst hättest du das Quiz nicht gemacht. Dieses Gefühl war richtig.`,
      bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">${pb.label.charAt(0).toUpperCase() + pb.label.slice(1)} wird selten von allein besser. Aber mit einem klaren Plan und ein paar Minuten am Tag verändert sich erstaunlich schnell etwas, für ${dogName} und für euer Zusammenleben.</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">Der auf ${dogName} zugeschnittene Plan wartet. Heute anfangen heißt, in einer Woche schon einen Unterschied zu sehen.</p>`,
      ctaText: `Jetzt ${dogName}s Plan starten`,
      footerHint: `Das ist die letzte Mail dieser Reihe. Kein Interesse mehr? Über den Abmelde-Link unten bist du sofort raus.`,
    };
  }

  if (n === 2) {
    if (lang === "pl") {
      return {
        subject: `Dzień 1 z ${dogName} pewnie nie był idealny`,
        preheader: `To normalne. Oto dlaczego.`,
        headline: `Wczoraj nie poszło tak, jak sobie wyobrażałeś.`,
        intro: `To nic niezwykłego. U większości naszych właścicieli dzień 1 jest najtrudniejszy — nie dlatego, że ćwiczenie jest trudne, ale dlatego, że ${dogName} jeszcze nie wie, czego od niego chcesz.`,
        bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">Co większość na początku przeocza: ${dogName} potrzebuje średnio 5 do 7 powtórzeń nowego wzorca zachowania, zanim po raz pierwszy „zaskoczy”. Jeśli wczoraj udały ci się tylko 3 próby, to nie było za mało — byłeś dopiero w połowie drogi.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:14px 0;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#8B7355;">Dziś zrób jedną rzecz inaczej</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">Zrób dzisiejsze ćwiczenie podczas najspokojniejszego spaceru dnia. W południe albo późnym popołudniem. Potrzebujesz skupienia — ${dogName} też.</p>
          </td></tr>
        </table>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">Jeśli masz wrażenie, że nic nie działa: właśnie w tym momencie prawie każdy się poddaje. Właśnie teraz dzielą cię 3–4 dni od pierwszego prawdziwego momentu „aha” z ${dogName}.</p>`,
        ctaText: `Otwórz plan ${dogName}`,
        footerHint: `Napisz do nas, jeśli utkniesz — czytamy każdy e-mail osobiście. W ciągu 12 godzin ktoś się do ciebie odezwie.`,
      };
    }
    if (lang === "it") {
      return {
        subject: `Il giorno 1 con ${dogName} probabilmente non è stato perfetto`,
        preheader: `È normale. Ecco perché.`,
        headline: `Ieri non è andata come te l'eri immaginata.`,
        intro: `Non è affatto insolito. Per la maggior parte dei nostri proprietari il giorno 1 è il più difficile, non perché l'esercizio sia complicato, ma perché ${dogName} non sa ancora cosa vuoi da lui.`,
        bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">Quello che quasi tutti all'inizio non notano: ${dogName} ha bisogno in media di 5 o 7 ripetizioni di un nuovo schema di comportamento prima che &quot;scatti&quot; per la prima volta. Se ieri sei riuscito a fare solo 3 tentativi, non erano troppo pochi: eri appena a metà strada.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:14px 0;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#8B7355;">Oggi fai una cosa in modo diverso</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">Fai l'esercizio di oggi durante la passeggiata più tranquilla della giornata. A mezzogiorno o nel tardo pomeriggio. A te serve concentrazione, e a ${dogName} anche.</p>
          </td></tr>
        </table>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">Se hai l'impressione che non funzioni niente: è proprio in questo momento che quasi tutti si arrendono. Proprio adesso mancano 3 o 4 giorni tra te e il primo vero momento in cui tutto va a posto con ${dogName}.</p>`,
        ctaText: `Apri il piano di ${dogName}`,
        footerHint: `Scrivici se ti blocchi, leggiamo ogni e-mail personalmente. Entro 12 ore qualcuno ti risponde.`,
      };
    }
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
    if (lang === "pl") {
      return {
        subject: `U ${plural} decyduje dzień 5`,
        preheader: `To, co zrobisz dziś, decyduje, czy nadejdzie moment „aha”.`,
        headline: `${dogName} jest w samym środku najważniejszego okna.`,
        intro: `Za tobą trzy dni treningu z ${dogName}. W ciągu najbliższych 48 godzin rozstrzygnie się, czy z treningu powstanie rutyna, czy znów wszystko przyśnie. To wniosek z ponad 800 planów.`,
        bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">U ${plural} takich jak ${dogName} nagroda jest najważniejszą dźwignią — ważniejszą niż liczba powtórzeń. Zrób test: to samo ćwiczenie raz z suchą karmą, raz z serem, raz z krótką zabawą. Od razu zobaczysz, co działa na ${dogName}.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:14px 0;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#8B7355;">Na dziś i jutro</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">Podnieś wartość nagrody — tylko w najtrudniejszej sytuacji ćwiczeniowej. Ser albo kiełbasa zamiast suchej karmy. Dokładnie wtedy, gdy ${dogName} najłatwiej „odpływa”.</p>
          </td></tr>
        </table>`,
        ctaText: `Otwórz ćwiczenie na dzień 5`,
        footerHint: `Jeśli zastanawiasz się, czy jesteś na dobrej drodze: napisz nam krótko, jak ${dogName} reaguje na którą nagrodę. Damy ci szczerą ocenę.`,
      };
    }
    if (lang === "it") {
      return {
        subject: `Nei ${plural} è il giorno 5 a fare la differenza`,
        preheader: `Quello che fai oggi decide se arriverà il momento della svolta.`,
        headline: `${dogName} è nel bel mezzo della finestra più importante.`,
        intro: `Hai alle spalle tre giorni di allenamento con ${dogName}. Nelle prossime 48 ore si decide se l'allenamento diventa una routine o se torna ad addormentarsi. È quello che abbiamo imparato da oltre 800 piani.`,
        bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">Nei ${plural} come ${dogName} la ricompensa è la leva più importante, più del numero di ripetizioni. Fai una prova: lo stesso esercizio una volta con le crocchette, una volta con il formaggio, una volta con un breve gioco. Vedrai subito cosa funziona con ${dogName}.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:14px 0;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#8B7355;">Per oggi e domani</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">Aumenta il valore della ricompensa, ma solo nella situazione di esercizio più difficile. Formaggio o würstel al posto delle crocchette. Proprio quando ${dogName} tende di più a &quot;distrarsi&quot;.</p>
          </td></tr>
        </table>`,
        ctaText: `Apri l'esercizio del giorno 5`,
        footerHint: `Se ti chiedi se sei sulla strada giusta: mandaci due righe su come ${dogName} reagisce a ciascuna ricompensa. Ti diamo una valutazione sincera.`,
      };
    }
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
    if (lang === "pl") {
      return {
        subject: `Nina z Kolonii miała ${breed}, jak ${dogName}`,
        preheader: `Co napisała po 14 dniach.`,
        headline: `E-mail, który dotarł do nas w zeszłym miesiącu.`,
        intro: `Nina z Kolonii zaczęła z naszym planem. Jej suczka rasy ${breed}, Sage, ma 2 lata. Ona też miała ten sam główny problem co ${dogName}. Po 14 dniach dotarł do nas taki e-mail:`,
        bodyHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;margin:8px 0 16px;">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0 0 10px;font-size:14.5px;line-height:1.7;color:#1a1a1a;font-style:italic;">„Po dniu 3 prawie się poddałam. Dzień 8 był pierwszym spacerem, podczas którego smycz ani razu się nie napięła. Popłakałam się.”</p>
            <p style="margin:0;font-size:13px;color:#6B7280;">— Nina S., ${breed} „Sage”, 2 lata, Kolonia</p>
          </td></tr>
        </table>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3a3a3a;">Wysyłamy ci to nie po to, żebyś poczuł się lepiej. Ale żebyś wiedział: to, przez co teraz przechodzisz z ${dogName}, ktoś już przed tobą przeszedł i dał radę.</p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#3a3a3a;">Sage Niny jest dziś, 8 miesięcy później, jednym z najspokojniejszych psów w okolicy. Nie dzięki cudowi. Ale dlatego, że nie przerwała w dniu 4.</p>`,
        ctaText: `Otwórz plan ${dogName}`,
        footerHint: `Dostajesz e-mail Niny, bo jesteś teraz dokładnie w tym miejscu, w którym ona była wtedy. Ty też dasz radę.`,
      };
    }
    if (lang === "it") {
      return {
        subject: `Nina di Colonia aveva un ${breed} come ${dogName}`,
        preheader: `Cosa ci ha scritto dopo 14 giorni.`,
        headline: `Un'e-mail che ci è arrivata il mese scorso.`,
        intro: `Nina di Colonia ha iniziato con il nostro piano. La sua ${breed} femmina, Sage, ha 2 anni. Anche lei aveva lo stesso tema principale di ${dogName}. Dopo 14 giorni ci è arrivata questa e-mail:`,
        bodyHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;margin:8px 0 16px;">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0 0 10px;font-size:14.5px;line-height:1.7;color:#1a1a1a;font-style:italic;">«Dopo il giorno 3 avevo quasi mollato. Il giorno 8 è stata la prima passeggiata in cui il guinzaglio non si è teso nemmeno una volta. Mi sono messa a piangere.»</p>
            <p style="margin:0;font-size:13px;color:#6B7280;">— Nina S., ${breed} «Sage», 2 anni, Colonia</p>
          </td></tr>
        </table>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3a3a3a;">Non te la mandiamo per farti sentire meglio. Ma perché tu sappia: quello che stai attraversando adesso con ${dogName}, qualcuno prima di te ce l'ha già fatta.</p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#3a3a3a;">La Sage di Nina oggi, 8 mesi dopo, è uno dei cani più tranquilli del suo quartiere. Non per miracolo. Ma perché al giorno 4 non ha mollato.</p>`,
        ctaText: `Apri il piano di ${dogName}`,
        footerHint: `Ricevi l'e-mail di Nina perché ora sei esattamente nel punto in cui lei era allora. Ce la farai anche tu.`,
      };
    }
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
    if (lang === "pl") {
      return {
        subject: `Pytanie o ${dogName} — przed 2. tygodniem`,
        preheader: `30 sekund czytania, sekunda zastanowienia.`,
        headline: `Tydzień 1 zaraz się kończy.`,
        intro: `Zanim zaczniesz 2. tydzień, jedno pytanie do ciebie. Nie jest retoryczne — możesz spokojnie odpowiedzieć wprost na tego e-maila.`,
        bodyHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;margin:8px 0 16px;">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0;font-size:15.5px;line-height:1.7;color:#1a1a1a;font-weight:700;">Kiedy dokładnie ostatnio świadomie ćwiczyłeś z ${dogName}?</p>
          </td></tr>
        </table>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3a3a3a;">Jeśli odpowiedź brzmi „dziś” albo „wczoraj” — jesteś na kursie. Rób dalej tak jak dotąd.</p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#3a3a3a;">Jeśli odpowiedź brzmi „3 dni temu” albo dawniej — bez stresu. Ale dziś krótka sesja (wystarczy 5 minut) znów was wciągnie. Tydzień 2 opiera się na tygodniu 1, a bez rutyny cała konstrukcja się rozpada.</p>`,
        ctaText: `Otwórz plan ${dogName}`,
        footerHint: `Odpowiedz na tego e-maila jedną liczbą: ile dni temu była ostatnia sesja? Odpowiadamy osobiście.`,
      };
    }
    if (lang === "it") {
      return {
        subject: `Una domanda su ${dogName}, prima della settimana 2`,
        preheader: `30 secondi di lettura, un secondo di riflessione.`,
        headline: `La settimana 1 sta per finire.`,
        intro: `Prima di iniziare la settimana 2, una domanda per te. Non è retorica: rispondi pure direttamente a questa e-mail.`,
        bodyHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;margin:8px 0 16px;">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0;font-size:15.5px;line-height:1.7;color:#1a1a1a;font-weight:700;">Quando esattamente hai fatto l'ultima volta un esercizio consapevole con ${dogName}?</p>
          </td></tr>
        </table>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3a3a3a;">Se la risposta è &quot;oggi&quot; o &quot;ieri&quot;, sei in carreggiata. Continua così.</p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#3a3a3a;">Se la risposta è &quot;3 giorni fa&quot; o prima ancora, nessun problema. Ma oggi una breve sessione (bastano 5 minuti) vi rimette in gioco. La settimana 2 si basa sulla settimana 1, e senza una routine tutta la costruzione crolla.</p>`,
        ctaText: `Apri il piano di ${dogName}`,
        footerHint: `Rispondi a questa e-mail con un numero: quanti giorni fa è stata l'ultima sessione? Rispondiamo personalmente.`,
      };
    }
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
    if (lang === "pl") {
      return {
        subject: `Co rodzina i sąsiedzi zauważą u ${dogName} jako pierwsi`,
        preheader: `Nie widzisz zmiany, bo jesteś przy tym codziennie.`,
        headline: `Inni zobaczą to, zanim ty to zobaczysz.`,
        intro: `Kiedy widzisz ${dogName} codziennie, drobne zmiany prawie nie rzucają się w oczy. Dlatego nasi właściciele często myślą „nic się nie dzieje” — aż przychodzą goście i mówią: „Co się stało z ${dogName}? Jest o wiele spokojniejszy niż w zeszłym miesiącu.”`,
        bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">Oto trzy zmiany, które innym najczęściej rzucają się w oczy jako pierwsze:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 16px;">
          <tr><td style="padding:10px 0;border-bottom:1px solid #F0EBE3;"><strong style="color:#1a1a1a;">Czas reakcji na zawołanie po imieniu</strong><br><span style="color:#6B7280;font-size:13.5px;line-height:1.5;">Zamiast 5 sekund opóźnienia → natychmiast.</span></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #F0EBE3;"><strong style="color:#1a1a1a;">Napięcie na smyczy</strong><br><span style="color:#6B7280;font-size:13.5px;line-height:1.5;">Już po 2 tygodniach zwykle wyraźnie odczuwalne — nawet jeśli teraz tego nie czujesz.</span></td></tr>
          <tr><td style="padding:10px 0;"><strong style="color:#1a1a1a;">Fazy spokoju w domu</strong><br><span style="color:#6B7280;font-size:13.5px;line-height:1.5;">Psy, które trenują w sposób uporządkowany, szybciej się w domu wyciszają. Bez tego, byś cokolwiek zmieniał.</span></td></tr>
        </table>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">Zapytaj dziś kogoś z otoczenia, kto zna ${dogName}: „Zauważyłeś coś w nim?”. Odpowiedź cię zaskoczy.</p>`,
        ctaText: `Otwórz plan ${dogName}`,
        footerHint: `Jeśli ktoś zauważy coś konkretnego — napisz nam. Zbieramy takie momenty i wykorzystujemy je (anonimowo), by motywować innych.`,
      };
    }
    if (lang === "it") {
      return {
        subject: `Cosa notano per primi familiari e vicini in ${dogName}`,
        preheader: `Non ti accorgi del cambiamento perché ci sei ogni giorno.`,
        headline: `Gli altri lo vedono prima di te.`,
        intro: `Quando vedi ${dogName} ogni giorno, i piccoli cambiamenti quasi non si notano. È il motivo per cui i nostri proprietari spesso pensano &quot;non succede niente&quot;, finché non arriva una visita che dice: &quot;Ma cosa è successo a ${dogName}? È molto più tranquillo del mese scorso.&quot;`,
        bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">Questi sono i tre cambiamenti che di solito gli altri notano per primi:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 16px;">
          <tr><td style="padding:10px 0;border-bottom:1px solid #F0EBE3;"><strong style="color:#1a1a1a;">Tempo di reazione quando lo chiami per nome</strong><br><span style="color:#6B7280;font-size:13.5px;line-height:1.5;">Invece di 5 secondi di ritardo → subito.</span></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #F0EBE3;"><strong style="color:#1a1a1a;">Tensione sul guinzaglio</strong><br><span style="color:#6B7280;font-size:13.5px;line-height:1.5;">Già dopo 2 settimane di solito ben percepibile, anche se in questo momento non la senti.</span></td></tr>
          <tr><td style="padding:10px 0;"><strong style="color:#1a1a1a;">Fasi di calma in casa</strong><br><span style="color:#6B7280;font-size:13.5px;line-height:1.5;">I cani che si allenano in modo strutturato si rilassano più in fretta a casa. Senza che tu cambi nulla.</span></td></tr>
        </table>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">Chiedi oggi a qualcuno del tuo giro che conosce ${dogName}: &quot;Hai notato qualcosa in lui?&quot;. La risposta ti sorprenderà.</p>`,
        ctaText: `Apri il piano di ${dogName}`,
        footerHint: `Se qualcuno nota qualcosa di concreto, scrivici. Raccogliamo questi momenti e li usiamo (in forma anonima) per motivare gli altri.`,
      };
    }
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
    if (lang === "pl") {
      return {
        subject: `Od teraz będzie wydawać się trudniej. Dlaczego to dobry znak.`,
        preheader: `„Plateau” — prawie wszyscy przeżywają je między dniem 20 a 25.`,
        headline: `Jeśli teraz przychodzi frustracja — jesteś dokładnie w planie.`,
        intro: `Jesteś w 3. tygodniu z ${dogName}. Jeśli wkrada się teraz uczucie „nie robimy już żadnych postępów” — witaj na plateau. Prawie każdy przeżywa je dokładnie teraz. To nie błąd, to biologia zachowania.`,
        bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">W pierwszych 2 tygodniach psy uczą się bardzo szybko — każde ćwiczenie przynosi widoczne postępy. W 3. tygodniu to zwalnia. Nie dlatego, że ${dogName} przestaje się uczyć, ale dlatego, że nauczone właśnie się utrwala (neuronaukowcy nazywają to konsolidacją).</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:14px 0;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#8B7355;">Co powinieneś zrobić TERAZ</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">Zmniejsz intensywność treningu, nie zwiększaj. Zamiast 3× dziennie → 1× dziennie, za to bardziej konsekwentnie. Plateau trwa 5–8 dni, potem nadchodzi kolejny skok — widoczny i często większy niż pierwszy.</p>
          </td></tr>
        </table>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">Właśnie tu 70 % właścicieli psów rezygnuje. Pozostałe 30 % przeżywa w 4. tygodniu największy moment „aha” z całego planu.</p>`,
        ctaText: `Otwórz plan ${dogName}`,
        footerHint: `Frustracja nie jest tu sygnałem ostrzegawczym, lecz kamieniem milowym. Napisz nam, jeśli masz wątpliwości — chętnie potwierdzimy, że jesteś na kursie.`,
      };
    }
    if (lang === "it") {
      return {
        subject: `Da adesso sembrerà più difficile. Perché è un buon segno.`,
        preheader: `Il &quot;plateau&quot;, quasi tutti lo vivono tra il giorno 20 e il 25.`,
        headline: `Se ora arriva la frustrazione, sei esattamente nei tempi.`,
        intro: `Sei nella settimana 3 con ${dogName}. Se ora si insinua la sensazione &quot;non facciamo più progressi&quot;, benvenuto nel plateau. Quasi tutti lo vivono proprio adesso. Non è un errore, è biologia del comportamento.`,
        bodyHtml: `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a;">Nelle prime 2 settimane i cani imparano velocissimamente, ogni esercizio porta progressi visibili. Nella settimana 3 tutto rallenta. Non perché ${dogName} smetta di imparare, ma perché ciò che ha imparato si sta consolidando (i neuroscienziati lo chiamano consolidamento).</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #C4A576;background:#FAF6EE;border-radius:6px;margin:14px 0;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#8B7355;">Cosa dovresti fare ORA</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">Riduci l'intensità dell'allenamento, non aumentarla. Invece di 3× al giorno → 1× al giorno, ma con più costanza. Il plateau dura da 5 a 8 giorni, poi arriva il salto successivo, visibile e spesso più grande del primo.</p>
          </td></tr>
        </table>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">È proprio qui che il 70 % dei proprietari di cani si ferma. L'altro 30 % vive nella settimana 4 il più grande momento di svolta di tutto il piano.</p>`,
        ctaText: `Apri il piano di ${dogName}`,
        footerHint: `Qui la frustrazione non è un campanello d'allarme, ma una pietra miliare. Scrivici se hai dubbi, ti confermiamo volentieri che sei in carreggiata.`,
      };
    }
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
    // Tag-30: persönliche Umfrage-Mail von Laura (Werkstudentin). Schlicht
    // gehalten (plainHtml) → wirkt persönlich + landet besser im Posteingang.
    // 2-Min-Feedback, als Dankeschön ein vergünstigtes Zusatzmodul.
    const umfrageUrl = `${BASE}/umfrage.html?lead_id=${encodeURIComponent(
      lead.id
    )}&email=${encodeURIComponent(lead.email)}&dog=${encodeURIComponent(dogName)}`;
    // DSGVO: sichtbarer Abmelde-Link (unser Endpoint setzt answers.unsubscribed,
    // die Sequenz-Cron stoppt daraufhin). Zusätzlich als List-Unsubscribe-Header.
    const unsubUrl = `${BASE}/api/unsubscribe?lead=${encodeURIComponent(lead.id)}`;

    // ── Trustpilot-Bewertungs-Einladung (Stern-Gating) ──────────────────
    // Hinter Flag REVIEW_INVITE_LIVE="1" — bis dahin bleibt die Laura-Mail
    // exakt wie bisher. 4-5★ → Trustpilot, 1-3★ → /bewertung → umfrage.html.
    // Die Einladung ist UNKONDITIONIERT (kein Rabatt daran geknüpft — das
    // 33%-Dankeschön hängt an der Umfrage, nicht an der öffentlichen Bewertung;
    // incentivierte Reviews wären Trustpilot-/UWG-widrig). Nur DE (Trustpilot-
    // Profil = pfoten-plan.de); PL/IT bräuchten eigene Profile.
    const reviewLive = process.env.REVIEW_INVITE_LIVE === "1";
    const revLink = (n: number) =>
      `${BASE}/bewertung?sterne=${n}&lead_id=${encodeURIComponent(
        lead.id
      )}&email=${encodeURIComponent(lead.email)}`;
    // Wichtig für Mobile: KEIN <a> um eine <table> (Gmail-App & Co. machen das
    // nicht klickbar → "passiert nichts"). Stattdessen je ein <a> IN der Zelle,
    // um Bild und Label — bulletproof tap-bar auf allen Clients.
    const starRow = (n: number, label: string, color: string) =>
      `<tr><td style="padding:6px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td><a href="${revLink(
        n
      )}" target="_blank" style="display:block;text-decoration:none;line-height:0;font-size:0;"><img src="${BASE}/review-stars-${n}.png" alt="${n} von 5 Sternen" width="150" height="28" style="display:block;width:150px;height:28px;border:0;"></a></td><td style="vertical-align:middle;padding-left:10px;"><a href="${revLink(n)}" target="_blank" style="display:inline-block;text-decoration:none;color:${color};font-size:14px;font-weight:600;">${label}</a></td></tr></table></td></tr>`;
    const starsTable = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;">${starRow(
      5,
      "Hervorragend",
      "#00b67a"
    )}${starRow(4, "Gut", "#73cf11")}${starRow(
      3,
      "Befriedigend",
      "#e6a700"
    )}${starRow(2, "Ausreichend", "#ff8622")}${starRow(
      1,
      "Mangelhaft",
      "#ff3722"
    )}</table>`;

    // Flag AN → bewertungs-fokussierte Mail (Umfrage-CTA raus, Sterne = Haupt-CTA;
    //           1-3★ landen über /bewertung weiter auf umfrage.html).
    // Flag AUS → exakt die bisherige Umfrage-Mail, damit bis zum Scharfstellen
    //           nichts an der laufenden Sequenz verändert wird.
    const reviewHtml = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<div style="max-width:520px;margin:0 auto;padding:24px 22px;font-size:15.5px;line-height:1.65;">
  <p style="margin:0 0 14px;">Hallo,</p>
  <p style="margin:0 0 14px;">ich bin Laura, Werkstudentin bei Pfoten-Plan 🐾. Du trainierst jetzt seit etwa 30 Tagen mit ${dogName} — und ich wollte kurz hören, wie zufrieden du bist.</p>
  <p style="margin:0 0 6px;font-weight:700;">Wie zufrieden bist du mit Pfoten-Plan?</p>
  <p style="margin:0 0 14px;color:#4B5563;">Wenn dir und ${dogName} der Plan geholfen hat, freuen wir uns riesig über deine Bewertung. Das dauert nur eine Minute und hilft anderen Hundehaltern bei der Entscheidung. Tippe einfach auf deine Bewertung:</p>
  ${starsTable}
  <p style="margin:14px 0 16px;color:#4B5563;">Und falls gerade etwas nicht rund läuft: Klick genauso auf die Sterne, dann kümmern wir uns persönlich darum.</p>
  <p style="margin:0 0 6px;">Dankeschön &amp; liebe Grüße</p>
  <p style="margin:0;">Laura<br><span style="color:#6B7280;font-size:13px;">Werkstudentin · Pfoten-Plan</span></p>
  <p style="margin:20px 0 0;font-size:11px;color:#9CA3AF;line-height:1.5;">Mehr zum Datenschutz: <a href="${BASE}/datenschutz.html" style="color:#9CA3AF;">pfoten-plan.de/datenschutz</a><br>Keine E-Mails mehr von uns? <a href="${unsubUrl}" style="color:#9CA3AF;text-decoration:underline;">Hier abmelden</a>.</p>
</div>
</body></html>`;

    const surveyHtml = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<div style="max-width:520px;margin:0 auto;padding:24px 22px;font-size:15.5px;line-height:1.65;">
  <p style="margin:0 0 14px;">Hallo,</p>
  <p style="margin:0 0 14px;">ich bin Laura, Werkstudentin bei Pfoten-Plan 🐾. Ich sammle gerade kurz Feedback zu deinem Training mit ${dogName}.</p>
  <p style="margin:0 0 18px;"><strong>4 Fragen, keine 2 Minuten.</strong> Als Dankeschön bekommst du danach ein Zusatzmodul <strong>33 % günstiger</strong>:</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr><td>
    <a href="${umfrageUrl}" target="_blank" style="display:inline-block;background:#C4A576;color:#ffffff;text-decoration:none;padding:15px 34px;border-radius:11px;font-size:16px;font-weight:700;">Zur kurzen Umfrage →</a>
  </td></tr></table>
  <p style="margin:0 0 12px;color:#4B5563;">Du trainierst jetzt seit etwa 30 Tagen mit ${dogName}.</p>
  <p style="margin:0 0 16px;color:#4B5563;">Genau der richtige Moment, um kurz zu schauen, was gut läuft und was wir besser machen können. Dein Feedback hilft uns wirklich.</p>
  <p style="margin:0 0 16px;font-size:13px;color:#9CA3AF;">Falls der Button nicht geht: <a href="${umfrageUrl}" style="color:#8B7355;word-break:break-all;">hier klicken</a></p>
  <p style="margin:0 0 6px;">Dankeschön &amp; liebe Grüße</p>
  <p style="margin:0;">Laura<br><span style="color:#6B7280;font-size:13px;">Werkstudentin · Pfoten-Plan</span></p>
  <p style="margin:20px 0 0;font-size:11px;color:#9CA3AF;line-height:1.5;">Die Teilnahme ist freiwillig. Mehr zum Datenschutz: <a href="${BASE}/datenschutz.html" style="color:#9CA3AF;">pfoten-plan.de/datenschutz</a><br>Keine E-Mails mehr von uns? <a href="${unsubUrl}" style="color:#9CA3AF;text-decoration:underline;">Hier abmelden</a>.</p>
</div>
</body></html>`;

    const plainHtml = reviewLive ? reviewHtml : surveyHtml;

    if (lang === "pl") {
      const plainHtmlPl = `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<div style="max-width:520px;margin:0 auto;padding:24px 22px;font-size:15.5px;line-height:1.65;">
  <p style="margin:0 0 14px;">Cześć,</p>
  <p style="margin:0 0 14px;">jestem Laura, praktykantka w ŁapaPlan 🐾. Zbieram właśnie krótko opinie o twoim treningu z ${dogName}.</p>
  <p style="margin:0 0 18px;"><strong>4 pytania, mniej niż 2 minuty.</strong> W podziękowaniu dostaniesz potem moduł dodatkowy <strong>33 % taniej</strong>:</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr><td>
    <a href="${umfrageUrl}" target="_blank" style="display:inline-block;background:#C4A576;color:#ffffff;text-decoration:none;padding:15px 34px;border-radius:11px;font-size:16px;font-weight:700;">Do krótkiej ankiety →</a>
  </td></tr></table>
  <p style="margin:0 0 12px;color:#4B5563;">Trenujesz z ${dogName} już od około 30 dni.</p>
  <p style="margin:0 0 16px;color:#4B5563;">To idealny moment, żeby krótko sprawdzić, co idzie dobrze, a co możemy zrobić lepiej. Twoja opinia naprawdę nam pomaga.</p>
  <p style="margin:0 0 16px;font-size:13px;color:#9CA3AF;">Jeśli przycisk nie działa: <a href="${umfrageUrl}" style="color:#8B7355;word-break:break-all;">kliknij tutaj</a></p>
  <p style="margin:0 0 6px;">Dziękuję &amp; serdecznie pozdrawiam</p>
  <p style="margin:0;">Laura<br><span style="color:#6B7280;font-size:13px;">Praktykantka · ŁapaPlan</span></p>
  <p style="margin:20px 0 0;font-size:11px;color:#9CA3AF;line-height:1.5;">Udział jest dobrowolny. Więcej o ochronie danych: <a href="${BASE}/datenschutz.html" style="color:#9CA3AF;">pfoten-plan.de/datenschutz</a><br>Nie chcesz już e-maili? <a href="${unsubUrl}" style="color:#9CA3AF;text-decoration:underline;">Wypisz się tutaj</a>.</p>
</div>
</body></html>`;

      return {
        subject: `Krótkie pytanie o ${dogName} 🐾`,
        senderName: "Laura z ŁapaPlan",
        plainHtml: plainHtmlPl,
      };
    }

    if (lang === "it") {
      const plainHtmlIt = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<div style="max-width:520px;margin:0 auto;padding:24px 22px;font-size:15.5px;line-height:1.65;">
  <p style="margin:0 0 14px;">Ciao,</p>
  <p style="margin:0 0 14px;">sono Laura, studentessa e collaboratrice da ZampaPlan 🐾. Sto raccogliendo un breve feedback sul tuo allenamento con ${dogName}.</p>
  <p style="margin:0 0 18px;"><strong>4 domande, meno di 2 minuti.</strong> Come ringraziamento riceverai poi un modulo aggiuntivo al <strong>33 % in meno</strong>:</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr><td>
    <a href="${umfrageUrl}" target="_blank" style="display:inline-block;background:#C4A576;color:#ffffff;text-decoration:none;padding:15px 34px;border-radius:11px;font-size:16px;font-weight:700;">Al breve sondaggio →</a>
  </td></tr></table>
  <p style="margin:0 0 12px;color:#4B5563;">Ti alleni con ${dogName} da circa 30 giorni.</p>
  <p style="margin:0 0 16px;color:#4B5563;">Proprio il momento giusto per dare un'occhiata a cosa funziona bene e a cosa possiamo migliorare. Il tuo feedback ci aiuta davvero.</p>
  <p style="margin:0 0 16px;font-size:13px;color:#9CA3AF;">Se il pulsante non funziona: <a href="${umfrageUrl}" style="color:#8B7355;word-break:break-all;">clicca qui</a></p>
  <p style="margin:0 0 6px;">Grazie &amp; un caro saluto</p>
  <p style="margin:0;">Laura<br><span style="color:#6B7280;font-size:13px;">Studentessa collaboratrice · ZampaPlan</span></p>
  <p style="margin:20px 0 0;font-size:11px;color:#9CA3AF;line-height:1.5;">La partecipazione è volontaria. Maggiori info sulla privacy: <a href="${BASE}/datenschutz.html" style="color:#9CA3AF;">pfoten-plan.de/datenschutz</a><br>Non vuoi più e-mail da noi? <a href="${unsubUrl}" style="color:#9CA3AF;text-decoration:underline;">Annulla l'iscrizione qui</a>.</p>
</div>
</body></html>`;

      return {
        subject: `Una breve domanda su ${dogName} 🐾`,
        senderName: "Laura di ZampaPlan",
        plainHtml: plainHtmlIt,
      };
    }

    return {
      subject: `Eine kurze Frage zu ${dogName} 🐾`,
      senderName: "Laura von Pfoten-Plan",
      plainHtml,
    };
  }

  return null;
}

// ── Send-Funktion ────────────────────────────────────────────────────
export async function sendSequenceMail(
  mailNum: number,
  lead: SequenceLead,
  lang: Lang = "de"
): Promise<{ ok: boolean; reason?: string }> {
  // PL-Marketing pausiert (lapaplan.pl-Auth down) — DE laeuft normal weiter.
  if (lang === "pl" && PL_MAILS_PAUSED) {
    return { ok: false, reason: "pl_paused" };
  }
  const def = buildMailDef(mailNum, lead, lang);
  if (!def) return { ok: false, reason: "no_content_for_mail" };
  if (!lead.email) return { ok: false, reason: "no_email" };

  // DSGVO: sichtbarer Abmelde-Link (unser Endpoint → answers.unsubscribed, Cron stoppt).
  const unsubUrl = `${BASE}/api/unsubscribe?lead=${encodeURIComponent(lead.id)}`;

  // Schlichte, persönliche Mail (z.B. Laura-Umfrage) nutzt eigenes HTML und
  // umgeht das Design-Template komplett. Sonst der normale Sequenz-Look.
  const html =
    def.plainHtml ??
    buildHtml({
      subject: def.subject,
      preheader: def.preheader || "",
      heroImg: getEmailImageUrl(lead.dog_breed, mailNum > 4 ? mailNum - 5 + 1 : mailNum), // Bilder 1-4 wiederverwenden für Mails 6-9
      dogBreed: displayBreed(lead.dog_breed),
      headline: def.headline || "",
      intro: def.intro || "",
      bodyHtml: def.bodyHtml || "",
      ctaUrl: def.ctaUrl || ctaUrlFor(lead),
      ctaText: def.ctaText || "",
      footerHint: def.footerHint || "",
      lang,
      unsubUrl,
    });

  const senderName =
    def.senderName ||
    (lang === "pl"
      ? "Max z ŁapaPlan"
      : lang === "it"
      ? "Max di ZampaPlan"
      : "Max von Pfoten-Plan");

  // DE: primär über Amazon SES (pfoten-post.de) — macht uns unabhängig von Brevo
  // und wärmt die neue Absenderdomain mit sauberem, engagiertem Käufer-Traffic auf.
  // Brevo bleibt automatischer Fallback. PL bleibt komplett auf Brevo (SES kann
  // nur als pfoten-post.de senden, nicht als lapaplan.pl).
  if (lang !== "pl") {
    const { sendViaSes, sesConfigured } = await import("./ses");
    if (sesConfigured()) {
      const fromEmail = /laura/i.test(senderName)
        ? "laura@pfoten-post.de"
        : "hallo@pfoten-post.de";
      const r = await sendViaSes({
        to: lead.email,
        subject: def.subject,
        html,
        fromName: senderName,
        fromEmail,
        replyTo: "support@pfoten-plan.de",
        unsubscribeUrl: unsubUrl,
        tags: [`email-seq-${mailNum}`],
      });
      if (r.ok) return { ok: true };
      console.error(
        `[email-sequence] SES fehlgeschlagen (mail ${mailNum}, ${lead.email}): ${r.status} ${r.error} → Fallback Brevo`
      );
    }
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email:
          lang === "pl"
            ? "pomoc@lapaplan.pl"
            : lang === "it"
            ? "supporto@zampaplan.it"
            : "support@pfoten-plan.de",
      },
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

// ── email_captured-Nurture Schedule (Tage nach Quiz-Abschluss = created_at) ──
// Versendet über sendSequenceMail (Mail-Nr 101–104). Gated im Cron via EC_SEQUENCE_LIVE.
export const EC_SEQUENCE_SCHEDULE: Array<{
  num: number;
  daysAfterCaptured: number;
  label: string;
}> = [
  { num: 101, daysAfterCaptured: 0, label: "EC Tag 0 (~10 Min) — Problem-Hook + Gratis-Übung + Proof" },
  { num: 102, daysAfterCaptured: 1, label: "EC Tag 1 — Warum es nicht von allein weggeht" },
  { num: 103, daysAfterCaptured: 3, label: "EC Tag 3 — Proof (problem-bezogen)" },
  { num: 104, daysAfterCaptured: 5, label: "EC Tag 5 — Check-in / zweiter Value-Touch" },
  { num: 105, daysAfterCaptured: 8, label: "EC Tag 8 — Einwände räumen" },
  { num: 106, daysAfterCaptured: 12, label: "EC Tag 12 — letzter Anstoß" },
];

export function getDueEcMail(daysAfterCaptured: number): number | null {
  let due: number | null = null;
  for (const s of EC_SEQUENCE_SCHEDULE) {
    if (daysAfterCaptured >= s.daysAfterCaptured) due = s.num;
  }
  return due;
}
