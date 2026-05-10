-- Erweitert member_mood_logs um strukturierte Folgefragen-Antworten.
-- Strikt additiv. Bestehende Zeilen bekommen NULL — alte Eintraege bleiben gueltig.
--
-- Voraussetzung: supabase-mood-logs-migration.sql wurde ausgefuehrt
-- (= Tabelle member_mood_logs existiert).

ALTER TABLE member_mood_logs
  ADD COLUMN IF NOT EXISTS answers jsonb;

COMMENT ON COLUMN member_mood_logs.answers IS
  'Strukturierte Antworten auf Folgefragen pro Problem-Key. Beispiel: {"leine_dauer":"meist","reaktion":"sofort"}. Wird im KI-Trainer-Kontext verwendet.';
