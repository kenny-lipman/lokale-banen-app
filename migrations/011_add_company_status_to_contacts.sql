-- Add company_status column to contacts table
ALTER TABLE contacts 
ADD COLUMN company_status VARCHAR(50) DEFAULT 'Prospect';

-- Add comment to explain the column
COMMENT ON COLUMN contacts.company_status IS 'Status of the contact (Prospect, Qualified, Disqualified)';

-- Create index for better performance on status queries
CREATE INDEX idx_contacts_company_status ON contacts(company_status); 