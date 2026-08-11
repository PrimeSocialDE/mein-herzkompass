// Dashboard-Zeile fuer das "Pfoten-Plan Club"-Abo (7,99 EUR/Monat).
// Kompakter TEASER ganz oben im Modul-Bereich — nur die Merkmale als Chips,
// kein Fliesstext. Die ganze Story steht auf /mitglieder/club.
// Ersetzt die fruehere Audio-Coach-Karte.

export default function ClubAboCard({
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
  const params = new URLSearchParams();
  if (email) params.set("email", email);
  if (dogName?.trim()) params.set("dog", dogName.trim());
  const href = `/mitglieder/club${params.toString() ? `?${params.toString()}` : ""}`;

  const t =
    lang === "pl"
      ? {
          bannerAlt: "Osobista pomoc treningowa dla Twojego psa",
          badge: "⭐ Nowość · Klub",
          headline: `Koniec z bezradnością przy ${dog}`,
          chips: [
            ["🎥", "Wideo-feedback"],
            ["🔄", "Plan rośnie z psem"],
            ["🆘", "Zawsze przy Tobie"],
            ["📦", "Wszystkie moduły tematyczne"],
          ] as [string, string][],
          perMonth: "/ miesiąc",
          cta: "Zobacz →",
        }
      : lang === "it"
      ? {
          bannerAlt: "Aiuto personale all'addestramento per il tuo cane",
          badge: "⭐ Novità · Club",
          headline: `Mai più senza risposte con ${dog}`,
          chips: [
            ["🎥", "Feedback video"],
            ["🔄", "Il piano cresce con lui"],
            ["🆘", "Sempre al tuo fianco"],
            ["📦", "Tutti i moduli tematici"],
          ] as [string, string][],
          perMonth: "/ mese",
          cta: "Scopri →",
        }
      : {
          bannerAlt: "Persönliche Trainings-Hilfe für deinen Hund",
          badge: "⭐ Neu · Club",
          headline: `Nie wieder ratlos mit ${dog}`,
          chips: [
            ["🎥", "Video-Feedback"],
            ["🔄", "Plan wächst mit"],
            ["🆘", "Immer für dich da"],
            ["📦", "Alle Themen-Module"],
          ] as [string, string][],
          perMonth: "/ Monat",
          cta: "Ansehen →",
        };
  const chips = t.chips;

  return (
    <a
      href={href}
      className="relative block overflow-hidden rounded-[18px] border border-[#E7D3AE] mb-5 sm:mb-7 transition-shadow hover:shadow-md"
      style={{
        background:
          "radial-gradient(120% 140% at 88% 0%, #F6E7C9 0%, rgba(246,231,201,0) 55%), linear-gradient(180deg,#FFFDF9 0%,#FFF4E1 100%)",
      }}
    >
      {/* Abo-Foto als schmales Banner oben */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/AboFoto.jpg"
        alt={t.bannerAlt}
        className="block w-full h-[128px] sm:h-[150px] object-cover"
        style={{ objectPosition: "center 42%" }}
      />

      <div className="relative px-3.5 pt-2.5 pb-3 sm:px-4 sm:pt-3 sm:pb-3.5">
        {/* Badge + Headline */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-white rounded-full px-2 py-0.5 bg-gradient-to-b from-[#C9A868] to-[#B7945A]">
            {t.badge}
          </span>
          <span className="text-[13px] sm:text-[14px] font-extrabold text-[#1a1a1a] leading-tight">
            {t.headline}
          </span>
        </div>

        {/* Merkmale als Chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chips.map(([icon, text]) => (
            <span
              key={text}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5B5347] bg-[#FCF4E3] border border-[#EADDC5] rounded-full px-2 py-0.5"
            >
              <span className="text-[12px]">{icon}</span>
              {text}
            </span>
          ))}
        </div>

        {/* Preis + CTA */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1">
            <span className="text-[19px] font-extrabold text-[#1a1a1a]">7,99&nbsp;€</span>
            <span className="text-[11px] font-semibold text-[#6B7280]">{t.perMonth}</span>
          </div>
          <span className="inline-flex items-center justify-center rounded-full px-4 py-1.5 text-[13px] font-extrabold text-white bg-gradient-to-b from-[#C9A868] to-[#B7945A] shadow-sm">
            {t.cta}
          </span>
        </div>
      </div>
    </a>
  );
}
