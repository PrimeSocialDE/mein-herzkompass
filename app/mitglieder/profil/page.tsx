import { getCurrentMember } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";
import { getMemberLang } from "@/lib/member-lang";
import SetPasswordCard from "./SetPasswordCard";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const user = await getCurrentMember();
  if (!user) {
    return <div className="text-[#6B7280]">Bitte einloggen.</div>;
  }
  const member = await getOrCreateMemberProfile({
    userId: user.id,
    email: user.email || "",
  });
  const lang = await getMemberLang(user?.email ?? member?.email ?? null);
  const t =
    lang === "pl"
      ? {
          kicker: "Profil",
          title: "Twoje dane",
          email: "E-mail",
          name: "Imię",
          dogName: "Imię psa",
          breed: "Rasa",
          status: "Status",
          statusPaid: "✓ Pełny plan odblokowany",
          statusFree: "Jeszcze bez planu",
          purchasedAt: "Plan kupiony dnia",
          footerPre: "Chcesz zmienić dane lub usunąć konto? Napisz do nas:",
        }
      : {
          kicker: "Profil",
          title: "Deine Daten",
          email: "E-Mail",
          name: "Name",
          dogName: "Hundename",
          breed: "Rasse",
          status: "Status",
          statusPaid: "✓ Voller Plan freigeschaltet",
          statusFree: "Noch ohne Plan",
          purchasedAt: "Plan gekauft am",
          footerPre: "Daten ändern oder Konto löschen? Schreib uns:",
        };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          {t.kicker}
        </p>
        <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-tight text-[#1a1a1a]">
          {t.title}
        </h1>
      </div>

      <div className="bg-white border border-[#EADDC5] rounded-2xl p-6 space-y-4">
        <Row label={t.email} value={member.email} />
        {member.name && <Row label={t.name} value={member.name} />}
        {member.dog_name && <Row label={t.dogName} value={member.dog_name} />}
        {member.dog_breed && <Row label={t.breed} value={member.dog_breed} />}
        <Row
          label={t.status}
          value={
            member.purchase_status === "paid"
              ? t.statusPaid
              : t.statusFree
          }
        />
        {member.purchased_at && (
          <Row
            label={t.purchasedAt}
            value={new Date(member.purchased_at).toLocaleDateString("de-DE")}
          />
        )}
      </div>

      <SetPasswordCard lang={lang} />

      <p className="text-[12px] text-[#9CA3AF] text-center">
        {t.footerPre}{" "}
        <a
          href="mailto:support@pfoten-plan.de"
          className="text-[#8B7355] underline"
        >
          support@pfoten-plan.de
        </a>
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#F0EBE3] last:border-b-0 pb-3 last:pb-0">
      <div className="text-[12px] font-semibold text-[#9CA3AF] uppercase tracking-wide">
        {label}
      </div>
      <div className="text-[14px] text-[#1a1a1a] text-right">{value}</div>
    </div>
  );
}
