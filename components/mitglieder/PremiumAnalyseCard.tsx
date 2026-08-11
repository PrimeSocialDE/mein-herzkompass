// Dashboard-Einstieg fuer die 79-EUR-Premium-Analyse. Eigene, visuelle Karte
// (bewusst NICHT im Modul-Grid, um die Premium-Positionierung zu schuetzen).
// Verlinkt auf die Intake-Seite mit ?email=, damit die Seite die bekannten
// Hundedaten aus dem Lead vorbefuellt.

export default function PremiumAnalyseCard({
  dogName,
  email,
  lang = "de",
}: {
  dogName?: string | null;
  email?: string | null;
  lang?: "de" | "pl" | "it";
}) {
  const dog =
    dogName?.trim() ||
    (lang === "pl" ? "Twojego psa" : lang === "it" ? "il tuo cane" : "deinen Hund");
  const href = `/premium-analyse.html${email ? `?email=${encodeURIComponent(email)}` : ""}`;

  const t =
    lang === "pl"
      ? {
          badge: "Premium · Nowość",
          heading: `Zrozum ${dog} naprawdę`,
          leadStrong: `dlaczego ${dog} tak działa`,
          intro1: "Głęboka opinia o zrozumieniu: ",
          intro2:
            " — rasa i dziedzictwo, osobowość, zdrowie i etap życia. Idealne uzupełnienie Twojego planu treningowego.",
          chips: [
            ["🔍", "Zrozum dlaczego"],
            ["🐾", "Jego prawdziwy charakter"],
            ["🩺", "Jasność zamiast obaw"],
            ["💬", "Twoje pytanie, z odpowiedzią"],
          ] as [string, string][],
          delivery: "W 48 h e-mailem",
          guarantee: "14 dni gwarancji zwrotu pieniędzy",
          cta: "Dowiedz się więcej →",
        }
      : lang === "it"
      ? {
          badge: "Premium · Novità",
          heading: `Capisci davvero ${dog}`,
          leadStrong: `perché ${dog} è fatto così`,
          intro1: "Una perizia approfondita di comprensione: ",
          intro2:
            " — razza ed eredità, personalità, salute e fase della vita. Il complemento perfetto al tuo piano di addestramento.",
          chips: [
            ["🔍", "Capire il perché"],
            ["🐾", "Il suo vero carattere"],
            ["🩺", "Chiarezza invece di preoccupazione"],
            ["💬", "La tua domanda, con risposta"],
          ] as [string, string][],
          delivery: "In 48 h via e-mail",
          guarantee: "14 giorni soddisfatti o rimborsati",
          cta: "Scopri di più →",
        }
      : {
          badge: "Premium · Neu",
          heading: `Verstehe ${dog} endlich wirklich`,
          leadStrong: `warum ${dog} so tickt`,
          intro1: "Ein tiefes Verständnis-Gutachten: ",
          intro2:
            " — Rasse & Erbe, Persönlichkeit, Gesundheit & Lebensphase. Die perfekte Ergänzung zu deinem Trainingsplan.",
          chips: [
            ["🔍", "Verstehen, warum"],
            ["🐾", "Sein wahrer Charakter"],
            ["🩺", "Klarheit statt Sorge"],
            ["💬", "Deine Frage, beantwortet"],
          ] as [string, string][],
          delivery: "In 48 h per E-Mail",
          guarantee: "14 Tage Geld-zurück-Garantie",
          cta: "Mehr erfahren →",
        };

  return (
    <a
      href={href}
      className="block mb-8 rounded-2xl border border-[#EADDC5] bg-gradient-to-b from-[#FFFDF9] to-[#FFF9F0] overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="px-5 pt-5 pb-5">
        <div className="flex items-center gap-2.5 mb-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-white bg-[#C4A576] rounded-full px-2.5 py-1">
            {t.badge}
          </span>
          <span className="text-[11.5px] font-semibold text-[#8B7355]">★★★★★ 4,8/5</span>
        </div>

        <h2 className="text-[19px] font-extrabold text-[#1a1a1a] leading-tight">
          {t.heading}
        </h2>
        <p className="text-[13.5px] text-[#6B7280] mt-2 leading-snug">
          {t.intro1}<span className="text-[#42413f] font-semibold">{t.leadStrong}</span>{t.intro2}
        </p>

        <div className="grid grid-cols-2 gap-2 mt-4">
          {t.chips.map(([ico, label]) => (
            <div key={label} className="flex items-center gap-2 text-[12.5px] text-[#42413f] bg-white/70 border border-[#EADDC5] rounded-lg px-2.5 py-2">
              <span>{ico}</span>
              <span className="font-semibold leading-tight">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 mt-4">
          <div className="text-[12.5px] text-[#6B7280] font-medium leading-snug">
            {t.delivery}<br />{t.guarantee}
          </div>
          <span className="inline-flex items-center gap-1.5 text-[14px] font-bold text-white bg-gradient-to-b from-[#caa86f] to-[#b7945a] rounded-xl px-4 py-2.5 shadow-sm">
            {t.cta}
          </span>
        </div>
      </div>
    </a>
  );
}
