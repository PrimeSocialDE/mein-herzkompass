-- Upsell Tracking Table
-- Tracks which upsell emails have been sent to leads and purchase status
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS upsell_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  lead_id UUID REFERENCES wauwerk_leads(id),
  upsell_type TEXT NOT NULL,
  email_sent_at TIMESTAMPTZ,
  purchased BOOLEAN DEFAULT false,
  purchased_at TIMESTAMPTZ,
  stripe_payment_intent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_upsell_tracking_email ON upsell_tracking(user_email);
CREATE INDEX idx_upsell_tracking_type ON upsell_tracking(upsell_type);
