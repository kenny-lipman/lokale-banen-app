-- Migration: 016_add_contact_qualification_fields.sql
-- Add qualification status tracking to contacts table

-- Add qualification fields to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS qualification_status VARCHAR(20) DEFAULT 'pending' CHECK (qualification_status IN ('pending', 'qualified', 'disqualified', 'review'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS qualification_timestamp TIMESTAMP WITH TIME ZONE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS qualified_by_user UUID REFERENCES auth.users(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS qualification_notes TEXT;

-- Add contact priority and key contact flags
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_key_contact BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_priority INTEGER DEFAULT 5 CHECK (contact_priority BETWEEN 1 AND 10);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_qualification_status ON contacts(qualification_status);
CREATE INDEX IF NOT EXISTS idx_contacts_qualification_timestamp ON contacts(qualification_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_qualified_by_user ON contacts(qualified_by_user);
CREATE INDEX IF NOT EXISTS idx_contacts_is_key_contact ON contacts(is_key_contact);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_priority ON contacts(contact_priority);
CREATE INDEX IF NOT EXISTS idx_contacts_company_qualification ON contacts(company_id, qualification_status);

-- Add comments for documentation
COMMENT ON COLUMN contacts.qualification_status IS 'Contact qualification status: pending, qualified, disqualified, review';
COMMENT ON COLUMN contacts.qualification_timestamp IS 'When the contact was last qualified/disqualified';
COMMENT ON COLUMN contacts.qualified_by_user IS 'User who performed the qualification action';
COMMENT ON COLUMN contacts.qualification_notes IS 'Optional notes about the qualification decision';
COMMENT ON COLUMN contacts.is_key_contact IS 'Whether this contact is marked as a key contact for their company';
COMMENT ON COLUMN contacts.contact_priority IS 'Contact priority ranking (1=highest, 10=lowest)';

-- Update existing contacts to have default qualification status
UPDATE contacts SET qualification_status = 'pending' WHERE qualification_status IS NULL;
UPDATE contacts SET is_key_contact = FALSE WHERE is_key_contact IS NULL;
UPDATE contacts SET contact_priority = 5 WHERE contact_priority IS NULL;