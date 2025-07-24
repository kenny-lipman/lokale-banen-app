-- Migration: Add Workflow Tables for Otis UX Enhancement
-- Description: Creates tables for workflow session management and progress tracking
-- Date: December 2024
-- Author: Database Engineer

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create workflow sessions table
CREATE TABLE IF NOT EXISTS otis_workflow_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    current_stage VARCHAR(50) NOT NULL DEFAULT 'scraping',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    
    -- Add constraints
    CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'failed', 'paused')),
    CONSTRAINT valid_stage CHECK (current_stage IN ('scraping', 'enrichment', 'campaigns', 'results'))
);

-- Create workflow data table for storing stage-specific data
CREATE TABLE IF NOT EXISTS otis_workflow_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES otis_workflow_sessions(id) ON DELETE CASCADE,
    stage_name VARCHAR(50) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique data per session and stage
    UNIQUE(session_id, stage_name),
    
    -- Add constraints
    CONSTRAINT valid_stage_name CHECK (stage_name IN ('scraping', 'enrichment', 'campaigns', 'results'))
);

-- Create progress events table for detailed progress tracking
CREATE TABLE IF NOT EXISTS otis_progress_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES otis_workflow_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add constraints
    CONSTRAINT valid_event_type CHECK (event_type IN (
        'stage_started', 'stage_completed', 'stage_failed', 
        'progress_update', 'error_occurred', 'user_action'
    ))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflow_sessions_user_id ON otis_workflow_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_sessions_status ON otis_workflow_sessions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_sessions_current_stage ON otis_workflow_sessions(current_stage);
CREATE INDEX IF NOT EXISTS idx_workflow_sessions_created_at ON otis_workflow_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_sessions_expires_at ON otis_workflow_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_workflow_data_session_id ON otis_workflow_data(session_id);
CREATE INDEX IF NOT EXISTS idx_workflow_data_stage_name ON otis_workflow_data(stage_name);

CREATE INDEX IF NOT EXISTS idx_progress_events_session_id ON otis_progress_events(session_id);
CREATE INDEX IF NOT EXISTS idx_progress_events_event_type ON otis_progress_events(event_type);
CREATE INDEX IF NOT EXISTS idx_progress_events_created_at ON otis_progress_events(created_at);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_workflow_sessions_updated_at
    BEFORE UPDATE ON otis_workflow_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_data_updated_at
    BEFORE UPDATE ON otis_workflow_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for workflow session notifications (from previous migration)
DROP TRIGGER IF EXISTS workflow_sessions_notify ON otis_workflow_sessions;
CREATE TRIGGER workflow_sessions_notify
  AFTER INSERT OR UPDATE ON otis_workflow_sessions
  FOR EACH ROW EXECUTE FUNCTION notify_workflow_session();

-- Create trigger for progress events notifications
CREATE OR REPLACE FUNCTION notify_progress_event()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'otis_progress',
    json_build_object(
      'table', TG_TABLE_NAME,
      'action', TG_OP,
      'record', row_to_json(NEW),
      'timestamp', NOW()
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER progress_events_notify
  AFTER INSERT ON otis_progress_events
  FOR EACH ROW EXECUTE FUNCTION notify_progress_event();

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM otis_workflow_sessions 
  WHERE expires_at < NOW() AND status != 'completed';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired sessions (if using pg_cron)
-- SELECT cron.schedule('cleanup-expired-sessions', '0 2 * * *', 'SELECT cleanup_expired_sessions();');

-- Add RLS (Row Level Security) policies
ALTER TABLE otis_workflow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE otis_workflow_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE otis_progress_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for otis_workflow_sessions
CREATE POLICY "Users can view their own workflow sessions" ON otis_workflow_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workflow sessions" ON otis_workflow_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflow sessions" ON otis_workflow_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workflow sessions" ON otis_workflow_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for otis_workflow_data
CREATE POLICY "Users can view their own workflow data" ON otis_workflow_data
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM otis_workflow_sessions 
            WHERE otis_workflow_sessions.id = otis_workflow_data.session_id 
            AND otis_workflow_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own workflow data" ON otis_workflow_data
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM otis_workflow_sessions 
            WHERE otis_workflow_sessions.id = otis_workflow_data.session_id 
            AND otis_workflow_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own workflow data" ON otis_workflow_data
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM otis_workflow_sessions 
            WHERE otis_workflow_sessions.id = otis_workflow_data.session_id 
            AND otis_workflow_sessions.user_id = auth.uid()
        )
    );

-- Create RLS policies for otis_progress_events
CREATE POLICY "Users can view their own progress events" ON otis_progress_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM otis_workflow_sessions 
            WHERE otis_workflow_sessions.id = otis_progress_events.session_id 
            AND otis_workflow_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own progress events" ON otis_progress_events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM otis_workflow_sessions 
            WHERE otis_workflow_sessions.id = otis_progress_events.session_id 
            AND otis_workflow_sessions.user_id = auth.uid()
        )
    );

-- Grant necessary permissions
GRANT ALL ON otis_workflow_sessions TO authenticated;
GRANT ALL ON otis_workflow_data TO authenticated;
GRANT ALL ON otis_progress_events TO authenticated;
GRANT USAGE ON SEQUENCE otis_workflow_sessions_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE otis_workflow_data_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE otis_progress_events_id_seq TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE otis_workflow_sessions IS 'Stores workflow session information for the Otis UX enhancement';
COMMENT ON TABLE otis_workflow_data IS 'Stores stage-specific data for each workflow session';
COMMENT ON TABLE otis_progress_events IS 'Stores detailed progress events for real-time tracking';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Cleans up expired workflow sessions'; 