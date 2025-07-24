-- Session History Dashboard Database Schema
-- Migration: 003_add_session_history_features.sql

-- Extend otis_workflow_sessions table with session history features
ALTER TABLE otis_workflow_sessions 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_jobs INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_companies INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_contacts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_campaigns INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS workflow_state JSONB DEFAULT '{}';

-- Add performance indexes for session history queries
CREATE INDEX IF NOT EXISTS idx_otis_sessions_user_id ON otis_workflow_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_otis_sessions_created_at ON otis_workflow_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otis_sessions_completed_at ON otis_workflow_sessions(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_otis_sessions_status_created ON otis_workflow_sessions(status, created_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN otis_workflow_sessions.completed_at IS 'Timestamp when the workflow session was completed';
COMMENT ON COLUMN otis_workflow_sessions.total_jobs IS 'Total number of jobs scraped in this session';
COMMENT ON COLUMN otis_workflow_sessions.total_companies IS 'Total number of companies enriched in this session';
COMMENT ON COLUMN otis_workflow_sessions.total_contacts IS 'Total number of contacts found in this session';
COMMENT ON COLUMN otis_workflow_sessions.total_campaigns IS 'Total number of campaigns created in this session';
COMMENT ON COLUMN otis_workflow_sessions.workflow_state IS 'Serialized workflow state for session resume functionality';

-- Create function to update session metrics when workflow data changes
CREATE OR REPLACE FUNCTION update_session_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update session metrics based on workflow data changes
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update scraping metrics
        IF NEW.stage_name = 'scraping' THEN
            UPDATE otis_workflow_sessions 
            SET total_jobs = COALESCE((NEW.data->>'totalJobs')::INTEGER, 0)
            WHERE id = NEW.session_id;
        END IF;
        
        -- Update enrichment metrics
        IF NEW.stage_name = 'enrichment' THEN
            UPDATE otis_workflow_sessions 
            SET total_companies = COALESCE((NEW.data->>'totalCompanies')::INTEGER, 0),
                total_contacts = COALESCE((NEW.data->>'totalContacts')::INTEGER, 0)
            WHERE id = NEW.session_id;
        END IF;
        
        -- Update campaign metrics
        IF NEW.stage_name = 'campaigns' THEN
            UPDATE otis_workflow_sessions 
            SET total_campaigns = COALESCE((NEW.data->>'totalCampaigns')::INTEGER, 0)
            WHERE id = NEW.session_id;
        END IF;
        
        -- Mark session as completed when all stages are done
        IF NEW.stage_name = 'results' THEN
            UPDATE otis_workflow_sessions 
            SET completed_at = NOW(),
                status = 'completed'
            WHERE id = NEW.session_id AND status = 'active';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update session metrics
DROP TRIGGER IF EXISTS update_session_metrics_trigger ON otis_workflow_data;
CREATE TRIGGER update_session_metrics_trigger
    AFTER INSERT OR UPDATE ON otis_workflow_data
    FOR EACH ROW
    EXECUTE FUNCTION update_session_metrics();

-- Create function to serialize workflow state
CREATE OR REPLACE FUNCTION serialize_workflow_state(session_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    workflow_state JSONB;
    session_data RECORD;
BEGIN
    -- Get session info
    SELECT * INTO session_data 
    FROM otis_workflow_sessions 
    WHERE id = session_uuid;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Build workflow state
    workflow_state = jsonb_build_object(
        'sessionId', session_data.session_id,
        'currentStage', session_data.current_stage,
        'status', session_data.status,
        'createdAt', session_data.created_at,
        'completedAt', session_data.completed_at,
        'metrics', jsonb_build_object(
            'totalJobs', session_data.total_jobs,
            'totalCompanies', session_data.total_companies,
            'totalContacts', session_data.total_contacts,
            'totalCampaigns', session_data.total_campaigns
        ),
        'stageData', (
            SELECT jsonb_object_agg(stage_name, data)
            FROM otis_workflow_data
            WHERE session_id = session_uuid
        )
    );
    
    RETURN workflow_state;
END;
$$ language 'plpgsql';

-- Create function to get session history for a user
CREATE OR REPLACE FUNCTION get_user_session_history(
    user_uuid UUID,
    limit_count INTEGER DEFAULT 10,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    session_id VARCHAR,
    status VARCHAR,
    current_stage VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_jobs INTEGER,
    total_companies INTEGER,
    total_contacts INTEGER,
    total_campaigns INTEGER,
    duration_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ows.id,
        ows.session_id,
        ows.status,
        ows.current_stage,
        ows.created_at,
        ows.completed_at,
        ows.total_jobs,
        ows.total_companies,
        ows.total_contacts,
        ows.total_campaigns,
        CASE 
            WHEN ows.completed_at IS NOT NULL THEN
                EXTRACT(EPOCH FROM (ows.completed_at - ows.created_at)) / 60
            ELSE
                EXTRACT(EPOCH FROM (NOW() - ows.created_at)) / 60
        END::INTEGER as duration_minutes
    FROM otis_workflow_sessions ows
    WHERE ows.user_id = user_uuid
    ORDER BY ows.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ language 'plpgsql';

-- Grant necessary permissions
-- These might need to be adjusted based on your Supabase RLS policies

-- Insert sample data for testing (optional)
-- INSERT INTO otis_workflow_sessions (session_id, user_id, status, current_stage, total_jobs, total_companies, total_contacts, total_campaigns, completed_at)
-- VALUES 
--     ('test_session_1', auth.uid(), 'completed', 'results', 142, 38, 89, 2, NOW() - INTERVAL '2 hours'),
--     ('test_session_2', auth.uid(), 'completed', 'results', 98, 25, 67, 1, NOW() - INTERVAL '1 day'),
--     ('test_session_3', auth.uid(), 'active', 'enrichment', 75, 20, 0, 0, NULL)
-- ON CONFLICT (session_id) DO NOTHING; 