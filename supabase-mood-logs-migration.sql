-- Stimmungs-Check / Trainings-Verlauf fuer /mitglieder/erfolge/stimmung.
--
-- Append-only: jeder Check-in legt eine NEUE Zeile an. Mehrere
-- Eintraege pro Tag erlaubt (User kann nach jeder Uebung kurz tracken).
-- Niemals UPDATE, niemals DELETE — Verlauf bleibt erhalten.
--
-- Differenziert sich vom PDF-Tagebuch-Upsell: digital, mit Trend-
-- Auswertung, fuettert spaeter den KI-Trainer mit Patterns.

CREATE TABLE IF NOT EXISTS member_mood_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ON DELETE SET NULL: User-Loeschung darf Verlauf nicht zerstoeren
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,

  -- Datum + Stimmung
  log_date date NOT NULL DEFAULT (now()::date),
  mood text NOT NULL CHECK (mood IN ('gut', 'mittel', 'schwierig')),

  -- Optional: kurze Notiz + Bezug zum Modul/Uebung
  note text,
  module_slug text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mood_logs_user_date
  ON member_mood_logs (user_id, log_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mood_logs_email_date
  ON member_mood_logs (email, log_date DESC);

ALTER TABLE member_mood_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select own mood logs" ON member_mood_logs;
CREATE POLICY "select own mood logs"
  ON member_mood_logs FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE member_mood_logs IS
  'Stimmungs-Check pro Trainings-Einheit. Append-only, mehrere/Tag erlaubt. Service-Role inserts ueber API.';
