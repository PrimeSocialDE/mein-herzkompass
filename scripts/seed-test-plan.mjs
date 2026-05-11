// One-off: 12-Wochen-Trainingsplan in member_plan_content seeden.
// Simuliert was Make.com nach echter PDF-Generierung POSTen wuerde.
// Nutzt den Eddy-Plan (aus dem User-PDF) als Vorlage.
//
// Aufruf:
//   node scripts/seed-test-plan.mjs kontakt@primesocial.de
//
// Voraussetzung: User existiert bereits als member_users (sonst hat
// member_plan_content kein user_id-Match, fallback ueber email klappt
// aber trotzdem).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

try {
  const envText = readFileSync(".env.local", "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("FEHLT: SUPABASE_URL + SUPABASE_SERVICE_ROLE");
  process.exit(1);
}

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/seed-test-plan.mjs <email>");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// Hund-Name aus member_users holen falls vorhanden
const { data: m } = await sb
  .from("member_users")
  .select("id, dog_name")
  .ilike("email", email)
  .maybeSingle();
const userId = m?.id || null;
const dogName = m?.dog_name || "Bruno";

console.log(`\n→ Seede Sample-12-Wochen-Plan fuer ${email} (Hund: ${dogName})\n`);

// ── Plan-Content ──────────────────────────────────────────────────────
// Vereinfachte Variante des Eddy-Plans (Leinenziehen + Energie),
// gleiche Struktur wie Make.com POSTen wird.

const content = {
  intro: {
    headline: `3-Monatsplan für ${dogName}`,
    einleitung: `${dogName} ist ein aktiver Hund mit hohem Bewegungsdrang und neigt an der Leine zum Ziehen. Diese Kombination führt im Alltag oft zu Stress und angespannten Spaziergängen. Der Trainingsplan setzt genau hier an und strukturiert den Alltag so, dass ${dogName} klarer geführt werden kann.\n\nDie tägliche Trainingszeit von 15 Minuten erfordert einen fokussierten Aufbau. Kurze Einheiten und feste Routinen helfen ${dogName}, neue Abläufe zu verknüpfen, ohne ihn zu überfordern.`,
    ziele: `Im Mittelpunkt steht das zuverlässige Ausführen bereits vorhandener Signale unter Ablenkung. ${dogName} soll lernen, seine Energie besser zu dosieren und sich an Dir zu orientieren, statt impulsiv zu reagieren.\n\nDie Leinenführigkeit wird in mehreren Stufen aufgebaut. ${dogName} soll lernen, in Nebenposition mit lockerer Leine zu gehen und Zug nicht mehr als erfolgreiches Mittel zum Ziel zu erleben.`,
    aufbau: `Der Plan ist in zwölf Wochen gegliedert, die jeweils einen klaren Schwerpunkt haben. Jede Woche baut auf Elementen der vorherigen auf, ohne diese zu ersetzen. Wiederholung ist ausdrücklich Teil des Konzepts.\n\nRückschritte und schwankende Tage sind im Plan mitgedacht und gelten nicht als Scheitern. Wichtig ist, dass ${dogName} möglichst häufig Erfolg haben kann.`,
  },
  weeks: [
    {
      num: 1,
      title: "Start Alltagstruktur",
      wochenziele: [
        `${dogName} soll erste kurze Ruhemomente vor Aktivität aushalten können.`,
        "Die Leine soll bei kurzen Sequenzen von etwa drei Schritten locker bleiben.",
        `${dogName} soll auf seinen Namen zuverlässig mit Blickkontakt reagieren.`,
        "Sitz und Platz sollen zügig und ohne langes Zögern gezeigt werden.",
        "Das Futtermanagement soll so angepasst werden, dass Belohnungen gezielt eingesetzt werden.",
      ],
      tagesplan: `In dieser Woche liegt der Schwerpunkt auf klaren, ruhigen Alltagsritualen mit ${dogName}. Vor jeder Aktion wie Gassi, Futter oder Spiel baust Du einige Sekunden Ruhe ein.\n\nDie täglichen Einheiten bleiben sehr kurz und finden mehrmals über den Tag verteilt statt. Drei bis fünf Minuten reichen pro Session.`,
      no_gos: [
        "Ruck an Leine verletzt Vertrauen",
        "Reizstrecken lang erhöhen Erregung",
        "Draußen zu viel fordern überlastet",
        "Kommandos dauernd rufen stumpft ab",
        `${dogName} hochpushen vor Spaziergang schadet Ruhe`,
      ],
      fortschritt: [
        "etwas seltener anspringen, wenn es an die Leine geht",
        "nach Aufregung etwas schneller herunterfahren",
        "häufiger von sich aus Blickkontakt suchen",
        "weniger stark in die Leine springen",
        "bekannte Signale wie Sitz im Haus zügiger ausführen",
      ],
      uebungen: [
        {
          name: "Ritual Haustür ruhig",
          schritte: [
            `${dogName} anleinen in ruhigem Raum`,
            "Zur Tür gehen in normalem Tempo",
            "Vor Tür stehen bleiben ohne Kommentar",
            "Auf kurzen Blickkontakt warten still",
            "Bei Blick leise loben und öffnen",
            "Nur losgehen, wenn Leine locker",
            "Bei Ziehen kurz Tür wieder schließen",
            "Erneut warten bis kurze Ruhe",
          ],
        },
        {
          name: "Leckerli für Leinenruhe",
          schritte: [
            `${dogName} neben Dich stellen innen`,
            "Leine in einer Hand halten",
            "Bei lockerer Leine Markerwort sagen",
            "Sofort Leckerli an Bein geben",
            "Ein bis zwei Schritte vorgehen",
            "Wieder nur lockere Leine belohnen",
            "Bei Zug stehen bleiben kommentarlos",
            "Erst weitergehen nach Entspannung",
          ],
        },
      ],
    },
    {
      num: 2,
      title: "Impulskontrolle Basis",
      wochenziele: [
        `${dogName} soll vor dem Futternapf drei Sekunden warten können.`,
        "An Türen lernen zu pausieren bis Du freigibst.",
        "Ein erstes Abbruchsignal aufbauen.",
        "Leine bei 5 Schritten locker halten.",
        "Spielphasen mit klarer Beendigung ruhig abschließen.",
      ],
      tagesplan: `Der Tagesplan in dieser Woche dreht sich um kontrollierte Übergänge bei Futter, Türen und Spiel. Vor dem Futternapf übst Du das kurze Warten und gibst erst auf ein Freigabesignal die Erlaubnis.\n\nZusätzlich beginnst Du mit einem klaren Abbruchsignal in ruhigen Situationen. Beim Spiel achtest Du auf kurze, klare Sequenzen.`,
      no_gos: [
        "Abbruch schreien verknüpft Angst",
        "Wildes Spiel hochpushen fördert Übersprung",
        "Eddy anstarren erhöht Druck",
        "Futter hinwerfen ohne Plan verwirrt",
        "Türen hektisch öffnen steigert Erregung",
      ],
      fortschritt: [
        "seltener ungebremst zum Napf stürmen",
        "sich beim Anleinen ruhiger zeigen",
        "auf das Abbruchsignal gelegentlich reagieren",
        "Zerrphasen beenden können ohne hochzufahren",
        "an den ersten Metern der Leine weniger vorpreschen",
      ],
      uebungen: [
        {
          name: "Futternapf Freigabe",
          schritte: [
            `${dogName} Napf zeigen und hinstellen`,
            `${dogName} ins Sitz vor Napf bringen`,
            "Hand zwischen Hund und Napf halten",
            "Kurze Pause abwarten ohne Bewegung",
            "Freigabewort ruhig sagen zum Start",
            "Bei Vorpreschen Napf wegnehmen",
            "Erneut Sitz und kurze Pause abwarten",
            "Erst bei ruhigem Warten fressen lassen",
          ],
        },
        {
          name: "Tür Warten Freigabe",
          schritte: [
            `Mit ${dogName} an geschlossene Tür gehen`,
            `${dogName} neben oder hinter Dich stellen`,
            "Klinke anfassen und kurz warten",
            "Tür nur einen Spalt öffnen",
            "Bei Vorpreschen Tür sofort wieder schließen",
            "Auf kurzen Blickkontakt warten",
            "Ruhiges Freigabewort geben und losgehen",
            "Täglich an verschiedenen Türen wiederholen",
          ],
        },
      ],
    },
    {
      num: 3,
      title: "Leinenführigkeit Start",
      wochenziele: [
        `${dogName} soll ein sicheres Handtarget aufbauen.`,
        "Richtungswechsel an der Leine ruhig erfolgen.",
        "10 Schritte an lockerer Leine erreichbar.",
        "Häufiger Blickkontakt unterwegs.",
        "Genereller Zerrzug etwas geringer.",
      ],
      tagesplan: `An den meisten Tagen übst Du kurze Sequenzen der Leinenführigkeit auf bekannten Wegen. Das Handtarget wird zuerst im Haus gefestigt und dann an die Leine gekoppelt.\n\nDie Strecken bleiben bewusst kurz, dafür trainierst Du mehrere Male am Tag. Sobald ${dogName} zu stark zieht, drehst Du ruhig um.`,
      no_gos: [
        "Lange Spaziergänge überfordern Lernphase",
        `${dogName} zum Ziel ziehen verstärkt Zug`,
        "Dauernd locken mit Futter macht abhängig",
        "Anbrüllen bei Zug erzeugt Unsicherheit",
        "In Reizlage neue Technik starten überfordert",
      ],
      fortschritt: [
        "das Handtarget zuverlässig berühren",
        "bei Richtungswechseln öfter mitgehen",
        "mehr Zeit in halbwegs stabiler Nebenposition",
        "seltener dauerhaft auf Zug gehen",
        "schneller akzeptieren, dass Ziehen nicht ans Ziel bringt",
      ],
      uebungen: [
        {
          name: "Handtarget an Leine",
          schritte: [
            "Hand mit Leckerli nah vors Gesicht halten",
            "Markerwort bei Berührung der Hand sagen",
            "Leckerli direkt aus Hand geben",
            "Hand schrittweise höher an Bein positionieren",
            `${dogName} an Hand zur Nebenposition führen`,
            "An Leine ein bis zwei Schritte gehen",
            "Bei Berührung und Nebenposition belohnen",
            "Mehrmals täglich kurz wiederholen",
          ],
        },
        {
          name: "Umdrehen bei Zug",
          schritte: [
            `Mit ${dogName} an kurzer Leine losgehen`,
            "Sobald Leine spannt sofort stehen bleiben",
            `Kurz warten bis ${dogName} sich umdreht`,
            "Markerwort beim Blick zu Dir sagen",
            "Ruhig in entgegengesetzte Richtung gehen",
            "Bei lockerer Leine 2-3 Schritte belohnen",
            "Wiederholen bei jedem deutlichen Zug",
            "Strecke kurz halten und oft üben",
          ],
        },
      ],
    },
    {
      num: 4,
      title: "Ruhe & Platz",
      wochenziele: [
        `${dogName} soll Platz im Alltag gezielt nutzen.`,
        "Ein Entspannungssignal einführen.",
        "Kauartikel ritualisiert nach Aktivität.",
        "Besuchssituationen besser managen.",
        "Erste kleine Frustmomente aushalten.",
      ],
      tagesplan: `Diese Woche verknüpfst Du Platz aktiv mit Ruhe nach Bewegung. Nach Spaziergang, Spiel oder Besuch bittest Du ${dogName} auf seinen Platz.\n\nZusätzlich führst Du ein Entspannungssignal ein. Kauartikel setzt Du gezielt nach Aktivität ein.`,
      no_gos: [
        "Platz als Strafe nutzt Vertrauen ab",
        "Zu langes Bleiben überfordert Geduld",
        `${dogName} körperlich blocken erhöht Stress`,
        "Kauartikel ständig anbieten entwertet Ritual",
        "Ruheplatz wechseln erzeugt Unsicherheit",
      ],
      fortschritt: [
        "sich häufiger freiwillig hinlegen",
        "auf das Platzsignal schneller reagieren",
        "im Haus weniger herumwandern",
        "bei Besuch leichter auf Platz zu lenken",
        "etwas weniger bellen wenn er warten muss",
      ],
      uebungen: [
        {
          name: "Platz belohnen ruhig",
          schritte: [
            `Feste Decke für ${dogName} auswählen`,
            `${dogName} mit Signal auf Platz schicken`,
            "Sobald er liegt leise Markerwort sagen",
            "Belohnung ruhig auf Platz bringen",
            "Kurze Pause dann weiteres Leckerli geben",
            "Blick abwenden und selbst ruhig bleiben",
            "Dauer des Liegens langsam steigern",
            "Täglich in mehreren kurzen Blöcken",
          ],
        },
        {
          name: "Kauzeit nach Spaziergang",
          schritte: [
            "Nach Spaziergang direkt in Wohnung gehen",
            `${dogName} kurz Wasser anbieten und ableinen`,
            "Mit Signal auf festen Platz schicken",
            "Erst wenn er liegt Kauartikel hinlegen",
            "Entspannungssignal leise dazu sagen",
            "Raumwechsel und große Reize vermeiden",
            "Kauzeit nicht kommentieren",
            "Kauartikel nach Ende kommentarlos wegnehmen",
          ],
        },
      ],
    },
    // Wochen 5-12 als kompaktere Versionen (in der echten Make.com-
    // Generation kommt alles in voller Tiefe — hier zeigen wir genug
    // damit der UI-Test aussagekraeftig ist)
    {
      num: 5,
      title: "Aggression Abstand",
      wochenziele: [
        "Auslöserliste führen.",
        "Distanz zu Auslösern halten.",
        "Blickabwendung belohnen.",
        "Umdrehensignal aufbauen.",
        "Sicherheitsmanagement anpassen.",
      ],
      tagesplan: `Du beobachtest bei jedem Spaziergang genau, auf welche Reize ${dogName} wie stark reagiert. Routen mit gut steuerbaren Abständen wählen.\n\nDas Umdrehensignal wird in ruhigen Momenten geübt und dann vorsichtig in Anwesenheit von Reizen eingesetzt.`,
      no_gos: [
        "Frontale Annäherung erhöht Konfliktgefahr",
        "Fixieren zulassen verstärkt Muster",
        "Leinenruck bei Reiz koppelt Schmerz",
        "Unklare Wegeplanung stresst zusätzlich",
        "Lautes Schimpfen lenkt nicht um",
      ],
      fortschritt: [
        "früher auf Dich ansprechbar sein",
        "weniger lange starr fixieren",
        "schneller wieder zu normalem Erregungsniveau finden",
        "ruhiger mitgehen bei Bögen",
        "seltener in volle Eskalation geraten",
      ],
      uebungen: [
        {
          name: "Ausweichen Bogen laufen",
          schritte: [
            "Auslöser frühzeitig lokalisieren",
            "Leine auf gut kontrollierbare Länge",
            `Mit ${dogName} in großem Bogen weggehen`,
            "Blickkontakt zu Dir belohnen",
            "Ruhig weiter ohne Hast",
            "Bei erneutem Fixieren Bogen vergrößern",
            "Nach Vorbeigehen Richtung anpassen",
            "Verhalten jedes Mal gleich",
          ],
        },
        {
          name: "Umdrehen belohnen",
          schritte: [
            "In reizarmen Situationen Start üben",
            "Kurzes Wort für Umdrehen wählen",
            `Mit ${dogName} gemeinsam wenden`,
            "Sofort Blickkontakt nach Wende belohnen",
            "Mehrfach täglich ohne starken Reiz",
            "Später bei schwachem Reiz einsetzen",
            "Ruhiges Weggehen nach Umdrehen festigen",
            "Erfolgreiche Umdrehungen besonders reichlich belohnen",
          ],
        },
      ],
    },
    {
      num: 6,
      title: "Aggression Umorientierung",
      wochenziele: [
        "Name unter Reiz in 70% der Fälle.",
        "Handtarget bei Auslösern nutzbar.",
        "Stopsignal in größerer Distanz.",
        "Platz als kurze Pause.",
        "Belohnungen variieren.",
      ],
      tagesplan: `Diese Woche kombinierst Du Distanzstrategien mit gezielter Umorientierung. Du rufst ${dogName}s Namen wenn er einen Reiz wahrnimmt aber noch nicht voll fixiert.\n\nDas Stopsignal übst Du in größerer Distanz. Belohnungen variierst Du zwischen Futter, Schnüffeln und Weitergehen.`,
      no_gos: [
        "Zu nah an Reiz trainieren überlastet",
        "Lange Reizbeobachtung steigert Erregung",
        "Belohnung sparen senkt Motivation",
        "Platz direkt am Reiz überfordert",
        "Name rufen ohne Konsequenz entwertet",
      ],
      fortschritt: [
        "Fixieren schneller unterbrechen",
        "weniger knurren oder nach vorne gehen",
        "häufiger selbstständig wieder zu Dir schauen",
        "unter moderatem Reiz Handtarget annehmen",
        "kürzer in hoher Erregung verharren",
      ],
      uebungen: [
        {
          name: "Name Target belohnen",
          schritte: [
            `${dogName} in moderater Reizdistanz`,
            "Namen einmal ruhig sagen",
            "Bei Blick zu Dir Markerwort nutzen",
            "Sofort Handtarget anbieten neben Bein",
            "Bei Berührung direkt belohnen am Körper",
            "Kurze Pause und Grundrichtung",
            "Mehrmals mit Pausen wiederholen",
            "Distanz schrittweise verringern bei Erfolg",
          ],
        },
        {
          name: "Stop dann Abstand",
          schritte: [
            "In ruhiger Umgebung Stop üben",
            "Auf Stop sofortiges Stehenbleiben",
            `Reagiert ${dogName} belohnen`,
            "Gemeinsam einen Schritt rückwärts",
            "Später mit fernem Reiz kombinieren",
            "Stop vor zu hoher Erregung einsetzen",
            "Nach Stop bewusst Distanz vergrößern",
            "Belohnung in sicherer Entfernung",
          ],
        },
      ],
    },
    {
      num: 7,
      title: "Leinenführigkeit Ausbau",
      wochenziele: [
        "Nebenposition länger halten.",
        "Tempoänderungen mitgehen.",
        "Kurven ohne Zug.",
        "Umweltbelohnungen über Freigabe.",
        "Zug konsequent stoppen.",
      ],
      tagesplan: `Diese Woche verbindest Du Leinenarbeit mit mehr Abwechslung im Tempo. Schnüffeln gibst Du als Freigabe wenn die Leine locker ist.\n\nKurven werden flüssiger eingebaut. Freilauf wird klar von Leinenphasen getrennt.`,
      no_gos: [
        "Dauertraben überlastet Gelenke",
        "Ziehen bis Ziel verstärkt Verhalten",
        "Zu viele Kommandos überfordern",
        "Unklare Freigaben verwirren",
        "Frust laut abreagieren erhöht Anspannung",
      ],
      fortschritt: [
        "weniger Zugspitzen an der Leine",
        "an Deinem Tempo orientieren",
        "Kurven ruhiger mitgehen",
        "Schnüffeln auf Freigabe beginnen",
        "nach Freilauf besser ins Leinengehen zurückfinden",
      ],
      uebungen: [
        {
          name: "Tempo langsam schnell",
          schritte: [
            `Mit ${dogName} normal starten`,
            "Ruhig langsamer werden für einige Meter",
            "Bei Mitgehen Blickkontakt belohnen",
            "Wieder leicht Tempo erhöhen",
            "Bei Ziehen sofort Tempo verringern",
            "Mehrfach Wechsel auf kurzer Strecke",
            "Übergänge mit Körperbewegung ankündigen",
            "Nur auf überschaubarer Strecke",
          ],
        },
        {
          name: "Schnüffelsignal Freigabe",
          schritte: [
            `In ruhiger Gegend anhalten mit ${dogName}`,
            "Warten bis Leine locker ist",
            "Klares Wort für Schnüffeln sagen",
            "Mit Hand Richtung Boden zeigen",
            "Schnüffeln kurz zulassen",
            "Nach kurzer Zeit zum Bein rufen",
            "Weitergehen bei lockerer Leine belohnen",
            "Mehrmals pro Spaziergang einsetzen",
          ],
        },
      ],
    },
    {
      num: 8,
      title: "Frust & Begegnungen",
      wochenziele: [
        "Begegnungsprotokoll führen.",
        "Bogenlaufen als Routine.",
        "Platz bei Begegnungen auf Distanz.",
        "Belohnungsketten aufbauen.",
        "Klares Abbruchverhalten.",
      ],
      tagesplan: `Du planst Begegnungen so dass Du Abstände steuern kannst. Jede Begegnung wird kurz protokolliert.\n\nBei aufkommender Eskalation brichst Du konsequent ab und entfernst Dich.`,
      no_gos: [
        "Engstellen erzwingen erhöht Konfliktrisiko",
        "Leine dauerhaft straff steigert Druck",
        "Begegnungen sammeln verstärkt Problem",
        "Platz zu nah am Reiz überfordert",
        "Unvorbereitet Hundewiese riskant",
      ],
      fortschritt: [
        "bei Begegnungen weniger laut reagieren",
        "kürzer und weniger starr fixieren",
        "leichter zum Weitergehen motivieren",
        "Bögen ohne starkes Ziehen mitgehen",
        "in Distanz eher in Platz bleiben",
      ],
      uebungen: [
        {
          name: "Bogen vor Sichtkontakt",
          schritte: [
            "Reiz frühzeitig erkennen",
            `${dogName} auf Deine Seite weg vom Reiz`,
            "Mit weiten Schritten seitlich",
            "Leine kurz aber locker",
            "Blickkontakt zu Dir belohnen",
            "Ggf. zweiten Bogen anhängen",
            "Erst nach Reiz wieder geradeaus",
            "Begegnung notieren",
          ],
        },
        {
          name: "Belohnen Blick weg",
          schritte: [
            "Reiz in sicherer Distanz aufsuchen",
            `${dogName} beobachten lassen`,
            "Bei Blick weg Markerwort",
            "Leckerli an Dein Bein",
            "Blick weg mehrfach belohnen",
            "Zwischendurch ein zwei Schritte",
            "Nur in moderater Reizlage",
            "Bei zu starkem Fixieren Distanz größer",
          ],
        },
      ],
    },
    {
      num: 9,
      title: "Alltagssignale festigen",
      wochenziele: [
        "Sitz und Stop in verschiedenen Umgebungen.",
        "Platz mit Ablenkung bis 1 Min.",
        "Kurze Alleinruhe aufbauen.",
        "Vorstufe Rückruf im Haus.",
        "Kooperation beim Bürsten.",
      ],
      tagesplan: `Du überträgst bekannte Signale in neue Umgebungen. Platz wird an neuen Orten aufgebaut.\n\nKurze Alleinruhe im Haus wird vorbereitet. Beim Bürsten achtest Du auf ruhiges Handling.`,
      no_gos: [
        "Signale dauernd wiederholen entwertet",
        "Zu lange Alleinzeiten überfordern",
        "Reizvolle Orte zu lange stressen",
        "Handling hektisch verunsichert",
        "Platz bei starker Ablenkung überfordert",
      ],
      fortschritt: [
        "Sitz und Stop an mehreren Orten zuverlässiger",
        "im Platz mit Ablenkung länger liegen",
        "weniger angespannt im Haus",
        "Pausen ruhiger nutzen",
        "Körperpflege besser tolerieren",
      ],
      uebungen: [
        {
          name: "Mini Generalisierung",
          schritte: [
            "Bekanntes Signal im Wohnzimmer",
            "Gleichen Ablauf im Flur",
            "Später im Garten",
            "Nur kleine Ablenkungen anfangs",
            "Gleiche Belohnung verwenden",
            "Pro Ort wenige Wiederholungen",
            "Schwierigere Orte nach Sicherheit",
            "Pro Tag 1-2 neue Orte testen",
          ],
        },
        {
          name: "Komm her belohnen",
          schritte: [
            `${dogName}s Namen ruhig sagen`,
            "In die Hocke zu Dir einladen",
            "Bei Anlaufen Markerwort",
            "Belohnung nah am Körper",
            "Danach freigeben",
            "Nur rufen wenn Belohnung bereit",
            "Mehrmals täglich ruhig",
            "Keine Strafe nach Ankommen",
          ],
        },
      ],
    },
    {
      num: 10,
      title: "Energie sinnvoll lenken",
      wochenziele: [
        "Suchspiele 3 Min konzentriert.",
        "Nasenspiele unterwegs.",
        "Zerrspiele mit Regeln.",
        "Abruf aus Spiel.",
        "Nach Spiel in Platz.",
      ],
      tagesplan: `Du lenkst ${dogName}s Energie verstärkt in Such- und Nasenarbeit. Unterwegs baust Du kurze Schnüffelaufgaben ein.\n\nZerrspiele erhalten klare Start und Stopphasen. Nach aktiver Phase folgt Ruhephase.`,
      no_gos: [
        "Ballwerfen in Dauerschleife pusht hoch",
        "Wildes Rennen an Leine gefährlich",
        "Zerren ohne klares Ende verwirrt",
        "Suchspiele zu lange übermüden",
        "Keine Ruhephase nach Spiel stresst",
      ],
      fortschritt: [
        "schneller wieder beruhigen nach Spiel",
        "weniger wildes Rennen an Leine",
        "mehr Interesse an Suchaufgaben",
        "bei Zerrspielen klarer auf Start/Stopp",
        "leichter in liegende Ruheposition",
      ],
      uebungen: [
        {
          name: "Futtersuche im Gras",
          schritte: [
            "Ruhigen Grasbereich auswählen",
            `${dogName} in Sitz warten lassen`,
            "Mehrere Futterstücke ausstreuen",
            "Freigabewort für Suche",
            `${dogName} suchen lassen ohne Eingreifen`,
            "Nach wenigen Minuten beenden",
            "Restfutter einsammeln",
            "1-2× täglich",
          ],
        },
        {
          name: "Zerren Abbruch Tausch",
          schritte: [
            "Mit leichtem Zerrspielzeug",
            "Ziehen auf Signal erlauben",
            "Nach kurzer Zeit Abbruchwort",
            "Spielzeug stillhalten",
            "Bei Loslassen sofort Tauschleckerli",
            "Pause ohne Zerren",
            "Erst nach Pause neues Startsignal",
            "Regelmäßig in kurzen Einheiten",
          ],
        },
      ],
    },
    {
      num: 11,
      title: "Begegnungen schwieriger",
      wochenziele: [
        "Distanz vorsichtig reduzieren.",
        "Parallel laufen mit Hund.",
        "Umdrehen automatisch.",
        "Belohnungen verzögern.",
        "Ritual nach Begegnungen.",
      ],
      tagesplan: `Du gestaltest Begegnungen kontrollierter aber anspruchsvoller. Mit passendem Hund parallel laufen.\n\nNach jeder Begegnung folgt ein klares Ritual.`,
      no_gos: [
        "Grenzen testen provoziert Rückschläge",
        "Unbekannte Hundewiese erhöht Risiko",
        "Engstellen riskieren fördert Konflikte",
        "Belohnung weglassen senkt Kooperation",
        "Begegnungen an straffer Leine stressen",
      ],
      fortschritt: [
        "bei geringerer Distanz ruhiger bleiben",
        "Parallel laufen ohne ständiges Ziehen",
        "nach Umdrehen schneller abschalten",
        "verzögerte Belohnungen annehmen",
        "nach Begegnungen schneller normales Gangbild",
      ],
      uebungen: [
        {
          name: "Parallelweg mit Abstand",
          schritte: [
            "Geeigneten ruhigen Hund wählen",
            "Beide Hunde mit Abstand führen",
            "Gleiche Richtung langsam losgehen",
            "Auf lockere Leinen achten",
            "Ruhige Blicke belohnen",
            "Abstand vorsichtig anpassen",
            "Begegnung kurz halten",
            "Im Protokoll notieren",
          ],
        },
        {
          name: "Nach Begegnung Platz",
          schritte: [
            "Nach Begegnung weitergehen",
            "Festen Ort wählen",
            `${dogName} mit Signal ins Platz`,
            "Ruhiges Liegen abwarten",
            "Entspannungssignal leise",
            "Belohnung auf Platz",
            "Nach Ruhe ruhig losgehen",
            "Ritual nach jeder Begegnung",
          ],
        },
      ],
    },
    {
      num: 12,
      title: "Stabilisierung & Plan",
      wochenziele: [
        "Kernübungen wiederholen.",
        "Alltagstauglicher Trainingsmix.",
        "Strategien für Rückfälle.",
        "Belohnungsplan anpassen.",
        "Langfristige Routinen.",
      ],
      tagesplan: `Du wiederholst gezielt die Kernübungen. Daraus stellst Du einen einfachen Wochenmix zusammen.\n\nAußerdem planst Du, wie Du bei Rückfällen reagieren willst. Langfristige Routinen werden festgelegt.`,
      no_gos: [
        "Training abrupt stoppen bricht Strukturen",
        "Belohnung plötzlich streichen senkt Motivation",
        "Reize ohne Plan steigern überfordern",
        "Alte Muster ignorieren statt sichern",
        "Neue Ziele gleichzeitig starten verwirrt",
      ],
      fortschritt: [
        "seltener in starke Eskalationen",
        "häufiger selbst beruhigen",
        "Leinenführigkeit konstanter",
        "in Ruhephasen zuverlässig Platz",
        "strukturierte Tage",
      ],
      uebungen: [
        {
          name: "Wochenmix festlegen",
          schritte: [
            "Kernübungen auflisten",
            "Pro Tag max 3 kurze Blöcke",
            "Feste Zeiten morgens und abends",
            "Ruheübungen mit Leinenarbeit",
            "Begegnungstraining an planbaren Tagen",
            "Suchspiele an energiereichen Tagen",
            "Plan schriftlich sichtbar",
            "Nach Woche überprüfen",
          ],
        },
        {
          name: "Notfallroutine üben",
          schritte: [
            "Distanz und Umdrehstrategie festlegen",
            "Kurzes Notfallsignal",
            "In ruhiger Umgebung durchspielen",
            "Auf Signal sofort Umdrehen",
            `${dogName} eng bei Dir`,
            "Erst in sicherer Distanz Ruhe",
            "Belohnung für Umorientierung",
            "Regelmäßig ohne echten Reiz",
          ],
        },
      ],
    },
  ],
  monats_uebersichten: [
    {
      monat: 1,
      text: `Im ersten Monat liegt der Fokus auf Ruheaufbau, Impulskontrolle und Leinenbasis. ${dogName} lernt, dass nicht jede Erregung sofort in Aktion mündet.\n\nTypische Schwierigkeiten sind das hohe Energielevel und das gewohnte Ziehen an der Leine. Es ist normal dass ${dogName} an einzelnen Tagen unruhiger wirkt - das gehört zum Umlernen.`,
    },
    {
      monat: 2,
      text: `Im zweiten Monat verschiebt sich der Schwerpunkt in Richtung Distanzarbeit und Umorientierung. Ausweichen und Bogenlaufen werden zu festen Strategien.\n\nRückfälle bedeuten hier nicht dass alles verloren ist, sondern zeigen Punkte an denen Distanz und Management nachgeschärft werden müssen.`,
    },
    {
      monat: 3,
      text: `Im dritten Monat steht die Generalisierung der gelernten Inhalte im Vordergrund. Begegnungen werden anspruchsvoller, Alltagssignale werden gefestigt.\n\nDer Abschluss markiert keinen Endpunkt sondern den Übergang in einen langfristigen Umgang. Den Wochenmix kannst Du weiterführen und alle paar Wochen anpassen.`,
    },
  ],
  abschluss: `In den vergangenen zwölf Wochen wurde ${dogName}s Alltag Schritt für Schritt strukturiert. Ruhe, Impulskontrolle, Leinenführigkeit und der Umgang mit Auslösern wurden in kleinen Einheiten aufgebaut.\n\nWichtig ist, dass Du die Werkzeuge aus dem Plan kennst und sie gezielt einsetzen kannst. Dazu zählen Distanzmanagement, Bogenlaufen, Platz als Pause und ein strukturierter Belohnungsplan.\n\nAls nächster Schritt: den Wochenmix aus Woche 12 dauerhaft nutzen und alle paar Wochen anpassen. Beobachte regelmäßig ${dogName}s Signale zu Stress und Erholung.`,
  zusatz_spiele: [
    {
      nummer: 1,
      name: "Futter suchen",
      ziel: "Konzentration, Nasenarbeit und innere Ruhe fördern",
      schritte: [
        "Hund sitzt oder steht ruhig",
        "Zeige ein kleines Futterstück",
        "Lege es sichtbar ab",
        'Sage ruhig "Such"',
        "Lasse den Hund selbstständig suchen",
        "Bleibe still und beobachte",
        "Lobe leise nach dem Finden",
        "Wiederhole an anderer Stelle",
      ],
      warum:
        "Nasenarbeit macht müde, ruhig und zufrieden. Sie stärkt Selbstständigkeit und Frustrationstoleranz.",
    },
    {
      nummer: 2,
      name: "Handtouch spielerisch",
      ziel: "Aufmerksamkeit, Orientierung und Nähe spielerisch stärken",
      schritte: [
        "Halte deine Hand ruhig seitlich hin",
        "Warte auf Interesse",
        "Hund berührt die Hand mit der Nase",
        "Bestätige ruhig",
        "Belohne direkt",
        "Wechsle langsam die Position",
        "Bleibe freundlich und entspannt",
        "Beende nach wenigen Wiederholungen",
      ],
      warum:
        "Der Hund lernt, sich aktiv an dir zu orientieren. Ideal bei Unsicherheit oder Ablenkung.",
    },
    {
      nummer: 3,
      name: "Ruhiges Zerrspiel",
      ziel: "Impulskontrolle und kontrolliertes Spiel lernen",
      schritte: [
        "Nimm ein weiches Spielzeug",
        "Lade ruhig zum Ziehen ein",
        "Spiele langsam und kontrolliert",
        "Stoppe plötzlich die Bewegung",
        "Warte auf Lockerlassen oder Ruhe",
        "Belohne ruhiges Verhalten",
        "Spiele erst dann weiter",
        "Beende das Spiel bewusst",
      ],
      warum:
        "Der Hund lernt, Erregung zu regulieren. Spiel und Kontrolle schließen sich nicht aus.",
    },
  ],
};

const { data: inserted, error } = await sb
  .from("member_plan_content")
  .insert({
    user_id: userId,
    email,
    plan_slug: "trainingsplan",
    plan_title: `12-Wochen-Trainingsplan für ${dogName}`,
    content,
    pdf_url: null,
    dog_name: dogName,
    source: "seed-test-script",
  })
  .select("id, created_at")
  .single();

if (error) {
  console.error("Insert fehlgeschlagen:", error.message);
  process.exit(1);
}

console.log(`  ✓ Plan-Content angelegt: ${inserted.id}`);
console.log(`\nLog dich ein und schau auf /mitglieder/erfolge/coaching.\n`);
