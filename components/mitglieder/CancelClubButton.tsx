"use client";

import { useState } from "react";

export default function CancelClubButton({
  lang = "de",
}: {
  lang?: "de" | "pl" | "it";
}) {
  const [state, setState] = useState<"idle" | "confirm" | "loading" | "done">("idle");
  const [until, setUntil] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const t =
    lang === "pl"
      ? {
          cancelFail: "Anulowanie nie powiodło się. Spróbuj ponownie później.",
          netFail: "Błąd sieci. Spróbuj ponownie.",
          done: "Twój klub został anulowany.",
          accessUntil: (d: string) => `Masz jeszcze dostęp do ${d}.`,
          accessEnd: "Dostęp wygasa z końcem okresu rozliczeniowego.",
          cancelAbo: "Anuluj subskrypcję",
          confirm: "Na pewno anulować? Twój dostęp pozostaje do końca opłaconego miesiąca.",
          loading: "Chwileczkę …",
          yes: "Tak, anuluj",
          no: "Anuluj",
          locale: "pl-PL",
        }
      : lang === "it"
      ? {
          cancelFail: "Disdetta non riuscita. Riprova più tardi.",
          netFail: "Errore di rete. Riprova.",
          done: "Il tuo Club è stato disdetto.",
          accessUntil: (d: string) => `Hai ancora accesso fino al ${d}.`,
          accessEnd: "L'accesso scade alla fine del periodo.",
          cancelAbo: "Disdici l'abbonamento",
          confirm: "Disdire davvero? Il tuo accesso resta fino alla fine del mese pagato.",
          loading: "Un attimo …",
          yes: "Sì, disdici",
          no: "Annulla",
          locale: "it-IT",
        }
      : {
          cancelFail: "Kündigung fehlgeschlagen. Bitte später erneut.",
          netFail: "Netzwerkfehler. Bitte erneut versuchen.",
          done: "Dein Club ist gekündigt.",
          accessUntil: (d: string) => `Du hast noch bis ${d} Zugang.`,
          accessEnd: "Der Zugang läuft zum Periodenende aus.",
          cancelAbo: "Abo kündigen",
          confirm: "Wirklich kündigen? Dein Zugang bleibt bis zum Ende des bezahlten Monats.",
          loading: "Einen Moment …",
          yes: "Ja, kündigen",
          no: "Abbrechen",
          locale: "de-DE",
        };

  async function cancel() {
    setState("loading");
    setErr(null);
    try {
      const res = await fetch("/api/mitglieder/club/cancel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setUntil(data.accessUntil || null);
        setState("done");
      } else {
        setErr(data.error || t.cancelFail);
        setState("confirm");
      }
    } catch {
      setErr(t.netFail);
      setState("confirm");
    }
  }

  if (state === "done") {
    const d = until ? new Date(until).toLocaleDateString(t.locale) : null;
    return (
      <p className="text-[12.5px] text-[#4B5563] mt-5">
        {t.done}{" "}
        {d ? t.accessUntil(d) : t.accessEnd}
      </p>
    );
  }

  if (state === "idle") {
    return (
      <button
        onClick={() => setState("confirm")}
        className="text-[12px] text-[#9CA3AF] underline mt-6 hover:text-[#6B7280]"
      >
        {t.cancelAbo}
      </button>
    );
  }

  return (
    <div className="mt-6 text-center">
      <p className="text-[12.5px] text-[#4B5563] mb-2">
        {t.confirm}
      </p>
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={cancel}
          disabled={state === "loading"}
          className="rounded-full px-4 py-1.5 text-[12px] font-bold text-white bg-[#B7945A] disabled:opacity-60"
        >
          {state === "loading" ? t.loading : t.yes}
        </button>
        <button
          onClick={() => setState("idle")}
          className="rounded-full px-4 py-1.5 text-[12px] font-bold text-[#4B5563] bg-[#EFE9DE]"
        >
          {t.no}
        </button>
      </div>
      {err && <p className="text-[12px] text-red-600 mt-2">{err}</p>}
    </div>
  );
}
