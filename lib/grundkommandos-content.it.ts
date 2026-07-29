// lib/grundkommandos-content.it.ts
//
// Genera il CONTENUTO del "Piano comandi di base d'emergenza" (prodotto order-bump)
// per ogni cane tramite Opus. Si concentra sui comandi che il cane secondo il quiz
// (answers.dog_commands) NON conosce ancora, costruendo su quelli già noti.
// Ritorno: JSON di contenuto rigoroso (vedi GrundkommandosContent) che il
// PDF-Builder (lib/grundkommandos-pdf.ts) renderizza.

import Anthropic from "@anthropic-ai/sdk";

// Chiavi comando del quiz -> etichette italiane
export const COMMAND_LABELS: Record<string, string> = {
  sit: "Seduto",
  name: "Nome",
  place: "Al posto (coperta)",
  come: "Vieni/Qui",
  stay: "Resta",
  paw: "Zampa",
  wait: "Aspetta",
  heel: "Al piede",
  stop: "Fermo",
  leave: "Lascia",
  down: "Terra (sdraiato)",
};

// Comandi fondamentali che il prodotto copre SEMPRE (anche se non selezionati).
const CORE = [
  "Seduto",
  "Terra (sdraiato)",
  "Resta",
  "Vieni",
  "Aspetta",
  "Lascia",
  "Guarda (contatto visivo)",
  "Sulla coperta",
];

export interface GrundkommandoCmd {
  key: "cmd";
  command: string;
  status: "kann_schon" | "neu";
  title: string;
  intro: string;
  vorbereitung: string;
  aufbau: string[];
  wenn_nicht: string;
  wiederholung: string;
  erfolg: string;
  fehler: string;
}
export interface GrundkommandosContent {
  dogName: string;
  subtitle: string;
  known: string[];
  sections: any[];
}

function buildUserPrompt(dog: string, breed: string, problem: string, knownSet: string): string {
  return `Crea un manuale pratico MOLTO DETTAGLIATO „Sicuri nella vita di tutti i giorni – Comandi di base per cani insicuri" per ${dog} (${breed}), tema: ${problem}.
${dog} sa già: ${knownSet || "niente"}. Comandi fondamentali (importanti anche quelli non selezionati): ${CORE.join(", ")}. status "kann_schon" se presente in "${knownSet}", altrimenti "neu".
LINEE GUIDA: Ogni comando come VERO tutorial passo-passo per principianti; concreto su come GUIDARE il cane (attirarlo con un premietto, movimento della mano); "se non reagisce, allora..."; aspettative realistiche (NON al primo tentativo, tante ripetizioni distribuite su più giorni, numeri concreti); cane insicuro = nessuna costrizione, terminare con un successo. Comandi di controllo che funzionano anche con ciclisti, jogger, altri cani e ospiti.
Fornisci SOLO JSON, ogni valore su una riga:
{"dogName":"${dog}","subtitle":"...","sections":[
 {"key":"warum","title":"...","body":"3-4 frasi"},
 {"key":"haltung","title":"Prima di tutto il tuo atteggiamento","body":"2-3 frasi","points":["5 regole"]},
 {"key":"methode","title":"Come impara il tuo cane — la tua cassetta degli attrezzi","body":"2-3 frasi","bausteine":[{"name":"Attirare col premietto","text":"..."},{"name":"La parola-sì (il marcatore)","text":"..."},{"name":"Ricompensare","text":"..."},{"name":"Ripetere","text":"..."},{"name":"Piccoli passi","text":"..."},{"name":"Terminare con un successo","text":"..."}]},
 ${CORE.map((c) => `{"key":"cmd","command":"${c}","status":"kann_schon|neu","title":"${c} — breve aggiunta","intro":"1-2 frasi","vorbereitung":"1-2 frasi","aufbau":["6-7 passi concreti inclusi attirare col premietto/movimento della mano e se-non-reagisce"],"wenn_nicht":"2-3 frasi per guidarlo con dolcezza","wiederholung":"concreto: ripetizioni/sessione, quante volte al giorno, per quanti giorni; non al primo tentativo","erfolg":"...","fehler":"..."}`).join(",\n ")},
 {"key":"playbook","title":"Il prontuario del quotidiano: quale comando e quando","intro":"1 frase","situations":[
  {"ort":"A casa","situation":"Un ospite suona/entra","kommando":"Coperta + RESTA","tun":"2-3 frasi"},
  {"ort":"A casa","situation":"Suona il campanello / rumore forte","kommando":"GUARDA + TERRA","tun":"..."},
  {"ort":"A casa","situation":"Elemosina / cibo che cade a terra","kommando":"LASCIA","tun":"..."},
  {"ort":"A casa","situation":"${dog} si agita / diventa frenetico","kommando":"TERRA / Coperta","tun":"..."},
  {"ort":"A casa","situation":"Bambini che corrono/giocano scatenati","kommando":"Sulla coperta","tun":"..."},
  {"ort":"Fuori","situation":"Un altro cane viene incontro","kommando":"GUARDA + VIENI","tun":"..."},
  {"ort":"Fuori","situation":"Un gatto/topo sfreccia via","kommando":"GUARDA / LASCIA","tun":"..."},
  {"ort":"Fuori","situation":"Jogger/ciclista","kommando":"SEDUTO + GUARDA","tun":"..."},
  {"ort":"Fuori","situation":"Prima di attraversare la strada","kommando":"SEDUTO + ASPETTA","tun":"..."},
  {"ort":"Fuori","situation":"Un estraneo vuole accarezzarlo","kommando":"SEDUTO / VIENI","tun":"..."},
  {"ort":"Fuori","situation":"Al bar / in attesa","kommando":"TERRA + RESTA","tun":"..."},
  {"ort":"Fuori","situation":"${dog} si spaventa / vuole scappare","kommando":"GUARDA + VIENI","tun":"..."},
  {"ort":"Fuori","situation":"Alla porta di casa senza precipitarsi fuori","kommando":"SEDUTO + ASPETTA","tun":"..."},
  {"ort":"Fuori","situation":"Stimolo forte (camion dei rifiuti/fuochi d'artificio)","kommando":"GUARDA + Coperta","tun":"..."}
 ]},
 {"key":"wenn","title":"Cosa fare se…","cases":[{"fall":"${dog} si blocca","tun":"..."},{"fall":"sopraffatto/stressato","tun":"..."},{"fall":"in casa ok, fuori no","tun":"..."},{"fall":"reagisce solo con te","tun":"..."},{"fall":"passo indietro","tun":"..."}]},
 {"key":"woche","title":"Il tuo piano di partenza di 7 giorni","days":[{"tag":"Giorno 1-2","fokus":"..."},{"tag":"Giorno 3-4","fokus":"..."},{"tag":"Giorno 5-6","fokus":"..."},{"tag":"Giorno 7","fokus":"..."}],"check":["4 verifiche sì/no"]}
]}`;
}

