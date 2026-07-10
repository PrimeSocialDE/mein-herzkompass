"use client";

// Audio-Player fuer den Pfoten-Coach im Mitgliederbereich.
// Spielt die pro Kunde hinterlegten Audios (audioUrl -> Supabase-Storage o.ae.).
// Nur ein Track gleichzeitig; Play/Pause, Spulen (Klick auf Balken) + 15s zurueck.

import { useRef, useState } from "react";

type Situation = { emoji: string; text: string };
type Echeck = { question: string; yes: string; no: string };
type Mod = { title: string; cue?: string; audioUrl: string; situations?: Situation[]; echeck?: Echeck };
type Special = { title: string; cue?: string; audioUrl: string };
export type CoachContent = {
  dogName?: string;
  modules?: Mod[];
  sos?: Special | null;
  prewalk?: Special | null;
  woche2?: Special | null;
  bonus?: Special[];
};

const fmt = (s: number) => {
  s = Math.max(0, Math.floor(s || 0));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};

export default function CoachPlayer({ content, lang = "de" }: { content: CoachContent; lang?: "de" | "pl" }) {
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prog, setProg] = useState<Record<string, { cur: number; dur: number }>>({});

  const isPL = lang === "pl";
  const t = isPL
    ? {
        now: "▸ Gra teraz",
        pause: "Pauza",
        play: "Odtwórz",
        rewind: "Cofnij 15 sekund",
        sosRail: "Szybka pomoc · o każdej porze",
        sosTitle: "🆘 Twój pies właśnie się nakręca?",
        prewalkTitle: "🎧 Przed spacerem",
        sessionsRail: "Twoje sesje · mówi Ben",
        situ: "Co robić, gdy…?",
        echeckHead: "✅ Sprawdzian sukcesu",
        yes: "Tak →",
        notYet: "Jeszcze nie →",
        woche2Rail: "Gdy zapał opada",
        woche2Title: "Nie odpuszczaj — krótko i szczerze",
        bonusRail: "Tematy bonusowe",
      }
    : {
        now: "▸ Läuft gerade",
        pause: "Pause",
        play: "Abspielen",
        rewind: "15 Sekunden zurück",
        sosRail: "Soforthilfe · jederzeit",
        sosTitle: "🆘 Dein Hund dreht gerade auf?",
        prewalkTitle: "🎧 Vor dem Spaziergang",
        sessionsRail: "Deine Sessions · Ben spricht",
        situ: "Was tun, wenn…?",
        echeckHead: "✅ Erfolgs-Check",
        yes: "Ja →",
        notYet: "Noch nicht →",
        woche2Rail: "Wenn die Luft rausgeht",
        woche2Title: "Dranbleiben — kurz & ehrlich",
        bonusRail: "Bonus-Themen",
      };

  const onTime = (id: string) => {
    const a = audioRefs.current[id];
    if (a) setProg((p) => ({ ...p, [id]: { cur: a.currentTime, dur: a.duration || 0 } }));
  };
  const toggle = (id: string) => {
    const a = audioRefs.current[id];
    if (!a) return;
    if (activeId === id && !a.paused) { a.pause(); setActiveId(null); return; }
    Object.entries(audioRefs.current).forEach(([k, el]) => { if (k !== id && el) el.pause(); });
    a.play().then(() => setActiveId(id)).catch(() => {});
  };
  const seek = (id: string, ratio: number) => {
    const a = audioRefs.current[id];
    if (a && a.duration) { a.currentTime = Math.min(1, Math.max(0, ratio)) * a.duration; onTime(id); }
  };
  const rewind = (id: string) => {
    const a = audioRefs.current[id];
    if (a) { a.currentTime = Math.max(0, a.currentTime - 15); onTime(id); }
  };

  const Item = ({ id, title, cue, audioUrl, sos, children }: {
    id: string; title: string; cue?: string; audioUrl: string; sos?: boolean; children?: React.ReactNode;
  }) => {
    const p = prog[id] || { cur: 0, dur: 0 };
    const pct = p.dur ? (p.cur / p.dur) * 100 : 0;
    const isPlaying = activeId === id;
    const timeTxt = p.dur ? (isPlaying ? fmt(p.cur) : fmt(p.dur)) : "▶";
    return (
      <div className={"pc-card" + (sos ? " pc-sos" : "") + (isPlaying ? " pc-playing" : "")}>
        <audio
          ref={(el) => { audioRefs.current[id] = el; }}
          src={audioUrl}
          preload="metadata"
          onTimeUpdate={() => onTime(id)}
          onLoadedMetadata={() => onTime(id)}
          onEnded={() => setActiveId(null)}
        />
        <div className="pc-top">
          <div className="pc-txt">
            {isPlaying && <div className="pc-now">{t.now}</div>}
            <div className="pc-title">{title}</div>
            {cue && <div className="pc-cue">{cue}</div>}
          </div>
          <button className="pc-play" onClick={() => toggle(id)} aria-label={isPlaying ? t.pause : t.play}>
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
        </div>
        <div className="pc-track">
          <button className="pc-rw" onClick={() => rewind(id)} aria-label={t.rewind} type="button">↺</button>
          <div
            className="pc-bar"
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(id, (e.clientX - r.left) / r.width); }}
          >
            <div className="pc-fill" style={{ width: pct + "%" }} />
          </div>
          <span className="pc-time">{timeTxt}</span>
        </div>
        {children}
      </div>
    );
  };

  const modules = content.modules || [];
  const bonus = content.bonus || [];

  return (
    <div className="pcoach">
      <style>{css}</style>

      {(content.sos || content.prewalk) && (
        <>
          <div className="pc-rail pc-rail-sos"><b>{t.sosRail}</b></div>
          {content.sos && <Item id="sos" sos title={content.sos.title || t.sosTitle} cue={content.sos.cue} audioUrl={content.sos.audioUrl} />}
          {content.prewalk && <Item id="prewalk" title={content.prewalk.title || t.prewalkTitle} cue={content.prewalk.cue} audioUrl={content.prewalk.audioUrl} />}
        </>
      )}

      {modules.length > 0 && (
        <>
          <div className="pc-rail"><b>{t.sessionsRail}</b></div>
          {modules.map((m, i) => (
            <Item key={"m" + i} id={"m" + i} title={`${i + 1}. ${m.title}`} cue={m.cue} audioUrl={m.audioUrl}>
              {m.situations && m.situations.length > 0 && (
                <details className="pc-situ">
                  <summary>{t.situ} <span className="pc-chev">+</span></summary>
                  <ul>
                    {m.situations.map((s, j) => (
                      <li key={j}><span className="pc-emo">{s.emoji}</span><span>{s.text}</span></li>
                    ))}
                  </ul>
                </details>
              )}
              {m.echeck && (
                <div className="pc-echeck">
                  <div className="pc-eh">{t.echeckHead}</div>
                  <div className="pc-eq">{m.echeck.question}</div>
                  <div className="pc-eb"><b>{t.yes}</b> {m.echeck.yes} &nbsp;<span className="pc-no">{t.notYet}</span> {m.echeck.no}</div>
                </div>
              )}
            </Item>
          ))}
        </>
      )}

      {content.woche2 && (
        <>
          <div className="pc-rail"><b>{t.woche2Rail}</b></div>
          <Item id="woche2" title={content.woche2.title || t.woche2Title} cue={content.woche2.cue} audioUrl={content.woche2.audioUrl} />
        </>
      )}

      {bonus.length > 0 && (
        <>
          <div className="pc-rail"><b>{t.bonusRail}</b></div>
          {bonus.map((b, i) => (
            <Item key={"b" + i} id={"b" + i} title={b.title} cue={b.cue} audioUrl={b.audioUrl} />
          ))}
        </>
      )}
    </div>
  );
}

