-- Migration: 013_add_company_qualification_fields.sql
-- Add qualification status tracking to companies table

-- Add qualification fields to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS qualification_status VARCHAR(20) DEFAULT 'pending' CHECK (qualification_status IN ('pending', 'qualified', 'disqualified', 'review'));
ALTER TABLE companies ADD COLUMN IF NOT EXISTS qualification_timestamp TIMESTAMP WITH TIME ZONE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS qualified_by_user UUID REFERENCES auth.users(id);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS qualification_notes TEXT;

-- Add enrichment progress tracking fields (extending existing enrichment system)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_enrichment_batch_id UUID;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS enrichment_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS enrichment_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS enrichment_error_message TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_qualification_status ON companies(qualification_status);
CREATE INDEX IF NOT EXISTS idx_companies_qualification_timestamp ON companies(qualification_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_companies_qualified_by_user ON companies(qualified_by_user);
CREATE INDEX IF NOT EXISTS idx_companies_last_enrichment_batch_id ON companies(last_enrichment_batch_id);
CREATE INDEX IF NOT EXISTS idx_companies_enrichment_started_at ON companies(enrichment_started_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN companies.qualification_status IS 'Company qualification status: pending, qualified, disqualified, review';
COMMENT ON COLUMN companies.qualification_timestamp IS 'When the company was last qualified/disqualified';
COMMENT ON COLUMN companies.qualified_by_user IS 'User who performed the qualification action';
COMMENT ON COLUMN companies.qualification_notes IS 'Optional notes about the qualification decision';
COMMENT ON COLUMN companies.last_enrichment_batch_id IS 'ID of the last enrichment batch that processed this company';
COMMENT ON COLUMN companies.enrichment_started_at IS 'When enrichment was last started for this company';
COMMENT ON COLUMN companies.enrichment_completed_at IS 'When enrichment was last completed for this company';
COMMENT ON COLUMN companies.enrichment_error_message IS 'Error message if enrichment failed';

-- Update existing companies to have default qualification status
UPDATE companies SET qualification_status = 'pending' WHERE qualification_status IS NULL;