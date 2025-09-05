-- Migration: Fix contact statistics counting logic (Simple version without cron)
-- This migration creates/updates the materialized view for accurate contact statistics

-- Drop existing materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS contact_stats_mv CASCADE;

-- Create new materialized view with correct counting logic
CREATE MATERIALIZED VIEW contact_stats_mv AS
WITH contact_qualification_stats AS (
  SELECT 
    -- Count contacts based on their qualification_status
    COUNT(*) AS total_contacts,
    
    -- Contacts in campaigns (have a campaign_id)
    COUNT(CASE 
      WHEN campaign_id IS NOT NULL AND campaign_id != '' 
      THEN 1 
    END) AS contacts_with_campaign,
    
    -- Contacts without campaigns
    COUNT(CASE 
      WHEN campaign_id IS NULL OR campaign_id = '' 
      THEN 1 
    END) AS contacts_without_campaign,
    
    -- Qualified contacts (qualification_status = 'qualified' AND no campaign)
    COUNT(CASE 
      WHEN qualification_status = 'qualified' 
        AND (campaign_id IS NULL OR campaign_id = '')
      THEN 1 
    END) AS qualified_contacts,
    
    -- Review contacts (qualification_status = 'review')
    COUNT(CASE 
      WHEN qualification_status = 'review' 
      THEN 1 
    END) AS review_contacts,
    
    -- Disqualified contacts (qualification_status = 'disqualified')
    COUNT(CASE 
      WHEN qualification_status = 'disqualified' 
      THEN 1 
    END) AS disqualified_contacts,
    
    -- Pending contacts (qualification_status = 'pending' or NULL, and no campaign)
    COUNT(CASE 
      WHEN (qualification_status = 'pending' OR qualification_status IS NULL)
        AND (campaign_id IS NULL OR campaign_id = '')
      THEN 1 
    END) AS pending_contacts
    
  FROM contacts
)
SELECT 
  'total' as stat_type,
  total_contacts,
  contacts_with_campaign,
  contacts_without_campaign,
  qualified_contacts,
  review_contacts,
  disqualified_contacts,
  pending_contacts,
  NOW() as last_updated
FROM contact_qualification_stats;

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
COMMENT ON MATERIALIZED VIEW contact_stats_mv IS 'Materialized view for fast contact statistics retrieval. Must be manually refreshed or refreshed via application code when contacts change.';