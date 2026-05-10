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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          Upgrade
        </p>
        <h1 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          {isPaid
            ? "Module erweitern"
            : problemLabel
              ? `Plan freischalten — ${problemLabel} bei ${dog} lösen`
              : `Plan freischalten für ${dog}`}
        </h1>
        {!isPaid && (
          <p className="text-[14px] text-[#4B5563] mt-2 leading-relaxed">
            Klar geplant, Schritt für Schritt aufeinander aufgebaut. Damit du
            weißt was du tust und nicht im Nebel stocherst.
          </p>
        )}
      </div>

      {/* Plan-Auswahl (nur fuer Free-User) */}
      {!isPaid && <PlanOptionsCard dogName={member.dog_name} />}

      {/* Was passiert nach dem Kauf — Reassurance */}
      {!isPaid && (
        <div>
          <h2 className="text-[18px] md:text-[20px] font-bold text-[#1a1a1a] mb-3">
            Was passiert direkt nach dem Kauf
          </h2>
          <div className="space-y-3">
            {[
              {
                emoji: "⚡",
                title: "Sofort: erstes Modul freigeschaltet",
                body: `Du landest direkt in deinem Mitgliederbereich und kannst loslegen — keine Wartezeit.`,
              },
              {
                emoji: "📧",
                title: "PDF im Postfach",
                body: `Dein personalisierter Plan kommt parallel als PDF — perfekt zum Ausdrucken und an den Kühlschrank kleben.`,
              },
              {
                emoji: "📅",
                title: "Wöchentlicher Aufbau",
                body: `Jede Woche werden neue Module + Aufgaben freigeschaltet. Kein Overload — alles in dem Tempo das wirklich wirkt.`,
              },
              {
                emoji: "🤖",
                title: "Bei Fragen: KI-Trainer + Team-Support",
                body: `Im Chat bekommst du sofort Antworten. Bei kniffligen Themen schreibst du dem Trainer-Team eine Mail.`,
              },
            ].map((s, i) => (
              <div
                key={i}
                className="bg-white border border-[#EADDC5] rounded-2xl p-4 flex items-start gap-3"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#FFF9F0] flex items-center justify-center text-[18px]">
                  {s.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-[#1a1a1a] leading-tight mb-0.5">
                    {s.title}
                  </p>
                  <p className="text-[12px] text-[#6B7280] leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zusatz-Module: Verweis auf den Modul-Shop */}
      {upsells.length > 0 && (
        <div>
          <h2 className="text-[18px] md:text-[20px] font-bold text-[#1a1a1a] mb-1">
            Schon Plan, willst mehr?
          </h2>
          <p className="text-[13px] text-[#6B7280] mb-4 leading-relaxed">
            Spezial-Themen wie Aggression, Trennungsangst oder Reise gibt's als
            Einzel-Module im Modul-Shop.
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
