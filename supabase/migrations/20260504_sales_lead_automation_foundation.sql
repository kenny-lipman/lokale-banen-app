-- Sales Lead Automation — Foundation
-- Spec: docs/superpowers/specs/2026-05-04-sales-lead-automation-design.md (sectie 4)

-- ============================================================
-- 1. sales_lead_owner_config — 4 dealeigenaars (UI-beheerd)
-- ============================================================
CREATE TABLE sales_lead_owner_config (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key                           text UNIQUE NOT NULL,
  label                         text NOT NULL,
  pipedrive_user_id             bigint NOT NULL,
  pipedrive_pipeline_id         int NOT NULL,
  pipedrive_default_stage_id    int NOT NULL,
  hoofddomein_strategy          text NOT NULL CHECK (hoofddomein_strategy IN ('fixed','auto_match_by_address')),
  hoofddomein_fixed_value       text,
  wetarget_flag_value           smallint NOT NULL DEFAULT 301,
  contactmoment_field_key       text,
  contactmoment_offset_workdays smallint NOT NULL DEFAULT 1,
  is_active                     boolean NOT NULL DEFAULT true,
  display_order                 int NOT NULL DEFAULT 100,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sales_lead_owner_config ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. sales_lead_runs — 1 rij per ingevoerde URL
-- ============================================================
CREATE TABLE sales_lead_runs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  created_by                  uuid REFERENCES auth.users(id),
  input_url                   text NOT NULL,
  input_domain                text NOT NULL,
  owner_config_id             uuid NOT NULL REFERENCES sales_lead_owner_config(id),
  manual_vacancies            jsonb NOT NULL DEFAULT '[]'::jsonb,
  scrape_vacancies            boolean NOT NULL DEFAULT true,
  status                      text NOT NULL DEFAULT 'enriching'
                              CHECK (status IN ('enriching','review','syncing','completed','failed','duplicate')),
  enrichments                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  master_record               jsonb,
  selected_contacts           jsonb NOT NULL DEFAULT '[]'::jsonb,
  pipedrive_org_id            bigint,
  pipedrive_deal_id           bigint,
  pipedrive_person_ids        bigint[] NOT NULL DEFAULT '{}',
  existing_pipedrive_org_id   bigint,
  audit_log                   jsonb NOT NULL DEFAULT '[]'::jsonb,
  error                       text
);
CREATE INDEX idx_sales_lead_runs_created_by ON sales_lead_runs(created_by, created_at DESC);
CREATE INDEX idx_sales_lead_runs_status ON sales_lead_runs(status);
CREATE INDEX idx_sales_lead_runs_domain ON sales_lead_runs(input_domain);
ALTER TABLE sales_lead_runs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. enrichment_cache — generieke cache (KvK / Apollo / Maps / Pipedrive-meta)
-- ============================================================
CREATE TABLE enrichment_cache (
  source       text NOT NULL,
  cache_key    text NOT NULL,
  response     jsonb NOT NULL,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  PRIMARY KEY (source, cache_key)
);
CREATE INDEX idx_enrichment_cache_expires ON enrichment_cache(expires_at);
ALTER TABLE enrichment_cache ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. ALTER bestaande job_sources — career-page support
-- (8 bestaande aggregator-rijen krijgen via DEFAULT kind='aggregator')
-- ============================================================
ALTER TABLE job_sources ADD COLUMN kind text NOT NULL DEFAULT 'aggregator'
  CHECK (kind IN ('aggregator','company_career_page'));
ALTER TABLE job_sources ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE job_sources ADD COLUMN url text;
ALTER TABLE job_sources ADD COLUMN discovery_method text
  CHECK (discovery_method IS NULL OR discovery_method IN ('sitemap','robots','common_path','html_link','manual'));
ALTER TABLE job_sources ADD COLUMN is_external_ats boolean DEFAULT false;
ALTER TABLE job_sources ADD COLUMN ats_type text;
ALTER TABLE job_sources ADD COLUMN created_via text
  CHECK (created_via IS NULL OR created_via IN ('sales_lead_run','manual','seed'));
ALTER TABLE job_sources ADD COLUMN source_run_id uuid REFERENCES sales_lead_runs(id);
ALTER TABLE job_sources ADD COLUMN scrape_frequency text DEFAULT 'weekly'
  CHECK (scrape_frequency IN ('daily','weekly','monthly','manual'));
ALTER TABLE job_sources ADD COLUMN last_scraped_at timestamptz;
ALTER TABLE job_sources ADD COLUMN last_scrape_status text;
ALTER TABLE job_sources ADD COLUMN last_scrape_count int;
ALTER TABLE job_sources ADD COLUMN consecutive_failures int NOT NULL DEFAULT 0;
ALTER TABLE job_sources ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE job_sources ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE job_sources ADD CONSTRAINT job_sources_career_page_completeness CHECK (
  kind = 'aggregator'
  OR (kind = 'company_career_page' AND company_id IS NOT NULL AND url IS NOT NULL AND discovery_method IS NOT NULL)
);

CREATE INDEX idx_job_sources_kind ON job_sources(kind);
CREATE INDEX idx_job_sources_company ON job_sources(company_id) WHERE kind='company_career_page';
CREATE INDEX idx_job_sources_active_next ON job_sources(scrape_frequency, last_scraped_at)
  WHERE kind='company_career_page' AND active=true;
CREATE UNIQUE INDEX idx_job_sources_company_url ON job_sources(company_id, url) WHERE kind='company_career_page';
