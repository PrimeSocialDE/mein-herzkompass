// Chat-Endpoint für die /mitglieder/hilfe Seite. Ruft Claude (Anthropic
// SDK) mit dem User-Kontext (Hund-Daten + Quiz-Antworten + paid-Status)
// im System-Prompt — Claude antwortet damit als Pfoten-Plan-Trainer-AI
// kontextbezogen auf den konkreten Hund.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentMember, createMemberAdminClient } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";
import { THEMEN_MODULES } from "@/lib/member-themen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

// Free-Tier: 3 Fragen TOTAL (Lifetime, kein Reset). Wer mehr will,
// kauft einen Plan — Chat ist dann unlimitiert dabei. Kein eigenes
// Chat-Abo, weil das psychologisch zu schwach ist.
const FREE_TOTAL_LIMIT = 3;
const PAID_LIMIT = Infinity;

const PROBLEM_LABELS: Record<string, string> = {
  pulling: "Leinenziehen",
  barking: "übermäßiges Bellen",
  aggression: "Aggression",
  anxiety: "Trennungsangst",
  jumping: "Anspringen",
  recall: "Rückruf-Probleme",
  energy: "übermäßige Energie",
  destructive: "Zerstörungsverhalten",
  soiling: "Stubenreinheit",
  mouthing: "Aufnehmen von Gegenständen",
};

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

interface IncomingMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGES_PER_REQUEST = 4;

// ── Kontextueller Modul-Hinweis ───────────────────────────────────────────
// Erkennt das Thema der letzten Nutzer-Frage und schlägt das passende
// Themen-Modul vor — bewusst zurückhaltend (Guardrails):
//   • NUR bei anhaltendem Interesse: Thema muss >= 2× im Gespräch vorkommen.
//   • NICHT das Hauptproblem des Plans (das hat der Käufer schon).
//   • Nur für zahlende Mitglieder (Free-User → erst Plan kaufen).
//   • max. 1×/Gespräch wird im Frontend gedeckelt.
// Der Coach hilft immer zuerst; die Karte erscheint separat unter der Antwort.
const THEME_PATTERNS: Record<string, RegExp> = {
  pulling: /leine|zieht|ziehen|zerr/i,
  barking: /bell|kläff|verbell/i,
  aggression: /aggress|knurr|pöbel/i,
  anxiety: /angst|allein\b|panik|trennung|winsel|jammer/i,
  recall: /rückruf|abruf|kommt (eh |einfach |gar )?nicht|hört nicht|läuft weg|wegläuf/i,
  jumping: /spring|anspring/i,
  energy: /hyperaktiv|zappel|ausgelastet|überdreh|zur ruhe komm/i,
  destructive: /zerstör|zerkau|zernag/i,
  soiling: /stubenrein|pinkelt|uriniert|macht.*(rein|wohnung)/i,
  mouthing: /zwick|schnapp|aufnehm|giftköder|frisst.*(boden|alles)/i,
};

function blockText(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .filter((b) => b?.type === "text")
      .map((b: any) => b.text)
      .join(" ");
  return "";
}

function suggestModule(
  messages: IncomingMessage[],
  mainProblem: string | null
): { slug: string; title: string; goal: string; price_cents: number } | null {
  const userTexts = messages
    .filter((m) => m.role === "user")
    .map((m) => blockText(m.content).toLowerCase());
  if (userTexts.length === 0) return null;

  const last = userTexts[userTexts.length - 1];
  let theme: string | null = null;
  for (const [k, re] of Object.entries(THEME_PATTERNS)) {
    if (re.test(last)) {
      theme = k;
      break;
    }
  }
  // Kein klares Thema → nichts vorschlagen. (Hinweis darf jetzt AUCH beim
  // eigenen Plan-Thema kommen — das Modul hat mehr/individuellere Übungen.
  // Die Karte haengt UNTER der Antwort; der KI-Coach beantwortet die Frage
  // trotzdem voll, unabhaengig vom Vorschlag.)
  if (!theme) return null;
  void mainProblem;

  // Frueher Hinweis erlaubt: schon ab der ERSTEN klaren Frage zum Thema.
  // (Vorher >= 2 Nachrichten noetig -> Vorschlag feuerte fast nie.)
  const hits = userTexts.filter((t) => THEME_PATTERNS[theme!].test(t)).length;
  if (hits < 1) return null;

  const mod = THEMEN_MODULES.find((m) => m.problem_match === theme);
  if (!mod) return null;
  return {
    slug: mod.slug,
    title: mod.title,
    goal: mod.goal,
    price_cents: mod.price_cents,
  };
}

