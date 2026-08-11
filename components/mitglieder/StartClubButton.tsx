"use client";

import { useState } from "react";

export default function StartClubButton({
  email,
  dogName,
  leadId,
  lang = "de",
}: {
  email?: string | null;
  dogName?: string | null;
  leadId?: string | null;
  lang?: "de" | "pl" | "it";
}) {
  const t =
    lang === "pl"
      ? {
          startFail: "Nie udało się rozpocząć. Spróbuj ponownie później.",
          netFail: "Błąd sieci. Spróbuj ponownie.",
          loading: "Chwileczkę …",
          start: "Rozpocznij klub →",
        }
      : lang === "it"
      ? {
          startFail: "Impossibile avviare. Riprova più tardi.",
          netFail: "Errore di rete. Riprova.",
          loading: "Un attimo …",
          start: "Avvia il Club →",
        }
      : {
          startFail: "Konnte nicht starten. Bitte später erneut versuchen.",
          netFail: "Netzwerkfehler. Bitte erneut versuchen.",
          loading: "Einen Moment …",
          start: "Club starten →",
        };
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/mollie/abo-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, dogName, leadId }),
      });
      const data = await res.json().catch(() => ({}));
      // Braucht ein Mandate/Erstzahlung → Redirect zu Mollie
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      // Direkt gestartet (Mandate vorhanden) → ins Dashboard
      if (res.ok && data.ok) {
        window.location.href = "/mitglieder?club=1";
        return;
      }
      setErr(data.error || t.startFail);
      setLoading(false);
    } catch {
      setErr(t.netFail);
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={start}
        disabled={loading}
        className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-7 py-3 text-[15px] font-extrabold text-white bg-gradient-to-b from-[#C9A868] to-[#B7945A] shadow-sm disabled:opacity-60"
      >
        {loading ? t.loading : t.start}
      </button>
      {err && <p className="text-[12px] text-red-600 mt-2">{err}</p>}
    </div>
  );
}
