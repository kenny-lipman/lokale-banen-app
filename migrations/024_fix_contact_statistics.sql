-- Migration: Fix contact statistics counting logic
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

-- Create a trigger function to auto-refresh stats on contact changes
CREATE OR REPLACE FUNCTION trigger_refresh_contact_stats()
RETURNS trigger AS $$
BEGIN
  -- Refresh the materialized view in the background
  -- Note: This is done asynchronously to avoid blocking the transaction
  PERFORM pg_notify('refresh_contact_stats', '');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to refresh stats when contacts are modified
DROP TRIGGER IF EXISTS refresh_contact_stats_on_insert ON contacts;
DROP TRIGGER IF EXISTS refresh_contact_stats_on_update ON contacts;
DROP TRIGGER IF EXISTS refresh_contact_stats_on_delete ON contacts;

CREATE TRIGGER refresh_contact_stats_on_insert
  AFTER INSERT ON contacts
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_contact_stats();

CREATE TRIGGER refresh_contact_stats_on_update
  AFTER UPDATE ON contacts
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_contact_stats();

CREATE TRIGGER refresh_contact_stats_on_delete
  AFTER DELETE ON contacts
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_contact_stats();

-- Create a background job to periodically refresh the stats (every 5 minutes)
-- This ensures stats are eventually consistent even if notifications are missed
SELECT cron.schedule(
  'refresh-contact-stats',
  '*/5 * * * *',
  $$SELECT refresh_contact_stats_mv();$$
);

-- Initial refresh of the materialized view
REFRESH MATERIALIZED VIEW contact_stats_mv;

-- Add comment explaining the view
COMMENT ON MATERIALIZED VIEW contact_stats_mv IS 'Materialized view for fast contact statistics retrieval. Automatically refreshed on contact changes.';