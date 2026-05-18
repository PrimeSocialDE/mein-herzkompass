// GET /api/mitglieder/recovery-redirect?l=<lead_id>&s=<signature>
//
// Evergreen-Login-Link fuer die Checkout-Recovery-Mail. Die Mail bleibt
// ewig klick-bar — bei jedem Klick wird hier ein FRISCHER Supabase-
// Magic-Link generiert (1h gueltig) und auf den redirectet.
//
// Signatur: HMAC-SHA256(lead_id, WORKER_TOKEN).slice(0, 16) — Hex.
// Verhindert dass jemand mit ratenden lead_id-Strings Login-Tokens
// erzeugen kann.

import { NextRequest, NextResponse } from "next/server";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import { timingSafeEqual } from "node:crypto";
import { signRecoveryLead } from "@/lib/recovery-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://www.pfoten-plan.de";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("l") || "";
  const sig = searchParams.get("s") || "";

  if (!leadId || !sig) {
    return NextResponse.redirect(`${SITE_URL}/mitglieder/login`, { status: 303 });
  }

  // Signatur pruefen — timing-safe
  let valid = false;
  try {
    const exp = Buffer.from(signRecoveryLead(leadId), "hex");
    const got = Buffer.from(sig, "hex");
    if (exp.length === got.length) valid = timingSafeEqual(exp, got);
  } catch {}

  if (!valid) {
    return NextResponse.redirect(`${SITE_URL}/mitglieder/login`, { status: 303 });
  }

  // Lead → Email holen
  const admin = createMemberAdminClient();
  const { data: lead } = await admin
    .from("wauwerk_leads")
    .select("email")
    .eq("id", leadId)
    .maybeSingle();

  const email = lead?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.redirect(`${SITE_URL}/mitglieder/login`, { status: 303 });
  }

  // Frischer Magic-Link generieren — User landet direkt eingeloggt im
  // Dashboard. Falls Generation scheitert: Fallback Login-Page mit
  // prefill-Email.
  try {
    let { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${SITE_URL}/mitglieder/callback?next=${encodeURIComponent("/mitglieder?from=recovery")}`,
      },
    });

    if (error || !data?.properties?.hashed_token) {
      // User existiert evtl. noch nicht — anlegen, dann nochmal
      try {
        await admin.auth.admin.createUser({ email, email_confirm: true });
      } catch {
        // race-condition o.ae. — ignore
      }
      ({ data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: `${SITE_URL}/mitglieder/callback?next=${encodeURIComponent("/mitglieder?from=recovery")}`,
        },
      }));
    }

    const hashed = data?.properties?.hashed_token;
    if (!hashed) {
      return NextResponse.redirect(
        `${SITE_URL}/mitglieder/login?email=${encodeURIComponent(email)}`,
        { status: 303 }
      );
    }

    const params = new URLSearchParams({
      token_hash: hashed,
      type: "magiclink",
      next: "/mitglieder?from=recovery",
    });
    return NextResponse.redirect(
      `${SITE_URL}/mitglieder/callback?${params.toString()}`,
      { status: 303 }
    );
  } catch (e: any) {
    console.error("[recovery-redirect] generate-link failed:", e?.message);
    return NextResponse.redirect(
      `${SITE_URL}/mitglieder/login?email=${encodeURIComponent(email)}`,
      { status: 303 }
    );
  }
}
