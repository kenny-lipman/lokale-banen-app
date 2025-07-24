-- Create workflow session management tables
CREATE TABLE IF NOT EXISTS otis_workflow_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    current_stage VARCHAR(50) NOT NULL DEFAULT 'scraping',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Create workflow data storage table
CREATE TABLE IF NOT EXISTS otis_workflow_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES otis_workflow_sessions(id) ON DELETE CASCADE,
    stage_name VARCHAR(50) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, stage_name)
);

-- Create progress events table for tracking workflow progress
CREATE TABLE IF NOT EXISTS otis_progress_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES otis_workflow_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_otis_workflow_sessions_session_id ON otis_workflow_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_otis_workflow_sessions_user_id ON otis_workflow_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_otis_workflow_sessions_status ON otis_workflow_sessions(status);
CREATE INDEX IF NOT EXISTS idx_otis_workflow_data_session_id ON otis_workflow_data(session_id);
CREATE INDEX IF NOT EXISTS idx_otis_progress_events_session_id ON otis_progress_events(session_id);
CREATE INDEX IF NOT EXISTS idx_otis_progress_events_created_at ON otis_progress_events(created_at);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_otis_workflow_sessions_updated_at 
    BEFORE UPDATE ON otis_workflow_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_otis_workflow_data_updated_at 
    BEFORE UPDATE ON otis_workflow_data 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert a sample session for testing
INSERT INTO otis_workflow_sessions (session_id, current_stage, status) 
VALUES ('test_session_' || EXTRACT(EPOCH FROM NOW())::bigint, 'scraping', 'active')
ON CONFLICT (session_id) DO NOTHING; 