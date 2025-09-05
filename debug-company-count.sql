-- Debug query to check company count for specific run
-- Run this in your database to see what's happening

SELECT 
  'Total job_postings for run E7P3IvTrK229btaOc:' as description,
  COUNT(*) as count
FROM job_postings 
WHERE apify_run_id = 'E7P3IvTrK229btaOc'

UNION ALL

SELECT 
  'Job_postings with company_id for run E7P3IvTrK229btaOc:' as description,
  COUNT(*) as count
FROM job_postings 
WHERE apify_run_id = 'E7P3IvTrK229btaOc' 
AND company_id IS NOT NULL

UNION ALL

SELECT 
  'Unique companies for run E7P3IvTrK229btaOc:' as description,
  COUNT(DISTINCT company_id) as count
FROM job_postings 
WHERE apify_run_id = 'E7P3IvTrK229btaOc' 
AND company_id IS NOT NULL;

-- Also show a sample of the data
SELECT 
  id,
  apify_run_id,
  company_id,
  title,
  created_at
FROM job_postings 
WHERE apify_run_id = 'E7P3IvTrK229btaOc'
LIMIT 10;