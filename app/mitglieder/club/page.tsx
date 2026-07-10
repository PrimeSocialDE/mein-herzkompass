// /mitglieder/club — Landing + Checkout-Einstieg fuer das "Pfoten-Plan Club"-Abo
// (8 EUR/Monat, 14 Tage gratis). Erklaert den Nutzen, startet ueber den
// StartClubButton den Mollie-Abo-Checkout (/api/mollie/abo-checkout).

import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";
import StartClubButton from "@/components/mitglieder/StartClubButton";
import PaymentLogos from "@/components/mitglieder/PaymentLogos";
import CancelClubButton from "@/components/mitglieder/CancelClubButton";
import { getMemberLang } from "@/lib/member-lang";

export const dynamic = "force-dynamic";

const PILLARS: { icon: string; title: string; text: string }[] = [
  {
    icon: "🎥",
    title: "Video-Check deines Hundes",
    text: "Schick ein kurzes Video — du bekommst konkrete Rückmeldung zu genau eurer Situation, nicht 08/15.",
  },
  {
    icon: "🔄",
    title: "Wir bleiben dran",
    text: "Hakt es? Rückfall? Wir passen den Plan an, bis es sitzt — kein einmaliges PDF, wir bleiben dabei.",
  },
  {
    icon: "🆘",
    title: "Hilfe bei allem, was kommt",
    text: "Besuch, Umzug, Reise, nächste Lebensphase — dein Trainer ist da, wenn Neues auftaucht.",
  },
  {
    icon: "📦",
    title: "Alles sofort freigeschaltet",
    text: "Notfall-Karten & alle Themen-Module — auf deinen Hund abgestimmt. Und jeden Monat kommt ein neues dazu.",
  },
];

const PILLARS_PL: { icon: string; title: string; text: string }[] = [
  {
    icon: "🎥",
    title: "Wideo-analiza Twojego psa",
    text: "Wyślij krótkie wideo — dostaniesz konkretną informację zwrotną do dokładnie Waszej sytuacji, a nie ogólniki.",
  },
  {
    icon: "🔄",
    title: "Zostajemy przy Tobie",
    text: "Coś nie wychodzi? Nawrót? Dopasowujemy plan, aż zadziała — to nie jednorazowy PDF, jesteśmy z Tobą.",
  },
  {
    icon: "🆘",
    title: "Pomoc we wszystkim, co przyjdzie",
    text: "Wizyta, przeprowadzka, podróż, kolejny etap życia — Twój trener jest przy Tobie, gdy pojawia się coś nowego.",
  },
  {
    icon: "📦",
    title: "Wszystko od razu odblokowane",
    text: "Karty awaryjne i wszystkie moduły tematyczne — dopasowane do Twojego psa. A co miesiąc dochodzi nowy.",
  },
];

