"use client";

// In-Place-Checkout via Mollie Components.
// Karte: Komponenten werden gemountet, tokenisiert, direkt verarbeitet.
// PayPal/SEPA: Redirect zur Mollie-Hosted-Page (kein eigener Flow noetig).
// Status nach Card-Submit: Polling auf /api/mollie/payment-status.

import { useEffect, useRef, useState } from "react";

interface UpsellInfo {
  slug: string;
  title: string;
  price_cents: number;
  emoji: string;
}

interface Props {
  upsell: UpsellInfo;
  email: string;
  leadId: string | null;
  dogName: string | null;
  onClose: () => void;
}

const MOLLIE_PROFILE_ID = "pfl_JiqZcNVUKu";
const MOLLIE_SDK_URL = "https://js.mollie.com/v1/mollie.js";

declare global {
  interface Window {
    Mollie?: any;
  }
}

type Stage = "select" | "card" | "redirect" | "processing" | "success" | "failed";

export default function CheckoutModal({
  upsell,
  email,
  leadId,
  dogName,
  onClose,
}: Props) {
  const [stage, setStage] = useState<Stage>("select");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const mollieClientRef = useRef<any>(null);
  const componentsMountedRef = useRef(false);
  const cardNumberRef = useRef<HTMLDivElement>(null);
  const cardHolderRef = useRef<HTMLDivElement>(null);
  const cardExpiryRef = useRef<HTMLDivElement>(null);
  const cardCvcRef = useRef<HTMLDivElement>(null);

  const priceFormatted = `€${(upsell.price_cents / 100)
    .toFixed(2)
    .replace(".", ",")}`;

  // ── Mollie SDK laden ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Mollie) return;
    if (document.querySelector(`script[src="${MOLLIE_SDK_URL}"]`)) return;
    const s = document.createElement("script");
    s.src = MOLLIE_SDK_URL;
    s.async = true;
    document.head.appendChild(s);
  }, []);

  // ── Components mounten wenn Card-Stage aktiv ─────────────────────
  useEffect(() => {
    if (stage !== "card") return;
    if (componentsMountedRef.current) return;

    let cancelled = false;
    const tryMount = (attempts = 0) => {
      if (cancelled) return;
      if (typeof window.Mollie !== "function") {
        if (attempts > 30) {
          setError("Karten-Eingabe konnte nicht geladen werden.");
          return;
        }
        setTimeout(() => tryMount(attempts + 1), 100);
        return;
      }
      try {
        mollieClientRef.current = window.Mollie(MOLLIE_PROFILE_ID, {
          locale: "de_DE",
          testmode: false,
        });
        const styles = {
          base: {
            color: "#1a1a1a",
            fontSize: "15px",
            fontWeight: "400",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
            "::placeholder": { color: "#9CA3AF" },
          },
          invalid: { color: "#DC2626" },
        };
        const cardNumber = mollieClientRef.current.createComponent(
          "cardNumber",
          { styles }
        );
        const cardHolder = mollieClientRef.current.createComponent(
          "cardHolder",
          { styles }
        );
        const expiryDate = mollieClientRef.current.createComponent(
          "expiryDate",
          { styles }
        );
        const verificationCode = mollieClientRef.current.createComponent(
          "verificationCode",
          { styles }
        );
        cardNumber.mount(cardNumberRef.current!);
        cardHolder.mount(cardHolderRef.current!);
        expiryDate.mount(cardExpiryRef.current!);
        verificationCode.mount(cardCvcRef.current!);
        componentsMountedRef.current = true;
      } catch (e) {
        console.error("Mollie mount error:", e);
        setError("Karten-Eingabe konnte nicht geladen werden.");
      }
    };
    tryMount();

    return () => {
      cancelled = true;
    };
  }, [stage]);

  // ── Submit: Card-Token holen, POST, Status pollen ────────────────
  async function submitCard() {
    if (!mollieClientRef.current) {
      setError("Karten-Eingabe nicht bereit");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { token, error: tokErr } =
        await mollieClientRef.current.createToken();
      if (tokErr) {
        setError(tokErr.message || "Karten-Daten ungültig");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/mollie/upsell-product-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: upsell.slug,
          email,
          leadId: leadId || "",
          dogName: dogName || undefined,
          method: "creditcard",
          cardToken: token,
          returnUrl: window.location.pathname,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      // 3DS-Redirect noetig?
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      // Direkt verarbeitet — Status pollen
      setStage("processing");
      await pollStatus(data.paymentId);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Verbindungsfehler");
      setLoading(false);
    }
  }

  async function pollStatus(paymentId: string) {
    const maxAttempts = 20; // ~30s
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const res = await fetch("/api/mollie/payment-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId }),
        });
        const data = await res.json();
        if (data.paid) {
          setStage("success");
          return;
        }
        if (data.failed) {
          setStage("failed");
          setError("Zahlung wurde nicht erfolgreich abgeschlossen.");
          return;
        }
      } catch {}
    }
    setStage("failed");
    setError("Status konnte nicht bestätigt werden. Schau in dein Postfach.");
  }

  // ── Method-Buttons (PayPal/SEPA) — fallback redirect ─────────────
  async function payWithRedirect(method?: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mollie/upsell-product-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: upsell.slug,
          email,
          leadId: leadId || "",
          dogName: dogName || undefined,
          method,
          returnUrl: window.location.pathname,
        }),
      });
      const data = await res.json();
      if (data.url) {
        setStage("redirect");
        window.location.href = data.url;
      } else {
        setError(data.error || "Konnte Checkout nicht starten");
        setLoading(false);
      }
    } catch (e) {
      setError("Verbindungsfehler");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto"
      onClick={stage === "success" || stage === "select" ? onClose : undefined}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4 pb-4 border-b border-[#F0EBE3]">
          <div className="text-[28px] flex-shrink-0">{upsell.emoji}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B7355]">
              Modul-Kauf
            </p>
            <h2 className="text-[16px] font-extrabold text-[#1a1a1a] leading-tight">
              {upsell.title}
            </h2>
            <p className="text-[18px] font-extrabold text-[#1a1a1a] mt-1">
              {priceFormatted}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#1a1a1a] -mr-1 -mt-1 p-1"
            aria-label="Schließen"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Stages */}
        {stage === "select" && (
          <div className="space-y-2">
            {/* Karte */}
            <button
              onClick={() => setStage("card")}
              className="w-full bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-3 px-4 rounded-xl text-[14px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)] flex items-center justify-center gap-3"
            >
              <span>Mit Karte bezahlen</span>
              <span className="flex items-center gap-1.5 opacity-95">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/visa-logo.png" alt="Visa" className="h-4 w-auto bg-white rounded px-1 py-0.5" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mastercard-logo.png" alt="Mastercard" className="h-4 w-auto bg-white rounded px-1 py-0.5" />
              </span>
            </button>

            {/* PayPal */}
            <button
              onClick={() => payWithRedirect("paypal")}
              disabled={loading}
              className="w-full bg-[#FFC439] hover:bg-[#F0B82E] disabled:opacity-60 py-3 px-4 rounded-xl transition flex items-center justify-center"
              aria-label="Mit PayPal bezahlen"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/paypal-logo.png" alt="PayPal" className="h-5 w-auto" />
            </button>

            {/* Apple Pay */}
            <button
              onClick={() => payWithRedirect("applepay")}
              disabled={loading}
              className="w-full bg-black hover:bg-[#1a1a1a] disabled:opacity-60 py-3 px-4 rounded-xl transition flex items-center justify-center"
              aria-label="Mit Apple Pay bezahlen"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/applepay.png" alt="Apple Pay" className="h-5 w-auto invert" />
            </button>

            {/* SEPA */}
            <button
              onClick={() => payWithRedirect("directdebit")}
              disabled={loading}
              className="w-full bg-[#FAFAFA] hover:bg-[#F0EBE3] border border-[#EADDC5] text-[#1a1a1a] font-semibold py-3 px-4 rounded-xl text-[14px] transition flex items-center justify-center gap-2"
            >
              <span>SEPA-Lastschrift</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sepa-logo.png" alt="SEPA" className="h-4 w-auto" />
            </button>

            {/* Trust-Badge */}
            <div className="pt-3 mt-1 border-t border-[#F0EBE3]">
              <p className="text-[10px] text-[#9CA3AF] text-center mb-2">
                🔒 SSL-verschlüsselt · Zahlung verarbeitet von Mollie
              </p>
              <div className="flex items-center justify-center gap-2 opacity-70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/visa-logo.png" alt="Visa" className="h-3.5 w-auto" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mastercard-logo.png" alt="Mastercard" className="h-3.5 w-auto" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/paypal-logo.png" alt="PayPal" className="h-3 w-auto" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/applepay.png" alt="Apple Pay" className="h-3 w-auto" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/sepa-logo.png" alt="SEPA" className="h-3 w-auto" />
              </div>
              <p className="text-[10px] text-[#9CA3AF] text-center mt-2">
                Quittung an: {email}
              </p>
            </div>
          </div>
        )}

        {stage === "card" && (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-[#4B5563] block mb-1">
                Karteninhaber
              </label>
              <div
                ref={cardHolderRef}
                className="border border-[#E5E7EB] rounded-lg px-3 py-3 min-h-[44px] bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#4B5563] block mb-1">
                Kartennummer
              </label>
              <div
                ref={cardNumberRef}
                className="border border-[#E5E7EB] rounded-lg px-3 py-3 min-h-[44px] bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-[#4B5563] block mb-1">
                  Gültig bis
                </label>
                <div
                  ref={cardExpiryRef}
                  className="border border-[#E5E7EB] rounded-lg px-3 py-3 min-h-[44px] bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#4B5563] block mb-1">
                  CVC
                </label>
                <div
                  ref={cardCvcRef}
                  className="border border-[#E5E7EB] rounded-lg px-3 py-3 min-h-[44px] bg-white"
                />
              </div>
            </div>

            {error && (
              <p className="text-[12px] text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              onClick={submitCard}
              disabled={loading}
              className="w-full bg-[#C4A576] hover:bg-[#B5946A] disabled:opacity-60 text-white font-semibold py-3 px-5 rounded-xl text-[14px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
            >
              {loading ? "Verarbeite..." : `Sicher bezahlen · ${priceFormatted}`}
            </button>
            <button
              onClick={() => setStage("select")}
              className="w-full text-[12px] text-[#9CA3AF] hover:text-[#1a1a1a] py-1"
            >
              ← Andere Zahlungsart
            </button>
          </div>
        )}

        {stage === "processing" && (
          <div className="py-6 text-center">
            <div className="inline-block w-10 h-10 border-3 border-[#C4A576] border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-[14px] font-bold text-[#1a1a1a]">
              Zahlung wird verarbeitet...
            </p>
            <p className="text-[12px] text-[#6B7280] mt-1">
              Dauert nur einen Moment
            </p>
          </div>
        )}

        {stage === "redirect" && (
          <div className="py-6 text-center">
            <div className="inline-block w-10 h-10 border-3 border-[#C4A576] border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-[14px] text-[#1a1a1a]">
              Du wirst zur Zahlung weitergeleitet...
            </p>
          </div>
        )}

        {stage === "success" && (
          <div className="py-4 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#F0FDF4] mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 className="text-[18px] font-extrabold text-[#1a1a1a] mb-1">
              Geschafft!
            </h3>
            <p className="text-[13px] text-[#6B7280] mb-4 leading-relaxed">
              Dein {upsell.title}-Modul ist auf dem Weg in dein Postfach{" "}
              ({email}).
            </p>
            <button
              onClick={onClose}
              className="bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-2.5 px-6 rounded-xl text-[13px] transition"
            >
              Weiter im Modul-Shop
            </button>
          </div>
        )}

        {stage === "failed" && (
          <div className="py-4 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#FEF2F2] mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h3 className="text-[16px] font-bold text-[#1a1a1a] mb-1">
              Hat nicht geklappt
            </h3>
            {error && (
              <p className="text-[12px] text-[#6B7280] mb-3">{error}</p>
            )}
            <button
              onClick={() => {
                setStage("select");
                setError("");
                setLoading(false);
              }}
              className="bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-2.5 px-6 rounded-xl text-[13px] transition"
            >
              Nochmal versuchen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
