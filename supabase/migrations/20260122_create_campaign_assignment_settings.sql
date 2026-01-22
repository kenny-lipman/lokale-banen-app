-- Campaign Assignment Settings table
-- Stores user-configurable settings for the automatic campaign assignment
-- Run this migration manually in Supabase SQL editor

-- Create settings table
CREATE TABLE IF NOT EXISTS campaign_assignment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Global settings
  max_total_contacts INTEGER NOT NULL DEFAULT 500,
  max_per_platform INTEGER NOT NULL DEFAULT 30,

  -- Scheduling
  is_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Rate limiting
  delay_between_contacts_ms INTEGER NOT NULL DEFAULT 500,

  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO campaign_assignment_settings (
  max_total_contacts,
  max_per_platform,
  is_enabled,
  delay_between_contacts_ms
) VALUES (500, 30, true, 500)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE campaign_assignment_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read settings
CREATE POLICY "Allow authenticated users to read campaign settings"
  ON campaign_assignment_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to update settings
CREATE POLICY "Allow authenticated users to update campaign settings"
  ON campaign_assignment_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_campaign_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_campaign_settings_timestamp
  BEFORE UPDATE ON campaign_assignment_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_settings_timestamp();

-- ============================================================================
-- pg_cron job for daily campaign assignment
-- Run this separately in Supabase SQL editor (requires pg_cron extension)
-- ============================================================================

-- Schedule the cron job for 5:00 UTC (6:00 AM NL winter time)
-- SELECT cron.schedule(
--   'campaign-assignment-daily',
--   '0 5 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://lokale-banen-app.vercel.app/api/cron/campaign-assignment',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret_key', true)
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
