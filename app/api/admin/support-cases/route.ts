// Dashboard-API für die Support-Fälle (/admin-plan.html, Reiter "Support").
//
// Alles per POST mit Passwort im Body — wie die übrigen Admin-Routen.
// Aktionen: list | send | status | resend_plan

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendeAntwort, type CaseStatus, type SupportCase } from "@/lib/support-cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ADMIN_PASS = process.env.ADMIN_PASSWORD || "pfoten2024";

const STATI: CaseStatus[] = [
  "neu",
  "plankorrektur",
  "rettung_angeboten",
  "gerettet",
  "erstattung",
  "erledigt",
];

async function resendPlan(leadId: string, email: string): Promise<boolean> {
  const workerToken = process.env.WORKER_TOKEN;
  if (!workerToken) return false;
  const rawBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.pfoten-plan.de";
  const baseUrl = rawBase.replace(/^http:\/\//, "https://").replace(/\/+$/, "");
  try {
    const res = await fetch(`${baseUrl}/api/mitglieder/plan/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerToken}` },
      body: JSON.stringify({ lead_id: leadId, email, force: true }),
    });
    const txt = await res.text().catch(() => "");
    let ok = false;
    for (const line of txt.split("\n").filter(Boolean)) {
      try { const o = JSON.parse(line); if (o.event === "done") ok = !!o.ok; } catch {}
    }
    return ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  if (body?.password !== ADMIN_PASS) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const aktion = String(body.action || "list");

  // --- Liste + Kennzahlen ---------------------------------------------------
  if (aktion === "list") {
    const tage = Math.min(Math.max(parseInt(body.tage, 10) || 30, 1), 180);
    const seit = new Date(Date.now() - tage * 86_400_000).toISOString();

    const { data, error } = await supabase
      .from("support_cases")
      .select("*")
      .gte("received_at", seit)
      .order("received_at", { ascending: false })
      .limit(400);

    if (error) {
      // Häufigster Fall beim ersten Aufruf: die Tabelle gibt es noch nicht.
      return NextResponse.json(
        { error: "db_error", detail: error.message, hinweis: "sql/support_cases.sql im Supabase-SQL-Editor ausführen" },
        { status: 500 }
      );
    }

    const faelle = (data || []) as SupportCase[];
    const zaehler: Record<string, number> = {};
    for (const s of STATI) zaehler[s] = 0;
    for (const f of faelle) zaehler[f.status] = (zaehler[f.status] || 0) + 1;

    // Rettungsquote: wie viele Erstattungswünsche konnten gehalten werden.
    const entschieden = (zaehler.gerettet || 0) + (zaehler.erstattung || 0);
    const quote = entschieden > 0 ? Math.round(((zaehler.gerettet || 0) / entschieden) * 100) : null;
    const gerettetCent = faelle
      .filter((f) => f.status === "gerettet")
      .reduce((s, f) => s + (f.betrag_cent || 0), 0);

    return NextResponse.json({
      ok: true,
      tage,
      zaehler,
      offen: (zaehler.neu || 0) + (zaehler.plankorrektur || 0) + (zaehler.rettung_angeboten || 0),
      rettungsquote: quote,
      gerettet_eur: Math.round(gerettetCent / 100),
      faelle,
    });
  }

  // --- Antwort verschicken --------------------------------------------------
  if (aktion === "send") {
    const id = String(body.id || "");
    const text = String(body.text || "").trim();
    if (!id || text.length < 10) {
      return NextResponse.json({ error: "id_oder_text_fehlt" }, { status: 400 });
    }
    const { data: fall } = await supabase.from("support_cases").select("*").eq("id", id).maybeSingle();
    if (!fall) return NextResponse.json({ error: "fall_nicht_gefunden" }, { status: 404 });

    const ok = await sendeAntwort(fall as SupportCase, text);
    if (!ok) return NextResponse.json({ error: "versand_fehlgeschlagen" }, { status: 502 });

    const { data: neu } = await supabase.from("support_cases").select("*").eq("id", id).maybeSingle();
    return NextResponse.json({ ok: true, fall: neu });
  }

  // --- Zustand von Hand setzen ---------------------------------------------
  if (aktion === "status") {
    const id = String(body.id || "");
    const status = String(body.status || "") as CaseStatus;
    if (!id || !STATI.includes(status)) {
      return NextResponse.json({ error: "id_oder_status_ungueltig" }, { status: 400 });
    }
    const jetzt = new Date().toISOString();
    const { data, error } = await supabase
      .from("support_cases")
      .update({
        status,
        erledigt_at: status === "erledigt" ? jetzt : null,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, fall: data });
  }

  // --- Entwurf speichern, ohne zu senden ------------------------------------
  if (aktion === "entwurf") {
    const id = String(body.id || "");
    const text = String(body.text || "");
    if (!id) return NextResponse.json({ error: "id_fehlt" }, { status: 400 });
    const { data, error } = await supabase
      .from("support_cases")
      .update({ entwurf: text })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, fall: data });
  }

  // --- Plan neu ausliefern --------------------------------------------------
  if (aktion === "resend_plan") {
    const id = String(body.id || "");
    const { data: fall } = await supabase.from("support_cases").select("*").eq("id", id).maybeSingle();
    if (!fall?.lead_id) return NextResponse.json({ error: "kein_lead_zum_fall" }, { status: 400 });
    const ok = await resendPlan(fall.lead_id, fall.from_email);
    return NextResponse.json({ ok, hinweis: ok ? "Plan neu ausgelöst" : "Auslösen fehlgeschlagen" });
  }

  return NextResponse.json({ error: "unbekannte_aktion" }, { status: 400 });
}
