-- Add email activity tracking columns to instantly_pipedrive_syncs table
-- Run this migration manually in Supabase Dashboard SQL Editor

ALTER TABLE instantly_pipedrive_syncs
ADD COLUMN IF NOT EXISTS email_activities_synced BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_activities_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_activities_error TEXT,
ADD COLUMN IF NOT EXISTS email_activities_retry_count INTEGER DEFAULT 0;

-- Create index for retry queries
CREATE INDEX IF NOT EXISTS idx_instantly_pipedrive_syncs_email_retry
ON instantly_pipedrive_syncs (sync_success, email_activities_synced, email_activities_retry_count)
WHERE sync_success = true AND email_activities_synced = false;

COMMENT ON COLUMN instantly_pipedrive_syncs.email_activities_synced IS 'Whether email activities have been synced to Pipedrive';
COMMENT ON COLUMN instantly_pipedrive_syncs.email_activities_count IS 'Number of email activities synced';
COMMENT ON COLUMN instantly_pipedrive_syncs.email_activities_error IS 'Error message if email activity sync failed';
COMMENT ON COLUMN instantly_pipedrive_syncs.email_activities_retry_count IS 'Number of retry attempts for email activity sync';
