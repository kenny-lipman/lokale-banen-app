-- Voegt branche_override toe aan sales_lead_runs zodat sales in OTIS de Mistral-
-- suggestion kunnen overrulen voor de Pipedrive sync. Waarde matcht
-- pipedrive_branche_options.pipedrive_enum_id; FK is informeel (geen DB-constraint
-- omdat opties als 'inactive' gemarkeerd kunnen worden zonder de waarde te raken).

alter table sales_lead_runs
  add column branche_override integer;

comment on column sales_lead_runs.branche_override is
  'Optionele override van branche-enum (uit pipedrive_branche_options). Wint van '
  'master_record.branche_suggestion bij Pipedrive-sync. NULL = geen override, gebruik suggestion of SBI-fallback.';
