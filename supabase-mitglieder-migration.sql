-- ===========================================================================
-- MITGLIEDERBEREICH-MIGRATION — STRICT ADDITIV
-- Erstellt 5 NEUE member_-Tabellen + RLS-Policies. Bestehende Tabellen
-- (wauwerk_leads, orders, referral_rewards usw.) werden NICHT angetastet.
-- Im Supabase-Dashboard: SQL Editor → "+ New query" → einfügen → Run
-- ('Run and enable RLS' wählen)
-- ===========================================================================

-- ── 1) member_users ────────────────────────────────────────────────────────
-- Verknüpft 1:1 mit auth.users (Supabase Auth). Quiz-Daten werden bei der
-- ersten Registrierung aus wauwerk_leads übernommen (Email-Match), aber
-- wauwerk_leads bleibt als Single-Source-of-Truth.
CREATE TABLE IF NOT EXISTS public.member_users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL,
  name            text,
  dog_name        text,
  dog_breed       text,
  quiz_result     jsonb DEFAULT '{}'::jsonb,
  purchase_status text NOT NULL DEFAULT 'free' CHECK (purchase_status IN ('free','paid','abo')),
  purchased_at    timestamptz,
  -- Verlinkung zur Quiz-Lead-Row (read-only Snapshot)
  source_lead_id  uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_users_email ON public.member_users (lower(email));

-- ── 2) member_modules ──────────────────────────────────────────────────────
-- Globaler Modul-Katalog (von Admin gepflegt). Content als JSONB für
-- flexible Section-Strukturen (text, video, image, exercise).
CREATE TABLE IF NOT EXISTS public.member_modules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  title             text NOT NULL,
  description       text,
  content           jsonb NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  order_index       int NOT NULL DEFAULT 0,
  is_free           boolean NOT NULL DEFAULT false,
  -- Drip: nach wievielen Tagen post-purchase wird's freigeschaltet
  unlock_after_days int NOT NULL DEFAULT 0,
  -- Multi-Tenant-Vorbereitung (z.B. 'pfoten-plan', 'wauwerk', etc.)
  product_type      text NOT NULL DEFAULT 'pfoten-plan',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_modules_product_order
  ON public.member_modules (product_type, order_index);

-- ── 3) member_progress ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.member_progress (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.member_users(id) ON DELETE CASCADE,
  module_id   uuid NOT NULL REFERENCES public.member_modules(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'available' CHECK (status IN ('locked','available','in_progress','completed')),
  started_at  timestamptz,
  completed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_member_progress_user ON public.member_progress (user_id);

-- ── 4) member_upsells ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.member_upsells (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,
  title        text NOT NULL,
  description  text,
  price_cents  int NOT NULL,
  module_ids   uuid[] DEFAULT '{}',
  badge_text   text,
  is_active    boolean NOT NULL DEFAULT true,
  product_type text NOT NULL DEFAULT 'pfoten-plan',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_upsells_active
  ON public.member_upsells (product_type, is_active);

-- ── 5) member_purchases ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.member_purchases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.member_users(id) ON DELETE CASCADE,
  upsell_id        uuid REFERENCES public.member_upsells(id) ON DELETE SET NULL,
  amount_cents     int NOT NULL,
  payment_provider text NOT NULL DEFAULT 'mollie',
  payment_id       text NOT NULL,
  status           text NOT NULL DEFAULT 'paid',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_purchases_user ON public.member_purchases (user_id);

-- ===========================================================================
-- RLS POLICIES — User sieht NUR eigene Daten, Module/Upsells public-read
-- ===========================================================================

ALTER TABLE public.member_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_modules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_upsells   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_purchases ENABLE ROW LEVEL SECURITY;

-- member_users: User darf nur eigenes Profil lesen + ändern
DROP POLICY IF EXISTS member_users_self_select ON public.member_users;
CREATE POLICY member_users_self_select ON public.member_users
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS member_users_self_update ON public.member_users;
CREATE POLICY member_users_self_update ON public.member_users
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- member_modules: jeder authentifizierte User darf alle Module SEHEN
-- (Detail-Content wird server-seitig je nach purchase_status geschnitten)
DROP POLICY IF EXISTS member_modules_public_select ON public.member_modules;
CREATE POLICY member_modules_public_select ON public.member_modules
  FOR SELECT TO authenticated USING (true);

-- member_progress: nur eigener Fortschritt
DROP POLICY IF EXISTS member_progress_self_all ON public.member_progress;
CREATE POLICY member_progress_self_all ON public.member_progress
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- member_upsells: alle aktiven Upsells public-read
DROP POLICY IF EXISTS member_upsells_active_select ON public.member_upsells;
CREATE POLICY member_upsells_active_select ON public.member_upsells
  FOR SELECT TO authenticated USING (is_active = true);

-- member_purchases: nur eigene Käufe sehen
DROP POLICY IF EXISTS member_purchases_self_select ON public.member_purchases;
CREATE POLICY member_purchases_self_select ON public.member_purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ===========================================================================
-- Sanity-Check (optional nach Run):
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public' AND table_name LIKE 'member_%';
-- ===========================================================================
