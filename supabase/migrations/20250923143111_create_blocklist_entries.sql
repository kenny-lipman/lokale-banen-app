-- Create blocklist_entries table for managing blocked emails and domains
CREATE TABLE IF NOT EXISTS public.blocklist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(10) NOT NULL CHECK (type IN ('email', 'domain')),
  value TEXT NOT NULL,
  reason TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- External platform sync tracking
  instantly_synced BOOLEAN DEFAULT FALSE,
  instantly_synced_at TIMESTAMP WITH TIME ZONE,
  instantly_error TEXT,
  pipedrive_synced BOOLEAN DEFAULT FALSE,
  pipedrive_synced_at TIMESTAMP WITH TIME ZONE,
  pipedrive_error TEXT,

  -- Ensure unique entries per type
  CONSTRAINT unique_blocklist_value UNIQUE(type, value)
);

-- Create indexes for performance
CREATE INDEX idx_blocklist_entries_type_value ON public.blocklist_entries(type, value);
CREATE INDEX idx_blocklist_entries_active ON public.blocklist_entries(is_active) WHERE is_active = true;
CREATE INDEX idx_blocklist_entries_created_at ON public.blocklist_entries(created_at);
CREATE INDEX idx_blocklist_entries_value_lower ON public.blocklist_entries(LOWER(value));

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_blocklist_entries_updated_at BEFORE UPDATE
    ON public.blocklist_entries FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE public.blocklist_entries ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read blocklist entries
CREATE POLICY "Authenticated users can read blocklist entries"
    ON public.blocklist_entries FOR SELECT
    TO authenticated
    USING (true);

-- Policy: All authenticated users can create blocklist entries
CREATE POLICY "Authenticated users can create blocklist entries"
    ON public.blocklist_entries FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Policy: Users can update their own blocklist entries
CREATE POLICY "Users can update own blocklist entries"
    ON public.blocklist_entries FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by);

-- Policy: Users can delete their own blocklist entries
CREATE POLICY "Users can delete own blocklist entries"
    ON public.blocklist_entries FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by);

-- Add comments for documentation
COMMENT ON TABLE public.blocklist_entries IS 'Table for storing blocked email addresses and domains';
COMMENT ON COLUMN public.blocklist_entries.type IS 'Type of entry: email or domain';
COMMENT ON COLUMN public.blocklist_entries.value IS 'The email address or domain to block';
COMMENT ON COLUMN public.blocklist_entries.reason IS 'Reason for blocking this entry';
COMMENT ON COLUMN public.blocklist_entries.is_active IS 'Whether this blocklist entry is currently active';
COMMENT ON COLUMN public.blocklist_entries.instantly_synced IS 'Whether this entry has been synced to Instantly';
COMMENT ON COLUMN public.blocklist_entries.pipedrive_synced IS 'Whether this entry has been synced to Pipedrive';