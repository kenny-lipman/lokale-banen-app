-- =====================================================
-- Add platform costs and webhook URLs to job_sources
-- =====================================================

-- Add cost_per_1000_results and webhook_url columns to job_sources table
ALTER TABLE job_sources 
ADD COLUMN IF NOT EXISTS cost_per_1000_results DECIMAL(10,2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Update existing platforms with their costs and webhooks
UPDATE job_sources 
SET 
  cost_per_1000_results = 5.00,
  webhook_url = 'https://ba.grive-dev.com/webhook/b60d9c80-64a8-49bb-9d15-9a1618ed52e9'
WHERE name = 'linkedin';

UPDATE job_sources 
SET 
  cost_per_1000_results = 5.00,
  webhook_url = 'https://ba.grive-dev.com/webhook/indeed-webhook'
WHERE name = 'indeed';

-- Insert LinkedIn if it doesn't exist
INSERT INTO job_sources (id, name, cost_per_1000_results, webhook_url, active)
SELECT 
  gen_random_uuid(),
  'linkedin',
  5.00,
  'https://ba.grive-dev.com/webhook/b60d9c80-64a8-49bb-9d15-9a1618ed52e9',
  true
WHERE NOT EXISTS (SELECT 1 FROM job_sources WHERE name = 'linkedin');

-- Insert Indeed if it doesn't exist
INSERT INTO job_sources (id, name, cost_per_1000_results, webhook_url, active)
SELECT 
  gen_random_uuid(),
  'indeed',
  5.00,
  'https://ba.grive-dev.com/webhook/indeed-webhook',
  true
WHERE NOT EXISTS (SELECT 1 FROM job_sources WHERE name = 'indeed');

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_job_sources_name ON job_sources(name);
CREATE INDEX IF NOT EXISTS idx_job_sources_active ON job_sources(active); 