"use client";

// Flip-Karte fuer Modul-Shop. Front: Preview + Preis. Klick auf
// 'Mehr Infos' dreht die Karte zu Inhaltsliste + Kauf-Button.
// Kauf oeffnet das CheckoutModal — In-Place via Mollie Components,
// kein Redirect zu Mollie-Hosted-Page.

import { useState } from "react";
import CheckoutModal from "./CheckoutModal";

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
  const [showCheckout, setShowCheckout] = useState(false);

  function handleBuy() {
    setShowCheckout(true);
  }

  const priceFormatted = `€${(upsell.price_cents / 100)
    .toFixed(2)
    .replace(".", ",")}`;

  return (
    <div className="relative w-full" style={{ perspective: "1000px" }}>
      <div
        className="relative w-full aspect-[5/8] transition-transform duration-700 ease-out"
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
          {/* Bild oder Gradient mit Emoji — 1:1 damit quadratische Bilder
              (1080x1080) komplett sichtbar sind, kein Crop. */}
          <div className="relative aspect-square bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] flex items-center justify-center overflow-hidden flex-shrink-0">
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

          <div className="flex-1 p-2.5 flex flex-col">
            <h3 className="text-[12px] font-extrabold text-[#1a1a1a] leading-tight mb-1 line-clamp-2">
              {upsell.title}
            </h3>

            <p className="text-[10px] text-[#6B7280] leading-snug">
              8 Übungen für {dogName?.trim() || "deinen Hund"}
            </p>
            <p className="text-[9px] text-[#9CA3AF] leading-snug mt-0.5 flex items-center gap-1">
              <span className="text-[#16A34A]">✓</span>
              <span>Einmalig · kein Abo</span>
            </p>

            <button
              onClick={() => setFlipped(true)}
              className="mt-auto w-full bg-[#FAFAFA] hover:bg-[#F0EBE3] text-[#1a1a1a] font-semibold py-1.5 px-2 rounded-lg text-[11px] transition border border-[#EADDC5] flex items-center justify-between gap-1"
            >
              <span className="font-extrabold">{priceFormatted}</span>
              <span className="text-[#8B7355]">Mehr →</span>
            </button>
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
            className="w-full bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-2 px-3 rounded-lg text-[12px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            Für {priceFormatted} kaufen
          </button>
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal
          upsell={{
            slug: upsell.slug,
            title: upsell.title,
            price_cents: upsell.price_cents,
            emoji,
          }}
          email={email}
          leadId={leadId}
          dogName={dogName}
          onClose={() => setShowCheckout(false)}
        />
      )}
    </div>
  );
}
