// "Dein Hund"-Profil-Card. Nutzt die Quiz-Daten direkt aus Supabase
// (member_users.quiz_result + dog_name/dog_breed Top-Level) um dem User
// zu zeigen "wir kennen deinen Hund". Pure Personalisierung — wirkt
// emotional viel stärker als "Hallo {Name}".

import { PROBLEM_IMAGE } from "@/lib/member-images";

const PROBLEM_LABELS: Record<string, string> = {
  pulling: "Leinenziehen",
  barking: "Übermäßiges Bellen",
  aggression: "Aggression",
  anxiety: "Trennungsangst",
  jumping: "Anspringen",
  recall: "Rückruf-Probleme",
  energy: "Übermäßige Energie",
  destructive: "Zerstörungsverhalten",
  soiling: "Stubenreinheit",
  mouthing: "Aufnehmen von Gegenständen",
  "visitor-anxiety": "Angst bei Besuch",
  "thunder-anxiety": "Gewitterangst",
  "noise-sensitivity": "Geräuschempfindlichkeit",
  "general-anxiety": "Allgemeine Ängstlichkeit",
  "stranger-anxiety": "Angst vor Fremden",
  separation: "Trennungsangst",
  chasing: "Jagdverhalten",
  "chasing-movement": "Jagt Bewegungen",
  "prey-drive": "Starker Jagdtrieb",
  "chasing-cars": "Jagt Autos",
};

interface DogProfileCardProps {
  dogName: string | null;
  dogBreed: string | null;
  quizResult: any; // JSONB
}

function formatAge(age: any): string | null {
  if (!age) return null;
  const a = String(age).toLowerCase();
  if (a === "puppy" || a.includes("welp")) return "Welpe";
  if (a.includes("jung")) return "Jungtier";
  if (a.includes("senior")) return "Senior";
  if (/^\d/.test(a)) {
    const num = parseInt(a);
    if (num === 1) return "1 Jahr";
    if (num > 1 && num < 25) return `${num} Jahre`;
  }
  return String(age);
}

function formatSize(size: any): string | null {
  if (!size) return null;
  const s = String(size).toLowerCase();
  if (s.includes("klein") || s === "small") return "Klein";
  if (s.includes("mittel") || s === "medium") return "Mittel";
  if (s.includes("groß") || s === "large" || s === "gross") return "Groß";
  return String(size);
}

export default function DogProfileCard({
  dogName,
  dogBreed,
  quizResult,
}: DogProfileCardProps) {
  const q = quizResult || {};
  const problemKey = q.dog_problem || q.problem;
  const problemLabel = problemKey ? PROBLEM_LABELS[problemKey] || null : null;
  const heroImage = problemKey ? PROBLEM_IMAGE[problemKey] : null;
  const age = formatAge(q.dog_age);
  const size = formatSize(q.dog_size);
  const commands: string[] = Array.isArray(q.dog_commands) ? q.dog_commands : [];

  // Stats-Reihe zusammenstellen — nur was vorhanden ist
  const stats: { label: string; value: string }[] = [];
  if (dogBreed) stats.push({ label: "Rasse", value: dogBreed });
  if (age) stats.push({ label: "Alter", value: age });
  if (size) stats.push({ label: "Größe", value: size });

  // Bekannte Kommandos (max 4 zeigen)
  const knownCommands = commands.slice(0, 4);

  // Wenn gar keine Daten — Card überspringen
  if (!dogName && !dogBreed && !age && !problemLabel) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#EADDC5] shadow-[0_2px_12px_rgba(139,115,85,0.06)] overflow-hidden mb-6">
      {/* Top-Bereich: Avatar + Name + Stats */}
      <div className="px-5 md:px-6 py-5 flex items-start gap-4">
        {/* Hund-Avatar (Problem-Bild oder Default) */}
        <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden bg-[#FAF4E8] flex-shrink-0 ring-2 ring-[#C4A576]/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage || "/Hund1.jpg"}
            alt={dogName || "Dein Hund"}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
            Dein Hund
          </p>
          <h2 className="text-[20px] md:text-[24px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight mb-1">
            {dogName || "Dein Hund"}
          </h2>
          {stats.length > 0 && (
            <p className="text-[13px] text-[#6B7280] leading-snug">
              {stats.map((s) => s.value).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Hauptthema-Banner */}
      {problemLabel && (
        <div className="px-5 md:px-6 pb-4">
          <div className="flex items-center gap-3 bg-[#FFF9F0] border border-[#EADDC5] rounded-xl px-4 py-3">
            <div className="text-xl leading-none">🎯</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355]">
                Hauptthema
              </p>
              <p className="text-[14px] font-bold text-[#1a1a1a] leading-snug">
                {problemLabel}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bekannte Kommandos (falls erfasst) */}
      {knownCommands.length > 0 && (
        <div className="px-5 md:px-6 pb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">
            Was {dogName || "dein Hund"} schon kann
          </p>
          <div className="flex flex-wrap gap-1.5">
            {knownCommands.map((cmd) => (
              <span
                key={cmd}
                className="inline-flex items-center gap-1 bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-[12px] font-medium px-2.5 py-1 rounded-full"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                {cmd}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
