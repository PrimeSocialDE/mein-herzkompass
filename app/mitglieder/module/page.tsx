// /mitglieder/module — Modul-Shop mit Flip-Karten.
// Listet alle aktiven Upsells aus member_upsells. Klick auf
// 'Mehr Infos' dreht die Karte zur Detail-Liste, von dort direkt
// Mollie-Checkout.

import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth-server";
import {
  getOrCreateMemberProfile,
  listActiveUpsells,
  listModulesForMember,
} from "@/lib/member-db";
import { THEMEN_MODULES, sortByUserRelevance } from "@/lib/member-themen";
import UpsellFlipCard from "@/components/mitglieder/UpsellFlipCard";
import ModuleGrid from "@/components/mitglieder/ModuleGrid";

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

// Slug-basiertes Image-Override fuer DB-Upsells (member_upsells.image_url
// kann leer sein — hier sind die hardcoded Fallbacks pro Slug).
const UPSELL_IMAGE: Record<string, string> = {
  zweithund: "/zweithund.png",
  reise: "/reise.png",
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

  const [upsells, modules] = await Promise.all([
    listActiveUpsells(),
    listModulesForMember(member),
  ]);
  const dog = member.dog_name?.trim() || "deinen Hund";
  const isPaid = member.purchase_status === "paid";
  const unlockedCount = modules.filter((m) => m.unlocked).length;

  // Themen-Module sortiert nach User-Relevanz (eigenes Quiz-Problem zuerst)
  const userProblemKey =
    member.quiz_result?.dog_problem || member.quiz_result?.problem || null;
  const themenModules = sortByUserRelevance(THEMEN_MODULES, userProblemKey);

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          Modul-Übersicht
        </p>
        <h1 className="text-[22px] md:text-[28px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          Alle Module für {dog}
        </h1>
        <p className="text-[13px] text-[#4B5563] mt-1.5 leading-relaxed">
          Dein Trainings-Plan plus zusätzliche Spezial-Themen.
        </p>
      </div>

      {/* ── Section 1: Plan-Module ─────────────────────────────────── */}
      {modules.length > 0 && (
        <section className="mb-10">
          <h2 className="text-[20px] md:text-[22px] font-extrabold text-[#1a1a1a] leading-tight">
            Dein Trainings-Plan
          </h2>
          <p className="text-[12px] text-[#9CA3AF] mt-1 mb-3">
            {unlockedCount} von {modules.length} freigeschaltet
          </p>
          <ModuleGrid modules={modules} isPaid={isPaid} />
        </section>
      )}

      {/* ── Section 2: Themen-Module ───────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-[22px] md:text-[26px] font-extrabold text-[#1a1a1a] leading-tight">
          Themen-Module
        </h2>
        <p className="text-[12px] text-[#9CA3AF] mt-1 mb-3">
          {themenModules.length} verfügbar · Tipp auf eine Karte für Details
        </p>

        {/* Erklaer-Block: was sind die, wie laeufts ab */}
        <div className="bg-[#FFFDF8] border border-[#EADDC5] rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[18px]">💡</span>
            <p className="text-[13px] font-bold text-[#1a1a1a]">
              Wie funktionieren Themen-Module?
            </p>
          </div>
          <p className="text-[12px] text-[#4B5563] leading-relaxed mb-3">
            Spezial-Trainings zu einzelnen Themen. Einmal kaufen, dauerhaft
            verfügbar — als PDF im Postfach und hier im Mitgliederbereich.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: "🛒", text: "Modul wählen & kaufen" },
              { icon: "📧", text: "Sofort PDF im Postfach" },
              { icon: "♾️", text: "Lebenslang abrufbar" },
            ].map((s) => (
              <div
                key={s.text}
                className="flex items-start gap-1 text-[11px] text-[#1a1a1a] leading-snug"
              >
                <span className="text-[14px] flex-shrink-0">{s.icon}</span>
                <span>{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {themenModules.map((t) => (
            <UpsellFlipCard
              key={t.slug}
              upsell={{
                id: t.slug,
                slug: t.slug,
                title: t.title,
                description: t.short,
                badge_text:
                  t.problem_match === userProblemKey
                    ? "Für dich"
                    : t.badge_text,
                price_cents: t.price_cents,
                image_url: t.image_url || null,
              }}
              features={t.features}
              emoji={t.emoji}
              goal={t.goal}
              email={member.email}
              leadId={member.source_lead_id}
              dogName={member.dog_name}
            />
          ))}
        </div>
      </section>

      {/* ── Section 3: Weitere Zusatz-Module (PDFs, Abos) ──────────── */}
      {upsells.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[20px] md:text-[22px] font-extrabold text-[#1a1a1a] leading-tight">
            Weitere Module
          </h2>
          <p className="text-[12px] text-[#9CA3AF] mt-1 mb-3">
            Spezial-Guides als PDF
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                  image_url: UPSELL_IMAGE[u.slug] || u.image_url || null,
                }}
                features={featuresFor(u.slug, u.description)}
                emoji={UPSELL_EMOJI[u.slug] || "🎁"}
                email={member.email}
                leadId={member.source_lead_id}
                dogName={member.dog_name}
              />
            ))}
          </div>
        </section>
      )}

      {/* Trust-Hinweis */}
      <p className="text-[11px] text-[#9CA3AF] text-center mb-4">
        🔒 Sichere Zahlung über Mollie · Sofort als PDF im Postfach
      </p>
    </>
  );
}
