// Kopf des Modul-Shops: die Produkte, die es bisher nur ueber Kampagnen-Links
// gab. Wer im Mitgliederbereich stoebert, hat Charakterprofil und Komplettpaket
// schlicht nie gesehen.
//
// Bewusst serverseitig gerendert und ohne Interaktion: es sind Links auf die
// bestehenden Verkaufsseiten, kein zweiter Checkout-Weg, der auseinanderlaufen
// kann. Nur DE — die Produkte gibt es fuer PL/IT nicht.

type Props = {
  dogName?: string | null;
  email?: string | null;
  leadId?: string | null;
  hatProfil?: boolean;
  hatPaket?: boolean;
};

function link(pfad: string, email?: string | null, dogName?: string | null, leadId?: string | null) {
  const p = new URLSearchParams();
  if (leadId) p.set("lead_id", leadId);
  if (email) p.set("email", email);
  if (dogName?.trim()) p.set("dog", dogName.trim());
  return `${pfad}${p.toString() ? `?${p.toString()}` : ""}`;
}

export default function ShopHighlights({ dogName, email, leadId, hatProfil, hatPaket }: Props) {
  const dog = dogName?.trim() || "deinen Hund";
  const dogGen = dogName?.trim() ? `${dogName.trim()}s` : "deines Hundes";

  if (hatProfil && hatPaket) return null;

  return (
    <section className="mb-8">
      <h2 className="text-[22px] md:text-[26px] font-extrabold text-[#1a1a1a] leading-tight">
        Für {dog} empfohlen
      </h2>
      <p className="text-[12px] text-[#9CA3AF] mt-1 mb-3">
        Passend zu dem, was du uns über {dog} erzählt hast
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {/* ── Komplettpaket: der Ankerpreis ─────────────────────────── */}
        {!hatPaket && (
          <a
            href={link("/paket.html", email, dogName, leadId)}
            className="group relative block rounded-2xl border border-[#E7D3AE] p-5 overflow-hidden transition hover:shadow-lg"
            style={{ background: "linear-gradient(180deg,#FFFDF9 0%,#FFF4E1 100%)" }}
          >
            <span
              className="absolute top-0 right-0 text-[11px] font-extrabold text-white px-3 py-1 rounded-bl-xl"
              style={{ background: "linear-gradient(90deg,#C4A576,#BE9D67)" }}
            >
              Bestes Angebot
            </span>
            <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider mb-1">
              Komplettpaket
            </p>
            <p className="text-[19px] font-extrabold text-[#1a1a1a] leading-snug">
              Alles für {dog} auf einmal
            </p>
            <p className="text-[13.5px] text-[#4B5563] mt-1.5 leading-relaxed">
              Charakterprofil, alle zwölf Themen-Pläne und die Notfall-Karten. Ab morgen
              jeden Tag ein Thema im Postfach, angefangen mit deinem.
            </p>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-[26px] font-extrabold text-[#1a1a1a]">99 €</span>
              <span className="text-[14px] text-[#9CA3AF] line-through">219,77 €</span>
              <span className="text-[12px] font-extrabold text-[#2F6B34] bg-[#F2F8F0] border border-[#D6E8D0] rounded-full px-2.5 py-0.5">
                120 € gespart
              </span>
            </div>
            <p className="text-[13px] font-bold text-[#8B7355] mt-3 group-hover:underline">
              Paket ansehen →
            </p>
          </a>
        )}

        {/* ── Charakterprofil ───────────────────────────────────────── */}
        {!hatProfil && (
          <a
            href={link("/charakterprofil.html", email, dogName, leadId)}
            className="group relative block rounded-2xl border border-[#E8E4DF] bg-white p-5 overflow-hidden transition hover:shadow-lg"
          >
            <span className="absolute top-0 right-0 text-[11px] font-extrabold text-white px-3 py-1 rounded-bl-xl bg-[#8B7355]">
              Neu
            </span>
            <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider mb-1">
              Charakterprofil
            </p>
            <p className="text-[19px] font-extrabold text-[#1a1a1a] leading-snug">
              Warum {dog} so ist, wie {dogName?.trim() ? "er" : "er"} ist
            </p>
            <p className="text-[13.5px] text-[#4B5563] mt-1.5 leading-relaxed">
              Der Plan sagt, was ihr übt. Das Profil erklärt {dogGen} Rasse: Gassi-Zeiten,
              Schlafbedarf, Kopfarbeit, typische Baustellen. Mit vier Übungen.
            </p>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-[26px] font-extrabold text-[#1a1a1a]">24,90 €</span>
              <span className="text-[14px] text-[#9CA3AF] line-through">39,90 €</span>
            </div>
            <p className="text-[13px] font-bold text-[#8B7355] mt-3 group-hover:underline">
              Profil ansehen →
            </p>
          </a>
        )}
      </div>

      <p className="text-[12px] text-[#9CA3AF] mt-3 text-center">
        🔒 Sichere Zahlung · Kein Abo · 30 Tage Geld-zurück-Garantie
      </p>
    </section>
  );
}
