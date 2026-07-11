// PL-Nurture-Sequenz fuer email_captured-Leads (lapaplan.pl).
//
// 8 psychologisch aufgebaute polnische Mails. Takt (ab created_at):
//   1: +10 Min · 2: +6 Std · 3: +1 Tag · 4: +2 Tage · 5: +3 Tage
//   6: +4 Tage · 7: +5 Tage · 8: +6 Tage
// Ziel: Sicherheit geben + zum Kauf fuehren. KEIN Rabatt (clean).
// Mail 1-3 ohne Bild (persoenlich), 4/5/6 mit kleinem Bild.
// Jede Mail hat den sichtbaren Abmelde-Button (wrapTemplate unsubscribe:true).
// Absender: pomoc@lapaplan.pl (sendBrevoMail lang:"pl").
//
// DE unberuehrt — dieses Modul wird nur vom PL-Cron fuer lang=pl-Leads genutzt.

import { sendBrevoMail, wrapTemplate, escapeHtml } from "./member-mail";

const PL_BASE = "https://www.lapaplan.pl";

export type PlNurtureStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// Polnische Problem-Labels (klein, im Satz).
const PROBLEM_PL: Record<string, string> = {
  pulling: "ciągnięcia na smyczy",
  barking: "nadmiernego szczekania",
  aggression: "agresji",
  anxiety: "lęku separacyjnego",
  jumping: "skakania na ludzi",
  recall: "braku przywołania",
  energy: "nadmiaru energii",
  destructive: "niszczenia rzeczy",
  soiling: "załatwiania się w domu",
  mouthing: "gryzienia i podgryzania",
};

interface NurtureArgs {
  to: string;
  dogName?: string | null;
  dogProblem?: string | null;
  leadId?: string | null;
}

function planUrl(leadId: string | null | undefined, stage: PlNurtureStage): string {
  // Attribution: Kauf lässt sich später als "aus Nurture-Mail Stufe N" erkennen
  // (utm landet via Checkout am Lead). utm_content = stage-N.
  const p = new URLSearchParams();
  if (leadId) p.set("lead_id", leadId);
  p.set("utm_source", "email");
  p.set("utm_medium", "email");
  p.set("utm_campaign", "pl-nurture");
  p.set("utm_content", `stage-${stage}`);
  return `${PL_BASE}/plan?${p.toString()}`;
}

// Kleines Bild-Snippet (zentriert, abgerundet, max 260px) fuer Mail 4/5/6.
function imageBlock(src: string, alt: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:4px 0 16px;">
    <img src="${src}" alt="${escapeHtml(alt)}" width="260" style="width:260px;max-width:80%;height:auto;border-radius:12px;display:block;">
  </td></tr></table>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">${text}</p>`;
}

