-- Add session_name column to otis_workflow_sessions table
ALTER TABLE otis_workflow_sessions 
ADD COLUMN IF NOT EXISTS session_name VARCHAR(255);

-- Add index for session_name for better performance
CREATE INDEX IF NOT EXISTS idx_otis_workflow_sessions_session_name 
ON otis_workflow_sessions(session_name);

-- Update existing sessions to have a default name if they don't have one
UPDATE otis_workflow_sessions 
SET session_name = 'Session ' || session_id 
WHERE session_name IS NULL; 