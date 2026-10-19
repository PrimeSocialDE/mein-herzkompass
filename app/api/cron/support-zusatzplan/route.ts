// Baut für Support-Fälle im Status "zusatzplan_offen" automatisch einen
// individuellen Zusatzplan (lib/zusatzplan.ts) und schickt ihn als Antwort:
// "Wir haben den Plan angepasst, schon mal im Anhang. Guck mal, ob das so passt?"
//
// Ein Fall pro Lauf (die Plan-Erstellung dauert 2 bis 4 Minuten).
// Versand nur LIVE (wie der Autoresponder) und frühestens 2 Std nach der
// Kundenmail. Kopie jeder Mail an kontakt@primesocial.de.
//   ?dry=1&case=<id> -> erstellt den Plan und schickt ihn NUR an kontakt@primesocial.de

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendViaGoogleSmtp } from "@/lib/google-smtp";
import { zusatzplanText, zusatzplanPDF, planUebersicht } from "@/lib/zusatzplan";
import { cleanSubject, nl2br, type SupportCase } from "@/lib/support-cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";
const KOPIE = "kontakt@primesocial.de";
const GRACE_MS = 2 * 60 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

const PROBLEM_LABEL: Record<string, string> = {
  pulling: "Leinenziehen", "leash-reactive": "Pöbeln an der Leine", "dog-reactive": "Reaktion auf andere Hunde",
  barking: "Bellen", aggression: "Aggression", anxiety: "Angst / Trennungsangst", separation: "Alleinbleiben",
  jumping: "Anspringen", recall: "Rückruf", energy: "zu viel Energie", destructive: "Zerstören",
  soiling: "Stubenreinheit", mouthing: "Aufnehmen vom Boden",
};

async function setting(key: string): Promise<string> {
  const { data } = await supabase.from("system_settings").select("value").eq("key", key).maybeSingle();
  return String(data?.value ?? "").trim();
}

