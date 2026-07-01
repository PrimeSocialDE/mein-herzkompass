// app/api/premium-analyse/generate/route.ts
//
// Erzeugt die PREMIUM-EINZELANALYSE (Wert 79 EUR): Halter-Schilderung
// (transkribiertes Audio ODER Text) + optionale Foto/Video-Frames + Quiz
// -> hochprofessionelle, diagnostische Analyse (Claude Opus) -> Premium-PDF
// -> Versand per Brevo. Kein Standard-Plan, sondern eine individuelle
// Tiefen-Analyse fuer genau diesen Hund/diese geschilderte Situation.
//
// Body: {
//   email, dogName, breed?, age?, problem?,
//   transcript?  // Schilderung des Halters (aus Audio transkribiert oder Text)
//   photos?: [{ base64, type }]   // optionale Foto/Video-Frames
//   hadTraining?, commands?: string[], goal?
// }
// Auth: Bearer WORKER_TOKEN

import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import { buildPremiumAnalysePDF, type PremiumAnalyseContent } from "@/lib/premium-analyse-pdf";

// Rasse -> Datei (deckungsgleich mit lib/hund-verstehen-pdf.ts)
function breedFileName(k: string): string {
  const m: Record<string, string> = {
    labrador: "Labrador-Retriever.jpg", "labrador retriever": "Labrador-Retriever.jpg", "labrador-mix": "Labrador-Retriever.jpg",
    "golden retriever": "Golden-Retriever.jpg", "deutscher schäferhund": "German-Shepard.jpg",
    schäferhund: "German-Shepard.jpg", "german shepherd": "German-Shepard.jpg",
    "australian shepherd": "Australian-Shepherd.jpg", aussie: "Australian-Shepherd.jpg",
    "border collie": "Border-Collie.jpg", dackel: "Dackel.jpg", goldendoodle: "Goldendoodle.jpg",
    havaneser: "Havanese.jpg", havanese: "Havanese.jpg", mischling: "Mischling.jpg",
  };
  const lk = k.trim().toLowerCase();
  if (m[lk]) return m[lk];
  for (const key of Object.keys(m)) if (lk.includes(key)) return m[key];
  return "Allgemein.jpg";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const WORKER_TOKEN = (process.env.WORKER_TOKEN || "").trim();
const ALLOWED_IMG = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_FRAMES = 8;

function htmlBody(dogName: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
    <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:14px;padding:24px">
      <h1 style="font-size:22px;margin:0 0 6px;color:#1a1a1a">Deine persönliche Analyse für ${dogName}</h1>
      <p style="font-size:14px;color:#666;margin:10px 0 0;line-height:1.55">Im Anhang findest du deine individuelle Premium-Analyse: was hinter ${dogName}s Verhalten steckt, warum es bisher nicht klappte und dein konkreter Maßnahmen-Plan Schritt für Schritt. Nimm dir in Ruhe Zeit dafür.</p>
    </div>
  </div>`;
}

const SCHEMA = `{
  "summary": "1-2 prägnante Sätze als KERN-BEFUND fürs Deckblatt: die zentrale Erkenntnis über das WESEN/die Ursache dieses Hundes auf den Punkt.",
  "intro": "Abschnitt 1 'Das verstehe ich aus deiner Schilderung': spiegle die Schilderung konkret zurück (zitiere ruhig eine Formulierung des Halters) und greife das Halter-Gefühl einfühlsam auf. 2-4 Sätze. Absätze mit \\n\\n erlaubt.",
  "wishAnswer": "Wenn der Halter einen Freitext-Wunsch geäußert hat (das möchte ich über meinen Hund verstehen): beantworte ihn hier persönlich und direkt, 2-4 Sätze. Sonst null.",
  "diagnosis": "Abschnitt 'Die wahrscheinliche Ursache': benenne die WAHRSCHEINLICHE Ursache hinter dem Verhalten (Erklärung, nicht Symptom), fundiert + laienverständlich. AUSFÜHRLICH, mehrere Absätze (\\n\\n). VERSTEHEN, nicht trainieren.",
  "distanceNote": "1-2 Sätze zur Reizschwelle/zum Sicherheitsabstand dieses Hundes (ab welcher Nähe wird er unruhig) - rein erklärend. null wenn nicht relevant.",
  "breedHeritage": "Abschnitt 'Rasse, Herkunft & Erbe': erkläre AUSFÜHRLICH: wofür die Rasse ursprünglich gezüchtet wurde, woher sie historisch abstammt, Arbeitslinie vs. Showlinie (was das für DIESEN Hund bedeutet), das genetische Erbe (warum er tickt wie er tickt), und wie sich das ursprüngliche Aufgabenprofil heute im Wohnzimmer/Alltag zeigt. Konkret auf diesen Hund. Mehrere Absätze (\\n\\n). Mischling/unbekannt: über die wahrscheinlichen Anteile.",
  "healthTopics": ["3-5 RASSETYPISCHE Gesundheits-/Körper-Themen, auf die man achten sollte (z.B. Aussie: MDR1-Gendefekt, Augen/CEA, Gelenke/HD). Je 1-2 Sätze, informativ. Bei Mischling: allgemeiner/nach wahrscheinlichen Anteilen."],
  "healthBodyCondition": "Idealgewicht / Body-Condition-Einordnung passend zu Rasse, Größe, Gewicht und Alter dieses Hundes. Laienverständlich, informativ, keine Diagnose. 2-3 Sätze.",
  "healthNutrition": "Ernährungs-Check passend zu Alter, Gewicht und Aktivität dieses Hundes (Energiebedarf, worauf achten). Informativ, 2-4 Sätze.",
  "healthMedicalNote": "Wann das Verhalten medizinisch abzuklären ist - Schmerz/Erkrankung als versteckte Ursache. 1-2 Sätze.",
  "personalityTypeName": "ein einprägsamer, wohlwollender Archetyp-NAME für GENAU diesen Hund, mit Artikel, 2-4 Wörter (z.B. 'Der sensible Frühwarner', 'Der reizoffene Arbeiter', 'Die wachsame Diplomatin'). Individuell, nicht rein rassetypisch.",
  "personalityType": "kurzes beschreibendes Wesens-Label dieses Hundes, 2-4 Wörter (z.B. 'sensibel-reaktiv', 'souverän-eigenständig').",
  "personalityText": "Persönlichkeitsprofil: beschreibe das Wesen dieses Hundes konkret und ausführlich, mehrere Absätze (\\n\\n). Greife die drei Achsen-Werte unten erklärend auf (warum er reizoffen ist, warum er schnell/langsam hochfährt, woher sein Selbstvertrauen kommt).",
  "axisReizoffen": "Zahl 0.0-1.0: wie reizoffen ist dieser Hund (0 = sehr gelassen/abgeklärt, 1 = nimmt jeden Reiz sofort auf).",
  "axisTempo": "Zahl 0.0-1.0: sein Grundtempo/wie schnell er hochfährt (0 = tiefenentspannt, 1 = sofort hochgefahren). Richte dich nach dem angegebenen Aufdreh-Tempo, falls vorhanden.",
  "axisSelbstvertrauen": "Zahl 0.0-1.0: sein Selbstvertrauen (0 = unsicher/ängstlich, 1 = souverän/selbstsicher).",
  "personalityStress": "Stresslevel-Einschätzung dieses Hundes + konkret, was ihn runterbringt (greife auf, was der Halter als beruhigend angegeben hat). 2-4 Sätze.",
  "personalityBond": "Bindungstyp zwischen Hund und Halter (z.B. sicher gebunden, überanhänglich, unsicher) und was das bedeutet. 2-3 Sätze.",
  "lifePhaseNow": "die aktuelle Lebensphase, GENAU EINES dieser Wörter: Welpe, Junghund, Reife, Erwachsen, Senior. MUSS zum lifePhaseText passen (keine Widersprüche). Orientierung am Alter: Welpe bis ~5 Mon, Junghund ~5-18 Mon, Reife/Adoleszenz ~1,5-3 J, Erwachsen ~3-7 J, Senior ab ~7-8 J (große Rassen früher). Im Zweifel die JÜNGERE Phase wählen.",
  "lifePhaseText": "Wo steht dieser Hund gerade entwicklungspsychologisch und was bedeutet das. Konsistent mit lifePhaseNow. 2-4 Sätze.",
  "lifePhaseAhead": "Was sich in den nächsten 1-3 Jahren verändert (körperlich/im Verhalten). 2-3 Sätze.",
  "socialBehavior": "Abschnitt 'Sozialverhalten & Verträglichkeit': wie sich der Hund gegenüber anderen Hunden, fremden Menschen, Kindern und (falls relevant) Katzen/Kleintieren verhält, WARUM, und was das im Alltag bedeutet. Nutze die angegebene Verträglichkeit. Mehrere Absätze (\\n\\n).",
  "bodyLanguageIntro": "1-2 Sätze: warum es hilft, diesen Hund früh zu lesen.",
  "bodyLanguageSignals": [{"signal":"konkretes Körpersprache-Signal (z.B. 'Fixieren / starrer Blick')","meaning":"was es bei diesem Hund bedeutet, 1-2 Sätze - ERKLÄREND, kein Trainingsbefehl"}],
  "dailyNeeds": "Abschnitt 'Was dein Hund im Alltag wirklich braucht': die Kopf/Körper/Ruhe-Balance konkret für diesen Hund erklärt (warum gerade diese Mischung). Mehrere Absätze (\\n\\n).",
  "needsKopf": 40,
  "needsKoerper": 35,
  "needsRuhe": 25,
  "whyFailed": "Abschnitt 'Warum es bisher nicht geklappt hat': warum generische Tipps in DIESEM Fall scheiterten - aus Verständnis-Sicht (z.B. weil die Ursache nicht adressiert wurde). 2-4 Sätze.",
  "planBridge": "Abschnitt 'So verbindest du das mit deinem Training': der Halter hat BEREITS einen konkreten Schritt-für-Schritt-Trainingsplan. Erkläre, wie dieses Verständnis seinen bestehenden Plan STÄRKER macht (z.B. 'wenn du im Plan X übst, weißt du jetzt warum...'). Gib KEINE neuen, eigenen Übungs-Anweisungen, die dem Plan widersprechen könnten. Verweise positiv auf den bestehenden Trainingsplan. 2-4 Sätze.",
  "faq": [{"q":"eine konkrete Frage, die sich dieser Halter stellt","a":"klare, fundierte Antwort, 2-4 Sätze"}],
  "vision": "Abschnitt '[Hund] in einem Jahr': ein warmer, konkreter, emotionaler Ausblick - wie sich der Hund und der Alltag in ~12 Monaten anfühlen, wenn der Halter dieses Verständnis mit seinem bestehenden Trainingsplan verbindet. Motivierend und ehrlich (kein Wunderversprechen), KEINE Übungsanweisungen. 1-2 Absätze (\\n\\n).",
  "closing": "Abschnitt 'Ein ehrliches Wort': warm, ehrlich, ermutigend, auf Augenhöhe, greife auch das Halter-Gefühl auf. 2-4 Sätze.",
  "photoObservation": null,
  "dangerNote": null
}

ALLE Felder sind FLACH auf oberster Ebene - verschachtle NICHTS und erfinde keine Punkt-Keys wie 'personality.axes'. ARRAY-VORGABEN: "healthTopics" 3-5 Einträge. "bodyLanguageSignals" 5-7 Einträge. "faq" 5-6 Fragen (individuell, decke Rasse/Gesundheit/Persönlichkeit/Alltag ab - NICHT konkrete Trainingsanleitungen). Die drei Achsen-Werte (axisReizoffen, axisTempo, axisSelbstvertrauen) sind einzelne Dezimalzahlen 0.0-1.0. needsKopf+needsKoerper+needsRuhe sind Zahlen, die zusammen ungefähr 100 ergeben.`;
const NEEDS_DEFAULT = { kopf: 40, koerper: 35, ruhe: 25 };

export async function POST(request: Request) {
  try {
    const auth = request.headers.get("authorization") || "";
    const token = (auth.match(/^Bearer\s+(.+)$/i)?.[1] || auth).trim();
    if (!WORKER_TOKEN || token !== WORKER_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY fehlt" }, { status: 500 });
    if (!BREVO_API_KEY) return NextResponse.json({ error: "BREVO_API_KEY fehlt" }, { status: 500 });

    const body = await request.json();
    const email = String(body?.email || "").trim();
    if (!email) return NextResponse.json({ error: "email fehlt" }, { status: 400 });

    const dogName = String(body?.dogName || "dein Hund").slice(0, 40);
    const breed = body?.breed ? String(body.breed) : null;
    const age = body?.age ? String(body.age) : null;
    const problem = body?.problem ? String(body.problem) : null;
    const transcript = String(body?.transcript || "").trim();
    const hadTraining = body?.hadTraining ? String(body.hadTraining) : null;
    const goal = body?.goal ? String(body.goal) : null;
    const commands: string[] = Array.isArray(body?.commands) ? body.commands.slice(0, 8).map((c: any) => String(c)) : [];

    // Erweiterte Premium-Intake-Felder (machen die Analyse fachlich schärfer)
    const gender = body?.gender ? String(body.gender) : null;          // Rüde / Hündin
    const neutered = body?.neutered ? String(body.neutered) : null;    // kastriert / intakt
    const weight = body?.weight ? String(body.weight) : null;          // z.B. "30 kg" / "groß"
    const origin = body?.origin ? String(body.origin) : null;          // Züchter / Tierschutz / Auslandstierschutz / Wurf / unbekannt
    const ownedSince = body?.ownedSince ? String(body.ownedSince) : null;
    const health = body?.health ? String(body.health) : null;          // nein / unklar / ja: Beschreibung
    const activity = body?.activity ? String(body.activity) : null;    // wenig / mittel / viel
    const compatibility: string[] = Array.isArray(body?.compatibility)
      ? body.compatibility.slice(0, 6).map((c: any) => String(c))
      : (body?.compatibility ? [String(body.compatibility)] : []);

    // NEUE Premium-Quiz-Abfragen (Daten, die der Trainingsplan NICHT hatte -> echtes "nur hier")
    const arousalSpeed = body?.arousalSpeed != null && body?.arousalSpeed !== "" ? String(body.arousalSpeed) : null; // Slider: tiefenentspannt -> sofort hochgefahren
    const calms: string[] = Array.isArray(body?.calms) ? body.calms.slice(0, 4).map((c: any) => String(c)) : (body?.calms ? [String(body.calms)] : []); // Kauen/Schnüffeln/Körperkontakt/Rückzug
    const ownerFeeling = body?.ownerFeeling ? String(body.ownerFeeling) : null; // genervt/hilflos/besorgt/hoffnungsvoll
    const understandWish = body?.understandWish ? String(body.understandWish).slice(0, 400) : null; // Freitext-Wunsch

    // Foto/Video-Frames (optional)
    const photos: { base64: string; type: string }[] = [];
    if (Array.isArray(body?.photos)) {
      for (const ph of body.photos.slice(0, MAX_FRAMES)) {
        const t = String(ph?.type || "");
        if (ph?.base64 && ALLOWED_IMG.has(t)) photos.push({ base64: String(ph.base64), type: t });
      }
    }

    if (!transcript && photos.length === 0) {
      return NextResponse.json({ error: "transcript oder photos erforderlich" }, { status: 400 });
    }

    const hasMedia = photos.length > 0;
    const system = `Du bist ein erfahrener, zertifizierter Hundetrainer und Verhaltensexperte und erstellst eine PREMIUM-VERSTÄNDNIS-ANALYSE (Wert 79 EUR) auf Basis der persönlichen Schilderung eines Halters${hasMedia ? " und beigefügter Bilder/Video-Frames seines Hundes" : ""}. Das ist ein TIEFES VERSTÄNDNIS-GUTACHTEN über GENAU diesen Hund - es erklärt, WER dieser Hund ist und WARUM er so tickt (Ursache, Rasse & Herkunft, Gesundheit & Körper, Persönlichkeit & Psyche, Lebensphase, Sozialverhalten, Körpersprache, Alltags-Balance).

ABGRENZUNG ZUM TRAININGSPLAN (sehr wichtig):
- Der Halter besitzt BEREITS einen konkreten, schrittweisen Trainingsplan zu seinem Hauptthema. Diese Analyse ist KEIN zweiter Trainingsplan und KEINE Übungssammlung.
- Gib daher KEINE eigenen, detaillierten Schritt-für-Schritt-Übungsanweisungen ("Übung 1: mache X für 10 Minuten"), die dem bestehenden Plan widersprechen könnten. Der Fokus liegt auf VERSTEHEN, nicht auf Trainings-Anleitung.
- Wo es ums "Was tun" geht, bleibe auf Prinzip-/Verständnis-Ebene und verweise im Abschnitt "planBridge" positiv darauf, dass der Trainingsplan die konkreten Übungen liefert und dieses Verständnis ihn wirksamer macht.

AUSFÜHRLICHKEIT (wichtig): Schreibe jeden Abschnitt fachlich tief und ausführlich aus - gedruckt soll das Gutachten ca. 12-14 Seiten ergeben. Die längeren Abschnitte (diagnosis, breedHeritage, personality.text, socialBehavior, dailyNeeds) jeweils 3-5 Absätze. Lieber ein gut erklärter Gedanke mehr als knappe Stichworte. Bleibe dabei konkret auf DIESEN Hund bezogen, keine Floskeln und keine Füllsätze.

INDIVIDUALISIERUNG (zentral - dafür zahlt der Kunde 79 EUR): Es soll sich anlesen wie "das ist genau MEIN Hund", NICHT wie "das ist halt ein [Rasse]". Verarbeite die zusätzlichen, persönlichen Quiz-Daten konkret und sichtbar - besonders in Kapitel 4-6 (Rasse, Gesundheit, Persönlichkeit, Lebensphase):
- Aufdreh-Tempo (Slider): bestimmt direkt den Wert "axisTempo" und den Stress-Abschnitt. Beziehe dich darauf ("Du beschreibst, dass er sehr schnell hochfährt...").
- Beruhigt sich durch (Kauen/Schnüffeln/Körperkontakt/Rückzug): nimm GENAU das im Stress-Abschnitt ("personalityStress") auf ("Was ihm hilft - und das hast du selbst beobachtet - ist...").
- Halter-Gefühl (genervt/hilflos/besorgt/hoffnungsvoll): greife das einfühlsam in "intro" UND "closing" auf, sprich den Menschen an, nicht nur den Hund.
- Wenn ein Freitext-Wunsch ("das möchte ich verstehen") vorhanden ist: beantworte ihn persönlich und direkt im Feld "wishAnswer" (2-4 Sätze, sprich die Frage konkret an). Sonst "wishAnswer": null.
Wo persönliche Daten fehlen, bleib ehrlich allgemein - erfinde nichts.

PREMIUM-"NUR-HIER"-ELEMENTE:
- "personalityTypeName": vergib diesem konkreten Hund einen einprägsamen, wohlwollenden Archetyp-NAMEN (mit Artikel, 2-4 Wörter), der sein Wesen auf den Punkt bringt, z.B. "Der sensible Frühwarner", "Der reizoffene Arbeiter", "Die wachsame Diplomatin". Individuell, nicht rein rassetypisch.
- "vision": ein warmer, konkreter, emotionaler Ausblick "[Hund] in einem Jahr" - male ein realistisches Bild, wie sich der Hund und der Alltag in ~12 Monaten anfühlen, wenn der Halter dieses Verständnis mit seinem Trainingsplan verbindet. Motivierend, ehrlich (kein Wunderversprechen), 1-2 Absätze. KEINE Übungsanweisungen.

ANSPRUCH:
- Hochprofessionell, präzise, fundiert (Verhaltensbiologie/Genetik/Entwicklungsphasen korrekt, aber laienverständlich).
- ERKLÄREND: benenne die WAHRSCHEINLICHE URSACHE hinter dem Verhalten, nicht nur das Symptom. Beziehe dich konkret auf die Schilderung ("Du beschreibst, dass...").
- Ehrlich, warm, auf Augenhöhe. Du-Ansprache. Deutsch. Keine Markdown-Sterne, keine langen Gedankenstriche.
- Nutze die zusätzlichen Hunde-Daten, wo relevant: Geschlecht/Kastration (hormoneller Einfluss), Herkunft (Vorgeschichte, Arbeits- vs. Showlinie, z.B. Auslandstierschutz = Prägungs-/Vertrauensthema), Auslastung (Unterforderung), Verträglichkeit, Gewicht/Größe (Körper/Gesundheit), Alter (Lebensphase). Erfinde nichts dazu, was nicht in den Daten steht.
- "health" ist REIN INFORMATIV und KEINE Diagnose. Nenne rassetypische Themen seriös und ohne Panikmache.
- Wenn gesundheitliche Hinweise/Schmerzen genannt oder als "unklar" markiert sind: weise klar darauf hin, Schmerzen/Erkrankung tierärztlich abklären zu lassen (medizinische Ursachen ausschließen, bevor man am Verhalten arbeitet).
${hasMedia ? `- Es sind Bilder/Frames beigefügt. Fülle "photoObservation": 2-4 Sätze, was du an Körpersprache/Haltung/Ausdruck/Körperbau SIEHST und was es für die Analyse bedeutet. Sei ehrlich, wenn etwas nicht eindeutig erkennbar ist.` : `- Keine Bilder vorhanden: setze "photoObservation" auf null.`}
- "dangerNote": NUR bei echter Gefahr (z.B. zugeschnappt/gebissen, ernste Aggression mit Verletzungsrisiko) → 1-2 Sätze, dass hier zusätzlich professionelle Begleitung vor Ort ratsam ist. Sonst: null.

UMLAUTE (zwingend): Schreibe alle deutschen Umlaute als echte Zeichen ä ö ü Ä Ö Ü und ß. Verwende AUF KEINEN FALL die Ersatz-Schreibweisen ae/oe/ue/Ae/Oe/Ue/ss. Richtig: "Schäferhund", "Verträglichkeit", "Körpersprache", "für", "müssen". Falsch: "Schaeferhund", "Vertraeglichkeit", "Koerpersprache", "fuer", "muessen". JSON erlaubt diese Zeichen direkt.
"axisReizoffen"/"axisTempo"/"axisSelbstvertrauen": je eine Dezimalzahl zwischen 0.0 und 1.0. "lifePhaseNow": exakt eines von Welpe/Junghund/Reife/Erwachsen/Senior, passend zum Alter und zum lifePhaseText.

WICHTIG für valides JSON: Verwende INNERHALB der Text-Werte NIEMALS gerade Anführungszeichen ("). Wenn du etwas zitierst, nutze einfache Anführungszeichen (') oder schreibe es ohne Anführungszeichen. Keine Zeilenumbrüche außer als \\n.

Gib AUSSCHLIESSLICH gültiges JSON in genau dieser Struktur zurück (Beschreibungen durch echte Inhalte ersetzen):
${SCHEMA}`;

    const dataLines = [
      `Name: ${dogName}`,
      breed ? `Rasse: ${breed}` : null,
      age ? `Alter: ${age}` : null,
      problem ? `Hauptthema (Quiz): ${problem}` : null,
      gender ? `Geschlecht: ${gender}${neutered ? ` (${neutered})` : ""}` : (neutered ? `Kastration: ${neutered}` : null),
      weight ? `Gewicht/Größe: ${weight}` : null,
      origin ? `Herkunft: ${origin}` : null,
      ownedSince ? `Bei mir seit: ${ownedSince}` : null,
      health ? `Gesundheit/Schmerzen: ${health}` : null,
      activity ? `Auslastung (Bewegung + Kopfarbeit): ${activity}` : null,
      compatibility.length ? `Verträglichkeit: ${compatibility.join(", ")}` : null,
      arousalSpeed ? `Aufdreh-Tempo (Slider tiefenentspannt..sofort hochgefahren): ${arousalSpeed}` : null,
      calms.length ? `Beruhigt sich am besten durch: ${calms.join(", ")}` : null,
      ownerFeeling ? `So fühlt sich der Halter bei dem Thema: ${ownerFeeling}` : null,
      understandWish ? `Das möchte der Halter am liebsten über seinen Hund verstehen: "${understandWish}"` : null,
      hadTraining ? `Trainingsstand: ${hadTraining}` : null,
      commands.length ? `Kann schon: ${commands.join(", ")}` : null,
      goal ? `Ziel: ${goal}` : null,
    ].filter(Boolean).join("\n");

    const userText =
      (transcript ? `Persönliche Schilderung des Halters${hasMedia ? "" : " (transkribiert)"}:\n"${transcript}"\n\n` : "") +
      `Quiz-Daten:\n${dataLines}`;

    const userContent: any[] = [{ type: "text", text: userText }];
    for (const ph of photos) {
      userContent.push({ type: "image", source: { type: "base64", media_type: ph.type, data: ph.base64 } });
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const resp = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 14000,
      system,
      messages: [{ role: "user", content: userContent }],
    });
    const raw = resp.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();

    let content: PremiumAnalyseContent;
    try {
      const j = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
      const pp = JSON.parse(j);
      const clamp01 = (v: any, d: number) => { const n = Number(v); return isNaN(n) ? d : Math.max(0, Math.min(1, n > 1 ? n / 10 : n)); };
      // Drei FESTE Typ-Achsen (Wiedererkennungswert) - Modell liefert nur die Positionen.
      const axes = [
        { label: "Reizoffenheit", left: "gelassen", right: "reizoffen", pos: clamp01(pp.axisReizoffen, 0.5) },
        { label: "Grundtempo", left: "tiefenentspannt", right: "schnell hochgefahren", pos: clamp01(pp.axisTempo, 0.5) },
        { label: "Selbstvertrauen", left: "unsicher", right: "souverän", pos: clamp01(pp.axisSelbstvertrauen, 0.5) },
      ];
      content = {
        summary: String(pp.summary || ""),
        intro: String(pp.intro || ""),
        wishAnswer: pp.wishAnswer ? String(pp.wishAnswer) : null,
        diagnosis: String(pp.diagnosis || ""),
        distanceNote: pp.distanceNote ? String(pp.distanceNote) : null,
        breedHeritage: String(pp.breedHeritage || ""),
        health: {
          topics: Array.isArray(pp.healthTopics) ? pp.healthTopics.slice(0, 6).map((x: any) => String(x)) : [],
          bodyCondition: String(pp.healthBodyCondition || ""),
          nutrition: String(pp.healthNutrition || ""),
          medicalNote: String(pp.healthMedicalNote || ""),
        },
        personality: {
          typeName: String(pp.personalityTypeName || ""),
          type: String(pp.personalityType || ""),
          text: String(pp.personalityText || ""),
          stress: String(pp.personalityStress || ""),
          bond: String(pp.personalityBond || ""),
          axes,
        },
        lifePhase: { now: String(pp.lifePhaseNow || ""), text: String(pp.lifePhaseText || ""), ahead: String(pp.lifePhaseAhead || "") },
        socialBehavior: String(pp.socialBehavior || ""),
        bodyLanguageIntro: String(pp.bodyLanguageIntro || ""),
        bodyLanguageSignals: Array.isArray(pp.bodyLanguageSignals) ? pp.bodyLanguageSignals.slice(0, 8).map((s: any) => ({ signal: String(s.signal || ""), meaning: String(s.meaning || "") })) : [],
        dailyNeeds: String(pp.dailyNeeds || ""),
        needsBalance: {
          kopf: Number(pp.needsKopf) || NEEDS_DEFAULT.kopf,
          koerper: Number(pp.needsKoerper) || NEEDS_DEFAULT.koerper,
          ruhe: Number(pp.needsRuhe) || NEEDS_DEFAULT.ruhe,
        },
        whyFailed: String(pp.whyFailed || ""),
        planBridge: String(pp.planBridge || ""),
        vision: String(pp.vision || ""),
        faq: Array.isArray(pp.faq) ? pp.faq.slice(0, 6).map((f: any) => ({ q: String(f.q || ""), a: String(f.a || "") })) : [],
        closing: String(pp.closing || ""),
        photoObservation: pp.photoObservation ? String(pp.photoObservation) : null,
        dangerNote: pp.dangerNote ? String(pp.dangerNote) : null,
      };
    } catch (e: any) {
      console.error("[premium-analyse] JSON parse failed:", e?.message);
      return NextResponse.json({ error: "content_generation_failed" }, { status: 500 });
    }

    // Profil-Karte ("auf einen Blick") aus den Intake-Daten
    const facts: { label: string; value: string }[] = [
      breed ? { label: "Rasse", value: breed } : null,
      age ? { label: "Alter", value: age } : null,
      gender ? { label: "Geschlecht", value: `${gender}${neutered ? `, ${neutered}` : ""}` } : (neutered ? { label: "Kastration", value: neutered } : null),
      weight ? { label: "Gewicht / Größe", value: weight } : null,
      origin ? { label: "Herkunft", value: origin } : null,
      ownedSince ? { label: "Bei dir seit", value: ownedSince } : null,
      activity ? { label: "Auslastung", value: activity } : null,
      calms.length ? { label: "Beruhigt sich am besten durch", value: calms.join(", ") } : null,
      compatibility.length ? { label: "Verträglichkeit", value: compatibility.join(", ") } : null,
      health ? { label: "Gesundheit", value: health } : null,
      problem ? { label: "Hauptthema", value: problem } : null,
    ].filter(Boolean) as { label: string; value: string }[];

    // Deckblatt-Bild: bevorzugt das Kundenfoto, sonst das Rasse-Bild als Fallback.
    let coverImage: { bytes: Uint8Array; type: string } | null = null;
    if (photos.length && photos[0].base64) {
      try { coverImage = { bytes: new Uint8Array(Buffer.from(photos[0].base64, "base64")), type: photos[0].type }; } catch { coverImage = null; }
    }
    if (!coverImage) {
      try {
        const ip = join(process.cwd(), "public", "breeds", breedFileName(breed || "mischling"));
        if (existsSync(ip)) coverImage = { bytes: new Uint8Array(readFileSync(ip)), type: "image/jpeg" };
      } catch { coverImage = null; }
    }

    const pdfBytes = await buildPremiumAnalysePDF({ dogName, breed, age, problemLabel: problem, facts, coverImage, wishQuestion: understandWish, content });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    const fileName = `Analyse-${dogName.replace(/\s+/g, "-")}.pdf`;
    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
        to: [{ email }],
        cc: [{ email: "kontakt@primesocial.de" }],
        subject: `Deine persönliche Analyse für ${dogName}`,
        htmlContent: htmlBody(dogName),
        attachment: [{ name: fileName, content: pdfBase64 }],
      }),
    });
    if (!brevoRes.ok) {
      const t = await brevoRes.text();
      console.error("[premium-analyse] Brevo error:", brevoRes.status, t);
      return NextResponse.json({ error: "mail_failed", detail: t.slice(0, 200) }, { status: 502 });
    }

    console.log(`[premium-analyse] PDF an ${email} (${dogName}, frames=${photos.length})`);
    return NextResponse.json({ ok: true, pdf_bytes: pdfBytes.length, with_media: hasMedia });
  } catch (err: any) {
    console.error("[premium-analyse] error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Interner Fehler" }, { status: 500 });
  }
}
