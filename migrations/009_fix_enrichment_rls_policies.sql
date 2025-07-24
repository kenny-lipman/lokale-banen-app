-- Fix RLS policies for enrichment tables
-- Migration: 009_fix_enrichment_rls_policies.sql

-- Disable RLS on enrichment tables since they're used by API routes
-- This allows the API routes to insert/update data without user context

-- Disable RLS on enrichment_batches table
ALTER TABLE enrichment_batches DISABLE ROW LEVEL SECURITY;

-- Disable RLS on enrichment_status table  
ALTER TABLE enrichment_status DISABLE ROW LEVEL SECURITY;

-- Add comment explaining why RLS is disabled
COMMENT ON TABLE enrichment_batches IS 'RLS disabled - used by API routes for batch processing';
COMMENT ON TABLE enrichment_status IS 'RLS disabled - used by API routes for individual company tracking'; 