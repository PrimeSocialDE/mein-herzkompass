-- Chat-Usage-Counter für /mitglieder/hilfe (Rate-Limit Free-User: 3/24h).
-- Strikt additiv — bestehende Daten bleiben unberührt.

ALTER TABLE member_users
  ADD COLUMN IF NOT EXISTS chat_usage_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chat_usage_reset_at timestamptz;

COMMENT ON COLUMN member_users.chat_usage_count IS
  'Anzahl Chat-Fragen im aktuellen 24h-Fenster (Free-User-Limit).';
COMMENT ON COLUMN member_users.chat_usage_reset_at IS
  'Start des aktuellen 24h-Fensters. Nach 24h ab diesem Zeitpunkt: Counter wird zurückgesetzt.';
