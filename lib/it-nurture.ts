// IT-Nurture-Sequenz fuer email_captured-Leads (zampaplan.it).
//
// 8 psychologisch aufgebaute italienische Mails. Takt (ab created_at):
//   1: +10 Min · 2: +6 Std · 3: +1 Tag · 4: +2 Tage · 5: +3 Tage
//   6: +4 Tage · 7: +5 Tage · 8: +6 Tage
// Ziel: Sicherheit geben + zum Kauf fuehren. KEIN Rabatt (clean).
// Mail 1-3 ohne Bild (persoenlich), 4/5/6 mit kleinem Bild.
// Jede Mail hat den sichtbaren Abmelde-Button (wrapTemplate unsubscribe:true).
// Absender: supporto@zampaplan.it (sendBrevoMail lang:"it").
//
// Struktur 1:1 nach lib/pl-nurture.ts, nur Inhalte italienisch. DE/PL
// unberuehrt — dieses Modul wird nur vom IT-Cron fuer lang=it-Leads genutzt.

import { sendBrevoMail, wrapTemplate, escapeHtml } from "./member-mail";

const IT_BASE = "https://www.zampaplan.it";

export type ItNurtureStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// Italienische Problem-Labels (klein, im Satz nach "di" verwendbar).
const PROBLEM_IT: Record<string, string> = {
  pulling: "tirare al guinzaglio",
  barking: "abbaiare eccessivo",
  aggression: "aggressività",
  anxiety: "ansia da separazione",
  jumping: "saltare addosso alle persone",
  recall: "mancato richiamo",
  energy: "energia in eccesso",
  destructive: "distruzione di oggetti",
  soiling: "sporcare in casa",
  mouthing: "mordicchiare",
};

interface NurtureArgs {
  to: string;
  dogName?: string | null;
  dogProblem?: string | null;
  leadId?: string | null;
}

