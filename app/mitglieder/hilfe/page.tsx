"use client";

import { useEffect, useRef, useState } from "react";

interface SuggestedModule {
  slug: string;
  title: string;
  goal: string;
  price_cents: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  hasImage?: boolean;
  suggestedModule?: SuggestedModule;
}

interface LimitInfo {
  limit: number;
  is_paid: boolean;
}

interface CheckoutCtx {
  email: string | null;
  leadId: string | null;
  dogName: string | null;
}

interface AttachedImage {
  media_type: string;
  base64: string;
  previewUrl: string;
}

const SUGGESTED_QUESTIONS = [
  'Wie übe ich „Sitz" mit meinem Hund am besten?',
  'Mein Hund zieht an der Leine, was hilft sofort?',
  'Wie lange sollte eine Trainings-Session dauern?',
  'Mein Hund hört nicht auf seinen Namen draußen.',
];

const SUGGESTED_QUESTIONS_PL = [
  'Jak najlepiej ćwiczyć „siad" z psem?',
  'Mój pies ciągnie na smyczy, co pomoże od razu?',
  'Jak długo powinna trwać sesja treningowa?',
  'Mój pies nie reaguje na swoje imię na dworze.',
];

const TRAINER_AVATAR = "/TrainerPfoten-thumb.png";
// PL zeigt das Team-Foto mit "ŁapaPlan"-Shirts; DE bleibt unveraendert.
function trainerAvatar(isPL: boolean) {
  return isPL ? "/TrainerPfoten-thumb.pl.png" : TRAINER_AVATAR;
}

// Fallback-Cleanup auf Client-Seite (falls API-Cleanup mal ausfällt).
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?;:])/g, "$1$2")
    .replace(/\s—\s/g, ", ")
    .replace(/\s–\s/g, ", ")
    .replace(/—/g, "-")
    .replace(/–/g, "-");
}

