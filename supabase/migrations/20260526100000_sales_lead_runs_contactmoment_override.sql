-- contactmoment_override: optioneel een specifieke datum die in OTIS handmatig
-- gezet kan worden. Als NULL: PipedriveSync valt terug op nextWorkday(today,
-- owner.contactmoment_offset_workdays) zoals voorheen.

alter table sales_lead_runs
  add column contactmoment_override date;

comment on column sales_lead_runs.contactmoment_override is
  'Optionele datum-override voor het contactmoment-veld in de Pipedrive Deal. '
  'NULL = gebruik owner.contactmoment_offset_workdays (default volgende werkdag).';
