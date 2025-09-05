-- Migration: Fix duplicate contacts in contacts_optimized view (Simple version)
-- This version gets region data directly from companies table if available

-- Drop the existing view
DROP VIEW IF EXISTS contacts_optimized CASCADE;

-- Create the fixed view without job_postings join
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
    -- Region data - use company's region if stored there
    co.region_id,
    co.region as company_region,
    co.regio_platform,
    -- Source data - use company's source if stored there
    co.source_id,
    co.source_name,
    -- Additional computed fields
    CASE 
        WHEN c.campaign_id IS NOT NULL THEN co.qualification_status
        ELSE c.status 
    END as status_computed,
    co.start
FROM contacts c
LEFT JOIN companies co ON c.company_id = co.id;

-- Add comment explaining the fix
COMMENT ON VIEW contacts_optimized IS 'Optimized view for contacts with company data. Simplified to prevent duplicates by removing job_postings join.';

-- Grant appropriate permissions
GRANT SELECT ON contacts_optimized TO authenticated;
GRANT SELECT ON contacts_optimized TO anon;

-- Verify the fix
DO $$
DECLARE
  contact_count INTEGER;
  optimized_count INTEGER;
  duplicate_count INTEGER;
BEGIN
  -- Count unique contacts in base table
  SELECT COUNT(DISTINCT id) INTO contact_count FROM contacts;
  
  -- Count contacts in optimized view
  SELECT COUNT(*) INTO optimized_count FROM contacts_optimized;
  
  -- Check for duplicates
  SELECT COUNT(*) INTO duplicate_count FROM (
    SELECT id, COUNT(*) as cnt
    FROM contacts_optimized
    GROUP BY id
    HAVING COUNT(*) > 1
  ) dup;
  
  RAISE NOTICE '=== View Fix Verification ===';
  RAISE NOTICE 'Unique contacts in base table: %', contact_count;
  RAISE NOTICE 'Total rows in contacts_optimized view: %', optimized_count;
  RAISE NOTICE 'Duplicate contact IDs found: %', duplicate_count;
  
  IF duplicate_count > 0 THEN
    RAISE WARNING 'There are still % duplicate contacts in the view!', duplicate_count;
  ELSE
    RAISE NOTICE 'Success! No duplicate contacts in the view.';
  END IF;
  
  -- Show if we're matching 1:1
  IF contact_count = optimized_count THEN
    RAISE NOTICE 'Perfect match! View has exactly the same number of rows as contacts table.';
  ELSE
    RAISE NOTICE 'Row count difference: % (should be 0)', optimized_count - contact_count;
  END IF;
END $$;