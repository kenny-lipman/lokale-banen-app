-- Migration: Add cron job for cleaning up Instantly leads after 10 days
-- Schedule: Daily at 03:00 UTC (04:00 NL winter / 05:00 NL summer)
--
-- IMPORTANT: This cron job calls an API endpoint on the Lokale Banen app.
-- If the app URL changes, update the cron job with:
--
--   SELECT cron.unschedule('cleanup-instantly-leads');
--   -- Then re-run this migration with the new URL
--
-- Current URL: https://lokale-banen-app.vercel.app/api/cron/cleanup-instantly-leads
-- Required settings:
--   - app.settings.cron_secret_key (must be set in Supabase)
--   - app.settings.app_base_url (optional, for future flexibility)

-- First, remove the job if it already exists (for idempotency)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-instantly-leads');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist, ignore
    NULL;
END $$;

-- Schedule the cleanup cron job
-- Runs daily at 03:00 UTC (04:00 NL winter / 05:00 NL summer)
-- Processes leads where campaign_completed > 10 days ago
SELECT cron.schedule(
  'cleanup-instantly-leads',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(
      current_setting('app.settings.app_base_url', true),
      'https://lokale-banen-app.vercel.app'
    ) || '/api/cron/cleanup-instantly-leads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Document the cron job
COMMENT ON TABLE cron.job IS 'Scheduled jobs managed by pg_cron extension';
