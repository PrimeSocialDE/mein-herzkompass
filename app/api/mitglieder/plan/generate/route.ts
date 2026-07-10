// POST /api/mitglieder/plan/generate
//
// Generiert einen 1/3/6-Monats-Trainingsplan via Claude und speichert in
// member_plan_content (slug "trainingsplan"). Im Mitgliederbereich ist
// er dann sofort sichtbar (TrainingPlanWeekly renderer).
//
// STREAMING-RESPONSE (NDJSON, Content-Type: application/x-ndjson):
//   Während Claude arbeitet, sendet der Server alle 5s eine Keepalive-Zeile.
//   Damit bleiben Cloudflare/Vercel-Proxies die Connection alive (sonst 504).
//   Am Ende: eine Zeile mit {"event":"done", ...result}.
//
// Auth: WORKER_TOKEN als Bearer-Header.
//
// Body:
//   {
//     "email": "kunde@example.com",       // ODER
//     "lead_id": "uuid-of-wauwerk-lead",
//     "force": false,
//     "plan_length_months": 1 | 3 | 6,    // optional - sonst aus lead.selected_plan
//     "no_mail": false                    // optional - skip welcome mail
//   }
//
// Stream-Events (alle als NDJSON, eine pro Zeile):
//   {"event":"start","stage":"loading_lead"}
//   {"event":"ping","ts":1234567890}                  (alle 5s)
//   {"event":"stage","stage":"generating"}
//   {"event":"done","ok":true,"plan_content_id":"...","usage":{...}}
//   {"event":"done","ok":false,"error":"..."}

import { NextRequest } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import {
  generateTrainingPlan,
  planLengthFromSelectedPlan,
} from "@/lib/plan-generator";
import { getLatestPlanContent } from "@/lib/member-plan-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Pro-Plan: bis 300s erlaubt

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

interface StreamCtx {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
}

