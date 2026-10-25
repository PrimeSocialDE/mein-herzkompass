// Klassifiziert eine eingehende Support-Mail und formuliert (bei Bedarf) die
// Antwort. Wird vom Support-Autoresponder-Cron benutzt.
//
// Entscheidungen:
//  - WIDERRUF bekommt IMMER die feste Vorlage (nie von der KI umformuliert),
//    personalisiert mit Vorname + Hundename aus dem Lead.
//  - "Plan/Code nicht angekommen" → Aktion resend_plan (nur bei bezahltem Lead).
//  - Sonstige Fragen → individuelle KI-Antwort.
//  - "heikel" (wütend, rechtlich, Zahlungskonflikt/Chargeback, Betrags-
//    beschwerde, unklar) → bleibt IMMER Entwurf zur manuellen Freigabe,
//    auch im Live-Modus.

const TRIAGE_MODEL = "claude-opus-4-8";

export type SupportCategory =
  | "widerruf"
  | "plankorrektur"
  | "plan_fehlt"
  | "frage"
  | "rechnung"
  | "sonstiges";
export type SupportAction = "plan_neu_senden" | "keine";

export interface TriageLeadContext {
  found: boolean;
  vorname: string;
  hundename: string;
  bezahlt: boolean;
  plan: string;        // z.B. "6 Monate"
  planGesendet: boolean;
}

export interface TriageResult {
  kategorie: SupportCategory;
  heikel: boolean;
  aktion: SupportAction;
  antwort: string;
  kurz: string;
  /** false = keine Antwort schicken (Abwesenheitsnotiz, reines Danke/Bestätigung, Werbung …) */
  antwortNoetig: boolean;
}

/**
 * Harte Erkennung automatischer Antworten (Abwesenheit/Urlaub/Ferien, Autoreply,
 * Zustellfehler). Darauf antworten wir NIE — sonst entsteht eine Mail-Schleife
 * (25.10.2026: vier Antworten auf eine Ferienabwesenheit).
 */
export function istAutoAntwort(subject: string, text: string): boolean {
  const betreff = String(subject || "").toLowerCase();
  const kopf = String(text || "").slice(0, 600).toLowerCase();
  if (/(abwesenheit|out of office|automatische antwort|automatic reply|auto-?reply|autoreply|abwesend|urlaubsabwesenheit|ferienabwesenheit|not in the office|im urlaub|in den ferien|delivery status|unzustellbar|undeliverable|mail delivery)/.test(betreff)) return true;
  // Im Text nur, wenn keine Frage drinsteht (echte Kunden fragen etwas, Autoreplies nicht).
  if (String(text || "").includes("?")) return false;
  return /(bin (bis|vom|ab) .{0,40}(nicht im büro|abwesend|nicht erreichbar|im urlaub|in den ferien)|bin derzeit (nicht im büro|abwesend|im urlaub|nicht erreichbar)|ich bin (zur zeit|zurzeit|momentan|aktuell) (nicht im büro|abwesend|im urlaub|in den ferien|nicht erreichbar)|erholungszeit|diese e-?mail wird (nicht|weder) .{0,30}(gelesen|weitergeleitet)|automatisch generiert|this is an automatic)/.test(kopf);
}

/** Feste Widerruf-Vorlage (von Max vorgegeben, Fassung 19.10.2026). */
export function widerrufTemplate(vorname: string, _hundename?: string): string {
  const anrede = vorname ? `Hallo ${vorname},` : "Hallo,";
  return `${anrede}

vielen Dank für deine Nachricht.

Bevor wir die Rückerstattung einleiten, würden wir dir gerne die Möglichkeit geben, deinen PfotenPlan kostenfrei individuell anzupassen.

Beschreibe uns dafür bitte kurz in 3–4 Sätzen, was genau bei deinem Hund aktuell nicht funktioniert, welche Probleme ihr im Alltag habt und was du dir vom Training gewünscht hättest. Auf dieser Grundlage erstellen wir dir kostenlos einen individuellen Zusatzplan mit passenden Übungen.

Sollte dir dieser ebenfalls nicht weiterhelfen, kannst du natürlich weiterhin unsere 30-Tage-Geld-zurück-Garantie in Anspruch nehmen.

Liebe Grüße
Dein PfotenPlan-Team`;
}

function fallbackReply(vorname: string): string {
  const anrede = vorname ? `Hallo ${vorname},` : "Hallo,";
  return `${anrede}

vielen Dank für deine Nachricht — wir kümmern uns darum und melden uns gleich persönlich bei dir.

Viele Grüße
Dein Pfotenplan-Team`;
}

