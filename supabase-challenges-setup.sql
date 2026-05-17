-- ════════════════════════════════════════════════════════════════════
-- Challenge-System: Tabelle member_user_challenges
-- ════════════════════════════════════════════════════════════════════
--
-- Das Wochen-Challenge-System (lib/member-challenges.ts) erwartet
-- diese Tabelle. Ohne sie failen alle Reads silent → "Diese Woche
-- keine neue Aufgabe" auf der Challenge-Page, obwohl der Code zeitlich
-- 4 Templates picken wuerde.
--
-- Einmalig im Supabase SQL Editor ausfuehren. Idempotent.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.member_user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_slug TEXT NOT NULL,
  challenge_title TEXT NOT NULL,
  challenge_description TEXT NOT NULL,
  problem_match TEXT,
  target_sessions INT NOT NULL DEFAULT 3,
  sessions_done INT NOT NULL DEFAULT 0,
  badge_emoji TEXT NOT NULL,
  badge_label TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, challenge_slug, week_start_date)
);

-- Indexe fuer haeufige Queries
CREATE INDEX IF NOT EXISTS idx_muc_user_week
  ON public.member_user_challenges (user_id, week_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_muc_user_completed
  ON public.member_user_challenges (user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_muc_reminder_sent
  ON public.member_user_challenges (week_start_date)
  WHERE reminder_sent_at IS NOT NULL;

-- RLS: User darf seine eigenen Challenges lesen + Sessions hochzaehlen.
-- Service-Role bypasst RLS sowieso (= Server-API-Calls aus dem Cron etc).
ALTER TABLE public.member_user_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "muc_own_select" ON public.member_user_challenges;
CREATE POLICY "muc_own_select" ON public.member_user_challenges
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "muc_own_update" ON public.member_user_challenges;
CREATE POLICY "muc_own_update" ON public.member_user_challenges
  FOR UPDATE USING (auth.uid() = user_id);

-- INSERT laeuft nur ueber Service-Role (Server-Side), keine User-Policy noetig.
