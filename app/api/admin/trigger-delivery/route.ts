// Admin-Trigger zum manuellen Auslösen von Plan- und Zusatzmodul-Versand
// fuer eine spezifische Email. Macht das gleiche wie die zwei Crons,
// aber ohne Zeit-Filter und sofort.
//
// Auth: Authorization: Bearer <WORKER_TOKEN>  ODER  ?token=<WORKER_TOKEN>
//
// Body / Query:
//   email: string  (required)
//   force: boolean (optional, ueberschreibt Idempotenz-Markers)
//
// Aufruf:
//   curl -X POST "https://www.pfoten-plan.de/api/admin/trigger-delivery" \
//     -H "Authorization: Bearer $WORKER_TOKEN" \
//     -H "Content-Type: application/json" \
//     -d '{"email": "kunde@example.de"}'
//
// Was passiert:
//   1) Lead per Email holen
//   2) Wenn status=paid → /api/mitglieder/plan/generate (Hauptplan)
//   3) Wenn upsell_module gesetzt → /api/zusatzmodul/send (pro Modul-Key)

import { NextRequest } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TRAININGS_MODULE_KEYS = new Set([
  "pulling", "energy", "anxiety", "aggression", "mouthing",
  "recall", "barking", "jumping", "destructive", "soiling",
]);

function extractModuleKeys(lead: any): string[] {
  const all = new Set<string>();
  // DB-Spalten: upsell_module, upsell_2, upsell_prevention
  for (const col of ["upsell_module", "upsell_2", "upsell_prevention"]) {
    const v = lead[col];
    if (typeof v === "string" && v.trim()) all.add(v.trim());
  }
  const expanded = new Set<string>();
  for (const m of all) {
    if (m.includes("+")) {
      for (const part of m.split("+")) expanded.add(part.trim());
    } else {
      expanded.add(m);
    }
  }
  return [...expanded].filter((k) => TRAININGS_MODULE_KEYS.has(k));
}

function checkAuth(req: NextRequest): boolean {
  const token = process.env.WORKER_TOKEN;
  if (!token) return false;
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${token}`) return true;
  const q = req.nextUrl.searchParams.get("token");
  return q === token;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = (body.email || req.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
  const force = !!(body.force || req.nextUrl.searchParams.get("force"));
  if (!email) return Response.json({ error: "email fehlt" }, { status: 400 });

  const admin = createMemberAdminClient();

  // Lead holen
  const { data: lead, error } = await admin
    .from("wauwerk_leads")
    .select("id, email, dog_name, status, paid_at, upsell_module, upsell_2, upsell_prevention, answers")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !lead) {
    return Response.json({ error: `Lead nicht gefunden: ${email}` }, { status: 404 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.pfoten-plan.de";
  const workerToken = process.env.WORKER_TOKEN!;

  const result: any = {
    email,
    lead_id: lead.id,
    status: lead.status,
    paid_at: lead.paid_at,
    upsell_module: lead.upsell_module,
    upsell_2: (lead as any).upsell_2,
    upsell_prevention: (lead as any).upsell_prevention,
    actions: [] as any[],
  };

  // 1) Hauptplan triggern wenn status=paid
  if (lead.status === "paid") {
    try {
      const res = await fetch(`${baseUrl}/api/mitglieder/plan/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${workerToken}`,
        },
        body: JSON.stringify({ lead_id: lead.id, email: lead.email, force }),
      });
      const txt = await res.text();
      let finalEvt: any = null;
      for (const line of txt.split("\n").filter(Boolean)) {
        try {
          const obj = JSON.parse(line);
          if (obj.event === "done") finalEvt = obj;
        } catch {}
      }
      result.actions.push({
        type: "hauptplan",
        http: res.status,
        ok: finalEvt?.ok ?? res.ok,
        plan_id: finalEvt?.plan_content_id,
        error: finalEvt?.error,
      });
    } catch (e: any) {
      result.actions.push({ type: "hauptplan", ok: false, error: e?.message });
    }
  } else {
    result.actions.push({
      type: "hauptplan",
      skipped: true,
      reason: `status="${lead.status}" (kein paid)`,
    });
  }

  // 2) Zusatzmodule triggern
  const moduleKeys = extractModuleKeys(lead);
  if (moduleKeys.length === 0) {
    result.actions.push({
      type: "zusatzmodule",
      skipped: true,
      reason: "kein upsell_module gesetzt",
    });
  } else {
    for (const moduleKey of moduleKeys) {
      try {
        const res = await fetch(`${baseUrl}/api/zusatzmodul/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: lead.email,
            dogName: lead.dog_name || "deinen Hund",
            moduleKey,
            force,
          }),
        });
        const data = await res.json().catch(() => ({}));
        result.actions.push({
          type: "zusatzmodul",
          moduleKey,
          http: res.status,
          ok: data?.ok ?? res.ok,
          skipped: data?.skipped || false,
          error: data?.error,
        });
      } catch (e: any) {
        result.actions.push({
          type: "zusatzmodul",
          moduleKey,
          ok: false,
          error: e?.message,
        });
      }
    }
  }

  return Response.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
