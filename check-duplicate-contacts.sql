-- Check for duplicate contacts issue

-- 1. Check if there are duplicate emails in the contacts table
SELECT 
  'Duplicate emails in contacts table' as check_type,
  email,
  COUNT(*) as count
FROM contacts
WHERE email IS NOT NULL AND email != ''
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;

-- 2. Specifically check for the reported email
SELECT 
  'Check specific email: m.eisema@leeuwbouw.nl' as check_type,
  COUNT(*) as count
FROM contacts
WHERE email = 'm.eisema@leeuwbouw.nl';

-- 3. Show all records for this email
SELECT 
  'All records for m.eisema@leeuwbouw.nl' as check_type,
  id,
  name,
  first_name,
  last_name,
  email,
  company_id,
  campaign_id,
  qualification_status,
  created_at
FROM contacts
WHERE email = 'm.eisema@leeuwbouw.nl';

-- 4. Check if contacts_optimized view has duplicates
SELECT 
  'Duplicate emails in contacts_optimized view' as check_type,
  email,
  COUNT(*) as count
FROM contacts_optimized
WHERE email IS NOT NULL AND email != ''
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;

-- 5. Check specific email in contacts_optimized view
SELECT 
  'Records in contacts_optimized for m.eisema@leeuwbouw.nl' as check_type,
  COUNT(*) as count
FROM contacts_optimized
WHERE email = 'm.eisema@leeuwbouw.nl';

-- 6. Show all fields for this email in contacts_optimized
SELECT 
  'Details from contacts_optimized' as check_type,
  id,
  name,
  email,
  company_id,
  company_name,
  campaign_id,
  campaign_name,
  qualification_status
FROM contacts_optimized
WHERE email = 'm.eisema@leeuwbouw.nl';

-- 7. Check the view definition of contacts_optimized
SELECT 
  'View definition check' as check_type,
  viewname,
  definition
FROM pg_views
WHERE viewname = 'contacts_optimized'
AND schemaname = 'public';

-- 8. Check if there are any join issues causing duplicates
WITH contact_companies AS (
  SELECT 
    c.id as contact_id,
    c.email,
    c.company_id,
    comp.id as joined_company_id,
    comp.name as company_name
  FROM contacts c
  LEFT JOIN companies comp ON c.company_id = comp.id
  WHERE c.email = 'm.eisema@leeuwbouw.nl'
)
SELECT 
  'Join analysis for m.eisema@leeuwbouw.nl' as check_type,
  *
FROM contact_companies;

-- 9. Count total records in both tables
SELECT 
  'Record counts' as check_type,
  (SELECT COUNT(*) FROM contacts) as contacts_count,
  (SELECT COUNT(*) FROM contacts_optimized) as contacts_optimized_count,
  (SELECT COUNT(DISTINCT id) FROM contacts) as unique_contact_ids,
  (SELECT COUNT(DISTINCT id) FROM contacts_optimized) as unique_optimized_ids;