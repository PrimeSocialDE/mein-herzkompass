// Klick-Route für Kampagnen-Links: vermerkt den Klick am Lead und leitet weiter.
//
// Warum: SES-Klicks landen nicht in unserer Datenbank. Für die Montags-
// Erinnerung der Silvester-Kampagne müssen wir aber wissen, wer am Sonntag
// geklickt hat (answers.kampagne_<k>_klick_at).
//
// GET /api/kampagne/klick?l=<lead_id>&k=<kürzel>&u=<pfad>
//   k: nur bekannte Kürzel (KUERZEL), sonst wird nichts vermerkt
//   u: nur Pfade auf unserer eigenen Seite (beginnt mit "/", kein "//"),
//      sonst Weiterleitung auf die Startseite. Kein offener Redirect.
// Die Weiterleitung passiert immer, auch wenn das Vermerken scheitert.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KUERZEL = new Set(["sv"]);
const BASIS = "https://www.pfoten-plan.de";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lead = String(searchParams.get("l") || "");
  const k = String(searchParams.get("k") || "");
  const u = String(searchParams.get("u") || "/");
  const ziel = u.startsWith("/") && !u.startsWith("//") && !u.includes("\\") ? BASIS + u : BASIS + "/";

  if (KUERZEL.has(k) && UUID.test(lead)) {
    try {
      const feld = `kampagne_${k}_klick_at`;
      const { data } = await supabase.from("wauwerk_leads").select("answers").eq("id", lead).maybeSingle();
      const a = ((data?.answers as any) || null) as Record<string, any> | null;
      // Nur den ersten Klick festhalten, ein erneuter Klick schreibt nicht.
      if (a && !a[feld]) {
        await supabase.from("wauwerk_leads").update({ answers: { ...a, [feld]: new Date().toISOString() } }).eq("id", lead);
      }
    } catch (e: any) {
      console.warn("[kampagne/klick] Vermerken fehlgeschlagen:", e?.message);
    }
  }
  return NextResponse.redirect(ziel, 302);
}
