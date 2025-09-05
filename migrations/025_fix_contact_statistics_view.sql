-- Migration: Fix contact statistics view
-- This migration should be run AFTER 024_update_contact_qualification_status.sql
-- It creates/updates the materialized view for accurate contact statistics

-- Drop existing materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS contact_stats_mv CASCADE;

-- Create new materialized view with simplified counting logic
-- Now that qualification_status is properly maintained, counting is straightforward
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

-- Create a trigger function to auto-refresh stats on contact changes
CREATE OR REPLACE FUNCTION trigger_refresh_contact_stats()
RETURNS trigger AS $$
BEGIN
  -- Refresh the materialized view asynchronously
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

-- Initial refresh of the materialized view
REFRESH MATERIALIZED VIEW contact_stats_mv;

-- Add comment explaining the view
COMMENT ON MATERIALIZED VIEW contact_stats_mv IS 'Materialized view for fast contact statistics retrieval. Counts are based on qualification_status field which is automatically maintained.';

-- Verification query to show the statistics
SELECT 
  'Contact Statistics Summary' as description,
  total_contacts,
  contacts_with_campaign as "In Campaign",
  qualified_contacts as "Qualified",
  review_contacts as "Review",
  disqualified_contacts as "Disqualified",
  pending_contacts as "Pending"
FROM contact_stats_mv
WHERE stat_type = 'total';