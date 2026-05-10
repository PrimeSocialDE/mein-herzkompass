// Auth-Callback. Unterstützt zwei Flows damit Magic-Link auf jedem
// Geraet zuverlaessig funktioniert:
//
// 1. token_hash + type (UNSER Magic-Link-Flow via auth-hook)
//    → server-seitig via verifyOtp, KEIN PKCE-Verifier noetig,
//      funktioniert auch wenn User Mail auf anderem Geraet oeffnet
//
// 2. code (PKCE Fallback fuer Default-Supabase-Mail oder OAuth)
//    → exchangeCodeForSession, braucht code_verifier in Cookies
//      (nur same-device)
//
// Nach erfolgreicher Verifikation: Profil sicherstellen, dann
// Redirect zu 'next' (Default /mitglieder).

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getOrCreateMemberProfile } from "@/lib/member-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/mitglieder";

  // Pre-built response — Cookies werden vom Supabase-Client gesetzt
  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // ── Pfad 1: token_hash (Magic Link aus unserer auth-hook Mail) ──
  if (tokenHash && typeParam) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: typeParam,
    });
    if (error || !data?.user) {
      console.error(
        "[mitglieder/callback] verifyOtp fehlgeschlagen:",
        error?.message
      );
      return NextResponse.redirect(
        `${origin}/mitglieder/login?error=${encodeURIComponent(
          error?.message?.includes("expired")
            ? "link_abgelaufen"
            : "verify_failed"
        )}`
      );
    }
    try {
      await getOrCreateMemberProfile({
        userId: data.user.id,
        email: data.user.email || "",
      });
    } catch (e) {
      console.error("[mitglieder/callback] profil setup fail:", e);
    }
    return response;
  }

  // ── Pfad 2: code (PKCE Fallback fuer Default-Supabase-Mail / OAuth) ──
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data?.user) {
      console.error(
        "[mitglieder/callback] exchangeCodeForSession fehlgeschlagen:",
        error?.message
      );
      return NextResponse.redirect(
        `${origin}/mitglieder/login?error=${encodeURIComponent(
          error?.message || "exchange_failed"
        )}`
      );
    }
    try {
      await getOrCreateMemberProfile({
        userId: data.user.id,
        email: data.user.email || "",
      });
    } catch (e) {
      console.error("[mitglieder/callback] profil setup fail:", e);
    }
    return response;
  }

  // Weder token_hash noch code → fehlerhafter Aufruf
  return NextResponse.redirect(
    `${origin}/mitglieder/login?error=fehlende_parameter`
  );
}
