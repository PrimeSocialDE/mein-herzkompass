"use client";

import { useState } from "react";

export default function StartClubButton({
  email,
  dogName,
  leadId,
}: {
  email?: string | null;
  dogName?: string | null;
  leadId?: string | null;
}) {
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
      setErr(data.error || "Konnte nicht starten. Bitte später erneut versuchen.");
      setLoading(false);
    } catch {
      setErr("Netzwerkfehler. Bitte erneut versuchen.");
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
        {loading ? "Einen Moment …" : "Club starten →"}
      </button>
      {err && <p className="text-[12px] text-red-600 mt-2">{err}</p>}
    </div>
  );
}