const SYSTEM = `Du bist der Support-Assistent von Pfoten-Plan, einem deutschen Anbieter für personalisierte Hunde-Trainingspläne (PDF nach Kauf, plus Mitglieder-Bereich mit KI-Trainer). Du bearbeitest eine eingehende Kundenmail an support@pfoten-plan.de.

Deine Aufgabe: die Mail einordnen und – außer bei Widerruf – eine fertige, individuelle Antwort schreiben.

KATEGORIEN:
- "widerruf": Kunde will widerrufen / Geld zurück / stornieren / "passt nicht, will zurück".
- "plankorrektur": Kunde HAT den Plan, aber er passt nicht — sein eigentliches Problem kommt nicht vor, die Übungen kann der Hund längst, Rasse/Alter/Situation passen nicht. Er will eine Anpassung, ausdrücklich KEIN Geld zurück.
- "plan_fehlt": Kunde hat bezahlt, aber Plan / PDF / Zugang / Login-Code nicht bekommen bzw. findet ihn nicht.
- "rechnung": Kunde möchte eine Rechnung / Beleg.
- "frage": inhaltliche oder technische Frage (zu einer Übung, zum Ablauf, zum Mitglieder-Bereich usw.).
- "sonstiges": alles andere.

"heikel" = true, wenn der Fall besser von einem Menschen geprüft wird: verärgerter/drohender Ton, rechtliche Androhung, Zahlungskonflikt/Chargeback/PayPal-Käuferschutz, Beschwerde über eine Abbuchung/Betrag, Verdacht auf Doppelbuchung, oder wenn das Anliegen unklar ist. Im Zweifel true.

"aktion":
- "plan_neu_senden" NUR wenn Kategorie "plan_fehlt" UND der Kunde laut Kontext bezahlt hat. Sonst "keine".

ANTWORT-STIL (Feld "antwort"): Deutsch, per "Du", warm und persönlich, einfache kurze Sätze (viele Kundinnen sind ältere Menschen). Geh konkret auf das Anliegen ein. Nichts erfinden — keine Beträge, Fristen oder Fakten behaupten, die nicht im Kontext stehen. Unterschrift immer:
"Viele Grüße
Dein Pfotenplan-Team"
Bei Kategorie "widerruf" kannst du das Feld "antwort" leer lassen (die Vorlage wird separat eingesetzt).
Bei "plan_fehlt" mit Aktion plan_neu_senden: schreib, dass der Plan gerade erneut verschickt wurde und in wenigen Minuten im Postfach (ggf. Spam-Ordner prüfen) ankommt.
Bei "plankorrektur": nimm das Anliegen ernst, entschuldige dich kurz dafür, dass der Plan danebenlag, und bitte um 3 bis 4 Sätze, wo genau es gerade hakt — daraus wird kostenlos ein individuelles Zusatzmodul erstellt. Biete von dir aus KEINE Rückerstattung an.

"antwort_noetig" = false, wenn auf die Mail keine Antwort nötig ist und eine Antwort eher stören würde: automatische Abwesenheits-/Urlaubs-/Ferienmeldungen, Autoreplies, Zustellfehler, Newsletter/Werbung/Spam, reine Dank- oder Bestätigungsmails ohne Frage oder Bitte (z. B. "Danke, jetzt klappt es", "alles gut", "wir fangen nächste Woche an"). Sonst true. Bei "widerruf", "plan_fehlt" und "plankorrektur" immer true.

Antworte mit EXAKT EINEM JSON-Objekt, keine Markdown-Fences:
{"kategorie": "...", "heikel": true/false, "aktion": "plan_neu_senden|keine", "antwort_noetig": true/false, "antwort": "...", "kurz": "worum es in einem Satz geht"}`;

