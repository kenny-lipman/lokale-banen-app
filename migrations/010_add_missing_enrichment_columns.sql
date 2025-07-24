-- Add missing enrichment columns to companies table
-- Migration: 010_add_missing_enrichment_columns.sql

-- Add enrichment_status column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS enrichment_status VARCHAR(50) DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'processing', 'completed', 'failed', 'enriched'));

-- Add enrichment_batch_id column to companies table (alias for last_enrichment_batch_id)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS enrichment_batch_id UUID REFERENCES enrichment_batches(id);

-- Create index for enrichment_status column
CREATE INDEX IF NOT EXISTS idx_companies_enrichment_status ON companies(enrichment_status);

-- Create index for enrichment_batch_id column
CREATE INDEX IF NOT EXISTS idx_companies_enrichment_batch_id ON companies(enrichment_batch_id);

-- Comments for documentation
COMMENT ON COLUMN companies.enrichment_status IS 'Current enrichment status for this company';
COMMENT ON COLUMN companies.enrichment_batch_id IS 'Reference to the current enrichment batch processing this company'; 