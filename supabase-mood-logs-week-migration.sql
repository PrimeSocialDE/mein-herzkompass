-- Wochen-Check-in fuer member_mood_logs.
-- Strikt additiv. Voraussetzung: vorherige Migrations
-- (mood-logs + answers) sind gelaufen.
--
-- plan_week: Zahl 1..N, kennzeichnet einen wochen-bezogenen Check-in
--   (statt taeglichem). NULL fuer altes Daily-Format.
-- plan_problem_key: snapshot des quiz_result.dog_problem zum Zeitpunkt
--   des Eintrags (nuetzlich falls User spaeter den Plan wechselt).

ALTER TABLE member_mood_logs
  ADD COLUMN IF NOT EXISTS plan_week int,
  ADD COLUMN IF NOT EXISTS plan_problem_key text,
  ADD COLUMN IF NOT EXISTS ai_feedback text;

CREATE INDEX IF NOT EXISTS idx_mood_logs_user_week
  ON member_mood_logs (user_id, plan_week DESC, created_at DESC)
  WHERE plan_week IS NOT NULL;

COMMENT ON COLUMN member_mood_logs.plan_week IS
  'Wenn gesetzt: Eintrag bezieht sich auf eine ganze Plan-Woche (statt taegl. Check-in).';
COMMENT ON COLUMN member_mood_logs.plan_problem_key IS
  'Snapshot des quiz_result.dog_problem zum Zeitpunkt des Eintrags.';
COMMENT ON COLUMN member_mood_logs.ai_feedback IS
  'Persistierte KI-Wochen-Zusammenfassung (Claude Haiku). NULL fuer Daily-Eintraege.';
