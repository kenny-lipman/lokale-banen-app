-- Combined Migration: Fix Contact Qualification Status and Statistics
-- This migration updates all contact qualification statuses and fixes the statistics view

-- ============================================================================
-- PART 1: Update qualification_status for all contacts
-- ============================================================================

BEGIN;

-- Show current distribution
DO $$
BEGIN
  RAISE NOTICE '=== BEFORE: Current qualification_status distribution ===';
END $$;

SELECT 
  COALESCE(qualification_status, 'NULL') as qualification_status, 
  COUNT(*) as count,
  COUNT(CASE WHEN campaign_id IS NOT NULL AND campaign_id != '' THEN 1 END) as with_campaign
FROM contacts
GROUP BY qualification_status
ORDER BY qualification_status;

-- Update qualification_status based on business rules
UPDATE contacts
SET qualification_status = 
  CASE
    -- Rule 1: If contact has a campaign_id, set to 'in_campaign'
    WHEN campaign_id IS NOT NULL AND campaign_id != '' THEN 'in_campaign'
    
    -- Rule 2: Keep existing qualified status (only if no campaign)
    WHEN qualification_status = 'qualified' AND (campaign_id IS NULL OR campaign_id = '') THEN 'qualified'
    
    -- Rule 3: Keep existing review status
    WHEN qualification_status = 'review' THEN 'review'
    
    -- Rule 4: Keep existing disqualified status
    WHEN qualification_status = 'disqualified' THEN 'disqualified'
    
    -- Rule 5: Everything else becomes pending
    ELSE 'pending'
  END;

-- Ensure no NULL values remain (safety check)
UPDATE contacts
SET qualification_status = 'pending'
WHERE qualification_status IS NULL OR qualification_status = '';

-- Add NOT NULL constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'contacts'
    AND column_name = 'qualification_status'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE contacts ALTER COLUMN qualification_status SET NOT NULL;
  END IF;
END $$;

-- Add default value for new records
ALTER TABLE contacts ALTER COLUMN qualification_status SET DEFAULT 'pending';

-- Create check constraint to ensure valid values
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'contacts'
    AND constraint_name = 'contacts_qualification_status_check'
  ) THEN
    ALTER TABLE contacts DROP CONSTRAINT contacts_qualification_status_check;
  END IF;
  
  -- Add new constraint
  ALTER TABLE contacts 
  ADD CONSTRAINT contacts_qualification_status_check 
  CHECK (qualification_status IN ('pending', 'qualified', 'review', 'disqualified', 'in_campaign'));
END $$;

-- Create or update a trigger to maintain qualification_status consistency
CREATE OR REPLACE FUNCTION maintain_qualification_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If a campaign_id is set, automatically set qualification_status to 'in_campaign'
  IF NEW.campaign_id IS NOT NULL AND NEW.campaign_id != '' THEN
    NEW.qualification_status := 'in_campaign';
  -- If campaign_id is removed and status is 'in_campaign', reset to 'pending'
  ELSIF (NEW.campaign_id IS NULL OR NEW.campaign_id = '') AND NEW.qualification_status = 'in_campaign' THEN
    NEW.qualification_status := 'pending';
  -- Ensure qualification_status is never NULL
  ELSIF NEW.qualification_status IS NULL OR NEW.qualification_status = '' THEN
    NEW.qualification_status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS maintain_qualification_status_trigger ON contacts;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER maintain_qualification_status_trigger
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION maintain_qualification_status();

-- Add comment explaining the field
COMMENT ON COLUMN contacts.qualification_status IS 'Contact qualification status: pending, qualified, review, disqualified, or in_campaign. Automatically set to in_campaign when campaign_id is present.';

-- Show updated distribution
DO $$
BEGIN
  RAISE NOTICE '=== AFTER: Updated qualification_status distribution ===';
END $$;

SELECT 
  qualification_status, 
  COUNT(*) as count,
  COUNT(CASE WHEN campaign_id IS NOT NULL AND campaign_id != '' THEN 1 END) as with_campaign
FROM contacts
GROUP BY qualification_status
ORDER BY qualification_status;

-- ============================================================================
-- PART 2: Fix contact statistics view
-- ============================================================================

-- Drop existing materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS contact_stats_mv CASCADE;

-- Create new materialized view with simplified counting logic
CREATE MATERIALIZED VIEW contact_stats_mv AS
SELECT 
  'total' as stat_type,
  
  -- Total contacts
  COUNT(*) AS total_contacts,
  
  -- Contacts in campaigns (qualification_status = 'in_campaign')
  COUNT(CASE WHEN qualification_status = 'in_campaign' THEN 1 END) AS contacts_with_campaign,
  
  -- Contacts without campaigns (all non-in_campaign statuses)
  COUNT(CASE WHEN qualification_status != 'in_campaign' THEN 1 END) AS contacts_without_campaign,
  
  -- Qualified contacts (qualification_status = 'qualified')
  COUNT(CASE WHEN qualification_status = 'qualified' THEN 1 END) AS qualified_contacts,
  
  -- Review contacts (qualification_status = 'review')
  COUNT(CASE WHEN qualification_status = 'review' THEN 1 END) AS review_contacts,
  
  -- Disqualified contacts (qualification_status = 'disqualified')
  COUNT(CASE WHEN qualification_status = 'disqualified' THEN 1 END) AS disqualified_contacts,
  
  -- Pending contacts (qualification_status = 'pending')
  COUNT(CASE WHEN qualification_status = 'pending' THEN 1 END) AS pending_contacts,
  
  NOW() as last_updated
FROM contacts;

-- Create index for fast lookup
CREATE UNIQUE INDEX idx_contact_stats_mv_stat_type ON contact_stats_mv(stat_type);

-- Grant permissions
GRANT SELECT ON contact_stats_mv TO authenticated;
GRANT SELECT ON contact_stats_mv TO anon;

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_contact_stats_mv()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY contact_stats_mv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the refresh function
GRANT EXECUTE ON FUNCTION refresh_contact_stats_mv() TO authenticated;

-- Initial refresh of the materialized view
REFRESH MATERIALIZED VIEW contact_stats_mv;

-- Add comment explaining the view
COMMENT ON MATERIALIZED VIEW contact_stats_mv IS 'Materialized view for fast contact statistics retrieval. Counts are based on qualification_status field which is automatically maintained.';

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== FINAL: Contact Statistics Summary ===';
END $$;

SELECT 
  total_contacts as "Total",
  contacts_with_campaign as "In Campaign",
  qualified_contacts as "Qualified",
  review_contacts as "Review",
  disqualified_contacts as "Disqualified",
  pending_contacts as "Pending"
FROM contact_stats_mv
WHERE stat_type = 'total';

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully! Contact qualification statuses have been updated and statistics view has been fixed.';
END $$;