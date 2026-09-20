// app/api/paket/deliver/route.ts
//
// Auslieferung des Komplettpakets "Alles fuer <Hund>" (99 EUR).
//
// Das Paket buendelt, was es einzeln schon gibt (Einzelwert ueber 200 EUR).
// Wir schicken NICHT alles auf einmal: 13 Mails in einer Minute sehen aus wie
// Spam und ueberfordern die Zielgruppe. Stattdessen:
//   sofort  -> Willkommensmail + Charakterprofil + Notfall-Karten
//   taeglich-> ein Themen-Modul, sortiert nach dem, was der Halter im
//              Fragebogen selbst angegeben hat (siehe /api/cron/paket-drip)
//
// Body: { leadId?, email, dogName?, force? }
// Auth: Bearer WORKER_TOKEN

import { NextResponse } from "next/server";
import { after } from "next/server";
import { supabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const WORKER_TOKEN = (process.env.WORKER_TOKEN || "").trim();
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";

// Alle Module, die /api/zusatzmodul/send kennt. Reihenfolge = Standard,
// wird pro Kunde nach seinen eigenen Angaben umsortiert.
const ALLE_MODULE = [
  "pulling", "energy", "recall", "aggression", "barking", "mouthing",
  "anxiety", "jumping", "destructive", "soiling", "freilauf", "lebensretter",
] as const;

const MODUL_LABEL: Record<string, string> = {
  pulling: "Leinenführigkeit",
  energy: "Energie und Ruhe",
  recall: "Rückruf",
  aggression: "Hundebegegnungen",
  barking: "Bellen",
  mouthing: "Nichts vom Boden aufnehmen",
  anxiety: "Alleinbleiben",
  jumping: "Anspringen",
  destructive: "Zerstören in der Wohnung",
  soiling: "Stubenreinheit",
  freilauf: "Freilauf",
  lebensretter: "Die 10 Sicherheits-Kommandos",
};

function basisUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.pfoten-plan.de"
  ).replace(/\/+$/, "");
}

// Reihenfolge nach Relevanz: erst das Hauptthema, dann was er sonst
// angekreuzt hat, dann der Rest. So kommt Tag 1 direkt das, wofuer er
// urspruenglich gekauft hat.
export function moduleReihenfolge(answers: Record<string, any>): string[] {
  const haupt = String(answers?.dog_problem || "");
  const weitere: string[] = Array.isArray(answers?.dog_behaviors)
    ? answers.dog_behaviors.map((b: any) => String(b))
    : [];
  const schonGehabt: string[] = Array.isArray(answers?.zusatzmodul_sent)
    ? answers.zusatzmodul_sent.map((m: any) => String(m))
    : [];

  const sortiert: string[] = [];
  const dazu = (k: string) => {
    if (ALLE_MODULE.includes(k as any) && !sortiert.includes(k)) sortiert.push(k);
  };
  dazu(haupt);
  weitere.forEach(dazu);
  ALLE_MODULE.forEach(dazu);

  // Module, die der Kunde frueher schon einzeln gekauft hat, ans Ende —
  // doppelt schicken waere unnoetig, weglassen aber auch falsch, weil das
  // Paket sie enthaelt.
  return [
    ...sortiert.filter((m) => !schonGehabt.includes(m)),
    ...sortiert.filter((m) => schonGehabt.includes(m)),
  ];
}

