"use client";

import { useState } from "react";
import { createMemberBrowserClient } from "@/lib/member-auth";

// Passwort festlegen/ändern für eingeloggte Mitglieder.
// DSGVO: Supabase speichert das Passwort serverseitig als bcrypt-Hash
// (kein Klartext), Übertragung nur via HTTPS. Wir loggen das Passwort
// NIRGENDS und halten es nur kurz im lokalen State.
export default function SetPasswordCard() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) {
      setMsg({ ok: false, text: "Das Passwort muss mindestens 8 Zeichen haben." });
      return;
    }
    if (pw !== pw2) {
      setMsg({ ok: false, text: "Die Passwörter stimmen nicht überein." });
      return;
    }
    setBusy(true);
    const supabase = createMemberBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setMsg({
        ok: false,
        text:
          error.message?.toLowerCase().includes("should be different")
            ? "Das ist schon dein aktuelles Passwort."
            : "Konnte das Passwort nicht speichern. Bitte später nochmal versuchen.",
      });
      return;
    }
    setPw("");
    setPw2("");
    setMsg({
      ok: true,
      text: "Passwort gespeichert. Ab jetzt kannst du dich direkt mit E-Mail + Passwort einloggen — ganz ohne Code-Mail.",
    });
  }

  return (
    <div className="bg-white border border-[#EADDC5] rounded-2xl p-6">
      <h2 className="text-[16px] font-extrabold text-[#1a1a1a] mb-1">
        Passwort festlegen
      </h2>
      <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">
        Optional — aber praktisch: Mit einem Passwort kommst du jederzeit rein,
        ohne auf eine Code-Mail zu warten.
      </p>

      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="block text-[12px] font-medium text-[#6B7280] mb-1.5">
            Neues Passwort
          </label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Mind. 8 Zeichen"
            autoComplete="new-password"
            className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white text-[15px] focus:outline-none focus:border-[#C4A576] focus:ring-3 focus:ring-[#C4A576]/15 transition"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-[#6B7280] mb-1.5">
            Passwort wiederholen
          </label>
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="Nochmal eingeben"
            autoComplete="new-password"
            className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white text-[15px] focus:outline-none focus:border-[#C4A576] focus:ring-3 focus:ring-[#C4A576]/15 transition"
          />
        </div>

        {msg && (
          <div
            className={`text-[12px] rounded-lg px-3 py-2 ${
              msg.ok
                ? "bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534]"
                : "bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C]"
            }`}
          >
            {msg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-[#C4A576] hover:bg-[#B5946A] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-5 rounded-xl text-[14px] transition"
        >
          {busy ? "Speichere…" : "Passwort speichern"}
        </button>

        <p className="text-[11px] text-[#9CA3AF] leading-relaxed pt-1">
          🔒 Dein Passwort wird sicher verschlüsselt gespeichert (bcrypt) und
          niemals im Klartext abgelegt.
        </p>
      </form>
    </div>
  );
}
