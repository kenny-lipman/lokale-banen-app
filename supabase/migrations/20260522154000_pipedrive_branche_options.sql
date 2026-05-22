-- pipedrive_branche_options: Tenant-level mapping van Pipedrive Branche-enum (veld key 5a467ae0...)
-- naar SBI-prefixes. Single source of truth voor de WeTarget Pipedrive-instance.
-- Service-role-only access, geen RLS-policies (zoals sales_lead_runs / enrichment_cache).

create table pipedrive_branche_options (
  id                          uuid primary key default gen_random_uuid(),
  pipedrive_enum_id           integer not null unique,
  label                       text not null,
  sort_order                  integer not null default 0,
  sbi_prefixes                text[] not null default '{}',
  active                      boolean not null default true,
  synced_from_pipedrive_at    timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index idx_pdb_options_active on pipedrive_branche_options (active, sort_order);
create index idx_pdb_options_sbi on pipedrive_branche_options using gin (sbi_prefixes);

alter table pipedrive_branche_options enable row level security;

comment on table pipedrive_branche_options is
  'Tenant-level Pipedrive Branche-enum opties (veld 5a467ae0..., 12 opties per 2026-05-22). '
  'Beheerd via /admin/instellingen/branche-mapping, gesynced uit Pipedrive API. '
  'sbi_prefixes is onze business-logic (2-digit SBI -> branche), label/enum_id komen uit Pipedrive.';

-- Auto-update updated_at. search_path leeg om function_search_path_mutable advisor te vermijden.
create or replace function pipedrive_branche_options_touch_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end$$;

create trigger trg_pdb_options_updated_at
  before update on pipedrive_branche_options
  for each row execute function pipedrive_branche_options_touch_updated_at();

-- Seed: 12 huidige opties uit Pipedrive (key 5a467ae0..., fetched 2026-05-22)
-- met initiele SBI-prefix mapping. Sierteelt en Voedselbranche zijn smal; Mistral
-- vult de meeste edge-cases in via classificatie.
insert into pipedrive_branche_options
  (pipedrive_enum_id, label, sort_order, sbi_prefixes, synced_from_pipedrive_at) values
  (286, 'Automotive',                                  10, array['45'],                                                                                                          now()),
  (287, 'Bouw + gerelateerd',                          20, array['41','42','43'],                                                                                                now()),
  (288, 'Detailhandel, groothandel en ambachten',      30, array['46','47'],                                                                                                     now()),
  (289, 'Horeca & Toerisme',                           40, array['55','56'],                                                                                                     now()),
  (290, 'Leisure',                                     50, array['90','91','92','93'],                                                                                           now()),
  (291, 'Logistiek',                                   60, array['52'],                                                                                                          now()),
  (292, 'Sierteelt',                                   70, array['01','02'],                                                                                                     now()),
  (435, 'Techniek',                                    80, array['25','26','27','28','29','30','31','32','33'],                                                                  now()),
  (293, 'Transport',                                   90, array['49','50','51','53'],                                                                                           now()),
  (294, 'Voedselbranche',                             100, array['10','11'],                                                                                                     now()),
  (295, 'Zakelijke en persoonlijke dienstverlening',  110, array['58','59','60','61','62','63','64','65','66','68','69','70','71','72','73','74','75','77','78','79','80','81','82','84','94','95','96'], now()),
  (296, 'Zorg + onderwijs',                           120, array['85','86','87','88'],                                                                                           now());
