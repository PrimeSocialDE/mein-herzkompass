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

export type SupportCategory = "widerruf" | "plan_fehlt" | "frage" | "rechnung" | "sonstiges";
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
}

/** Feste Widerruf-Vorlage (von Max vorgegeben). */
export function widerrufTemplate(vorname: string, hundename: string): string {
  const anrede = vorname ? `Hallo ${vorname},` : "Hallo,";
  const hund = hundename || "euren Hund";
  return `${anrede}

vielen Dank für deine Nachricht.

Bevor wir die Rückerstattung veranlassen, würden wir dir gerne noch anbieten, den Pfotenplan für ${hund} individuell anzupassen. Beschreib uns dafür gerne in 3 bis 4 Sätzen, wo genau eure aktuellen Herausforderungen liegen und was du dir vom Training erhofft hast.

Wir können dir dann kostenlos ein individuelles Zusatzmodul mit passenden Übungen erstellen, die noch nicht in eurem bisherigen Plan enthalten sind.

Falls du das nicht möchtest, ist das natürlich auch kein Problem. Dann erstatten wir dir den Betrag im Rahmen unserer Geld-zurück-Garantie zurück.

Viele Grüße
Dein Pfotenplan-Team`;
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

Antworte mit EXAKT EINEM JSON-Objekt, keine Markdown-Fences:
{"kategorie": "...", "heikel": true/false, "aktion": "plan_neu_senden|keine", "antwort": "...", "kurz": "worum es in einem Satz geht"}`;

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

    const kategorie: SupportCategory = ["widerruf", "plan_fehlt", "rechnung", "frage", "sonstiges"].includes(
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

    return {
      kategorie,
      heikel,
      aktion,
      antwort,
      kurz: typeof parsed.kurz === "string" ? parsed.kurz.slice(0, 200) : "",
    };
  } catch (e: any) {
    console.error("[support-triage] Fehler:", e?.message);
    return {
      kategorie: "sonstiges",
      heikel: true,
      aktion: "keine",
      antwort: fallbackReply(lead.vorname),
      kurz: "Triage-Fehler – manuell prüfen",
    };
  }
}
