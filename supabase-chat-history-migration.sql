-- Chat-History fuer den KI-Trainer im Mitglieder-Bereich.
-- Pro User wird der gesamte Verlauf gespeichert. Beim Page-Reload werden
-- die letzten N Messages geladen, der Bot bekommt sie als Kontext mit
-- damit er an vorherige Gespraeche anknuepfen kann.
--
-- Strikt additive Migration — bestehende Tabellen unberuehrt.

CREATE TABLE IF NOT EXISTS member_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index fuer schnelles Laden der letzten Messages eines Users
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
  ON member_chat_messages (user_id, created_at DESC);

-- RLS: User kann nur eigene Messages lesen, schreiben passiert via
-- service_role (im Chat-Endpoint).
ALTER TABLE member_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select own chat messages" ON member_chat_messages;
CREATE POLICY "select own chat messages"
  ON member_chat_messages FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE member_chat_messages IS
  'Chat-History pro User fuer den KI-Trainer. Append-only via service_role.';
