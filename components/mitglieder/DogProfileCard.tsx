// "Dein Hund"-Profil-Card. Nutzt die Quiz-Daten direkt aus Supabase
// (member_users.quiz_result + dog_name/dog_breed Top-Level) um dem User
// zu zeigen "wir kennen deinen Hund". Pure Personalisierung — wirkt
// emotional viel stärker als "Hallo {Name}".
//
// Wenn planWeek + totalWeeks gesetzt sind, wird die aktuelle Plan-Woche
// prominent angezeigt (statt nur Hundename) — der User sieht sofort
// wo er gerade im Plan steht.

const PROBLEM_LABELS_BY_LANG: Record<"de" | "pl" | "it", Record<string, string>> = {
  de: {
    pulling: "Leinenziehen",
    barking: "Übermäßiges Bellen",
    aggression: "Aggression",
    anxiety: "Trennungsangst",
    jumping: "Anspringen",
    recall: "Rückruf-Probleme",
    energy: "Übermäßige Energie",
    destructive: "Zerstörungsverhalten",
    soiling: "Stubenreinheit",
    mouthing: "Aufnehmen von Gegenständen",
    "visitor-anxiety": "Angst bei Besuch",
    "thunder-anxiety": "Gewitterangst",
    "noise-sensitivity": "Geräuschempfindlichkeit",
    "general-anxiety": "Allgemeine Ängstlichkeit",
    "stranger-anxiety": "Angst vor Fremden",
    separation: "Trennungsangst",
    chasing: "Jagdverhalten",
    "chasing-movement": "Jagt Bewegungen",
    "prey-drive": "Starker Jagdtrieb",
    "chasing-cars": "Jagt Autos",
  },
  pl: {
    pulling: "Ciągnięcie na smyczy",
    barking: "Nadmierne szczekanie",
    aggression: "Agresja",
    anxiety: "Lęk separacyjny",
    jumping: "Skakanie na ludzi",
    recall: "Problemy z przywołaniem",
    energy: "Nadmierna energia",
    destructive: "Niszczenie",
    soiling: "Czystość w domu",
    mouthing: "Podnoszenie przedmiotów",
    "visitor-anxiety": "Lęk przy gościach",
    "thunder-anxiety": "Lęk przed burzą",
    "noise-sensitivity": "Wrażliwość na hałas",
    "general-anxiety": "Ogólna lękliwość",
    "stranger-anxiety": "Lęk przed obcymi",
    separation: "Lęk separacyjny",
    chasing: "Zachowania łowieckie",
    "chasing-movement": "Gonienie ruchu",
    "prey-drive": "Silny instynkt łowiecki",
    "chasing-cars": "Gonienie samochodów",
  },
  it: {
    pulling: "Tira al guinzaglio",
    barking: "Abbaio eccessivo",
    aggression: "Aggressività",
    anxiety: "Ansia da separazione",
    jumping: "Salta addosso",
    recall: "Problemi di richiamo",
    energy: "Energia eccessiva",
    destructive: "Distruttività",
    soiling: "Pulizia in casa",
    mouthing: "Raccoglie oggetti",
    "visitor-anxiety": "Ansia con le visite",
    "thunder-anxiety": "Paura dei temporali",
    "noise-sensitivity": "Sensibilità ai rumori",
    "general-anxiety": "Ansia generale",
    "stranger-anxiety": "Paura degli estranei",
    separation: "Ansia da separazione",
    chasing: "Istinto predatorio",
    "chasing-movement": "Insegue il movimento",
    "prey-drive": "Forte istinto predatorio",
    "chasing-cars": "Insegue le auto",
  },
};

type Lang = "de" | "pl" | "it";

interface DogProfileCardProps {
  dogName: string | null;
  dogBreed: string | null;
  quizResult: any; // JSONB
  planWeek?: number | null;     // Aktuelle Plan-Woche (1-N), optional
  totalWeeks?: number | null;   // Gesamtzahl der Wochen im Plan
  lang?: Lang;
}

function formatAge(age: any, lang: Lang): string | null {
  if (!age) return null;
  const a = String(age).toLowerCase();
  if (a === "puppy" || a.includes("welp"))
    return lang === "pl" ? "Szczeniak" : lang === "it" ? "Cucciolo" : "Welpe";
  if (a.includes("jung"))
    return lang === "pl" ? "Młody pies" : lang === "it" ? "Giovane" : "Jungtier";
  if (a.includes("senior"))
    return lang === "pl" ? "Senior" : lang === "it" ? "Anziano" : "Senior";
  if (/^\d/.test(a)) {
    const num = parseInt(a);
    if (num === 1)
      return lang === "pl" ? "1 rok" : lang === "it" ? "1 anno" : "1 Jahr";
    if (num > 1 && num < 25)
      return lang === "pl"
        ? `${num} lat`
        : lang === "it"
        ? `${num} anni`
        : `${num} Jahre`;
  }
  return String(age);
}

