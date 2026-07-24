// /api/zusatzmodul/send — generiert ein Zusatzmodul-PDF on-the-fly
// und schickt es per Brevo an den Käufer. Wird typischerweise vom
// Mollie/Stripe-Webhook nach einem Upsell-Kauf getriggert.
//
// Body:
//   { email, dogName?, moduleKey }
//
// moduleKey: pulling | energy | anxiety | aggression | mouthing |
//            recall | barking | jumping | destructive | soiling

import { NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import { renderBelegFooterHtml, type BelegRow } from "@/lib/beleg";

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";

// Idempotenz-Check: hat dieser Lead für dieses Modul schon eine Mail
// bekommen? Tracking in wauwerk_leads.answers.zusatzmodul_sent (Array).
async function isAlreadySent(email: string, moduleKey: string): Promise<boolean> {
  if (!email) return false;
  const admin = createMemberAdminClient();
  const { data } = await admin
    .from("wauwerk_leads")
    .select("id, answers")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sent = (data?.answers as any)?.zusatzmodul_sent;
  return Array.isArray(sent) && sent.includes(moduleKey);
}

async function markAsSent(email: string, moduleKey: string): Promise<void> {
  if (!email) return;
  const admin = createMemberAdminClient();
  const { data } = await admin
    .from("wauwerk_leads")
    .select("id, answers")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.id) return;
  const prevAnswers = (data.answers || {}) as Record<string, any>;
  const sent: string[] = Array.isArray(prevAnswers.zusatzmodul_sent)
    ? prevAnswers.zusatzmodul_sent
    : [];
  if (sent.includes(moduleKey)) return;
  await admin
    .from("wauwerk_leads")
    .update({
      answers: {
        ...prevAnswers,
        zusatzmodul_sent: [...sent, moduleKey],
        zusatzmodul_sent_at: {
          ...(prevAnswers.zusatzmodul_sent_at || {}),
          [moduleKey]: new Date().toISOString(),
        },
      },
    })
    .eq("id", data.id);
}

// Mail-Texte pro Modul — gleicher Stil wie bei den Sample-Mails.
const MODULE_CONFIG: Record<
  string,
  {
    label: string;
    subject: string;
    intro: string;
    body: string;
    closing: string;
  }
