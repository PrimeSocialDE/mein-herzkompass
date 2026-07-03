// Dashboard-Zeile fuer den 19,99-EUR-Audio-Coach ("Coach nebenbei").
// Bewusst eine EIGENE, volle Zeile im Themen-Modul-Bereich (nicht im Grid),
// damit die Premium-Positionierung + der Audio-Charakter herausstechen.
// Auf Mobile bewusst kompakt (kleinere Paddings/Fonts, 2x2-Chips).
// Verlinkt auf die Intake-/Checkout-Seite mit ?email= (Muster wie PremiumAnalyseCard).

export default function PfotenCoachCard({
  dogName,
  email,
}: {
  dogName?: string | null;
  email?: string | null;
}) {
  const dog = dogName?.trim() || "deinen Hund";
  const params = new URLSearchParams();
  if (email) params.set("email", email);
  if (dogName?.trim()) params.set("dog", dogName.trim());
  const href = `/pfoten-coach${params.toString() ? `?${params.toString()}` : ""}`;

  const chips: [string, string][] = [
    ["🎧", "5 Sessions · 2–3 Min"],
    ["🆘", "SOS-Soforthilfe"],
    ["✅", "Erfolgs-Check"],
    ["🏠", "Bonus-Themen"],
  ];

  const waveHeights = [26, 52, 80, 44, 66, 34, 58, 24];

  return (
    <a
      href={href}
      className="relative block overflow-hidden rounded-[18px] border border-[#E7D3AE] mb-5 sm:mb-8 transition-shadow hover:shadow-md"
      style={{
        background:
          "radial-gradient(120% 140% at 88% 0%, #FBEFD9 0%, rgba(251,239,217,0) 55%), linear-gradient(180deg,#FFFDF9 0%,#FFF7EA 100%)",
      }}
    >
      {/* Schallwellen rechts (nur Desktop) */}
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

      <div className="relative p-3.5 sm:px-5 sm:pt-5 sm:pb-5">
        <div className="flex items-center gap-2 mb-2 sm:mb-3.5">
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wide text-white rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 bg-gradient-to-b from-[#C9A868] to-[#B7945A]">
            🎧 Neu · Audio-Coach
          </span>
          <span className="text-[11px] font-bold text-[#8B7355]">★★★★★ 4,9/5</span>
        </div>

        <div className="flex items-start gap-2.5 sm:gap-4">
          <div
            className="flex-shrink-0 w-[42px] h-[42px] sm:w-[62px] sm:h-[62px] rounded-[13px] sm:rounded-[18px] overflow-hidden border border-[#E7D3AE]"
            style={{
              boxShadow:
                "0 10px 22px -10px rgba(74,57,40,.6), inset 0 1px 0 rgba(255,255,255,.15)",
            }}
          >
            <img
              src="/audio-coach-icon.jpg"
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[16px] sm:text-[20px] font-extrabold text-[#1a1a1a] leading-tight">
              {dog === "deinen Hund" ? "Dein Audio-Coach" : `${dogName?.trim()}s Coach`} — dein Trainer fürs Ohr 🎧
            </h2>
            <p className="text-[11.5px] sm:text-[13px] text-[#6B7280] mt-1 sm:mt-1.5 leading-snug">
              Ben begleitet dich <span className="text-[#42413f] font-semibold">Schritt für Schritt durch jede Übung</span> —
              geführte Sessions, Soforthilfe und ein Check, ob ihr weiter dürft.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mt-3 sm:mt-4">
          {chips.map(([ico, t]) => (
            <div
              key={t}
              className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-[12.5px] text-[#42413f] bg-white border border-[#EADDC5] rounded-[10px] px-2 py-1.5 sm:px-2.5 sm:py-2"
            >
              <span className="flex-shrink-0 text-[13px] sm:text-[15px]">{ico}</span>
              <span className="font-semibold leading-tight">{t}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 mt-3 sm:mt-4 flex-wrap">
          <div className="text-[14px]">
            <span className="font-extrabold text-[#1a1a1a] text-[19px] sm:text-[22px]">19,99&nbsp;€</span>
            <span className="block text-[11px] sm:text-[12px] text-[#6B7280] mt-0.5">
              Einmalig · auf {dog} zugeschnitten
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 sm:gap-2 text-[13.5px] sm:text-[15px] font-extrabold text-white bg-gradient-to-b from-[#CAA86F] to-[#B0894E] rounded-[12px] sm:rounded-[14px] px-4 py-2.5 sm:px-5 sm:py-3 shadow-sm">
            <span className="w-[20px] h-[20px] sm:w-[22px] sm:h-[22px] rounded-full bg-white/20 flex items-center justify-center text-[10px] sm:text-[11px]">▶</span>
            Coach freischalten →
          </span>
        </div>
      </div>
    </a>
  );
}
