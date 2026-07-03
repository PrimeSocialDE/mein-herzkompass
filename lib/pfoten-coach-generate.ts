// lib/pfoten-coach-generate.ts
//
// Voll-Generator fuer den Audio-Coach. Pipeline pro Kunde:
//   1) Plan des Kunden lesen (member_plan_content)
//   2) Opus (claude-opus-4-8) erzeugt die Coach-Skripte (Module + SOS + Prewalk
//      + Woche-2 + Bonus), zugeschnitten auf Hund + Plan  -> striktes JSON
//   3) Ben (ElevenLabs) vertont jedes Skript -> MP3
//   4) Upload in Supabase-Storage (Bucket "coach-audio", public)
//   5) answers.pfoten_coach.content am Lead schreiben (Shape = CoachPlayer)
//
// WARTET NUR AUF DEN KEY: ohne ELEVENLABS_API_KEY liefert der Generator einen
// klaren Fehler ("elevenlabs_key_missing") — alles andere ist fertig.

import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/db";

const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const ELEVENLABS_API_KEY = (process.env.ELEVENLABS_API_KEY || "").trim();
// Ben — 30, sauberes Standard-Deutsch. Ueberschreibbar per Env.
const VOICE_ID = (process.env.ELEVENLABS_VOICE_ID || "aTTiK3YzK3dXETpuDE2h").trim();
const BUCKET = "coach-audio";

type GenResult =
  | { ok: true; leadId: string; moduleCount: number; audioCount: number; charCount: number }
  | { ok: false; reason: string };

// ── ElevenLabs TTS ─────────────────────────────────────────────
async function tts(text: string): Promise<Buffer> {
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_64`,
    {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
      }),
    }
  );
  if (!r.ok) throw new Error(`tts_${r.status}: ${(await r.text()).slice(0, 200)}`);
  return Buffer.from(await r.arrayBuffer());
}

async function ensureBucket(): Promise<void> {
  try {
    const { data } = await supabase.storage.getBucket(BUCKET);
    if (!data) await supabase.storage.createBucket(BUCKET, { public: true });
  } catch {
    // createBucket wirft, wenn er schon existiert — ignorieren.
  }
}

async function uploadAudio(leadId: string, key: string, buf: Buffer): Promise<string> {
  const path = `${leadId}/${key}.mp3`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: "audio/mpeg",
    upsert: true,
  });
  if (error) throw new Error(`upload_${key}: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ── Plan des Kunden kompakt zusammenfassen (Kontext fuer Opus) ──
function summarizePlan(content: any, dogName: string): string {
  if (!content || !Array.isArray(content.weeks)) return `(kein strukturierter Plan gefunden — nutze allgemeines Wissen für ${dogName})`;
  const lines: string[] = [];
  if (content.intro?.headline) lines.push(`Plan: ${content.intro.headline}`);
  for (const w of content.weeks.slice(0, 12)) {
    const ueb = (w.uebungen || []).map((u: any) => u.name).filter(Boolean).join(", ");
    lines.push(`Woche ${w.num}: ${w.title}${w.schwerpunkt ? ` — ${w.schwerpunkt}` : ""}${ueb ? ` | Übungen: ${ueb}` : ""}`);
  }
  return lines.join("\n").slice(0, 4000);
}

// ── Opus: Skripte erzeugen ─────────────────────────────────────
type Script = { title: string; cue?: string; script: string; situations?: { emoji: string; text: string }[]; echeck?: { question: string; yes: string; no: string } };
type Scripts = { modules: Script[]; sos?: Script; prewalk?: Script; woche2?: Script; bonus?: Script[] };

function extractJson(text: string): any {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("kein JSON in Opus-Antwort");
  return JSON.parse(text.slice(s, e + 1));
}

async function generateScripts(dog: string, breed: string | null, problem: string | null, planSummary: string): Promise<Scripts> {
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const sys = `Du bist "Ben", ein warmherziger, ruhiger Hundetrainer-Coach von Pfoten-Plan. Du schreibst Skripte, die als Audio vorgelesen werden (deutsche Sprache, gesprochene Sprache, kein Markdown, keine Aufzählungszeichen im script-Text). Du sprichst den Halter mit "du" an und nennst den Hund IMMER beim Namen: ${dog}. Ton: aufbauend, konkret, nie belehrend.`;
  const user = `Erzeuge den kompletten Audio-Coach für ${dog}${breed ? ` (${breed})` : ""}${problem ? `, Hauptthema: ${problem}` : ""}.

Kontext — der Trainingsplan des Kunden:
${planSummary}

Gib AUSSCHLIESSLICH gültiges JSON zurück (keine Erklärung drumherum) mit exakt dieser Struktur:
{
  "modules": [   // GENAU 5 Module, abgeleitet aus den wichtigsten Themen des Plans
    {
      "title": "kurzer Modultitel (ohne Nummer)",
      "cue": "1 Satz: woran der Halter Erfolg erkennt",
      "script": "2–3 Minuten gesprochenes Coaching (ca. 1800–2400 Zeichen): warme Begrüßung, WARUM das Modul wichtig ist, dann 1–2 Übungen Schritt für Schritt konkret angeleitet, dann woran man Erfolg erkennt, dann die wichtigsten 'Was tun, wenn'-Situationen gesprochen, dann motivierender Abschluss. Nenne ${dog} mehrfach.",
      "situations": [ {"emoji":"🐕","text":"…Situation: was tun (1 Satz)"} ],  // 3–5 echte Alltagssituationen
      "echeck": {"question":"Ja/Nein-Frage zum Weiterkommen","yes":"was dann","no":"was dann"}
    }
  ],
  "sos": {"title":"🆘 ${dog} dreht gerade auf?","cue":"1 Satz","script":"~60 Sek (ca. 900–1000 Zeichen): den Halter im Stress-Moment sofort runterholen und anleiten"},
  "prewalk": {"title":"🎧 Vor dem Spaziergang","cue":"1 Satz","script":"~30 Sek (ca. 400–500 Zeichen): EIN Fokus für heute"},
  "woche2": {"title":"Dranbleiben — kurz & ehrlich","cue":"1 Satz","script":"~60 Sek (ca. 800–900 Zeichen): gegen den Abbruch nach ein paar Tagen, Rückschritte sind normal"},
  "bonus": [ {"title":"emoji + Thema","cue":"1 Satz","script":"~60 Sek (ca. 800 Zeichen)"} ]  // 1–2 Bonus-Themen passend zu ${dog}s Bedarf (z.B. Allein bleiben, Rückruf, Prävention)
}`;

  const resp = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: sys,
    messages: [{ role: "user", content: user }],
  });
  const text = resp.content
    .map((b: any) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  const parsed = extractJson(text) as Scripts;
  if (!parsed?.modules?.length) throw new Error("Opus lieferte keine Module");
  return parsed;
}

