// Browser-only Auth-Helper. Keine Server-Imports!
// Server-Helpers sind in lib/member-auth-server.ts (cookies, admin client).

import { createBrowserClient as createBrowserSupabase } from "@supabase/ssr";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export function createMemberBrowserClient() {
  return createBrowserSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
}
