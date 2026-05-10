// View für User die noch GAR KEINEN Plan gekauft haben.
// Lean-Variante: Outcome-fokussiert ('selbst loesen, ohne Hundeschule'),
// Image-Header pro Karte, Payment-Logo-Strip statt Feature-Grid.
//
// Klick auf Plan-Karte → fetch /api/mollie/wauwerk-checkout, dann
// direkter Redirect zur Mollie-Hosted-Page.

"use client";

import { useState } from "react";

interface PlanOption {
  key: "1month" | "3month" | "6month";
  months: number;
  weeks: number;
  price: string;
  daily: string;
  popular: boolean;
  badge: string | null;
  tagline: string;
  image: string;
  bullets: { icon: string; text: string }[];
}

const PLANS: PlanOption[] = [
  {
    key: "1month",
    months: 1,
    weeks: 4,
    price: "29,99",
    daily: "99 Cent",
    popular: false,
    badge: "Intensiv",
    tagline: "Erste Erfolge in 4 Wochen",
    image: "/plan-1m-placeholder.svg",
    bullets: [
      { icon: "⚡", text: "Täglich kurz trainieren" },
      { icon: "🎯", text: "Basis-Übungen für 1 Thema" },
      { icon: "💪", text: "Schnell sichtbare Erfolge" },
    ],
  },
  {
    key: "3month",
    months: 3,
    weeks: 12,
    price: "39,99",
    daily: "44 Cent",
    popular: true,
    badge: "Beliebt",
    tagline: "Im Wohlfühl-Tempo, klare Ergebnisse",
    image: "/plan-3m-placeholder.svg",
    bullets: [
      { icon: "📚", text: "Mehr Übungen für mehr Tiefe" },
      { icon: "🌿", text: "3× pro Woche reicht" },
      { icon: "⚖️", text: "Mehrere Themen abgedeckt" },
    ],
  },
  {
    key: "6month",
    months: 6,
    weeks: 24,
    price: "59,99",
    daily: "33 Cent",
    popular: false,
    badge: "Komplett",
    tagline: "Ganz in Ruhe, richtig beherrschen",
    image: "/plan-6m-placeholder.svg",
    bullets: [
      { icon: "🐾", text: "Alle Übungen — wirklich vertiefen" },
      { icon: "🌳", text: "Alle 10 Themen-Module inklusive" },
      { icon: "🛋️", text: "Im eigenen Tempo, kein Druck" },
    ],
  },
];

export default function PlanOptionsCard({
  dogName,
  email,
  leadId,
}: {
  dogName?: string | null;
  email: string;
  leadId?: string | null;
}) {
  const dog = dogName?.trim() || "deinem Hund";

  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function startCheckout(planKey: PlanOption["key"]) {
    if (loadingKey) return;
    setLoadingKey(planKey);
    setError("");
    try {
      const res = await fetch("/api/mollie/wauwerk-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planKey,
          email,
          leadId: leadId || undefined,
          dogName: dogName || undefined,
          utm_source: "member-area",
          utm_campaign: "upgrade",
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Konnte Checkout nicht starten");
        setLoadingKey(null);
      }
    } catch (e) {
      setError("Verbindungsfehler. Versuch's gleich nochmal.");
      setLoadingKey(null);
    }
  }

  return (
    <section className="space-y-6">
      {/* Outcome-Hero — kurz, klar, ohne Marketing-Geschwurbel */}
      <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-2xl p-5 md:p-6">
        <h2 className="text-[20px] md:text-[24px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight mb-1.5">
          Probleme mit {dog} selbst lösen
        </h2>
        <p className="text-[14px] text-[#4B5563] leading-relaxed">
          Schritt für Schritt, im eigenen Tempo, von zuhause aus — ohne
          teure Hundeschule, ohne Stress.
        </p>
      </div>

      {/* Plan-Cards mit Bild-Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PLANS.map((p) => {
          const isLoading = loadingKey === p.key;
          const anyLoading = !!loadingKey;
          return (
            <button
              key={p.key}
              onClick={() => startCheckout(p.key)}
              disabled={anyLoading}
              className={`relative text-left bg-white rounded-2xl border overflow-hidden flex flex-col disabled:opacity-60 ${
                p.popular
                  ? "border-[#C4A576] shadow-[0_4px_16px_rgba(196,165,118,0.18)]"
                  : "border-[#EADDC5]"
              }`}
            >
              {/* Image-Header */}
              <div className="relative aspect-[16/9] bg-[#FAF4E8] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image}
                  alt={p.badge || `${p.months}-Monats-Plan`}
                  className="w-full h-full object-cover"
                />
                {p.badge && (
                  <div
                    className={`absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      p.popular
                        ? "bg-[#C4A576] text-white"
                        : "bg-white/90 text-[#8B7355]"
                    }`}
                  >
                    {p.badge}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 flex flex-col flex-1">
                <p className="text-[14px] font-bold text-[#1a1a1a] leading-tight mb-2">
                  {p.tagline}
                </p>

                {/* 3 Differenzierungs-Bullets pro Plan */}
                <ul className="space-y-1 mb-3">
                  {p.bullets.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-[12px] text-[#4B5563] leading-snug"
                    >
                      <span className="flex-shrink-0">{b.icon}</span>
                      <span>{b.text}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex items-baseline gap-1">
                  <span className="text-[26px] font-extrabold text-[#1a1a1a]">
                    €{p.price.split(",")[0]}
                  </span>
                  <span className="text-[12px] text-[#9CA3AF]">
                    ,{p.price.split(",")[1]}
                  </span>
                </div>
                <div className="text-[11px] text-[#6B7280] mb-3">
                  Nur <strong>{p.daily} am Tag</strong> · einmalig
                </div>

                <div
                  className={`mt-auto text-center font-semibold py-2.5 px-4 rounded-xl text-[13px] ${
                    p.popular
                      ? "bg-[#C4A576] text-white shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
                      : "bg-[#FAFAFA] text-[#1a1a1a] border border-[#EADDC5]"
                  }`}
                >
                  {isLoading ? "Lade…" : "Plan wählen →"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-[12px] text-[#B91C1C] text-center">{error}</p>
      )}

      {/* Trust + Payment-Logos kompakt */}
      <div className="bg-white border border-[#EADDC5] rounded-2xl p-4">
        <p className="text-[12px] text-[#15803D] font-semibold text-center mb-3">
          🔒 30 Tage Geld-zurück · Sichere Zahlung über Mollie
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap opacity-90">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/visa-logo.png" alt="Visa" className="h-6 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mastercard-logo.png"
            alt="Mastercard"
            className="h-6 w-auto"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/PayPal3.png" alt="PayPal" className="h-5 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/applepay.png" alt="Apple Pay" className="h-5 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sepa-logo.png" alt="SEPA" className="h-5 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/klarna-logo.png" alt="Klarna" className="h-5 w-auto" />
        </div>
      </div>
    </section>
  );
}
