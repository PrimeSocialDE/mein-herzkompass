// Dashboard-Zeile fuer den 19,99-EUR-Audio-Coach ("Coach nebenbei").
// Bewusst eine EIGENE, volle Zeile im Modul-Bereich (nicht im 9-19-EUR-Grid),
// damit die Premium-Positionierung + der Audio-Charakter herausstechen.
// Verlinkt auf die Intake-/Checkout-Seite mit ?email=, damit die bekannten
// Hundedaten vorbefuellt werden (Muster wie PremiumAnalyseCard).

export default function PfotenCoachCard({
  dogName,
  email,
}: {
  dogName?: string | null;
  email?: string | null;
}) {
  const dog = dogName?.trim() || "deinen Hund";
  const href = `/pfoten-coach.html${email ? `?email=${encodeURIComponent(email)}` : ""}`;

  const chips: [string, string][] = [
    ["🎧", "5 geführte Sessions (je 2–3 Min)"],
    ["🆘", "SOS-Hilfe für den Ausraster-Moment"],
    ["✅", "Erfolgs-Check: darf ich weiter?"],
    ["🏠", "Bonus-Themen nach Bedarf"],
  ];

  // dezente Schallwellen-Deko (rechts)
  const waveHeights = [26, 52, 80, 44, 66, 34, 58, 24];

  return (
    <a
      href={href}
      className="relative block overflow-hidden rounded-[20px] border border-[#E7D3AE] mb-8 transition-shadow hover:shadow-md"
      style={{
        background:
          "radial-gradient(120% 140% at 88% 0%, #FBEFD9 0%, rgba(251,239,217,0) 55%), linear-gradient(180deg,#FFFDF9 0%,#FFF7EA 100%)",
      }}
    >
      {/* Schallwellen rechts */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 hidden sm:flex items-center justify-end gap-[5px] pr-6 opacity-50"
        aria-hidden="true"
      >
        {waveHeights.map((h, i) => (
          <span
            key={i}
            className="w-[4px] rounded-full"
            style={{
              height: `${h}%`,
              background: "linear-gradient(180deg,#EACF9C,#D9BE86)",
            }}
          />
        ))}
      </div>

      <div className="relative px-5 pt-5 pb-5">
        <div className="flex items-center gap-2.5 mb-3.5">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-white rounded-full px-2.5 py-1 bg-gradient-to-b from-[#C9A868] to-[#B7945A]">
            🎧 Neu · Audio-Coach
          </span>
          <span className="text-[11.5px] font-bold text-[#8B7355]">★★★★★ 4,9/5</span>
        </div>

        <div className="flex items-start gap-4">
          <div
            className="flex-shrink-0 w-[62px] h-[62px] rounded-[18px] flex items-center justify-center text-[29px]"
            style={{
              background: "linear-gradient(155deg,#4a3928,#6b533a)",
              boxShadow:
                "0 10px 22px -10px rgba(74,57,40,.8), inset 0 1px 0 rgba(255,255,255,.15)",
            }}
          >
            🎧
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-extrabold text-[#1a1a1a] leading-tight">
              {dog === "deinen Hund" ? "Dein Audio-Coach" : `${dogName?.trim()}s Coach`} — dein Trainer fürs Ohr 🎧
            </h2>
            <p className="text-[13px] text-[#6B7280] mt-1.5 leading-snug">
              Ben begleitet dich <span className="text-[#42413f] font-semibold">Schritt für Schritt durch jede Übung</span> —
              geführte Sessions, Soforthilfe im Stress-Moment und ein Check, ob ihr weiter dürft. Kein Lesen, einfach zuhören.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
          {chips.map(([ico, t]) => (
            <div
              key={t}
              className="flex items-center gap-2 text-[12.5px] text-[#42413f] bg-white border border-[#EADDC5] rounded-[11px] px-2.5 py-2"
            >
              <span className="flex-shrink-0 text-[15px]">{ico}</span>
              <span className="font-semibold leading-tight">{t}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
          <div className="text-[15px]">
            <span className="font-extrabold text-[#1a1a1a] text-[22px]">19,99&nbsp;€</span>
            <span className="block text-[12px] text-[#6B7280] mt-0.5">
              Einmalig · sofort im Dashboard · auf {dog} zugeschnitten
            </span>
          </div>
          <span className="inline-flex items-center gap-2 text-[15px] font-extrabold text-white bg-gradient-to-b from-[#CAA86F] to-[#B0894E] rounded-[14px] px-5 py-3 shadow-sm">
            <span className="w-[22px] h-[22px] rounded-full bg-white/20 flex items-center justify-center text-[11px]">▶</span>
            Coach freischalten →
          </span>
        </div>
      </div>
    </a>
  );
}
