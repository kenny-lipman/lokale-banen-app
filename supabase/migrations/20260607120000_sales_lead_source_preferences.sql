-- Globale OTIS source preferences voor configureerbare reviewvelden.
-- Niet-configureerbare velden (company_name, kvk_number, website) blijven hardcoded
-- in de master-record logica en horen hier niet in opgeslagen te worden.

create table if not exists sales_lead_source_preferences (
  field_name text primary key,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint sales_lead_source_preferences_field_check
    check (field_name in ('address', 'industry', 'employee_count', 'phone', 'email')),
  constraint sales_lead_source_preferences_source_check
    check (source in ('kvk', 'google_maps', 'apollo', 'website'))
);

alter table sales_lead_source_preferences enable row level security;

comment on table sales_lead_source_preferences is
  'Globale OTIS source preferences per configureerbaar reviewveld. Ontbrekende rijen vallen terug op app-defaults.';
comment on column sales_lead_source_preferences.field_name is
  'Configureerbaar NormalizedFields veld: address, industry, employee_count, phone of email.';
comment on column sales_lead_source_preferences.source is
  'Voorkeursbron voor dit veld: kvk, google_maps, apollo of website.';
comment on column sales_lead_source_preferences.updated_by is
  'Laatste admin/gebruiker die deze globale preference via de API heeft aangepast.';

create or replace function sales_lead_source_preferences_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sales_lead_source_preferences_updated_at
  on sales_lead_source_preferences;
create trigger trg_sales_lead_source_preferences_updated_at
  before update on sales_lead_source_preferences
  for each row execute function sales_lead_source_preferences_touch_updated_at();
