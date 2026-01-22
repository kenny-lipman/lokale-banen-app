-- Create instantly_backfill_batches table for tracking backfill operations
CREATE TABLE instantly_backfill_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT UNIQUE NOT NULL,

  -- Config
  campaign_ids TEXT[] DEFAULT '{}',
  dry_run BOOLEAN DEFAULT false,
  batch_size INTEGER DEFAULT 25,
  delay_ms INTEGER DEFAULT 100,

  -- Progress
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'collecting', 'processing', 'paused', 'completed', 'failed', 'cancelled')),
  total_leads INTEGER DEFAULT 0,
  processed_leads INTEGER DEFAULT 0,
  synced_leads INTEGER DEFAULT 0,
  skipped_leads INTEGER DEFAULT 0,
  failed_leads INTEGER DEFAULT 0,
  current_batch INTEGER DEFAULT 0,

  -- Timestamps
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Error
  last_error TEXT,
  error_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for status queries
CREATE INDEX idx_backfill_batches_status ON instantly_backfill_batches(status);

-- Comment for documentation
COMMENT ON TABLE instantly_backfill_batches IS 'Tracks Instantly to Pipedrive backfill batch operations';

-- Create instantly_backfill_leads table for tracking individual leads in backfill batches
CREATE TABLE instantly_backfill_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES instantly_backfill_batches(id) ON DELETE CASCADE,

  -- Lead identification
  lead_email TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,

  -- Status tracking
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'synced', 'skipped', 'failed')),

  -- Instantly data (cached for debugging/retry)
  instantly_data JSONB,
  determined_event_type TEXT,
  has_reply BOOLEAN DEFAULT false,

  -- Results from Pipedrive sync
  pipedrive_org_id INTEGER,
  pipedrive_person_id INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Ensure no duplicate leads per batch
  CONSTRAINT unique_lead_per_batch UNIQUE (batch_id, lead_email, campaign_id)
);

-- Index for efficient batch + status queries
CREATE INDEX idx_backfill_leads_batch_status ON instantly_backfill_leads(batch_id, status);

-- Index for finding leads by email (for debugging)
CREATE INDEX idx_backfill_leads_email ON instantly_backfill_leads(lead_email);

-- Comment for documentation
COMMENT ON TABLE instantly_backfill_leads IS 'Individual leads queued for backfill processing, linked to a batch';
