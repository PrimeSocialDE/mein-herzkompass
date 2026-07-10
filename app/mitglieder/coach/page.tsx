// app/mitglieder/coach/page.tsx
//
// Die Kunden-Seite fuer den Audio-Coach. Login-gated (bestehende Member-Auth).
// Zeigt je nach Status:
//  - nicht gekauft  -> Kauf-CTA (/pfoten-coach)
//  - gekauft, noch kein Inhalt -> "wird erstellt"-Zustand (Manual-MVP)
//  - gekauft + Inhalt vorhanden -> CoachPlayer (spielt die Audios)
// Inhalt liegt am Lead unter answers.pfoten_coach.content.

import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";
import { supabase } from "@/lib/db";
import CoachPlayer, { type CoachContent } from "@/components/mitglieder/CoachPlayer";
import { getMemberLang } from "@/lib/member-lang";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const user = await getCurrentMember();
  if (!user) {
    return (
      <div className="text-center py-12 text-[#6B7280]">
        Bitte zuerst{" "}
        <Link href="/mitglieder/login" className="underline">einloggen</Link>.
      </div>
    );
  }

  const member = await getOrCreateMemberProfile({ userId: user.id, email: user.email || "" });
  const lang = await getMemberLang(user?.email ?? member?.email ?? null);
  const dog =
    member.dog_name?.trim() || (lang === "pl" ? "Twojego psa" : "deinen Hund");
  const t =
    lang === "pl"
      ? {
          kicker: "ŁapaPlan · Twój trener na co dzień",
          namePrefix: "Twój",
          subtitle: "Ben prowadzi Cię krok po kroku przez plan — prosto do ucha.",
          unlockTitle: "Odblokuj swojego audio-trenera",
          unlockText: `Prowadzone sesje, natychmiastowa pomoc SOS i sprawdzanie postępów — dopasowane do ${dog}.`,
          unlockCta: "▶ Odblokuj trenera · 79 zł",
          creatingTitle: "Twój trener jest właśnie tworzony",
          creatingText: `Przygotowujemy nagrania specjalnie dla ${dog} i jego planu. Gdy będą gotowe, dostaniesz e-mail — wtedy wystarczy tutaj kliknąć Play. Zwykle w ciągu 24 godzin.`,
          footerPre: "Masz pytania? Napisz do nas na",
        }
      : {
          kicker: "Pfoten-Plan · Dein Coach nebenbei",
          namePrefix: "Dein",
          subtitle: "Ben begleitet dich Schritt für Schritt durch den Plan — direkt ins Ohr.",
          unlockTitle: "Schalte deinen Audio-Coach frei",
          unlockText: `Geführte Sessions, SOS-Soforthilfe und Erfolgs-Checks — zugeschnitten auf ${dog}.`,
          unlockCta: "▶ Coach freischalten · 19,99 €",
          creatingTitle: "Dein Coach wird gerade erstellt",
          creatingText: `Wir bereiten die Audios speziell für ${dog} und seinen Plan vor. Sobald sie bereit sind, bekommst du eine E-Mail — dann kannst du hier einfach auf Play drücken. Meist innerhalb von 24 Stunden.`,
          footerPre: "Fragen? Schreib uns an",
        };

  // Kaufstatus + Inhalt vom Lead lesen.
  let coach: any = null;
  if (member.source_lead_id) {
    const { data } = await supabase
      .from("wauwerk_leads")
      .select("answers")
      .eq("id", member.source_lead_id)
      .maybeSingle();
    coach = (data?.answers as any)?.pfoten_coach || null;
  }
  const isPaid = coach?.status === "paid";
  const content: CoachContent | null =
    coach?.content && Array.isArray(coach.content.modules) && coach.content.modules.length > 0
      ? (coach.content as CoachContent)
      : null;

  return (
    <div className="max-w-[480px] mx-auto">
      {/* Header */}
      <div className="text-center pt-2 pb-1">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8B7355]">
          {t.kicker}
        </p>
        <h1 className="text-[26px] font-extrabold text-[#1a1a1a] leading-tight mt-1.5" style={{ fontFamily: "Georgia, serif" }}>
          {!member.dog_name?.trim() ? t.namePrefix : `${member.dog_name?.trim()}s`} <span className="text-[#B0894E]">Coach</span> 🎧
        </h1>
        <p className="text-[14px] text-[#6B7280] leading-snug mt-2 max-w-[34ch] mx-auto">
          {t.subtitle}
        </p>
      </div>

      {!isPaid && (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-6 mt-6 text-center">
          <div className="text-[34px]">🎧</div>
          <h2 className="text-[18px] font-extrabold text-[#1a1a1a] mt-2">{t.unlockTitle}</h2>
          <p className="text-[14px] text-[#6B7280] leading-snug mt-2">
            {t.unlockText}
          </p>
          <Link
            href={`/pfoten-coach?email=${encodeURIComponent(member.email || user.email || "")}${member.dog_name?.trim() ? `&dog=${encodeURIComponent(member.dog_name.trim())}` : ""}`}
            className="inline-flex items-center gap-2 text-[15px] font-extrabold text-white bg-gradient-to-b from-[#CAA86F] to-[#B0894E] rounded-[14px] px-5 py-3 mt-5 shadow-sm"
          >
            {t.unlockCta}
          </Link>
        </div>
      )}

      {isPaid && !content && (
        <div className="bg-[#FFF9F0] border border-[#EADDC5] rounded-2xl p-6 mt-6 text-center">
          <div className="text-[34px]">🎙️</div>
          <h2 className="text-[18px] font-extrabold text-[#1a1a1a] mt-2">{t.creatingTitle}</h2>
          <p className="text-[14px] text-[#6B7280] leading-relaxed mt-2">
            {t.creatingText}
          </p>
        </div>
      )}

      {isPaid && content && (
        <div className="mt-6">
          <CoachPlayer content={content} lang={lang} />
        </div>
      )}

      <p className="text-center text-[12px] text-[#9aa2ad] mt-8 leading-relaxed">
        {t.footerPre}{" "}
        <a href="mailto:support@pfoten-plan.de" className="text-[#B0894E] font-bold">support@pfoten-plan.de</a>
      </p>
    </div>
  );
}
