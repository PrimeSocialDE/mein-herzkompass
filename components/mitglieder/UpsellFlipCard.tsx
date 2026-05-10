"use client";

// Flip-Karte fuer Modul-Shop. Front: Preview + Preis. Klick auf
// 'Mehr Infos' dreht die Karte zu Inhaltsliste + Kauf-Button.
// Kauf laeuft direkt ueber Mollie-Checkout (upsell-product).

import { useState } from "react";

interface Upsell {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  badge_text: string | null;
  price_cents: number;
  image_url?: string | null;
}

interface Props {
  upsell: Upsell;
  features: string[];
  emoji: string;
  email: string;
  leadId: string | null;
  dogName: string | null;
}

export default function UpsellFlipCard({
  upsell,
  features,
  emoji,
  email,
  leadId,
  dogName,
}: Props) {
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleBuy() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mollie/upsell-product-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: upsell.slug,
          email,
          leadId: leadId || "",
          dogName: dogName || undefined,
          returnUrl: window.location.pathname,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Konnte Checkout nicht starten");
        setLoading(false);
      }
    } catch (e) {
      setError("Verbindungsfehler. Versuch's gleich nochmal.");
      setLoading(false);
    }
  }

  const priceFormatted = `€${(upsell.price_cents / 100)
    .toFixed(2)
    .replace(".", ",")}`;

  return (
    <div className="relative w-full" style={{ perspective: "1000px" }}>
      <div
        className="relative w-full aspect-[3/4] transition-transform duration-700 ease-out"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* ── FRONT ──────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 bg-white border border-[#EADDC5] rounded-xl overflow-hidden flex flex-col shadow-[0_2px_8px_rgba(139,115,85,0.06)]"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          {/* Bild oder Gradient mit Emoji */}
          <div className="relative aspect-[4/3] bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] flex items-center justify-center overflow-hidden flex-shrink-0">
            {upsell.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={upsell.image_url}
                alt={upsell.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[42px] leading-none">{emoji}</span>
            )}
            {upsell.badge_text && (
              <span className="absolute top-1.5 left-1.5 text-[8px] font-bold uppercase tracking-wider bg-white/90 backdrop-blur-sm text-[#8B7355] px-1.5 py-0.5 rounded">
                {upsell.badge_text}
              </span>
            )}
          </div>

          <div className="flex-1 p-3 flex flex-col">
            <h3 className="text-[13px] font-extrabold text-[#1a1a1a] leading-tight mb-1 line-clamp-2">
              {upsell.title}
            </h3>

            <div className="mt-auto">
              <div className="text-[16px] font-extrabold text-[#1a1a1a] mb-2 leading-none">
                {priceFormatted}
              </div>
              <button
                onClick={() => setFlipped(true)}
                className="w-full bg-[#FAFAFA] hover:bg-[#F0EBE3] text-[#1a1a1a] font-semibold py-1.5 px-2 rounded-lg text-[11px] transition border border-[#EADDC5]"
              >
                Mehr Infos →
              </button>
            </div>
          </div>
        </div>

        {/* ── BACK ───────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#FFFDF8] to-white border-2 border-[#C4A576] rounded-xl overflow-hidden p-3 flex flex-col shadow-[0_4px_16px_rgba(196,165,118,0.15)]"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <button
            onClick={() => setFlipped(false)}
            className="self-start text-[10px] text-[#9CA3AF] hover:text-[#1a1a1a] mb-1.5"
            aria-label="Zurück"
          >
            ← Zurück
          </button>

          <h3 className="text-[13px] font-extrabold text-[#1a1a1a] mb-2 leading-tight">
            {upsell.title}
          </h3>

          <ul className="space-y-1 mb-2 flex-1 overflow-y-auto">
            {features.map((f, i) => (
              <li
                key={i}
                className="flex gap-1.5 items-start text-[11px] text-[#1a1a1a] leading-snug"
              >
                <span className="text-[#C4A576] flex-shrink-0 font-bold">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={handleBuy}
            disabled={loading}
            className="w-full bg-[#C4A576] hover:bg-[#B5946A] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded-lg text-[12px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            {loading ? "Lade…" : `Für ${priceFormatted} kaufen`}
          </button>
          {error && (
            <p className="text-[10px] text-[#B91C1C] text-center mt-1">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
