-- Migration: Add cron job for cleaning up Instantly leads after 10 days
-- Schedule: Daily at 03:00 UTC (04:00 NL winter / 05:00 NL summer)

-- First, remove the job if it already exists (for idempotency)
SELECT cron.unschedule('cleanup-instantly-leads')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-instantly-leads'
);

-- Schedule the cleanup cron job
SELECT cron.schedule(
  'cleanup-instantly-leads',
  '0 3 * * *',  -- 03:00 UTC daily = 04:00 NL winter / 05:00 NL summer
  $$
  SELECT net.http_post(
    url := 'https://lokale-banen-app.vercel.app/api/cron/cleanup-instantly-leads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Add comment for documentation
COMMENT ON COLUMN cron.job.jobname IS 'cleanup-instantly-leads: Removes leads from Instantly 10 days after campaign_completed to catch late replies';
