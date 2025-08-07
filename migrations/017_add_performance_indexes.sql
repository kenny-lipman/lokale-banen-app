-- Migration: 017_add_performance_indexes.sql
-- Add comprehensive database indexes for contact management performance optimization

-- ==== CONTACTS TABLE INDEXES ====

-- Existing qualification indexes (from 016_add_contact_qualification_fields.sql)
-- These should already exist, but adding IF NOT EXISTS for safety
CREATE INDEX IF NOT EXISTS idx_contacts_qualification_status ON contacts(qualification_status);
CREATE INDEX IF NOT EXISTS idx_contacts_qualification_timestamp ON contacts(qualification_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_qualified_by_user ON contacts(qualified_by_user);
CREATE INDEX IF NOT EXISTS idx_contacts_is_key_contact ON contacts(is_key_contact);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_priority ON contacts(contact_priority);
CREATE INDEX IF NOT EXISTS idx_contacts_company_qualification ON contacts(company_id, qualification_status);

-- Additional performance indexes for contacts
CREATE INDEX IF NOT EXISTS idx_contacts_email_status ON contacts(email_status);
CREATE INDEX IF NOT EXISTS idx_contacts_campaign_id ON contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_contacts_campaign_name ON contacts(campaign_name);
CREATE INDEX IF NOT EXISTS idx_contacts_instantly_id ON contacts(instantly_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_last_touch ON contacts(last_touch DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contacts_company_email_status ON contacts(company_id, email_status);
CREATE INDEX IF NOT EXISTS idx_contacts_company_campaign ON contacts(company_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_contacts_qualification_created ON contacts(qualification_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_key_qualification ON contacts(is_key_contact, qualification_status);

-- Text search indexes for names and emails
CREATE INDEX IF NOT EXISTS idx_contacts_name_gin ON contacts USING GIN (to_tsvector('english', COALESCE(name, '')));
CREATE INDEX IF NOT EXISTS idx_contacts_email_gin ON contacts USING GIN (to_tsvector('english', COALESCE(email, '')));
CREATE INDEX IF NOT EXISTS idx_contacts_title_gin ON contacts USING GIN (to_tsvector('english', COALESCE(title, '')));

-- ==== COMPANIES TABLE INDEXES ====

-- Ensure company qualification indexes exist
CREATE INDEX IF NOT EXISTS idx_companies_qualification_status ON companies(qualification_status);
CREATE INDEX IF NOT EXISTS idx_companies_qualification_timestamp ON companies(qualification_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_companies_qualified_by_user ON companies(qualified_by_user);

-- Apollo enrichment indexes
CREATE INDEX IF NOT EXISTS idx_companies_apollo_enriched_at ON companies(apollo_enriched_at DESC) WHERE apollo_enriched_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_apollo_contacts_count ON companies(apollo_contacts_count DESC) WHERE apollo_contacts_count > 0;

-- Company search and filtering
CREATE INDEX IF NOT EXISTS idx_companies_name_gin ON companies USING GIN (to_tsvector('english', COALESCE(name, '')));
CREATE INDEX IF NOT EXISTS idx_companies_website_gin ON companies USING GIN (to_tsvector('english', COALESCE(website, '')));
CREATE INDEX IF NOT EXISTS idx_companies_location_gin ON companies USING GIN (to_tsvector('english', COALESCE(location, '')));

-- ==== JOB_POSTINGS TABLE INDEXES ====

-- Apify run relationships
CREATE INDEX IF NOT EXISTS idx_job_postings_apify_run_id ON job_postings(apify_run_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_company_run ON job_postings(company_id, apify_run_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_created_at ON job_postings(created_at DESC);

-- ==== ENRICHMENT SYSTEM INDEXES ====

-- These should exist from previous migrations, but ensuring they're present
CREATE INDEX IF NOT EXISTS idx_enrichment_batches_batch_id ON enrichment_batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_batches_status ON enrichment_batches(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_batches_created_at ON enrichment_batches(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_status_batch_id ON enrichment_status(batch_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_status_company_id ON enrichment_status(company_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_status_status ON enrichment_status(status);

-- ==== CONTACT ACTIVITY LOGS INDEXES ====
-- These will be created automatically when the activity log table is created

-- Create table if it doesn't exist (from activity logging system)
CREATE TABLE IF NOT EXISTS contact_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('qualification_change', 'campaign_assignment', 'email_verification', 'priority_change', 'key_contact_toggle', 'created', 'updated', 'deleted')),
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity log indexes
CREATE INDEX IF NOT EXISTS idx_contact_activity_logs_contact_id ON contact_activity_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_activity_logs_user_id ON contact_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_activity_logs_action_type ON contact_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_contact_activity_logs_created_at ON contact_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_activity_logs_session_id ON contact_activity_logs(session_id);

-- Composite indexes for activity logs
CREATE INDEX IF NOT EXISTS idx_contact_activity_contact_action ON contact_activity_logs(contact_id, action_type);
CREATE INDEX IF NOT EXISTS idx_contact_activity_user_action ON contact_activity_logs(user_id, action_type);

-- ==== PARTIAL INDEXES FOR EFFICIENCY ====

-- Only index contacts with qualification data
CREATE INDEX IF NOT EXISTS idx_contacts_qualified_only ON contacts(qualification_timestamp DESC) 
WHERE qualification_status IS NOT NULL AND qualification_status != 'pending';

-- Only index contacts with campaign assignments
CREATE INDEX IF NOT EXISTS idx_contacts_with_campaigns ON contacts(campaign_id, created_at DESC) 
WHERE campaign_id IS NOT NULL;

-- Only index key contacts
CREATE INDEX IF NOT EXISTS idx_key_contacts_only ON contacts(qualification_status, created_at DESC) 
WHERE is_key_contact = true;

-- Only index verified emails
CREATE INDEX IF NOT EXISTS idx_verified_emails_only ON contacts(email, created_at DESC) 
WHERE email_status = 'verified';

-- ==== STATISTICS AND MAINTENANCE ====

-- Update table statistics for better query planning
ANALYZE contacts;
ANALYZE companies;
ANALYZE job_postings;
ANALYZE enrichment_batches;
ANALYZE enrichment_status;
ANALYZE contact_activity_logs;

-- Comments for documentation
COMMENT ON INDEX idx_contacts_qualification_status IS 'Primary index for contact qualification filtering';
COMMENT ON INDEX idx_contacts_company_qualification IS 'Composite index for company-based qualification queries';
COMMENT ON INDEX idx_contacts_name_gin IS 'Full-text search index for contact names';
COMMENT ON INDEX idx_contacts_email_gin IS 'Full-text search index for contact emails';
COMMENT ON INDEX idx_qualified_only IS 'Partial index for contacts with qualification data';
COMMENT ON INDEX idx_contacts_with_campaigns IS 'Partial index for contacts assigned to campaigns';

-- Performance monitoring query (for reference)
-- SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY idx_tup_read DESC;