"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "Wie übe ich „Sitz" mit meinem Hund am besten?",
  "Mein Hund zieht an der Leine — was hilft sofort?",
  "Wie lange sollte eine Trainings-Session dauern?",
  "Mein Hund hört nicht auf seinen Namen draußen.",
];

export default function HilfePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    setError("");
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/mitglieder/hilfe/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok || !data.reply) {
        setError(data.error || "Konnte keine Antwort holen.");
      } else {
        setMessages([
          ...newMessages,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch (e: any) {
      setError("Verbindungsfehler. Versuch's gleich nochmal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] md:h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="mb-4">
        <p className="text-[12px] font-semibold text-[#8B7355] uppercase tracking-wider mb-1.5">
          Hilfe & Trainer-Chat
        </p>
        <h1 className="text-[22px] md:text-[26px] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
          Frag uns alles
        </h1>
        <p className="text-[13px] text-[#6B7280] mt-1">
          Stell deine Frage zum Training. Wir antworten direkt — bei
          medizinischen Themen verweisen wir an deinen Tierarzt.
        </p>
      </div>

      {/* Chat-Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-white border border-[#EADDC5] rounded-2xl p-4 md:p-5 mb-3 space-y-3"
      >
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="bg-[#FFF9F0] border border-[#EADDC5] rounded-xl p-4">
              <p className="text-[13px] text-[#5A4A3A] leading-relaxed">
                👋 Hallo! Ich bin deine Trainings-Assistenz. Frag mich alles
                zum Training mit deinem Hund — ich helfe dir mit konkreten
                Schritten weiter.
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">
                Beispiel-Fragen
              </p>
              <div className="space-y-1.5">
                {SUGGESTED_QUESTIONS.map((q) => (
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
          <ChatBubble key={i} message={m} />
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="bg-[#F3F4F6] rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13px] text-[#9CA3AF] inline-flex items-center gap-1">
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

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Frag mich was..."
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl border border-[#E5E7EB] bg-white text-[14px] focus:outline-none focus:border-[#C4A576] focus:ring-3 focus:ring-[#C4A576]/15 transition disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-[#C4A576] hover:bg-[#B5946A] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 rounded-xl text-[14px] transition shadow-[0_1px_2px_rgba(139,115,85,0.2)]"
          aria-label="Senden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </form>
    </div>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-[#C4A576] text-white rounded-tr-sm"
            : "bg-[#F3F4F6] text-[#1a1a1a] rounded-tl-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
