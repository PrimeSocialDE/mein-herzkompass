// Dashboard-Einstieg fuer die 79-EUR-Premium-Analyse. Eigene, visuelle Karte
// (bewusst NICHT im Modul-Grid, um die Premium-Positionierung zu schuetzen).
// Verlinkt auf die Intake-Seite mit ?email=, damit die Seite die bekannten
// Hundedaten aus dem Lead vorbefuellt.

export default function PremiumAnalyseCard({
  dogName,
  email,
}: {
  dogName?: string | null;
  email?: string | null;
}) {
  const dog = dogName?.trim() || "deinen Hund";
  const href = `/premium-analyse.html${email ? `?email=${encodeURIComponent(email)}` : ""}`;

  return (
    <a
      href={href}
      className="block mb-8 rounded-2xl border border-[#EADDC5] bg-gradient-to-b from-[#FFFDF9] to-[#FFF9F0] overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="px-5 pt-5 pb-5">
        <div className="flex items-center gap-2.5 mb-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-white bg-[#C4A576] rounded-full px-2.5 py-1">
            Premium · Neu
          </span>
          <span className="text-[11.5px] font-semibold text-[#8B7355]">★★★★★ 4,8/5</span>
        </div>

        <h2 className="text-[19px] font-extrabold text-[#1a1a1a] leading-tight">
          Verstehe {dog} endlich wirklich
        </h2>
        <p className="text-[13.5px] text-[#6B7280] mt-2 leading-snug">
          Ein tiefes Verständnis-Gutachten: <span className="text-[#42413f] font-semibold">warum {dog} so tickt</span> —
          Rasse &amp; Erbe, Persönlichkeit, Gesundheit &amp; Lebensphase. Die perfekte Ergänzung zu deinem Trainingsplan.
        </p>

        <div className="grid grid-cols-2 gap-2 mt-4">
          {[
            ["🔍", "Verstehen, warum"],
            ["🐾", "Sein wahrer Charakter"],
            ["🩺", "Klarheit statt Sorge"],
            ["💬", "Deine Frage, beantwortet"],
          ].map(([ico, t]) => (
            <div key={t} className="flex items-center gap-2 text-[12.5px] text-[#42413f] bg-white/70 border border-[#EADDC5] rounded-lg px-2.5 py-2">
              <span>{ico}</span>
              <span className="font-semibold leading-tight">{t}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 mt-4">
          <div className="text-[12.5px] text-[#6B7280] font-medium leading-snug">
            In 48&nbsp;h per E-Mail<br />14&nbsp;Tage Geld-zurück-Garantie
          </div>
          <span className="inline-flex items-center gap-1.5 text-[14px] font-bold text-white bg-gradient-to-b from-[#caa86f] to-[#b7945a] rounded-xl px-4 py-2.5 shadow-sm">
            Mehr erfahren →
          </span>
        </div>
      </div>
    </a>
  );
}
