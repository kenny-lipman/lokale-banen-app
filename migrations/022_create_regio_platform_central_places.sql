-- Migration: Create regio_platform_central_places table
-- This table maps each regio_platform to its optimal central place for job posting scraping

-- Create the main table
CREATE TABLE IF NOT EXISTS public.regio_platform_central_places (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    regio_platform VARCHAR NOT NULL UNIQUE,
    central_place VARCHAR NOT NULL,
    central_postcode VARCHAR,
    scraping_priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_regio_platform_central_places_platform ON public.regio_platform_central_places(regio_platform);
CREATE INDEX IF NOT EXISTS idx_regio_platform_central_places_active ON public.regio_platform_central_places(is_active);
CREATE INDEX IF NOT EXISTS idx_regio_platform_central_places_priority ON public.regio_platform_central_places(scraping_priority);

-- Enable Row Level Security
ALTER TABLE public.regio_platform_central_places ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for security
-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to all users" ON public.regio_platform_central_places
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow write access only to service role (for admin operations)
CREATE POLICY "Allow write access to service role" ON public.regio_platform_central_places
    FOR ALL USING (auth.role() = 'service_role');

-- Create or replace the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic updated_at timestamp updates
CREATE TRIGGER update_regio_platform_central_places_updated_at 
    BEFORE UPDATE ON public.regio_platform_central_places 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.regio_platform_central_places IS 'Maps each regio_platform to its optimal central place for job posting scraping';
COMMENT ON COLUMN public.regio_platform_central_places.regio_platform IS 'The platform identifier (e.g., ZaanseBanen, AmsterdamBanen)';
COMMENT ON COLUMN public.regio_platform_central_places.central_place IS 'The optimal place to scrape job postings from for this platform';
COMMENT ON COLUMN public.regio_platform_central_places.central_postcode IS 'The postcode of the central place';
COMMENT ON COLUMN public.regio_platform_central_places.scraping_priority IS 'Priority level for scraping (1 = highest priority)';
COMMENT ON COLUMN public.regio_platform_central_places.is_active IS 'Whether this central place mapping is currently active'; 