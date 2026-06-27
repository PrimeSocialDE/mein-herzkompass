"use client";

import { useEffect, useState } from "react";

interface Section {
  emoji: string;
  heading: string;
  text: string;
}
interface Insight {
  title: string;
  intro: string;
  sections: Section[];
  note: string;
}

export default function HundVerstehenCard({ dogName }: { dogName?: string | null }) {
  const dog = dogName?.trim() || "deinen Hund";
  const [insight, setInsight] = useState<Insight | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    fetch("/api/mitglieder/hund-verstehen")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (!active) return;
        if (d?.insight?.sections?.length) {
          setInsight(d.insight);
          setState("ready");
        } else {
          setState("error");
        }
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, []);

  // Bei Fehler/locked: Card unauffaellig ausblenden (kein kaputtes UI)
  if (state === "error") return null;

  return (
    <div className="mb-8 rounded-2xl border border-[#EADDC5] bg-gradient-to-b from-[#FFFDF9] to-[#FFF9F0] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-extrabold text-[#1a1a1a] leading-tight">
            {state === "ready" ? insight!.title : `${dog} verstehen`}
          </h2>
          {state === "ready" && insight!.intro && (
            <p className="text-[13.5px] text-[#6B7280] mt-1 leading-snug">
              {insight!.intro}
            </p>
          )}
        </div>
        <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#8B7355] bg-white/70 border border-[#EADDC5] rounded-full px-2.5 py-1">
          Monatlich neu
        </span>
      </div>

      {/* Loading-Skeleton */}
      {state === "loading" && (
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center gap-2 text-[13px] text-[#9CA3AF]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#C4A576] animate-pulse" />
            <span>{dog} wird gerade analysiert…</span>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3.5 w-1/3 rounded bg-[#EADDC5]/60 animate-pulse" />
              <div className="h-3 w-full rounded bg-[#EADDC5]/40 animate-pulse" />
              <div className="h-3 w-4/5 rounded bg-[#EADDC5]/40 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Insight */}
      {state === "ready" && insight && (
        <div className="px-5 pb-5">
          <div className="space-y-4">
            {insight.sections.map((s, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white border border-[#EADDC5] flex items-center justify-center text-[16px]">
                  {s.emoji}
                </div>
                <div>
                  <div className="text-[14px] font-bold text-[#1a1a1a] mb-0.5">
                    {s.heading}
                  </div>
                  <p className="text-[13.5px] text-[#4B5563] leading-relaxed">
                    {s.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {insight.note && (
            <p className="text-[11.5px] text-[#9CA3AF] mt-4 pt-3 border-t border-[#EADDC5]/70 leading-relaxed">
              {insight.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
