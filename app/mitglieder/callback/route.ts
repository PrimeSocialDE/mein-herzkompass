// Magic-Link-Callback. Supabase schickt User hierhin nach Klick auf den Link.
// 1. Code aus URL → in Session tauschen
// 2. Profil sicherstellen (Auto-Match gegen wauwerk_leads)
// 3. Redirect zu Dashboard (oder zu redirect-Param falls gesetzt)

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getOrCreateMemberProfile } from "@/lib/member-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/mitglieder";

  if (!code) {
    return NextResponse.redirect(`${origin}/mitglieder/login?error=no_code`);
  }

  let response = NextResponse.redirect(`${origin}${next}`);

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

  const { error: exErr, data } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr || !data?.user) {
    return NextResponse.redirect(
      `${origin}/mitglieder/login?error=${encodeURIComponent(exErr?.message || "exchange_failed")}`
    );
  }

  // Profil sicherstellen (mit Auto-Match aus wauwerk_leads)
  try {
    await getOrCreateMemberProfile({
      userId: data.user.id,
      email: data.user.email || "",
    });
  } catch (e) {
    console.error("[mitglieder/callback] getOrCreateMemberProfile error:", e);
    // Profil-Anlage fehlgeschlagen → trotzdem redirect, Dashboard zeigt Fallback
  }

  return response;
}