> = {
  pulling: {
    label: "Leinenführungs-Plan",
    subject: "Dein Leinenführungs-Plan für {dogName} ist da",
    intro: "der Leinenführungs-Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und so aufgebaut, dass ihr gemeinsam zu entspannten Spaziergängen findet. Die acht Übungen greifen logisch ineinander und helfen euch dabei, ruhige Orientierung an dir aufzubauen, Ziehen sanft auszuhebeln und Ablenkungen souverän zu meistern.",
    closing: "Viel Freude bei der Umsetzung und entspannte Spaziergänge mit {dogName}!",
  },
  energy: {
    label: "Energie- & Ruhe-Plan",
    subject: "Dein Energie- & Ruhe-Plan für {dogName} ist da",
    intro: "der Energie- & Ruhe-Plan für {dogName} ist jetzt fertig.",
    body: 'Der Plan wurde individuell auf {dogName} abgestimmt und so aufgebaut, dass ihr gemeinsam den "Aus-Knopf" findet. Die acht Übungen greifen logisch ineinander und helfen euch dabei, Impulskontrolle zu stärken, Frusttoleranz aufzubauen und eine gesunde Balance zwischen Aktivität und wertvoller Entspannung zu finden.',
    closing: "Viel Freude bei der Umsetzung und eine entspannte Zeit mit {dogName}!",
  },
  anxiety: {
    label: "Alleine-bleiben Plan",
    subject: "Dein Alleine-bleiben Plan für {dogName} ist da",
    intro: "der Alleine-bleiben Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und so aufgebaut, dass {dogName} Schritt für Schritt lernt, dass dein Weggehen sicher und vorhersehbar ist. Die acht Übungen greifen logisch ineinander und helfen euch dabei, Vor-Signale zu entkoppeln, Allein-Zeit sanft aufzubauen und eine berechenbare Tagesstruktur zu etablieren.",
    closing: "Viel Geduld bei der Umsetzung und entspanntere Stunden für euch beide!",
  },
  aggression: {
    label: "Aggressions-Kontrolle",
    subject: "Dein Aggressions-Kontroll-Plan für {dogName} ist da",
    intro: "der Aggressions-Kontroll-Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und konsequent unter dem Schwellenwert aufgebaut, ohne Konfrontation oder Druck. Die acht Übungen greifen logisch ineinander und helfen euch dabei, Sicherheit zu schaffen, Reize emotional umzulernen und Begegnungen ruhiger zu gestalten.",
    closing: "Geduld zahlt sich hier besonders aus — viel Erfolg mit {dogName}!",
  },
  mouthing: {
    label: "Anti-Aufnehm Plan",
    subject: "Dein Anti-Aufnehm Plan für {dogName} ist da",
    intro: "der Anti-Aufnehm Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und so aufgebaut, dass ihr gemeinsam sichere Spaziergänge ohne Such-Drama hinbekommt. Die acht Übungen greifen logisch ineinander und helfen euch dabei, AUS und PFUI sauber zu konditionieren, Tausch-Geschäfte zu etablieren und Hochrisiko-Strecken zu meistern.",
    closing: "Viel Freude bei der Umsetzung und sichere Spaziergänge mit {dogName}!",
  },
  recall: {
    label: "Rückruf-Plan",
    subject: "Dein Rückruf-Plan für {dogName} ist da",
    intro: "der Rückruf-Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und so aufgebaut, dass der Rückruf in Stufen zuverlässig wird. Die acht Übungen greifen logisch ineinander und helfen euch dabei, KOMM-HER positiv zu laden, mit Schleppleine zu festigen und Ablenkungen souverän zu meistern.",
    closing: "Viel Erfolg beim Aufbau eures sicheren Rückrufs!",
  },
  barking: {
    label: "Anti-Bell Plan",
    subject: "Dein Anti-Bell Plan für {dogName} ist da",
    intro: "der Anti-Bell Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und setzt darauf, Stille aktiv zu belohnen statt Bellen zu bekämpfen. Die acht Übungen greifen logisch ineinander und helfen euch dabei, Auslöser zu identifizieren, Klingel-Routinen umzulernen und Frust-Bellen zu reduzieren.",
    closing: "Viel Erfolg bei der Umsetzung und ruhigere Stunden mit {dogName}!",
  },
  jumping: {
    label: "Anti-Anspring Plan",
    subject: "Dein Anti-Anspring Plan für {dogName} ist da",
    intro: "der Anti-Anspring Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und so aufgebaut, dass ihr Begrüßungen entspannt gestalten könnt. Die acht Übungen greifen logisch ineinander und helfen euch dabei, die 4-Pfoten-Regel zu etablieren, SITZ als Begrüßung zu festigen und auch mit Gästen ruhige Routinen zu schaffen.",
    closing: "Viel Erfolg mit {dogName} bei euren nächsten Begegnungen!",
  },
  destructive: {
    label: "Anti-Zerstörungs Plan",
    subject: "Dein Anti-Zerstörungs Plan für {dogName} ist da",
    intro: "der Anti-Zerstörungs Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und arbeitet mit besseren Alternativen statt Verboten. Die acht Übungen greifen logisch ineinander und helfen euch dabei, Ursachen zu erkennen, ein attraktives Kau-Sortiment aufzubauen und mentale Auslastung im Alltag zu sichern.",
    closing: "Viel Freude bei der Umsetzung und eine ruhigere Wohnung!",
  },
  soiling: {
    label: "Stubenreinheits-Plan",
    subject: "Dein Stubenreinheits-Plan für {dogName} ist da",
    intro: "der Stubenreinheits-Plan für {dogName} ist jetzt fertig.",
    body: "Der Plan wurde individuell auf {dogName} abgestimmt und setzt auf klare Routinen und konsequente Belohnung statt Strafe. Die acht Übungen greifen logisch ineinander und helfen euch dabei, eine berechenbare Toiletten-Routine zu etablieren, Auslöser zu lesen und Unfälle sauber zu managen.",
    closing: "Geduld und Routine zahlen sich aus — viel Erfolg mit {dogName}!",
  },
  lebensretter: {
    label: "Lebensretter-Training",
    subject: "Dein Lebensretter-Training für {dogName} ist da",
    intro: "dein persönliches Lebensretter-Training für {dogName} ist jetzt fertig.",
    body: "Es enthält 10 Kommandos, die im Ernstfall den Unterschied machen: vom Notfall-Rückruf über das sofortige Aus bei Giftködern bis zum Distanz-Not-Halt an der Straße. Jedes Kommando ist in fünf klaren Schritten aufgebaut, mit Übungsplan und den wichtigsten No-Gos. Die Einleitung ist eigens auf {dogName} zugeschnitten.",
    closing: "Fang am besten mit dem Notfall-Rückruf an, damit du weißt, dass du für {dogName} alles getan hast.",
  },
};

