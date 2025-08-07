-- Migration: 015_add_enrichment_completion_function.sql
-- Add function for atomic enrichment completion processing

-- Create enrichment notifications table for real-time updates
CREATE TABLE IF NOT EXISTS enrichment_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    batch_id TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for real-time queries
CREATE INDEX IF NOT EXISTS idx_enrichment_notifications_created_at 
ON enrichment_notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_notifications_company_id 
ON enrichment_notifications(company_id);

-- Function to atomically process enrichment completion
CREATE OR REPLACE FUNCTION process_enrichment_completion(
    p_company_id UUID,
    p_batch_id TEXT,
    p_success BOOLEAN,
    p_contacts_found INTEGER DEFAULT 0,
    p_enrichment_data JSONB DEFAULT '{}',
    p_error_message TEXT DEFAULT NULL
)
RETURNS TABLE(
    updated_companies INTEGER,
    updated_enrichment_status INTEGER,
    batch_completed BOOLEAN
) AS $$
DECLARE
    v_batch_db_id UUID;
    v_updated_companies INTEGER := 0;
    v_updated_enrichment_status INTEGER := 0;
    v_batch_completed BOOLEAN := FALSE;
    v_total_companies INTEGER;
    v_completed_companies INTEGER;
    v_failed_companies INTEGER;
BEGIN
    -- Get batch database ID
    SELECT id INTO v_batch_db_id
    FROM enrichment_batches
    WHERE batch_id = p_batch_id;
    
    IF v_batch_db_id IS NULL THEN
        RAISE EXCEPTION 'Batch not found: %', p_batch_id;
    END IF;
    
    -- Start transaction
    BEGIN
        -- Update enrichment_status
        UPDATE enrichment_status
        SET 
            status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
            contacts_found = p_contacts_found,
            enriched_data = p_enrichment_data,
            error_message = p_error_message,
            processing_completed_at = NOW(),
            updated_at = NOW()
        WHERE batch_id = v_batch_db_id AND company_id = p_company_id;
        
        GET DIAGNOSTICS v_updated_enrichment_status = ROW_COUNT;
        
        -- Update companies table if successful
        IF p_success THEN
            UPDATE companies
            SET 
                apollo_enriched_at = NOW(),
                apollo_contacts_count = p_contacts_found,
                apollo_enrichment_data = p_enrichment_data,
                enrichment_status = 'completed',
                updated_at = NOW()
            WHERE id = p_company_id;
            
            GET DIAGNOSTICS v_updated_companies = ROW_COUNT;
        ELSE
            -- Mark company enrichment as failed
            UPDATE companies
            SET 
                enrichment_status = 'failed',
                updated_at = NOW()
            WHERE id = p_company_id;
            
            GET DIAGNOSTICS v_updated_companies = ROW_COUNT;
        END IF;
        
        -- Check if batch is complete
        SELECT 
            total_companies,
            COUNT(*) FILTER (WHERE status = 'completed'),
            COUNT(*) FILTER (WHERE status = 'failed')
        INTO v_total_companies, v_completed_companies, v_failed_companies
        FROM enrichment_batches eb
        JOIN enrichment_status es ON eb.id = es.batch_id
        WHERE eb.id = v_batch_db_id
        GROUP BY eb.total_companies;
        
        -- Update batch if complete
        IF (v_completed_companies + v_failed_companies) >= v_total_companies THEN
            UPDATE enrichment_batches
            SET 
                status = 'completed',
                completed_companies = v_completed_companies,
                failed_companies = v_failed_companies,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = v_batch_db_id;
            
            v_batch_completed := TRUE;
        ELSE
            -- Update progress
            UPDATE enrichment_batches
            SET 
                completed_companies = v_completed_companies,
                failed_companies = v_failed_companies,
                updated_at = NOW()
            WHERE id = v_batch_db_id;
        END IF;
        
        -- Insert notification for real-time updates
        INSERT INTO enrichment_notifications (
            company_id,
            batch_id,
            notification_type,
            data
        ) VALUES (
            p_company_id,
            p_batch_id,
            CASE WHEN p_success THEN 'enrichment_completed' ELSE 'enrichment_failed' END,
            jsonb_build_object(
                'success', p_success,
                'contacts_found', p_contacts_found,
                'batch_completed', v_batch_completed
            )
        );
        
    EXCEPTION WHEN OTHERS THEN
        -- Rollback and re-raise
        RAISE;
    END;
    
    RETURN QUERY SELECT v_updated_companies, v_updated_enrichment_status, v_batch_completed;
END;
$$ LANGUAGE plpgsql;

-- Function to get enrichment progress
CREATE OR REPLACE FUNCTION get_enrichment_progress(p_batch_id TEXT)
RETURNS TABLE(
    batch_id TEXT,
    status TEXT,
    total_companies INTEGER,
    completed_companies INTEGER,
    failed_companies INTEGER,
    processing_companies INTEGER,
    progress_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        eb.batch_id,
        eb.status,
        eb.total_companies,
        COUNT(*) FILTER (WHERE es.status = 'completed')::INTEGER as completed_companies,
        COUNT(*) FILTER (WHERE es.status = 'failed')::INTEGER as failed_companies,
        COUNT(*) FILTER (WHERE es.status = 'processing')::INTEGER as processing_companies,
        CASE 
            WHEN eb.total_companies > 0 THEN
                ROUND(
                    (COUNT(*) FILTER (WHERE es.status IN ('completed', 'failed'))::NUMERIC / eb.total_companies) * 100,
                    2
                )
            ELSE 0
        END as progress_percentage
    FROM enrichment_batches eb
    LEFT JOIN enrichment_status es ON eb.id = es.batch_id
    WHERE eb.batch_id = p_batch_id
    GROUP BY eb.batch_id, eb.status, eb.total_companies;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for new table (adjust as needed)
-- ALTER TABLE enrichment_notifications ENABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON FUNCTION process_enrichment_completion IS 'Atomically processes enrichment completion and updates all related tables';
COMMENT ON FUNCTION get_enrichment_progress IS 'Gets real-time enrichment progress for a batch';
COMMENT ON TABLE enrichment_notifications IS 'Stores notifications for real-time enrichment updates';