-- Test script to verify contact statistics are calculated correctly

-- Show current contact counts by qualification_status
SELECT 
  'Current Contact Distribution' as description,
  qualification_status,
  COUNT(*) as count,
  COUNT(CASE WHEN campaign_id IS NOT NULL AND campaign_id != '' THEN 1 END) as with_campaign,
  COUNT(CASE WHEN campaign_id IS NULL OR campaign_id = '' THEN 1 END) as without_campaign
FROM contacts
GROUP BY qualification_status
ORDER BY qualification_status;

-- Show what the statistics should be
SELECT 
  'Expected Statistics' as description,
  COUNT(*) as total_contacts,
  COUNT(CASE WHEN campaign_id IS NOT NULL AND campaign_id != '' THEN 1 END) as contacts_with_campaign,
  COUNT(CASE WHEN campaign_id IS NULL OR campaign_id = '' THEN 1 END) as contacts_without_campaign,
  COUNT(CASE WHEN qualification_status = 'qualified' AND (campaign_id IS NULL OR campaign_id = '') THEN 1 END) as qualified_contacts,
  COUNT(CASE WHEN qualification_status = 'review' THEN 1 END) as review_contacts,
  COUNT(CASE WHEN qualification_status = 'disqualified' THEN 1 END) as disqualified_contacts,
  COUNT(CASE WHEN (qualification_status = 'pending' OR qualification_status IS NULL) AND (campaign_id IS NULL OR campaign_id = '') THEN 1 END) as pending_contacts
FROM contacts;

-- Show current materialized view stats (if it exists)
SELECT 
  'Current Materialized View Stats' as description,
  *
FROM contact_stats_mv
WHERE stat_type = 'total';

-- Verify specific tab counts match the logic
WITH tab_counts AS (
  SELECT
    -- In Campaign tab: contacts with campaign_id
    COUNT(CASE WHEN campaign_id IS NOT NULL AND campaign_id != '' THEN 1 END) as in_campaign_tab,
    
    -- Qualified tab: qualified status AND no campaign
    COUNT(CASE WHEN qualification_status = 'qualified' AND (campaign_id IS NULL OR campaign_id = '') THEN 1 END) as qualified_tab,
    
    -- Review tab: review status
    COUNT(CASE WHEN qualification_status = 'review' THEN 1 END) as review_tab,
    
    -- Disqualified tab: disqualified status  
    COUNT(CASE WHEN qualification_status = 'disqualified' THEN 1 END) as disqualified_tab,
    
    -- Pending tab: pending or null status AND no campaign
    COUNT(CASE WHEN (qualification_status = 'pending' OR qualification_status IS NULL) AND (campaign_id IS NULL OR campaign_id = '') THEN 1 END) as pending_tab
  FROM contacts
)
SELECT 
  'Tab Counts Verification' as description,
  in_campaign_tab,
  qualified_tab,
  review_tab,
  disqualified_tab,
  pending_tab
FROM tab_counts;

-- Sample of qualified contacts to verify the filter logic
SELECT 
  'Sample Qualified Contacts (should show in Qualified tab)' as description,
  id,
  name,
  email,
  qualification_status,
  campaign_id,
  campaign_name,
  CASE 
    WHEN qualification_status = 'qualified' AND (campaign_id IS NULL OR campaign_id = '') 
    THEN 'Should show in Qualified tab'
    ELSE 'Should NOT show in Qualified tab'
  END as tab_visibility
FROM contacts
WHERE qualification_status = 'qualified'
LIMIT 20;