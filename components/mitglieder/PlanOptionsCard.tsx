// View für User die noch GAR KEINEN Plan gekauft haben.
// Premium-Feel: Outcome-Versprechen, Feature-Grid und 3 Plan-Karten
// mit klarer Differenzierung — damit User den vollen Wert sehen
// bevor sie auf den Preis schauen.

"use client";

interface PlanOption {
  months: number;
  weeks: number;
  price: string;          // 'XX,99'
  daily: string;          // 'XX Cent'
  popular: boolean;
  badge: string | null;   // Top-Pille
  tagline: string;        // 1-Satz-Versprechen
  bullets: string[];      // 2-3 Bullets pro Plan
}

const PLANS: PlanOption[] = [
  {
    months: 1,
    weeks: 4,
    price: "29,99",
    daily: "99 Cent",
    popular: false,
    badge: "Quick-Start",
    tagline: "In 4 Wochen das Problem im Griff",
    bullets: [
      "4 Wochen Trainings-Plan",
      "Fokus auf dein Hauptthema",
      "Alle Erfolge & Tipps inklusive",
    ],
  },
  {
    months: 3,
    weeks: 12,
    price: "39,99",
    daily: "44 Cent",
    popular: true,
    badge: "Beliebt",
    tagline: "12 Wochen für eine echte Verhaltens-Umstellung",
    bullets: [
      "12 Wochen Schritt-für-Schritt-Plan",
      "Alle Verhaltens-Themen abgedeckt",
      "Bestes Preis-Leistungs-Verhältnis",
    ],
  },
  {
    months: 6,
    weeks: 24,
    price: "59,99",
    daily: "33 Cent",
    popular: false,
    badge: "Komplett-Paket",
    tagline: "Tiefgang über 24 Wochen, mit allen Themen-Modulen",
    bullets: [
      "24 Wochen voller Trainings-Plan",
      "Alle 10 Themen-Module inklusive",
      "Genug Zeit für nachhaltige Erfolge",
    ],
  },
];

const FEATURES: { emoji: string; title: string; body: string }[] = [
  {
    emoji: "🎯",
    title: "Auf dein Problem zugeschnitten",
    body: "Übungen wählen wir nach deinem Quiz-Ergebnis aus.",
  },
  {
    emoji: "🏆",
    title: "Wochen-Aufgaben & Erfolge",
    body: "Spielerisch dranbleiben, Badges sammeln.",
  },
  {
    emoji: "🗺️",
    title: "Plan-Coaching mit Tagestipp",
    body: "Du siehst täglich, was als Nächstes dran ist.",
  },
  {
    emoji: "🤖",
    title: "KI-Trainer 24/7",
    body: "Fragen direkt im Chat, sofort Antwort.",
  },
  {
    emoji: "📧",
    title: "E-Mail-Support vom Team",
    body: "Bei kniffligen Themen antwortet ein echter Trainer.",
  },
  {
    emoji: "📄",
    title: "PDF zum Ausdrucken",
    body: "Plan auch offline am Kühlschrank kleben.",
  },
];

