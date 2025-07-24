-- Apollo Enrichment Database Schema
-- Migration: 001_create_enrichment_tables.sql

-- Create enrichment_batches table for tracking batch operations
CREATE TABLE IF NOT EXISTS enrichment_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    total_companies INTEGER NOT NULL DEFAULT 0,
    completed_companies INTEGER NOT NULL DEFAULT 0,
    failed_companies INTEGER NOT NULL DEFAULT 0,
    webhook_url TEXT,
    webhook_payload JSONB,
    webhook_response JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create enrichment_status table for individual company enrichment tracking
CREATE TABLE IF NOT EXISTS enrichment_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES enrichment_batches(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    website VARCHAR(255),
    contacts_found INTEGER DEFAULT 0,
    enriched_data JSONB,
    error_message TEXT,
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique company per batch
    UNIQUE(batch_id, company_id)
);

-- Add enrichment fields to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS apollo_enriched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS apollo_contacts_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS apollo_enrichment_data JSONB;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_enrichment_batch_id UUID REFERENCES enrichment_batches(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_enrichment_batches_batch_id ON enrichment_batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_batches_status ON enrichment_batches(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_batches_created_at ON enrichment_batches(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_status_batch_id ON enrichment_status(batch_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_status_company_id ON enrichment_status(company_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_status_status ON enrichment_status(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_status_created_at ON enrichment_status(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_companies_apollo_enriched_at ON companies(apollo_enriched_at);
CREATE INDEX IF NOT EXISTS idx_companies_last_enrichment_batch_id ON companies(last_enrichment_batch_id);

-- Create function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_enrichment_batches_updated_at ON enrichment_batches;
CREATE TRIGGER update_enrichment_batches_updated_at
    BEFORE UPDATE ON enrichment_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_enrichment_status_updated_at ON enrichment_status;
CREATE TRIGGER update_enrichment_status_updated_at
    BEFORE UPDATE ON enrichment_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions (adjust as needed for your setup)
-- These might need to be adjusted based on your Supabase RLS policies

-- Insert initial data or setup if needed
-- (None required for this schema)

-- Comments for documentation
COMMENT ON TABLE enrichment_batches IS 'Tracks Apollo enrichment batch operations with their overall status and metadata';
COMMENT ON TABLE enrichment_status IS 'Tracks individual company enrichment status within each batch';
COMMENT ON COLUMN companies.apollo_enriched_at IS 'Timestamp of last successful Apollo enrichment';
COMMENT ON COLUMN companies.apollo_contacts_count IS 'Number of contacts found during last Apollo enrichment';
COMMENT ON COLUMN companies.apollo_enrichment_data IS 'JSON data from Apollo enrichment including contacts and company details';
COMMENT ON COLUMN companies.last_enrichment_batch_id IS 'Reference to the last enrichment batch that processed this company'; 