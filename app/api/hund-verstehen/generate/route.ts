// app/api/hund-verstehen/generate/route.ts
//
// Generiert das Premium-PDF "Dein Hund verstehen" (rasse-/verhaltens-
// personalisiert, optional mit Foto-Analyse) und schickt es als Brevo-Anhang.
// Wird vom Upsell-/Webhook-Flow getriggert (oder fuer Previews).
//
// Body: {
//   email, dogName, breed, age, problem?, behaviors?: string[],
//   photoBase64?: string, photoType?: string   // optionales Hundefoto
// }
// Auth: Bearer WORKER_TOKEN

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildHundVerstehenPDF,
  type HundVerstehenContent,
} from "@/lib/hund-verstehen-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const WORKER_TOKEN = (process.env.WORKER_TOKEN || "").trim();

const ALLOWED_IMG = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function htmlBody(dogName: string, breed: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
    <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:14px;padding:24px">
      <h1 style="font-size:22px;margin:0 0 6px;color:#1a1a1a">${dogName} verstehen — dein persönliches Profil</h1>
      <p style="font-size:15px;color:#666;margin:0">auf ${breed} & ${dogName}s Verhalten zugeschnitten</p>
      <p style="font-size:13px;color:#666;margin:14px 0 0;line-height:1.55">Im Anhang: wie ${dogName} tickt, der Rasse-Steckbrief, wie er mit dir spricht (Körpersprache), was er gerade braucht und rasse-typische Themen. Druck es aus oder hab es auf dem Handy dabei.</p>
    </div>
  </div>`;
}

const SCHEMA = `{
  "currentState": "3-4 Sätze, die die QUIZ-ANGABEN konkret zurückspiegeln: Alter, Hauptthema, das beobachtete Verhalten, Trainingsstand. Beginne konkret im Stil 'Du hast angegeben, dass ...'. KEIN Rasse-Lexikon, sondern DIESER Hund.",
  "characterIntro": "2-3 Sätze: wie der Hund tickt — verknüpfe Rasse MIT den genannten Verhaltensweisen, nicht generisch",
  "characterTraits": [{"label":"z.B. Energielevel","value":"konkret, 1 Zeile"} (4-6: Energielevel, Sozialverhalten, Lerntyp, Bindung, Reizoffenheit)],
  "whyBehavior": [{"behavior":"GENAU eine vom Halter genannte Verhaltensweise, formuliert als 'Du hast angegeben, dass [Name] ...'","explanation":"2-3 Sätze: WARUM er das tut — koppelt die Rasse-Veranlagung an GENAU dieses Verhalten"} (eine pro genannter Verhaltensweise + Hauptthema, max 5)],
  "steckbrief": [{"feld":"Herkunft / Ursprüngliche Aufgabe / Energielevel / Typische Eigenschaften / Pflegeaufwand / Größe & Gewicht","wert":"konkret"} (6 Einträge)],
  "bodyLanguageIntro": "1-2 Sätze",
  "bodyLanguageSignals": [{"signal":"z.B. Rute hoch & steif","bedeutung":"konkret"} (4-5, möglichst zu den genannten Verhaltensweisen passend)],
  "needsIntro": "1-2 Sätze passend zu Alter/Thema",
  "needsPoints": ["4-5 konkrete Bedürfnisse, alltagsnah"],
  "breedTopics": [{"thema":"rasse-typisches Thema","tipp":"was hilft, 1 Zeile"} (4-5)],
  "selfCheck": ["5-6 kurze, beobachtbare Aussagen zum Ankreuzen, je EIN Verhalten, z.B. '[Name] springt Besucher an' — NUR die Aussage, ohne Skala/Antwort"],
  "closing": "2-3 warme, ehrliche Sätze als Abschluss"
}`;

export async function POST(request: Request) {
  try {
    // ── Auth ──
    const auth = request.headers.get("authorization") || "";
    const token = (auth.match(/^Bearer\s+(.+)$/i)?.[1] || auth).trim();
    if (!WORKER_TOKEN || token !== WORKER_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY fehlt" }, { status: 500 });
    }
    if (!BREVO_API_KEY) {
      return NextResponse.json({ error: "BREVO_API_KEY fehlt" }, { status: 500 });
    }

    const body = await request.json();
    const email = String(body?.email || "").trim();
    if (!email) return NextResponse.json({ error: "email fehlt" }, { status: 400 });

    const dogName = String(body?.dogName || "dein Hund").slice(0, 40);
    const breed = String(body?.breed || "Mischling");
    const age = String(body?.age || "adult");
    const problem = body?.problem ? String(body.problem) : null;
    const behaviors: string[] = Array.isArray(body?.behaviors)
      ? body.behaviors.slice(0, 8).map((b: any) => String(b))
      : [];
    const commands: string[] = Array.isArray(body?.commands)
      ? body.commands.slice(0, 8).map((c: any) => String(c))
      : [];
    const hadTraining = body?.hadTraining ? String(body.hadTraining) : null;
    const goal = body?.goal ? String(body.goal) : null;

    // Optionales Foto
    let photo: { bytes: Uint8Array; type: string } | null = null;
    if (body?.photoBase64 && ALLOWED_IMG.has(String(body?.photoType || ""))) {
      try {
        photo = {
          bytes: new Uint8Array(Buffer.from(String(body.photoBase64), "base64")),
          type: String(body.photoType),
        };
      } catch { photo = null; }
    }

    // ── KI-Content generieren (mit optionaler Foto-Analyse) ──────────
    const system = `Du bist der Pfoten-Plan KI-Trainer und Rasse-Experte. Erstelle ein hochwertiges, SPEZIFISCHES "${dogName} verstehen"-Profil. Es erklaert den Hund (Persoenlichkeit, Rasse, Koerpersprache, Beduerfnisse) — es loest NICHT das Training.

REGELN:
- DAS WICHTIGSTE: SPIEGLE die konkreten Quiz-Angaben dieses Halters zurueck. Schreibe NICHT generisch ueber die Rasse, sondern verknuepfe Rasse-Wissen mit GENAU dem, was der Halter angegeben hat. Statt "Labradore neigen zu Leinenziehen" -> "Du hast angegeben, dass ${dogName} bei anderen Hunden zieht. Das passt zu seinem hohen Vorwaertsantrieb als Apportierhund...". Jeder Halter mit denselben Quiz-Antworten soll sich wiedererkennen, nicht jeder Labrador-Besitzer denselben Text bekommen.
- KONKRET + rasse-fundiert. KEINE Floskeln ("treu und verspielt"). Beziehe dich bei bekannter Rasse auf Herkunft/urspruengliche Aufgabe und was das im Alltag bedeutet. Bei Mischling/unbekannt: ueber das beobachtete Verhalten.
- "currentState" und "whyBehavior" MUESSEN sich direkt auf die angegebenen Daten beziehen (Alter, Hauptthema, beobachtetes Verhalten, Trainingsstand). "selfCheck"-Aussagen sollen zu den genannten Verhaltensweisen + typischen Rasse-Themen passen.
- Ehrlich: Rasse = Tendenzen, kein Schicksal.
- Du-Ansprache, warm, kompetent. Deutsch. Keine Markdown-Sterne, keine langen Gedankenstriche.
${photo ? `- Es ist ein FOTO des Hundes angehaengt. Fuelle zusaetzlich das Feld "photoObservation": 2-3 Saetze, was du an Koerpersprache/Haltung/Ausdruck SIEHST, plus 1 Tipp. Sei ehrlich wenn etwas nicht eindeutig erkennbar ist. KEIN tieraerztlicher Befund.` : `- Kein Foto vorhanden: setze "photoObservation" auf null.`}

Gib AUSSCHLIESSLICH gueltiges JSON in genau dieser Struktur zurueck (Beschreibungen ersetzen):
${SCHEMA.replace(/\}$/, photo ? `,\n  "photoObservation": "2-3 Sätze aus dem Foto + 1 Tipp"\n}` : `,\n  "photoObservation": null\n}`)}`;

    const dataLines = [
      `Name: ${dogName}`,
      `Rasse: ${breed}`,
      `Alter: ${age}`,
      problem ? `Hauptthema (vom Halter angegeben): ${problem}` : null,
      behaviors.length ? `Beobachtetes Verhalten (vom Halter angegeben): ${behaviors.join(", ")}` : null,
      hadTraining ? `Bisheriger Trainingsstand: ${hadTraining}` : null,
      commands.length ? `Kann schon: ${commands.join(", ")}` : null,
      goal ? `Ziel des Halters: ${goal}` : null,
    ].filter(Boolean).join("\n");

    const userContent: any[] = [{ type: "text", text: `Daten:\n${dataLines}` }];
    if (photo) {
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: photo.type, data: String(body.photoBase64) },
      });
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: userContent }],
    });
    const raw = resp.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("")
      .trim();

    let content: HundVerstehenContent;
    try {
      const j = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
      const p = JSON.parse(j);
      content = {
        currentState: String(p.currentState || ""),
        characterIntro: String(p.characterIntro || ""),
        characterTraits: Array.isArray(p.characterTraits) ? p.characterTraits.slice(0, 6).map((t: any) => ({ label: String(t.label || ""), value: String(t.value || "") })) : [],
        whyBehavior: Array.isArray(p.whyBehavior) ? p.whyBehavior.slice(0, 5).map((w: any) => ({ behavior: String(w.behavior || ""), explanation: String(w.explanation || "") })) : [],
        steckbrief: Array.isArray(p.steckbrief) ? p.steckbrief.slice(0, 7).map((r: any) => ({ feld: String(r.feld || ""), wert: String(r.wert || "") })) : [],
        bodyLanguageIntro: String(p.bodyLanguageIntro || ""),
        bodyLanguageSignals: Array.isArray(p.bodyLanguageSignals) ? p.bodyLanguageSignals.slice(0, 6).map((s: any) => ({ signal: String(s.signal || ""), bedeutung: String(s.bedeutung || "") })) : [],
        photoObservation: p.photoObservation ? String(p.photoObservation) : null,
        needsIntro: String(p.needsIntro || ""),
        needsPoints: Array.isArray(p.needsPoints) ? p.needsPoints.slice(0, 6).map((x: any) => String(x)) : [],
        breedTopics: Array.isArray(p.breedTopics) ? p.breedTopics.slice(0, 6).map((t: any) => ({ thema: String(t.thema || ""), tipp: String(t.tipp || "") })) : [],
        selfCheck: Array.isArray(p.selfCheck) ? p.selfCheck.slice(0, 6).map((x: any) => String(x)) : [],
        closing: String(p.closing || ""),
      };
    } catch (e: any) {
      console.error("[hund-verstehen/generate] JSON parse failed:", e?.message);
      return NextResponse.json({ error: "content_generation_failed" }, { status: 500 });
    }

    // ── PDF bauen ─────────────────────────────────────────────────────
    const pdfBytes = await buildHundVerstehenPDF({ dogName, breed, age, dogPhoto: photo, content });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    // ── Per Brevo mit Anhang senden ───────────────────────────────────
    const fileName = `Dein-Hund-verstehen-${dogName.replace(/\s+/g, "-")}.pdf`;
    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
        to: [{ email }],
        cc: [{ email: "kontakt@primesocial.de" }],
        subject: `${dogName} verstehen — dein persönliches Profil`,
        htmlContent: htmlBody(dogName, breed),
        attachment: [{ name: fileName, content: pdfBase64 }],
      }),
    });
    if (!brevoRes.ok) {
      const t = await brevoRes.text();
      console.error("[hund-verstehen/generate] Brevo error:", brevoRes.status, t);
      return NextResponse.json({ error: "mail_failed", detail: t.slice(0, 200) }, { status: 502 });
    }

    console.log(`[hund-verstehen] PDF an ${email} (${dogName}, ${breed}, foto=${!!photo})`);
    return NextResponse.json({ ok: true, pdf_bytes: pdfBytes.length, with_photo: !!photo });
  } catch (err: any) {
    console.error("[hund-verstehen/generate] error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Interner Fehler" }, { status: 500 });
  }
}
