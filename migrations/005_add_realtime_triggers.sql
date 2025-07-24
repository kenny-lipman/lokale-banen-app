-- Migration: Add real-time triggers for OTIS workflow sessions
-- This enables automatic WebSocket notifications when data changes

-- Enable the pg_notify extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_notify;

-- Create a function to notify WebSocket connections of session updates
CREATE OR REPLACE FUNCTION notify_session_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify all listeners about the session update
    PERFORM pg_notify(
        'session_update',
        json_build_object(
            'session_id', NEW.session_id,
            'type', 'session_update',
            'data', json_build_object(
                'current_stage', NEW.current_stage,
                'status', NEW.status,
                'total_jobs', NEW.total_jobs,
                'total_companies', NEW.total_companies,
                'total_contacts', NEW.total_contacts,
                'scraping_status', NEW.scraping_status,
                'job_count', NEW.job_count,
                'updated_at', NEW.updated_at
            ),
            'timestamp', NOW()
        )::text
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to notify about enrichment progress
CREATE OR REPLACE FUNCTION notify_enrichment_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify about enrichment progress updates
    PERFORM pg_notify(
        'enrichment_progress',
        json_build_object(
            'session_id', NEW.session_id,
            'type', 'enrichment_progress_update',
            'data', json_build_object(
                'total_companies', NEW.total_companies,
                'total_jobs', NEW.total_jobs,
                'enrichment_status', NEW.status,
                'timestamp', NOW()
            ),
            'timestamp', NOW()
        )::text
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to notify about new companies found
CREATE OR REPLACE FUNCTION notify_new_companies()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if companies count increased
    IF NEW.total_companies > OLD.total_companies THEN
        PERFORM pg_notify(
            'new_companies',
            json_build_object(
                'session_id', NEW.session_id,
                'type', 'new_companies_found',
                'data', json_build_object(
                    'new_companies', NEW.total_companies - OLD.total_companies,
                    'total_companies', NEW.total_companies,
                    'timestamp', NOW()
                ),
                'timestamp', NOW()
            )::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to notify about new jobs found
CREATE OR REPLACE FUNCTION notify_new_jobs()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if jobs count increased
    IF NEW.total_jobs > OLD.total_jobs THEN
        PERFORM pg_notify(
            'new_jobs',
            json_build_object(
                'session_id', NEW.session_id,
                'type', 'new_jobs_found',
                'data', json_build_object(
                    'new_jobs', NEW.total_jobs - OLD.total_jobs,
                    'total_jobs', NEW.total_jobs,
                    'timestamp', NOW()
                ),
                'timestamp', NOW()
            )::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to notify about stage changes
CREATE OR REPLACE FUNCTION notify_stage_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if stage actually changed
    IF NEW.current_stage != OLD.current_stage THEN
        PERFORM pg_notify(
            'stage_change',
            json_build_object(
                'session_id', NEW.session_id,
                'type', 'stage_change',
                'data', json_build_object(
                    'previous_stage', OLD.current_stage,
                    'current_stage', NEW.current_stage,
                    'status', NEW.status,
                    'timestamp', NOW()
                ),
                'timestamp', NOW()
            )::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for the otis_workflow_sessions table
DROP TRIGGER IF EXISTS trigger_session_update ON otis_workflow_sessions;
CREATE TRIGGER trigger_session_update
    AFTER UPDATE ON otis_workflow_sessions
    FOR EACH ROW
    EXECUTE FUNCTION notify_session_update();

DROP TRIGGER IF EXISTS trigger_enrichment_progress ON otis_workflow_sessions;
CREATE TRIGGER trigger_enrichment_progress
    AFTER UPDATE ON otis_workflow_sessions
    FOR EACH ROW
    WHEN (OLD.total_companies IS DISTINCT FROM NEW.total_companies OR 
          OLD.total_jobs IS DISTINCT FROM NEW.total_jobs OR
          OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION notify_enrichment_progress();

DROP TRIGGER IF EXISTS trigger_new_companies ON otis_workflow_sessions;
CREATE TRIGGER trigger_new_companies
    AFTER UPDATE ON otis_workflow_sessions
    FOR EACH ROW
    WHEN (NEW.total_companies > OLD.total_companies)
    EXECUTE FUNCTION notify_new_companies();

DROP TRIGGER IF EXISTS trigger_new_jobs ON otis_workflow_sessions;
CREATE TRIGGER trigger_new_jobs
    AFTER UPDATE ON otis_workflow_sessions
    FOR EACH ROW
    WHEN (NEW.total_jobs > OLD.total_jobs)
    EXECUTE FUNCTION notify_new_jobs();

DROP TRIGGER IF EXISTS trigger_stage_change ON otis_workflow_sessions;
CREATE TRIGGER trigger_stage_change
    AFTER UPDATE ON otis_workflow_sessions
    FOR EACH ROW
    WHEN (NEW.current_stage IS DISTINCT FROM OLD.current_stage)
    EXECUTE FUNCTION notify_stage_change();

-- Create a function to get session-specific notifications
CREATE OR REPLACE FUNCTION get_session_notifications(session_id_param TEXT)
RETURNS TABLE (
    channel_name TEXT,
    payload TEXT
) AS $$
BEGIN
    -- Return notifications for the specific session
    RETURN QUERY
    SELECT 
        'session_' || session_id_param as channel_name,
        json_build_object(
            'session_id', session_id_param,
            'type', 'session_specific_update',
            'timestamp', NOW()
        )::text as payload;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better trigger performance
CREATE INDEX IF NOT EXISTS idx_otis_sessions_session_id ON otis_workflow_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_otis_sessions_updated_at ON otis_workflow_sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_otis_sessions_status ON otis_workflow_sessions(status);
CREATE INDEX IF NOT EXISTS idx_otis_sessions_current_stage ON otis_workflow_sessions(current_stage);

-- Add comments for documentation
COMMENT ON FUNCTION notify_session_update() IS 'Notifies WebSocket connections about session updates';
COMMENT ON FUNCTION notify_enrichment_progress() IS 'Notifies about enrichment progress changes';
COMMENT ON FUNCTION notify_new_companies() IS 'Notifies when new companies are found';
COMMENT ON FUNCTION notify_new_jobs() IS 'Notifies when new jobs are found';
COMMENT ON FUNCTION notify_stage_change() IS 'Notifies when workflow stage changes';
COMMENT ON FUNCTION get_session_notifications(TEXT) IS 'Gets session-specific notifications'; 