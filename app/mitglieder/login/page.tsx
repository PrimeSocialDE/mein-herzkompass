"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createMemberBrowserClient } from "@/lib/member-auth";

type Stage = "idle" | "loading" | "sent" | "verifying" | "error";
type Mode = "anmelden" | "konto";

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
  const [mode, setMode] = useState<Mode>("anmelden");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);

  // Auto-Redirect wenn schon eingeloggt — User klickt auf "Anmelden" und
  // landet sofort im Mitgliederbereich, ohne Login-Form-Flash
  useEffect(() => {
    let mounted = true;
    const supabase = createMemberBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        router.replace("/mitglieder");
      } else {
        setSessionChecked(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  // Mode aus URL-Param (?mode=konto) wenn da
  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "konto") setMode("konto");
  }, [searchParams]);

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
          "Wir kennen diese E-Mail noch nicht. Wechsel oben auf 'Account erstellen'."
        );
      } else if (error?.message) {
        setErrorMsg(`Anmeldung fehlgeschlagen: ${error.message}`);
      } else {
        setErrorMsg(
          "Code stimmt nicht. Pruefe nochmal in der Mail oder fordere einen neuen an."
        );
      }
      return;
    }
    router.push("/mitglieder");
    router.refresh();
  }

  function reset() {
    setStage("idle");
    setCode("");
    setErrorMsg("");
  }

  function switchMode(m: Mode) {
    if (m === mode) return;
    setMode(m);
    setStage("idle");
    setCode("");
    setErrorMsg("");
  }

  // Während Session-Check: Mini-Spinner, kein Form-Flash
  if (!sessionChecked) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <div className="inline-block w-8 h-8 border-2 border-[#EADDC5] border-t-[#C4A576] rounded-full animate-spin" />
      </div>
    );
  }

  const isAnmelden = mode === "anmelden";

  return (
    <div className="max-w-md mx-auto py-6">
      <div className="bg-white rounded-2xl border border-[#EADDC5] shadow-[0_2px_12px_rgba(139,115,85,0.06)] overflow-hidden">
        {/* Tab-Switcher */}
        <div className="flex border-b border-[#EADDC5]">
          <button
            type="button"
            onClick={() => switchMode("anmelden")}
            className={`flex-1 py-3.5 px-4 text-[14px] font-bold transition-colors ${
              isAnmelden
                ? "bg-white text-[#1a1a1a] border-b-2 border-[#C4A576] -mb-px"
                : "bg-[#FAFAFA] text-[#9CA3AF]"
            }`}
          >
            Anmelden
          </button>
          <button
            type="button"
            onClick={() => switchMode("konto")}
            className={`flex-1 py-3.5 px-4 text-[14px] font-bold transition-colors ${
              !isAnmelden
                ? "bg-white text-[#1a1a1a] border-b-2 border-[#C4A576] -mb-px"
                : "bg-[#FAFAFA] text-[#9CA3AF]"
            }`}
          >
            Account erstellen
          </button>
        </div>

        <div className="p-7 md:p-9">
          <h1 className="text-[22px] md:text-[26px] font-extrabold tracking-tight text-[#1a1a1a] mb-2">
            {isAnmelden ? "Schön dass du wieder da bist" : "Konto in 30 Sek anlegen"}
          </h1>
          <p className="text-[14px] text-[#6B7280] leading-relaxed mb-6">
            {isAnmelden
              ? "Trag deine E-Mail ein. Wir schicken dir einen 6-stelligen Code — funktioniert in jedem Browser, auch ohne Cookies."
              : "Trag deine E-Mail ein. Wir schicken dir einen Magic-Link — ein Klick und dein Konto ist da."}
          </p>

          {stage === "sent" || stage === "verifying" ? (
            isAnmelden ? (
              // ── Anmelden: Code-Eingabe prominent ──────────────────
              <>
                <div className="bg-[#FFF9F0] border-2 border-[#C4A576] rounded-xl p-4 mb-5 text-center">
                  <div className="text-[28px] mb-1">📩</div>
                  <p className="text-[14px] font-bold text-[#1a1a1a] mb-1">
                    Code unterwegs an {email}
                  </p>
                  <p className="text-[12px] text-[#5A4A3A] leading-relaxed">
                    Trag den 6-stelligen Code aus der Mail unten ein.
                  </p>
                </div>

                <form onSubmit={verifyCode} className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#6B7280] mb-1.5">
                      6-stelliger Code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9 ]*"
                      maxLength={7}
                      autoComplete="one-time-code"
                      autoFocus
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
                      className="w-full px-4 py-4 rounded-lg border-2 border-[#E5E7EB] bg-white text-[24px] font-bold tracking-widest text-center font-mono focus:outline-none focus:border-[#C4A576] focus:ring-3 focus:ring-[#C4A576]/15 transition"
                    />
                  </div>

                  {errorMsg && (
                    <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[12px] rounded-lg px-3 py-2">
                      {errorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={
                      stage === "verifying" ||
                      code.replace(/\s/g, "").length !== 6
                    }
                    className="w-full bg-[#C4A576] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-5 rounded-xl text-[14px] shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
                  >
                    {stage === "verifying" ? "Prüfe Code…" : "Code prüfen → Einloggen"}
                  </button>

                  <p className="text-[11px] text-[#9CA3AF] text-center pt-1 leading-relaxed">
                    Lieber den Link in der Mail klicken? Geht auch — landet
                    automatisch hier.
                  </p>

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
              // ── Account erstellen: Link prominent ─────────────────
              <>
                <div className="bg-[#F0FDF4] border-2 border-[#16A34A] rounded-xl p-5 mb-5 text-center">
                  <div className="text-[36px] mb-2">📬</div>
                  <p className="text-[15px] font-bold text-[#166534] mb-1">
                    Magic-Link unterwegs an {email}
                  </p>
                  <p className="text-[13px] text-[#15803D] leading-relaxed">
                    Klick auf den Button in der Mail — dein Konto wird
                    automatisch erstellt und du landest direkt drin.
                  </p>
                </div>

                <div className="bg-[#FAFAFA] border border-[#EADDC5] rounded-xl p-3 mb-4">
                  <p className="text-[11px] text-[#6B7280] leading-relaxed">
                    💡 <strong>Tipp:</strong> Mail nicht da? Prüf den Spam-Ordner.
                    Falls du in einem anderen Browser eingeloggt sein möchtest,
                    kannst du auch auf <button
                      onClick={() => switchMode("anmelden")}
                      className="underline text-[#8B7355] font-semibold"
                    >Anmelden</button> wechseln und dort den Code aus der Mail
                    eintippen.
                  </p>
                </div>

                {errorMsg && (
                  <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[12px] rounded-lg px-3 py-2 mb-3">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="button"
                  onClick={reset}
                  className="w-full text-[12px] text-[#9CA3AF] hover:text-[#1a1a1a] py-2"
                >
                  Andere E-Mail verwenden
                </button>
              </>
            )
          ) : (
            // ── Initialer Form (für beide Modi gleich) ──────────────
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
                {stage === "loading"
                  ? "Sende…"
                  : isAnmelden
                    ? "Code per Mail anfordern"
                    : "Magic-Link senden"}
              </button>

              <p className="text-[11px] text-[#9CA3AF] text-center pt-2 leading-relaxed">
                {isAnmelden
                  ? "Noch kein Konto? Wechsel oben auf 'Account erstellen'."
                  : "Schon ein Konto? Wechsel oben auf 'Anmelden'."}
              </p>

              {/* Trust-Hinweis */}
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
    </div>
  );
}