/** Baut Subject + HTML fuer eine Stage. */
export function buildPlNurture(
  stage: PlNurtureStage,
  args: NurtureArgs
): { subject: string; html: string } {
  const dog = (args.dogName || "").trim() || "Twojego psa";
  const dogCap = (args.dogName || "").trim() || "Twój pies";
  const problem = PROBLEM_PL[String(args.dogProblem || "")] || "zachowania";
  const cta = planUrl(args.leadId, stage);

  const common = { ctaUrl: cta, unsubscribe: true, lang: "pl" as const };

  switch (stage) {
    case 1:
      return {
        subject: `Plan treningowy dla ${dog} jest gotowy 🐾`,
        html: wrapTemplate({
          ...common,
          preheader: "Twoje odpowiedzi są zapisane — zobacz, co przygotowaliśmy.",
          headline: `Cześć! Plan dla ${dog} czeka`,
          intro: `Dziękujemy za wypełnienie quizu. Na podstawie Twoich odpowiedzi przygotowaliśmy <strong>spersonalizowany plan treningowy</strong> — dopasowany do ${dog} i tematu ${problem}.`,
          bodyHtml:
            p(`ŁapaPlan tworzy zespół doświadczonych trenerów psów. Pracujemy <strong>wyłącznie metodami opartymi na nagradzaniu</strong> — bez krzyku, bez kar, bez kolczatek. Tylko konkretne ćwiczenia, które możesz zacząć jeszcze dziś.`) +
            p(`Plan jest jednorazowy (bez abonamentu), a dostęp masz od razu po zakupie — mailem i w panelu.`),
          ctaText: `Zobacz plan dla ${dog}`,
        }),
      };

    case 2:
      return {
        subject: `Ponad 3000 psów miało ten sam problem`,
        html: wrapTemplate({
          ...common,
          preheader: "Zobacz, co zmieniło się u innych właścicieli.",
          headline: `Nie jesteś sam z tym wyzwaniem`,
          intro: `Temat ${problem} zna bardzo wielu właścicieli. Dobra wiadomość: to jedna z rzeczy, które da się zmienić — krok po kroku.`,
          bodyHtml:
            p(`💬 <em>„Mój pies kiedyś szczekał na każdego innego psa. Po 3 tygodniach z planem możemy wreszcie spokojnie chodzić na spacery."</em> — Bella`) +
            p(`💬 <em>„Ćwiczenia są proste i skuteczne. Widać różnicę już po kilku dniach."</em> — Max`) +
            p(`Ponad <strong>3000 psów</strong> przeszło już przez nasz plan. Twój może być następny.`),
          ctaText: `Chcę spokojniejsze spacery`,
        }),
      };

    case 3:
      return {
        subject: `Czy to zadziała u ${dog}?`,
        html: wrapTemplate({
          ...common,
          preheader: "Krótka, szczera odpowiedź.",
          headline: `„Ale mój pies jest inny…"`,
          intro: `Słyszymy to często. Dlatego plan <strong>nie jest gotowym szablonem</strong> — powstaje na podstawie Twoich odpowiedzi.`,
          bodyHtml:
            p(`Rasa, wiek, charakter i dokładnie ten problem, który zaznaczyłeś (${problem}) — wszystko to bierzemy pod uwagę. Ćwiczenia są tak zaprojektowane, że wykonasz je <strong>bez wcześniejszego doświadczenia</strong>.`) +
            p(`A gdy utkniesz, masz <strong>trenera AI dostępnego 24/7</strong>, który odpowie na pytania o ${dog} o każdej porze.`),
          ctaText: `Sprawdź plan dla ${dog}`,
        }),
      };

    case 4:
      return {
        subject: `Im dłużej czekasz, tym trudniej`,
        html: wrapTemplate({
          ...common,
          preheader: "Bez presji — po prostu szczerze.",
          headline: `Zachowania utrwalają się z czasem`,
          intro: `To nie jest straszenie — po prostu tak działa uczenie się u psów. Każdy dzień bez jasnych zasad utrwala stary nawyk.`,
          bodyHtml:
            imageBlock(`${PL_BASE}/Vorher.jpg`, "Codzienna walka") +
            p(`Dobra wiadomość: działa to też w drugą stronę. Kilka minut spójnego treningu dziennie i ${dog} zaczyna rozumieć, czego od niego oczekujesz.`) +
            p(`Nie musisz robić wszystkiego naraz. Plan prowadzi Cię <strong>krok po kroku</strong> — wystarczy zacząć.`),
          ctaText: `Zacznij już dziś`,
        }),
      };

    case 5:
      return {
        subject: `Co dokładnie dostajesz`,
        html: wrapTemplate({
          ...common,
          preheader: "Konkretnie, punkt po punkcie.",
          headline: `Twój plan to nie jeden PDF`,
          intro: `Oto co dostajesz od razu po zakupie:`,
          bodyHtml:
            imageBlock(`${PL_BASE}/MockupPL.png`, "Tak wygląda Twój plan") +
            p(`✅ <strong>Spersonalizowany plan tygodniowy</strong> dla ${dog}<br>
               ✅ <strong>2 ćwiczenia główne dziennie</strong> — krótkie, jasne, skuteczne<br>
               ✅ <strong>Trener AI 24/7</strong> do pytań i trudnych sytuacji<br>
               ✅ <strong>Plan w PDF</strong> — do druku lub na telefon<br>
               ✅ Gry bonusowe i dodatkowe moduły`) +
            p(`Wszystko w jednym miejscu, dopasowane do ${dog}.`),
          ctaText: `Chcę mój plan`,
        }),
      };

    case 6:
      return {
        subject: `Kto stoi za ŁapaPlan`,
        html: wrapTemplate({
          ...common,
          preheader: "Metoda oparta na nauce, nie na sile.",
          headline: `Nasz zespół trenerów`,
          intro: `Za planem stoi zespół doświadczonych trenerów psów — a nie anonimowy generator.`,
          bodyHtml:
            imageBlock(`${PL_BASE}/team.png`, "Zespół trenerów ŁapaPlan") +
            p(`Pracujemy <strong>metodą opartą na nagradzaniu</strong> — tą samą, którą stosują profesjonaliści na całym świecie. Żadnych kar, kolczatek czy krzyku. Trening, który buduje <strong>zaufanie</strong> między Tobą a ${dog}, a nie strach.`) +
            p(`To bezpieczne dla psa i skuteczne dla Ciebie.`),
          ctaText: `Poznaj plan`,
        }),
      };

    case 7:
      return {
        subject: `Bez ryzyka — masz naszą gwarancję`,
        html: wrapTemplate({
          ...common,
          preheader: "Jedyne, co możesz stracić, to stary problem.",
          headline: `Próbujesz bez ryzyka`,
          intro: `Rozumiemy wahanie. Dlatego zdejmujemy z Ciebie ryzyko.`,
          bodyHtml:
            p(`🔒 <strong>Płatność jednorazowa</strong> — żadnego abonamentu, nic się nie odnawia.<br>
               🔒 <strong>Natychmiastowy dostęp</strong> — plan mailem od razu po zakupie.<br>
               🔒 <strong>Gwarancja zwrotu</strong> — jeśli plan Ci nie pasuje, napisz do nas na pomoc@lapaplan.pl.`) +
            p(`Jedyne, co realnie ryzykujesz, to kolejny tydzień z tym samym problemem.`),
          ctaText: `Zaczynam bez ryzyka`,
        }),
      };

    case 8:
      return {
        subject: `Ostatnie przypomnienie w sprawie ${dog}`,
        html: wrapTemplate({
          ...common,
          preheader: "Nie chcemy zapełniać Ci skrzynki.",
          headline: `Twój plan wciąż na Ciebie czeka`,
          intro: `To nasze ostatnie przypomnienie — nie chcemy zapełniać Ci skrzynki.`,
          bodyHtml:
            p(`Twój spersonalizowany plan dla ${dog} (temat: ${problem}) jest gotowy i czeka. Wszystko, czego potrzebujesz, jest po drugiej stronie tego przycisku.`) +
            p(`Jeśli teraz nie jest dobry moment — w porządku. Ale jeśli chcesz, żeby coś naprawdę się zmieniło, najlepszy dzień na start jest dziś.`),
          ctaText: `Odbieram plan dla ${dogCap}`,
        }),
      };
  }
}

/** Sendet die Stage-Mail. Absender pomoc@lapaplan.pl (lang:"pl"). */
export async function sendPlNurtureMail(
  stage: PlNurtureStage,
  args: NurtureArgs
): Promise<{ ok: boolean; reason?: string }> {
  const { subject, html } = buildPlNurture(stage, args);
  return sendBrevoMail({
    to: args.to,
    subject,
    html,
    lang: "pl",
    tags: ["pl-nurture", `stage-${stage}`],
  });
}
