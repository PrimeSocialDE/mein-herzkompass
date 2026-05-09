import { getCurrentMember } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile, listActiveUpsells } from "@/lib/member-db";
import PlanOptionsCard from "@/components/mitglieder/PlanOptionsCard";

export const dynamic = "force-dynamic";

export default async function UpgradePage() {
  const user = await getCurrentMember();
  if (!user) {
    return <div className="text-[#6B7280]">Bitte einloggen.</div>;
  }
  const member = await getOrCreateMemberProfile({
    userId: user.id,
    email: user.email || "",
  });
  const upsells = await listActiveUpsells();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          Upgrade
        </p>
        <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-tight text-[#1a1a1a]">
          {member.purchase_status === "paid" ? "Module erweitern" : "Plan freischalten"}
        </h1>
      </div>

      {member.purchase_status !== "paid" && (
        <PlanOptionsCard dogName={member.dog_name} />
      )}

      {upsells.length > 0 && (
        <div>
          <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-3">
            Zusätzliche Module
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upsells.map((u: any) => (
              <div
                key={u.id}
                className="bg-white border border-[#EADDC5] rounded-2xl p-5"
              >
                {u.badge_text && (
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-[#FFF9F0] text-[#8B7355] px-2 py-0.5 rounded-md mb-2">
                    {u.badge_text}
                  </span>
                )}
                <h4 className="text-[15px] font-bold text-[#1a1a1a] mb-1">
                  {u.title}
                </h4>
                {u.description && (
                  <p className="text-[12px] text-[#6B7280] leading-relaxed mb-3">
                    {u.description}
                  </p>
                )}
                <div className="flex items-baseline justify-between">
                  <div className="text-[18px] font-extrabold text-[#C4A576]">
                    €{(u.price_cents / 100).toFixed(2).replace(".", ",")}
                  </div>
                  <button
                    disabled
                    className="bg-[#C4A576] text-white font-semibold py-2 px-4 rounded-lg text-[12px] opacity-60"
                    title="Kommt bald"
                  >
                    Bald verfügbar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
