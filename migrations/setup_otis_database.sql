-- =====================================================
-- Otis Workflow Database Setup
-- Run this script in your Supabase SQL Editor
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. Create workflow session management tables
-- =====================================================

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

-- =====================================================
-- 2. Create workflow data storage table
-- =====================================================

CREATE TABLE IF NOT EXISTS otis_workflow_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES otis_workflow_sessions(id) ON DELETE CASCADE,
    stage_name VARCHAR(50) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, stage_name)
);

-- =====================================================
-- 3. Create progress events table for tracking workflow progress
-- =====================================================

CREATE TABLE IF NOT EXISTS otis_progress_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES otis_workflow_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. Create indexes for better performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_otis_workflow_sessions_session_id ON otis_workflow_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_otis_workflow_sessions_user_id ON otis_workflow_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_otis_workflow_sessions_status ON otis_workflow_sessions(status);
CREATE INDEX IF NOT EXISTS idx_otis_workflow_data_session_id ON otis_workflow_data(session_id);
CREATE INDEX IF NOT EXISTS idx_otis_progress_events_session_id ON otis_progress_events(session_id);
CREATE INDEX IF NOT EXISTS idx_otis_progress_events_created_at ON otis_progress_events(created_at);

-- =====================================================
-- 5. Create function to update the updated_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- 6. Create triggers to automatically update updated_at
-- =====================================================

DROP TRIGGER IF EXISTS update_otis_workflow_sessions_updated_at ON otis_workflow_sessions;
CREATE TRIGGER update_otis_workflow_sessions_updated_at 
    BEFORE UPDATE ON otis_workflow_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_otis_workflow_data_updated_at ON otis_workflow_data;
CREATE TRIGGER update_otis_workflow_data_updated_at 
    BEFORE UPDATE ON otis_workflow_data 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. Create RLS (Row Level Security) policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE otis_workflow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE otis_workflow_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE otis_progress_events ENABLE ROW LEVEL SECURITY;

-- Create policies for otis_workflow_sessions
CREATE POLICY "Users can view their own workflow sessions" ON otis_workflow_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workflow sessions" ON otis_workflow_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflow sessions" ON otis_workflow_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Create policies for otis_workflow_data
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

-- Create policies for otis_progress_events
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

-- =====================================================
-- 8. Insert sample data for testing
-- =====================================================

-- Insert a sample session for testing (only if no sessions exist)
INSERT INTO otis_workflow_sessions (session_id, current_stage, status) 
SELECT 
    'test_session_' || EXTRACT(EPOCH FROM NOW())::bigint,
    'scraping',
    'active'
WHERE NOT EXISTS (SELECT 1 FROM otis_workflow_sessions LIMIT 1);

-- =====================================================
-- 9. Verify the setup
-- =====================================================

-- Check if tables were created successfully
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'otis_%'
ORDER BY table_name;

-- Check if indexes were created
SELECT 
    indexname,
    tablename
FROM pg_indexes 
WHERE tablename LIKE 'otis_%'
ORDER BY tablename, indexname;

-- Check if triggers were created
SELECT 
    trigger_name,
    event_object_table
FROM information_schema.triggers 
WHERE event_object_table LIKE 'otis_%'
ORDER BY event_object_table, trigger_name;

-- =====================================================
-- Setup Complete!
-- =====================================================

-- You should see:
-- - 3 tables: otis_workflow_sessions, otis_workflow_data, otis_progress_events
-- - 6 indexes for performance
-- - 2 triggers for automatic timestamp updates
-- - RLS policies for security
-- - 1 sample session for testing 