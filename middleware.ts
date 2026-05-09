// Middleware schützt /mitglieder/* Routes — ausser Login/Callback.
// Nicht-eingeloggte User werden zu /mitglieder/login redirected.
// Außerdem werden hier Auth-Cookies refreshed (Standard @supabase/ssr-Pattern).

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const PUBLIC_PATHS = [
  "/mitglieder/login",
  "/mitglieder/callback",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Nur /mitglieder/* schützen — Rest unverändert durchlassen
  if (!pathname.startsWith("/mitglieder")) {
    return NextResponse.next();
  }

  // Public-Paths (Login, Callback) brauchen keinen Auth-Check
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  let response = NextResponse.next({ request });

  // ENV nicht da → ohne Check durchlassen (kein Crash)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Nicht eingeloggt + nicht-public Pfad → zu Login
  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/mitglieder/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Eingeloggt + auf Login-Page → direkt zum Dashboard
  if (user && pathname === "/mitglieder/login") {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/mitglieder";
    dashUrl.search = "";
    return NextResponse.redirect(dashUrl);
  }

  return response;
}

export const config = {
  matcher: ["/mitglieder/:path*"],
};
