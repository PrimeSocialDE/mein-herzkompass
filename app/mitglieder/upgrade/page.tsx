import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile, listActiveUpsells } from "@/lib/member-db";
import PlanOptionsCard from "@/components/mitglieder/PlanOptionsCard";

export const dynamic = "force-dynamic";

const PROBLEM_LABELS: Record<string, string> = {
  pulling: "Leinenziehen",
  barking: "Bellen",
  aggression: "Aggression",
  anxiety: "Trennungsangst",
  jumping: "Anspringen",
  recall: "Rückruf",
  energy: "Energie",
  destructive: "Zerstörungsverhalten",
  soiling: "Stubenreinheit",
  mouthing: "Aufnehmen vom Boden",
};

export default async function UpgradePage() {
  const user = await getCurrentMember();
  if (!user) {
    return (
      <div className="text-[#6B7280]">
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
  const isPaid = member.purchase_status === "paid";
  const dog = member.dog_name?.trim() || "deinen Hund";
  const problemKey =
    member.quiz_result?.dog_problem || member.quiz_result?.problem || null;
  const problemLabel = problemKey ? PROBLEM_LABELS[problemKey] || null : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          Upgrade
        </p>
        <h1 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          {isPaid
            ? "Module erweitern"
            : problemLabel
              ? `${problemLabel} bei ${dog} lösen`
              : `Plan freischalten für ${dog}`}
        </h1>
      </div>

      {/* Plan-Auswahl (nur fuer Free-User) */}
      {!isPaid && (
        <PlanOptionsCard
          dogName={member.dog_name}
          email={member.email}
          leadId={member.source_lead_id}
        />
      )}

      {/* So einfach gehts — 4 Icons in einer Reihe (Mobile: 2x2) */}
      {!isPaid && (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-4">
          <p className="text-[12px] font-bold uppercase tracking-widest text-[#8B7355] mb-3 text-center">
            So einfach geht&rsquo;s
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: "🏠", label: "Von zuhause aus" },
              { icon: "⏱️", label: "5 Min am Tag" },
              { icon: "💬", label: "Hilfe per Chat" },
              { icon: "📄", label: "PDF zum Mitnehmen" },
            ].map((step) => (
              <div key={step.label} className="text-center">
                <div className="text-[28px] leading-none mb-1">{step.icon}</div>
                <p className="text-[12px] font-semibold text-[#1a1a1a] leading-tight">
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zusatz-Module: Verweis auf den Modul-Shop (nur fuer Paid) */}
      {isPaid && upsells.length > 0 && (
        <div>
          <h2 className="text-[18px] md:text-[20px] font-bold text-[#1a1a1a] mb-1">
            Mehr für {dog}?
          </h2>
          <p className="text-[13px] text-[#6B7280] mb-4 leading-relaxed">
            Spezial-Themen wie Aggression, Trennungsangst oder Reise gibt&rsquo;s
            als Einzel-Module im Modul-Shop.
          </p>
          <Link
            href="/mitglieder/module"
            className="inline-flex items-center gap-2 bg-[#C4A576] text-white font-semibold py-3 px-5 rounded-xl text-[14px] shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            Modul-Shop ansehen <span aria-hidden>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
