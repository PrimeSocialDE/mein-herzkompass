-- Upsell Schedule Table
-- Tracks when each paid lead should start their upsell journey
-- Existing customers get staggered start dates, new customers get "today"

CREATE TABLE IF NOT EXISTS upsell_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  upsell_start_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'new',  -- 'backfill' for existing, 'new' for fresh
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id)
);

CREATE INDEX IF NOT EXISTS idx_upsell_schedule_start ON upsell_schedule(upsell_start_date);
CREATE INDEX IF NOT EXISTS idx_upsell_schedule_email ON upsell_schedule(user_email);
