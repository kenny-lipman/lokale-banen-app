-- Add session naming and metadata fields to otis_workflow_sessions table
ALTER TABLE otis_workflow_sessions 
ADD COLUMN IF NOT EXISTS session_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS session_type VARCHAR(50) DEFAULT 'quick',
ADD COLUMN IF NOT EXISTS template_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Update existing sessions with default names
UPDATE otis_workflow_sessions 
SET session_name = CONCAT('Session ', session_id)
WHERE session_name IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_otis_sessions_name ON otis_workflow_sessions(session_name);
CREATE INDEX IF NOT EXISTS idx_otis_sessions_type ON otis_workflow_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_otis_sessions_created_at ON otis_workflow_sessions(created_at);

-- Add comments for documentation
COMMENT ON COLUMN otis_workflow_sessions.session_name IS 'Human-readable name for the session';
COMMENT ON COLUMN otis_workflow_sessions.session_type IS 'Type of session: quick, deep, custom';
COMMENT ON COLUMN otis_workflow_sessions.template_name IS 'Name of the template used for this session';
COMMENT ON COLUMN otis_workflow_sessions.metadata IS 'Additional metadata for the session'; 