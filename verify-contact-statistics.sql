-- Verification script to debug contact statistics discrepancy

-- 1. Check if qualification_status column has NULL values (should be 0 after migration)
SELECT 
  'Contacts with NULL qualification_status' as check_type,
  COUNT(*) as count
FROM contacts
WHERE qualification_status IS NULL;

-- 2. Check distribution of qualification_status values
SELECT 
  'Distribution of qualification_status' as check_type,
  qualification_status,
  COUNT(*) as count
FROM contacts
GROUP BY qualification_status
ORDER BY count DESC;

-- 3. Check contacts that might be counted differently (old status vs new qualification_status)
SELECT 
  'Contacts with mismatched statuses' as check_type,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'Review' OR status = 'review' THEN 1 END) as old_review_count,
  COUNT(CASE WHEN qualification_status = 'review' THEN 1 END) as new_review_count
FROM contacts;

-- 4. Find contacts where old status is 'Review' but qualification_status is different
SELECT 
  'Review status mismatch details' as check_type,
  id,
  name,
  email,
  status as old_status,
  qualification_status,
  campaign_id,
  campaign_name
FROM contacts
WHERE (status = 'Review' OR status = 'review')
  AND qualification_status != 'review'
LIMIT 20;

-- 5. Check contacts_optimized view (used by frontend)
SELECT 
  'Contacts_optimized view - review status' as check_type,
  COUNT(*) as total_in_view
FROM contacts_optimized
WHERE qualification_status = 'review';

-- 6. Compare different ways of counting review contacts
WITH review_counts AS (
  SELECT
    COUNT(CASE WHEN qualification_status = 'review' THEN 1 END) as by_qualification_status,
    COUNT(CASE WHEN status = 'Review' OR status = 'review' THEN 1 END) as by_old_status,
    COUNT(CASE 
      WHEN qualification_status = 'review' 
        OR (qualification_status IS NULL AND (status = 'Review' OR status = 'review'))
      THEN 1 
    END) as by_combined_logic
  FROM contacts
)
SELECT 
  'Review count comparison' as check_type,
  by_qualification_status as "By qualification_status",
  by_old_status as "By old status field",
  by_combined_logic as "By combined logic (frontend was using this)"
FROM review_counts;

-- 7. Check if there are contacts with campaign but wrong qualification_status
SELECT 
  'Contacts with campaign but wrong status' as check_type,
  COUNT(*) as count
FROM contacts
WHERE campaign_id IS NOT NULL 
  AND campaign_id != ''
  AND qualification_status != 'in_campaign';

-- 8. Check pending contacts that should be qualified/review/disqualified
SELECT 
  'Pending contacts that might need review' as check_type,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'Qualified' THEN 1 END) as should_be_qualified,
  COUNT(CASE WHEN status = 'Disqualified' THEN 1 END) as should_be_disqualified,
  COUNT(CASE WHEN status = 'Review' OR status = 'review' THEN 1 END) as should_be_review
FROM contacts
WHERE qualification_status = 'pending'
  AND status IN ('Qualified', 'Disqualified', 'Review', 'review');