// Bonus-Varianten: nutzen den PDF-Inhalt eines bestehenden Moduls (pdfModuleKey),
// aber mit eigenem, exklusiverem Mail-Namen UND eigenem Idempotenz-Key. Wichtig:
// der eigene Key (z.B. "freilauf") verhindert, dass ein spaeterer regulaerer
// Kauf desselben Moduls (z.B. "recall" im Shop) faelschlich als "schon gesendet"
// geblockt wird. Der Shop/MODULE_CONFIG bleibt unangetastet.
const BONUS_CONFIG: Record<
  string,
  {
    pdfModuleKey: string;
    label: string;
    subject: string;
    intro: string;
    body: string;
    closing: string;
  }
> = {
  freilauf: {
    pdfModuleKey: "recall",
    label: "Freilauf-Perfektions-Plan",
    subject: "🎁 Dein Freilauf-Perfektions-Plan für {dogName} ist da",
    intro: "dein exklusiver Freilauf-Perfektions-Plan für {dogName} ist freigeschaltet — heute geschenkt zu deinem Trainingsplan dazu.",
    body: "Dieser Bonus bringt {dogName} aufs nächste Level: zuverlässig kommen — auch aus dem Spiel, bei Ablenkung oder auf Distanz — und entspannter Freilauf, dem du wirklich vertrauen kannst. Die acht Übungen bauen logisch aufeinander auf: vom sicheren KOMM-HER über die Schleppleinen-Phase bis zur souveränen Freilauf-Routine.",
    closing: "Viel Freude mit eurem neuen Freilauf — Schritt für Schritt zur Perfektion!",
  },
};

