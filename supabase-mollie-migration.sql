-- ===========================================================================
-- Mollie-Migration — STRICT ADDITIV, überschreibt KEINE bestehenden Daten
-- ===========================================================================
-- Im Supabase-Dashboard: SQL Editor → "+ New query" → Inhalt einfügen → Run
-- Kann gefahrlos mehrfach ausgeführt werden (alles ist IF NOT EXISTS).
-- Stripe-Spalten (stripe_session_id, stripe_payment_intent) bleiben unangetastet.
-- ---------------------------------------------------------------------------

-- 1) wauwerk_leads: Mollie-Tracking-Spalten
ALTER TABLE public.wauwerk_leads
  ADD COLUMN IF NOT EXISTS mollie_payment_id        text,
  ADD COLUMN IF NOT EXISTS mollie_upsell_payment_id text,
  ADD COLUMN IF NOT EXISTS payment_provider         text;

-- 2) orders: Mollie-Tracking-Spalten
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS mollie_payment_id text,
  ADD COLUMN IF NOT EXISTS payment_provider  text;

-- 3) Indizes für schnelle Webhook-Lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_wauwerk_leads_mollie_payment_id
  ON public.wauwerk_leads (mollie_payment_id)
  WHERE mollie_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_mollie_payment_id
  ON public.orders (mollie_payment_id)
  WHERE mollie_payment_id IS NOT NULL;

-- 4) Optional: trainer_hilfe_anfragen vorbereiten (falls später migriert wird)
--    Trainer-Hilfe-Flow ist NICHT Teil dieser Migration — Spalte schon mal anlegen
--    schadet aber nicht, dann muss man's später nicht nochmal machen.
ALTER TABLE public.trainer_hilfe_anfragen
  ADD COLUMN IF NOT EXISTS mollie_payment_id text,
  ADD COLUMN IF NOT EXISTS payment_provider  text;

-- ===========================================================================
-- Sanity-Check (kannst du nach dem Run laufen lassen, ändert nichts):
-- ===========================================================================
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'wauwerk_leads'
--    AND column_name LIKE 'mollie%' OR column_name = 'payment_provider';