export async function triageInbound(
  mail: { fromEmail: string; fromName: string; subject: string; text: string },
  lead: TriageLeadContext
): Promise<TriageResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const kontext = [
    `Absender: ${mail.fromName || ""} <${mail.fromEmail}>`,
    `Betreff: ${mail.subject}`,
    lead.found
      ? `Kunde in DB: ja. Vorname: ${lead.vorname || "unbekannt"}. Hund: ${lead.hundename || "unbekannt"}. Bezahlt: ${lead.bezahlt ? "ja" : "nein"}. Plan: ${lead.plan || "unbekannt"}. Plan bereits ausgeliefert: ${lead.planGesendet ? "ja" : "nein"}.`
      : `Kunde in DB: NICHT gefunden (E-Mail unbekannt). Aktion daher immer "keine", "heikel" eher true.`,
    ``,
    `Nachricht des Kunden:`,
    mail.text || "(kein lesbarer Text)",
  ].join("\n");

  // Ohne API-Key: konservativer Fallback (alles Entwurf, nichts automatisch).
  if (!apiKey) {
    return {
      kategorie: "sonstiges",
      heikel: true,
      aktion: "keine",
      antwort: fallbackReply(lead.vorname),
      antwortNoetig: true,
      kurz: "API-Key fehlt – manuell prüfen",
    };
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: TRIAGE_MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: kontext }],
    });
    const rawText = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    const jsonStart = rawText.indexOf("{");
    const jsonEnd = rawText.lastIndexOf("}");
    const parsed = JSON.parse(
      jsonStart >= 0 && jsonEnd > jsonStart ? rawText.slice(jsonStart, jsonEnd + 1) : rawText
    );

    const kategorie: SupportCategory = [
      "widerruf",
      "plankorrektur",
      "plan_fehlt",
      "rechnung",
      "frage",
      "sonstiges",
    ].includes(
      parsed.kategorie
    )
      ? parsed.kategorie
      : "sonstiges";

    let aktion: SupportAction = parsed.aktion === "plan_neu_senden" ? "plan_neu_senden" : "keine";
    // Harte Sicherung: Aktion nur bei bekanntem, bezahltem Kunden + Kategorie plan_fehlt.
    if (!(kategorie === "plan_fehlt" && lead.found && lead.bezahlt)) aktion = "keine";

    // Widerruf → immer feste Vorlage.
    let antwort: string;
    if (kategorie === "widerruf") {
      antwort = widerrufTemplate(lead.vorname, lead.hundename);
    } else {
      antwort = typeof parsed.antwort === "string" && parsed.antwort.trim().length > 20
        ? parsed.antwort.trim()
        : fallbackReply(lead.vorname);
    }

    // Unbekannter Absender → immer heikel (nichts automatisch senden).
    const heikel = parsed.heikel === true || !lead.found;

    const antwortNoetig =
      ["widerruf", "plan_fehlt", "plankorrektur"].includes(kategorie) || parsed.antwort_noetig !== false;

    return {
      kategorie,
      heikel,
      aktion,
      antwort,
      kurz: typeof parsed.kurz === "string" ? parsed.kurz.slice(0, 200) : "",
      antwortNoetig,
    };
  } catch (e: any) {
    console.error("[support-triage] Fehler:", e?.message);
    return {
      kategorie: "sonstiges",
      heikel: true,
      aktion: "keine",
      antwort: fallbackReply(lead.vorname),
      antwortNoetig: true,
      kurz: "Triage-Fehler – manuell prüfen",
    };
  }
}

// ---------------------------------------------------------------------------
// Folgemail auf ein bereits versendetes Rettungsangebot
// ---------------------------------------------------------------------------
//
// Wenn bei einem Widerruf die Vorlage raus ist ("erst Zusatzmodul, sonst Geld
// zurück"), entscheidet die nächste Kundenmail über Geld bleibt oder Geld weg.
// Das ist eine viel engere Frage als die Erstklassifikation — und damit auch
// deutlich zuverlässiger zu beantworten.

export type FollowUpOutcome = "annahme" | "ablehnung" | "offen";

export interface FollowUpResult {
  ergebnis: FollowUpOutcome;
  antwort: string;
  kurz: string;
  heikel: boolean;
}

const FOLLOWUP_SYSTEM = `Du bist der Support-Assistent von Pfoten-Plan. Einem Kunden, der widerrufen wollte, haben wir angeboten: Er beschreibt uns in 3 bis 4 Sätzen, wo es hakt, und bekommt kostenlos ein individuelles Zusatzmodul — andernfalls erstatten wir im Rahmen der Geld-zurück-Garantie.

Jetzt liegt seine Antwort darauf vor. Ordne NUR ein, wie er sich entschieden hat.

ERGEBNIS:
- "annahme": Er will das Zusatzmodul (sagt zu, beschreibt sein Problem, fragt nach, zeigt Interesse).
- "ablehnung": Er besteht auf der Rückerstattung ("trotzdem zurücktreten", "will mein Geld", "keine Option", "bitte erstatten").
- "offen": Weder noch, unklar, oder es geht um etwas ganz anderes.

ANTWORT-STIL (Feld "antwort"): Deutsch, per "Du", warm, einfache kurze Sätze (viele Kundinnen sind ältere Menschen). Nichts erfinden — keine Beträge, Fristen oder Termine behaupten.
- Bei "annahme": bedanke dich, bestätige, dass das Zusatzmodul erstellt wird. Fehlt die Problembeschreibung noch, bitte um 3 bis 4 Sätze.
- Bei "ablehnung": akzeptiere die Entscheidung ohne weiteres Nachfassen, bestätige, dass die Erstattung veranlasst wird. KEINE Frist und KEINEN Betrag nennen.
- Bei "offen": geh freundlich auf das ein, was er schreibt.
Unterschrift immer:
"Viele Grüße
Dein Pfotenplan-Team"

Antworte mit EXAKT EINEM JSON-Objekt, keine Markdown-Fences:
{"ergebnis": "annahme|ablehnung|offen", "antwort": "...", "kurz": "worum es in einem Satz geht"}`;

