// app/api/cron/paket-drip/route.ts
//
// Taegliche Zustellung der Paket-Module. Jeder Paket-Kunde bekommt pro Tag
// EIN Themen-Modul, in der Reihenfolge, die /api/paket/deliver nach seinen
// Fragebogen-Angaben festgelegt hat.
//
// Warum nicht alles sofort: dreizehn Mails in einer Minute sehen aus wie
// Spam, landen im Zweifel im Junk und niemand arbeitet sie ab. Ein Thema
// pro Tag ist die Zustellung UND das Produkt.
//
//   ?secret=...   Pflicht
//   ?dry=1        zeigt nur, wer dran waere
//   ?lead=<uuid>  nur diesen Lead (fuer Support)
//
// Schedule: einmal taeglich, siehe vercel.json

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";
const ABSTAND_STUNDEN = 20; // Sicherheitsabstand, damit nie zwei am Tag rausgehen
const MAX_PRO_LAUF = 60;

function basisUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.pfoten-plan.de"
  ).replace(/\/+$/, "");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = searchParams.get("dry") === "1";
  const nurLead = searchParams.get("lead");

  let abfrage: any = supabase
    .from("wauwerk_leads")
    .select("id, email, dog_name, answers")
    .not("answers->paket_queue", "is", null)
    .order("id", { ascending: true })
    .limit(MAX_PRO_LAUF * 3);
  if (nurLead) abfrage = abfrage.eq("id", nurLead);

  const { data, error } = await abfrage;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Lead = {
    id: string;
    email: string | null;
    dog_name: string | null;
    answers: Record<string, any> | null;
  };
  const leads = (data || []) as Lead[];

  const jetzt = Date.now();
  const faellig = leads.filter((l) => {
    const a = l.answers || {};
    const queue: string[] = Array.isArray(a.paket_queue) ? a.paket_queue : [];
    if (!queue.length || !l.email) return false;
    if (nurLead) return true; // Support-Trigger ignoriert den Abstand
    const letzte = a.paket_letzte_lieferung ? new Date(a.paket_letzte_lieferung).getTime() : 0;
    return jetzt - letzte >= ABSTAND_STUNDEN * 3600000;
  }).slice(0, MAX_PRO_LAUF);

  if (dry) {
    return NextResponse.json({
      ok: true,
      modus: "DRY-RUN",
      paket_kunden: leads.length,
      heute_faellig: faellig.length,
      beispiel: faellig[0]
        ? {
            email: faellig[0].email,
            hund: faellig[0].dog_name,
            naechstes: (faellig[0].answers?.paket_queue || [])[0],
            offen: (faellig[0].answers?.paket_queue || []).length,
          }
        : null,
    });
  }

  const base = basisUrl();
  let ok = 0, err = 0, fertig = 0;

  for (const l of faellig) {
    const a = l.answers || {};
    const queue: string[] = Array.isArray(a.paket_queue) ? [...a.paket_queue] : [];
    const modul = queue.shift();
    if (!modul) continue;

    try {
      const r = await fetch(`${base}/api/zusatzmodul/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: l.email,
          dogName: (l.dog_name || "").trim() || undefined,
          moduleKey: modul,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      ok++;
    } catch (e: any) {
      err++;
      console.error(`[paket-drip] ${l.email} / ${modul}:`, e?.message);
      continue; // Queue unveraendert lassen, morgen neuer Versuch
    }

    // Frisch lesen und mergen, damit parallele Schreiber nicht clobbern
    const { data: fresh } = await supabase
      .from("wauwerk_leads")
      .select("answers")
      .eq("id", l.id)
      .maybeSingle();
    const basis = (((fresh as any)?.answers as any) || a) as Record<string, any>;
    const geliefert: string[] = Array.isArray(basis.paket_geliefert) ? basis.paket_geliefert : [];
    if (!queue.length) fertig++;

    await supabase
      .from("wauwerk_leads")
      .update({
        answers: {
          ...basis,
          paket_queue: queue.length ? queue : null,
          paket_geliefert: [...geliefert, modul],
          paket_letzte_lieferung: new Date().toISOString(),
          ...(queue.length ? {} : { paket_abgeschlossen_at: new Date().toISOString() }),
        },
      })
      .eq("id", l.id);
  }

  return NextResponse.json({
    ok: true,
    modus: "LIVE",
    gesendet: ok,
    fehler: err,
    paket_abgeschlossen: fertig,
    faellig: faellig.length,
  });
}