function planUrl(leadId: string | null | undefined, stage: ItNurtureStage): string {
  // Attribution: Kauf lässt sich später als "aus Nurture-Mail Stufe N" erkennen
  // (utm landet via Checkout am Lead). utm_content = stage-N.
  const p = new URLSearchParams();
  if (leadId) p.set("lead_id", leadId);
  p.set("utm_source", "email");
  p.set("utm_medium", "email");
  p.set("utm_campaign", "it-nurture");
  p.set("utm_content", `stage-${stage}`);
  return `${IT_BASE}/plan?${p.toString()}`;
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
export function buildItNurture(
  stage: ItNurtureStage,
  args: NurtureArgs
): { subject: string; html: string } {
  const dog = (args.dogName || "").trim() || "il tuo cane";
  const dogCap = (args.dogName || "").trim() || "Il tuo cane";
  const problem = PROBLEM_IT[String(args.dogProblem || "")] || "comportamento";
  const cta = planUrl(args.leadId, stage);

  const common = { ctaUrl: cta, unsubscribe: true, lang: "it" as const };

  switch (stage) {
    case 1:
      return {
        subject: `Il piano per ${dog} è pronto 🐾`,
        html: wrapTemplate({
          ...common,
          preheader: "Le tue risposte sono salvate — guarda cosa abbiamo preparato.",
          headline: `Ciao! Il piano per ${dog} ti aspetta`,
          intro: `Grazie per aver completato il quiz. In base alle tue risposte abbiamo preparato un <strong>piano di addestramento personalizzato</strong> — su misura per ${dog} e per il problema di ${problem}.`,
          bodyHtml:
            p(`ZampaPlan è creato da un team di addestratori cinofili esperti. Lavoriamo <strong>esclusivamente con metodi basati sul rinforzo positivo</strong> — senza urla, senza punizioni, senza collari a strangolo. Solo esercizi concreti che puoi iniziare già oggi.`) +
            p(`Il piano è un acquisto unico (nessun abbonamento) e hai accesso subito dopo l'acquisto — via email e nell'area riservata.`),
          ctaText: `Guarda il piano per ${dog}`,
        }),
      };

    case 2:
      return {
        subject: `${dogCap} non è l'unico con questo problema`,
        html: wrapTemplate({
          ...common,
          preheader: "Guarda cosa è cambiato per altri proprietari.",
          headline: `Non sei solo con questa sfida`,
          intro: `Il problema di ${problem} è familiare a moltissimi proprietari. La buona notizia: è una di quelle cose che si possono cambiare — passo dopo passo.`,
          bodyHtml:
            p(`💬 <em>„Il mio cane una volta abbaiava a ogni altro cane. Dopo 3 settimane con il piano finalmente riusciamo a passeggiare tranquilli."</em> — Bella`) +
            p(`💬 <em>„Gli esercizi sono semplici ed efficaci. Si vede la differenza già dopo pochi giorni."</em> — Marco`) +
            p(`Più di <strong>3000 cani</strong> hanno già seguito il nostro piano. Il tuo può essere il prossimo.`),
          ctaText: `Voglio passeggiate più tranquille`,
        }),
      };

    case 3:
      return {
        subject: `Funzionerà con ${dog}?`,
        html: wrapTemplate({
          ...common,
          preheader: "Una risposta breve e sincera.",
          headline: `„Ma il mio cane è diverso…"`,
          intro: `Lo sentiamo spesso. Per questo il piano <strong>non è un modello preconfezionato</strong> — nasce dalle tue risposte.`,
          bodyHtml:
            p(`Razza, età, carattere ed esattamente il problema che hai indicato (${problem}) — teniamo conto di tutto. Gli esercizi sono pensati per essere svolti <strong>senza alcuna esperienza precedente</strong>.`) +
            p(`E quando ti blocchi, hai un <strong>coach AI disponibile 24 ore su 24</strong> che risponde alle tue domande su ${dog} a qualsiasi ora.`),
          ctaText: `Scopri il piano per ${dog}`,
        }),
      };

    case 4:
      return {
        subject: `${dogCap}: più aspetti, più diventa difficile`,
        html: wrapTemplate({
          ...common,
          preheader: "Senza pressione — solo onestà.",
          headline: `I comportamenti si consolidano con il tempo`,
          intro: `Non è per spaventarti — è semplicemente così che funziona l'apprendimento nei cani. Ogni giorno senza regole chiare rafforza la vecchia abitudine.`,
          bodyHtml:
            imageBlock(`${IT_BASE}/Vorher.jpg`, "La lotta di ogni giorno") +
            p(`La buona notizia: funziona anche al contrario. Pochi minuti di addestramento coerente al giorno e ${dog} inizia a capire cosa ti aspetti da lui.`) +
            p(`Non devi fare tutto in una volta. Il piano ti guida <strong>passo dopo passo</strong> — basta iniziare.`),
          ctaText: `Inizia già oggi`,
        }),
      };

    case 5:
      return {
        subject: `Cosa riceve esattamente ${dog}`,
        html: wrapTemplate({
          ...common,
          preheader: "Concretamente, punto per punto.",
          headline: `Il tuo piano non è un semplice PDF`,
          intro: `Ecco cosa ricevi subito dopo l'acquisto:`,
          bodyHtml:
            imageBlock(`${IT_BASE}/MockupPL.png`, "Ecco come si presenta il tuo piano") +
            p(`✅ <strong>Piano settimanale personalizzato</strong> per ${dog}<br>
               ✅ <strong>2 esercizi principali al giorno</strong> — brevi, chiari, efficaci<br>
               ✅ <strong>Coach AI 24/7</strong> per domande e situazioni difficili<br>
               ✅ <strong>Piano in PDF</strong> — da stampare o da tenere sul telefono<br>
               ✅ Giochi bonus e moduli aggiuntivi`) +
            p(`Tutto in un unico posto, su misura per ${dog}.`),
          ctaText: `Voglio il mio piano`,
        }),
      };

    case 6:
      return {
        subject: `Chi prepara il piano per ${dog}`,
        html: wrapTemplate({
          ...common,
          preheader: "Un metodo basato sulla scienza, non sulla forza.",
          headline: `Il nostro team di addestratori`,
          intro: `Dietro il piano c'è un team di addestratori cinofili esperti — non un generatore anonimo.`,
          bodyHtml:
            imageBlock(`${IT_BASE}/team.png`, "Il team di addestratori ZampaPlan") +
            p(`Lavoriamo con un <strong>metodo basato sul rinforzo positivo</strong> — lo stesso che usano i professionisti in tutto il mondo. Nessuna punizione, nessun collare a strangolo, nessuna urla. Un addestramento che costruisce <strong>fiducia</strong> tra te e ${dog}, non paura.`) +
            p(`È sicuro per il cane ed efficace per te.`),
          ctaText: `Scopri il piano`,
        }),
      };

    case 7:
      return {
        subject: `Senza rischi per ${dog}`,
        html: wrapTemplate({
          ...common,
          preheader: "L'unica cosa che puoi perdere è il vecchio problema.",
          headline: `Provi senza rischi`,
          intro: `Capiamo l'esitazione. Per questo togliamo noi il rischio a te.`,
          bodyHtml:
            p(`🔒 <strong>Pagamento unico</strong> — nessun abbonamento, non si rinnova nulla.<br>
               🔒 <strong>Accesso immediato</strong> — il piano via email subito dopo l'acquisto.<br>
               🔒 <strong>Garanzia di rimborso</strong> — se il piano non fa per te, scrivici a supporto@zampaplan.it.`) +
            p(`L'unica cosa che rischi davvero è un'altra settimana con lo stesso problema.`),
          ctaText: `Inizio senza rischi`,
        }),
      };

    case 8:
      return {
        subject: `Ultimo promemoria per ${dog}`,
        html: wrapTemplate({
          ...common,
          preheader: "Non vogliamo riempirti la casella di posta.",
          headline: `Il tuo piano ti sta ancora aspettando`,
          intro: `Questo è il nostro ultimo promemoria — non vogliamo riempirti la casella di posta.`,
          bodyHtml:
            p(`Il tuo piano personalizzato per ${dog} (tema: ${problem}) è pronto e ti aspetta. Tutto ciò di cui hai bisogno è dall'altra parte di questo pulsante.`) +
            p(`Se adesso non è il momento giusto — va bene così. Ma se vuoi che qualcosa cambi davvero, il giorno migliore per iniziare è oggi.`),
          ctaText: `Ritiro il piano per ${dogCap}`,
        }),
      };
  }
}

/** Sendet die Stage-Mail. Absender supporto@zampaplan.it (lang:"it"). */
export async function sendItNurtureMail(
  stage: ItNurtureStage,
  args: NurtureArgs
): Promise<{ ok: boolean; reason?: string }> {
  const { subject, html } = buildItNurture(stage, args);
  return sendBrevoMail({
    to: args.to,
    subject,
    html,
    lang: "it",
    // Persoenlicher Absender hebt Open-Rate (statt reiner Marke "ZampaPlan").
    senderName: "Max di ZampaPlan",
    tags: ["it-nurture", `stage-${stage}`],
  });
}
