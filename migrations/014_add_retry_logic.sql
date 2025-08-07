-- Migration: 014_add_retry_logic.sql
-- Add retry logic and circuit breaker fields to enrichment tables

-- Add retry-related columns to enrichment_status table
ALTER TABLE enrichment_status 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS failure_reason TEXT,
ADD COLUMN IF NOT EXISTS retry_scheduled_at TIMESTAMP WITH TIME ZONE;

-- Add circuit breaker status to enrichment_batches table
ALTER TABLE enrichment_batches 
ADD COLUMN IF NOT EXISTS retry_policy JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS circuit_breaker_status TEXT DEFAULT 'closed' CHECK (circuit_breaker_status IN ('open', 'closed', 'half_open'));

-- Update status constraints to include new retry statuses
ALTER TABLE enrichment_status DROP CONSTRAINT IF EXISTS enrichment_status_status_check;
ALTER TABLE enrichment_status 
ADD CONSTRAINT enrichment_status_status_check 
CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'queued_for_retry'));

-- Add indexes for retry queries
CREATE INDEX IF NOT EXISTS idx_enrichment_status_retry_scheduled 
ON enrichment_status(retry_scheduled_at) 
WHERE retry_scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrichment_status_retry_count 
ON enrichment_status(retry_count) 
WHERE retry_count > 0;

CREATE INDEX IF NOT EXISTS idx_enrichment_batches_circuit_breaker 
ON enrichment_batches(circuit_breaker_status) 
WHERE circuit_breaker_status != 'closed';

-- Add function to automatically retry failed enrichments
CREATE OR REPLACE FUNCTION schedule_retry_enrichments()
RETURNS INTEGER AS $$
DECLARE
    retry_count INTEGER := 0;
BEGIN
    -- Mark enrichments that are ready for retry
    UPDATE enrichment_status 
    SET 
        status = 'queued',
        retry_scheduled_at = NULL,
        updated_at = NOW()
    WHERE 
        status = 'queued_for_retry' 
        AND retry_scheduled_at IS NOT NULL 
        AND retry_scheduled_at <= NOW()
        AND retry_count < 3; -- Max 3 retry attempts
    
    GET DIAGNOSTICS retry_count = ROW_COUNT;
    
    RETURN retry_count;
END;
$$ LANGUAGE plpgsql;

-- Add function to get retry statistics
CREATE OR REPLACE FUNCTION get_retry_statistics()
RETURNS TABLE(
    total_retries BIGINT,
    successful_retries BIGINT,
    failed_retries BIGINT,
    pending_retries BIGINT,
    avg_retry_count NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE retry_count > 0) as total_retries,
        COUNT(*) FILTER (WHERE retry_count > 0 AND status = 'completed') as successful_retries,
        COUNT(*) FILTER (WHERE retry_count > 0 AND status = 'failed') as failed_retries,
        COUNT(*) FILTER (WHERE status = 'queued_for_retry') as pending_retries,
        AVG(retry_count) FILTER (WHERE retry_count > 0) as avg_retry_count
    FROM enrichment_status;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON COLUMN enrichment_status.retry_count IS 'Number of retry attempts for this enrichment';
COMMENT ON COLUMN enrichment_status.last_retry_at IS 'Timestamp of the last retry attempt';
COMMENT ON COLUMN enrichment_status.failure_reason IS 'Classification of the failure reason for retry logic';
COMMENT ON COLUMN enrichment_status.retry_scheduled_at IS 'When this enrichment is scheduled for retry';
COMMENT ON COLUMN enrichment_batches.retry_policy IS 'JSON configuration for retry behavior';
COMMENT ON COLUMN enrichment_batches.circuit_breaker_status IS 'Circuit breaker status for this batch type';

-- Grant necessary permissions for the new functions
-- (Adjust based on your RLS setup)
-- GRANT EXECUTE ON FUNCTION schedule_retry_enrichments() TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_retry_statistics() TO authenticated;