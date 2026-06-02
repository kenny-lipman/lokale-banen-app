-- Queue-vlag voor career-page detail-verrijking.
-- Alleen gezet op job_postings die via de sales-lead career-page-flow zijn aangemaakt
-- (upsertJobPostingsFromRun). De inline website-stap verrijkt waar mogelijk al en zet
-- de vlag op false; de overflow + mislukkingen worden door de cron
-- career-page-detail-scrape opgepakt, die de detailpagina ophaalt en
-- salary/description/uren/opleiding/niveau vult en detail_scraped_at zet.
-- Bewust GEEN NULL-based marker: dat zou elke bestaande/toekomstige rij van andere
-- scrapers (werkenindekempen, Apify) in de queue trekken.
ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS needs_detail_scrape boolean NOT NULL DEFAULT false;

-- Tijdstip van laatste detail-scrape-poging (observability; null = nooit geprobeerd).
ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS detail_scraped_at timestamptz;

-- Smalle partial index: bevat alleen de rijen die nog detail-verrijking nodig hebben.
CREATE INDEX IF NOT EXISTS idx_job_postings_needs_detail_scrape
  ON job_postings (created_at)
  WHERE needs_detail_scrape;
