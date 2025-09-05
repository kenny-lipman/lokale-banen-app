-- Check what columns are available in the companies table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'companies'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if companies table has region-related columns
SELECT 
  'Region columns in companies table' as check_type,
  COUNT(*) FILTER (WHERE column_name = 'region') as has_region,
  COUNT(*) FILTER (WHERE column_name = 'region_id') as has_region_id,
  COUNT(*) FILTER (WHERE column_name = 'regio_platform') as has_regio_platform,
  COUNT(*) FILTER (WHERE column_name = 'source_id') as has_source_id,
  COUNT(*) FILTER (WHERE column_name = 'source_name') as has_source_name
FROM information_schema.columns
WHERE table_name = 'companies'
  AND table_schema = 'public';

-- Check how many companies have multiple job postings (causing duplicates)
SELECT 
  'Companies with multiple job postings' as check_type,
  COUNT(DISTINCT company_id) as companies_with_job_postings,
  COUNT(*) as total_job_postings,
  ROUND(AVG(posting_count), 2) as avg_postings_per_company,
  MAX(posting_count) as max_postings_per_company
FROM (
  SELECT company_id, COUNT(*) as posting_count
  FROM job_postings
  WHERE company_id IS NOT NULL
  GROUP BY company_id
) company_posting_counts;

-- Show specific example of a company with multiple postings
WITH company_duplicates AS (
  SELECT company_id, COUNT(*) as posting_count
  FROM job_postings
  WHERE company_id IS NOT NULL
  GROUP BY company_id
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC
  LIMIT 5
)
SELECT 
  'Example companies causing duplicates' as check_type,
  c.id,
  c.name,
  cd.posting_count,
  COUNT(DISTINCT cont.id) as contact_count,
  COUNT(DISTINCT cont.id) * cd.posting_count as expected_duplicates
FROM company_duplicates cd
JOIN companies c ON c.id = cd.company_id
LEFT JOIN contacts cont ON cont.company_id = c.id
GROUP BY c.id, c.name, cd.posting_count;