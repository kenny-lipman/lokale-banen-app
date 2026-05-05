-- Single-call counts RPC voor /companies tabs.
-- Vervangt 5 parallelle getCompanies()-calls met count: 'exact' (timeout-prone)
-- door één RPC met cap-pattern (LIMIT 10001 per status).
--
-- UI rendert "10.000+" zodra is_capped voor die status.
--
-- Note: hasContacts filter wordt NIET ondersteund (vereist contacts subquery,
-- te duur voor count). Als die filter actief is, geeft frontend hem niet mee
-- en de count is dan voor "alle records" (filter werkt nog wel op de listing).

CREATE OR REPLACE FUNCTION public.get_company_counts(
  search_term text DEFAULT NULL,
  is_customer_filter boolean DEFAULT NULL,
  source_filter text DEFAULT NULL,
  status_filter text DEFAULT NULL,
  website_filter text DEFAULT NULL,             -- 'with' | 'without' | null
  category_size_filter text[] DEFAULT NULL,
  apollo_enriched_filter text DEFAULT NULL,     -- 'enriched' | 'not_enriched' | null
  regio_platform_filter text[] DEFAULT NULL,
  subdomeinen_filter text[] DEFAULT NULL,
  pipedrive_filter text DEFAULT NULL,           -- 'synced' | 'not_synced' | null
  instantly_filter text DEFAULT NULL,           -- 'synced' | 'not_synced' | null
  date_from timestamptz DEFAULT NULL,
  date_to timestamptz DEFAULT NULL
)
RETURNS TABLE(qualification_status text, row_count bigint, is_capped boolean)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  cap_plus_one INTEGER := 10001;
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT c.qualification_status::text AS qs
    FROM companies c
    WHERE
      (search_term IS NULL OR search_term = '' OR
        c.name ILIKE '%' || search_term || '%' OR
        c.location ILIKE '%' || search_term || '%')
      AND (is_customer_filter IS NULL OR c.is_customer = is_customer_filter)
      AND (source_filter IS NULL OR c.source = source_filter)
      AND (status_filter IS NULL OR c.status = status_filter)
      AND (
        website_filter IS NULL OR
        (website_filter = 'with' AND c.website IS NOT NULL AND c.website <> ''
                                  AND c.website NOT ILIKE '%null%' AND c.website NOT ILIKE '%undefined%')
        OR (website_filter = 'without' AND (c.website IS NULL OR c.website = ''
                                            OR c.website ILIKE '%null%' OR c.website ILIKE '%undefined%'))
      )
      AND (category_size_filter IS NULL OR array_length(category_size_filter, 1) IS NULL
           OR c.category_size = ANY(category_size_filter))
      AND (
        apollo_enriched_filter IS NULL OR
        (apollo_enriched_filter = 'enriched' AND c.apollo_enriched_at IS NOT NULL) OR
        (apollo_enriched_filter = 'not_enriched' AND c.apollo_enriched_at IS NULL)
      )
      AND (regio_platform_filter IS NULL OR array_length(regio_platform_filter, 1) IS NULL
           OR c.hoofddomein = ANY(regio_platform_filter))
      AND (subdomeinen_filter IS NULL OR array_length(subdomeinen_filter, 1) IS NULL
           OR c.subdomeinen && subdomeinen_filter)
      AND (
        pipedrive_filter IS NULL OR
        (pipedrive_filter = 'synced' AND c.pipedrive_synced = true) OR
        (pipedrive_filter = 'not_synced' AND (c.pipedrive_synced IS NULL OR c.pipedrive_synced = false))
      )
      AND (
        instantly_filter IS NULL OR
        (instantly_filter = 'synced' AND c.pipedrive_id IS NOT NULL) OR
        (instantly_filter = 'not_synced' AND c.pipedrive_id IS NULL)
      )
      AND (date_from IS NULL OR c.created_at >= date_from)
      AND (date_to IS NULL OR c.created_at <= date_to)
  ),
  -- Cap per status: stop tellen na 10001 hits.
  capped AS (
    SELECT s.status,
      (SELECT COUNT(*) FROM (
        SELECT 1 FROM base
        WHERE COALESCE(qs, 'pending') = s.status
        LIMIT cap_plus_one
      ) sub) AS n
    FROM unnest(ARRAY['pending','qualified','review','disqualified','enriched']) AS s(status)
  )
  SELECT capped.status, capped.n, (capped.n >= cap_plus_one) AS is_capped
  FROM capped;
END;
$function$;

COMMENT ON FUNCTION public.get_company_counts IS
  'Per-qualification_status counts met cap-pattern (10001). Vervangt 5 parallelle exact-count queries.';
