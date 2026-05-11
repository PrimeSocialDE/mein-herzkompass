// POST /api/mitglieder/plan/generate
//
// Generiert einen 12-Wochen-Trainingsplan via Claude und speichert in
// member_plan_content (slug "trainingsplan"). Im Mitgliederbereich ist
// er dann sofort sichtbar (TrainingPlanWeekly renderer).
//
// Auth: WORKER_TOKEN als Bearer-Header (gleicher Token wie andere
// internen Endpoints).
//
// Body:
//   {
//     "email": "kunde@example.com"   // ODER
//     "lead_id": "uuid-of-wauwerk-lead",
//     "force": false                  // optional - regeneriert auch wenn
//                                     //   schon ein Plan existiert
//   }
//
// Antwort:
//   {
//     "ok": true,
//     "plan_content_id": "uuid",
//     "usage": { input_tokens, output_tokens, estimated_cost_usd },
//     "duration_ms": 12345
//   }

import { NextRequest, NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import {
  generateTrainingPlan,
  planLengthFromSelectedPlan,
} from "@/lib/plan-generator";
import { getLatestPlanContent } from "@/lib/member-plan-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // Claude kann ~30-60s brauchen fuer 12 Wochen

const PROBLEM_LABELS: Record<string, string> = {
  pulling: "Leinenziehen",
  barking: "übermäßiges Bellen",
  aggression: "Aggression in Begegnungen",
  anxiety: "Trennungsangst",
  jumping: "Anspringen von Menschen",
  recall: "unzuverlässiger Rückruf",
  energy: "zu viel Energie",
  destructive: "Zerstörungsverhalten",
  soiling: "Stubenunreinheit",
  mouthing: "Aufnehmen vom Boden",
};

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") || "";
  const sentToken = (authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || authHeader)
    .trim();
  const expected = (process.env.WORKER_TOKEN || "").trim();
  if (!expected || sentToken !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const leadId = String(body?.lead_id || "").trim();
  const force = !!body?.force;
  // Optional: Plan-Länge ueberschreiben (1/3/6). Wenn nicht gesetzt → aus
  // lead.selected_plan ableiten.
  const overrideMonths =
    body?.plan_length_months &&
    [1, 3, 6].includes(Number(body.plan_length_months))
      ? (Number(body.plan_length_months) as 1 | 3 | 6)
      : null;

  if (!email && !leadId) {
    return NextResponse.json(
      { error: "email oder lead_id ist Pflicht" },
      { status: 400 }
    );
  }

  const admin = createMemberAdminClient();
  const startedAt = Date.now();

  // ── 1) Lead-Daten holen ────────────────────────────────────────────
  let leadQuery = admin
    .from("wauwerk_leads")
    .select(
      "id, email, customer_name, dog_name, answers, status, selected_plan, created_at"
    );
  if (leadId) leadQuery = leadQuery.eq("id", leadId);
  else leadQuery = leadQuery.ilike("email", email).order("created_at", { ascending: false }).limit(1);

  const { data: lead, error: leadErr } = await leadQuery.maybeSingle();
  if (leadErr || !lead) {
    return NextResponse.json(
      { error: "Lead nicht gefunden", details: leadErr?.message },
      { status: 404 }
    );
  }

  const targetEmail = (lead.email || email).toLowerCase();
  const answers = (lead.answers || {}) as Record<string, any>;

  // ── 2) Quiz-Daten extrahieren ─────────────────────────────────────
  const dogName = lead.dog_name || answers.dog_name || "deinem Hund";
  const dogProblem =
    answers.dog_problem || answers.problem || answers.main_problem || null;

  if (!dogProblem) {
    return NextResponse.json(
      {
        error:
          "Kein dog_problem im Lead gefunden — Quiz-Antwort fehlt. Plan kann nicht generiert werden.",
      },
      { status: 400 }
    );
  }

  // ── 3) Schon ein Plan da? (skip wenn nicht force) ─────────────────
  if (!force) {
    // user_id lookup ueber member_users
    const { data: existingMember } = await admin
      .from("member_users")
      .select("id")
      .ilike("email", targetEmail)
      .maybeSingle();
    const userId = (existingMember as any)?.id || null;

    // Prüfen ob schon Plan-Content da ist
    if (userId) {
      const existing = await getLatestPlanContent(
        userId,
        targetEmail,
        "trainingsplan"
      );
      if (existing) {
        return NextResponse.json({
          ok: false,
          error: "skipped_existing",
          message:
            "Plan existiert bereits. Setze force=true um neu zu generieren.",
          existing_plan_id: existing.id,
          existing_created_at: existing.created_at,
        });
      }
    }
  }

  // ── 4) Generator-Input zusammenstellen ────────────────────────────
  const bekannteSignale: string[] = Array.isArray(answers.dog_commands)
    ? answers.dog_commands
    : Array.isArray(answers.bekannte_signale)
      ? answers.bekannte_signale
      : [];

  const trainingszeit =
    typeof answers.trainingszeit_minuten === "number"
      ? answers.trainingszeit_minuten
      : typeof answers.daily_training_minutes === "number"
        ? answers.daily_training_minutes
        : 15;

  // Zusatzkontext: alles weitere aus answers das relevant sein könnte
  const zusatzKontextLines: string[] = [];
  if (answers.dog_energy) zusatzKontextLines.push(`Energielevel: ${answers.dog_energy}`);
  if (answers.haushalt) zusatzKontextLines.push(`Haushalt: ${answers.haushalt}`);
  if (answers.kinder_im_haushalt) zusatzKontextLines.push(`Kinder im Haushalt: ja`);
  if (answers.weitere_hunde) zusatzKontextLines.push(`Weitere Hunde: ja`);

  // Plan-Länge: explizit ueberschrieben ODER aus selected_plan ableiten
  const planLengthMonths =
    overrideMonths || planLengthFromSelectedPlan(lead.selected_plan);

  // ── 5) Plan generieren ─────────────────────────────────────────────
  const result = await generateTrainingPlan({
    dog_name: dogName,
    dog_breed: answers.dog_breed || null,
    dog_age: answers.dog_age || null,
    dog_size: answers.dog_size || null,
    dog_problem: dogProblem,
    dog_problem_label: PROBLEM_LABELS[dogProblem],
    bekannte_signale: bekannteSignale,
    trainingszeit_minuten: trainingszeit,
    zusatz_kontext:
      zusatzKontextLines.length > 0 ? zusatzKontextLines.join("\n") : undefined,
    plan_length_months: planLengthMonths,
  });

  if (!result.ok || !result.plan) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error || "Generation fehlgeschlagen",
        raw_response: result.raw_response?.slice(0, 500),
      },
      { status: 500 }
    );
  }

  // ── 6) In member_plan_content speichern ───────────────────────────
  // user_id lookup nochmal (falls Member zwischenzeitlich angelegt)
  const { data: memberAfter } = await admin
    .from("member_users")
    .select("id")
    .ilike("email", targetEmail)
    .maybeSingle();
  const finalUserId = (memberAfter as any)?.id || null;

  const planTitle = `${planLengthMonths}-Monats-Trainingsplan für ${dogName}`;

  const { data: inserted, error: insErr } = await admin
    .from("member_plan_content")
    .insert({
      user_id: finalUserId,
      email: targetEmail,
      plan_slug: "trainingsplan",
      plan_title: planTitle,
      content: result.plan,
      pdf_url: null,
      dog_name: dogName,
      dog_breed: answers.dog_breed || null,
      source: "claude-internal",
      source_payment_id: lead.id,
    })
    .select("id, created_at")
    .single();

  if (insErr) {
    return NextResponse.json(
      {
        ok: false,
        error: "Insert in member_plan_content fehlgeschlagen",
        details: insErr.message,
        plan_was_generated: true, // Wichtig: Plan ist NICHT verloren falls
        plan: result.plan,         //   der User es trotzdem braucht
      },
      { status: 500 }
    );
  }

  // ── 7) "Plan ist fertig"-Mail (fire-and-forget) ───────────────────
  // SAFEGUARD gegen Brevo-Flood:
  //   - Mail wird nur EINMAL pro Plan-Generierung versendet (= EINMAL pro
  //     neuem member_plan_content-Row Insert). Da der Endpoint oben bei
  //     existierendem Plan ohne force fruehzeitig returnt, kann hier
  //     keine Doppel-Versendung passieren.
  //   - Mollie-Webhook ist idempotent (processed_payment_ids check),
  //     selbst wenn Mollie retried wird kein zweiter Generate-Call abgesetzt.
  //   - Kein Auto-Retry bei Brevo-Fehler — wenn die Mail scheitert, scheitert
  //     sie. Kein Loop.
  //   - Opt-outs: ?no_mail=1 im Body ODER env DISABLE_PLAN_READY_EMAIL=1
  const skipMail =
    !!body?.no_mail || process.env.DISABLE_PLAN_READY_EMAIL === "1";
  if (!skipMail) {
    import("@/lib/member-mail")
      .then((m) =>
        m.sendPlanReadyEmail({
          to: targetEmail,
          dogName,
          planLengthMonths,
          plan: result.plan!,
          customerName: lead.customer_name || null,
        })
      )
      .then((r) => {
        if (!r.ok) {
          console.warn("[plan/generate] mail not sent:", r.reason);
        }
      })
      .catch((e) =>
        console.error("[plan/generate] mail error:", e?.message)
      );
  }

  return NextResponse.json({
    ok: true,
    plan_content_id: (inserted as any).id,
    created_at: (inserted as any).created_at,
    usage: result.usage,
    duration_ms: Date.now() - startedAt,
    user_id_matched: !!finalUserId,
    weeks_count: result.plan.weeks.length,
    plan_length_months: planLengthMonths,
  });
}