function willkommenHtml(dog: string, ersteThemen: string[]): string {
  const p = "margin:0 0 16px;font-size:16px;line-height:1.7;";
  const liste = ersteThemen
    .map((t, i) => `<li style="margin:0 0 6px;">Tag ${i + 1}: ${t}</li>`)
    .join("");
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:#FFF9F0;border:1px solid #EADDC5;border-radius:14px;padding:24px">
    <h1 style="font-size:22px;margin:0 0 6px;color:#1a1a1a">Alles für ${dog} ist unterwegs</h1>
    <p style="${p}">Danke dir. Du bekommst jetzt nicht dreizehn Mails auf einmal, sondern der Reihe nach, damit ihr das auch wirklich umsetzen könnt.</p>
    <p style="${p}"><strong>Gleich im Postfach:</strong> das Charakterprofil für ${dog} und die Notfall-Karten zum Ausdrucken.</p>
    <p style="margin:0 0 8px;font-size:16px;font-weight:700;">Ab morgen täglich ein Thema, angefangen mit deinem:</p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:15.5px;line-height:1.7;color:#4B5563">${liste}</ul>
    <p style="${p}">Insgesamt zwölf Themen. Jedes ist ein eigener kleiner Plan mit acht Übungen.</p>
    <p style="margin:0;font-size:14px;color:#6B7280;">Fragen? Antworte einfach auf diese Mail, es liest ein echter Mensch.</p>
  </div>
</div>`;
}

export async function POST(request: Request) {
  try {
    const auth = request.headers.get("authorization") || "";
    const token = (auth.match(/^Bearer\s+(.+)$/i)?.[1] || auth).trim();
    if (!WORKER_TOKEN || token !== WORKER_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const leadId = String(body?.leadId || "").trim();
    const force = body?.force === true;
    let email = String(body?.email || "").trim();
    let dogName = String(body?.dogName || "").slice(0, 40);

    let answers: Record<string, any> = {};
    if (leadId) {
      const { data: lead } = await supabase
        .from("wauwerk_leads")
        .select("email,dog_name,answers")
        .eq("id", leadId)
        .maybeSingle();
      if (lead) {
        answers = ((lead as any).answers || {}) as Record<string, any>;
        email = email || String((lead as any).email || "");
        dogName = dogName || String((lead as any).dog_name || "");
        if (answers.paket_gekauft_at && !force) {
          return NextResponse.json({
            ok: true,
            skipped: "already_delivered",
            at: answers.paket_gekauft_at,
          });
        }
      }
    }
    if (!email) return NextResponse.json({ error: "email fehlt" }, { status: 400 });
    const dog = dogName || "deinen Hund";

    const reihenfolge = moduleReihenfolge(answers);
    const base = basisUrl();

    // ── Sofort: Charakterprofil (dauert ~2,5 Min, laeuft nebenher) ──
    after(async () => {
      try {
        const r = await fetch(`${base}/api/charakterprofil/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${WORKER_TOKEN}`,
          },
          body: JSON.stringify({ leadId, email, dogName: dogName || undefined }),
        });
        console.log(`[paket] charakterprofil ${email}: HTTP ${r.status}`);
      } catch (e: any) {
        console.error("[paket] charakterprofil fehlgeschlagen:", e?.message);
      }
    });

    // ── Sofort: Notfall-Karten (statisches PDF, schnell) ────────────
    try {
      const r = await fetch(`${base}/api/notfall-karten/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, dogName: dogName || undefined }),
      });
      console.log(`[paket] notfall-karten ${email}: HTTP ${r.status}`);
    } catch (e: any) {
      console.error("[paket] notfall-karten fehlgeschlagen:", e?.message);
    }

    // ── Willkommensmail ────────────────────────────────────────────
    if (BREVO_API_KEY) {
      const ersteThemen = reihenfolge.slice(0, 4).map((m) => MODUL_LABEL[m] || m);
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
          to: [{ email }],
          cc: [{ email: "kontakt@primesocial.de" }],
          subject: `Alles für ${dog}: los geht's`,
          htmlContent: willkommenHtml(dog, ersteThemen),
        }),
      }).catch((e) => console.error("[paket] Willkommensmail:", e?.message));
    }

    // ── Warteschlange fuer den Tages-Drip ──────────────────────────
    if (leadId) {
      const { data: fresh } = await supabase
        .from("wauwerk_leads")
        .select("answers")
        .eq("id", leadId)
        .maybeSingle();
      await supabase
        .from("wauwerk_leads")
        .update({
          answers: {
            ...(((fresh as any)?.answers as any) || answers),
            paket_gekauft_at: new Date().toISOString(),
            paket_queue: reihenfolge,
            paket_letzte_lieferung: new Date().toISOString(),
          },
        })
        .eq("id", leadId);
    }

    return NextResponse.json({ ok: true, module_geplant: reihenfolge.length, reihenfolge });
  } catch (err: any) {
    console.error("[paket/deliver] error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Interner Fehler" }, { status: 500 });
  }
}
