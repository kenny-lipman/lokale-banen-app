-- Migration: Add Instantly tracking fields to contacts table
-- This tracks the lifecycle of contacts through Instantly campaigns and syncing to Pipedrive

-- Add Instantly tracking columns to contacts table
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS instantly_synced BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS instantly_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS instantly_status TEXT,
ADD COLUMN IF NOT EXISTS instantly_campaign_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS instantly_id TEXT,
ADD COLUMN IF NOT EXISTS instantly_removed_at TIMESTAMPTZ;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_contacts_instantly_synced
  ON public.contacts(instantly_synced)
  WHERE instantly_synced = TRUE;

CREATE INDEX IF NOT EXISTS idx_contacts_instantly_removed
  ON public.contacts(instantly_removed_at)
  WHERE instantly_removed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_instantly_status
  ON public.contacts(instantly_status)
  WHERE instantly_status IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.contacts.instantly_synced IS 'Whether this contact has been synced from Instantly to Pipedrive';
COMMENT ON COLUMN public.contacts.instantly_synced_at IS 'When the contact was synced from Instantly to Pipedrive';
COMMENT ON COLUMN public.contacts.instantly_status IS 'Current Instantly status: reply_received, lead_interested, lead_not_interested, campaign_completed, in_campaign';
COMMENT ON COLUMN public.contacts.instantly_campaign_ids IS 'Array of Instantly campaign IDs this contact has been part of';
COMMENT ON COLUMN public.contacts.instantly_id IS 'The lead ID from Instantly API';
COMMENT ON COLUMN public.contacts.instantly_removed_at IS 'When the contact was removed from Instantly (after sync to Pipedrive)';

-- Add new qualification_status value for contacts removed from Instantly
-- Note: We use the existing qualification_status field, adding 'synced_to_pipedrive' as a valid status
-- The flow is: in_campaign -> synced_to_pipedrive (when removed from Instantly and in Pipedrive)
