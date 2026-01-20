-- Migration: Add campaign_completed_at for delayed Instantly removal
-- When a campaign completes, we wait 10 days before removing the lead from Instantly
-- This gives late responders a chance to reply

-- Add campaign_completed_at column
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS instantly_campaign_completed_at TIMESTAMPTZ;

-- Add index for efficient querying of leads to be cleaned up
CREATE INDEX IF NOT EXISTS idx_contacts_instantly_campaign_completed
  ON public.contacts(instantly_campaign_completed_at)
  WHERE instantly_campaign_completed_at IS NOT NULL
    AND instantly_removed_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.contacts.instantly_campaign_completed_at IS 'When the Instantly campaign completed for this contact. Used for delayed removal (10 days after completion).';
