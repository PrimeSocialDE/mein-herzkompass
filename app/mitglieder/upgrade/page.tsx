import Link from "next/link";
import { getCurrentMember } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile, listActiveUpsells } from "@/lib/member-db";
import { getMemberLang } from "@/lib/member-lang";
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

const PROBLEM_LABELS_PL: Record<string, string> = {
  pulling: "Ciągnięcie na smyczy",
  barking: "Szczekanie",
  aggression: "Agresja",
  anxiety: "Lęk separacyjny",
  jumping: "Skakanie na ludzi",
  recall: "Przywołanie",
  energy: "Energia",
  destructive: "Niszczenie",
  soiling: "Czystość w domu",
  mouthing: "Podnoszenie z ziemi",
};

export default async function UpgradePage({
  searchParams,
}: {
  searchParams?: Promise<{ preview?: string }>;
}) {
  const sp = (await searchParams) || {};
  // Test-Preview: ?preview=free zwingt Free-View an, auch wenn Paid-User
  // (konsistent mit /mitglieder page).
  const previewFreeView = sp.preview === "free";

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
  const lang = await getMemberLang(user?.email ?? member?.email ?? null);
  const upsells = await listActiveUpsells();
  const isPaid = previewFreeView
    ? false
    : member.purchase_status === "paid";
  const dog =
    member.dog_name?.trim() || (lang === "pl" ? "Twojego psa" : "deinen Hund");
  const problemKey =
    member.quiz_result?.dog_problem || member.quiz_result?.problem || null;
  const problemLabels = lang === "pl" ? PROBLEM_LABELS_PL : PROBLEM_LABELS;
  const problemLabel = problemKey ? problemLabels[problemKey] || null : null;
  const t =
    lang === "pl"
      ? {
          kicker: "Ulepszenie",
          headPaid: "Rozszerz moduły",
          headProblem: `Rozwiąż ${problemLabel} u ${dog}`,
          headFree: `Odblokuj plan dla ${dog}`,
          howTitle: "To takie proste",
          stepHome: "Z domu",
          stepDaily: "5 min dziennie",
          stepChat: "Pomoc na czacie",
          stepPdf: "PDF na wynos",
          moreTitle: `Więcej dla ${dog}?`,
          moreText:
            "Tematy specjalne, jak agresja, lęk separacyjny czy podróż, są dostępne jako pojedyncze moduły w przeglądzie modułów.",
          moreCta: "Zobacz przegląd modułów",
        }
      : {
          kicker: "Upgrade",
          headPaid: "Module erweitern",
          headProblem: `${problemLabel} bei ${dog} lösen`,
          headFree: `Plan freischalten für ${dog}`,
          howTitle: "So einfach geht’s",
          stepHome: "Von zuhause aus",
          stepDaily: "5 Min am Tag",
          stepChat: "Hilfe per Chat",
          stepPdf: "PDF zum Mitnehmen",
          moreTitle: `Mehr für ${dog}?`,
          moreText:
            "Spezial-Themen wie Aggression, Trennungsangst oder Reise gibt’s als Einzel-Module in der Modul-Übersicht.",
          moreCta: "Modul-Übersicht ansehen",
        };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          {t.kicker}
        </p>
        <h1 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          {isPaid
            ? t.headPaid
            : problemLabel
              ? t.headProblem
              : t.headFree}
        </h1>
      </div>

      {/* Plan-Auswahl (nur fuer Free-User) */}
      {!isPaid && (
        <PlanOptionsCard
          dogName={member.dog_name}
          email={member.email}
          leadId={member.source_lead_id}
          lang={lang}
        />
      )}

      {/* So einfach gehts — 4 Icons in einer Reihe (Mobile: 2x2) */}
      {!isPaid && (
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-4">
          <p className="text-[12px] font-bold uppercase tracking-widest text-[#8B7355] mb-3 text-center">
            {t.howTitle}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: "🏠", label: t.stepHome },
              { icon: "⏱️", label: t.stepDaily },
              { icon: "💬", label: t.stepChat },
              { icon: "📄", label: t.stepPdf },
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
            {t.moreTitle}
          </h2>
          <p className="text-[13px] text-[#6B7280] mb-4 leading-relaxed">
            {t.moreText}
          </p>
          <Link
            href="/mitglieder/module"
            className="inline-flex items-center gap-2 bg-[#C4A576] text-white font-semibold py-3 px-5 rounded-xl text-[14px] shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            {t.moreCta} <span aria-hidden>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
