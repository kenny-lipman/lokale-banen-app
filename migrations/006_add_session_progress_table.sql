-- Migration: Add session progress tracking table
-- This table tracks progress for each stage of the workflow

CREATE TABLE IF NOT EXISTS session_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES workflow_sessions(sessionId) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL CHECK (stage IN ('scraping', 'enrichment', 'campaigns', 'results')),
  total INTEGER DEFAULT 0 CHECK (total >= 0),
  completed INTEGER DEFAULT 0 CHECK (completed >= 0),
  failed INTEGER DEFAULT 0 CHECK (failed >= 0),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique progress per session and stage
  UNIQUE(session_id, stage)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_session_progress_session_id ON session_progress(session_id);
CREATE INDEX IF NOT EXISTS idx_session_progress_stage ON session_progress(stage);
CREATE INDEX IF NOT EXISTS idx_session_progress_status ON session_progress(status);
CREATE INDEX IF NOT EXISTS idx_session_progress_updated_at ON session_progress(updated_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_session_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_progress_updated_at
  BEFORE UPDATE ON session_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_session_progress_updated_at();

-- Add RLS policies for session_progress table
ALTER TABLE session_progress ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see progress for their own sessions
CREATE POLICY "Users can view their own session progress" ON session_progress
  FOR SELECT USING (
    session_id IN (
      SELECT sessionId FROM workflow_sessions 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert progress for their own sessions
CREATE POLICY "Users can insert their own session progress" ON session_progress
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT sessionId FROM workflow_sessions 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update progress for their own sessions
CREATE POLICY "Users can update their own session progress" ON session_progress
  FOR UPDATE USING (
    session_id IN (
      SELECT sessionId FROM workflow_sessions 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can delete progress for their own sessions
CREATE POLICY "Users can delete their own session progress" ON session_progress
  FOR DELETE USING (
    session_id IN (
      SELECT sessionId FROM workflow_sessions 
      WHERE user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE session_progress IS 'Tracks progress for each stage of the OTIS workflow';
COMMENT ON COLUMN session_progress.session_id IS 'Reference to the workflow session';
COMMENT ON COLUMN session_progress.stage IS 'The workflow stage (scraping, enrichment, campaigns, results)';
COMMENT ON COLUMN session_progress.total IS 'Total number of items to process';
COMMENT ON COLUMN session_progress.completed IS 'Number of items completed successfully';
COMMENT ON COLUMN session_progress.failed IS 'Number of items that failed';
COMMENT ON COLUMN session_progress.status IS 'Current status of the stage'; 