export async function triageFollowUp(
  mail: { fromEmail: string; fromName: string; subject: string; text: string },
  lead: TriageLeadContext
): Promise<FollowUpResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ergebnis: "offen",
      antwort: fallbackReply(lead.vorname),
      kurz: "API-Key fehlt – manuell prüfen",
      heikel: true,
    };
  }

  const kontext = [
    `Kunde: ${lead.vorname || mail.fromName || mail.fromEmail}`,
    lead.hundename ? `Hund: ${lead.hundename}` : "",
    lead.plan ? `Gekaufter Plan: ${lead.plan}` : "",
    `Betreff: ${mail.subject}`,
    "",
    "Seine Antwort:",
    mail.text,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: TRIAGE_MODEL,
      max_tokens: 1200,
      system: FOLLOWUP_SYSTEM,
      messages: [{ role: "user", content: kontext }],
    });
    const rawText = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    const jsonStart = rawText.indexOf("{");
    const jsonEnd = rawText.lastIndexOf("}");
    const parsed = JSON.parse(
      jsonStart >= 0 && jsonEnd > jsonStart ? rawText.slice(jsonStart, jsonEnd + 1) : rawText
    );

    const ergebnis: FollowUpOutcome = ["annahme", "ablehnung", "offen"].includes(parsed.ergebnis)
      ? parsed.ergebnis
      : "offen";

    const antwort =
      typeof parsed.antwort === "string" && parsed.antwort.trim().length > 20
        ? parsed.antwort.trim()
        : fallbackReply(lead.vorname);

    return {
      ergebnis,
      antwort,
      kurz: typeof parsed.kurz === "string" ? parsed.kurz.slice(0, 200) : "",
      // Eine Erstattung ist eine Geldentscheidung — die geht nie ohne Freigabe raus.
      heikel: ergebnis !== "annahme",
    };
  } catch (e: any) {
    console.error("[support-triage] Folgemail-Fehler:", e?.message);
    return {
      ergebnis: "offen",
      antwort: fallbackReply(lead.vorname),
      kurz: "Triage-Fehler – manuell prüfen",
      heikel: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Reicht die Beschreibung für einen Zusatzplan?
// ---------------------------------------------------------------------------
// Wird genutzt, wenn jemand das Rettungsangebot annimmt oder eine Plankorrektur
// wünscht. Nur wenn konkret beschrieben ist, was beim Hund nicht klappt, wird
// automatisch ein Zusatzplan gebaut — sonst fragen wir nach.

export interface ProblemCheck {
  ausreichend: boolean;
  beschreibung: string; // knappe Zusammenfassung des Problems in Kundensicht
}

const PROBLEM_SYSTEM = `Du prüfst Kundenmails an einen Anbieter von Hunde-Trainingsplänen. Entscheide, ob die Mail(s) genug Informationen enthalten, um daraus einen individuellen Zusatz-Trainingsplan zu erstellen.

"ausreichend" = true, wenn mindestens EIN konkretes Verhaltensproblem oder eine konkrete Situation beschrieben ist (z.B. "zieht an der Leine, sobald andere Hunde kommen", "kommt draußen nicht zurück, wenn er Wild riecht", "bellt jeden Besuch an", "im Plan fehlen Übungen zum Alleinbleiben"). Allgemeine Aussagen wie "hilft nicht", "passt nicht", "will mein Geld zurück" reichen NICHT.

"beschreibung": fasse in 2 bis 5 Sätzen zusammen, was beim Hund nicht klappt, in welchen Situationen, und was sich die Person wünscht. Nur was in der Mail steht, nichts erfinden.

Antworte mit EXAKT EINEM JSON-Objekt, keine Markdown-Fences:
{"ausreichend": true|false, "beschreibung": "..."}`;

export async function triageProblem(texte: string): Promise<ProblemCheck> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !texte.trim()) return { ausreichend: false, beschreibung: "" };
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: TRIAGE_MODEL,
      max_tokens: 600,
      system: PROBLEM_SYSTEM,
      messages: [{ role: "user", content: texte.slice(0, 6000) }],
    });
    const raw = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    const a = raw.indexOf("{"), e = raw.lastIndexOf("}");
    const parsed = JSON.parse(a >= 0 && e > a ? raw.slice(a, e + 1) : raw);
    const beschreibung = typeof parsed.beschreibung === "string" ? parsed.beschreibung.trim() : "";
    return { ausreichend: parsed.ausreichend === true && beschreibung.length > 30, beschreibung };
  } catch (e: any) {
    console.error("[support-triage] Problem-Check-Fehler:", e?.message);
    return { ausreichend: false, beschreibung: "" };
  }
}
