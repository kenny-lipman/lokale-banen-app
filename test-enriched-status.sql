-- Test script to verify 'enriched' status implementation
-- Run this against your database to test the migration

-- 1. Check if constraint allows 'enriched' status
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'companies_qualification_status_check';

-- 2. Test updating a company to 'enriched' status
-- (This should work after the migration)
UPDATE companies 
SET qualification_status = 'enriched'
WHERE id = (SELECT id FROM companies WHERE qualification_status = 'qualified' LIMIT 1)
RETURNING id, name, qualification_status;

-- 3. Check how many companies were marked as enriched by the migration
SELECT 
  qualification_status,
  COUNT(*) as count,
  COUNT(CASE WHEN apollo_enriched_at IS NOT NULL THEN 1 END) as has_apollo_data
FROM companies
GROUP BY qualification_status
ORDER BY qualification_status;

-- 4. Verify the index was created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'companies' 
AND indexname = 'idx_companies_enriched';

-- 5. Sample of enriched companies
SELECT id, name, qualification_status, apollo_enriched_at, apollo_contacts_count
FROM companies
WHERE qualification_status = 'enriched'
LIMIT 5;