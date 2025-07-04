-- Create job_sources table
CREATE TABLE IF NOT EXISTS job_sources (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create regions table
CREATE TABLE IF NOT EXISTS regions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Netherlands',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    website TEXT,
    location VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create job_postings table
CREATE TABLE IF NOT EXISTS job_postings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    location VARCHAR(255),
    source_id UUID REFERENCES job_sources(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active',
    external_vacancy_id VARCHAR(255),
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_postings_company_id ON job_postings(company_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_source_id ON job_postings(source_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_external_vacancy_id ON job_postings(external_vacancy_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_scraped_at ON job_postings(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);

-- Create full-text search index
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_job_postings_search ON job_postings USING gin(search_vector);

-- Create trigger to update search_vector
CREATE OR REPLACE FUNCTION update_job_postings_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('dutch', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.location, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_postings_search_vector
    BEFORE INSERT OR UPDATE ON job_postings
    FOR EACH ROW EXECUTE FUNCTION update_job_postings_search_vector();

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_postings_updated_at
    BEFORE UPDATE ON job_postings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