const SYS =
  "Sei Ben, un addestratore cinofilo calmo ed esperto. Scrivi in italiano naturale, con tono caldo e parlato, dando sempre del tu (mai «Lei» né «voi»), molto concreto e pratico. Niente anglicismi: usa «premietto» per il bocconcino-ricompensa, «marcatore» per il segnale-sì, «maxi-premio» per la ricompensa speciale, «tempismo», «allenamento»/«addestramento». Niente gergo tecnico, niente Markdown. NESSUN a capo reale nelle stringhe JSON. Rispetta una sintassi JSON valida. Rispondi SOLO con JSON.";

// dog_commands (chiavi del quiz) -> etichette italiane
export function knownLabelsFromDogCommands(dogCommands: any): string[] {
  if (!Array.isArray(dogCommands)) return [];
  return dogCommands
    .map((c) => COMMAND_LABELS[String(c)] || null)
    .filter((x): x is string => !!x && x !== "keins");
}

export async function generateGrundkommandosContent(input: {
  dogName?: string | null;
  breed?: string | null;
  problem?: string | null;
  knownCommands?: string[];
}): Promise<GrundkommandosContent> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY mancante");

  const dog = (input.dogName || "il tuo cane").trim() || "il tuo cane";
  const breed = (input.breed || "Meticcio").trim() || "Meticcio";
  const problem = (input.problem || "insicurezza").trim() || "insicurezza";
  const known = (input.knownCommands || []).filter(Boolean);
  const knownSet = known.join(", ");

  const anthropic = new Anthropic({ apiKey });
  const stream = anthropic.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 22000,
    system: SYS,
    messages: [{ role: "user", content: buildUserPrompt(dog, breed, problem, knownSet) }],
  });
  const msg = await stream.finalMessage();
  const text = msg.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");

  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("nessun JSON nella risposta di Opus");
  let raw = text.slice(s, e + 1).replace(/[\r\n\t]+/g, " ");
  // Riparazione: rimuovi la "]" sparsa subito dopo campi di testo scalari (errore di Opus)
  raw = raw.replace(
    /("(?:wenn_nicht|wiederholung|erfolg|fehler|intro|vorbereitung|tun|body|text|subtitle|title|fokus)"\s*:\s*"[^"]*")\s*\]/g,
    "$1"
  );
  const data = JSON.parse(raw) as GrundkommandosContent;
  if (!Array.isArray(data?.sections) || !data.sections.length) {
    throw new Error("Opus non ha fornito sezioni");
  }
  data.known = known;
  data.dogName = data.dogName || dog;
  return data;
}
