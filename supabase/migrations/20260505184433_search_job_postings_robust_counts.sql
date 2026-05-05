-- Robuuste counts en CTE-first listing voor search_job_postings
--
-- Wijzigingen t.o.v. vorige versie:
--   1. Count subquery LIMIT 1001 → 10001 (matches /review-counts cap_plus_one).
--      UI rendert "10.000+" zodra capped, anders exacte count.
--   2. Nieuwe return-kolom `is_capped boolean` (true wanneer total >= 10001).
--   3. Listing in MATERIALIZED CTE: filter+sort+limit op job_postings eerst,
--      dan pas joins op companies/job_sources/platforms. Voorkomt timeouts
--      bij 170k archived rows / 1M+ pending rows.
--   4. Archief tab sorteert op archived_at DESC (gebruikt idx_jp_archived ~15ms);
--      met created_at DESC koos planner verkeerde index → 26s.

DROP FUNCTION IF EXISTS public.search_job_postings(
  text, text, uuid[], uuid[], timestamptz, timestamptz, text[], numeric, numeric,
  text[], text[], numeric, numeric, integer, integer, text, text
);

CREATE OR REPLACE FUNCTION public.search_job_postings(
  search_term text DEFAULT NULL,
  status_filter text DEFAULT NULL,
  source_filter uuid[] DEFAULT NULL,
  platform_filter uuid[] DEFAULT NULL,
  date_from timestamptz DEFAULT NULL,
  date_to timestamptz DEFAULT NULL,
  employment_filter text[] DEFAULT NULL,
  salary_min numeric DEFAULT NULL,
  salary_max numeric DEFAULT NULL,
  career_level_filter text[] DEFAULT NULL,
  education_level_filter text[] DEFAULT NULL,
  hours_min numeric DEFAULT NULL,
  hours_max numeric DEFAULT NULL,
  page_number integer DEFAULT 1,
  page_size integer DEFAULT 10,
  review_status_filter text DEFAULT NULL,
  archived_filter text DEFAULT 'active'
)
RETURNS TABLE(
  id uuid, title text, location text, status text, review_status text, scraped_at timestamptz,
  job_type text[], salary text, url text, country text, source_id uuid, platform_id uuid,
  company_id uuid, company_name text, company_website text, company_logo_url text,
  company_rating_indeed numeric, company_is_customer boolean, source_name text,
  platform_regio_platform text, total_count bigint, is_capped boolean,
  description text, employment text, career_level text, education_level text,
  working_hours_min numeric, working_hours_max numeric, categories text, end_date date,
  city text, zipcode text, street text, created_at timestamptz,
  lokalebanen_pushed_at timestamptz, archived_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  offset_val INT;
  total BIGINT;
  capped BOOLEAN;
  has_filters BOOLEAN;
  has_text_search BOOLEAN;
  ts_query tsquery;
  matching_company_ids uuid[];
  search_lower TEXT;
  cap_plus_one INTEGER := 10001;
BEGIN
  IF archived_filter NOT IN ('active', 'archived', 'all') THEN
    RAISE EXCEPTION 'Invalid archived_filter: %. Must be one of: active, archived, all',
      archived_filter USING ERRCODE = '22023';
  END IF;

  offset_val := (page_number - 1) * page_size;
  has_text_search := (search_term IS NOT NULL AND search_term != '');

  IF has_text_search THEN
    ts_query := plainto_tsquery('simple', search_term);
    search_lower := LOWER(search_term);
    PERFORM set_limit(0.3);
    SELECT ARRAY_AGG(c.id) INTO matching_company_ids
    FROM companies c WHERE c.name % search_term LIMIT 1000;
  END IF;

  has_filters := (
    has_text_search OR status_filter IS NOT NULL OR review_status_filter IS NOT NULL OR
    archived_filter != 'all' OR
    (source_filter IS NOT NULL AND array_length(source_filter, 1) > 0) OR
    (platform_filter IS NOT NULL AND array_length(platform_filter, 1) > 0) OR
    date_from IS NOT NULL OR date_to IS NOT NULL OR
    (employment_filter IS NOT NULL AND array_length(employment_filter, 1) > 0) OR
    salary_min IS NOT NULL OR salary_max IS NOT NULL OR
    (career_level_filter IS NOT NULL AND array_length(career_level_filter, 1) > 0) OR
    (education_level_filter IS NOT NULL AND array_length(education_level_filter, 1) > 0) OR
    hours_min IS NOT NULL OR hours_max IS NOT NULL
  );

  -- COUNT (cap_plus_one)
  IF NOT has_filters THEN
    SELECT COALESCE(reltuples::bigint, 500000) INTO total
    FROM pg_class WHERE relname = 'job_postings';
    capped := false;
  ELSIF has_text_search THEN
    SELECT COUNT(*) INTO total FROM (
      SELECT 1 FROM job_postings jp
      WHERE (jp.search_vector @@ ts_query
             OR (matching_company_ids IS NOT NULL AND jp.company_id = ANY(matching_company_ids)))
        AND (status_filter IS NULL OR jp.status = status_filter)
        AND (review_status_filter IS NULL OR jp.review_status = review_status_filter)
        AND ((archived_filter = 'active' AND jp.archived_at IS NULL)
             OR (archived_filter = 'archived' AND jp.archived_at IS NOT NULL)
             OR (archived_filter = 'all'))
        AND (source_filter IS NULL OR array_length(source_filter, 1) IS NULL OR jp.source_id = ANY(source_filter))
        AND (platform_filter IS NULL OR array_length(platform_filter, 1) IS NULL OR jp.platform_id = ANY(platform_filter))
        AND (date_from IS NULL OR jp.created_at >= date_from)
        AND (date_to IS NULL OR jp.created_at <= date_to)
        AND (employment_filter IS NULL OR array_length(employment_filter, 1) IS NULL OR jp.employment = ANY(employment_filter))
        AND (career_level_filter IS NULL OR array_length(career_level_filter, 1) IS NULL OR jp.career_level = ANY(career_level_filter))
        AND (education_level_filter IS NULL OR array_length(education_level_filter, 1) IS NULL OR jp.education_level = ANY(education_level_filter))
        AND ((hours_min IS NULL AND hours_max IS NULL) OR (jp.working_hours_min IS NOT NULL AND jp.working_hours_max IS NOT NULL
             AND (hours_min IS NULL OR jp.working_hours_min >= hours_min)
             AND (hours_max IS NULL OR jp.working_hours_max <= hours_max)))
      LIMIT cap_plus_one
    ) sub;
    capped := total >= cap_plus_one;
  ELSE
    SELECT COUNT(*) INTO total FROM (
      SELECT 1 FROM job_postings jp
      WHERE (status_filter IS NULL OR jp.status = status_filter)
        AND (review_status_filter IS NULL OR jp.review_status = review_status_filter)
        AND ((archived_filter = 'active' AND jp.archived_at IS NULL)
             OR (archived_filter = 'archived' AND jp.archived_at IS NOT NULL)
             OR (archived_filter = 'all'))
        AND (source_filter IS NULL OR array_length(source_filter, 1) IS NULL OR jp.source_id = ANY(source_filter))
        AND (platform_filter IS NULL OR array_length(platform_filter, 1) IS NULL OR jp.platform_id = ANY(platform_filter))
        AND (date_from IS NULL OR jp.created_at >= date_from)
        AND (date_to IS NULL OR jp.created_at <= date_to)
        AND (employment_filter IS NULL OR array_length(employment_filter, 1) IS NULL OR jp.employment = ANY(employment_filter))
        AND (career_level_filter IS NULL OR array_length(career_level_filter, 1) IS NULL OR jp.career_level = ANY(career_level_filter))
        AND (education_level_filter IS NULL OR array_length(education_level_filter, 1) IS NULL OR jp.education_level = ANY(education_level_filter))
        AND ((hours_min IS NULL AND hours_max IS NULL) OR (jp.working_hours_min IS NOT NULL AND jp.working_hours_max IS NOT NULL
             AND (hours_min IS NULL OR jp.working_hours_min >= hours_min)
             AND (hours_max IS NULL OR jp.working_hours_max <= hours_max)))
      LIMIT cap_plus_one
    ) sub;
    capped := total >= cap_plus_one;
  END IF;

  -- LIST (split per pad om planner naar juiste index te dwingen)
  IF has_text_search THEN
    -- Text-search: complexe ranking, joins inline
    RETURN QUERY
    SELECT
      jp.id, jp.title, jp.location, jp.status, jp.review_status, jp.scraped_at,
      jp.job_type, jp.salary, jp.url, jp.country, jp.source_id, jp.platform_id,
      c.id, c.name, c.website, c.logo_url, c.rating_indeed, c.is_customer,
      js.name, p.regio_platform::TEXT, total, capped,
      jp.description, jp.employment, jp.career_level, jp.education_level,
      jp.working_hours_min, jp.working_hours_max, jp.categories, jp.end_date,
      jp.city, jp.zipcode, jp.street, jp.created_at, jp.lokalebanen_pushed_at,
      jp.archived_at
    FROM job_postings jp
    INNER JOIN companies c ON jp.company_id = c.id
    INNER JOIN job_sources js ON jp.source_id = js.id
    LEFT JOIN platforms p ON jp.platform_id = p.id
    WHERE (jp.search_vector @@ ts_query
           OR (matching_company_ids IS NOT NULL AND jp.company_id = ANY(matching_company_ids)))
      AND (status_filter IS NULL OR jp.status = status_filter)
      AND (review_status_filter IS NULL OR jp.review_status = review_status_filter)
      AND ((archived_filter = 'active' AND jp.archived_at IS NULL)
           OR (archived_filter = 'archived' AND jp.archived_at IS NOT NULL)
           OR (archived_filter = 'all'))
      AND (source_filter IS NULL OR array_length(source_filter, 1) IS NULL OR jp.source_id = ANY(source_filter))
      AND (platform_filter IS NULL OR array_length(platform_filter, 1) IS NULL OR jp.platform_id = ANY(platform_filter))
      AND (date_from IS NULL OR jp.created_at >= date_from)
      AND (date_to IS NULL OR jp.created_at <= date_to)
      AND (employment_filter IS NULL OR array_length(employment_filter, 1) IS NULL OR jp.employment = ANY(employment_filter))
      AND (career_level_filter IS NULL OR array_length(career_level_filter, 1) IS NULL OR jp.career_level = ANY(career_level_filter))
      AND (education_level_filter IS NULL OR array_length(education_level_filter, 1) IS NULL OR jp.education_level = ANY(education_level_filter))
      AND ((hours_min IS NULL AND hours_max IS NULL) OR (jp.working_hours_min IS NOT NULL AND jp.working_hours_max IS NOT NULL
           AND (hours_min IS NULL OR jp.working_hours_min >= hours_min)
           AND (hours_max IS NULL OR jp.working_hours_max <= hours_max)))
    ORDER BY
      CASE WHEN LOWER(c.name) = search_lower THEN 0 ELSE 1 END,
      similarity(LOWER(c.name), search_lower) DESC,
      ts_rank(jp.search_vector, ts_query) DESC,
      jp.created_at DESC
    LIMIT page_size OFFSET offset_val;
  ELSIF archived_filter = 'archived' THEN
    -- Archief: ORDER BY archived_at DESC → idx_jp_archived (~15ms)
    RETURN QUERY
    WITH paged AS MATERIALIZED (
      SELECT jp.* FROM job_postings jp
      WHERE jp.archived_at IS NOT NULL
        AND (status_filter IS NULL OR jp.status = status_filter)
        AND (review_status_filter IS NULL OR jp.review_status = review_status_filter)
        AND (source_filter IS NULL OR array_length(source_filter, 1) IS NULL OR jp.source_id = ANY(source_filter))
        AND (platform_filter IS NULL OR array_length(platform_filter, 1) IS NULL OR jp.platform_id = ANY(platform_filter))
        AND (date_from IS NULL OR jp.created_at >= date_from)
        AND (date_to IS NULL OR jp.created_at <= date_to)
        AND (employment_filter IS NULL OR array_length(employment_filter, 1) IS NULL OR jp.employment = ANY(employment_filter))
        AND (career_level_filter IS NULL OR array_length(career_level_filter, 1) IS NULL OR jp.career_level = ANY(career_level_filter))
        AND (education_level_filter IS NULL OR array_length(education_level_filter, 1) IS NULL OR jp.education_level = ANY(education_level_filter))
        AND ((hours_min IS NULL AND hours_max IS NULL) OR (jp.working_hours_min IS NOT NULL AND jp.working_hours_max IS NOT NULL
             AND (hours_min IS NULL OR jp.working_hours_min >= hours_min)
             AND (hours_max IS NULL OR jp.working_hours_max <= hours_max)))
      ORDER BY jp.archived_at DESC
      LIMIT page_size OFFSET offset_val
    )
    SELECT
      paged.id, paged.title, paged.location, paged.status, paged.review_status, paged.scraped_at,
      paged.job_type, paged.salary, paged.url, paged.country, paged.source_id, paged.platform_id,
      c.id, c.name, c.website, c.logo_url, c.rating_indeed, c.is_customer,
      js.name, p.regio_platform::TEXT, total, capped,
      paged.description, paged.employment, paged.career_level, paged.education_level,
      paged.working_hours_min, paged.working_hours_max, paged.categories, paged.end_date,
      paged.city, paged.zipcode, paged.street, paged.created_at, paged.lokalebanen_pushed_at,
      paged.archived_at
    FROM paged
    LEFT JOIN companies c ON paged.company_id = c.id
    LEFT JOIN job_sources js ON paged.source_id = js.id
    LEFT JOIN platforms p ON paged.platform_id = p.id
    ORDER BY paged.archived_at DESC;
  ELSE
    -- Active / all: ORDER BY created_at DESC → idx_jp_active
    RETURN QUERY
    WITH paged AS MATERIALIZED (
      SELECT jp.* FROM job_postings jp
      WHERE (status_filter IS NULL OR jp.status = status_filter)
        AND (review_status_filter IS NULL OR jp.review_status = review_status_filter)
        AND ((archived_filter = 'active' AND jp.archived_at IS NULL)
             OR (archived_filter = 'all'))
        AND (source_filter IS NULL OR array_length(source_filter, 1) IS NULL OR jp.source_id = ANY(source_filter))
        AND (platform_filter IS NULL OR array_length(platform_filter, 1) IS NULL OR jp.platform_id = ANY(platform_filter))
        AND (date_from IS NULL OR jp.created_at >= date_from)
        AND (date_to IS NULL OR jp.created_at <= date_to)
        AND (employment_filter IS NULL OR array_length(employment_filter, 1) IS NULL OR jp.employment = ANY(employment_filter))
        AND (career_level_filter IS NULL OR array_length(career_level_filter, 1) IS NULL OR jp.career_level = ANY(career_level_filter))
        AND (education_level_filter IS NULL OR array_length(education_level_filter, 1) IS NULL OR jp.education_level = ANY(education_level_filter))
        AND ((hours_min IS NULL AND hours_max IS NULL) OR (jp.working_hours_min IS NOT NULL AND jp.working_hours_max IS NOT NULL
             AND (hours_min IS NULL OR jp.working_hours_min >= hours_min)
             AND (hours_max IS NULL OR jp.working_hours_max <= hours_max)))
      ORDER BY jp.created_at DESC
      LIMIT page_size OFFSET offset_val
    )
    SELECT
      paged.id, paged.title, paged.location, paged.status, paged.review_status, paged.scraped_at,
      paged.job_type, paged.salary, paged.url, paged.country, paged.source_id, paged.platform_id,
      c.id, c.name, c.website, c.logo_url, c.rating_indeed, c.is_customer,
      js.name, p.regio_platform::TEXT, total, capped,
      paged.description, paged.employment, paged.career_level, paged.education_level,
      paged.working_hours_min, paged.working_hours_max, paged.categories, paged.end_date,
      paged.city, paged.zipcode, paged.street, paged.created_at, paged.lokalebanen_pushed_at,
      paged.archived_at
    FROM paged
    LEFT JOIN companies c ON paged.company_id = c.id
    LEFT JOIN job_sources js ON paged.source_id = js.id
    LEFT JOIN platforms p ON paged.platform_id = p.id
    ORDER BY paged.created_at DESC;
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.search_job_postings IS
  'Search job postings with filters. Counts capped at 10001 (UI shows "10.000+"). MATERIALIZED CTE for index-scan-before-joins.';
