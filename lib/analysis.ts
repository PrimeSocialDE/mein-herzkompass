// lib/analysis.ts
// Baut aus den raw localStorage-Antworten schöne Absätze für die PDF.

export type Blocks = {
    Begrüßung_block1?: string;
    Begrüßung_block2?: string;
  
    analyse_block1?: string;
    analyse_block2?: string;
    analyse_block3?: string;
  
    fakten_block1?: string;
  
    staerken_block1?: string;
    staerken_block2?: string;
  
    schwaechen_block1?: string;
    schwaechen_block2?: string;
  
    ergebnis_block?: string;
  
    empfehlung1?: string;
    empfehlung2?: string;
    empfehlung3?: string;
  
    zukunft_block1?: string;
    zukunft_block2?: string;
  
    abschluss_block?: string;
    wuensche_block?: string;
  };
  
  // kleine Helfer
  const J = (...parts: Array<string | undefined | null>) =>
    parts.filter(Boolean).join(" ");
  
  const P = (...sentences: Array<string | undefined | null>) =>
    sentences.filter(Boolean).join(" ");
  
  const cap = (s?: string | null) =>
    (s ?? "").replace(/^\s*[a-zäöü]/, (m) => m.toUpperCase());
  
  const q = (s?: string | null) => (s ? `„${s}“` : "");
  
  function niceFreq(v?: string | null) {
    switch ((v || "").toLowerCase()) {
      case "sehr-oft":
      case "sehr_oft":
        return "sehr häufig";
      case "oft":
        return "oft";
      case "manchmal":
        return "manchmal";
      case "selten":
        return "selten";
      case "nie":
        return "so gut wie nie";
      default:
        return undefined;
    }
  }
  
  function niceCloseness(v?: string | null) {
    switch ((v || "").toLowerCase()) {
      case "hoch":
      case "wichtig":
      case "sehr_wichtig":
        return "eine hohe Bedeutung";
      case "mittel":
      case "mittelmäßig":
        return "eine gewisse Bedeutung";
      case "weniger-wichtig":
      case "weniger_wichtig":
        return "keine übermäßige Bedeutung";
      default:
        return undefined;
    }
  }
  
  function niceGenderPref(v?: string | null) {
    switch ((v || "").toLowerCase()) {
      case "frauen":
        return "Frauen";
      case "maenner":
      case "männer":
        return "Männer";
      case "divers":
        return "diverse Personen";
      default:
        return undefined;
    }
  }
  
  function niceConflict(v?: string | null) {
    switch ((v || "").toLowerCase()) {
      case "kaempfen":
      case "kämpfen":
        return "Konflikte eher konfrontativ zu lösen";
      case "frieden-machen":
      case "frieden_machen":
        return "schnell wieder Frieden herzustellen";
      case "bereuen":
        return "Dinge zu bereuen und es beim nächsten Mal besser machen zu wollen";
      default:
        return undefined;
    }
  }
  
  function niceWrongPattern(v?: string | null) {
    switch ((v || "").toLowerCase()) {
      case "manchmal":
        return "manchmal auf Menschen zu setzen, die langfristig nicht gut passen";
      case "oft":
        return "häufig auf Partner:innen zu treffen, die nicht zu deinen Bedürfnissen passen";
      default:
        return undefined;
    }
  }
  
  /**
   * Baut längere Absätze aus den Rohantworten.
   * Du kannst hier jederzeit weitere Sätze/Regeln ergänzen.
   */
  export function buildBlocksFromAnswers(ans: Record<string, any>): Partial<Blocks> {
    const name = ans.user_name || ans.name || "du";
  
    // zentrale Antworten
    const longing = ans.deepestLonging; // z.B. "sicherheit-geborgenheit"
    const genderPref = niceGenderPref(ans.genderPreference);
    const closeness = niceCloseness(ans.dailyClosenessImportance);
    const conflict = niceConflict(ans.conflictBehavior);
    const wrongPattern = niceWrongPattern(ans.wrongPartnerPattern);
    const lovedFreq = niceFreq(ans.giveVsReceive || ans.feelingLoved);
  
    // Empfehlungsschritte (deine stepXX_answer-Werte)
    const s21 = ans.step21_answer;
    const s22 = ans.step22_answer;
    const s23 = ans.step23_answer;
    const s24 = ans.step24_answer;
    const s25 = ans.step25_answer;
    const s26 = ans.step26_answer;
    const s27 = ans.step27_answer;
  
    // Begrüßung
    const begr1 = P(
      `Hallo ${cap(name)}!`,
      `Hier ist deine persönliche Dating-Analyse – klar, ehrlich und auf den Punkt.`
    );
  
    // Analyse – Teil 1
    const an1 = P(
      longing
        ? `Im Kern sehnst du dich nach ${longing.replace(/-/g, " ")}. Dieses Bedürfnis ist ein verlässlicher Kompass dafür, welche Menschen dir wirklich guttun.`
        : `Deine Antworten zeigen klare Prioritäten, die dir dabei helfen, passende Menschen leichter zu erkennen.`,
      closeness
        ? `Nähe hat für dich ${closeness}. Das heißt: Du brauchst einen Menschen, der Nähe ähnlich bewertet – sonst entsteht langfristig Reibung.`
        : undefined
    );
  
    // Analyse – Teil 2
    const an2 = P(
      conflict
        ? `Im Umgang mit Konflikten neigst du dazu, ${conflict}. Das ist wichtig zu wissen – denn die beste Beziehung ist nicht die konfliktfreie, sondern die mit einer reifen Streitkultur.`
        : undefined,
      lovedFreq
        ? `Zuneigung erlebst du ${lovedFreq}. Das solltest du bewusst einfordern: klare Worte, kleine Gesten und Verbindlichkeit helfen dir am meisten.`
        : undefined
    );
  
    // Fakten
    const fakten = P(
      genderPref ? `Partnerpräferenz: ${genderPref}.` : undefined,
      longing ? `Zentraler Fokus: ${longing.replace(/-/g, " ")}.` : undefined
    );
  
    // Ergebnis / Kurzfazit
    const erg = P(
      `Kurzfazit: Wenn du deine Bedürfnisse klar benennst und bei ersten Signalen konsequent bleibst, ziehst du die Menschen an, die wirklich zu dir passen.`,
      wrongPattern
        ? `Achte besonders darauf, Muster zu durchbrechen: Du tendierst dazu, ${wrongPattern}. Setze dir hier bewusste Grenzen.`
        : undefined
    );
  
    // Stärken / Schwächen (aus freieren Antworten ableitbar – hier exemplarisch)
    const staerke1 = s21
      ? P(
          `Eine deiner Stärken: ${s21.replace(/_/g, " ")}.`,
          `Sie gibt dir Orientierung in Gesprächen und hilft dir, dich nicht zu verstellen.`
        )
      : undefined;
  
    const schw1 = s22
      ? P(
          `Wachstumsfeld: ${s22.replace(/_/g, " ")}.`,
          `Es lohnt sich, genau hier bewusste kleine Schritte zu gehen – mit realistischen Erwartungen an dich selbst.`
        )
      : undefined;
  
    // Konkrete Empfehlungen
    const emp1 = s21
      ? P(
          `Fokussiere in den ersten Gesprächen gezielt das Thema "${s21.replace(
            /_/g,
            " "
          )}".`,
          `Formulierungen wie ${q(
            "„Mir ist wichtig, dass…“"
          )} oder ${q("„Ich merke, dass ich mich wohlfühle, wenn…“")} schaffen Offenheit ohne Druck.`
        )
      : undefined;
  
    const emp2 = s22
      ? P(
          `Setze eine klare Grenze bei "${s22.replace(/_/g, " ")}".`,
          `Wenn das Gegenüber ausweicht, freundlich beenden – das schützt Zeit und Herz.`
        )
      : undefined;
  
    const emp3 = s23
      ? P(
          `Bringe "${s23.replace(
            /_/g,
            " "
          )}" aktiv in Dates ein: kurze, ehrliche Sätze und echte Neugier. Das trennt früh die Spreu vom Weizen.`
        )
      : undefined;
  
    // Nächste Schritte / Zukunft
    const zuk1 = s24
      ? P(
          `Der nächste wirksame Schritt: ${s24.replace(/_/g, " ")}.`,
          `Plane dafür bewusst Zeit ein (z. B. wöchentlich 60 Minuten) – kleine Rituale erzeugen große Wirkung.`
        )
      : undefined;
  
    const zuk2 = s25
      ? P(
          `Außerdem hilfreich: ${s25.replace(
            /_/g,
            " "
          )}.`,
          `Halte nach 14 Tagen fest, was sich spürbar verändert hat – Fortschritt motiviert.`
        )
      : undefined;
  
    // Abschluss & Wünsche
    const abschluss = s26
      ? P(
          `Zum Schluss: ${s26.replace(
            /_/g,
            " "
          )}.`,
          `Erlaube dir, genau so aufzutreten – echt, freundlich und klar.`
        )
      : P(
          `Zum Schluss: Echtheit schlägt Taktik.`,
          `Dein Tempo, deine Grenzen, deine Prioritäten – das ist die beste Filterfunktion überhaupt.`
        );
  
    const wuensche = s27
      ? P(
          `Mein Wunsch für dich: ${s27.replace(
            /_/g,
            " "
          )}.`,
          `Und ganz praktisch: heute eine kleine Sache tun, die dich innerlich aufrichtet.`
        )
      : undefined;
  
    return {
      Begrüßung_block1: begr1,
  
      analyse_block1: an1,
      analyse_block2: an2,
  
      fakten_block1: fakten,
  
      staerken_block1: staerke1,
      schwaechen_block1: schw1,
  
      ergebnis_block: erg,
  
      empfehlung1: emp1,
      empfehlung2: emp2,
      empfehlung3: emp3,
  
      zukunft_block1: zuk1,
      zukunft_block2: zuk2,
  
      abschluss_block: abschluss,
      wuensche_block: wuensche,
    };
  }