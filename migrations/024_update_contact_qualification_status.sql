-- Migration: Update qualification_status for all contacts
-- This migration ensures all contacts have proper qualification_status values

-- First, let's see the current distribution
DO $$
BEGIN
  RAISE NOTICE 'Current qualification_status distribution:';
END $$;

SELECT 
  qualification_status, 
  COUNT(*) as count,
  COUNT(CASE WHEN campaign_id IS NOT NULL AND campaign_id != '' THEN 1 END) as with_campaign
FROM contacts
GROUP BY qualification_status
ORDER BY qualification_status;

-- Update qualification_status based on business rules
UPDATE contacts
SET qualification_status = 
  CASE
    -- Rule 1: If contact has a campaign_id, set to 'in_campaign'
    WHEN campaign_id IS NOT NULL AND campaign_id != '' THEN 'in_campaign'
    
    -- Rule 2: Keep existing qualified status
    WHEN qualification_status = 'qualified' THEN 'qualified'
    
    -- Rule 3: Keep existing review status
    WHEN qualification_status = 'review' THEN 'review'
    
    -- Rule 4: Keep existing disqualified status
    WHEN qualification_status = 'disqualified' THEN 'disqualified'
    
    -- Rule 5: Everything else becomes pending (including NULL and empty values)
    ELSE 'pending'
  END
WHERE 
  -- Only update records that need changes
  (campaign_id IS NOT NULL AND campaign_id != '' AND (qualification_status != 'in_campaign' OR qualification_status IS NULL))
  OR qualification_status IS NULL
  OR qualification_status = ''
  OR (qualification_status NOT IN ('qualified', 'review', 'disqualified', 'in_campaign', 'pending'));

-- Ensure no NULL values remain
UPDATE contacts
SET qualification_status = 'pending'
WHERE qualification_status IS NULL OR qualification_status = '';

-- Add NOT NULL constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'contacts'
    AND column_name = 'qualification_status'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE contacts ALTER COLUMN qualification_status SET NOT NULL;
  END IF;
END $$;

-- Add default value for new records
ALTER TABLE contacts ALTER COLUMN qualification_status SET DEFAULT 'pending';

-- Create check constraint to ensure valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'contacts'
    AND constraint_name = 'contacts_qualification_status_check'
  ) THEN
    ALTER TABLE contacts 
    ADD CONSTRAINT contacts_qualification_status_check 
    CHECK (qualification_status IN ('pending', 'qualified', 'review', 'disqualified', 'in_campaign'));
  END IF;
END $$;

-- Show the updated distribution
DO $$
BEGIN
  RAISE NOTICE 'Updated qualification_status distribution:';
END $$;

SELECT 
  qualification_status, 
  COUNT(*) as count,
  COUNT(CASE WHEN campaign_id IS NOT NULL AND campaign_id != '' THEN 1 END) as with_campaign
FROM contacts
GROUP BY qualification_status
ORDER BY qualification_status;

-- Create or update a trigger to maintain qualification_status consistency
CREATE OR REPLACE FUNCTION maintain_qualification_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If a campaign_id is set, automatically set qualification_status to 'in_campaign'
  IF NEW.campaign_id IS NOT NULL AND NEW.campaign_id != '' THEN
    NEW.qualification_status := 'in_campaign';
  -- If campaign_id is removed and status is 'in_campaign', reset to 'pending'
  ELSIF (NEW.campaign_id IS NULL OR NEW.campaign_id = '') AND NEW.qualification_status = 'in_campaign' THEN
    NEW.qualification_status := 'pending';
  -- Ensure qualification_status is never NULL
  ELSIF NEW.qualification_status IS NULL OR NEW.qualification_status = '' THEN
    NEW.qualification_status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS maintain_qualification_status_trigger ON contacts;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER maintain_qualification_status_trigger
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION maintain_qualification_status();

-- Add comment explaining the field
COMMENT ON COLUMN contacts.qualification_status IS 'Contact qualification status: pending, qualified, review, disqualified, or in_campaign. Automatically set to in_campaign when campaign_id is present.';