export default function PlanOptionsCard({
  dogName,
}: {
  dogName?: string | null;
}) {
  const dog = dogName?.trim() || "deinen Hund";
  const dogPossessive = dogName?.trim() ? `${dogName}s` : "Eure";

  return (
    <section className="space-y-8">
      {/* Outcome-Versprechen */}
      <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-2xl p-5 md:p-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1.5">
          Das Versprechen
        </p>
        <h2 className="text-[20px] md:text-[24px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight mb-2">
          {dogPossessive} Verhaltens-Thema in einem klaren Zeitrahmen lösen
        </h2>
        <p className="text-[14px] text-[#4B5563] leading-relaxed">
          Die Übungen sind so aufgebaut, dass {dog} das Hauptthema innerhalb
          deiner Plan-Laufzeit Schritt für Schritt abtrainiert — nichts
          Schwammiges, sondern klar planbare Wochenziele.
        </p>
      </div>

      {/* Feature-Grid */}
      <div>
        <h2 className="text-[18px] md:text-[20px] font-bold text-[#1a1a1a] mb-3">
          Alles was im Plan drin ist
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white border border-[#EADDC5] rounded-xl p-4 flex gap-3"
            >
              <span className="text-[24px] flex-shrink-0 leading-none">
                {f.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[#1a1a1a] leading-tight mb-0.5">
                  {f.title}
                </p>
                <p className="text-[12px] text-[#6B7280] leading-snug">
                  {f.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan-Cards */}
      <div>
        <h2 className="text-[18px] md:text-[20px] font-bold text-[#1a1a1a] mb-3">
          Wähle deine Laufzeit
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PLANS.map((p) => (
            <a
              key={p.months}
              href={`/deinplan4.html?utm_source=member-area&utm_campaign=upgrade&plan=${p.months}month`}
              className={`relative bg-white rounded-2xl border p-5 block flex flex-col ${
                p.popular
                  ? "border-[#C4A576] shadow-[0_4px_16px_rgba(196,165,118,0.15)]"
                  : "border-[#EADDC5]"
              }`}
            >
              {p.badge && (
                <div
                  className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                    p.popular
                      ? "bg-[#C4A576] text-white"
                      : "bg-[#F0EBE3] text-[#8B7355]"
                  }`}
                >
                  {p.badge}
                </div>
              )}

              <div className="text-[12px] text-[#8B7355] font-semibold uppercase tracking-wide mb-1 mt-1">
                {p.months}-Monats-Plan · {p.weeks} Wochen
              </div>

              <p className="text-[13px] font-bold text-[#1a1a1a] leading-tight mb-3 min-h-[34px]">
                {p.tagline}
              </p>

              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[28px] font-extrabold text-[#1a1a1a]">
                  €{p.price.split(",")[0]}
                </span>
                <span className="text-[12px] text-[#9CA3AF]">
                  ,{p.price.split(",")[1]}
                </span>
              </div>
              <div className="text-[11px] text-[#6B7280] mb-4">
                Umgerechnet nur <strong>{p.daily} am Tag</strong> · einmalig,
                kein Abo
              </div>

              <ul className="space-y-1.5 mb-4 flex-1">
                {p.bullets.map((b, i) => (
                  <li
                    key={i}
                    className="flex gap-1.5 items-start text-[12px] text-[#1a1a1a] leading-snug"
                  >
                    <span className="text-[#C4A576] flex-shrink-0 font-bold">
                      ✓
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div
                className={`text-center font-semibold py-2.5 px-4 rounded-xl text-[13px] ${
                  p.popular
                    ? "bg-[#C4A576] text-white shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
                    : "bg-[#FAFAFA] text-[#1a1a1a] border border-[#EADDC5]"
                }`}
              >
                Plan wählen →
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Trust-Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 flex items-start gap-3">
          <div className="text-[22px] leading-none flex-shrink-0">🔒</div>
          <div>
            <p className="text-[13px] font-semibold text-[#166534] mb-0.5">
              30 Tage Geld-zurück
            </p>
            <p className="text-[12px] text-[#15803D] leading-relaxed">
              Bringt's nichts? Eine Mail genügt — keine Begründung nötig.
            </p>
          </div>
        </div>
        <div className="bg-[#FFF9F0] border border-[#EADDC5] rounded-xl p-4 flex items-start gap-3">
          <div className="text-[22px] leading-none flex-shrink-0">💳</div>
          <div>
            <p className="text-[13px] font-semibold text-[#1a1a1a] mb-0.5">
              Sichere Zahlung
            </p>
            <p className="text-[12px] text-[#6B7280] leading-relaxed">
              Karte, PayPal, Apple Pay, SEPA, Klarna — alles via Mollie.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
