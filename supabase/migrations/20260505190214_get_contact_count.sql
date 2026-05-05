-- Cap-counting RPC voor /contacten lijst.
-- Vervangt count: 'exact' op de PostgREST query (timeout-prone op 595k contacts
-- met inner join + datum/tekstfilters) door cap-pattern (LIMIT 10001).
--
-- UI rendert "10.000+" zodra is_capped = true.

CREATE OR REPLACE FUNCTION public.get_contact_count(
  search_term text DEFAULT NULL,
  in_campaign text DEFAULT NULL,           -- 'with' | 'without' | null
  has_email text DEFAULT NULL,             -- 'with' | 'without' | null
  category_status text[] DEFAULT NULL,     -- qualification_status array
  company_status text[] DEFAULT NULL,      -- companies.status array (kan 'null' bevatten)
  company_start text[] DEFAULT NULL,       -- companies.start array (zelfde)
  company_size text[] DEFAULT NULL,        -- companies.category_size array
  pipedrive_filter text DEFAULT NULL,      -- 'synced' | 'not_synced' | null
  instantly_filter text DEFAULT NULL,      -- 'synced' | 'not_synced' | null
  platform_company_ids uuid[] DEFAULT NULL,-- pre-resolved via mv_company_platforms
  date_from timestamptz DEFAULT NULL,
  date_to timestamptz DEFAULT NULL
)
RETURNS TABLE(row_count bigint, is_capped boolean)
LANGUAGE plpgsql
STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  cap_plus_one INTEGER := 10001;
  total BIGINT;
  needs_company_join BOOLEAN := (
    company_status IS NOT NULL OR
    company_start IS NOT NULL OR
    company_size IS NOT NULL
  );
BEGIN
  -- Inner join op companies alleen als company-filters actief zijn.
  IF needs_company_join THEN
    SELECT COUNT(*) INTO total FROM (
      SELECT 1
      FROM contacts c
      INNER JOIN companies co ON c.company_id = co.id
      WHERE
        (search_term IS NULL OR search_term = '' OR
          c.first_name ILIKE '%' || search_term || '%' OR
          c.last_name ILIKE '%' || search_term || '%' OR
          c.email ILIKE '%' || search_term || '%')
        AND (in_campaign IS NULL OR
             (in_campaign = 'with' AND c.campaign_id IS NOT NULL) OR
             (in_campaign = 'without' AND c.campaign_id IS NULL))
        AND (has_email IS NULL OR
             (has_email = 'with' AND c.email IS NOT NULL AND c.email <> '') OR
             (has_email = 'without' AND (c.email IS NULL OR c.email = '')))
        AND (category_status IS NULL OR array_length(category_status, 1) IS NULL
             OR c.qualification_status = ANY(category_status))
        AND (company_status IS NULL OR array_length(company_status, 1) IS NULL
             OR (co.status = ANY(company_status))
             OR ('null' = ANY(company_status) AND co.status IS NULL))
        AND (company_start IS NULL OR array_length(company_start, 1) IS NULL
             OR (co.start::text = ANY(company_start))
             OR ('null' = ANY(company_start) AND co.start IS NULL))
        AND (company_size IS NULL OR array_length(company_size, 1) IS NULL
             OR (co.category_size = ANY(company_size))
             OR ('null' = ANY(company_size) AND co.category_size IS NULL))
        AND (pipedrive_filter IS NULL OR
             (pipedrive_filter = 'synced' AND c.pipedrive_synced = true) OR
             (pipedrive_filter = 'not_synced' AND (c.pipedrive_synced IS NULL OR c.pipedrive_synced = false)))
        AND (instantly_filter IS NULL OR
             (instantly_filter = 'synced' AND c.instantly_synced = true) OR
             (instantly_filter = 'not_synced' AND (c.instantly_synced IS NULL OR c.instantly_synced = false)))
        AND (platform_company_ids IS NULL OR array_length(platform_company_ids, 1) IS NULL
             OR c.company_id = ANY(platform_company_ids))
        AND (date_from IS NULL OR c.created_at >= date_from)
        AND (date_to IS NULL OR c.created_at <= date_to)
      LIMIT cap_plus_one
    ) sub;
  ELSE
    SELECT COUNT(*) INTO total FROM (
      SELECT 1
      FROM contacts c
      WHERE
        (search_term IS NULL OR search_term = '' OR
          c.first_name ILIKE '%' || search_term || '%' OR
          c.last_name ILIKE '%' || search_term || '%' OR
          c.email ILIKE '%' || search_term || '%')
        AND (in_campaign IS NULL OR
             (in_campaign = 'with' AND c.campaign_id IS NOT NULL) OR
             (in_campaign = 'without' AND c.campaign_id IS NULL))
        AND (has_email IS NULL OR
             (has_email = 'with' AND c.email IS NOT NULL AND c.email <> '') OR
             (has_email = 'without' AND (c.email IS NULL OR c.email = '')))
        AND (category_status IS NULL OR array_length(category_status, 1) IS NULL
             OR c.qualification_status = ANY(category_status))
        AND (pipedrive_filter IS NULL OR
             (pipedrive_filter = 'synced' AND c.pipedrive_synced = true) OR
             (pipedrive_filter = 'not_synced' AND (c.pipedrive_synced IS NULL OR c.pipedrive_synced = false)))
        AND (instantly_filter IS NULL OR
             (instantly_filter = 'synced' AND c.instantly_synced = true) OR
             (instantly_filter = 'not_synced' AND (c.instantly_synced IS NULL OR c.instantly_synced = false)))
        AND (platform_company_ids IS NULL OR array_length(platform_company_ids, 1) IS NULL
             OR c.company_id = ANY(platform_company_ids))
        AND (date_from IS NULL OR c.created_at >= date_from)
        AND (date_to IS NULL OR c.created_at <= date_to)
      LIMIT cap_plus_one
    ) sub;
  END IF;

  RETURN QUERY SELECT total, (total >= cap_plus_one);
END;
$function$;

COMMENT ON FUNCTION public.get_contact_count IS
  'Capped count voor /contacten (LIMIT 10001). UI rendert "10.000+" als is_capped.';
