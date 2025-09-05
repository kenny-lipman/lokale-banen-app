-- Create a view that replaces regions_with_job_postings_count
-- This will allow the existing code to work with the new cities table structure

CREATE OR REPLACE VIEW regions_with_job_postings_count AS
SELECT 
  c.id,
  c.regio_platform,
  c.plaats,
  c.postcode,
  c.created_at,
  c.is_active,
  c.platform_id,
  COALESCE(job_counts.job_postings_count, 0) as job_postings_count
FROM cities c
LEFT JOIN (
  SELECT 
    region_id,
    COUNT(*) as job_postings_count
  FROM job_postings 
  GROUP BY region_id
) job_counts ON c.id = job_counts.region_id;

-- If the above doesn't work because the column names don't match,
-- try this alternative that doesn't rely on job_postings having a region_id:

-- CREATE OR REPLACE VIEW regions_with_job_postings_count AS
-- SELECT 
--   c.id,
--   c.regio_platform,
--   c.plaats,
--   c.postcode,
--   c.created_at,
--   c.is_active,
--   c.platform_id,
--   0 as job_postings_count  -- Placeholder until we determine the correct relationship
-- FROM cities c;