// Erstellt und liefert den Aufbauplan der Plan-Verlängerung (lib/aufbauplan.ts).
//
// Der Mollie-Webhook merkt den Kauf in answers.verl_bestellt vor. Dieser Cron
// (alle 10 Min.) nimmt pro Lauf EINEN Teil in Arbeit, weil ein Teil 3-4 Minuten
// braucht:
//   3 Monate: Teil 1 -> PDF -> Mail -> fertig
//   6 Monate: Lauf 1 Teil 1 (Text in answers.verl_teil1), Lauf 2 Teil 2 -> beide PDFs in einer Mail
//   Upgrade (3-Monats-Käufer, Tag 31): ein Lauf, Teil 2 = Monat 4-6 im Anschluss an den laufenden Plan
// Sperre answers.verl_lock (15 Min.), damit sich überlappende Läufe nicht doppeln.
// Kopie jeder Auslieferung an kontakt@primesocial.de. Nach 3 Fehlversuchen (verl_fehler)
// bleibt der Auftrag liegen und muss von Hand angestoßen werden.
//   ?dry=1&lead=<id>&monate=3|6  -> erstellt Teil 1 (bzw. beide) und schickt NUR an kontakt@primesocial.de, ohne Marker

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendViaGoogleSmtp } from "@/lib/google-smtp";
import { planUebersicht } from "@/lib/zusatzplan";
import { aufbauplanText, aufbauplanPDF, uebungsNamen, type VerlCheckin } from "@/lib/aufbauplan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";
const KOPIE = "kontakt@primesocial.de";
const LOCK_MS = 15 * 60 * 1000;

const PROBLEM_LABEL: Record<string, string> = {
  pulling: "Leinenziehen", "leash-reactive": "Pöbeln an der Leine", "dog-reactive": "Reaktion auf andere Hunde",
  barking: "Bellen", aggression: "Aggression", anxiety: "Angst / Trennungsangst", separation: "Alleinbleiben",
  jumping: "Anspringen", recall: "Rückruf", energy: "zu viel Energie", destructive: "Zerstören",
  soiling: "Stubenreinheit", mouthing: "Aufnehmen vom Boden",
};

type Lead = { id: string; email: string; customer_name: string | null; dog_name: string | null; answers: Record<string, any> | null };

const kap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const dateiName = (dog: string, teil: string) => `Aufbauplan-${dog.replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, "") || "Hund"}${teil}.pdf`;

async function merge(id: string, patch: Record<string, any>) {
  const { data } = await supabase.from("wauwerk_leads").select("answers").eq("id", id).maybeSingle();
  await supabase.from("wauwerk_leads").update({ answers: { ...((data?.answers as any) || {}), ...patch } }).eq("id", id);
}

async function grundlagen(lead: Lead) {
  const a = lead.answers || {};
  const dog = kap(String(lead.dog_name || a.dog_name || "").trim()) || "deinen Hund";
  const { data: plan } = await supabase
    .from("member_plan_content").select("content")
    .ilike("email", lead.email).eq("plan_slug", "trainingsplan")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const vn = String(lead.customer_name || "").trim().split(/\s+/)[0]?.replace(/[^A-Za-zÄÖÜäöüß-]/g, "") || "";
  return {
    dog,
    vorname: vn,
    problemLabel: PROBLEM_LABEL[String(a.dog_problem || "")] || undefined,
    uebersicht: planUebersicht(plan?.content),
    checkin: (a.verl_checkin || {}) as VerlCheckin,
  };
}

async function teilErstellen(lead: Lead, g: Awaited<ReturnType<typeof grundlagen>>, teil: 1 | 2, teil1Text?: string) {
  return aufbauplanText({
    dogName: g.dog,
    customerName: g.vorname || undefined,
    problemLabel: g.problemLabel,
    checkin: g.checkin,
    planUebersicht: g.uebersicht,
    teil,
    teil1Uebungen: teil === 2 && teil1Text ? uebungsNamen(teil1Text) : undefined,
  });
}

