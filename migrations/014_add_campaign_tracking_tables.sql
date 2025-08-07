-- Migration: 014_add_campaign_tracking_tables.sql
-- Add tables for tracking campaign additions and contact selections

-- Create campaign_additions table for logging campaign operations
CREATE TABLE IF NOT EXISTS campaign_additions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id VARCHAR(255) NOT NULL,
    campaign_name VARCHAR(255),
    added_by UUID REFERENCES auth.users(id),
    contacts_added INTEGER NOT NULL DEFAULT 0,
    contacts_failed INTEGER NOT NULL DEFAULT 0,
    total_contacts INTEGER NOT NULL DEFAULT 0,
    results JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create contact_selections table for tracking user selections during workflow
CREATE TABLE IF NOT EXISTS contact_selections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255),
    user_id UUID REFERENCES auth.users(id),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    apify_run_id VARCHAR(255),
    selected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    selection_type VARCHAR(50) DEFAULT 'manual' CHECK (selection_type IN ('manual', 'bulk_company', 'bulk_qualification')),
    is_selected BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique contact per session
    UNIQUE(session_id, contact_id)
);

-- Add campaign tracking fields to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS campaign_added_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS campaign_status VARCHAR(50) DEFAULT 'not_in_campaign' CHECK (campaign_status IN ('not_in_campaign', 'pending_addition', 'added', 'failed_addition', 'removed'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_additions_campaign_id ON campaign_additions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_additions_added_by ON campaign_additions(added_by);
CREATE INDEX IF NOT EXISTS idx_campaign_additions_created_at ON campaign_additions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_selections_session_id ON contact_selections(session_id);
CREATE INDEX IF NOT EXISTS idx_contact_selections_user_id ON contact_selections(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_selections_contact_id ON contact_selections(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_selections_company_id ON contact_selections(company_id);
CREATE INDEX IF NOT EXISTS idx_contact_selections_apify_run_id ON contact_selections(apify_run_id);
CREATE INDEX IF NOT EXISTS idx_contact_selections_created_at ON contact_selections(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_campaign_status ON contacts(campaign_status);
CREATE INDEX IF NOT EXISTS idx_contacts_campaign_added_at ON contacts(campaign_added_at DESC);

-- Create function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_campaign_additions_updated_at ON campaign_additions;
CREATE TRIGGER update_campaign_additions_updated_at
    BEFORE UPDATE ON campaign_additions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contact_selections_updated_at ON contact_selections;
CREATE TRIGGER update_contact_selections_updated_at
    BEFORE UPDATE ON contact_selections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE campaign_additions IS 'Logs all campaign addition operations with results and metadata';
COMMENT ON TABLE contact_selections IS 'Tracks user contact selections during the workflow for session management';
COMMENT ON COLUMN contacts.campaign_added_at IS 'When the contact was added to a campaign';
COMMENT ON COLUMN contacts.campaign_status IS 'Current campaign status of the contact';
COMMENT ON COLUMN contact_selections.selection_type IS 'How the contact was selected: manual, bulk_company, bulk_qualification';
COMMENT ON COLUMN contact_selections.is_selected IS 'Whether the contact is currently selected (allows for deselection tracking)';

-- Create RLS policies for campaign_additions
ALTER TABLE campaign_additions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaign additions" ON campaign_additions
    FOR SELECT USING (auth.uid() = added_by);

CREATE POLICY "Users can insert their own campaign additions" ON campaign_additions
    FOR INSERT WITH CHECK (auth.uid() = added_by);

-- Create RLS policies for contact_selections
ALTER TABLE contact_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contact selections" ON contact_selections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contact selections" ON contact_selections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contact selections" ON contact_selections
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contact selections" ON contact_selections
    FOR DELETE USING (auth.uid() = user_id);