// Bild client-seitig verkleinern + als JPEG-base64 → kleines Payload.
function compressImage(file: File): Promise<AttachedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas ctx"));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        const base64 = dataUrl.split(",")[1] || "";
        resolve({ media_type: "image/jpeg", base64, previewUrl: dataUrl });
      };
      img.onerror = () => reject(new Error("image load failed"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

export default function HilfePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  // Modul-Hinweis: max. 1× pro Gespräch (Ref verhindert ein zweites Anhängen)
  const moduleShownRef = useRef(false);
  const [dismissedModule, setDismissedModule] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [coachPremium, setCoachPremium] = useState(false);
  const [checkoutCtx, setCheckoutCtx] = useState<CheckoutCtx | null>(null);
  const [attached, setAttached] = useState<AttachedImage | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [buying, setBuying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPL, setIsPL] = useState(false);
  useEffect(() => {
    if (/(^|\.)lapaplan\.pl$/i.test(window.location.hostname)) setIsPL(true);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Beim Mount: Chat-History + Coach-Status laden
  useEffect(() => {
    let cancelled = false;
    let teaserTimer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const res = await fetch("/api/mitglieder/hilfe/chat", { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data?.messages) && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: any) => ({
              role: m.role,
              content: stripMarkdown(m.content),
            }))
          );
        }
        const premium = !!data?.coach_premium;
        setCoachPremium(premium);
        setCheckoutCtx({
          email: data?.email ?? null,
          leadId: data?.lead_id ?? null,
          dogName: data?.dog_name ?? null,
        });
        // Foto-Analyse-Pop-up nach 20 Sek. — nur Nicht-Premium, einmal pro Sitzung.
        const alreadyShown =
          typeof window !== "undefined" &&
          window.sessionStorage.getItem("coach_paywall_seen") === "1";
        if (!premium && !alreadyShown) {
          teaserTimer = setTimeout(() => {
            if (cancelled) return;
            setShowPaywall(true);
            try {
              window.sessionStorage.setItem("coach_paywall_seen", "1");
            } catch {}
          }, 20000);
        }
      } catch {
        // Verbindungsfehler — einfach mit leerem Verlauf starten
      }
    })();
    return () => {
      cancelled = true;
      if (teaserTimer) clearTimeout(teaserTimer);
    };
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    // Nicht-Premium: gar nicht erst anhängen, direkt Paywall zeigen.
    if (!coachPremium) {
      setShowPaywall(true);
      return;
    }
    try {
      const img = await compressImage(file);
      setAttached(img);
      setError("");
    } catch {
      setError(
        isPL
          ? "Nie udało się wczytać zdjęcia. Spróbuj inne zdjęcie."
          : "Bild konnte nicht geladen werden. Versuch ein anderes Foto."
      );
    }
  }

  function onAttachClick() {
    if (!coachPremium) {
      setShowPaywall(true);
      return;
    }
    fileRef.current?.click();
  }

  async function send(message: string) {
    const trimmed = message.trim();
    const image = attached;
    if ((!trimmed && !image) || loading) return;
    setError("");

    // Bild ohne Premium → Paywall (Sicherheitsnetz, sollte UI eh verhindern)
    if (image && !coachPremium) {
      setShowPaywall(true);
      return;
    }

    const userText =
      trimmed ||
      (image ? (isPL ? "Co zauważasz u mojego psa?" : "Was fällt dir an meinem Hund auf?") : "");
    const prevMessages = messages;
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userText, hasImage: !!image },
    ];
    setMessages(newMessages);
    setInput("");
    setAttached(null);
    setLoading(true);

    // API-Messages bauen: vorherige als reiner Text, die neue ggf. mit Bild.
    const apiMessages = prevMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    if (image) {
      apiMessages.push({
        role: "user",
        content: [
          { type: "text", text: userText },
          {
            type: "image",
            source: { type: "base64", media_type: image.media_type, data: image.base64 },
          },
        ] as any,
      });
    } else {
      apiMessages.push({ role: "user", content: userText });
    }

    try {
      const res = await fetch("/api/mitglieder/hilfe/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = await res.json();
      if (res.status === 402 && data.error === "coach_premium_required") {
        setMessages(prevMessages);
        setInput(trimmed);
        setShowPaywall(true);
      } else if (res.status === 429 && data.error === "limit_reached") {
        setMessages(prevMessages);
        setInput(trimmed);
        setLimitInfo({ limit: data.limit, is_paid: !!data.is_paid });
      } else if (!res.ok || !data.reply) {
        setError(data.error || (isPL ? "Nie udało się uzyskać odpowiedzi." : "Konnte keine Antwort holen."));
      } else {
        const assistantMsg: Message = {
          role: "assistant",
          content: stripMarkdown(data.reply),
        };
        // Kontextueller Modul-Hinweis: höchstens einmal pro Gespräch anhängen
        if (data.suggested_module && !moduleShownRef.current) {
          assistantMsg.suggestedModule = data.suggested_module;
          moduleShownRef.current = true;
        }
        setMessages([...newMessages, assistantMsg]);
        if (data.usage && !data.usage.unlimited) setUsage(data.usage);
      }
    } catch {
      setError(isPL ? "Błąd połączenia. Spróbuj zaraz jeszcze raz." : "Verbindungsfehler. Versuch's gleich nochmal.");
    } finally {
      setLoading(false);
    }
  }

  async function buyCoachPremium() {
    if (buying) return;
    setBuying(true);
    try {
      const res = await fetch("/api/mollie/upsell-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "coach-foto",
          price: 1900,
          email: checkoutCtx?.email,
          leadId: checkoutCtx?.leadId,
          dogName: checkoutCtx?.dogName,
          returnUrl: "/mitglieder/hilfe",
        }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setBuying(false);
        setError(data?.error || (isPL ? "Nie udało się rozpocząć płatności." : "Checkout konnte nicht gestartet werden."));
      }
    } catch {
      setBuying(false);
      setError(isPL ? "Błąd połączenia podczas płatności." : "Verbindungsfehler beim Checkout.");
    }
  }

  const t = isPL
    ? {
        headerTitle: "ŁapaPlan Trener AI",
        statusAvailable: "dostępny 24/7",
        photoActive: "★ Analiza zdjęć aktywna",
        subtitle: "Nasza SI, wyszkolona wiedzą naszego zespołu trenerów psów",
        greetingIntro: "Cześć! Zadaj mi pytanie o trening, a dam Ci konkretne kroki.",
        greetingPremium: "Możesz też wysłać mi zdjęcie swojego psa.",
        greetingFree: "Dzięki analizie zdjęć możesz nawet pokazać mi zdjęcie swojego psa.",
        exampleQuestions: "Przykładowe pytania",
        moduleHintTitle: "💡 Pasuje do Twojego tematu",
        photoAttached: "Zdjęcie dołączone",
        placeholderPhoto: "Pytanie do zdjęcia (opcjonalnie)…",
        placeholderDefault: "Zapytaj nas o coś...",
        attachPhoto: "Dołącz zdjęcie",
        photoAnalysisPremium: "Analiza zdjęć (Premium)",
        send: "Wyślij",
        removePhoto: "Usuń zdjęcie",
        dismissHint: "Ukryj wskazówkę",
        badgeNew: "Nowość",
        teaserLabel: "Analiza zdjęć:",
        teaserText: "Pokaż trenerowi swojego psa i od razu otrzymaj ocenę.",
        teamAlt: "Zespół trenerów ŁapaPlan",
        teamHint: "SI wyszkolona przez prawdziwy zespół trenerów ŁapaPlan",
      }
    : {
        headerTitle: "Pfoten-Plan KI-Trainer",
        statusAvailable: "24/7 verfügbar",
        photoActive: "★ Foto-Analyse aktiv",
        subtitle: "Unsere KI, trainiert mit dem Wissen unseres Hundetrainer-Teams",
        greetingIntro: "Hallo! Stell mir deine Frage zum Training, ich gebe dir konkrete Schritte.",
        greetingPremium: "Du kannst mir auch ein Foto von deinem Hund schicken.",
        greetingFree: "Mit der Foto-Analyse kannst du mir sogar ein Bild deines Hundes zeigen.",
        exampleQuestions: "Beispiel-Fragen",
        moduleHintTitle: "💡 Passend zu deinem Thema",
        photoAttached: "Foto angehängt",
        placeholderPhoto: "Frage zum Foto (optional)…",
        placeholderDefault: "Frag uns was...",
        attachPhoto: "Foto anhängen",
        photoAnalysisPremium: "Foto-Analyse (Premium)",
        send: "Senden",
        removePhoto: "Foto entfernen",
        dismissHint: "Hinweis ausblenden",
        badgeNew: "Neu",
        teaserLabel: "Foto-Analyse:",
        teaserText: "Zeig dem Trainer deinen Hund und erhalte sofort eine Einschätzung.",
        teamAlt: "Pfoten-Plan Trainer-Team",
        teamHint: "KI trainiert vom echten Pfoten-Plan Trainer-Team",
      };
  const questions = isPL ? SUGGESTED_QUESTIONS_PL : SUGGESTED_QUESTIONS;

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] md:h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="bg-white border border-[#EADDC5] rounded-2xl px-4 py-3 mb-3">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-[15px] font-bold text-[#1a1a1a] leading-tight">
            {t.headerTitle}
          </p>
          <span className="inline-flex items-center gap-1 text-[10px] text-[#15803D] font-semibold">
            <span className="w-1.5 h-1.5 bg-[#22C55E] rounded-full"></span>
            {t.statusAvailable}
          </span>
          {coachPremium && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[#8B7355] font-bold bg-[#FFF4E0] border border-[#EADDC5] rounded-full px-2 py-0.5">
              {t.photoActive}
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#6B7280] leading-snug">
          {t.subtitle}
        </p>
      </div>

      {/* Chat-Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-white border border-[#EADDC5] rounded-2xl p-4 md:p-5 mb-3 space-y-3"
      >
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex gap-2 items-end">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={trainerAvatar(isPL)}
                alt=""
                className="w-7 h-7 rounded-full object-cover flex-shrink-0"
              />
              <div className="bg-[#FFF9F0] border border-[#EADDC5] rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%]">
                <p className="text-[13px] text-[#5A4A3A] leading-relaxed">
                  {t.greetingIntro}{" "}
                  {coachPremium ? t.greetingPremium : t.greetingFree}
                </p>
              </div>
            </div>

            <div className="pt-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">
                {t.exampleQuestions}
              </p>
              <div className="space-y-1.5">
                {questions.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="w-full text-left text-[13px] text-[#1a1a1a] bg-[#FAFAFA] hover:bg-[#F0EBE3] rounded-lg px-3 py-2 transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i}>
            <ChatBubble message={m} isPL={isPL} />
            {m.suggestedModule && !dismissedModule && (
              <div className="ml-9 mt-2 mb-1 bg-[#FFF9F0] border border-[#EADDC5] rounded-2xl px-4 py-3">
                <button
                  onClick={() => setDismissedModule(true)}
                  aria-label={t.dismissHint}
                  className="float-right text-[#C4B998] hover:text-[#8B7355] text-[16px] leading-none -mt-0.5"
                >
                  ×
                </button>
                <p className="text-[12px] text-[#8B7355] font-semibold mb-1">
                  {t.moduleHintTitle}
                </p>
                <p className="text-[13px] text-[#4B5563] leading-relaxed mb-2">
                  {isPL ? (
                    <>
                      Do tego mamy moduł <strong>„{m.suggestedModule.title}"</strong> —
                      z wyraźnie <strong>większą liczbą bardziej indywidualnych ćwiczeń</strong> (
                      {m.suggestedModule.goal.toLowerCase()}), krok po kroku. Bez przymusu,
                      tutaj też oczywiście Ci pomogę.
                    </>
                  ) : (
                    <>
                      Dazu haben wir das Modul <strong>„{m.suggestedModule.title}"</strong> —
                      mit deutlich <strong>mehr und individuelleren Übungen</strong> (
                      {m.suggestedModule.goal.toLowerCase()}), Schritt für Schritt. Kein Muss,
                      ich helfe dir hier natürlich auch weiter.
                    </>
                  )}
                </p>
                <a
                  href="/mitglieder/module"
                  className="inline-block text-[13px] font-semibold text-[#C4A576] hover:underline"
                >
                  {isPL ? (
                    <>
                      Zobacz moduł (
                      {Math.round((m.suggestedModule.price_cents / 100) * 4)} zł) →
                    </>
                  ) : (
                    <>
                      Modul ansehen (
                      {(m.suggestedModule.price_cents / 100)
                        .toFixed(2)
                        .replace(".", ",")}{" "}
                      €) →
                    </>
                  )}
                </a>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 items-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trainerAvatar(isPL)}
              alt=""
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
            <div className="bg-[#F3F4F6] rounded-2xl rounded-bl-sm px-4 py-2.5 text-[13px] text-[#9CA3AF] inline-flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 bg-[#9CA3AF] rounded-full animate-pulse"></span>
              <span className="inline-block w-1.5 h-1.5 bg-[#9CA3AF] rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></span>
              <span className="inline-block w-1.5 h-1.5 bg-[#9CA3AF] rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[12px] rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {/* Foto-Vorschau (angehängt, vor dem Senden) */}
      {attached && (
        <div className="flex items-center gap-2 mb-2 bg-white border border-[#EADDC5] rounded-xl px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attached.previewUrl} alt="Vorschau" className="w-12 h-12 rounded-lg object-cover" />
          <span className="text-[12px] text-[#6B7280] flex-1">{t.photoAttached}</span>
          <button
            onClick={() => setAttached(null)}
            className="text-[#9CA3AF] hover:text-[#B91C1C] text-[18px] leading-none px-1"
            aria-label={t.removePhoto}
          >
            ×
          </button>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={onAttachClick}
          disabled={loading}
          className="flex-shrink-0 w-12 rounded-xl border border-[#E5E7EB] bg-white text-[#8B7355] hover:bg-[#FAF4E8] disabled:opacity-50 transition flex items-center justify-center relative"
          aria-label={t.attachPhoto}
          title={coachPremium ? t.attachPhoto : t.photoAnalysisPremium}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
          {!coachPremium && (
            <span className="absolute -top-1 -right-1 bg-[#C4A576] text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">★</span>
          )}
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={attached ? t.placeholderPhoto : t.placeholderDefault}
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl border border-[#E5E7EB] bg-white text-[14px] focus:outline-none focus:border-[#C4A576] focus:ring-3 focus:ring-[#C4A576]/15 transition disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || (!input.trim() && !attached)}
          className="bg-[#C4A576] hover:bg-[#B5946A] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 rounded-xl text-[14px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          aria-label={t.send}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </form>

      {/* Foto-Analyse Teaser (nur Nicht-Premium) */}
      {!coachPremium && (
        <button
          onClick={() => setShowPaywall(true)}
          className="mt-2 w-full flex items-center gap-2.5 text-left bg-gradient-to-r from-[#FFF4E0] to-[#FFF9F0] border-2 border-[#E6CFA0] rounded-xl px-3.5 py-2.5 hover:from-[#FCEBCB] hover:to-[#FFF4E0] transition shadow-[0_2px_8px_rgba(196,165,118,0.18)]"
        >
          <span className="text-[20px] leading-none flex-shrink-0">📷</span>
          <span className="flex-1 text-[12.5px] text-[#5A4A3A] leading-snug">
            <span className="inline-block bg-[#C4A576] text-white text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 mr-1.5 align-middle">{t.badgeNew}</span>
            <strong className="text-[#1a1a1a]">{t.teaserLabel}</strong> {t.teaserText}
          </span>
          <span className="text-[#C4A576] font-bold text-[16px] flex-shrink-0">→</span>
        </button>
      )}

      {/* Team-Hinweis */}
      <div className="flex items-center gap-2 mt-2 mb-1 text-[#9CA3AF]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={trainerAvatar(isPL)}
          alt={t.teamAlt}
          className="w-7 h-7 rounded-full object-cover flex-shrink-0 opacity-80"
        />
        <p className="text-[10px] leading-snug">
          {t.teamHint}
        </p>
      </div>

      {usage && usage.remaining > 0 && (
        <p className="text-[11px] text-[#9CA3AF] text-center mt-2">
          {isPL ? (
            <>
              Jeszcze {usage.remaining} z {usage.limit} darmowych pytań.
              Potem: odblokuj plan i korzystaj z czatu bez limitu.
            </>
          ) : (
            <>
              Noch {usage.remaining} von {usage.limit} kostenlosen Fragen.
              Danach: Plan freischalten für unbegrenzten Chat.
            </>
          )}
        </p>
      )}

      {limitInfo && (
        <LimitModal info={limitInfo} onClose={() => setLimitInfo(null)} isPL={isPL} />
      )}
      {showPaywall && (
        <CoachPaywall
          dogName={checkoutCtx?.dogName || null}
          buying={buying}
          onBuy={buyCoachPremium}
          onClose={() => setShowPaywall(false)}
          isPL={isPL}
        />
      )}
    </div>
  );
}

function CoachPaywall({
  dogName,
  buying,
  onBuy,
  onClose,
  isPL,
}: {
  dogName: string | null;
  buying: boolean;
  onBuy: () => void;
  onClose: () => void;
  isPL: boolean;
}) {
  const dog = dogName || (isPL ? "Twoim psem" : "deinem Hund");
  const c = isPL
    ? {
        alt: "Zespół trenerów ŁapaPlan",
        heading: "Odblokuj analizę zdjęć",
        bullet1: "Analiza zdjęć i filmów Twojego psa",
        bullet2: "„Czy robię to dobrze?” — natychmiastowa odpowiedź, 24/7",
        bullet3: "30 dni bez limitu, jednorazowo zamiast abonamentu",
        later: "Później",
      }
    : {
        alt: "Pfoten-Plan Trainer-Team",
        heading: "Foto-Analyse freischalten",
        bullet1: "Foto & Video deines Hundes analysieren lassen",
        bullet2: `„Mach ich's richtig?" — sofortiges Feedback, 24/7`,
        bullet3: "30 Tage unbegrenzt, einmalig statt Abo",
        later: "Später",
      };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={trainerAvatar(isPL)}
            alt={c.alt}
            className="w-20 h-20 rounded-full object-cover border-3 border-[#C4A576] mx-auto mb-3 shadow-md"
          />
          <h2 className="text-[18px] font-extrabold text-[#1a1a1a] mb-1 leading-tight">
            {c.heading}
          </h2>
          <p className="text-[13px] text-[#6B7280] leading-relaxed">
            {isPL ? (
              <>
                Wyślij trenerowi zdjęcie lub film z {dog} w danej sytuacji i od razu
                otrzymaj osobistą ocenę mowy ciała oraz konkretne wskazówki.{" "}
                <strong>30 dni, tak często, jak chcesz.</strong>
              </>
            ) : (
              <>
                Schick dem Trainer ein Foto oder Video von {dog} in der Situation und
                erhalte sofort eine persönliche Einschätzung zur Körpersprache plus
                konkrete Tipps. <strong>30 Tage, so oft du willst.</strong>
              </>
            )}
          </p>
        </div>

        <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-xl p-4 mb-4">
          <ul className="space-y-1.5 text-[13px] text-[#1a1a1a]">
            <li className="flex gap-2 items-start">
              <span className="text-[#C4A576] flex-shrink-0">✓</span>
              <span>{c.bullet1}</span>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-[#C4A576] flex-shrink-0">✓</span>
              <span>{c.bullet2}</span>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-[#C4A576] flex-shrink-0">✓</span>
              <span>{c.bullet3}</span>
            </li>
          </ul>
        </div>

        <p className="text-center text-[12px] text-[#9CA3AF] mb-3">
          {isPL ? (
            <>
              Jedna godzina z trenerem kosztuje 299&nbsp;zł.{" "}
              <span className="text-[#1a1a1a] font-semibold">Tutaj: 79&nbsp;zł.</span>
            </>
          ) : (
            <>
              Eine einzige Hundestunde kostet 80&nbsp;€.{" "}
              <span className="text-[#1a1a1a] font-semibold">Hier: 19&nbsp;€.</span>
            </>
          )}
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={onBuy}
            disabled={buying}
            className="block text-center bg-[#C4A576] hover:bg-[#B5946A] disabled:opacity-60 text-white font-semibold py-3 px-5 rounded-xl text-[14px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            {buying
              ? isPL
                ? "Otwieram…"
                : "Wird geöffnet…"
              : isPL
              ? "Odblokuj analizę zdjęć · 79 zł"
              : "Foto-Analyse freischalten · 19 €"}
          </button>
          <button
            onClick={onClose}
            className="text-[12px] text-[#9CA3AF] hover:text-[#1a1a1a] py-1"
          >
            {c.later}
          </button>
        </div>
      </div>
    </div>
  );
}

function LimitModal({
  info,
  onClose,
  isPL,
}: {
  info: LimitInfo;
  onClose: () => void;
  isPL: boolean;
}) {
  const l = isPL
    ? {
        alt: "Zespół trenerów ŁapaPlan",
        heading: "Odblokuj Trenera AI",
        included: "W planie zawarte",
        bullet1: "Nieograniczone pytania do Trenera AI",
        bullet2: "Wszystkie moduły treningowe krok po kroku",
        bullet3: "Kup raz, korzystaj na stałe",
        cta: "Odblokuj plan",
        later: "Później",
      }
    : {
        alt: "Pfoten-Plan Trainer-Team",
        heading: "Schalte den KI-Trainer frei",
        included: "Im Plan enthalten",
        bullet1: "Unbegrenzte Fragen an den KI-Trainer",
        bullet2: "Alle Trainings-Module Schritt für Schritt",
        bullet3: "Einmal kaufen, dauerhaft nutzen",
        cta: "Plan freischalten",
        later: "Später",
      };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={trainerAvatar(isPL)}
            alt={l.alt}
            className="w-20 h-20 rounded-full object-cover border-3 border-[#C4A576] mx-auto mb-3 shadow-md"
          />
          <h2 className="text-[18px] font-extrabold text-[#1a1a1a] mb-1 leading-tight">
            {l.heading}
          </h2>
          <p className="text-[13px] text-[#6B7280] leading-relaxed">
            {isPL ? (
              <>
                Twoje {info.limit} darmowych pytań testowych zostało wykorzystane.
                Z planem ŁapaPlan korzystasz z naszego Trenera AI{" "}
                <strong>bez limitu</strong>, plus pełny plan treningowy.
              </>
            ) : (
              <>
                Du hast deine {info.limit} kostenlosen Test-Fragen genutzt.
                Mit einem Pfoten-Plan nutzt du unseren KI-Trainer{" "}
                <strong>unbegrenzt</strong>, plus den vollen Trainings-Plan.
              </>
            )}
          </p>
        </div>

        <div className="bg-gradient-to-br from-[#FFF9F0] to-[#FAF4E8] border border-[#EADDC5] rounded-xl p-4 mb-4">
          <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">
            {l.included}
          </p>
          <ul className="space-y-1.5 text-[13px] text-[#1a1a1a]">
            <li className="flex gap-2 items-start">
              <span className="text-[#C4A576] flex-shrink-0">✓</span>
              <span>{l.bullet1}</span>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-[#C4A576] flex-shrink-0">✓</span>
              <span>{l.bullet2}</span>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-[#C4A576] flex-shrink-0">✓</span>
              <span>{l.bullet3}</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <a
            href="/mitglieder/upgrade"
            className="block text-center bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-3 px-5 rounded-xl text-[14px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          >
            {l.cta}
          </a>
          <button
            onClick={onClose}
            className="text-[12px] text-[#9CA3AF] hover:text-[#1a1a1a] py-1"
          >
            {l.later}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message, isPL }: { message: Message; isPL: boolean }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap bg-[#C4A576] text-white">
          {message.hasImage && <span className="mr-1">📷</span>}
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2 items-end justify-start">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={trainerAvatar(isPL)}
        alt=""
        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
      />
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap bg-[#F3F4F6] text-[#1a1a1a]">
        {message.content}
      </div>
    </div>
  );
}
