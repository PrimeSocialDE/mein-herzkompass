// One-Tap-Login-Endpoint.
//
// Ein signierter, tagelang gueltiger, WIEDERVERWENDBARER Link (siehe
// lib/one-tap-login.ts) loggt den Kunden direkt ein — ohne 6-stelligen Code,
// ohne Minuten-Ablauf, ohne dass ein E-Mail-Scanner den Token verbrennt.
//
// Ablauf: Signatur pruefen → serverseitig frische Supabase-Session erzeugen
// (admin.generateLink 'magiclink' → verifyOtp mit dem hashed_token) → Session-
// Cookies auf die Redirect-Response setzen → ab ins Dashboard.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { verifyOneTap } from "@/lib/one-tap-login";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import { getOrCreateMemberProfile } from "@/lib/member-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const eB64 = searchParams.get("e") || "";
  const exp = searchParams.get("exp") || "";
  const sig = searchParams.get("sig") || "";
  const nextRaw = searchParams.get("next") || "/mitglieder";
  const next = nextRaw.startsWith("/") ? nextRaw : "/mitglieder";

  const loginErr = (code: string) =>
    NextResponse.redirect(
      `${origin}/mitglieder/login?error=${encodeURIComponent(code)}`
    );

  const ok = verifyOneTap(eB64, exp, sig);
  if (!ok) return loginErr("link_ungueltig");
  const email = ok.email;

  // 1) Sicherstellen, dass der Auth-User existiert (idempotent).
  const admin = createMemberAdminClient();
  try {
    await admin.auth.admin.createUser({ email, email_confirm: true });
  } catch {
    // existiert schon → ignorieren
  }

  // 2) Magic-Link-Token serverseitig erzeugen (kein Mailversand, wir nutzen nur
  //    den hashed_token direkt zum Session-Tausch).
  const { data: linkData, error: genErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = (linkData as any)?.properties?.hashed_token;
  if (genErr || !tokenHash) {
    console.error(
      "[one-tap] generateLink fehlgeschlagen:",
      genErr?.message || "kein hashed_token"
    );
    return loginErr("login_fehlgeschlagen");
  }

  // 3) Token gegen eine echte Session tauschen; Cookies auf die Redirect-
  //    Response setzen (gleiches Muster wie /mitglieder/callback).
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

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (error || !data?.user) {
    console.error("[one-tap] verifyOtp fehlgeschlagen:", error?.message);
    return loginErr("login_fehlgeschlagen");
  }

  try {
    await getOrCreateMemberProfile({
      userId: data.user.id,
      email: data.user.email || email,
    });
  } catch (e) {
    console.error("[one-tap] profil setup fail:", e);
  }

  return response;
}
