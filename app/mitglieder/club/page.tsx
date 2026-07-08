// /mitglieder/club — Landing + Checkout-Einstieg fuer das "Pfoten-Plan Club"-Abo
// (8 EUR/Monat, 14 Tage gratis). Erklaert den Nutzen, startet ueber den
// StartClubButton den Mollie-Abo-Checkout (/api/mollie/abo-checkout).

import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";
import StartClubButton from "@/components/mitglieder/StartClubButton";
import PaymentLogos from "@/components/mitglieder/PaymentLogos";
import CancelClubButton from "@/components/mitglieder/CancelClubButton";

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
  const dog = member.dog_name?.trim() || "deinen Hund";
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
          Der Pfoten-Plan Club kommt bald 🐾
        </h1>
        <p className="text-[14px] text-[#4B5563]">
          Wir legen gerade die letzte Hand an. Schau bald wieder vorbei!
        </p>
        <Link
          href="/mitglieder/module"
          className="inline-block mt-5 rounded-full px-5 py-2.5 text-[13px] font-extrabold text-white bg-gradient-to-b from-[#C9A868] to-[#B7945A]"
        >
          Zu den Modulen →
        </Link>
      </div>
    );
  }

  if (isAbo) {
    return (
      <div className="max-w-[560px] mx-auto text-center py-10">
        <div className="text-[40px] mb-2">⭐</div>
        <h1 className="text-[22px] font-extrabold text-[#1a1a1a] mb-2">
          Du bist Club-Mitglied 🎉
        </h1>
        <p className="text-[14px] text-[#4B5563]">
          Alle Module sind freigeschaltet. Viel Freude beim Training mit {dog}!
        </p>
        <div>
          <Link
            href="/mitglieder/module"
            className="inline-block mt-5 rounded-full px-5 py-2.5 text-[13px] font-extrabold text-white bg-gradient-to-b from-[#C9A868] to-[#B7945A]"
          >
            Zur Bibliothek →
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
          alt="Training mit deinem Hund"
          className="w-full h-[160px] object-cover rounded-2xl border border-[#EADDC5] mb-4"
        />
        <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white rounded-full px-2.5 py-1 bg-gradient-to-b from-[#C9A868] to-[#B7945A]">
          ⭐ Pfoten-Plan Club
        </span>
        <h1 className="text-[24px] sm:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight mt-3">
          Nie wieder ratlos mit {dog}
        </h1>
        <p className="text-[14px] text-[#4B5563] mt-2 leading-relaxed max-w-[460px] mx-auto">
          Wenn du nicht weiterweißt, bekommst du persönliche Hilfe für genau {dog} —
          Video schicken, konkrete Rückmeldung, und wir bleiben dran, bis es klappt.
        </p>
      </div>

      {/* Pillars */}
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {PILLARS.map((p) => (
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
          <span className="text-[13px] font-semibold text-[#6B7280]">/ Monat</span>
        </div>
        <p className="text-[12px] text-[#8B7355] font-semibold mb-4">
          Jederzeit kündbar · keine Mindestlaufzeit
        </p>

        <StartClubButton
          email={member.email}
          dogName={member.dog_name}
          leadId={member.source_lead_id}
        />

        <PaymentLogos />

        <p className="text-[10.5px] text-[#9CA3AF] mt-3">
          🔒 Sichere Zahlung über Mollie · keine Mindestlaufzeit
        </p>
      </div>

      <p className="text-[11px] text-[#9CA3AF] text-center mt-5">
        Schon dabei? Deine Bibliothek findest du unter{" "}
        <Link href="/mitglieder/module" className="underline">
          Module
        </Link>
        .
      </p>
    </div>
  );
}
