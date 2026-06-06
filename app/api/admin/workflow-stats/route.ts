import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

// Liefert die aggregierten Workflow-Statistiken fuer das Admin-Dashboard:
//  - Versandzahlen aus Supabase (wauwerk_leads.answers)
//      Kaeufer:   answers.email_sequence_sent[]  (enthaelt Mail-Nummern 2..9)
//      Recovery:  answers.warm_recovery_stageN_sent_at
//  - Open-/Klickrate pro Mail aus Brevo (aggregatedReport je Tag)
//      Kaeufer:   email-seq-2 .. email-seq-9
//      Recovery:  stage-1 .. stage-5
//
// Auth: Passwort im Request-Body (gleiches wie das Admin-Frontend).

const ADMIN_PASS = process.env.ADMIN_PASSWORD || "pfoten2024";
const BUYER_MAILS = [2, 3, 4, 6, 7, 8, 9];
const RECOVERY_STAGES = [1, 2, 3, 4, 5];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function countContainsMail(num: number): Promise<number> {
  const { count } = await supabase
    .from("wauwerk_leads")
    .select("id", { count: "exact", head: true })
    .contains("answers", { email_sequence_sent: [num] });
  return count || 0;
}

async function countStageSent(stage: number): Promise<number> {
  const { count } = await supabase
    .from("wauwerk_leads")
    .select("id", { count: "exact", head: true })
    .not(`answers->>warm_recovery_stage${stage}_sent_at`, "is", null);
  return count || 0;
}

async function countStatus(status: string): Promise<number> {
  const { count } = await supabase
    .from("wauwerk_leads")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  return count || 0;
}

async function brevoTag(tag: string, startDate: string, endDate: string) {
  const key = process.env.BREVO_API_KEY;
  if (!key) return null;
  try {
    const url = `https://api.brevo.com/v3/smtp/statistics/aggregatedReport?tag=${encodeURIComponent(
      tag
    )}&startDate=${startDate}&endDate=${endDate}`;
    const res = await fetch(url, {
      headers: { "api-key": key, accept: "application/json" },
    });
    if (!res.ok) return { error: `Brevo ${res.status}` };
    const d = await res.json();
    return {
      delivered: d.delivered ?? 0,
      opens: d.opens ?? 0,
      uniqueOpens: d.uniqueOpens ?? 0,
      clicks: d.clicks ?? 0,
      uniqueClicks: d.uniqueClicks ?? 0,
      requests: d.requests ?? 0,
    };
  } catch (e: any) {
    return { error: e?.message || "fetch failed" };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json().catch(() => ({}));
    if (password !== ADMIN_PASS) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const now = new Date();
    const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const startDate = ymd(start);
    const endDate = ymd(now);

    // --- Supabase Versandzahlen (parallel) ---
    const [paidTotal, pendingTotal, failedTotal] = await Promise.all([
      countStatus("paid"),
      countStatus("pending"),
      countStatus("failed"),
    ]);

    const buyerCountsArr = await Promise.all(BUYER_MAILS.map(countContainsMail));
    const recoveryCountsArr = await Promise.all(RECOVERY_STAGES.map(countStageSent));

    const buyerSent: Record<number, number> = {};
    BUYER_MAILS.forEach((n, i) => (buyerSent[n] = buyerCountsArr[i]));
    const recoverySent: Record<number, number> = {};
    RECOVERY_STAGES.forEach((s, i) => (recoverySent[s] = recoveryCountsArr[i]));

    // --- Brevo Open/Klick je Tag (parallel) ---
    const buyerTags = BUYER_MAILS.map((n) => `email-seq-${n}`);
    const recoveryTags = RECOVERY_STAGES.map((s) => `stage-${s}`);
    const allTags = [...buyerTags, ...recoveryTags];
    const brevoResults = await Promise.all(
      allTags.map((t) => brevoTag(t, startDate, endDate))
    );
    const brevo: Record<string, any> = {};
    allTags.forEach((t, i) => (brevo[t] = brevoResults[i]));

    return NextResponse.json({
      range: { startDate, endDate },
      leads: { paid: paidTotal, pending: pendingTotal, failed: failedTotal },
      buyerSent,
      recoverySent,
      brevo,
      brevoConfigured: !!process.env.BREVO_API_KEY,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
