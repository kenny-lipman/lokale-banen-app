-- Add webhook response fields to enrichment_status table
-- Migration: 008_add_webhook_response_fields.sql

-- Add webhook_response field to store individual webhook responses
ALTER TABLE enrichment_status ADD COLUMN IF NOT EXISTS webhook_response JSONB;

-- Add processed_at field to track when webhook was processed
ALTER TABLE enrichment_status ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

-- Add partial_success status to enrichment_batches table
ALTER TABLE enrichment_batches DROP CONSTRAINT IF EXISTS enrichment_batches_status_check;
ALTER TABLE enrichment_batches ADD CONSTRAINT enrichment_batches_status_check 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'partial_success'));

-- Create index for processed_at field for better query performance
CREATE INDEX IF NOT EXISTS idx_enrichment_status_processed_at ON enrichment_status(processed_at);

-- Add comments for documentation
COMMENT ON COLUMN enrichment_status.webhook_response IS 'JSON response from individual webhook call for this company';
COMMENT ON COLUMN enrichment_status.processed_at IS 'Timestamp when webhook was processed for this company'; 