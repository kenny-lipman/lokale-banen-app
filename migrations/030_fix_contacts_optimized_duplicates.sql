-- Migration: Fix duplicate contacts in contacts_optimized view
-- The issue: joining with job_postings creates duplicates when a company has multiple job postings

-- Drop the existing view
DROP VIEW IF EXISTS contacts_optimized CASCADE;

-- Create the fixed view using DISTINCT ON or a better join strategy
CREATE VIEW contacts_optimized AS
WITH company_regions AS (
  -- Get one region per company (avoiding duplicates from multiple job postings)
  SELECT DISTINCT ON (jp.company_id)
    jp.company_id,
    r.id as region_id,
    r.plaats as company_region,
    r.regio_platform,
    s.id as source_id,
    s.name as source_name
  FROM job_postings jp
  LEFT JOIN regions r ON jp.region_id = r.id
  LEFT JOIN sources s ON jp.source_id = s.id
  ORDER BY jp.company_id, jp.scraped_at DESC -- Get the most recent job posting's region
)
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
    -- Region data from the CTE (one per company)
    cr.region_id,
    cr.company_region,
    cr.regio_platform,
    -- Source data from the CTE
    cr.source_id,
    cr.source_name,
    -- Additional computed fields
    CASE 
        WHEN c.campaign_id IS NOT NULL THEN co.qualification_status
        ELSE c.status 
    END as status_computed,
    co.start
FROM contacts c
LEFT JOIN companies co ON c.company_id = co.id
LEFT JOIN company_regions cr ON co.id = cr.company_id;

-- Add comment explaining the fix
COMMENT ON VIEW contacts_optimized IS 'Optimized view for contacts with company, region, and source data. Fixed to prevent duplicates from multiple job postings per company. Uses the most recent job posting for region/source data.';

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
END $$;