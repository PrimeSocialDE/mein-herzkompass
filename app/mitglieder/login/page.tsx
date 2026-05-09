"use client";

import { useState } from "react";
import { createMemberBrowserClient } from "@/lib/member-auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const supabase = createMemberBrowserClient();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/mitglieder/callback`
        : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message || "Konnte Login-Mail nicht verschicken.");
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="max-w-md mx-auto py-6">
      <div className="bg-white rounded-2xl border border-[#EADDC5] shadow-[0_2px_12px_rgba(139,115,85,0.06)] p-7 md:p-9">
        <h1 className="text-[22px] md:text-[26px] font-extrabold tracking-tight text-[#1a1a1a] mb-2">
          Anmelden
        </h1>
        <p className="text-[14px] text-[#6B7280] leading-relaxed mb-6">
          Trag deine E-Mail ein. Wir schicken dir einen Link — ein Klick und du
          bist drin. Kein Passwort nötig.
        </p>

        {status === "sent" ? (
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-5 text-center">
            <div className="text-3xl mb-2">📩</div>
            <p className="text-[15px] font-bold text-[#166534] mb-1">
              Mail unterwegs
            </p>
            <p className="text-[13px] text-[#15803D] leading-relaxed">
              Schau in deinen Posteingang ({email}) und klick den Link.
              Manchmal landet er im Spam.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
              disabled={status === "loading"}
              className="w-full bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-3.5 px-5 rounded-xl text-[15px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === "loading" ? "Sende Link..." : "Login-Link senden"}
            </button>

            <p className="text-[11px] text-[#9CA3AF] text-center pt-2">
              Noch kein Konto? Wird automatisch erstellt — du musst nichts
              extra ausfüllen.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
