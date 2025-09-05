-- =====================================================
-- Migration: Add automation_enabled to platforms table
-- Purpose: Move from per-user automation preferences to global platform settings
-- Date: 2025-01-26
-- =====================================================

-- Step 1: Add automation_enabled column to platforms table
ALTER TABLE platforms 
ADD COLUMN IF NOT EXISTS automation_enabled BOOLEAN DEFAULT false;

-- Step 2: Migrate existing preferences (take the most common setting per platform)
-- This will set automation_enabled to true if ANY user had it enabled for that platform
UPDATE platforms p
SET automation_enabled = EXISTS (
    SELECT 1 
    FROM user_platform_automation_preferences upap 
    WHERE upap.regio_platform = p.regio_platform 
    AND upap.automation_enabled = true
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 
    FROM user_platform_automation_preferences upap 
    WHERE upap.regio_platform = p.regio_platform
);

-- Step 3: Add index for better performance
CREATE INDEX IF NOT EXISTS idx_platforms_automation_enabled ON platforms(automation_enabled);
CREATE INDEX IF NOT EXISTS idx_platforms_regio_platform ON platforms(regio_platform);

-- Step 4: Add comment to document the column
COMMENT ON COLUMN platforms.automation_enabled IS 'Global automation setting for this platform - determines if daily scraping is enabled';

-- Note: The user_platform_automation_preferences table is NOT dropped in this migration
-- to allow for rollback if needed. It can be dropped in a future cleanup migration
-- after confirming the new system works correctly.