-- Migration: Create user_automation_preferences table
-- Description: Table to store user preferences for regional automation toggles

-- Create the main table
CREATE TABLE user_automation_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
  automation_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, region_id)
);

-- Create performance indexes
CREATE INDEX idx_user_automation_preferences_user_id ON user_automation_preferences(user_id);
CREATE INDEX idx_user_automation_preferences_region_id ON user_automation_preferences(region_id);
CREATE INDEX idx_user_automation_preferences_enabled ON user_automation_preferences(automation_enabled);
CREATE INDEX idx_user_automation_preferences_user_enabled ON user_automation_preferences(user_id, automation_enabled);

-- Enable Row Level Security
ALTER TABLE user_automation_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own automation preferences"
  ON user_automation_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own automation preferences"
  ON user_automation_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own automation preferences"
  ON user_automation_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own automation preferences"
  ON user_automation_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Create or replace the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_user_automation_preferences_updated_at 
  BEFORE UPDATE ON user_automation_preferences 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function for batch upsert of automation preferences
CREATE OR REPLACE FUNCTION upsert_automation_preferences(
  p_user_id UUID,
  p_preferences JSONB
) RETURNS VOID AS $$
BEGIN
  -- Delete existing preferences for user
  DELETE FROM user_automation_preferences WHERE user_id = p_user_id;
  
  -- Insert new preferences
  INSERT INTO user_automation_preferences (user_id, region_id, automation_enabled)
  SELECT 
    p_user_id,
    (value->>'region_id')::UUID,
    (value->>'automation_enabled')::BOOLEAN
  FROM jsonb_array_elements(p_preferences);
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE user_automation_preferences IS 'Stores user preferences for regional automation toggles';
COMMENT ON COLUMN user_automation_preferences.user_id IS 'Reference to auth.users table';
COMMENT ON COLUMN user_automation_preferences.region_id IS 'Reference to regions table';
COMMENT ON COLUMN user_automation_preferences.automation_enabled IS 'Whether automation is enabled for this region';
COMMENT ON FUNCTION upsert_automation_preferences IS 'Batch upsert function for automation preferences'; 