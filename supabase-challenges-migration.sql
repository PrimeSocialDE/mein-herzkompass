-- Wochen-Challenges (Gamification fuer Mitgliederbereich /erfolge).
-- Strikt additiv. Jede Challenge ist EIN Datensatz fuer User + Woche.
-- Templates leben im Code (lib/member-challenges.ts), hier wird nur
-- der per-User-State gespeichert (Fortschritt + Badge-Earned-Datum).

CREATE TABLE IF NOT EXISTS member_user_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Welche Challenge (slug entspricht Code-Template)
  challenge_slug text NOT NULL,
  challenge_title text NOT NULL,
  challenge_description text NOT NULL,
  problem_match text,            -- z.B. "pulling" oder NULL fuer generic

  -- Fortschritt
  target_sessions int NOT NULL DEFAULT 3,
  sessions_done int NOT NULL DEFAULT 0,

  -- Badge bei Abschluss
  badge_emoji text NOT NULL DEFAULT '🥇',
  badge_label text NOT NULL,

  -- Wochen-Bezug (Montag der Woche, ISO)
  week_start_date date NOT NULL,

  -- Free vs Paid (steuert Anzahl pro Woche)
  is_premium boolean NOT NULL DEFAULT false,

  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Verhindert Duplikat-Assignment derselben Challenge in derselben Woche
  UNIQUE (user_id, challenge_slug, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_user_challenges_user_week
  ON member_user_challenges (user_id, week_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_user_challenges_completed
  ON member_user_challenges (user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- RLS: User darf nur eigene Eintraege sehen. Writes laufen serverseitig
-- ueber Service-Role (admin client), keine Insert/Update-Policy noetig.
ALTER TABLE member_user_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select own challenges" ON member_user_challenges;
CREATE POLICY "select own challenges"
  ON member_user_challenges FOR SELECT
  USING (auth.uid() = user_id);

-- updated_at automatisch pflegen
CREATE OR REPLACE FUNCTION set_updated_at_user_challenges()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_challenges_updated_at ON member_user_challenges;
CREATE TRIGGER trg_user_challenges_updated_at
  BEFORE UPDATE ON member_user_challenges
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_user_challenges();
