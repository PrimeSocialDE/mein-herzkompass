"use client";

// Banner direkt nach Mollie-Kauf (Dashboard-Flow).
// Wenn Plan schon da: gruener "Plan ist da" Banner, statisch.
// Wenn noch nicht: warmer "Wird gerade erstellt" Banner mit Auto-Reload alle 6s.
// Pruefen via hasRichPlan-Prop — wir wissen aus dem Server-Render ob
// member_plan_content schon existiert.

import { useEffect, useState } from "react";

export default function PurchaseSuccessBanner({
  hasRichPlan,
}: {
  hasRichPlan: boolean;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (hasRichPlan) return;
    // Plan noch nicht da: alle 6s die Page neu laden um zu sehen ob er fertig ist.
    // Plan-Generation dauert i.d.R. 15-25s. Nach 60s aufgeben (User kann manuell reloaden).
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
      window.location.reload();
    }, 6000);
    const giveUp = setTimeout(() => clearInterval(interval), 60_000);
    return () => {
      clearInterval(interval);
      clearTimeout(giveUp);
    };
  }, [hasRichPlan]);

  if (hasRichPlan) {
    return (
      <div className="mb-5 bg-gradient-to-br from-[#F0FDF4] to-[#DCFCE7] border border-[#86EFAC] rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="text-[28px] leading-none flex-shrink-0">🎉</div>
          <div>
            <p className="text-[14px] font-bold text-[#15803D] mb-1">
              Dein Plan ist da!
            </p>
            <p className="text-[13px] text-[#166534] leading-relaxed">
              Du findest ihn gleich unten — plus eine Mail mit dem PDF im
              Anhang ist unterwegs.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div
          className="w-7 h-7 border-[3px] border-[#C4A576] border-t-transparent rounded-full flex-shrink-0"
          style={{ animation: "spin 1s linear infinite" }}
        />
        <div>
          <p className="text-[14px] font-bold text-[#1a1a1a] mb-1">
            Dein Plan wird gerade erstellt
          </p>
          <p className="text-[13px] text-[#6B7280] leading-relaxed">
            Wir bauen ihn personalisiert zusammen — dauert noch ca. 15-30
            Sekunden. Die Seite lädt automatisch neu, sobald er fertig ist.
            Eine Mail mit PDF kommt parallel raus.
          </p>
        </div>
      </div>
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