// ---- POLNISCHE Mail-Configs (lang="pl") — Keys identisch zur DE-Version ----
const MODULE_CONFIG_PL: typeof MODULE_CONFIG = {
  pulling: {
    label: "Plan chodzenia na luźnej smyczy",
    subject: "Twój plan chodzenia na smyczy dla {dogName} jest gotowy",
    intro: "plan chodzenia na luźnej smyczy dla {dogName} jest już gotowy.",
    body: "Plan został indywidualnie dopasowany do {dogName} i zbudowany tak, żebyście razem doszli do spokojnych spacerów. Osiem ćwiczeń logicznie się zazębia i pomoże wam zbudować spokojną orientację na Ciebie, łagodnie wygasić ciągnięcie i pewnie radzić sobie z rozproszeniami.",
    closing: "Powodzenia we wdrażaniu i spokojnych spacerów z {dogName}!",
  },
  energy: {
    label: "Plan energii i spokoju",
    subject: "Twój plan energii i spokoju dla {dogName} jest gotowy",
    intro: "plan energii i spokoju dla {dogName} jest już gotowy.",
    body: "Plan został indywidualnie dopasowany do {dogName} i zbudowany tak, żebyście razem znaleźli „przycisk wyłączania”. Osiem ćwiczeń logicznie się zazębia i pomoże wam wzmocnić kontrolę impulsów, zbudować tolerancję na frustrację i znaleźć zdrową równowagę między aktywnością a cennym odpoczynkiem.",
    closing: "Powodzenia we wdrażaniu i spokojnego czasu z {dogName}!",
  },
  anxiety: {
    label: "Plan zostawania samemu",
    subject: "Twój plan zostawania samemu dla {dogName} jest gotowy",
    intro: "plan zostawania samemu dla {dogName} jest już gotowy.",
    body: "Plan został indywidualnie dopasowany do {dogName} i zbudowany tak, żeby {dogName} krok po kroku uczył się, że Twoje wyjście jest bezpieczne i przewidywalne. Osiem ćwiczeń logicznie się zazębia i pomoże wam odczepić sygnały poprzedzające wyjście, łagodnie wydłużać czas samotności i wprowadzić przewidywalną strukturę dnia.",
    closing: "Cierpliwości we wdrażaniu i spokojniejszych godzin dla was obojga!",
  },
  aggression: {
    label: "Plan kontroli agresji",
    subject: "Twój plan kontroli agresji dla {dogName} jest gotowy",
    intro: "plan kontroli agresji dla {dogName} jest już gotowy.",
    body: "Plan został indywidualnie dopasowany do {dogName} i konsekwentnie zbudowany poniżej progu pobudzenia, bez konfrontacji i presji. Osiem ćwiczeń logicznie się zazębia i pomoże wam stworzyć poczucie bezpieczeństwa, emocjonalnie przewarunkować bodźce i spokojniej kształtować spotkania.",
    closing: "Cierpliwość szczególnie się tu opłaca — powodzenia z {dogName}!",
  },
  mouthing: {
    label: "Plan przeciw podnoszeniu z ziemi",
    subject: "Twój plan przeciw podnoszeniu z ziemi dla {dogName} jest gotowy",
    intro: "plan przeciw podnoszeniu z ziemi dla {dogName} jest już gotowy.",
    body: "Plan został indywidualnie dopasowany do {dogName} i zbudowany tak, żebyście razem osiągnęli bezpieczne spacery bez dramatu ze zbieraniem. Osiem ćwiczeń logicznie się zazębia i pomoże wam czysto uwarunkować PUŚĆ i FUJ, wprowadzić wymianę na coś lepszego i opanować trasy wysokiego ryzyka.",
    closing: "Powodzenia we wdrażaniu i bezpiecznych spacerów z {dogName}!",
  },
  recall: {
    label: "Plan przywołania",
    subject: "Twój plan przywołania dla {dogName} jest gotowy",
    intro: "plan przywołania dla {dogName} jest już gotowy.",
    body: "Plan został indywidualnie dopasowany do {dogName} i zbudowany tak, żeby przywołanie stawało się niezawodne etapami. Osiem ćwiczeń logicznie się zazębia i pomoże wam pozytywnie naładować DO MNIE, utrwalić je na lince i pewnie radzić sobie z rozproszeniami.",
    closing: "Powodzenia w budowaniu pewnego przywołania!",
  },
  barking: {
    label: "Plan przeciw szczekaniu",
    subject: "Twój plan przeciw szczekaniu dla {dogName} jest gotowy",
    intro: "plan przeciw szczekaniu dla {dogName} jest już gotowy.",
    body: "Plan został indywidualnie dopasowany do {dogName} i stawia na aktywne nagradzanie ciszy zamiast zwalczania szczekania. Osiem ćwiczeń logicznie się zazębia i pomoże wam zidentyfikować wyzwalacze, przeuczyć rytuał przy dzwonku i ograniczyć szczekanie z frustracji.",
    closing: "Powodzenia we wdrażaniu i spokojniejszych godzin z {dogName}!",
  },
  jumping: {
    label: "Plan przeciw skakaniu na ludzi",
    subject: "Twój plan przeciw skakaniu dla {dogName} jest gotowy",
    intro: "plan przeciw skakaniu dla {dogName} jest już gotowy.",
    body: "Plan został indywidualnie dopasowany do {dogName} i zbudowany tak, żebyście mogli spokojnie kształtować powitania. Osiem ćwiczeń logicznie się zazębia i pomoże wam wprowadzić zasadę czterech łap na ziemi, utrwalić SIAD jako powitanie i stworzyć spokojne rytuały także z gośćmi.",
    closing: "Powodzenia z {dogName} przy kolejnych spotkaniach!",
  },
  destructive: {
    label: "Plan przeciw niszczeniu",
    subject: "Twój plan przeciw niszczeniu dla {dogName} jest gotowy",
    intro: "plan przeciw niszczeniu dla {dogName} jest już gotowy.",
    body: "Plan został indywidualnie dopasowany do {dogName} i pracuje z lepszymi alternatywami zamiast zakazów. Osiem ćwiczeń logicznie się zazębia i pomoże wam rozpoznać przyczyny, zbudować atrakcyjny wybór gryzaków i zapewnić stymulację umysłową na co dzień.",
    closing: "Powodzenia we wdrażaniu i spokojniejszego mieszkania!",
  },
  soiling: {
    label: "Plan czystości w domu",
    subject: "Twój plan czystości w domu dla {dogName} jest gotowy",
    intro: "plan czystości w domu dla {dogName} jest już gotowy.",
    body: "Plan został indywidualnie dopasowany do {dogName} i stawia na jasne rutyny i konsekwentne nagradzanie zamiast kary. Osiem ćwiczeń logicznie się zazębia i pomoże wam wprowadzić przewidywalną rutynę toaletową, odczytywać sygnały i czysto zarządzać wpadkami.",
    closing: "Cierpliwość i rutyna się opłacają — powodzenia z {dogName}!",
  },
};