async function ausliefern(lead: Lead, g: Awaited<ReturnType<typeof grundlagen>>, monate: 3 | 6, texte: string[], dry: boolean, upgrade = false) {
  if (upgrade) return ausliefernUpgrade(lead, g, texte[0], dry);
  const anhaenge = [];
  for (let i = 0; i < texte.length; i++) {
    const teil = (i + 1) as 1 | 2;
    const pdf = await aufbauplanPDF(texte[i], g.dog, teil, monate);
    anhaenge.push({
      name: dateiName(g.dog, monate === 6 ? (teil === 1 ? "-Monat-1-3" : "-Monat-4-6") : ""),
      contentBase64: Buffer.from(pdf).toString("base64"),
    });
  }
  const text = `${g.vorname ? `Hallo ${g.vorname}` : "Hallo"},

hier ist der Aufbauplan für ${g.dog}: ${monate} Monate mit frischen Übungen, die auf dem aufbauen, was ${g.dog} schon kann, und genau da ansetzen, wo es laut deinem Check-in noch hakt.
${monate === 6 ? "\nIm Anhang findest du zwei PDFs: Monat 1 bis 3 und Monat 4 bis 6. Starte mit dem ersten, das zweite baut darauf auf.\n" : "\nDu findest ihn als PDF im Anhang, zum Ausdrucken und Abhaken.\n"}
Fang mit Übung 1 an und nimm dir für jede Übung ein paar Tage Zeit. Wenn etwas nicht passt oder du Fragen hast, antworte einfach auf diese Mail.

Viel Freude mit ${g.dog}!

Liebe Grüße
Dein PfotenPlan-Team`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.6">${text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>`;
  await sendViaGoogleSmtp({
    to: dry ? KOPIE : lead.email,
    ...(dry ? {} : { cc: KOPIE }),
    subject: `${dry ? "[TEST] " : ""}Dein Aufbauplan für ${g.dog} ist da`,
    html,
    fromName: "Pfoten-Plan",
    attachments: anhaenge,
  } as any);
  return anhaenge.length;
}

