-- Migration: Create instantly_pipedrive_syncs table
-- Purpose: Track all syncs between Instantly leads and Pipedrive organizations/persons
-- This enables audit trail and prevents duplicate syncs

-- Create the main sync tracking table
CREATE TABLE IF NOT EXISTS public.instantly_pipedrive_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Instantly data
  instantly_lead_email TEXT NOT NULL,
  instantly_lead_id TEXT,
  instantly_campaign_id TEXT NOT NULL,
  instantly_campaign_name TEXT,
  instantly_workspace_id TEXT,

  -- Pipedrive data
  pipedrive_org_id INTEGER,
  pipedrive_org_name TEXT,
  pipedrive_person_id INTEGER,

  -- Sync metadata
  event_type TEXT NOT NULL, -- 'campaign_completed', 'reply_received', 'lead_interested', 'lead_not_interested', 'lead_added', 'backfill'
  status_prospect_set TEXT, -- The status value that was set in Pipedrive
  sync_source TEXT NOT NULL DEFAULT 'webhook', -- 'webhook', 'backfill', 'manual'

  -- Reply tracking (for determining final status)
  has_reply BOOLEAN DEFAULT FALSE,
  reply_sentiment TEXT, -- 'positive', 'negative', 'neutral', NULL

  -- Timestamps
  instantly_event_at TIMESTAMPTZ, -- When the event occurred in Instantly
  synced_at TIMESTAMPTZ DEFAULT NOW(), -- When we processed the sync
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Debug/audit
  raw_webhook_payload JSONB,
  sync_error TEXT,
  sync_attempts INTEGER DEFAULT 1,
  sync_success BOOLEAN DEFAULT TRUE,

  -- Flags
  org_created BOOLEAN DEFAULT FALSE, -- Did we create a new org?
  person_created BOOLEAN DEFAULT FALSE, -- Did we create a new person?
  status_skipped BOOLEAN DEFAULT FALSE, -- Was status update skipped (e.g., protected status)?
  skip_reason TEXT -- Reason for skipping if applicable
);

-- Unique constraint: one sync per email + campaign + event type
-- This prevents duplicate processing of the same webhook
CREATE UNIQUE INDEX IF NOT EXISTS idx_instantly_sync_unique
  ON public.instantly_pipedrive_syncs(instantly_lead_email, instantly_campaign_id, event_type);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_instantly_sync_email
  ON public.instantly_pipedrive_syncs(instantly_lead_email);

CREATE INDEX IF NOT EXISTS idx_instantly_sync_campaign
  ON public.instantly_pipedrive_syncs(instantly_campaign_id);

CREATE INDEX IF NOT EXISTS idx_instantly_sync_pipedrive_org
  ON public.instantly_pipedrive_syncs(pipedrive_org_id)
  WHERE pipedrive_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_instantly_sync_pipedrive_person
  ON public.instantly_pipedrive_syncs(pipedrive_person_id)
  WHERE pipedrive_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_instantly_sync_event_type
  ON public.instantly_pipedrive_syncs(event_type);

CREATE INDEX IF NOT EXISTS idx_instantly_sync_created
  ON public.instantly_pipedrive_syncs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_instantly_sync_source
  ON public.instantly_pipedrive_syncs(sync_source);

CREATE INDEX IF NOT EXISTS idx_instantly_sync_failed
  ON public.instantly_pipedrive_syncs(sync_success, sync_attempts)
  WHERE sync_success = FALSE;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_instantly_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_instantly_sync_updated_at
  BEFORE UPDATE ON public.instantly_pipedrive_syncs
  FOR EACH ROW
  EXECUTE FUNCTION update_instantly_sync_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.instantly_pipedrive_syncs IS 'Tracks all synchronization events between Instantly leads and Pipedrive CRM';
COMMENT ON COLUMN public.instantly_pipedrive_syncs.event_type IS 'Type of Instantly event: campaign_completed, reply_received, lead_interested, lead_not_interested, lead_added, backfill';
COMMENT ON COLUMN public.instantly_pipedrive_syncs.sync_source IS 'How the sync was triggered: webhook (real-time), backfill (batch), manual (API call)';
COMMENT ON COLUMN public.instantly_pipedrive_syncs.status_prospect_set IS 'The Pipedrive Status Prospect value that was set';
COMMENT ON COLUMN public.instantly_pipedrive_syncs.has_reply IS 'Whether this lead has replied to any email in the campaign';
COMMENT ON COLUMN public.instantly_pipedrive_syncs.reply_sentiment IS 'Sentiment of the reply: positive, negative, neutral';

-- Enable RLS (Row Level Security)
ALTER TABLE public.instantly_pipedrive_syncs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role has full access to instantly_pipedrive_syncs"
  ON public.instantly_pipedrive_syncs
  FOR ALL
  USING (true)
  WITH CHECK (true);
