-- ════════════════════════════════════════════════════════════════════
-- Idempotenz fuer den Mid-Week-Reminder-Cron
-- ════════════════════════════════════════════════════════════════════
--
-- Fuegt eine "reminder_sent_at" Spalte zu member_user_challenges hinzu.
-- /api/mitglieder/challenges/notify-midweek nutzt sie, um pro Woche
-- pro User nur EINEN Reminder zu schicken — auch wenn der Cron im
-- gleichen Zeitfenster mehrfach laeuft.
--
-- Einmalig im Supabase SQL Editor ausfuehren. Idempotent.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.member_user_challenges
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Index nicht zwingend noetig (Filter ueber user_id + week_start_date),
-- aber Cron-Query gewinnt minimal:
CREATE INDEX IF NOT EXISTS idx_muc_reminder_sent
  ON public.member_user_challenges (week_start_date)
  WHERE reminder_sent_at IS NOT NULL;