function emit(ctx: StreamCtx, payload: any) {
  try {
    ctx.controller.enqueue(ctx.encoder.encode(JSON.stringify(payload) + "\n"));
  } catch {
    // Connection might be closed already — silent
  }
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") || "";
  const sentToken = (authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || authHeader)
    .trim();
  const expected = (process.env.WORKER_TOKEN || "").trim();
  if (!expected || sentToken !== expected) {
    return new Response(
      JSON.stringify({ event: "done", ok: false, error: "Unauthorized" }) + "\n",
      { status: 401, headers: { "Content-Type": "application/x-ndjson" } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ event: "done", ok: false, error: "Invalid JSON" }) + "\n",
      { status: 400, headers: { "Content-Type": "application/x-ndjson" } }
    );
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const leadId = String(body?.lead_id || "").trim();
  const force = !!body?.force;
  const overrideMonths =
    body?.plan_length_months &&
    [1, 3, 6].includes(Number(body.plan_length_months))
      ? (Number(body.plan_length_months) as 1 | 3 | 6)
      : null;
  const skipMail =
    !!body?.no_mail || process.env.DISABLE_PLAN_READY_EMAIL === "1";
  // recipientOverride: schickt Plan-Ready-Mail an diese Email statt an
  // den Lead-Email. Nur fuer Admin-Tests (z.B. PDFs an support-Adresse
  // schicken zur Verifikation, statt an den echten Kunden).
  const recipientOverride = String(body?.recipient_override || "").trim().toLowerCase();

  if (!email && !leadId) {
    return new Response(
      JSON.stringify({
        event: "done",
        ok: false,
        error: "email oder lead_id ist Pflicht",
      }) + "\n",
      { status: 400, headers: { "Content-Type": "application/x-ndjson" } }
    );
  }

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const ctx: StreamCtx = { controller, encoder };

      // Keepalive: alle 5s ein Ping damit Cloudflare/Vercel-Proxy nicht schliessen
      const keepalive = setInterval(() => {
        emit(ctx, { event: "ping", ts: Date.now() });
      }, 5000);

      try {
        emit(ctx, { event: "start", stage: "loading_lead" });

        // ── 1) Lead-Daten ──────────────────────────────────────────
        const admin = createMemberAdminClient();
        let leadQuery = admin
          .from("wauwerk_leads")
          .select(
            "id, email, customer_name, dog_name, answers, status, selected_plan, created_at"
          );
        if (leadId) leadQuery = leadQuery.eq("id", leadId);
        else
          leadQuery = leadQuery
            .ilike("email", email)
            .order("created_at", { ascending: false })
            .limit(1);

        const { data: lead, error: leadErr } = await leadQuery.maybeSingle();
        if (leadErr || !lead) {
          emit(ctx, {
            event: "done",
            ok: false,
            error: "Lead nicht gefunden",
            details: leadErr?.message,
          });
          return;
        }

        const targetEmail = (lead.email || email).toLowerCase();
        const answers = (lead.answers || {}) as Record<string, any>;
        const dogName = lead.dog_name || answers.dog_name || "deinem Hund";
        const dogProblem =
          answers.dog_problem || answers.problem || answers.main_problem || null;

        if (!dogProblem) {
          emit(ctx, {
            event: "done",
            ok: false,
            error: "Kein dog_problem im Lead — Plan-Generierung nicht möglich",
          });
          return;
        }

        // ── 2) Existierender Plan? ─────────────────────────────────
        if (!force) {
          const { data: existingMember } = await admin
            .from("member_users")
            .select("id")
            .ilike("email", targetEmail)
            .maybeSingle();
          const userId = (existingMember as any)?.id || null;
          if (userId) {
            const existing = await getLatestPlanContent(
              userId,
              targetEmail,
              "trainingsplan"
            );
            if (existing) {
              emit(ctx, {
                event: "done",
                ok: false,
                error: "skipped_existing",
                existing_plan_id: existing.id,
                existing_created_at: existing.created_at,
              });
              return;
            }
          }
        }

        // ── 3) Plan-Länge bestimmen ────────────────────────────────
        const planLengthMonths =
          overrideMonths || planLengthFromSelectedPlan(lead.selected_plan);

        // ── 4) Input fuer Generator ────────────────────────────────
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
        const zusatzKontextLines: string[] = [];
        if (answers.dog_energy)
          zusatzKontextLines.push(`Energielevel: ${answers.dog_energy}`);

        emit(ctx, {
          event: "stage",
          stage: "composing",
          months: planLengthMonths,
          weeks: planLengthMonths * 4,
        });

        // ── 5) Plan zusammenbauen — Composer aus Übungs-Bibliothek ─
        // Geschwindigkeit: <50ms (rein deterministisch). Optional kommt
        // dann noch eine KI-personalisierte Einleitung (Haiku, ~3-5s).
        // ── Sprach-Weiche ─────────────────────────────────────────
        // Default "de" -> deutsche Dateien (unveraendert). "pl" laedt die
        // duplizierten polnischen Bausteine. lang kommt aus answers.lang
        // (wird im PL-Checkout gesetzt). Literale Import-Pfade, damit der
        // Bundler beide Varianten sauber aufloest.
        const planLang = (answers as any)?.lang === "pl" ? "pl" : "de";
        let composePlan: typeof import("@/lib/plan-composer").composePlan;
        let generatePersonalizedIntro: typeof import("@/lib/plan-intro-ai").generatePersonalizedIntro;
        let problemLabelMap: Record<string, string>;
        if (planLang === "pl") {
          ({ composePlan } = await import("@/lib/plan-composer.pl"));
          ({ generatePersonalizedIntro } = await import("@/lib/plan-intro-ai.pl"));
          problemLabelMap = (await import("@/lib/exercise-library.pl"))
            .PROBLEM_LABELS_PL as Record<string, string>;
        } else {
          ({ composePlan } = await import("@/lib/plan-composer"));
          ({ generatePersonalizedIntro } = await import("@/lib/plan-intro-ai"));
          problemLabelMap = (await import("@/lib/exercise-library"))
            .PROBLEM_LABELS_DE as Record<string, string>;
        }

        // Parse dog_age zu Monaten (best effort: "2 Jahre" / "6 Monate")
        function parseAgeToMonths(s: any): number | undefined {
          if (typeof s !== "string") return undefined;
          const num = parseFloat(s.replace(/[^0-9.,]/g, "").replace(",", "."));
          if (isNaN(num)) return undefined;
          if (/monat/i.test(s)) return Math.round(num);
          if (/jahr/i.test(s)) return Math.round(num * 12);
          return Math.round(num);
        }

        const validProblemKey =
          ["pulling", "barking", "aggression", "anxiety", "recall",
           "energy", "jumping", "destructive", "soiling", "mouthing"]
            .includes(dogProblem) ? dogProblem : "pulling";

        const problemLabel = problemLabelMap[validProblemKey] || dogProblem;

        // KI-Intro generieren (parallel zum Compose-Job)
        const customProblemText =
          typeof answers.custom_problem_text === "string" &&
          answers.custom_problem_text.trim().length > 0
            ? answers.custom_problem_text.trim()
            : undefined;
        const introPromise = generatePersonalizedIntro({
          dogName,
          dogBreed: answers.dog_breed || undefined,
          dogAgeMonths: parseAgeToMonths(answers.dog_age),
          problemLabel,
          planLengthMonths,
          zusatzKontext: zusatzKontextLines.join("\n") || undefined,
          customProblemText,
        });

        const introResult = await introPromise;
        emit(ctx, {
          event: "stage",
          stage: "intro_generated",
          ai_intro_ms: introResult.ms,
          ai_intro_ok: !!introResult.einleitung,
          ai_ziele_ok: !!introResult.ziele,
          ai_abschluss_ok: !!introResult.abschluss,
        });

        const plan = composePlan({
          problem: validProblemKey,
          planLengthMonths,
          dog: {
            dogName,
            dogBreed: answers.dog_breed || undefined,
            dogAgeMonths: parseAgeToMonths(answers.dog_age),
            dogSize: answers.dog_size || undefined,
            dogGender: answers.dog_gender || undefined,
            trainingsZeitMinuten: trainingszeit,
            bekannteSignale,
          },
          introText: introResult.einleitung || undefined,
          zieleText: introResult.ziele || undefined,
          abschlussText: introResult.abschluss || undefined,
          customProblemText,
        });

        const result = {
          ok: true as const,
          plan,
          usage: {
            input_tokens: 0,
            output_tokens: 0,
            estimated_cost_usd: introResult.einleitung ? 0.01 : 0,
            ms: introResult.ms,
          },
        };

        emit(ctx, { event: "stage", stage: "saving" });

        // ── 6) Speichern ───────────────────────────────────────────
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
          emit(ctx, {
            event: "done",
            ok: false,
            error: "Insert in member_plan_content fehlgeschlagen",
            details: insErr.message,
          });
          return;
        }

        // ── 7) Mail (fire-and-forget, idempotent — siehe Brevo-Flood-Schutz) ─
        if (!skipMail) {
          emit(ctx, { event: "stage", stage: "sending_mail" });
          try {
            const { sendPlanReadyEmail } = await import("@/lib/member-mail");
            const mailRes = await sendPlanReadyEmail({
              to: recipientOverride || targetEmail,
              dogName,
              dogBreed: answers.dog_breed || null,
              dogAge: answers.dog_age || null,
              mainProblem: PROBLEM_LABELS[dogProblem] || dogProblem || null,
              planLengthMonths,
              plan: result.plan,
              customerName: lead.customer_name || null,
              lang: planLang,
            });
            emit(ctx, {
              event: "stage",
              stage: "mail_sent",
              ok: mailRes.ok,
              reason: mailRes.reason,
            });
          } catch (e: any) {
            console.error("[plan/generate] mail error:", e?.message);
            emit(ctx, {
              event: "stage",
              stage: "mail_failed",
              error: e?.message,
            });
          }
        }

        // ── 8) Initial-Challenges seeden (proaktiv, ab Tag 1) ─────────
        // Erzeugt Auth-User + Member-Profil + erste Wochen-Challenges.
        // Triggert intern auch die Welcome-Challenges-Mail. Idempotent.
        emit(ctx, { event: "stage", stage: "seeding_challenges" });
        try {
          const { seedInitialChallengesForEmail } = await import(
            "@/lib/seed-initial-challenges"
          );
          const seedRes = await seedInitialChallengesForEmail(targetEmail);
          emit(ctx, {
            event: "stage",
            stage: "challenges_seeded",
            ok: seedRes.ok,
            count: seedRes.challenges_count,
            reason: seedRes.reason,
          });
        } catch (e: any) {
          console.error("[plan/generate] seed-challenges error:", e?.message);
          emit(ctx, {
            event: "stage",
            stage: "challenges_seed_failed",
            error: e?.message,
          });
        }

        // ── 8) Final ───────────────────────────────────────────────
        emit(ctx, {
          event: "done",
          ok: true,
          plan_content_id: (inserted as any).id,
          created_at: (inserted as any).created_at,
          usage: result.usage,
          duration_ms: Date.now() - startedAt,
          user_id_matched: !!finalUserId,
          weeks_count: result.plan.weeks.length,
          plan_length_months: planLengthMonths,
        });
      } catch (e: any) {
        console.error("[plan/generate] fatal:", e?.message);
        emit(ctx, {
          event: "done",
          ok: false,
          error: e?.message || "Unbekannter Fehler",
        });
      } finally {
        clearInterval(keepalive);
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
