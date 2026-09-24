// Holt zu einer E-Mail die Hunde-Angaben aus dem Fragebogen zurueck.
//
// Warum ueberhaupt serverseitig: die Charakterprofil-Seite koennte mit dem
// oeffentlichen Anon-Key selbst in wauwerk_leads schauen. Dann stuende die
// Abfrage aber offen im Quelltext und liesse sich beliebig gegen fremde
// Adressen laufen. Hier liegt sie hinter dem Service-Role-Key, gibt nur drei
// Felder heraus und ist pro IP gedrosselt.
//
// Bewusst NICHT herausgegeben: E-Mail, Kaufhistorie, Freitexte, lead_id.
// Ein Treffer verraet nur: zu dieser Adresse gibt es einen Hund mit Namen X
// und Rasse Y. Mehr braucht die Seite nicht.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Drossel: pro IP 12 Abfragen je 10 Minuten. Der Speicher lebt nur so lange
// wie die Lambda-Instanz, bremst Massenabfragen aus einer Quelle aber
// spuerbar. Gegen ein verteiltes Durchprobieren hilft er nicht — dafuer
// waere ein zentraler Zaehler noetig.
const FENSTER_MS = 10 * 60 * 1000;
const MAX_PRO_FENSTER = 12;
const zaehler = new Map<string, { n: number; bis: number }>();

function drosselGreift(ip: string): boolean {
  const jetzt = Date.now();
  const e = zaehler.get(ip);
  if (!e || jetzt > e.bis) {
    zaehler.set(ip, { n: 1, bis: jetzt + FENSTER_MS });
    return false;
  }
  e.n += 1;
  return e.n > MAX_PRO_FENSTER;
}

export async function POST(req: NextRequest) {
  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email || "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ gefunden: false }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
    return NextResponse.json({ gefunden: false });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unbekannt";

  if (drosselGreift(ip)) {
    // Bewusst dieselbe Antwort wie "nichts gefunden": wer durchprobiert,
    // soll nicht merken, ab wann er gebremst wird.
    return NextResponse.json({ gefunden: false });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Neuester Eintrag zu der Adresse, der ueberhaupt Angaben enthaelt.
    const { data } = await supabase
      .from("wauwerk_leads")
      .select("dog_name, answers, created_at")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(8);

    if (!data || !data.length) return NextResponse.json({ gefunden: false });

    let dogName = "";
    let dogBreed = "";
    let dogGender = "";
    for (const zeile of data as any[]) {
      const a = (zeile?.answers || {}) as Record<string, any>;
      if (!dogName) dogName = String(zeile?.dog_name || a.dog_name || "").trim();
      if (!dogBreed) dogBreed = String(a.dog_breed || "").trim();
      if (!dogGender) dogGender = String(a.dog_gender || "").trim();
      if (dogName && dogBreed && dogGender) break;
    }

    if (!dogName && !dogBreed) return NextResponse.json({ gefunden: false });

    return NextResponse.json({
      gefunden: true,
      dog_name: dogName.slice(0, 40),
      dog_breed: dogBreed.slice(0, 60),
      dog_gender: dogGender === "female" ? "female" : dogGender === "male" ? "male" : "",
    });
  } catch (e: any) {
    console.warn("[charakterprofil/lead-lookup]", e?.message);
    return NextResponse.json({ gefunden: false });
  }
}