export default async function ClubPage() {
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
  const dog =
    member.dog_name?.trim() || (lang === "pl" ? "Twojego psa" : "deinen Hund");
  const pillars = lang === "pl" ? PILLARS_PL : PILLARS;
  const t =
    lang === "pl"
      ? {
          soonTitle: "Klub ŁapaPlan już wkrótce 🐾",
          soonText: "Właśnie dopinamy ostatnie szczegóły. Zajrzyj wkrótce ponownie!",
          soonCta: "Do modułów →",
          memberTitle: "Jesteś członkiem klubu 🎉",
          memberText: `Wszystkie moduły są odblokowane. Miłego treningu z ${dog}!`,
          libraryCta: "Do biblioteki →",
          imgAlt: "Trening z Twoim psem",
          badge: "⭐ ŁapaPlan Klub",
          heroTitle: `Nigdy więcej bezradności przy ${dog}`,
          heroText: `Gdy nie wiesz, co dalej, dostajesz osobistą pomoc dla dokładnie ${dog} — wyślij wideo, dostań konkretną informację zwrotną, a my zostajemy przy Tobie, aż się uda.`,
          priceUnit: "/ miesiąc",
          priceSub: "Możesz anulować w każdej chwili · bez minimalnego okresu",
          secure: "🔒 Bezpieczna płatność przez Mollie · bez minimalnego okresu",
          footerPre: "Już z nami? Twoją bibliotekę znajdziesz w",
          footerLink: "Moduły",
        }
      : {
          soonTitle: "Der Pfoten-Plan Club kommt bald 🐾",
          soonText: "Wir legen gerade die letzte Hand an. Schau bald wieder vorbei!",
          soonCta: "Zu den Modulen →",
          memberTitle: "Du bist Club-Mitglied 🎉",
          memberText: `Alle Module sind freigeschaltet. Viel Freude beim Training mit ${dog}!`,
          libraryCta: "Zur Bibliothek →",
          imgAlt: "Training mit deinem Hund",
          badge: "⭐ Pfoten-Plan Club",
          heroTitle: `Nie wieder ratlos mit ${dog}`,
          heroText: `Wenn du nicht weiterweißt, bekommst du persönliche Hilfe für genau ${dog} — Video schicken, konkrete Rückmeldung, und wir bleiben dran, bis es klappt.`,
          priceUnit: "/ Monat",
          priceSub: "Jederzeit kündbar · keine Mindestlaufzeit",
          secure: "🔒 Sichere Zahlung über Mollie · keine Mindestlaufzeit",
          footerPre: "Schon dabei? Deine Bibliothek findest du unter",
          footerLink: "Module",
        };
  const isAbo = member.purchase_status === "abo";
  // Test-Gate: der Kauf-Flow ist vorerst nur fuer max@ erreichbar. Fremde,
  // die die URL raten, sehen "kommt bald" (kein versehentlicher Kauf).
  // Zum oeffentlichen Launch: diesen Block entfernen.
  const isTester = member.email?.toLowerCase() === "max@primesocial.de";
  if (!isAbo && !isTester) {
    return (
      <div className="max-w-[520px] mx-auto text-center py-12">
        <div className="text-[40px] mb-2">⭐</div>
        <h1 className="text-[22px] font-extrabold text-[#1a1a1a] mb-2">
          {t.soonTitle}
        </h1>
        <p className="text-[14px] text-[#4B5563]">
          {t.soonText}
        </p>
        <Link
          href="/mitglieder/module"
          className="inline-block mt-5 rounded-full px-5 py-2.5 text-[13px] font-extrabold text-white bg-gradient-to-b from-[#C9A868] to-[#B7945A]"
        >
          {t.soonCta}
        </Link>
      </div>
    );
  }

  if (isAbo) {
    return (
      <div className="max-w-[560px] mx-auto text-center py-10">
        <div className="text-[40px] mb-2">⭐</div>
        <h1 className="text-[22px] font-extrabold text-[#1a1a1a] mb-2">
          {t.memberTitle}
        </h1>
        <p className="text-[14px] text-[#4B5563]">
          {t.memberText}
        </p>
        <div>
          <Link
            href="/mitglieder/module"
            className="inline-block mt-5 rounded-full px-5 py-2.5 text-[13px] font-extrabold text-white bg-gradient-to-b from-[#C9A868] to-[#B7945A]"
          >
            {t.libraryCta}
          </Link>
        </div>
        <CancelClubButton />
      </div>
    );
  }

  return (
    <div className="max-w-[620px] mx-auto">
      {/* Hero */}
      <div className="text-center pt-2 pb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/AboFoto.jpg"
          alt={t.imgAlt}
          className="w-full h-[160px] object-cover rounded-2xl border border-[#EADDC5] mb-4"
        />
        <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white rounded-full px-2.5 py-1 bg-gradient-to-b from-[#C9A868] to-[#B7945A]">
          {t.badge}
        </span>
        <h1 className="text-[24px] sm:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight mt-3">
          {t.heroTitle}
        </h1>
        <p className="text-[14px] text-[#4B5563] mt-2 leading-relaxed max-w-[460px] mx-auto">
          {t.heroText}
        </p>
      </div>

      {/* Pillars */}
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {pillars.map((p) => (
          <div
            key={p.title}
            className="bg-[#FFFDF8] border border-[#EADDC5] rounded-2xl p-4"
          >
            <div className="text-[24px] mb-1.5">{p.icon}</div>
            <h3 className="text-[14px] font-extrabold text-[#1a1a1a] mb-1">
              {p.title}
            </h3>
            <p className="text-[12.5px] text-[#4B5563] leading-relaxed">{p.text}</p>
          </div>
        ))}
      </div>

      {/* Preis-Box + CTA */}
      <div
        className="rounded-2xl border border-[#E7D3AE] p-5 text-center"
        style={{
          background:
            "radial-gradient(120% 140% at 50% 0%, #F6E7C9 0%, rgba(246,231,201,0) 60%), linear-gradient(180deg,#FFFDF9 0%,#FFF4E1 100%)",
        }}
      >
        <div className="flex items-baseline justify-center gap-2 mb-1">
          <span className="text-[34px] font-extrabold text-[#1a1a1a]">7,99&nbsp;€</span>
          <span className="text-[13px] font-semibold text-[#6B7280]">{t.priceUnit}</span>
        </div>
        <p className="text-[12px] text-[#8B7355] font-semibold mb-4">
          {t.priceSub}
        </p>

        <StartClubButton
          email={member.email}
          dogName={member.dog_name}
          leadId={member.source_lead_id}
        />

        <PaymentLogos />

        <p className="text-[10.5px] text-[#9CA3AF] mt-3">
          {t.secure}
        </p>
      </div>

      <p className="text-[11px] text-[#9CA3AF] text-center mt-5">
        {t.footerPre}{" "}
        <Link href="/mitglieder/module" className="underline">
          {t.footerLink}
        </Link>
        .
      </p>
    </div>
  );
}