async function ausliefernUpgrade(lead: Lead, g: Awaited<ReturnType<typeof grundlagen>>, text2: string, dry: boolean) {
  const pdf = await aufbauplanPDF(text2, g.dog, 2, 6);
  const text = `${g.vorname ? `Hallo ${g.vorname}` : "Hallo"},

${g.dog}s Plan ist jetzt auf 6 Monate erweitert. Im Anhang findest du Monat 4 bis 6: frische Übungen, die nahtlos an Woche 12 deines jetzigen Plans anschließen.

Mach mit deinem jetzigen Plan ganz normal weiter. Wenn du Woche 12 geschafft hast, startest du mit diesem PDF, Übung 10. Druck es dir am besten jetzt schon aus.

Wenn du Fragen hast, antworte einfach auf diese Mail.

Liebe Grüße
Dein PfotenPlan-Team`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.6">${text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>`;
  await sendViaGoogleSmtp({
    to: dry ? KOPIE : lead.email,
    ...(dry ? {} : { cc: KOPIE }),
    subject: `${dry ? "[TEST] " : ""}${g.dog}s Plan: Monat 4 bis 6 ist da`,
    html,
    fromName: "Pfoten-Plan",
    attachments: [{ name: dateiName(g.dog, "-Monat-4-6"), contentBase64: Buffer.from(pdf).toString("base64") }],
  } as any);
  return 1;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Testlauf für einen beliebigen Lead, nur an kontakt@primesocial.de ──
  if (searchParams.get("dry") === "1") {
    const id = searchParams.get("lead") || "";
    const monate = searchParams.get("monate") === "6" ? 6 : 3;
    const { data } = await supabase.from("wauwerk_leads").select("id, email, customer_name, dog_name, answers").eq("id", id).maybeSingle();
    if (!data) return NextResponse.json({ error: "lead nicht gefunden" }, { status: 404 });
    const lead = data as Lead;
    const g = await grundlagen(lead);
    if (!g.checkin.klappt_nicht) {
      g.checkin = {
        klappt: searchParams.get("klappt") || "An der Leine läuft es schon viel ruhiger.",
        klappt_nicht: searchParams.get("hakt") || "Bei Hundebegegnungen auf engem Weg wird es noch schwierig.",
        neu: searchParams.get("neu") || "",
      };
    }
    if (searchParams.get("up") === "1") {
      const t2 = await teilErstellen(lead, g, 2);
      await ausliefern(lead, g, 6, [t2], true, true);
      return NextResponse.json({ ok: true, dry: true, upgrade: true, an: KOPIE, uebungen: uebungsNamen(t2) });
    }
    const t1 = await teilErstellen(lead, g, 1);
    const texte = [t1];
    // 6 Monate im Testlauf: Teil 2 sprengt die 300 s, daher nur Teil 1 + Hinweis
    const n = await ausliefern(lead, g, monate as 3 | 6, texte, true);
    return NextResponse.json({ ok: true, dry: true, an: KOPIE, pdfs: n, monate, uebungen: uebungsNamen(t1) });
  }

  // ── Normalbetrieb: ältesten offenen Auftrag nehmen ──
  const { data, error } = await (supabase as any)
    .from("wauwerk_leads")
    .select("id, email, customer_name, dog_name, answers")
    .not("answers->verl_bestellt", "is", null)
    .is("answers->>verl_geliefert_at", null)
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const offen = ((data || []) as Lead[])
    .filter((l) => {
      const lock = (l.answers || {}).verl_lock;
      if (Number((l.answers || {}).verl_fehler || 0) >= 3) return false; // nach 3 Fehlversuchen: Hand-Fall
      return !lock || Date.now() - new Date(lock).getTime() > LOCK_MS;
    })
    .sort((x, y) => String(x.answers?.verl_bestellt?.at).localeCompare(String(y.answers?.verl_bestellt?.at)));
  const lead = offen[0];
  if (!lead) return NextResponse.json({ ok: true, nichts_offen: true });

  const a = lead.answers || {};
  const monate: 3 | 6 = a.verl_bestellt?.monate === 6 ? 6 : 3;
  await merge(lead.id, { verl_lock: new Date().toISOString() });

  try {
    const g = await grundlagen(lead);
    if (a.verl_bestellt?.upgrade) {
      const t2 = await teilErstellen(lead, g, 2);
      await ausliefern(lead, g, 6, [t2], false, true);
      await merge(lead.id, { verl_lock: null, verl_geliefert_at: new Date().toISOString() });
      return NextResponse.json({ ok: true, geliefert: lead.id, upgrade: true });
    }
    if (!a.verl_teil1) {
      const t1 = await teilErstellen(lead, g, 1);
      if (monate === 3) {
        await ausliefern(lead, g, 3, [t1], false);
        await merge(lead.id, { verl_teil1: null, verl_lock: null, verl_geliefert_at: new Date().toISOString() });
        return NextResponse.json({ ok: true, geliefert: lead.id, monate });
      }
      await merge(lead.id, { verl_teil1: t1, verl_lock: null });
      return NextResponse.json({ ok: true, teil1_fertig: lead.id, monate });
    }
    const t2 = await teilErstellen(lead, g, 2, a.verl_teil1);
    await ausliefern(lead, g, 6, [a.verl_teil1, t2], false);
    await merge(lead.id, { verl_teil1: null, verl_lock: null, verl_geliefert_at: new Date().toISOString() });
    return NextResponse.json({ ok: true, geliefert: lead.id, monate });
  } catch (e: any) {
    console.error("[verlaengerung-generate] fehlgeschlagen:", lead.id, e?.message);
    await merge(lead.id, { verl_lock: null, verl_fehler: Number(a.verl_fehler || 0) + 1 });
    return NextResponse.json({ error: "fehlgeschlagen", detail: e?.message }, { status: 500 });
  }
}