const css = `
.pcoach{--gold1:#CAA86F;--gold2:#B0894E;--brown:#8B7355;--ink:#23201B;--muted:#7C7266;--green:#6E8B5A;--border:#ECE0CB;--bstrong:#E2D2B4;--tint:#FBF6EC;--sos1:#D2694F;--sos2:#B4432E;max-width:480px}
.pcoach .pc-rail{display:flex;align-items:center;gap:10px;margin:22px 2px 12px}
.pcoach .pc-rail::after{content:"";flex:1;height:1px;background:var(--bstrong)}
.pcoach .pc-rail b{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--brown)}
.pcoach .pc-rail-sos b{color:var(--sos2)}.pcoach .pc-rail-sos::after{background:#E8C3B9}
.pcoach .pc-card{background:#fff;border:1px solid var(--border);border-radius:16px;padding:14px;margin-bottom:12px;box-shadow:0 8px 22px -18px rgba(90,70,40,.35)}
.pcoach .pc-sos{background:linear-gradient(180deg,#FCEEE9,#FBE7E0);border-color:#E8C3B9}
.pcoach .pc-top{display:flex;align-items:flex-start;gap:13px}
.pcoach .pc-txt{flex:1;min-width:0}
.pcoach .pc-now{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--green);margin-bottom:2px}
.pcoach .pc-sos .pc-now{color:var(--sos2)}
.pcoach .pc-title{font-size:16px;font-weight:700;line-height:1.25;color:var(--ink)}
.pcoach .pc-sos .pc-title{color:var(--sos2)}
.pcoach .pc-cue{font-size:13px;line-height:1.5;color:var(--muted);margin-top:4px}
.pcoach .pc-play{flex:0 0 auto;width:52px;height:52px;border-radius:50%;border:0;cursor:pointer;color:#fff;background:linear-gradient(150deg,var(--gold1),var(--gold2));display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px -6px rgba(176,137,78,.7)}
.pcoach .pc-sos .pc-play{background:linear-gradient(150deg,var(--sos1),var(--sos2))}
.pcoach .pc-play svg{width:22px;height:22px}
.pcoach .pc-track{display:flex;align-items:center;gap:9px;margin-top:12px}
.pcoach .pc-rw{flex:0 0 auto;width:30px;height:24px;border-radius:8px;border:1px solid var(--bstrong);background:#fff;color:var(--gold2);font-size:15px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.pcoach .pc-bar{flex:1;height:8px;border-radius:99px;background:#EFE6D4;cursor:pointer;position:relative;overflow:hidden}
.pcoach .pc-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--gold1),var(--gold2))}
.pcoach .pc-sos .pc-fill{background:linear-gradient(90deg,var(--sos1),var(--sos2))}
.pcoach .pc-time{font-size:12px;font-weight:600;color:var(--muted);min-width:34px;text-align:right;font-variant-numeric:tabular-nums}
.pcoach .pc-situ{margin-top:12px;border-top:1px dashed var(--bstrong)}
.pcoach .pc-situ summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:11px 2px 3px;font-size:13px;font-weight:800;color:var(--gold2)}
.pcoach .pc-situ summary::-webkit-details-marker{display:none}
.pcoach .pc-situ[open] .pc-chev{transform:rotate(45deg)}
.pcoach .pc-chev{transition:transform .2s;font-size:17px}
.pcoach .pc-situ ul{list-style:none;margin:4px 0 2px;padding:0;display:flex;flex-direction:column;gap:9px}
.pcoach .pc-situ li{display:flex;gap:9px;background:var(--tint);border:1px solid var(--border);border-radius:11px;padding:9px 11px;font-size:12.7px;line-height:1.5;color:#5f5748}
.pcoach .pc-emo{flex:0 0 auto;font-size:15px}
.pcoach .pc-echeck{margin-top:11px;background:#EEF3E8;border:1px solid #D7E0CB;border-radius:11px;padding:10px 12px}
.pcoach .pc-eh{font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--green);margin-bottom:5px}
.pcoach .pc-eq{font-size:13px;font-weight:700;color:var(--ink);line-height:1.4}
.pcoach .pc-eb{font-size:12.3px;color:#5c6650;line-height:1.55;margin-top:5px}
.pcoach .pc-eb b{color:var(--green)}.pcoach .pc-no{color:var(--gold2)}
`;
