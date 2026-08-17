// Öffentlicher Support-Chat (Pre-Purchase-Assistentin) + Selbstbedienung:
// Die KI kann die Quiz-Angaben des Kunden direkt in Supabase ändern (Tool-Use).
// Sicherheit: nur das Lead aus der Session (leadId), UND die E-Mail muss zum
// Lead passen. Nach dem Kauf wird der Plan automatisch neu generiert.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 30;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const SB = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE || "";
const WORKER = process.env.WORKER_TOKEN || "";

// Änderbare Quiz-Felder (Whitelist) + gültige Werte
const AGE = ["puppy", "young", "adult", "senior"];
const PROBLEMS = ["pulling","aggression","dog-reactive","energy","recall","barking","anxiety","mouthing","jumping","destructive","soiling","obedience"];

const SYSTEM = `Du bist Emma, die freundliche Assistentin vom Pfoten-Plan Team. Pfoten-Plan erstellt personalisierte Hunde-Trainingspläne aus einem kurzen Quiz.

STIL: warm, kurz (1–3 Sätze), Deutsch, Du-Form. Erfinde nichts.

FAKTEN, die du beantworten darfst:
- Lieferung: Plan kommt SOFORT nach dem Kauf per E-Mail (PDF + Login zum Mitgliederbereich); ggf. Spam-Ordner prüfen.
- Abo: nein, Einmalzahlung.
- Garantie: 30 Tage Geld-zurück.
- Ablauf: kurzes Quiz zum Hund → sofort individueller Plan. Kleine Übungen täglich, jedes Alter.
- Preise: sag, dass man den Preis direkt auf der Seite sieht.

ÄNDERUNGEN (das kannst du WIRKLICH tun): Wenn der Kunde eine seiner Quiz-Angaben ändern will (Name, Alter, Rasse, Geschlecht, Hauptthema/Problem), dann:
1) Frag KURZ nach, was genau geändert werden soll, falls unklar. Frag NICHT nach der E-Mail — die Session identifiziert den Kunden bereits.
2) Ruf das Tool "update_dog_details" mit den zu ändernden Feldern auf.
3) Bei Erfolg bestätige warm und sag, dass der angepasste Plan (falls schon gekauft) gerade neu erstellt und per Mail geschickt wird.
Für Problem/Thema nutze einen dieser Werte: ${PROBLEMS.join(", ")} (z.B. Trennungsangst → "anxiety", Ziehen → "pulling", Reaktivität gegen Hunde → "aggression"). Alter: ${AGE.join(", ")}.

Wenn das Tool einen Fehler zurückgibt, entschuldige dich kurz und verweise auf WhatsApp. Für alles andere Persönliche → WhatsApp/support@pfoten-plan.de.`;

async function sbGet(path: string) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  return r.ok ? r.json() : null;
}

// Logging: jede Kundenfrage ins Lead schreiben (support_chat_log, max 30).
// Wird NACH dem KI-Lauf ausgeführt, damit es eine evtl. Daten-Änderung nicht überschreibt.
async function logQuestion(leadId: string, msg: string, changed?: string[]) {
  if (!leadId || !msg || !SB || !KEY) return;
  try {
    const rows = await sbGet(`wauwerk_leads?id=eq.${leadId}&select=answers`);
    const lead = rows && rows[0];
    if (!lead) return;
    const answers = { ...(lead.answers || {}) };
    const log = Array.isArray(answers.support_chat_log) ? answers.support_chat_log.slice(-29) : [];
    log.push({ t: new Date().toISOString(), q: msg.slice(0, 300), ...(changed && changed.length ? { changed } : {}) });
    answers.support_chat_log = log;
    await fetch(`${SB}/rest/v1/wauwerk_leads?id=eq.${leadId}`, {
      method: "PATCH",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ answers }),
    });
  } catch {}
}

