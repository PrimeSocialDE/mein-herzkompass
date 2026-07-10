"use client";

import { useState } from "react";
import { createMemberBrowserClient } from "@/lib/member-auth";

// Passwort festlegen/ändern für eingeloggte Mitglieder.
// DSGVO: Supabase speichert das Passwort serverseitig als bcrypt-Hash
// (kein Klartext), Übertragung nur via HTTPS. Wir loggen das Passwort
// NIRGENDS und halten es nur kurz im lokalen State.
export default function SetPasswordCard({ lang = "de" }: { lang?: "de" | "pl" }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isPL = lang === "pl";
  const t = isPL
    ? {
        errMin: "Hasło musi mieć co najmniej 8 znaków.",
        errMismatch: "Hasła nie są takie same.",
        errSame: "To już Twoje obecne hasło.",
        errSave: "Nie udało się zapisać hasła. Spróbuj ponownie później.",
        saved: "Hasło zapisane. Od teraz możesz logować się bezpośrednio e-mailem i hasłem — zupełnie bez maila z kodem.",
        title: "Ustaw hasło",
        intro: "Opcjonalnie — ale wygodnie: z hasłem wejdziesz w każdej chwili, bez czekania na mail z kodem.",
        newPw: "Nowe hasło",
        newPwPlaceholder: "Min. 8 znaków",
        repeatPw: "Powtórz hasło",
        repeatPwPlaceholder: "Wpisz ponownie",
        saving: "Zapisuję…",
        saveBtn: "Zapisz hasło",
        secure: "🔒 Twoje hasło jest bezpiecznie szyfrowane (bcrypt) i nigdy nie jest przechowywane jako zwykły tekst.",
      }
    : {
        errMin: "Das Passwort muss mindestens 8 Zeichen haben.",
        errMismatch: "Die Passwörter stimmen nicht überein.",
        errSame: "Das ist schon dein aktuelles Passwort.",
        errSave: "Konnte das Passwort nicht speichern. Bitte später nochmal versuchen.",
        saved: "Passwort gespeichert. Ab jetzt kannst du dich direkt mit E-Mail + Passwort einloggen — ganz ohne Code-Mail.",
        title: "Passwort festlegen",
        intro: "Optional — aber praktisch: Mit einem Passwort kommst du jederzeit rein, ohne auf eine Code-Mail zu warten.",
        newPw: "Neues Passwort",
        newPwPlaceholder: "Mind. 8 Zeichen",
        repeatPw: "Passwort wiederholen",
        repeatPwPlaceholder: "Nochmal eingeben",
        saving: "Speichere…",
        saveBtn: "Passwort speichern",
        secure: "🔒 Dein Passwort wird sicher verschlüsselt gespeichert (bcrypt) und niemals im Klartext abgelegt.",
      };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) {
      setMsg({ ok: false, text: t.errMin });
      return;
    }
    if (pw !== pw2) {
      setMsg({ ok: false, text: t.errMismatch });
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
            ? t.errSame
            : t.errSave,
      });
      return;
    }
    setPw("");
    setPw2("");
    setMsg({
      ok: true,
      text: t.saved,
    });
  }

  return (
    <div className="bg-white border border-[#EADDC5] rounded-2xl p-6">
      <h2 className="text-[16px] font-extrabold text-[#1a1a1a] mb-1">
        {t.title}
      </h2>
      <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">
        {t.intro}
      </p>

      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="block text-[12px] font-medium text-[#6B7280] mb-1.5">
            {t.newPw}
          </label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={t.newPwPlaceholder}
            autoComplete="new-password"
            className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white text-[15px] focus:outline-none focus:border-[#C4A576] focus:ring-3 focus:ring-[#C4A576]/15 transition"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-[#6B7280] mb-1.5">
            {t.repeatPw}
          </label>
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder={t.repeatPwPlaceholder}
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
          {busy ? t.saving : t.saveBtn}
        </button>

        <p className="text-[11px] text-[#9CA3AF] leading-relaxed pt-1">
          {t.secure}
        </p>
      </form>
    </div>
  );
}