const BONUS_CONFIG_PL: typeof BONUS_CONFIG = {
  freilauf: {
    pdfModuleKey: "recall",
    label: "Plan doskonałego chodzenia bez smyczy",
    subject: "🎁 Twój plan doskonałego luzu dla {dogName} jest gotowy",
    intro: "Twój ekskluzywny plan doskonałego chodzenia bez smyczy dla {dogName} jest odblokowany — dziś w prezencie do Twojego planu treningowego.",
    body: "Ten bonus przenosi {dogName} na wyższy poziom: niezawodne przychodzenie — nawet z zabawy, przy rozproszeniu czy na dystans — i spokojny luz, któremu naprawdę możesz zaufać. Osiem ćwiczeń logicznie buduje jedno na drugim: od pewnego DO MNIE przez etap linki po pewną rutynę bez smyczy.",
    closing: "Powodzenia z nowym luzem — krok po kroku do perfekcji!",
  },
};

function personalize(s: string, name: string): string {
  return String(s || "").replace(/\{dogName\}/g, name);
}

// Lebensretter-Modul: persönliche KI-Einleitung (whyParas) auf Basis von Rasse
// + Quiz-Antworten. Fällt bei Fehler still auf null zurück → buildPdf nutzt dann
// den statischen Standardtext des Moduls. Keine Gedankenstriche (Kunden-Wunsch).
async function buildLebensretterIntro(
  dogName: string,
  breed: string,
  answers: Record<string, any> | null
): Promise<string[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const problem =
    answers?.dog_problem ||
    answers?.problem ||
    (Array.isArray(answers?.dog_behaviors)
      ? answers!.dog_behaviors.join(", ")
      : "") ||
    "";
  const age = answers?.dog_age || answers?.age || "";
  const prompt = `Du schreibst die persönliche Einleitung für das "Lebensretter-Training" für einen Hund. Das ist ein Modul mit 10 Sicherheits-Kommandos (Notfall-Rückruf, sofortiges Aus bei Giftködern, Distanz-Not-Halt, Straßen-Stopp, Maulkorb-Akzeptanz u.a.), die den Hund im Ernstfall schützen.

Hund: ${dogName}, Rasse: ${breed || "unbekannt"}${age ? `, Alter: ${age}` : ""}.${problem ? ` Themen aus dem Quiz: ${problem}.` : ""}

Schreibe 3 bis 4 kurze, warme Absätze (per du, wie ein erfahrener Hundetrainer), die:
- auf die typischen Eigenschaften der Rasse eingehen und WARUM gerade dieser Hund von den Sicherheits-Kommandos profitiert
- die Quiz-Themen (falls vorhanden) aufgreifen und mit dem Sicherheits-Aspekt verknüpfen
- das Ganze um die Kernfrage rahmen: "Was, wenn es mal drauf ankommt?"
- in den Gedanken münden, dass diese 10 Kommandos das Sicherheitsnetz für ${dogName} sind

WICHTIG: Keine Gedankenstriche. Nutze Kommas und Punkte. Deutsch, konkret, nicht kitschig.

Gib AUSSCHLIESSLICH ein JSON-Array von 3 bis 4 Strings zurück (jeder String ein Absatz), sonst nichts.`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error("[zusatzmodul/send] Intro-API", res.status);
      return null;
    }
    const data = await res.json();
    const text = (data.content || [])
      .map((c: any) => c.text || "")
      .join("");
    const m = text.match(/\[[\s\S]*\]/);
    const paras = JSON.parse(m ? m[0] : text);
    if (Array.isArray(paras) && paras.length && paras.every((p) => typeof p === "string")) {
      return paras;
    }
    return null;
  } catch (e: any) {
    console.error("[zusatzmodul/send] Intro-Generierung fehlgeschlagen:", e?.message);
    return null;
  }
}

