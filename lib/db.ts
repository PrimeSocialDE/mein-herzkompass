import { createClient } from "@supabase/supabase-js";

// Verbindung zur Datenbank (Backend-only!)
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);