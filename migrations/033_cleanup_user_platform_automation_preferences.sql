-- =====================================================
-- Cleanup Migration: Remove user_platform_automation_preferences table
-- Purpose: Clean up after migration to platforms table
-- Date: 2025-01-26
-- WARNING: Only run this after confirming the new system works correctly!
-- =====================================================

-- Step 1: Create a backup table first (optional safety measure)
-- Uncomment the following lines if you want to keep a backup:
-- CREATE TABLE user_platform_automation_preferences_backup AS 
-- SELECT * FROM user_platform_automation_preferences;

-- Step 2: Drop the old table (ONLY after confirming new system works)
-- IMPORTANT: Test the new system thoroughly before running this!
-- DROP TABLE IF EXISTS user_platform_automation_preferences;

-- For now, just add a comment to mark the table as deprecated
COMMENT ON TABLE user_platform_automation_preferences IS 'DEPRECATED: Replaced by automation_enabled column in platforms table. Safe to drop after confirming migration works.';

-- Step 3: Remove any unused indexes (if they exist)
-- DROP INDEX IF EXISTS idx_user_platform_automation_preferences_user_id;
-- DROP INDEX IF EXISTS idx_user_platform_automation_preferences_platform;

-- Note: The actual DROP statements are commented out for safety.
-- Uncomment and run them only after thoroughly testing the new system.