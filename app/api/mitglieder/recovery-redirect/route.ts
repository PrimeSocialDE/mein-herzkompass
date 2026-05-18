// GET /api/mitglieder/recovery-redirect?l=<lead_id>&s=<signature>
//
// Evergreen-Login fuer die Checkout-Recovery-Mail. Die Mail bleibt
// ewig klick-bar — bei jedem Klick wird HIER server-side ein frischer
// Magic-Link erzeugt UND sofort verifiziert. Cookies werden in dieser
// Route gesetzt. Anschliessend Redirect ins Dashboard, bereits eingeloggt.
//
// Vorher gab es bei dem Pfad ein Race-Issue: die Route generierte einen
// hashed_token + redirectete zu /mitglieder/callback?token_hash=...
// Wenn dazwischen mehrere Sekunden Browser-Latenz lagen ODER der Browser
// den Token in der History cachte und nochmal triggerte (Single-Use),
// kam die Login-Page mit "Link abgelaufen" zurueck.
//
// Jetzt: Token wird hier erzeugt UND hier konsumiert (Microsekunden
// dazwischen). Plus Cookies werden via createServerClient gesetzt.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { timingSafeEqual } from "node:crypto";
import { signRecoveryLead } from "@/lib/recovery-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://www.pfoten-plan.de";
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

function loginFallbackUrl(email?: string): string {
  const u = new URL(`${SITE_URL}/mitglieder/login`);
  if (email) u.searchParams.set("email", email);
  u.searchParams.set("from", "recovery");
  return u.toString();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("l") || "";
  const sig = searchParams.get("s") || "";

  if (!leadId || !sig) {
    return NextResponse.redirect(loginFallbackUrl(), { status: 303 });
  }

  // Signatur pruefen — timing-safe
  let valid = false;
  try {
    const exp = Buffer.from(signRecoveryLead(leadId), "hex");
    const got = Buffer.from(sig, "hex");
    if (exp.length === got.length) valid = timingSafeEqual(exp, got);
  } catch {}
  if (!valid) {
    return NextResponse.redirect(loginFallbackUrl(), { status: 303 });
  }

  // Lead → Email holen
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: lead } = await admin
    .from("wauwerk_leads")
    .select("email")
    .eq("id", leadId)
    .maybeSingle();

  const email = (lead?.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.redirect(loginFallbackUrl(), { status: 303 });
  }

  // Stelle sicher dass Auth-User existiert (idempotent)
  try {
    await admin.auth.admin.createUser({ email, email_confirm: true });
  } catch {
    // existiert schon — ignore
  }

  // Frischen Magic-Link generieren — KEIN redirectTo da wir hier sofort
  // selbst verifizieren. Type 'magiclink' (compatible mit existing
  // auth-hook in dieser Codebase).
  let hashedToken: string | null = null;
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    hashedToken = data?.properties?.hashed_token || null;
    if (error) {
      console.error(
        "[recovery-redirect] generateLink error:",
        error.message
      );
    }
  } catch (e: any) {
    console.error("[recovery-redirect] generateLink exception:", e?.message);
  }
  if (!hashedToken) {
    return NextResponse.redirect(loginFallbackUrl(email), { status: 303 });
  }

  // Response vorbereiten — Cookies werden waehrend verifyOtp gesetzt
  const response = NextResponse.redirect(
    `${SITE_URL}/mitglieder?from=recovery`,
    { status: 303 }
  );

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // SOFORT verifizieren — Microsekunden seit generateLink, kein Race-Issue.
  // Probieren beide types — manche Supabase-Versionen erwarten 'email',
  // andere 'magiclink' fuer admin-generierte Tokens.
  let verifyError: string | null = null;
  let verified = false;
  for (const type of ["magiclink", "email"] as const) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: hashedToken,
      type: type as any,
    });
    if (!error && data?.user) {
      verified = true;
      break;
    }
    verifyError = error?.message || verifyError;
    // Bei "Token has expired" gar nicht erst den 2. Type probieren
    if (error?.message?.includes("expired") || error?.message?.includes("used")) {
      break;
    }
  }

  if (!verified) {
    console.error(
      "[recovery-redirect] verifyOtp fehlgeschlagen:",
      verifyError,
      "email=",
      email
    );
    return NextResponse.redirect(loginFallbackUrl(email), { status: 303 });
  }

  return response;
}
