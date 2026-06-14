// Käufer-Umfrage (Tag-30 „Laura"-Mail). Speichert die Antworten am Lead und
// schickt zusätzlich eine Benachrichtigung an max@primesocial.de.
//
// DSGVO: Es werden nur die freiwillig angegebenen Antworten gespeichert
// (Datensparsamkeit). Die Testimonial-Nutzung ist eine separate, optionale
// Einwilligung (consent_testimonial). Keine zusätzlichen personenbezogenen
// Daten über das hinaus, was der Lead ohnehin schon hat.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendBrevoMail } from "@/lib/member-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const leadId = (body?.lead_id || "").toString().trim() || null;
  const email = (body?.email || "").toString().trim().toLowerCase() || null;
  if (!leadId && !email) {
    return NextResponse.json({ error: "lead_id oder email fehlt" }, { status: 400 });
  }

  // Nur erwartete Felder übernehmen (Datensparsamkeit).
  const survey = {
    zufriedenheit_plan: body?.zufriedenheit_plan ?? null, // 1-5
    was_geholfen: (body?.was_geholfen ?? "").toString().slice(0, 2000),
    was_fehlt: (body?.was_fehlt ?? "").toString().slice(0, 2000),
    plan_beachten: (body?.plan_beachten ?? "").toString().slice(0, 2000),
    website_erlebnis: body?.website_erlebnis ?? null, // 1-5
    consent_testimonial: body?.consent_testimonial === true,
    submitted_at: new Date().toISOString(),
  };

  // Lead laden (für answers-Merge + Empfänger/Hundename in der Benachrichtigung).
  let leadQuery = supabase
    .from("wauwerk_leads")
    .select("id, email, dog_name, answers")
    .limit(1);
  leadQuery = leadId
    ? leadQuery.eq("id", leadId)
    : leadQuery.ilike("email", email as string);
  const { data: lead, error: leadErr } = await leadQuery.single();

  if (leadErr || !lead) {
    // Trotzdem benachrichtigen, damit kein Feedback verloren geht.
    await notifyMax(email || leadId || "unbekannt", null, survey);
    return NextResponse.json({ ok: true, stored: false, reason: "lead_not_found" });
  }

  // Antworten additiv in answers.survey_response mergen (read-modify-write).
  // Nur mergen wenn vorhandene answers sauber gelesen wurden — sonst NICHT
  // anfassen, damit ein Fehler nie die Quiz-Antworten mit {} überschreibt.
  const prev = (lead.answers || {}) as Record<string, any>;
  const { error: updErr } = await supabase
    .from("wauwerk_leads")
    .update({ answers: { ...prev, survey_response: survey } })
    .eq("id", lead.id);

  await notifyMax(lead.email || email || "unbekannt", lead.dog_name, survey);

  if (updErr) {
    return NextResponse.json({ ok: true, stored: false, reason: "update_failed" });
  }
  return NextResponse.json({ ok: true, stored: true });
}

async function notifyMax(
  who: string,
  dogName: string | null,
  s: {
    zufriedenheit_plan: any;
    was_geholfen: string;
    was_fehlt: string;
    plan_beachten: string;
    website_erlebnis: any;
    consent_testimonial: boolean;
    submitted_at: string;
  }
) {
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#2C2C2E;line-height:1.6">
      <h2 style="color:#C4A576;margin:0 0 12px">📋 Neue Umfrage-Antwort</h2>
      <p><strong>Kunde:</strong> ${esc(who)}${dogName ? ` &middot; Hund: ${esc(dogName)}` : ""}</p>
      <table style="border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#6B6B6B">Zufriedenheit Plan</td><td><strong>${esc(s.zufriedenheit_plan)}</strong> / 5</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B6B6B">Website/Bestellung</td><td><strong>${esc(s.website_erlebnis)}</strong> / 5</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B6B6B;vertical-align:top">Was geholfen hat</td><td>${esc(s.was_geholfen) || "—"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B6B6B;vertical-align:top">Was fehlt / Verbesserung</td><td>${esc(s.was_fehlt) || "—"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B6B6B;vertical-align:top">Im Plan beachten</td><td>${esc(s.plan_beachten) || "—"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B6B6B">Testimonial erlaubt?</td><td>${s.consent_testimonial ? "✅ ja" : "—"}</td></tr>
      </table>
    </div>`;
  try {
    await sendBrevoMail({
      to: "max@primesocial.de",
      subject: `📋 Umfrage-Antwort: ${who}`,
      html,
      tags: ["intern", "umfrage"],
    });
  } catch (e: any) {
    console.error("[umfrage] notifyMax failed:", e?.message);
  }
}
