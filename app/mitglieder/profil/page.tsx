import { getCurrentMember } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";

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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          Profil
        </p>
        <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-tight text-[#1a1a1a]">
          Deine Daten
        </h1>
      </div>

      <div className="bg-white border border-[#EADDC5] rounded-2xl p-6 space-y-4">
        <Row label="E-Mail" value={member.email} />
        {member.name && <Row label="Name" value={member.name} />}
        {member.dog_name && <Row label="Hundename" value={member.dog_name} />}
        {member.dog_breed && <Row label="Rasse" value={member.dog_breed} />}
        <Row
          label="Status"
          value={
            member.purchase_status === "paid"
              ? "✓ Voller Plan freigeschaltet"
              : "Noch ohne Plan"
          }
        />
        {member.purchased_at && (
          <Row
            label="Plan gekauft am"
            value={new Date(member.purchased_at).toLocaleDateString("de-DE")}
          />
        )}
      </div>

      <p className="text-[12px] text-[#9CA3AF] text-center">
        Daten ändern oder Konto löschen? Schreib uns:{" "}
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
