"use client";

// Timed Upgrade-Popup fuer Free-User auf der Uebersicht.
// Erscheint nach 75 Sek auf der Page, nur wenn:
// - Noch nicht in dieser Session gezeigt (sessionStorage)
// - Cooldown nicht aktiv (localStorage, 7 Tage nach 'Spaeter')
//
// Klick auf 'Plan waehlen' → direkt zu Mollie-Checkout (3-Monat).
// Klick auf 'X' → close (kommt naechste Session wieder).
// Klick auf 'Spaeter' → 7-Tage-Cooldown.

import { useEffect, useState } from "react";

const SHOWN_KEY = "pp_upgrade_popup_shown";
const COOLDOWN_KEY = "pp_upgrade_popup_cooldown";
const SHOW_DELAY_MS = 180_000; // 3 Min — User soll erst Inhalt entdecken
const COOLDOWN_DAYS = 7;

interface Props {
  email: string;
  leadId: string | null;
  dogName: string | null;
}

export default function UpgradePopup({ email, leadId, dogName }: Props) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SHOWN_KEY)) return;

    const cooldownUntilStr = localStorage.getItem(COOLDOWN_KEY);
    if (cooldownUntilStr) {
      const cooldownMs = parseInt(cooldownUntilStr, 10);
      if (Number.isFinite(cooldownMs) && cooldownMs > Date.now()) return;
    }

    const timer = setTimeout(() => {
      setShow(true);
      sessionStorage.setItem(SHOWN_KEY, "1");
    }, SHOW_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  // ESC-Key schliesst Popup
  useEffect(() => {
    if (!show) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShow(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  function close() {
    setShow(false);
  }

  function later() {
    if (typeof window !== "undefined") {
      const until = Date.now() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(COOLDOWN_KEY, String(until));
    }
    setShow(false);
  }

  async function buy() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mollie/wauwerk-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "3month",
          email,
          leadId: leadId || undefined,
          dogName: dogName || undefined,
          utm_source: "member-area",
          utm_campaign: "upgrade-popup",
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Konnte Checkout nicht starten");
        setLoading(false);
      }
    } catch (e) {
      setError("Verbindungsfehler. Versuch's gleich nochmal.");
      setLoading(false);
    }
  }

  if (!show) return null;

  const dog = dogName?.trim() || "deinem Hund";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 overflow-y-auto animate-in fade-in"
      onClick={close}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image-Header (3-Monat-Plan) mit Close-Button + Badge */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[#FAF4E8]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/3Monat.jpg"
            alt="3-Monats-Plan"
            className="w-full h-full object-cover"
          />
          <button
            onClick={close}
            className="absolute top-3 right-3 bg-white/95 rounded-full p-1.5 text-[#1a1a1a] shadow"
            aria-label="Schließen"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">
            Empfohlen · 12 Wochen Plan
          </p>
          <h2 className="text-[20px] sm:text-[22px] font-extrabold text-[#1a1a1a] leading-tight mb-2">
            Bring {dog} im Wohlfühl-Tempo ans Ziel
          </h2>
          <p className="text-[13px] text-[#4B5563] leading-relaxed mb-4">
            Mehr Übungen für mehr Tiefe. Alle Themen abgedeckt. Klar
            strukturiert, gut machbarer Aufwand.
          </p>

          {/* Preis-Kasten */}
          <div className="bg-[#FFF9F0] border border-[#EADDC5] rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[24px] font-extrabold text-[#1a1a1a] leading-none">
                €39,99
              </p>
              <p className="text-[11px] text-[#6B7280] mt-1">
                Nur 44 Cent am Tag · einmalig
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-[#15803D] font-bold uppercase tracking-wider bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-1 rounded-full text-center leading-tight">
              30 Tage<br />
              Geld zurück
            </span>
          </div>

          <button
            onClick={buy}
            disabled={loading}
            className="w-full bg-[#C4A576] disabled:opacity-60 text-white font-semibold py-3 px-5 rounded-xl text-[14px] shadow-[0_1px_2px_rgba(139,115,85,0.2)] mb-2"
          >
            {loading ? "Lade Checkout…" : "Plan wählen →"}
          </button>
          {error && (
            <p className="text-[11px] text-[#B91C1C] text-center mb-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 mt-1">
            <a
              href="/mitglieder/upgrade"
              className="text-[12px] text-[#8B7355] underline underline-offset-2"
            >
              Alle 3 Pläne ansehen
            </a>
            <button
              onClick={later}
              className="text-[12px] text-[#9CA3AF]"
            >
              Später erinnern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
