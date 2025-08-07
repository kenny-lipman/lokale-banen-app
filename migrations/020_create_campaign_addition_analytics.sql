-- Migration: Create campaign_addition_analytics table
-- Description: Track campaign addition attempts, modal usage, and API performance

CREATE TABLE IF NOT EXISTS campaign_addition_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL CHECK (event_type IN ('campaign_addition_attempt', 'modal_shown', 'modal_confirmed', 'api_error')),
    campaign_id TEXT,
    campaign_name TEXT,
    contact_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id TEXT,
    modal_shown BOOLEAN DEFAULT FALSE,
    modal_confirmed BOOLEAN DEFAULT FALSE,
    processing_time_ms INTEGER,
    error_codes TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_addition_analytics_event_type ON campaign_addition_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_campaign_addition_analytics_timestamp ON campaign_addition_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_campaign_addition_analytics_campaign_id ON campaign_addition_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_addition_analytics_user_id ON campaign_addition_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_addition_analytics_session_id ON campaign_addition_analytics(session_id);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_campaign_addition_analytics_event_timestamp ON campaign_addition_analytics(event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_campaign_addition_analytics_campaign_timestamp ON campaign_addition_analytics(campaign_id, timestamp);

-- Add RLS (Row Level Security) policies
ALTER TABLE campaign_addition_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own analytics data
CREATE POLICY "Users can view their own analytics" ON campaign_addition_analytics
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own analytics data
CREATE POLICY "Users can insert their own analytics" ON campaign_addition_analytics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can access all analytics data (for admin purposes)
CREATE POLICY "Service role can access all analytics" ON campaign_addition_analytics
    FOR ALL USING (auth.role() = 'service_role');

-- Create a function to clean up old analytics data (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_campaign_analytics()
RETURNS void AS $$
BEGIN
    DELETE FROM campaign_addition_analytics 
    WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up old data (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-campaign-analytics', '0 2 * * *', 'SELECT cleanup_old_campaign_analytics();');

-- Add comments for documentation
COMMENT ON TABLE campaign_addition_analytics IS 'Tracks campaign addition events, modal usage, and API performance metrics';
COMMENT ON COLUMN campaign_addition_analytics.event_type IS 'Type of event: campaign_addition_attempt, modal_shown, modal_confirmed, api_error';
COMMENT ON COLUMN campaign_addition_analytics.modal_shown IS 'Whether the confirmation modal was shown to the user';
COMMENT ON COLUMN campaign_addition_analytics.modal_confirmed IS 'Whether the user confirmed the action in the modal';
COMMENT ON COLUMN campaign_addition_analytics.processing_time_ms IS 'Time taken to process the campaign addition in milliseconds';
COMMENT ON COLUMN campaign_addition_analytics.error_codes IS 'Array of error codes if the operation failed';
COMMENT ON COLUMN campaign_addition_analytics.metadata IS 'Additional metadata about the event'; 