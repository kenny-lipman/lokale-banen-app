-- Update blocklist_entries table to support new block types
-- This migration updates the schema to match the new UI requirements

-- First, add new columns without constraints
ALTER TABLE public.blocklist_entries
ADD COLUMN IF NOT EXISTS block_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS blocklist_level VARCHAR(20),
ADD COLUMN IF NOT EXISTS instantly_id TEXT;

-- Update existing data: copy type to block_type
UPDATE public.blocklist_entries
SET block_type = type
WHERE block_type IS NULL;

-- Update existing data: set blocklist_level based on type
UPDATE public.blocklist_entries
SET blocklist_level = CASE
  WHEN type = 'email' THEN 'contact'
  WHEN type = 'domain' THEN 'domain'
  ELSE 'domain'
END
WHERE blocklist_level IS NULL;

-- Make value nullable (company blocks don't need value)
ALTER TABLE public.blocklist_entries ALTER COLUMN value DROP NOT NULL;

-- Drop old constraint on type
ALTER TABLE public.blocklist_entries DROP CONSTRAINT IF EXISTS blocklist_entries_type_check;

-- Add new constraint for block_type
ALTER TABLE public.blocklist_entries
ADD CONSTRAINT blocklist_entries_block_type_check
CHECK (block_type IN ('email', 'domain', 'company', 'contact'));

-- Add new constraint for blocklist_level
ALTER TABLE public.blocklist_entries
ADD CONSTRAINT blocklist_entries_blocklist_level_check
CHECK (blocklist_level IN ('contact', 'domain', 'organization'));

-- Update unique constraint to be more flexible
ALTER TABLE public.blocklist_entries DROP CONSTRAINT IF EXISTS unique_blocklist_value;

-- Add new unique constraints based on block type
-- Email blocks: unique by value
-- Domain blocks: unique by value
-- Company blocks: unique by company_id
-- Contact blocks: unique by contact_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocklist_email_unique
ON public.blocklist_entries(value)
WHERE block_type = 'email' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocklist_domain_unique
ON public.blocklist_entries(value)
WHERE block_type = 'domain' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocklist_company_unique
ON public.blocklist_entries(company_id)
WHERE block_type = 'company' AND is_active = true AND company_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocklist_contact_unique
ON public.blocklist_entries(contact_id)
WHERE block_type = 'contact' AND is_active = true AND contact_id IS NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_blocklist_entries_block_type ON public.blocklist_entries(block_type);
CREATE INDEX IF NOT EXISTS idx_blocklist_entries_company_id ON public.blocklist_entries(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blocklist_entries_contact_id ON public.blocklist_entries(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blocklist_entries_blocklist_level ON public.blocklist_entries(blocklist_level);
CREATE INDEX IF NOT EXISTS idx_blocklist_entries_pipedrive_sync ON public.blocklist_entries(pipedrive_synced) WHERE pipedrive_synced IS NOT NULL;

-- Update comments
COMMENT ON COLUMN public.blocklist_entries.block_type IS 'Type of entry: email, domain, company, or contact';
COMMENT ON COLUMN public.blocklist_entries.value IS 'The email address or domain to block (nullable for company/contact blocks)';
COMMENT ON COLUMN public.blocklist_entries.company_id IS 'Company ID for company-level blocks';
COMMENT ON COLUMN public.blocklist_entries.contact_id IS 'Contact ID for contact-level blocks';
COMMENT ON COLUMN public.blocklist_entries.blocklist_level IS 'Level of blocking: contact, domain, or organization';
COMMENT ON COLUMN public.blocklist_entries.instantly_id IS 'ID from Instantly API for tracking synced entries';