async function applyUpdate(leadId: string, sessionEmail: string, input: any) {
  if (!leadId) return { ok: false, error: "Keine Session gefunden. Bitte schreib uns kurz auf WhatsApp." };
  const rows = await sbGet(`wauwerk_leads?id=eq.${leadId}&select=email,status,selected_plan,answers`);
  const lead = rows && rows[0];
  if (!lead) return { ok: false, error: "Lead nicht gefunden." };
  // leadId aus der Session ist der Eigentumsnachweis (localStorage vom eigenen Quiz).
  // E-Mail wird NICHT abgefragt. Falls zufällig eine in der Session/im Chat liegt,
  // gleichen wir sie still ab (Extra-Schutz) — fehlt sie, ändern wir trotzdem.
  const givenEmail = String(input.email || sessionEmail || "").trim().toLowerCase();
  const leadEmail = String(lead.email || (lead.answers || {}).email || "").trim().toLowerCase();
  if (givenEmail && leadEmail && givenEmail !== leadEmail) {
    return { ok: false, error: "E-Mail passt nicht zur Bestellung. Ich ändere nichts, um fremde Daten zu schützen." };
  }
  // Merge-Update (niemals überschreiben)
  const answers = { ...(lead.answers || {}) };
  const changed: string[] = [];
  const map: Record<string, any> = {};
  if (typeof input.dog_name === "string" && input.dog_name.trim()) { answers.dog_name = input.dog_name.trim(); map.dog_name = answers.dog_name; changed.push("Name"); }
  if (typeof input.dog_age === "string" && AGE.includes(input.dog_age)) { answers.dog_age = input.dog_age; changed.push("Alter"); }
  if (typeof input.dog_breed === "string" && input.dog_breed.trim()) { answers.dog_breed = input.dog_breed.trim(); changed.push("Rasse"); }
  if (typeof input.dog_gender === "string" && input.dog_gender.trim()) { answers.dog_gender = input.dog_gender.trim(); changed.push("Geschlecht"); }
  if (typeof input.dog_problem === "string" && PROBLEMS.includes(input.dog_problem)) {
    answers.dog_problem = input.dog_problem;
    const beh = Array.isArray(answers.dog_behaviors) ? answers.dog_behaviors.slice() : [];
    if (!beh.includes(input.dog_problem)) beh.unshift(input.dog_problem);
    answers.dog_behaviors = beh; changed.push("Hauptthema");
  }
  if (!changed.length) return { ok: false, error: "Nichts zu ändern erkannt." };
  const body: any = { answers };
  if (map.dog_name) body.dog_name = map.dog_name;
  await fetch(`${SB}/rest/v1/wauwerk_leads?id=eq.${leadId}`, {
    method: "PATCH",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  // Nach Kauf: Plan neu generieren (fire-and-forget)
  const isPaid = lead.status === "paid" || !!(lead.answers || {}).processed_payment_ids;
  let regen = false;
  if (isPaid && WORKER) {
    // Monate + Empfänger leitet plan/generate frisch aus dem Lead ab (selected_plan / email)
    fetch(`https://www.pfoten-plan.de/api/mitglieder/plan/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WORKER}`, "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId, force: true }),
    }).catch(() => {});
    regen = true;
  }
  return { ok: true, changed, regen };
}

export async function POST(req: NextRequest) {
  try {
    if (!ANTHROPIC_API_KEY) return NextResponse.json({ reply: "Schreib uns gern direkt auf WhatsApp – dann helfen wir dir sofort. 🐾" });
    const body = await req.json().catch(() => ({}));
    const leadId = typeof body?.leadId === "string" ? body.leadId.slice(0, 60) : "";
    const sessionEmail = typeof body?.email === "string" ? body.email.slice(0, 120) : "";
    let msgs: any[] = Array.isArray(body?.messages) ? body.messages : [];
    msgs = msgs.filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12).map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 800) }));
    if (!msgs.length || msgs[msgs.length - 1].role !== "user") {
      return NextResponse.json({ reply: "Frag mich einfach – z.B. zur Lieferung, oder wenn du eine deiner Angaben ändern möchtest. 🐾" });
    }
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const tools: any = [{
      name: "update_dog_details",
      description: "Ändert die Quiz-Angaben des Kunden zu seinem Hund. Der Kunde ist über die Session identifiziert — keine E-Mail nötig.",
      input_schema: {
        type: "object",
        properties: {
          dog_name: { type: "string" }, dog_breed: { type: "string" }, dog_gender: { type: "string" },
          dog_age: { type: "string", enum: AGE },
          dog_problem: { type: "string", enum: PROBLEMS },
        },
      },
    }];
    const lastUserMsg = String(msgs[msgs.length - 1].content || "");
    let changedFields: string[] = [];
    let convo: any[] = msgs.slice();
    let finalText = "";
    for (let i = 0; i < 3; i++) {
      const resp = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 400, system: SYSTEM, tools, messages: convo });
      const toolUse = resp.content.find((b: any) => b.type === "tool_use") as any;
      finalText = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
      if (resp.stop_reason !== "tool_use" || !toolUse) break;
      const result = await applyUpdate(leadId, sessionEmail, toolUse.input || {});
      if (result && (result as any).ok && Array.isArray((result as any).changed)) changedFields = (result as any).changed;
      convo.push({ role: "assistant", content: resp.content });
      convo.push({ role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) }] });
    }
    // Logging nach dem Lauf (liest frischen Stand inkl. evtl. Änderung, hängt Frage an)
    await logQuestion(leadId, lastUserMsg, changedFields);
    return NextResponse.json({ reply: finalText || "Das klären wir am schnellsten persönlich – schreib uns kurz auf WhatsApp. 🐾" });
  } catch (e) {
    console.error("[support-chat] error:", e);
    return NextResponse.json({ reply: "Oje, gerade hakt's bei mir. Schreib uns am besten kurz auf WhatsApp, dann helfen wir dir sofort. 🐾" }, { status: 200 });
  }
}