// Coach-Premium = Foto/Video-Analyse freigeschaltet. Liegt in den Lead-answers
// (coach_premium_until in der Zukunft). Robust gegen mehrere Leads pro Email.
async function resolveCoachContext(
  admin: ReturnType<typeof createMemberAdminClient>,
  email: string
): Promise<{ premium: boolean; leadId: string | null; dogName: string | null }> {
  if (!email) return { premium: false, leadId: null, dogName: null };
  try {
    const { data: leads } = await admin
      .from("wauwerk_leads")
      .select("id, dog_name, answers, created_at")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(10);
    const now = Date.now();
    let premium = false;
    let leadId: string | null = null;
    let dogName: string | null = null;
    for (const l of leads || []) {
      if (!leadId) leadId = l.id as string;
      if (!dogName && l.dog_name) dogName = l.dog_name as string;
      const until = (l.answers as any)?.coach_premium_until;
      if (until && new Date(until).getTime() > now) premium = true;
    }
    return { premium, leadId, dogName };
  } catch {
    return { premium: false, leadId: null, dogName: null };
  }
}

// Reiner Text aus String- oder Block-Content (für History/Speicherung).
function contentText(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content;
  const txt = content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join(" ");
  const hasImg = content.some((b) => b.type === "image");
  return (hasImg ? "[Foto] " : "") + txt;
}

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Chat ist gerade nicht verfügbar (Konfig fehlt)." },
      { status: 503 }
    );
  }

  const user = await getCurrentMember();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  let messages: IncomingMessage[];
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }
  if (messages.length === 0) {
    return NextResponse.json({ error: "Keine Nachrichten" }, { status: 400 });
  }
  // Limit gegen Missbrauch
  if (messages.length > 20) messages = messages.slice(-20);

  const hasImage = messages.some(
    (m) =>
      Array.isArray(m.content) &&
      (m.content as ContentBlock[]).some((b) => b?.type === "image")
  );

  const member = await getOrCreateMemberProfile({
    userId: user.id,
    email: user.email || "",
  });

  // ── Rate-Limit-Check (Free: 3 Fragen LIFETIME, Paid: unlimited) ──
  // Lifetime statt 24h, sonst warten User einfach 24h ab und chatten
  // weiter. Wer mehr will, kauft einen Plan — Chat ist dann inklusive.
  const limit =
    member.purchase_status === "paid" ? PAID_LIMIT : FREE_TOTAL_LIMIT;
  const admin = createMemberAdminClient();

  // ── Coach-Premium-Gate: Bilder nur für Premium (Foto/Video-Analyse) ──
  if (hasImage) {
    const coach = await resolveCoachContext(admin, user.email || "");
    if (!coach.premium) {
      return NextResponse.json(
        {
          error: "coach_premium_required",
          lead_id: coach.leadId,
          dog_name: coach.dogName,
        },
        { status: 402 }
      );
    }
  }

  const { data: usageRow } = await admin
    .from("member_users")
    .select("chat_usage_count")
    .eq("id", user.id)
    .maybeSingle();

  const currentCount = (usageRow?.chat_usage_count as number | null) || 0;

  if (limit !== Infinity && currentCount >= limit) {
    return NextResponse.json(
      {
        error: "limit_reached",
        limit,
        used: currentCount,
        is_paid: member.purchase_status === "paid",
      },
      { status: 429 }
    );
  }

  // ── User-Kontext zusammenbauen (für System-Prompt) ──────────────
  const dog = member.dog_name || "der Hund";
  const breed = member.dog_breed ? `, ${member.dog_breed}` : "";
  const quiz = member.quiz_result || {};
  const ageRaw = quiz.dog_age;
  const ageStr = ageRaw ? `, ${ageRaw}` : "";
  const problemKey = quiz.dog_problem || quiz.problem;
  const problemLabel = problemKey ? PROBLEM_LABELS[problemKey] || problemKey : null;
  const knownCommands: string[] = Array.isArray(quiz.dog_commands)
    ? quiz.dog_commands
    : [];

  const contextLines: string[] = [
    `Hund: ${dog}${breed}${ageStr}.`,
  ];
  if (problemLabel) {
    contextLines.push(`Hauptthema laut Quiz: "${problemLabel}".`);
  }
  if (knownCommands.length > 0) {
    contextLines.push(
      `Bekannte Kommandos: ${knownCommands.slice(0, 5).join(", ")}.`
    );
  }
  contextLines.push(
    `Status: ${member.purchase_status === "paid" ? "voller Plan" : "kostenlose Übungen"}.`
  );

  const systemPrompt = `Du bist der Pfoten-Plan KI-Trainer, eine KI-Assistenz die mit dem Wissen des echten Pfoten-Plan Hundetrainer-Teams trainiert wurde. Antworte freundlich, geduldig, konkret und alltagsnah auf Deutsch.

NUTZER-KONTEXT:
${contextLines.join("\n")}

ROLLE & TON:
- Du bist eine KI, das ist transparent. Wenn der User direkt fragt ob du eine KI/AI/Bot bist, sag ehrlich ja, und ergänze dass du mit dem Wissen unseres echten Trainer-Teams trainiert wurdest.
- Behaupte NIEMALS du seist ein Mensch oder ein echter Trainer. Behaupte NICHT du würdest persönlich Hunde trainieren.
- Du darfst von "unserem Trainer-Team" oder "unseren Trainern" sprechen wenn du auf Trainings-Methoden des Pfoten-Plans verweist (z.B. "unser Trainer-Team empfiehlt…", "in unseren Modulen lernst du…").
- Sprich den User mit "du" an. Tonfall: warm, kompetent, nicht roboterhaft.

INHALT:
- Beziehe dich wenn möglich konkret auf ${dog}${problemLabel ? ` und das Thema "${problemLabel}"` : ""}.
- Gib Schritt-für-Schritt-Tipps, kurz und umsetzbar (max 3-5 Schritte).
- Wenn unklar ist was gemeint ist: stelle EINE Rückfrage statt zu raten.
- Bleibe IMMER beim Thema Hundetraining/Pfoten-Plan. Bei Off-Topic ("welches Wetter ist heute" etc.): freundlich zurückführen.
- Bei medizinischen Symptomen (Schmerzen, akute Krankheit): empfehle ausdrücklich einen Tierarzt-Besuch — du bist KEIN Ersatz für tierärztlichen Rat.

NIEMALS ABBRUCH EMPFEHLEN (sehr wichtig):
- Rate dem Nutzer NIEMALS, den Pfoten-Plan abzubrechen, aufzugeben, zu pausieren oder zu kündigen. Sag NIEMALS, dass der Plan ihm "nicht helfen kann" oder dass er "besser einen Trainer vor Ort statt des Plans" braucht. Du bist da, um ihn IM Plan zu begleiten und dranzuhalten.
- Erwähne von dir aus NIEMALS Geld-zurück, Rückerstattung oder Storno.
- Wenn ein Problem hartnäckig ist oder sich trotz Übung nicht bessert: das ist normal, bleib zuversichtlich, ermutige zum Dranbleiben und biete an, die Schritte gemeinsam weiter anzupassen. Stelle EINE Rückfrage, um es zu konkretisieren, statt das Handtuch zu werfen.
- Nur bei wirklich schweren Fällen (z.B. ernste Aggression, Beißvorfälle, starke Angst): empfiehl eine Trainerin oder Verhaltenstherapeutin vor Ort ZUSÄTZLICH und ERGÄNZEND zum Plan ("zusätzlich zu deinem Plan kann euch jemand vor Ort live begleiten") — niemals als Ersatz für den Plan und niemals verbunden mit Aufgeben/Abbrechen.
- Halte Antworten unter 200 Wörter, nutze gerne kurze Listen oder Aufzählungen.
- Wenn der Nutzer ein Foto oder Video (als Bilder) schickt: beschreibe kurz was du an ${dog}s Körpersprache/Haltung/Situation siehst, und gib daraus 1-2 konkrete Trainings-Tipps. Sei ehrlich wenn etwas auf dem Bild nicht eindeutig erkennbar ist. Das ist eine Trainings-Einschätzung, KEIN tierärztlicher Befund.

FORMAT (WICHTIG):
- Verwende KEIN Markdown. Keine Sternchen (** oder *), keine #-Headlines, keine Backticks.
- Schreibe normalen Fließtext. Für Aufzählungen nutze einfache Nummern (1. 2. 3.) oder Bindestriche (-).
- Verwende KEINE langen Gedankenstriche (— oder –). Nutze stattdessen Kommas, Punkte oder normale Bindestriche (-).
- Schreibe wichtige Wörter ohne Hervorhebung, der Text wirkt natürlicher.`;

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: systemPrompt,
      messages: messages.map((m) => {
        if (typeof m.content === "string") {
          return { role: m.role, content: m.content.slice(0, 4000) };
        }
        let imgCount = 0;
        const blocks = (m.content as ContentBlock[])
          .map((b) => {
            if (b.type === "text") {
              return { type: "text" as const, text: String(b.text).slice(0, 4000) };
            }
            if (
              b.type === "image" &&
              ALLOWED_IMAGE_TYPES.has(b.source?.media_type) &&
              imgCount < MAX_IMAGES_PER_REQUEST
            ) {
              imgCount++;
              return {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: b.source.media_type as
                    | "image/jpeg"
                    | "image/png"
                    | "image/webp"
                    | "image/gif",
                  data: b.source.data,
                },
              };
            }
            return null;
          })
          .filter((b): b is NonNullable<typeof b> => b !== null);
        return { role: m.role, content: blocks };
      }),
    });

    const text = response.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n")
      .trim();

    // Defensiv: Markdown-Sterne und lange Gedankenstriche raus, falls
    // Claude sich trotz System-Prompt nicht dran hält.
    const cleaned = text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?;:])/g, "$1$2")
      .replace(/\s—\s/g, ", ")
      .replace(/\s–\s/g, ", ")
      .replace(/—/g, "-")
      .replace(/–/g, "-");

    // Counter hochzählen (nur Free-User, Paid hat Infinity)
    if (limit !== Infinity) {
      await admin
        .from("member_users")
        .update({ chat_usage_count: currentCount + 1 })
        .eq("id", user.id);
    }

    // ── Chat-History persistieren (letzte User-Frage + KI-Antwort) ──
    // Strikt append-only. Failures hier blockieren die Antwort nicht
    // (Verlauf-speicherung ist nice-to-have, KI-Antwort ist priority).
    try {
      const lastUserMsg = messages[messages.length - 1];
      const lastUserText = lastUserMsg ? contentText(lastUserMsg.content) : "";
      if (lastUserMsg?.role === "user" && lastUserText) {
        await admin.from("member_chat_messages").insert([
          {
            user_id: user.id,
            role: "user",
            content: lastUserText.slice(0, 4000),
          },
          {
            user_id: user.id,
            role: "assistant",
            content: cleaned.slice(0, 8000),
          },
        ]);
      }
    } catch (e: any) {
      console.warn("[hilfe-chat] history save failed:", e?.message);
    }

    // Kontextueller Modul-Hinweis — nur für zahlende Mitglieder, Guardrails s.o.
    const suggested_module =
      member.purchase_status === "paid"
        ? suggestModule(messages, problemKey || null)
        : null;

    return NextResponse.json({
      reply: cleaned,
      suggested_module,
      usage: limit === Infinity
        ? { unlimited: true }
        : { used: currentCount + 1, limit, remaining: Math.max(0, limit - (currentCount + 1)) },
    });
  } catch (e: any) {
    console.error("[hilfe-chat] Anthropic error:", e);
    return NextResponse.json(
      { error: "Konnte Antwort nicht generieren. Versuch's gleich nochmal." },
      { status: 500 }
    );
  }
}

// GET — Chat-History laden. Nur eigene Messages (RLS + user-id Filter).
// Default: letzte 50 Messages, chronologisch sortiert (oldest first für UI).
export async function GET(req: NextRequest) {
  const user = await getCurrentMember();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") || "50", 10),
    200
  );

  const admin = createMemberAdminClient();
  const { data, error } = await admin
    .from("member_chat_messages")
    .select("role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[hilfe-chat] history load error:", error);
    return NextResponse.json({ messages: [] });
  }

  // Reverse für UI (oldest first)
  const messages = (data || []).reverse().map((r: any) => ({
    role: r.role as "user" | "assistant",
    content: r.content as string,
    timestamp: r.created_at as string,
  }));

  const coach = await resolveCoachContext(admin, user.email || "");
  return NextResponse.json({
    messages,
    coach_premium: coach.premium,
    lead_id: coach.leadId,
    dog_name: coach.dogName,
    email: user.email || null,
  });
}
