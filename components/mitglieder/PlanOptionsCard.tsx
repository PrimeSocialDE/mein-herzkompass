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
    image: "/1Monat.jpg",
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
    image: "/3Monat.jpg",
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
    image: "/6Monat.jpg",
    bullets: [
      { icon: "🐾", text: "Alle Übungen — wirklich vertiefen" },
      { icon: "🌳", text: "Alle 10 Themen-Module inklusive" },
      { icon: "🛋️", text: "Im eigenen Tempo, kein Druck" },
    ],
  },
];

const PLANS_PL: PlanOption[] = [
  {
    key: "1month",
    months: 1,
    weeks: 4,
    price: "109",
    daily: "3,60 zł",
    popular: false,
    badge: "Intensywnie",
    tagline: "Pierwsze efekty w 4 tygodnie",
    image: "/1Monat.jpg",
    bullets: [
      { icon: "⚡", text: "Codziennie krótki trening" },
      { icon: "🎯", text: "Ćwiczenia bazowe na 1 temat" },
      { icon: "💪", text: "Szybko widoczne efekty" },
    ],
  },
  {
    key: "3month",
    months: 3,
    weeks: 12,
    price: "149",
    daily: "1,70 zł",
    popular: true,
    badge: "Popularny",
    tagline: "We własnym tempie, jasne rezultaty",
    image: "/3Monat.jpg",
    bullets: [
      { icon: "📚", text: "Więcej ćwiczeń, większa głębia" },
      { icon: "🌿", text: "Wystarczą 3× w tygodniu" },
      { icon: "⚖️", text: "Kilka tematów objętych planem" },
    ],
  },
  {
    key: "6month",
    months: 6,
    weeks: 24,
    price: "229",
    daily: "1,30 zł",
    popular: false,
    badge: "Komplet",
    tagline: "Zupełnie na spokojnie, do mistrzostwa",
    image: "/6Monat.jpg",
    bullets: [
      { icon: "🐾", text: "Wszystkie ćwiczenia — realnie pogłębione" },
      { icon: "🌳", text: "Wszystkie 10 modułów tematycznych" },
      { icon: "🛋️", text: "We własnym tempie, bez presji" },
    ],
  },
];

export default function PlanOptionsCard({
  dogName,
  email,
  leadId,
  lang = "de",
}: {
  dogName?: string | null;
  email: string;
  leadId?: string | null;
  lang?: "de" | "pl";
}) {
  const isPL = lang === "pl";
  const dog = dogName?.trim() || (isPL ? "Twoim psem" : "deinem Hund");
  const plans = isPL ? PLANS_PL : PLANS;
  const t = isPL
    ? {
        heroTitle: `Rozwiąż problemy z ${dog} samodzielnie`,
        heroSub:
          "Krok po kroku, we własnym tempie, z domu — bez drogiej szkoły dla psów, bez stresu.",
        choose: "Wybierz plan →",
        loading: "Ładuję…",
        trust: "🔒 30 dni gwarancji zwrotu · Bezpieczna płatność przez Mollie",
        errStart: "Nie udało się rozpocząć płatności",
        errConn: "Błąd połączenia. Spróbuj zaraz ponownie.",
      }
    : {
        heroTitle: `Probleme mit ${dog} selbst lösen`,
        heroSub:
          "Schritt für Schritt, im eigenen Tempo, von zuhause aus — ohne teure Hundeschule, ohne Stress.",
        choose: "Plan wählen →",
        loading: "Lade…",
        trust: "🔒 30 Tage Geld-zurück · Sichere Zahlung über Mollie",
        errStart: "Konnte Checkout nicht starten",
        errConn: "Verbindungsfehler. Versuch's gleich nochmal.",
      };

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
          // Dashboard-User: nach Kauf zurueck ins Dashboard, bei Abbruch
          // zurueck zur Upgrade-Page. Sonst landen sie auf der Marketing-LP.
          successPath: "/mitglieder?bought=1",
          cancelPath: "/mitglieder/upgrade?canceled=1",
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || t.errStart);
        setLoadingKey(null);
      }
    } catch (e) {
      setError(t.errConn);
      setLoadingKey(null);
    }
  }

  return (
    <section className="space-y-6">
      {/* Outcome-Hero — kurz, klar, ohne Marketing-Geschwurbel */}
      <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-2xl p-5 md:p-6">
        <h2 className="text-[20px] md:text-[24px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight mb-1.5">
          {t.heroTitle}
        </h2>
        <p className="text-[14px] text-[#4B5563] leading-relaxed">
          {t.heroSub}
        </p>
      </div>

      {/* Plan-Cards mit Bild-Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {plans.map((p) => {
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
              {/* Image-Header (4:3 — echte Bilder sind 1600x1200) */}
              <div className="relative aspect-[4/3] bg-[#FAF4E8] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image}
                  alt={p.badge || (isPL ? `Plan ${p.months}-miesięczny` : `${p.months}-Monats-Plan`)}
                  className="w-full h-full object-cover"
                />
                {p.badge && (
                  <div
                    className={`absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
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

                {isPL ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[26px] font-extrabold text-[#1a1a1a]">
                        {p.price} zł
                      </span>
                    </div>
                    <div className="text-[11px] text-[#6B7280] mb-3">
                      Tylko <strong>{p.daily} dziennie</strong> · jednorazowo
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}

                <div
                  className={`mt-auto text-center font-semibold py-2.5 px-4 rounded-xl text-[13px] ${
                    p.popular
                      ? "bg-[#C4A576] text-white shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
                      : "bg-[#FAFAFA] text-[#1a1a1a] border border-[#EADDC5]"
                  }`}
                >
                  {isLoading ? t.loading : t.choose}
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
          {t.trust}
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
