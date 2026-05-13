-- ═══════════════════════════════════════════════════════════════════
-- Supabase Security-Advisor Fixes (Stand: aktueller Errors-Tab)
-- Im Supabase Dashboard → SQL Editor ausführen.
--
-- Strategie: RLS aktivieren OHNE neue Policies. Damit:
--   - Public-API-Key kann NICHTS mehr lesen/schreiben (Security gesichert)
--   - Unser Server-Code (alle API-Routes) nutzt SUPABASE_SERVICE_ROLE,
--     der umgeht RLS komplett — wir bleiben fully funktional.
-- ═══════════════════════════════════════════════════════════════════

-- ── 6× RLS-Disabled-Tabellen ────────────────────────────────────────
ALTER TABLE public.arbeitserlaubnis_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp_leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_cache             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upsell_schedule       ENABLE ROW LEVEL SECURITY;

-- ── 2× Security Definer Views fix ───────────────────────────────────
-- SECURITY DEFINER auf einer View bedeutet: View läuft mit den Rechten
-- des Erstellers (oft postgres/admin) — Public bekommt darüber Zugriff
-- auf Daten die er sonst nicht sehen dürfte. Fix: SECURITY INVOKER
-- (View läuft mit den Rechten des Aufrufers).
ALTER VIEW public.referral_tracking SET (security_invoker = true);
ALTER VIEW public.referral_summary  SET (security_invoker = true);
