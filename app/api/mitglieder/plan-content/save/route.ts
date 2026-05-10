// POST /api/mitglieder/plan-content/save
//
// Append-only: jeder Aufruf legt eine NEUE Zeile in member_plan_content an.
// Niemals UPDATE/DELETE — alte Inhalte bleiben fuer immer abrufbar.
//
// Gedacht fuer Make.com / generate-*.mjs Worker:
// Nach jeder PDF-Generierung wird die strukturierte JSON hierher gepusht,
// damit der Inhalt auch in der App unter /mitglieder/modul/[slug] sichtbar ist.
//
// Auth: WORKER_TOKEN als Bearer-Header (gleicher Token wie /api/worker/generate).
//
// Body (JSON):
//   {
//     "email": "kunde@example.com",      REQUIRED
//     "plan_slug": "ernaehrung",         REQUIRED — slug-key fuer den Plan-Typ
//     "plan_title": "Ernaehrungsplan fuer Buddy",  optional
//     "content": { ... }                 REQUIRED — die Claude-JSON-Struktur
//     "pdf_url": "https://.../buddy.pdf" optional — wenn PDF im Bucket liegt
//     "dog_name": "Buddy",               optional
//     "dog_breed": "Labrador",           optional
//     "source": "make.com",              optional
//     "source_payment_id": "tr_xxx"      optional — Mollie payment id
//   }

import { NextRequest, NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // ── Auth-Check ────────────────────────────────────────────────────
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body?.email || "")
    .trim()
    .toLowerCase();
  const plan_slug = String(body?.plan_slug || "").trim();
  const content = body?.content;

  if (!email) {
    return NextResponse.json(
      { error: "email is required" },
      { status: 400 }
    );
  }
  if (!plan_slug) {
    return NextResponse.json(
      { error: "plan_slug is required" },
      { status: 400 }
    );
  }
  if (!content || typeof content !== "object") {
    return NextResponse.json(
      { error: "content (jsonb object) is required" },
      { status: 400 }
    );
  }

  const admin = createMemberAdminClient();

  // ── Optional: user_id via email matchen ───────────────────────────
  let user_id: string | null = null;
  try {
    const { data: u } = await admin
      .from("member_users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    user_id = (u as any)?.id || null;
  } catch {
    // Wenn Match scheitert, geht's ohne user_id weiter — der Email-Match
    // im Renderer faengt es spaeter ab.
  }

  // ── INSERT (niemals UPDATE) ───────────────────────────────────────
  const insertData: Record<string, any> = {
    user_id,
    email,
    plan_slug,
    plan_title: body?.plan_title || null,
    content,
    pdf_url: body?.pdf_url || null,
    dog_name: body?.dog_name || null,
    dog_breed: body?.dog_breed || null,
    source: body?.source || "external",
    source_payment_id: body?.source_payment_id || null,
  };

  const { data, error } = await admin
    .from("member_plan_content")
    .insert(insertData)
    .select("id, created_at")
    .single();

  if (error) {
    console.error("[plan-content/save] insert failed:", error);
    return NextResponse.json(
      { error: error.message || "Insert failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: (data as any).id,
    created_at: (data as any).created_at,
    user_id_matched: !!user_id,
  });
}