// ── Haupt-Pipeline ─────────────────────────────────────────────
export async function generateCoachForEmail(input: {
  email?: string;
  leadId?: string;
  dogName?: string;
}): Promise<GenResult> {
  if (!ANTHROPIC_API_KEY) return { ok: false, reason: "anthropic_key_missing" };
  if (!ELEVENLABS_API_KEY) return { ok: false, reason: "elevenlabs_key_missing" };

  const email = (input.email || "").trim();
  let leadId = (input.leadId || "").trim();

  // Lead + Antworten laden (per id oder E-Mail, neuester).
  let leadEmail = email;
  if (!leadId && email) {
    const { data } = await supabase
      .from("wauwerk_leads")
      .select("id,email")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) { leadId = String(data.id); leadEmail = String(data.email || email); }
  }
  if (!leadId) return { ok: false, reason: "lead_not_found" };

  const { data: leadRow } = await supabase.from("wauwerk_leads").select("email,answers").eq("id", leadId).maybeSingle();
  const answers: any = leadRow?.answers || {};
  leadEmail = leadEmail || String(leadRow?.email || "");

  // Plan lesen (neuester member_plan_content per E-Mail).
  let planContent: any = null;
  let breed: string | null = null;
  let dog = (input.dogName || "").trim();
  if (leadEmail) {
    const { data: pc } = await supabase
      .from("member_plan_content")
      .select("content,dog_name,dog_breed")
      .ilike("email", leadEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pc) {
      planContent = (pc as any).content || null;
      breed = (pc as any).dog_breed || null;
      dog = dog || (pc as any).dog_name || "";
    }
  }
  dog = dog || answers?.dog_name || "dein Hund";
  const problem: string | null =
    answers?.quiz_result?.dog_problem || answers?.quiz_result?.problem || answers?.dog_problem || null;

  // 1) Skripte erzeugen
  const scripts = await generateScripts(dog, breed, problem, summarizePlan(planContent, dog));

  // 2) Vertonen + Upload
  await ensureBucket();
  let charCount = 0;
  let audioCount = 0;
  const voice = async (key: string, s: Script | undefined) => {
    if (!s?.script) return undefined;
    charCount += s.script.length;
    const buf = await tts(s.script);
    audioCount++;
    return await uploadAudio(leadId, key, buf);
  };

  const modules = [];
  for (let i = 0; i < scripts.modules.length; i++) {
    const m = scripts.modules[i];
    const audioUrl = await voice(`m${i}`, m);
    if (!audioUrl) continue;
    modules.push({ title: m.title, cue: m.cue, audioUrl, situations: m.situations || [], echeck: m.echeck || null });
  }
  const sosUrl = await voice("sos", scripts.sos);
  const prewalkUrl = await voice("prewalk", scripts.prewalk);
  const woche2Url = await voice("woche2", scripts.woche2);
  const bonus = [];
  for (let i = 0; i < (scripts.bonus || []).length; i++) {
    const b = scripts.bonus![i];
    const audioUrl = await voice(`bonus${i}`, b);
    if (audioUrl) bonus.push({ title: b.title, cue: b.cue, audioUrl });
  }

  const content = {
    dogName: dog,
    modules,
    sos: scripts.sos && sosUrl ? { title: scripts.sos.title, cue: scripts.sos.cue, audioUrl: sosUrl } : null,
    prewalk: scripts.prewalk && prewalkUrl ? { title: scripts.prewalk.title, cue: scripts.prewalk.cue, audioUrl: prewalkUrl } : null,
    woche2: scripts.woche2 && woche2Url ? { title: scripts.woche2.title, cue: scripts.woche2.cue, audioUrl: woche2Url } : null,
    bonus,
  };

  // 3) Am Lead speichern (bestehende pfoten_coach-Felder wie paid_at erhalten).
  const merged = {
    ...answers,
    pfoten_coach: {
      ...(answers.pfoten_coach || {}),
      status: "paid",
      content,
      generated_at: new Date().toISOString(),
    },
  };
  const { error: upErr } = await supabase.from("wauwerk_leads").update({ answers: merged }).eq("id", leadId);
  if (upErr) return { ok: false, reason: `save_failed: ${upErr.message}` };

  return { ok: true, leadId, moduleCount: modules.length, audioCount, charCount };
}