function buildHtml(
  cfg: { intro: string; body: string; closing: string },
  dogName: string,
  belegFooterHtml?: string
): string {
  const intro = personalize(cfg.intro, dogName);
  const body = personalize(cfg.body, dogName);
  const closing = personalize(cfg.closing, dogName);

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;line-height:1.6;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:36px 36px 12px;">
<p style="margin:0 0 18px;font-size:15px;color:#1a1a1a;">Hallo,</p>
<p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;">${intro}</p>
<p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;">${body}</p>
<p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;">Wenn während des Trainings Fragen auftauchen, melde dich jederzeit gern.</p>
<p style="margin:0 0 8px;font-size:15px;color:#1a1a1a;">${closing}</p>
</td></tr>
<tr><td style="padding:8px 36px 32px;">
<div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;padding:14px 16px;">
<p style="margin:0;font-size:13px;color:#4B5563;line-height:1.5;">Der vollständige Plan liegt als PDF im Anhang — druckbar oder unterwegs auf dem Handy dabei.</p>
</div>
${belegFooterHtml ? `<div style="margin-top:8px;">${belegFooterHtml}</div>` : ""}
</td></tr>
<tr><td style="padding:18px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;">
<p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;">Pfoten-Plan · Persönliches Hundetraining</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// POLNISCHE Mail-HTML (lang="pl")
function buildHtmlPL(
  cfg: { intro: string; body: string; closing: string },
  dogName: string
): string {
  const intro = personalize(cfg.intro, dogName);
  const body = personalize(cfg.body, dogName);
  const closing = personalize(cfg.closing, dogName);

  return `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;line-height:1.6;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EADDC5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:36px 36px 12px;">
<p style="margin:0 0 18px;font-size:15px;color:#1a1a1a;">Cześć,</p>
<p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;">${intro}</p>
<p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;">${body}</p>
<p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;">Jeśli w trakcie treningu pojawią się pytania, śmiało napisz do nas w każdej chwili.</p>
<p style="margin:0 0 8px;font-size:15px;color:#1a1a1a;">${closing}</p>
</td></tr>
<tr><td style="padding:8px 36px 32px;">
<div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:12px;padding:14px 16px;">
<p style="margin:0;font-size:13px;color:#4B5563;line-height:1.5;">Pełny plan znajdziesz w załączniku jako PDF — do wydruku albo pod ręką w telefonie na spacerze.</p>
</div>
</td></tr>
<tr><td style="padding:18px 32px;background:#FAFAFA;border-top:1px solid #F0EBE3;">
<p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;">ŁapaPlan · Spersonalizowany trening psa</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// Sprache des Leads (answers.lang) via Email nachschlagen — Default "de".
async function langForEmail(email: string): Promise<string> {
  if (!email) return "de";
  try {
    const admin = createMemberAdminClient();
    const { data } = await admin
      .from("wauwerk_leads")
      .select("answers")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lang = (data?.answers as any)?.lang;
    return String(lang || "").toLowerCase() === "pl" ? "pl" : "de";
  } catch {
    return "de";
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, dogName, moduleKey, bonusKey, force, lang } = body || {};

    if (!email) return NextResponse.json({ error: "email fehlt" }, { status: 400 });

    // Entweder regulaeres Modul (moduleKey → MODULE_CONFIG) ODER Bonus-Variante
    // (bonusKey → BONUS_CONFIG mit eigenem Namen + eigenem Idempotenz-Key).
    const bonus = bonusKey ? BONUS_CONFIG[bonusKey] : null;
    if (bonusKey && !bonus) {
      return NextResponse.json(
        { error: `bonusKey ungültig: "${bonusKey}". Verfügbar: ${Object.keys(BONUS_CONFIG).join(", ")}` },
        { status: 400 }
      );
    }
    if (!bonus && (!moduleKey || !MODULE_CONFIG[moduleKey])) {
      return NextResponse.json(
        { error: `moduleKey ungültig: "${moduleKey}". Verfügbar: ${Object.keys(MODULE_CONFIG).join(", ")}` },
        { status: 400 }
      );
    }

    // Effektive Werte: Bonus hat eigenen Track-Key + eigenen Mail-Text,
    // das PDF kommt aber aus pdfModuleKey (bestehender Modul-Inhalt).
    // Sprache: explizit im Body ODER am Lead (answers.lang). PL -> polnische
    // Mail-Config + polnischer PDF-Generator. Default "de" (unveraendert).
    const isPL =
      String(lang || "").toLowerCase() === "pl" ||
      (await langForEmail(email)) === "pl";
    const cfg = bonus
      ? isPL
        ? BONUS_CONFIG_PL[bonusKey]
        : bonus
      : isPL
        ? MODULE_CONFIG_PL[moduleKey] || MODULE_CONFIG[moduleKey]
        : MODULE_CONFIG[moduleKey];
    const pdfModuleKey: string = bonus ? bonus.pdfModuleKey : moduleKey;
    const trackKey: string = bonus ? bonusKey : moduleKey;
    if (!BREVO_API_KEY) {
      return NextResponse.json({ error: "BREVO_API_KEY fehlt" }, { status: 500 });
    }

    // Idempotenz: wenn dieses Modul schon an diese Email gesendet wurde,
    // skip — ausser ?force=true (Re-Send vom Dashboard / Admin).
    if (!force) {
      const alreadySent = await isAlreadySent(email, trackKey);
      if (alreadySent) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "already_sent",
          moduleKey: trackKey,
          email,
        });
      }
    }

    const name = (dogName || (isPL ? "Twojego psa" : "deinen Hund")).trim();

    // PDF on-the-fly bauen — kein Vorab-File nötig. PL nutzt den polnischen
    // Generator (Arimo-Unicode-Font). Zwei statische import()-Zweige, damit der
    // Bundler beide Module korrekt aufloest.
    const { buildPdf } = isPL
      ? await import("@/generate-zusatzmodul-pdf.pl.mjs")
      : await import("@/generate-zusatzmodul-pdf.mjs");

    // Lebensretter: echte Rasse + persönliche KI-Einleitung (whyParas) auf Basis
    // von Rasse/Quiz. Die anderen Module bleiben unverändert (Default-Breed + statischer why-Text).
    let pdfBreed = isPL ? "kundelek" : "Mischling";
    let whyParas: string[] | undefined;
    let belegFooterHtml: string | undefined;
    if (pdfModuleKey === "lebensretter") {
      try {
        const admin = createMemberAdminClient();
        const { data: lead } = await admin
          .from("wauwerk_leads")
          .select("id, answers, breed")
          .ilike("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const answers = (lead?.answers as any) || null;
        const breed =
          (lead as any)?.breed ||
          answers?.breed ||
          answers?.dog_breed ||
          "";
        if (breed) pdfBreed = breed;
        const intro = await buildLebensretterIntro(name, breed, answers);
        if (intro) whyParas = intro;

        // Beleg (Kleinbetragsrechnung) nachladen — im Mollie-Webhook bereits
        // erzeugt (vor der Auslieferung). Nur DE. Best-effort: fehlt er (seltener
        // Timing-Fall), geht die Mail trotzdem raus, der Beleg liegt im System.
        if (!isPL && (lead as any)?.id) {
          const { data: b } = await admin
            .from("belege")
            .select(
              "belegnummer,beschreibung,brutto_cents,ust_cents,netto_cents,ust_satz,leistungsdatum"
            )
            .eq("lead_id", (lead as any).id)
            .ilike("beschreibung", "%Lebensretter%")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (b) belegFooterHtml = renderBelegFooterHtml(b as BelegRow);
        }
      } catch (e: any) {
        console.warn("[zusatzmodul/send] Lebensretter-Personalisierung übersprungen:", e?.message);
      }
    }

    const pdfBytes = await buildPdf({
      dogName: name,
      dogBreed: pdfBreed,
      moduleKey: pdfModuleKey,
      verbose: false,
      ...(whyParas ? { whyParas } : {}),
    });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    const subject = personalize(cfg.subject, name);
    const html = isPL ? buildHtmlPL(cfg, name) : buildHtml(cfg, name, belegFooterHtml);
    const filename = `Pfoten-Plan-${cfg.label.replace(/[^a-zA-Z0-9-]/g, "-")}-${name.replace(/[^a-zA-Z0-9-]/g, "")}.pdf`;

    // Bezahlte Auslieferung: DE primär über Google Workspace SMTP (bessere
    // Zustellung bei web.de/GMX), Brevo als automatischer Fallback. PL bleibt
    // auf Brevo.
    let sentVia: "google" | "brevo" | null = null;
    let brevoMessageId: string | null = null;
    if (!isPL) {
      try {
        const { googleSmtpConfigured, sendViaGoogleSmtp } = await import(
          "@/lib/google-smtp"
        );
        if (googleSmtpConfigured()) {
          await sendViaGoogleSmtp({
            to: email,
            subject,
            html,
            cc: "kontakt@primesocial.de",
            attachments: [{ name: filename, contentBase64: pdfBase64 }],
          });
          sentVia = "google";
        }
      } catch (e: any) {
        console.error(
          "[zusatzmodul/send] Google-SMTP fehlgeschlagen → Fallback Brevo:",
          e?.message
        );
      }
    }

    if (!sentVia) {
      const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: isPL
            ? { name: "ŁapaPlan", email: "support@pfoten-plan.de" }
            : { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
          replyTo: isPL
            ? { email: "support@pfoten-plan.de", name: "ŁapaPlan" }
            : { email: "support@pfoten-plan.de", name: "Pfoten-Plan Support" },
          to: [{ email }],
          cc: [{ email: "kontakt@primesocial.de" }],
          subject,
          htmlContent: html,
          attachment: [{ name: filename, content: pdfBase64 }],
          tags: [`zusatzmodul-${trackKey}`, "auto-trigger"],
        }),
      });

      if (!brevoRes.ok) {
        const txt = await brevoRes.text();
        return NextResponse.json(
          { error: `Brevo ${brevoRes.status}: ${txt.slice(0, 200)}` },
          { status: 500 }
        );
      }
      const data = await brevoRes.json();
      brevoMessageId = data.messageId || null;
      sentVia = "brevo";
    }

    // Idempotenz-Marker setzen (best-effort, blockiert die Response nicht)
    try {
      await markAsSent(email, trackKey);
    } catch (e: any) {
      console.warn("[zusatzmodul/send] markAsSent failed:", e?.message);
    }
    return NextResponse.json({
      ok: true,
      moduleKey: trackKey,
      email,
      via: sentVia,
      brevoMessageId,
    });
  } catch (e: any) {
    console.error("[zusatzmodul/send] error:", e);
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
