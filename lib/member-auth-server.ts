// Server-only Auth-Helpers. Niemals von Client Components importieren!
// Browser-Client ist in lib/member-auth.ts (Browser-only).
//
// Verwendung:
//   • createMemberServerClient() — in Route Handlers / Server Components
//   • createMemberAdminClient()  — Service-Role-bypass für privilegierte Ops
//   • getCurrentMember()         — aktuellen User aus der Session holen

import "server-only";
import { createServerClient as createServerSupabase } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

export async function createMemberServerClient() {
  const cookieStore = await cookies();
  return createServerSupabase(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components dürfen nicht setzen → Middleware übernimmt das
        }
      },
    },
  });
}

export function createMemberAdminClient() {
  if (!SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_SERVICE_ROLE nicht gesetzt");
  }
  return createPlainClient(
    process.env.SUPABASE_URL || SUPABASE_URL,
    SUPABASE_SERVICE_ROLE,
    { auth: { persistSession: false } }
  );
}

export async function getCurrentMember() {
  const supabase = await createMemberServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
