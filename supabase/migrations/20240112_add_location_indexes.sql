-- Add indexes for improved location query performance
-- These indexes help optimize queries when filtering by location fields

-- Index for companies location field
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_location 
  ON companies(location)
  WHERE location IS NOT NULL;

-- Index for job_postings location field  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_postings_location 
  ON job_postings(location)
  WHERE location IS NOT NULL;

-- Index for job_postings company_id for faster joins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_postings_company_id 
  ON job_postings(company_id);

-- Composite index for job_postings to optimize location queries with company joins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_postings_company_location
  ON job_postings(company_id, location)
  WHERE location IS NOT NULL;