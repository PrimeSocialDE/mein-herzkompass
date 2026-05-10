// /wochen-check-demo — Public Vorschau der KI-Wochen-Begleitung.
// Lead-Magnet: User waehlt Problem, beantwortet 4-5 konkrete Fragen,
// bekommt LIVE eine KI-Wochen-Zusammenfassung. CTA → Plan kaufen.
//
// Kein Login noetig. Backend-Endpoint ist rate-limited per IP.

import DemoFlow from "./DemoFlow";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pfoten-Plan KI-Wochen-Coach (kostenlose Vorschau)",
  description:
    "Probier die KI-Wochen-Begleitung gratis - in 60 Sek bekommst du eine konkrete Empfehlung für deinen Hund.",
};

const PROBLEMS = [
  { key: "pulling", emoji: "🐕", label: "Leinen­ziehen" },
  { key: "barking", emoji: "🗣️", label: "Bellen" },
  { key: "aggression", emoji: "⚠️", label: "Aggression" },
  { key: "anxiety", emoji: "😰", label: "Trennungs­angst" },
  { key: "jumping", emoji: "🦘", label: "Anspringen" },
  { key: "recall", emoji: "📣", label: "Rückruf" },
  { key: "energy", emoji: "⚡", label: "Zu viel Energie" },
  { key: "destructive", emoji: "🪑", label: "Zerstören" },
  { key: "soiling", emoji: "💧", label: "Stuben­reinheit" },
  { key: "mouthing", emoji: "🌿", label: "Bodenfresser" },
];

export default function WochenCheckDemoPage() {
  return (
    <main className="min-h-screen bg-[#FAF8F5] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">
            Kostenlose Vorschau · 60 Sekunden
          </p>
          <h1 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight mb-3">
            Probier den KI-Wochen-Coach
          </h1>
          <p className="text-[14px] md:text-[15px] text-[#4B5563] leading-relaxed max-w-lg mx-auto">
            Beantworte 4-5 kurze Fragen zu deinem Hund - die KI gibt dir eine
            konkrete Wochen-Empfehlung. Keine Anmeldung nötig.
          </p>
        </div>

        <DemoFlow problems={PROBLEMS} />

        {/* Trust-Strip */}
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] text-[#9CA3AF]">
          <span>✓ Keine Anmeldung</span>
          <span>✓ Antwort in 30 Sek</span>
          <span>✓ Von Hundetrainern entwickelt</span>
        </div>
      </div>
    </main>
  );
}
