// /mitglieder/module — Modul-Shop mit Flip-Karten.
// Listet alle aktiven Upsells aus member_upsells. Klick auf
// 'Mehr Infos' dreht die Karte zur Detail-Liste, von dort direkt
// Mollie-Checkout.

import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth-server";
import {
  getOrCreateMemberProfile,
  listActiveUpsells,
} from "@/lib/member-db";
import UpsellFlipCard from "@/components/mitglieder/UpsellFlipCard";

export const dynamic = "force-dynamic";

// Hardcoded Features-Map keyed by Upsell-Slug. Wird verwendet wenn
// in der DB keine eigene Features-Liste hinterlegt ist (faellt zurueck
// auf split der description). Slugs entsprechen den 'type'-Werten der
// upsell-product-checkout-Route.
const UPSELL_FEATURES: Record<string, string[]> = {
  ernaehrung: [
    "Personalisierter Ernährungsplan für deinen Hund",
    "Klare Mengenangaben für jeden Tag",
    "Snack- und Belohnungs-Tipps",
    "Sofort als PDF im Postfach",
  ],
  reise: [
    "Vorbereitung und Packliste",
    "Auto, Bahn, Flugzeug — was zu beachten ist",
    "Hotel- und Restaurant-Etikette",
    "Sofort als PDF im Postfach",
  ],
  erstehilfe: [
    "Notfall-Maßnahmen Schritt für Schritt",
    "Vergiftungen, Verletzungen, Insektenstiche",
    "Wann zum Tierarzt, wann selbst handeln",
    "Sofort als PDF im Postfach",
  ],
  zweithund: [
    "Zweithund einführen ohne Konflikte",
    "Welcher Hund passt zu deinem?",
    "Die ersten Wochen meistern",
    "Sofort als PDF im Postfach",
  ],
  abo: [
    "Saisonale Trainings-Tipps",
    "Frühling, Sommer, Herbst, Winter",
    "Quartalsweise neue Inhalte",
  ],
  tagebuch: [
    "Trainings-Tagebuch zum Eintragen",
    "12-Wochen-Struktur, Schritt für Schritt",
    "Hochwertige Druckqualität, sofort als PDF",
  ],
};

const UPSELL_EMOJI: Record<string, string> = {
  ernaehrung: "🥩",
  reise: "✈️",
  erstehilfe: "🚑",
  zweithund: "🐕",
  abo: "📅",
  tagebuch: "📖",
};

function featuresFor(slug: string, description: string | null): string[] {
  if (UPSELL_FEATURES[slug]) return UPSELL_FEATURES[slug];
  if (description) {
    const split = description
      .split(/[\n.•]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);
    if (split.length >= 2) return split.slice(0, 5);
  }
  return ["Direkt im Postfach", "Sofort startbereit"];
}

export default async function ModulShopPage() {
  const user = await getCurrentMember();
  if (!user) {
    return (
      <div className="text-center py-12 text-[#6B7280]">
        Bitte zuerst{" "}
        <Link href="/mitglieder/login" className="underline">
          einloggen
        </Link>
        .
      </div>
    );
  }

  const member = await getOrCreateMemberProfile({
    userId: user.id,
    email: user.email || "",
  });

  const upsells = await listActiveUpsells();
  const dog = member.dog_name?.trim() || "deinen Hund";

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          Modul-Shop
        </p>
        <h1 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          Zusatz-Module für {dog}
        </h1>
        <p className="text-[14px] text-[#4B5563] mt-2 leading-relaxed">
          Spezial-Module zu einzelnen Themen. Tippe auf eine Karte für die
          Details, mit einem Klick gekauft.
        </p>
      </div>

      {upsells.length === 0 ? (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-6 text-center">
          <p className="text-[20px] mb-1">📦</p>
          <p className="text-[14px] text-[#6B7280]">
            Aktuell sind keine Zusatz-Module verfügbar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
          {upsells.map((u: any) => (
            <UpsellFlipCard
              key={u.id}
              upsell={{
                id: u.id,
                slug: u.slug,
                title: u.title,
                description: u.description,
                badge_text: u.badge_text,
                price_cents: u.price_cents,
                image_url: u.image_url,
              }}
              features={featuresFor(u.slug, u.description)}
              emoji={UPSELL_EMOJI[u.slug] || "🎁"}
              email={member.email}
              leadId={member.source_lead_id}
              dogName={member.dog_name}
            />
          ))}
        </div>
      )}

      {/* Trust-Hinweis unten */}
      {upsells.length > 0 && (
        <div className="mt-8 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-[20px] flex-shrink-0">🔒</span>
          <p className="text-[13px] text-[#15803D] leading-snug">
            Sichere Zahlung über Mollie · Sofort als PDF im Postfach
          </p>
        </div>
      )}
    </>
  );
}
