-- =====================================================
-- Remove Session Dependencies Migration
-- This migration removes foreign key constraints and session-related
-- dependencies to support the simplified OTIS workflow
-- =====================================================

-- 1. Drop foreign key constraint on apify_runs.session_id
ALTER TABLE apify_runs DROP CONSTRAINT IF EXISTS apify_runs_session_id_fkey;

-- 2. Make session_id nullable in apify_runs (if not already)
ALTER TABLE apify_runs ALTER COLUMN session_id DROP NOT NULL;

-- 3. Drop foreign key constraints on otis_workflow_data
ALTER TABLE otis_workflow_data DROP CONSTRAINT IF EXISTS otis_workflow_data_session_id_fkey;

-- 4. Drop foreign key constraints on otis_progress_events
ALTER TABLE otis_progress_events DROP CONSTRAINT IF EXISTS otis_progress_events_session_id_fkey;

-- 5. Drop session-related indexes that are no longer needed
DROP INDEX IF EXISTS idx_otis_workflow_sessions_session_id;
DROP INDEX IF EXISTS idx_otis_workflow_sessions_user_id;
DROP INDEX IF EXISTS idx_otis_workflow_sessions_status;
DROP INDEX IF EXISTS idx_otis_workflow_data_session_id;
DROP INDEX IF EXISTS idx_otis_progress_events_session_id;

-- 6. Drop session-related triggers
DROP TRIGGER IF EXISTS update_otis_workflow_sessions_updated_at ON otis_workflow_sessions;
DROP TRIGGER IF EXISTS update_otis_workflow_data_updated_at ON otis_workflow_data;

-- 7. Drop session-related tables (optional - comment out if you want to keep them for reference)
-- DROP TABLE IF EXISTS otis_workflow_data CASCADE;
-- DROP TABLE IF EXISTS otis_progress_events CASCADE;
-- DROP TABLE IF EXISTS otis_workflow_sessions CASCADE;

-- 8. Drop session-related RLS policies
DROP POLICY IF EXISTS "Users can view their own workflow sessions" ON otis_workflow_sessions;
DROP POLICY IF EXISTS "Users can insert their own workflow sessions" ON otis_workflow_sessions;
DROP POLICY IF EXISTS "Users can update their own workflow sessions" ON otis_workflow_sessions;

DROP POLICY IF EXISTS "Users can view their own workflow data" ON otis_workflow_data;
DROP POLICY IF EXISTS "Users can insert their own workflow data" ON otis_workflow_data;
DROP POLICY IF EXISTS "Users can update their own workflow data" ON otis_workflow_data;

DROP POLICY IF EXISTS "Users can view their own progress events" ON otis_progress_events;
DROP POLICY IF EXISTS "Users can insert their own progress events" ON otis_progress_events;

-- 9. Disable RLS on session tables (since we're not using them)
ALTER TABLE otis_workflow_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE otis_workflow_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE otis_progress_events DISABLE ROW LEVEL SECURITY;

-- 10. Add index for job tracking (if not exists)
CREATE INDEX IF NOT EXISTS idx_apify_runs_job_id ON apify_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_apify_runs_created_at ON apify_runs(created_at);

-- =====================================================
-- Migration Complete!
-- =====================================================

-- Verify the changes
SELECT 
    table_name,
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns 
WHERE table_name = 'apify_runs' 
AND column_name = 'session_id';

-- Check remaining constraints
SELECT 
    constraint_name,
    table_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'apify_runs'
AND constraint_type = 'FOREIGN KEY'; 