function vorname(fall: SupportCase, customerName?: string | null): string {
  const src = (customerName || fall.from_name || "").trim();
  return src ? src.split(/\s+/)[0].replace(/[^A-Za-zÄÖÜäöüß-]/g, "") : "";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = searchParams.get("dry") === "1";
  const caseId = searchParams.get("case");
  const live = process.env.SUPPORT_AUTO_LIVE === "1" || (await setting("support_auto_live")) === "true";
  if (!live && !dry) return NextResponse.json({ ok: true, schatten: true });
  const liveAb = (await setting("support_live_ab")) || new Date().toISOString();

  // Fall holen: entweder gezielt (dry) oder den ältesten fälligen
  let fall: SupportCase | null = null;
  if (caseId) {
    const { data } = await supabase.from("support_cases").select("*").eq("id", caseId).maybeSingle();
    fall = (data as SupportCase) || null;
  } else {
    const { data } = await supabase
      .from("support_cases")
      .select("*")
      .eq("status", "zusatzplan_offen")
      .gte("received_at", liveAb)
      .lte("received_at", new Date(Date.now() - GRACE_MS).toISOString())
      .order("received_at", { ascending: true })
      .limit(5);
    // Sperre: wer gerade in Arbeit ist (entwurf = "[in_arbeit:<zeit>]"), wird übersprungen, solange die Sperre frisch ist
    fall = ((data || []) as SupportCase[]).find((f) => {
      const m = String(f.entwurf || "").match(/^\[in_arbeit:(.+)\]$/);
      return !m || Date.now() - new Date(m[1]).getTime() > LOCK_MS;
    }) || null;
  }
  if (!fall) return NextResponse.json({ ok: true, nichts_offen: true });

  if (!dry) {
    await supabase.from("support_cases").update({ entwurf: `[in_arbeit:${new Date().toISOString()}]` }).eq("id", fall.id);
  }

  // Kunde + Originalplan
  let lead: any = null;
  if (fall.lead_id) {
    const { data } = await supabase.from("wauwerk_leads").select("id, email, customer_name, dog_name, answers").eq("id", fall.lead_id).maybeSingle();
    lead = data;
  }
  if (!lead) {
    const { data } = await supabase.from("wauwerk_leads").select("id, email, customer_name, dog_name, answers")
      .ilike("email", fall.from_email).order("created_at", { ascending: false }).limit(1).maybeSingle();
    lead = data;
  }
  const dogName = (fall.dog_name || lead?.dog_name || "deinen Hund").trim();
  const dogCap = dogName.charAt(0).toUpperCase() + dogName.slice(1);
  const planMail = lead?.email || fall.from_email;
  const { data: plan } = await supabase.from("member_plan_content").select("content")
    .ilike("email", planMail).eq("plan_slug", "trainingsplan").order("created_at", { ascending: false }).limit(1).maybeSingle();

  const beschwerde = (fall.verlauf || []).filter((v) => v.richtung === "ein").map((v) => v.text).slice(-3).join("\n\n---\n\n") || fall.letzte_nachricht || "";

  let pdf: Uint8Array;
  try {
    const text = await zusatzplanText({
      dogName: dogCap,
      customerName: vorname(fall, lead?.customer_name),
      problemLabel: PROBLEM_LABEL[String(lead?.answers?.dog_problem || "")] || undefined,
      beschwerde,
      planUebersicht: planUebersicht(plan?.content),
    });
    pdf = await zusatzplanPDF(text, dogCap);
  } catch (e: any) {
    console.error("[support-zusatzplan] Erstellung fehlgeschlagen:", e?.message);
    if (!dry) await supabase.from("support_cases").update({ entwurf: null }).eq("id", fall.id); // Sperre lösen, nächster Lauf versucht es erneut
    return NextResponse.json({ error: "erstellung_fehlgeschlagen", detail: e?.message }, { status: 500 });
  }

  const vn = vorname(fall, lead?.customer_name);
  const text = `${vn ? `Hallo ${vn}` : "Hallo"},

wir haben den Plan für ${dogCap} angepasst, du findest ihn schon mal im Anhang. Guck mal, ob das so passt?

Darin sind neue Übungen, die genau bei dem ansetzen, was du uns geschrieben hast. Fang am besten mit Übung 1 an und nimm dir für jede Übung ein paar Tage Zeit.

Wenn noch etwas fehlt oder nicht passt, antworte einfach auf diese Mail.

Liebe Grüße
Dein PfotenPlan-Team`;
  const betreff = "Re: " + (cleanSubject(fall.subject || "") || `Dein angepasster Plan für ${dogCap}`);
  const fileName = `Zusatz-Plan-${dogCap.replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, "") || "Hund"}.pdf`;

  try {
    await sendViaGoogleSmtp({
      to: dry ? KOPIE : fall.from_email,
      ...(dry ? {} : { cc: KOPIE }),
      subject: dry ? `[TEST] ${betreff}` : betreff,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.6">${nl2br(text)}</div>`,
      fromName: "Max von Pfoten-Plan",
      attachments: [{ name: fileName, contentBase64: Buffer.from(pdf).toString("base64") }],
    } as any);
  } catch (e: any) {
    console.error("[support-zusatzplan] Versand fehlgeschlagen:", e?.message);
    if (!dry) await supabase.from("support_cases").update({ entwurf: null }).eq("id", fall.id);
    return NextResponse.json({ error: "versand_fehlgeschlagen" }, { status: 502 });
  }

  if (!dry) {
    const jetzt = new Date().toISOString();
    await supabase.from("support_cases").update({
      status: "gerettet",
      entwurf: text,
      gesendet_at: jetzt,
      kurz: `Zusatzplan geschickt (${fileName})`,
      verlauf: [...(fall.verlauf || []), { richtung: "aus", text: `${text}\n\n[Anhang: ${fileName}]`, at: jetzt }],
    }).eq("id", fall.id);
  }
  return NextResponse.json({ ok: true, dry, fall: fall.id, an: dry ? KOPIE : fall.from_email, pdf_kb: Math.round(pdf.length / 1024) });
}
