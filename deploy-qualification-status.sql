-- Deployment Script: Campaign Qualification Status System
-- This script applies all necessary changes for the campaign qualification status workflow

-- =================================================================
-- STEP 1: Add 'in_campaign' qualification status (Migration 027)
-- =================================================================

-- Update the check constraint to include 'in_campaign'
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_qualification_status_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_qualification_status_check 
  CHECK (qualification_status IN ('pending', 'qualified', 'disqualified', 'review', 'in_campaign'));

-- Update column comment to reflect the new states  
COMMENT ON COLUMN contacts.qualification_status IS 'Contact qualification status: pending, qualified, disqualified, review, in_campaign';

-- Set existing contacts with campaign_id to 'in_campaign' status if they are currently 'qualified'
UPDATE contacts 
SET 
  qualification_status = 'in_campaign',
  qualification_timestamp = COALESCE(qualification_timestamp, NOW())
WHERE campaign_id IS NOT NULL 
  AND qualification_status = 'qualified';

-- Create function to automatically update qualification status when campaign_id changes
CREATE OR REPLACE FUNCTION update_qualification_status_on_campaign_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If campaign_id is being set from NULL to a value, and status is 'qualified'
  IF OLD.campaign_id IS NULL AND NEW.campaign_id IS NOT NULL THEN
    IF NEW.qualification_status = 'qualified' THEN
      NEW.qualification_status = 'in_campaign';
      NEW.qualification_timestamp = NOW();
    END IF;
  -- If campaign_id is being removed (set to NULL), and status is 'in_campaign' 
  ELSIF OLD.campaign_id IS NOT NULL AND NEW.campaign_id IS NULL THEN
    IF NEW.qualification_status = 'in_campaign' THEN
      NEW.qualification_status = 'qualified';
      NEW.qualification_timestamp = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically manage qualification status on campaign changes
DROP TRIGGER IF EXISTS trg_update_qualification_status_on_campaign_change ON contacts;
CREATE TRIGGER trg_update_qualification_status_on_campaign_change
  BEFORE UPDATE OF campaign_id ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_qualification_status_on_campaign_change();

-- =================================================================
-- STEP 2: Database Query Optimization (Migration 028)
-- =================================================================

-- Composite index for common filtering operations
CREATE INDEX IF NOT EXISTS idx_contacts_qualification_campaign_composite 
ON contacts(qualification_status, campaign_id, company_id);

-- Index specifically for "qualified but not in campaign" queries (common for UI filtering)
CREATE INDEX IF NOT EXISTS idx_contacts_qualified_no_campaign 
ON contacts(qualification_status, company_id) 
WHERE qualification_status = 'qualified' AND campaign_id IS NULL;

-- Index for campaign statistics queries
CREATE INDEX IF NOT EXISTS idx_contacts_campaign_statistics 
ON contacts(campaign_id, qualification_status, created_at DESC) 
WHERE campaign_id IS NOT NULL;

-- Partial index for pending contacts (most commonly queried state)
CREATE INDEX IF NOT EXISTS idx_contacts_pending_qualification 
ON contacts(company_id, created_at DESC) 
WHERE qualification_status = 'pending' OR qualification_status IS NULL;

-- Optimize search queries with text search index
CREATE INDEX IF NOT EXISTS idx_contacts_search_text 
ON contacts USING gin (
  to_tsvector('english', 
    coalesce(name, '') || ' ' || 
    coalesce(first_name, '') || ' ' || 
    coalesce(last_name, '') || ' ' || 
    coalesce(email, '') || ' ' || 
    coalesce(title, '')
  )
);

-- =================================================================
-- STEP 3: Update contacts_optimized view (Migration 029)
-- =================================================================

-- Drop and recreate the contacts_optimized view
DROP VIEW IF EXISTS contacts_optimized CASCADE;

CREATE VIEW contacts_optimized AS
SELECT 
    c.id,
    c.company_id,
    c.first_name,
    c.last_name,
    c.name,
    c.title,
    c.email,
    c.email_status,
    c.linkedin_url,
    c.source,
    c.found_at,
    c.last_touch,
    c.created_at,
    c.campaign_id,
    c.campaign_name,
    c.phone,
    c.instantly_id,
    c.apollo_id,
    c.status,
    c.qualification_status,
    c.qualification_timestamp,
    c.qualified_by_user,
    -- Company data from join
    co.name as company_name,
    co.location as company_location,
    co.website,
    co.phone as company_phone,
    co.linkedin as company_linkedin,
    co.category_size,
    co.size_min,
    co.size_max,
    co.qualification_status as company_status,
    co.qualification_status as company_status_field,
    co.klant_status,
    co.enrichment_status,
    -- Region data
    r.id as region_id,
    r.plaats as company_region,
    r.regio_platform,
    -- Source data
    s.id as source_id,
    s.name as source_name,
    -- Additional computed fields
    CASE 
        WHEN c.campaign_id IS NOT NULL THEN co.qualification_status
        ELSE c.status 
    END as status_computed,
    co.start
FROM contacts c
LEFT JOIN companies co ON c.company_id = co.id
LEFT JOIN job_postings jp ON co.id = jp.company_id
LEFT JOIN regions r ON jp.region_id = r.id  
LEFT JOIN sources s ON jp.source_id = s.id;

-- =================================================================
-- STEP 4: Final optimizations and cleanup
-- =================================================================

-- Update table statistics for better query planning
ANALYZE contacts;

-- Add helpful comments for maintenance
COMMENT ON INDEX idx_contacts_qualification_campaign_composite IS 'Optimizes filtering by qualification status, campaign, and company - used by OTIS enhanced contacts UI';
COMMENT ON INDEX idx_contacts_qualified_no_campaign IS 'Optimizes "qualified but not in campaign" queries for tab filtering';
COMMENT ON INDEX idx_contacts_campaign_statistics IS 'Optimizes campaign statistics and reporting queries';
COMMENT ON INDEX idx_contacts_pending_qualification IS 'Optimizes pending contacts queries (default tab)';
COMMENT ON INDEX idx_contacts_search_text IS 'Full-text search optimization for contact search functionality';
COMMENT ON VIEW contacts_optimized IS 'Optimized view for contacts with company, region, and source data. Includes qualification_status for new campaign workflow.';

-- Grant appropriate permissions
ALTER VIEW contacts_optimized OWNER TO postgres;

-- =================================================================
-- VERIFICATION QUERIES
-- =================================================================

-- Verify the trigger is working
SELECT 'Trigger created successfully' as status 
WHERE EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trg_update_qualification_status_on_campaign_change'
);

-- Show current qualification status distribution
SELECT 
    qualification_status,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE campaign_id IS NOT NULL) as with_campaign,
    COUNT(*) FILTER (WHERE campaign_id IS NULL) as without_campaign
FROM contacts 
WHERE qualification_status IS NOT NULL
GROUP BY qualification_status
ORDER BY count DESC;

-- Verify indexes were created
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'contacts' 
  AND indexname LIKE 'idx_contacts_%qualification%'
ORDER BY indexname;