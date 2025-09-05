-- Migration: Add processing tracking fields to apify_runs table
-- Purpose: Track user processing status and notes for Apify runs review workflow

-- Add processing status enum type
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processing_status_enum') THEN
        CREATE TYPE processing_status_enum AS ENUM ('not_started', 'in_progress', 'completed');
    END IF;
END $$;

-- Add new columns to apify_runs table
ALTER TABLE apify_runs 
ADD COLUMN IF NOT EXISTS processing_status processing_status_enum DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS processing_notes TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS processed_by VARCHAR(255);

-- Add index for performance when filtering by processing status
CREATE INDEX IF NOT EXISTS idx_apify_runs_processing_status 
ON apify_runs(processing_status);

-- Add index for processed_at to support sorting by processing date
CREATE INDEX IF NOT EXISTS idx_apify_runs_processed_at 
ON apify_runs(processed_at);

-- Update RLS policies if needed (assuming service role access for now)
-- Note: Adjust based on your authentication requirements

COMMENT ON COLUMN apify_runs.processing_status IS 'Track whether the run has been reviewed: not_started, in_progress, or completed';
COMMENT ON COLUMN apify_runs.processing_notes IS 'User notes about what was done during processing of this run';
COMMENT ON COLUMN apify_runs.processed_at IS 'Timestamp of last processing status update';
COMMENT ON COLUMN apify_runs.processed_by IS 'User identifier who processed this run';