function formatSize(size: any, lang: Lang): string | null {
  if (!size) return null;
  const s = String(size).toLowerCase();
  if (s.includes("klein") || s === "small")
    return lang === "pl" ? "Mały" : lang === "it" ? "Piccolo" : "Klein";
  if (s.includes("mittel") || s === "medium")
    return lang === "pl" ? "Średni" : lang === "it" ? "Medio" : "Mittel";
  if (s.includes("groß") || s === "large" || s === "gross")
    return lang === "pl" ? "Duży" : lang === "it" ? "Grande" : "Groß";
  return String(size);
}

export default function DogProfileCard({
  dogName,
  dogBreed,
  quizResult,
  planWeek,
  totalWeeks,
  lang = "de",
}: DogProfileCardProps) {
  const q = quizResult || {};
  const problemKey = q.dog_problem || q.problem;
  const problemLabels = PROBLEM_LABELS_BY_LANG[lang] || PROBLEM_LABELS_BY_LANG.de;
  const problemLabel = problemKey ? problemLabels[problemKey] || null : null;
  const age = formatAge(q.dog_age, lang);
  const size = formatSize(q.dog_size, lang);
  const commands: string[] = Array.isArray(q.dog_commands) ? q.dog_commands : [];

  const dogFallback =
    lang === "pl" ? "Twój pies" : lang === "it" ? "Il tuo cane" : "Dein Hund";
  const dogFallbackLower =
    lang === "pl" ? "Twój pies" : lang === "it" ? "il tuo cane" : "dein Hund";

  // Stats-Reihe zusammenstellen — nur was vorhanden ist
  const stats: { label: string; value: string }[] = [];
  if (dogBreed) stats.push({ label: "Rasse", value: dogBreed });
  if (age) stats.push({ label: "Alter", value: age });
  if (size) stats.push({ label: "Größe", value: size });

  // Bekannte Kommandos (max 4 zeigen)
  const knownCommands = commands.slice(0, 4);

  // Wenn gar keine Daten — Card überspringen
  if (!dogName && !dogBreed && !age && !problemLabel) return null;

  // Wochen-Anzeige nur wenn beide Werte sinnvoll
  const showWeek =
    typeof planWeek === "number" &&
    typeof totalWeeks === "number" &&
    planWeek > 0 &&
    totalWeeks > 0;

  return (
    <div className="bg-white rounded-2xl border border-[#EADDC5] shadow-[0_2px_12px_rgba(139,115,85,0.06)] overflow-hidden mb-6">
      {/* Top-Bereich: Hund-Emoji + Wochen-Info / Hundename + Stats */}
      <div className="px-5 md:px-6 py-5 flex items-start gap-4">
        {/* Hund-Emoji statt Foto */}
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-[#FFF9F0] flex-shrink-0 ring-2 ring-[#C4A576]/20 flex items-center justify-center text-[40px] md:text-[48px] leading-none">
          🐕
        </div>

        <div className="flex-1 min-w-0">
          {showWeek ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
                {lang === "pl" ? "Aktualny tydzień" : lang === "it" ? "Settimana attuale" : "Aktuelle Woche"}
              </p>
              <h2 className="text-[20px] md:text-[24px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight mb-1">
                {lang === "pl" ? "Tydzień" : lang === "it" ? "Settimana" : "Woche"} {planWeek} <span className="text-[#9CA3AF] font-bold">/ {totalWeeks}</span>
              </h2>
              <p className="text-[13px] text-[#6B7280] leading-snug">
                {dogName || dogFallback}
                {stats.length > 0 && (
                  <>
                    {" · "}
                    {stats.map((s) => s.value).join(" · ")}
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
                {dogFallback}
              </p>
              <h2 className="text-[20px] md:text-[24px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight mb-1">
                {dogName || dogFallback}
              </h2>
              {stats.length > 0 && (
                <p className="text-[13px] text-[#6B7280] leading-snug">
                  {stats.map((s) => s.value).join(" · ")}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hauptthema-Banner */}
      {problemLabel && (
        <div className="px-5 md:px-6 pb-4">
          <div className="flex items-center gap-3 bg-[#FFF9F0] border border-[#EADDC5] rounded-xl px-4 py-3">
            <div className="text-xl leading-none">🎯</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355]">
                {lang === "pl" ? "Główny temat" : lang === "it" ? "Tema principale" : "Hauptthema"}
              </p>
              <p className="text-[14px] font-bold text-[#1a1a1a] leading-snug">
                {problemLabel}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bekannte Kommandos (falls erfasst) */}
      {knownCommands.length > 0 && (
        <div className="px-5 md:px-6 pb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">
            {lang === "pl"
              ? `Co ${dogName || dogFallbackLower} już potrafi`
              : lang === "it"
              ? `Cosa sa già fare ${dogName || dogFallbackLower}`
              : `Was ${dogName || dogFallbackLower} schon kann`}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {knownCommands.map((cmd) => (
              <span
                key={cmd}
                className="inline-flex items-center gap-1 bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-[12px] font-medium px-2.5 py-1 rounded-full"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                {cmd}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
