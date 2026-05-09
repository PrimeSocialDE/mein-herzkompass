// View für User die noch GAR KEINEN Plan gekauft haben.
// Zeigt 1/3/6-Monats-Optionen mit klarem Hinweis dass danach Module
// im Mitgliederbereich freigeschaltet werden.

"use client";

const PLANS = [
  { months: 1, price: 29, daily: "99 Cent", popular: false },
  { months: 3, price: 39, daily: "44 Cent", popular: true },
  { months: 6, price: 59, daily: "33 Cent", popular: false },
];

export default function PlanOptionsCard({ dogName }: { dogName?: string | null }) {
  const dog = dogName || "deinen Hund";

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-[20px] md:text-[24px] font-extrabold tracking-tight text-[#1a1a1a] mb-2">
          Schließe deinen Trainings-Plan ab
        </h2>
        <p className="text-[14px] text-[#6B7280] leading-relaxed">
          Damit alle Module hier für {dog} freigeschaltet werden, brauchst du
          einen Plan. Wähle deine Laufzeit:
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PLANS.map((p) => (
          <a
            key={p.months}
            href={`/deinplan4.html?utm_source=member-area&utm_campaign=upgrade&plan=${p.months}month`}
            className={`relative bg-white rounded-2xl border p-5 transition hover:border-[#C4A576] block ${
              p.popular ? "border-[#C4A576] shadow-[0_4px_16px_rgba(196,165,118,0.15)]" : "border-[#EADDC5]"
            }`}
          >
            {p.popular && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#C4A576] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                Beliebt
              </div>
            )}
            <div className="text-[12px] text-[#8B7355] font-semibold uppercase tracking-wide mb-1">
              {p.months}-Monats-Plan
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[28px] font-extrabold text-[#1a1a1a]">€{p.price}</span>
              <span className="text-[12px] text-[#9CA3AF]">,99</span>
            </div>
            <div className="text-[12px] text-[#6B7280]">
              Umgerechnet nur <strong>{p.daily} am Tag</strong>
            </div>
            <div className="mt-3 text-[11px] text-[#9CA3AF]">Einmalig · kein Abo</div>
          </a>
        ))}
      </div>

      <div className="bg-[#FFF9F0] border border-[#EADDC5] rounded-xl p-4 flex items-start gap-3">
        <div className="text-2xl leading-none">🔒</div>
        <div>
          <p className="text-[13px] font-semibold text-[#1a1a1a] mb-0.5">
            30 Tage Geld-zurück-Garantie
          </p>
          <p className="text-[12px] text-[#6B7280] leading-relaxed">
            Wenn dir der Plan nichts bringt, kriegst du dein Geld zurück. Eine
            Mail genügt — keine Begründung nötig.
          </p>
        </div>
      </div>
    </section>
  );
}
