-- Migration: Add Real-time Triggers for Otis UX Enhancement
-- Description: Creates PostgreSQL triggers for real-time WebSocket notifications
-- Date: December 2024
-- Author: Database Engineer

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create function to notify WebSocket clients about progress updates
CREATE OR REPLACE FUNCTION notify_otis_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify about changes to enrichment_status table
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

-- Create function to notify about apify_runs updates
CREATE OR REPLACE FUNCTION notify_apify_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify about changes to apify_runs table
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

-- Create function to notify about workflow session updates
CREATE OR REPLACE FUNCTION notify_workflow_session()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify about changes to otis_workflow_sessions table
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

-- Create triggers for enrichment_status table
DROP TRIGGER IF EXISTS enrichment_status_notify ON enrichment_status;
CREATE TRIGGER enrichment_status_notify
  AFTER INSERT OR UPDATE ON enrichment_status
  FOR EACH ROW EXECUTE FUNCTION notify_otis_progress();

-- Create triggers for apify_runs table
DROP TRIGGER IF EXISTS apify_runs_notify ON apify_runs;
CREATE TRIGGER apify_runs_notify
  AFTER INSERT OR UPDATE ON apify_runs
  FOR EACH ROW EXECUTE FUNCTION notify_apify_progress();

-- Create triggers for otis_workflow_sessions table (will be created in next migration)
-- DROP TRIGGER IF EXISTS workflow_sessions_notify ON otis_workflow_sessions;
-- CREATE TRIGGER workflow_sessions_notify
--   AFTER INSERT OR UPDATE ON otis_workflow_sessions
--   FOR EACH ROW EXECUTE FUNCTION notify_workflow_session();

-- Create indexes for better performance on real-time queries
CREATE INDEX IF NOT EXISTS idx_enrichment_status_batch_id ON enrichment_status(batch_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_status_status ON enrichment_status(status);
CREATE INDEX IF NOT EXISTS idx_apify_runs_status ON apify_runs(status);
CREATE INDEX IF NOT EXISTS idx_apify_runs_created_at ON apify_runs(created_at);

-- Add comments for documentation
COMMENT ON FUNCTION notify_otis_progress() IS 'Notifies WebSocket clients about enrichment status changes';
COMMENT ON FUNCTION notify_apify_progress() IS 'Notifies WebSocket clients about Apify scraping progress';
COMMENT ON FUNCTION notify_workflow_session() IS 'Notifies WebSocket clients about workflow session changes';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_otis_progress() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_apify_progress() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_workflow_session() TO authenticated; 