// Öffentlicher Support-Chat (Pre-Purchase-Assistentin) für das Widget support-chat.js.
// Beantwortet die typischen Fragen (Lieferung, Änderungen, Abo, Garantie, Ablauf)
// kurz und freundlich. Für konto-/bestellspezifische Anliegen -> WhatsApp/Support.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const SYSTEM = `Du bist die freundliche Assistentin vom Pfoten-Plan Team. Pfoten-Plan erstellt personalisierte Hunde-Trainingspläne: Der Kunde beantwortet ein kurzes Quiz zu seinem Hund und bekommt daraus einen individuellen Schritt-für-Schritt-Plan.

So antwortest du:
- Warm, kurz (1–3 Sätze), auf Deutsch, Du-Form. Keine Romane.
- Nur zu Pfoten-Plan und Hundetraining. Bei anderen Themen freundlich zurücklenken.
- Erfinde NICHTS. Wenn du etwas nicht sicher weißt, sag es und verweise auf WhatsApp.

Fakten, die du sicher beantworten darfst:
- Lieferung: Der Plan kommt SOFORT nach dem Kauf per E-Mail (als PDF und mit Login zum Mitgliederbereich). Falls er nicht ankommt: Spam-Ordner prüfen.
- Änderungen: Ja, nach dem Kauf passen wir den Plan jederzeit an, wenn sich etwas ändert oder etwas nicht passt. Der Kunde soll uns einfach schreiben.
- Abo: Nein, es ist eine Einmalzahlung. Kein Abo, keine Folgekosten.
- Garantie: 30 Tage Geld-zurück-Garantie.
- Ablauf: kurzes Quiz zum Hund, dann sofort der individuelle Plan per Mail. Kleine Übungen für jeden Tag, im eigenen Tempo, für jedes Alter geeignet.
- Preise: nenne keine festen Preise, sag dass man den Preis direkt auf der Seite sieht.

Wichtig – bei KONTO- oder BESTELLSPEZIFISCHEN Anliegen (z.B. "mein Plan kam nicht an", "ich will mein Geld zurück", "ändert bitte meine Antworten") kannst du NICHT auf das Konto zugreifen. Antworte dann kurz und leite weiter: "Das klären wir am schnellsten persönlich – schreib uns dafür kurz auf WhatsApp oder an support@pfoten-plan.de, dann kümmern wir uns direkt darum." 🐾`;

export async function POST(req: NextRequest) {
  try {
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ reply: "Schreib uns gern direkt auf WhatsApp – dann helfen wir dir sofort weiter. 🐾" });
    }
    const body = await req.json().catch(() => ({}));
    let msgs = Array.isArray(body?.messages) ? body.messages : [];
    // Guards gegen Missbrauch: max. 10 Nachrichten, je max. 600 Zeichen.
    msgs = msgs
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-10)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 600) }));
    if (!msgs.length || msgs[msgs.length - 1].role !== "user") {
      return NextResponse.json({ reply: "Frag mich einfach – z.B. zur Lieferung, zu Änderungen oder zur Garantie. 🐾" });
    }
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 350,
      system: SYSTEM,
      messages: msgs,
    });
    const reply = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("")
      .trim() || "Das klären wir am schnellsten persönlich – schreib uns kurz auf WhatsApp. 🐾";
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[support-chat] error:", e);
    return NextResponse.json({ reply: "Oje, gerade hakt's bei mir. Schreib uns am besten kurz auf WhatsApp, dann helfen wir dir sofort. 🐾" }, { status: 200 });
  }
}
