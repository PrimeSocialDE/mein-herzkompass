-- ===========================================================================
-- Referral-Migration — STRICT ADDITIV, überschreibt KEINE bestehenden Daten
-- ===========================================================================
-- Im Supabase-Dashboard: SQL Editor → "+ New query" → Inhalt einfügen → Run
-- Kann gefahrlos mehrfach ausgeführt werden (alles ist IF NOT EXISTS).
-- ---------------------------------------------------------------------------

-- 1) wauwerk_leads: Referral-Tracking-Spalten
--    referral_code:       eindeutiger Code, den ein paid Lead an Freunde weiterschickt
--    referred_by_code:    Code, mit dem dieser Lead von einem Empfehler kam
ALTER TABLE public.wauwerk_leads
  ADD COLUMN IF NOT EXISTS referral_code     text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_code  text;

-- 2) Tabelle für Belohnungen (1 Eintrag = 1 Coupon den ein Empfehler einlösen kann)
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Wer kriegt den Reward?
  referrer_lead_id uuid         NOT NULL REFERENCES public.wauwerk_leads(id) ON DELETE CASCADE,
  referrer_email  text          NOT NULL,
  -- Welcher neue Kauf hat den Reward ausgelöst?
  referred_lead_id uuid         NOT NULL REFERENCES public.wauwerk_leads(id) ON DELETE CASCADE,
  referred_email  text          NOT NULL,
  -- Coupon zum Einlösen (per Email an Empfehler geschickt)
  redeem_code     text          NOT NULL UNIQUE,
  status          text          NOT NULL DEFAULT 'pending', -- pending | redeemed | expired
  -- Welches Modul wurde nach Einlösung gewählt?
  redeemed_module text,
  redeemed_at     timestamptz,
  -- Audit
  created_at      timestamptz   NOT NULL DEFAULT now()
);

-- 3) Indizes für schnelle Lookups
CREATE INDEX IF NOT EXISTS idx_wauwerk_leads_referral_code
  ON public.wauwerk_leads (referral_code)
  WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wauwerk_leads_referred_by_code
  ON public.wauwerk_leads (referred_by_code)
  WHERE referred_by_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_rewards_redeem_code
  ON public.referral_rewards (redeem_code);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer_lead_id
  ON public.referral_rewards (referrer_lead_id);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_status
  ON public.referral_rewards (status);

-- ===========================================================================
-- Sanity-Check (kannst du nach dem Run laufen lassen, ändert nichts):
-- ===========================================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='wauwerk_leads'
--    AND column_name IN ('referral_code','referred_by_code');
-- SELECT count(*) FROM public.referral_rewards;  -- sollte 0 sein nach Run
