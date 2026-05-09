// Auth-Helpers für den Mitgliederbereich.
// Nutzt @supabase/ssr für Cookie-basierte Sessions in Next.js App Router.
//
// Drei verschiedene Clients je nach Kontext:
//   • createBrowserClient()  — im Frontend (Client Components, "use client")
//   • createServerClient()   — in Route Handlers / Server Components
//   • createAdminClient()    — Service-Role-bypass für Server-side Schreib-Ops
//
// PUBLIC-ENV nötig:
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
// (zusätzlich zu den server-only SUPABASE_URL / SUPABASE_SERVICE_ROLE)

import {
  createBrowserClient as createBrowserSupabase,
  createServerClient as createServerSupabase,
} from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

// ── Browser (Client Components) ─────────────────────────────────────────────
export function createMemberBrowserClient() {
  return createBrowserSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ── Server (Route Handlers, Server Components, Middleware) ──────────────────
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

// ── Admin (Service-Role bypass RLS, nur server-side) ────────────────────────
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

// ── Hilfsfunktion: aktuellen User holen (Server) ────────────────────────────
export async function getCurrentMember() {
  const supabase = await createMemberServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
