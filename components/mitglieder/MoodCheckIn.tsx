"use client";

// Inline-Check-in fuer den Stimmungs-Tagebuch.
// 3 Mood-Buttons + optionales Notizfeld + Speichern.
// Optimistic UX: nach Save → 'Eingetragen!' Bestaetigung.

import { useState } from "react";

type Mood = "gut" | "mittel" | "schwierig";

const MOODS: { key: Mood; emoji: string; label: string; color: string }[] = [
  { key: "gut", emoji: "😊", label: "Gut gelaufen", color: "#16A34A" },
  { key: "mittel", emoji: "😐", label: "Mittel", color: "#F59E0B" },
  { key: "schwierig", emoji: "😞", label: "Schwierig", color: "#DC2626" },
];

export default function MoodCheckIn() {
  const [selected, setSelected] = useState<Mood | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");

  async function save() {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/mitglieder/mood/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood: selected,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Speichern fehlgeschlagen");
        setSaving(false);
        return;
      }
      setSavedAt(new Date());
      setTimeout(() => {
        setSelected(null);
        setNote("");
        setShowNote(false);
        setSavedAt(null);
        setSaving(false);
        // Page-Reload damit Verlauf den neuen Eintrag sofort zeigt
        window.location.reload();
      }, 1500);
    } catch (e) {
      setError("Verbindungsfehler. Versuch's gleich nochmal.");
      setSaving(false);
    }
  }

  if (savedAt) {
    return (
      <div className="bg-white border border-[#C4A576] rounded-2xl p-5 text-center">
        <div className="text-[40px] mb-2">✅</div>
        <p className="text-[15px] font-bold text-[#1a1a1a]">Eingetragen!</p>
        <p className="text-[12px] text-[#6B7280] mt-1">
          Lädt deinen Verlauf gleich neu...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#EADDC5] rounded-2xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
        Wie lief&rsquo;s heute?
      </p>
      <p className="text-[15px] font-bold text-[#1a1a1a] mb-4 leading-tight">
        Trag kurz ein wie deine letzte Übung war
      </p>

      {/* 3 Mood-Buttons */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {MOODS.map((m) => {
          const isSel = selected === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setSelected(m.key)}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-colors ${
                isSel
                  ? "border-[#C4A576] bg-[#FFF9F0]"
                  : "border-[#EADDC5] bg-white"
              }`}
              style={isSel ? { borderColor: m.color } : undefined}
            >
              <span className="text-[28px] leading-none">{m.emoji}</span>
              <span className="text-[11px] font-semibold text-[#1a1a1a]">
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Notiz (optional, einklappbar) */}
      {selected && (
        <>
          {!showNote ? (
            <button
              onClick={() => setShowNote(true)}
              className="text-[12px] text-[#8B7355] underline underline-offset-2 mb-3"
            >
              + Kurze Notiz dazu (optional)
            </button>
          ) : (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. 'Beim 3. Versuch klappte es mit dem Sitz'"
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 border border-[#EADDC5] rounded-lg text-[13px] mb-3 focus:outline-none focus:border-[#C4A576]"
            />
          )}

          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-[#C4A576] disabled:opacity-60 text-white font-semibold py-2.5 px-5 rounded-xl text-[13px] shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            {saving ? "Speichere…" : "Eintragen"}
          </button>
          {error && (
            <p className="text-[11px] text-[#B91C1C] text-center mt-2">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
