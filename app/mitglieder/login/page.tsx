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

const ERROR_MESSAGES_PL: Record<string, string> = {
  link_abgelaufen:
    "Link wygasł. Wpisz ponownie swój e-mail, a wyślemy Ci nowy.",
  verify_failed:
    "Nie udało się zweryfikować linku. Poproś o nowy.",
  exchange_failed:
    "Logowanie nie powiodło się. Poproś o nowy link.",
  fehlende_parameter:
    "Link był niekompletny. Poproś o nowy.",
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("anmelden");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isPL, setIsPL] = useState(false);

  // Sprach-Erkennung über Host (hydration-sicher: initial de, nach Mount pl)
  useEffect(() => {
    if (/(^|\.)lapaplan\.pl$/i.test(window.location.hostname)) setIsPL(true);
  }, []);

  const t = isPL
    ? {
        tabAnmelden: "Zaloguj się",
        tabKonto: "Załóż konto",
        emailRequired: "Podaj swój e-mail.",
        passwordError:
          "E-mail lub hasło się nie zgadza. Nie masz jeszcze hasła? Poproś poniżej o kod — a potem w panelu członkowskim w zakładce „Profil” ustaw sobie hasło.",
        sendMailFailed: "Nie udało się wysłać e-maila z logowaniem.",
        codeSixDigits: "Kod musi mieć 6 cyfr.",
        codeExpired:
          "Kod wygasł lub został już użyty. Wpisz ponownie swój e-mail, a wyślemy Ci nowy.",
        emailUnknown:
          "Nie znamy jeszcze tego e-maila. Przełącz się powyżej na „Załóż konto”.",
        loginFailedPrefix: "Logowanie nie powiodło się: ",
        codeWrong:
          "Kod się nie zgadza. Sprawdź jeszcze raz w e-mailu albo poproś o nowy.",
        headingAnmelden: "Dobrze, że znów jesteś",
        headingKonto: "Załóż konto w 30 sek",
        subAnmelden:
          "Podaj swój e-mail — wyślemy Ci 6-cyfrowy kod logowania. Bez hasła.",
        subKonto:
          "Wpisz swój e-mail. Wyślemy Ci magiczny link — jedno kliknięcie i konto gotowe.",
        codeSentPrefix: "Kod w drodze na ",
        codeSentHint: "Wpisz poniżej 6-cyfrowy kod z e-maila.",
        codeLabel: "6-cyfrowy kod",
        verifying: "Sprawdzam kod…",
        verifyBtn: "Sprawdź kod → Zaloguj się",
        linkHint:
          "Wolisz kliknąć link w e-mailu? Też działa — wróci automatycznie tutaj.",
        otherEmail: "Użyj innego e-maila",
        magicSentPrefix: "Magiczny link w drodze na ",
        magicSentBody:
          "Kliknij przycisk w e-mailu — konto utworzy się automatycznie i od razu wejdziesz do środka.",
        tipStrong: "Wskazówka:",
        tipPart1:
          "Nie ma e-maila? Sprawdź folder ze spamem. Jeśli chcesz być zalogowany w innej przeglądarce, możesz też przełączyć się na ",
        tipLink: "Zaloguj się",
        tipPart2: " i tam wpisać kod z e-maila.",
        emailLabel: "E-mail",
        emailPlaceholder: "twoj@email.pl",
        passwordLabel: "Hasło",
        passwordPlaceholder: "Twoje hasło (jeśli ustawione)",
        loadingBtn: "Chwila…",
        loginBtn: "Zaloguj się",
        requestCodeBtn: "Poproś o kod logowania",
        magicLinkBtn: "Wyślij magiczny link",
        preferCode: "Wolę przez kod logowania (bez hasła)",
        havePassword: "Mam ustawione hasło",
        switchToKonto:
          "Nie masz jeszcze konta? Przełącz się powyżej na „Załóż konto”.",
        switchToAnmelden:
          "Masz już konto? Przełącz się powyżej na „Zaloguj się”.",
        trustBefore: "Na tym urządzeniu pozostaniesz ",
        trustStrong: "zalogowany przez 30 dni",
        trustAfter: " — bez ciągłego pingpongu z e-mailami.",
      }
    : {
        tabAnmelden: "Anmelden",
        tabKonto: "Account erstellen",
        emailRequired: "Bitte gib deine E-Mail ein.",
        passwordError:
          "E-Mail oder Passwort stimmt nicht. Noch kein Passwort gesetzt? Fordere unten einen Code an — und leg dir danach im Mitgliederbereich unter „Profil“ ein Passwort fest.",
        sendMailFailed: "Konnte Login-Mail nicht verschicken.",
        codeSixDigits: "Code muss 6 Stellen haben.",
        codeExpired:
          "Der Code ist abgelaufen oder bereits genutzt. Trag deine E-Mail nochmal ein damit wir dir einen neuen schicken.",
        emailUnknown:
          "Wir kennen diese E-Mail noch nicht. Wechsel oben auf 'Account erstellen'.",
        loginFailedPrefix: "Anmeldung fehlgeschlagen: ",
        codeWrong:
          "Code stimmt nicht. Pruefe nochmal in der Mail oder fordere einen neuen an.",
        headingAnmelden: "Schön dass du wieder da bist",
        headingKonto: "Konto in 30 Sek anlegen",
        subAnmelden:
          "Gib deine E-Mail ein — wir schicken dir einen 6-stelligen Login-Code. Kein Passwort nötig.",
        subKonto:
          "Trag deine E-Mail ein. Wir schicken dir einen Magic-Link — ein Klick und dein Konto ist da.",
        codeSentPrefix: "Code unterwegs an ",
        codeSentHint: "Trag den 6-stelligen Code aus der Mail unten ein.",
        codeLabel: "6-stelliger Code",
        verifying: "Prüfe Code…",
        verifyBtn: "Code prüfen → Einloggen",
        linkHint:
          "Lieber den Link in der Mail klicken? Geht auch — landet automatisch hier.",
        otherEmail: "Andere E-Mail verwenden",
        magicSentPrefix: "Magic-Link unterwegs an ",
        magicSentBody:
          "Klick auf den Button in der Mail — dein Konto wird automatisch erstellt und du landest direkt drin.",
        tipStrong: "Tipp:",
        tipPart1:
          "Mail nicht da? Prüf den Spam-Ordner. Falls du in einem anderen Browser eingeloggt sein möchtest, kannst du auch auf ",
        tipLink: "Anmelden",
        tipPart2: " wechseln und dort den Code aus der Mail eintippen.",
        emailLabel: "E-Mail",
        emailPlaceholder: "deine@email.de",
        passwordLabel: "Passwort",
        passwordPlaceholder: "Dein Passwort (falls gesetzt)",
        loadingBtn: "Moment…",
        loginBtn: "Einloggen",
        requestCodeBtn: "Login-Code anfordern",
        magicLinkBtn: "Magic-Link senden",
        preferCode: "Lieber per Login-Code (ohne Passwort)",
        havePassword: "Ich habe ein Passwort eingerichtet",
        switchToKonto: "Noch kein Konto? Wechsel oben auf 'Account erstellen'.",
        switchToAnmelden: "Schon ein Konto? Wechsel oben auf 'Anmelden'.",
        trustBefore: "Auf diesem Gerät bleibst du ",
        trustStrong: "30 Tage eingeloggt",
        trustAfter: " — kein ständiges Mail-Pingpong.",
      };

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
      const map = isPL ? ERROR_MESSAGES_PL : ERROR_MESSAGES;
      const prefix = isPL
        ? "Logowanie nie powiodło się: "
        : "Anmeldung fehlgeschlagen: ";
      setErrorMsg(map[err] || `${prefix}${decodeURIComponent(err)}`);
    }
  }, [searchParams, isPL]);

  // Passwort-Login (DSGVO: Passwort nur im State, kein Logging, HTTPS).
  async function loginWithPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg(t.emailRequired);
      return;
    }
    // Kein Passwort eingetippt → automatisch den Code-Weg nehmen.
    if (!password) {
      return sendLink(e);
    }
    setStage("loading");
    setErrorMsg("");

    const supabase = createMemberBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error || !data?.session) {
      setStage("error");
      setErrorMsg(t.passwordError);
      return;
    }
    router.push("/mitglieder");
    router.refresh();
  }

  async function sendLink(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg(t.emailRequired);
      setStage("idle");
      return;
    }
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
      setErrorMsg(error.message || t.sendMailFailed);
      return;
    }
    setStage("sent");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = code.replace(/\s/g, "");
    if (cleaned.length !== 6) {
      setErrorMsg(t.codeSixDigits);
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
        setErrorMsg(t.codeExpired);
      } else if (msg.includes("not found") || msg.includes("user not")) {
        setErrorMsg(t.emailUnknown);
      } else if (error?.message) {
        setErrorMsg(`${t.loginFailedPrefix}${error.message}`);
      } else {
        setErrorMsg(t.codeWrong);
      }
      return;
    }
    router.push("/mitglieder");
    router.refresh();
  }

  function reset() {
    setStage("idle");
    setCode("");
    setPassword("");
    setShowPassword(false);
    setErrorMsg("");
  }

  function switchMode(m: Mode) {
    if (m === mode) return;
    setMode(m);
    setStage("idle");
    setCode("");
    setPassword("");
    setShowPassword(false);
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
            {t.tabAnmelden}
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
            {t.tabKonto}
          </button>
        </div>

        <div className="p-7 md:p-9">
          <h1 className="text-[22px] md:text-[26px] font-extrabold tracking-tight text-[#1a1a1a] mb-2">
            {isAnmelden ? t.headingAnmelden : t.headingKonto}
          </h1>
          <p className="text-[14px] text-[#6B7280] leading-relaxed mb-6">
            {isAnmelden ? t.subAnmelden : t.subKonto}
          </p>

          {stage === "sent" || stage === "verifying" ? (
            isAnmelden ? (
              // ── Anmelden: Code-Eingabe prominent ──────────────────
              <>
                <div className="bg-[#FFF9F0] border-2 border-[#C4A576] rounded-xl p-4 mb-5 text-center">
                  <div className="text-[28px] mb-1">📩</div>
                  <p className="text-[14px] font-bold text-[#1a1a1a] mb-1">
                    {t.codeSentPrefix}{email}
                  </p>
                  <p className="text-[12px] text-[#5A4A3A] leading-relaxed">
                    {t.codeSentHint}
                  </p>
                </div>

                <form onSubmit={verifyCode} className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#6B7280] mb-1.5">
                      {t.codeLabel}
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
                    {stage === "verifying" ? t.verifying : t.verifyBtn}
                  </button>

                  <p className="text-[11px] text-[#9CA3AF] text-center pt-1 leading-relaxed">
                    {t.linkHint}
                  </p>

                  <button
                    type="button"
                    onClick={reset}
                    className="w-full text-[12px] text-[#9CA3AF] hover:text-[#1a1a1a] py-1"
                  >
                    {t.otherEmail}
                  </button>
                </form>
              </>
            ) : (
              // ── Account erstellen: Link prominent ─────────────────
              <>
                <div className="bg-[#F0FDF4] border-2 border-[#16A34A] rounded-xl p-5 mb-5 text-center">
                  <div className="text-[36px] mb-2">📬</div>
                  <p className="text-[15px] font-bold text-[#166534] mb-1">
                    {t.magicSentPrefix}{email}
                  </p>
                  <p className="text-[13px] text-[#15803D] leading-relaxed">
                    {t.magicSentBody}
                  </p>
                </div>

                <div className="bg-[#FAFAFA] border border-[#EADDC5] rounded-xl p-3 mb-4">
                  <p className="text-[11px] text-[#6B7280] leading-relaxed">
                    💡 <strong>{t.tipStrong}</strong> {t.tipPart1}<button
                      onClick={() => switchMode("anmelden")}
                      className="underline text-[#8B7355] font-semibold"
                    >{t.tipLink}</button>{t.tipPart2}
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
                  {t.otherEmail}
                </button>
              </>
            )
          ) : (
            // ── Initialer Form (für beide Modi gleich) ──────────────
            <form onSubmit={isAnmelden ? (showPassword ? loginWithPassword : sendLink) : sendLink} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[#6B7280] mb-1.5">
                  {t.emailLabel}
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white text-[15px] focus:outline-none focus:border-[#C4A576] focus:ring-3 focus:ring-[#C4A576]/15 transition"
                  autoComplete="email"
                />
              </div>

              {isAnmelden && showPassword && (
                <div>
                  <label className="block text-[12px] font-medium text-[#6B7280] mb-1.5">
                    {t.passwordLabel}
                  </label>
                  <input
                    type="password"
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white text-[15px] focus:outline-none focus:border-[#C4A576] focus:ring-3 focus:ring-[#C4A576]/15 transition"
                    autoComplete="current-password"
                  />
                </div>
              )}

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
                  ? t.loadingBtn
                  : isAnmelden
                    ? showPassword
                      ? t.loginBtn
                      : t.requestCodeBtn
                    : t.magicLinkBtn}
              </button>

              {isAnmelden &&
                (showPassword ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPassword(false);
                      setPassword("");
                      setErrorMsg("");
                    }}
                    className="w-full text-[12px] text-[#8B7355] underline hover:text-[#1a1a1a] py-1"
                  >
                    {t.preferCode}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPassword(true);
                      setErrorMsg("");
                    }}
                    className="w-full text-[12px] text-[#9CA3AF] underline hover:text-[#1a1a1a] py-1"
                  >
                    {t.havePassword}
                  </button>
                ))}

              <p className="text-[11px] text-[#9CA3AF] text-center pt-2 leading-relaxed">
                {isAnmelden ? t.switchToKonto : t.switchToAnmelden}
              </p>

              {/* Trust-Hinweis */}
              <div className="bg-[#FFF9F0] border border-[#EADDC5] rounded-xl px-4 py-3 mt-3 flex items-start gap-2">
                <span className="text-[16px] flex-shrink-0">🔒</span>
                <p className="text-[11px] text-[#5A4A3A] leading-relaxed">
                  {t.trustBefore}<strong>{t.trustStrong}</strong>{t.trustAfter}
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
