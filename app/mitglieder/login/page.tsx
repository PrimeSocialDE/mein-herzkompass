"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createMemberBrowserClient } from "@/lib/member-auth";

type Stage = "idle" | "loading" | "sent" | "verifying" | "error";

const ERROR_MESSAGES: Record<string, string> = {
  link_abgelaufen:
    "Der Link ist abgelaufen. Trag deine E-Mail nochmal ein, dann schicken wir dir einen neuen.",
  verify_failed:
    "Der Link konnte nicht verifiziert werden. Bitte fordere einen neuen an.",
  exchange_failed:
    "Anmeldung fehlgeschlagen. Bitte fordere einen neuen Link an.",
  fehlende_parameter:
    "Der Link war unvollständig. Bitte fordere einen neuen an.",
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Fehler-Param aus URL (Callback redirected hierher bei Problemen)
  useEffect(() => {
    const err = searchParams.get("error");
    if (err) {
      setErrorMsg(
        ERROR_MESSAGES[err] || `Anmeldung fehlgeschlagen: ${decodeURIComponent(err)}`
      );
    }
  }, [searchParams]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStage("loading");
    setErrorMsg("");

    const supabase = createMemberBrowserClient();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/mitglieder/callback`
        : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });

    if (error) {
      setStage("error");
      setErrorMsg(error.message || "Konnte Login-Mail nicht verschicken.");
      return;
    }
    setStage("sent");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = code.replace(/\s/g, "");
    if (cleaned.length !== 6) {
      setErrorMsg("Code muss 6 Stellen haben.");
      return;
    }
    setStage("verifying");
    setErrorMsg("");

    const supabase = createMemberBrowserClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: cleaned,
      type: "email",
    });

    if (error || !data?.session) {
      setStage("sent");
      const msg = (error?.message || "").toLowerCase();
      if (msg.includes("expired") || msg.includes("invalid")) {
        setErrorMsg(
          "Der Code ist abgelaufen oder bereits genutzt. Trag deine E-Mail nochmal ein damit wir dir einen neuen schicken."
        );
      } else if (msg.includes("not found") || msg.includes("user not")) {
        setErrorMsg(
          "Wir kennen diese E-Mail noch nicht. Trag sie oben nochmal ein und drück auf 'Login-Link senden'."
        );
      } else if (error?.message) {
        // Fallback: echte Supabase-Fehlermeldung sichtbar machen statt verstecken
        setErrorMsg(`Anmeldung fehlgeschlagen: ${error.message}`);
      } else {
        setErrorMsg(
          "Code stimmt nicht. Pruefe nochmal in der Mail oder fordere einen neuen an."
        );
      }
      return;
    }
    // Session ist gesetzt → ab ins Dashboard
    router.push("/mitglieder");
    router.refresh();
  }

  function reset() {
    setStage("idle");
    setCode("");
    setErrorMsg("");
  }

  return (
    <div className="max-w-md mx-auto py-6">
      <div className="bg-white rounded-2xl border border-[#EADDC5] shadow-[0_2px_12px_rgba(139,115,85,0.06)] p-7 md:p-9">
        <h1 className="text-[22px] md:text-[26px] font-extrabold tracking-tight text-[#1a1a1a] mb-2">
          Anmelden
        </h1>
        <p className="text-[14px] text-[#6B7280] leading-relaxed mb-6">
          Trag deine E-Mail ein. Wir schicken dir einen Login-Link plus einen
          6-stelligen Code — egal womit du lieber arbeitest.
        </p>

        {stage === "sent" || stage === "verifying" ? (
          <>
            {/* Bestaetigung */}
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 mb-5 text-center">
              <div className="text-[28px] mb-1">📩</div>
              <p className="text-[14px] font-bold text-[#166534] mb-1">
                Mail unterwegs an {email}
              </p>
              <p className="text-[12px] text-[#15803D] leading-relaxed">
                Klick einfach auf den Button in der Mail. Manchmal landet sie
                im Spam.
              </p>
            </div>

            {/* Alternative: Code eingeben */}
            <form onSubmit={verifyCode} className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#6B7280] mb-1.5">
                  Lieber den 6-stelligen Code aus der Mail eingeben?
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9 ]*"
                  maxLength={7}
                  autoComplete="one-time-code"
                  placeholder="123 456"
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value
                        .replace(/[^0-9]/g, "")
                        .slice(0, 6)
                        .replace(/(\d{3})(\d{0,3})/, "$1 $2")
                        .trim()
                    )
                  }
                  className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white text-[20px] font-bold tracking-widest text-center font-mono focus:outline-none focus:border-[#C4A576] focus:ring-3 focus:ring-[#C4A576]/15 transition"
                />
              </div>

              {errorMsg && (
                <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[12px] rounded-lg px-3 py-2">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={stage === "verifying" || code.replace(/\s/g, "").length !== 6}
                className="w-full bg-[#C4A576] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-5 rounded-xl text-[14px] shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
              >
                {stage === "verifying" ? "Prüfe Code…" : "Code prüfen → Einloggen"}
              </button>

              <button
                type="button"
                onClick={reset}
                className="w-full text-[12px] text-[#9CA3AF] hover:text-[#1a1a1a] py-1"
              >
                Andere E-Mail verwenden
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={sendLink} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[#6B7280] mb-1.5">
                E-Mail
              </label>
              <input
                type="email"
                required
                autoFocus
                placeholder="deine@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white text-[15px] focus:outline-none focus:border-[#C4A576] focus:ring-3 focus:ring-[#C4A576]/15 transition"
                autoComplete="email"
              />
            </div>

            {errorMsg && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[13px] rounded-lg px-4 py-2.5">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={stage === "loading"}
              className="w-full bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-3.5 px-5 rounded-xl text-[15px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {stage === "loading" ? "Sende Link…" : "Login-Link senden"}
            </button>

            <p className="text-[11px] text-[#9CA3AF] text-center pt-2 leading-relaxed">
              Noch kein Konto? Wird automatisch erstellt — du musst nichts
              extra ausfüllen.
            </p>

            {/* Trust-Hinweis: lange Sessions */}
            <div className="bg-[#FFF9F0] border border-[#EADDC5] rounded-xl px-4 py-3 mt-3 flex items-start gap-2">
              <span className="text-[16px] flex-shrink-0">🔒</span>
              <p className="text-[11px] text-[#5A4A3A] leading-relaxed">
                Auf diesem Gerät bleibst du <strong>30 Tage eingeloggt</strong> —
                kein ständiges Mail-Pingpong.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
