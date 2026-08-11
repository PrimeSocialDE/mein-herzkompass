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
import { THEMEN_MODULES, sortByUserRelevance } from "@/lib/member-themen";
import UpsellFlipCard from "@/components/mitglieder/UpsellFlipCard";
import ClubAboCard from "@/components/mitglieder/ClubAboCard";
import { getClubStateForEmail } from "@/lib/club";
import { getMemberLang } from "@/lib/member-lang";

export const dynamic = "force-dynamic";

// Hardcoded Features-Map keyed by Upsell-Slug. Wird verwendet wenn
// in der DB keine eigene Features-Liste hinterlegt ist (faellt zurueck
// auf split der description). Slugs entsprechen den 'type'-Werten der
// upsell-product-checkout-Route.
const UPSELL_FEATURES_DE: Record<string, string[]> = {
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

const UPSELL_FEATURES_PL: Record<string, string[]> = {
  ernaehrung: [
    "Spersonalizowany plan żywienia dla Twojego psa",
    "Jasne ilości na każdy dzień",
    "Wskazówki dot. przekąsek i nagród",
    "Od razu PDF w skrzynce",
  ],
  reise: [
    "Przygotowanie i lista rzeczy do spakowania",
    "Samochód, pociąg, samolot — na co uważać",
    "Etykieta w hotelu i restauracji",
    "Od razu PDF w skrzynce",
  ],
  erstehilfe: [
    "Działania w nagłych wypadkach krok po kroku",
    "Zatrucia, urazy, ukąszenia owadów",
    "Kiedy do weterynarza, a kiedy działać samemu",
    "Od razu PDF w skrzynce",
  ],
  zweithund: [
    "Wprowadzenie drugiego psa bez konfliktów",
    "Który pies pasuje do Twojego?",
    "Jak przetrwać pierwsze tygodnie",
    "Od razu PDF w skrzynce",
  ],
  abo: [
    "Sezonowe wskazówki treningowe",
    "Wiosna, lato, jesień, zima",
    "Nowe treści co kwartał",
  ],
  tagebuch: [
    "Dziennik treningowy do uzupełniania",
    "Struktura 12 tygodni, krok po kroku",
    "Wysoka jakość druku, od razu jako PDF",
  ],
};

const UPSELL_FEATURES_IT: Record<string, string[]> = {
  ernaehrung: [
    "Piano alimentare personalizzato per il tuo cane",
    "Quantità chiare per ogni giorno",
    "Consigli su snack e ricompense",
    "Subito come PDF nella casella",
  ],
  reise: [
    "Preparazione e lista dei bagagli",
    "Auto, treno, aereo — cosa considerare",
    "Etichetta in hotel e ristorante",
    "Subito come PDF nella casella",
  ],
  erstehilfe: [
    "Misure di emergenza passo passo",
    "Avvelenamenti, ferite, punture di insetti",
    "Quando andare dal veterinario, quando agire da soli",
    "Subito come PDF nella casella",
  ],
  zweithund: [
    "Introdurre un secondo cane senza conflitti",
    "Quale cane si adatta al tuo?",
    "Superare le prime settimane",
    "Subito come PDF nella casella",
  ],
  abo: [
    "Consigli di addestramento stagionali",
    "Primavera, estate, autunno, inverno",
    "Nuovi contenuti ogni trimestre",
  ],
  tagebuch: [
    "Diario di addestramento da compilare",
    "Struttura di 12 settimane, passo passo",
    "Alta qualità di stampa, subito come PDF",
  ],
};

// Polnische Parallel-Felder fuer THEMEN_MODULES (nach Slug). DE/IT bleiben in
// member-themen.ts; hier nur PL ergaenzt (Bilder fallen auf DE zurueck).
const THEMEN_PL: Record<
  string,
  { title: string; goal: string; short: string; features: string[]; badge_text: string | null }
> = {
  "thema-leinen": {
    title: "Chodzenie na smyczy",
    goal: "Chodzi spokojnie na smyczy",
    short: "Luźna smycz w 14 dni.",
    features: [
      "Budowanie krok po kroku w 14 dni",
      "Co naprawdę uspokaja psy",
      "Ćwiczenia na miasto, las i park",
      "Od razu PDF w skrzynce",
    ],
    badge_text: "Popularne",
  },
  "thema-bellen": {
    title: "Oduczanie szczekania",
    goal: "Szczeka rzadziej i krócej",
    short: "Ustal sygnał spokoju, bez stresu.",
    features: [
      "Zrozum przyczyny (strach, nuda, pilnowanie)",
      "Zbuduj sygnał spokoju",
      "Ćwiczenia na dzwonek, gości, hałasy z zewnątrz",
      "Od razu PDF w skrzynce",
    ],
    badge_text: null,
  },
  "thema-aggression": {
    title: "Rozładowanie agresji",
    goal: "Zachowuje spokój przy innych psach",
    short: "Bezpiecznie reaguj, wyciszaj, zapobiegaj.",
    features: [
      "Dlaczego psy reagują agresywnie",
      "Rozpoznawanie i unikanie wyzwalaczy",
      "Techniki deeskalacji krok po kroku",
      "Kiedy potrzebna jest pomoc profesjonalisty",
      "Od razu PDF w skrzynce",
    ],
    badge_text: "Szczegółowe",
  },
  "thema-trennungsangst": {
    title: "Lęk separacyjny",
    goal: "Zostaje spokojny sam w domu",
    short: "Sam w domu bez stresu.",
    features: [
      "Oswajanie małymi krokami",
      "Od 1 minuty do 4 godzin",
      "Co robić przy nawrotach",
      "Od razu PDF w skrzynce",
    ],
    badge_text: null,
  },
  "thema-anspringen": {
    title: "Oduczanie skakania",
    goal: "Wita z wszystkimi łapami na ziemi",
    short: "Powitanie z czterema łapami na ziemi.",
    features: [
      "Dlaczego psy skaczą (uwaga)",
      "Trenuj konsekwentną reakcję",
      "Ćwiczenia na rodzinę, gości, obcych",
      "Od razu PDF w skrzynce",
    ],
    badge_text: null,
  },
  "thema-rueckruf": {
    title: "Trening przywołania",
    goal: "Wraca niezawodnie, gdy wołasz",
    short: "Twój pies wraca niezawodnie.",
    features: [
      "Naładuj imię pozytywnie",
      "Trening z gwizdkiem krok po kroku",
      "Ćwiczenia z rosnącym rozproszeniem",
      "Od razu PDF w skrzynce",
    ],
    badge_text: null,
  },
  "thema-energie": {
    title: "Nadmiar energii",
    goal: "Znajduje spokój po wyładowaniu",
    short: "Wyładuj energię i znajdź spokój.",
    features: [
      "Stymulacja umysłowa vs fizyczna",
      "Mata węchowa i gry w szukanie",
      "Buduj fazę spokoju",
      "Od razu PDF w skrzynce",
    ],
    badge_text: null,
  },
  "thema-zerstoerung": {
    title: "Zachowania destrukcyjne",
    goal: "Zostawia meble, buty i kable w spokoju",
    short: "Meble, buty i kable bezpieczne.",
    features: [
      "Dlaczego psy niszczą",
      "Zaproponuj alternatywy do gryzienia",
      "Trenuj grę w wymianę",
      "Od razu PDF w skrzynce",
    ],
    badge_text: null,
  },
  "thema-stubenrein": {
    title: "Czystość w domu",
    goal: "Załatwia się na dworze, nie w domu",
    short: "Ustal rutynę w 21 dni.",
    features: [
      "Stałe pory na siusiu",
      "Co robić przy wpadkach",
      "Szczenięta vs dorosłe psy",
      "Od razu PDF w skrzynce",
    ],
    badge_text: null,
  },
  "thema-aufnehmen": {
    title: "Nic z ziemi",
    goal: "Zostawia rzeczy leżące na ziemi",
    short: "Koniec z podnoszeniem rzeczy na spacerze.",
    features: [
      "Gra w wymianę jako podstawa",
      "Zbuduj komendę „zostaw”",
      "Ćwiczenia na trasie spaceru",
      "Od razu PDF w skrzynce",
    ],
    badge_text: null,
  },
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

function featuresFor(
  slug: string,
  description: string | null,
  lang: "de" | "pl" | "it"
): string[] {
  const map =
    lang === "pl"
      ? UPSELL_FEATURES_PL
      : lang === "it"
      ? UPSELL_FEATURES_IT
      : UPSELL_FEATURES_DE;
  if (map[slug]) return map[slug];
  if (description) {
    const split = description
      .split(/[\n.•]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);
    if (split.length >= 2) return split.slice(0, 5);
  }
  return lang === "pl"
    ? ["Prosto do skrzynki", "Od razu gotowe do startu"]
    : lang === "it"
    ? ["Direttamente nella casella", "Subito pronto all'uso"]
    : ["Direkt im Postfach", "Sofort startbereit"];
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

  const lang = await getMemberLang(user?.email ?? member?.email ?? null);
  const tr =
    lang === "pl"
      ? {
          eyebrow: "Przegląd modułów",
          heading: "Wszystkie moduły dla",
          subtitle: "Twój plan treningowy plus dodatkowe tematy specjalne.",
          clubAllFree: "Wszystkie moduły są odblokowane 🎉",
          themenTitle: "Moduły tematyczne",
          themenAvail: "dostępnych · Dotknij karty, aby zobaczyć szczegóły",
          howTitle: "Jak działają moduły tematyczne?",
          howText:
            "Treningi specjalne na wybrane tematy. Kupujesz raz, dostępne na zawsze — jako PDF w skrzynce i tutaj w strefie członkowskiej.",
          stepChoose: "Wybierz moduł i kup",
          stepPdf: "Od razu PDF w skrzynce",
          stepForever: "Dostępne na zawsze",
          unlocked: "✅ Odblokowane",
          lockedSoon: "🔒 Wkrótce dostępne",
          forYou: "Dla Ciebie",
          moreTitle: "Więcej modułów",
          moreSub: "Poradniki specjalne jako PDF",
          trust: "🔒 Bezpieczna płatność przez Mollie · Od razu PDF w skrzynce",
        }
      : lang === "it"
      ? {
          eyebrow: "Panoramica moduli",
          heading: "Tutti i moduli per",
          subtitle: "Il tuo piano di addestramento più temi speciali aggiuntivi.",
          clubAllFree: "Tutti i moduli sono sbloccati 🎉",
          themenTitle: "Moduli tematici",
          themenAvail: "disponibili · Tocca una scheda per i dettagli",
          howTitle: "Come funzionano i moduli tematici?",
          howText:
            "Addestramenti speciali su singoli temi. Acquisti una volta, disponibili per sempre — come PDF nella tua casella e qui nell'area membri.",
          stepChoose: "Scegli e acquista il modulo",
          stepPdf: "PDF subito nella casella",
          stepForever: "Disponibile a vita",
          unlocked: "✅ Sbloccato",
          lockedSoon: "🔒 Presto disponibile",
          forYou: "Per te",
          moreTitle: "Altri moduli",
          moreSub: "Guide speciali in PDF",
          trust: "🔒 Pagamento sicuro tramite Mollie · Subito come PDF nella casella",
        }
      : {
          eyebrow: "Modul-Übersicht",
          heading: "Alle Module für",
          subtitle: "Dein Trainings-Plan plus zusätzliche Spezial-Themen.",
          clubAllFree: "Alle Module sind freigeschaltet 🎉",
          themenTitle: "Themen-Module",
          themenAvail: "verfügbar · Tipp auf eine Karte für Details",
          howTitle: "Wie funktionieren Themen-Module?",
          howText:
            "Spezial-Trainings zu einzelnen Themen. Einmal kaufen, dauerhaft verfügbar — als PDF im Postfach und hier im Mitgliederbereich.",
          stepChoose: "Modul wählen & kaufen",
          stepPdf: "Sofort PDF im Postfach",
          stepForever: "Lebenslang abrufbar",
          unlocked: "✅ Freigeschaltet",
          lockedSoon: "🔒 Schaltet bald frei",
          forYou: "Für dich",
          moreTitle: "Weitere Module",
          moreSub: "Spezial-Guides als PDF",
          trust: "🔒 Sichere Zahlung über Mollie · Sofort als PDF im Postfach",
        };

  const upsells = await listActiveUpsells();
  const dog =
    member.dog_name?.trim() || (lang === "pl" ? "Twojego psa" : lang === "it" ? "il tuo cane" : "deinen Hund");

  // Themen-Module sortiert nach User-Relevanz (eigenes Quiz-Problem zuerst)
  const userProblemKey =
    member.quiz_result?.dog_problem || member.quiz_result?.problem || null;
  const themenModules = sortByUserRelevance(THEMEN_MODULES, userProblemKey);

  // Lokalisierte Felder pro Themen-Modul (PL aus THEMEN_PL, IT aus den _it-
  // Feldern, sonst DE). Bilder fallen fuer PL auf DE zurueck (keine .pl-Assets).
  function themenTitle(t: (typeof THEMEN_MODULES)[number]): string {
    if (lang === "pl") return THEMEN_PL[t.slug]?.title ?? t.title;
    if (lang === "it") return t.title_it ?? t.title;
    return t.title;
  }
  function themenShort(t: (typeof THEMEN_MODULES)[number]): string {
    if (lang === "pl") return THEMEN_PL[t.slug]?.short ?? t.short;
    if (lang === "it") return t.short_it ?? t.short;
    return t.short;
  }
  function themenGoal(t: (typeof THEMEN_MODULES)[number]): string {
    if (lang === "pl") return THEMEN_PL[t.slug]?.goal ?? t.goal;
    if (lang === "it") return t.goal_it ?? t.goal;
    return t.goal;
  }
  function themenFeatures(t: (typeof THEMEN_MODULES)[number]): string[] {
    if (lang === "pl") return THEMEN_PL[t.slug]?.features ?? t.features;
    if (lang === "it") return t.features_it ?? t.features;
    return t.features;
  }
  function themenBadge(t: (typeof THEMEN_MODULES)[number]): string | null {
    if (lang === "pl") return THEMEN_PL[t.slug]?.badge_text ?? t.badge_text;
    if (lang === "it") return t.badge_text_it ?? t.badge_text;
    return t.badge_text;
  }
  function themenImage(t: (typeof THEMEN_MODULES)[number]): string | null | undefined {
    // IT hat eigene Bilder; PL nutzt DE-Bilder (kein .pl-Asset vorhanden).
    if (lang === "it") return t.image_url_it ?? t.image_url;
    return t.image_url;
  }

  // Club-Status (defensiv — darf die Seite fuer Nicht-Club-Mitglieder NIE
  // beeinflussen; bei jedem Fehler fallen wir auf "kein Club" zurueck).
  let hasClub = false;
  let clubUnlocked = new Set<string>();
  let clubNextUnlockAt: string | null = null;
  try {
    if (member.email) {
      const club = await getClubStateForEmail(member.email);
      hasClub =
        club.state.active ||
        (!!club.state.accessUntil &&
          Date.parse(club.state.accessUntil) > Date.now());
      clubUnlocked = new Set(club.state.unlocked);
      clubNextUnlockAt = club.state.nextUnlockAt;
    }
  } catch (e) {
    console.error("[module-page] club-state read failed:", (e as any)?.message);
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          {tr.eyebrow}
        </p>
        <h1 className="text-[22px] md:text-[28px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          {tr.heading} {dog}
        </h1>
        <p className="text-[13px] text-[#4B5563] mt-1.5 leading-relaxed">
          {tr.subtitle}
        </p>
      </div>

      {/* ── Pfoten-Plan Club (Abo) — prominent GANZ OBEN. Ersetzt die
          fruehere Audio-Coach-Karte. VORERST NUR fuer max@ (Test-Gate) —
          zum oeffentlichen Launch: die email-Bedingung entfernen. ── */}
      {!hasClub &&
        member.email?.toLowerCase() === "max@primesocial.de" && (
          <ClubAboCard dogName={member.dog_name} email={member.email} lang={lang} />
        )}

      {/* ── Club aktiv: Status-Banner ────────────────────────────────── */}
      {hasClub && (
        <div className="rounded-2xl border border-[#E7D3AE] p-4 mb-6 flex items-center gap-3"
          style={{ background: "linear-gradient(180deg,#FFFDF9 0%,#FFF4E1 100%)" }}
        >
          <span className="text-[26px]">⭐</span>
          <div>
            <p className="text-[13px] font-extrabold text-[#1a1a1a] leading-tight">
              {lang === "pl"
                ? `Twój Klub jest aktywny — ${clubUnlocked.size} z ${themenModules.length} modułów odblokowanych`
                : lang === "it"
                ? `Il tuo Club è attivo — ${clubUnlocked.size} di ${themenModules.length} moduli sbloccati`
                : `Dein Club ist aktiv — ${clubUnlocked.size} von ${themenModules.length} Modulen frei`}
            </p>
            <p className="text-[12px] text-[#8B7355] mt-0.5">
              {clubNextUnlockAt
                ? lang === "pl"
                  ? `Następny moduł odblokuje się ${new Date(clubNextUnlockAt).toLocaleDateString("de-DE")}.`
                  : lang === "it"
                  ? `Il prossimo modulo si sblocca il ${new Date(clubNextUnlockAt).toLocaleDateString("de-DE")}.`
                  : `Nächstes Modul schaltet sich am ${new Date(clubNextUnlockAt).toLocaleDateString("de-DE")} frei.`
                : tr.clubAllFree}
            </p>
          </div>
        </div>
      )}

      {/* Plan-Status-Section entfernt — Upgrade-CTA gibts schon auf
          fast jeder anderen Seite. Hier soll der Modul-Shop im Fokus
          stehen, nicht nochmal 'Plan freischalten'. */}

      {/* ── Section 2: Themen-Module ───────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-[22px] md:text-[26px] font-extrabold text-[#1a1a1a] leading-tight">
          {tr.themenTitle}
        </h2>
        <p className="text-[12px] text-[#9CA3AF] mt-1 mb-3">
          {themenModules.length} {tr.themenAvail}
        </p>

        {/* Erklaer-Block: was sind die, wie laeufts ab */}
        <div className="bg-[#FFFDF8] border border-[#EADDC5] rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[18px]">💡</span>
            <p className="text-[13px] font-bold text-[#1a1a1a]">
              {tr.howTitle}
            </p>
          </div>
          <p className="text-[12px] text-[#4B5563] leading-relaxed mb-3">
            {tr.howText}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: "🛒", text: tr.stepChoose },
              { icon: "📧", text: tr.stepPdf },
              { icon: "♾️", text: tr.stepForever },
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

        {hasClub ? (
          /* Club-Bibliothek: frei / gesperrt (kein Kauf) */
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {themenModules.map((t) => {
              const unlocked = clubUnlocked.has(t.slug);
              return (
                <div
                  key={t.slug}
                  className={`rounded-xl border border-[#EADDC5] overflow-hidden bg-white ${
                    unlocked ? "" : "opacity-80"
                  }`}
                >
                  <div className="relative">
                    {themenImage(t) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={themenImage(t)!}
                        alt={themenTitle(t)}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center text-[40px] bg-[#FFF9F0]">
                        {t.emoji}
                      </div>
                    )}
                    {!unlocked && (
                      <div className="absolute inset-0 bg-white/55 flex items-center justify-center">
                        <span className="text-[24px]">🔒</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-[12px] font-bold text-[#1a1a1a] leading-tight">
                      {themenTitle(t)}
                    </p>
                    <p
                      className={`text-[11px] mt-1 font-semibold ${
                        unlocked ? "text-[#16A34A]" : "text-[#9CA3AF]"
                      }`}
                    >
                      {unlocked ? tr.unlocked : tr.lockedSoon}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {themenModules.map((t) => (
              <UpsellFlipCard
                key={t.slug}
                upsell={{
                  id: t.slug,
                  slug: t.slug,
                  title: themenTitle(t),
                  description: themenShort(t),
                  badge_text:
                    t.problem_match === userProblemKey ? tr.forYou : themenBadge(t),
                  price_cents: t.price_cents,
                  image_url: themenImage(t) || null,
                }}
                features={themenFeatures(t)}
                emoji={t.emoji}
                goal={themenGoal(t)}
                email={member.email}
                leadId={member.source_lead_id}
                dogName={member.dog_name}
                lang={lang}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Section 3: Weitere Zusatz-Module (PDFs, Abos) ──────────── */}
      {upsells.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[20px] md:text-[22px] font-extrabold text-[#1a1a1a] leading-tight">
            {tr.moreTitle}
          </h2>
          <p className="text-[12px] text-[#9CA3AF] mt-1 mb-3">
            {tr.moreSub}
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
                features={featuresFor(u.slug, u.description, lang)}
                emoji={UPSELL_EMOJI[u.slug] || "🎁"}
                email={member.email}
                leadId={member.source_lead_id}
                dogName={member.dog_name}
                lang={lang}
              />
            ))}
          </div>
        </section>
      )}

      {/* Trust-Hinweis */}
      <p className="text-[11px] text-[#9CA3AF] text-center mb-4">
        {tr.trust}
      </p>
    </>
  );
}
