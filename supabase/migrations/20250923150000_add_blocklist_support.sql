-- Add blocklist support to contacts table
-- This migration adds the is_blocked column and necessary indexes for efficient blocklist operations

-- Add is_blocked column with default false
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;

-- Add index for efficient querying of blocked contacts
CREATE INDEX IF NOT EXISTS idx_contacts_blocked ON contacts(is_blocked) WHERE is_blocked = true;

-- Add comment to document the purpose
COMMENT ON COLUMN contacts.is_blocked IS 'Indicates if this contact should be blocked from receiving communications';