-- Plan-Content-Store fuer /mitglieder/modul/[slug].
--
-- STRIKT APPEND-ONLY: jeder Generierungs-Lauf von Make.com legt eine
-- NEUE Zeile an. Niemals UPDATE, niemals DELETE — alte Versionen
-- bleiben fuer immer abrufbar (Auditierbar, kein Datenverlust).
--
-- Der App-Renderer holt sich immer die NEUESTE Zeile pro
-- (user_id, plan_slug). Aeltere bleiben als Historie liegen.
--
-- Strikt additive Migration — bestehende Daten + Tabellen unberuehrt.

CREATE TABLE IF NOT EXISTS member_plan_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Wer
  -- ON DELETE SET NULL (nicht CASCADE!): selbst wenn ein User-Account
  -- mal geloescht wird, bleibt der Inhalt erhalten — falls noch
  -- benoetigt fuer Backup/Audit/Wieder-Reaktivierung.
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,

  -- Was fuer ein Plan
  plan_slug text NOT NULL,
  plan_title text,

  -- Inhalt (das ist die Claude-JSON aus den generate-*.mjs Scripts)
  content jsonb NOT NULL,
  pdf_url text,

  -- Snapshot des Hund-Kontexts zum Generierungs-Zeitpunkt
  dog_name text,
  dog_breed text,

  -- Audit
  source text,                       -- 'make.com', 'worker-generate', 'manual'
  source_payment_id text,            -- Mollie payment id wenn vorhanden

  created_at timestamptz DEFAULT now()
  -- Bewusst KEIN updated_at: Inhalte sind unveraenderlich nach Insert.
);

CREATE INDEX IF NOT EXISTS idx_plan_content_user_slug
  ON member_plan_content (user_id, plan_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plan_content_email_slug
  ON member_plan_content (email, plan_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plan_content_payment
  ON member_plan_content (source_payment_id);

-- RLS: User darf NUR LESEN. Keine UPDATE/DELETE-Policy.
-- Writes laufen ausschliesslich via Service-Role (Make.com / worker).
ALTER TABLE member_plan_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select own plan content" ON member_plan_content;
CREATE POLICY "select own plan content"
  ON member_plan_content FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE member_plan_content IS
  'Append-only Inhalts-Store fuer Plan-Module. Make.com pusht hier nach jeder PDF-Generierung. Strikt additiv, niemals UPDATE/DELETE.';
