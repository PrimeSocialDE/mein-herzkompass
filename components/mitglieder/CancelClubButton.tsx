"use client";

import { useState } from "react";

export default function CancelClubButton() {
  const [state, setState] = useState<"idle" | "confirm" | "loading" | "done">("idle");
  const [until, setUntil] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function cancel() {
    setState("loading");
    setErr(null);
    try {
      const res = await fetch("/api/mitglieder/club/cancel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setUntil(data.accessUntil || null);
        setState("done");
      } else {
        setErr(data.error || "Kündigung fehlgeschlagen. Bitte später erneut.");
        setState("confirm");
      }
    } catch {
      setErr("Netzwerkfehler. Bitte erneut versuchen.");
      setState("confirm");
    }
  }

  if (state === "done") {
    const d = until ? new Date(until).toLocaleDateString("de-DE") : null;
    return (
      <p className="text-[12.5px] text-[#4B5563] mt-5">
        Dein Club ist gekündigt.{" "}
        {d ? `Du hast noch bis ${d} Zugang.` : "Der Zugang läuft zum Periodenende aus."}
      </p>
    );
  }

  if (state === "idle") {
    return (
      <button
        onClick={() => setState("confirm")}
        className="text-[12px] text-[#9CA3AF] underline mt-6 hover:text-[#6B7280]"
      >
        Abo kündigen
      </button>
    );
  }

  return (
    <div className="mt-6 text-center">
      <p className="text-[12.5px] text-[#4B5563] mb-2">
        Wirklich kündigen? Dein Zugang bleibt bis zum Ende des bezahlten Monats.
      </p>
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={cancel}
          disabled={state === "loading"}
          className="rounded-full px-4 py-1.5 text-[12px] font-bold text-white bg-[#B7945A] disabled:opacity-60"
        >
          {state === "loading" ? "Einen Moment …" : "Ja, kündigen"}
        </button>
        <button
          onClick={() => setState("idle")}
          className="rounded-full px-4 py-1.5 text-[12px] font-bold text-[#4B5563] bg-[#EFE9DE]"
        >
          Abbrechen
        </button>
      </div>
      {err && <p className="text-[12px] text-red-600 mt-2">{err}</p>}
    </div>
  );
}
